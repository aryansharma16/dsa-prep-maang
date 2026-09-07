import mongoose from 'mongoose';
import { z } from 'zod';
import {
  ATTEMPT_EDIT_WINDOW_MS,
  DEFAULT_LANG,
  OUTCOME_VALUES,
  REASON_VALUES,
  SOLUTION_LANGS,
  attemptEditableUntil,
  outcomeEffect,
  reasonAllowed,
} from '../config/attempts.js';
import { HUES } from '../config/hues.js';
import { REVISION_FLAGS, REVISION_NOTE_MAX, UPCOMING_LIMIT } from '../config/revision.js';
import {
  DEFAULT_GRADE,
  RECALL_GRADES,
  nextReview,
  reviewChoices,
  reviewNumber,
  reviewPlan,
  scheduleReview,
} from './review.service.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { objectId } from '../utils/query.js';

/**
 * Progress tracking, once, for any problem collection.
 *
 * There are two curriculums now — the interview roadmap and the CP ladder — and
 * the *tracking* is not what differs between them. Someone flags a problem, logs
 * a sitting, writes a note and gets it back in three days for identical reasons
 * on both sides of the app, and the rules are subtle enough to be worth having
 * in one place: the half-hour edit window and its two-round-trip atomicity, the
 * outcome table's asymmetry about `needsRevision`, the ladder advancing only on
 * a *transition* to solved, and the difference between recalling and dismissing.
 *
 * Two copies of that would not stay identical. They would drift on the first
 * bug fix applied to one of them, and the symptom would be a revision queue that
 * behaves differently depending on which page you reached it from — which is
 * exactly the kind of thing nobody reports and everybody notices.
 *
 * So this is a factory. Hand it a problem model, a progress model and the
 * visibility rule, and it returns the six handlers. The two controllers that
 * call it are thin by construction, and neither can develop its own opinion
 * about spaced repetition.
 */

const oid = (id) => new mongoose.Types.ObjectId(id);

/** The colour on an attempt is optional — '' is "none", not a missing field. */
const hue = z.enum([...HUES, '']);

export const patchSchema = z
  .object({
    status: z.enum(['todo', 'attempted', 'solved']).optional(),
    flagged: z.boolean().optional(),
    needsRevision: z.boolean().optional(),
    /*
      Why you flagged it, and the line that says what you actually meant. Both
      optional and both `''`-able: a flag raised by the keyboard shortcut carries
      neither, and must still be a flag. See config/revision.js.
    */
    revisionReason: z.enum([...REVISION_FLAGS, '']).optional(),
    revisionNote: z.string().max(REVISION_NOTE_MAX).optional(),
    confidence: z.number().int().min(1).max(5).optional(),
    notes: z.string().max(20000).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });

/** A failure reason is optional — '' is "not said", like the colour above. */
const reason = z.enum([...REASON_VALUES, '']);

/**
 * The solution, as written.
 *
 * The cap matches the model's. Trailing whitespace is stripped but the body is
 * otherwise stored exactly as typed — this is code, and reformatting somebody's
 * indentation on the way into the database would be a surprise.
 */
const solutionCode = z.string().max(20000).transform((s) => s.trimEnd());

export const attemptSchema = z
  .object({
    minutes: z.number().int().min(0).max(600).default(0),
    outcome: z.enum(OUTCOME_VALUES).default('solved'),
    confidence: z.number().int().min(1).max(5).optional(),
    note: z.string().max(2000).default(''),
    color: hue.default(''),
    timed: z.boolean().default(false),
    code: solutionCode.default(''),
    lang: z.enum(SOLUTION_LANGS).default(DEFAULT_LANG),
    reason: reason.default(''),
    peeked: z.boolean().default(false),
  })
  /*
    A reason belongs to a sitting that did not solve the problem, and the outcome
    table is what says which those are. Dropped rather than rejected: the chips
    are hidden the moment you pick a solving outcome, so a reason arriving beside
    one is a client that changed the outcome after the fact, not a caller doing
    something wrong. Answering 400 to that would fail a log somebody spent
    twenty-five minutes earning.
  */
  .transform((v) => (reasonAllowed(v.outcome) ? v : { ...v, reason: '' }));

export const attemptEditSchema = z
  .object({
    note: z.string().max(2000).optional(),
    color: hue.optional(),
    // `null` clears it — "I no longer think that was a 4" is a different edit
    // from "leave it alone", and the field has to be able to say both.
    confidence: z.number().int().min(1).max(5).nullable().optional(),
    /*
      The code is editable inside the same half-hour window as the note, and for
      the same reason: the fix you thought of on the way to the kitchen belongs
      on the sitting it belongs to. After that the log is a record — see
      config/attempts.js.
    */
    code: solutionCode.optional(),
    lang: z.enum(SOLUTION_LANGS).optional(),
    reason: reason.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });

export const attemptIdParam = z.object({ problemId: objectId, attemptId: objectId });

export const reviewSchema = z.object({
  /*
    What the buttons on the revision queue actually mean. Three intentions, and
    only two of them are reviews:

      recalled   I came back to this and got it — `grade` says how easily.
      missed     I came back to this and could not do it.
      dismissed  take it off the list; I am not claiming to have reviewed it.

    `missed` is the one that was not expressible before. Test mode approximated
    it by dismissing the row and then patching the flag back on from the client,
    which left the problem standing on a rung it had just failed. See
    services/review.service.js for what a lapse is supposed to do to a ladder.
  */
  result: z.enum(['recalled', 'missed', 'dismissed']),
  /*
    How easily, on a review that went well. Optional and defaulted rather than
    required, because "I got it" is a complete answer and the plain queue is
    allowed to be one click.
  */
  grade: z.enum(RECALL_GRADES).optional(),
  confidence: z.number().int().min(1).max(5).optional(),
  /*
    What you said the problem was before anything was revealed — test mode's
    whole output. Optional, because the queue's plain mode does not ask for one
    and a review without it is still a review.
  */
  recall: z.string().max(500).optional(),
});

/** How many recall lines one problem keeps. See models/schemas/recall.js. */
const RECALL_KEEP = 10;

/**
 * The clause that keeps the edit window honest across two round trips.
 *
 * The `$or` is the same fallback `attemptEditableUntil` applies in JS, and has
 * to be: a comparison against a missing `loggedAt` matches nothing, so without
 * it an attempt written before that field existed passes the JS check — which
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
 * Builds the progress handlers for one problem collection.
 *
 * @param {object}   options
 * @param {import('mongoose').Model} options.Problem   the problem model
 * @param {import('mongoose').Model} options.Progress  its progress model
 * @param {(userId: string) => object} options.visibleTo
 *        The visibility filter, as a Mongo query fragment. Passed in rather than
 *        assumed, because it is the one rule that is genuinely per-module — and
 *        the one that must not be got wrong, since every handler here writes a
 *        row keyed to an id taken from the URL.
 * @param {string}  [options.notFound]  what to call a problem that is not there
 */
export function createProgressHandlers({ Problem, Progress, visibleTo, notFound = 'Problem not found' }) {
  /**
   * The problem this request is about, if the caller may see it at all.
   *
   * Every handler below takes a problem id from the URL and writes a row keyed
   * to it, so without this an id is enough to attach yourself to somebody
   * else's private addition — and the revision queue populates the problem it
   * points at, which would then show you their problem.
   *
   * 404 rather than 403: a problem you cannot see must not be distinguishable
   * from one that does not exist.
   */
  async function visibleProblem(problemId, userId) {
    const problem = await Problem.findOne({ _id: problemId, ...visibleTo(userId) }).select('_id');
    if (!problem) throw ApiError.notFound(notFound);
    return problem;
  }

  /**
   * Two upserts racing on a problem with no progress row yet both miss the
   * document and both try to insert, so one loses on the {user, problem} unique
   * index. Clicking a status twice quickly is enough to trigger it. By the time
   * we retry the row exists, so the second attempt updates instead of inserting.
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

  /**
   * The attempt this request is about, if it is still open to being changed.
   *
   * The window is checked here rather than folded into each update's filter so
   * that "there is no such attempt" and "you are too late" come back as
   * different answers. They are different mistakes and the second has to say
   * when it closed, or the dialog can only report that something went wrong.
   *
   * The caller then re-states the window in its own update filter, which is
   * what makes the check atomic: this read and the write that follows it are
   * two round trips, and only the filter closes the gap between them.
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
   * PATCH .../progress/:problemId
   * Upserts the single progress row for this user+problem. The client fires
   * this after already applying the change locally, so it must be cheap and
   * idempotent.
   */
  const patchProgress = asyncHandler(async (req, res) => {
    const problem = await visibleProblem(req.params.problemId, req.userId);

    const existing = await Progress.findOne({ user: oid(req.userId), problem: problem._id });
    const update = { ...req.body };

    /*
      Taking the flag off takes its reason and its line with it. Left behind they
      are an explanation of a flag that is not there any more, and the next time
      you raise one by keyboard it would silently inherit whatever you wrote
      about the problem in June.
    */
    if (update.needsRevision === false) {
      update.revisionReason = '';
      update.revisionNote = '';
    }

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

  /** POST .../progress/:problemId/attempt — one sitting, logged. */
  const logAttempt = asyncHandler(async (req, res) => {
    const problem = await visibleProblem(req.params.problemId, req.userId);

    const { minutes, outcome, confidence, note, color, timed, code, lang, reason, peeked } =
      req.body;
    const existing = await Progress.findOne({ user: oid(req.userId), problem: problem._id });
    const effect = outcomeEffect(outcome);

    const set = { lastReviewedAt: new Date() };
    if (confidence) set.confidence = confidence;
    // Never `false`: see config/attempts.js on why an outcome may raise this
    // flag and may not lower one you set by hand.
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
            // Same instant, different fact — see the model.
            loggedAt: new Date(),
            minutes,
            outcome,
            note,
            color,
            timed,
            /*
              On the sitting as well as on the row. The row's copy is the
              current value the ladder multiplies by and is overwritten every
              time; this one stays where it was written, which is what makes the
              log a series rather than a list of the same number.
            */
            confidence: confidence ?? null,
            /*
              What you wrote, why it did not work, and whether you had opened
              the editorial. All three belong to the sitting and none to the
              row: the second attempt's code is not a correction of the first
              one's, it is a different piece of evidence, and reading them in
              order is the whole point of keeping them.
            */
            code,
            lang,
            reason,
            peeked,
          },
        },
        $setOnInsert: { user: oid(req.userId), problem: problem._id },
      },
    );

    res.json({ progress });
  });

  /**
   * GET .../progress/:problemId/attempts — the full log for one problem.
   *
   * Separate from the list endpoint, which carries only the last few of these
   * and truncates their notes. The whole history with whole notes is worth a
   * request when you have opened the dialog to read it, and is not worth
   * shipping hundreds of times over to a table that shows four chips.
   */
  const listAttempts = asyncHandler(async (req, res) => {
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

  /**
   * PATCH .../progress/:problemId/attempts/:attemptId — re-annotate one.
   *
   * What was worth writing down about a sitting is often clear only after the
   * next one, so the log is editable in place rather than write-once. For half
   * an hour, and then not — see config/attempts.js. The positional `$` writes to
   * the element the filter matched, which is what makes this safe next to a
   * delete: an index read a moment ago points at a different sitting once
   * something before it has gone, and an id does not move.
   */
  const editAttempt = asyncHandler(async (req, res) => {
    const { attemptId } = req.params;
    const { problem } = await editableAttempt(req.params.problemId, req.userId, attemptId);

    const set = {};
    if (req.body.note !== undefined) set['attempts.$.note'] = req.body.note;
    if (req.body.color !== undefined) set['attempts.$.color'] = req.body.color;
    if (req.body.confidence !== undefined) set['attempts.$.confidence'] = req.body.confidence;
    if (req.body.code !== undefined) set['attempts.$.code'] = req.body.code;
    if (req.body.lang !== undefined) set['attempts.$.lang'] = req.body.lang;
    /*
      Not re-checked against the outcome here, unlike on the way in. This
      endpoint cannot change the outcome, so the sitting's solving-ness is
      whatever it already was — and the client only offers the chips on a
      sitting that has them. Re-deriving it would need a second read of the
      attempt purely to reject an edit nobody can make.
    */
    if (req.body.reason !== undefined) set['attempts.$.reason'] = req.body.reason;

    const progress = await Progress.findOneAndUpdate(
      { user: oid(req.userId), problem: problem._id, attempts: stillOpen(attemptId) },
      { $set: set },
      { new: true },
    );

    if (!progress) throw ApiError.notFound('No such attempt', 'NO_ATTEMPT');
    res.json({ progress });
  });

  /**
   * DELETE .../progress/:problemId/attempts/:attemptId — take one back out.
   *
   * It removes the sitting and nothing else: the row's status, its solve date
   * and its place on the revision ladder stay exactly as they are. Those fields
   * are the server's reading of everything up to now, not a running total of
   * this array — un-solving a problem because you tidied up its log would be a
   * surprise, and recomputing them from what is left would need the history the
   * delete just threw away.
   */
  const deleteAttempt = asyncHandler(async (req, res) => {
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
   * POST .../progress/:problemId/review — working the revision queue.
   *
   * This exists because the queue has two ways in and the page had one way out.
   * A row is due because `needsRevision` is set *or* because `nextReviewAt` has
   * passed, and a plain `{ needsRevision: false }` does nothing at all to a row
   * that was due by schedule. The status patch cannot help either: it advances
   * the ladder only when the status *transitions* to solved, and a scheduled row
   * is already solved.
   *
   * Overloading the status patch to fix that would have been worse. "Set this
   * field" and "I reviewed this" are different requests, and only the second
   * should be allowed to move a schedule.
   */
  const reviewProgress = asyncHandler(async (req, res) => {
    const problem = await visibleProblem(req.params.problemId, req.userId);

    const existing = await Progress.findOne({ user: oid(req.userId), problem: problem._id });
    if (!existing) throw ApiError.notFound('Nothing to review here', 'NO_PROGRESS');

    const { result, grade, confidence, recall } = req.body;
    /*
      Every answer clears the hand-raised flag and everything hanging off it. The
      flag means "bring this back", the row is in front of you, and the reason
      you wrote in June is not an explanation of anything once you have answered.
    */
    const set = { needsRevision: false, revisionReason: '', revisionNote: '' };

    /*
      The recall line, kept whichever way the review went — and *especially* when
      it went badly. "I said prefix sums and it was a monotonic stack" is the
      most useful sentence this feature produces, and storing it only on a
      success would throw away exactly the half worth reading back.

      `$slice: -10` keeps the last ten and is what stops a problem reviewed
      thirty times from growing without bound.
    */
    const push = recall?.trim()
      ? { recalls: { $each: [{ at: new Date(), text: recall.trim() }], $slice: -RECALL_KEEP } }
      : null;

    if (result === 'recalled' || result === 'missed') {
      /*
        The answer moves the ladder, and the ladder is the one in
        review.service.js — the stage, the gap and the confidence all come back
        from one call so no controller can move two of the three and forget the
        other. A miss steps *down* a rung and comes back tomorrow; a hard recall
        stands still; good and easy climb.
      */
      const stage = existing.reviewStage ?? 0;
      const answer = result === 'missed' ? 'missed' : grade || DEFAULT_GRADE;
      const step = scheduleReview(stage, answer);

      set.lastReviewedAt = new Date();
      set.reviewStage = step.stage;
      set.nextReviewAt = step.nextReviewAt;
      /*
        The freshest reading of the problem there is. An explicit `confidence` in
        the body still wins — the dots in test mode's older shape sent one — but
        the answer itself is now what normally writes this field, which is the
        whole reason the intervals stopped being multiplied by a number from
        three months ago.
      */
      set.confidence = confidence ?? step.confidence;

      // You can only have recalled it if you can do it. A miss says nothing
      // about a status you already earned, so it leaves one alone.
      if (result === 'recalled' && existing.status !== 'solved') {
        set.status = 'solved';
        set.solvedAt = existing.solvedAt || new Date();
      }
    } else {
      // Not a review, so it moves no ladder — but a confidence sent alongside is
      // still a statement about the problem and is honoured, as it always was.
      if (confidence) set.confidence = confidence;
      /*
        Dismissing takes it off the queue and does nothing else — which means
        clearing only what was putting it there. A schedule still in the future
        is not why this row is in front of you, and wiping it would silently
        retire a problem from revision because you tidied up a flag.
      */
      if (existing.nextReviewAt && existing.nextReviewAt <= new Date()) set.nextReviewAt = null;
    }

    const progress = await Progress.findOneAndUpdate(
      { _id: existing._id },
      push ? { $set: set, $push: push } : { $set: set },
      { new: true },
    );

    res.json({ progress });
  });

  return {
    visibleProblem,
    upsertProgress,
    patchProgress,
    logAttempt,
    listAttempts,
    editAttempt,
    deleteAttempt,
    reviewProgress,
  };
}

/**
 * The shape the revision queue ships per row, from a populated progress row.
 *
 * Shared because both queues answer the same question and their clients render
 * with the same components — a `dueReason` that meant something different on
 * one of the two pages would be a bug nobody could see from either file.
 */
export function toQueueItem(row, { rungs, problem, now = new Date() }) {
  const stage = Math.min(row.reviewStage ?? 0, rungs);
  /*
    The forecast runs from the day this review actually happens, which is today
    for a row you are looking at — not from its due date, which on an overdue
    row is in the past and would date the whole plan behind itself.
  */
  const good = scheduleReview(stage, DEFAULT_GRADE, now);

  return {
    ...problem,
    progress: {
      status: row.status,
      flagged: row.flagged,
      needsRevision: row.needsRevision,
      /* Why you flagged it and what you said about it — see config/revision.js.
         Both default to '' so a row flagged before this shipped renders as a
         flag with nothing attached rather than as `undefined`. */
      revisionReason: row.revisionReason || '',
      revisionNote: row.revisionNote || '',
      confidence: row.confidence,
      notes: row.notes,
      solvedAt: row.solvedAt,
      nextReviewAt: row.nextReviewAt,
      attemptCount: row.attempts?.length || 0,
      attemptMinutes: (row.attempts || []).reduce((n, a) => n + (a.minutes || 0), 0),
      // Same tail the list endpoints ship, for the same reason — the queue is
      // deciding what to work on next, and "three sittings, still stuck" is the
      // part of that decision a count cannot make.
      recentAttempts: (row.attempts || []).slice(-4),
      /*
        The last three things you said this problem was, for test mode's reveal.
        Three rather than all ten: the panel is showing you what you thought last
        time, not a diary, and the older ones are only interesting next to the
        newer ones anyway.
      */
      recentRecalls: (row.recalls || []).slice(-3),
    },
    dueReason: row.needsRevision ? 'marked' : 'scheduled',
    /*
      Where this problem is on the ladder, and what getting it right would buy —
      computed server-side rather than sent as raw stage numbers, because the
      multiplier curve is the server's and a client that reimplements it will
      eventually disagree with the date the server actually writes.
    */
    review: {
      stage,
      rungs,
      /** Which review this row is waiting for, 1-based — see `reviewNumber`. */
      number: reviewNumber(stage),
      lastReviewedAt: row.lastReviewedAt || row.solvedAt || null,
      /** The date that put the row here, or null on one you flagged by hand. */
      dueAt: row.nextReviewAt || null,
      /** What each of the four buttons would schedule, so each can say so. */
      choices: reviewChoices(stage, now),
      /*
        Every review still owed after the one you are about to do, dated. See
        `reviewPlan` for why an approximate future beats no future at all.
      */
      plan: reviewPlan(stage, now),
      nextGapDays: good.days,
    },
  };
}

/**
 * A row that is scheduled but not yet due.
 *
 * Deliberately thinner than a queue item: this is a date and a title in a list
 * you read, not a row you work, so it carries no attempts, no recalls and no
 * per-button arithmetic. Thirty of these ship with every queue request — see
 * `UPCOMING_LIMIT` — and the heaviest field on the full shape is the attempt
 * tail nobody is going to read from a forecast.
 *
 * The problem document rides along whole because the client links these titles
 * through the same `queueLink` the due rows use, and that reads `url`, `track`
 * and `topic` off the problem rather than off a shape invented here.
 */
export function toUpcomingItem(row, { rungs, problem }) {
  const stage = Math.min(row.reviewStage ?? 0, rungs);
  return {
    ...problem,
    progress: {
      status: row.status,
      confidence: row.confidence,
      nextReviewAt: row.nextReviewAt,
    },
    dueReason: 'scheduled',
    review: {
      stage,
      rungs,
      number: reviewNumber(stage),
      dueAt: row.nextReviewAt,
      lastReviewedAt: row.lastReviewedAt || row.solvedAt || null,
      // Dated from the day it is actually due, not from today — this row is not
      // in front of you, and its plan runs from when it will be.
      plan: reviewPlan(stage, row.nextReviewAt),
    },
  };
}

/**
 * The not-yet-due half of a queue request, for any of the four collections.
 *
 * Same query in four controllers otherwise, and the one clause that is easy to
 * get wrong is `needsRevision: { $ne: true }`: a flagged row is already in the
 * list above and must not be forecast as though it were merely scheduled.
 */
export async function findUpcoming(Progress, { user, extra = {}, populate, now = new Date() }) {
  const query = Progress.find({
    user,
    needsRevision: { $ne: true },
    nextReviewAt: { $ne: null, $gt: now },
    ...extra,
  })
    .sort({ nextReviewAt: 1 })
    .limit(UPCOMING_LIMIT);

  if (populate) query.populate(...populate);
  return query.lean();
}
