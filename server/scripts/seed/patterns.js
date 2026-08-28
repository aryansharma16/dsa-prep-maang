/**
 * The curriculum. `order` is the learning ramp — arrays before two pointers,
 * two pointers before sliding window, graphs before DP. `quota` is how many
 * problems the curation pass keeps for that pattern: enough to internalise the
 * technique, few enough that you finish it.
 *
 * The quotas were re-derived when the FAANG list became a fourth source. They
 * had been sized for three, and a source whose problems are kept regardless of
 * rank does not simply add to a list built that way — it *displaces*, because
 * the filler allowance is whatever the quota has left after core is seated. The
 * first run with the new source seated 271 FAANG problems and silently dropped
 * 67 already-curated ones, Sqrt(x) and Integer to Roman among them.
 *
 * So each number here is now `core + the filler that pattern already had`, which
 * is what makes the fourth source additive. Anything that changes which problems
 * count as core — a new sheet, or a sheet promoted into CORE_SHEETS in curate.js
 * — has to re-derive them again. The curation report prints "+n over quota" per
 * pattern, which is the signal that this has drifted.
 */
export const PATTERNS = [
  {
    slug: 'arrays-hashing',
    name: 'Arrays & Hashing',
    quota: 42,
    blurb: 'Trade memory for time — a hash map turns a nested scan into a single pass.',
    keyTechniques: ['frequency map', 'set membership', 'index map', 'bucket by key'],
  },
  {
    slug: 'two-pointers',
    name: 'Two Pointers',
    quota: 19,
    blurb: 'On sorted or symmetric data, walk from both ends and let the comparison decide which side moves.',
    keyTechniques: ['opposite ends', 'fast & slow', 'sort then scan', 'skip duplicates'],
  },
  {
    slug: 'prefix-sum',
    name: 'Prefix Sum',
    quota: 15,
    blurb: 'Precompute running totals so any range query becomes one subtraction.',
    keyTechniques: ['running sum', 'prefix + hash map', '2D prefix grid', 'difference array'],
  },
  {
    slug: 'sliding-window',
    name: 'Sliding Window',
    quota: 18,
    blurb: 'Grow the window while it stays valid, shrink from the left the moment it breaks.',
    keyTechniques: ['fixed size', 'variable size', 'window + counter map', 'at most K trick'],
  },
  {
    slug: 'strings',
    name: 'Strings',
    quota: 18,
    blurb: 'Most string problems are an array pattern wearing a costume — parsing, counting or two pointers.',
    keyTechniques: ['char counts', 'expand around centre', 'in-place reversal', 'tokenising'],
  },
  {
    slug: 'binary-search',
    name: 'Binary Search',
    quota: 24,
    blurb: 'Not just for sorted arrays — binary search the answer whenever feasibility is monotonic.',
    keyTechniques: ['classic bounds', 'first/last occurrence', 'rotated array', 'search the answer'],
  },
  {
    slug: 'stack',
    name: 'Stack & Monotonic Stack',
    quota: 24,
    blurb: 'When the answer depends on the most recent unresolved item, a stack is the data structure.',
    keyTechniques: ['bracket matching', 'monotonic increasing/decreasing', 'next greater element', 'histogram'],
  },
  {
    slug: 'linked-list',
    name: 'Linked List',
    quota: 21,
    blurb: 'Pointer surgery. A dummy head and a slow/fast pair solve most of these.',
    keyTechniques: ['dummy head', 'slow & fast', 'reverse in place', 'merge two lists'],
  },
  {
    slug: 'trees',
    name: 'Binary Trees',
    quota: 34,
    blurb: 'Decide what each node needs from its children, then let recursion do the walking.',
    keyTechniques: ['DFS preorder/inorder/postorder', 'BFS by level', 'return-value recursion', 'path tracking'],
  },
  {
    slug: 'bst',
    name: 'Binary Search Trees',
    quota: 11,
    blurb: 'Inorder traversal of a BST is sorted — that single fact solves most BST problems.',
    keyTechniques: ['inorder = sorted', 'range pruning', 'insert/delete rewiring', 'kth element'],
  },
  {
    slug: 'heap',
    name: 'Heap / Priority Queue',
    quota: 21,
    blurb: 'When you only ever need the best-so-far, a heap beats sorting everything.',
    keyTechniques: ['top K', 'min-heap of size K', 'two heaps for median', 'merge K sorted'],
  },
  {
    slug: 'tries',
    name: 'Tries',
    quota: 10,
    blurb: 'Share prefixes across strings to make lookup depend on word length, not dictionary size.',
    keyTechniques: ['prefix tree insert/search', 'wildcard matching', 'trie + DFS on grid', 'bitwise trie'],
  },
  {
    slug: 'backtracking',
    name: 'Backtracking',
    quota: 19,
    blurb: 'Choose, recurse, un-choose. The un-choose is the part people forget.',
    keyTechniques: ['subsets & permutations', 'pruning invalid branches', 'used[] array', 'grid DFS with restore'],
  },
  {
    slug: 'graphs',
    name: 'Graphs (BFS / DFS)',
    quota: 27,
    blurb: 'Grids are graphs. BFS gives shortest unweighted paths, DFS gives connectivity.',
    keyTechniques: ['adjacency list', 'visited set', 'multi-source BFS', 'flood fill'],
  },
  {
    slug: 'advanced-graphs',
    name: 'Advanced Graphs',
    quota: 17,
    blurb: 'Weighted paths, cycle detection and grouping — Dijkstra, topological sort and union-find.',
    keyTechniques: ['union-find', 'topological sort', "Dijkstra's", 'minimum spanning tree'],
  },
  {
    slug: 'greedy',
    name: 'Greedy',
    quota: 17,
    blurb: 'Take the locally best move — but only after you can argue why it never loses.',
    keyTechniques: ['sort by a key', 'exchange argument', 'running best', 'interval scheduling'],
  },
  {
    slug: 'intervals',
    name: 'Intervals',
    quota: 10,
    blurb: 'Sort by start, then decide overlap by comparing against the last kept interval.',
    keyTechniques: ['sort by start/end', 'merge overlapping', 'sweep line', 'min-heap of end times'],
  },
  {
    slug: 'dp-1d',
    name: '1-D Dynamic Programming',
    quota: 36,
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
    quota: 14,
    blurb: 'XOR cancels pairs, n & (n-1) clears the lowest set bit. Most problems are one of those two.',
    keyTechniques: ['XOR tricks', 'masks & shifts', 'n & (n-1)', 'bitmask as a set'],
  },
  {
    slug: 'math-geometry',
    name: 'Math & Geometry',
    quota: 21,
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
  {
    slug: 'concurrency',
    name: 'Concurrency',
    /*
      Six, because six is the entire population.

      LeetCode has exactly six non-premium problems tagged Concurrency and the
      quota is set to all of them rather than to a round number. Every other
      quota here is a judgement about how much of a large pool is worth your
      time; this one is a statement that the pool is small. If the quota read 12
      the curation report would flag the pattern as a thin pool for ever, and a
      warning that can never be acted on trains you to ignore warnings.

      It sits last because it is the one pattern here that is not an algorithm.
      These problems test whether you can reason about a lock and a signal, which
      is a different skill from everything above — Databricks and Netflix ask
      them in a dedicated round, not inside the algorithm round. Filed under
      Arrays & Hashing, which is where the tag rules sent them before this
      existed, they were noise in the ramp a beginner is supposed to walk up.
    */
    quota: 6,
    blurb: 'Order operations across threads with the smallest possible amount of shared state.',
    keyTechniques: ['semaphore / permit', 'condition variable', 'atomic counter', 'lock ordering'],
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
