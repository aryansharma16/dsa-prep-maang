import mongoose from 'mongoose';

/** What someone is telling us, which decides very little except how it reads. */
export const FEEDBACK_TYPES = ['suggestion', 'bug', 'complaint', 'other'];

/**
 * Where a submission is in its life.
 *
 * Two terminal states rather than one, because `declined` is the only honest way
 * to close something we have read and are not going to do. Without it the only
 * exit is `resolved`, which the submitter reads as "done" — a lie the product
 * tells on the team's behalf.
 *
 * `in_review` earns its place for the same reason. "Has a person seen this yet"
 * is the question somebody actually has three days after submitting, and neither
 * `open` nor `resolved` answers it.
 *
 * Anything finer — duplicate, won't fix, deferred to next quarter — is a
 * sentence, not a state. That is what the response note is for.
 */
export const FEEDBACK_STATUSES = ['open', 'in_review', 'planned', 'resolved', 'declined'];

/**
 * The statuses that still owe somebody an answer.
 *
 * Derived by exclusion rather than written out again, because three separate
 * things read it — the per-account submission cap, the dashboard's open count,
 * and the queue's default filter — and a fourth working state added above must
 * not silently become terminal in all three.
 */
export const OPEN_STATUSES = FEEDBACK_STATUSES.filter(
  (status) => status !== 'resolved' && status !== 'declined',
);

/**
 * The one reply.
 *
 * A sub-schema with `default: undefined` rather than a nested path, so a
 * submission nobody has answered carries no `response` key at all — the
 * `User.avatar` arrangement. Declared as a nested path Mongoose would
 * materialise `{ text: '', by: null, at: null }` on every row, and "has anyone
 * replied" would stop being one truthy check.
 */
const responseSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true, maxlength: 2000 },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // Copied in for the reason AuditLog copies the actor's email: a reply signed
    // by nobody, because the staff account was deleted, reads as a machine
    // closing a ticket.
    byName: { type: String, default: '' },
    at: { type: Date, default: null },
  },
  { _id: false },
);

const feedbackSchema = new mongoose.Schema(
  {
    submitter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    /**
     * Denormalised, both of them.
     *
     * The queue has to stay readable after an account is deleted — a row that
     * says "someone reported this" is a row nobody can follow up on. The cost is
     * that the email goes stale when a person changes theirs, which is correct
     * for a record of who submitted it *then*, but does mean the panel's search
     * will miss the new address. The `submitter` id is the reliable filter.
     */
    submitterName: { type: String, default: '' },
    submitterEmail: { type: String, default: '' },

    type: { type: String, enum: FEEDBACK_TYPES, default: 'suggestion', index: true },

    /**
     * A short line, separate from the body.
     *
     * The queue is a table, and a table whose only column is a truncated
     * four-thousand-character body cannot be scanned. It is also what the audit
     * row uses as its label.
     */
    title: { type: String, required: true, trim: true, maxlength: 140 },
    message: { type: String, required: true, trim: true, maxlength: 4000 },

    /**
     * The client route the form was opened from — a `location.pathname`, never a
     * full URL. "The stats page" is most of a bug report, and asking someone to
     * remember where they were is asking them to file a worse one.
     */
    path: { type: String, default: '', maxlength: 200 },

    status: { type: String, enum: FEEDBACK_STATUSES, default: 'open', index: true },

    /*
      Deliberately not named `editedAt`. In this codebase that field means "has
      diverged from the seeder", and this collection has no seeder.
    */
    statusChangedAt: { type: Date, default: null },
    statusChangedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    response: { type: responseSchema, default: undefined },
  },
  { timestamps: true },
);

// "What have I sent, newest first" — the only query the learner surfaces make.
feedbackSchema.index({ submitter: 1, createdAt: -1 });
// The triage list. The prefix rule means this also serves a status-only filter
// and an unfiltered list, both in date order.
feedbackSchema.index({ status: 1, type: 1, createdAt: -1 });
// The per-account open cap, and the dashboard's "who is waiting" count.
feedbackSchema.index({ submitter: 1, status: 1 });

/**
 * What the person who submitted it sees.
 *
 * The reply carries a name and not an id, on purpose. An ObjectId is a handle to
 * probe; a name is a byline, and a reply with a byline reads as an answer from
 * somebody rather than a status change with words attached.
 */
export const feedbackCard = (row) => ({
  _id: row._id,
  type: row.type,
  status: row.status,
  title: row.title,
  message: row.message,
  path: row.path || '',
  response: row.response?.text
    ? { text: row.response.text, by: row.response.byName || 'The team', at: row.response.at }
    : null,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

/**
 * The same submission plus what only staff get to see.
 *
 * Built by adding to the card rather than subtracting from the document, and the
 * direction is the whole point: a field added to the card is deliberately shown
 * to its submitter, while a field added only here is private because of where it
 * was written, not because somebody remembered to strip it.
 */
export const feedbackRow = (row) => {
  const card = feedbackCard(row);

  return {
    ...card,
    submitter: {
      _id: row.submitter ?? null,
      name: row.submitterName || '',
      email: row.submitterEmail || '',
    },
    response: card.response ? { ...card.response, byId: row.response.by ?? null } : null,
    statusChangedAt: row.statusChangedAt ?? null,
  };
};

export const Feedback = mongoose.model('Feedback', feedbackSchema);
