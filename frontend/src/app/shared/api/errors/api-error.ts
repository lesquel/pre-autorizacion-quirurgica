/**
 * ApiError — typed wrapper around RFC 7807 problem+json responses, plus
 * fallback for transport-level failures.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly title?: string,
    readonly detail?: string,
    readonly traceId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
