import { describe, expect, it } from 'vitest';
import { redactArgs } from '../src/lib/audit.js';

describe('redactArgs', () => {
  it('keeps allowlisted fields verbatim', () => {
    const result = redactArgs({ store: 'starpil', limit: 25 }, ['store', 'limit']);
    expect(result).toEqual({ store: 'starpil', limit: 25 });
  });

  it('replaces non-allowlisted fields with a marker rather than dropping them', () => {
    // Recording that an argument was supplied, without its value, is what lets
    // an investigator tell "not passed" apart from "passed but private".
    const result = redactArgs({ store: 'starpil', email: 'customer@example.com' }, ['store']);
    expect(result).toEqual({ store: 'starpil', email: '[redacted]' });
  });

  it('redacts everything when no allowlist is declared', () => {
    // A tool that forgets to declare loggableArgs must fail closed.
    const result = redactArgs({ secret: 'value', other: 1 }, undefined);
    expect(result).toEqual({ secret: '[redacted]', other: '[redacted]' });
  });

  it('returns an empty object for absent args', () => {
    expect(redactArgs(undefined, ['store'])).toEqual({});
  });

  it('truncates long strings', () => {
    const long = 'x'.repeat(1000);
    const result = redactArgs({ query: long }, ['query']) as { query: string };
    expect(result.query.length).toBeLessThan(600);
    expect(result.query.endsWith('…')).toBe(true);
  });

  it('caps long arrays and reports how many were dropped', () => {
    const ids = Array.from({ length: 100 }, (_, i) => `id-${i}`);
    const result = redactArgs({ productIds: ids }, ['productIds']) as { productIds: unknown[] };
    expect(result.productIds).toHaveLength(26); // 25 items + the summary entry
    expect(String(result.productIds[25])).toContain('75 more');
  });

  it('truncates nested object values', () => {
    const result = redactArgs({ filter: { name: 'y'.repeat(1000) } }, ['filter']) as {
      filter: { name: string };
    };
    expect(result.filter.name.length).toBeLessThan(600);
  });

  it('leaves non-string scalars untouched', () => {
    const result = redactArgs({ limit: 42, dryRun: true, missing: null }, ['limit', 'dryRun', 'missing']);
    expect(result).toEqual({ limit: 42, dryRun: true, missing: null });
  });
});
