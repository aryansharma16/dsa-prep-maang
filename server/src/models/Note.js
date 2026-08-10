import { randomBytes, randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { kindFor } from './File.js';

/**
 * A personal note — the write-up you make after fighting something, not a page
 * from a manual.
 *
 * This is deliberately not PatternGuide. A guide is curriculum: one per pattern
 * slug, seeded, edited by an admin, read by everyone. A note is somebody's own
 * — "the CORS thing that cost me an afternoon", "how I finally got presigned
 * PUTs working" — owned by one user, private until they say otherwise, and
 * unbounded in number. Sharing a collection between those two would mean every
 * guide query carrying an owner filter it does not want, and every note query
 * carrying a slug uniqueness rule it cannot honour.
 *
 * What is borrowed from PatternGuide, on purpose, is the shape of the content:
 * a list of typed blocks, not an HTML or Markdown string. The client renders
 * each block with a component, so no sanitizer ever stands between the database
 * and the page, and the editor gets a form per block instead of a textarea full
 * of markup. Nothing stored here is ever interpreted as markup by the server.
 *
 * Inline emphasis inside `text` is markdown-lite — `**bold**`, `_italic_`,
 * `` `code` ``, `[label](url)` — parsed by the renderer, never by the server.
 * That choice is worth its own line: the alternative, offset-based spans
 * (`{start, end, mark}`), is the thing that silently corrupts every time text is
 * edited without recomputing every offset behind it. Plain text with inline
 * markers cannot drift out of sync with itself, and it means `plainText` below
 * is nearly free to derive and directly searchable.
 */

/* -------------------------------------------------------------------------- */
/* assets                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * An S3 object as a block carries it.
 *
 * Denormalised from the File row rather than referenced, because rendering a
 * note must not fan out into one query per image. `fileId` is still kept, and it
 * is what makes the file sweepable when a block is deleted and what ties the
 * object back to an owner for authorisation.
 *
 * No signed URL is stored, for the reason File.js spells out — it expires. `url`
 * holds only the permanent kind, set when the bucket is public or fronted by
 * CloudFront. Everything else is signed at read time by the note service.
 */
const assetSchema = new mongoose.Schema(
  {
    fileId: { type: mongoose.Schema.Types.ObjectId, ref: 'File', default: null },
    key: { type: String, required: true },
    name: { type: String, default: '' },
    contentType: { type: String, default: '' },
    kind: { type: String, default: 'other' },
    bytes: { type: Number, default: 0 },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    /** Permanent URL only — never a signed one. Null on a private bucket. */
    url: { type: String, default: null },
    /** Pages for a PDF, duration for a video: whatever the kind happens to have. */
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false },
);

const codeVariantSchema = new mongoose.Schema(
  {
    // 'js' | 'java' | 'bash' | 'text' — several variants render as tabs.
    lang: { type: String, default: 'text' },
    label: { type: String, default: '' },
    // Shown as the tab's filename chip, e.g. 's3.service.js'.
    filename: { type: String, default: '' },
    code: { type: String, default: '' },
  },
  { _id: false },
);

const linkSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    url: { type: String, required: true },
    // The host, shown as a muted suffix — 'docs.aws.amazon.com'.
    source: { type: String, default: '' },
    description: { type: String, default: '' },
  },
  { _id: false },
);

const listItemSchema = new mongoose.Schema(
  {
    text: { type: String, default: '' },
    // Checklist only. Kept on every item so a list can change variant without
    // losing state the user already set.
    checked: { type: Boolean, default: false },
    // Indent level, 0-2. Nesting inside one list rather than nested lists —
    // the editor produces this from Tab, and it survives a variant change.
    depth: { type: Number, default: 0, min: 0, max: 2 },
  },
  { _id: false },
);

/* -------------------------------------------------------------------------- */
/* blocks                                                                      */
/* -------------------------------------------------------------------------- */

/** Everything a dropdown is allowed to contain — i.e. every type but itself. */
export const LEAF_BLOCK_TYPES = [
  'heading',
  'paragraph',
  'list',
  'callout',
  'code',
  'quote',
  'links',
  'image',
  'gallery',
  'file',
  'video',
  'table',
  'divider',
];

export const BLOCK_TYPES = [...LEAF_BLOCK_TYPES, 'dropdown'];

export const CALLOUT_TONES = ['note', 'tip', 'warn', 'danger', 'success'];
export const LIST_VARIANTS = ['bullet', 'numbered', 'check', 'arrow', 'plain'];

/**
 * The fields every block shares. One schema for all types rather than a
 * discriminator per type, matching PatternGuide: a block is small, the unused
 * fields cost nothing at rest because they are defaults, and the alternative —
 * fourteen discriminators — makes reordering blocks in an array painful for no
 * gain. Which fields apply to which type is enforced by zod at the edge, where
 * a bad payload can still be rejected with a useful message.
 */
const blockFields = (types) => ({
  /**
   * Stable per block, and not Mongo's `_id`.
   *
   * The editor needs an identity that exists before the block is ever saved —
   * for drag and drop, for React keys, for the anchor a heading contributes to
   * the table of contents. `_id` is assigned by the database on insert, which is
   * too late for all three.
   */
  id: { type: String, default: () => randomUUID().slice(0, 8) },
  type: { type: String, required: true, enum: types },

  // heading | paragraph | callout | quote | list-less text-carrying blocks
  text: { type: String, default: '' },
  // heading only, 2-4. The note's own title is the h1, so a block never is.
  level: { type: Number, default: 2, min: 2, max: 4 },

  // list
  items: { type: [listItemSchema], default: undefined },
  variant: { type: String, default: '' },

  // callout | dropdown — the coloured label above the body
  title: { type: String, default: '' },
  tone: { type: String, default: '' },

  // dropdown — whether it renders expanded on first paint
  open: { type: Boolean, default: false },

  // code
  variants: { type: [codeVariantSchema], default: undefined },

  // table
  columns: { type: [String], default: undefined },
  rows: { type: [[String]], default: undefined },

  // links
  links: { type: [linkSchema], default: undefined },

  // image | file | video-as-upload
  asset: { type: assetSchema, default: undefined },
  // gallery
  assets: { type: [assetSchema], default: undefined },
  caption: { type: String, default: '' },
  // image | gallery layout
  align: { type: String, default: 'center' },
  width: { type: String, default: 'full' },

  // video — a YouTube id, not a URL. An id cannot carry a payload; a URL can.
  videoId: { type: String, default: '' },

  // quote
  cite: { type: String, default: '' },
});

const leafBlockSchema = new mongoose.Schema(blockFields(LEAF_BLOCK_TYPES), { _id: false });

/**
 * A top-level block, which may be a dropdown holding leaf blocks.
 *
 * Nesting stops at one level, and that is a decision rather than a limitation
 * left for later. A self-referencing Mongoose schema is possible but fragile,
 * and unbounded nesting turns every consumer — the renderer, `plainText`, the
 * asset walker, the editor's drag target — into a recursive function with a
 * depth guard bolted on. One level covers what this content actually needs (a
 * collapsed "the full stack trace", "the config that finally worked") and keeps
 * every one of those consumers a flat loop over two arrays.
 */
const blockSchema = new mongoose.Schema(
  {
    ...blockFields(BLOCK_TYPES),
    children: { type: [leafBlockSchema], default: undefined },
  },
  { _id: false },
);

/* -------------------------------------------------------------------------- */
/* the note                                                                    */
/* -------------------------------------------------------------------------- */

export const VISIBILITIES = ['private', 'unlisted', 'public'];
export const NOTE_STATUSES = ['draft', 'published'];

const noteSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    /**
     * Denormalised for the same reason File copies `requestedByEmail`: a public
     * note outlives interest in its author's row, and a populate against a
     * deleted user yields null — leaving a shared page bylined "by null".
     */
    authorName: { type: String, default: '' },

    title: { type: String, required: true, trim: true, maxlength: 200 },

    /**
     * Readable, and unique *per author* rather than globally.
     *
     * Two people are both going to write "s3-cors-hell", and neither should get
     * a suffix because of the other. Public links do not use this field at all
     * — see `publicId` — so uniqueness never has to reach across users.
     */
    slug: { type: String, required: true, index: true },

    /**
     * The handle a shared link is built from, unguessable and stable.
     *
     * Separate from `slug` because it must survive a rename: someone shares a
     * note, then fixes a typo in the title, and the link in the message they
     * already sent has to keep working. It also means a public URL leaks
     * nothing about the author's other notes, which sequential ids or
     * `/:userId/:slug` both would.
     */
    publicId: {
      type: String,
      unique: true,
      index: true,
      default: () => randomBytes(8).toString('base64url'),
    },

    /** One line under the title, and the card's body in a list. */
    summary: { type: String, default: '', maxlength: 500 },
    /** A single emoji, Notion-style. Cosmetic, and cheap enough to be worth it. */
    icon: { type: String, default: '', maxlength: 8 },
    cover: { type: assetSchema, default: undefined },

    blocks: { type: [blockSchema], default: [] },

    tags: { type: [String], default: [], index: true },
    /** Free-form grouping — 'aws', 'react', 'interview'. The sidebar's folders. */
    category: { type: String, default: '', index: true, maxlength: 60 },

    /**
     * Optional links back into the roadmap, so a note written while grinding
     * two-pointers can surface on that pattern's page. Slugs rather than refs:
     * a note may reference a problem the user later deletes, and a dangling
     * ObjectId reads as corruption where a dangling slug reads as history.
     */
    patternSlug: { type: String, default: '', index: true },
    problemSlug: { type: String, default: '' },

    /**
     * Who can read this.
     *
     * Three values, not two, because "public" is doing two different jobs in
     * most people's heads: *listed* — anyone may find this in the feed — and
     * *link-only* — I sent this to one person and it is not for the index.
     * Collapsing them forces anyone who wants the second to accept the first.
     *
     * The default is `private`, and the default is the point: a note is written
     * before it is shared, and the failure mode of the other default is
     * publishing something nobody meant to publish.
     */
    visibility: { type: String, enum: VISIBILITIES, default: 'private', index: true },

    /**
     * Orthogonal to visibility, deliberately. Visibility answers "who may read
     * it"; status answers "is it finished". A public draft is a real state — the
     * note is shared with a colleague mid-write — and one field cannot hold both
     * answers without one of them being a lie.
     */
    status: { type: String, enum: NOTE_STATUSES, default: 'draft', index: true },

    pinned: { type: Boolean, default: false },
    favorite: { type: Boolean, default: false },

    /**
     * Every word of the note's prose, flattened on save.
     *
     * The reason this field exists rather than a text index over `blocks`: a
     * text index on a nested array indexes each element separately and cannot
     * span them, so "presigned put" would only match if both words landed in the
     * same paragraph. Flattening first makes the whole note one searchable
     * document. `select: false` keeps it off every read that is not a search —
     * it is a duplicate of content the client already has in `blocks`.
     */
    plainText: { type: String, default: '', select: false },
    wordCount: { type: Number, default: 0 },
    readingMinutes: { type: Number, default: 0 },

    views: { type: Number, default: 0 },

    publishedAt: { type: Date, default: null },
    /** Distinct from `updatedAt`, which a view counter bump would also move. */
    lastEditedAt: { type: Date, default: null },

    /**
     * Soft delete, for the reason File uses one and one more.
     *
     * A note owns S3 objects. Hard-deleting the row would strand every image and
     * PDF it referenced — the keys live in `blocks`, and dropping the document
     * is what makes them unfindable. Marking it instead keeps the keys reachable
     * until the sweeper has confirmed the bytes are gone, and gives the author
     * an undo on a button whose mistake is otherwise unrecoverable.
     */
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

/* -------------------------------------------------------------------------- */
/* indexes                                                                     */
/* -------------------------------------------------------------------------- */

// "my notes, newest first" — the list view's only query.
noteSchema.index({ author: 1, deletedAt: 1, updatedAt: -1 });
// Pinned first within that same list.
noteSchema.index({ author: 1, pinned: -1, updatedAt: -1 });
// The uniqueness `slug` promises. Scoped to the author, never global.
noteSchema.index({ author: 1, slug: 1 }, { unique: true });
// The public feed.
noteSchema.index({ visibility: 1, status: 1, deletedAt: 1, publishedAt: -1 });
// "what did I write about two-pointers"
noteSchema.index({ author: 1, patternSlug: 1, deletedAt: 1 });

/**
 * One text index for the whole collection — Mongo permits exactly one, so this
 * has to cover both searches that exist. Weights put a title match above a body
 * match, which is what makes searching your own notes feel like it works: the
 * note *called* "CORS" should outrank the twelve that merely mention it.
 */
noteSchema.index(
  { title: 'text', summary: 'text', tags: 'text', plainText: 'text' },
  { weights: { title: 10, tags: 6, summary: 4, plainText: 1 }, name: 'note_search' },
);

/* -------------------------------------------------------------------------- */
/* derived fields                                                              */
/* -------------------------------------------------------------------------- */

/** A slug candidate. Uniqueness is the service's job — see `uniqueSlug`. */
export const slugify = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    // Strips the combining marks NFKD just split off, so "récursion" slugs to
    // "recursion" rather than losing the letter it was attached to.
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'note';

/** Every block, top level and nested, as one flat list. */
export const flatBlocks = (blocks = []) =>
  blocks.flatMap((block) => [block, ...(block.children || [])]);

/**
 * The note's prose as one string.
 *
 * Code is included rather than skipped, which is the opposite of what a blog
 * would do. The thing people come back to these notes for is frequently the
 * error message — searching "ENOTFOUND" or "SignatureDoesNotMatch" has to find
 * the note that pasted it, and that text only ever lives in a code block.
 *
 * Capped because the field is duplicated content and a runaway note should not
 * double the collection's size on its own.
 */
export function plainTextOf(blocks = [], limit = 20000) {
  const parts = [];

  for (const block of flatBlocks(blocks)) {
    if (block.text) parts.push(block.text);
    if (block.title) parts.push(block.title);
    if (block.caption) parts.push(block.caption);
    if (block.cite) parts.push(block.cite);
    for (const item of block.items || []) if (item.text) parts.push(item.text);
    for (const variant of block.variants || []) if (variant.code) parts.push(variant.code);
    for (const link of block.links || []) parts.push([link.label, link.description].filter(Boolean).join(' '));
    for (const row of block.rows || []) parts.push(row.join(' '));
    if (block.columns?.length) parts.push(block.columns.join(' '));
  }

  return parts.join('\n').replace(/\s+/g, ' ').trim().slice(0, limit);
}

/** Every S3-backed asset in a note, wherever it sits. */
export function noteAssets(note) {
  const found = [];
  if (note.cover?.key) found.push(note.cover);
  for (const block of flatBlocks(note.blocks || [])) {
    if (block.asset?.key) found.push(block.asset);
    for (const asset of block.assets || []) if (asset?.key) found.push(asset);
  }
  return found;
}

/**
 * Section headings, for the "ON THIS PAGE" rail.
 *
 * Derived on read rather than stored: it is a pure function of the blocks, and
 * a stored copy is one more thing that can disagree with them. Headings inside a
 * dropdown are skipped — a link that scrolls to something collapsed and
 * invisible is worse than no link.
 */
export function tableOfContents(blocks = []) {
  return (blocks || [])
    .filter((block) => block.type === 'heading' && block.text?.trim())
    .map((block) => ({
      id: block.id,
      text: block.text.trim(),
      level: block.level || 2,
    }));
}

/**
 * Recomputes everything derived from `blocks`.
 *
 * A hook rather than something callers remember to do, because the failure is
 * silent: a note updated without this keeps searching and reading as its old
 * self, and nothing in the response says so.
 */
noteSchema.pre('save', function derive(next) {
  if (this.isModified('blocks')) {
    this.plainText = plainTextOf(this.blocks);
    this.wordCount = this.plainText ? this.plainText.split(/\s+/).length : 0;
    // 200 wpm, floored at a minute — "0 min read" is not a thing anyone wants
    // to see, and a note with three lines still reads as "1 min".
    this.readingMinutes = Math.max(1, Math.round(this.wordCount / 200));
    this.lastEditedAt = new Date();
  }

  // Stamped once, on the first publish. Re-publishing an unpublished note keeps
  // its original date, which is what a reader expects a byline date to mean.
  if (this.status === 'published' && !this.publishedAt) this.publishedAt = new Date();

  next();
});

/* -------------------------------------------------------------------------- */
/* queries                                                                     */
/* -------------------------------------------------------------------------- */

/** Live notes only — the base every read starts from. */
noteSchema.statics.live = function live(filter = {}) {
  return this.find({ ...filter, deletedAt: null });
};

noteSchema.statics.softDelete = function softDelete(id, userId = null) {
  return this.findOneAndUpdate(
    { _id: id, deletedAt: null },
    { $set: { deletedAt: new Date(), deletedBy: userId } },
    { new: true },
  );
};

/* -------------------------------------------------------------------------- */
/* wire shapes                                                                 */
/* -------------------------------------------------------------------------- */

noteSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.__v;
    delete ret.plainText;
    return ret;
  },
});

/**
 * The card in a list: everything a tile renders, and none of the body.
 *
 * Blocks are the expensive part of a note and a list of thirty would ship every
 * code block and every base64-free-but-still-large table for nothing.
 */
export const noteCard = (note) => ({
  id: note._id,
  title: note.title,
  slug: note.slug,
  publicId: note.publicId,
  summary: note.summary,
  icon: note.icon,
  cover: note.cover?.url ? { url: note.cover.url, name: note.cover.name } : null,
  tags: note.tags ?? [],
  category: note.category || '',
  patternSlug: note.patternSlug || '',
  visibility: note.visibility,
  status: note.status,
  pinned: Boolean(note.pinned),
  favorite: Boolean(note.favorite),
  wordCount: note.wordCount ?? 0,
  readingMinutes: note.readingMinutes ?? 0,
  views: note.views ?? 0,
  author: { id: note.author, name: note.authorName || '' },
  publishedAt: note.publishedAt ?? null,
  updatedAt: note.updatedAt,
  createdAt: note.createdAt,
});

/**
 * The full note, as its author sees it.
 *
 * `_id` is included — the author's own client edits by id. What is not included
 * is anything about where the bytes live: assets are stripped down to a URL and
 * the facts a renderer needs, so no S3 key reaches the browser. A key is not
 * itself a credential, but publishing one invites a direct request to the
 * bucket and pins a storage layout the client should never learn.
 */
export const publicAsset = (asset) =>
  asset && asset.key
    ? {
        id: asset.fileId ?? null,
        url: asset.url ?? null,
        name: asset.name || '',
        contentType: asset.contentType || '',
        kind: asset.kind || kindFor(asset.contentType || ''),
        bytes: asset.bytes ?? 0,
        width: asset.width ?? null,
        height: asset.height ?? null,
        meta: asset.meta ?? {},
      }
    : null;

const publicBlock = (block) => {
  const out = { id: block.id, type: block.type };

  if (block.text) out.text = block.text;
  if (block.type === 'heading') out.level = block.level || 2;
  if (block.title) out.title = block.title;
  if (block.tone) out.tone = block.tone;
  if (block.variant) out.variant = block.variant;
  if (block.caption) out.caption = block.caption;
  if (block.cite) out.cite = block.cite;
  if (block.videoId) out.videoId = block.videoId;
  if (block.type === 'dropdown') out.open = Boolean(block.open);
  if (block.type === 'image' || block.type === 'gallery') {
    out.align = block.align || 'center';
    out.width = block.width || 'full';
  }

  if (block.items?.length) out.items = block.items.map((i) => ({ ...i }));
  if (block.variants?.length) out.variants = block.variants.map((v) => ({ ...v }));
  if (block.links?.length) out.links = block.links.map((l) => ({ ...l }));
  if (block.columns?.length) out.columns = block.columns;
  if (block.rows?.length) out.rows = block.rows;
  if (block.asset?.key) out.asset = publicAsset(block.asset);
  if (block.assets?.length) out.assets = block.assets.map(publicAsset).filter(Boolean);
  if (block.children?.length) out.children = block.children.map(publicBlock);

  return out;
};

export const publicNote = (note) => ({
  ...noteCard(note),
  blocks: (note.blocks || []).map(publicBlock),
  toc: tableOfContents(note.blocks),
  problemSlug: note.problemSlug || '',
  lastEditedAt: note.lastEditedAt ?? null,
  deletedAt: note.deletedAt ?? null,
});

/**
 * What a reader who is not the author gets.
 *
 * Only the counters and the byline differ, but the split is worth having as its
 * own function: it is the one place to look when asking "what does a stranger
 * see", and it means `visibility` and `status` — which describe the author's
 * intent, not the content — never leak into a shared page.
 */
const withoutIntent = ({ visibility, status, favorite, pinned, deletedAt, ...rest }) => rest;

export const sharedNote = (note) => withoutIntent(publicNote(note));

/** The same trim, for a card in the public feed. */
export const sharedCard = (note) => withoutIntent(noteCard(note));

export const Note = mongoose.model('Note', noteSchema);
