/**
 * A small, stable error taxonomy.
 *
 * Everything that can fail is mapped onto one of these codes before it reaches
 * a caller. The point is that a scheduled job can branch on `code` and a human
 * reading Claude's output gets a sentence that says what to do next — neither
 * of which works if raw HTTP status codes leak through.
 */

export type ErrorCode =
  | 'UNAUTHENTICATED'
  | 'PERMISSION_DENIED'
  | 'STORE_NOT_FOUND'
  | 'STORE_UNINSTALLED'
  | 'NOT_FOUND'
  | 'VALIDATION_FAILED'
  | 'RATE_LIMITED'
  | 'UPSTREAM_ERROR'
  | 'INTERNAL_ERROR';

/** HTTP status used when an error surfaces over the admin/OAuth HTTP API. */
const HTTP_STATUS: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  PERMISSION_DENIED: 403,
  STORE_NOT_FOUND: 404,
  STORE_UNINSTALLED: 409,
  NOT_FOUND: 404,
  VALIDATION_FAILED: 400,
  RATE_LIMITED: 429,
  UPSTREAM_ERROR: 502,
  INTERNAL_ERROR: 500,
};

export class GatewayError extends Error {
  readonly code: ErrorCode;
  /** Structured detail safe to return to the caller (e.g. Shopify userErrors). */
  readonly details?: unknown;
  /** Whether the caller may usefully retry the identical request. */
  readonly retryable: boolean;

  constructor(
    code: ErrorCode,
    message: string,
    options: { details?: unknown; retryable?: boolean; cause?: unknown } = {},
  ) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'GatewayError';
    this.code = code;
    this.details = options.details;
    this.retryable = options.retryable ?? (code === 'RATE_LIMITED' || code === 'UPSTREAM_ERROR');
  }

  get httpStatus(): number {
    return HTTP_STATUS[this.code];
  }

  /**
   * The shape returned to MCP clients. `code` is for machines, `message` for
   * humans, `details` for whatever the model needs to fix its next attempt.
   */
  toPayload(requestId?: string): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      error: this.code,
      message: this.message,
      retryable: this.retryable,
    };
    if (this.details !== undefined) payload.details = this.details;
    if (requestId) payload.requestId = requestId;
    return payload;
  }
}

export const unauthenticated = (m = 'Authentication required.') =>
  new GatewayError('UNAUTHENTICATED', m);

export const permissionDenied = (m: string, details?: unknown) =>
  new GatewayError('PERMISSION_DENIED', m, { details });

export const validationFailed = (m: string, details?: unknown) =>
  new GatewayError('VALIDATION_FAILED', m, { details });

export const notFound = (m: string) => new GatewayError('NOT_FOUND', m);

export const internalError = (m: string, cause?: unknown) =>
  new GatewayError('INTERNAL_ERROR', m, { cause });

/**
 * Coerce an unknown thrown value into a GatewayError. Unknown failures become
 * INTERNAL_ERROR with a generic message — we deliberately do not echo arbitrary
 * exception text back to a caller, since it can carry internals.
 */
export function toGatewayError(err: unknown): GatewayError {
  if (err instanceof GatewayError) return err;
  const message = err instanceof Error ? err.message : String(err);
  return new GatewayError('INTERNAL_ERROR', 'An unexpected error occurred.', { cause: message });
}
