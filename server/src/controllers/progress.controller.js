import mongoose from 'mongoose';
import { z } from 'zod';
import {
  ATTEMPT_EDIT_WINDOW_MS,
  OUTCOME_VALUES,
  attemptEditableUntil,
  outcomeEffect,
} from '../config/attempts.js';
import { HUES } from '../config/hues.js';
import { Problem } from '../models/Problem.js';
import { Progress } from '../models/Progress.js';
import { nextReview } from '../services/review.service.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { objectId } from '../utils/query.js';

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

/** The colour on an attempt is optional — '' is "none", not a missing field. */
const hue = z.enum([...HUES, '']);

export const attemptSchema = z.object({
  minutes: z.number().int().min(0).max(600).default(0),
  outcome: z.enum(OUTCOME_VALUES).default('solved'),
  confidence: z.number().int().min(1).max(5).optional(),
  note: z.string().max(2000).default(''),
  color: hue.default(''),
  timed: z.boolean().default(false),
});

/** POST /api/progress/:problemId/attempt — one sitting, logged. */
export const logAttempt = asyncHandler(async (req, res) => {
  const problem = await visibleProblem(req.params.problemId, req.userId);

  const { minutes, outcome, confidence, note, color, timed } = req.body;
  const existing = await Progress.findOne({ user: oid(req.userId), problem: problem._id });
  const effect = outcomeEffect(outcome);

  const set = { lastReviewedAt: new Date() };
  if (confidence) set.confidence = confidence;
  // Never `false`: see config/attempts.js on why an outcome may raise
  // this flag and may not lower one you set by hand.
  if (effect.flagsRevision) set.needsRevision = true;

  if (effect.solves) {
    set.status = 'solved';
    set.solvedAt = existing?.solvedAt || new Date();
    const stage = existing?.reviewStage ?? 0;
    set.reviewStage = stage + 1;
    set.nextReviewAt = nextReview(stage, confidence ?? existing?.confidence ?? 3).nextReviewAt;
  } else {
    // Getting stuck on something already solved does not un-solve it.
    set.status = existing?.status === 'solved' ? 'solved' : 'attempted';
  }

  const progress = await upsertProgress(
    { user: oid(req.userId), problem: problem._id },
    {
      $set: set,
      $push: {
        attempts: {
          _id: new mongoose.Types.ObjectId(),
          at: new Date(),
          // Same instant, different fact — see models/Progress.js.
          loggedAt: new Date(),
          minutes,
          outcome,
          note,
          color,
          timed,
          /*
            On the sitting as well as on the row. The row's copy is the current
            value the ladder multiplies by and is overwritten every time; this
            one stays where it was written, which is what makes the log a series
            rather than a list of the same number.
          */
          confidence: confidence ?? null,
        },
      },
      $setOnInsert: { user: oid(req.userId), problem: problem._id },
    },
  );

  res.json({ progress });
});

/**
 * GET /api/progress/:problemId/attempts — the full log for one problem.
 *
 * Separate from the roadmap, which carries only the last few of these and
 * truncates their notes. The whole history with whole notes is worth a request
 * when you have opened the dialog to read it, and is not worth shipping 430
 * times over to the table that shows four chips.
 */
export const listAttempts = asyncHandler(async (req, res) => {
  const problem = await visibleProblem(req.params.problemId, req.userId);

  const row = await Progress.findOne({ user: oid(req.userId), problem: problem._id })
    .select('attempts')
    .lean();

  const attempts = row?.attempts || [];
  res.json({
    attempts,
    total: attempts.length,
    minutes: attempts.reduce((n, a) => n + (a.minutes || 0), 0),
  });
});

export const attemptEditSchema = z
  .object({
    note: z.string().max(2000).optional(),
    color: hue.optional(),
    // `null` clears it — "I no longer think that was a 4" is a different edit
    // from "leave it alone", and the field has to be able to say both.
    confidence: z.number().int().min(1).max(5).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });

export const attemptIdParam = z.object({ problemId: objectId, attemptId: objectId });

/**
 * The attempt this request is about, if it is still open to being changed.
 *
 * The window is checked here rather than folded into each update's filter so
 * that "there is no such attempt" and "you are too late" come back as different
 * answers. They are different mistakes and the second one has to say when it
 * closed, or the dialog can only report that something went wrong.
 *
 * The caller then re-states the window in its own update filter, which is what
 * makes the check atomic: this read and the write that follows it are two round
 * trips, and only the filter closes the gap between them.
 */
async function editableAttempt(problemId, userId, attemptId) {
  const problem = await visibleProblem(problemId, userId);

  const row = await Progress.findOne(
    { user: oid(userId), problem: problem._id, 'attempts._id': oid(attemptId) },
    { 'attempts.$': 1 },
  ).lean();

  const attempt = row?.attempts?.[0];
  if (!attempt) throw ApiError.notFound('No such attempt', 'NO_ATTEMPT');

  const until = attemptEditableUntil(attempt);
  if (until.getTime() <= Date.now()) {
    throw ApiError.badRequest(
      `That attempt was logged more than ${Math.round(
        ATTEMPT_EDIT_WINDOW_MS / 60000,
      )} minutes ago and can no longer be changed`,
      'ATTEMPT_LOCKED',
    );
  }

  return { problem, attempt, until };
}

/**
 * The clause that keeps the window honest across the two round trips above.
 *
 * The `$or` is the same fallback `attemptEditableUntil` applies in JS, and has
 * to be: a comparison against a missing `loggedAt` matches nothing, so without
 * it an attempt written before that field existed passes the check above — which
 * reads `at` — and then fails this one, and the caller is told its attempt does
 * not exist. Two readings of one rule is worse than either reading.
 */
const stillOpen = (attemptId) => {
  const cutoff = new Date(Date.now() - ATTEMPT_EDIT_WINDOW_MS);
  return {
    $elemMatch: {
      _id: oid(attemptId),
      $or: [{ loggedAt: { $gt: cutoff } }, { loggedAt: null, at: { $gt: cutoff } }],
    },
  };
};

/**
 * PATCH /api/progress/:problemId/attempts/:attemptId — re-annotate one.
 *
 * What was worth writing down about a sitting is often clear only after the
 * next one, so the log is editable in place rather than write-once.
 *
 * For half an hour, and then not — see config/attempts.js. The positional `$`
 * writes to the element the filter matched, which is what makes this safe next
 * to a delete: an index read a moment ago points at a different sitting once
 * something before it has gone, and an id does not move.
 */
export const editAttempt = asyncHandler(async (req, res) => {
  const { attemptId } = req.params;
  const { problem } = await editableAttempt(req.params.problemId, req.userId, attemptId);

  const set = {};
  if (req.body.note !== undefined) set['attempts.$.note'] = req.body.note;
  if (req.body.color !== undefined) set['attempts.$.color'] = req.body.color;
  if (req.body.confidence !== undefined) set['attempts.$.confidence'] = req.body.confidence;

  const progress = await Progress.findOneAndUpdate(
    { user: oid(req.userId), problem: problem._id, attempts: stillOpen(attemptId) },
    { $set: set },
    { new: true },
  );

  if (!progress) throw ApiError.notFound('No such attempt', 'NO_ATTEMPT');
  res.json({ progress });
});

/**
 * DELETE /api/progress/:problemId/attempts/:attemptId — take one back out.
 *
 * A mis-tap logs an attempt against the wrong row or with the wrong number on
 * it, and until now the only way out was deleting the problem — which is what
 * the half-hour window is sized for. It removes the sitting and nothing else:
 * the row's status, its solve date and its place on the revision ladder stay
 * exactly as they are.
 *
 * That is deliberate and worth being explicit about. Those fields are the
 * server's reading of everything up to now, not a running total of this array —
 * un-solving a problem because you tidied up its log would be a surprise, and
 * recomputing them from what is left would need the history the delete just
 * threw away. The circle in the first column is one click if the status is
 * actually wrong.
 */
export const deleteAttempt = asyncHandler(async (req, res) => {
  const { attemptId } = req.params;
  const { problem } = await editableAttempt(req.params.problemId, req.userId, attemptId);

  const progress = await Progress.findOneAndUpdate(
    { user: oid(req.userId), problem: problem._id, attempts: stillOpen(attemptId) },
    { $pull: { attempts: { _id: oid(attemptId) } } },
    { new: true },
  );

  if (!progress) throw ApiError.notFound('No such attempt', 'NO_ATTEMPT');
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
        attemptMinutes: (r.attempts || []).reduce((n, a) => n + (a.minutes || 0), 0),
        // Same tail the roadmap ships, for the same reason — the queue is
        // deciding what to work on next, and "three sittings, still stuck" is
        // the part of that decision a count cannot make.
        recentAttempts: (r.attempts || []).slice(-4),
      },
      dueReason: r.needsRevision ? 'marked' : 'scheduled',
    }));

  res.json({ items, count: items.length });
});
