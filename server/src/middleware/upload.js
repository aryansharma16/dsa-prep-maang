import multer from 'multer';
import { ApiError } from '../utils/ApiError.js';

/**
 * Multipart parsing for the routes that accept a file.
 *
 * Memory storage, deliberately: the file is going straight back out to
 * Cloudinary, so writing it to a temp directory would mean a disk round trip
 * plus cleanup on a filesystem the host may not even keep between requests. The
 * size cap is what makes that safe — it is the only thing standing between a
 * request body and the heap, so it is required, not optional.
 */

export const MB = 1024 * 1024;

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
export const DOCUMENT_TYPES = ['application/pdf'];

/**
 * @param {object} options
 * @param {number} options.maxBytes  hard ceiling for one file
 * @param {string[]} options.mimeTypes  allowlist, matched against the declared type
 * @param {number} [options.maxFiles]  how many files one request may carry
 */
function fileUpload({ maxBytes, mimeTypes, maxFiles = 1 }) {
  return multer({
    storage: multer.memoryStorage(),
    /*
      `files` is a real memory bound, not a formality. Memory storage means the
      ceiling on one request is maxBytes × maxFiles held in the heap at once, so
      the two limits have to be read together — 20 files at 25MB is half a
      gigabyte of resident buffers per concurrent uploader.
    */
    limits: { fileSize: maxBytes, files: maxFiles },
    fileFilter: (_req, file, cb) => {
      if (mimeTypes.includes(file.mimetype)) {
        cb(null, true);
        return;
      }
      /*
        A first pass only. This type is the browser's claim about the file, and
        a hand-rolled request can claim anything. What actually holds depends on
        where the bytes are going: Cloudinary refuses to decode a non-image
        under `resource_type: 'image'`, and on the S3 path — which has no such
        guarantee, because S3 stores whatever it is handed — it is
        `resolveContentType` in s3.service.js reading the file's magic numbers.
        This one exists to reject the honest mistake (someone picking a .zip)
        before spending a round trip on it.
      */
      cb(ApiError.badRequest(`Unsupported file type: ${file.mimetype}`, 'BAD_FILE_TYPE'));
    },
  });
}

/** Wraps a multer middleware so its errors arrive as ApiError, like everything else. */
function handled(middleware, { maxBytes, field, maxFiles }) {
  return (req, res, next) =>
    middleware(req, res, (error) => {
      if (!error) {
        next();
        return;
      }
      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          next(
            ApiError.badRequest(
              `File is too large — the limit is ${Math.round(maxBytes / MB)}MB`,
              'FILE_TOO_LARGE',
            ),
          );
          return;
        }
        if (error.code === 'LIMIT_FILE_COUNT') {
          next(
            ApiError.badRequest(
              `Too many files — the limit is ${maxFiles} per request`,
              'TOO_MANY_FILES',
            ),
          );
          return;
        }
        if (error.code === 'LIMIT_UNEXPECTED_FILE') {
          /*
            Two different mistakes arrive with this one code: the wrong field
            name, and more files than `.array()` accepts. Only the caller's own
            limit tells them apart, so the message says which is which rather
            than sending someone to check a field name that was already right.
          */
          next(
            ApiError.badRequest(
              maxFiles > 1
                ? `Send up to ${maxFiles} files as the "${field}" field`
                : `Send the file as the "${field}" field`,
              'BAD_FIELD',
            ),
          );
          return;
        }
        next(ApiError.badRequest(error.message, 'UPLOAD_REJECTED'));
        return;
      }
      next(error);
    });
}

/** One image under `maxMb`, arriving as `req.file`. */
export function singleImage(field, maxMb = 5) {
  const maxBytes = maxMb * MB;
  return handled(fileUpload({ maxBytes, mimeTypes: IMAGE_TYPES }).single(field), {
    maxBytes,
    field,
    maxFiles: 1,
  });
}

/** One document under `maxMb`. Here for the uploads that come next. */
export function singleDocument(field, maxMb = 10) {
  const maxBytes = maxMb * MB;
  return handled(
    fileUpload({ maxBytes, mimeTypes: [...DOCUMENT_TYPES, ...IMAGE_TYPES] }).single(field),
    { maxBytes, field, maxFiles: 1 },
  );
}

/**
 * A CV: PDF or Word, and nothing else.
 *
 * Its own list rather than `singleDocument`'s, which also takes images — a
 * screenshot of a CV is not a CV anybody can send, and accepting one would put
 * a PNG in a library whose every row is meant to be something you attach to an
 * application form. The bytes go to Cloudinary as `raw`, which will store
 * anything, so this filter is the only check on type there is.
 */
export const RESUME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export function singleResume(field, maxMb = 8) {
  const maxBytes = maxMb * MB;
  return handled(fileUpload({ maxBytes, mimeTypes: RESUME_TYPES }).single(field), {
    maxBytes,
    field,
    maxFiles: 1,
  });
}

/** Everything the bulk endpoints accept: images and PDFs together. */
export const UPLOAD_TYPES = [...IMAGE_TYPES, ...DOCUMENT_TYPES];

/**
 * Many files under one field, arriving as `req.files`.
 *
 * The defaults are chosen against the memory ceiling rather than against what
 * feels generous: 20 × 15MB is 300MB of buffers in the worst case, which is
 * already more than a small instance wants to hold for one request. Raising
 * either past that is a decision to make with the box's RAM in view — and past
 * roughly that point the right answer stops being this middleware at all and
 * becomes `signedPutUrls`, which never routes the bytes through the server.
 *
 * @param {string} field
 * @param {object} [options]
 * @param {number} [options.maxMb]     per file, not per request
 * @param {number} [options.maxFiles]
 * @param {string[]} [options.mimeTypes]
 */
export function multipleFiles(field, options = {}) {
  const { maxMb = 15, maxFiles = 20, mimeTypes = UPLOAD_TYPES } = options;
  const maxBytes = maxMb * MB;
  return handled(fileUpload({ maxBytes, mimeTypes, maxFiles }).array(field, maxFiles), {
    maxBytes,
    field,
    maxFiles,
  });
}

/** Many images under one field. */
export function multipleImages(field, options = {}) {
  return multipleFiles(field, { maxMb: 5, maxFiles: 20, ...options, mimeTypes: IMAGE_TYPES });
}

/** Many PDFs under one field. */
export function multipleDocuments(field, options = {}) {
  return multipleFiles(field, { maxMb: 25, maxFiles: 10, ...options, mimeTypes: DOCUMENT_TYPES });
}

/**
 * Several named fields at once — `[{ name: 'cover', maxCount: 1 }, ...]`.
 *
 * For the form that carries more than one kind of file, where `req.files` comes
 * back keyed by field name instead of as a flat list.
 */
export function fileFields(fields, options = {}) {
  const { maxMb = 15, mimeTypes = UPLOAD_TYPES } = options;
  const maxBytes = maxMb * MB;
  const maxFiles = fields.reduce((sum, f) => sum + (f.maxCount || 1), 0);
  return handled(fileUpload({ maxBytes, mimeTypes, maxFiles }).fields(fields), {
    maxBytes,
    field: fields.map((f) => f.name).join('", "'),
    maxFiles,
  });
}
