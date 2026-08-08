import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const ACCESS_COOKIE = 'accessToken';
export const REFRESH_COOKIE = 'refreshToken';

const FIFTEEN_MIN = 15 * 60 * 1000;
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

export function signAccessToken(userId) {
  return jwt.sign({ sub: String(userId) }, env.jwt.accessSecret, {
    expiresIn: env.jwt.accessTtl,
  });
}

export function signRefreshToken(userId) {
  return jwt.sign({ sub: String(userId) }, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshTtl,
  });
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

export function setAuthCookies(res, userId) {
  res.cookie(ACCESS_COOKIE, signAccessToken(userId), cookieOptions(FIFTEEN_MIN));
  res.cookie(REFRESH_COOKIE, signRefreshToken(userId), cookieOptions(THIRTY_DAYS));
}

export function clearAuthCookies(res) {
  const opts = { ...cookieOptions(0) };
  delete opts.maxAge;
  res.clearCookie(ACCESS_COOKIE, opts);
  res.clearCookie(REFRESH_COOKIE, opts);
}
