import { defineFilters } from './spec.js';

/**
 * What you can narrow the roadmap by.
 *
 * The whole filter surface of the page, in one list: the dialog renders from it,
 * the bar's badge counts from it, the rows are matched by it and the account
 * saves it. Adding a filter is an entry here plus, if it belongs in the bar
 * rather than the dialog, a button in Roadmap.jsx.
 *
 * Order is the order the dialog renders. It runs cheapest-to-decide first —
 * difficulty and status are a tap each — down to the two data-driven lists that
 * are a search and a scroll.
 */

const SHEETS = [
  /*
    First, because it is the only one of the five that was built for this
    roadmap rather than imported into it — 300 of the 517, chosen for coverage
    per hour rather than by any outside author. See server/scripts/seed/ai-sheet.js.
  */
  {
    value: 'ai-300',
    label: 'AI-recommended 300',
    note: 'Every pattern, least overlap — the shortest path',
  },
  { value: 'striver-sde', label: "Striver's SDE Sheet", note: '191 problems, day by day' },
  { value: 'neetcode-150', label: 'NeetCode 150', note: 'The pattern-first 150' },
  { value: 'blind-75', label: 'Blind 75', note: 'The original short list' },
  { value: 'faang-2026', label: 'FAANG 2025-26', note: 'Reported in recent interviews' },
];

export const ROADMAP_FILTERS = defineFilters([
  {
    id: 'difficulty',
    kind: 'one',
    label: 'Difficulty',
    // Four short options, so a segmented control beats a dropdown: every choice
    // is visible, and picking one is a tap rather than a tap, a scroll and a tap.
    control: 'segmented',
    options: [
      { value: '', label: 'All' },
      { value: 'Easy', label: 'Easy' },
      { value: 'Medium', label: 'Medium' },
      { value: 'Hard', label: 'Hard' },
    ],
    match: (p, value) => p.difficulty === value,
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
    id: 'sheet',
    kind: 'one',
    label: 'Sheet',
    // Three long names — a row of segments would wrap to three lines.
    options: [{ value: '', label: 'All sheets' }, ...SHEETS],
    match: (p, value) => (p.sheets || []).some((s) => s.sheet === value),
  },
  {
    id: 'topics',
    kind: 'many',
    label: 'Topics',
    placeholder: 'Any topic',
    /*
      The tags a problem carries, not the pattern it is filed under. A pattern is
      where the roadmap puts a problem; the tags are what it touches on the way —
      binary search turns up inside Sorting and inside Intervals — so this cuts
      across the sections rather than picking one of them.

      Options come from the loaded roadmap, so none are declared here.
    */
    match: (p, values) => (p.topicTags || []).some((t) => values.includes(t)),
  },
  {
    id: 'companies',
    kind: 'many',
    label: 'Companies',
    placeholder: 'Any company',
    match: (p, values) => (p.companies || []).some((c) => values.includes(c.name)),
  },
  {
    /*
      Recency, as its own filter rather than an option on the one above.

      'Companies' answers "who has historically asked this", from a frequency
      dataset with no date on it. This answers "who was reported asking it in
      2025-26". Someone with four months and a target company wants the second
      question, and folding it into the first would make one filter mean two
      things depending on which name you picked — including for the names that
      only exist on this side, since OpenAI and Anthropic have no frequency data
      at all.

      Options come from the loaded roadmap, like Topics and Companies.
    */
    id: 'askedRecently',
    kind: 'many',
    label: 'Asked in 2025-26',
    placeholder: 'Any company',
    match: (p, values) => (p.askedRecently || []).some((name) => values.includes(name)),
  },

  /*
    The three below live in the bar rather than the dialog. They are what you
    reach for mid-session — flip one, look, flip it back — and that is a
    different gesture from setting up a view, which is what the dialog is for.
  */
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
