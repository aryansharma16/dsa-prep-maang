/**
 * Maps a problem onto one curriculum pattern.
 *
 * Priority matters. Two rules were wrong in the first draft and starved whole
 * patterns, so do not reorder casually:
 *  - `bst` must be tested before `trees`, otherwise every BST problem is caught
 *    by the generic Tree/Binary Tree tag and the bst pattern ends up with 0.
 *  - `intervals` has no LeetCode tag at all, so it needs the slug keyword rule
 *    below plus NeetCode's own pattern field.
 */

// NeetCode already hand-classified 450 problems — trust that over tag guessing.
const NEETCODE_PATTERN_MAP = {
  'Arrays & Hashing': 'arrays-hashing',
  'Two Pointers': 'two-pointers',
  'Sliding Window': 'sliding-window',
  Stack: 'stack',
  'Binary Search': 'binary-search',
  'Linked List': 'linked-list',
  Trees: 'trees',
  Tries: 'tries',
  'Heap / Priority Queue': 'heap',
  Backtracking: 'backtracking',
  Graphs: 'graphs',
  'Advanced Graphs': 'advanced-graphs',
  '1-D Dynamic Programming': 'dp-1d',
  '2-D Dynamic Programming': 'dp-2d',
  Greedy: 'greedy',
  Intervals: 'intervals',
  'Math & Geometry': 'math-geometry',
  'Bit Manipulation': 'bit-manipulation',
};

const INTERVAL_SLUG = /interval|meeting-rooms|merge-triplets|car-pooling|my-calendar|employee-free-time|minimum-number-of-arrows/;

// First matching rule wins.
const TAG_RULES = [
  /*
    Concurrency goes first, and it is the only rule here that is not about which
    algorithm a problem uses.

    'Print in Order' carries Concurrency and nothing else, so before this rule
    existed it fell all the way through to the `arrays-hashing` default and sat
    in the beginner ramp next to Two Sum. The tag is only ever applied to the
    handful of threading problems, so matching it first costs nothing and cannot
    steal a problem from a pattern that wants it.
  */
  ['concurrency', ['Concurrency', 'Multi-threading']],
  ['tries', ['Trie']],
  [
    'advanced-graphs',
    [
      'Union-Find',
      'Topological Sort',
      "Dijkstra's Algorithm",
      'Shortest Path',
      'Minimum Spanning Tree',
      'Strongly Connected Component',
      'Eulerian Circuit',
    ],
  ],
  ['graphs', ['Graph Theory', 'Bipartite Graph']],
  ['bst', ['Binary Search Tree']],
  ['trees', ['Binary Tree', 'Tree', 'DP on Trees', 'Lowest Common Ancestor']],
  ['linked-list', ['Linked List', 'Doubly-Linked List']],
  ['stack', ['Monotonic Stack', 'Stack', 'Monotonic Queue', 'Queue']],
  ['heap', ['Heap (Priority Queue)', 'Quickselect']],
  ['backtracking', ['Backtracking']],
  ['dp-2d', ['0-1 Knapsack', 'Knapsack Problem', 'Longest Common Subsequence', 'Bitmask']],
  ['dp-1d', ['Dynamic Programming', 'Memoization', 'Longest Increasing Subsequence']],
  ['sliding-window', ['Sliding Window']],
  ['two-pointers', ['Two Pointers']],
  ['prefix-sum', ['Prefix Sum']],
  ['binary-search', ['Binary Search']],
  ['design', ['Design', 'Data Stream', 'Iterator']],
  ['greedy', ['Greedy']],
  ['bit-manipulation', ['Bit Manipulation']],
  ['math-geometry', ['Math', 'Geometry', 'Number Theory', 'Combinatorics']],
  ['strings', ['String Matching', 'Rolling Hash', 'String']],
];

export function classify({ slug, topicTags = [], neetcodePattern }) {
  if (INTERVAL_SLUG.test(slug || '')) return 'intervals';

  const fromNeetcode = NEETCODE_PATTERN_MAP[neetcodePattern];
  if (fromNeetcode) return fromNeetcode;

  const tags = new Set(topicTags);
  for (const [pattern, keys] of TAG_RULES) {
    if (keys.some((key) => tags.has(key))) return pattern;
  }

  return 'arrays-hashing';
}

/**
 * Striver's 61 GFG/CodeStudio-only problems carry no tags, and their titles are
 * too terse for regexes to place reliably ("DFS", "BFS", "Egg Dropping"). There
 * are only 61, so they are pinned explicitly — clearer and far less fragile than
 * stacking more regexes. Anything not listed falls through to TITLE_RULES.
 */
const TITLE_OVERRIDES = {
  'flattening of a linkedlist': 'linked-list',
  'm coloring problem': 'backtracking',
  'the n-th root of an integer': 'binary-search',
  'k-th element of two sorted arrays': 'binary-search',
  'aggressive cows': 'binary-search',
  'allocate minimum number of pages': 'binary-search',
  'matrix median': 'binary-search',
  'merge k sorted arrays': 'heap',
  'maximum sum combination': 'heap',
  'next smaller element': 'stack',
  'the celebrity problem': 'stack',
  'check for children sum property': 'trees',
  dfs: 'graphs',
  bfs: 'graphs',
  "mst using prim's algo": 'advanced-graphs',
  "mst using kruskal's algo": 'advanced-graphs',
  'maximum sum increasing subsequence': 'dp-1d',
  'egg dropping': 'dp-2d',
  'maximum profit in job scheduling': 'greedy',
  'fractional knapsack problem': 'greedy',
  'power set (this is very important)': 'backtracking',
  'longest string with all prefixes': 'tries',
  'number of distinct substrings in a string': 'tries',
  'minimum characters needed to be inserted in the beginning to make it palindromic': 'strings',
  'inversion of array (pre-req: merge sort)': 'arrays-hashing',
};

/** Fallback for Striver's GFG-only problems, which carry no tags at all. */
const TITLE_RULES = [
  ['tries', /trie|prefix tree/i],
  ['advanced-graphs', /dijkstra|topolog|union find|disjoint|spanning tree|bellman|floyd|kosaraju|bridges|articulation/i],
  ['graphs', /graph|island|bipartite|clone|course schedule|flood|rotten|maze/i],
  ['bst', /\bbst\b|binary search tree/i],
  ['trees', /\btree\b|binary tree|traversal|ancestor|inorder|preorder|postorder|node|diameter/i],
  ['linked-list', /linked list|\bll\b|reverse.*list|palindrome list/i],
  ['stack', /stack|queue|parenthes|bracket|next greater|histogram/i],
  ['heap', /heap|priority queue|kth largest|kth smallest|median/i],
  ['backtracking', /permut|combinat|subset|n[- ]queen|sudoku|word break|rat in|backtrack/i],
  ['dp-2d', /knapsack|edit distance|common subsequence|matrix chain|palindrom.*partition|grid path/i],
  ['dp-1d', /dynamic|dp\b|longest increasing|house robber|stairs|coin change|subset sum/i],
  ['sliding-window', /window|longest substring|subarray of size/i],
  ['two-pointers', /two pointer|3sum|4sum|pair sum|trapping rain/i],
  ['prefix-sum', /prefix|subarray.*sum|xor k|zero sum/i],
  ['binary-search', /binary search|search in rotated|median of two|nth root|allocate|koko/i],
  ['intervals', /interval|meeting|overlap/i],
  ['greedy', /greedy|activity selection|job sequen|fractional|platform|coin.*minimum/i],
  ['bit-manipulation', /\bbit\b|xor|set bits|power of two/i],
  ['design', /design|lru|lfu|cache|implement.*using/i],
  ['strings', /string|anagram|palindrome|roman|atoi|substring/i],
  ['math-geometry', /matrix|rotate|spiral|gcd|prime|sqrt|modul|pow\(/i],
];

export function classifyByTitle(title) {
  // Normalise the curly apostrophe so overrides can be written with a plain one.
  const key = String(title).toLowerCase().replace(/[’‘]/g, "'").trim();
  if (TITLE_OVERRIDES[key]) return TITLE_OVERRIDES[key];

  for (const [pattern, regex] of TITLE_RULES) {
    if (regex.test(title)) return pattern;
  }
  return 'arrays-hashing';
}
