import mongoose from 'mongoose';
import { z } from 'zod';
import { SqlProblem } from '../../models/SqlProblem.js';
import { SqlProgress } from '../../models/SqlProgress.js';
import { createProgressHandlers, toQueueItem } from '../../services/progress.kit.js';
import { LADDER_RUNGS, nextReview } from '../../services/review.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { visibleTo } from './sql.problem.controller.js';

/**
 * Progress for the Lab — almost entirely borrowed.
 *
 * The six handlers below are the ones `progress.kit.js` already implements for
 * the roadmap and the ladder. Flagging a problem, logging a sitting, editing it
 * inside the half-hour window and answering the revision queue mean exactly the
 * same things here as there, and the rules are subtle enough — the outcome
 * table's asymmetry about `needsRevision`, the ladder advancing only on a
 * *transition* to solved — that a second copy would drift on the first fix.
 *
 * Two handlers are written here because they are genuinely this module's own:
 * a revision queue that tags its rows `sql`, and the one thing no other
 * curriculum has — a pass that the app can verify rather than take your word
 * for.
 */

const oid = (id) => new mongoose.Types.ObjectId(id);

const handlers = createProgressHandlers({
  Problem: SqlProblem,
  Progress: SqlProgress,
  visibleTo,
  notFound: 'Problem not in the bank',
});

export const {
  patchProgress,
  logAttempt,
  listAttempts,
  editAttempt,
  deleteAttempt,
  reviewProgress,
} = handlers;

const { visibleProblem, upsertProgress } = handlers;

/**
 * The query that passed.
 *
 * Bounded at the same 20,000 characters an attempt's `code` is, because it is
 * the same text stored a second time — see the note on `bestQuery` in the
 * model.
 */
export const solvedSchema = z.object({
  query: z.string().min(1).max(20000).transform((s) => s.trimEnd()),
  /** Wall-clock milliseconds the run took. Presentational; never trusted for the ladder. */
  ms: z.number().int().min(0).max(600000).default(0),
});

/**
 * POST /sql/progress/:problemId/solved — the reader's query matched.
 *
 * ---------------------------------------------------------------------------
 * The one place in this app where "solved" is not self-reported.
 *
 * Everywhere else — the roadmap, the ladder, Learn — marking something done is
 * an act of honesty, and that is fine because the person being kept honest is
 * the only person reading. Here the browser actually ran the query and diffed
 * the rows, so the app knows.
 *
 * And it still cannot *prove* it: the diff happened client-side, so this
 * endpoint is taking the browser's word that the browser's own grader was
 * satisfied. Somebody who wanted to could call it directly. That is a
 * deliberate limit, not an oversight — re-running the query server-side would
 * mean a SQL execution service, a sandbox, a rate limit and a resource budget,
 * all to defend a personal prep tracker against its own owner. The honest
 * summary is that this endpoint removes the *accident* of over-reporting
 * progress, not the possibility of lying to yourself on purpose.
 * ---------------------------------------------------------------------------
 *
 * It is not `patchProgress` with `{ status: 'solved' }` because it does two
 * further things: it stores the winning query, and it only advances the
 * revision ladder on a *transition* into solved, so passing the same problem
 * twice in one sitting does not push it two rungs down the queue.
 */
export const markSolved = asyncHandler(async (req, res) => {
  const { problemId } = req.params;
  const { query } = req.body;
  const user = oid(req.userId);

  /* Throws a 404 itself if the problem is not visible to this account. */
  const problem = await visibleProblem(problemId, req.userId);

  const existing = await SqlProgress.findOne({ user, problem: problem._id }).lean();
  const alreadySolved = existing?.status === 'solved';

  const set = { status: 'solved', bestQuery: query, needsRevision: false };

  /*
    The ladder advances on a *transition* into solved, and only then — the same
    rule `patchProgress` follows, and the reason it is restated here rather than
    inherited: passing the same problem twice in one sitting is an ordinary
    thing to do in a Lab where running the query is cheap, and each pass pushing
    it another rung down the queue would quietly schedule a problem you have
    just proved you know for sixty days' time.
  */
  if (!alreadySolved) {
    const confidence = existing?.confidence ?? 3;
    const stage = existing?.reviewStage ?? 0;
    set.solvedAt = new Date();
    set.reviewStage = stage + 1;
    set.nextReviewAt = nextReview(stage, confidence).nextReviewAt;
  }

  const row = await upsertProgress(
    { user, problem: problem._id },
    { $set: set, $setOnInsert: { user, problem: problem._id } },
  );

  res.json({
    progress: {
      status: row.status,
      solvedAt: row.solvedAt,
      nextReviewAt: row.nextReviewAt,
      bestQuery: row.bestQuery,
      /* So the workbench can say "first time" rather than "solved" again. */
      firstSolve: !alreadySolved,
    },
  });
});

/**
 * GET /sql/revision — the Lab's share of the merged queue.
 *
 * Shaped by `toQueueItem` exactly as the ladder's is, then tagged. The tag is
 * what lets `Revision.jsx` interleave four sources into one list ordered by
 * when each is due, rather than showing four queues.
 */
export const revisionQueue = asyncHandler(async (req, res) => {
  const now = new Date();
  const rows = await SqlProgress.find({
    user: oid(req.userId),
    $or: [{ needsRevision: true }, { nextReviewAt: { $ne: null, $lte: now } }],
  })
    .populate('problem')
    .sort({ nextReviewAt: 1, updatedAt: -1 })
    .lean();

  const items = rows
    /* A problem pruned by a re-seed leaves its progress row behind for a moment. */
    .filter((r) => r.problem)
    .map((r) => ({
      ...toQueueItem(r, { rungs: LADDER_RUNGS, problem: r.problem }),
      /*
        `source` is the queue's tag for which curriculum a row came from, and it
        overwrites the problem's own `source` object on the way past — so the
        destination has to be lifted out first or a linked problem arrives in the
        merged queue with nowhere to go. An `editor` problem has no URL and does
        not want one: the queue links it back into the Lab.
      */
      url: r.problem.mode === 'external' ? r.problem.source?.url || '' : '',
      source: 'sql',
    }));

  res.json({ items, count: items.length });
});
