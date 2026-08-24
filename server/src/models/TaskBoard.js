import mongoose from 'mongoose';

/**
 * One board per account, holding the columns its tasks sit in.
 *
 * The board exists as its own document rather than as a `statuses` array on the
 * user for two reasons. It is the seat for everything a board will eventually
 * own that a user should not — a default view, a sort, an archive policy — and
 * it means "several boards" is a migration that drops the unique index and adds
 * a name, rather than a rewrite of every task query. Tasks already carry a
 * `board` ref for exactly that reason, even though today it only ever holds one
 * value per person.
 *
 * There is deliberately no board switcher in the UI. Shipping the seam without
 * shipping the feature is the cheap half; inventing a board list nobody asked
 * for is the expensive one.
 */

/**
 * The hues a column may wear.
 *
 * Named rather than stored as colour: the resolved value differs between light
 * and dark, and a stored `#26c281` would be a dark-theme green forever. The
 * client turns the name into a colour with `[data-hue='green']`, so every
 * column is drawn from one palette rather than a value per board.
 *
 * Kept in sync with the `[data-hue]` rules at the foot of client/src/styles/
 * tokens.css. A name absent there resolves to no colour at all, so this list is
 * the enum rather than a suggestion.
 */
export const STATUS_HUES = [
  'slate',
  'amber',
  'orange',
  'red',
  'pink',
  'fuchsia',
  'violet',
  'indigo',
  'blue',
  'sky',
  'teal',
  'green',
  'lime',
];

/**
 * What a column *means*, as opposed to what it is called.
 *
 * Behaviour hangs off this and never off the name. A board where "Done" has
 * been renamed to "Shipped" — or translated, or split into "Merged" and
 * "Deployed" — must still stop timers, stamp completion and drop out of the
 * open-work counts, and matching on the string "Done" is how that quietly
 * breaks the first time someone edits a column.
 *
 * Three values, not two. `active` is not decoration: it is what "In Progress"
 * is, and it is the column a timer belongs to, so a card started from `open`
 * can be offered a move rather than leaving the board lying about where the
 * work is.
 */
export const STATUS_KINDS = ['open', 'active', 'done'];

const statusSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 40 },
  hue: { type: String, enum: STATUS_HUES, default: 'slate' },
  kind: { type: String, enum: STATUS_KINDS, default: 'open' },
  order: { type: Number, default: 0 },
});
// `_id` is kept — unlike most sub-schemas here. A task points at a column, and
// that reference has to survive the column being renamed, recoloured and moved.

/**
 * The columns a new board starts with.
 *
 * Four, matching the shape most people already have in their head, and one of
 * each kind that matters. A board that opened empty would make the first
 * interaction "invent a workflow" rather than "write down a task", which is the
 * wrong first thing to ask of anyone.
 */
export const DEFAULT_STATUSES = [
  { name: 'Planned', hue: 'slate', kind: 'open', order: 0 },
  { name: 'In Progress', hue: 'amber', kind: 'active', order: 1 },
  { name: 'Done', hue: 'green', kind: 'done', order: 2 },
  { name: 'On Hold', hue: 'orange', kind: 'open', order: 3 },
];

/** Boards this size are a personal tool, not a project tracker. */
export const MAX_STATUSES = 12;

const boardSchema = new mongoose.Schema(
  {
    /**
     * Unique, which is what makes this "the" board rather than "a" board.
     *
     * Dropping this index is the whole of the migration to several boards —
     * everything else already reads a board by id.
     */
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    statuses: { type: [statusSchema], default: () => DEFAULT_STATUSES },
  },
  { timestamps: true },
);

/* -------------------------------------------------------------------------- */
/* wire shapes                                                                 */
/* -------------------------------------------------------------------------- */

boardSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

/** Columns in the order they are drawn. Sorted here so no caller has to. */
export const publicStatus = (status) => ({
  id: status._id,
  name: status.name,
  hue: status.hue,
  kind: status.kind,
  order: status.order ?? 0,
});

export const publicBoard = (board) => ({
  id: board._id,
  statuses: [...(board.statuses || [])]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map(publicStatus),
  updatedAt: board.updatedAt,
});

export const TaskBoard = mongoose.model('TaskBoard', boardSchema);
