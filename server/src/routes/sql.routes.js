import { Router } from 'express';
import {
  getBank,
  getProblem,
  getSqlStats,
  idParam,
} from '../controllers/sql/sql.problem.controller.js';
import {
  deleteAttempt,
  editAttempt,
  listAttempts,
  logAttempt,
  markSolved,
  patchProgress,
  reviewProgress,
  revisionQueue,
  solvedSchema,
} from '../controllers/sql/sql.progress.controller.js';
import {
  attemptEditSchema,
  attemptIdParam,
  attemptSchema,
  patchSchema,
  reviewSchema,
} from '../services/progress.kit.js';
import { validate } from '../middleware/validate.js';

/**
 * The SQL Lab's routes.
 *
 * A mounted sub-router rather than inline entries in `routes/index.js`, by the
 * rule that file states: three or more routes get their own table. There are
 * ten.
 *
 * Nothing here is public and nothing here declares its own auth. The mount in
 * `routes/index.js` carries `requireModule('sql')`, which is what makes a route
 * added to this file tomorrow covered by having been added at all.
 *
 * There is no endpoint that runs SQL, and there never should be. The engine is
 * in the reader's browser; the server stores what happened.
 */
export const sqlRouter = Router();

/* ------------------------------------------------------------------ reading */

sqlRouter.get('/bank', getBank);
sqlRouter.get('/stats', getSqlStats);

/*
  Literal segments before the `/:id` pattern, or Express matches "stats" as an
  id and answers a validation error that says nothing about routing. The same
  ordering rule `cp.routes.js` and `task.routes.js` both state.
*/
sqlRouter.get('/problems/:id', validate(idParam, 'params'), getProblem);

/* --------------------------------------------------------------- tracking */

/*
  `/revision` above `/progress/:problemId` for that same reason — see the note
  at cp.routes.js:68.
*/
sqlRouter.get('/revision', revisionQueue);

sqlRouter.patch('/progress/:problemId', validate(patchSchema), patchProgress);

/**
 * The verified pass.
 *
 * Its own route rather than a `PATCH … { status: 'solved' }`, because it does
 * two things that patch does not: it stores the query that worked, and it
 * reports whether this was the first solve so the workbench can say so.
 */
sqlRouter.post('/progress/:problemId/solved', validate(solvedSchema), markSolved);

sqlRouter.post('/progress/:problemId/attempt', validate(attemptSchema), logAttempt);
sqlRouter.get('/progress/:problemId/attempts', listAttempts);
sqlRouter.patch(
  '/progress/:problemId/attempts/:attemptId',
  validate(attemptIdParam, 'params'),
  validate(attemptEditSchema),
  editAttempt,
);
sqlRouter.delete(
  '/progress/:problemId/attempts/:attemptId',
  validate(attemptIdParam, 'params'),
  deleteAttempt,
);

sqlRouter.post('/progress/:problemId/review', validate(reviewSchema), reviewProgress);
