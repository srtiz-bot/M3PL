/**
 * Users and service accounts — the two kinds of principal that can call the
 * gateway. Kept in one module because the permission layer treats them
 * uniformly and the parallel shape is easier to keep correct side by side.
 */

import { randomId, randomToken, sha256Hex } from '../lib/crypto.js';
import { GatewayError } from '../lib/errors.js';
import type { Env, Principal, Role, ServiceAccount, User } from '../types.js';

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  created_at: number;
  last_seen_at: number | null;
}

interface ServiceAccountRow {
  id: string;
  name: string;
  description: string;
  status: string;
  created_by: string;
  created_at: number;
  last_used_at: number | null;
  expires_at: number | null;
}

const toUser = (row: UserRow): User => ({
  id: row.id,
  email: row.email,
  name: row.name,
  role: row.role as Role,
  status: row.status as User['status'],
  createdAt: row.created_at,
  lastSeenAt: row.last_seen_at,
});

const toServiceAccount = (row: ServiceAccountRow): ServiceAccount => ({
  id: row.id,
  name: row.name,
  description: row.description,
  status: row.status as ServiceAccount['status'],
  createdBy: row.created_by,
  createdAt: row.created_at,
  lastUsedAt: row.last_used_at,
  expiresAt: row.expires_at,
});

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export async function getUserById(env: Env, id: string): Promise<User | null> {
  const row = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<UserRow>();
  return row ? toUser(row) : null;
}

export async function getUserByEmail(env: Env, email: string): Promise<User | null> {
  const row = await env.DB.prepare('SELECT * FROM users WHERE email = ?')
    .bind(email.toLowerCase())
    .first<UserRow>();
  return row ? toUser(row) : null;
}

export async function listUsers(env: Env): Promise<User[]> {
  const { results } = await env.DB.prepare('SELECT * FROM users ORDER BY email').all<UserRow>();
  return results.map(toUser);
}

/**
 * Establish or refresh a user on successful Google sign-in.
 *
 * New users land as `analyst` — read-only — so that being in the Workspace
 * domain grants visibility but never write access until someone deliberately
 * grants it. The single exception is ADMIN_BOOTSTRAP_EMAIL, which exists so the
 * system has a first operator without hand-editing the database.
 */
export async function upsertUserFromSignIn(
  env: Env,
  params: { email: string; name: string },
): Promise<User> {
  const email = params.email.toLowerCase();
  const now = Date.now();
  const existing = await getUserByEmail(env, email);

  if (existing) {
    if (existing.status === 'suspended') {
      throw new GatewayError('PERMISSION_DENIED', 'This account is suspended.');
    }
    await env.DB.prepare('UPDATE users SET last_seen_at = ?, name = ? WHERE id = ?')
      .bind(now, params.name || existing.name, existing.id)
      .run();
    return { ...existing, name: params.name || existing.name, lastSeenAt: now };
  }

  const isBootstrapAdmin =
    !!env.ADMIN_BOOTSTRAP_EMAIL && env.ADMIN_BOOTSTRAP_EMAIL.toLowerCase() === email;
  const role: Role = isBootstrapAdmin ? 'admin' : 'analyst';
  const id = randomId('usr');

  await env.DB.prepare(
    `INSERT INTO users (id, email, name, role, status, created_at, last_seen_at)
     VALUES (?, ?, ?, ?, 'active', ?, ?)`,
  )
    .bind(id, email, params.name, role, now, now)
    .run();

  const user: User = {
    id,
    email,
    name: params.name,
    role,
    status: 'active',
    createdAt: now,
    lastSeenAt: now,
  };

  // The bootstrap admin needs an actual all-store `admin` grant, not just the
  // role label, because enforcement reads the grant table.
  if (isBootstrapAdmin) {
    const { grantScope } = await import('./permissions.js');
    await grantScope(env, {
      principalType: 'user',
      principalId: id,
      storeId: null,
      scope: 'admin',
      grantedBy: 'system:bootstrap',
    });
  }

  return user;
}

export async function setUserRole(env: Env, userId: string, role: Role): Promise<void> {
  await env.DB.prepare('UPDATE users SET role = ? WHERE id = ?').bind(role, userId).run();
}

export async function setUserStatus(
  env: Env,
  userId: string,
  status: User['status'],
): Promise<void> {
  await env.DB.prepare('UPDATE users SET status = ? WHERE id = ?').bind(status, userId).run();

  // Suspension must take effect now, not at the next token expiry.
  if (status === 'suspended') {
    await env.DB.prepare(
      `UPDATE oauth_tokens SET revoked_at = ?
        WHERE principal_type = 'user' AND principal_id = ? AND revoked_at IS NULL`,
    )
      .bind(Date.now(), userId)
      .run();
  }
}

// ---------------------------------------------------------------------------
// Service accounts
// ---------------------------------------------------------------------------

export async function listServiceAccounts(env: Env): Promise<ServiceAccount[]> {
  const { results } = await env.DB.prepare(
    'SELECT * FROM service_accounts ORDER BY name',
  ).all<ServiceAccountRow>();
  return results.map(toServiceAccount);
}

export async function getServiceAccountById(
  env: Env,
  id: string,
): Promise<ServiceAccount | null> {
  const row = await env.DB.prepare('SELECT * FROM service_accounts WHERE id = ?')
    .bind(id)
    .first<ServiceAccountRow>();
  return row ? toServiceAccount(row) : null;
}

/**
 * Mint a service account. The returned token is the only time the plaintext
 * exists — only its hash is persisted, so it cannot be recovered, only rotated.
 */
export async function createServiceAccount(
  env: Env,
  params: { name: string; description?: string; createdBy: string; expiresAt?: number | null },
): Promise<{ account: ServiceAccount; token: string }> {
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(params.name)) {
    throw new GatewayError(
      'VALIDATION_FAILED',
      'Service account name must be lowercase alphanumeric with hyphens, e.g. "nightly-inventory-sync".',
    );
  }

  const existing = await env.DB.prepare('SELECT id FROM service_accounts WHERE name = ?')
    .bind(params.name)
    .first();
  if (existing) {
    throw new GatewayError('VALIDATION_FAILED', `A service account named "${params.name}" already exists.`);
  }

  // The `smcp_sa_` prefix makes these greppable in config files and lets secret
  // scanners recognise them.
  const token = `smcp_sa_${randomToken(32)}`;
  const id = randomId('svc');
  const now = Date.now();

  await env.DB.prepare(
    `INSERT INTO service_accounts
       (id, name, description, token_hash, status, created_by, created_at, expires_at)
     VALUES (?, ?, ?, ?, 'active', ?, ?, ?)`,
  )
    .bind(
      id,
      params.name,
      params.description ?? '',
      await sha256Hex(token),
      params.createdBy,
      now,
      params.expiresAt ?? null,
    )
    .run();

  return {
    account: {
      id,
      name: params.name,
      description: params.description ?? '',
      status: 'active',
      createdBy: params.createdBy,
      createdAt: now,
      lastUsedAt: null,
      expiresAt: params.expiresAt ?? null,
    },
    token,
  };
}

/** Issue a fresh token for an existing account, invalidating the previous one. */
export async function rotateServiceAccountToken(env: Env, id: string): Promise<string> {
  const account = await getServiceAccountById(env, id);
  if (!account) throw new GatewayError('NOT_FOUND', 'Service account not found.');

  const token = `smcp_sa_${randomToken(32)}`;
  await env.DB.prepare("UPDATE service_accounts SET token_hash = ?, status = 'active' WHERE id = ?")
    .bind(await sha256Hex(token), id)
    .run();
  return token;
}

export async function revokeServiceAccount(env: Env, id: string): Promise<void> {
  await env.DB.prepare("UPDATE service_accounts SET status = 'revoked' WHERE id = ?")
    .bind(id)
    .run();
}

/**
 * Authenticate a service-account bearer token.
 *
 * Lookup is by hash, so a leaked database cannot be replayed as a credential.
 */
export async function authenticateServiceAccountToken(
  env: Env,
  token: string,
): Promise<Principal | null> {
  const row = await env.DB.prepare(
    "SELECT * FROM service_accounts WHERE token_hash = ? AND status = 'active'",
  )
    .bind(await sha256Hex(token))
    .first<ServiceAccountRow>();

  if (!row) return null;
  if (row.expires_at !== null && row.expires_at < Date.now()) return null;

  // last_used_at is genuinely useful for spotting jobs that quietly died, but
  // it must not block the request.
  await env.DB.prepare('UPDATE service_accounts SET last_used_at = ? WHERE id = ?')
    .bind(Date.now(), row.id)
    .run();

  return { type: 'service_account', id: row.id, label: row.name, role: 'operator' };
}
