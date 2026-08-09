import mongoose from 'mongoose';
import { z } from 'zod';

/**
 * Shared bits for the admin list endpoints — paging, id params and the one
 * thing you must never forget when building a RegExp from user input.
 */

/** A user string is not a pattern. Unescaped, `(a+)+` is a denial of service. */
export const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const objectId = z
  .string()
  .refine((value) => mongoose.Types.ObjectId.isValid(value), 'Not a valid id');

export const idParam = z.object({ id: objectId });

/**
 * Query paging, coerced because everything in a query string is a string.
 *
 * `limit` is capped: without it a caller asks for a million rows and the
 * response is the denial of service instead of the regex.
 */
export const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

/** The paginated envelope, so every list endpoint answers the same shape. */
export const paged = (key, rows, { total, page, limit }) => ({
  [key]: rows,
  total,
  page,
  limit,
  pages: Math.max(1, Math.ceil(total / limit)),
});
