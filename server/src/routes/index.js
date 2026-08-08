import { Router } from 'express';
import {
  createCustom,
  createSchema,
  getDescription,
  listGrouped,
  listPatterns,
  lookup,
  lookupSchema,
  removeCustom,
} from '../controllers/problem.controller.js';
import {
  attemptSchema,
  logAttempt,
  patchProgress,
  patchSchema,
  revisionQueue,
} from '../controllers/progress.controller.js';
import { getStats } from '../controllers/stats.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validate } from '../middleware/validate.js';
import { authRouter } from './auth.routes.js';

export const router = Router();

router.get('/health', (_req, res) => res.json({ ok: true, uptime: process.uptime() }));
router.use('/auth', authRouter);

// Everything below needs a session.
router.use(requireAuth);

router.get('/patterns', listPatterns);

router.get('/problems', listGrouped);
router.post('/problems/lookup', validate(lookupSchema), lookup);
router.post('/problems', validate(createSchema), createCustom);
router.get('/problems/:slug/description', getDescription);
router.delete('/problems/:id', removeCustom);

router.get('/progress/revision', revisionQueue);
router.patch('/progress/:problemId', validate(patchSchema), patchProgress);
router.post('/progress/:problemId/attempt', validate(attemptSchema), logAttempt);

router.get('/stats', getStats);
