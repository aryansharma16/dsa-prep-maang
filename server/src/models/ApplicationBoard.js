import mongoose from 'mongoose';

import {
  COLUMNS,
  COLUMN_KEYS,
  CURRENCIES,
  DEFAULT_STALE_AFTER_DAYS,
  MAX_STALE_AFTER_DAYS,
  MIN_STALE_AFTER_DAYS,
} from '../config/applications.js';
import { HUES } from '../config/hues.js';

/**
 * One board per account: what this person calls each lane, and a couple of
 * answers about them rather than about any one job.
 *
 * Its own document rather than a blob on `User`, for the reason `TaskBoard`
 * already writes down — `requireAuth` reads the user document on every request
 * in the app, and a per-module preferences bag there rides along on every call
 * that has nothing to do with applications.
 *
 * ---------------------------------------------------------------------------
 * The one real divergence from TaskBoard, and it is worth naming because it
 * changes what this document *is*.
 *
 * A task points at its column by `_id`, because those columns are user-created
 * and only the board knows them. Here the stages are a fixed vocabulary the
 * server already has in config/applications.js, so an application stores
 * `stage: String` and never an id. Three consequences, all of them good:
 *
 *   - the stats aggregations never read this document, so the funnel works on
 *     an account that has never opened the page;
 *   - this document is pure decoration. Delete it and nothing is lost — the
 *     next read recreates it with the default labels and every card is still in
 *     the right lane. Compare TaskBoard, where losing the board orphans every
 *     task;
 *   - there is no `assertStatus` equivalent to write. The enum is the
 *     validation.
 *
 * What is yours is the *word*. Call `in_process` "Grinding" or "Interviewing"
 * or "In flight" and every number still lands in the same bucket. That pairing
 * — `key` immutable, `label` free — is the whole design of this file.
 * ---------------------------------------------------------------------------
 */

const columnSchema = new mongoose.Schema(
  {
    key: { type: String, enum: COLUMN_KEYS, required: true, immutable: true },
    label: { type: String, required: true, trim: true, maxlength: 40 },
    hue: { type: String, enum: HUES, default: 'slate' },
    order: { type: Number, default: 0 },
    /**
     * Takes the lane off the board without taking the stages out of the
     * vocabulary, so an application already sitting in a hidden lane is still
     * valid data and still counts. The escape hatch for the column you do not
     * use — most people never touch Wishlist.
     */
    hidden: { type: Boolean, default: false },
  },
  { _id: false },
);
/*
  `_id` is off here, unlike `TaskBoard.statuses`. `key` is the stable address
  and it survives a rename, a recolour and a move on its own, so a second
  identity beside it would only be one more thing that can disagree with the
  first.
*/

/** What the lanes are called before anybody renames them. */
export const DEFAULT_COLUMNS = COLUMNS.map((column, index) => ({
  key: column.key,
  label: column.label,
  hue: column.hue,
  order: index,
  hidden: false,
}));

const applicationBoardSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },

    columns: { type: [columnSchema], default: () => DEFAULT_COLUMNS },

    /** Pre-filled on a new offer, because it is the same answer every time. */
    defaultCurrency: { type: String, enum: CURRENCIES, default: 'INR' },

    /**
     * How long silence has to last before a live card is drawn as stale.
     *
     * A setting and not a constant, because it is a personal judgement about
     * your market — three weeks is normal at some companies and abandonment at
     * others. It drives a badge and a sort, and never a move: nothing in this
     * module relocates a card you did not drag. See `ghosted` in
     * config/applications.js.
     */
    staleAfterDays: {
      type: Number,
      default: DEFAULT_STALE_AFTER_DAYS,
      min: MIN_STALE_AFTER_DAYS,
      max: MAX_STALE_AFTER_DAYS,
    },
  },
  { timestamps: true },
);

/* -------------------------------------------------------------------------- */
/* wire shape                                                                  */
/* -------------------------------------------------------------------------- */

applicationBoardSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

export const publicColumn = (column) => ({
  key: column.key,
  label: column.label,
  hue: column.hue,
  order: column.order ?? 0,
  hidden: Boolean(column.hidden),
});

export const publicApplicationBoard = (board) => ({
  id: board._id,
  columns: [...(board.columns || [])]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map(publicColumn),
  defaultCurrency: board.defaultCurrency || 'INR',
  staleAfterDays: board.staleAfterDays ?? DEFAULT_STALE_AFTER_DAYS,
  updatedAt: board.updatedAt,
});

export const ApplicationBoard = mongoose.model('ApplicationBoard', applicationBoardSchema);
