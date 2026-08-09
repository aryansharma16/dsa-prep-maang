import { ApiError } from '../utils/ApiError.js';

/**
 * Validates req[source] against a zod schema and replaces it with the parsed
 * value — which is what lets a handler read `req.query.page` as a number.
 *
 * The reassignment on the last line is fine on Express 4, where `req.query` is
 * a plain property. **On Express 5 it becomes a getter and this throws.** The
 * fix at that point is to write the parsed value to `req.validated` instead of
 * back onto the request. Worth knowing before that upgrade, because the admin
 * list endpoints are the first callers to pass `'query'`.
 */
export const validate = (schema, source = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    const message = result.error.issues
      .map((i) => `${i.path.join('.') || source}: ${i.message}`)
      .join('; ');
    return next(ApiError.badRequest(message, 'VALIDATION'));
  }
  req[source] = result.data;
  next();
};
