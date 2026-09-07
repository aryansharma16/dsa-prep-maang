import mongoose from 'mongoose';
import { Problem } from '../models/Problem.js';
import { Progress } from '../models/Progress.js';
import {
  createProgressHandlers,
  findUpcoming,
  toQueueItem,
  toUpcomingItem,
} from '../services/progress.kit.js';
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

/** The problem fields a queue row needs — the description is a page, not a row. */
const QUEUE_PROBLEM = '-descriptionHtml -descriptionFetchedAt';

/**
 * GET /api/progress/revision
 *
 * Two lists, not one. `items` is the work — anything flagged by hand or whose
 * spaced-repetition date has come due. `upcoming` is the next thirty rows that
 * are scheduled and *not* yet due, which the queue never used to say anything
 * about: the schedule existed only as a date on a row you could not see until
 * the morning it fired, so "when does this come back" and "what does next week
 * look like" were unanswerable from the page whose whole job is the schedule.
 */
export const revisionQueue = asyncHandler(async (req, res) => {
  const now = new Date();
  const user = oid(req.userId);

  const [rows, ahead] = await Promise.all([
    Progress.find({
      user,
      $or: [{ needsRevision: true }, { nextReviewAt: { $ne: null, $lte: now } }],
    })
      .populate('problem', QUEUE_PROBLEM)
      .sort({ nextReviewAt: 1, updatedAt: -1 })
      .lean(),
    findUpcoming(Progress, { user, now, populate: ['problem', QUEUE_PROBLEM] }),
  ]);

  const items = rows
    .filter((r) => r.problem)
    .map((r) => toQueueItem(r, { rungs: LADDER_RUNGS, problem: r.problem, now }));

  const upcoming = ahead
    .filter((r) => r.problem)
    .map((r) => toUpcomingItem(r, { rungs: LADDER_RUNGS, problem: r.problem }));

  res.json({ items, count: items.length, upcoming });
});
