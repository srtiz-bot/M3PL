/**
 * OAuth 2.1 authorization server for MCP clients.
 *
 * Implements what Claude Desktop / Claude Code expect:
 *   • RFC 9728 protected-resource metadata
 *   • RFC 8414 authorization-server metadata
 *   • RFC 7591 dynamic client registration
 *   • Authorization code + PKCE (S256 only)
 *   • Refresh tokens, rotated on every use with reuse detection
 *
 * The "sign in once" property comes from rotation with a sliding 90-day expiry
 * (decision D-004): an active user's refresh token keeps moving forward and
 * they never see a login screen again; an inactive one eventually lapses.
 */

import { randomToken, sha256Base64Url, sha256Hex, timingSafeEqual } from '../lib/crypto.js';
import { GatewayError } from '../lib/errors.js';
import { htmlResponse, jsonResponse, readForm, readJson, type RouteContext } from '../lib/http.js';
import {
  consumeAuthorizationCode,
  consumeState,
  createClient,
  findToken,
  getClient,
  putState,
  revokeChain,
  revokeToken,
  storeAuthorizationCode,
  storeToken,
} from '../db/oauth.js';
import { getUserById, upsertUserFromSignIn } from '../db/principals.js';
import { randomId } from '../lib/crypto.js';
import { assertAllowed, buildGoogleAuthUrl, exchangeGoogleCode } from './google.js';
import { page, escapeHtml } from './shopify-oauth.js';
import type { Env, Principal } from '../types.js';

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

/** RFC 9728 — tells a client which authorization server guards this resource. */
export function protectedResourceMetadata(env: Env): Response {
  return jsonResponse({
    resource: `${env.GATEWAY_URL}/mcp`,
    authorization_servers: [env.GATEWAY_URL],
    bearer_methods_supported: ['header'],
    resource_documentation: `${env.GATEWAY_URL}/`,
  });
}

/** RFC 8414 — the authorization server's own capabilities. */
export function authorizationServerMetadata(env: Env): Response {
  return jsonResponse({
    issuer: env.GATEWAY_URL,
    authorization_endpoint: `${env.GATEWAY_URL}/authorize`,
    token_endpoint: `${env.GATEWAY_URL}/token`,
    registration_endpoint: `${env.GATEWAY_URL}/register`,
    revocation_endpoint: `${env.GATEWAY_URL}/revoke`,
    scopes_supported: ['mcp'],
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    // S256 only. OAuth 2.1 removes `plain`, and allowing it would defeat PKCE.
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_post'],
  });
}

// ---------------------------------------------------------------------------
// Dynamic client registration (RFC 7591)
// ---------------------------------------------------------------------------

interface RegistrationRequest {
  client_name?: string;
  redirect_uris?: string[];
  token_endpoint_auth_method?: string;
}

/**
 * Open registration, deliberately.
 *
 * Registering a client grants nothing: every authorization still requires a
 * Google sign-in from an allowlisted domain, and every tool call still requires
 * a permission grant. Gating registration would break the zero-config client
 * setup that makes this pleasant to use, in exchange for no real security.
 */
export async function handleRegister(context: RouteContext): Promise<Response> {
  const body = await readJson<RegistrationRequest>(context.request);
  const redirectUris = body.redirect_uris ?? [];

  if (redirectUris.length === 0) {
    throw new GatewayError('VALIDATION_FAILED', 'redirect_uris is required.');
  }
  for (const uri of redirectUris) {
    assertValidRedirectUri(uri);
  }

  const isPublicClient = (body.token_endpoint_auth_method ?? 'none') === 'none';
  const clientSecret = isPublicClient ? null : `smcp_cs_${randomToken(32)}`;

  const client = await createClient(context.env, {
    clientName: body.client_name ?? 'Unnamed MCP client',
    redirectUris,
    clientSecretHash: clientSecret ? await sha256Hex(clientSecret) : null,
  });

  const response: Record<string, unknown> = {
    client_id: client.clientId,
    client_name: client.clientName,
    redirect_uris: client.redirectUris,
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: isPublicClient ? 'none' : 'client_secret_post',
    client_id_issued_at: Math.floor(client.createdAt / 1000),
  };
  if (clientSecret) response.client_secret = clientSecret;

  return jsonResponse(response, { status: 201 });
}

/**
 * Redirect URIs must be HTTPS, or loopback HTTP.
 *
 * The loopback exception is required — desktop MCP clients listen on
 * 127.0.0.1 — but is narrow: any other plaintext destination could leak an
 * authorization code over the network.
 */
function assertValidRedirectUri(uri: string): void {
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    throw new GatewayError('VALIDATION_FAILED', `Invalid redirect URI: ${uri}`);
  }

  const isLoopback =
    parsed.protocol === 'http:' &&
    (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost' || parsed.hostname === '[::1]');

  if (parsed.protocol !== 'https:' && !isLoopback) {
    throw new GatewayError(
      'VALIDATION_FAILED',
      `Redirect URIs must use https, or http on a loopback address. Got: ${uri}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Authorization endpoint
// ---------------------------------------------------------------------------

/**
 * GET /authorize
 *
 * Validates the client's request, then hands off to Google. The client's PKCE
 * challenge and redirect target ride along in signed-at-rest state so the
 * Google callback can complete the flow.
 */
export async function handleAuthorize(context: RouteContext): Promise<Response> {
  const { env, url } = context;
  const params = url.searchParams;

  const clientId = params.get('client_id');
  const redirectUri = params.get('redirect_uri');
  const responseType = params.get('response_type');
  const codeChallenge = params.get('code_challenge');
  const codeChallengeMethod = params.get('code_challenge_method');

  if (!clientId || !redirectUri) {
    throw new GatewayError('VALIDATION_FAILED', 'client_id and redirect_uri are required.');
  }

  const client = await getClient(env, clientId);
  if (!client) {
    throw new GatewayError('VALIDATION_FAILED', 'Unknown client_id. Register the client first.');
  }

  // Exact-match the redirect URI against what was registered. Prefix matching
  // here is a classic open-redirect / code-exfiltration hole.
  if (!client.redirectUris.includes(redirectUri)) {
    throw new GatewayError('VALIDATION_FAILED', 'redirect_uri does not match a registered URI for this client.');
  }

  // Past this point errors are returned to the client's redirect_uri per
  // OAuth's error model, since we have now verified where it is safe to send.
  if (responseType !== 'code') {
    return redirectWithError(redirectUri, params.get('state'), 'unsupported_response_type', 'Only response_type=code is supported.');
  }
  if (!codeChallenge || codeChallengeMethod !== 'S256') {
    return redirectWithError(
      redirectUri,
      params.get('state'),
      'invalid_request',
      'PKCE with code_challenge_method=S256 is required.',
    );
  }

  const state = await putState(env, {
    kind: 'google_signin',
    ttlSeconds: 900,
    payload: {
      clientId,
      redirectUri,
      codeChallenge,
      clientState: params.get('state'),
      scope: params.get('scope') ?? 'mcp',
      resource: params.get('resource'),
    },
  });

  return Response.redirect(buildGoogleAuthUrl(env, state), 302);
}

interface SignInState {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  clientState: string | null;
  scope: string;
  resource: string | null;
}

/**
 * GET /auth/google/callback
 *
 * Completes the Google leg, establishes the user, and issues our own
 * authorization code back to the MCP client.
 */
export async function handleGoogleCallback(context: RouteContext): Promise<Response> {
  const { env, url } = context;

  const googleError = url.searchParams.get('error');
  if (googleError) {
    return htmlResponse(
      page('Sign-in cancelled', `<p>Google reported: <code>${escapeHtml(googleError)}</code></p>`),
      400,
    );
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) {
    throw new GatewayError('VALIDATION_FAILED', 'Missing code or state from Google.');
  }

  const signInState = await consumeState<SignInState>(env, state, 'google_signin');
  if (!signInState) {
    return htmlResponse(
      page('Sign-in expired', '<p>This sign-in link has expired or was already used. Start again from your MCP client.</p>'),
      400,
    );
  }

  const identity = await exchangeGoogleCode(env, code);

  // Allowlist failures render as a page rather than redirecting an error back
  // to the client, because the person needs to read why they were refused.
  try {
    assertAllowed(identity, env);
  } catch (err) {
    const message = err instanceof GatewayError ? err.message : 'Sign-in refused.';
    return htmlResponse(page('Access denied', `<p>${escapeHtml(message)}</p>`), 403);
  }

  const user = await upsertUserFromSignIn(env, { email: identity.email, name: identity.name });

  const authorizationCode = randomToken(32);
  await storeAuthorizationCode(env, authorizationCode, {
    clientId: signInState.clientId,
    userId: user.id,
    redirectUri: signInState.redirectUri,
    codeChallenge: signInState.codeChallenge,
    scope: signInState.scope,
    resource: signInState.resource,
  });

  const redirect = new URL(signInState.redirectUri);
  redirect.searchParams.set('code', authorizationCode);
  if (signInState.clientState) redirect.searchParams.set('state', signInState.clientState);

  return Response.redirect(redirect.toString(), 302);
}

function redirectWithError(
  redirectUri: string,
  state: string | null,
  error: string,
  description: string,
): Response {
  const url = new URL(redirectUri);
  url.searchParams.set('error', error);
  url.searchParams.set('error_description', description);
  if (state) url.searchParams.set('state', state);
  return Response.redirect(url.toString(), 302);
}

// ---------------------------------------------------------------------------
// Token endpoint
// ---------------------------------------------------------------------------

export async function handleToken(context: RouteContext): Promise<Response> {
  const form = await readForm(context.request);
  const grantType = form.get('grant_type');

  switch (grantType) {
    case 'authorization_code':
      return exchangeAuthorizationCode(context, form);
    case 'refresh_token':
      return exchangeRefreshToken(context, form);
    default:
      return oauthError('unsupported_grant_type', `Unsupported grant_type: ${grantType ?? '(none)'}`);
  }
}

async function exchangeAuthorizationCode(
  context: RouteContext,
  form: URLSearchParams,
): Promise<Response> {
  const { env } = context;

  const code = form.get('code');
  const codeVerifier = form.get('code_verifier');
  const clientId = form.get('client_id');
  const redirectUri = form.get('redirect_uri');

  if (!code || !codeVerifier || !clientId) {
    return oauthError('invalid_request', 'code, code_verifier and client_id are required.');
  }

  const client = await getClient(env, clientId);
  if (!client) return oauthError('invalid_client', 'Unknown client.');

  if (client.clientSecretHash) {
    const provided = form.get('client_secret');
    if (!provided || !timingSafeEqual(await sha256Hex(provided), client.clientSecretHash)) {
      return oauthError('invalid_client', 'Client authentication failed.');
    }
  }

  const authorization = await consumeAuthorizationCode(env, code);
  if (!authorization) {
    return oauthError('invalid_grant', 'The authorization code is invalid, expired, or already used.');
  }
  if (authorization.clientId !== clientId) {
    return oauthError('invalid_grant', 'The authorization code was issued to a different client.');
  }
  if (redirectUri && redirectUri !== authorization.redirectUri) {
    return oauthError('invalid_grant', 'redirect_uri does not match the authorization request.');
  }

  // PKCE: SHA-256 the verifier and compare against the stored challenge. This
  // is what stops an intercepted code from being redeemed by anyone else.
  if (!timingSafeEqual(await sha256Base64Url(codeVerifier), authorization.codeChallenge)) {
    return oauthError('invalid_grant', 'PKCE verification failed.');
  }

  const user = await getUserById(env, authorization.userId);
  if (!user || user.status !== 'active') {
    return oauthError('invalid_grant', 'The user account is no longer active.');
  }

  return issueTokenPair(env, {
    principalType: 'user',
    principalId: user.id,
    clientId,
    scope: authorization.scope,
    chainId: randomId('chn'),
  });
}

/**
 * Refresh with rotation.
 *
 * Presenting an already-rotated refresh token means either a replay or theft;
 * either way the entire chain is revoked, which converts a silent compromise
 * into a visible re-authentication.
 */
async function exchangeRefreshToken(context: RouteContext, form: URLSearchParams): Promise<Response> {
  const { env } = context;

  const refreshToken = form.get('refresh_token');
  const clientId = form.get('client_id');
  if (!refreshToken) return oauthError('invalid_request', 'refresh_token is required.');

  const stored = await findToken(env, refreshToken, 'refresh');
  if (!stored) return oauthError('invalid_grant', 'Unknown refresh token.');

  if (stored.revokedAt !== null) {
    await revokeChain(env, stored.chainId);
    console.warn(
      JSON.stringify({
        level: 'warn',
        message: 'refresh_token_reuse_detected',
        chainId: stored.chainId,
        principalId: stored.principalId,
      }),
    );
    return oauthError('invalid_grant', 'This refresh token has already been used. Please sign in again.');
  }

  if (stored.expiresAt < Date.now()) {
    return oauthError('invalid_grant', 'The refresh token has expired. Please sign in again.');
  }
  if (clientId && stored.clientId && clientId !== stored.clientId) {
    return oauthError('invalid_grant', 'The refresh token was issued to a different client.');
  }

  const user = await getUserById(env, stored.principalId);
  if (!user || user.status !== 'active') {
    return oauthError('invalid_grant', 'The user account is no longer active.');
  }

  // Retire the presented token before issuing its replacement, so a concurrent
  // duplicate request trips the reuse check above rather than minting a second
  // live chain.
  await revokeToken(env, stored.id);

  return issueTokenPair(env, {
    principalType: 'user',
    principalId: stored.principalId,
    clientId: stored.clientId,
    scope: stored.scope,
    chainId: stored.chainId,
    rotatedFrom: stored.id,
  });
}

async function issueTokenPair(
  env: Env,
  params: {
    principalType: 'user';
    principalId: string;
    clientId: string | null;
    scope: string;
    chainId: string;
    rotatedFrom?: string;
  },
): Promise<Response> {
  const accessTtl = Number(env.ACCESS_TOKEN_TTL_SECONDS) || 3600;
  // The sliding window: each refresh restarts the 90 days, so a user who keeps
  // using the gateway never has to sign in again.
  const refreshTtl = Number(env.REFRESH_TOKEN_TTL_SECONDS) || 7_776_000;

  const accessToken = `smcp_at_${randomToken(32)}`;
  const refreshToken = `smcp_rt_${randomToken(32)}`;

  await storeToken(env, accessToken, {
    kind: 'access',
    principalType: params.principalType,
    principalId: params.principalId,
    clientId: params.clientId,
    scope: params.scope,
    chainId: params.chainId,
    ttlSeconds: accessTtl,
  });

  await storeToken(env, refreshToken, {
    kind: 'refresh',
    principalType: params.principalType,
    principalId: params.principalId,
    clientId: params.clientId,
    scope: params.scope,
    chainId: params.chainId,
    rotatedFrom: params.rotatedFrom ?? null,
    ttlSeconds: refreshTtl,
  });

  return jsonResponse({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: accessTtl,
    refresh_token: refreshToken,
    scope: params.scope,
  });
}

/** RFC 7009 token revocation. Always 200, per spec, to avoid a probing oracle. */
export async function handleRevoke(context: RouteContext): Promise<Response> {
  const form = await readForm(context.request);
  const token = form.get('token');
  if (!token) return jsonResponse({ ok: true });

  for (const kind of ['access', 'refresh'] as const) {
    const stored = await findToken(context.env, token, kind);
    if (stored) {
      await revokeChain(context.env, stored.chainId);
      break;
    }
  }
  return jsonResponse({ ok: true });
}

function oauthError(error: string, description: string): Response {
  const status = error === 'invalid_client' ? 401 : 400;
  return jsonResponse({ error, error_description: description }, { status });
}

// ---------------------------------------------------------------------------
// Bearer authentication for the MCP endpoint
// ---------------------------------------------------------------------------

/**
 * Resolve a bearer token to a principal.
 *
 * Handles both credential types: a user's OAuth access token, and a service
 * account's static token. Which one it is, is determined by lookup, not by
 * inspecting the prefix — the prefix is a human convenience only.
 */
export async function authenticateBearer(env: Env, token: string): Promise<Principal | null> {
  const stored = await findToken(env, token, 'access');
  if (stored) {
    if (stored.revokedAt !== null || stored.expiresAt < Date.now()) return null;

    const user = await getUserById(env, stored.principalId);
    if (!user || user.status !== 'active') return null;

    return { type: 'user', id: user.id, label: user.email, role: user.role };
  }

  const { authenticateServiceAccountToken } = await import('../db/principals.js');
  return authenticateServiceAccountToken(env, token);
}
