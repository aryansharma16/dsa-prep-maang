/**
 * The community problem sheets the ladder is curated against.
 *
 * The rating sweep in `curate.js` can tell you that a problem is popular and
 * well-rated. It cannot tell you that a problem is the *canonical* example of a
 * technique — that judgement is made by people who have taught this, and it is
 * written down in a handful of well-known sheets. This file is where those
 * sheets are declared; `fetch-sheets.js` downloads them and `parse-sheets.js`
 * turns them into `(contestId, index) -> reasons` records.
 *
 * Every source here is a public GitHub repository, pinned to a branch and read
 * as raw text. That matters for reproducibility: the snapshot lands in
 * data/raw/cp/sheets/ and is committed, so a curate run a year from now produces
 * the same ladder even if a repo is renamed or deleted.
 *
 * `weight` is how much a mention in that sheet is worth in the curation score.
 * They are not equal — CP-31 is a taught syllabus with a rating band per step,
 * while A2OJ is a broad topic index that includes everything anyone thought was
 * relevant. Both are useful and only one is opinionated.
 */

const GH_RAW = 'https://raw.githubusercontent.com';
const GH_API = 'https://api.github.com';

export const SHEETS = Object.freeze([
  /**
   * The CP-31 sheet: 31 problems at each rating from 800 to 1500.
   *
   * The single most useful source here for the lower half of the ladder,
   * because it is not a topic list — it is a *rating* ladder built to be worked
   * through in order, which is exactly the progression this module is organised
   * around. The repo stores one C++ solution per problem, named
   * `{rating}/{rating}-{n}-{Title}.cpp`, so the rating, the position in the
   * band, the title and a reference implementation all come from the path.
   *
   * The catch is that the paths carry no contest id, so these are matched back
   * to the Codeforces problemset by (title, rating) in parse-sheets.js.
   */
  {
    id: 'cp-31',
    label: 'CP-31 Sheet',
    kind: 'github-tree',
    repo: 'shobhitraj1/CP-31-Sheet-Solutions',
    ref: 'main',
    file: 'cp-31.json',
    weight: 3.0,
    solutionLang: 'cpp',
  },

  /**
   * Updated A2OJ-style Div. 2 ladders — 100 problems each for A, B, C, D and E.
   *
   * Markdown tables with a direct problemset link and a rating per row, so these
   * parse exactly and need no title matching. The division-letter split is
   * genuinely useful information the API does not carry: "a Div. 2 C" is a
   * shared vocabulary for a kind of problem, not just a rating.
   */
  {
    id: 'cf-ladders',
    label: 'Codeforces Ladders',
    kind: 'raw-files',
    repo: 'karansinghgit/CodeForces-Ladders',
    ref: 'master',
    weight: 2.0,
    files: [
      { path: 'div2A.md', group: 'Div. 2 A' },
      { path: 'div2B.md', group: 'Div. 2 B' },
      { path: 'div2C.md', group: 'Div. 2 C' },
      { path: 'div2D.md', group: 'Div. 2 D' },
      { path: 'div2E.md', group: 'Div. 2 E' },
    ],
  },

  /**
   * The A2OJ ladder, by topic.
   *
   * 150-odd category files, each a markdown table of problems across several
   * judges. Only the Codeforces rows are used, and the category name is the
   * reason this source is here at all: it is a human-assigned topic label, which
   * is a far better pattern signal than the Codeforces tag list (which is an
   * editorial answer key rather than a teaching category).
   *
   * Broad rather than opinionated — hence the lower weight. A problem being in
   * A2OJ's `dsu` list is good evidence about *which pattern* it belongs to and
   * weak evidence that it is worth doing.
   */
  {
    id: 'a2oj',
    label: 'A2OJ Ladder',
    kind: 'github-tree-files',
    repo: 'rishabhdeepsingh/A2OJ-Ladder',
    ref: 'master',
    file: 'a2oj.json',
    weight: 1.0,
    /** Only files under here are category tables. */
    prefix: 'categories/',
    /**
     * A2OJ category directory -> our pattern slug.
     *
     * Only the categories that map cleanly are listed. An unmapped category is
     * still parsed — its problems just contribute a sheet mention without a
     * pattern hint, which is the honest outcome for a bucket called `Strategy`.
     */
    patternMap: {
      '001. Dynamic_Programming': 'dp-linear',
      '002. implementation': 'implementation-simulation',
      '003. math': 'arithmetic-and-parity',
      '004. Greedy': 'greedy-exchange',
      '005. DFS_BFS_Dijkstra': 'graph-traversal',
      '006. brute_force': 'implementation-simulation',
      '007. data_structures': 'fenwick-segment',
      '013. Binary_Search_Ternary_Search': 'binary-search-answer',
      '014. constructive_algorithms': 'constructive-basics',
      '015. sortings': 'sorting-and-comparators',
      '016. graphs': 'graph-traversal',
      '017. Geometry': 'geometry',
      '018. Number_Theory': 'number-theory-basics',
      '019. strings': 'strings-basics',
      '020. combinatorics': 'combinatorics-basics',
      '022. trees': 'dp-on-trees',
      '023. Segment_Tree': 'fenwick-segment',
      '024. Network_Flow': 'flows-matching',
      '025. probabilities': 'probability-expectation',
      '026. two_pointers': 'two-pointers-sliding',
      '028. dsu': 'dsu',
      '029. bitmasks': 'dp-bitmask',
      '030. Matrix_Power': 'matrix-exponentiation',
      '031. games': 'game-theory',
      '032. MST_Disjoint_sets_SCC': 'mst',
      '033. hashing': 'string-hashing-suffix',
      '034. Binary_Indexed_Tree': 'fenwick-segment',
      '035. divide_and_conquer': 'divide-conquer',
      '036. Ad-hoc': 'constructive-basics',
      '042. Heavy-Light_Descomposition': 'heavy-light',
      '044. KMP': 'strings-basics',
      '045. string_suffix_structures': 'string-hashing-suffix',
      '047. Meet_in_The_Middle': 'divide-conquer',
      '048. Suffix_Array_Tree': 'string-hashing-suffix',
      '049. 0_1_Knapsack': 'dp-knapsack',
      '051. MO_s_Algorithm_Query_square_root_decomposition': 'offline-queries-mo',
      '052. FFT': 'fft-ntt',
      '053. Convex_hull': 'geometry',
      '054. TopologicalSort': 'topological-sort',
      '055. 2sat': 'scc-bridges',
      '056. LIS': 'dp-linear',
      '059. All_Pair_Shortest_Path_Floyd-Warshall': 'shortest-paths',
      '060. LCS': 'dp-grid-interval',
      '062. LCA': 'lca-binary-lifting',
      '063. EulerianTour': 'dp-on-trees',
      '064. Strongly_Connected_Components': 'scc-bridges',
      '065. interactive': 'interactive-problems',
      '067. Lowest_Common_Ancestor': 'lca-binary-lifting',
      '068. Suffix_automaton': 'string-hashing-suffix',
      '069. Centroid_Decomposition': 'heavy-light',
      '070. line_sweep': 'geometry',
      '073. Gaussian_elimination': 'matrix-exponentiation',
      '074. DFS_BFS': 'graph-traversal',
      '075. Coin_Change': 'dp-knapsack',
      '077. Mobius_Function': 'advanced-number-theory',
      '078. Math_Games': 'game-theory',
      '079. Edit_Distance': 'dp-grid-interval',
      '082. Persistent_Segment_Tree': 'advanced-structures',
      '084. Sqrt_decomposition': 'sqrt-decomposition',
      '086. Articulation_Point': 'scc-bridges',
      '087. Heaps': 'greedy-exchange',
      '089. Dijkstra': 'shortest-paths',
      '090. bit_manipulation': 'bit-manipulation',
      '091. Randomized_Algorithm': 'randomization',
      '094. segment_trees': 'fenwick-segment',
      '095. RMQ': 'sparse-table-rmq',
      '096. Simulation': 'implementation-simulation',
      '097. Bellman-Ford': 'shortest-paths',
      '099. digit_dp': 'dp-digit',
      '100. chinese_remainder_theorem': 'advanced-number-theory',
      '101. 0_1_BFS': 'shortest-paths',
      '102. Square_Root_Decomposition': 'sqrt-decomposition',
      '103. BinarySearchVariants': 'binary-search-answer',
      '104. Rabin-Karp': 'string-hashing-suffix',
      '107. Game_Theory': 'game-theory',
      '109. Treap': 'advanced-structures',
      '110. matrix_exponentiation': 'matrix-exponentiation',
      '111. Minimum_Spanning_Tree': 'mst',
      '112. 2D_Range_Queries': 'fenwick-segment',
      '113. Minimum_Cost_Flow': 'flows-matching',
      '114. ETF': 'advanced-number-theory',
      '119. tries': 'string-hashing-suffix',
      '120. Graph_basics_concepts_BFS_DFS': 'graph-traversal',
      "121. Kadane's_Algorithm": 'dp-linear',
      '126. flood_fill': 'graph-traversal',
      '127. binary_search': 'binary-search-answer',
      '129. Z_algorithm': 'strings-basics',
      '131. Prefix_Sums': 'prefix-sums-difference',
      '137. Pigeonhole_principle': 'combinatorics-basics',
      '140. Biconnected_Component': 'scc-bridges',
      '143. dfs': 'graph-traversal',
      '144. dp': 'dp-linear',
      '145. maxflow': 'flows-matching',
      '146. MST': 'mst',
      '147. big_mod': 'modular-arithmetic',
      '148. SQRT_Heuristic': 'sqrt-decomposition',
    },
  },
]);

export const sheetById = (id) => SHEETS.find((s) => s.id === id) || null;

export const rawUrl = (repo, ref, path) =>
  `${GH_RAW}/${repo}/${ref}/${path.split('/').map(encodeURIComponent).join('/')}`;

export const treeUrl = (repo, ref) => `${GH_API}/repos/${repo}/git/trees/${ref}?recursive=1`;

export const blobUrl = (repo, ref, path) =>
  `https://github.com/${repo}/blob/${ref}/${path.split('/').map(encodeURIComponent).join('/')}`;

/**
 * CodeChef's public problem list, by rating band.
 *
 * Undocumented but plainly public — it is what codechef.com/practice calls to
 * paint its own problem table, it needs no key, and it answers with real
 * `difficulty_rating` values. `start_rating`/`end_rating` are what make it
 * usable here: there are 21,500 problems in the index and only about 4,000 of
 * them carry a rating, so the bands both filter and paginate in one parameter.
 *
 * `page` is the pagination knob. `offset` is accepted and silently ignored,
 * which is worth knowing because the obvious loop with `offset` returns page one
 * forever and looks like a working script.
 */
export const CC_LIST_URL = 'https://www.codechef.com/api/list/problems';
export const CC_PROBLEM_URL = (code) =>
  `https://www.codechef.com/api/contests/PRACTICE/problems/${encodeURIComponent(code)}`;
export const ccProblemPage = (code) => `https://www.codechef.com/problems/${code}`;

/**
 * The CodeChef bands to sweep, and how many problems to keep from each.
 *
 * CodeChef ratings are on their own scale and do not convert to Codeforces
 * ones — a CodeChef 1600 is roughly a Codeforces 900, because the scales were
 * calibrated against different populations. The mapping to our tiers is
 * therefore declared here rather than computed, and it is approximate on
 * purpose: it is a teaching order, not a claim of equivalence.
 */
/*
  `keep` was scaled by half again when the ladder target went from 200 CodeChef
  problems to 300. The shape is deliberately unchanged — descending with rating,
  because the lower bands are where a ladder is actually walked — and the extra
  slots come off the top of a much deeper pool rather than off the bottom of
  this one: 3,872 problems clear the submission and solver floors, so 300 is
  still the best 8% of what is eligible. The floors themselves did not move.
*/
export const CC_BANDS = Object.freeze([
  { min: 1000, max: 1199, tier: 'newbie', keep: 39 },
  { min: 1200, max: 1399, tier: 'newbie', keep: 36 },
  { min: 1400, max: 1599, tier: 'pupil', keep: 39 },
  { min: 1600, max: 1799, tier: 'pupil', keep: 36 },
  { min: 1800, max: 1999, tier: 'specialist', keep: 36 },
  { min: 2000, max: 2199, tier: 'specialist', keep: 33 },
  { min: 2200, max: 2399, tier: 'expert', keep: 30 },
  { min: 2400, max: 2599, tier: 'expert', keep: 24 },
  { min: 2600, max: 2799, tier: 'candidate-master', keep: 18 },
  { min: 2800, max: 2999, tier: 'master', keep: 9 },
]);

/**
 * How good a teaching example a CodeChef problem is.
 *
 * Attempted by enough people to be real, and solved by enough of them to be
 * comprehensible. The acceptance rate is what separates "hard" from "badly
 * worded", which is the same thing the solve-count floor approximates on the
 * Codeforces side — and the only quality signal CodeChef publishes either.
 *
 * Lives here rather than in curate.js because the fetch step needs it too: it
 * shortlists by this score before spending a detail request per problem.
 */
export const ccScore = (p) => {
  const rate = p.distinctSolvers / Math.max(p.totalSubmissions, 1);
  return Math.log10(p.distinctSolvers + 1) * 2 + rate * 3;
};

/** Enough of a shortlist that the curator still has something to choose between. */
export const CC_SHORTLIST_FACTOR = 1.6;

/** The discussion thread CodeChef files an editorial under. */
export const ccEditorialUrl = (topicId) =>
  topicId && Number(topicId) > 0 ? `https://discuss.codechef.com/t/${topicId}` : '';

/** CodeChef's own coarse label for a rating, as its practice page shows it. */
export function ccDifficultyLabel(rating) {
  if (!rating || rating < 0) return 'Unrated';
  if (rating < 1200) return 'Beginner';
  if (rating < 1600) return 'Easy';
  if (rating < 2000) return 'Medium';
  if (rating < 2500) return 'Hard';
  return 'Challenge';
}

/**
 * The division a CodeChef contest code implies.
 *
 * Starters contests are split by division and the code carries it — START123A is
 * Div 1, …B is Div 2, and so on. Older contest families (COOK, LTIME, and the
 * long challenges) predate the division split and get an empty string, which
 * renders as no tag rather than as a wrong one.
 */
export function ccDivision(contestCode = '') {
  const match = String(contestCode).match(/^START\d+([A-D])$/i);
  if (match) return `Div ${{ A: 1, B: 2, C: 3, D: 4 }[match[1].toUpperCase()]}`;
  return '';
}

/** Which contest family a CodeChef problem came from. */
export function ccCategory(contestCode = '') {
  const code = String(contestCode).toUpperCase();
  if (code.startsWith('START')) return 'starters';
  if (code.startsWith('COOK')) return 'cookoff';
  if (code.startsWith('LTIME')) return 'lunchtime';
  if (/^(DSA|CP|LP|LEARN)/.test(code)) return 'learning';
  if (code) return 'long';
  return 'practice';
}
