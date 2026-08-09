import { can } from '../config/roles.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Gates a route on one capability. Runs after `requireAuth`, which has already
 * established who the caller is.
 *
 * This reads the account rather than trusting a role claim in the token. A
 * token lives fifteen minutes, so a claim would leave a demoted admin holding
 * their old powers for that long — the one window where being slow to notice
 * actually matters. One indexed read on an admin route is a fine price; the
 * rest of the app still does zero reads in `requireAuth`.
 *
 * `req.actor` is left behind because every admin handler needs it anyway, for
 * the audit log if nothing else.
 */
export const requireCap = (capability) =>
  asyncHandler(async (req, _res, next) => {
    const actor = await User.findById(req.userId).select('email name role');
    if (!actor) throw ApiError.unauthorized('Account no longer exists', 'NO_USER');

    if (!can(actor.role, capability)) {
      // Deliberately vague. Naming the capability would tell someone probing
      // the API exactly which role to go after.
      throw ApiError.forbidden('You do not have access to this', 'FORBIDDEN');
    }

    req.actor = actor;
    next();
  });
