import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

export function notFound(req, _res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars -- Express identifies error middleware by arity
export function errorHandler(err, _req, res, _next) {
  /*
    Nothing can be said once the status line is spent.

    Streaming routes commit headers early and then keep writing for a minute, so
    any error after that point arrives here on a response that cannot be given a
    status or a JSON body — `res.status().json()` on it throws
    ERR_HTTP_HEADERS_SENT, which replaces a handled failure with an unhandled
    one. Handing it back to Express lets finalhandler destroy the socket, which
    is the only correct outcome: a truncated stream is what the client already
    has to be able to cope with.

    The chat endpoint catches its own post-header failures and reports them as
    SSE events. This is the backstop for the ones it cannot, and for every
    streaming route written after it.
  */
  if (res.headersSent) return _next(err);

  let status = err.status || 500;
  let message = err.message || 'Something went wrong';
  let code = err.code;

  // Duplicate key (unique email, unique problem slug, unique user+problem)
  if (err.code === 11000) {
    status = 409;
    code = 'DUPLICATE';
    message = `Already exists: ${Object.keys(err.keyValue || {}).join(', ')}`;
  }

  if (err.name === 'ValidationError') {
    status = 400;
    code = 'VALIDATION';
    message = Object.values(err.errors || {})
      .map((e) => e.message)
      .join('; ');
  }

  // A malformed id in a URL is a bad request, not a server fault. Without this
  // every mistyped /admin/users/:id answers 500 with a stack trace attached.
  if (err.name === 'CastError') {
    status = 400;
    code = 'BAD_ID';
    message = `Invalid ${err.path}: ${String(err.value).slice(0, 60)}`;
  }

  if (status >= 500) console.error('[error]', err);

  // `meta` is opt-in — only errors that attach it get it, and only ever
  // structured facts the client can act on: which providers were tried, when a
  // quota resets. Never an upstream message, for the reason services/ai/errors.js
  // gives.
  return res.status(status).json({
    error: {
      message,
      code,
      ...(err.meta ? { meta: err.meta } : {}),
      ...(env.isProd ? {} : { stack: err.stack }),
    },
  });
}
