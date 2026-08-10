import { randomUUID } from 'node:crypto';
import path from 'node:path';
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Everything this app stores in S3 goes through here.
 *
 * Same bargain as media.service.js: callers hand over bytes and a key and get
 * back a small, storable record. Nobody outside this file imports the SDK, so
 * the day a bucket moves region or a key scheme changes, it changes once.
 *
 * Nothing touches disk. Multer holds the file in memory and it is streamed
 * straight out, which is what makes this safe on a host with a read-only or
 * ephemeral filesystem.
 *
 * Where this genuinely differs from Cloudinary, and the reason `sniffType`
 * below exists: Cloudinary decodes what you send it and refuses anything that
 * is not an image under `resource_type: 'image'`. S3 does not. S3 is a byte
 * store — it will accept a renamed executable, label it `image/png` because the
 * request said so, and serve it back with that Content-Type forever. The
 * server-side guarantee that came free with Cloudinary has to be rebuilt here,
 * so it is, from the file's own leading bytes.
 */

/* -------------------------------------------------------------------------- */
/* client                                                                      */
/* -------------------------------------------------------------------------- */

let client = null;

/**
 * Builds the client once, lazily — importing this module must have no effect
 * and must never reach for a credential.
 *
 * There is no `credentials` option here, and that omission is the entire
 * credential strategy. Passing nothing is what makes the SDK run its default
 * provider chain, which ends at the EC2 instance metadata service — so on the
 * deployed box the app picks up MAANGPrepEC2S3Role automatically, gets
 * short-lived credentials, and has them rotated for it before they expire.
 *
 * Setting them explicitly from env vars would *disable* that. Long-lived IAM
 * user keys are the thing the instance role exists to avoid: they sit in a file
 * on disk, they do not rotate, and they stay valid until somebody remembers to
 * revoke them. The chain also covers a laptop — env vars, SSO, then
 * `~/.aws/credentials` — so there is nothing this would buy.
 */
function useS3() {
  if (!env.s3.configured) {
    throw new ApiError(
      503,
      'File storage is not configured on this server',
      'STORAGE_DISABLED',
    );
  }
  if (!client) {
    client = new S3Client({
      region: env.s3.region,
      // Three attempts, exponential backoff. S3 answers 503 SlowDown under
      // burst — a bulk upload is exactly the shape that provokes it, and the
      // retry is the difference between a slow request and a failed one.
      maxAttempts: 3,
    });
  }
  return client;
}

export const storageEnabled = () => env.s3.configured;

/** Test seam — drops the memoised client so a new region/bucket takes effect. */
export function resetClient() {
  client = null;
}

/* -------------------------------------------------------------------------- */
/* keys                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * A key under the app's own prefix, so nothing lands at the bucket root.
 *
 * The S3 analogue of media.service's `folderFor`. S3 has no directories — the
 * slashes are just characters in a flat key — but the console renders them as
 * folders and `listObjects`/`deletePrefix` scope on them, so the convention
 * earns its keep.
 */
export const keyFor = (...parts) =>
  [env.s3.prefix, ...parts]
    .filter(Boolean)
    .map((part) => String(part).replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/');

/**
 * Makes one path segment safe to sit in a key.
 *
 * A filename arrives from the client and is therefore hostile input. Three
 * things are being prevented: `../` climbing out of the intended prefix, control
 * characters and quotes that break the Content-Disposition header this filename
 * is later interpolated into, and the unbounded length that would otherwise blow
 * past S3's 1024-byte key limit and fail the request at the far end.
 *
 * The extension is preserved separately so a truncated name still ends in
 * `.pdf` — the extension is what most clients use to decide how to open it.
 */
export function safeSegment(name, { maxLength = 80 } = {}) {
  const raw = String(name ?? '').trim();
  const ext = path.extname(raw).slice(0, 12).replace(/[^a-zA-Z0-9.]/g, '');
  const stem = path
    .basename(raw, path.extname(raw))
    // eslint-disable-next-line no-control-regex -- control chars are exactly what this strips
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, maxLength);
  return `${stem || 'file'}${ext.toLowerCase()}`;
}

/**
 * A collision-proof key for a user-supplied filename.
 *
 * Two people uploading `resume.pdf` on the same day must not overwrite each
 * other, and the readable half of the name is worth keeping for whoever reads
 * the bucket later — so: short random prefix, original name after it.
 */
export const uniqueKey = (folder, filename) =>
  keyFor(folder, `${randomUUID().slice(0, 8)}-${safeSegment(filename)}`);

/* -------------------------------------------------------------------------- */
/* content types                                                               */
/* -------------------------------------------------------------------------- */

/**
 * What the bytes actually are, read from their leading magic numbers.
 *
 * `file.mimetype` is the browser's claim and a hand-rolled request can claim
 * anything, so it is worth precisely nothing as a security control. This is the
 * check that holds — it is the S3 replacement for Cloudinary refusing to decode
 * a non-image, and the only reason an upload endpoint here can promise that
 * what it stored as an image is an image.
 *
 * Returns null for anything unrecognised, which callers treat as "not one of
 * the types we accept" rather than "unknown but fine".
 */
export function sniffType(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;

  const hex = buffer.subarray(0, 12).toString('hex');
  const ascii = (start, end) => buffer.subarray(start, end).toString('latin1');

  if (hex.startsWith('ffd8ff')) return 'image/jpeg';
  if (hex.startsWith('89504e470d0a1a0a')) return 'image/png';
  if (ascii(0, 4) === 'GIF8') return 'image/gif';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  // ISO-BMFF: the brand at bytes 8-11 distinguishes AVIF from HEIC and MP4.
  if (ascii(4, 8) === 'ftyp') {
    const brand = ascii(8, 12);
    if (brand === 'avif' || brand === 'avis') return 'image/avif';
    if (brand === 'heic' || brand === 'heix' || brand === 'mif1') return 'image/heic';
  }
  if (ascii(0, 4) === '%PDF') return 'application/pdf';
  return null;
}

export const IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/heic',
];
export const DOCUMENT_TYPES = ['application/pdf'];

/**
 * Resolves the Content-Type to store, rejecting bytes that are not what they
 * claim to be.
 *
 * Stored types are sniffed, never echoed from the request. That matters beyond
 * the upload itself: S3 replays this header on every future GET, so a lie
 * accepted here becomes a lie served to every browser that ever loads the file.
 *
 * @param {Buffer} buffer
 * @param {object} [options]
 * @param {string[]} [options.allow]     permitted sniffed types; omit to allow any known type
 * @param {string} [options.fallback]    type for bytes that sniff to nothing
 * @param {boolean} [options.strict]     reject unrecognised bytes outright
 */
export function resolveContentType(buffer, options = {}) {
  const { allow, fallback = 'application/octet-stream', strict = false } = options;
  const sniffed = sniffType(buffer);

  if (!sniffed) {
    if (strict || allow) {
      throw ApiError.badRequest(
        'That file is not a type this endpoint accepts',
        'BAD_FILE_TYPE',
      );
    }
    return fallback;
  }
  if (allow && !allow.includes(sniffed)) {
    throw ApiError.badRequest(`Unsupported file type: ${sniffed}`, 'BAD_FILE_TYPE');
  }
  return sniffed;
}

/* -------------------------------------------------------------------------- */
/* the stored record                                                           */
/* -------------------------------------------------------------------------- */

/**
 * The subset worth keeping in Mongo.
 *
 * `key` is the field that matters — it is the handle for deleting, copying or
 * signing a URL later, the same role `publicId` plays in media.service. The
 * rest is here so a document can be rendered without a round trip to S3.
 *
 * No `url`: on a private bucket a URL is a short-lived signed thing, and
 * persisting one would mean storing a value that is wrong within the hour.
 * Derive it at read time with `signedGetUrl` or `publicUrl`.
 */
const toAsset = ({ key, contentType, bytes, etag, metadata }) => ({
  key,
  bucket: env.s3.bucket,
  contentType,
  bytes,
  etag: etag ? etag.replace(/"/g, '') : undefined,
  ...(metadata && Object.keys(metadata).length ? { metadata } : {}),
  uploadedAt: new Date(),
});

/** Turns an SDK failure into the shape the rest of the app throws. */
function wrapError(error, fallbackMessage) {
  const status = error?.$metadata?.httpStatusCode;
  if (status === 404 || error?.name === 'NotFound' || error?.name === 'NoSuchKey') {
    return ApiError.notFound('That file does not exist', 'NO_SUCH_KEY');
  }
  if (status === 403 || error?.name === 'AccessDenied') {
    // Almost always the instance role's policy, not the caller's session — say
    // so, because "Forbidden" alone sends people hunting through auth code.
    return new ApiError(
      502,
      'Storage refused the request — check the instance role policy for this bucket',
      'STORAGE_FORBIDDEN',
    );
  }
  return new ApiError(502, error?.message || fallbackMessage, 'STORAGE_FAILED');
}

/* -------------------------------------------------------------------------- */
/* upload                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Uploads a buffer or stream and resolves to an asset record.
 *
 * Goes through lib-storage's `Upload` rather than a bare PutObjectCommand
 * because that one class covers both sizes of this problem: it sends a small
 * buffer as a single PUT, and transparently switches to a parallel multipart
 * upload past the part size. A 40MB PDF and a 20KB avatar take the same code
 * path, and a stream of unknown length works without buffering it first.
 *
 * @param {Buffer|import('node:stream').Readable} body
 * @param {object} options
 * @param {string} options.key                    full key, from `keyFor`/`uniqueKey`
 * @param {string} [options.contentType]          skipped when `allow`/`sniff` resolves one
 * @param {string[]} [options.allow]              permitted sniffed types (buffers only)
 * @param {string} [options.filename]             sets Content-Disposition
 * @param {'inline'|'attachment'} [options.disposition]
 * @param {Record<string,string>} [options.metadata]  x-amz-meta-*, ASCII only
 * @param {string} [options.cacheControl]
 * @param {number} [options.partSize]             bytes per multipart part
 * @param {number} [options.queueSize]            parts in flight
 */
export async function uploadObject(body, options = {}) {
  const s3 = useS3();
  const {
    key,
    allow,
    filename,
    disposition = 'inline',
    metadata,
    // A year, immutable: every key this service writes is either unique per
    // upload or overwritten wholesale, so a cached copy can never be stale in a
    // way the client would need to discover.
    cacheControl = 'public, max-age=31536000, immutable',
    partSize = 5 * 1024 * 1024,
    queueSize = 4,
  } = options;

  if (!key) throw new Error('uploadObject requires a key');

  const isBuffer = Buffer.isBuffer(body);
  const contentType = isBuffer
    ? resolveContentType(body, { allow, fallback: options.contentType || 'application/octet-stream' })
    : options.contentType || 'application/octet-stream';

  try {
    const upload = new Upload({
      client: s3,
      params: {
        Bucket: env.s3.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: cacheControl,
        // Encrypted at rest with the bucket's own key. Costs nothing, and it is
        // the box a compliance review always asks about.
        ServerSideEncryption: 'AES256',
        ...(filename
          ? { ContentDisposition: `${disposition}; filename="${safeSegment(filename)}"` }
          : {}),
        ...(metadata ? { Metadata: sanitizeMetadata(metadata) } : {}),
      },
      partSize,
      queueSize,
    });

    const result = await upload.done();

    return toAsset({
      key,
      contentType,
      bytes: isBuffer ? body.length : undefined,
      etag: result?.ETag,
      metadata,
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw wrapError(error, 'Upload failed');
  }
}

/**
 * S3 metadata is sent as HTTP headers, so it can only carry printable ASCII.
 * A name with an accent in it would otherwise fail the whole upload with a
 * signing error that names no field.
 */
function sanitizeMetadata(metadata) {
  return Object.fromEntries(
    Object.entries(metadata)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([rawKey, value]) => [
        rawKey.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        String(value).replace(/[^\u0020-\u007e]/g, '').slice(0, 1024),
      ]),
  );
}

/**
 * Uploads many files at once, and tells you about each one separately.
 *
 * The result is a per-item report rather than a bare array, because a bulk
 * upload has an outcome a single upload does not: partly worked. Rejecting all
 * forty files because the eleventh was a corrupt JPEG would be the wrong trade
 * — the caller wants the thirty-nine and a list of what to retry. Nothing here
 * throws for an individual failure; it is recorded and the run continues.
 *
 * Concurrency is bounded. Firing every file at once is how a fifty-file upload
 * turns into fifty parallel multipart transfers, exhausts the socket pool and
 * starts collecting 503 SlowDown from S3.
 *
 * @param {Array<{buffer?: Buffer, stream?: any, key?: string, originalname?: string, mimetype?: string}>} files
 * @param {object} [options]
 * @param {string} [options.folder]        used with each file's name when no explicit key
 * @param {number} [options.concurrency]
 * @param {string[]} [options.allow]
 * @returns {Promise<{uploaded: object[], failed: object[], total: number}>}
 */
export async function uploadMany(files, options = {}) {
  const { folder = 'uploads', concurrency = 4, ...rest } = options;
  const list = Array.from(files || []);
  if (!list.length) return { uploaded: [], failed: [], total: 0 };

  const uploaded = [];
  const failed = [];

  await mapWithConcurrency(list, concurrency, async (file, index) => {
    const name = file.originalname || file.filename || `file-${index}`;
    try {
      const asset = await uploadObject(file.buffer ?? file.stream ?? file, {
        ...rest,
        key: file.key || uniqueKey(folder, name),
        contentType: file.mimetype,
        filename: name,
      });
      uploaded.push({ ...asset, originalName: name, index });
    } catch (error) {
      failed.push({
        originalName: name,
        index,
        error: error.message,
        code: error.code || 'UPLOAD_FAILED',
      });
    }
  });

  // Restored to submission order — the pool finishes out of order, and a caller
  // pairing results against the form's file list needs the order it sent.
  uploaded.sort((a, b) => a.index - b.index);
  failed.sort((a, b) => a.index - b.index);

  return { uploaded, failed, total: list.length };
}

/**
 * Runs `task` over `items`, never more than `limit` at a time.
 *
 * Workers pull from a shared cursor rather than the list being sliced into
 * batches, so one slow 40MB PDF does not hold up the small files behind it the
 * way a batch barrier would.
 */
async function mapWithConcurrency(items, limit, task) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      await task(items[index], index);
    }
  });
  await Promise.all(workers);
}

/* -------------------------------------------------------------------------- */
/* read                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * The object as a stream, plus the headers worth forwarding.
 *
 * This is what a proxy route pipes to the client when the bucket is private and
 * you would rather not hand out a signed URL — the app stays the only thing
 * that can authorise a read.
 */
export async function getObjectStream(key) {
  try {
    const result = await useS3().send(
      new GetObjectCommand({ Bucket: env.s3.bucket, Key: key }),
    );
    return {
      stream: result.Body,
      contentType: result.ContentType,
      contentLength: result.ContentLength,
      etag: result.ETag?.replace(/"/g, ''),
      lastModified: result.LastModified,
      metadata: result.Metadata,
    };
  } catch (error) {
    throw wrapError(error, 'Could not read that file');
  }
}

/** The whole object in memory. For small files only — it has no size guard. */
export async function getObjectBuffer(key) {
  const { stream, ...rest } = await getObjectStream(key);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return { buffer: Buffer.concat(chunks), ...rest };
}

/** Size, type and metadata without transferring the bytes. */
export async function headObject(key) {
  try {
    const result = await useS3().send(
      new HeadObjectCommand({ Bucket: env.s3.bucket, Key: key }),
    );
    return {
      key,
      bytes: result.ContentLength,
      contentType: result.ContentType,
      etag: result.ETag?.replace(/"/g, ''),
      lastModified: result.LastModified,
      metadata: result.Metadata || {},
    };
  } catch (error) {
    throw wrapError(error, 'Could not read that file');
  }
}

/** Whether a key exists. Never throws — a storage fault reads as "no". */
export async function objectExists(key) {
  if (!key || !env.s3.configured) return false;
  try {
    await useS3().send(new HeadObjectCommand({ Bucket: env.s3.bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

/**
 * One page of keys under a prefix.
 *
 * Paged rather than exhaustive because a bucket is unbounded and a prefix that
 * holds forty thousand objects should not become forty thousand objects in this
 * process's heap. `listAllObjects` is the deliberate opt-in to that.
 */
export async function listObjects(prefix = '', options = {}) {
  const { maxKeys = 1000, continuationToken, delimiter } = options;
  try {
    const result = await useS3().send(
      new ListObjectsV2Command({
        Bucket: env.s3.bucket,
        Prefix: keyFor(prefix),
        MaxKeys: maxKeys,
        ContinuationToken: continuationToken,
        // Set to '/' to get one level only, with subfolders reported as
        // CommonPrefixes instead of every key beneath them.
        Delimiter: delimiter,
      }),
    );
    return {
      objects: (result.Contents || []).map((item) => ({
        key: item.Key,
        bytes: item.Size,
        etag: item.ETag?.replace(/"/g, ''),
        lastModified: item.LastModified,
      })),
      folders: (result.CommonPrefixes || []).map((p) => p.Prefix),
      nextToken: result.NextContinuationToken,
      truncated: Boolean(result.IsTruncated),
    };
  } catch (error) {
    throw wrapError(error, 'Could not list files');
  }
}

/**
 * Every key under a prefix, following pagination.
 *
 * `limit` is a guard rail, not a preference — it stops a mistyped prefix from
 * walking the entire bucket into memory.
 */
export async function listAllObjects(prefix = '', { limit = 10000 } = {}) {
  const all = [];
  let token;
  do {
    // eslint-disable-next-line no-await-in-loop -- pagination is inherently serial
    const page = await listObjects(prefix, { continuationToken: token, maxKeys: 1000 });
    all.push(...page.objects);
    token = page.nextToken;
  } while (token && all.length < limit);
  return all.slice(0, limit);
}

/* -------------------------------------------------------------------------- */
/* edit                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * CopySource has to name the bucket and be URL-encoded, and it is encoded per
 * segment so the slashes stay slashes. Encoding the whole string instead turns
 * a nested key into one flat literal and copies from a key that does not exist
 * — which S3 reports as a 404 on a file you can see in the console.
 */
const copySource = (key) =>
  `${env.s3.bucket}/${String(key).split('/').map(encodeURIComponent).join('/')}`;

/**
 * Copies an object. Server-side — the bytes never come back through this
 * process, so a 200MB file costs a single API call and no bandwidth.
 */
export async function copyObject(fromKey, toKey, options = {}) {
  try {
    const result = await useS3().send(
      new CopyObjectCommand({
        Bucket: env.s3.bucket,
        CopySource: copySource(fromKey),
        Key: toKey,
        ServerSideEncryption: 'AES256',
        ...(options.contentType || options.metadata
          ? {
              // Without REPLACE, S3 keeps the source's headers and silently
              // ignores everything passed here.
              MetadataDirective: 'REPLACE',
              ContentType: options.contentType,
              ...(options.metadata ? { Metadata: sanitizeMetadata(options.metadata) } : {}),
            }
          : {}),
      }),
    );
    return toAsset({
      key: toKey,
      contentType: options.contentType,
      etag: result?.CopyObjectResult?.ETag,
      metadata: options.metadata,
    });
  } catch (error) {
    throw wrapError(error, 'Could not copy that file');
  }
}

/**
 * Renames a key.
 *
 * S3 has no rename: this is a copy followed by a delete, and the order is the
 * safe one. If the delete fails the file exists at both keys, which is an orphan
 * to sweep; if it were reversed, a failed copy would have already destroyed the
 * original.
 */
export async function moveObject(fromKey, toKey, options = {}) {
  const asset = await copyObject(fromKey, toKey, options);
  await deleteObject(fromKey);
  return asset;
}

/**
 * Changes the stored headers or metadata on an object in place.
 *
 * "In place" is a copy onto its own key — the only way S3 offers to edit an
 * object's headers, since the objects themselves are immutable. Which is also
 * why the existing values are read first and merged: a copy replaces the whole
 * metadata set, so anything not re-sent here would be dropped.
 */
export async function updateObjectMeta(key, changes = {}) {
  const current = await headObject(key);
  return copyObject(key, key, {
    contentType: changes.contentType || current.contentType,
    metadata: { ...current.metadata, ...(changes.metadata || {}) },
  });
}

/* -------------------------------------------------------------------------- */
/* delete                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Deletes one object. Never throws.
 *
 * Same reasoning as media.service's `destroyAsset`: callers delete a *replaced*
 * file, after the new one is saved and the user is done. Failing their request
 * because old bytes outlived their record is the wrong trade — an orphan in a
 * bucket is cheaper than a broken save. Failures are logged for a sweep.
 */
export async function deleteObject(key) {
  if (!key || !env.s3.configured) return false;
  try {
    await useS3().send(new DeleteObjectCommand({ Bucket: env.s3.bucket, Key: key }));
    return true;
  } catch (error) {
    console.error('[s3] could not delete', key, error.message);
    return false;
  }
}

/**
 * Deletes many objects.
 *
 * Chunked at 1000 because that is S3's hard limit for one DeleteObjects call —
 * a 1001-key request is rejected in full, so the chunking is correctness rather
 * than tuning. Per-key failures come back in `errors`: S3 reports them inside a
 * 200 response, so a call that "succeeded" can still have deleted nothing, and
 * a caller that ignores this field would never find out.
 */
export async function deleteMany(keys) {
  const list = [...new Set((keys || []).filter(Boolean))];
  if (!list.length || !env.s3.configured) return { deleted: [], errors: [] };

  const s3 = useS3();
  const deleted = [];
  const errors = [];

  for (let i = 0; i < list.length; i += 1000) {
    const chunk = list.slice(i, i + 1000);
    try {
      // eslint-disable-next-line no-await-in-loop -- chunks are serial by design
      const result = await s3.send(
        new DeleteObjectsCommand({
          Bucket: env.s3.bucket,
          Delete: { Objects: chunk.map((Key) => ({ Key })), Quiet: false },
        }),
      );
      deleted.push(...(result.Deleted || []).map((d) => d.Key));
      errors.push(...(result.Errors || []).map((e) => ({ key: e.Key, message: e.Message })));
    } catch (error) {
      errors.push(...chunk.map((key) => ({ key, message: error.message })));
    }
  }

  return { deleted, errors };
}

/**
 * Deletes everything under a prefix.
 *
 * The empty-prefix guard is not paranoia. `keyFor('')` collapses to the app
 * prefix, and one careless `deletePrefix(someVariable)` where the variable is
 * undefined would otherwise mean "delete every file this app has ever stored",
 * with no confirmation step and no undo on a bucket without versioning.
 * Deleting the app's whole prefix has to be spelled out.
 */
export async function deletePrefix(prefix, { allowRoot = false } = {}) {
  const scoped = keyFor(prefix);
  if (!allowRoot && (!prefix || scoped === env.s3.prefix)) {
    throw ApiError.badRequest(
      'Refusing to delete the whole storage prefix — pass allowRoot to mean it',
      'UNSAFE_PREFIX',
    );
  }
  const objects = await listAllObjects(prefix);
  if (!objects.length) return { deleted: [], errors: [] };
  return deleteMany(objects.map((o) => o.key));
}

/* -------------------------------------------------------------------------- */
/* urls                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * A time-limited URL to read a private object.
 *
 * This is the normal way to serve a file from a private bucket: the link is
 * signed with the instance role's credentials and stops working when it expires,
 * so it can be handed to a browser without the bucket being public.
 *
 * One caveat worth knowing before this is used for anything sensitive: the URL
 * *is* the authorisation. Anyone holding it can read the object until it
 * expires, so keep the TTL short and do not log these.
 *
 * @param {string} key
 * @param {object} [options]
 * @param {number} [options.expiresIn]  seconds
 * @param {string} [options.download]   filename to force a download instead of inline
 */
export async function signedGetUrl(key, options = {}) {
  if (!key || !env.s3.configured) return null;
  const { expiresIn = env.s3.signedUrlTtl, download } = options;
  try {
    return await getSignedUrl(
      useS3(),
      new GetObjectCommand({
        Bucket: env.s3.bucket,
        Key: key,
        // Overrides the stored disposition for this link only, so the same
        // object can render inline in a viewer and download from a button.
        ...(download
          ? { ResponseContentDisposition: `attachment; filename="${safeSegment(download)}"` }
          : {}),
      }),
      { expiresIn },
    );
  } catch (error) {
    console.error('[s3] could not sign url for', key, error.message);
    return null;
  }
}

/**
 * A time-limited URL the browser can PUT to directly.
 *
 * The reason to reach for this: the file never passes through this server. A
 * 200MB upload costs the app one signing call instead of holding the bytes in
 * memory and paying for the bandwidth twice — which is the only sane way to do
 * large or high-volume uploads on a small instance.
 *
 * The trade is that the sniffing in `uploadObject` cannot run, because the
 * server never sees the bytes. `contentType` is pinned into the signature so
 * the client cannot substitute a different one, but what it actually sends is
 * unverified until something reads it back. Prefer the server path for anything
 * that is later served to other users; use this for bulk and for big files, and
 * verify after the fact with `headObject`.
 */
export async function signedPutUrl(key, options = {}) {
  const { contentType = 'application/octet-stream', expiresIn = env.s3.signedUrlTtl } = options;
  try {
    const url = await getSignedUrl(
      useS3(),
      new PutObjectCommand({
        Bucket: env.s3.bucket,
        Key: key,
        ContentType: contentType,
        ServerSideEncryption: 'AES256',
      }),
      { expiresIn },
    );
    // The client must send these exact headers or the signature will not match.
    return {
      url,
      key,
      expiresIn,
      headers: { 'Content-Type': contentType, 'x-amz-server-side-encryption': 'AES256' },
    };
  } catch (error) {
    throw wrapError(error, 'Could not prepare an upload URL');
  }
}

/** Signed upload URLs for a batch of files, in one round of signing. */
export async function signedPutUrls(files, { folder = 'uploads', expiresIn } = {}) {
  return Promise.all(
    (files || []).map((file) =>
      signedPutUrl(uniqueKey(folder, file.filename || file.name), {
        contentType: file.contentType || file.type,
        expiresIn,
      }),
    ),
  );
}

/**
 * A permanent URL, for a bucket that is actually public or behind CloudFront.
 *
 * Returns null when `AWS_S3_PUBLIC_URL` is unset, which is the honest answer
 * for a private bucket — a constructed s3.amazonaws.com URL would look right
 * and 403 for every visitor. Callers fall back to `signedGetUrl`.
 */
export function publicUrl(key) {
  if (!key || !env.s3.publicBaseUrl) return null;
  return `${env.s3.publicBaseUrl}/${String(key).split('/').map(encodeURIComponent).join('/')}`;
}

/**
 * The URL to hand a client for this key: permanent if the bucket is public,
 * signed if it is not. The one callers should reach for by default.
 */
export async function urlFor(key, options = {}) {
  return publicUrl(key) || signedGetUrl(key, options);
}
