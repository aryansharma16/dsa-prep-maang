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
 */
function fileUpload({ maxBytes, mimeTypes }) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxBytes, files: 1 },
    fileFilter: (_req, file, cb) => {
      if (mimeTypes.includes(file.mimetype)) {
        cb(null, true);
        return;
      }
      /*
        A first pass only. This type is the browser's claim about the file, and
        a hand-rolled request can claim anything — the check that actually
        holds is Cloudinary refusing to decode a non-image under
        `resource_type: 'image'`. This one exists to reject the honest mistake
        (someone picking a .zip) before spending a round trip on it.
      */
      cb(ApiError.badRequest(`Unsupported file type: ${file.mimetype}`, 'BAD_FILE_TYPE'));
    },
  });
}

/** Wraps a multer middleware so its errors arrive as ApiError, like everything else. */
function handled(middleware, { maxBytes, field }) {
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
        if (error.code === 'LIMIT_UNEXPECTED_FILE') {
          next(ApiError.badRequest(`Send the file as the "${field}" field`, 'BAD_FIELD'));
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
  });
}

/** One document under `maxMb`. Here for the uploads that come next. */
export function singleDocument(field, maxMb = 10) {
  const maxBytes = maxMb * MB;
  return handled(
    fileUpload({ maxBytes, mimeTypes: [...DOCUMENT_TYPES, ...IMAGE_TYPES] }).single(field),
    { maxBytes, field },
  );
}
