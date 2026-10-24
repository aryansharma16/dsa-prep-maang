import mongoose from 'mongoose';

/**
 * One recruiter contact in the MAANG Recruiter Directory.
 *
 * The directory is shared: every signed-in user sees the `shared` contacts,
 * and anyone can add one. Only the person who added a contact (`owner`) can
 * edit or delete it; the super admin can edit or delete any of them.
 *
 * `private` contacts are seen by their owner (and the super admin) only.
 *
 * `locked` contacts are the directory's base list (the imported 100). Everyone
 * sees them and nobody, the super admin included, can edit or delete them
 * through the API; change them by re-running the import script.
 *
 * Outreach progress (status, note) is per user, in RecruiterOutreach, so one
 * person marking a recruiter "messaged" does not change it for anybody else.
 */
export const RECRUITER_SENIORITY = [
  'entry',
  'senior',
  'partner',
  'manager',
  'director',
  'head',
  'vp',
  'other',
];
export const RECRUITER_VISIBILITY = ['shared', 'private'];

const recruiterSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    visibility: { type: String, enum: RECRUITER_VISIBILITY, default: 'shared', index: true },
    locked: { type: Boolean, default: false },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    title: { type: String, trim: true, maxlength: 160, default: '' },
    seniority: { type: String, enum: RECRUITER_SENIORITY, default: 'other' },
    company: { type: String, required: true, trim: true, maxlength: 80 },
    location: { type: String, trim: true, maxlength: 120, default: '' },
    phone: { type: String, trim: true, maxlength: 40, default: '' },
    email: { type: String, trim: true, lowercase: true, maxlength: 160, default: '' },
    linkedin: { type: String, trim: true, maxlength: 300, default: '' },
  },
  { timestamps: true },
);

recruiterSchema.index({ company: 1, name: 1 });

export const Recruiter = mongoose.model('Recruiter', recruiterSchema);

/** The shape the client gets, with this viewer's outreach and permissions folded in. */
export const recruiterCard = (r, { viewerId, admin, outreach }) => {
  const ownerId = String(r.owner?._id || r.owner);
  const mine = ownerId === String(viewerId);
  return {
    id: String(r._id),
    name: r.name,
    title: r.title,
    seniority: r.seniority,
    company: r.company,
    location: r.location,
    phone: r.phone,
    email: r.email,
    linkedin: r.linkedin,
    visibility: r.visibility,
    locked: Boolean(r.locked),
    mine: mine && !r.locked,
    canEdit: !r.locked && (mine || admin),
    addedBy: r.locked ? 'Directory' : mine ? 'You' : r.owner?.name || 'Someone',
    status: outreach?.status || 'new',
    note: outreach?.note || '',
    contactedAt: outreach?.contactedAt || null,
  };
};
