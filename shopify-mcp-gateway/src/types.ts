/**
 * Shared types and the Worker environment contract.
 */

export interface Env {
  // Bindings
  DB: D1Database;
  SHOP_RATE_LIMITER: DurableObjectNamespace;

  // Vars (wrangler.jsonc)
  GATEWAY_URL: string;
  ALLOWED_EMAIL_DOMAINS: string;
  ALLOWED_EMAILS: string;
  ADMIN_BOOTSTRAP_EMAIL: string;
  SHOPIFY_SCOPES: string;
  SHOPIFY_API_VERSION: string;
  SHOPIFY_PLUS_SHOPS: string;
  ACCESS_TOKEN_TTL_SECONDS: string;
  REFRESH_TOKEN_TTL_SECONDS: string;

  // Secrets (wrangler secret put)
  TOKEN_ENCRYPTION_KEY: string;
  SHOPIFY_API_KEY: string;
  SHOPIFY_API_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  ADMIN_API_KEY: string;
}

export type PrincipalType = 'user' | 'service_account';

/** The authenticated caller behind an MCP request. */
export interface Principal {
  type: PrincipalType;
  id: string;
  /** Human-readable identifier used in audit logs: email or service-account name. */
  label: string;
  /** Only meaningful for users. Service accounts derive authority from grants alone. */
  role: Role;
}

export type Role = 'admin' | 'operator' | 'analyst';

export const SCOPES = [
  'stores:read',
  'products:read',
  'products:write',
  'inventory:read',
  'inventory:write',
  'orders:read',
  'discounts:write',
  'audit:read',
  'admin',
] as const;

export type Scope = (typeof SCOPES)[number];

export interface Store {
  id: string;
  shopDomain: string;
  label: string;
  scopes: string;
  status: 'active' | 'uninstalled' | 'disabled';
  installedBy: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: 'active' | 'suspended';
  createdAt: number;
  lastSeenAt: number | null;
}

export interface ServiceAccount {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'revoked';
  createdBy: string;
  createdAt: number;
  lastUsedAt: number | null;
  expiresAt: number | null;
}

export interface PermissionGrant {
  id: string;
  principalType: PrincipalType;
  principalId: string;
  /** null means every store, including ones installed later. */
  storeId: string | null;
  scope: Scope;
  grantedBy: string;
  grantedAt: number;
}

/** Per-request context threaded through the MCP layer. */
export interface RequestContext {
  env: Env;
  requestId: string;
  principal: Principal;
  ctx: ExecutionContext;
}
