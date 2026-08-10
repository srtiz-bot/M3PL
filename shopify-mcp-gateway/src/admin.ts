/**
 * Admin HTTP API.
 *
 * Two ways in, both required to be explicit:
 *   • a user bearer token belonging to a principal holding the `admin` scope
 *   • the ADMIN_API_KEY secret, for bootstrap and scripted onboarding
 *
 * The API-key path exists because there is a chicken-and-egg problem at
 * install time: someone has to make the first grant. It is a break-glass
 * credential, audited like everything else.
 */

import { bearerToken, jsonResponse, readJson, type RouteContext } from './lib/http.js';
import { GatewayError } from './lib/errors.js';
import { timingSafeEqual } from './lib/crypto.js';
import { writeAuditLog } from './lib/audit.js';
import { authenticateBearer } from './auth/oauth-server.js';
import {
  applyRolePreset,
  grantScope,
  isValidScope,
  listGrantsForPrincipal,
  revokeAllForPrincipal,
  revokeScope,
} from './db/permissions.js';
import {
  createServiceAccount,
  getUserByEmail,
  listServiceAccounts,
  listUsers,
  revokeServiceAccount,
  rotateServiceAccountToken,
  setUserRole,
  setUserStatus,
} from './db/principals.js';
import { revokeAllTokensForPrincipal } from './db/oauth.js';
import { listStores, resolveStore, setStoreLabel } from './db/stores.js';
import type { Env, Principal, Role, Scope } from './types.js';

/**
 * Authenticate an admin caller and return the principal to attribute actions to.
 */
async function requireAdmin(context: RouteContext): Promise<Principal> {
  const { env, request } = context;
  const token = bearerToken(request);

  if (!token) {
    throw new GatewayError('UNAUTHENTICATED', 'Admin endpoints require a bearer token or the admin API key.');
  }

  // Break-glass path. Constant-time compare so the key cannot be probed byte
  // by byte, and guarded against an unset secret matching an empty header.
  if (env.ADMIN_API_KEY && timingSafeEqual(token, env.ADMIN_API_KEY)) {
    return { type: 'user', id: 'system:admin-key', label: 'admin-api-key', role: 'admin' };
  }

  const principal = await authenticateBearer(env, token);
  if (!principal) {
    throw new GatewayError('UNAUTHENTICATED', 'The token is invalid, expired or revoked.');
  }

  const { hasScope } = await import('./db/permissions.js');
  if (!(await hasScope(env, principal, null, 'admin'))) {
    throw new GatewayError('PERMISSION_DENIED', 'This endpoint requires the `admin` scope.');
  }

  return principal;
}

/** Record an admin action. Permission changes are exactly what an audit trail is for. */
async function auditAdmin(
  context: RouteContext,
  principal: Principal,
  action: string,
  args: Record<string, unknown>,
  loggable: string[],
): Promise<void> {
  await writeAuditLog(context.env, {
    requestId: context.requestId,
    principal,
    tool: `admin:${action}`,
    args,
    loggableArgs: loggable,
    outcome: 'ok',
    durationMs: 0,
  });
}

// ---------------------------------------------------------------------------
// GET /admin/overview
// ---------------------------------------------------------------------------

export async function handleOverview(context: RouteContext): Promise<Response> {
  await requireAdmin(context);
  const { env } = context;

  const [stores, users, serviceAccounts] = await Promise.all([
    listStores(env, true),
    listUsers(env),
    listServiceAccounts(env),
  ]);

  return jsonResponse({
    stores: stores.map((s) => ({ id: s.id, label: s.label, domain: s.shopDomain, status: s.status })),
    users: users.map((u) => ({ id: u.id, email: u.email, role: u.role, status: u.status })),
    serviceAccounts: serviceAccounts.map((a) => ({
      id: a.id,
      name: a.name,
      status: a.status,
      lastUsedAt: a.lastUsedAt ? new Date(a.lastUsedAt).toISOString() : null,
    })),
    installUrl: `${env.GATEWAY_URL}/shopify/install?shop=YOUR-STORE.myshopify.com`,
  });
}

// ---------------------------------------------------------------------------
// POST /admin/permissions   { principal, scopes[], store?, role? }
// ---------------------------------------------------------------------------

interface GrantRequest {
  principal: string;
  scopes?: string[];
  role?: Role;
  store?: string | null;
  revoke?: boolean;
}

export async function handlePermissions(context: RouteContext): Promise<Response> {
  const admin = await requireAdmin(context);
  const { env } = context;
  const body = await readJson<GrantRequest>(context.request);

  if (!body.principal) {
    throw new GatewayError('VALIDATION_FAILED', '`principal` is required (an email or service-account name).');
  }

  const target = await resolvePrincipal(env, body.principal);

  // A named store scopes the grant; omitting it grants across all stores,
  // including ones installed later.
  let storeId: string | null = null;
  if (body.store) {
    storeId = (await resolveStore(env, body.store)).id;
  }

  if (body.role) {
    if (!['admin', 'operator', 'analyst'].includes(body.role)) {
      throw new GatewayError('VALIDATION_FAILED', 'role must be one of: admin, operator, analyst.');
    }
    await applyRolePreset(env, {
      principalType: target.type,
      principalId: target.id,
      role: body.role,
      grantedBy: admin.label,
    });
    if (target.type === 'user') await setUserRole(env, target.id, body.role);
  }

  const scopes = (body.scopes ?? []).filter((s): s is Scope => {
    if (!isValidScope(s)) {
      throw new GatewayError('VALIDATION_FAILED', `Unknown scope "${s}".`);
    }
    return true;
  });

  for (const scope of scopes) {
    if (body.revoke) {
      await revokeScope(env, { principalType: target.type, principalId: target.id, storeId, scope });
    } else {
      await grantScope(env, {
        principalType: target.type,
        principalId: target.id,
        storeId,
        scope,
        grantedBy: admin.label,
      });
    }
  }

  await auditAdmin(
    context,
    admin,
    body.revoke ? 'revoke_permissions' : 'grant_permissions',
    { principal: body.principal, scopes, role: body.role, store: body.store ?? 'ALL' },
    ['principal', 'scopes', 'role', 'store'],
  );

  return jsonResponse({
    principal: { type: target.type, id: target.id, label: body.principal },
    grants: (await listGrantsForPrincipal(env, target)).map((g) => ({
      scope: g.scope,
      store: g.storeId ?? 'ALL_STORES',
    })),
  });
}

async function resolvePrincipal(
  env: Env,
  identifier: string,
): Promise<{ type: 'user' | 'service_account'; id: string }> {
  if (identifier.includes('@')) {
    const user = await getUserByEmail(env, identifier);
    if (!user) {
      throw new GatewayError(
        'NOT_FOUND',
        `No user with email "${identifier}". They must sign in once before permissions can be granted.`,
      );
    }
    return { type: 'user', id: user.id };
  }

  const accounts = await listServiceAccounts(env);
  const account = accounts.find((a) => a.name === identifier || a.id === identifier);
  if (!account) {
    throw new GatewayError('NOT_FOUND', `No service account named "${identifier}".`);
  }
  return { type: 'service_account', id: account.id };
}

// ---------------------------------------------------------------------------
// POST /admin/service-accounts
// ---------------------------------------------------------------------------

export async function handleCreateServiceAccount(context: RouteContext): Promise<Response> {
  const admin = await requireAdmin(context);
  const body = await readJson<{
    name: string;
    description?: string;
    scopes?: string[];
    store?: string;
    expiresInDays?: number;
  }>(context.request);

  if (!body.name) throw new GatewayError('VALIDATION_FAILED', '`name` is required.');

  const expiresAt = body.expiresInDays
    ? Date.now() + Number(body.expiresInDays) * 86_400_000
    : null;

  const { account, token } = await createServiceAccount(context.env, {
    name: body.name,
    description: body.description ?? '',
    createdBy: admin.id,
    expiresAt,
  });

  // Grant in the same call so a job is never created without the permissions
  // it needs, which is the usual cause of a mysterious first-run failure.
  const storeId = body.store ? (await resolveStore(context.env, body.store)).id : null;
  for (const scope of body.scopes ?? []) {
    if (!isValidScope(scope)) throw new GatewayError('VALIDATION_FAILED', `Unknown scope "${scope}".`);
    await grantScope(context.env, {
      principalType: 'service_account',
      principalId: account.id,
      storeId,
      scope,
      grantedBy: admin.label,
    });
  }

  await auditAdmin(
    context,
    admin,
    'create_service_account',
    { name: body.name, scopes: body.scopes, store: body.store ?? 'ALL' },
    ['name', 'scopes', 'store'],
  );

  return jsonResponse(
    {
      serviceAccount: { id: account.id, name: account.name, expiresAt },
      token,
      warning: 'This token is shown once and cannot be recovered. Store it in your scheduler now.',
      usage: `Authorization: Bearer ${token.slice(0, 16)}…`,
    },
    { status: 201 },
  );
}

export async function handleRotateServiceAccount(context: RouteContext): Promise<Response> {
  const admin = await requireAdmin(context);
  const body = await readJson<{ id: string }>(context.request);
  if (!body.id) throw new GatewayError('VALIDATION_FAILED', '`id` is required.');

  const token = await rotateServiceAccountToken(context.env, body.id);
  await auditAdmin(context, admin, 'rotate_service_account', { id: body.id }, ['id']);

  return jsonResponse({
    token,
    warning: 'The previous token is now invalid. Update your scheduler before the next run.',
  });
}

export async function handleRevokeServiceAccount(context: RouteContext): Promise<Response> {
  const admin = await requireAdmin(context);
  const body = await readJson<{ id: string; removeGrants?: boolean }>(context.request);
  if (!body.id) throw new GatewayError('VALIDATION_FAILED', '`id` is required.');

  await revokeServiceAccount(context.env, body.id);
  if (body.removeGrants) {
    await revokeAllForPrincipal(context.env, 'service_account', body.id);
  }

  await auditAdmin(context, admin, 'revoke_service_account', { id: body.id }, ['id']);
  return jsonResponse({ ok: true, id: body.id });
}

// ---------------------------------------------------------------------------
// POST /admin/users   — suspend, reactivate, or change role
// ---------------------------------------------------------------------------

export async function handleUsers(context: RouteContext): Promise<Response> {
  const admin = await requireAdmin(context);
  const body = await readJson<{ email: string; status?: 'active' | 'suspended'; role?: Role; offboard?: boolean }>(
    context.request,
  );

  if (!body.email) throw new GatewayError('VALIDATION_FAILED', '`email` is required.');

  const user = await getUserByEmail(context.env, body.email);
  if (!user) throw new GatewayError('NOT_FOUND', `No user with email "${body.email}".`);

  // Offboarding must be total and immediate: suspend, drop every grant, and
  // kill live tokens so an open session cannot keep working.
  if (body.offboard) {
    await setUserStatus(context.env, user.id, 'suspended');
    await revokeAllForPrincipal(context.env, 'user', user.id);
    await revokeAllTokensForPrincipal(context.env, 'user', user.id);
    await auditAdmin(context, admin, 'offboard_user', { email: body.email }, ['email']);
    return jsonResponse({ ok: true, email: body.email, offboarded: true });
  }

  if (body.status) await setUserStatus(context.env, user.id, body.status);
  if (body.role) await setUserRole(context.env, user.id, body.role);

  await auditAdmin(context, admin, 'update_user', { email: body.email, status: body.status, role: body.role }, [
    'email',
    'status',
    'role',
  ]);

  return jsonResponse({ ok: true, email: body.email, status: body.status ?? user.status, role: body.role ?? user.role });
}

// ---------------------------------------------------------------------------
// POST /admin/stores  — rename a store's friendly label
// ---------------------------------------------------------------------------

export async function handleStores(context: RouteContext): Promise<Response> {
  const admin = await requireAdmin(context);
  const body = await readJson<{ store: string; label: string }>(context.request);

  if (!body.store || !body.label) {
    throw new GatewayError('VALIDATION_FAILED', '`store` and `label` are required.');
  }

  const store = await resolveStore(context.env, body.store);
  await setStoreLabel(context.env, store.id, body.label);
  await auditAdmin(context, admin, 'rename_store', { store: store.shopDomain, label: body.label }, [
    'store',
    'label',
  ]);

  return jsonResponse({ ok: true, domain: store.shopDomain, label: body.label });
}
