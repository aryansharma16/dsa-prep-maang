import { Router } from 'express';
import {
  login,
  loginSchema,
  logout,
  me,
  refresh,
  register,
  registerSchema,
} from '../controllers/auth.controller.js';
import {
  removeAvatar,
  selfUpdateSchema,
  updateMe,
  uploadAvatar,
} from '../controllers/user.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { singleImage } from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';

export const authRouter = Router();

authRouter.post('/register', validate(registerSchema), register);
authRouter.post('/login', validate(loginSchema), login);
authRouter.post('/refresh', refresh);
authRouter.post('/logout', logout);
authRouter.get('/me', requireAuth, me);
// Your own details. Needs no capability — it can only reach your own document.
authRouter.patch('/me', requireAuth, validate(selfUpdateSchema), updateMe);

/*
  The avatar hangs off /me because that is the resource it belongs to. Auth
  comes first and multipart parsing second, so an unauthenticated request is
  turned away before anyone can push five megabytes into this process's heap.
*/
authRouter.post('/me/avatar', requireAuth, singleImage('avatar', 5), uploadAvatar);
authRouter.delete('/me/avatar', requireAuth, removeAvatar);
