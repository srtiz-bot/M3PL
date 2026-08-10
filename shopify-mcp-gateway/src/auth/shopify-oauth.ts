/**
 * Shopify app installation (OAuth 2.0, offline access).
 *
 * The install grants an **offline** access token, which does not expire. That
 * property is the whole reason unattended scheduled tasks work: there is no
 * refresh to perform and no session to keep alive.
 *
 * Adding store #3 is: open /shopify/install?shop=…, click Install. No deploy,
 * no code change, no secret to copy.
 */

import { hmacSha256Base64, hmacSha256Hex, timingSafeEqual } from '../lib/crypto.js';
import { GatewayError } from '../lib/errors.js';
import { htmlResponse, jsonResponse, type RouteContext } from '../lib/http.js';
import { consumeState, putState } from '../db/oauth.js';
import { isValidShopDomain, markStoreUninstalled, upsertStore } from '../db/stores.js';
import type { Env } from '../types.js';

/**
 * Verify the `hmac` parameter Shopify appends to install/callback redirects.
 *
 * Per Shopify's spec: drop `hmac` (and legacy `signature`), sort the remaining
 * parameters, join as `k=v` pairs with `&`, and HMAC-SHA256 with the app
 * secret. Comparison is constant-time.
 */
export async function verifyShopifyHmac(url: URL, apiSecret: string): Promise<boolean> {
  const provided = url.searchParams.get('hmac');
  if (!provided) return false;

  const pairs: string[] = [];
  for (const [key, value] of url.searchParams) {
    if (key === 'hmac' || key === 'signature') continue;
    pairs.push(`${key}=${value}`);
  }
  pairs.sort();

  const expected = await hmacSha256Hex(apiSecret, pairs.join('&'));
  return timingSafeEqual(expected, provided);
}

/**
 * Verify an inbound webhook using the raw request body.
 *
 * The body must be the exact bytes Shopify sent — parsing and re-serialising
 * changes the signature, so callers pass the raw text.
 */
export async function verifyWebhookHmac(
  rawBody: string,
  headerHmac: string | null,
  apiSecret: string,
): Promise<boolean> {
  if (!headerHmac) return false;
  const expected = await hmacSha256Base64(apiSecret, rawBody);
  return timingSafeEqual(expected, headerHmac);
}

/**
 * GET /shopify/install?shop=<domain>
 *
 * Begins the install. Deliberately unauthenticated: it is initiated by a
 * Shopify store admin who may not yet have a gateway account, and it grants
 * nothing on its own — the token is only issued after Shopify itself
 * authenticates the merchant and signs the callback.
 */
export async function handleInstall(context: RouteContext): Promise<Response> {
  const { env, url } = context;
  const shop = (url.searchParams.get('shop') ?? '').trim().toLowerCase();

  if (!shop) {
    return htmlResponse(
      page(
        'Install the gateway',
        `<p>Add your store's <code>.myshopify.com</code> domain to the URL:</p>
         <pre>${escapeHtml(env.GATEWAY_URL)}/shopify/install?shop=<b>your-store</b>.myshopify.com</pre>`,
      ),
      400,
    );
  }

  // Security control, not a convenience check: `shop` is interpolated into an
  // outbound URL below, so an unvalidated value would let a caller point the
  // flow at a host they control.
  if (!isValidShopDomain(shop)) {
    throw new GatewayError(
      'VALIDATION_FAILED',
      'The `shop` parameter must be a valid *.myshopify.com domain.',
    );
  }

  // If Shopify signed this request (app-store or admin-initiated install),
  // verify it. A bare operator-typed URL has no hmac, which is fine.
  if (url.searchParams.has('hmac') && !(await verifyShopifyHmac(url, env.SHOPIFY_API_SECRET))) {
    throw new GatewayError('VALIDATION_FAILED', 'Shopify HMAC verification failed.');
  }

  const state = await putState(env, { kind: 'shopify_install', payload: { shop }, ttlSeconds: 600 });

  const authorizeUrl = new URL(`https://${shop}/admin/oauth/authorize`);
  authorizeUrl.searchParams.set('client_id', env.SHOPIFY_API_KEY);
  authorizeUrl.searchParams.set('scope', env.SHOPIFY_SCOPES);
  authorizeUrl.searchParams.set('redirect_uri', `${env.GATEWAY_URL}/shopify/callback`);
  authorizeUrl.searchParams.set('state', state);
  // No `grant_options[]=per-user` — omitting it requests an offline token.

  return Response.redirect(authorizeUrl.toString(), 302);
}

/**
 * GET /shopify/callback
 *
 * Exchanges the authorization code for an offline access token and stores it
 * encrypted. Three independent checks must pass first: HMAC signature, state
 * nonce, and shop-domain agreement between the state and the callback.
 */
export async function handleCallback(context: RouteContext): Promise<Response> {
  const { env, url } = context;

  const shop = (url.searchParams.get('shop') ?? '').toLowerCase();
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!shop || !code || !state) {
    throw new GatewayError('VALIDATION_FAILED', 'Missing shop, code or state in the callback.');
  }
  if (!isValidShopDomain(shop)) {
    throw new GatewayError('VALIDATION_FAILED', 'Invalid shop domain in the callback.');
  }
  if (!(await verifyShopifyHmac(url, env.SHOPIFY_API_SECRET))) {
    throw new GatewayError(
      'VALIDATION_FAILED',
      'Shopify HMAC verification failed. This callback was not signed by Shopify.',
    );
  }

  const stored = await consumeState<{ shop: string }>(env, state, 'shopify_install');
  if (!stored) {
    throw new GatewayError(
      'VALIDATION_FAILED',
      'The install link has expired or was already used. Start the install again.',
    );
  }
  // Binding the state to its shop stops a code issued for one store from being
  // redeemed against another.
  if (stored.shop !== shop) {
    throw new GatewayError('VALIDATION_FAILED', 'Shop mismatch between the install request and callback.');
  }

  const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: env.SHOPIFY_API_KEY,
      client_secret: env.SHOPIFY_API_SECRET,
      code,
    }),
  });

  if (!tokenResponse.ok) {
    const body = await tokenResponse.text().catch(() => '');
    throw new GatewayError(
      'UPSTREAM_ERROR',
      `Shopify rejected the token exchange (HTTP ${tokenResponse.status}).`,
      { details: { body: body.slice(0, 500) } },
    );
  }

  const payload = (await tokenResponse.json()) as { access_token?: string; scope?: string };
  if (!payload.access_token) {
    throw new GatewayError('UPSTREAM_ERROR', 'Shopify returned no access token.');
  }

  const store = await upsertStore(env, {
    shopDomain: shop,
    accessToken: payload.access_token,
    scopes: payload.scope ?? env.SHOPIFY_SCOPES,
  });

  await registerUninstallWebhook(env, shop, payload.access_token).catch((err) => {
    // A missing webhook degrades cleanup, not function: the store still works,
    // it just won't self-mark as uninstalled. Not worth failing the install.
    console.error(
      JSON.stringify({ level: 'warn', message: 'uninstall_webhook_registration_failed', shop, cause: String(err) }),
    );
  });

  return htmlResponse(
    page(
      'Store connected',
      `<p><b>${escapeHtml(store.label)}</b> (<code>${escapeHtml(shop)}</code>) is now available through the gateway.</p>
       <p>Granted scopes: <code>${escapeHtml(store.scopes)}</code></p>
       <p class="muted">Team members still need a permission grant for this store before they can use it.
       Run <code>scripts/admin.sh grant</code> or POST to <code>/admin/permissions</code>.</p>`,
    ),
  );
}

/**
 * Subscribe to `app/uninstalled` so a removed app stops being a stale row with
 * a dead token.
 */
async function registerUninstallWebhook(env: Env, shop: string, accessToken: string): Promise<void> {
  const mutation = `
    mutation registerUninstall($topic: WebhookSubscriptionTopic!, $sub: WebhookSubscriptionInput!) {
      webhookSubscriptionCreate(topic: $topic, webhookSubscription: $sub) {
        userErrors { field message }
      }
    }`;

  const response = await fetch(`https://${shop}/admin/api/${env.SHOPIFY_API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken,
    },
    body: JSON.stringify({
      query: mutation,
      variables: {
        topic: 'APP_UNINSTALLED',
        sub: { callbackUrl: `${env.GATEWAY_URL}/shopify/webhooks/uninstalled`, format: 'JSON' },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`webhook registration returned HTTP ${response.status}`);
  }
}

/**
 * POST /shopify/webhooks/uninstalled
 *
 * Shopify retries on non-2xx, so this returns 200 for anything it has actually
 * handled — including a shop we do not know about, which is not an error worth
 * retrying.
 */
export async function handleUninstallWebhook(context: RouteContext): Promise<Response> {
  const { env, request } = context;

  // The raw body is required: re-serialising JSON changes the signature.
  const rawBody = await request.text();
  const headerHmac = request.headers.get('X-Shopify-Hmac-Sha256');

  if (!(await verifyWebhookHmac(rawBody, headerHmac, env.SHOPIFY_API_SECRET))) {
    // 401 here is correct — an unsigned request is not from Shopify.
    return jsonResponse({ error: 'UNAUTHENTICATED', message: 'Invalid webhook signature.' }, { status: 401 });
  }

  const shop = request.headers.get('X-Shopify-Shop-Domain');
  if (shop && isValidShopDomain(shop)) {
    await markStoreUninstalled(env, shop);
    console.log(JSON.stringify({ level: 'info', message: 'store_uninstalled', shop }));
  }

  return jsonResponse({ ok: true });
}

// ---------------------------------------------------------------------------
// Minimal HTML shell for the handful of pages this flow renders
// ---------------------------------------------------------------------------

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)} — Shopify MCP Gateway</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 16px/1.6 ui-sans-serif, system-ui, -apple-system, sans-serif;
         max-width: 42rem; margin: 4rem auto; padding: 0 1.5rem; }
  h1 { font-size: 1.4rem; margin-bottom: 1rem; }
  code, pre { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .9em; }
  pre { background: rgba(127,127,127,.12); padding: .75rem 1rem; border-radius: .5rem; overflow-x: auto; }
  code { background: rgba(127,127,127,.12); padding: .1rem .3rem; border-radius: .25rem; }
  .muted { opacity: .7; font-size: .9em; }
</style></head>
<body><h1>${escapeHtml(title)}</h1>${body}</body></html>`;
}
