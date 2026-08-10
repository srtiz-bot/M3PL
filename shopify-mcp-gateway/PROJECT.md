# PROJECT — Shopify Multi-Store MCP Gateway

Living status document. Updated as work proceeds.
**Last updated:** 2026-08-10

---

## 1. Status

| | |
|---|---|
| **Phase** | 7 of 7 — code complete, verified end-to-end locally |
| **Build** | `tsc --noEmit` clean · `vitest` 75/75 · `wrangler deploy --dry-run` bundles (177 KiB) |
| **Runtime** | Verified against a live local Worker + D1 — see §1.1 |
| **Deployed** | Not yet — needs Cloudflare account + Shopify app + Google OAuth client |
| **Blocking on** | Human steps in §5 (credentials only, no code work) |

### 1.1 End-to-end verification performed

Run against `wrangler dev` with a real local D1. 26 checks, all passing:

| Area | Verified |
|---|---|
| Schema | All 28 DDL statements apply; partial unique indexes deduplicate repeat grants (4 inserts → 2 rows) |
| Permissions | Per-store grant allows one store and denies another; all-store grant reaches a store created *afterwards* (criterion S3) |
| Discovery | RFC 9728 + RFC 8414 documents served correctly |
| MCP auth | No token → 401 with `WWW-Authenticate` + `resource_metadata`; bogus token → 401 |
| DCR | Registers a loopback client; rejects `http://` on a non-loopback host |
| OAuth | Unregistered `redirect_uri` rejected; PKCE `plain` rejected; valid S256 redirects to Google; bad grant_type and bogus code rejected |
| Tool filtering | Service account with 4 scopes sees exactly 5 tools — no `bulk_tag`, `discount_create`, `order_*` or `audit_search` (D-011) |
| Store resolution | Short name, friendly label, full domain and mixed case all resolve; unknown store returns the list of available ones |
| Denials | `product_update` without `products:write` → `PERMISSION_DENIED`, logged with `outcome='denied'` |
| Safety guards | Unfiltered `bulk_tag` refused; 80% discount refused without `allowDeepDiscount`; discount without end date refused |
| **PII redaction** | `order_search` with a customer email logged as `"email":"[redacted]"`; **0 occurrences** of the raw address anywhere in `audit_log` (D-009) |
| Crypto | AES-GCM round-trip, random IV per encryption, tamper detection, wrong-key rejection, 32-byte key enforcement |

Not verifiable without live credentials: the Shopify token exchange, the Google
token exchange, and real Admin API calls. Everything up to the outbound request
is exercised.

### What works today

- Cloudflare Worker with D1 schema and migrations
- Shopify OAuth install flow (HMAC-verified) → encrypted offline tokens
- OAuth 2.1 authorization server with PKCE + dynamic client registration
- Google Workspace SSO federation with domain allowlist
- Service accounts with scoped, rotatable bearer tokens
- Per-shop cost-aware rate limiting via Durable Object
- Bounded retry with jitter, `Retry-After` handling, idempotent writes
- MCP Streamable HTTP transport, 11 tools, per-principal tool filtering
- Scope enforcement at a single choke point
- Append-only audit log with allowlist-based redaction

### What is not built (by decision, see §4)

Webhook sync beyond `app/uninstalled`; Shopify Bulk Operations API; read
caching; web admin UI. Rationale in `docs/ARCHITECTURE.md` §10.

---

## 2. Task board

### Done

- [x] **P0** Architecture doc — `docs/ARCHITECTURE.md`
- [x] **P0** This document
- [x] **P1** Worker scaffold: `package.json`, `tsconfig.json`, `wrangler.jsonc`
- [x] **P1** D1 schema — `migrations/0001_init.sql`
- [x] **P1** AES-256-GCM envelope encryption — `src/lib/crypto.ts`
- [x] **P1** Typed D1 repositories — `src/db/`
- [x] **P2** Shopify install + callback + HMAC verify — `src/auth/shopify-oauth.ts`
- [x] **P2** `app/uninstalled` webhook handler
- [x] **P3** OAuth 2.1 AS: discovery, DCR, PKCE, rotating refresh — `src/auth/oauth-server.ts`
- [x] **P3** Google OIDC federation + domain allowlist — `src/auth/google.ts`
- [x] **P3** Service-account issuance and verification
- [x] **P4** Shopify GraphQL client — `src/shopify/client.ts`
- [x] **P4** Per-shop rate limiter Durable Object — `src/shopify/rate-limiter.ts`
- [x] **P4** Retry with full jitter — `src/lib/retry.ts`
- [x] **P5** MCP JSON-RPC transport — `src/mcp/server.ts`
- [x] **P5** 11 tools — `src/tools/`
- [x] **P6** Scope enforcement — `src/auth/permissions.ts`
- [x] **P6** Audit log writer + redaction — `src/lib/audit.ts`
- [x] **P7** Unit tests — `test/`
- [x] **P7** Admin endpoints — `src/admin.ts`
- [x] **P7** Deployment runbook — `README.md`

### Next up (post-deploy)

- [ ] Deploy to Cloudflare, run migrations, set secrets
- [ ] Install Shopify app on Starpil, then Wax Supply
- [ ] Onboard team, grant per-store scopes
- [ ] Create the first service account and point one scheduled job at it
- [ ] Watch audit log for a week; tune scope grants from real usage

### Backlog (not scheduled)

- [ ] Bulk Operations API path for >2k-product tagging
- [ ] Slack notification on `denied` audit events
- [ ] Metafield read/write tools
- [ ] Automated refresh-token reuse alerting

---

## 3. Decision log

Newest first. Each entry: what was decided, why, and what it costs.

### D-012 — Repo lives in a subdirectory pending transplant
**Decision:** built at `shopify-mcp-gateway/` on branch
`claude/cloudflare-shopify-gateway-vcd4k7` of `srtiz-bot/M3PL`.
**Why:** the GitHub App authorizing this session cannot create repositories
(403 `Resource not accessible by integration`), so the new repo could not be
created from here. The tree is fully self-contained — nothing references its
parent — so it transplants with a copy and a fresh `git init`.
**Cost:** one manual step. See README §11.

### D-011 — `tools/list` is filtered per principal
**Decision:** callers only see tools they hold a scope for on ≥1 store.
**Why:** an analyst seeing `bulk_tag` invites the model to propose writes that
will be denied, wasting a turn and producing a confusing error.
**Cost:** `tools/list` costs one extra D1 query.

### D-010 — Every tool takes an explicit `store` argument
**Decision:** no ambient "current store"; no `switch_shop`.
**Why:** this is the native server's core defect. Statefulness across calls is
exactly what breaks unattended jobs, which have no session to carry state.
**Cost:** slightly more verbose calls. Worth it.

### D-009 — Audit redaction is allowlist, not denylist
**Decision:** tools declare which argument fields are safe to log; everything
else is dropped.
**Why:** a denylist fails open — add a tool with a `customerEmail` arg and you
have silently started logging PII.
**Cost:** each new tool must declare its loggable fields.

### D-008 — Idempotency keys on all writes
**Decision:** write tools accept/derive an idempotency key, checked in D1.
**Why:** retry after an ambiguous timeout must not double-apply a tag or
double-decrement inventory.
**Cost:** one D1 read+write per mutation.

### D-007 — Durable Object per shop for rate limiting
**Decision:** authoritative leaky-bucket state in a DO keyed by shop domain.
**Why:** Shopify's limit is per-shop and cost-based; Workers are distributed, so
without a serialization point, parallel batches collectively exceed the bucket.
**Cost:** a DO hop (~ms) per Shopify call. Cheap relative to the API call.

### D-006 — Retry never retries GraphQL `userErrors`
**Decision:** retry transport/throttle failures only.
**Why:** `userErrors` are deterministic validation failures. Retrying burns
quota and delays a clear error the caller needs to see.
**Cost:** none.

### D-005 — Service accounts, not a human's token, for scheduled tasks
**Decision:** named non-human principals with their own grants.
**Why:** correct attribution in the audit log, revocable independently, and the
job survives that person leaving the company.
**Cost:** one more principal type through the auth layer.

### D-004 — Refresh tokens rotate on use, with 90-day sliding expiry
**Decision:** each refresh issues a new refresh token and invalidates the old;
`rotated_from` enables reuse detection.
**Why:** delivers "OAuth once" — an active user never re-authenticates — while
keeping a stolen token detectable and time-bounded.
**Cost:** a write on every refresh.

### D-003 — Identity federated to Google Workspace
**Decision:** the gateway is the OAuth AS to MCP clients, but delegates identity
to Google OIDC, gated on the `hd` claim.
**Why:** no password storage, and Workspace offboarding revokes access for free.
**Cost:** dependency on Google availability at sign-in (not at refresh).

### D-002 — One distributed Shopify app, OAuth-installed per store
**Decision:** over per-store custom apps with pasted admin tokens.
**Why:** adding store #3 becomes a click, not a code+secret change. Offline
tokens don't expire, which is what unattended scheduling requires.
**Cost:** Shopify app configuration is more involved up front.

### D-001 — D1 over KV for all state
**Decision:** relational store for everything, including OAuth codes.
**Why:** stores × users × grants is a join problem; the audit log needs indexed
queries. KV's eventual consistency is actively wrong for single-use auth codes,
which could replay across colos.
**Cost:** D1 write latency is higher than KV. Not on any hot path.

---

## 4. Open questions

| # | Question | Owner | Notes |
|---|---|---|---|
| Q1 | Which Google Workspace domain(s) to allow? | Sergio | `starpilwax.com` assumed; confirm whether Wax Supply staff use a second domain |
| Q2 | Shopify Plus on either store? | Sergio | Affects rate-limit bucket size (`SHOPIFY_PLUS_SHOPS`) |
| Q3 | Should `discount_create` require a second approval? | Sergio | Currently a normal scoped write; discounts are money |
| Q4 | Retention on `audit_log`? | Sergio | Unbounded today; suggest 400 days then archive to R2 |

---

## 5. Human steps required before first use

None of these are code. Details in `README.md`.

1. **Cloudflare** — create D1 DB, put its id in `wrangler.jsonc`, run migrations.
2. **Shopify Partners** — create the app, set redirect URL, note key/secret.
3. **Google Cloud** — OAuth client (Web), set redirect URL, note id/secret.
4. **Secrets** — `wrangler secret put` for the six values in README §3.
5. **Deploy**, then open the install URL once per store.
6. **Bootstrap the first admin** via `ADMIN_BOOTSTRAP_EMAIL`.

---

## 6. Changelog

| Date | Entry |
|---|---|
| 2026-08-10 | Phases 0–7 implemented. Architecture approved. 75 unit tests + 26 live end-to-end checks passing. Awaiting deploy. |
