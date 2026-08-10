import { describe, expect, it } from 'vitest';
import { getTool, listTools } from '../src/tools/index.js';
import { buildProductQuery, clampLimit } from '../src/tools/products.js';
import { defaultLabelFor, isValidShopDomain } from '../src/db/stores.js';
import { ROLE_SCOPES } from '../src/db/permissions.js';
import { SCOPES } from '../src/types.js';

describe('tool registry', () => {
  it('exposes the full documented tool surface', () => {
    expect(listTools().map((t) => t.name).sort()).toEqual(
      [
        'audit_search',
        'bulk_tag',
        'discount_create',
        'inventory_get',
        'inventory_set',
        'list_stores',
        'order_get',
        'order_search',
        'product_get',
        'product_search',
        'product_update',
      ].sort(),
    );
  });

  it('gives every tool a valid scope', () => {
    for (const tool of listTools()) {
      expect(SCOPES).toContain(tool.scope);
    }
  });

  it('requires a `store` argument on every store-scoped tool', () => {
    // No ambient "current store" (decision D-010) — a scheduled task must not
    // depend on prior session state.
    for (const tool of listTools()) {
      if (!tool.needsStore) continue;
      expect(tool.inputSchema.properties).toHaveProperty('store');
      expect(tool.inputSchema.required).toContain('store');
    }
  });

  it('declares loggable args for every tool that takes arguments', () => {
    for (const tool of listTools()) {
      expect(Array.isArray(tool.loggableArgs)).toBe(true);
    }
  });

  it('never marks a customer email as loggable', () => {
    // Guards decision D-009 against future tools quietly logging PII.
    for (const tool of listTools()) {
      expect(tool.loggableArgs).not.toContain('email');
    }
  });

  it('offers an idempotencyKey on every mutating tool', () => {
    for (const tool of listTools()) {
      if (!tool.mutating) continue;
      expect(tool.inputSchema.properties).toHaveProperty('idempotencyKey');
    }
  });

  it('resolves tools by name', () => {
    expect(getTool('bulk_tag')?.name).toBe('bulk_tag');
    expect(getTool('does_not_exist')).toBeUndefined();
  });
});

describe('role presets', () => {
  it('gives admin every scope', () => {
    expect(new Set(ROLE_SCOPES.admin)).toEqual(new Set(SCOPES));
  });

  it('keeps analysts read-only', () => {
    for (const scope of ROLE_SCOPES.analyst) {
      expect(scope.endsWith(':write')).toBe(false);
      expect(scope).not.toBe('admin');
    }
  });

  it('withholds audit:read and admin from operators', () => {
    // Reading everyone's activity is supervisory, not operational.
    expect(ROLE_SCOPES.operator).not.toContain('audit:read');
    expect(ROLE_SCOPES.operator).not.toContain('admin');
  });
});

describe('buildProductQuery', () => {
  it('returns an empty string when nothing is filtered', () => {
    expect(buildProductQuery({})).toBe('');
  });

  it('combines filters with AND', () => {
    const query = buildProductQuery({ tag: 'summer', status: 'active' });
    expect(query).toContain("tag:'summer'");
    expect(query).toContain('status:ACTIVE');
    expect(query).toContain(' AND ');
  });

  it('searches both title and SKU for free text', () => {
    const query = buildProductQuery({ query: 'wax' });
    expect(query).toContain('title:*wax*');
    expect(query).toContain('sku:*wax*');
  });

  it('escapes quotes so a crafted term cannot break out of the clause', () => {
    expect(buildProductQuery({ tag: "it's" })).toContain("\\'");
  });
});

describe('clampLimit', () => {
  it('falls back for missing or invalid input', () => {
    expect(clampLimit(undefined, 25)).toBe(25);
    expect(clampLimit('abc', 25)).toBe(25);
    expect(clampLimit(0, 25)).toBe(25);
    expect(clampLimit(-5, 25)).toBe(25);
  });

  it('caps at the maximum', () => {
    expect(clampLimit(9999, 25)).toBe(250);
    expect(clampLimit(9999, 25, 1000)).toBe(1000);
  });

  it('passes through and floors valid values', () => {
    expect(clampLimit(50, 25)).toBe(50);
    expect(clampLimit(50.9, 25)).toBe(50);
  });
});

describe('isValidShopDomain', () => {
  it('accepts real myshopify domains', () => {
    expect(isValidShopDomain('starpil.myshopify.com')).toBe(true);
    expect(isValidShopDomain('wax-supply.myshopify.com')).toBe(true);
  });

  it('rejects anything that is not a myshopify domain', () => {
    // This check is what stops a crafted `shop` parameter pointing the OAuth
    // flow at an attacker-controlled host.
    expect(isValidShopDomain('evil.com')).toBe(false);
    expect(isValidShopDomain('starpil.myshopify.com.evil.com')).toBe(false);
    expect(isValidShopDomain('starpil.myshopify.com/../x')).toBe(false);
    expect(isValidShopDomain('-bad.myshopify.com')).toBe(false);
    expect(isValidShopDomain('')).toBe(false);
    expect(isValidShopDomain('https://starpil.myshopify.com')).toBe(false);
  });
});

describe('defaultLabelFor', () => {
  it('derives a readable label from the domain', () => {
    expect(defaultLabelFor('starpil.myshopify.com')).toBe('Starpil');
    expect(defaultLabelFor('wax-supply.myshopify.com')).toBe('Wax Supply');
  });
});
