import { Pattern } from '../models/Pattern.js';
import { PatternGuide } from '../models/PatternGuide.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * GET /api/patterns/:slug/guide
 *
 * A pattern with no guide written yet answers 200 with `guide: null` rather
 * than 404. It is not an error — the drawer renders "no guide yet" and offers
 * the blurb, which is the right state for a pattern nobody has documented.
 * A slug that is not a pattern at all is a genuine 404.
 */
export const getGuide = asyncHandler(async (req, res) => {
  const slug = String(req.params.slug || '').toLowerCase();

  const guide = await PatternGuide.findOne({ patternSlug: slug }).lean();
  if (guide) return res.json({ slug, guide });

  const pattern = await Pattern.findOne({ slug }).select('slug name blurb').lean();
  if (!pattern) throw ApiError.notFound(`Unknown pattern: ${slug}`, 'NO_PATTERN');

  res.json({ slug, guide: null, pattern });
});
