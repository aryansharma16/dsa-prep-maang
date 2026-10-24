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
    /*
      'striver-sde' | 'neetcode-150' | 'blind-75' | 'faang-2026' | 'sheet-150' | 'ai-300'

      Five are imported lists (sheet-150 from a hand-kept file in data/raw); `ai-300` is computed from the curated rows
      themselves at seed time — see server/scripts/seed/ai-sheet.js. Not an enum,
      deliberately: a sheet is a label the curation pass writes, and pinning the
      set here would mean a schema change every time one is added.
    */
    sheet: { type: String, required: true },
    // e.g. 'Day 5: Linked List' or 'Arrays & Hashing'
    group: { type: String, default: '' },
    order: { type: Number, default: 0 },
  },
  { _id: false },
);

const problemSchema = new mongoose.Schema(
  {
    /**
     * Unique per owner, not globally — see the compound index below.
     */
    slug: { type: String, required: true },
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
    /**
     * Which move inside the pattern this problem drills — a slug from that
     * pattern's `subPatterns` (scripts/seed/subpatterns.js). Empty for problems
     * nobody has filed yet, which the roadmap shows under "Other".
     */
    subPattern: { type: String, default: '' },

    topicTags: { type: [String], default: [] },
    companies: { type: [companySchema], default: [] },
    /**
     * Companies reported to have asked this in 2025-26, from the FAANG
     * interview-questions repo.
     *
     * Names only, and deliberately separate from `companies` above. That field
     * is a measured ask-frequency per company from a dataset with no date on
     * it — a problem Google stopped asking in 2019 carries the same freq as one
     * they asked last month. This one carries no frequency at all and is a
     * recency claim instead. Merging them would put an invented number beside
     * measured ones in a single array, and nothing downstream could tell which
     * was which. Two fields: `companies` is how often, this is lately.
     *
     * Not every name here has a company logo or a CSV — OpenAI, Anthropic,
     * Databricks and Stripe appear only in this field.
     */
    askedRecently: { type: [String], default: [] },
    sheets: { type: [sheetSchema], default: [] },

    // LeetCode's own problem number — the one everyone quotes ("LC 42").
    lcId: { type: Number, default: 0 },

    /**
     * In the bank but not on the default roadmap. Set for problems imported
     * only because a list needs them (the resource kit's 360, via
     * scripts/interview/import-kit-problems.js). The roadmap, its counts,
     * Stats and the Playbook all skip these; the roadmap shows them only when
     * asked (`GET /problems?extras=only`, used by the Kit 360 sheet filter and
     * the 30-Day Sprint page).
     */
    extra: { type: Boolean, default: false, index: true },

    likes: { type: Number, default: 0 },
    dislikes: { type: Number, default: 0 },
    // Share of votes that are likes, 0-100. A better quality signal than raw
    // likes, which mostly track how long a problem has existed.
    likeRatio: { type: Number, default: 0 },
    /**
     * Never populated: the upstream LeetCode index carries no acceptance rate.
     * Kept because existing documents have the field, but nothing reads it.
     */
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

    /**
     * Stamped whenever the admin panel writes this problem. Its presence is
     * what stops the seeder overwriting that work, and what keeps the prune
     * from deleting an admin-created shared problem — see scripts/seed/seed.js.
     *
     * Null means "still exactly what the curation pass produced", and the
     * seeder is free to refresh it. Same name and same contract as
     * PatternGuide.editedAt, deliberately: one idiom, not two.
     */
    editedAt: { type: Date, default: null, index: true },
    editedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

/**
 * A slug identifies a problem *within one person's list*, which is why this is
 * compound rather than a unique constraint on `slug` alone.
 *
 * Globally unique looks right until two people add the same LeetCode problem.
 * The second one is refused — and refused with "that problem is already in your
 * list", about a row they cannot see and did not create. One learner adding a
 * problem must not be able to change what another learner is allowed to add;
 * that is the whole meaning of a private addition.
 *
 * Mongo treats `owner: null` as a value here, so the seeded curriculum still
 * gets exactly one row per slug and each user gets at most one of their own
 * alongside it. That is the constraint that actually matters: nobody ends up
 * with the same problem twice in one list.
 *
 * Queries by slug alone still use this index — it is the leading field — so the
 * standalone one it replaced is not missed. It does mean `findOne({ slug })`
 * with no owner is now ambiguous by construction, and every caller scopes it.
 */
problemSchema.index({ slug: 1, owner: 1 }, { unique: true });

// The roadmap query walks patterns in order, then problems in ramp order.
problemSchema.index({ patternSlug: 1, patternOrder: 1 });
// Company filter
problemSchema.index({ 'companies.name': 1 });
// The recency filter, which is a separate axis from the one above.
problemSchema.index({ askedRecently: 1 });

export const Problem = mongoose.model('Problem', problemSchema);
