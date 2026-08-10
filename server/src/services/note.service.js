import { File, kindFor } from '../models/File.js';
import { Note, noteAssets, slugify } from '../models/Note.js';
import { ApiError } from '../utils/ApiError.js';
import { removeFile, storeFiles } from './file.service.js';
import { DOCUMENT_TYPES, IMAGE_TYPES, urlFor } from './s3.service.js';

/**
 * Everything the notes module does that is not routing or validation.
 *
 * Three jobs, and they are here rather than in the controller because each one
 * is a rule about the data that must hold no matter which endpoint is asking:
 *
 *   1. Who may read a note — one function, `assertCanRead`, so the answer cannot
 *      differ between the by-id route and the by-share-link route.
 *   2. Which S3 objects a note is allowed to point at — `resolveAssets`, which
 *      is the module's real authorisation boundary and is explained there.
 *   3. Turning stored keys into URLs a browser can use, which is per-request
 *      work the model cannot do because signing is async.
 */

/** Where every file uploaded through this module lands, in S3 and in the index. */
export const NOTE_FOLDER = 'notes';
export const NOTE_PURPOSE = 'note-asset';

/* -------------------------------------------------------------------------- */
/* slugs                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * A slug unique within one author's notes.
 *
 * Loops rather than trusting a single candidate, and checks against deleted
 * notes too: the unique index covers them, so a soft-deleted "s3-cors" would
 * otherwise make the next "S3 CORS" fail with a duplicate-key error the user
 * cannot act on.
 *
 * `exceptId` lets a rename keep its own slug — without it, saving a note under
 * its existing title would collide with itself and drift to `-2` on every save.
 */
export async function uniqueSlug(author, title, exceptId = null) {
  const base = slugify(title);

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    // eslint-disable-next-line no-await-in-loop -- each try depends on the last
    const taken = await Note.exists({
      author,
      slug: candidate,
      ...(exceptId ? { _id: { $ne: exceptId } } : {}),
    });
    if (!taken) return candidate;
  }

  // Fifty notes with the same title is not a case worth another query for.
  return `${base}-${Date.now().toString(36)}`;
}

/* -------------------------------------------------------------------------- */
/* assets                                                                      */
/* -------------------------------------------------------------------------- */

/** The asset fields worth copying out of a File row and onto a block. */
const assetFromFile = (file, extra = {}) => ({
  fileId: file._id,
  key: file.key,
  name: file.originalName,
  contentType: file.contentType,
  kind: file.kind || kindFor(file.contentType),
  bytes: file.bytes ?? 0,
  width: file.width ?? extra.width ?? null,
  height: file.height ?? extra.height ?? null,
  url: file.url ?? null,
  meta: extra.meta ?? {},
});

/** Every `fileId` a payload's blocks and cover reference, deduplicated. */
function referencedFileIds(payload) {
  const ids = new Set();
  const take = (asset) => {
    if (asset?.fileId) ids.add(String(asset.fileId));
  };

  take(payload.cover);
  for (const block of payload.blocks || []) {
    take(block.asset);
    for (const asset of block.assets || []) take(asset);
    for (const child of block.children || []) {
      take(child.asset);
      for (const asset of child.assets || []) take(asset);
    }
  }
  return [...ids];
}

/**
 * Rebuilds every asset in a payload from the database, and drops the ones the
 * caller does not own.
 *
 * This is the module's authorisation boundary, and it is worth being blunt
 * about why it cannot be skipped. A block arrives from the browser carrying an
 * asset, and the obvious implementation stores what it was handed. That would
 * let anyone paste another user's `fileId` — or, worse, a raw S3 `key` — into a
 * block and have the server sign a URL for it on every read. It is an
 * IDOR that reads as a feature request ("images in notes") and leaves no trace
 * in the logs.
 *
 * So nothing the client sends about an asset is trusted except the id, the id
 * is looked up scoped to the owner, and every other field is copied from the
 * row. A reference that does not resolve is not an error — it is dropped, and
 * the rest of the note saves. That is deliberate: the common cause is a file
 * deleted in another tab, and failing the whole save would strand the user with
 * a note they cannot fix without finding the offending block by hand.
 *
 * @param {object} payload  the parsed body — mutated in place is avoided; a copy comes back
 * @param {string} ownerId
 */
export async function resolveAssets(payload, ownerId) {
  const ids = referencedFileIds(payload);
  if (!ids.length) return payload;

  const rows = await File.find({
    _id: { $in: ids },
    owner: ownerId,
    deletedAt: null,
    status: 'ready',
  }).lean();

  const byId = new Map(rows.map((row) => [String(row._id), row]));
  const resolve = (asset) => {
    if (!asset?.fileId) return undefined;
    const row = byId.get(String(asset.fileId));
    return row ? assetFromFile(row, asset) : undefined;
  };

  const resolveBlock = (block) => ({
    ...block,
    ...(block.asset ? { asset: resolve(block.asset) } : {}),
    ...(block.assets ? { assets: block.assets.map(resolve).filter(Boolean) } : {}),
  });

  return {
    ...payload,
    ...(payload.cover ? { cover: resolve(payload.cover) } : {}),
    ...(payload.blocks
      ? {
          blocks: payload.blocks.map((block) => ({
            ...resolveBlock(block),
            ...(block.children ? { children: block.children.map(resolveBlock) } : {}),
          })),
        }
      : {}),
  };
}

/**
 * Fills in a usable URL for every asset in a note.
 *
 * Permanent when the bucket is public or behind CloudFront, signed otherwise —
 * `urlFor` decides, so this file never has to know which deployment it is in.
 * Signing is local HMAC over cached credentials, not an API call, so a note with
 * forty images costs microseconds and zero AWS traffic.
 *
 * One caveat that belongs in the open, because it is a property of the
 * deployment rather than of this code: on a bucket with `AWS_S3_PUBLIC_URL`
 * set, *every* URL is permanent and unauthenticated, including those inside a
 * private note. The keys carry a random prefix so they are not enumerable, which
 * makes them capability URLs — unguessable, but valid forever for anyone who
 * ends up holding one. A deployment that treats private notes as genuinely
 * private wants the bucket private and this function signing.
 *
 * Takes and returns plain objects, so it composes with `.lean()`.
 */
export async function hydrateNote(note, options = {}) {
  if (!note) return note;
  const plain = typeof note.toObject === 'function' ? note.toObject() : note;

  const assets = noteAssets(plain);
  if (!assets.length) return plain;

  // One signature per distinct key — a gallery that repeats an image should not
  // pay twice, and the same key must resolve to the same URL within a response.
  const keys = [...new Set(assets.map((asset) => asset.key))];
  const urls = new Map(
    await Promise.all(keys.map(async (key) => [key, await urlFor(key, options)])),
  );

  // Mutates the copy `toObject`/`lean` already gave us, rather than rebuilding
  // the whole block tree a second time.
  for (const asset of assets) asset.url = asset.url || urls.get(asset.key) || null;

  return plain;
}

/** `hydrateNote` over a list, sharing nothing — each note signs its own keys. */
export const hydrateNotes = (notes, options = {}) =>
  Promise.all(notes.map((note) => hydrateNote(note, options)));

/**
 * Soft-deletes the files a note used to reference and no longer does.
 *
 * Called after an update, and after a delete with an empty `next`. Without it
 * every removed image stays in the bucket forever with a File row that claims it
 * is live — invisible to the orphan sweeper precisely because the row exists.
 *
 * Soft, not hard, for the reason the rest of the module is: an undo on the note
 * has to bring its pictures back, and file.service's sweeper is what eventually
 * removes the bytes once nobody has changed their mind.
 */
export async function releaseUnusedAssets(previous, next, userId) {
  const before = new Set(noteAssets(previous).map((asset) => asset.key));
  if (!before.size) return 0;

  for (const asset of noteAssets(next)) before.delete(asset.key);
  if (!before.size) return 0;

  await Promise.all([...before].map((key) => removeFile(key, userId)));
  return before.size;
}

/**
 * Uploads files and records them against a note.
 *
 * The File rows are written with `linkedTo` pointing at the note, which is what
 * makes "every file this note owns" a query rather than a walk of the block
 * tree. They are *not* inserted into any block: where an image sits in the
 * document is the editor's decision, and this endpoint exists so the editor can
 * upload on drop and place the block afterwards.
 */
export async function uploadNoteFiles(note, files, user) {
  const { files: rows, failed, total } = await storeFiles(files, {
    /*
      Passing `allow` is what makes the type check real. Without it,
      `resolveContentType` falls back to the browser's declared type for bytes it
      does not recognise — and multer's filter upstream only ever saw that same
      claim. With it, the leading bytes must sniff to something on this list or
      the file is refused. That matters more here than almost anywhere else in
      the app: a note can be public, so its attachments are served to strangers
      with whatever Content-Type was recorded, forever.

      A rejection lands in `failed` rather than failing the request, because
      `uploadMany` reports per file — nine good images should not be lost to one
      renamed .zip.
    */
    allow: [...IMAGE_TYPES, ...DOCUMENT_TYPES],
    folder: `${NOTE_FOLDER}/${note._id}`,
    purpose: NOTE_PURPOSE,
    owner: user.id,
    requestedBy: user.id,
    requestedByEmail: user.email || '',
    linkedTo: { type: 'note', id: String(note._id) },
  });

  const assets = await Promise.all(
    rows.map(async (row) => {
      const asset = assetFromFile(row);
      asset.url = asset.url || (await urlFor(asset.key));
      return asset;
    }),
  );

  return { assets, failed, total };
}

/**
 * Detaches one uploaded file from a note.
 *
 * Scoped by `linkedTo` as well as by owner, so an id belonging to the caller's
 * avatar cannot be deleted through a notes route. Soft, like everything else
 * here — the sweeper in file.service takes the bytes later.
 *
 * The block referencing it should be removed in the same save. If it is not,
 * nothing breaks loudly: `resolveAssets` drops the dead reference the next time
 * the note is written, because the row no longer matches its `deletedAt: null`
 * lookup.
 */
export async function detachAsset(note, fileId, userId) {
  const file = await File.findOne({
    _id: fileId,
    owner: userId,
    'linkedTo.type': 'note',
    'linkedTo.id': String(note._id),
    deletedAt: null,
  });
  if (!file) throw ApiError.notFound('That file is not attached to this note');

  await removeFile(file.key, userId);
  return file.key;
}

/**
 * Hard-deletes a note and releases every file it owns.
 *
 * The order matters and is the same trade file.service documents: the files are
 * marked first, then the note row goes. Dropping the note first and failing the
 * file pass would strand every object it referenced — `linkedTo.id` is the only
 * index that knows they belong to anything, and the note is what gives that id
 * meaning.
 *
 * Files are found by `linkedTo` rather than by walking blocks, which is the
 * only way to catch the ones that were uploaded and never placed — a drag,
 * a change of mind, a closed tab.
 */
export async function purgeNote(note, userId) {
  const files = await File.find({
    'linkedTo.type': 'note',
    'linkedTo.id': String(note._id),
    deletedAt: null,
  })
    .select('key')
    .lean();

  await Promise.all(files.map((file) => removeFile(file.key, userId)));
  await Note.deleteOne({ _id: note._id });

  return { files: files.length };
}

/* -------------------------------------------------------------------------- */
/* reading                                                                     */
/* -------------------------------------------------------------------------- */

export const isAuthor = (note, userId) => Boolean(userId) && String(note.author) === String(userId);

/**
 * The one place that decides who may read a note.
 *
 * `private` is the author alone. `unlisted` and `public` differ only in whether
 * the feed lists them — both are readable by anyone holding the link, which is
 * what "share" means — but a *draft* is not, whatever its visibility says, and
 * that combination is the one worth being careful about: a note set to public
 * while still being written must not be readable until it is published.
 */
export function assertCanRead(note, userId) {
  if (!note || note.deletedAt) throw ApiError.notFound('Note not found');
  if (isAuthor(note, userId)) return note;

  if (note.visibility === 'private') {
    // 404 rather than 403. A 403 confirms the note exists, which is exactly the
    // fact a private note is keeping.
    throw ApiError.notFound('Note not found');
  }
  if (note.status !== 'published') throw ApiError.notFound('Note not found');

  return note;
}

/** The author's own note, or a 404 — never another user's, whatever its id. */
export async function ownedNote(id, userId) {
  const note = await Note.findOne({ _id: id, author: userId, deletedAt: null });
  if (!note) throw ApiError.notFound('Note not found');
  return note;
}

/**
 * Bumps the view counter without touching `updatedAt`.
 *
 * `timestamps: false` is load-bearing, not tidiness. Mongoose stamps `updatedAt`
 * on an update by default, so counting a view would reorder the author's
 * "recently edited" list every time a stranger opened the page.
 *
 * Fire-and-forget: a failed counter is not worth failing a page load over.
 */
export function countView(noteId) {
  Note.updateOne({ _id: noteId }, { $inc: { views: 1 } }, { timestamps: false }).catch(() => {});
}

/* -------------------------------------------------------------------------- */
/* listing                                                                     */
/* -------------------------------------------------------------------------- */

/** Builds the Mongo filter for a list request, owner-scoped or public. */
export function buildFilter({ scope, userId, q, tag, category, patternSlug, visibility, status, favorite }) {
  const filter = { deletedAt: null };

  if (scope === 'mine') {
    filter.author = userId;
    if (visibility) filter.visibility = visibility;
    if (status) filter.status = status;
    if (favorite) filter.favorite = true;
  } else {
    // The feed shows only what its author both made public and finished.
    filter.visibility = 'public';
    filter.status = 'published';
  }

  if (tag) filter.tags = tag;
  if (category) filter.category = category;
  if (patternSlug) filter.patternSlug = patternSlug;
  // `$text` rather than a regex: the index exists, and an unescaped user regex
  // is the denial of service utils/query.js warns about.
  if (q) filter.$text = { $search: q };

  return filter;
}

/**
 * A page of notes.
 *
 * Sorted by relevance when searching and by recency otherwise — a text search
 * ordered by date is the one that makes people think search is broken. Pinned
 * notes float in the owner's own list only; pinning is a personal shelf, not an
 * editorial signal, so it must not reorder a public feed.
 */
export async function listNotes(filter, { page, limit, scope }) {
  const searching = Boolean(filter.$text);

  const projection = searching ? { score: { $meta: 'textScore' } } : {};
  const sort = searching
    ? { score: { $meta: 'textScore' } }
    : scope === 'mine'
      ? { pinned: -1, updatedAt: -1 }
      : { publishedAt: -1 };

  const [rows, total] = await Promise.all([
    Note.find(filter, projection)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      // Blocks are the expensive half of a note and a card renders none of them.
      .select('-blocks -plainText')
      .lean(),
    Note.countDocuments(filter),
  ]);

  return { rows, total };
}

/**
 * The author's own tags with counts — the sidebar's filter list.
 *
 * An aggregation rather than `distinct` because the count is the useful part:
 * a tag used once is noise in a list of forty, and the client cannot know that
 * without it.
 */
export function tagCounts(userId, { limit = 50 } = {}) {
  return Note.aggregate([
    { $match: { author: userId, deletedAt: null } },
    { $unwind: '$tags' },
    { $group: { _id: '$tags', count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
    { $limit: limit },
    { $project: { _id: 0, tag: '$_id', count: 1 } },
  ]);
}
