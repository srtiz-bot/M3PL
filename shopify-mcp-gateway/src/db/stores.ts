/**
 * Store repository. Owns the one decryptable secret in the system, so token
 * decryption is deliberately confined to this module.
 */

import { decryptSecret, encryptSecret, randomId } from '../lib/crypto.js';
import { GatewayError } from '../lib/errors.js';
import type { Env, Store } from '../types.js';

interface StoreRow {
  id: string;
  shop_domain: string;
  label: string;
  access_token_enc: string | null;
  scopes: string;
  status: string;
  installed_by: string | null;
  created_at: number;
  updated_at: number;
}

function toStore(row: StoreRow): Store {
  return {
    id: row.id,
    shopDomain: row.shop_domain,
    label: row.label,
    scopes: row.scopes,
    status: row.status as Store['status'],
    installedBy: row.installed_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Derive a human label from a shop domain: `wax-supply.myshopify.com` → `Wax Supply`.
 * Admins can override it later; this only has to be a reasonable default.
 */
export function defaultLabelFor(shopDomain: string): string {
  return shopDomain
    .replace(/\.myshopify\.com$/i, '')
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * Validate a shop domain before it is ever interpolated into a URL.
 *
 * This is a security control, not a convenience check: `shop` arrives from a
 * query parameter, and without this an attacker could point the install flow
 * (and later, authenticated API calls) at a host they control.
 */
export function isValidShopDomain(shop: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,58}[a-z0-9]\.myshopify\.com$/i.test(shop);
}

export async function listStores(env: Env, includeInactive = false): Promise<Store[]> {
  const sql = includeInactive
    ? 'SELECT * FROM stores ORDER BY label'
    : "SELECT * FROM stores WHERE status = 'active' ORDER BY label";
  const { results } = await env.DB.prepare(sql).all<StoreRow>();
  return results.map(toStore);
}

export async function getStoreById(env: Env, id: string): Promise<Store | null> {
  const row = await env.DB.prepare('SELECT * FROM stores WHERE id = ?').bind(id).first<StoreRow>();
  return row ? toStore(row) : null;
}

export async function getStoreByDomain(env: Env, shopDomain: string): Promise<Store | null> {
  const row = await env.DB.prepare('SELECT * FROM stores WHERE shop_domain = ?')
    .bind(shopDomain.toLowerCase())
    .first<StoreRow>();
  return row ? toStore(row) : null;
}

/**
 * Resolve the `store` argument that every tool takes. Accepts a full shop
 * domain, the bare subdomain, a friendly label, or the internal id — because a
 * human writing a prompt will use whichever they remember.
 */
export async function resolveStore(env: Env, identifier: string): Promise<Store> {
  const needle = identifier.trim().toLowerCase();
  if (!needle) {
    throw new GatewayError('VALIDATION_FAILED', 'A `store` argument is required.');
  }

  const { results } = await env.DB.prepare(
    `SELECT * FROM stores
      WHERE LOWER(shop_domain) = ?1
         OR LOWER(label) = ?1
         OR id = ?2
         OR LOWER(shop_domain) = ?1 || '.myshopify.com'
      LIMIT 2`,
  )
    .bind(needle, identifier.trim())
    .all<StoreRow>();

  if (results.length === 0) {
    const available = await listStores(env);
    throw new GatewayError(
      'STORE_NOT_FOUND',
      `No store matches "${identifier}".`,
      { details: { availableStores: available.map((s) => ({ label: s.label, domain: s.shopDomain })) } },
    );
  }

  // Ambiguity is a configuration problem (two stores sharing a label); guessing
  // would mean writing to the wrong shop, so refuse instead.
  if (results.length > 1) {
    throw new GatewayError(
      'VALIDATION_FAILED',
      `"${identifier}" matches more than one store. Use the full myshopify.com domain.`,
      { details: { matches: results.map((r) => r.shop_domain) } },
    );
  }

  const store = toStore(results[0]!);

  if (store.status === 'uninstalled') {
    throw new GatewayError(
      'STORE_UNINSTALLED',
      `The gateway app has been uninstalled from ${store.shopDomain}. Reinstall it to restore access.`,
    );
  }
  if (store.status === 'disabled') {
    throw new GatewayError('STORE_UNINSTALLED', `${store.shopDomain} is disabled in the gateway.`);
  }

  return store;
}

/**
 * Decrypt a store's Shopify access token. The only place decryption happens.
 */
export async function getStoreAccessToken(env: Env, storeId: string): Promise<string> {
  const row = await env.DB.prepare('SELECT access_token_enc, shop_domain FROM stores WHERE id = ?')
    .bind(storeId)
    .first<{ access_token_enc: string | null; shop_domain: string }>();

  if (!row || !row.access_token_enc) {
    throw new GatewayError(
      'STORE_UNINSTALLED',
      'No Shopify credential is stored for this shop. Reinstall the gateway app.',
    );
  }
  return decryptSecret(row.access_token_enc, env.TOKEN_ENCRYPTION_KEY);
}

/** Insert or update a store after a successful OAuth install. */
export async function upsertStore(
  env: Env,
  params: { shopDomain: string; accessToken: string; scopes: string; installedBy?: string | null },
): Promise<Store> {
  const shopDomain = params.shopDomain.toLowerCase();
  const encrypted = await encryptSecret(params.accessToken, env.TOKEN_ENCRYPTION_KEY);
  const now = Date.now();
  const existing = await getStoreByDomain(env, shopDomain);

  if (existing) {
    // Reinstall: refresh the credential and reactivate, but keep the id so
    // existing per-store permission grants survive.
    await env.DB.prepare(
      `UPDATE stores
          SET access_token_enc = ?, scopes = ?, status = 'active', updated_at = ?
        WHERE id = ?`,
    )
      .bind(encrypted, params.scopes, now, existing.id)
      .run();
    return { ...existing, scopes: params.scopes, status: 'active', updatedAt: now };
  }

  const id = randomId('str');
  const label = defaultLabelFor(shopDomain);
  await env.DB.prepare(
    `INSERT INTO stores
       (id, shop_domain, label, access_token_enc, scopes, status, installed_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
  )
    .bind(id, shopDomain, label, encrypted, params.scopes, params.installedBy ?? null, now, now)
    .run();

  return {
    id,
    shopDomain,
    label,
    scopes: params.scopes,
    status: 'active',
    installedBy: params.installedBy ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Handle `app/uninstalled`. The token is zeroed rather than kept, since it is
 * dead to Shopify the moment the app is removed and there is no reason to keep
 * a decryptable secret around.
 */
export async function markStoreUninstalled(env: Env, shopDomain: string): Promise<void> {
  await env.DB.prepare(
    `UPDATE stores
        SET status = 'uninstalled', access_token_enc = NULL, updated_at = ?
      WHERE shop_domain = ?`,
  )
    .bind(Date.now(), shopDomain.toLowerCase())
    .run();
}

export async function setStoreLabel(env: Env, storeId: string, label: string): Promise<void> {
  await env.DB.prepare('UPDATE stores SET label = ?, updated_at = ? WHERE id = ?')
    .bind(label, Date.now(), storeId)
    .run();
}
