import mongoose from 'mongoose';
import {
  SQL_CATEGORY_SLUGS,
  SQL_DIFFICULTY_SLUGS,
  SQL_MODE_SLUGS,
} from '../config/sqlCategories.js';

/**
 * One SQL Lab problem — of which there are two kinds, and `mode` says which.
 *
 * An `editor` problem is a statement, a database to run it against, and the rows
 * a correct answer produces. An `external` one is a statement, a difficulty and
 * a link to the judge that already hosts it. The argument for keeping both in
 * one collection rather than two is that everything *around* a problem — the
 * category rail, the filters, the columns, the progress ladder, the revision
 * queue — is identical for both, and only the middle of the row differs.
 *
 * ---------------------------------------------------------------------------
 * Why this is a third problem collection rather than a field on an existing one.
 *
 * `Problem` and `CPProblem` are already separate, and the argument at the top of
 * `CPProblem.js` — different difficulty scales, different sources, different
 * visibility gate — applies here too. But this one has a stronger reason: a
 * roadmap problem is only ever a *link* to somewhere you go and solve it, and
 * most of these are **self-contained and executable**. They carry their own
 * schema, their own rows and their own expected output, because a Lab where the
 * app can tell you that you are wrong is the point of the module. Bolting
 * `setupSql` and `expected` onto a collection where they are null for 1,600 of
 * 1,617 rows would be a shape that lies about what it holds.
 *
 * The external rows do not weaken that argument, they sharpen it: they are the
 * problems where somebody else's judge is *better* than ours, and the honest
 * thing is to send you there rather than re-type their tables.
 * ---------------------------------------------------------------------------
 *
 * The tracking half is *not* separate: `SqlProgress` is `CPProgress` with the
 * judge-sync fields removed, and both go through `progress.kit.js`. Solving,
 * flagging, logging a sitting and coming back on the 3/7/21/60 ladder are the
 * same acts here as anywhere else in the app, and a second implementation of
 * them would drift on the first bug fix.
 */

/**
 * A sample table, as the reader sees it before writing anything.
 *
 * Denormalised from `setupSql` on purpose, and this is the one place in the
 * schema where the same fact is stored twice. Rendering the tables by *parsing*
 * the DDL would mean shipping a SQL parser to the browser to draw a grid, and
 * building them by *running* the DDL would mean booting the WASM engine before
 * the statement could be read. Neither is worth it for something the seed
 * script can write down once — and the verifier checks the two agree, so they
 * cannot drift.
 */
const sampleTableSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    columns: { type: [String], default: [] },
    /** Cell values, as strings. Presentation only — nothing is compared against these. */
    rows: { type: [[String]], default: [] },
  },
  { _id: false },
);

/**
 * What a correct answer returns.
 *
 * **Generated, never hand-written.** `scripts/seed/sql/verify.js` runs the
 * reference solution against `setupSql` under the same sql.js build the browser
 * uses, and writes whatever came back. A hand-typed grid would be a second
 * opinion about the answer, and the reader would be told they were wrong
 * whenever the two disagreed.
 */
const expectedSchema = new mongoose.Schema(
  {
    columns: { type: [String], default: [] },
    /** Mixed, because a cell is a number, a string or null and all three matter. */
    rows: { type: [[mongoose.Schema.Types.Mixed]], default: [] },
  },
  { _id: false },
);

/**
 * Required on a Lab problem, absent on a linked one.
 *
 * A function rather than `true`, because half this collection has no SQL of its
 * own: an `external` row is a title, a summary and a link, and demanding a
 * schema for it would mean inventing one that never runs. The verifier makes
 * the same split, and makes it the other way round too — an external problem
 * carrying `setupSql` is an error there, not a field quietly ignored.
 */
function requiredInTheLab() {
  return this.mode !== 'external';
}

const sqlProblemSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, trim: true, maxlength: 120 },
    title: { type: String, required: true, trim: true, maxlength: 200 },

    /**
     * The question, in our own words.
     *
     * Never a copy of the source's. LeetCode's statements are LeetCode's, and a
     * copied one would also not be self-contained enough to run locally — which
     * is the entire feature. `source.url` credits the original.
     */
    statement: { type: String, required: true, maxlength: 4000 },

    category: { type: String, enum: SQL_CATEGORY_SLUGS, required: true, index: true },
    categoryOrder: { type: Number, default: 0 },
    difficulty: { type: String, enum: SQL_DIFFICULTY_SLUGS, required: true, index: true },

    /**
     * Where this one is solved — see `SQL_MODES` in `config/sqlCategories.js`.
     *
     * `editor` is the self-contained kind: the fields below it are all filled
     * in, the query runs in the browser and the app marks it. `external` is a
     * problem that already lives on a judge, and everything from `setupSql` to
     * `explanation` is empty for it — the row is a title, a summary, a
     * difficulty and `source.url`.
     *
     * Indexed because the page filters on it, and defaulted to `editor` so a
     * document written before this field existed reads as what it actually is.
     */
    mode: { type: String, enum: SQL_MODE_SLUGS, default: 'editor', index: true },

    /** `CREATE TABLE`s and `INSERT`s. Run fresh for every single execution. */
    setupSql: { type: String, required: requiredInTheLab, maxlength: 20000 },

    tables: { type: [sampleTableSchema], default: [] },
    expected: { type: expectedSchema, default: () => ({}) },

    /**
     * Whether the reader's row order is part of the answer.
     *
     * `false` for most, and that is the safer default: a query with no
     * `ORDER BY` has no defined order, so grading one positionally would fail
     * correct answers at random. Set `true` only where the question actually
     * asks for an ordering — and then the question has to say so, because
     * otherwise it is graded on something it never asked for.
     */
    orderMatters: { type: Boolean, default: false },

    /**
     * The query that decides the answer, for problems whose answer is a changed
     * table rather than a returned grid.
     *
     * When set, the reader's statements run for their side effects and *this*
     * runs afterwards; its result is what gets compared. It is what makes the
     * whole `modify` category gradeable — an `UPDATE` returns no rows, so
     * without it there would be nothing to check.
     */
    checkSql: { type: String, default: '', maxlength: 4000 },

    /**
     * How many rows the answer has, written by hand.
     *
     * The one number in this document that is not generated, and it exists to
     * catch the failure the generator cannot: running the reference solution
     * proves it *runs*, not that it answers the *question*. A subtly wrong
     * solution would silently become a subtly wrong `expected`, and every
     * reader would then be marked wrong for being right. The verifier compares
     * this against what it produced and fails the seed if they disagree.
     *
     * `-1` means "not asserted" — for the handful of problems where the row
     * count genuinely depends on the sample data in a way not worth restating.
     */
    expectRows: { type: Number, default: -1 },

    /** The reference answer. Behind the same 25-minute gate as every editorial. */
    solutionSql: { type: String, required: requiredInTheLab, maxlength: 4000 },

    /** Where MySQL and the SQLite this runs on genuinely differ, for this problem. */
    dialectNote: { type: String, default: '', maxlength: 600 },

    /** Progressive, revealed one at a time. Two or three; never the answer in prose. */
    hints: { type: [String], default: [] },

    /** Why the solution works, shown after a pass or with the solution. */
    explanation: { type: String, default: '', maxlength: 4000 },

    /** `sql/<slug>` — the Learn topic that teaches this, linked from the workbench. */
    learnTopic: { type: String, default: '', maxlength: 120 },

    /**
     * Where the problem came from, and — for an `external` one — where it goes.
     *
     * On an `editor` problem this is credit: the shape of the question came
     * from somewhere, the schema and the words are ours. On an `external` one
     * `url` is load-bearing, because it is the only way to reach the problem at
     * all, and the verifier refuses to write a row without it.
     */
    source: {
      platform: { type: String, default: '', maxlength: 40 },
      url: { type: String, default: '', maxlength: 400 },
      lcId: { type: Number, default: 0 },
      /**
       * The curated list this came off, if any — `top-sql-50` for LeetCode's
       * study plan. `planOrder` is that list's own numbering, kept so the plan
       * can be walked in the order its author intended even though the Lab
       * files the problems under its own eight categories.
       */
      plan: { type: String, default: '', maxlength: 40 },
      planOrder: { type: Number, default: 0 },
    },

    topicTags: { type: [String], default: [] },
    score: { type: Number, default: 0 },

    /*
      The ownership block, identical to `Problem` and `CPProblem` — see the note
      at Problem.js:117. `owner: null` is the curated bank everyone sees;
      anything else is one account's own addition. `editedAt` is the seeder's
      lock: a row the admin panel has touched is never overwritten and never
      pruned.
    */
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    editedAt: { type: Date, default: null, index: true },
    editedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

/**
 * Unique per owner, not globally.
 *
 * The same rule and the same reasoning as `Problem.js:136`: a global unique
 * slug would mean one learner adding a problem changes what another is allowed
 * to add. It is also what makes the seeder's `{ slug, owner: null }` filter
 * safe — see `scripts/seed/sql/seed.js`.
 */
sqlProblemSchema.index({ slug: 1, owner: 1 }, { unique: true });
sqlProblemSchema.index({ category: 1, categoryOrder: 1 });
sqlProblemSchema.index({ difficulty: 1, categoryOrder: 1 });
sqlProblemSchema.index({ 'source.plan': 1, 'source.planOrder': 1 });

export const SqlProblem = mongoose.model('SqlProblem', sqlProblemSchema);
