import mongoose from 'mongoose';

import {
  DEFAULT_LANG,
  OUTCOME_VALUES,
  REASON_VALUES,
  SOLUTION_LANGS,
} from '../../config/attempts.js';
import { HUES } from '../../config/hues.js';

/**
 * One sitting with a problem — the sub-document, once, for both curriculums.
 *
 * `Progress` and `CPProgress` declared this separately and byte-identically,
 * which was fine while it was six fields nobody touched and stopped being fine
 * the moment there was a field to add: two copies of a schema drift on the first
 * change applied to one of them, and the symptom is a dialog that saves your
 * solution on the roadmap and silently drops it on the ladder.
 *
 * Extracted here rather than into either model, following the precedent next
 * door: `schemas/guideBlock.js` is shared by `PatternGuide` and `CPPatternGuide`
 * for exactly this reason. The handlers that write these live in one place too
 * — see services/progress.kit.js — so the two curriculums now share the shape
 * *and* the rules, and neither can develop an opinion of its own.
 *
 * ---------------------------------------------------------------------------
 * The fields, and why each one is separate from the ones next to it.
 *
 * `note` and `color` make an attempt a thing you can read back rather than a
 * tally mark — the account of how *that* sitting went, next to the one note the
 * problem already has for what you eventually understood.
 *
 * `timed` records whether the minutes were measured by the stopwatch or picked
 * off a preset, because a wall-clock number and a guess should not be read as
 * the same evidence when you are deciding whether you are getting faster.
 *
 * `confidence` is the same field the problem carries, recorded per sitting. The
 * one on the row is what the revision ladder multiplies by and only ever holds
 * the latest value; this is the series, which is the thing worth looking at —
 * 2 → 3 → 4 over three attempts is a problem you are learning, and three 2s is a
 * problem you are re-reading. `null` on the attempts logged before this existed,
 * which is not the same fact as "shaky" and must not render as one.
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
 * ---------------------------------------------------------------------------
 */
export const attemptSchema = new mongoose.Schema({
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

  /**
   * What you actually wrote.
   *
   * The gap this closes is the largest one this collection had: everything above
   * describes a sitting and none of it is the sitting. Without the code you
   * cannot re-read your own approach six weeks later, cannot see that the second
   * attempt fixed the bug or repeated it, and cannot tell "solved" from "solved
   * twice from an empty file" — which is the rule the whole revision ladder is
   * built on.
   *
   * 20 000 characters. An interview answer is a page; this is room for four of
   * them and still small enough that hundreds of attempts are nothing next to
   * the statement HTML this database already stores per problem.
   *
   * Empty by default, so every attempt written before this existed is valid,
   * unchanged, and renders as an attempt with no solution attached rather than
   * as an empty code block.
   */
  code: { type: String, default: '', maxlength: 20000 },

  /**
   * Which language the code above is in.
   *
   * Defaulted rather than nullable, because a snippet has to be highlighted as
   * *something* and the alternative is a null check at every render site. On an
   * attempt with no code it is simply not read.
   */
  lang: { type: String, enum: SOLUTION_LANGS, default: DEFAULT_LANG },

  /**
   * Why it did not end in a solve.
   *
   * `''` is "not said", which is a real state and the one every historical
   * attempt is in — see config/attempts.js. The enum deliberately does not
   * include an "other": a reason you cannot name is better left blank than
   * filed under a bucket that then dominates the leak report.
   *
   * Only meaningful on a non-solving outcome, and the writer is what enforces
   * that rather than the schema: a validator here would have to re-derive the
   * outcome table, and `reasonAllowed()` already states it once.
   */
  reason: { type: String, enum: [...REASON_VALUES, ''], default: '' },

  /**
   * Whether the editorial was opened for this problem before it was solved.
   *
   * Recorded on the sitting rather than the row, because it is a fact about one
   * sitting: peeking on Tuesday and solving unaided on Friday is a real and
   * interesting sequence, and a flag on the problem could not hold it.
   *
   * The gate in the table is a hard block, so this is mostly the record of the
   * legitimate cases — a solved problem, or one you had already spent the
   * twenty-five minutes on. It is here so the leak report can say how many
   * solves involved one at all.
   */
  peeked: { type: Boolean, default: false },
});
