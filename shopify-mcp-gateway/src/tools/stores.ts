/**
 * Store discovery. Usually the first call any session makes, since every other
 * tool needs an explicit `store` argument.
 */

import { listGrantsForPrincipal } from '../db/permissions.js';
import { listStores } from '../db/stores.js';
import type { ToolDefinition } from '../mcp/types.js';
import type { Scope } from '../types.js';

export const listStoresTool: ToolDefinition = {
  name: 'list_stores',
  title: 'List stores',
  description:
    'List the Shopify stores you can access through the gateway, with the permissions you hold on each. ' +
    'Call this first — every other tool needs a `store` argument, and this tells you both what exists ' +
    'and what you are allowed to do there.',
  scope: 'stores:read',
  needsStore: false,
  mutating: false,
  loggableArgs: [],
  inputSchema: {
    type: 'object',
    properties: {},
    additionalProperties: false,
  },

  async handler(_args, { env, principal }) {
    const [stores, grants] = await Promise.all([
      listStores(env),
      listGrantsForPrincipal(env, principal),
    ]);

    const globalScopes = new Set<Scope>(
      grants.filter((g) => g.storeId === null).map((g) => g.scope),
    );
    const isAdmin = globalScopes.has('admin');

    const perStore = new Map<string, Set<Scope>>();
    for (const grant of grants) {
      if (grant.storeId === null) continue;
      const existing = perStore.get(grant.storeId) ?? new Set<Scope>();
      existing.add(grant.scope);
      perStore.set(grant.storeId, existing);
    }

    const visible = stores
      .map((store) => {
        const scopes = new Set<Scope>([...globalScopes, ...(perStore.get(store.id) ?? [])]);
        // `admin` subsumes every other scope; expanding it here means the
        // caller sees the truth rather than a bare "admin".
        if (isAdmin) {
          for (const s of ['stores:read', 'products:read', 'products:write', 'inventory:read',
            'inventory:write', 'orders:read', 'discounts:write', 'audit:read'] as Scope[]) {
            scopes.add(s);
          }
        }
        return {
          label: store.label,
          domain: store.shopDomain,
          status: store.status,
          yourPermissions: [...scopes].sort(),
        };
      })
      // A store the caller holds nothing on is noise, and listing it would
      // invite calls that can only be denied.
      .filter((entry) => entry.yourPermissions.length > 0);

    return {
      stores: visible,
      count: visible.length,
      note:
        visible.length === 0
          ? 'You have no permissions on any store yet. Ask an admin to grant them.'
          : 'Pass `domain` or `label` as the `store` argument to other tools.',
    };
  },
};
