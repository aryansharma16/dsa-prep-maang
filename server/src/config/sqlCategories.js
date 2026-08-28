/**
 * The eight things a SQL interview asks you to do, in the order to learn them.
 *
 * The Lab's spine, and the twin of `cpTiers.js` — same job, same shape, four
 * consumers that must agree on it: the seed curator, the bank endpoint, the
 * stats endpoint, and the category rail on the page.
 *
 * What it is *not* is a copy of the Learn track's ten sections. Those are
 * reading order for a subject; these are the shapes a practice problem comes
 * in, and the two genuinely differ — normalisation and ACID are three Learn
 * sections and no practice problems at all, because there is no query to write.
 * Conversely `strings-dates` is one category here and scattered across four
 * Learn topics, because it is a recognisable *kind* of question.
 *
 * `focus` is one line, and it earns its place twice: it is rendered under the
 * category name on the rail, and it is what tells someone scanning the page
 * whether this is the section they are stuck on.
 *
 * There is no `min`/`max` here, unlike the CP tiers. Those exist because a
 * Codeforces rating is a number a problem carries; difficulty here is a
 * three-value enum on the problem itself, and inventing a numeric band to sort
 * within a category would be a number nobody could check.
 */
export const SQL_CATEGORIES = Object.freeze([
  {
    slug: 'select',
    label: 'Select & filter',
    order: 0,
    colour: 'sky',
    focus: 'Get the right rows and the right columns out of one table.',
  },
  {
    slug: 'sorting',
    label: 'Sorting & pagination',
    order: 1,
    colour: 'teal',
    focus: 'Order, ties, top-N, and the Nth of something.',
  },
  {
    slug: 'aggregation',
    label: 'Aggregation & grouping',
    order: 2,
    colour: 'green',
    focus: 'Collapse rows into groups, then filter the groups.',
  },
  {
    slug: 'joins',
    label: 'Joins',
    order: 3,
    colour: 'amber',
    focus: 'Combine tables, and keep the rows that did not match when you meant to.',
  },
  {
    slug: 'subqueries',
    label: 'Subqueries & CTEs',
    order: 4,
    colour: 'orange',
    focus: 'A query inside a query, and naming one so the whole thing reads.',
  },
  {
    slug: 'window',
    label: 'Window functions',
    order: 5,
    colour: 'violet',
    focus: 'Rank, running totals and the previous row — without collapsing anything.',
  },
  {
    slug: 'strings-dates',
    label: 'Strings, dates & logic',
    order: 6,
    colour: 'pink',
    focus: 'CASE, text functions and date arithmetic — where the dialects differ most.',
  },
  {
    slug: 'modify',
    label: 'Modify & design',
    order: 7,
    colour: 'red',
    focus: 'INSERT, UPDATE, DELETE and DDL — graded on the table you leave behind.',
  },
]);

export const SQL_CATEGORY_SLUGS = SQL_CATEGORIES.map((c) => c.slug);

const BY_SLUG = new Map(SQL_CATEGORIES.map((c) => [c.slug, c]));

export const categoryBySlug = (slug) => BY_SLUG.get(slug) || null;

export const categoryLabel = (slug) => BY_SLUG.get(slug)?.label || slug;

/**
 * The other spine.
 *
 * Difficulty is the second grouping the page offers, and it is here rather than
 * a bare array of strings for the same reason the categories are: the page
 * needs a label and a colour per group, and deriving those from the string in
 * three components is how two of them end up disagreeing.
 *
 * The three values match the roadmap's `difficulty` enum exactly, so a reader
 * moving between the two curriculums is reading the same word for the same
 * thing.
 */
export const SQL_DIFFICULTIES = Object.freeze([
  { slug: 'Easy', label: 'Easy', order: 0, colour: 'green', focus: 'One clause, one idea.' },
  {
    slug: 'Medium',
    label: 'Medium',
    order: 1,
    colour: 'amber',
    focus: 'Two ideas, or one idea applied where it is not obvious.',
  },
  {
    slug: 'Hard',
    label: 'Hard',
    order: 2,
    colour: 'red',
    focus: 'A pattern you have to recognise before you can write anything.',
  },
]);

export const SQL_DIFFICULTY_SLUGS = SQL_DIFFICULTIES.map((d) => d.slug);

/**
 * The third spine: **where you solve it**.
 *
 * The Lab holds two kinds of problem and they are not variations of each other,
 * so this is an enum on the problem rather than a boolean derived from whether
 * `source.url` happens to be set:
 *
 *   - `editor` — self-contained and executable. It carries its own schema, its
 *     own rows and its own expected grid, the query runs in the browser, and
 *     the app can tell you whether you are right. Everything the Lab authored
 *     itself is one of these.
 *   - `external` — a problem that already exists somewhere with a judge behind
 *     it. It carries a title, a one-line summary in our words, a difficulty and
 *     a link, and clicking it takes you to LeetCode. Nothing is re-hosted.
 *
 * The rule that decides which: **if the problem lives on a platform, it links to
 * the platform.** Re-typing LeetCode's schema and sample rows so the same
 * question can be graded twice buys nothing — their judge is better than ours,
 * it is where the discussion is, and it is where a submission actually counts.
 * What the Lab adds for those rows is the part LeetCode does not: the category
 * it belongs to, the Learn topic that teaches it, and the same progress ladder
 * everything else in the app is on.
 *
 * The five exceptions are the five problems the Lab authored *before* the SQL 50
 * was imported. They stay `editor` and keep the credit link, and the importer
 * skips their LeetCode ids — see `problems/leetcode-sql-50.js`.
 */
export const SQL_MODES = Object.freeze([
  {
    slug: 'editor',
    label: 'In the Lab',
    order: 0,
    focus: 'Runs in your browser, and the app marks it.',
  },
  {
    slug: 'external',
    label: 'On the platform',
    order: 1,
    focus: 'Opens where it lives, and the judge there marks it.',
  },
]);

export const SQL_MODE_SLUGS = SQL_MODES.map((m) => m.slug);
