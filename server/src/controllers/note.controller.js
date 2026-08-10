import mongoose from 'mongoose';
import { z } from 'zod';
import {
  CALLOUT_TONES,
  LIST_VARIANTS,
  Note,
  VISIBILITIES,
  noteCard,
  publicNote,
  sharedCard,
  sharedNote,
} from '../models/Note.js';
import { User } from '../models/User.js';
import {
  assertCanRead,
  buildFilter,
  countView,
  detachAsset,
  hydrateNote,
  hydrateNotes,
  isAuthor,
  listNotes,
  ownedNote,
  purgeNote,
  releaseUnusedAssets,
  resolveAssets,
  tagCounts,
  uniqueSlug,
  uploadNoteFiles,
} from '../services/note.service.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { youtubeId } from '../utils/links.js';
import { objectId, paged, pageQuery } from '../utils/query.js';

const oid = (id) => new mongoose.Types.ObjectId(id);

/* -------------------------------------------------------------------------- */
/* block validation                                                            */
/* -------------------------------------------------------------------------- */

/**
 * A discriminated union, one arm per block type.
 *
 * The model stores every block in one permissive schema — that is the right
 * shape at rest, since blocks live in an array and get reordered. This is where
 * the strictness goes instead: it is the last point at which a bad payload can
 * be refused with a message naming the field, and it is what stops a `table`
 * arriving with a `videoId` and 40KB of nothing in it.
 *
 * The caps are all deliberate. `blocks` is an unbounded array in a document with
 * a 16MB ceiling, and every one of these limits is the difference between a
 * rejected request and a document that can be written but never updated again.
 */

/**
 * What the client may say about an asset: which file, and nothing else that
 * matters. Everything authoritative — key, type, size, name — is read from the
 * File row server-side. See `resolveAssets`, which explains why.
 */
const assetRef = z.object({
  fileId: objectId,
  // Measured in the browser before upload; the server has no image decoder and
  // this is the only place the dimensions can come from. Cosmetic only: it sets
  // the placeholder's aspect ratio so the page does not jump as images load.
  width: z.number().int().positive().max(20000).optional(),
  height: z.number().int().positive().max(20000).optional(),
  meta: z.record(z.any()).optional(),
});

const listItem = z.object({
  text: z.string().max(2000),
  checked: z.boolean().optional(),
  depth: z.number().int().min(0).max(2).optional(),
});

const codeVariant = z.object({
  lang: z.string().max(30).optional(),
  label: z.string().max(60).optional(),
  filename: z.string().max(120).optional(),
  code: z.string().max(50000),
});

/**
 * A URL that is safe to put in an `href`.
 *
 * `z.string().url()` is not that check, which is the part worth writing down:
 * it delegates to `new URL()`, and `javascript:alert(document.cookie)` is a
 * perfectly well-formed URL. Storing one would give this module the single XSS
 * hole its whole no-HTML design exists to avoid — the renderer never
 * interprets markup, but it does interpolate this string into an anchor, and a
 * link in a *public* note is served to everyone who opens it.
 *
 * So the scheme is allowlisted rather than the dangerous ones blocklisted:
 * `data:` and `vbscript:` are the two people remember, and the list of the rest
 * is not knowable in advance.
 */
const SAFE_SCHEMES = new Set(['http:', 'https:', 'mailto:']);

const safeUrl = z
  .string()
  .url()
  .max(2000)
  .refine((value) => {
    try {
      return SAFE_SCHEMES.has(new URL(value).protocol);
    } catch {
      return false;
    }
  }, 'Links must be http(s) or mailto');

const link = z.object({
  label: z.string().min(1).max(200),
  url: safeUrl,
  source: z.string().max(120).optional(),
  description: z.string().max(300).optional(),
});

const base = { id: z.string().max(40).optional() };

const block = (type, shape) => z.object({ ...base, type: z.literal(type), ...shape });

/** Every type a dropdown may contain — i.e. every type but another dropdown. */
const leafBlocks = [
  block('heading', {
    text: z.string().min(1).max(300),
    level: z.number().int().min(2).max(4).optional(),
  }),
  block('paragraph', { text: z.string().max(10000) }),
  block('list', {
    variant: z.enum(LIST_VARIANTS).optional(),
    items: z.array(listItem).max(200),
  }),
  block('callout', {
    tone: z.enum(CALLOUT_TONES).optional(),
    title: z.string().max(200).optional(),
    text: z.string().max(5000),
  }),
  block('code', {
    variants: z.array(codeVariant).min(1).max(8),
    caption: z.string().max(300).optional(),
  }),
  block('quote', { text: z.string().max(2000), cite: z.string().max(200).optional() }),
  block('links', {
    links: z.array(link).min(1).max(30),
    variant: z.enum(['list', 'cards']).optional(),
  }),
  block('image', {
    asset: assetRef,
    caption: z.string().max(300).optional(),
    align: z.enum(['left', 'center', 'right']).optional(),
    width: z.enum(['full', 'wide', 'inline']).optional(),
  }),
  block('gallery', {
    assets: z.array(assetRef).min(1).max(20),
    caption: z.string().max(300).optional(),
    width: z.enum(['full', 'wide', 'inline']).optional(),
  }),
  block('file', {
    asset: assetRef,
    title: z.string().max(200).optional(),
    caption: z.string().max(300).optional(),
  }),
  block('video', {
    // A full YouTube URL in any shape, or a bare id — normalised below to an id,
    // because an id cannot carry a query string and a URL can.
    videoId: z.string().max(200),
    caption: z.string().max(300).optional(),
  }),
  block('table', {
    columns: z.array(z.string().max(200)).max(12),
    rows: z.array(z.array(z.string().max(2000)).max(12)).max(200),
    caption: z.string().max(300).optional(),
  }),
  block('divider', {}),
];

const leafBlock = z.discriminatedUnion('type', leafBlocks);

const anyBlock = z.discriminatedUnion('type', [
  ...leafBlocks,
  block('dropdown', {
    title: z.string().min(1).max(300),
    open: z.boolean().optional(),
    tone: z.enum(CALLOUT_TONES).optional(),
    children: z.array(leafBlock).max(50).default([]),
  }),
]);

const blocks = z.array(anyBlock).max(500);

/**
 * Normalises what validation cannot: a YouTube URL becomes an id, and a video
 * block whose URL was unrecognisable is dropped rather than stored as an empty
 * frame the reader cannot act on.
 */
const normalizeBlocks = (list = []) =>
  list
    .map((item) => {
      if (item.type === 'video') return { ...item, videoId: youtubeId(item.videoId) };
      if (item.type === 'dropdown') return { ...item, children: normalizeBlocks(item.children) };
      return item;
    })
    .filter((item) => item.type !== 'video' || item.videoId);

/* -------------------------------------------------------------------------- */
/* request schemas                                                             */
/* -------------------------------------------------------------------------- */

const tag = z.string().min(1).max(40);

const noteFields = {
  title: z.string().min(1).max(200),
  slug: z.string().max(120).optional(),
  summary: z.string().max(500).optional(),
  icon: z.string().max(8).optional(),
  cover: assetRef.nullable().optional(),
  blocks: blocks.optional(),
  tags: z.array(tag).max(20).optional(),
  category: z.string().max(60).optional(),
  patternSlug: z.string().max(80).optional(),
  problemSlug: z.string().max(200).optional(),
  visibility: z.enum(VISIBILITIES).optional(),
  status: z.enum(['draft', 'published']).optional(),
  pinned: z.boolean().optional(),
  favorite: z.boolean().optional(),
};

export const createSchema = z.object(noteFields);

/**
 * Every field optional, and `.strict()` rather than the usual permissive parse.
 *
 * A PATCH here is a sparse update — anything absent is left alone — which makes
 * a typo'd field name indistinguishable from an omitted one. Silently ignoring
 * `visibilty: 'public'` is the failure that matters in this module, so the
 * request is refused instead.
 */
export const updateSchema = z
  .object({ ...noteFields, title: noteFields.title.optional() })
  .strict()
  .refine((body) => Object.keys(body).length > 0, 'Nothing to update');

export const listQuery = pageQuery.extend({
  q: z.string().max(120).optional(),
  tag: tag.optional(),
  category: z.string().max(60).optional(),
  patternSlug: z.string().max(80).optional(),
  visibility: z.enum(VISIBILITIES).optional(),
  status: z.enum(['draft', 'published']).optional(),
  // Not `z.coerce.boolean()` — that reads the string "false" as true, because
  // every non-empty string is truthy. This is the shape that actually round
  // trips through a query string.
  favorite: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
});

export const publicListQuery = pageQuery.extend({
  q: z.string().max(120).optional(),
  tag: tag.optional(),
  patternSlug: z.string().max(80).optional(),
});

export const publicIdParam = z.object({ publicId: z.string().min(6).max(40) });
export const assetParam = z.object({ id: objectId, fileId: objectId });

/* -------------------------------------------------------------------------- */
/* the caller's own notes                                                      */
/* -------------------------------------------------------------------------- */

/** GET /api/notes — the author's own library, paged. */
export const listMine = asyncHandler(async (req, res) => {
  const { page, limit, ...filters } = req.query;
  const filter = buildFilter({ scope: 'mine', userId: oid(req.userId), ...filters });
  const { rows, total } = await listNotes(filter, { page, limit, scope: 'mine' });

  res.json(paged('notes', rows.map(noteCard), { total, page, limit }));
});

/** GET /api/notes/tags — the sidebar's filter list. */
export const listTags = asyncHandler(async (req, res) => {
  res.json({ tags: await tagCounts(oid(req.userId)) });
});

/**
 * GET /api/notes/:id — one note, in full.
 *
 * Serves other people's public notes too, so a link pasted between signed-in
 * users resolves without the client having to know whose it is. `assertCanRead`
 * is what makes that safe, and it 404s rather than 403s on a private note — see
 * the note there.
 */
export const getOne = asyncHandler(async (req, res) => {
  const note = await Note.findById(req.params.id);
  assertCanRead(note, req.userId);

  const mine = isAuthor(note, req.userId);
  if (!mine) countView(note._id);

  const hydrated = await hydrateNote(note);
  res.json({ note: mine ? publicNote(hydrated) : sharedNote(hydrated), mine });
});

/** POST /api/notes — a new note, private and draft unless told otherwise. */
export const create = asyncHandler(async (req, res) => {
  const author = oid(req.userId);
  const body = await resolveAssets(req.body, author);

  // Denormalised once, here. See `authorName` in the model for why it is copied
  // rather than populated.
  const user = await User.findById(author).select('name').lean();

  const note = await Note.create({
    ...body,
    blocks: normalizeBlocks(body.blocks || []),
    author,
    authorName: user?.name || '',
    slug: await uniqueSlug(author, body.slug || body.title),
  });

  res.status(201).json({ note: publicNote(await hydrateNote(note)) });
});

/** PATCH /api/notes/:id — sparse update, including the private/public toggle. */
export const update = asyncHandler(async (req, res) => {
  const note = await ownedNote(req.params.id, req.userId);
  const body = await resolveAssets(req.body, note.author);

  const before = note.toObject();

  // A rename does not move the slug on its own — a link that already works
  // should keep working, and fixing a typo in a title is the common edit. Only
  // an explicit `slug` changes it.
  if (body.slug !== undefined) {
    note.slug = await uniqueSlug(note.author, body.slug || body.title || note.title, note._id);
  }

  for (const [field, value] of Object.entries(body)) {
    if (field === 'slug') continue;
    if (field === 'blocks') {
      note.blocks = normalizeBlocks(value);
      continue;
    }
    // `cover: null` is how the client clears one; undefined is how Mongoose
    // stores "no subdocument at all".
    note[field] = field === 'cover' && value === null ? undefined : value;
  }

  await note.save();

  // After the save, so a failed write cannot take the images with it.
  if (body.blocks || body.cover !== undefined) {
    await releaseUnusedAssets(before, note.toObject(), note.author);
  }

  res.json({ note: publicNote(await hydrateNote(note)) });
});

/**
 * DELETE /api/notes/:id — soft, and the files stay.
 *
 * A restore has to bring the pictures back with it, and the file sweeper runs on
 * a timer this route cannot see. Releasing them belongs to `purge`, which is the
 * point of no return for both halves at once.
 */
export const remove = asyncHandler(async (req, res) => {
  const note = await ownedNote(req.params.id, req.userId);
  await Note.softDelete(note._id, oid(req.userId));
  res.json({ ok: true, id: note._id });
});

/** POST /api/notes/:id/restore — undo, for as long as the note has not been purged. */
export const restore = asyncHandler(async (req, res) => {
  const note = await Note.findOneAndUpdate(
    { _id: req.params.id, author: oid(req.userId), deletedAt: { $ne: null } },
    { $set: { deletedAt: null, deletedBy: null } },
    { new: true },
  );
  if (!note) throw ApiError.notFound('Note not found');

  res.json({ note: publicNote(await hydrateNote(note)) });
});

/** DELETE /api/notes/:id/permanent — the note and its files, for good. */
export const purge = asyncHandler(async (req, res) => {
  // Deliberately not `ownedNote`: this is the only route that acts on an
  // already-deleted note, and requiring it to be live first would make emptying
  // the trash impossible.
  const note = await Note.findOne({ _id: req.params.id, author: oid(req.userId) });
  if (!note) throw ApiError.notFound('Note not found');

  const { files } = await purgeNote(note, oid(req.userId));
  res.json({ ok: true, id: note._id, filesReleased: files });
});

/* -------------------------------------------------------------------------- */
/* attachments                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * POST /api/notes/:id/assets — images and PDFs for one note.
 *
 * Returns block-ready assets and places none of them. Where a picture goes in
 * the document is the editor's business; this endpoint exists so it can upload
 * on drop and insert the block afterwards, instead of holding a 20MB file in
 * memory until the whole note is saved.
 *
 * Partial success is a normal outcome — `failed` names what to retry.
 */
export const uploadAssets = asyncHandler(async (req, res) => {
  const note = await ownedNote(req.params.id, req.userId);
  if (!req.files?.length) throw ApiError.badRequest('No files were sent', 'NO_FILES');

  const user = await User.findById(req.userId).select('email').lean();
  const result = await uploadNoteFiles(note, req.files, {
    id: note.author,
    email: user?.email || '',
  });

  res.status(201).json(result);
});

/** DELETE /api/notes/:id/assets/:fileId — detach one upload. */
export const removeAsset = asyncHandler(async (req, res) => {
  const note = await ownedNote(req.params.id, req.userId);
  await detachAsset(note, req.params.fileId, oid(req.userId));
  res.json({ ok: true });
});

/* -------------------------------------------------------------------------- */
/* shared notes                                                                */
/* -------------------------------------------------------------------------- */

/**
 * GET /api/notes/public — the feed.
 *
 * Public *and* published only, enforced in `buildFilter` rather than here, so
 * the rule cannot be relaxed by a query parameter this handler forgot to strip.
 */
export const listPublic = asyncHandler(async (req, res) => {
  const { page, limit, ...filters } = req.query;
  const filter = buildFilter({ scope: 'public', ...filters });
  const { rows, total } = await listNotes(filter, { page, limit, scope: 'public' });

  // Cards only — `listNotes` already dropped the blocks, and the cover is the
  // one asset a tile needs a URL for.
  const hydrated = await hydrateNotes(rows);
  res.json(paged('notes', hydrated.map(sharedCard), { total, page, limit }));
});

/**
 * GET /api/notes/public/:publicId — a shared note, by the link its author sent.
 *
 * Unauthenticated by design: the point of sharing is that the recipient need not
 * have an account. It reaches unlisted notes as well as public ones, which is
 * what "unlisted" means — the id is the capability, and it is 11 random
 * characters precisely so holding the link is the only way to have it.
 */
export const getShared = asyncHandler(async (req, res) => {
  const note = await Note.findOne({ publicId: req.params.publicId });
  assertCanRead(note, req.userId);

  countView(note._id);
  res.json({ note: sharedNote(await hydrateNote(note)) });
});
