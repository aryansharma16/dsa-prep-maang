import mongoose from 'mongoose';
import { z } from 'zod';
import { LearnProgress } from '../models/LearnProgress.js';
import { LADDER_RUNGS, nextReview } from '../services/review.service.js';
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
  /**
   * The title, sent by the client because only the client can see it.
   *
   * Snapshotted rather than looked up — see the model. It is the caller's own
   * bundle talking about its own content, so there is nothing to verify it
   * against; it is bounded and stored.
   */
  title: z.string().max(200).default(''),
  confidence: z.number().int().min(1).max(5).default(3),
  /** `false` un-reads a topic — clears its schedule and takes it off the queue. */
  read: z.boolean().default(true),
});

export const reviewSchema = z.object({
  result: z.enum(['recalled', 'dismissed']),
  confidence: z.number().int().min(1).max(5).optional(),
  recall: z.string().max(500).optional(),
});

const shape = (row) => ({
  track: row.track,
  topic: row.topic,
  readAt: row.readAt,
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
    .select('track topic readAt confidence needsRevision nextReviewAt reviewStage')
    .lean();
  res.json({ topics: rows.map(shape) });
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
  const { title, confidence, read } = req.body;
  const user = oid(req.userId);

  const existing = await LearnProgress.findOne({ user, track, topic });

  const set = { confidence, needsRevision: false };
  if (title) set.title = title;

  if (read) {
    set.readAt = existing?.readAt || new Date();
    set.lastReviewedAt = new Date();
    const stage = existing?.reviewStage ?? 0;
    set.reviewStage = stage + 1;
    set.nextReviewAt = nextReview(stage, confidence).nextReviewAt;
  } else {
    set.readAt = null;
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
  const rows = await LearnProgress.find({
    user: oid(req.userId),
    readAt: { $ne: null },
    $or: [{ needsRevision: true }, { nextReviewAt: { $ne: null, $lte: now } }],
  })
    .sort({ nextReviewAt: 1, updatedAt: -1 })
    .lean();

  const items = rows.map((row) => ({
    _id: String(row._id),
    track: row.track,
    topic: row.topic,
    title: row.title || row.topic,
    progress: {
      status: 'solved',
      needsRevision: row.needsRevision,
      confidence: row.confidence,
      notes: '',
      nextReviewAt: row.nextReviewAt,
      recentAttempts: [],
      recentRecalls: (row.recalls || []).slice(-3),
    },
    dueReason: row.needsRevision ? 'marked' : 'scheduled',
    review: {
      stage: Math.min(row.reviewStage ?? 0, LADDER_RUNGS),
      rungs: LADDER_RUNGS,
      lastReviewedAt: row.lastReviewedAt || row.readAt || null,
      nextGapDays: nextReview(row.reviewStage ?? 0, row.confidence ?? 3).days,
    },
  }));

  res.json({ items, count: items.length });
});

/**
 * POST /learn/progress/:track/:topic/review — working the queue.
 *
 * The same two intentions the problem queues have, with the same meanings:
 * `recalled` advances a rung, `dismissed` only clears what put the row in front
 * of you. The recall line is kept either way — a wrong one is the more useful
 * half.
 */
export const reviewTopic = asyncHandler(async (req, res) => {
  const { track, topic } = req.params;
  const { result, confidence, recall } = req.body;
  const user = oid(req.userId);

  const existing = await LearnProgress.findOne({ user, track, topic });
  if (!existing) throw ApiError.notFound('Nothing to review here', 'NO_PROGRESS');

  const set = { needsRevision: false };
  if (confidence) set.confidence = confidence;

  if (result === 'recalled') {
    const stage = existing.reviewStage ?? 0;
    set.lastReviewedAt = new Date();
    set.reviewStage = stage + 1;
    set.nextReviewAt = nextReview(stage, confidence ?? existing.confidence ?? 3).nextReviewAt;
  } else if (existing.nextReviewAt && existing.nextReviewAt <= new Date()) {
    set.nextReviewAt = null;
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
