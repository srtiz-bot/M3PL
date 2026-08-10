/**
 * Bounded retry with full jitter.
 *
 * The classifier is the important part. We retry transport-level and throttle
 * failures, and never retry deterministic validation failures — retrying a
 * GraphQL `userErrors` response just burns rate-limit quota and delays the
 * error the caller actually needs to see.
 */

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** Injectable for tests; defaults to a real timer. */
  sleep?: (ms: number) => Promise<void>;
  /** Injectable for tests; defaults to Math.random. */
  random?: () => number;
  onRetry?: (info: { attempt: number; delayMs: number; error: unknown }) => void;
}

const DEFAULTS = {
  maxAttempts: 4,
  baseDelayMs: 250,
  maxDelayMs: 8_000,
};

/**
 * A failure the caller has classified as worth retrying.
 * `retryAfterMs`, when present, comes from an upstream `Retry-After` header and
 * overrides our computed backoff — the server knows better than we do.
 */
export class RetryableError extends Error {
  readonly retryAfterMs?: number;

  constructor(message: string, options: { retryAfterMs?: number; cause?: unknown } = {}) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'RetryableError';
    this.retryAfterMs = options.retryAfterMs;
  }
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Full jitter: `random(0, min(cap, base * 2^attempt))`.
 *
 * Chosen over equal-jitter/decorrelated because when several bulk batches
 * collide on the same shop, full jitter spreads retries out the most and so
 * recovers fastest. See AWS's "Exponential Backoff and Jitter".
 */
export function computeBackoffMs(
  attempt: number,
  baseDelayMs = DEFAULTS.baseDelayMs,
  maxDelayMs = DEFAULTS.maxDelayMs,
  random: () => number = Math.random,
): number {
  const exponential = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
  return Math.floor(random() * exponential);
}

/**
 * Run `fn`, retrying only when it throws a `RetryableError`.
 *
 * Any other error propagates immediately — that is the contract that keeps
 * validation failures from being retried.
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const maxAttempts = options.maxAttempts ?? DEFAULTS.maxAttempts;
  const baseDelayMs = options.baseDelayMs ?? DEFAULTS.baseDelayMs;
  const maxDelayMs = options.maxDelayMs ?? DEFAULTS.maxDelayMs;
  const sleep = options.sleep ?? defaultSleep;
  const random = options.random ?? Math.random;

  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!(err instanceof RetryableError)) throw err;

      const isLastAttempt = attempt === maxAttempts - 1;
      if (isLastAttempt) break;

      // Honour an explicit Retry-After over our own backoff, but still cap it
      // so a pathological upstream value cannot stall a Worker invocation.
      const delayMs =
        err.retryAfterMs !== undefined
          ? Math.min(err.retryAfterMs, maxDelayMs)
          : computeBackoffMs(attempt, baseDelayMs, maxDelayMs, random);

      options.onRetry?.({ attempt: attempt + 1, delayMs, error: err });
      await sleep(delayMs);
    }
  }

  throw lastError;
}

/** Parse a `Retry-After` header, which may be seconds or an HTTP date. */
export function parseRetryAfter(header: string | null, now = Date.now()): number | undefined {
  if (!header) return undefined;

  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000);

  const date = Date.parse(header);
  if (Number.isFinite(date)) return Math.max(0, date - now);

  return undefined;
}
