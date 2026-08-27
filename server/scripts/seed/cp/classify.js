/**
 * Which pattern a Codeforces problem belongs to.
 *
 * The hard part is that a CF problem carries several tags and only one of them
 * is the technique being taught. `dp + trees + dfs and similar` is a tree-DP
 * problem, not a linear-DP problem that happens to mention trees, and filing it
 * under `dp-linear` puts a 1900 in the middle of a Specialist section.
 *
 * So this is a priority list, not a lookup table. Rules are tried in order and
 * the first match wins, which means the *specific* combinations have to come
 * before the general single-tag ones. That ordering is the whole file; the rules
 * themselves are unremarkable.
 *
 * A rule is:
 *   { pattern, all?: [tags], any?: [tags], none?: [tags], minRating?, maxRating? }
 *
 * `all` must all be present, `any` needs one, `none` must be absent. Rating
 * bounds exist because the same tag pair means different things at different
 * levels: `dp + bitmasks` at 1600 is usually a small subset enumeration, and at
 * 2200 it is genuinely bitmask DP.
 */

import { CP_PATTERN_SLUGS } from './patterns.js';

const RULES = [
  // ── Format first. An interactive binary search is an interactive problem. ──
  { pattern: 'interactive-problems', any: ['interactive'] },

  /*
    The very bottom of the ladder.

    `io-and-complexity` is a teaching section about reading the constraints and
    writing the loop, and no Codeforces tag corresponds to it — left to the rules
    below it would be permanently empty, which reads as a broken section rather
    than as a section with nothing to practise. An 800-rated implementation
    problem *is* where that skill is practised, so the easiest band of them is
    filed here rather than under `implementation-simulation`, which starts at 900
    and has plenty.
  */
  { pattern: 'io-and-complexity', any: ['implementation', 'brute force'], maxRating: 800 },

  // ── Specific multi-tag combinations, most specific first ──────────────────
  { pattern: 'dp-on-trees', all: ['dp'], any: ['trees'] },
  { pattern: 'dp-bitmask', all: ['dp', 'bitmasks'], minRating: 1800 },
  { pattern: 'dp-digit', all: ['dp'], any: ['number theory'], minRating: 2000, none: ['trees', 'graphs'] },
  { pattern: 'dp-optimizations', all: ['dp'], any: ['divide and conquer', 'geometry'], minRating: 2300 },
  { pattern: 'dp-grid-interval', all: ['dp'], any: ['strings', 'matrices'], maxRating: 2200 },
  { pattern: 'dp-knapsack', all: ['dp'], any: ['bitmasks'], maxRating: 1700 },
  { pattern: 'dp-knapsack', all: ['dp'], any: ['brute force'], maxRating: 1600 },

  { pattern: 'scc-bridges', any: ['2-sat'] },
  { pattern: 'scc-bridges', all: ['graphs'], any: ['dfs and similar'], minRating: 2100 },
  { pattern: 'flows-matching', any: ['flows', 'graph matchings'] },
  { pattern: 'mst', all: ['graphs'], any: ['dsu'], minRating: 1600 },
  { pattern: 'shortest-paths', any: ['shortest paths'] },
  { pattern: 'topological-sort', all: ['graphs'], any: ['dfs and similar'], maxRating: 1900 },
  { pattern: 'lca-binary-lifting', all: ['trees'], any: ['data structures'], minRating: 2100 },
  { pattern: 'heavy-light', all: ['trees'], any: ['data structures'], minRating: 2400 },

  { pattern: 'string-hashing-suffix', any: ['string suffix structures'] },
  { pattern: 'string-hashing-suffix', all: ['strings'], any: ['hashing'] },
  { pattern: 'strings-basics', any: ['strings'], maxRating: 1900 },

  { pattern: 'fft-ntt', any: ['fft'] },
  { pattern: 'matrix-exponentiation', any: ['matrices'], minRating: 1900 },
  { pattern: 'advanced-number-theory', any: ['chinese remainder theorem'] },
  { pattern: 'advanced-number-theory', all: ['number theory'], minRating: 2200 },
  { pattern: 'geometry', any: ['geometry'] },
  { pattern: 'game-theory', any: ['games'] },
  { pattern: 'probability-expectation', any: ['probabilities'] },
  { pattern: 'divide-conquer', any: ['meet-in-the-middle'] },
  { pattern: 'divide-conquer', any: ['divide and conquer'] },
  { pattern: 'offline-queries-mo', all: ['data structures'], any: ['sortings'], minRating: 2200 },
  { pattern: 'lazy-segment-tree', all: ['data structures'], minRating: 2200, any: ['trees', 'dp'] },
  { pattern: 'advanced-structures', all: ['data structures'], minRating: 2500 },
  { pattern: 'randomization', any: ['probabilities'], minRating: 2400 },

  // ── Single strong tags ────────────────────────────────────────────────────
  { pattern: 'dsu', any: ['dsu'] },
  { pattern: 'fenwick-segment', any: ['data structures'], minRating: 1700 },
  { pattern: 'sparse-table-rmq', any: ['data structures'], minRating: 1500, maxRating: 1699 },
  { pattern: 'dp-on-trees', any: ['trees'], minRating: 1700 },
  { pattern: 'graph-traversal', any: ['graphs', 'dfs and similar', 'trees'] },
  { pattern: 'dp-linear', any: ['dp'] },
  { pattern: 'bit-manipulation', any: ['bitmasks'] },
  { pattern: 'combinatorics-basics', any: ['combinatorics'] },
  { pattern: 'modular-arithmetic', all: ['number theory'], any: ['combinatorics', 'math'], minRating: 1500 },
  { pattern: 'number-theory-basics', any: ['number theory'] },
  { pattern: 'binary-search-answer', any: ['binary search', 'ternary search'] },
  { pattern: 'two-pointers-sliding', any: ['two pointers'] },
  { pattern: 'stacks-monotonic', any: ['expression parsing'] },
  { pattern: 'constructive-advanced', any: ['constructive algorithms'], minRating: 1900 },
  { pattern: 'constructive-basics', any: ['constructive algorithms'] },
  { pattern: 'greedy-exchange', all: ['greedy'], any: ['sortings'] },
  { pattern: 'sorting-and-comparators', any: ['sortings'] },
  { pattern: 'greedy-exchange', any: ['greedy'] },
  { pattern: 'hashing-frequency', any: ['hashing'] },
  { pattern: 'prefix-sums-difference', all: ['math'], any: ['implementation'], maxRating: 1200 },
  { pattern: 'arithmetic-and-parity', any: ['math'] },
  { pattern: 'implementation-simulation', any: ['implementation', 'brute force'] },
];

/*
  Every pattern named above must exist, or a rule silently files problems under
  a section that is never rendered. Checked at import rather than at first match,
  so a typo fails the seed immediately instead of on whichever problem happens
  to hit that rule.
*/
const known = new Set(CP_PATTERN_SLUGS);
for (const rule of RULES) {
  if (!known.has(rule.pattern)) {
    throw new Error(`classify.js names an unknown pattern: ${rule.pattern}`);
  }
}

const matches = (rule, tags, rating) => {
  if (rule.minRating && rating < rule.minRating) return false;
  if (rule.maxRating && rating > rule.maxRating) return false;
  if (rule.all && !rule.all.every((t) => tags.has(t))) return false;
  if (rule.any && !rule.any.some((t) => tags.has(t))) return false;
  if (rule.none && rule.none.some((t) => tags.has(t))) return false;
  return true;
};

/**
 * The pattern for a problem, and how confident the assignment is.
 *
 * `hint` is a pattern suggested by a human-curated sheet — the A2OJ category a
 * problem was filed under. It wins over the tag rules whenever it is present,
 * because a person deciding "this is a DSU problem" is better evidence than a
 * tag list written to be an editorial index. The rules are the fallback for the
 * ~90% of the problemset no sheet has an opinion about.
 *
 * `confidence` feeds the curation score: a problem whose pattern was chosen by a
 * human is a better teaching example of that pattern than one matched by rule 47.
 */
export function classify(problem, { hint = null } = {}) {
  if (hint && known.has(hint)) return { pattern: hint, confidence: 1, via: 'sheet' };

  const tags = new Set(problem.tags || []);
  const rating = problem.rating || 0;

  for (const [i, rule] of RULES.entries()) {
    if (matches(rule, tags, rating)) {
      // Earlier rules are more specific, so they are trusted more. The range is
      // deliberately narrow — this is a tiebreak, not a verdict.
      return { pattern: rule.pattern, confidence: 0.9 - (i / RULES.length) * 0.35, via: 'tags' };
    }
  }

  return { pattern: fallbackFor(rating), confidence: 0.2, via: 'rating' };
}

/**
 * What to do with a problem no rule matched.
 *
 * Untagged problems are real — recent rounds are often tagged late — and the
 * only signal left is the rating. Filing them by difficulty is not a claim about
 * technique, which is why the confidence is 0.2 and the curator effectively
 * never picks one over a classified problem.
 */
function fallbackFor(rating) {
  if (rating <= 1000) return 'implementation-simulation';
  if (rating <= 1300) return 'greedy-exchange';
  if (rating <= 1600) return 'constructive-basics';
  if (rating <= 2000) return 'dp-linear';
  return 'constructive-advanced';
}

/**
 * Our own topic vocabulary, derived from CF's.
 *
 * Coarser than the CF tag list and safe to show on an unsolved row, which the
 * raw tags are not — "dp, bitmasks" on a problem you have not started hands over
 * the hard half of it. See the note on `platformTags` in the model.
 */
const TOPIC_MAP = {
  'dfs and similar': 'graphs',
  graphs: 'graphs',
  trees: 'trees',
  dsu: 'graphs',
  'shortest paths': 'graphs',
  flows: 'graphs',
  'graph matchings': 'graphs',
  dp: 'dynamic programming',
  greedy: 'greedy',
  math: 'math',
  'number theory': 'math',
  combinatorics: 'math',
  probabilities: 'math',
  geometry: 'geometry',
  strings: 'strings',
  hashing: 'strings',
  'string suffix structures': 'strings',
  'data structures': 'data structures',
  sortings: 'sorting',
  'binary search': 'binary search',
  'ternary search': 'binary search',
  'two pointers': 'two pointers',
  bitmasks: 'bit manipulation',
  implementation: 'implementation',
  'brute force': 'brute force',
  'constructive algorithms': 'constructive',
  interactive: 'interactive',
  games: 'game theory',
  matrices: 'math',
  fft: 'math',
  'divide and conquer': 'divide and conquer',
  'meet-in-the-middle': 'divide and conquer',
  'chinese remainder theorem': 'math',
  '2-sat': 'graphs',
  'expression parsing': 'strings',
  schedules: 'greedy',
};

export const topicsFor = (tags = []) =>
  [...new Set(tags.map((t) => TOPIC_MAP[t]).filter(Boolean))].sort();

// ──────────────────────────────── CodeChef ───────────────────────────────────

/**
 * CodeChef tags are a different vocabulary from Codeforces' and need their own
 * rules — this is not the same list with synonyms bolted on.
 *
 * Two differences drive the design. CodeChef's tag set is open: it mixes real
 * topics ('segment trees', 'prefix sum') with difficulty labels ('cakewalk',
 * 'easy'), contest codes ('start22', 'cook137') and setter usernames
 * ('raysh07_adm'). Of the 221 distinct tags across the shortlist, about 60 mean
 * anything topical. So this maps only what is meaningful and lets the rest fall
 * through, rather than pretending an unmapped tag is a signal.
 *
 * And CodeChef tags are much coarser — 'algorithms' is on two thirds of
 * everything. The list is therefore ordered specific-to-general like the
 * Codeforces one, and the broad buckets sit at the bottom where they act as a
 * last resort rather than swallowing everything above them.
 */
const CC_RULES = [
  ['flows-matching', ['flows', 'max flow', 'min cut', 'matching']],
  ['fft-ntt', ['fft', 'ntt', 'polynomial']],
  ['heavy-light', ['heavy light decomposition', 'hld', 'centroid decomposition']],
  ['advanced-structures', ['advanced tree structures', 'advanced data structures', 'treap', 'persistent']],
  ['lazy-segment-tree', ['lazy propagation', 'segment trees', 'segment tree']],
  ['lca-binary-lifting', ['lca', 'binary lifting', 'sparse table']],
  ['scc-bridges', ['scc', 'strongly connected components', '2-sat', 'articulation']],
  ['sqrt-decomposition', ['sqrt decomposition', 'square root decomposition']],
  ['offline-queries-mo', ["mo's algorithm", 'mo algorithm', 'offline queries']],
  ['string-hashing-suffix', ['hashing', 'suffix array', 'suffix automaton', 'trie', 'z algorithm', 'kmp']],
  ['matrix-exponentiation', ['matrix exponentiation', 'matrix']],
  ['advanced-number-theory', ['mobius', 'chinese remainder theorem', 'euler totient', 'totient']],
  ['dp-digit', ['digit dp']],
  ['dp-bitmask', ['bitmasking', 'bitmask dp']],
  ['dp-optimizations', ['advanced dp', 'convex hull trick', 'dp optimization']],
  ['dp-on-trees', ['tree dp', 'dp on trees']],
  ['dp-knapsack', ['knapsack', 'subset sum']],
  ['geometry', ['geometry', 'computational geometry', 'convex hull']],
  ['game-theory', ['game theory', 'games', 'nim', 'sprague grundy']],
  ['probability-expectation', ['probability', 'expected value', 'expectation']],
  ['randomization', ['randomization', 'randomized']],
  ['interactive-problems', ['interactive']],
  ['divide-conquer', ['divide and conquer', 'meet in the middle']],
  ['mst', ['mst', 'minimum spanning tree', 'kruskal', 'prim']],
  ['dsu', ['dsu', 'disjoint set union', 'union find']],
  ['shortest-paths', ['dijkstra', 'shortest path', 'bellman ford', 'floyd warshall']],
  ['topological-sort', ['topological sort', 'toposort']],
  ['graph-traversal', ['dfs', 'bfs', 'graph algos', 'graphs', 'traversals', 'advanced graph algos', 'trees']],
  ['fenwick-segment', ['fenwick', 'bit', 'binary indexed tree', 'range queries', 'queries']],
  ['combinatorics-basics', ['combinatorics', 'inclusion exclusion', 'permutations']],
  ['modular-arithmetic', ['modular arithmetic', 'modulo', 'fast exponentiation']],
  ['number-theory-basics', ['number theory', 'gcd', 'prime divisors', 'divisors', 'integer factorisation', 'primes', 'sieve']],
  ['binary-search-answer', ['binary search on answer', 'binary search', 'searching', 'ternary search']],
  ['two-pointers-sliding', ['two pointers', 'sliding window', 'subarray']],
  ['prefix-sums-difference', ['prefix sum', 'prefix sums', 'difference array', 'pre processing']],
  ['stacks-monotonic', ['stacks', 'monotonic stack', 'queues']],
  ['bit-manipulation', ['bit manipulation', 'bitwise operation', 'bitwise-xor', 'xor']],
  ['strings-basics', ['string', 'strings']],
  ['hashing-frequency', ['frequency arrays', 'maps', 'sets', 'set theory']],
  ['sorting-and-comparators', ['sorting', 'sort']],
  ['dp-linear', ['dynamic programming', 'dp approach', 'bottom-up', 'recursion', 'backtracking']],
  ['greedy-exchange', ['greedy']],
  ['constructive-basics', ['constructive', 'case work', 'groupings']],
  ['arithmetic-and-parity', ['basic math', 'mathematics', 'arithmetic', 'math', 'sequences and progression', 'ap']],
  ['implementation-simulation', ['implementation', 'ad-hoc', 'observation', 'brute force', 'complete search', 'simple algos', 'arrays', '1d arrays', 'simulation']],
  ['io-and-complexity', ['basic programming concepts', 'loops', 'conditional statements', 'cakewalk']],
];

/*
  Same guard as the Codeforces rules — a typo here would file CodeChef problems
  under a section the ladder never renders.
*/
for (const [pattern] of CC_RULES) {
  if (!known.has(pattern)) throw new Error(`classify.js names an unknown CodeChef pattern: ${pattern}`);
}

/**
 * The pattern for a CodeChef problem.
 *
 * `fallback` is the tier's entry-point pattern, passed in by the curator, and is
 * used only when no tag matched — which for an un-enriched problem means every
 * time. Stated as a parameter rather than computed here so that the "we do not
 * actually know" case stays visible at the call site.
 */
export function classifyCodechef(tags = [], fallback = 'implementation-simulation') {
  const lower = new Set(tags.map((t) => String(t).toLowerCase().trim()));

  for (const [pattern, keys] of CC_RULES) {
    if (keys.some((k) => lower.has(k))) return { pattern, confidence: 0.8, via: 'cc-tags' };
  }
  return { pattern: fallback, confidence: 0.2, via: 'tier' };
}

/** Our topic vocabulary, from CodeChef's tags. Same contract as `topicsFor`. */
const CC_TOPIC_MAP = {
  'dynamic programming': 'dynamic programming',
  'dp approach': 'dynamic programming',
  'advanced dp': 'dynamic programming',
  greedy: 'greedy',
  mathematics: 'math',
  'basic math': 'math',
  math: 'math',
  arithmetic: 'math',
  'number theory': 'math',
  combinatorics: 'math',
  probability: 'math',
  'expected value': 'math',
  'modular arithmetic': 'math',
  gcd: 'math',
  divisors: 'math',
  'prime divisors': 'math',
  'integer factorisation': 'math',
  graphs: 'graphs',
  'graph algos': 'graphs',
  'advanced graph algos': 'graphs',
  dfs: 'graphs',
  bfs: 'graphs',
  traversals: 'graphs',
  trees: 'trees',
  'data structures': 'data structures',
  'advanced data structures': 'data structures',
  'segment trees': 'data structures',
  'advanced tree structures': 'data structures',
  stacks: 'data structures',
  queues: 'data structures',
  sets: 'data structures',
  maps: 'data structures',
  'frequency arrays': 'data structures',
  string: 'strings',
  strings: 'strings',
  hashing: 'strings',
  sorting: 'sorting',
  searching: 'binary search',
  'binary search': 'binary search',
  'binary search on answer': 'binary search',
  'two pointers': 'two pointers',
  'prefix sum': 'prefix sums',
  'bit manipulation': 'bit manipulation',
  'bitwise operation': 'bit manipulation',
  bitmasking: 'bit manipulation',
  constructive: 'constructive',
  'ad-hoc': 'constructive',
  observation: 'constructive',
  implementation: 'implementation',
  'brute force': 'brute force',
  'complete search': 'brute force',
  geometry: 'geometry',
  'game theory': 'game theory',
  'divide and conquer': 'divide and conquer',
  recursion: 'recursion',
  backtracking: 'recursion',
};

export const ccTopicsFor = (tags = []) =>
  [
    ...new Set(tags.map((t) => CC_TOPIC_MAP[String(t).toLowerCase().trim()]).filter(Boolean)),
  ].sort();

export { RULES as CLASSIFY_RULES, CC_RULES };
