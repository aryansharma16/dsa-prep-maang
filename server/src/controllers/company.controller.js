import { companySlug, ensureLogo } from '../services/logo.service.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const A_MONTH = 60 * 60 * 24 * 30;
const A_DAY = 60 * 60 * 24;

export const getLogo = asyncHandler(async (req, res) => {
  const slug = companySlug(req.params.slug);
  if (!slug) throw ApiError.badRequest('Company required', 'BAD_COMPANY');

  const logo = await ensureLogo(slug);

  if (!logo) {
    // The miss is cached too. Without this every row with an unknown company
    // re-asks on every render, and each ask is a database round trip.
    res.set('Cache-Control', `public, max-age=${A_DAY}`);
    throw ApiError.notFound(`No logo for ${slug}`, 'NO_LOGO');
  }

  res.set('Content-Type', logo.contentType);
  res.set('Cache-Control', `public, max-age=${A_MONTH}`);
  // These bytes came off a third-party CDN. nosniff keeps the browser from
  // reinterpreting them as anything but the image type we recorded.
  res.set('X-Content-Type-Options', 'nosniff');
  // res.send() adds the ETag and answers conditional GETs with a 304 itself.
  res.send(logo.data);
});
