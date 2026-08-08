import mongoose from 'mongoose';

const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    // 0-100, normalised per company by the source dataset
    freq: { type: Number, default: 0 },
  },
  { _id: false },
);

const sheetSchema = new mongoose.Schema(
  {
    // 'striver-sde' | 'neetcode-150' | 'blind-75'
    sheet: { type: String, required: true },
    // e.g. 'Day 5: Linked List' or 'Arrays & Hashing'
    group: { type: String, default: '' },
    order: { type: Number, default: 0 },
  },
  { _id: false },
);

const problemSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    source: {
      type: String,
      enum: ['leetcode', 'gfg', 'custom'],
      default: 'leetcode',
    },
    difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], required: true },
    url: { type: String, default: '' },
    // Secondary reference link (Striver's article, editorial, etc.)
    articleUrl: { type: String, default: '' },

    patternSlug: { type: String, required: true, index: true },
    // Position inside the pattern. Easy problems first — this ordering is the learning ramp.
    patternOrder: { type: Number, default: 0 },

    topicTags: { type: [String], default: [] },
    companies: { type: [companySchema], default: [] },
    sheets: { type: [sheetSchema], default: [] },

    likes: { type: Number, default: 0 },
    acceptance: { type: Number, default: 0 },
    // Relevance score from the curation pass, used as the default sort tiebreak
    score: { type: Number, default: 0 },
    videoId: { type: String, default: '' },

    // Fetched lazily from the LeetCode API the first time the problem is opened.
    descriptionHtml: { type: String, default: null },
    descriptionFetchedAt: { type: Date, default: null },

    /**
     * Visibility: null means everyone sees it (the seeded curriculum), otherwise
     * only that user does.
     */
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },

    /**
     * Provenance: who created this record. null means it came from the seed.
     *
     * Deliberately separate from `owner`, which is a visibility rule. Today they
     * match for every user-added problem, but they answer different questions —
     * if a problem is ever promoted into the shared list, `owner` goes null while
     * `addedBy` must keep pointing at the person who contributed it. Collapsing
     * the two would lose that permanently.
     */
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  },
  { timestamps: true },
);

// The roadmap query walks patterns in order, then problems in ramp order.
problemSchema.index({ patternSlug: 1, patternOrder: 1 });
// Company filter
problemSchema.index({ 'companies.name': 1 });

export const Problem = mongoose.model('Problem', problemSchema);
