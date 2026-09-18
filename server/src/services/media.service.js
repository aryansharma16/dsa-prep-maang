import { Readable } from 'node:stream';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Everything this app stores in Cloudinary goes through here.
 *
 * The point of the indirection is that callers never touch the SDK: they hand
 * over a buffer and a folder and get back the small, storable record below.
 * When document uploads arrive they reuse `uploadBuffer` as-is — a new caller
 * is a new folder and a new `resourceType`, not a second integration.
 *
 * Nothing is written to disk at any point. Multer keeps the file in memory and
 * it is streamed straight out to Cloudinary, which matters on hosts with a
 * read-only or ephemeral filesystem (Render, Vercel, most containers).
 */

let configured = false;

/** Configures the SDK once, lazily — importing this module must have no effect. */
function useCloudinary() {
  if (!env.cloudinary.configured) {
    throw new ApiError(
      503,
      'File uploads are not configured on this server',
      'UPLOADS_DISABLED',
    );
  }
  if (!configured) {
    cloudinary.config({
      cloud_name: env.cloudinary.cloudName,
      api_key: env.cloudinary.apiKey,
      api_secret: env.cloudinary.apiSecret,
      secure: true,
    });
    configured = true;
  }
  return cloudinary;
}

export const uploadsEnabled = () => env.cloudinary.configured;

/** A folder path under the app's own prefix, so nothing lands at the cloud root. */
export const folderFor = (...parts) => [env.cloudinary.folder, ...parts].filter(Boolean).join('/');

/**
 * The subset of Cloudinary's response worth keeping in Mongo.
 *
 * `publicId` is the one field that matters — it is the handle for deleting or
 * re-deriving a URL later. The rest is there so a document can be rendered
 * without a round trip to Cloudinary.
 */
const toAsset = (result) => ({
  publicId: result.public_id,
  url: result.secure_url,
  format: result.format,
  bytes: result.bytes,
  width: result.width,
  height: result.height,
  version: result.version,
  uploadedAt: new Date(),
});

/**
 * Uploads a buffer and resolves to an asset record.
 *
 * `resourceType: 'image'` is a real server-side check, not a formality:
 * Cloudinary decodes what it is given and rejects anything that is not an
 * image, which is the guarantee a Content-Type header cannot give — that
 * header is written by the client and can say anything.
 *
 * @param {Buffer} buffer
 * @param {object} options
 * @param {string} options.folder      destination folder, from `folderFor`
 * @param {string} [options.publicId]  stable id within the folder; omit for a random one
 * @param {'image'|'video'|'raw'|'auto'} [options.resourceType]
 * @param {object[]} [options.transformation] applied once, at upload time
 * @param {string[]} [options.tags]
 */
export function uploadBuffer(buffer, options = {}) {
  const api = useCloudinary();
  const {
    folder,
    publicId,
    resourceType = 'image',
    transformation,
    tags,
    overwrite = true,
  } = options;

  return new Promise((resolve, reject) => {
    const stream = api.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        resource_type: resourceType,
        transformation,
        tags,
        overwrite,
        // A stable public_id would otherwise serve the previous image from CDN
        // caches for hours after a replacement.
        invalidate: true,
      },
      (error, result) => {
        if (error) {
          // Cloudinary's own message ("Invalid image file") is the useful one;
          // its status codes are HTTP-shaped already.
          reject(
            new ApiError(
              error.http_code >= 400 && error.http_code < 500 ? 400 : 502,
              error.message || 'Upload failed',
              'UPLOAD_FAILED',
            ),
          );
          return;
        }
        resolve(toAsset(result));
      },
    );

    Readable.from(buffer).pipe(stream);
  });
}

/**
 * Deletes an asset. Never throws.
 *
 * Callers delete a *replaced* file — the new one is already saved and the user
 * is done. Failing their request because the old bytes outlived their record
 * would be the wrong trade; an orphan in the cloud is cheaper than a broken
 * save. Anything that fails here is logged and left for a sweep.
 */
export async function destroyAsset(publicId, resourceType = 'image') {
  if (!publicId || !env.cloudinary.configured) return false;
  try {
    const api = useCloudinary();
    const result = await api.uploader.destroy(publicId, {
      resource_type: resourceType,
      invalidate: true,
    });
    return result?.result === 'ok';
  } catch (error) {
    console.error('[media] could not delete', publicId, error.message);
    return false;
  }
}

/**
 * A short-lived, signed download link that goes through Cloudinary's API rather
 * than its CDN.
 *
 * Needed because a new Cloudinary account refuses to *deliver* PDFs and ZIPs
 * from the public CDN at all — the upload succeeds and the delivery URL answers
 * `401 deny or ACL failure`, which a browser shows as "Failed to load PDF
 * document". The API download is not subject to that setting. It is signed
 * with the API secret and expires in a minute, so it is only ever fetched
 * server-side and never handed to a browser. See `resumeFile`.
 */
export function privateDownloadUrl(publicId, { resourceType = 'raw', ttlSeconds = 60 } = {}) {
  const api = useCloudinary();
  return api.utils.private_download_url(publicId, '', {
    resource_type: resourceType,
    type: 'upload',
    expires_at: Math.floor(Date.now() / 1000) + ttlSeconds,
  });
}

/**
 * A delivery URL derived from a stored publicId.
 *
 * One upload serves every size: the transformation lives in the URL and
 * Cloudinary renders and caches it on first request. `f_auto`/`q_auto` let it
 * pick the format and compression per browser.
 */
export function assetUrl(publicId, transformation = {}) {
  if (!publicId || !env.cloudinary.configured) return null;
  return useCloudinary().url(publicId, {
    secure: true,
    fetch_format: 'auto',
    quality: 'auto',
    ...transformation,
  });
}
