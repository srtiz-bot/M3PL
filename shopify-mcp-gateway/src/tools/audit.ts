/**
 * Audit log query tool.
 *
 * Gated on `audit:read`, which is not in the operator preset — knowing what
 * everyone else did is a supervisory capability, not an operational one.
 */

import { queryAuditLog, type AuditOutcome } from '../lib/audit.js';
import { GatewayError } from '../lib/errors.js';
import { getStoreByDomain, resolveStore } from '../db/stores.js';
import type { ToolDefinition } from '../mcp/types.js';

export const auditSearchTool: ToolDefinition = {
  name: 'audit_search',
  title: 'Search the audit log',
  description:
    'Query the gateway audit trail: who called which tool, against which store, and what happened. ' +
    'Filter by person or service account, store, tool, outcome, or time window. ' +
    'Useful for answering "who changed this?" and for spotting repeated permission denials.',
  scope: 'audit:read',
  needsStore: false,
  mutating: false,
  loggableArgs: ['principal', 'store', 'tool', 'outcome', 'sinceHours', 'limit'],
  inputSchema: {
    type: 'object',
    properties: {
      principal: {
        type: 'string',
        description: 'Filter to one actor: an email address or a service-account name.',
      },
      store: { type: 'string', description: 'Filter to one store (domain or label).' },
      tool: { type: 'string', description: 'Filter to one tool name, e.g. "bulk_tag".' },
      outcome: {
        type: 'string',
        enum: ['ok', 'denied', 'error'],
        description: 'Filter by result. "denied" surfaces permission failures.',
      },
      sinceHours: {
        type: 'number',
        minimum: 0.1,
        maximum: 8760,
        default: 24,
        description: 'How far back to look, in hours. Defaults to the last 24.',
      },
      limit: { type: 'integer', minimum: 1, maximum: 500, default: 50, description: 'Max entries to return.' },
    },
    additionalProperties: false,
  },

  async handler(args, { env }) {
    let storeId: string | undefined;
    if (args.store) {
      // Accept an uninstalled store here — historical audit entries for a store
      // that has since been removed are exactly what an investigation needs.
      const direct = await getStoreByDomain(env, String(args.store));
      storeId = direct ? direct.id : (await resolveStore(env, String(args.store))).id;
    }

    const sinceHours = Number(args.sinceHours ?? 24);
    if (!Number.isFinite(sinceHours) || sinceHours <= 0) {
      throw new GatewayError('VALIDATION_FAILED', '`sinceHours` must be a positive number.');
    }

    const entries = await queryAuditLog(env, {
      principalId: args.principal ? String(args.principal) : undefined,
      storeId,
      tool: args.tool ? String(args.tool) : undefined,
      outcome: args.outcome as AuditOutcome | undefined,
      since: Date.now() - sinceHours * 3600 * 1000,
      limit: args.limit ? Number(args.limit) : 50,
    });

    return {
      count: entries.length,
      window: `last ${sinceHours} hour(s)`,
      entries: entries.map((entry) => ({
        at: new Date(entry.ts).toISOString(),
        who: entry.principal,
        tool: entry.tool,
        store: entry.store,
        outcome: entry.outcome,
        error: entry.errorCode ? `${entry.errorCode}: ${entry.errorMessage}` : null,
        durationMs: entry.durationMs,
        args: entry.args,
        requestId: entry.requestId,
      })),
    };
  },
};
