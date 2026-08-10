import { describe, expect, it } from 'vitest';
import { assertAllowed, parseIdToken, type GoogleIdentity } from '../src/auth/google.js';
import { verifyShopifyHmac } from '../src/auth/shopify-oauth.js';
import { hmacSha256Hex, toBase64Url } from '../src/lib/crypto.js';
import type { Env } from '../src/types.js';

function envWith(overrides: Partial<Env>): Env {
  return {
    ALLOWED_EMAIL_DOMAINS: '',
    ALLOWED_EMAILS: '',
    ...overrides,
  } as Env;
}

function identity(overrides: Partial<GoogleIdentity> = {}): GoogleIdentity {
  return {
    email: 'sortiz@starpilwax.com',
    name: 'S Ortiz',
    hostedDomain: 'starpilwax.com',
    emailVerified: true,
    ...overrides,
  };
}

describe('assertAllowed', () => {
  it('permits a matching hosted domain', () => {
    expect(() => assertAllowed(identity(), envWith({ ALLOWED_EMAIL_DOMAINS: 'starpilwax.com' }))).not.toThrow();
  });

  it('permits a matching email suffix when hd is absent', () => {
    expect(() =>
      assertAllowed(identity({ hostedDomain: null }), envWith({ ALLOWED_EMAIL_DOMAINS: 'starpilwax.com' })),
    ).not.toThrow();
  });

  it('permits an explicitly allowlisted individual', () => {
    expect(() =>
      assertAllowed(
        identity({ email: 'contractor@gmail.com', hostedDomain: null }),
        envWith({ ALLOWED_EMAILS: 'contractor@gmail.com' }),
      ),
    ).not.toThrow();
  });

  it('supports several domains', () => {
    expect(() =>
      assertAllowed(
        identity({ email: 'a@waxsupply.com', hostedDomain: 'waxsupply.com' }),
        envWith({ ALLOWED_EMAIL_DOMAINS: 'starpilwax.com, waxsupply.com' }),
      ),
    ).not.toThrow();
  });

  it('rejects an outside domain', () => {
    expect(() =>
      assertAllowed(
        identity({ email: 'stranger@example.com', hostedDomain: 'example.com' }),
        envWith({ ALLOWED_EMAIL_DOMAINS: 'starpilwax.com' }),
      ),
    ).toThrow(/not permitted/i);
  });

  it('rejects an unverified email', () => {
    expect(() =>
      assertAllowed(identity({ emailVerified: false }), envWith({ ALLOWED_EMAIL_DOMAINS: 'starpilwax.com' })),
    ).toThrow(/not verified/i);
  });

  it('fails CLOSED when no allowlist is configured', () => {
    // A misconfiguration must lock us out, never open the gateway to anyone.
    expect(() => assertAllowed(identity(), envWith({}))).toThrow(/allowlist/i);
  });

  it('does not let a lookalike domain through', () => {
    expect(() =>
      assertAllowed(
        identity({ email: 'attacker@evil-starpilwax.com', hostedDomain: 'evil-starpilwax.com' }),
        envWith({ ALLOWED_EMAIL_DOMAINS: 'starpilwax.com' }),
      ),
    ).toThrow(/not permitted/i);
  });
});

describe('parseIdToken', () => {
  function makeIdToken(claims: Record<string, unknown>): string {
    const encode = (value: unknown) =>
      toBase64Url(new TextEncoder().encode(JSON.stringify(value)));
    return `${encode({ alg: 'RS256' })}.${encode(claims)}.signature`;
  }

  const baseClaims = {
    iss: 'https://accounts.google.com',
    aud: 'client-123',
    exp: Math.floor(Date.now() / 1000) + 600,
    email: 'sortiz@starpilwax.com',
    email_verified: true,
    name: 'S Ortiz',
    hd: 'starpilwax.com',
  };

  it('extracts the identity from valid claims', () => {
    const result = parseIdToken(makeIdToken(baseClaims), 'client-123');
    expect(result.email).toBe('sortiz@starpilwax.com');
    expect(result.hostedDomain).toBe('starpilwax.com');
    expect(result.emailVerified).toBe(true);
  });

  it('rejects a token minted for a different application', () => {
    expect(() => parseIdToken(makeIdToken(baseClaims), 'other-client')).toThrow(/different application/i);
  });

  it('rejects an unexpected issuer', () => {
    expect(() => parseIdToken(makeIdToken({ ...baseClaims, iss: 'https://evil.example' }), 'client-123')).toThrow(
      /issuer/i,
    );
  });

  it('rejects an expired token', () => {
    expect(() =>
      parseIdToken(makeIdToken({ ...baseClaims, exp: Math.floor(Date.now() / 1000) - 10 }), 'client-123'),
    ).toThrow(/expired/i);
  });

  it('rejects a malformed token', () => {
    expect(() => parseIdToken('not.a.valid.jwt.at.all', 'client-123')).toThrow(/malformed/i);
  });
});

describe('verifyShopifyHmac', () => {
  const SECRET = 'shpss_test_secret';

  async function signedUrl(params: Record<string, string>): Promise<URL> {
    const sorted = Object.keys(params)
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join('&');
    const hmac = await hmacSha256Hex(SECRET, sorted);

    const url = new URL('https://gateway.example/shopify/callback');
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    url.searchParams.set('hmac', hmac);
    return url;
  }

  it('accepts a correctly signed callback', async () => {
    const url = await signedUrl({ code: 'abc123', shop: 'starpil.myshopify.com', state: 'st_1' });
    expect(await verifyShopifyHmac(url, SECRET)).toBe(true);
  });

  it('rejects a tampered parameter', async () => {
    const url = await signedUrl({ code: 'abc123', shop: 'starpil.myshopify.com', state: 'st_1' });
    url.searchParams.set('shop', 'attacker.myshopify.com');
    expect(await verifyShopifyHmac(url, SECRET)).toBe(false);
  });

  it('rejects a missing hmac', async () => {
    const url = new URL('https://gateway.example/shopify/callback?shop=starpil.myshopify.com');
    expect(await verifyShopifyHmac(url, SECRET)).toBe(false);
  });

  it('rejects a signature made with the wrong secret', async () => {
    const url = await signedUrl({ code: 'abc123', shop: 'starpil.myshopify.com' });
    expect(await verifyShopifyHmac(url, 'wrong_secret')).toBe(false);
  });

  it('is order-independent, since it sorts before signing', async () => {
    const url = await signedUrl({ b: '2', a: '1', c: '3' });
    const reordered = new URL('https://gateway.example/shopify/callback');
    reordered.searchParams.set('c', '3');
    reordered.searchParams.set('a', '1');
    reordered.searchParams.set('b', '2');
    reordered.searchParams.set('hmac', url.searchParams.get('hmac')!);
    expect(await verifyShopifyHmac(reordered, SECRET)).toBe(true);
  });
});
