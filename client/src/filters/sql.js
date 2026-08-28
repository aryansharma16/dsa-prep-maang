import { defineFilters } from './spec.js';

/**
 * What the SQL Lab can be narrowed by.
 *
 * One entry per filter, and everything else falls out of it: the dialog, the
 * count on the Filters chip, what Clear all clears, and what is saved to the
 * account under the `sql` view scope. See the header of `spec.js`.
 *
 * The bar filters are the four questions asked most often while working —
 * "what have I not done", "what did I flag", "what is due" — and they are on
 * the bar rather than behind the button because a filter you reach for every
 * session should not be two clicks away.
 */
export const SQL_FILTERS = defineFilters([
  {
    id: 'category',
    kind: 'many',
    label: 'Category',
    placeholder: 'Any category',
    /* Options come from the loaded bank, so none are declared here. */
    match: (p, values) => values.includes(p.category),
  },
  {
    id: 'difficulty',
    kind: 'many',
    label: 'Difficulty',
    placeholder: 'Any level',
    options: [
      { value: 'Easy', label: 'Easy' },
      { value: 'Medium', label: 'Medium' },
      { value: 'Hard', label: 'Hard' },
    ],
    match: (p, values) => values.includes(p.difficulty),
  },
  {
    id: 'status',
    kind: 'one',
    label: 'Status',
    control: 'segmented',
    options: [
      { value: '', label: 'Any' },
      { value: 'todo', label: 'Not started' },
      { value: 'attempted', label: 'Attempted' },
      { value: 'solved', label: 'Solved' },
    ],
    match: (p, value) => (p.progress?.status || 'todo') === value,
  },
  {
    /*
      Two kinds of row, and this is the filter that separates them. Worth having
      on both settings rather than only one: "just the ones I can run here" is
      an offline session, and "just the ones on LeetCode" is a session where you
      want submissions that count on a profile.
    */
    id: 'mode',
    kind: 'one',
    label: 'Where you solve it',
    control: 'segmented',
    options: [
      { value: '', label: 'Anywhere' },
      { value: 'editor', label: 'In the Lab' },
      { value: 'external', label: 'On the platform' },
    ],
    match: (p, value) => (p.mode || 'editor') === value,
  },
  {
    id: 'topics',
    kind: 'many',
    label: 'Topics',
    placeholder: 'Any topic',
    match: (p, values) => values.some((v) => p.topicTags?.includes(v)),
  },
  {
    /*
      Provenance, which is not the same question as `mode`. A problem can be
      credited to LeetCode and still run here — the five the Lab authored before
      the SQL 50 was imported are exactly that — so filtering by where a problem
      *came from* and by where you *solve it* have to stay separate controls.
    */
    id: 'source',
    kind: 'many',
    label: 'Source',
    placeholder: 'Anywhere',
    match: (p, values) => values.includes(p.source?.platform || 'ours'),
  },

  /* ------------------------------------------------------------ the bar */

  {
    id: 'unsolved',
    kind: 'flag',
    label: 'Unsolved',
    place: 'bar',
    match: (p) => (p.progress?.status || 'todo') !== 'solved',
  },
  {
    id: 'flagged',
    kind: 'flag',
    label: 'Flagged',
    place: 'bar',
    match: (p) => Boolean(p.progress?.flagged),
  },
  {
    id: 'revision',
    kind: 'flag',
    label: 'Needs revision',
    place: 'bar',
    match: (p) => Boolean(p.progress?.needsRevision),
  },
  {
    id: 'mine',
    kind: 'flag',
    label: 'Added by me',
    place: 'bar',
    match: (p) => Boolean(p.mine),
  },
]);
