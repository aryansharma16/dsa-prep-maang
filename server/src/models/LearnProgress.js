import mongoose from 'mongoose';
import { recallSchema } from './schemas/recall.js';

/**
 * One account's standing with one Learn topic.
 *
 * The Learn track is 111 topics of reference prose — the React and Node notes —
 * and until now it was the one thing in the app you could read and never see
 * again. The roadmap schedules a problem to come back in three days; a topic you
 * read once in week two was simply gone by week nine, which is the opposite of
 * how the rest of this app treats knowledge.
 *
 * So a topic gets the same treatment a problem does, on the same ladder: mark it
 * read, say how solid it felt, and it comes back on the 3/7/21/60 schedule
 * stretched or compressed by that confidence. The interval maths is not
 * reimplemented here — `nextReview()` in services/review.service.js is the one
 * implementation, shared with both problem curriculums, so all three queues
 * cannot drift apart.
 *
 * ---------------------------------------------------------------------------
 * Why the topic is a pair of slugs and not a ref.
 *
 * Learn has no collection. Its content is authored as JavaScript modules in the
 * client bundle (`client/src/learn/react/…`), deliberately — it is reference
 * prose we write, identical for every reader, with nothing per-account in it.
 * There is nothing here to point a ref at.
 *
 * That makes `{ track, topic }` the natural key, and it has one honest
 * consequence worth stating: renaming a topic's slug orphans its progress rows.
 * The alternative — seeding 111 documents to own an id — would mean a migration
 * every time a sentence changes, which is the cost this design was chosen to
 * avoid. A renamed slug is rare, and its failure is a topic that quietly leaves
 * the queue rather than one that shows wrong.
 * ---------------------------------------------------------------------------
 */
const learnProgressSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    /** `react`, `node` — the track slug from client/src/learn/tracks.js. */
    track: { type: String, required: true, trim: true, maxlength: 64 },
    /** The topic slug within it, from that track's index. */
    topic: { type: String, required: true, trim: true, maxlength: 128 },

    /**
     * What it is called, captured when it is marked read.
     *
     * A snapshot, unlike everything else here, and for the reason `Task`
     * snapshots a problem title: the queue is rendered server-side from these
     * rows and the server cannot see the client bundle the titles live in.
     * Without it the queue would be a list of slugs.
     */
    title: { type: String, default: '', maxlength: 200 },

    readAt: { type: Date, default: null },
    confidence: { type: Number, min: 1, max: 5, default: 3 },
    needsRevision: { type: Boolean, default: false },

    /* The same three fields the two problem curriculums carry, holding the same
       meanings, moved by the same function. */
    lastReviewedAt: { type: Date, default: null },
    nextReviewAt: { type: Date, default: null },
    reviewStage: { type: Number, default: 0 },

    /** What you said it was, in test mode. See schemas/recall.js. */
    recalls: { type: [recallSchema], default: [] },
  },
  { timestamps: true },
);

/** One row per account per topic — every upsert relies on this. */
learnProgressSchema.index({ user: 1, track: 1, topic: 1 }, { unique: true });
/** The queue lookup, matching the two problem collections' shape. */
learnProgressSchema.index({ user: 1, nextReviewAt: 1 });

export const LearnProgress = mongoose.model('LearnProgress', learnProgressSchema);
