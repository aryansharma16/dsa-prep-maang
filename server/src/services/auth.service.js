import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { DEFAULT_ROLE } from '../config/roles.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';

const BCRYPT_ROUNDS = 12;

export const hashPassword = (password) => bcrypt.hash(password, BCRYPT_ROUNDS);

/** Whether this address is the pinned super admin. Never true when unset. */
export const isSuperAdminEmail = (email) =>
  Boolean(env.superAdminEmail) && String(email || '').toLowerCase() === env.superAdminEmail;

/**
 * Makes the pinned account a super admin, if it exists and is not one already.
 *
 * Called on boot and again at every login. Twice, because neither alone is
 * enough: at boot the account may not have registered yet, and a login-only
 * check would leave the role unset for an owner who never signs out. It writes
 * only when the role is actually wrong, so the steady state costs one indexed
 * read.
 */
export async function reconcileSuperAdmin() {
  if (!env.superAdminEmail) return null;

  const user = await User.findOne({ email: env.superAdminEmail }).select('role email');
  if (!user) return null;
  if (user.role === 'super_admin') return user;

  await User.updateOne({ _id: user._id }, { $set: { role: 'super_admin' } });
  console.log(`[auth] ${user.email} promoted to super_admin`);
  return user;
}

/**
 * Creates an account. Both the public signup and the admin panel come here, so
 * "email already taken" is answered in one place with one message.
 *
 * `role` is a parameter rather than something the caller sets afterwards: an
 * account that exists for a moment as a plain `user` before being promoted is a
 * second write that can fail on its own. Public signup never passes it — its
 * schema has no such field — so it falls to DEFAULT_ROLE. The pinned-address
 * spread stays last, and so still wins over anything asked for.
 */
export async function registerUser({ email, password, name, role = DEFAULT_ROLE }) {
  const existing = await User.findOne({ email });
  if (existing) throw ApiError.conflict('An account with that email already exists', 'EMAIL_TAKEN');

  const passwordHash = await hashPassword(password);
  return User.create({
    email,
    passwordHash,
    name,
    role,
    // The owner registering for the first time gets their role immediately,
    // rather than only after a restart or a second sign-in.
    ...(isSuperAdminEmail(email) ? { role: 'super_admin' } : {}),
  });
}

export async function loginUser({ email, password }) {
  // The one place that asks for the hash — it is `select: false` on the schema.
  const user = await User.findOne({ email }).select('+passwordHash');
  // Same message either way so the endpoint doesn't leak which emails exist.
  if (!user) throw ApiError.unauthorized('Incorrect email or password', 'BAD_CREDENTIALS');

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw ApiError.unauthorized('Incorrect email or password', 'BAD_CREDENTIALS');

  // Re-asserted on the way in: if the role was ever changed in the database by
  // hand, signing in puts it back to what the environment says.
  if (isSuperAdminEmail(user.email) && user.role !== 'super_admin') {
    user.role = 'super_admin';
  }

  /*
    Both stamped here, and they are not the same fact. `lastLoginAt` answers
    "when did they last type a password", which is a security question — an
    account that has not signed in for months is one to ask about.
    `lastSeenAt` answers "are they still using this", and the refresh endpoint
    keeps it current from here on.

    Folded into the save the super-admin check may already need, so signing in
    costs one write rather than two.
  */
  const now = new Date();
  user.lastLoginAt = now;
  user.lastSeenAt = now;
  await user.save();

  return user;
}
