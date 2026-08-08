import { ApiError } from '../utils/ApiError.js';

// Validates req[source] against a zod schema and replaces it with the parsed value.
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
