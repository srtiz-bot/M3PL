/**
 * Append-only audit log.
 *
 * Redaction is allowlist-based (decision D-009): a tool declares which of its
 * argument fields are safe to record, and everything else is dropped. A
 * denylist would fail open — add a tool with a `customerEmail` argument and you
 * have silently started logging PII.
 */

import { randomId } from './crypto.js';
import type { Env, Principal } from '../types.js';

export type AuditOutcome = 'ok' | 'denied' | 'error';

export interface AuditEntry {
  requestId: string;
  principal: Principal;
  tool: string;
  storeId?: string | null;
  storeDomain?: string | null;
  args?: Record<string, unknown>;
  /** Argument names safe to persist. Anything else is replaced with a marker. */
  loggableArgs?: readonly string[];
  outcome: AuditOutcome;
  errorCode?: string | null;
  errorMessage?: string | null;
  durationMs: number;
  shopifyCost?: number | null;
}

/** Values longer than this are truncated so one call cannot bloat the table. */
const MAX_VALUE_LENGTH = 512;
const MAX_ARRAY_ITEMS = 25;

/**
 * Project arguments down to the declared allowlist.
 *
 * Non-allowlisted keys are not merely dropped — they are recorded as
 * `"[redacted]"`, so an investigator can see that an argument was supplied
 * without seeing its value.
 */
export function redactArgs(
  args: Record<string, unknown> | undefined,
  loggable: readonly string[] | undefined,
): Record<string, unknown> {
  if (!args) return {};
  const allow = new Set(loggable ?? []);
  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(args)) {
    if (!allow.has(key)) {
      out[key] = '[redacted]';
      continue;
    }
    out[key] = truncate(value);
  }
  return out;
}

function truncate(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.length > MAX_VALUE_LENGTH ? `${value.slice(0, MAX_VALUE_LENGTH)}…` : value;
  }
  if (Array.isArray(value)) {
    const head = value.slice(0, MAX_ARRAY_ITEMS).map(truncate);
    return value.length > MAX_ARRAY_ITEMS
      ? [...head, `…and ${value.length - MAX_ARRAY_ITEMS} more`]
      : head;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = truncate(v);
    return out;
  }
  return value;
}

/**
 * Write one audit row.
 *
 * Never throws: an audit failure must not convert a successful Shopify write
 * into a reported error, because the write already happened. Failures are
 * logged to the Workers console, which is itself retained.
 */
export async function writeAuditLog(env: Env, entry: AuditEntry): Promise<void> {
  try {
    await env.DB.prepare(
      `INSERT INTO audit_log
         (id, ts, request_id, principal_type, principal_id, principal_label,
          tool, store_id, store_domain, args_redacted, outcome,
          error_code, error_message, duration_ms, shopify_cost)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        randomId('aud'),
        Date.now(),
        entry.requestId,
        entry.principal.type,
        entry.principal.id,
        entry.principal.label,
        entry.tool,
        entry.storeId ?? null,
        entry.storeDomain ?? null,
        JSON.stringify(redactArgs(entry.args, entry.loggableArgs)),
        entry.outcome,
        entry.errorCode ?? null,
        entry.errorMessage ? entry.errorMessage.slice(0, MAX_VALUE_LENGTH) : null,
        Math.round(entry.durationMs),
        entry.shopifyCost ?? null,
      )
      .run();
  } catch (err) {
    console.error(
      JSON.stringify({
        level: 'error',
        message: 'audit_write_failed',
        requestId: entry.requestId,
        tool: entry.tool,
        cause: err instanceof Error ? err.message : String(err),
      }),
    );
  }
}

export interface AuditQuery {
  principalId?: string;
  storeId?: string;
  tool?: string;
  outcome?: AuditOutcome;
  since?: number;
  until?: number;
  limit?: number;
}

export interface AuditRecord {
  id: string;
  ts: number;
  requestId: string;
  principal: string;
  tool: string;
  store: string | null;
  args: unknown;
  outcome: string;
  errorCode: string | null;
  errorMessage: string | null;
  durationMs: number;
}

export async function queryAuditLog(env: Env, query: AuditQuery): Promise<AuditRecord[]> {
  const conditions: string[] = [];
  const bindings: unknown[] = [];

  if (query.principalId) {
    conditions.push('(principal_id = ? OR principal_label = ?)');
    bindings.push(query.principalId, query.principalId);
  }
  if (query.storeId) {
    conditions.push('store_id = ?');
    bindings.push(query.storeId);
  }
  if (query.tool) {
    conditions.push('tool = ?');
    bindings.push(query.tool);
  }
  if (query.outcome) {
    conditions.push('outcome = ?');
    bindings.push(query.outcome);
  }
  if (query.since !== undefined) {
    conditions.push('ts >= ?');
    bindings.push(query.since);
  }
  if (query.until !== undefined) {
    conditions.push('ts <= ?');
    bindings.push(query.until);
  }

  const limit = Math.min(Math.max(query.limit ?? 50, 1), 500);
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { results } = await env.DB.prepare(
    `SELECT id, ts, request_id, principal_label, tool, store_domain,
            args_redacted, outcome, error_code, error_message, duration_ms
       FROM audit_log ${where}
      ORDER BY ts DESC
      LIMIT ?`,
  )
    .bind(...bindings, limit)
    .all<{
      id: string;
      ts: number;
      request_id: string;
      principal_label: string;
      tool: string;
      store_domain: string | null;
      args_redacted: string;
      outcome: string;
      error_code: string | null;
      error_message: string | null;
      duration_ms: number;
    }>();

  return results.map((row) => ({
    id: row.id,
    ts: row.ts,
    requestId: row.request_id,
    principal: row.principal_label,
    tool: row.tool,
    store: row.store_domain,
    args: safeParse(row.args_redacted),
    outcome: row.outcome,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    durationMs: row.duration_ms,
  }));
}

function safeParse(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}
