# Shopify Multi-Store MCP Gateway — Architecture

**Status:** approved baseline (v1)
**Last updated:** 2026-08-10

---

## 1. Problem statement

The native Shopify MCP server does not fit our internal use because:

1. **Single-store binding.** It talks to one shop at a time; switching stores is a
   stateful, in-session operation. Our team works across Starpil and Wax Supply
   simultaneously and will add more stores.
2. **Session-bound auth.** Credentials live with the interactive session. When a
   scheduled/unattended task runs, there is no browser to complete a login, so
   jobs fail or silently re-prompt.
3. **No org controls.** No per-user permission model, no audit trail, no way to
   say "Maria can read orders on every store but only write products on Wax
   Supply."

The gateway replaces it with a single always-on multi-tenant MCP endpoint.

### Success criteria

| # | Criterion | How it is met |
|---|---|---|
| S1 | A teammate authenticates once and is not prompted again | OAuth 2.1 + long-lived rotating refresh tokens (§4) |
| S2 | Scheduled tasks run unattended, indefinitely | Service-account tokens, no browser leg (§4.4) |
| S3 | Adding store #3..N requires no code change | OAuth install flow writes a row to D1 (§3) |
| S4 | Every write is attributable | Append-only audit log keyed to actor (§7) |
| S5 | A compromised DB does not leak Shopify tokens | AES-GCM envelope encryption, key in Worker secret (§6) |
| S6 | Transient Shopify failures do not surface as task failures | Cost-aware limiter + bounded retry (§5) |

---

## 2. Topology

```
┌───────────────────────────────────────────────────────────────────────┐
│  Clients                                                              │
│  ┌────────────────┐  ┌────────────────┐  ┌─────────────────────────┐  │
│  │ Claude Desktop │  │ Claude Code    │  │ Scheduled job / cron    │  │
│  │ (human, OAuth) │  │ (human, OAuth) │  │ (service acct, bearer)  │  │
│  └───────┬────────┘  └───────┬────────┘  └───────────┬─────────────┘  │
└──────────┼───────────────────┼───────────────────────┼────────────────┘
           │  Streamable HTTP MCP (JSON-RPC 2.0 over POST /mcp)
           └───────────────────┴───────────────────────┘
                               │
                    ┌──────────▼───────────┐
                    │  Cloudflare Worker   │
                    │  ──────────────────  │
                    │  • OAuth 2.1 AS      │
                    │  • MCP transport     │
                    │  • Permission gate   │
                    │  • Audit writer      │
                    │  • Shopify client    │
                    └──┬────────┬───────┬──┘
                       │        │       │
        ┌──────────────▼──┐  ┌──▼────┐  ▼ ── outbound HTTPS ──┐
        │ D1 (SQLite)     │  │  DO   │                        │
        │ stores, users,  │  │ rate  │   ┌────────────────────▼─────┐
        │ tokens, grants, │  │ limit │   │ Shopify Admin GraphQL    │
        │ audit, clients  │  │ per   │   │  starpil.myshopify.com   │
        └─────────────────┘  │ shop  │   │  waxsupply.myshopify.com │
                             └───────┘   │  …store N                │
                                         └──────────────────────────┘
                                         ┌──────────────────────────┐
                                         │ Google OIDC (identity)   │
                                         └──────────────────────────┘
```

**Why these primitives**

- **Workers** — the MCP endpoint must be reachable from Claude's servers, always
  warm, and globally low-latency. No container to keep alive.
- **D1** — relational is the right shape here (stores × users × grants is a join
  problem, and the audit log wants indexed queries). Single-digit-GB is ample.
- **Durable Objects** — Shopify's rate limit is *per shop*, and Workers are
  distributed. A DO gives one authoritative token bucket per shop, which is the
  only correct place to serialize that state.
- **KV is deliberately not used.** Its eventual consistency is wrong for OAuth
  authorization codes (single-use, must not replay across colos).

---

## 3. Data model

All tables live in one D1 database. Full DDL in `migrations/`.

```
stores                       users                    service_accounts
─────────                    ─────                    ────────────────
id (pk)                      id (pk)                  id (pk)
shop_domain (uniq)           email (uniq)             name (uniq)
label                        name                     description
access_token_enc  ←encrypted status                   created_by
scopes                       role                     status
status                       created_at               created_at
installed_by                 last_seen_at             last_used_at
created_at / updated_at
        │                          │                        │
        │                          └───────────┬────────────┘
        │                                      │  principal (user | service_account)
        │                                      │
        └──────────────┬───────────────────────┘
                       ▼
                 permissions
                 ───────────
                 id (pk)
                 principal_type   'user' | 'service_account'
                 principal_id
                 store_id         (NULL = all stores, incl. future ones)
                 scope            e.g. 'products:write'
                 granted_by / granted_at

oauth_clients            oauth_authorizations       oauth_tokens
─────────────            ──────────────────────     ────────────
client_id (pk)           code_hash (pk)             id (pk)
client_secret_hash       client_id                  token_hash (uniq)
redirect_uris (json)     user_id                    kind  'access' | 'refresh'
name                     code_challenge (S256)      principal_type/_id
created_at               redirect_uri               client_id
                         scope                      scope
                         expires_at (60s)           expires_at
                         consumed_at                revoked_at
                                                    rotated_from

audit_log (append-only)                    idempotency_keys
───────────────────────                    ────────────────
id (pk)            request_id              key (pk)
ts                 tool                    principal_id
principal_type     store_id                response_hash
principal_id       args_redacted (json)    created_at
principal_label    outcome  ok|denied|error
                   error_code
                   duration_ms
                   shopify_cost
```

### Design notes

- `permissions.store_id IS NULL` means "every store, including ones installed
  later." This is what makes S3 (add a store, no code change) actually hold for
  admins without a permission backfill.
- `oauth_tokens` stores only a SHA-256 **hash** of the token. A DB dump yields no
  usable credential. `rotated_from` gives us refresh-token reuse detection.
- `stores.access_token_enc` is the one place a decryptable secret exists, and it
  is encrypted with a key that lives only in a Worker secret binding.
- The audit log is append-only by convention *and* by grant: no code path issues
  UPDATE or DELETE against it.

---

## 4. Authentication and authorization

There are three distinct trust relationships. Conflating them is the usual
source of "why do I have to log in again."

### 4.1 Gateway ← Client (MCP OAuth 2.1)

Claude Desktop / Claude Code speak the MCP authorization spec: they discover the
AS, dynamically register, run PKCE, and hold a refresh token.

```
Client                     Gateway (AS)                 Google
  │                             │                          │
  │ GET /.well-known/oauth-protected-resource              │
  │────────────────────────────>│                          │
  │ GET /.well-known/oauth-authorization-server            │
  │────────────────────────────>│                          │
  │ POST /register  (DCR)       │                          │
  │────────────────────────────>│                          │
  │ GET /authorize?PKCE…        │                          │
  │────────────────────────────>│  302 to Google OIDC      │
  │                             │─────────────────────────>│
  │                             │  id_token (hd=<domain>)  │
  │                             │<─────────────────────────│
  │                             │  verify JWT via JWKS,    │
  │                             │  enforce domain allowlist│
  │  302 ?code=…                │  upsert user             │
  │<────────────────────────────│                          │
  │ POST /token (code+verifier) │                          │
  │────────────────────────────>│                          │
  │  access(1h) + refresh(90d)  │                          │
  │<────────────────────────────│                          │
```

**Why this satisfies "OAuth once, no constant re-auth":**
access tokens are short (1 h) but the client silently refreshes. Refresh tokens
are **rotated on every use and their expiry slides forward 90 days**. A teammate
who uses the gateway at all stays signed in forever; one who disappears for 90
days signs in again. Rotation plus `rotated_from` reuse-detection means a stolen
refresh token is detected and the whole chain is revoked.

Identity is federated to Google Workspace and gated on the `hd` claim matching
`ALLOWED_EMAIL_DOMAINS`, with an optional explicit `ALLOWED_EMAILS` allowlist.
Offboarding someone in Google Workspace locks them out at next refresh.

### 4.2 Gateway ← Scheduled tasks (service accounts)

No browser, so no authorization-code leg. An admin runs:

```
POST /admin/service-accounts  {"name":"nightly-inventory-sync", ...}
→ returns a bearer token, shown exactly once
```

The token is a long random string; only its hash is stored. Scheduled tasks put
it in an `Authorization: Bearer` header. Service accounts get their own
permission grants and appear in the audit log under their own name — so
"nightly-inventory-sync retagged 400 products" is never misattributed to a
person, and revoking the job does not require disabling a human's account.

### 4.3 Gateway → Shopify (offline tokens)

One **distributed Shopify app**, installed per store by a store admin:

```
/shopify/install?shop=starpil.myshopify.com
   → Shopify consent screen
   → /shopify/callback?code&hmac&state
   → verify HMAC (constant-time) + state nonce + shop-domain shape
   → exchange code for OFFLINE access token
   → encrypt, INSERT INTO stores
```

Offline tokens do not expire, which is precisely what unattended scheduling
needs. Adding a store is: open the install URL, click install. No deploy.

`app/uninstalled` webhook marks the store `uninstalled` and zeroes the token.

### 4.4 Permission model

Scopes are coarse enough to reason about and fine enough to be useful:

| Scope | Grants |
|---|---|
| `stores:read` | list stores the principal can see |
| `products:read` | product search / get |
| `products:write` | product update, bulk tagging |
| `inventory:read` | inventory levels |
| `inventory:write` | set / adjust inventory |
| `orders:read` | order search / get |
| `discounts:write` | create discount codes |
| `audit:read` | query the audit log |
| `admin` | manage users, service accounts, grants |

Every scope is evaluated **against a specific store**. `Maria` can hold
`products:write` on Wax Supply and only `orders:read` on Starpil. Three built-in
roles (`admin`, `operator`, `analyst`) are conveniences that expand to grant
sets; the grant table is the source of truth.

Enforcement is a single choke point: no tool handler talks to Shopify without
passing through `requireScope(principal, storeId, scope)`. There is no
"trusted internal" bypass path.

---

## 5. Shopify access layer

### Rate limiting

Shopify's GraphQL Admin API is a **cost-based leaky bucket, per shop**: a bucket
of 1000 points refilling at 50/s (higher on Plus). Every response reports
`throttleStatus { maximumAvailable, currentlyAvailable, restoreRate }`.

A Durable Object per shop domain holds the authoritative bucket:

1. Caller asks the DO to reserve estimated cost → DO returns "go" or "wait N ms".
2. After the call, the real cost from `throttleStatus` reconciles the estimate.
3. Concurrent Workers serialize through the same DO, so N parallel bulk-tag
   batches cannot collectively blow the bucket.

This is what keeps a 500-product bulk tag from tripping 429s halfway through and
leaving a partial write.

### Retry

Bounded exponential backoff with full jitter, max 4 attempts:

- **Retry:** 429 (honor `Retry-After`), 500/502/503/504, network errors,
  GraphQL `THROTTLED`.
- **Do not retry:** 4xx other than 429, and any GraphQL `userErrors` — those are
  deterministic and retrying just burns quota.

Writes carry an idempotency key so a retry after an ambiguous timeout cannot
double-apply.

### Error handling

Shopify failures are translated into a small, stable taxonomy that the model can
actually act on, rather than leaking raw HTTP:

`STORE_NOT_FOUND`, `STORE_UNINSTALLED`, `PERMISSION_DENIED`, `NOT_FOUND`,
`VALIDATION_FAILED` (carries Shopify `userErrors` verbatim), `RATE_LIMITED`,
`UPSTREAM_ERROR`, `INTERNAL_ERROR`.

Each is returned as an MCP tool error with a human-readable message *and* a
machine code, so a scheduled task can branch on the code and a human reading
Claude's output gets a sentence that says what to do next.

---

## 6. Token storage

```
plaintext token
   → AES-256-GCM (WebCrypto), random 96-bit IV per encryption
   → stored as  v1:<base64url iv>:<base64url ciphertext+tag>
```

The key is a 32-byte value in the `TOKEN_ENCRYPTION_KEY` Worker secret, never in
D1, never in the repo, never in `wrangler.jsonc`. The `v1:` prefix is a version
tag so we can rotate algorithm or key without a flag-day migration.

What this buys: a D1 export, a leaked backup, or read access to the database
alone is not sufficient to call Shopify. An attacker needs the Worker secret too.

Gateway-issued tokens (access/refresh/service-account) are never stored at all —
only SHA-256 hashes, compared in constant time.

---

## 7. Audit logging

Every tool invocation writes one row, before *and* after:

- **Who** — principal type, id, and human label (email or service-account name)
- **What** — tool name, target store, redacted arguments
- **Outcome** — `ok` / `denied` / `error`, error code, duration, Shopify cost
- **Correlation** — a request id echoed in error messages, so a user-reported
  failure is one indexed lookup

Redaction is allowlist-based: argument fields are recorded only if the tool
declares them safe to log. A new tool cannot accidentally start logging PII.

Denials are logged as loudly as successes — an operator repeatedly hitting
`PERMISSION_DENIED` on a store is a signal worth having.

---

## 8. MCP surface

Transport: **Streamable HTTP**, `POST /mcp`, JSON-RPC 2.0.

Every tool takes an explicit `store` argument (domain or label). There is no
ambient "current store" — that statefulness is the native server's core problem,
and a scheduled task must never depend on prior session state.

| Tool | Scope | Purpose |
|---|---|---|
| `list_stores` | `stores:read` | Stores the caller can access, with granted scopes |
| `product_search` | `products:read` | Query by text/tag/status/vendor, paginated |
| `product_get` | `products:read` | Full product incl. variants and inventory |
| `product_update` | `products:write` | Title, description, status, vendor, type, tags |
| `bulk_tag` | `products:write` | Add/remove tags across many products, batched |
| `inventory_get` | `inventory:read` | Levels by variant/SKU across locations |
| `inventory_set` | `inventory:write` | Absolute set or relative adjust, per location |
| `order_search` | `orders:read` | Query by status/date/customer, paginated |
| `order_get` | `orders:read` | Full order incl. line items and fulfillment |
| `discount_create` | `discounts:write` | Percentage/fixed code discounts |
| `audit_search` | `audit:read` | Query the audit trail |

`tools/list` is **filtered per principal**: an analyst never sees `bulk_tag`.
This keeps the model from proposing actions the caller cannot take.

---

## 9. Phased delivery

| Phase | Content | Status |
|---|---|---|
| 0 | Architecture, PROJECT.md | ✅ |
| 1 | Scaffold, D1 schema, crypto, repositories | ✅ |
| 2 | Shopify OAuth install flow | ✅ |
| 3 | Gateway OAuth 2.1 AS + Google SSO + service accounts | ✅ |
| 4 | Shopify client, rate limiter DO, retry | ✅ |
| 5 | MCP transport + 11 tools | ✅ |
| 6 | Permissions enforcement + audit logging | ✅ |
| 7 | Tests, admin API, deployment runbook | ✅ |

---

## 10. Explicitly out of scope for v1

Recorded so they are decisions, not oversights:

- **Webhook ingestion beyond `app/uninstalled`.** No product/order sync. The
  gateway is a read-through proxy; adding an event pipeline is a separate design.
- **Shopify Bulk Operations API.** `bulk_tag` batches through the normal API,
  which is correct up to a few thousand products. Beyond that, the async bulk
  mutation endpoint is the right tool and would change the tool contract to
  poll-based.
- **Caching of Shopify reads.** Correctness over latency; stale inventory is
  worse than slow inventory.
- **A web admin UI.** Admin operations are HTTP endpoints plus a CLI script.
- **Multi-region D1 replication.** Single primary is fine at our write volume.
