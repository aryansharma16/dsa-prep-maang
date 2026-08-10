import { z } from 'zod';
import { User, publicUser } from '../models/User.js';
import { loginUser, registerUser } from '../services/auth.service.js';
import { moduleAccess } from '../services/settings.service.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  REFRESH_COOKIE,
  clearAuthCookies,
  setAuthCookies,
  verifyRefreshToken,
} from '../utils/tokens.js';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required').max(60),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * Everything the client needs to draw the app for this person.
 *
 * `modules` travels with the user rather than through an endpoint of its own so
 * the two arrive together and cannot disagree: there is no frame in which the
 * side menu has been drawn from a stale module list against a fresh account, or
 * the reverse. It is on all four session responses for the same reason — a sign
 * in has to be able to change the menu, because which modules you can see
 * depends on who you now are.
 *
 * A rendering convenience, exactly like `caps`. The routes are locked
 * independently in `requireModule`.
 */
const session = async (user) => ({
  user: publicUser(user),
  modules: await moduleAccess(user.role),
});

export const register = asyncHandler(async (req, res) => {
  const user = await registerUser(req.body);
  setAuthCookies(res, user);
  res.status(201).json(await session(user));
});

export const login = asyncHandler(async (req, res) => {
  const user = await loginUser(req.body);
  setAuthCookies(res, user);
  res.json(await session(user));
});

export const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token) throw ApiError.unauthorized('No refresh token', 'NO_REFRESH');

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    clearAuthCookies(res);
    throw ApiError.unauthorized('Refresh token expired, please sign in again', 'REFRESH_EXPIRED');
  }

  const user = await User.findById(payload.sub);
  if (!user) {
    clearAuthCookies(res);
    throw ApiError.unauthorized('Account no longer exists', 'NO_USER');
  }

  /*
    Where a revoked session actually dies. An admin bumping tokenVersion — by
    resetting a password or forcing a sign-out — leaves every token already in
    the wild carrying the old number, and this is the check that notices. It
    lives here rather than in requireAuth so the common path stays a signature
    check with no database read; the cost is that the old access token keeps
    working until it expires.
  */
  if ((payload.tv ?? 0) !== user.tokenVersion) {
    clearAuthCookies(res);
    throw ApiError.unauthorized('Session ended, please sign in again', 'REFRESH_EXPIRED');
  }

  /*
    The one honest "last active" signal this app has. A tab left open refreshes
    every fifteen minutes and a closed one stops, so this decays on its own
    without anything having to notice a sign-out that never happens.

    `updateOne` rather than `user.save()`: nothing else on the document changed,
    and a full save here would race the profile edit someone might be making in
    another tab.
  */
  await User.updateOne({ _id: user._id }, { $set: { lastSeenAt: new Date() } });

  setAuthCookies(res, user);
  res.json(await session(user));
});

export const logout = asyncHandler(async (_req, res) => {
  clearAuthCookies(res);
  res.json({ ok: true });
});

export const me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) throw ApiError.unauthorized('Account no longer exists', 'NO_USER');
  res.json(await session(user));
});
