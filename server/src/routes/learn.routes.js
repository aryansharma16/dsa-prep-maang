import { Router } from 'express';
import {
  getCatalogue,
  getTopic,
  topicContentParams,
} from '../controllers/learn.content.controller.js';
import {
  bulkMarkRead,
  bulkReadSchema,
  learnRevisionQueue,
  listLearnProgress,
  markRead,
  markSchema,
  markTopic,
  readSchema,
  reviewSchema,
  reviewTopic,
  topicParams,
} from '../controllers/learn.controller.js';
import { validate } from '../middleware/validate.js';

/**
 * Learn's routes — the reference itself, and what you have done with it.
 *
 * These were four entries inline in `routes/index.js`, each carrying its own
 * `requireModule('learn')`. Adding the content endpoints would have made six
 * repetitions of the same guard, and that file's own rule is that three or more
 * routes get a table of their own — it is the rule `/cp` and `/sql` already
 * follow.
 *
 * The move is worth more than tidiness. The gate now sits on the *mount*, which
 * is what makes a route added to this file tomorrow covered by having been added
 * at all, rather than by somebody remembering the guard. Nothing here declares
 * its own auth; the mount carries both that and the module check.
 *
 * ---------------------------------------------------------------------------
 * The two halves, and why they are one router.
 *
 * `/catalogue` and `/topics/*` are the *content* — identical for every reader,
 * cacheable, and until recently not on the server at all. `/progress` and
 * `/revision` are per-account and never cacheable.
 *
 * They share a module gate, and that is the point of putting them together:
 * hiding Learn in the admin panel now takes the prose with the pages. It could
 * not do that before — the words shipped in the bundle either way, which
 * `docs/learn.md` called "the trade". There is no trade any more.
 * ---------------------------------------------------------------------------
 */
export const learnRouter = Router();

/*
  Content first, and `/topics/:track/:topic` rather than `/:track/:topic`.

  A bare two-segment pattern would match `/learn/progress/react` too, and the
  first matching route wins — so the content endpoint would quietly answer for a
  progress URL that had one segment too few. The prefix makes that impossible
  rather than making it depend on the order of the lines below.
*/
learnRouter.get('/catalogue', getCatalogue);
learnRouter.get(
  '/topics/:track/:topic',
  validate(topicContentParams, 'params'),
  getTopic,
);

learnRouter.get('/progress', listLearnProgress);
learnRouter.get('/revision', learnRevisionQueue);

/*
  The one-time hand-over of what localStorage was holding. Two segments against
  the three of `/progress/:track/:topic`, so the two cannot shadow each other
  whichever order they are declared in.
*/
learnRouter.put('/progress/read', validate(bulkReadSchema), bulkMarkRead);

/*
  Read and scheduled, on two routes, because they are two different acts.

  The first is fired by a scroll handler and means "my eyes have been over
  this"; the second is a deliberate press with a confidence attached. Merging
  them is how a topic you skimmed ends up in Tuesday's revision queue — see the
  note on LearnProgress.
*/
learnRouter.put(
  '/progress/:track/:topic/read',
  validate(topicParams, 'params'),
  validate(readSchema),
  markRead,
);

learnRouter.put(
  '/progress/:track/:topic',
  validate(topicParams, 'params'),
  validate(markSchema),
  markTopic,
);

learnRouter.post(
  '/progress/:track/:topic/review',
  validate(topicParams, 'params'),
  validate(reviewSchema),
  reviewTopic,
);
