/**
 * Per-shop rate limiter (Durable Object).
 *
 * Shopify's GraphQL Admin API is a cost-based leaky bucket scoped to the shop:
 * a bucket of N points that refills at R points/second. Workers are
 * distributed, so without one authoritative place to hold that state, several
 * concurrent bulk batches would each believe they had the full bucket and
 * collectively blow through it.
 *
 * One DO instance per shop domain gives us that serialization point. The DO
 * does not sleep on behalf of callers — it returns "wait this long", and the
 * caller waits. Blocking inside the DO would serialize all callers behind the
 * slowest one.
 */

/** Shopify's standard (non-Plus) bucket. Plus multiplies both by 10. */
const STANDARD_BUCKET = { capacity: 1000, restoreRate: 50 };
const PLUS_BUCKET = { capacity: 10_000, restoreRate: 500 };

interface ReserveRequest {
  cost: number;
  plus?: boolean;
}

interface ReserveResponse {
  /** Whether the caller may proceed immediately. */
  granted: boolean;
  /** If not granted, how long to wait before asking again. */
  retryAfterMs: number;
  available: number;
}

interface ObserveRequest {
  /** Actual cost reported by Shopify's `throttleStatus`. */
  actualCost: number;
  /** What we estimated and already deducted. */
  estimatedCost: number;
  /** Shopify's own view of the bucket, which is authoritative. */
  currentlyAvailable?: number;
  maximumAvailable?: number;
  restoreRate?: number;
}

export class ShopRateLimiter implements DurableObject {
  private available: number | null = null;
  private capacity = STANDARD_BUCKET.capacity;
  private restoreRate = STANDARD_BUCKET.restoreRate;
  private lastRefillMs = Date.now();

  // In-memory state is intentional: this is a throughput governor, not a
  // ledger. If the DO is evicted, we resynchronise from Shopify's own
  // throttleStatus on the very next response.
  constructor(
    private readonly state: DurableObjectState,
    private readonly env: unknown,
  ) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    switch (url.pathname) {
      case '/reserve':
        return this.handleReserve(await request.json<ReserveRequest>());
      case '/observe':
        return this.handleObserve(await request.json<ObserveRequest>());
      case '/status':
        this.refill();
        return Response.json({ available: this.available ?? this.capacity, capacity: this.capacity });
      default:
        return new Response('Not found', { status: 404 });
    }
  }

  private configure(plus: boolean | undefined): void {
    if (plus === undefined) return;
    const bucket = plus ? PLUS_BUCKET : STANDARD_BUCKET;
    if (this.capacity !== bucket.capacity) {
      this.capacity = bucket.capacity;
      this.restoreRate = bucket.restoreRate;
      this.available = null; // re-seed on next refill
    }
  }

  /** Add points for elapsed time, capped at capacity. */
  private refill(): void {
    const now = Date.now();
    if (this.available === null) {
      this.available = this.capacity;
      this.lastRefillMs = now;
      return;
    }
    const elapsedSeconds = (now - this.lastRefillMs) / 1000;
    if (elapsedSeconds <= 0) return;
    this.available = Math.min(this.capacity, this.available + elapsedSeconds * this.restoreRate);
    this.lastRefillMs = now;
  }

  private handleReserve(body: ReserveRequest): Response {
    this.configure(body.plus);
    this.refill();

    // A request costing more than the entire bucket can never succeed; let it
    // through so Shopify returns its own explanatory error rather than us
    // looping forever.
    const cost = Math.max(1, Math.min(body.cost, this.capacity));

    if (this.available! >= cost) {
      this.available! -= cost;
      return Response.json({
        granted: true,
        retryAfterMs: 0,
        available: Math.floor(this.available!),
      } satisfies ReserveResponse);
    }

    // Time for the bucket to refill to the requested cost, plus a small margin
    // so the retry does not land a hair early.
    const deficit = cost - this.available!;
    const retryAfterMs = Math.ceil((deficit / this.restoreRate) * 1000) + 50;

    return Response.json({
      granted: false,
      retryAfterMs,
      available: Math.floor(this.available!),
    } satisfies ReserveResponse);
  }

  /**
   * Reconcile against Shopify's reported state.
   *
   * Our pre-flight cost estimate is a guess; Shopify reports the real cost and
   * its own remaining balance. Trusting Shopify's number keeps our bucket from
   * drifting out of sync over a long run of calls.
   */
  private handleObserve(body: ObserveRequest): Response {
    if (body.maximumAvailable && body.maximumAvailable !== this.capacity) {
      this.capacity = body.maximumAvailable;
    }
    if (body.restoreRate) {
      this.restoreRate = body.restoreRate;
    }

    if (typeof body.currentlyAvailable === 'number') {
      this.available = body.currentlyAvailable;
      this.lastRefillMs = Date.now();
    } else {
      // No authoritative reading — correct for the estimate/actual difference.
      this.refill();
      this.available = Math.max(0, this.available! - (body.actualCost - body.estimatedCost));
    }

    return Response.json({ available: Math.floor(this.available ?? this.capacity) });
  }
}

/** Client-side helper used by the Shopify HTTP client. */
export class RateLimiterClient {
  constructor(
    private readonly namespace: DurableObjectNamespace,
    private readonly shopDomain: string,
    private readonly isPlus: boolean,
  ) {}

  private get stub(): DurableObjectStub {
    return this.namespace.get(this.namespace.idFromName(this.shopDomain));
  }

  async reserve(cost: number): Promise<ReserveResponse> {
    const response = await this.stub.fetch('https://limiter/reserve', {
      method: 'POST',
      body: JSON.stringify({ cost, plus: this.isPlus } satisfies ReserveRequest),
    });
    return response.json<ReserveResponse>();
  }

  async observe(body: ObserveRequest): Promise<void> {
    await this.stub.fetch('https://limiter/observe', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }
}
