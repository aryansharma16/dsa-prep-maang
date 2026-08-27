import mongoose from 'mongoose';
import { CP_TIER_SLUGS } from '../config/cpTiers.js';

/**
 * One competitive-programming problem, from Codeforces or CodeChef.
 *
 * Separate from `Problem` rather than a `platform: 'codeforces'` value on it.
 * The deciding field is `difficulty`: on the roadmap it is a three-value enum
 * that every query, filter, badge and stats bucket is built around, and there is
 * no honest way to write 1847 into it. Codeforces difficulty is an integer with
 * ~30 meaningful values and a rank name attached; CodeChef's is a different
 * integer on a different scale. Collapsing either into Easy/Medium/Hard throws
 * away the one number the whole module is organised by.
 *
 * The rest follows from that. A CP problem carries a contest, a division, an
 * index letter and a solve count; a roadmap problem carries sheets, a LeetCode
 * id and a like ratio. Two shapes, two collections, and neither query has to
 * remember to exclude the other's rows.
 *
 * What is *not* different is the ownership model. `slug`/`owner`/`addedBy`/
 * `editedAt` mean exactly what they mean on `Problem`, down to the compound
 * index, because "the seeded curriculum plus your own additions" is the same
 * rule here and a second rule would be a second set of bugs.
 */

const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    freq: { type: Number, default: 0 },
  },
  { _id: false },
);

/**
 * Where a problem came from, when it came from a curated list rather than from
 * the ratings sweep.
 *
 * The reason a problem is on the ladder is worth keeping. "It scored well on
 * solve count" and "the CP-31 sheet picks this as *the* binary-search-on-answer
 * problem" are different claims, and only the second is worth showing a learner
 * as a reason to do this one next.
 */
const sheetSchema = new mongoose.Schema(
  {
    // 'cp-31' | 'a2oj' | 'usaco-guide' | 'cp-algorithms' | 'cc-dsa-series' | 'cc-practice'
    sheet: { type: String, required: true },
    group: { type: String, default: '' },
    order: { type: Number, default: 0 },
    /** One line on why this problem is the canonical example. Rendered on the row. */
    note: { type: String, default: '' },
  },
  { _id: false },
);

/**
 * Codeforces' own metadata, kept under its own key rather than flattened.
 *
 * Nested because half of it is meaningless on a CodeChef row and a flat schema
 * would leave `division: ''` and `rating: 0` on 200 documents that have a
 * perfectly good difficulty of their own. A missing sub-document says "not a
 * Codeforces problem"; a zeroed field says "a Codeforces problem with no
 * rating", which is a different and wrong claim.
 */
const codeforcesSchema = new mongoose.Schema(
  {
    contestId: { type: Number, required: true },
    /** 'A' | 'B1' | 'F2' — the letter, with the sub-index where there is one. */
    index: { type: String, required: true },
    /** 800-3500 in steps of 100. The number the whole module is organised by. */
    rating: { type: Number, default: 0 },
    /** Contest points. Says something about relative difficulty within a round. */
    points: { type: Number, default: 0 },
    /**
     * How many accounts have solved it, from `problemset.problems`.
     *
     * The single best quality signal the API offers. It is not just popularity:
     * a problem nobody solves is usually one with a statement nobody
     * understands, and the curation floor uses it for exactly that.
     */
    solvedCount: { type: Number, default: 0 },
    contestName: { type: String, default: '' },
    /** 'CF' | 'ICPC' — CF's own contest type, not the division. */
    contestType: { type: String, default: '' },
    /** 'Div. 2' | 'Div. 1' | 'Div. 3' | 'Div. 4' | 'Div. 1 + 2' | 'Educational' | 'Global' | 'Other' */
    division: { type: String, default: '' },
    contestStartedAt: { type: Date, default: null },
  },
  { _id: false },
);

const codechefSchema = new mongoose.Schema(
  {
    /** The problem code — 'FLOW001'. What the URL is built from. */
    code: { type: String, required: true },
    /** CodeChef's own 1000-3000 scale. Not comparable to a CF rating; never mixed with one. */
    difficultyRating: { type: Number, default: 0 },
    /** 'Beginner' | 'Easy' | 'Medium' | 'Hard' | 'Challenge' */
    difficultyLabel: { type: String, default: '' },
    /** 'practice' | 'starters' | 'long' | 'cookoff' | 'lunchtime' | 'learning' */
    category: { type: String, default: '' },
    contestCode: { type: String, default: '' },
    contestName: { type: String, default: '' },
    /** Starters divisions: 'Div 1' … 'Div 4'. Empty for practice problems. */
    division: { type: String, default: '' },
    successfulSubmissions: { type: Number, default: 0 },
  },
  { _id: false },
);

/**
 * A reference implementation, when a curated source publishes one.
 *
 * A link, never the code itself. Two reasons, and both matter. The code belongs
 * to whoever wrote it and lives under their licence in their repository —
 * copying it into this database would be redistributing it, and a stale copy at
 * that. And a solution that appears inline on the row is a solution someone
 * reads by accident: linking it puts a deliberate click between a learner and
 * the answer, which is the difference between a reference and a spoiler.
 *
 * `lang` is 'cpp' or 'java' — C++ because that is what competitive programming
 * is written in, Java because that is what a large share of the people arriving
 * from the interview curriculum already know.
 */
const solutionSchema = new mongoose.Schema(
  {
    lang: { type: String, enum: ['cpp', 'java', 'python'], required: true },
    url: { type: String, required: true },
    /** Attribution — the repo it came from, shown next to the link. */
    source: { type: String, default: '' },
  },
  { _id: false },
);

const cpProblemSchema = new mongoose.Schema(
  {
    /**
     * 'cf-1352-G' | 'cc-FLOW001'. Unique per owner, not globally — see the
     * compound index below, which carries the same argument `Problem` makes.
     */
    slug: { type: String, required: true },
    title: { type: String, required: true },

    platform: {
      type: String,
      enum: ['codeforces', 'codechef', 'custom'],
      required: true,
      index: true,
    },

    /**
     * The platform's own difficulty label, as text — '1400' for Codeforces,
     * 'Easy' for CodeChef, whatever the user typed for a custom addition.
     *
     * A display string on purpose. The comparable number lives in
     * `codeforces.rating` / `codechef.difficultyRating`, and the two scales do
     * not convert: a CodeChef 1600 and a Codeforces 1600 are not the same
     * problem. Anything that sorts or buckets reads the platform block; this is
     * what a badge renders when it does not care.
     */
    difficulty: { type: String, default: '' },

    url: { type: String, default: '' },
    /** The official editorial. On Codeforces this is the round's tutorial blog. */
    editorialUrl: { type: String, default: '' },
    articleUrl: { type: String, default: '' },
    videoId: { type: String, default: '' },

    patternSlug: { type: String, required: true, index: true },
    /** Position inside the pattern — easy to hard. The ramp. */
    patternOrder: { type: Number, default: 0 },

    tier: { type: String, enum: CP_TIER_SLUGS, required: true, index: true },
    /** Position inside the tier, across patterns. Drives the tier-first view. */
    tierOrder: { type: Number, default: 0 },

    /** Our normalised taxonomy — stable across both platforms. */
    topicTags: { type: [String], default: [] },
    /**
     * The platform's own tags, verbatim.
     *
     * Kept beside `topicTags` rather than merged into it because they answer
     * different questions and one of them spoils. A CF tag list is the
     * editorial's answer key — seeing `dp, bitmasks` on an unsolved problem
     * hands over the hard half — so the UI hides these behind a toggle and the
     * filter that reads them is opt-in. `topicTags` is ours, coarser, and safe
     * to show on the row.
     */
    platformTags: { type: [String], default: [] },

    /**
     * Only ever populated where the data is real, which in practice means
     * CodeChef problems that have appeared in a hiring contest. Codeforces
     * publishes nothing about who asks what, so CF rows carry an empty array
     * rather than a guess.
     */
    companies: { type: [companySchema], default: [] },

    codeforces: { type: codeforcesSchema, default: undefined },
    codechef: { type: codechefSchema, default: undefined },

    curatedFrom: { type: [sheetSchema], default: [] },
    solutions: { type: [solutionSchema], default: [] },

    /** Curation score — company of `Problem.score`, and the default sort tiebreak. */
    score: { type: Number, default: 0 },

    /** Visibility: null means everyone sees it, otherwise only that user does. */
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    /** Provenance. Deliberately separate from `owner` — see the note on Problem. */
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },

    editedAt: { type: Date, default: null, index: true },
    editedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

/** Same rule, same reasoning, as the compound index on Problem. */
cpProblemSchema.index({ slug: 1, owner: 1 }, { unique: true });

/** The two groupings the ladder endpoint offers. */
cpProblemSchema.index({ tier: 1, tierOrder: 1 });
cpProblemSchema.index({ patternSlug: 1, patternOrder: 1 });

/** The rating filter and the stats histogram. */
cpProblemSchema.index({ platform: 1, 'codeforces.rating': 1 });

/**
 * The join key for handle sync.
 *
 * `user.status` answers with `contestId` and `index` and nothing else that
 * identifies a problem, so every synced submission is looked up by this pair.
 * A handle with 3000 accepted submissions is 3000 lookups against this index on
 * every sync, which is the one query in the module that has to be fast.
 */
cpProblemSchema.index({ 'codeforces.contestId': 1, 'codeforces.index': 1 });

export const CPProblem = mongoose.model('CPProblem', cpProblemSchema);
