import aggregation from './aggregation.js';
import joins from './joins.js';
import leetcodeSql50 from './leetcode-sql-50.js';
import modify from './modify.js';
import select from './select.js';
import sorting from './sorting.js';
import stringsDates from './strings-dates.js';
import subqueries from './subqueries.js';
import windowFns from './window.js';

/**
 * The bank, composed from one module per category — and one per imported list.
 *
 * Kept as separate files rather than one array for the reason
 * `seed/guides/index.js` states about the pattern guides: a category runs to
 * several hundred lines, and eight of them in a single module would be
 * unreviewable — both for a person editing a statement and for a diff.
 *
 * `leetcode-sql-50.js` breaks the one-file-per-category rule on purpose, and it
 * is the only file here that does. Its rows are not authored problems, they are
 * a **manifest**: forty-five titles, summaries and links transcribed from one
 * published study plan, spread across seven of the eight categories. Splitting
 * a transcription seven ways would hide the two things worth checking about it —
 * that it is complete, and that it is in the plan's own order — in seven files
 * where neither could be seen. Provenance beats category here.
 *
 * Listed in curriculum order for readability, with the imported list last. The
 * seeder does not care: a problem's position comes from `categoryOrder`, which
 * `verify.js` assigns within each category as it goes, so the page's ordering
 * cannot drift from the order the files are written in. Putting the manifest
 * last is what makes the Lab's own problems come first inside every category —
 * you meet the ones that run here before the ones that send you away.
 */
export const sqlProblems = [
  ...select,
  ...sorting,
  ...aggregation,
  ...joins,
  ...subqueries,
  ...windowFns,
  ...stringsDates,
  ...modify,
  ...leetcodeSql50,
];
