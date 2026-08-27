import { Router } from 'express';

import {
  createCustom,
  createSchema,
  getGuide,
  getLadder,
  listPatterns,
  removeCustom,
  updateCustom,
  updateSchema,
} from '../controllers/cp/cp.problem.controller.js';
import {
  deleteAttempt,
  editAttempt,
  listAttempts,
  logAttempt,
  patchProgress,
  reviewProgress,
  revisionQueue,
} from '../controllers/cp/cp.progress.controller.js';
import {
  getProfile,
  getRatingHistory,
  handleSchema,
  setHandle,
  sync,
} from '../controllers/cp/cp.profile.controller.js';
import { getCpStats } from '../controllers/cp/cp.stats.controller.js';
import { aiLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import {
  attemptEditSchema,
  attemptIdParam,
  attemptSchema,
  patchSchema,
  reviewSchema,
} from '../services/progress.kit.js';
import { idParam } from '../utils/query.js';

/**
 * Pro Coder — the competitive-programming ladder.
 *
 * Everything here is already behind `requireAuth` and `requireModule('procoder')`
 * — see routes/index.js, where authorisation is positional and this router is
 * mounted below both gates. Every handler scopes its query to `req.userId`, so
 * there is no capability check: this is a learner surface and the only thing
 * anyone can reach is their own.
 *
 * Route order matters in exactly one place, marked below.
 */
export const cpRouter = Router();

/* ── The ladder ────────────────────────────────────────────────────────────── */

cpRouter.get('/ladder', getLadder);
cpRouter.get('/patterns', listPatterns);
cpRouter.get('/patterns/:slug/guide', getGuide);

/* ── Your own additions ────────────────────────────────────────────────────── */

cpRouter.post('/problems', validate(createSchema), createCustom);
cpRouter.patch('/problems/:id', validate(idParam, 'params'), validate(updateSchema), updateCustom);
cpRouter.delete('/problems/:id', validate(idParam, 'params'), removeCustom);

/* ── Tracking ──────────────────────────────────────────────────────────────── */

/*
  `/revision` before `/:problemId`.

  Express matches in declaration order, so with these the other way round the
  revision queue is swallowed by the progress route and "revision" is parsed as
  a problem id — which fails validation and returns a 400 that looks nothing
  like a routing bug.
*/
cpRouter.get('/revision', revisionQueue);

cpRouter.patch('/progress/:problemId', validate(patchSchema), patchProgress);
cpRouter.post('/progress/:problemId/attempt', validate(attemptSchema), logAttempt);
cpRouter.get('/progress/:problemId/attempts', listAttempts);
cpRouter.patch(
  '/progress/:problemId/attempts/:attemptId',
  validate(attemptIdParam, 'params'),
  validate(attemptEditSchema),
  editAttempt,
);
cpRouter.delete(
  '/progress/:problemId/attempts/:attemptId',
  validate(attemptIdParam, 'params'),
  deleteAttempt,
);
cpRouter.post('/progress/:problemId/review', validate(reviewSchema), reviewProgress);

/* ── Stats ─────────────────────────────────────────────────────────────────── */

cpRouter.get('/stats', getCpStats);

/* ── Codeforces identity ───────────────────────────────────────────────────── */

cpRouter.get('/profile', getProfile);
cpRouter.get('/profile/rating-history', getRatingHistory);
cpRouter.put('/profile/handle', validate(handleSchema), setHandle);

/*
  `aiLimiter` on sync, and it is not about AI.

  It is the app's "this request spends someone else's resource" limiter, and
  that is exactly what a sync is: one press pulls a multi-megabyte response from
  a public API that rate-limits per IP, which on a shared deployment means one
  person's refresh button can lock every other user out of Codeforces.

  The ten-minute per-account cooldown in sync.service.js is the real policy —
  it survives a restart and is measured per handle. This is the cheap outer
  bound that stops a loop reaching the service at all.
*/
cpRouter.post('/profile/sync', aiLimiter, sync);
