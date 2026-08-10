/**
 * Permission grants and their enforcement.
 *
 * The single rule: nothing reaches Shopify without passing `requireScope`.
 * There is no privileged internal bypass — admin tooling grants itself the
 * `admin` scope like anything else, so the audit trail stays complete.
 */

import { randomId } from '../lib/crypto.js';
import { GatewayError } from '../lib/errors.js';
import type { Env, PermissionGrant, Principal, PrincipalType, Role, Scope } from '../types.js';
import { SCOPES } from '../types.js';

interface PermissionRow {
  id: string;
  principal_type: string;
  principal_id: string;
  store_id: string | null;
  scope: string;
  granted_by: string;
  granted_at: number;
}

const toGrant = (row: PermissionRow): PermissionGrant => ({
  id: row.id,
  principalType: row.principal_type as PrincipalType,
  principalId: row.principal_id,
  storeId: row.store_id,
  scope: row.scope as Scope,
  grantedBy: row.granted_by,
  grantedAt: row.granted_at,
});

/**
 * Role presets. These are a convenience for onboarding — the grant table stays
 * the source of truth, so a role can be tailored per person afterwards without
 * the preset silently reasserting itself.
 */
export const ROLE_SCOPES: Record<Role, Scope[]> = {
  admin: [...SCOPES],
  operator: [
    'stores:read',
    'products:read',
    'products:write',
    'inventory:read',
    'inventory:write',
    'orders:read',
    'discounts:write',
  ],
  analyst: ['stores:read', 'products:read', 'inventory:read', 'orders:read'],
};

export function isValidScope(scope: string): scope is Scope {
  return (SCOPES as readonly string[]).includes(scope);
}

export async function listGrantsForPrincipal(
  env: Env,
  principal: Pick<Principal, 'type' | 'id'>,
): Promise<PermissionGrant[]> {
  const { results } = await env.DB.prepare(
    'SELECT * FROM permissions WHERE principal_type = ? AND principal_id = ?',
  )
    .bind(principal.type, principal.id)
    .all<PermissionRow>();
  return results.map(toGrant);
}

export async function grantScope(
  env: Env,
  params: {
    principalType: PrincipalType;
    principalId: string;
    storeId: string | null;
    scope: Scope;
    grantedBy: string;
  },
): Promise<void> {
  if (!isValidScope(params.scope)) {
    throw new GatewayError('VALIDATION_FAILED', `Unknown scope "${params.scope}".`, {
      details: { validScopes: SCOPES },
    });
  }

  // The unique indexes make a repeated grant a no-op rather than an error,
  // which keeps onboarding scripts idempotent.
  await env.DB.prepare(
    `INSERT OR IGNORE INTO permissions
       (id, principal_type, principal_id, store_id, scope, granted_by, granted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      randomId('prm'),
      params.principalType,
      params.principalId,
      params.storeId,
      params.scope,
      params.grantedBy,
      Date.now(),
    )
    .run();
}

export async function revokeScope(
  env: Env,
  params: {
    principalType: PrincipalType;
    principalId: string;
    storeId: string | null;
    scope: Scope;
  },
): Promise<void> {
  // `store_id IS ?` rather than `= ?` so a NULL (all-stores) grant is matched.
  await env.DB.prepare(
    `DELETE FROM permissions
      WHERE principal_type = ? AND principal_id = ? AND store_id IS ? AND scope = ?`,
  )
    .bind(params.principalType, params.principalId, params.storeId, params.scope)
    .run();
}

/** Apply a role preset as all-store grants. Used during onboarding. */
export async function applyRolePreset(
  env: Env,
  params: { principalType: PrincipalType; principalId: string; role: Role; grantedBy: string },
): Promise<void> {
  for (const scope of ROLE_SCOPES[params.role]) {
    await grantScope(env, {
      principalType: params.principalType,
      principalId: params.principalId,
      storeId: null,
      scope,
      grantedBy: params.grantedBy,
    });
  }
}

/**
 * Does this principal hold `scope` on `storeId`?
 *
 * A grant matches when it names this store explicitly, or when it is an
 * all-stores grant (`store_id IS NULL`). The all-stores case is what makes
 * "add store #3 without touching permissions" work for admins.
 */
export async function hasScope(
  env: Env,
  principal: Pick<Principal, 'type' | 'id'>,
  storeId: string | null,
  scope: Scope,
): Promise<boolean> {
  const row = await env.DB.prepare(
    `SELECT 1 FROM permissions
      WHERE principal_type = ?
        AND principal_id = ?
        AND scope IN (?, 'admin')
        AND (store_id IS NULL OR store_id = ?)
      LIMIT 1`,
  )
    .bind(principal.type, principal.id, scope, storeId)
    .first();
  return row !== null;
}

/**
 * Enforce a scope, or throw. This is the choke point referenced throughout the
 * architecture doc — every tool handler calls it before touching Shopify.
 */
export async function requireScope(
  env: Env,
  principal: Principal,
  storeId: string | null,
  scope: Scope,
): Promise<void> {
  if (await hasScope(env, principal, storeId, scope)) return;

  throw new GatewayError(
    'PERMISSION_DENIED',
    storeId
      ? `You do not have the "${scope}" permission on this store.`
      : `You do not have the "${scope}" permission.`,
    { details: { requiredScope: scope, principal: principal.label } },
  );
}

/** Store ids this principal can touch with `scope`, for list/filter operations. */
export async function storeIdsWithScope(
  env: Env,
  principal: Pick<Principal, 'type' | 'id'>,
  scope: Scope,
): Promise<{ all: boolean; storeIds: string[] }> {
  const { results } = await env.DB.prepare(
    `SELECT store_id FROM permissions
      WHERE principal_type = ? AND principal_id = ? AND scope IN (?, 'admin')`,
  )
    .bind(principal.type, principal.id, scope)
    .all<{ store_id: string | null }>();

  if (results.some((r) => r.store_id === null)) return { all: true, storeIds: [] };
  return { all: false, storeIds: results.map((r) => r.store_id!).filter(Boolean) };
}

/**
 * Every scope the principal holds anywhere. Used to filter `tools/list` so a
 * caller is never shown a tool they cannot use (decision D-011).
 */
export async function effectiveScopes(
  env: Env,
  principal: Pick<Principal, 'type' | 'id'>,
): Promise<Set<Scope>> {
  const { results } = await env.DB.prepare(
    'SELECT DISTINCT scope FROM permissions WHERE principal_type = ? AND principal_id = ?',
  )
    .bind(principal.type, principal.id)
    .all<{ scope: string }>();

  const scopes = new Set<Scope>();
  for (const row of results) {
    if (isValidScope(row.scope)) scopes.add(row.scope);
  }
  // `admin` subsumes everything; expanding it here keeps every consumer simple.
  if (scopes.has('admin')) for (const s of SCOPES) scopes.add(s);
  return scopes;
}

/** Remove every grant for a principal. Used when offboarding. */
export async function revokeAllForPrincipal(
  env: Env,
  principalType: PrincipalType,
  principalId: string,
): Promise<void> {
  await env.DB.prepare('DELETE FROM permissions WHERE principal_type = ? AND principal_id = ?')
    .bind(principalType, principalId)
    .run();
}
