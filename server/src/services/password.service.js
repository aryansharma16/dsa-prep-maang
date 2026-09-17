import crypto from 'node:crypto';
import { PasswordReset } from '../models/PasswordReset.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { hashPassword } from './auth.service.js';
import { mailPasswordChanged, mailPasswordReset } from './mail.service.js';

/**
 * Forgotten passwords: a link by email, and setting a new password with it.
 *
 * Three rules make this safe, and each one closes a specific hole:
 *
 *  - **The answer is the same whether the address has an account or not.** A
 *    form that says "no account with that email" is a free lookup of who uses
 *    this app. So `requestReset` never throws for an unknown address, and the
 *    controller sends one sentence either way.
 *  - **A link works once, for an hour, and only the newest one works.** Asking
 *    again deletes the older links, so a reset email sitting in an old inbox —
 *    or forwarded by mistake — stops being a way in the moment a newer one is
 *    requested, and certainly once it has been used.
 *  - **Setting the password signs out everywhere.** Whoever forced this reset
 *    may already hold a session; bumping `tokenVersion` kills every refresh
 *    token issued before the change, which is the whole point of changing it.
 */

/** How long a link stays good. Long enough to find the email, short enough to go stale. */
export const RESET_TTL_MINUTES = 60;

/*
  How soon the same account can be sent another link. Without it the form is a
  way to put a few hundred emails in somebody's inbox from behind a rotating set
  of addresses, which the per-IP limiter cannot see. One a minute is invisible to
  a person who genuinely did not get the first one.
*/
const RESEND_AFTER_MS = 60 * 1000;

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

/**
 * Emails a reset link if the address belongs to an account. Resolves either way.
 *
 * The mail is not awaited, for the reason signup's is not — but here it also
 * matters for what the response time gives away: an address with an account
 * would otherwise take a mail-API round trip longer to answer than one without.
 */
export async function requestReset(email) {
  const user = await User.findOne({ email }).select('_id email name');
  if (!user) return;

  const recent = await PasswordReset.findOne({ user: user._id })
    .sort({ createdAt: -1 })
    .select('createdAt');
  if (recent && Date.now() - recent.createdAt.getTime() < RESEND_AFTER_MS) return;

  // 32 bytes, URL-safe: 43 characters with nothing to escape in a query string.
  const token = crypto.randomBytes(32).toString('base64url');

  // Only the newest link works — see the note at the top of this file.
  await PasswordReset.deleteMany({ user: user._id });
  await PasswordReset.create({
    user: user._id,
    tokenHash: sha256(token),
    expiresAt: new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000),
  });

  mailPasswordReset(user, token, RESET_TTL_MINUTES);
}

/**
 * Sets a new password from a link. The link is spent whether or not anything
 * after the lookup fails, because it is deleted before the password is written.
 *
 * One error for "no such token", "expired" and "already used": telling those
 * apart helps nobody who has a real link, and helps somebody probing for one.
 */
export async function resetPassword(token, password) {
  const reset = await PasswordReset.findOneAndDelete({ tokenHash: sha256(String(token)) });
  if (!reset || reset.expiresAt.getTime() < Date.now()) {
    throw ApiError.badRequest(
      'This reset link is invalid or has expired. Ask for a new one.',
      'RESET_INVALID',
    );
  }

  const user = await User.findById(reset.user).select('_id email name');
  if (!user) {
    throw ApiError.badRequest(
      'This reset link is invalid or has expired. Ask for a new one.',
      'RESET_INVALID',
    );
  }

  await User.updateOne(
    { _id: user._id },
    { $set: { passwordHash: await hashPassword(password) }, $inc: { tokenVersion: 1 } },
  );
  // Any other outstanding link for this account is now pointless, and a live one is a risk.
  await PasswordReset.deleteMany({ user: user._id });

  /*
    Sent to the account's own address, whatever happened. If they did this, it
    is a receipt; if they did not, it is the only way they find out somebody
    else can read their inbox.
  */
  mailPasswordChanged(user);

  return user;
}
