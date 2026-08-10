/**
 * Google Workspace identity federation.
 *
 * The gateway is the authorization server that MCP clients talk to, but it
 * does not own identity — Google does. That means no passwords stored here,
 * and offboarding someone in Workspace locks them out of the gateway too.
 */

import { fromBase64Url } from '../lib/crypto.js';
import { GatewayError } from '../lib/errors.js';
import type { Env } from '../types.js';

const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

export interface GoogleIdentity {
  email: string;
  name: string;
  /** Google Workspace hosted-domain claim. Absent for consumer gmail accounts. */
  hostedDomain: string | null;
  emailVerified: boolean;
}

export function buildGoogleAuthUrl(env: Env, state: string): string {
  const url = new URL(GOOGLE_AUTH_ENDPOINT);
  url.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
  url.searchParams.set('redirect_uri', `${env.GATEWAY_URL}/auth/google/callback`);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', state);
  // Ask Google to preselect the org's accounts. This is a UX hint only — the
  // real enforcement is the hd/email check in assertAllowed() below, because a
  // client can always drop this parameter.
  if (env.ALLOWED_EMAIL_DOMAINS) {
    const first = env.ALLOWED_EMAIL_DOMAINS.split(',')[0]?.trim();
    if (first) url.searchParams.set('hd', first);
  }
  return url.toString();
}

/**
 * Exchange a Google authorization code for an identity.
 *
 * Note on signature verification: the id_token is fetched directly from
 * Google's token endpoint over TLS, using our client secret. OIDC Core §3.1.3.7
 * explicitly permits skipping signature validation in this case, since the TLS
 * channel already authenticates the issuer. We still validate iss, aud and exp,
 * because those guard against a token minted for a different application.
 */
export async function exchangeGoogleCode(env: Env, code: string): Promise<GoogleIdentity> {
  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${env.GATEWAY_URL}/auth/google/callback`,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new GatewayError('UPSTREAM_ERROR', 'Google rejected the sign-in.', {
      details: { status: response.status, body: body.slice(0, 300) },
    });
  }

  const payload = (await response.json()) as { id_token?: string };
  if (!payload.id_token) {
    throw new GatewayError('UPSTREAM_ERROR', 'Google returned no id_token.');
  }

  return parseIdToken(payload.id_token, env.GOOGLE_CLIENT_ID);
}

interface IdTokenClaims {
  iss?: string;
  aud?: string;
  exp?: number;
  email?: string;
  email_verified?: boolean | string;
  name?: string;
  hd?: string;
}

export function parseIdToken(idToken: string, expectedAudience: string): GoogleIdentity {
  const segments = idToken.split('.');
  if (segments.length !== 3) {
    throw new GatewayError('UPSTREAM_ERROR', 'Malformed id_token from Google.');
  }

  let claims: IdTokenClaims;
  try {
    claims = JSON.parse(new TextDecoder().decode(fromBase64Url(segments[1]!))) as IdTokenClaims;
  } catch {
    throw new GatewayError('UPSTREAM_ERROR', 'Could not decode the id_token payload.');
  }

  if (!claims.iss || !GOOGLE_ISSUERS.includes(claims.iss)) {
    throw new GatewayError('UPSTREAM_ERROR', 'id_token has an unexpected issuer.');
  }
  // Without this check, a token minted for a different Google client could be
  // replayed here.
  if (claims.aud !== expectedAudience) {
    throw new GatewayError('UPSTREAM_ERROR', 'id_token was issued for a different application.');
  }
  if (typeof claims.exp === 'number' && claims.exp * 1000 < Date.now()) {
    throw new GatewayError('UPSTREAM_ERROR', 'id_token has expired.');
  }
  if (!claims.email) {
    throw new GatewayError('UPSTREAM_ERROR', 'Google did not return an email address.');
  }

  return {
    email: claims.email.toLowerCase(),
    name: claims.name ?? '',
    hostedDomain: claims.hd ?? null,
    emailVerified: claims.email_verified === true || claims.email_verified === 'true',
  };
}

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Gate sign-in on the configured allowlist.
 *
 * Domain matching uses the `hd` claim when present and falls back to the email
 * suffix. `hd` is the stronger signal — it is asserted by Workspace itself —
 * but the suffix check covers domains where `hd` is not emitted.
 */
export function assertAllowed(identity: GoogleIdentity, env: Env): void {
  if (!identity.emailVerified) {
    throw new GatewayError('PERMISSION_DENIED', 'Your Google account email is not verified.');
  }

  const allowedEmails = splitList(env.ALLOWED_EMAILS ?? '');
  if (allowedEmails.includes(identity.email)) return;

  const allowedDomains = splitList(env.ALLOWED_EMAIL_DOMAINS ?? '');
  if (allowedDomains.length === 0 && allowedEmails.length === 0) {
    // Fail closed. An empty allowlist means "nobody", never "everybody" —
    // a misconfiguration should lock us out, not open the gateway to the world.
    throw new GatewayError(
      'PERMISSION_DENIED',
      'No sign-in allowlist is configured. Set ALLOWED_EMAIL_DOMAINS before allowing sign-ins.',
    );
  }

  const emailDomain = identity.email.split('@')[1]?.toLowerCase() ?? '';
  const domainMatches =
    (identity.hostedDomain !== null && allowedDomains.includes(identity.hostedDomain.toLowerCase())) ||
    allowedDomains.includes(emailDomain);

  if (!domainMatches) {
    throw new GatewayError(
      'PERMISSION_DENIED',
      `${identity.email} is not permitted to use this gateway. Sign in with your work account.`,
    );
  }
}
