/**
 * The curriculum. `order` is the learning ramp — arrays before two pointers,
 * two pointers before sliding window, graphs before DP. `quota` is how many
 * problems the curation pass keeps for that pattern: enough to internalise the
 * technique, few enough that you finish it.
 */
export const PATTERNS = [
  {
    slug: 'arrays-hashing',
    name: 'Arrays & Hashing',
    quota: 30,
    blurb: 'Trade memory for time — a hash map turns a nested scan into a single pass.',
    keyTechniques: ['frequency map', 'set membership', 'index map', 'bucket by key'],
  },
  {
    slug: 'two-pointers',
    name: 'Two Pointers',
    quota: 16,
    blurb: 'On sorted or symmetric data, walk from both ends and let the comparison decide which side moves.',
    keyTechniques: ['opposite ends', 'fast & slow', 'sort then scan', 'skip duplicates'],
  },
  {
    slug: 'prefix-sum',
    name: 'Prefix Sum',
    quota: 12,
    blurb: 'Precompute running totals so any range query becomes one subtraction.',
    keyTechniques: ['running sum', 'prefix + hash map', '2D prefix grid', 'difference array'],
  },
  {
    slug: 'sliding-window',
    name: 'Sliding Window',
    quota: 16,
    blurb: 'Grow the window while it stays valid, shrink from the left the moment it breaks.',
    keyTechniques: ['fixed size', 'variable size', 'window + counter map', 'at most K trick'],
  },
  {
    slug: 'strings',
    name: 'Strings',
    quota: 14,
    blurb: 'Most string problems are an array pattern wearing a costume — parsing, counting or two pointers.',
    keyTechniques: ['char counts', 'expand around centre', 'in-place reversal', 'tokenising'],
  },
  {
    slug: 'binary-search',
    name: 'Binary Search',
    quota: 20,
    blurb: 'Not just for sorted arrays — binary search the answer whenever feasibility is monotonic.',
    keyTechniques: ['classic bounds', 'first/last occurrence', 'rotated array', 'search the answer'],
  },
  {
    slug: 'stack',
    name: 'Stack & Monotonic Stack',
    quota: 20,
    blurb: 'When the answer depends on the most recent unresolved item, a stack is the data structure.',
    keyTechniques: ['bracket matching', 'monotonic increasing/decreasing', 'next greater element', 'histogram'],
  },
  {
    slug: 'linked-list',
    name: 'Linked List',
    quota: 18,
    blurb: 'Pointer surgery. A dummy head and a slow/fast pair solve most of these.',
    keyTechniques: ['dummy head', 'slow & fast', 'reverse in place', 'merge two lists'],
  },
  {
    slug: 'trees',
    name: 'Binary Trees',
    quota: 28,
    blurb: 'Decide what each node needs from its children, then let recursion do the walking.',
    keyTechniques: ['DFS preorder/inorder/postorder', 'BFS by level', 'return-value recursion', 'path tracking'],
  },
  {
    slug: 'bst',
    name: 'Binary Search Trees',
    quota: 10,
    blurb: 'Inorder traversal of a BST is sorted — that single fact solves most BST problems.',
    keyTechniques: ['inorder = sorted', 'range pruning', 'insert/delete rewiring', 'kth element'],
  },
  {
    slug: 'heap',
    name: 'Heap / Priority Queue',
    quota: 16,
    blurb: 'When you only ever need the best-so-far, a heap beats sorting everything.',
    keyTechniques: ['top K', 'min-heap of size K', 'two heaps for median', 'merge K sorted'],
  },
  {
    slug: 'tries',
    name: 'Tries',
    quota: 8,
    blurb: 'Share prefixes across strings to make lookup depend on word length, not dictionary size.',
    keyTechniques: ['prefix tree insert/search', 'wildcard matching', 'trie + DFS on grid', 'bitwise trie'],
  },
  {
    slug: 'backtracking',
    name: 'Backtracking',
    quota: 16,
    blurb: 'Choose, recurse, un-choose. The un-choose is the part people forget.',
    keyTechniques: ['subsets & permutations', 'pruning invalid branches', 'used[] array', 'grid DFS with restore'],
  },
  {
    slug: 'graphs',
    name: 'Graphs (BFS / DFS)',
    quota: 24,
    blurb: 'Grids are graphs. BFS gives shortest unweighted paths, DFS gives connectivity.',
    keyTechniques: ['adjacency list', 'visited set', 'multi-source BFS', 'flood fill'],
  },
  {
    slug: 'advanced-graphs',
    name: 'Advanced Graphs',
    quota: 14,
    blurb: 'Weighted paths, cycle detection and grouping — Dijkstra, topological sort and union-find.',
    keyTechniques: ['union-find', 'topological sort', "Dijkstra's", 'minimum spanning tree'],
  },
  {
    slug: 'greedy',
    name: 'Greedy',
    quota: 16,
    blurb: 'Take the locally best move — but only after you can argue why it never loses.',
    keyTechniques: ['sort by a key', 'exchange argument', 'running best', 'interval scheduling'],
  },
  {
    slug: 'intervals',
    name: 'Intervals',
    quota: 8,
    blurb: 'Sort by start, then decide overlap by comparing against the last kept interval.',
    keyTechniques: ['sort by start/end', 'merge overlapping', 'sweep line', 'min-heap of end times'],
  },
  {
    slug: 'dp-1d',
    name: '1-D Dynamic Programming',
    quota: 26,
    blurb: 'Define what dp[i] means in one sentence. If you cannot, the recurrence will not come.',
    keyTechniques: ['recurrence + base case', 'memo to tabulation', 'rolling variables', 'house-robber shape'],
  },
  {
    slug: 'dp-2d',
    name: '2-D Dynamic Programming',
    quota: 22,
    blurb: 'Two changing inputs means a grid — strings against strings, items against capacity.',
    keyTechniques: ['knapsack', 'LCS / edit distance', 'grid paths', 'interval DP'],
  },
  {
    slug: 'bit-manipulation',
    name: 'Bit Manipulation',
    quota: 12,
    blurb: 'XOR cancels pairs, n & (n-1) clears the lowest set bit. Most problems are one of those two.',
    keyTechniques: ['XOR tricks', 'masks & shifts', 'n & (n-1)', 'bitmask as a set'],
  },
  {
    slug: 'math-geometry',
    name: 'Math & Geometry',
    quota: 12,
    blurb: 'Matrix rotations, overflow-safe arithmetic and the occasional number-theory identity.',
    keyTechniques: ['in-place matrix ops', 'GCD / modulo', 'digit manipulation', 'coordinate geometry'],
  },
  {
    slug: 'design',
    name: 'Design',
    quota: 10,
    blurb: 'Compose the primitives you already know to hit a target complexity per operation.',
    keyTechniques: ['hash map + doubly linked list', 'two stacks', 'heap + lazy delete', 'array + index map'],
  },
];

export const PATTERN_SLUGS = PATTERNS.map((p) => p.slug);

export const patternDocs = PATTERNS.map((p, i) => ({
  slug: p.slug,
  name: p.name,
  order: i + 1,
  blurb: p.blurb,
  keyTechniques: p.keyTechniques,
}));
