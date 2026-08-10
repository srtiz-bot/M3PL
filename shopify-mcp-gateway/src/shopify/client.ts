/**
 * Shopify Admin GraphQL client.
 *
 * Responsibilities, in order of importance:
 *   1. Never leak a raw upstream failure to the caller — map onto our taxonomy.
 *   2. Never retry something deterministic (decision D-006).
 *   3. Stay inside the shop's leaky bucket, cooperatively with other Workers.
 */

import { GatewayError } from '../lib/errors.js';
import { parseRetryAfter, RetryableError, withRetry } from '../lib/retry.js';
import { getStoreAccessToken } from '../db/stores.js';
import type { Env, Store } from '../types.js';
import { RateLimiterClient } from './rate-limiter.js';

export interface GraphQLUserError {
  field?: string[] | null;
  message: string;
  code?: string;
}

interface ThrottleStatus {
  maximumAvailable: number;
  currentlyAvailable: number;
  restoreRate: number;
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string; extensions?: { code?: string } }>;
  extensions?: {
    cost?: {
      requestedQueryCost: number;
      actualQueryCost: number;
      throttleStatus: ThrottleStatus;
    };
  };
}

export interface ShopifyCallResult<T> {
  data: T;
  cost: number | null;
}

/**
 * Default pre-flight cost estimate.
 *
 * Shopify charges roughly 1 point per field plus connection multipliers. Most
 * of our queries land well under 50; over-estimating is the safe direction
 * since `observe()` corrects downward from the real cost afterwards.
 */
const DEFAULT_COST_ESTIMATE = 50;

export class ShopifyClient {
  private readonly limiter: RateLimiterClient;

  constructor(
    private readonly env: Env,
    private readonly store: Store,
  ) {
    const plusShops = (env.SHOPIFY_PLUS_SHOPS ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    this.limiter = new RateLimiterClient(
      env.SHOP_RATE_LIMITER,
      store.shopDomain,
      plusShops.includes(store.shopDomain.toLowerCase()),
    );
  }

  private get endpoint(): string {
    return `https://${this.store.shopDomain}/admin/api/${this.env.SHOPIFY_API_VERSION}/graphql.json`;
  }

  /**
   * Execute a GraphQL operation with rate limiting and bounded retry.
   *
   * `costEstimate` only affects pre-flight reservation; the real cost from
   * Shopify reconciles the bucket afterwards.
   */
  async graphql<T = Record<string, unknown>>(
    query: string,
    variables: Record<string, unknown> = {},
    options: { costEstimate?: number } = {},
  ): Promise<ShopifyCallResult<T>> {
    const accessToken = await getStoreAccessToken(this.env, this.store.id);
    const estimatedCost = options.costEstimate ?? DEFAULT_COST_ESTIMATE;

    return withRetry(
      async () => {
        // Wait for bucket capacity before spending a request on a near-certain 429.
        const reservation = await this.limiter.reserve(estimatedCost);
        if (!reservation.granted) {
          throw new RetryableError(
            `Rate limit bucket exhausted for ${this.store.shopDomain}.`,
            { retryAfterMs: reservation.retryAfterMs },
          );
        }

        const response = await this.fetchWithTimeout(accessToken, query, variables);
        return this.handleResponse<T>(response, estimatedCost);
      },
      {
        maxAttempts: 4,
        onRetry: ({ attempt, delayMs, error }) => {
          console.log(
            JSON.stringify({
              level: 'info',
              message: 'shopify_retry',
              shop: this.store.shopDomain,
              attempt,
              delayMs,
              cause: error instanceof Error ? error.message : String(error),
            }),
          );
        },
      },
    );
  }

  private async fetchWithTimeout(
    accessToken: string,
    query: string,
    variables: Record<string, unknown>,
  ): Promise<Response> {
    // Without a timeout a hung upstream connection would consume the entire
    // Worker invocation budget and surface as an opaque failure.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);

    try {
      return await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken,
          Accept: 'application/json',
        },
        body: JSON.stringify({ query, variables }),
        signal: controller.signal,
      });
    } catch (err) {
      // Network-level failures are exactly what retry exists for.
      if (err instanceof Error && err.name === 'AbortError') {
        throw new RetryableError(`Shopify request to ${this.store.shopDomain} timed out.`, { cause: err });
      }
      throw new RetryableError(`Network error calling ${this.store.shopDomain}.`, { cause: err });
    } finally {
      clearTimeout(timeout);
    }
  }

  private async handleResponse<T>(
    response: Response,
    estimatedCost: number,
  ): Promise<ShopifyCallResult<T>> {
    if (response.status === 429) {
      throw new RetryableError('Shopify rate limit exceeded.', {
        retryAfterMs: parseRetryAfter(response.headers.get('Retry-After')) ?? 1000,
      });
    }

    if (response.status >= 500) {
      throw new RetryableError(`Shopify returned HTTP ${response.status}.`);
    }

    if (response.status === 401 || response.status === 403) {
      // The stored token is dead or lacks a scope. Retrying cannot help, and
      // the operator needs to know a reinstall is required.
      throw new GatewayError(
        'STORE_UNINSTALLED',
        `Shopify rejected the stored credential for ${this.store.shopDomain} (HTTP ${response.status}). ` +
          'Reinstall the gateway app on this store to reissue it.',
      );
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new GatewayError('UPSTREAM_ERROR', `Shopify returned HTTP ${response.status}.`, {
        details: { body: body.slice(0, 500) },
      });
    }

    let payload: GraphQLResponse<T>;
    try {
      payload = (await response.json()) as GraphQLResponse<T>;
    } catch {
      throw new GatewayError('UPSTREAM_ERROR', 'Shopify returned a malformed JSON response.');
    }

    // Reconcile the bucket against Shopify's authoritative view.
    const cost = payload.extensions?.cost;
    if (cost) {
      await this.limiter
        .observe({
          actualCost: cost.actualQueryCost,
          estimatedCost,
          currentlyAvailable: cost.throttleStatus.currentlyAvailable,
          maximumAvailable: cost.throttleStatus.maximumAvailable,
          restoreRate: cost.throttleStatus.restoreRate,
        })
        // Reconciliation is an optimisation; failing it must not fail the call.
        .catch(() => undefined);
    }

    if (payload.errors?.length) {
      const throttled = payload.errors.some((e) => e.extensions?.code === 'THROTTLED');
      if (throttled) {
        throw new RetryableError('Shopify throttled the query.', { retryAfterMs: 1000 });
      }

      const messages = payload.errors.map((e) => e.message).join('; ');

      // Shopify reports missing API scopes as a GraphQL error, not a 403.
      if (/access denied|not approved|requires? .*scope/i.test(messages)) {
        throw new GatewayError(
          'PERMISSION_DENIED',
          `The Shopify app lacks a required API scope on ${this.store.shopDomain}: ${messages}`,
          { details: { grantedScopes: this.store.scopes } },
        );
      }

      throw new GatewayError('UPSTREAM_ERROR', `Shopify GraphQL error: ${messages}`, {
        details: { errors: payload.errors },
      });
    }

    if (!payload.data) {
      throw new GatewayError('UPSTREAM_ERROR', 'Shopify returned no data.');
    }

    return { data: payload.data, cost: cost?.actualQueryCost ?? null };
  }
}

/**
 * Convert Shopify `userErrors` into a validation failure.
 *
 * These are deliberately never retried: they are deterministic rejections of
 * the input, and the caller needs to see them to fix the request.
 */
export function assertNoUserErrors(userErrors: GraphQLUserError[] | undefined, operation: string): void {
  if (!userErrors || userErrors.length === 0) return;

  throw new GatewayError(
    'VALIDATION_FAILED',
    `${operation} was rejected by Shopify: ${userErrors.map((e) => e.message).join('; ')}`,
    { details: { userErrors } },
  );
}

/**
 * Turn a numeric or partial id into a Shopify global id.
 * Accepts `gid://shopify/Product/123`, `123`, or `Product/123`.
 */
export function toGid(type: string, id: string | number): string {
  const value = String(id).trim();
  if (value.startsWith('gid://')) return value;
  const numeric = value.includes('/') ? value.split('/').pop()! : value;
  return `gid://shopify/${type}/${numeric}`;
}

/** Extract the numeric portion of a global id, for display. */
export function fromGid(gid: string): string {
  return gid.split('/').pop() ?? gid;
}
