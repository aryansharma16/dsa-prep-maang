import mongoose from 'mongoose';

/**
 * The block vocabulary a long-form guide is written in.
 *
 * Content is a list of typed blocks, not an HTML or Markdown string. The client
 * renders each block with a React component, which means no sanitizer stands
 * between the database and the page, and the admin panel gets a form to bind to
 * instead of a textarea full of markup.
 *
 * Extracted here because two collections now speak it — `PatternGuide` for the
 * interview curriculum and `CPPatternGuide` for the competitive-programming one.
 * They are separate collections on purpose (a CP guide and a roadmap guide are
 * different content for different readers, and the seeders that write them are
 * separate), but the *vocabulary* is one thing: `GuideBlocks.jsx` renders both
 * from the same switch, and a `type` added to one enum and not the other would
 * be a block the renderer draws and the database refuses to store.
 */

const codeVariantSchema = new mongoose.Schema(
  {
    // 'java' | 'cpp' | 'js' | 'text' — the renderer shows a tab per variant.
    lang: { type: String, required: true },
    label: { type: String, default: '' },
    code: { type: String, required: true },
  },
  { _id: false },
);

const linkSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    url: { type: String, required: true },
    // Where it points — shown as a muted suffix, e.g. 'cp-algorithms.com'.
    source: { type: String, default: '' },
  },
  { _id: false },
);

export const BLOCK_TYPES = [
  'heading',
  'paragraph',
  'bullets',
  'code',
  'callout',
  'table',
  'image',
  'video',
  'links',
  /*
    The last two came from the Learn HLD track, where the page is mostly
    pictures. Neither adds a field: `diagram` is `text` + `caption` and `flow`
    is `items` + `caption`, which is the reason they were shaped this way. A
    block type is cheap here and expensive everywhere else — the renderer, the
    zod union, the editor's field list, the seeder's verifier and `toPlaintext`
    all have to learn it — so reusing the existing fields keeps that cost to a
    switch case instead of a migration.

    `diagram` is ASCII art drawn as a *figure*: no line-number gutter, no tab
    strip, no copy button. The Networks track draws its handshakes in `sh` code
    blocks for want of anything better, and a reader cannot tell a picture from
    a snippet when both arrive wearing a gutter and a Copy.

    `flow` is a pipeline — `Client → CDN → LB → Service → DB` — as chips rather
    than as a line of monospace, so it reflows on a narrow screen instead of
    scrolling sideways off it.
  */
  'diagram',
  'flow',
];

export const guideBlockSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, enum: BLOCK_TYPES },

    // heading | paragraph | callout | image caption | diagram art
    text: { type: String, default: '' },
    // bullets | flow steps
    items: { type: [String], default: [] },
    // code — one entry renders plain, several render as tabs
    variants: { type: [codeVariantSchema], default: [] },
    // table
    columns: { type: [String], default: [] },
    rows: { type: [[String]], default: [] },
    /*
      table | diagram | flow — an optional name above the thing, and for a
      table, what kind of grid it is.

      Both came from the Learn SQL track, where a section is regularly "here are
      the tables, here is the query, here is the result" and three unlabelled
      grids in a row is a puzzle. Kept in step here because the vocabulary is one
      thing across both collections — see the note at the top of this file — even
      though no seeded guide sets them yet. `''` and undefined render exactly as
      every table written before them did.

      `caption` carries more weight on the two newer types than it does on a
      table: it is the only label a diagram or a flow has, and on the HLD
      track's scale ladder it is the rung itself — `1K users`, `100K users`.

      `quick` is the third grid kind, and the Interview Quick Look box the HLD
      track opens on: rows of `[label, what to say]`, the header row hidden
      because the caption already names it.
    */
    caption: { type: String, default: '' },
    variant: { type: String, enum: ['', 'data', 'result', 'quick'], default: '' },
    // callout
    tone: { type: String, enum: ['note', 'warn', 'tip'], default: 'note' },
    // image
    url: { type: String, default: '' },
    // video — a YouTube id, not a full URL
    videoId: { type: String, default: '' },
    // links
    links: { type: [linkSchema], default: [] },
  },
  { _id: false },
);

/**
 * The link sub-schema on its own, for documents that carry links outside a
 * block — `CPPattern.brief.links` is a short reading list, not a guide.
 */
export const guideLinkSchema = linkSchema;
