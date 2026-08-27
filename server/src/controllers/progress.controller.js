import mongoose from 'mongoose';
import { Problem } from '../models/Problem.js';
import { Progress } from '../models/Progress.js';
import { createProgressHandlers, toQueueItem } from '../services/progress.kit.js';
import { LADDER_RUNGS } from '../services/review.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const oid = (id) => new mongoose.Types.ObjectId(id);

/**
 * Tracking, for the interview roadmap.
 *
 * The handlers themselves live in services/progress.kit.js, shared with the Pro
 * Coder ladder. They were duplicated for about an hour and the reason they are
 * not is that the rules here are subtle — the half-hour edit window and its
 * two-round-trip atomicity, the outcome table's asymmetry about
 * `needsRevision`, the ladder advancing only on a *transition* to solved — and
 * two copies of a subtle rule drift on the first bug fix applied to one of them.
 *
 * What stays here is what is genuinely this module's: which collections it
 * reads, its visibility rule, and its revision queue's projection.
 */

/**
 * The visibility rule: the seeded curriculum, plus your own additions, and
 * nothing else. The same filter the roadmap and the chat context use — see
 * problem.controller.js, which states the argument at length.
 */
const visibleTo = (userId) => ({ $or: [{ owner: null }, { owner: oid(userId) }] });

const handlers = createProgressHandlers({ Problem, Progress, visibleTo });

export const {
  patchProgress,
  logAttempt,
  listAttempts,
  editAttempt,
  deleteAttempt,
  reviewProgress,
} = handlers;

export {
  attemptEditSchema,
  attemptIdParam,
  attemptSchema,
  patchSchema,
  reviewSchema,
} from '../services/progress.kit.js';

/**
 * GET /api/progress/revision
 * Anything explicitly flagged for revision, or whose spaced-repetition date has
 * come due.
 */
export const revisionQueue = asyncHandler(async (req, res) => {
  const now = new Date();
  const rows = await Progress.find({
    user: oid(req.userId),
    $or: [{ needsRevision: true }, { nextReviewAt: { $ne: null, $lte: now } }],
  })
    .populate('problem', '-descriptionHtml -descriptionFetchedAt')
    .sort({ nextReviewAt: 1, updatedAt: -1 })
    .lean();

  const items = rows
    .filter((r) => r.problem)
    .map((r) => toQueueItem(r, { rungs: LADDER_RUNGS, problem: r.problem }));

  res.json({ items, count: items.length });
});
