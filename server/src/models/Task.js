import mongoose from 'mongoose';
import { kindFor } from './File.js';

/**
 * A thing you meant to do.
 *
 * The roadmap records what happened — this records what was intended, which is
 * the half the app had nowhere to put. "I'll do these three sliding-window
 * questions today" is a sentence `Progress` cannot hold: it is about three
 * problems at once, it has a deadline, and it is true before any of them is
 * opened.
 *
 * Named `Task` and not `Todo` on purpose. `Progress.status` already has a
 * `'todo'` value meaning "this problem is unstarted", and a second unrelated
 * `todo` in the same codebase is read as the first one by everybody, including
 * whoever writes the next query.
 */

/* -------------------------------------------------------------------------- */
/* sub-schemas                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * A checklist item. One level, and that is the schema's decision rather than a
 * limit to lift later.
 *
 * A subtask holding subtasks turns every consumer — the progress count, the
 * renderer, the drag target, the "is this finished" test — into a recursive
 * walk with a depth guard. Nothing this feature is for needs the second level:
 * "do these three questions" is a list, not a tree.
 */
const subtaskSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  done: { type: Boolean, default: false },
  doneAt: { type: Date, default: null },
  order: { type: Number, default: 0 },
});

/**
 * A problem this task is about.
 *
 * A ref *and* a snapshot, following `Conversation`. Neither alone is enough:
 *
 * - A slug is ambiguous. `Problem` is uniquely indexed on `{ slug, owner }`, so
 *   `findOne({ slug })` can match a stranger's custom problem as easily as the
 *   seeded one. Every lookup would have to re-derive the owner scope, and the
 *   one that forgets is a silent cross-account read.
 * - A bare ObjectId dangles. You can delete a problem you added while a task
 *   still names it, and a dangling id renders as a blank row — corruption,
 *   where a dangling title reads as history and is what actually happened.
 *
 * So: the ref is how live progress is looked up, the snapshot is what is drawn
 * when the ref no longer resolves. The snapshot is written server-side from the
 * problem row and never echoed from the request — the same rule `resolveAssets`
 * applies to attachments, for the same reason. A client cannot name a problem
 * it cannot see.
 */
const questionSchema = new mongoose.Schema(
  {
    problem: { type: mongoose.Schema.Types.ObjectId, ref: 'Problem', required: true },
    slug: { type: String, default: '' },
    title: { type: String, default: '' },
    difficulty: { type: String, default: '' },
    patternSlug: { type: String, default: '' },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

/**
 * A file on the task: a denormalised copy of the `File` row so rendering a task
 * is one read, with `url` left null because the bucket is private and a
 * permanent URL would be a lie. Signed URLs are attached on read — see
 * `hydrateTask`.
 */
const attachmentSchema = new mongoose.Schema(
  {
    fileId: { type: mongoose.Schema.Types.ObjectId, ref: 'File', default: null },
    key: { type: String, required: true },
    name: { type: String, default: '' },
    contentType: { type: String, default: '' },
    kind: { type: String, default: 'other' },
    bytes: { type: Number, default: 0 },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    url: { type: String, default: null },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

/**
 * One sitting at this task.
 *
 * Closed runs only — an open one is `runningSince` on the task itself, not a
 * session with a null end. A half-written row is a state every reader has to
 * know about, and keeping the running clock in one nullable field instead means
 * `sessions` is only ever a list of things that finished.
 */
const sessionSchema = new mongoose.Schema({
  startedAt: { type: Date, required: true },
  endedAt: { type: Date, required: true },
  seconds: { type: Number, required: true, min: 0 },
  /** Typed in afterwards rather than measured. The timer you forgot to start. */
  manual: { type: Boolean, default: false },
  /** Hit `MAX_SESSION_SECONDS` — the laptop closed with the clock running. */
  truncated: { type: Boolean, default: false },
});

export const PRIORITIES = ['none', 'low', 'med', 'high'];

/**
 * Twelve hours, after which a session is closed at the cap and flagged.
 *
 * Not a guess about how long anyone studies — a bound on how wrong one forgotten
 * timer is allowed to make every number derived from it. Without it a single
 * overnight run reports nineteen hours on one problem and quietly ruins the
 * average the feature exists to produce. The flag matters as much as the cap:
 * a truncated session is visibly an artefact, so it can be corrected rather
 * than believed.
 */
export const MAX_SESSION_SECONDS = 12 * 60 * 60;

/* -------------------------------------------------------------------------- */
/* the task                                                                    */
/* -------------------------------------------------------------------------- */

const taskSchema = new mongoose.Schema(
  {
    /**
     * No `index: true` here, unlike most models. Every query in this module is
     * `user`-prefixed and served by one of the compound indexes below, and a
     * bare `{ user: 1 }` alongside them would be a fourth index that answers
     * nothing the others do not — as well as colliding, by key, with the
     * partial unique index that enforces one running clock.
     */
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    board: { type: mongoose.Schema.Types.ObjectId, ref: 'TaskBoard', required: true, index: true },

    /** A `_id` from the board's `statuses`. Validated against it on every write. */
    status: { type: mongoose.Schema.Types.ObjectId, required: true },
    /**
     * Position within its column.
     *
     * Plain integers, rewritten for the whole destination column on every move,
     * rather than fractional indices. A personal board holds tens of cards per
     * column, so the full-column write is one round trip and cannot drift; the
     * fractional scheme buys a smaller write in exchange for rebalancing logic
     * that is only ever exercised in the rare case, which is where it breaks.
     *
     * Gaps are expected and harmless — a card leaving a column does not
     * renumber the ones it left behind. Nothing reads these numbers, only their
     * order.
     */
    order: { type: Number, default: 0 },

    title: { type: String, required: true, trim: true, maxlength: 200 },
    notes: { type: String, default: '', maxlength: 4000 },

    /**
     * Null is the default and means unlimited, not "unset and therefore wrong".
     *
     * Most tasks genuinely have no deadline, so a required date would be a field
     * people invent an answer for — and an invented deadline is worse than none,
     * because everything downstream then treats it as real and shows it overdue.
     */
    dueAt: { type: Date, default: null },

    priority: { type: String, enum: PRIORITIES, default: 'none' },
    tags: { type: [String], default: [] },

    subtasks: { type: [subtaskSchema], default: [] },
    questions: { type: [questionSchema], default: [] },
    attachments: { type: [attachmentSchema], default: [] },

    sessions: { type: [sessionSchema], default: [] },
    /** Sum of `sessions[].seconds`, kept so a list read need not add them up. */
    trackedSeconds: { type: Number, default: 0 },

    /**
     * When the running clock started, or null.
     *
     * A timestamp, never an accumulating counter. That is what makes a reload, a
     * second tab and a closed laptop all agree on the same elapsed time — each
     * one subtracts from the same instant — and it means a running timer costs
     * zero writes per second instead of one.
     */
    runningSince: { type: Date, default: null },

    /** Stamped when the task lands in a `done` column, cleared when it leaves. */
    completedAt: { type: Date, default: null },

    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

/* -------------------------------------------------------------------------- */
/* indexes                                                                     */
/* -------------------------------------------------------------------------- */

// The board read: every live task for one person, already in column order.
taskSchema.index({ user: 1, deletedAt: 1, status: 1, order: 1 });
// The calendar, and "what is overdue".
taskSchema.index({ user: 1, deletedAt: 1, dueAt: 1 });

/**
 * At most one running timer per account, enforced by the database.
 *
 * The service stops whatever is running before it starts anything, which is
 * correct right up until two tabs do it at the same instant and both pass the
 * check before either writes. This index is what makes that race lose instead
 * of producing two running clocks and a total that counts the same minute
 * twice.
 *
 * `$gt: new Date(0)` rather than `$ne: null`, because partial filters accept
 * only a small set of operators and `$ne` is not among them. It selects the
 * same rows: BSON orders null below Date, so a task that has never run is not
 * in the index at all and any number of them may coexist.
 *
 * A start that loses the race catches the duplicate-key and retries once, the
 * same shape `upsertProgress` uses for the double-clicked status.
 */
taskSchema.index(
  { user: 1 },
  { unique: true, partialFilterExpression: { runningSince: { $gt: new Date(0) } } },
);

/* -------------------------------------------------------------------------- */
/* derived fields                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Keeps `trackedSeconds` honest without asking callers to remember.
 *
 * The failure this prevents is silent: a task whose sessions were edited but
 * whose total was not still renders a total, just the wrong one, and nothing in
 * the response says so.
 */
taskSchema.pre('save', function derive(next) {
  if (this.isModified('sessions')) {
    this.trackedSeconds = (this.sessions || []).reduce((sum, s) => sum + (s.seconds || 0), 0);
  }
  next();
});

/* -------------------------------------------------------------------------- */
/* queries                                                                     */
/* -------------------------------------------------------------------------- */

/** Live tasks only — the base every read starts from. */
taskSchema.statics.live = function live(filter = {}) {
  return this.find({ ...filter, deletedAt: null });
};

taskSchema.statics.softDelete = function softDelete(id, userId = null) {
  return this.findOneAndUpdate(
    { _id: id, deletedAt: null },
    { $set: { deletedAt: new Date(), deletedBy: userId } },
    { new: true },
  );
};

/* -------------------------------------------------------------------------- */
/* wire shapes                                                                 */
/* -------------------------------------------------------------------------- */

taskSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

/**
 * An attachment as the browser sees it: enough to render, and no S3 key.
 *
 * A key is not a credential, but publishing one invites a direct request to the
 * bucket and pins a storage layout the client has no business learning.
 */
export const publicAttachment = (asset) =>
  asset && asset.key
    ? {
        id: asset.fileId ?? null,
        url: asset.url ?? null,
        name: asset.name || '',
        contentType: asset.contentType || '',
        kind: asset.kind || kindFor(asset.contentType || ''),
        bytes: asset.bytes ?? 0,
        width: asset.width ?? null,
        height: asset.height ?? null,
        addedAt: asset.addedAt ?? null,
      }
    : null;

const publicSubtask = (subtask) => ({
  id: subtask._id,
  title: subtask.title,
  done: Boolean(subtask.done),
  doneAt: subtask.doneAt ?? null,
  order: subtask.order ?? 0,
});

const publicQuestion = (question) => ({
  problemId: question.problem,
  slug: question.slug || '',
  title: question.title || '',
  difficulty: question.difficulty || '',
  patternSlug: question.patternSlug || '',
  addedAt: question.addedAt ?? null,
});

const publicSession = (session) => ({
  id: session._id,
  startedAt: session.startedAt,
  endedAt: session.endedAt,
  seconds: session.seconds,
  manual: Boolean(session.manual),
  truncated: Boolean(session.truncated),
});

/**
 * The whole task.
 *
 * There is no separate card shape. A task's largest field is 4000 characters of
 * notes and the board wants the subtasks and questions anyway, to draw the
 * progress ring, so a trimmed second shape would save nothing worth the risk of
 * the drawer and the card disagreeing about what a task is.
 *
 * `elapsedSeconds` is deliberately absent. The client computes it from
 * `runningSince` against the server clock, so a number that changes every
 * second is never baked into a response that might sit in a cache or a retry.
 */
export const publicTask = (task) => ({
  id: task._id,
  status: task.status,
  order: task.order ?? 0,
  title: task.title,
  notes: task.notes || '',
  dueAt: task.dueAt ?? null,
  priority: task.priority || 'none',
  tags: task.tags ?? [],
  subtasks: [...(task.subtasks || [])]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map(publicSubtask),
  questions: (task.questions || []).map(publicQuestion),
  attachments: (task.attachments || []).map(publicAttachment).filter(Boolean),
  sessions: [...(task.sessions || [])]
    .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))
    .map(publicSession),
  trackedSeconds: task.trackedSeconds ?? 0,
  runningSince: task.runningSince ?? null,
  completedAt: task.completedAt ?? null,
  createdAt: task.createdAt,
  updatedAt: task.updatedAt,
});

export const Task = mongoose.model('Task', taskSchema);
