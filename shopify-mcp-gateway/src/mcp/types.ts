/**
 * MCP tool contract.
 *
 * Every tool declares its required scope and its loggable arguments up front.
 * Both are enforced by the dispatcher rather than by the handler, so a new tool
 * cannot forget to check permissions or accidentally log PII.
 */

import type { Env, Principal, Scope, Store } from '../types.js';

export interface JsonSchema {
  type: string;
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
  [key: string]: unknown;
}

export interface ToolContext {
  env: Env;
  principal: Principal;
  requestId: string;
  ctx: ExecutionContext;
  /** Resolved and permission-checked store, for tools that declare `needsStore`. */
  store?: Store;
}

export interface ToolDefinition {
  name: string;
  title: string;
  description: string;
  inputSchema: JsonSchema;
  /** Scope the caller must hold — on the target store, if the tool takes one. */
  scope: Scope;
  /**
   * Argument names safe to write to the audit log. Everything else is recorded
   * as "[redacted]" (decision D-009).
   */
  loggableArgs: readonly string[];
  /** Whether this tool resolves a `store` argument before the handler runs. */
  needsStore: boolean;
  /** Mutating tools support idempotency keys and are called out in `tools/list`. */
  mutating: boolean;
  handler: (args: Record<string, unknown>, context: ToolContext) => Promise<unknown>;
}

/** Shared `store` property, mixed into every store-scoped tool's schema. */
export const STORE_PROPERTY = {
  store: {
    type: 'string',
    description:
      'Which store to act on: the myshopify.com domain (e.g. "starpil.myshopify.com"), ' +
      'the short name ("starpil"), or the friendly label ("Starpil"). ' +
      'Call list_stores to see what is available.',
  },
} as const;
