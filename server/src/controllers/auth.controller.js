import { z } from 'zod';
import { User, publicUser } from '../models/User.js';
import { loginUser } from '../services/auth.service.js';
import { requestReset, resetPassword } from '../services/password.service.js';
import { requestAccess } from '../services/signup.service.js';
import { moduleAccess } from '../services/settings.service.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  REFRESH_COOKIE,
  clearAuthCookies,
  setAuthCookies,
  verifyRefreshToken,
} from '../utils/tokens.js';

/**
 * The five fields, and the only five.
 *
 * Asking a stranger for more than this before they are let in is a product
 * decision, not a validation change — the form, the model and this schema all
 * say so in the same words so that adding a sixth has to be done on purpose in
 * three places.
 *
 * `mobile` is checked for shape rather than for being a real number: this app
 * sends nothing to it, it is there so the owner can tell two applicants apart
 * and reach one if they want to, and a strict E.164 rule would refuse half the
 * ways people write their own number down.
 */
export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required').max(60),
  mobile: z
    .string()
    .trim()
    .min(7, 'That does not look like a phone number')
    .max(20)
    .regex(/^[+\d][\d\s()-]*$/, 'Digits, spaces, brackets and a leading + only'),
  reason: z.string().trim().max(300).optional().default(''),
});

export const forgotSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

export const resetSchema = z.object({
  // 32 random bytes as base64url is 43 characters. Bounded so a megabyte of
  // "token" is refused by the validator rather than hashed.
  token: z.string().min(20).max(200),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
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

/**
 * Asks for an account. Does not create one.
 *
 * The two responses are different shapes on purpose, and the client branches on
 * which it got. A 201 with a session is the pinned owner registering on a fresh
 * deployment — the one address that cannot queue behind an approver, because it
 * *is* the approver. Everyone else gets a 202: accepted, nothing exists yet,
 * no cookies set.
 *
 * 202 rather than 201 because the status code is the honest one — the request
 * has been accepted for processing and the processing is a person reading it.
 */
export const register = asyncHandler(async (req, res) => {
  const { user, request } = await requestAccess(req.body, req);

  if (user) {
    setAuthCookies(res, user);
    res.status(201).json(await session(user));
    return;
  }

  res.status(202).json({
    pending: true,
    email: request.email,
    message: 'Your request is with the owner. You will get an email when it is reviewed.',
  });
});

/**
 * Asks for a reset link. Answers the same sentence whether or not the address
 * has an account — see services/password.service.js for why that matters.
 */
export const forgotPassword = asyncHandler(async (req, res) => {
  await requestReset(req.body.email);
  res.json({
    ok: true,
    message: 'If that email has an account, a link to reset its password is on its way.',
  });
});

/**
 * Sets a new password from a link. Does not sign in: the person has to type the
 * new password once more on the login page, which is both a check that they
 * know what they just set and the point at which every old session is gone.
 */
export const resetPasswordWithToken = asyncHandler(async (req, res) => {
  await resetPassword(req.body.token, req.body.password);
  clearAuthCookies(res);
  res.json({ ok: true, message: 'Password changed. Sign in with your new password.' });
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
