import mongoose from 'mongoose';
import { attemptSchema } from './schemas/attempt.js';
import { recallSchema } from './schemas/recall.js';

/**
 * One account's standing with one SQL Lab problem.
 *
 * `CPProgress` with the judge-sync fields removed — there is no external judge
 * to reconcile against here, because the judge is in the reader's own browser.
 * Everything else is deliberately identical, down to the sub-schemas: the same
 * `attemptSchema` and `recallSchema` the roadmap and the ladder use, so a
 * sitting logged here is the same object as a sitting logged anywhere else and
 * `progress.kit.js` can move all three without knowing which it has.
 *
 * `attemptSchema.lang` already permits `'sql'` — that shipped with the Learn
 * track, alongside `PROBLEM_LANGS` so the roadmap's picker stayed three wide.
 *
 * ---------------------------------------------------------------------------
 * The one field that is not on its twin.
 *
 * `bestQuery` is the query that last passed. It is stored because the whole
 * point of this module is that a pass is *earned*, and the thing earned is
 * worth being able to read again — six weeks later, next to a better answer, is
 * exactly when a solved SQL problem teaches you the most.
 *
 * It duplicates the `code` on the passing attempt, which is a real redundancy
 * and a deliberate one: attempts are capped and roll off, and the query that
 * solved a problem should not disappear because you later logged four more
 * sittings against it.
 * ---------------------------------------------------------------------------
 */
const sqlProgressSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    problem: { type: mongoose.Schema.Types.ObjectId, ref: 'SqlProblem', required: true },

    status: { type: String, enum: ['todo', 'attempted', 'solved'], default: 'todo' },
    flagged: { type: Boolean, default: false },
    needsRevision: { type: Boolean, default: false },
    /** Why the flag is up, and your line about it. See models/Progress.js. */
    revisionReason: { type: String, default: '', maxlength: 32 },
    revisionNote: { type: String, default: '', maxlength: 500 },
    confidence: { type: Number, min: 1, max: 5, default: 3 },
    notes: { type: String, default: '' },

    attempts: { type: [attemptSchema], default: [] },
    recalls: { type: [recallSchema], default: [] },

    solvedAt: { type: Date, default: null },
    lastReviewedAt: { type: Date, default: null },
    nextReviewAt: { type: Date, default: null },
    reviewStage: { type: Number, default: 0 },

    /** The query that last passed. See the note above. */
    bestQuery: { type: String, default: '', maxlength: 20000 },
  },
  { timestamps: true },
);

/** One row per account per problem — every upsert in the progress kit relies on this. */
sqlProgressSchema.index({ user: 1, problem: 1 }, { unique: true });
/** The revision queue lookup, matching the other two progress collections. */
sqlProgressSchema.index({ user: 1, nextReviewAt: 1 });
/** The activity heatmap reads attempt dates across all three. */
sqlProgressSchema.index({ 'attempts.at': -1 });

export const SqlProgress = mongoose.model('SqlProgress', sqlProgressSchema);
