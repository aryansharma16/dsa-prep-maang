import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const ACCESS_COOKIE = 'accessToken';
export const REFRESH_COOKIE = 'refreshToken';

const FIFTEEN_MIN = 15 * 60 * 1000;
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

/**
 * Tokens carry the account's `tokenVersion` alongside its id.
 *
 * Refreshing compares the two and refuses a token minted before the version was
 * bumped — that is what makes "sign out everywhere" reach devices this process
 * has never seen. It is checked at refresh rather than on every request, so
 * requireAuth stays a pure signature check with no database read. The cost is
 * that a revoked session survives until its access token expires; see
 * middleware/requireAuth.js.
 */
export function signAccessToken(user) {
  return jwt.sign(
    { sub: String(user._id ?? user), tv: user.tokenVersion ?? 0 },
    env.jwt.accessSecret,
    { expiresIn: env.jwt.accessTtl },
  );
}

export function signRefreshToken(user) {
  return jwt.sign(
    { sub: String(user._id ?? user), tv: user.tokenVersion ?? 0 },
    env.jwt.refreshSecret,
    { expiresIn: env.jwt.refreshTtl },
  );
}

export const verifyAccessToken = (token) => jwt.verify(token, env.jwt.accessSecret);
export const verifyRefreshToken = (token) => jwt.verify(token, env.jwt.refreshSecret);

// The client is on Vercel and the API on Render — different origins — so prod
// cookies must be SameSite=None; Secure. Locally that would break over http,
// hence the split.
function cookieOptions(maxAge) {
  return {
    httpOnly: true,
    secure: env.isProd,
    sameSite: env.isProd ? 'none' : 'lax',
    maxAge,
    path: '/',
  };
}

/** Takes the user document, not an id — the tokens need its `tokenVersion`. */
export function setAuthCookies(res, user) {
  res.cookie(ACCESS_COOKIE, signAccessToken(user), cookieOptions(FIFTEEN_MIN));
  res.cookie(REFRESH_COOKIE, signRefreshToken(user), cookieOptions(THIRTY_DAYS));
}

export function clearAuthCookies(res) {
  const opts = { ...cookieOptions(0) };
  delete opts.maxAge;
  res.clearCookie(ACCESS_COOKIE, opts);
  res.clearCookie(REFRESH_COOKIE, opts);
}
