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
 * response is the denial of service instead of the regex. `max` is per
 * endpoint, because the ceiling that is safe depends on how wide a row is —
 * a list projected down to a dozen scalar fields carries a page a hundred
 * times larger than one that ships rendered HTML.
 *
 * `limit=all` asks for one page of everything and means `max`. It is the
 * honest spelling of what a caller wanting the whole list is doing: it still
 * cannot exceed the ceiling, and the envelope's `total`/`pages` say whether
 * anything was left behind.
 */
export const makePageQuery = ({ max = 100, defaultLimit = 25 } = {}) =>
  z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.preprocess(
      (value) => (value === 'all' ? max : value),
      z.coerce.number().int().min(1).max(max).default(defaultLimit),
    ),
  });

export const pageQuery = makePageQuery();

/** The paginated envelope, so every list endpoint answers the same shape. */
export const paged = (key, rows, { total, page, limit }) => ({
  [key]: rows,
  total,
  page,
  limit,
  pages: Math.max(1, Math.ceil(total / limit)),
});
