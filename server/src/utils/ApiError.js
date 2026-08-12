export class ApiError extends Error {
  constructor(status, message, code = undefined) {
    super(message);
    this.status = status;
    this.code = code;
  }

  static badRequest(message, code) {
    return new ApiError(400, message, code);
  }

  static unauthorized(message = 'Not authenticated', code) {
    return new ApiError(401, message, code);
  }

  static forbidden(message = 'Not allowed', code) {
    return new ApiError(403, message, code);
  }

  static notFound(message = 'Not found', code) {
    return new ApiError(404, message, code);
  }

  static conflict(message, code) {
    return new ApiError(409, message, code);
  }

  /**
   * Rate limited. The one status here that is not about the request being wrong
   * — it was fine, there have just been too many of them — so the message should
   * say when to come back rather than what to fix. `meta.retryAfterSeconds`
   * carries the number; see middleware/rateLimit.js.
   */
  static tooManyRequests(message = 'Too many requests', code = 'RATE_LIMITED') {
    return new ApiError(429, message, code);
  }
}
