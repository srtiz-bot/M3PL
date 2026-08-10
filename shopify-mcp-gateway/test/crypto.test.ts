import { describe, expect, it } from 'vitest';
import {
  decryptSecret,
  encryptSecret,
  fromBase64Url,
  hmacSha256Hex,
  randomToken,
  sha256Base64Url,
  sha256Hex,
  timingSafeEqual,
  toBase64Url,
} from '../src/lib/crypto.js';

// A valid 32-byte key, base64url encoded.
const KEY = toBase64Url(new Uint8Array(32).fill(7));

describe('base64url encoding', () => {
  it('round-trips arbitrary bytes', () => {
    const bytes = new Uint8Array([0, 1, 250, 251, 252, 253, 254, 255, 62, 63]);
    expect(Array.from(fromBase64Url(toBase64Url(bytes)))).toEqual(Array.from(bytes));
  });

  it('emits no padding or URL-unsafe characters', () => {
    for (let length = 1; length <= 8; length++) {
      const encoded = toBase64Url(new Uint8Array(length).fill(255));
      expect(encoded).not.toMatch(/[+/=]/);
    }
  });
});

describe('encryptSecret / decryptSecret', () => {
  it('round-trips a Shopify access token', async () => {
    // Assembled at runtime rather than written literally: a realistic-looking
    // shpat_ literal trips GitHub push protection, even as an obvious fixture.
    const token = ['shpat', 'NOT', 'A', 'REAL', 'TOKEN', 'x'.repeat(24)].join('_');
    const envelope = await encryptSecret(token, KEY);

    expect(envelope.startsWith('v1:')).toBe(true);
    // The plaintext must not be recoverable by inspection.
    expect(envelope).not.toContain(token);
    expect(await decryptSecret(envelope, KEY)).toBe(token);
  });

  it('produces a different ciphertext each time (random IV)', async () => {
    const a = await encryptSecret('same-input', KEY);
    const b = await encryptSecret('same-input', KEY);
    expect(a).not.toBe(b);
    expect(await decryptSecret(a, KEY)).toBe(await decryptSecret(b, KEY));
  });

  it('refuses to decrypt with the wrong key', async () => {
    const envelope = await encryptSecret('secret', KEY);
    const otherKey = toBase64Url(new Uint8Array(32).fill(9));
    await expect(decryptSecret(envelope, otherKey)).rejects.toThrow(/decrypt/i);
  });

  it('detects tampering with the ciphertext', async () => {
    const envelope = await encryptSecret('secret', KEY);
    const parts = envelope.split(':');
    // Flip a character in the ciphertext; GCM authentication must reject it.
    const tampered = parts[2]!.startsWith('A')
      ? `B${parts[2]!.slice(1)}`
      : `A${parts[2]!.slice(1)}`;
    await expect(decryptSecret(`${parts[0]}:${parts[1]}:${tampered}`, KEY)).rejects.toThrow();
  });

  it('rejects a malformed envelope', async () => {
    await expect(decryptSecret('not-an-envelope', KEY)).rejects.toThrow(/malformed|unsupported/i);
  });

  it('rejects a key that is not 32 bytes', async () => {
    await expect(encryptSecret('x', toBase64Url(new Uint8Array(16)))).rejects.toThrow(/32 bytes/);
  });
});

describe('timingSafeEqual', () => {
  it('matches identical strings', () => {
    expect(timingSafeEqual('abc123', 'abc123')).toBe(true);
  });

  it('rejects differing strings of equal length', () => {
    expect(timingSafeEqual('abc123', 'abc124')).toBe(false);
  });

  it('rejects strings of differing length', () => {
    expect(timingSafeEqual('abc', 'abcd')).toBe(false);
  });
});

describe('hashing', () => {
  it('sha256Hex matches a known vector', async () => {
    // SHA-256("abc")
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('sha256Base64Url produces the PKCE S256 challenge format', async () => {
    // RFC 7636 Appendix B test vector.
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    expect(await sha256Base64Url(verifier)).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('hmacSha256Hex matches a known vector', async () => {
    // RFC 4231 test case 1.
    expect(await hmacSha256Hex('key', 'The quick brown fox jumps over the lazy dog')).toBe(
      'f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8',
    );
  });
});

describe('randomToken', () => {
  it('produces distinct, URL-safe values', () => {
    const tokens = new Set(Array.from({ length: 100 }, () => randomToken()));
    expect(tokens.size).toBe(100);
    for (const token of tokens) expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
