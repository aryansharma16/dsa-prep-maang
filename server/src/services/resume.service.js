import { createHash } from 'node:crypto';

import { Application } from '../models/Application.js';
import { Resume } from '../models/Resume.js';
import { ApiError } from '../utils/ApiError.js';
import { destroyAsset, folderFor, privateDownloadUrl, uploadBuffer } from './media.service.js';

/**
 * The CV library behind the Applications module.
 *
 * Three rules, and every function below exists to keep one of them:
 *
 *   1. **The same file is never stored twice.** Identity is the SHA-256 of the
 *      bytes, computed here from what arrived rather than trusted from the
 *      client, and `{ user, hash }` is unique in the database. See
 *      models/Resume.js for the whole argument.
 *   2. **An application never loses track of which CV it was sent with.** It
 *      carries a snapshot of the label and URL beside the reference, so
 *      deleting a CV from the library leaves a readable line rather than a
 *      blank one.
 *   3. **`usedCount` is recounted, never incremented.** An increment has to be
 *      right for attach, swap, detach, soft-delete and restore separately;
 *      a count is right by construction.
 */

/** Cloudinary keeps CVs apart from avatars, under the app's own prefix. */
const RESUME_FOLDER = 'resumes';

/** A CV is two pages. Anything above this is somebody picking the wrong file. */
export const MAX_RESUME_BYTES = 8 * 1024 * 1024;

export const MAX_RESUMES = 40;

export const sha256 = (input) => createHash('sha256').update(input).digest('hex');

/**
 * The same link, whoever typed it.
 *
 * Lower-cased host, no trailing slash, and the tracking parameters Google Drive
 * and LinkedIn bolt on stripped — otherwise the one link pasted from a phone
 * and from a laptop is two rows, and the dedupe promise quietly fails for links
 * while holding for files.
 */
export function normaliseLink(raw) {
  let url;
  try {
    url = new URL(String(raw).trim());
  } catch {
    throw ApiError.badRequest('That is not a link', 'BAD_URL');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw ApiError.badRequest('Only http and https links', 'BAD_URL');
  }
  url.hostname = url.hostname.toLowerCase();
  url.hash = '';
  ['usp', 'utm_source', 'utm_medium', 'utm_campaign', 'trk'].forEach((key) =>
    url.searchParams.delete(key),
  );
  return url.toString().replace(/\/+$/, '');
}

/** One CV, or a 404 — the ownership rule every lookup in this app follows. */
export async function ownedResume(id, userId) {
  const resume = await Resume.findOne({ _id: id, user: userId });
  if (!resume) throw ApiError.notFound('Resume not found');
  return resume;
}

async function assertLibraryRoom(userId) {
  const count = await Resume.countDocuments({ user: userId });
  if (count >= MAX_RESUMES) {
    throw ApiError.badRequest(
      `That is ${MAX_RESUMES} CVs. Delete an old one before adding another.`,
      'TOO_MANY_RESUMES',
    );
  }
}

/**
 * Create a row, or return the one that already has this hash.
 *
 * The `11000` catch is the race the unique index exists for: two tabs miss the
 * lookup at the same instant, both try to insert, and the loser is handed the
 * winner's row instead of an error. `onDuplicate` lets the upload path clean up
 * the object it just put in the cloud when it turns out to have lost.
 */
async function insertOrExisting(doc, { onDuplicate } = {}) {
  try {
    return { resume: await Resume.create(doc), existed: false };
  } catch (err) {
    if (err?.code !== 11000) throw err;
    await onDuplicate?.();
    return {
      resume: await Resume.findOne({ user: doc.user, hash: doc.hash }),
      existed: true,
    };
  }
}

/**
 * "Do I already have this one?" — asked before the browser sends any bytes.
 *
 * This is what makes re-attaching a CV free. The client hashes the file
 * locally and asks; on a hit it links the existing row and the upload never
 * happens. The answer is only a shortcut — `storeUpload` re-hashes whatever
 * actually arrives, so a client that lies about a hash can only ever fail to
 * save itself an upload.
 */
export async function findByHash(userId, hash) {
  if (!/^[a-f0-9]{64}$/.test(hash || '')) return null;
  return Resume.findOne({ user: userId, hash });
}

export async function storeUpload(userId, file, { label = '' } = {}) {
  if (!file?.buffer?.length) throw ApiError.badRequest('No file', 'NO_FILE');

  const hash = sha256(file.buffer);

  /* The same file sent a second time is a lookup, not an upload. */
  const known = await Resume.findOne({ user: userId, hash });
  if (known) return { resume: known, existed: true };

  await assertLibraryRoom(userId);

  /*
    `raw`, not `image`. Cloudinary will ingest a PDF as an image and serve page
    renders of it, but a .docx would be refused, and a CV should come back out
    as the exact file that went in — which is what `raw` does.

    The public id *is* the hash, so even Cloudinary's side of this cannot hold
    two copies: a re-upload that somehow got past both checks above lands on
    the same object rather than beside it.
  */
  const extension = (file.originalname.match(/\.([a-z0-9]{1,5})$/i)?.[1] || '').toLowerCase();
  const asset = await uploadBuffer(file.buffer, {
    folder: folderFor(RESUME_FOLDER, String(userId)),
    publicId: extension ? `${hash}.${extension}` : hash,
    resourceType: 'raw',
    tags: ['resume'],
  });

  const name = file.originalname.slice(0, 200);
  return insertOrExisting(
    {
      user: userId,
      hash,
      label: (label || name.replace(/\.[a-z0-9]{1,5}$/i, '')).slice(0, 80),
      name,
      source: 'upload',
      url: asset.url,
      publicId: asset.publicId,
      bytes: asset.bytes || file.buffer.length,
      format: extension || asset.format || '',
    },
    /* Same hash, same public id — the object we "created" is the winner's. */
    { onDuplicate: () => {} },
  );
}

export async function storeLink(userId, raw, { label = '' } = {}) {
  const url = normaliseLink(raw);
  const hash = sha256(`link:${url}`);

  const known = await Resume.findOne({ user: userId, hash });
  if (known) return { resume: known, existed: true };

  await assertLibraryRoom(userId);

  const host = new URL(url).hostname.replace(/^www\./, '');
  return insertOrExisting({
    user: userId,
    hash,
    label: (label || `Link — ${host}`).slice(0, 80),
    name: url.slice(0, 200),
    source: 'link',
    url,
  });
}

/**
 * Recount how many live applications name each of these CVs.
 *
 * Called after any write that could change the answer, with just the ids that
 * could have moved — one `countDocuments` per CV touched, which is one or two.
 */
export async function recount(userId, ids = []) {
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  await Promise.all(
    unique.map(async (id) => {
      const usedCount = await Application.countDocuments({
        user: userId,
        deletedAt: null,
        'resume.id': id,
      });
      await Resume.updateOne({ _id: id, user: userId }, { $set: { usedCount } });
    }),
  );
}

/**
 * Remove a CV from the library.
 *
 * The applications that were sent it keep their snapshot — see the note on the
 * model — and lose only the live reference, so their drawer still says which
 * version they got. The Cloudinary object goes too, unless the row was a pasted
 * link, where there is nothing of ours to delete.
 */
export async function removeResume(userId, id) {
  const resume = await ownedResume(id, userId);

  await Application.updateMany(
    { user: userId, 'resume.id': resume._id },
    { $set: { 'resume.id': null } },
  );

  await resume.deleteOne();
  if (resume.publicId) await destroyAsset(resume.publicId, 'raw');

  return resume;
}

/** What a stored format is served as. Anything else goes out as a download. */
const CONTENT_TYPES = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

/**
 * Open a CV: where to send the browser, or the bytes to send it.
 *
 * A pasted link is a redirect — the file is somebody else's to serve. An
 * uploaded one is fetched from Cloudinary here, through the signed API
 * download, and streamed back from this app, for two reasons:
 *
 *   - It is the only way it opens at all on an account that blocks PDF
 *     delivery, which new Cloudinary accounts do by default.
 *   - It is also the right way. A CV carries a phone number, an email and
 *     often an address, and a public CDN URL is readable by anyone it is ever
 *     pasted to. Served from here, reading it takes this account's session.
 */
export async function resumeFile(userId, id) {
  const resume = await ownedResume(id, userId);

  if (resume.source === 'link' || !resume.publicId) return { redirect: resume.url };

  let upstream;
  try {
    upstream = await fetch(privateDownloadUrl(resume.publicId));
  } catch {
    upstream = null;
  }
  if (!upstream?.ok || !upstream.body) {
    throw new ApiError(502, 'Could not fetch that CV from storage', 'RESUME_UNAVAILABLE');
  }

  return {
    body: upstream.body,
    length: upstream.headers.get('content-length'),
    type: CONTENT_TYPES[resume.format] || 'application/octet-stream',
    name: resume.name || `${resume.label || 'cv'}.${resume.format || 'pdf'}`,
  };
}

/** The snapshot an application stores, written from the row and never from the request. */
export const resumeSnapshot = (resume) => ({
  id: resume._id,
  label: resume.label || resume.name || 'Untitled',
  url: resume.url,
});
