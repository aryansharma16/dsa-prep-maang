import mongoose from 'mongoose';
import { attemptSchema } from './schemas/attempt.js';
import { recallSchema } from './schemas/recall.js';

/**
 * What one account has done with one roadmap problem.
 *
 * The attempt sub-document used to be declared here and byte-identically again
 * in `CPProgress`. It now lives in schemas/attempt.js, shared by both — the
 * tracking is not what differs between the two curriculums, and two copies of a
 * schema drift on the first field added to one of them.
 */

const progressSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    problem: { type: mongoose.Schema.Types.ObjectId, ref: 'Problem', required: true },

    status: {
      type: String,
      enum: ['todo', 'attempted', 'solved'],
      default: 'todo',
    },
    flagged: { type: Boolean, default: false },
    needsRevision: { type: Boolean, default: false },
    // 1 = shaky, 5 = could teach it. Drives the spaced-repetition interval.
    confidence: { type: Number, min: 1, max: 5, default: 3 },
    notes: { type: String, default: '' },

    attempts: { type: [attemptSchema], default: [] },
    /** What you said this was, from the title alone. See schemas/recall.js. */
    recalls: { type: [recallSchema], default: [] },
    solvedAt: { type: Date, default: null },
    lastReviewedAt: { type: Date, default: null },
    nextReviewAt: { type: Date, default: null },
    // How many times this has come back around the revision ladder
    reviewStage: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// One progress row per user per problem — upserts rely on this.
progressSchema.index({ user: 1, problem: 1 }, { unique: true });
// Revision queue lookup
progressSchema.index({ user: 1, nextReviewAt: 1 });
/*
  The admin dashboard's daily activity chart.

  Every other query against this collection is scoped to one account and rides
  the two indexes above. That one is deliberately site-wide, so it cannot — and
  without this it is a full collection scan on the panel's landing page. A
  multikey index over the embedded attempt dates costs one entry per attempt
  logged, which is the same order as writing the attempt in the first place.
*/
progressSchema.index({ 'attempts.at': -1 });

export const Progress = mongoose.model('Progress', progressSchema);
