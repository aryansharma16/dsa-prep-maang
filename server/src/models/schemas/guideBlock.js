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
];

export const guideBlockSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, enum: BLOCK_TYPES },

    // heading | paragraph | callout | image caption
    text: { type: String, default: '' },
    // bullets
    items: { type: [String], default: [] },
    // code — one entry renders plain, several render as tabs
    variants: { type: [codeVariantSchema], default: [] },
    // table
    columns: { type: [String], default: [] },
    rows: { type: [[String]], default: [] },
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
