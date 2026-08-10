-- Shopify Multi-Store MCP Gateway — initial schema
-- See docs/ARCHITECTURE.md §3 for the rationale behind these shapes.

-- ---------------------------------------------------------------------------
-- Stores. One row per Shopify shop that has installed the app.
-- access_token_enc holds an AES-256-GCM envelope (see src/lib/crypto.ts);
-- it is the only decryptable secret in this database.
-- ---------------------------------------------------------------------------
CREATE TABLE stores (
  id                TEXT PRIMARY KEY,
  shop_domain       TEXT NOT NULL UNIQUE,       -- e.g. starpil.myshopify.com
  label             TEXT NOT NULL,              -- friendly name, e.g. "Starpil"
  access_token_enc  TEXT,                       -- NULL once uninstalled
  scopes            TEXT NOT NULL DEFAULT '',   -- comma-separated, as granted
  status            TEXT NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active', 'uninstalled', 'disabled')),
  installed_by      TEXT,                       -- users.id, NULL if installed out-of-band
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL
);

CREATE INDEX idx_stores_status ON stores (status);

-- ---------------------------------------------------------------------------
-- Human principals, established on first successful Google sign-in.
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL DEFAULT '',
  role          TEXT NOT NULL DEFAULT 'operator'
                  CHECK (role IN ('admin', 'operator', 'analyst')),
  status        TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'suspended')),
  created_at    INTEGER NOT NULL,
  last_seen_at  INTEGER
);

CREATE INDEX idx_users_email ON users (email);

-- ---------------------------------------------------------------------------
-- Non-human principals for scheduled/unattended work. The bearer token is
-- never stored — only its SHA-256 hash.
-- ---------------------------------------------------------------------------
CREATE TABLE service_accounts (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE,
  description   TEXT NOT NULL DEFAULT '',
  token_hash    TEXT NOT NULL UNIQUE,
  status        TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'revoked')),
  created_by    TEXT NOT NULL,                  -- users.id of the granting admin
  created_at    INTEGER NOT NULL,
  last_used_at  INTEGER,
  expires_at    INTEGER                         -- NULL = no expiry
);

CREATE INDEX idx_service_accounts_token_hash ON service_accounts (token_hash);

-- ---------------------------------------------------------------------------
-- Permission grants. A NULL store_id means "all stores, including stores
-- installed in the future" — this is what lets an admin stay an admin when
-- store #3 is added, with no backfill.
-- ---------------------------------------------------------------------------
CREATE TABLE permissions (
  id              TEXT PRIMARY KEY,
  principal_type  TEXT NOT NULL CHECK (principal_type IN ('user', 'service_account')),
  principal_id    TEXT NOT NULL,
  store_id        TEXT,                          -- NULL = all stores
  scope           TEXT NOT NULL,
  granted_by      TEXT NOT NULL,
  granted_at      INTEGER NOT NULL
);

-- A principal should hold a given (store, scope) at most once. Two partial
-- indexes are needed because SQLite treats NULLs as distinct in a UNIQUE index,
-- which would otherwise allow duplicate all-store grants.
CREATE UNIQUE INDEX idx_permissions_unique_store
  ON permissions (principal_type, principal_id, store_id, scope)
  WHERE store_id IS NOT NULL;

CREATE UNIQUE INDEX idx_permissions_unique_global
  ON permissions (principal_type, principal_id, scope)
  WHERE store_id IS NULL;

CREATE INDEX idx_permissions_principal
  ON permissions (principal_type, principal_id);

-- ---------------------------------------------------------------------------
-- OAuth clients. Populated by RFC 7591 dynamic client registration, which is
-- how Claude Desktop / Claude Code register themselves.
-- ---------------------------------------------------------------------------
CREATE TABLE oauth_clients (
  client_id           TEXT PRIMARY KEY,
  client_secret_hash  TEXT,                      -- NULL for public (PKCE-only) clients
  client_name         TEXT NOT NULL DEFAULT '',
  redirect_uris       TEXT NOT NULL,             -- JSON array
  created_at          INTEGER NOT NULL
);

-- ---------------------------------------------------------------------------
-- In-flight authorization codes. Single-use, 60-second lifetime.
-- Stored by hash so a DB read cannot redeem one.
-- ---------------------------------------------------------------------------
CREATE TABLE oauth_authorizations (
  code_hash       TEXT PRIMARY KEY,
  client_id       TEXT NOT NULL,
  user_id         TEXT NOT NULL,
  redirect_uri    TEXT NOT NULL,
  code_challenge  TEXT NOT NULL,                 -- S256 only
  scope           TEXT NOT NULL DEFAULT '',
  resource        TEXT,                          -- RFC 8707 resource indicator
  expires_at      INTEGER NOT NULL,
  consumed_at     INTEGER
);

CREATE INDEX idx_oauth_authorizations_expires ON oauth_authorizations (expires_at);

-- ---------------------------------------------------------------------------
-- Issued access and refresh tokens, stored as SHA-256 hashes only.
-- rotated_from gives us refresh-token reuse detection: if a token that has
-- already been rotated is presented again, the whole chain is revoked.
-- ---------------------------------------------------------------------------
CREATE TABLE oauth_tokens (
  id              TEXT PRIMARY KEY,
  token_hash      TEXT NOT NULL UNIQUE,
  kind            TEXT NOT NULL CHECK (kind IN ('access', 'refresh')),
  principal_type  TEXT NOT NULL CHECK (principal_type IN ('user', 'service_account')),
  principal_id    TEXT NOT NULL,
  client_id       TEXT,
  scope           TEXT NOT NULL DEFAULT '',
  chain_id        TEXT NOT NULL,                 -- shared across a rotation chain
  rotated_from    TEXT,                          -- oauth_tokens.id this replaced
  issued_at       INTEGER NOT NULL,
  expires_at      INTEGER NOT NULL,
  revoked_at      INTEGER
);

CREATE INDEX idx_oauth_tokens_hash ON oauth_tokens (token_hash);
CREATE INDEX idx_oauth_tokens_chain ON oauth_tokens (chain_id);
CREATE INDEX idx_oauth_tokens_expires ON oauth_tokens (expires_at);

-- ---------------------------------------------------------------------------
-- Short-lived state for the Shopify install flow and the Google sign-in leg.
-- ---------------------------------------------------------------------------
CREATE TABLE oauth_state (
  state       TEXT PRIMARY KEY,
  kind        TEXT NOT NULL CHECK (kind IN ('shopify_install', 'google_signin')),
  payload     TEXT NOT NULL,                     -- JSON, flow-specific
  expires_at  INTEGER NOT NULL
);

CREATE INDEX idx_oauth_state_expires ON oauth_state (expires_at);

-- ---------------------------------------------------------------------------
-- Append-only audit trail. No code path issues UPDATE or DELETE here except
-- the retention job. See docs/ARCHITECTURE.md §7.
-- ---------------------------------------------------------------------------
CREATE TABLE audit_log (
  id               TEXT PRIMARY KEY,
  ts               INTEGER NOT NULL,
  request_id       TEXT NOT NULL,
  principal_type   TEXT NOT NULL,
  principal_id     TEXT NOT NULL,
  principal_label  TEXT NOT NULL,                -- email or service-account name
  tool             TEXT NOT NULL,
  store_id         TEXT,
  store_domain     TEXT,
  args_redacted    TEXT NOT NULL DEFAULT '{}',   -- JSON, allowlisted fields only
  outcome          TEXT NOT NULL CHECK (outcome IN ('ok', 'denied', 'error')),
  error_code       TEXT,
  error_message    TEXT,
  duration_ms      INTEGER NOT NULL DEFAULT 0,
  shopify_cost     REAL
);

CREATE INDEX idx_audit_ts ON audit_log (ts DESC);
CREATE INDEX idx_audit_principal ON audit_log (principal_id, ts DESC);
CREATE INDEX idx_audit_store ON audit_log (store_id, ts DESC);
CREATE INDEX idx_audit_outcome ON audit_log (outcome, ts DESC);
CREATE INDEX idx_audit_request ON audit_log (request_id);

-- ---------------------------------------------------------------------------
-- Idempotency for mutating tools, so a retry after an ambiguous timeout
-- cannot double-apply a write.
-- ---------------------------------------------------------------------------
CREATE TABLE idempotency_keys (
  key           TEXT PRIMARY KEY,
  principal_id  TEXT NOT NULL,
  tool          TEXT NOT NULL,
  response      TEXT NOT NULL,                   -- JSON of the original result
  created_at    INTEGER NOT NULL,
  expires_at    INTEGER NOT NULL
);

CREATE INDEX idx_idempotency_expires ON idempotency_keys (expires_at);
