import mongoose from 'mongoose';
import { urlFor } from '../services/s3.service.js';

/**
 * One object in S3, as this app records it.
 *
 * The collection is the index; S3 is only the bytes. Everything a list view
 * needs — name, size, type, owner, when — is here, so rendering a page of files
 * costs one Mongo query and zero calls to AWS. S3 is touched only to move the
 * bytes themselves.
 *
 * What is deliberately *not* stored is a signed URL. A signed link expires
 * (15 minutes by default), so a `url` column on a private bucket would hold a
 * value that is wrong within the hour and would have to be rewritten on every
 * read — a write amplification for something that can simply be derived. `key`
 * is the load-bearing field instead, the same role `publicId` plays for
 * Cloudinary in the User model's assetSchema.
 *
 * That costs nothing, which is the part worth knowing: presigning is local HMAC
 * over already-cached credentials, not an API call. Deriving a fresh URL per
 * request involves no round trip to AWS at all, so there is no cache to keep and
 * no staleness to manage.
 *
 * `url` below is therefore only ever the *permanent* kind — set when the bucket
 * is public or fronted by CloudFront, null otherwise.
 */

/** Coarse buckets for filtering a file list without parsing MIME strings in a query. */
export const FILE_KINDS = ['image', 'document', 'other'];

export const kindFor = (contentType = '') => {
  if (contentType.startsWith('image/')) return 'image';
  if (contentType === 'application/pdf') return 'document';
  return 'other';
};

const fileSchema = new mongoose.Schema(
  {
    /**
     * The S3 object key. The handle for everything: reading, signing, copying,
     * deleting. Unique because two rows pointing at one object means deleting
     * either one breaks the other.
     */
    key: { type: String, required: true, unique: true, index: true },

    /**
     * Which bucket the key lives in, copied in rather than read from config at
     * use time. A row written today must still resolve after the bucket is
     * renamed or the app is pointed at a second one — config tells you where
     * new files go, not where old ones went.
     */
    bucket: { type: String, required: true },
    region: { type: String, default: '' },

    /**
     * A permanent URL, and only ever a permanent one — CloudFront or a public
     * bucket. Null on a private bucket, where the correct answer is a
     * short-lived signed URL that must not be persisted. See `attachUrls`.
     */
    url: { type: String, default: null },

    /** What the user called it. Shown in the UI; never used to build the key. */
    originalName: { type: String, required: true, trim: true, maxlength: 255 },

    /**
     * The sniffed type, never the browser's claim.
     *
     * S3 replays this header on every GET, so whatever is recorded here is what
     * every future visitor's browser is told the file is. It comes from
     * `resolveContentType` reading the file's magic numbers — see the note at
     * the top of s3.service.js for why the declared type is worthless here.
     */
    contentType: { type: String, required: true },
    // Derived from contentType on save, so a list can filter on it directly.
    kind: { type: String, enum: FILE_KINDS, default: 'other', index: true },

    bytes: { type: Number, default: 0 },
    /** S3's ETag, quotes stripped. Cheap way to tell whether bytes changed. */
    etag: { type: String, default: '' },
    // Images only, and only when something bothered to measure them.
    width: { type: Number, default: null },
    height: { type: Number, default: null },

    /**
     * Whose file this is, and who put it there.
     *
     * Two fields because they genuinely differ: an admin uploading a document
     * on a learner's behalf makes the learner the `owner` and the admin the
     * `requestedBy`. Authorisation reads `owner`; the audit trail reads
     * `requestedBy`. Collapsing them would make "who did this" unanswerable in
     * exactly the case where it is asked.
     */
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    /**
     * Denormalised for the same reason AuditLog copies the actor's email: a row
     * that reads "uploaded by 65f3…" after the account is deleted records
     * nothing, and a populate against a deleted user yields null.
     */
    requestedByEmail: { type: String, default: '' },

    /**
     * What the file is *for* — 'avatar', 'guide-attachment', 'resume'.
     *
     * Free-form rather than an enum: the set grows every time a feature learns
     * to accept a file, and pinning it here would make each of those a schema
     * change plus a migration for rows that were already fine.
     */
    purpose: { type: String, default: 'general', index: true, maxlength: 60 },

    /**
     * The record this file hangs off, if any — a problem, a guide, a user.
     *
     * Deliberately a loose (type, id) pair rather than a real ref: files attach
     * to several unrelated collections, and Mongoose's `refPath` would demand
     * every one of them be named here and kept in step forever.
     */
    linkedTo: {
      type: { type: String, default: '' },
      id: { type: String, default: '' },
    },

    /**
     * Whether the bytes actually arrived.
     *
     * `pending` exists for the presigned-PUT path, where the row is written when
     * the upload URL is handed out and the browser uploads straight to S3 —
     * meaning the server never observes the transfer and cannot know it
     * finished. A row stuck at `pending` is an abandoned upload, and it is the
     * only reliable way to find the orphaned object it may have left behind.
     * Server-side uploads go straight to `ready`.
     */
    status: {
      type: String,
      enum: ['pending', 'ready', 'failed'],
      default: 'ready',
      index: true,
    },

    /** Anything a caller wants to keep that has no column. Page counts, etc. */
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    tags: { type: [String], default: [] },

    /**
     * Soft delete, and not merely as a safety net.
     *
     * A file lives in two places, and they cannot be removed atomically. If the
     * row is dropped first and the S3 delete then fails, the key is gone from
     * the only index that knew about it — the object is orphaned, unreferenced
     * and unbillable to anyone, and nothing can ever find it again. Marking the
     * row instead keeps the key discoverable until the bytes are confirmed
     * gone, at which point the row can be hard-deleted by the sweeper.
     *
     * It also makes an accidental delete recoverable for as long as the sweep
     * has not run, which on a user-facing "delete my document" button is worth
     * having on its own.
     */
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    /** Set once the S3 object is confirmed gone — the row is then safe to drop. */
    purgedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// The common reads: one user's files, newest first, and one purpose's.
fileSchema.index({ owner: 1, deletedAt: 1, createdAt: -1 });
fileSchema.index({ purpose: 1, deletedAt: 1, createdAt: -1 });
// "what is attached to this problem/guide"
fileSchema.index({ 'linkedTo.type': 1, 'linkedTo.id': 1, deletedAt: 1 });
// The sweeper's query: deleted, not yet purged.
fileSchema.index({ deletedAt: 1, purgedAt: 1 });

/** `kind` is derived, never passed in — one source of truth for it. */
fileSchema.pre('save', function setKind(next) {
  if (this.isModified('contentType')) this.kind = kindFor(this.contentType);
  next();
});

/**
 * Records an upload. Idempotent on `key`, which is what makes a retried request
 * update the existing row instead of creating a second one for the same object.
 *
 * @param {object} asset  the record `uploadObject` returns
 * @param {object} [extra]  owner, requestedBy, purpose, linkedTo, tags, meta
 */
fileSchema.statics.record = function record(asset, extra = {}) {
  const { key, bucket, contentType, bytes, etag } = asset;
  return this.findOneAndUpdate(
    { key },
    {
      $set: {
        key,
        bucket,
        contentType,
        bytes,
        etag,
        kind: kindFor(contentType),
        status: 'ready',
        // A re-upload to the same key un-deletes it: the bytes are back.
        deletedAt: null,
        deletedBy: null,
        purgedAt: null,
        ...extra,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
};

/** Live files only — the default every read should start from. */
fileSchema.statics.live = function live(filter = {}) {
  return this.find({ ...filter, deletedAt: null, status: 'ready' });
};

/**
 * Marks a file deleted without touching S3.
 *
 * The bytes are removed by the sweeper afterwards, for the reason `deletedAt`
 * documents above. Callers that want both should use the file service rather
 * than reaching for `deleteObject` here.
 */
fileSchema.statics.softDelete = function softDelete(key, userId = null) {
  return this.findOneAndUpdate(
    { key, deletedAt: null },
    { $set: { deletedAt: new Date(), deletedBy: userId } },
    { new: true },
  );
};

/**
 * Fills in a usable URL for each file, permanent or signed as the bucket
 * requires.
 *
 * Async and batched because signing is per-object. It is local HMAC rather than
 * a network call, so a page of fifty costs microseconds and no AWS traffic —
 * but it cannot be a Mongoose virtual, which must be synchronous.
 *
 * Takes and returns plain objects, so it composes with `.lean()`.
 */
fileSchema.statics.attachUrls = async function attachUrls(files, options = {}) {
  const list = Array.isArray(files) ? files : [files];
  const withUrls = await Promise.all(
    list.map(async (file) => {
      if (!file) return file;
      const plain = typeof file.toObject === 'function' ? file.toObject() : { ...file };
      plain.url = plain.url || (await urlFor(plain.key, options));
      return plain;
    }),
  );
  return Array.isArray(files) ? withUrls : withUrls[0];
};

fileSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

/**
 * The shape the client receives.
 *
 * `bucket`, `region` and `key` are infrastructure — they tell a reader exactly
 * where the object sits and invite a direct request for it, so they stay on the
 * server. The client gets a URL and the facts it renders.
 */
export const publicFile = (file) => ({
  id: file._id,
  name: file.originalName,
  url: file.url ?? null,
  contentType: file.contentType,
  kind: file.kind,
  bytes: file.bytes,
  width: file.width ?? null,
  height: file.height ?? null,
  purpose: file.purpose,
  tags: file.tags ?? [],
  createdAt: file.createdAt,
});

export const File = mongoose.model('File', fileSchema);
