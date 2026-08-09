import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

export function notFound(req, _res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars -- Express identifies error middleware by arity
export function errorHandler(err, _req, res, _next) {
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

  res.status(status).json({
    error: {
      message,
      code,
      ...(env.isProd ? {} : { stack: err.stack }),
    },
  });
}
