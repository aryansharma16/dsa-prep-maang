import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { isSuperAdminEmail } from './auth.service.js';

/**
 * The two guards that keep the super-admin pin from being decorative.
 *
 * Neither is obvious from the permission matrix, and without them the matrix
 * lies. They are here rather than inline in each handler because every user
 * write needs both, and one that forgets is a full account takeover.
 */

/** Fields a handler needs about the account it is acting on. Never the hash. */
const TARGET_FIELDS = 'email name role avatar profile createdAt updatedAt';

/**
 * Loads the account an admin action targets, and refuses the escalation.
 *
 * `admin` holds `user:password`, so without the super-admin check an admin sets
 * the owner's password and signs in as them — two clicks to own the site. The
 * same check stops anyone renaming, demoting or deleting the owner. Acting on
 * your own account is allowed; that is how the owner changes their own name.
 */
export async function loadTarget(req, { write = true } = {}) {
  const target = await User.findById(req.params.id).select(TARGET_FIELDS);
  if (!target) throw ApiError.notFound('User not found', 'NO_USER');

  if (write && target.role === 'super_admin' && String(target._id) !== req.userId) {
    throw ApiError.forbidden(
      'The super admin account cannot be changed from here',
      'SUPER_ADMIN_PINNED',
    );
  }

  return target;
}

/**
 * Refuses to move the pinned address onto or off any account.
 *
 * This is the escalation the matrix hides: `admin` and `dev_member` can both
 * edit a user's email. Without this, either one moves SUPER_ADMIN_EMAIL off the
 * owner's account, puts it on their own, signs out and back in — and the login
 * hook promotes them to super_admin. Editing "user details" turns out to be a
 * path to owning the site, so the reserved address is refused in both
 * directions.
 *
 * Creation calls this with no target: there is no address to move off, but the
 * reserved one must not be claimable by a brand new account either.
 */
export function assertEmailNotReserved(nextEmail, target = {}) {
  const next = String(nextEmail || '').trim().toLowerCase();
  if (!next || next === target.email) return;

  if (isSuperAdminEmail(next)) {
    throw ApiError.forbidden(
      'That address is reserved for the super admin',
      'SUPER_ADMIN_PINNED',
    );
  }
  if (isSuperAdminEmail(target.email)) {
    throw ApiError.forbidden(
      'The super admin address cannot be changed from here',
      'SUPER_ADMIN_PINNED',
    );
  }
}

/** Some actions make no sense against yourself, and one is a lockout. */
export function assertNotSelf(req, target, what) {
  if (String(target._id) === req.userId) {
    throw ApiError.forbidden(`You cannot ${what} your own account`, 'SELF_ACTION');
  }
}
