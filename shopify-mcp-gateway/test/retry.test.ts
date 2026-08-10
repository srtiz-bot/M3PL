import { describe, expect, it, vi } from 'vitest';
import { computeBackoffMs, parseRetryAfter, RetryableError, withRetry } from '../src/lib/retry.js';

/** Deterministic sleep that records the delays instead of waiting. */
function recordingSleep() {
  const delays: number[] = [];
  return {
    delays,
    sleep: async (ms: number) => {
      delays.push(ms);
    },
  };
}

describe('withRetry', () => {
  it('returns the first successful result without sleeping', async () => {
    const { delays, sleep } = recordingSleep();
    const fn = vi.fn(async () => 'ok');

    expect(await withRetry(fn, { sleep })).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(delays).toEqual([]);
  });

  it('retries a RetryableError and eventually succeeds', async () => {
    const { delays, sleep } = recordingSleep();
    let attempts = 0;
    const fn = async () => {
      attempts++;
      if (attempts < 3) throw new RetryableError('throttled');
      return 'recovered';
    };

    expect(await withRetry(fn, { sleep, random: () => 0.5 })).toBe('recovered');
    expect(attempts).toBe(3);
    expect(delays).toHaveLength(2);
  });

  it('does NOT retry a non-retryable error', async () => {
    // This is decision D-006: deterministic failures must surface immediately.
    const { delays, sleep } = recordingSleep();
    const fn = vi.fn(async () => {
      throw new Error('validation failed');
    });

    await expect(withRetry(fn, { sleep })).rejects.toThrow('validation failed');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(delays).toEqual([]);
  });

  it('gives up after maxAttempts and rethrows the last error', async () => {
    const { delays, sleep } = recordingSleep();
    const fn = vi.fn(async () => {
      throw new RetryableError('always down');
    });

    await expect(withRetry(fn, { sleep, maxAttempts: 3 })).rejects.toThrow('always down');
    expect(fn).toHaveBeenCalledTimes(3);
    // Three attempts means two waits — no pointless sleep after the last try.
    expect(delays).toHaveLength(2);
  });

  it('honours an explicit retryAfterMs over computed backoff', async () => {
    const { delays, sleep } = recordingSleep();
    let attempts = 0;
    const fn = async () => {
      attempts++;
      if (attempts === 1) throw new RetryableError('slow down', { retryAfterMs: 1234 });
      return 'ok';
    };

    await withRetry(fn, { sleep, random: () => 0 });
    expect(delays).toEqual([1234]);
  });

  it('caps a pathological retryAfterMs at maxDelayMs', async () => {
    const { delays, sleep } = recordingSleep();
    let attempts = 0;
    const fn = async () => {
      attempts++;
      if (attempts === 1) throw new RetryableError('back off', { retryAfterMs: 999_999 });
      return 'ok';
    };

    await withRetry(fn, { sleep, maxDelayMs: 5000 });
    expect(delays).toEqual([5000]);
  });

  it('reports each retry through onRetry', async () => {
    const { sleep } = recordingSleep();
    const onRetry = vi.fn();
    let attempts = 0;

    await withRetry(
      async () => {
        attempts++;
        if (attempts < 3) throw new RetryableError('nope');
        return 'ok';
      },
      { sleep, onRetry },
    );

    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry.mock.calls[0]![0].attempt).toBe(1);
  });
});

describe('computeBackoffMs', () => {
  it('grows exponentially with the attempt number', () => {
    // random() === 1 gives the top of the jitter window.
    expect(computeBackoffMs(0, 100, 10_000, () => 1)).toBe(100);
    expect(computeBackoffMs(1, 100, 10_000, () => 1)).toBe(200);
    expect(computeBackoffMs(2, 100, 10_000, () => 1)).toBe(400);
    expect(computeBackoffMs(3, 100, 10_000, () => 1)).toBe(800);
  });

  it('applies full jitter, so the floor is zero', () => {
    expect(computeBackoffMs(5, 100, 10_000, () => 0)).toBe(0);
  });

  it('never exceeds maxDelayMs', () => {
    expect(computeBackoffMs(20, 100, 3000, () => 1)).toBe(3000);
  });
});

describe('parseRetryAfter', () => {
  it('parses a delay expressed in seconds', () => {
    expect(parseRetryAfter('2')).toBe(2000);
    expect(parseRetryAfter('0')).toBe(0);
  });

  it('parses an HTTP date relative to now', () => {
    const now = Date.parse('2026-08-10T12:00:00Z');
    const later = new Date(now + 5000).toUTCString();
    // toUTCString drops sub-second precision, so allow a small tolerance.
    expect(parseRetryAfter(later, now)).toBeGreaterThanOrEqual(4000);
    expect(parseRetryAfter(later, now)).toBeLessThanOrEqual(5000);
  });

  it('returns undefined for a missing or unparseable header', () => {
    expect(parseRetryAfter(null)).toBeUndefined();
    expect(parseRetryAfter('soon')).toBeUndefined();
  });

  it('never returns a negative delay for a past date', () => {
    const now = Date.parse('2026-08-10T12:00:00Z');
    expect(parseRetryAfter(new Date(now - 60_000).toUTCString(), now)).toBe(0);
  });
});
