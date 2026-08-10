/**
 * Worker entry point.
 *
 * Route map:
 *   /                                          landing / health
 *   /.well-known/oauth-protected-resource      RFC 9728 discovery
 *   /.well-known/oauth-authorization-server    RFC 8414 discovery
 *   /register /authorize /token /revoke        OAuth 2.1 AS
 *   /auth/google/callback                      Google OIDC federation
 *   /shopify/install /shopify/callback         Shopify app install
 *   /shopify/webhooks/uninstalled              Shopify webhook
 *   /mcp                                       MCP (Streamable HTTP)
 *   /admin/*                                   admin API
 */

import {
  handleCreateServiceAccount,
  handleOverview,
  handlePermissions,
  handleRevokeServiceAccount,
  handleRotateServiceAccount,
  handleStores,
  handleUsers,
} from './admin.js';
import {
  authorizationServerMetadata,
  handleAuthorize,
  handleGoogleCallback,
  handleRegister,
  handleRevoke,
  handleToken,
  protectedResourceMetadata,
} from './auth/oauth-server.js';
import {
  handleCallback,
  handleInstall,
  handleUninstallWebhook,
  page,
} from './auth/shopify-oauth.js';
import { purgeExpired } from './db/oauth.js';
import { randomId } from './lib/crypto.js';
import { htmlResponse, Router, type RouteContext } from './lib/http.js';
import { handleMcp } from './mcp/server.js';
import type { Env } from './types.js';

export { ShopRateLimiter } from './shopify/rate-limiter.js';

const router = new Router()
  // Discovery
  .get('/.well-known/oauth-protected-resource', ({ env }) => protectedResourceMetadata(env))
  .get('/.well-known/oauth-authorization-server', ({ env }) => authorizationServerMetadata(env))
  // Some clients probe the MCP-suffixed variant of the resource metadata path.
  .get('/.well-known/oauth-protected-resource/mcp', ({ env }) => protectedResourceMetadata(env))

  // OAuth 2.1 authorization server
  .post('/register', handleRegister)
  .get('/authorize', handleAuthorize)
  .post('/token', handleToken)
  .post('/revoke', handleRevoke)
  .get('/auth/google/callback', handleGoogleCallback)

  // Shopify app lifecycle
  .get('/shopify/install', handleInstall)
  .get('/shopify/callback', handleCallback)
  .post('/shopify/webhooks/uninstalled', handleUninstallWebhook)

  // MCP
  .post('/mcp', handleMcp)

  // Admin
  .get('/admin/overview', handleOverview)
  .post('/admin/permissions', handlePermissions)
  .post('/admin/service-accounts', handleCreateServiceAccount)
  .post('/admin/service-accounts/rotate', handleRotateServiceAccount)
  .post('/admin/service-accounts/revoke', handleRevokeServiceAccount)
  .post('/admin/users', handleUsers)
  .post('/admin/stores', handleStores)

  // Health and landing
  .get('/health', () =>
    new Response(JSON.stringify({ status: 'ok', service: 'shopify-mcp-gateway' }), {
      headers: { 'Content-Type': 'application/json' },
    }),
  )
  .get('/', ({ env }) => htmlResponse(landingPage(env)));

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    // One id per request, echoed into audit rows and error payloads so a
    // user-reported failure is a single indexed lookup.
    const requestId = randomId('req');

    const context: RouteContext = { request, env, ctx, url, requestId };
    const response = await router.handle(context);

    // Surface the id on every response, including successes.
    const headers = new Headers(response.headers);
    headers.set('X-Request-Id', requestId);
    return new Response(response.body, { status: response.status, headers });
  },

  /** Nightly retention pass. Expired rows carry no value and the tables are indexed on expiry. */
  async scheduled(_event: ScheduledController, env: Env, _ctx: ExecutionContext): Promise<void> {
    const purged = await purgeExpired(env);
    console.log(JSON.stringify({ level: 'info', message: 'retention_purge', purged }));
  },
};

function landingPage(env: Env): string {
  return page(
    'Shopify MCP Gateway',
    `<p>Multi-store Shopify gateway exposing an MCP interface with per-user OAuth,
        scoped permissions and a full audit trail.</p>

     <h2>Connect an MCP client</h2>
     <p>Add this server to Claude and sign in with your work Google account:</p>
     <pre>${env.GATEWAY_URL}/mcp</pre>
     <p class="muted">You sign in once. The client refreshes silently after that,
        so scheduled work keeps running without re-authentication.</p>

     <h2>Connect a store</h2>
     <p>A Shopify admin opens this once per store:</p>
     <pre>${env.GATEWAY_URL}/shopify/install?shop=<b>your-store</b>.myshopify.com</pre>

     <h2>Scheduled tasks</h2>
     <p>Unattended jobs use a service-account token rather than a person's session.
        An admin mints one with <code>POST /admin/service-accounts</code>.</p>

     <p class="muted">Health: <a href="/health">/health</a></p>`,
  );
}
