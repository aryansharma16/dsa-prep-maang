import mongoose from 'mongoose';
import { z } from 'zod';
import { LearnProgress } from '../models/LearnProgress.js';
import { LearnTopic } from '../models/LearnTopic.js';
import { UPCOMING_LIMIT } from '../config/revision.js';
import {
  DEFAULT_GRADE,
  LADDER_RUNGS,
  RECALL_GRADES,
  nextReview,
  reviewChoices,
  reviewNumber,
  reviewPlan,
  scheduleReview,
} from '../services/review.service.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Reading progress for the Learn tracks.
 *
 * Learn was the one module with no API surface — its prose is authored in the
 * client bundle, so there was nothing per-account to store. This adds the only
 * per-account fact it has: whether you have read a topic, how solid it felt, and
 * when it should come back.
 *
 * It reuses the revision ladder rather than inventing a second one. `nextReview`
 * in services/review.service.js is the same function the roadmap and the ladder
 * move on, so a topic and a problem due on the same morning were scheduled by
 * the same arithmetic.
 *
 * Deliberately *not* built on progress.kit.js. That factory is shaped around a
 * problem collection — it takes a `Problem` model, resolves a visible problem by
 * id, and writes an attempt log. A topic has no row to resolve and no attempts,
 * so reusing it would mean passing a fake model to skip most of what it does.
 */

const oid = (id) => new mongoose.Types.ObjectId(id);

/** A slug from the client's own track index. Bounded, never interpreted. */
const slug = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-z0-9-]+$/i, 'Not a topic slug');

export const topicParams = z.object({ track: slug, topic: slug });

export const markSchema = z.object({
  /*
    `title` is deliberately absent.

    The client used to send it, because only the client could see it. There is a
    `LearnTopic` collection now, so the server looks it up and the request is not
    consulted — zod strips unknown keys, so an older bundle still sending one is
    silently fine rather than an error nobody can act on.
  */
  confidence: z.number().int().min(1).max(5).default(3),
  /** `false` takes the topic off the ladder. It does not un-read it. */
  read: z.boolean().default(true),
});

/**
 * Marking a topic *read* — a browsing fact, and nothing more.
 *
 * Separate from `markSchema` above because the two must never be reachable by
 * accident from one another: this is fired by a scroll handler at 90% of the
 * page, and if it touched the revision ladder then skimming a topic on a train
 * would put it in Tuesday's queue. See the model.
 */
export const readSchema = z.object({ read: z.boolean().default(true) });

/**
 * The one-time hand-over of what localStorage was holding.
 *
 * Read state lived in the browser until there was a collection worth putting it
 * in, so every existing reader has a `learn-read` map that the server has never
 * seen. This takes the whole thing in one request rather than one per topic —
 * there are 170 topics, and 170 PUTs to migrate a page of ticks is a thing you
 * only get to do wrong once.
 */
export const bulkReadSchema = z.object({
  keys: z
    .array(z.string().regex(/^[a-z0-9-]+\/[a-z0-9-]+$/i, 'Not a track/topic key'))
    .max(500),
});

/* The same three intentions and the same grades the problem queues take — see
   the long note on `reviewSchema` in services/progress.kit.js. A topic answered
   in the merged queue must move on the same ladder as the problem above it. */
export const reviewSchema = z.object({
  result: z.enum(['recalled', 'missed', 'dismissed']),
  grade: z.enum(RECALL_GRADES).optional(),
  confidence: z.number().int().min(1).max(5).optional(),
  recall: z.string().max(500).optional(),
});

const shape = (row) => ({
  track: row.track,
  topic: row.topic,
  readAt: row.readAt,
  lastViewedAt: row.lastViewedAt,
  scheduledAt: row.scheduledAt,
  confidence: row.confidence,
  needsRevision: row.needsRevision,
  nextReviewAt: row.nextReviewAt,
  reviewStage: row.reviewStage,
});

/**
 * GET /learn/progress — everything this account has marked, in one request.
 *
 * The whole set rather than one topic at a time: the track page draws 68 rows
 * and would otherwise fire 68 requests to tick them.
 */
export const listLearnProgress = asyncHandler(async (req, res) => {
  const rows = await LearnProgress.find({ user: oid(req.userId) })
    .select(
      'track topic readAt lastViewedAt scheduledAt confidence needsRevision nextReviewAt reviewStage',
    )
    .lean();
  res.json({ topics: rows.map(shape) });
});

/**
 * PUT /learn/progress/:track/:topic/read — your eyes have been over this.
 *
 * The cheap half, and it is careful to stay cheap. It never touches
 * `scheduledAt` or any ladder field, so a topic read at 90% scroll is recorded
 * and nothing is scheduled; and it never clears `scheduledAt` either, so
 * un-ticking a topic you deliberately put on the ladder does not silently take
 * it off.
 *
 * `readAt` is the *first* time and only set once — a topic you re-read has not
 * become newly read — while `lastViewedAt` moves every time.
 */
export const markRead = asyncHandler(async (req, res) => {
  const { track, topic } = req.params;
  const user = oid(req.userId);
  const now = new Date();

  const row = await LearnProgress.findOneAndUpdate(
    { user, track, topic },
    req.body.read
      ? { $set: { lastViewedAt: now }, $setOnInsert: { user, track, topic, readAt: now } }
      : { $set: { readAt: null } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();

  /*
    A row that already existed but had been un-read needs `readAt` set, and
    `$setOnInsert` above only fires on a genuine insert. One extra write, and
    only on the re-read of a previously cleared topic.
  */
  if (req.body.read && !row.readAt) {
    const fixed = await LearnProgress.findOneAndUpdate(
      { _id: row._id },
      { $set: { readAt: now } },
      { new: true },
    ).lean();
    return res.json({ topic: shape(fixed) });
  }

  res.json({ topic: shape(row) });
});

/**
 * PUT /learn/progress/read — the localStorage hand-over, in one request.
 *
 * Idempotent, and deliberately additive: it never clears a topic that is not in
 * the list. The browser's map is one device's memory of what was read, not the
 * truth about every device, so treating an absence there as "not read" would let
 * the first laptop to run the migration erase the second one's ticks.
 */
export const bulkMarkRead = asyncHandler(async (req, res) => {
  const user = oid(req.userId);
  const now = new Date();

  const pairs = req.body.keys.map((key) => {
    const [track, topic] = key.split('/');
    return { track, topic };
  });

  if (pairs.length) {
    await LearnProgress.bulkWrite(
      pairs.map(({ track, topic }) => ({
        updateOne: {
          filter: { user, track, topic },
          update: { $setOnInsert: { user, track, topic, readAt: now, lastViewedAt: now } },
          upsert: true,
        },
      })),
      { ordered: false },
    );
  }

  const rows = await LearnProgress.find({ user })
    .select(
      'track topic readAt lastViewedAt scheduledAt confidence needsRevision nextReviewAt reviewStage',
    )
    .lean();
  res.json({ topics: rows.map(shape), migrated: pairs.length });
});

/**
 * PUT /learn/progress/:track/:topic — mark a topic read, or un-read it.
 *
 * Marking it read is what starts the schedule, and it starts at the first rung
 * exactly as a first solve does. Un-reading clears the schedule so it stops
 * surfacing — the mirror of un-solving a problem in `patchProgress`.
 */
export const markTopic = asyncHandler(async (req, res) => {
  const { track, topic } = req.params;
  const { confidence, read } = req.body;
  const user = oid(req.userId);

  const [existing, doc] = await Promise.all([
    LearnProgress.findOne({ user, track, topic }),
    /*
      The title, looked up rather than believed.

      It arrived in the request body until there was a collection to resolve it
      against. Reading it here means the queue cannot be made to say something
      the content does not — and it costs one indexed lookup on a click a reader
      makes a few times an hour.
    */
    LearnTopic.findOne({ track, slug: topic }).select('title').lean(),
  ]);

  const set = { confidence, needsRevision: false };
  if (doc?.title) set.title = doc.title;

  if (read) {
    const now = new Date();
    // Scheduling is also a reading: you do not press this without having read it.
    set.readAt = existing?.readAt || now;
    set.lastViewedAt = now;
    set.scheduledAt = existing?.scheduledAt || now;
    set.lastReviewedAt = now;
    const stage = existing?.reviewStage ?? 0;
    set.reviewStage = stage + 1;
    set.nextReviewAt = nextReview(stage, confidence).nextReviewAt;
  } else {
    /*
      Off the ladder, still read.

      This used to clear `readAt` too, back when that field was what "scheduled"
      meant. The control says "stop bringing this back", not "I never saw it",
      and taking the tick away as a side effect would be the page contradicting
      the button.
    */
    set.scheduledAt = null;
    set.nextReviewAt = null;
    set.reviewStage = 0;
  }

  const row = await LearnProgress.findOneAndUpdate(
    { user, track, topic },
    { $set: set, $setOnInsert: { user, track, topic } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();

  res.json({ topic: shape(row) });
});

/**
 * GET /learn/revision — the topics that are due.
 *
 * Shaped to match `toQueueItem`'s output closely enough that the client merges
 * it into the same list as the two problem queues with a `source` tag, which is
 * exactly what it already does for Pro Coder. It is deliberately not identical:
 * a topic has no difficulty and no companies, and inventing them to fill the
 * shape would put words in the row that are not true.
 */
export const learnRevisionQueue = asyncHandler(async (req, res) => {
  const now = new Date();
  const user = oid(req.userId);
  /*
    `scheduledAt`, not `readAt`. This was `readAt` when that field meant "put on
    the ladder"; read is a browsing fact now, set by a scroll handler, and
    queueing off it would put every topic you have ever skimmed into Tuesday
    morning — which is exactly what keeping read out of the database was
    protecting against.
  */
  const onTheLadder = { user, scheduledAt: { $ne: null } };

  const [rows, ahead] = await Promise.all([
    LearnProgress.find({
      ...onTheLadder,
      $or: [{ needsRevision: true }, { nextReviewAt: { $ne: null, $lte: now } }],
    })
      .sort({ nextReviewAt: 1, updatedAt: -1 })
      .lean(),
    /* What is coming, on the same terms the three problem queues answer it —
       see `findUpcoming` in services/progress.kit.js. */
    LearnProgress.find({
      ...onTheLadder,
      needsRevision: { $ne: true },
      nextReviewAt: { $ne: null, $gt: now },
    })
      .sort({ nextReviewAt: 1 })
      .limit(UPCOMING_LIMIT)
      .lean(),
  ]);

  const items = rows.map((row) => {
    const stage = Math.min(row.reviewStage ?? 0, LADDER_RUNGS);
    const good = scheduleReview(stage, DEFAULT_GRADE, now);
    return {
      _id: String(row._id),
      track: row.track,
      topic: row.topic,
      title: row.title || row.topic,
      progress: {
        status: 'solved',
        needsRevision: row.needsRevision,
        revisionReason: row.revisionReason || '',
        revisionNote: row.revisionNote || '',
        confidence: row.confidence,
        notes: '',
        nextReviewAt: row.nextReviewAt,
        recentAttempts: [],
        recentRecalls: (row.recalls || []).slice(-3),
      },
      dueReason: row.needsRevision ? 'marked' : 'scheduled',
      review: {
        stage,
        rungs: LADDER_RUNGS,
        number: reviewNumber(stage),
        lastReviewedAt: row.lastReviewedAt || row.readAt || null,
        dueAt: row.nextReviewAt || null,
        choices: reviewChoices(stage, now),
        plan: reviewPlan(stage, now),
        nextGapDays: good.days,
      },
    };
  });

  const upcoming = ahead.map((row) => {
    const stage = Math.min(row.reviewStage ?? 0, LADDER_RUNGS);
    return {
      _id: String(row._id),
      track: row.track,
      topic: row.topic,
      title: row.title || row.topic,
      progress: { status: 'solved', confidence: row.confidence, nextReviewAt: row.nextReviewAt },
      dueReason: 'scheduled',
      review: {
        stage,
        rungs: LADDER_RUNGS,
        number: reviewNumber(stage),
        dueAt: row.nextReviewAt,
        lastReviewedAt: row.lastReviewedAt || row.readAt || null,
        plan: reviewPlan(stage, row.nextReviewAt),
      },
    };
  });

  res.json({ items, count: items.length, upcoming });
});

/**
 * POST /learn/progress/:track/:topic/review — working the queue.
 *
 * The same three intentions the problem queues have, with the same meanings:
 * `recalled` climbs by the grade given, `missed` drops a rung and comes back
 * tomorrow, `dismissed` only clears what put the row in front of you. The
 * arithmetic is `scheduleReview`'s in every case, so a topic and a problem
 * answered the same way move by the same amount. The recall line is kept either
 * way — a wrong one is the more useful half.
 */
export const reviewTopic = asyncHandler(async (req, res) => {
  const { track, topic } = req.params;
  const { result, grade, confidence, recall } = req.body;
  const user = oid(req.userId);

  const existing = await LearnProgress.findOne({ user, track, topic });
  if (!existing) throw ApiError.notFound('Nothing to review here', 'NO_PROGRESS');

  const set = { needsRevision: false, revisionReason: '', revisionNote: '' };

  if (result === 'recalled' || result === 'missed') {
    const step = scheduleReview(
      existing.reviewStage ?? 0,
      result === 'missed' ? 'missed' : grade || DEFAULT_GRADE,
    );
    set.lastReviewedAt = new Date();
    set.reviewStage = step.stage;
    set.nextReviewAt = step.nextReviewAt;
    set.confidence = confidence ?? step.confidence;
  } else {
    if (confidence) set.confidence = confidence;
    if (existing.nextReviewAt && existing.nextReviewAt <= new Date()) set.nextReviewAt = null;
  }

  const update = { $set: set };
  if (recall?.trim()) {
    update.$push = { recalls: { $each: [{ at: new Date(), text: recall.trim() }], $slice: -10 } };
  }

  const row = await LearnProgress.findOneAndUpdate({ _id: existing._id }, update, {
    new: true,
  }).lean();

  res.json({ topic: shape(row) });
});
