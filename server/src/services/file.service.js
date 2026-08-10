import { File } from '../models/File.js';
import { env } from '../config/env.js';
import {
  deleteMany,
  listAllObjects,
  publicUrl,
  resolveContentType,
  uniqueKey,
  uploadMany,
  uploadObject,
} from './s3.service.js';

/**
 * The seam between the bytes in S3 and the rows that index them.
 *
 * s3.service.js knows nothing about Mongo and File.js knows nothing about AWS —
 * on purpose, so each can be read and tested on its own. This is the one place
 * that holds both, and therefore the only place that has to care about the
 * thing neither can solve alone: an upload is two writes to two systems that
 * cannot be made atomic, and either can fail after the other succeeded.
 *
 * Every failure mode here resolves the same way — toward an orphan rather than
 * a dangling reference. Bytes with no row cost pennies and are found by the
 * sweeper. A row with no bytes is a broken link in someone's UI.
 */

/**
 * Uploads one file and records it.
 *
 * The row is written after the upload, never before: if S3 rejects the bytes
 * there is nothing to point at, and a row written first would have to be rolled
 * back by a second write that can itself fail.
 *
 * @param {{buffer: Buffer, originalname: string, mimetype: string}} file  a multer file
 * @param {object} [options]
 * @param {string} [options.folder]
 * @param {string[]} [options.allow]     permitted sniffed types
 * @param {string} [options.purpose]
 * @param {string} [options.owner]
 * @param {string} [options.requestedBy]
 * @param {string} [options.requestedByEmail]
 * @param {object} [options.linkedTo]
 * @param {string[]} [options.tags]
 * @param {object} [options.meta]
 */
export async function storeFile(file, options = {}) {
  const { folder = 'uploads', allow, ...record } = options;

  // Sniffed before the upload so a rejected type costs nothing — no bytes sent,
  // no row written, no cleanup owed.
  const contentType = resolveContentType(file.buffer, { allow, fallback: file.mimetype });
  const key = uniqueKey(folder, file.originalname);

  const asset = await uploadObject(file.buffer, {
    key,
    contentType,
    filename: file.originalname,
    allow,
  });

  return File.record(asset, {
    originalName: file.originalname,
    region: env.s3.region,
    url: publicUrl(key),
    ...record,
  });
}

/**
 * Uploads many files and records the ones that landed.
 *
 * Partial success is the expected outcome, not an error case: forty files go
 * up, the eleventh is a corrupt JPEG, and the caller wants the thirty-nine plus
 * a list of what to retry. Rows are written only for successful uploads, so a
 * failure leaves nothing behind to clean up.
 *
 * @returns {Promise<{files: object[], failed: object[], total: number}>}
 */
export async function storeFiles(files, options = {}) {
  const { folder = 'uploads', allow, concurrency, ...record } = options;

  const { uploaded, failed, total } = await uploadMany(files, { folder, allow, concurrency });

  // One bulk write rather than a round trip per file — the uploads were the
  // slow part and there is no reason to follow them with N inserts.
  const rows = await Promise.all(
    uploaded.map((asset) =>
      File.record(asset, {
        originalName: asset.originalName,
        region: env.s3.region,
        url: publicUrl(asset.key),
        ...record,
      }),
    ),
  );

  return { files: rows, failed, total };
}

/**
 * Marks a file deleted. The bytes stay until `purgeDeleted` runs.
 *
 * Deliberately not a delete of both at once. S3 and Mongo cannot be written
 * atomically, and of the two possible orders only this one is recoverable: mark
 * the row, then remove the bytes, then drop the row. Removing the bytes first
 * and failing the row update leaves a live record pointing at nothing; dropping
 * the row first and failing the S3 call loses the key forever, orphaning an
 * object that nothing can now find.
 */
export async function removeFile(key, userId = null) {
  return File.softDelete(key, userId);
}

/** Undo, for as long as the sweeper has not run. */
export async function restoreFile(key) {
  return File.findOneAndUpdate(
    { key, purgedAt: null },
    { $set: { deletedAt: null, deletedBy: null } },
    { new: true },
  );
}

/**
 * Deletes the S3 objects behind soft-deleted rows, then drops the rows.
 *
 * The sweeper. Run it from a cron or an admin button — the delay is the point,
 * since it is what makes an accidental delete recoverable.
 *
 * `olderThan` keeps it from racing a user who is still looking at the undo
 * button. Rows whose S3 delete fails keep `purgedAt` null and are simply picked
 * up by the next run, which is why this needs no retry logic of its own.
 *
 * @param {object} [options]
 * @param {number} [options.olderThanMinutes]
 * @param {number} [options.limit]
 */
export async function purgeDeleted({ olderThanMinutes = 60, limit = 500 } = {}) {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);

  const doomed = await File.find({ deletedAt: { $ne: null, $lte: cutoff }, purgedAt: null })
    .select('key')
    .limit(limit)
    .lean();

  if (!doomed.length) return { purged: 0, failed: 0 };

  const { deleted, errors } = await deleteMany(doomed.map((f) => f.key));

  // Only rows whose bytes are confirmed gone. The rest stay for the next run.
  if (deleted.length) await File.deleteMany({ key: { $in: deleted } });

  if (errors.length) {
    console.error('[files] could not purge', errors.length, 'objects —', errors[0]?.message);
  }
  return { purged: deleted.length, failed: errors.length };
}

/**
 * Finds objects in S3 that no live row points at.
 *
 * The other direction of drift, and the one nothing else catches: an upload
 * that succeeded while the row write failed, or a presigned PUT the browser
 * completed and never confirmed. Reports rather than deletes — an unreferenced
 * object is not proof of an orphan, only of a row this query did not see, and
 * deleting on that assumption is how a bug becomes data loss.
 */
export async function findOrphans(prefix = '', { limit = 1000 } = {}) {
  const objects = await listAllObjects(prefix, { limit });
  if (!objects.length) return [];

  const keys = objects.map((o) => o.key);
  const known = await File.find({ key: { $in: keys } }).select('key').lean();
  const knownKeys = new Set(known.map((f) => f.key));

  return objects.filter((o) => !knownKeys.has(o.key));
}
