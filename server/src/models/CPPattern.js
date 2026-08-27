import mongoose from 'mongoose';
import { CP_TIER_SLUGS } from '../config/cpTiers.js';
import { guideLinkSchema } from './schemas/guideBlock.js';

/**
 * One competitive-programming technique.
 *
 * A separate collection from `Pattern` rather than a `track` field on it, and
 * the reason is that they are not the same kind of thing wearing different
 * labels. An interview pattern is a *recognition* unit — "this is a sliding
 * window problem" is the whole insight, and the code follows. A CP pattern is an
 * *implementation* unit: everybody above 1600 knows what a segment tree is, and
 * the difficulty is the reduction to it. So the two carry different fields
 * (`tier`, `prereqs`, `brief.invariant` mean nothing on the roadmap) and are
 * read by different pages. Sharing a collection would mean every roadmap query
 * growing a filter it would be a bug to forget.
 *
 * There are roughly 48 of these against the roadmap's 22, because CP splits
 * where interview prep does not: "DP" is one interview pattern and eight CP
 * ones, and someone who can do knapsack cannot necessarily do digit DP.
 */

/**
 * The short-form teaching content every pattern carries.
 *
 * On the pattern rather than in the guide collection, deliberately. It is ten
 * short fields and the ladder renders it inline the moment a section is opened,
 * where a guide is a second request behind a click. The trade is that
 * `listPatterns` ships it on every load — about 40KB across all 48, which is
 * less than one problem's cached LeetCode description.
 *
 * `invariant` is the field that earns the block. Most CP patterns are one
 * sentence about what stays true, and someone who can state it can usually
 * write the code; someone who cannot state it is about to write a solution that
 * passes the samples and fails test 4.
 */
const briefSchema = new mongoose.Schema(
  {
    /** What stays true while the technique runs. The one sentence worth memorising. */
    invariant: { type: String, default: '' },
    /** The signal in a statement that says "this one". */
    whenItFires: { type: String, default: '' },
    /** Typical complexity, as plain text — 'O(n log n)', not LaTeX. */
    complexity: { type: String, default: '' },
    /** The mistakes that cost a WA rather than a TLE. */
    traps: { type: [String], default: [] },
    /** Reading list: cp-algorithms, USACO Guide, CF editorials and blogs. */
    links: { type: [guideLinkSchema], default: [] },
  },
  { _id: false },
);

const cpPatternSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    /** Position in the curriculum. Lower = learn first. */
    order: { type: Number, required: true },

    /**
     * The tier this technique is *introduced* at, not the only tier it appears
     * in. Binary search on the answer is introduced at Pupil and still shows up
     * in 2400s — the ladder groups problems by their own rating, and this only
     * decides where the pattern first appears in the pattern-first view.
     */
    tier: { type: String, enum: CP_TIER_SLUGS, required: true, index: true },

    blurb: { type: String, default: '' },
    keyTechniques: { type: [String], default: [] },
    brief: { type: briefSchema, default: () => ({}) },

    /**
     * Patterns you want under your belt first, by slug.
     *
     * Not enforced anywhere — nothing locks a section. It drives a hint on the
     * section header ("assumes: DSU, sorting"), which is the useful half of a
     * prerequisite graph without the half that tells an adult what they may not
     * read.
     */
    prereqs: { type: [String], default: [] },

    /**
     * Same contract as Pattern.editedAt: set by the admin panel, and the seeder
     * leaves an edited pattern alone. `seed:cp:db` `$set`s every field above on
     * each run, so without this a hand-corrected blurb is silently reverted.
     */
    editedAt: { type: Date, default: null },
    editedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

export const CPPattern = mongoose.model('CPPattern', cpPatternSchema);
