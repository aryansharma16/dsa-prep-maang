import { Router } from 'express';
import { getLogo } from '../controllers/company.controller.js';
import { getGuide } from '../controllers/guide.controller.js';
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
import { uploadsEnabled } from '../services/media.service.js';
import { adminRouter } from './admin.routes.js';
import { authRouter } from './auth.routes.js';

export const router = Router();

// `uploads` is here because it is configuration, not code: when a picture will
// not save, the first question is whether this deployment has the keys at all.
router.get('/health', (_req, res) =>
  res.json({ ok: true, uptime: process.uptime(), uploads: uploadsEnabled() }),
);
router.use('/auth', authRouter);

/**
 * Public on purpose. The browser loads these through an <img>, which cannot
 * replay a request after a silent token refresh — behind requireAuth every logo
 * would break fifteen minutes into a session. Nothing here is private: it is a
 * cache of publicly reachable brand icons keyed by company name.
 */
router.get('/companies/:slug/logo', getLogo);

// Everything below needs a session.
router.use(requireAuth);

/*
  Immediately below the gate, deliberately. This file authorises by position —
  a route added above line 45 is public with nothing in the file's shape to say
  so — and the admin surface is the last thing that should end up on the wrong
  side of it. Its own capability checks are inside adminRouter.
*/
router.use('/admin', adminRouter);

router.get('/patterns', listPatterns);
router.get('/patterns/:slug/guide', getGuide);

router.get('/problems', listGrouped);
router.post('/problems/lookup', validate(lookupSchema), lookup);
router.post('/problems', validate(createSchema), createCustom);
router.get('/problems/:slug/description', getDescription);
router.delete('/problems/:id', removeCustom);

router.get('/progress/revision', revisionQueue);
router.patch('/progress/:problemId', validate(patchSchema), patchProgress);
router.post('/progress/:problemId/attempt', validate(attemptSchema), logAttempt);

router.get('/stats', getStats);
