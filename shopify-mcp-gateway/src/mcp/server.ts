/**
 * MCP server — Streamable HTTP transport, JSON-RPC 2.0.
 *
 * The dispatcher owns four cross-cutting concerns so that individual tools do
 * not have to (and cannot forget to):
 *   • authentication → principal
 *   • store resolution and scope enforcement
 *   • idempotency for mutating tools
 *   • audit logging of every outcome, including denials
 */

import { writeAuditLog } from '../lib/audit.js';
import { randomId } from '../lib/crypto.js';
import { GatewayError, toGatewayError } from '../lib/errors.js';
import { bearerToken, corsHeaders, jsonResponse, readJson, type RouteContext } from '../lib/http.js';
import { getIdempotentResponse, storeIdempotentResponse } from '../db/oauth.js';
import { effectiveScopes, requireScope } from '../db/permissions.js';
import { resolveStore } from '../db/stores.js';
import { authenticateBearer } from '../auth/oauth-server.js';
import type { Env, Principal } from '../types.js';
import { getTool, listTools } from '../tools/index.js';
import type { ToolContext } from './types.js';

/** Protocol revisions this server implements. Newest first. */
const SUPPORTED_PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const SERVER_INFO = { name: 'shopify-mcp-gateway', version: '1.0.0' };

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

// JSON-RPC reserved error codes.
const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INTERNAL_ERROR = -32603;

function rpcResult(id: string | number | null | undefined, result: unknown): Response {
  return jsonResponse({ jsonrpc: '2.0', id: id ?? null, result });
}

function rpcError(
  id: string | number | null | undefined,
  code: number,
  message: string,
  data?: unknown,
): Response {
  const error: Record<string, unknown> = { code, message };
  if (data !== undefined) error.data = data;
  return jsonResponse({ jsonrpc: '2.0', id: id ?? null, error });
}

/**
 * POST /mcp
 */
export async function handleMcp(context: RouteContext): Promise<Response> {
  const { env, request, requestId } = context;

  // --- Authentication -----------------------------------------------------
  const token = bearerToken(request);
  if (!token) {
    return unauthenticatedResponse(env, 'Missing bearer token.');
  }

  const principal = await authenticateBearer(env, token);
  if (!principal) {
    return unauthenticatedResponse(env, 'The access token is invalid, expired, or revoked.');
  }

  // --- Parse --------------------------------------------------------------
  let body: JsonRpcRequest | JsonRpcRequest[];
  try {
    body = await readJson<JsonRpcRequest | JsonRpcRequest[]>(request);
  } catch {
    return rpcError(null, PARSE_ERROR, 'Request body must be valid JSON.');
  }

  // Batches are legal JSON-RPC. Each element is dispatched independently and
  // notifications (no id) produce no response entry.
  if (Array.isArray(body)) {
    const responses: unknown[] = [];
    for (const item of body) {
      const response = await dispatch(item, env, principal, requestId, context.ctx);
      if (response !== null) responses.push(response);
    }
    return responses.length === 0
      ? new Response(null, { status: 202, headers: corsHeaders() })
      : jsonResponse(responses);
  }

  const response = await dispatch(body, env, principal, requestId, context.ctx);
  // A notification gets an accepted-with-no-body, per the transport spec.
  if (response === null) return new Response(null, { status: 202, headers: corsHeaders() });

  return jsonResponse(response);
}

/**
 * RFC 9728: an unauthenticated caller must be pointed at the resource metadata
 * document. This is how an MCP client discovers where to sign in, and skipping
 * it is why some gateways make clients re-authenticate by hand.
 */
function unauthenticatedResponse(env: Env, message: string): Response {
  return jsonResponse(
    { error: 'UNAUTHENTICATED', message },
    {
      status: 401,
      headers: {
        'WWW-Authenticate': `Bearer realm="shopify-mcp-gateway", resource_metadata="${env.GATEWAY_URL}/.well-known/oauth-protected-resource"`,
      },
    },
  );
}

/** Returns the JSON-RPC response object, or null for notifications. */
async function dispatch(
  message: JsonRpcRequest,
  env: Env,
  principal: Principal,
  requestId: string,
  ctx: ExecutionContext,
): Promise<unknown | null> {
  if (message?.jsonrpc !== '2.0' || typeof message.method !== 'string') {
    return { jsonrpc: '2.0', id: message?.id ?? null, error: { code: INVALID_REQUEST, message: 'Invalid JSON-RPC request.' } };
  }

  const isNotification = message.id === undefined || message.id === null;

  try {
    switch (message.method) {
      case 'initialize': {
        const requested = (message.params?.protocolVersion as string) ?? SUPPORTED_PROTOCOL_VERSIONS[0]!;
        // Echo the client's version when we speak it; otherwise offer our newest
        // and let the client decide whether it can proceed.
        const protocolVersion = SUPPORTED_PROTOCOL_VERSIONS.includes(requested)
          ? requested
          : SUPPORTED_PROTOCOL_VERSIONS[0]!;

        return {
          jsonrpc: '2.0',
          id: message.id,
          result: {
            protocolVersion,
            capabilities: { tools: { listChanged: false } },
            serverInfo: SERVER_INFO,
            instructions:
              'Multi-store Shopify gateway. Every tool takes an explicit `store` argument — ' +
              'call list_stores first to see which stores you can access and what you may do on each. ' +
              'There is no "current store"; nothing is remembered between calls.',
          },
        };
      }

      case 'notifications/initialized':
      case 'notifications/cancelled':
        return null;

      case 'ping':
        return isNotification ? null : { jsonrpc: '2.0', id: message.id, result: {} };

      case 'tools/list': {
        // Filtered per principal (decision D-011): showing a tool the caller
        // cannot use invites the model to propose an action that will be denied.
        const held = await effectiveScopes(env, principal);
        const tools = listTools()
          .filter((tool) => held.has(tool.scope))
          .map((tool) => ({
            name: tool.name,
            title: tool.title,
            description: tool.description,
            inputSchema: tool.inputSchema,
            annotations: {
              readOnlyHint: !tool.mutating,
              destructiveHint: false,
              idempotentHint: !tool.mutating,
            },
          }));

        return { jsonrpc: '2.0', id: message.id, result: { tools } };
      }

      case 'tools/call':
        return await handleToolCall(message, env, principal, requestId, ctx);

      case 'resources/list':
        return { jsonrpc: '2.0', id: message.id, result: { resources: [] } };

      case 'prompts/list':
        return { jsonrpc: '2.0', id: message.id, result: { prompts: [] } };

      default:
        if (isNotification) return null;
        return {
          jsonrpc: '2.0',
          id: message.id,
          error: { code: METHOD_NOT_FOUND, message: `Unknown method: ${message.method}` },
        };
    }
  } catch (err) {
    if (isNotification) return null;
    const error = toGatewayError(err);
    return {
      jsonrpc: '2.0',
      id: message.id,
      error: { code: INTERNAL_ERROR, message: error.message, data: error.toPayload(requestId) },
    };
  }
}

/**
 * Execute a tool call.
 *
 * Tool *failures* are returned as `isError: true` content rather than JSON-RPC
 * errors — that is the MCP convention, and it is what lets the model read the
 * failure and correct itself instead of the client treating it as a transport
 * fault.
 */
async function handleToolCall(
  message: JsonRpcRequest,
  env: Env,
  principal: Principal,
  requestId: string,
  ctx: ExecutionContext,
): Promise<unknown> {
  const started = Date.now();
  const toolName = message.params?.name as string | undefined;
  const args = (message.params?.arguments as Record<string, unknown>) ?? {};

  if (!toolName) {
    return { jsonrpc: '2.0', id: message.id, error: { code: INVALID_REQUEST, message: 'tools/call requires a `name`.' } };
  }

  const tool = getTool(toolName);
  if (!tool) {
    return {
      jsonrpc: '2.0',
      id: message.id,
      error: { code: METHOD_NOT_FOUND, message: `Unknown tool: ${toolName}` },
    };
  }

  const toolContext: ToolContext = { env, principal, requestId, ctx };
  let storeId: string | null = null;
  let storeDomain: string | null = null;

  try {
    // --- Store resolution + scope check ----------------------------------
    if (tool.needsStore) {
      const store = await resolveStore(env, String(args.store ?? ''));
      toolContext.store = store;
      storeId = store.id;
      storeDomain = store.shopDomain;
    }

    await requireScope(env, principal, storeId, tool.scope);

    // --- Idempotency -----------------------------------------------------
    // A retry after an ambiguous timeout must not re-apply a write (D-008).
    const idempotencyKey =
      tool.mutating && typeof args.idempotencyKey === 'string'
        ? `${principal.id}:${toolName}:${args.idempotencyKey}`
        : null;

    if (idempotencyKey) {
      const cached = await getIdempotentResponse(env, idempotencyKey);
      if (cached !== null) {
        await writeAuditLog(env, {
          requestId,
          principal,
          tool: toolName,
          storeId,
          storeDomain,
          args,
          loggableArgs: tool.loggableArgs,
          outcome: 'ok',
          durationMs: Date.now() - started,
          errorMessage: 'replayed from idempotency cache',
        });
        return toolSuccess(message.id, cached);
      }
    }

    const result = await tool.handler(args, toolContext);

    if (idempotencyKey) {
      await storeIdempotentResponse(env, {
        key: idempotencyKey,
        principalId: principal.id,
        tool: toolName,
        response: result,
      });
    }

    await writeAuditLog(env, {
      requestId,
      principal,
      tool: toolName,
      storeId,
      storeDomain,
      args,
      loggableArgs: tool.loggableArgs,
      outcome: 'ok',
      durationMs: Date.now() - started,
    });

    return toolSuccess(message.id, result);
  } catch (err) {
    const error = toGatewayError(err);

    // Denials are logged as loudly as successes: an operator repeatedly hitting
    // PERMISSION_DENIED on a store is a signal worth having.
    await writeAuditLog(env, {
      requestId,
      principal,
      tool: toolName,
      storeId,
      storeDomain,
      args,
      loggableArgs: tool.loggableArgs,
      outcome: error.code === 'PERMISSION_DENIED' ? 'denied' : 'error',
      errorCode: error.code,
      errorMessage: error.message,
      durationMs: Date.now() - started,
    });

    if (error.code === 'INTERNAL_ERROR') {
      console.error(
        JSON.stringify({
          level: 'error',
          requestId,
          tool: toolName,
          principal: principal.label,
          cause: String(error.cause ?? error.message),
        }),
      );
    }

    return {
      jsonrpc: '2.0',
      id: message.id,
      result: {
        isError: true,
        content: [{ type: 'text', text: JSON.stringify(error.toPayload(requestId), null, 2) }],
      },
    };
  }
}

function toolSuccess(id: string | number | null | undefined, result: unknown): unknown {
  return {
    jsonrpc: '2.0',
    id,
    result: {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
      isError: false,
    },
  };
}

export { randomId as newRequestId };
