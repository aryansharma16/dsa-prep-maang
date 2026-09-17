import { Router } from 'express';
import {
  forgotPassword,
  forgotSchema,
  login,
  loginSchema,
  logout,
  me,
  refresh,
  register,
  registerSchema,
  resetPasswordWithToken,
  resetSchema,
} from '../controllers/auth.controller.js';
import {
  rateApp,
  ratingSchema,
  removeAvatar,
  selfUpdateSchema,
  updateMe,
  uploadAvatar,
} from '../controllers/user.controller.js';
import {
  loginLimiter,
  passwordResetLimiter,
  registerLimiter,
  uploadLimiter,
} from '../middleware/rateLimit.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { singleImage } from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';

export const authRouter = Router();

/*
  The two limiters sit ahead of their validators, so a request that never had a
  well-formed body still spends budget. Someone walking a password list has no
  reason to send valid-looking payloads once they learn that malformed ones are
  free.

  `/refresh` and `/logout` are left to the global limiter on purpose. Refresh is
  not guessable — it needs a signed cookie this server minted — and the client
  fires it automatically whenever a 15-minute access token expires mid-session,
  so a strict per-address limit here would sign out everyone on a shared network
  rather than stop anything.
*/
authRouter.post('/register', registerLimiter, validate(registerSchema), register);
authRouter.post('/login', loginLimiter, validate(loginSchema), login);
authRouter.post('/forgot-password', passwordResetLimiter, validate(forgotSchema), forgotPassword);
authRouter.post('/reset-password', passwordResetLimiter, validate(resetSchema), resetPasswordWithToken);
authRouter.post('/refresh', refresh);
authRouter.post('/logout', logout);
authRouter.get('/me', requireAuth, me);
// Your own details. Needs no capability — it can only reach your own document.
authRouter.patch('/me', requireAuth, validate(selfUpdateSchema), updateMe);

/*
  Your own rating. Not under /feedback, even though it belongs to that feature:
  the star picker is in the sign-out dialog, which exists whether or not the
  Feedback module is switched on.
*/
authRouter.put('/me/rating', requireAuth, validate(ratingSchema), rateApp);

/*
  The avatar hangs off /me because that is the resource it belongs to. Auth comes
  first, the rate limit second and multipart parsing last, so neither a stranger
  nor someone already over their upload budget can push five megabytes into this
  process's heap before being turned away. The limiter also needs `req.userId`,
  which only exists after requireAuth has run.
*/
authRouter.post('/me/avatar', requireAuth, uploadLimiter, singleImage('avatar', 5), uploadAvatar);
authRouter.delete('/me/avatar', requireAuth, removeAvatar);
