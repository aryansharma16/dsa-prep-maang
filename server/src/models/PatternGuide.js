import mongoose from 'mongoose';

/**
 * Long-form reference for one pattern — the "why" the roadmap itself does not
 * carry. One document per pattern slug.
 *
 * Deliberately its own collection rather than a field on Pattern: `listPatterns`
 * reads the whole collection with no projection and the roadmap aggregation
 * $lookups whole pattern documents, so a guide field would ship every guide on
 * every sidebar load.
 *
 * Content is a list of typed blocks, not an HTML or Markdown string. The client
 * renders each block with a React component, which means no sanitizer stands
 * between the database and the page, and the admin panel gets a form to bind to
 * instead of a textarea full of markup.
 */

const codeVariantSchema = new mongoose.Schema(
  {
    // 'java' | 'cpp' | 'text' — the renderer shows a tab per variant.
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
    // Where it points — shown as a muted suffix, e.g. 'docs.oracle.com'.
    source: { type: String, default: '' },
  },
  { _id: false },
);

const blockSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: [
        'heading',
        'paragraph',
        'bullets',
        'code',
        'callout',
        'table',
        'image',
        'video',
        'links',
      ],
    },

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

const patternGuideSchema = new mongoose.Schema(
  {
    patternSlug: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    summary: { type: String, default: '' },
    blocks: { type: [blockSchema], default: [] },

    /**
     * Stamped by the admin panel when a human edits a guide. Its presence is
     * what stops the seeder from overwriting that work — see scripts/seed/guides.js.
     * Null means "still exactly what was seeded", and the seeder is free to
     * refresh it.
     */
    editedAt: { type: Date, default: null },
    seededAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const PatternGuide = mongoose.model('PatternGuide', patternGuideSchema);
