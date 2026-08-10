/**
 * Cryptographic primitives.
 *
 * Two distinct jobs live here and they are deliberately different:
 *
 *   • Shopify access tokens must be *recoverable*, so they are encrypted with
 *     AES-256-GCM under a key held only in a Worker secret.
 *   • Gateway-issued tokens (access / refresh / service-account) never need to
 *     be recovered, so only their SHA-256 hash is stored. A database dump
 *     therefore yields nothing usable.
 */

import { internalError } from './errors.js';

const ENVELOPE_VERSION = 'v1';
const IV_BYTES = 12; // 96-bit IV, the GCM-recommended size

// ---------------------------------------------------------------------------
// Encoding helpers
// ---------------------------------------------------------------------------

export function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ---------------------------------------------------------------------------
// Random values
// ---------------------------------------------------------------------------

/** A URL-safe random token. 32 bytes ≈ 256 bits of entropy. */
export function randomToken(bytes = 32): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export function randomId(prefix: string): string {
  return `${prefix}_${toBase64Url(crypto.getRandomValues(new Uint8Array(16)))}`;
}

// ---------------------------------------------------------------------------
// Hashing
// ---------------------------------------------------------------------------

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return toHex(new Uint8Array(digest));
}

export async function sha256Base64Url(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return toBase64Url(new Uint8Array(digest));
}

/**
 * Constant-time string comparison.
 *
 * Length is compared first and short-circuits — that leaks only the length,
 * which for fixed-width hashes and HMACs is not secret.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ---------------------------------------------------------------------------
// HMAC — used for Shopify webhook and callback verification
// ---------------------------------------------------------------------------

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

async function hmacSign(secret: string, message: string): Promise<Uint8Array> {
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return new Uint8Array(sig);
}

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  return toHex(await hmacSign(secret, message));
}

export async function hmacSha256Base64(secret: string, message: string): Promise<string> {
  let binary = '';
  for (const b of await hmacSign(secret, message)) binary += String.fromCharCode(b);
  return btoa(binary);
}

// ---------------------------------------------------------------------------
// Envelope encryption for Shopify access tokens
// ---------------------------------------------------------------------------

async function importAesKey(rawKey: string): Promise<CryptoKey> {
  const keyBytes = fromBase64Url(rawKey);
  if (keyBytes.length !== 32) {
    throw internalError(
      'TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes. ' +
        'Generate one with: openssl rand -base64 32 | tr "+/" "-_" | tr -d "="',
    );
  }
  return crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

/**
 * Encrypt to `v1:<iv>:<ciphertext+tag>`, all base64url.
 *
 * The version prefix exists so the key or algorithm can be rotated without a
 * flag-day migration: a future decrypt can dispatch on it.
 */
export async function encryptSecret(plaintext: string, rawKey: string): Promise<string> {
  const key = await importAesKey(rawKey);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  return `${ENVELOPE_VERSION}:${toBase64Url(iv)}:${toBase64Url(new Uint8Array(ciphertext))}`;
}

export async function decryptSecret(envelope: string, rawKey: string): Promise<string> {
  const parts = envelope.split(':');
  if (parts.length !== 3 || parts[0] !== ENVELOPE_VERSION) {
    throw internalError('Stored secret is malformed or uses an unsupported envelope version.');
  }
  const key = await importAesKey(rawKey);
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64Url(parts[1]!) },
      key,
      fromBase64Url(parts[2]!),
    );
    return new TextDecoder().decode(plaintext);
  } catch {
    // GCM authentication failure: wrong key, or the ciphertext was tampered with.
    throw internalError('Failed to decrypt stored secret. The encryption key may have changed.');
  }
}
