import mongoose from 'mongoose';
import { z } from 'zod';
import { Problem } from '../models/Problem.js';
import { Progress } from '../models/Progress.js';
import { nextReview } from '../services/review.service.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const oid = (id) => new mongoose.Types.ObjectId(id);

/**
 * The problem this progress row is about, if the caller may see it at all.
 *
 * Both endpoints below take a problem id from the URL and write a row keyed to
 * it, so without the `owner` clause an id is enough to attach yourself to
 * somebody else's private addition — and the revision queue populates the
 * problem it points at, which would then show you their problem. The same
 * filter as the roadmap and the chat context, for the same reason.
 *
 * 404 rather than 403: a problem you cannot see should not be distinguishable
 * from one that does not exist.
 */
async function visibleProblem(problemId, userId) {
  const problem = await Problem.findOne({
    _id: problemId,
    $or: [{ owner: null }, { owner: oid(userId) }],
  }).select('_id');

  if (!problem) throw ApiError.notFound('Problem not found');
  return problem;
}

/**
 * Two upserts racing on a problem with no progress row yet both miss the
 * document and both try to insert, so one loses on the {user, problem} unique
 * index. Clicking a status twice quickly is enough to trigger it. By the time we
 * retry the row exists, so the second attempt updates instead of inserting.
 */
async function upsertProgress(filter, update) {
  const options = { new: true, upsert: true, setDefaultsOnInsert: true };
  try {
    return await Progress.findOneAndUpdate(filter, update, options);
  } catch (err) {
    if (err.code !== 11000) throw err;
    return Progress.findOneAndUpdate(filter, update, options);
  }
}

export const patchSchema = z
  .object({
    status: z.enum(['todo', 'attempted', 'solved']).optional(),
    flagged: z.boolean().optional(),
    needsRevision: z.boolean().optional(),
    confidence: z.number().int().min(1).max(5).optional(),
    notes: z.string().max(20000).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });

/**
 * PATCH /api/progress/:problemId
 * Upserts the single progress row for this user+problem. The client fires this
 * after already applying the change locally, so it must be cheap and idempotent.
 */
export const patchProgress = asyncHandler(async (req, res) => {
  const problem = await visibleProblem(req.params.problemId, req.userId);

  const existing = await Progress.findOne({ user: oid(req.userId), problem: problem._id });
  const update = { ...req.body };

  if (update.status === 'solved' && existing?.status !== 'solved') {
    const confidence = update.confidence ?? existing?.confidence ?? 3;
    const stage = existing?.reviewStage ?? 0;
    update.solvedAt = new Date();
    update.reviewStage = stage + 1;
    update.nextReviewAt = nextReview(stage, confidence).nextReviewAt;
  }

  // Un-solving clears the review schedule so it stops surfacing as "due".
  if (update.status && update.status !== 'solved' && existing?.status === 'solved') {
    update.solvedAt = null;
    update.nextReviewAt = null;
    update.reviewStage = 0;
  }

  const progress = await upsertProgress(
    { user: oid(req.userId), problem: problem._id },
    { $set: update, $setOnInsert: { user: oid(req.userId), problem: problem._id } },
  );

  res.json({ progress });
});

export const attemptSchema = z.object({
  minutes: z.number().int().min(0).max(600).default(0),
  outcome: z.enum(['solved', 'solved-with-help', 'stuck']).default('solved'),
  confidence: z.number().int().min(1).max(5).optional(),
});

/** POST /api/progress/:problemId/attempt — the two-tap "log attempt" popover. */
export const logAttempt = asyncHandler(async (req, res) => {
  const problem = await visibleProblem(req.params.problemId, req.userId);

  const { minutes, outcome, confidence } = req.body;
  const existing = await Progress.findOne({ user: oid(req.userId), problem: problem._id });

  const set = { lastReviewedAt: new Date() };
  if (confidence) set.confidence = confidence;

  if (outcome === 'stuck') {
    set.status = existing?.status === 'solved' ? 'solved' : 'attempted';
    set.needsRevision = true;
  } else {
    set.status = 'solved';
    set.solvedAt = existing?.solvedAt || new Date();
    const stage = existing?.reviewStage ?? 0;
    set.reviewStage = stage + 1;
    set.nextReviewAt = nextReview(stage, confidence ?? existing?.confidence ?? 3).nextReviewAt;
  }

  const progress = await upsertProgress(
    { user: oid(req.userId), problem: problem._id },
    {
      $set: set,
      $push: { attempts: { at: new Date(), minutes, outcome } },
      $setOnInsert: { user: oid(req.userId), problem: problem._id },
    },
  );

  res.json({ progress });
});

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
    .map((r) => ({
      ...r.problem,
      progress: {
        status: r.status,
        flagged: r.flagged,
        needsRevision: r.needsRevision,
        confidence: r.confidence,
        notes: r.notes,
        solvedAt: r.solvedAt,
        nextReviewAt: r.nextReviewAt,
        attemptCount: r.attempts?.length || 0,
      },
      dueReason: r.needsRevision ? 'marked' : 'scheduled',
    }));

  res.json({ items, count: items.length });
});
