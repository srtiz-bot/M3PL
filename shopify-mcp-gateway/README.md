# Shopify Multi-Store MCP Gateway

A Cloudflare Worker that replaces the native Shopify MCP server for internal
team use. One always-on endpoint, every store, per-user OAuth, and scheduled
tasks that keep running without anyone re-authenticating.

- **Architecture:** [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- **Status, tasks and decision log:** [`PROJECT.md`](PROJECT.md)

---

## Why this exists

| Problem with the native server | What this does instead |
|---|---|
| One store per session; `switch_shop` is stateful | Every tool takes an explicit `store` argument. No hidden state. |
| Auth is tied to an interactive session, so cron jobs stall | Service-account tokens: no browser leg, no expiry. |
| No permission model | Per-user, per-store scopes enforced at one choke point. |
| No audit trail | Every call — including denials — is logged with an actor. |

---

## 1. What you need before deploying

| | Where | What you get |
|---|---|---|
| Cloudflare account | dash.cloudflare.com | Workers + D1 |
| Shopify app | partners.shopify.com | `SHOPIFY_API_KEY` / `SHOPIFY_API_SECRET` |
| Google OAuth client | console.cloud.google.com | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` |

---

## 2. Deploy

```bash
npm install

# 1. Create the database and paste the printed id into wrangler.jsonc
npx wrangler d1 create shopify-mcp-gateway

# 2. Create the tables
npm run migrate:remote

# 3. Deploy once to claim your workers.dev URL
npm run deploy
```

Now set `GATEWAY_URL` in `wrangler.jsonc` to the URL that deploy printed (or
your custom domain) and set `ALLOWED_EMAIL_DOMAINS` / `ADMIN_BOOTSTRAP_EMAIL`
to your own values.

**The gateway URL must match exactly** in three places — Cloudflare, Shopify
and Google. A trailing slash or an `http://` mismatch is the single most common
cause of a failed callback.

## 3. Secrets

```bash
# 32 random bytes, base64url. Generate it once; changing it makes every stored
# Shopify token undecryptable and forces a reinstall on every store.
openssl rand -base64 32 | tr '+/' '-_' | tr -d '=' | npx wrangler secret put TOKEN_ENCRYPTION_KEY

npx wrangler secret put SHOPIFY_API_KEY
npx wrangler secret put SHOPIFY_API_SECRET
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET

# Break-glass admin credential for bootstrap and scripted onboarding.
openssl rand -base64 32 | npx wrangler secret put ADMIN_API_KEY
```

Then redeploy: `npm run deploy`.

### Shopify app settings

In your Partners dashboard, on the app:

- **App URL:** `https://YOUR-GATEWAY/`
- **Allowed redirection URL:** `https://YOUR-GATEWAY/shopify/callback`
- **Scopes:** match `SHOPIFY_SCOPES` in `wrangler.jsonc`

### Google OAuth client settings

Create an **OAuth client ID → Web application**:

- **Authorized redirect URI:** `https://YOUR-GATEWAY/auth/google/callback`

---

## 4. Connect your stores

Open once per store, signed in as a Shopify admin:

```
https://YOUR-GATEWAY/shopify/install?shop=starpil.myshopify.com
https://YOUR-GATEWAY/shopify/install?shop=waxsupply.myshopify.com
```

Adding a third store later is the same URL with a different `shop`. No deploy,
no code change, no secret to rotate.

---

## 5. Onboard your team

Each person signs in once from their MCP client (see §6). That creates their
account as a read-only **analyst**. An admin then grants what they need:

```bash
export GW=https://YOUR-GATEWAY
export ADMIN_KEY=<the ADMIN_API_KEY you set>

# Full operator access on every store, including future ones
./scripts/admin.sh grant maria@starpilwax.com --role operator

# Or scope tightly: write products on Wax Supply only
./scripts/admin.sh grant maria@starpilwax.com \
  --scopes products:read,products:write \
  --store waxsupply.myshopify.com

# See who has what
./scripts/admin.sh overview
```

Roles are presets, not fences — `operator` expands into a grant set you can
then tailor per person.

| Role | Scopes |
|---|---|
| `analyst` | read products, inventory, orders |
| `operator` | everything analyst has, plus product/inventory writes and discounts |
| `admin` | everything, including permission management and the audit log |

### Offboarding

```bash
./scripts/admin.sh offboard maria@starpilwax.com
```

Suspends the account, drops every grant, and revokes live tokens immediately —
an open session stops working on the next call, not at the next token expiry.

---

## 6. Connect a client

Add the server to Claude Desktop, Claude Code, or any MCP client that supports
remote servers with OAuth:

```
https://YOUR-GATEWAY/mcp
```

The client discovers the authorization server, registers itself, and opens a
browser for Google sign-in. **That is the only sign-in you will do.** The
access token lasts an hour, but the client refreshes silently and each refresh
slides the 90-day window forward — so an active user never sees a login screen
again.

---

## 7. Scheduled and unattended tasks

Scheduled work uses a service account, not a person's session:

```bash
./scripts/admin.sh service-account nightly-inventory-sync \
  --scopes stores:read,inventory:read,inventory:write \
  --store waxsupply.myshopify.com
```

The token is printed **once**. Put it in your scheduler and call the gateway
directly:

```bash
curl -X POST "$GW/mcp" \
  -H "Authorization: Bearer $SERVICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call",
       "params":{"name":"inventory_get",
                 "arguments":{"store":"waxsupply.myshopify.com","sku":"WAX-500"}}}'
```

Rotate without downtime — mint the new token, update the scheduler, then the
old one stops working:

```bash
./scripts/admin.sh rotate <service-account-id>
```

---

## 8. Tools

Every tool takes an explicit `store`. Call `list_stores` first.

| Tool | Scope | What it does |
|---|---|---|
| `list_stores` | `stores:read` | Stores you can reach, and your permissions on each |
| `product_search` | `products:read` | Search by text, tag, status, vendor, type |
| `product_get` | `products:read` | One product with variants and per-location stock |
| `product_update` | `products:write` | Title, description, status, vendor, type, tags |
| `bulk_tag` | `products:write` | Add/remove tags across many products |
| `inventory_get` | `inventory:read` | Stock by SKU / variant / product, per location |
| `inventory_set` | `inventory:write` | Absolute set or relative adjust |
| `order_search` | `orders:read` | Orders by status, date, customer, text |
| `order_get` | `orders:read` | One order with line items and fulfillments |
| `discount_create` | `discounts:write` | Percentage or fixed-amount discount codes |
| `audit_search` | `audit:read` | Who did what, where, and whether it worked |

`tools/list` is filtered per caller, so an analyst never sees `bulk_tag`.

### Safety behaviours worth knowing

- **`bulk_tag` refuses to run unfiltered.** Without `productIds` or at least one
  search filter it errors rather than tagging the whole catalogue. Use
  `dryRun: true` to see what would change.
- **`discount_create` requires an end date** unless you pass
  `neverExpires: true`, and blocks percentage discounts over 50% unless you pass
  `allowDeepDiscount: true` — because "50" meaning 50% and "50" meaning $50 is
  one keystroke apart.
- **`inventory_set` refuses ambiguity.** A SKU matching two variants, or a
  variant stocked at several locations, is an error rather than a guess.
- **Mutating tools accept `idempotencyKey`.** Repeating a call with the same key
  returns the first result instead of applying the change twice.

---

## 9. Development

```bash
npm run typecheck     # tsc --noEmit
npm test              # vitest
npm run migrate:local # apply migrations to a local D1
npm run dev           # wrangler dev
npm run tail          # live production logs
```

---

## 10. Operations

**Find out who changed something.** Ask Claude to run `audit_search`, or query
D1 directly:

```bash
npx wrangler d1 execute shopify-mcp-gateway --remote --command \
  "SELECT datetime(ts/1000,'unixepoch') t, principal_label, tool, store_domain, outcome
     FROM audit_log ORDER BY ts DESC LIMIT 20"
```

**Every response carries `X-Request-Id`**, and it appears in the matching audit
row — so a reported failure is one indexed lookup.

**Watch for `refresh_token_reuse_detected` in the logs.** It means a refresh
token was presented twice, which is either a client bug or a stolen credential.
The whole token chain is revoked automatically and the user must sign in again.

**Rotating `TOKEN_ENCRYPTION_KEY`** invalidates every stored Shopify token. It
is recoverable — reinstall the app on each store — but it is not a routine
operation.

---

## 11. Moving this into its own repository

This tree was developed inside `srtiz-bot/M3PL` because the GitHub App running
the build could not create repositories (see decision D-012 in `PROJECT.md`).
Nothing here refers to the parent repo, so it transplants unchanged:

```bash
./scripts/transplant.sh https://github.com/srtiz-bot/ai.Goodproductivity.git
# then, after reviewing:
cd ~/shopify-mcp-gateway && git push -u origin main
```

The script copies the tree (minus `node_modules`, `.wrangler` and `.dev.vars`),
initialises a fresh repo, makes the first commit and sets the remote. It stops
short of pushing so you can look before anything leaves the machine.

Doing it by hand is equally fine:

```bash
cd shopify-mcp-gateway && rm -rf node_modules .wrangler
git init && git add . && git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/srtiz-bot/ai.Goodproductivity.git
git push -u origin main
```
