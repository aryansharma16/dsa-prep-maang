import mongoose from 'mongoose';
import { OUTCOME_VALUES } from '../config/attempts.js';
import { HUES } from '../config/hues.js';

/**
 * One sitting with a problem.
 *
 * `note` and `colour` make an attempt a thing you can read back rather than a
 * tally mark — the account of how *that* sitting went, next to the one note the
 * problem already has for what you eventually understood. Both are the reason
 * the log is worth opening a second time.
 *
 * `timed` records whether the minutes were measured by the stopwatch or picked
 * off a preset, because a wall-clock number and a guess should not be read as
 * the same evidence when you are deciding whether you are getting faster.
 *
 * `confidence` is the same field the problem carries, recorded per sitting.
 * The one on the row is what the revision ladder multiplies by and it only ever
 * holds the latest value; this is the series, which is the thing worth looking
 * at — 2 → 3 → 4 over three attempts is a problem you are learning, and three
 * 2s is a problem you are re-reading. `null` on the attempts logged before this
 * existed, which is not the same fact as "shaky" and must not render as one.
 *
 * `_id` is kept — it used to be off, on the argument that an append-only array
 * makes an index a stable address. Deleting an attempt ends that: every index
 * after the hole shifts, so an edit issued against a number read a moment ago
 * lands on the wrong sitting. An id does not move.
 *
 * `at` and `loggedAt` are the same instant today and are not the same fact. `at`
 * is when the sitting happened and is what a "log yesterday's attempt" feature
 * would let you set; `loggedAt` is when this record was written, is immutable,
 * and is what the half-hour edit window is measured from. A grace period
 * anchored to a value its beneficiary can choose is not a grace period. See
 * config/attempts.js.
 */
const attemptSchema = new mongoose.Schema({
  at: { type: Date, default: Date.now },
  loggedAt: { type: Date, default: Date.now, immutable: true },
  minutes: { type: Number, default: 0 },
  outcome: {
    type: String,
    enum: OUTCOME_VALUES,
    default: 'solved',
  },
  note: { type: String, default: '' },
  color: { type: String, enum: [...HUES, ''], default: '' },
  timed: { type: Boolean, default: false },
  confidence: { type: Number, min: 1, max: 5, default: null },
});

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
