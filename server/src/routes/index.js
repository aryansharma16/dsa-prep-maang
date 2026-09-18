import { Router } from 'express';
import { getLogo } from '../controllers/company.controller.js';
import { getGuide } from '../controllers/guide.controller.js';
import { getPublicModules } from '../controllers/modules.controller.js';
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
  updateCustom,
  updateSchema as problemUpdateSchema,
} from '../controllers/problem.controller.js';
import {
  attemptEditSchema,
  attemptIdParam,
  attemptSchema,
  deleteAttempt,
  editAttempt,
  listAttempts,
  logAttempt,
  patchProgress,
  patchSchema,
  reviewProgress,
  reviewSchema,
  revisionQueue,
} from '../controllers/progress.controller.js';
import {
  getPlaybook,
  patchPlaybook,
  patchSchema as playbookPatchSchema,
} from '../controllers/playbook.controller.js';
import {
  drillRunSchema,
  getPracticeStats,
  mockRunSchema,
  saveDrillRun,
  saveMockRun,
} from '../controllers/practice.controller.js';
import { getStats } from '../controllers/stats.controller.js';
import {
  clearView,
  getView,
  saveView,
  saveViewSchema,
  scopeSchema,
} from '../controllers/view.controller.js';
import { writeLimiter } from '../middleware/rateLimit.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireModule } from '../middleware/requireModule.js';
import { validate } from '../middleware/validate.js';
import { aiEnabled } from '../services/gemini.service.js';
import { uploadsEnabled } from '../services/media.service.js';
import { anyProviderConfigured } from '../services/ai/registry.js';
import { adminRouter } from './admin.routes.js';
import { applicationRouter } from './application.routes.js';
import { authRouter } from './auth.routes.js';
import { chatRouter } from './chat.routes.js';
import { cpRouter } from './cp.routes.js';
import { designRouter } from './design.routes.js';
import { feedbackRouter } from './feedback.routes.js';
import { learnRouter } from './learn.routes.js';
import { sqlRouter } from './sql.routes.js';
import { taskRouter } from './task.routes.js';

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
 * Public, and the same answer an ordinary learner gets: every module except the
 * hidden ones. `/docs` is mounted on both sides of the auth branch and gates the
 * sections it writes about on this list, so a signed-out reader is shown exactly
 * the modules that are switched on. A module still in development is missing
 * from it, which is what keeps it safe to leave open — see
 * controllers/modules.controller.js.
 */
router.get('/modules', getPublicModules);

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
  System Design, above `writeLimiter` on purpose — the one module that is.

  Its autosave is a steady stream of small saves for as long as someone draws,
  and under the limiter below that stream runs out of budget in about two
  minutes. The router carries its own sync limiter for saves and re-applies
  `writeLimiter` to everything else, so nothing in it is uncounted — see
  routes/design.routes.js. Below `requireAuth` and behind its module gate like
  every learner module.
*/
router.use('/design', requireModule('design'), designRouter);

/*
  Positional, like the gate above it, and placed here for two reasons.

  Below `/admin`, so staff are not counted. The panel writes in bursts by design
  — importing content, answering a queue, editing a guide section by section —
  and a learner-shaped ceiling would fire on the ordinary use of a surface that
  is already behind a role and a capability check. They are still under
  `apiLimiter`, which is what actually bounds a runaway client.

  Above everything else, so a route added anywhere below this line is covered by
  having been added at all. It skips GET and HEAD itself, so it costs reads
  nothing — see middleware/rateLimit.js.
*/
router.use(writeLimiter);

/*
  `requireModule` guards the learner modules that can be taken off the side
  menu while they are being built. It sits on the mount rather than inside each
  router, so a route added to chat or tasks tomorrow is covered by having been
  added there at all — see config/modules.js.
*/
router.use('/chat', requireModule('chat'), chatRouter);

/*
  Pro Coder — the competitive-programming ladder, with its own collections,
  its own progress rows and its own Codeforces sync.

  One mount, like chat and tasks, so a route added to cp.routes.js tomorrow is
  behind the module gate by having been added there at all.
*/
router.use('/cp', requireModule('procoder'), cpRouter);

/*
  The SQL Lab. Mounted the same way and for the same reason: ten routes is a
  table of its own, and the module gate belongs on the mount so a route added
  to that file tomorrow is covered by having been added.

  Nothing behind it executes SQL — the engine runs in the reader's browser, so
  this is a store of what happened rather than a place queries are sent.
*/
router.use('/sql', requireModule('sql'), sqlRouter);

router.get('/patterns', listPatterns);
router.get('/patterns/:slug/guide', getGuide);

router.get('/problems', listGrouped);
router.post('/problems/lookup', validate(lookupSchema), lookup);
router.post('/problems', validate(createSchema), createCustom);
router.get('/problems/:slug/description', getDescription);
router.patch('/problems/:id', validate(problemUpdateSchema), updateCustom);
router.delete('/problems/:id', removeCustom);

router.get('/progress/revision', requireModule('revision'), revisionQueue);
router.post(
  '/progress/:problemId/review',
  requireModule('revision'),
  validate(reviewSchema),
  reviewProgress,
);
router.patch('/progress/:problemId', validate(patchSchema), patchProgress);
router.post('/progress/:problemId/attempt', validate(attemptSchema), logAttempt);
router.get('/progress/:problemId/attempts', listAttempts);
router.patch(
  '/progress/:problemId/attempts/:attemptId',
  validate(attemptIdParam, 'params'),
  validate(attemptEditSchema),
  editAttempt,
);
router.delete(
  '/progress/:problemId/attempts/:attemptId',
  validate(attemptIdParam, 'params'),
  deleteAttempt,
);

router.get('/stats', requireModule('stats'), getStats);

/*
  Learn — the reference itself, and what you have done with it.

  One mount, like chat, cp and sql, and it earned one the moment the content
  moved into Mongo: four routes became six, all repeating the same guard. The
  gate belongs here so a route added to learn.routes.js tomorrow is behind it by
  having been added at all.

  Worth noting what this now gates. Learn's prose used to ship in the client
  bundle, so hiding the module took away the pages and left the words — the
  README called that the trade. The words come from here now, so hiding Learn
  hides Learn.
*/
router.use('/learn', requireModule('learn'), learnRouter);

/*
  Practice — the pattern drill and the mock harness.

  Nothing here reads or writes a progress row. A drill answer is a recognition
  and a mock is a session with a shared clock; neither is an attempt, and the one
  record that means "I sat down with this problem" must not fill up with them.
*/
router.post(
  '/practice/drill-runs',
  requireModule('practice'),
  validate(drillRunSchema),
  saveDrillRun,
);
router.post(
  '/practice/mock-runs',
  requireModule('practice'),
  validate(mockRunSchema),
  saveMockRun,
);
router.get('/practice/stats', requireModule('practice'), getPracticeStats);

/*
  The owner's prep plan. Behind the same middleware as every other module, which
  for an owner module means the `playbook` capability and a 404 for everyone
  else — see middleware/requireModule.js.

  Two routes rather than a mounted router: there are two of them, they will stay
  two, and a sub-router for that is a file to open on the way to reading four
  lines.
*/
router.get('/playbook', requireModule('playbook'), getPlaybook);
router.patch(
  '/playbook',
  requireModule('playbook'),
  validate(playbookPatchSchema),
  patchPlaybook,
);

/*
  How a screen is set up for the caller — today, the filters they left on.

  Not behind `requireModule`, on purpose. The scope is a string the client picks,
  so gating this would mean mapping scopes to modules here — a second copy of a
  list that already lives in config/modules.js, drifting the first time somebody
  adds a scope. There is nothing to protect either way: a saved view holds the
  filter names the caller themselves sent, so a hidden module's view leaks
  nothing about the module. The screen it belongs to is still gated, and a view
  for a screen you cannot open is a document nobody reads.
*/
router.get('/views/:scope', validate(scopeSchema, 'params'), getView);
router.put(
  '/views/:scope',
  validate(scopeSchema, 'params'),
  validate(saveViewSchema),
  saveView,
);
router.delete('/views/:scope', validate(scopeSchema, 'params'), clearView);

/*
  The board, and everything on it. Behind the same gate as chat.

  Nothing here has a public surface — a task has no share link and no second
  reader — so there is only one mount to remember.
*/
router.use('/tasks', requireModule('tasks'), taskRouter);

/*
  Under the same module gate as chat and tasks, so hiding Feedback takes the form
  with the nav item rather than leaving a page that submits into a 404.

  The queue staff work from is *not* gated, and cannot be from here — it hangs off
  adminRouter, mounted above every requireModule in this file. That is deliberate:
  hiding the form stops new submissions, it does not empty a collection that
  already has people waiting in it.
*/
router.use('/feedback', requireModule('feedback'), feedbackRouter);

/*
  The job hunt. Behind the same gate as chat and tasks, and one mount for the
  same reason — a route added to application.routes.js tomorrow is covered by
  having been added there at all.

  Worth gating properly rather than by habit: this is the one module holding
  names and phone numbers of people who are not the account holder, so a hidden
  door here would leave a referrer's contact details answering anyone who kept a
  bookmark.
*/
router.use('/applications', requireModule('applications'), applicationRouter);

router.get('/motivation', validate(surfaceQuery, 'query'), getMotivation);
