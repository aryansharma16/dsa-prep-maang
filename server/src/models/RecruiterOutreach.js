import mongoose from 'mongoose';

/**
 * One user's outreach progress with one recruiter: where it stands and a note.
 *
 * Kept apart from Recruiter because contacts are shared and progress is not.
 * A row exists only once someone moves a contact off "new" or writes a note;
 * no row means "not contacted".
 */
export const RECRUITER_STATUSES = ['new', 'messaged', 'replied', 'call', 'closed'];

const outreachSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    recruiter: { type: mongoose.Schema.Types.ObjectId, ref: 'Recruiter', required: true },
    status: { type: String, enum: RECRUITER_STATUSES, default: 'new' },
    note: { type: String, trim: true, maxlength: 1000, default: '' },
    contactedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

outreachSchema.index({ user: 1, recruiter: 1 }, { unique: true });
outreachSchema.index({ user: 1, status: 1 });

export const RecruiterOutreach = mongoose.model('RecruiterOutreach', outreachSchema);
