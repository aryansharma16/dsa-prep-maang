import mongoose from 'mongoose';

/**
 * The CVs you have sent, one row per distinct file.
 *
 * A library rather than a field on the application, and that shape is the whole
 * feature. A job hunt uses three or four CVs across fifty applications — the
 * general one, the one rewritten for backend roles, the one with the new
 * project on it — so storing the file against each application would mean the
 * same two pages uploaded fifty times, fifty URLs for one document, and no way
 * to ask the only question worth asking: *which version actually gets replies*.
 *
 * ---------------------------------------------------------------------------
 * `hash` is the identity, and `{ user, hash }` is unique.
 *
 * SHA-256 of the bytes, computed from what the server received rather than from
 * anything the client claimed. Re-attaching a CV you have already sent
 * somewhere is then not an upload at all: the browser hashes the file, asks
 * whether that hash exists, and on a hit it links the row that is already there
 * and never sends the bytes. On a miss it uploads, and the server hashes again
 * before storing — so two tabs racing the same new file end up with one row and
 * one object in the cloud rather than two of each.
 *
 * A pasted link has no bytes to hash, so it hashes its normalised URL instead.
 * The same Google Drive link pasted against four applications is one row, which
 * is the same promise by the same mechanism.
 * ---------------------------------------------------------------------------
 *
 * Deleting a row does not orphan the applications that point at it: they carry
 * a snapshot of the label and the URL beside the reference, the same ref-plus-
 * snapshot arrangement `postMortem` uses, for the same reason. A dangling id
 * renders as a blank line, which reads as corruption; a dangling label reads as
 * history, and "I sent them the backend one" stays true after you tidy up.
 */

export const RESUME_SOURCES = ['upload', 'link'];

/** What a resume is for, set in Interview Helper → Resume Building's bank. */
export const RESUME_KINDS = ['general', 'company', 'role'];

const resumeSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    /** SHA-256 of the file's bytes, or of the normalised URL for a link. */
    hash: { type: String, required: true },

    /**
     * What you call this version — "Backend, Nov", "General v3".
     *
     * Defaults to the filename, because that is usually already the label
     * somebody chose, and an untitled row in a picker of four is useless.
     */
    label: { type: String, default: '', trim: true, maxlength: 80 },

    /** The original filename, kept even after the label is edited. */
    name: { type: String, default: '', trim: true, maxlength: 200 },

    source: { type: String, enum: RESUME_SOURCES, default: 'upload' },

    /** Where it can be read. A Cloudinary delivery URL, or the link you pasted. */
    url: { type: String, required: true, maxlength: 2000 },

    /**
     * Cloudinary's handle, so the object can be deleted with the row.
     *
     * Null for a pasted link — there is nothing of ours to delete, and trying
     * would be this app reaching into somebody else's Drive.
     */
    publicId: { type: String, default: null },

    bytes: { type: Number, default: 0 },
    format: { type: String, default: '' },

    /**
     * How many live applications name this CV.
     *
     * Denormalised so the picker can say "sent to 11" without counting across
     * the collection on every render, and recomputed by the service whenever an
     * application's resume changes rather than incremented — the argument the
     * application's own derived fields already make about drift.
     */
    usedCount: { type: Number, default: 0 },

    // The resume bank (Interview Helper → Resume Building). All optional, so
    // rows created from Applications keep working unchanged.
    kind: { type: String, enum: RESUME_KINDS, default: 'general' },
    company: { type: String, default: '', trim: true, maxlength: 80 },
    role: { type: String, default: '', trim: true, maxlength: 80 },
    notes: { type: String, default: '', trim: true, maxlength: 300 },
    // Versions: every version points at the first one in its line (`family`),
    // so the bank can show the latest and keep the older ones underneath.
    family: { type: mongoose.Schema.Types.ObjectId, ref: 'Resume', default: null },
  },
  { timestamps: true },
);

/*
  The dedupe, enforced by the database rather than by the check that precedes
  it. The service looks the hash up first and skips the upload on a hit; this is
  what makes that correct when two tabs look it up at the same instant and both
  miss.
*/
resumeSchema.index({ user: 1, hash: 1 }, { unique: true });
/* The picker: this account's CVs, newest first. */
resumeSchema.index({ user: 1, createdAt: -1 });

resumeSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

export const publicResume = (resume) => ({
  id: resume._id,
  label: resume.label || resume.name || 'Untitled',
  name: resume.name || '',
  source: resume.source,
  url: resume.url,
  bytes: resume.bytes || 0,
  format: resume.format || '',
  usedCount: resume.usedCount || 0,
  kind: resume.kind || 'general',
  company: resume.company || '',
  role: resume.role || '',
  notes: resume.notes || '',
  family: resume.family ? String(resume.family) : null,
  createdAt: resume.createdAt,
});

export const Resume = mongoose.model('Resume', resumeSchema);
