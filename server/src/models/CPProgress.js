import mongoose from 'mongoose';
import { OUTCOME_VALUES } from '../config/attempts.js';
import { HUES } from '../config/hues.js';

/**
 * One person's record against one CP problem.
 *
 * A deliberate mirror of `Progress` — same statuses, same attempt sub-document,
 * same spaced-repetition fields, same unique index — because the *tracking* is
 * not what differs between the two curriculums. Someone flags a problem, logs a
 * sitting, writes a note and gets it back in three days for identical reasons on
 * both sides of the app, and the revision ladder in services/review.service.js
 * is shared rather than reimplemented.
 *
 * What it adds is the platform's own verdict, which the roadmap has no
 * equivalent of: LeetCode will not tell us what you have solved, and Codeforces
 * will.
 */

const attemptSchema = new mongoose.Schema({
  at: { type: Date, default: Date.now },
  loggedAt: { type: Date, default: Date.now, immutable: true },
  minutes: { type: Number, default: 0 },
  outcome: { type: String, enum: OUTCOME_VALUES, default: 'solved' },
  note: { type: String, default: '' },
  color: { type: String, enum: [...HUES, ''], default: '' },
  timed: { type: Boolean, default: false },
  confidence: { type: Number, min: 1, max: 5, default: null },
});

const cpProgressSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    problem: { type: mongoose.Schema.Types.ObjectId, ref: 'CPProblem', required: true },

    status: { type: String, enum: ['todo', 'attempted', 'solved'], default: 'todo' },
    flagged: { type: Boolean, default: false },
    needsRevision: { type: Boolean, default: false },
    confidence: { type: Number, min: 1, max: 5, default: 3 },
    notes: { type: String, default: '' },

    attempts: { type: [attemptSchema], default: [] },
    solvedAt: { type: Date, default: null },
    lastReviewedAt: { type: Date, default: null },
    nextReviewAt: { type: Date, default: null },
    reviewStage: { type: Number, default: 0 },

    /**
     * Codeforces says you have an accepted submission on this.
     *
     * Kept as its own field rather than folded into `status: 'solved'`, and the
     * distinction is the point of the whole sync feature. "The judge accepted
     * my code" and "I understand this problem" are different claims, and
     * conflating them destroys the more interesting one: a ladder where every
     * problem you ever AC'd in a contest three years ago is silently marked done
     * cannot tell you what you have actually learned.
     *
     * So sync sets this always, and only promotes `status` when the row is still
     * untouched — see services/cp/sync.service.js. A problem you AC'd but never
     * logged shows on the ladder as exactly that, which is a prompt worth having
     * rather than an inconsistency worth hiding.
     */
    solvedOnPlatform: { type: Boolean, default: false, index: true },
    /** When the accepted submission was made, per the platform. */
    platformSolvedAt: { type: Date, default: null },
    /** The submission id, so a re-sync can tell "still true" from "new". */
    platformSubmissionId: { type: Number, default: null },
  },
  { timestamps: true },
);

/** One row per user per problem — every upsert in the module relies on this. */
cpProgressSchema.index({ user: 1, problem: 1 }, { unique: true });
/** The CP revision queue. */
cpProgressSchema.index({ user: 1, nextReviewAt: 1 });
/** The stats page's activity chart, site-wide like its roadmap twin. */
cpProgressSchema.index({ 'attempts.at': -1 });

export const CPProgress = mongoose.model('CPProgress', cpProgressSchema);
