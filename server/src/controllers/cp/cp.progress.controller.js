import mongoose from 'mongoose';
import { CPProblem } from '../../models/CPProblem.js';
import { CPProgress } from '../../models/CPProgress.js';
import { createProgressHandlers, toQueueItem } from '../../services/progress.kit.js';
import { LADDER_RUNGS } from '../../services/review.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { visibleTo } from './cp.problem.controller.js';

const oid = (id) => new mongoose.Types.ObjectId(id);

/**
 * Tracking, for the CP ladder.
 *
 * Thin by construction: the handlers come from services/progress.kit.js, which
 * the interview roadmap uses too. Flags, notes, attempt logs and the spaced
 * repetition ladder mean the same thing on both sides of the app, and the one
 * thing that must not happen is the two developing different opinions about the
 * half-hour edit window or when the ladder advances.
 */
const handlers = createProgressHandlers({
  Problem: CPProblem,
  Progress: CPProgress,
  visibleTo,
  notFound: 'Problem not on your ladder',
});

export const {
  patchProgress,
  logAttempt,
  listAttempts,
  editAttempt,
  deleteAttempt,
  reviewProgress,
} = handlers;

/**
 * GET /api/cp/revision
 *
 * The CP half of the revision queue. Its own endpoint rather than a `source`
 * parameter on the roadmap's, because the two read different collections and a
 * shared route would have to branch on a query string before it could even
 * decide which model to populate from. The client merges the two lists — see
 * the Revision page.
 */
export const revisionQueue = asyncHandler(async (req, res) => {
  const now = new Date();
  const rows = await CPProgress.find({
    user: oid(req.userId),
    $or: [{ needsRevision: true }, { nextReviewAt: { $ne: null, $lte: now } }],
  })
    .populate('problem')
    .sort({ nextReviewAt: 1, updatedAt: -1 })
    .lean();

  const items = rows
    .filter((r) => r.problem)
    .map((r) => ({
      ...toQueueItem(r, { rungs: LADDER_RUNGS, problem: r.problem }),
      /*
        Which curriculum this row came from.

        The Revision page draws both queues in one list, and without this a CP
        problem and a LeetCode problem are indistinguishable in the merged
        array — which matters because the two have different columns, different
        links and different progress endpoints behind their buttons.
      */
      source: 'cp',
    }));

  res.json({ items, count: items.length });
});
