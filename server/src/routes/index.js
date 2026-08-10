import { Router } from 'express';
import { getLogo } from '../controllers/company.controller.js';
import { getGuide } from '../controllers/guide.controller.js';
import {
  getLoginMotivation,
  getMotivation,
  surfaceQuery,
} from '../controllers/motivation.controller.js';
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
import { requireModule } from '../middleware/requireModule.js';
import { validate } from '../middleware/validate.js';
import { aiEnabled } from '../services/gemini.service.js';
import { uploadsEnabled } from '../services/media.service.js';
import { anyProviderConfigured } from '../services/ai/registry.js';
import { adminRouter } from './admin.routes.js';
import { authRouter } from './auth.routes.js';
import { chatRouter } from './chat.routes.js';
import { noteRouter, sharedNoteRouter } from './note.routes.js';

export const router = Router();

// `uploads` and `ai` are here because they are configuration, not code: when a
// picture will not save, the first question is whether this deployment has the
// keys at all. Same question, same answer, for a motivation line that never
// turns personal.
//
// `chat` is a separate flag from `ai` because they answer different questions.
// `ai` is "is there a Gemini key", which is what the motivation line and the
// admin drafting tool depend on; `chat` is "is there any provider at all",
// which can be true with no Gemini key and false with one.
router.get('/health', (_req, res) =>
  res.json({
    ok: true,
    uptime: process.uptime(),
    uploads: uploadsEnabled(),
    ai: aiEnabled(),
    chat: anyProviderConfigured(),
  }),
);
router.use('/auth', authRouter);

/**
 * Public on purpose. The browser loads these through an <img>, which cannot
 * replay a request after a silent token refresh — behind requireAuth every logo
 * would break fifteen minutes into a session. Nothing here is private: it is a
 * cache of publicly reachable brand icons keyed by company name.
 */
router.get('/companies/:slug/logo', getLogo);

/**
 * Public on purpose, and narrowly so. The sign-in page shows a line, and the
 * only visitor who can see that page is by definition not signed in.
 *
 * It leaks nothing: the picker is handed no signals at all, and every trigger
 * except `always` tests something about a person — so a visitor we know nothing
 * about can only ever match the generic pool. That is a property of the
 * predicates in config/motivationTriggers.js, not a filter written here, which
 * is why adding a trigger cannot accidentally widen this.
 */
router.get('/motivation/login', getLoginMotivation);

/**
 * Public because sharing a note is the feature. A link sent to someone who has
 * no account has to open, or "public" means nothing.
 *
 * It is narrow in the way the two routes above are. Only notes their author
 * marked public or unlisted *and* published are reachable, and the check lives
 * in `assertCanRead` and `buildFilter` rather than in a filter written here — so
 * the guarantee is a property of the notes service, not of this line's position
 * in this file. A private note 404s here exactly as it does for a signed-in
 * stranger, and the share id is 11 random characters, so it cannot be walked.
 *
 * `requireModule` applies here too, and it has to. Notes being hidden means the
 * module has not shipped, and a share link is the one part of it that reaches
 * people who never signed in — leaving this open would publish an unfinished
 * feature to exactly the audience it was withheld from. The super admin's own
 * links still open for them: they hold `module:preview`.
 */
router.use('/notes/public', requireModule('notes'), sharedNoteRouter);

// Everything below needs a session.
router.use(requireAuth);

/*
  Immediately below the gate, deliberately. This file authorises by position —
  a route added above `router.use(requireAuth)` is public with nothing in the
  file's shape to say so — and the admin surface is the last thing that should
  end up on the wrong side of it. Its own capability checks are inside
  adminRouter.
*/
router.use('/admin', adminRouter);

/*
  `requireModule` guards the four learner modules that can be taken off the side
  menu while they are being built. It sits on the mount rather than inside each
  router, so a route added to notes or chat tomorrow is covered by having been
  added there at all — see config/modules.js.
*/
router.use('/chat', requireModule('chat'), chatRouter);

router.get('/patterns', listPatterns);
router.get('/patterns/:slug/guide', getGuide);

router.get('/problems', listGrouped);
router.post('/problems/lookup', validate(lookupSchema), lookup);
router.post('/problems', validate(createSchema), createCustom);
router.get('/problems/:slug/description', getDescription);
router.delete('/problems/:id', removeCustom);

router.get('/progress/revision', requireModule('revision'), revisionQueue);
router.patch('/progress/:problemId', validate(patchSchema), patchProgress);
router.post('/progress/:problemId/attempt', validate(attemptSchema), logAttempt);

router.get('/stats', requireModule('stats'), getStats);

router.use('/notes', requireModule('notes'), noteRouter);

router.get('/motivation', validate(surfaceQuery, 'query'), getMotivation);
