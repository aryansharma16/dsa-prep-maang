import mongoose from 'mongoose';

/**
 * Somebody asking for an account, before there is one.
 *
 * Registration does not create a `User` any more: it creates one of these, and
 * the super admin turns it into an account or does not. That is the whole
 * feature, and the reason it is a separate collection rather than a `pending`
 * flag on `User` is that every other query in this app treats a `User` row as a
 * real person — the admin list, the stats counts, `reconcileSuperAdmin`, the
 * unique index on email. A pending row in there would be a person who cannot
 * sign in, appearing in all of them, and every one of those call sites would
 * have to learn about it. Here, nothing that already exists has to change.
 *
 * The request holds the password the applicant chose, hashed with the same cost
 * as a real account's and `select: false` for the same reason. It is never
 * readable through the API — the one caller that wants it is the approval, which
 * copies it onto the new `User` and then deletes the row's copy. A request that
 * is rejected or left pending therefore ages out holding a bcrypt hash, which is
 * no worse than the account it would have become.
 */

export const SIGNUP_STATUSES = ['pending', 'approved', 'rejected'];

/**
 * Where the request came from, gathered rather than asked for.
 *
 * None of this is a form field — the applicant fills in five things and this is
 * captured alongside them, which is why the "max five fields" budget is not
 * spent on it. It is here because "approve or reject" is a judgement call, and
 * the useful signal for it is rarely in the answers: five requests from one
 * address in a minute is the thing worth seeing.
 *
 * Every field is optional and best-effort. A lookup that is down, rate-limited
 * or blocked must cost the applicant nothing, so an empty `city` means the
 * lookup did not answer and never that the request is suspect.
 */
const contextSchema = new mongoose.Schema(
  {
    ip: { type: String, default: '', maxlength: 60 },
    city: { type: String, default: '', maxlength: 80 },
    region: { type: String, default: '', maxlength: 80 },
    country: { type: String, default: '', maxlength: 80 },
    /** Desktop, mobile or tablet, read off the user agent. */
    device: { type: String, default: '', maxlength: 20 },
    browser: { type: String, default: '', maxlength: 40 },
    os: { type: String, default: '', maxlength: 40 },
    /** Kept whole as well: the parse above is a guess, this is the evidence. */
    userAgent: { type: String, default: '', maxlength: 400 },
  },
  { _id: false },
);

const signupRequestSchema = new mongoose.Schema(
  {
    /*
      The five fields, and the only five. Adding a sixth is a product decision
      about how much a stranger is asked for before they are let in, not a
      schema change to slip in — which is why the count is written down here.
    */
    name: { type: String, required: true, trim: true, maxlength: 60 },
    // No `index: true` — the partial unique index below already covers it, and
    // declaring both makes Mongoose build two indexes on the same key.
    email: { type: String, required: true, lowercase: true, trim: true },
    mobile: { type: String, required: true, trim: true, maxlength: 20 },
    /** Why they want in. The field that actually decides approve or reject. */
    reason: { type: String, default: '', trim: true, maxlength: 300 },
    passwordHash: { type: String, required: true, select: false },

    status: { type: String, enum: SIGNUP_STATUSES, default: 'pending', index: true },
    context: { type: contextSchema, default: () => ({}) },

    decidedAt: { type: Date, default: null },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // Copied in, like AuditLog's actor email: a decision signed by nobody,
    // because the account was deleted, reads as the machine having decided.
    decidedByName: { type: String, default: '' },
    /** Why it was refused. Sent to the applicant when there is one. */
    note: { type: String, default: '', trim: true, maxlength: 500 },

    /** The account this became. Absent unless approved. */
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

/*
  One *pending* request per address, not one request per address ever.

  A plain unique index would mean a rejected applicant can never apply again,
  and an approved one leaves a row that blocks the address forever even after
  the account is deleted. The partial filter says the thing actually meant: a
  queue cannot hold the same person twice.
*/
signupRequestSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } },
);

// The queue, newest first, and the same index serves an unfiltered list.
signupRequestSchema.index({ status: 1, createdAt: -1 });

/**
 * A request as the panel receives it.
 *
 * Built by listing what goes in rather than deleting what must not: the hash is
 * `select: false`, and this is the second wall — a field is in the response
 * because it was named here, so a column added to the schema later cannot leak
 * by being forgotten.
 */
export const signupRow = (row) => ({
  _id: row._id,
  name: row.name,
  email: row.email,
  mobile: row.mobile,
  reason: row.reason || '',
  status: row.status,
  context: {
    ip: row.context?.ip || '',
    city: row.context?.city || '',
    region: row.context?.region || '',
    country: row.context?.country || '',
    device: row.context?.device || '',
    browser: row.context?.browser || '',
    os: row.context?.os || '',
  },
  note: row.note || '',
  decidedAt: row.decidedAt ?? null,
  decidedBy: row.decidedByName || '',
  user: row.user ?? null,
  createdAt: row.createdAt,
});

export const SignupRequest = mongoose.model('SignupRequest', signupRequestSchema);
