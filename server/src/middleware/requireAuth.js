import { ApiError } from '../utils/ApiError.js';
import { ACCESS_COOKIE, verifyAccessToken } from '../utils/tokens.js';

export function requireAuth(req, _res, next) {
  const token = req.cookies?.[ACCESS_COOKIE];
  if (!token) return next(ApiError.unauthorized('Not authenticated', 'NO_TOKEN'));

  try {
    const payload = verifyAccessToken(token);
    req.userId = payload.sub;
    next();
  } catch (err) {
    // The client refresh interceptor keys off TOKEN_EXPIRED to retry once.
    const code = err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'BAD_TOKEN';
    next(ApiError.unauthorized('Session expired', code));
  }
}
