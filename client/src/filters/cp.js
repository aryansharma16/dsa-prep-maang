import { defineFilters } from './spec.js';
import { RATING_PRESETS } from '../theme/cfRating.js';

/**
 * What you can narrow the CP ladder by.
 *
 * Same engine as the roadmap's — the dialog renders from this, the badge counts
 * from it, rows are matched by it and the account saves it. What differs is the
 * axes, and they differ a lot: a CP problem has a rating, a division, a contest
 * and a judge, and none of "Easy/Medium/Hard", "sheet" or "company" means
 * anything here.
 *
 * Order is the order the dialog renders, cheapest-to-decide first.
 */

/**
 * The rating of a problem on *its own platform's* scale.
 *
 * Deliberately only Codeforces. CodeChef ratings are a different scale
 * calibrated against a different population — a CodeChef 1600 sits far below a
 * Codeforces 1600 — so a single numeric filter across both would quietly return
 * the wrong problems for one of them. Filtering by rating therefore implies
 * Codeforces, and the field says so.
 */
const cfRatingOf = (p) => (p.platform === 'codeforces' ? p.codeforces?.rating || 0 : 0);

export const CP_FILTERS = defineFilters([
  {
    id: 'tier',
    kind: 'many',
    label: 'Tier',
    placeholder: 'Any tier',
    // Options come from the loaded ladder, so none are declared here — the
    // labels live in one place on the server.
    match: (p, values) => values.includes(p.tier),
  },
  {
    id: 'rating',
    kind: 'range',
    label: 'Codeforces rating',
    min: 800,
    max: 3500,
    step: 100,
    minPlaceholder: '800',
    maxPlaceholder: '3500',
    presets: RATING_PRESETS,
    /*
      A rating filter is implicitly a Codeforces filter, so CodeChef rows drop
      out rather than being kept on a technicality. Keeping them would be worse:
      "1400–1600" returning problems with no Codeforces rating at all reads as
      the filter being broken.
    */
    match: (p, { min, max }) => {
      const rating = cfRatingOf(p);
      if (!rating) return false;
      if (min != null && rating < min) return false;
      if (max != null && rating > max) return false;
      return true;
    },
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
    id: 'division',
    kind: 'many',
    label: 'Division',
    placeholder: 'Any division',
    options: [
      { value: 'Div. 1', label: 'Div. 1' },
      { value: 'Div. 2', label: 'Div. 2' },
      { value: 'Div. 3', label: 'Div. 3' },
      { value: 'Div. 4', label: 'Div. 4' },
      { value: 'Div. 1 + 2', label: 'Div. 1 + 2' },
      { value: 'Educational', label: 'Educational' },
      { value: 'Global', label: 'Global round' },
      { value: 'Div 1', label: 'CodeChef Div 1' },
      { value: 'Div 2', label: 'CodeChef Div 2' },
      { value: 'Div 3', label: 'CodeChef Div 3' },
      { value: 'Div 4', label: 'CodeChef Div 4' },
    ],
    match: (p, values) =>
      values.includes(p.codeforces?.division) || values.includes(p.codechef?.division),
  },
  {
    id: 'index',
    kind: 'many',
    label: 'Problem letter',
    placeholder: 'Any position',
    /*
      Which slot in the round it was. Worth its own filter because "Div. 2 C" is
      a shared vocabulary for a kind of problem — a specific difficulty *and* a
      specific amount of time you are meant to spend on it — that no other field
      here captures. Sub-indices are folded in, so F covers F1 and F2.
    */
    options: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((v) => ({ value: v, label: v })),
    match: (p, values) => values.includes((p.codeforces?.index || '').charAt(0)),
  },
  {
    id: 'patterns',
    kind: 'many',
    label: 'Patterns',
    placeholder: 'Any pattern',
    match: (p, values) => values.includes(p.patternSlug),
  },
  {
    id: 'topics',
    kind: 'many',
    label: 'Topics',
    placeholder: 'Any topic',
    /*
      Our own taxonomy, not the judge's tags. A Codeforces tag list is the
      editorial's answer key — seeing `dp, bitmasks` on an unsolved problem
      hands over the hard half — so the raw tags are behind their own opt-in
      filter below, and this one is safe to reach for while browsing.
    */
    match: (p, values) => (p.topicTags || []).some((t) => values.includes(t)),
  },
  {
    id: 'platformTags',
    kind: 'many',
    label: 'Judge tags (spoilers)',
    placeholder: 'Any judge tag',
    match: (p, values) => (p.platformTags || []).some((t) => values.includes(t)),
  },
  {
    id: 'contest',
    kind: 'many',
    label: 'Contest',
    placeholder: 'Any contest',
    match: (p, values) =>
      values.includes(p.codeforces?.contestName) || values.includes(p.codechef?.contestCode),
  },
  {
    id: 'sheets',
    kind: 'many',
    label: 'Curated sheet',
    placeholder: 'Any source',
    options: [
      { value: 'cp-31', label: 'CP-31 Sheet', note: '31 problems per rating, 800–1500' },
      { value: 'cf-ladders', label: 'Codeforces Ladders', note: 'Div. 2 A–E, 100 each' },
      { value: 'a2oj', label: 'A2OJ Ladder', note: 'By topic' },
      { value: 'cc-practice', label: 'CodeChef practice', note: 'By rating band' },
    ],
    match: (p, values) => (p.sheets || []).some((s) => values.includes(s)),
  },
  {
    id: 'companies',
    kind: 'many',
    label: 'Companies',
    placeholder: 'Any company',
    /*
      Only ever populated where the data is real, which for competitive
      programming is rare — Codeforces publishes nothing about who asks what.
      The dialog renders this only when the loaded ladder actually carries some,
      the same data-driven rule the roadmap's company list uses.
    */
    match: (p, values) => (p.companies || []).some((c) => values.includes(c.name)),
  },

  /*
    The five below live in the bar rather than the dialog. They are what you
    reach for mid-session — flip one, look, flip it back — which is a different
    gesture from setting up a view.
  */
  {
    id: 'platform',
    kind: 'one',
    label: 'Platform',
    place: 'bar',
    control: 'segmented',
    options: [
      { value: '', label: 'All' },
      { value: 'codeforces', label: 'Codeforces' },
      { value: 'codechef', label: 'CodeChef' },
    ],
    match: (p, value) => p.platform === value,
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
    id: 'unlogged',
    kind: 'flag',
    label: 'Solved on judge, not logged',
    place: 'bar',
    /*
      The prompt the sync exists to create. Codeforces says you have an accepted
      submission and this ladder has no record of you working on it — usually a
      contest solve from before you started tracking, and exactly the list worth
      going through once after linking a handle.
    */
    match: (p) => Boolean(p.progress?.solvedOnPlatform) && (p.progress?.status || 'todo') !== 'solved',
  },
  {
    id: 'mine',
    kind: 'flag',
    label: 'Added by me',
    place: 'bar',
    match: (p) => Boolean(p.mine),
  },
]);
