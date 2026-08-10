/**
 * Storage for the gateway's own OAuth 2.1 authorization server.
 *
 * Two invariants hold throughout:
 *   • Codes and tokens are stored as SHA-256 hashes, never plaintext.
 *   • Authorization codes are single-use, enforced by a conditional UPDATE
 *     rather than a read-then-write, so two concurrent redemptions cannot both
 *     succeed.
 */

import { randomId, sha256Hex } from '../lib/crypto.js';
import type { Env, PrincipalType } from '../types.js';

// ---------------------------------------------------------------------------
// Short-lived flow state (Shopify install, Google sign-in)
// ---------------------------------------------------------------------------

export async function putState(
  env: Env,
  params: { kind: 'shopify_install' | 'google_signin'; payload: unknown; ttlSeconds?: number },
): Promise<string> {
  const state = randomId('st');
  await env.DB.prepare('INSERT INTO oauth_state (state, kind, payload, expires_at) VALUES (?, ?, ?, ?)')
    .bind(state, params.kind, JSON.stringify(params.payload), Date.now() + (params.ttlSeconds ?? 600) * 1000)
    .run();
  return state;
}

/**
 * Fetch and delete a state value in one shot. Consuming on read is what makes
 * the state nonce single-use, which is the CSRF protection for both flows.
 */
export async function consumeState<T = unknown>(
  env: Env,
  state: string,
  kind: 'shopify_install' | 'google_signin',
): Promise<T | null> {
  const row = await env.DB.prepare('SELECT payload, expires_at FROM oauth_state WHERE state = ? AND kind = ?')
    .bind(state, kind)
    .first<{ payload: string; expires_at: number }>();

  if (!row) return null;
  await env.DB.prepare('DELETE FROM oauth_state WHERE state = ?').bind(state).run();
  if (row.expires_at < Date.now()) return null;

  try {
    return JSON.parse(row.payload) as T;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Clients (RFC 7591 dynamic registration)
// ---------------------------------------------------------------------------

export interface OAuthClient {
  clientId: string;
  clientSecretHash: string | null;
  clientName: string;
  redirectUris: string[];
  createdAt: number;
}

export async function createClient(
  env: Env,
  params: { clientName: string; redirectUris: string[]; clientSecretHash: string | null },
): Promise<OAuthClient> {
  const clientId = randomId('cli');
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO oauth_clients (client_id, client_secret_hash, client_name, redirect_uris, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(clientId, params.clientSecretHash, params.clientName, JSON.stringify(params.redirectUris), now)
    .run();

  return {
    clientId,
    clientSecretHash: params.clientSecretHash,
    clientName: params.clientName,
    redirectUris: params.redirectUris,
    createdAt: now,
  };
}

export async function getClient(env: Env, clientId: string): Promise<OAuthClient | null> {
  const row = await env.DB.prepare('SELECT * FROM oauth_clients WHERE client_id = ?')
    .bind(clientId)
    .first<{
      client_id: string;
      client_secret_hash: string | null;
      client_name: string;
      redirect_uris: string;
      created_at: number;
    }>();

  if (!row) return null;
  let redirectUris: string[] = [];
  try {
    redirectUris = JSON.parse(row.redirect_uris) as string[];
  } catch {
    redirectUris = [];
  }

  return {
    clientId: row.client_id,
    clientSecretHash: row.client_secret_hash,
    clientName: row.client_name,
    redirectUris,
    createdAt: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// Authorization codes
// ---------------------------------------------------------------------------

export interface StoredAuthorization {
  clientId: string;
  userId: string;
  redirectUri: string;
  codeChallenge: string;
  scope: string;
  resource: string | null;
}

/** Codes live 60 seconds — long enough for a redirect, short enough to matter. */
const AUTH_CODE_TTL_MS = 60_000;

export async function storeAuthorizationCode(
  env: Env,
  code: string,
  params: StoredAuthorization,
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO oauth_authorizations
       (code_hash, client_id, user_id, redirect_uri, code_challenge, scope, resource, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      await sha256Hex(code),
      params.clientId,
      params.userId,
      params.redirectUri,
      params.codeChallenge,
      params.scope,
      params.resource,
      Date.now() + AUTH_CODE_TTL_MS,
    )
    .run();
}

/**
 * Redeem an authorization code exactly once.
 *
 * The conditional `UPDATE … WHERE consumed_at IS NULL` is the single-use
 * guarantee: D1 serialises it, so of two concurrent redemptions exactly one
 * reports a changed row and the other gets nothing.
 */
export async function consumeAuthorizationCode(
  env: Env,
  code: string,
): Promise<StoredAuthorization | null> {
  const codeHash = await sha256Hex(code);
  const now = Date.now();

  const result = await env.DB.prepare(
    'UPDATE oauth_authorizations SET consumed_at = ? WHERE code_hash = ? AND consumed_at IS NULL',
  )
    .bind(now, codeHash)
    .run();

  if (!result.meta.changes) return null;

  const row = await env.DB.prepare('SELECT * FROM oauth_authorizations WHERE code_hash = ?')
    .bind(codeHash)
    .first<{
      client_id: string;
      user_id: string;
      redirect_uri: string;
      code_challenge: string;
      scope: string;
      resource: string | null;
      expires_at: number;
    }>();

  if (!row || row.expires_at < now) return null;

  return {
    clientId: row.client_id,
    userId: row.user_id,
    redirectUri: row.redirect_uri,
    codeChallenge: row.code_challenge,
    scope: row.scope,
    resource: row.resource,
  };
}

// ---------------------------------------------------------------------------
// Access and refresh tokens
// ---------------------------------------------------------------------------

export interface StoredToken {
  id: string;
  kind: 'access' | 'refresh';
  principalType: PrincipalType;
  principalId: string;
  clientId: string | null;
  scope: string;
  chainId: string;
  rotatedFrom: string | null;
  issuedAt: number;
  expiresAt: number;
  revokedAt: number | null;
}

export async function storeToken(
  env: Env,
  token: string,
  params: {
    kind: 'access' | 'refresh';
    principalType: PrincipalType;
    principalId: string;
    clientId: string | null;
    scope: string;
    chainId: string;
    rotatedFrom?: string | null;
    ttlSeconds: number;
  },
): Promise<string> {
  const id = randomId('tok');
  const now = Date.now();

  await env.DB.prepare(
    `INSERT INTO oauth_tokens
       (id, token_hash, kind, principal_type, principal_id, client_id, scope,
        chain_id, rotated_from, issued_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      await sha256Hex(token),
      params.kind,
      params.principalType,
      params.principalId,
      params.clientId,
      params.scope,
      params.chainId,
      params.rotatedFrom ?? null,
      now,
      now + params.ttlSeconds * 1000,
    )
    .run();

  return id;
}

export async function findToken(
  env: Env,
  token: string,
  kind: 'access' | 'refresh',
): Promise<StoredToken | null> {
  const row = await env.DB.prepare('SELECT * FROM oauth_tokens WHERE token_hash = ? AND kind = ?')
    .bind(await sha256Hex(token), kind)
    .first<{
      id: string;
      kind: string;
      principal_type: string;
      principal_id: string;
      client_id: string | null;
      scope: string;
      chain_id: string;
      rotated_from: string | null;
      issued_at: number;
      expires_at: number;
      revoked_at: number | null;
    }>();

  if (!row) return null;

  return {
    id: row.id,
    kind: row.kind as 'access' | 'refresh',
    principalType: row.principal_type as PrincipalType,
    principalId: row.principal_id,
    clientId: row.client_id,
    scope: row.scope,
    chainId: row.chain_id,
    rotatedFrom: row.rotated_from,
    issuedAt: row.issued_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
  };
}

export async function revokeToken(env: Env, tokenId: string): Promise<void> {
  await env.DB.prepare('UPDATE oauth_tokens SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL')
    .bind(Date.now(), tokenId)
    .run();
}

/**
 * Revoke every token in a rotation chain.
 *
 * Called on refresh-token reuse: presenting an already-rotated token means
 * either a replay or a stolen token, and in both cases the safe response is to
 * invalidate the whole lineage and force a fresh sign-in.
 */
export async function revokeChain(env: Env, chainId: string): Promise<void> {
  await env.DB.prepare('UPDATE oauth_tokens SET revoked_at = ? WHERE chain_id = ? AND revoked_at IS NULL')
    .bind(Date.now(), chainId)
    .run();
}

export async function revokeAllTokensForPrincipal(
  env: Env,
  principalType: PrincipalType,
  principalId: string,
): Promise<void> {
  await env.DB.prepare(
    'UPDATE oauth_tokens SET revoked_at = ? WHERE principal_type = ? AND principal_id = ? AND revoked_at IS NULL',
  )
    .bind(Date.now(), principalType, principalId)
    .run();
}

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

export async function getIdempotentResponse(env: Env, key: string): Promise<unknown | null> {
  const row = await env.DB.prepare('SELECT response, expires_at FROM idempotency_keys WHERE key = ?')
    .bind(key)
    .first<{ response: string; expires_at: number }>();

  if (!row || row.expires_at < Date.now()) return null;
  try {
    return JSON.parse(row.response);
  } catch {
    return null;
  }
}

export async function storeIdempotentResponse(
  env: Env,
  params: { key: string; principalId: string; tool: string; response: unknown },
): Promise<void> {
  const now = Date.now();
  await env.DB.prepare(
    `INSERT OR REPLACE INTO idempotency_keys (key, principal_id, tool, response, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(params.key, params.principalId, params.tool, JSON.stringify(params.response), now, now + IDEMPOTENCY_TTL_MS)
    .run();
}

// ---------------------------------------------------------------------------
// Retention
// ---------------------------------------------------------------------------

/** Nightly cron cleanup. Expired rows have no value and the tables are indexed on expiry. */
export async function purgeExpired(env: Env): Promise<Record<string, number>> {
  const now = Date.now();
  const results: Record<string, number> = {};

  const statements: Array<[string, string]> = [
    ['oauth_state', 'DELETE FROM oauth_state WHERE expires_at < ?'],
    ['oauth_authorizations', 'DELETE FROM oauth_authorizations WHERE expires_at < ?'],
    ['idempotency_keys', 'DELETE FROM idempotency_keys WHERE expires_at < ?'],
    // Keep expired tokens 30 days past expiry so reuse detection still has the
    // chain to revoke, and so an incident review can see what existed.
    ['oauth_tokens', `DELETE FROM oauth_tokens WHERE expires_at < ? - ${30 * 24 * 60 * 60 * 1000}`],
  ];

  for (const [name, sql] of statements) {
    const result = await env.DB.prepare(sql).bind(now).run();
    results[name] = result.meta.changes ?? 0;
  }

  return results;
}
