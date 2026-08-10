/**
 * A minimal router and response helpers.
 *
 * Deliberately dependency-free: the routing needs here are a dozen static
 * paths, and every runtime dependency is one more thing to audit in a service
 * that holds Shopify write credentials.
 */

import type { Env } from '../types.js';
import { GatewayError, toGatewayError } from './errors.js';

export interface RouteContext {
  request: Request;
  env: Env;
  ctx: ExecutionContext;
  url: URL;
  requestId: string;
}

type Handler = (context: RouteContext) => Promise<Response> | Response;

interface Route {
  method: string;
  path: string;
  handler: Handler;
}

export class Router {
  private routes: Route[] = [];

  get(path: string, handler: Handler): this {
    return this.add('GET', path, handler);
  }

  post(path: string, handler: Handler): this {
    return this.add('POST', path, handler);
  }

  delete(path: string, handler: Handler): this {
    return this.add('DELETE', path, handler);
  }

  private add(method: string, path: string, handler: Handler): this {
    this.routes.push({ method, path, handler });
    return this;
  }

  async handle(context: RouteContext): Promise<Response> {
    const { request, url } = context;

    // CORS preflight. MCP clients and the OAuth flow are browser-adjacent, so
    // the discovery and token endpoints must be reachable cross-origin.
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    const path = url.pathname.replace(/\/+$/, '') || '/';
    const match = this.routes.find((r) => r.path === path);

    if (!match) {
      return jsonResponse({ error: 'NOT_FOUND', message: `No route for ${path}` }, { status: 404 });
    }
    if (match.method !== request.method) {
      // Find every method registered for this path so the response is useful.
      const allowed = this.routes.filter((r) => r.path === path).map((r) => r.method);
      return jsonResponse(
        { error: 'METHOD_NOT_ALLOWED', message: `${request.method} not allowed on ${path}` },
        { status: 405, headers: { Allow: allowed.join(', ') } },
      );
    }

    try {
      return await match.handler(context);
    } catch (err) {
      const gatewayError = toGatewayError(err);
      if (gatewayError.code === 'INTERNAL_ERROR') {
        console.error(
          JSON.stringify({
            level: 'error',
            requestId: context.requestId,
            path,
            message: gatewayError.message,
            cause: String(gatewayError.cause ?? ''),
          }),
        );
      }
      return errorResponse(gatewayError, context.requestId);
    }
  }
}

export function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Mcp-Session-Id, MCP-Protocol-Version',
    'Access-Control-Expose-Headers': 'Mcp-Session-Id, WWW-Authenticate',
    'Access-Control-Max-Age': '86400',
  };
}

export function jsonResponse(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status: init.status ?? 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...corsHeaders(),
      ...init.headers,
    },
  });
}

export function errorResponse(error: GatewayError, requestId: string): Response {
  const headers: Record<string, string> = {};

  // RFC 9728: an unauthenticated caller needs to be told where to authenticate.
  // This is what lets an MCP client discover the authorization server.
  if (error.code === 'UNAUTHENTICATED') {
    headers['WWW-Authenticate'] = 'Bearer realm="shopify-mcp-gateway"';
  }

  return jsonResponse(error.toPayload(requestId), { status: error.httpStatus, headers });
}

export function htmlResponse(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

/** Parse a JSON body, converting malformed input into a clean validation error. */
export async function readJson<T = unknown>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new GatewayError('VALIDATION_FAILED', 'Request body must be valid JSON.');
  }
}

/** Parse an `application/x-www-form-urlencoded` body (OAuth token endpoint). */
export async function readForm(request: Request): Promise<URLSearchParams> {
  const text = await request.text();
  return new URLSearchParams(text);
}

/** Extract a bearer token from the Authorization header, if present. */
export function bearerToken(request: Request): string | null {
  const header = request.headers.get('Authorization');
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1]!.trim() : null;
}
