/**
 * The competitive-programming curriculum: 49 techniques, ordered.
 *
 * `order` is the learning ramp and `tier` is where the technique is introduced —
 * the two are not the same thing and both are needed. Order says "learn prefix
 * sums before Mo's algorithm"; tier says "prefix sums is a Pupil-level tool", so
 * the ladder can group by rating band and the pattern-first view can still run
 * in teaching order.
 *
 * `quota` is how many problems the curation pass keeps for that pattern, summed
 * across every tier the pattern appears in. Lower tiers carry more per pattern
 * on purpose: at 1200 the bottleneck is reps, and at 2400 it is exposure, so
 * eight well-chosen flow problems beat thirty.
 *
 * `prereqs` are advisory. Nothing locks a section — see the note on the model.
 *
 * Why 49 and not 22: interview prep splits problems by what you have to
 * *recognise*, and CP splits them by what you have to *implement*. "Dynamic
 * programming" is one interview pattern and eight of these, because someone
 * fluent in knapsack is not thereby able to write a digit DP, and pretending
 * otherwise is what makes a ladder stall at Specialist.
 */

/*
  The quotas below were scaled by four thirds when the ladder target went from
  600 Codeforces problems to 800, because the top-up pass will not take any
  pattern past 1.5x its quota — leaving them at the old numbers would have
  capped the run at 795 no matter what TARGET_CF said, and the shortfall would
  have looked like a thin pool rather than an arithmetic ceiling.

  Scaled uniformly on purpose. Each of these numbers is a judgement about how
  much of that technique is worth practising relative to the others, and that
  judgement did not change just because the ladder got longer.
*/

const cp = (label, url) => ({ label, url, source: 'cp-algorithms.com' });
const usaco = (label, url) => ({ label, url, source: 'usaco.guide' });
const cf = (label, url) => ({ label, url, source: 'codeforces.com' });

export const CP_PATTERNS = [
  // ─────────────────────────────── TIER 0 · FOUNDATIONS ───────────────────────
  {
    slug: 'io-and-complexity',
    name: 'I/O, Limits & the Complexity Budget',
    tier: 'newbie',
    quota: 11,
    blurb:
      'Read the constraints first. n ≤ 10^5 and a 2-second limit is a sentence about which algorithms are allowed, before you have read the problem.',
    keyTechniques: ['fast I/O', 'reading constraints', 'operations budget', 'multi-testcase loops'],
    prereqs: [],
    brief: {
      invariant:
        'A judge machine does on the order of 10^8 simple operations per second. Every constraint in the statement is a division problem against that number.',
      whenItFires:
        'Always, and before anything else. The constraint line tells you whether you are looking for O(n log n) or O(n^2), which is most of the search narrowed before you have had an idea.',
      complexity:
        'n ≤ 10 → n!  ·  n ≤ 20 → 2^n  ·  n ≤ 500 → n^3  ·  n ≤ 5000 → n^2  ·  n ≤ 10^6 → n log n  ·  n ≤ 10^8 → O(n) or O(log n)',
      traps: [
        'cin/cout without sync_with_stdio(false) on 10^6 lines is a TLE with a correct algorithm underneath it.',
        'endl flushes. Use "\\n" inside loops and keep endl for the last line, or nothing.',
        'Sum of n over all test cases is bounded, not n per case — the whole point of that line is that O(n) per case is fine and O(maxN) per case is not.',
        'Not clearing global arrays between test cases. This is the single most common wrong-answer-on-test-2 in multi-case problems.',
      ],
      links: [
        usaco('Time Complexity', 'https://usaco.guide/bronze/time-comp'),
        usaco('Fast Input & Output', 'https://usaco.guide/general/fast-io'),
      ],
    },
  },
  {
    slug: 'implementation-simulation',
    name: 'Implementation & Simulation',
    tier: 'newbie',
    quota: 16,
    blurb:
      'No trick — just do exactly what the statement says, carefully, in the fewest lines that can still be debugged.',
    keyTechniques: ['direct simulation', 'careful indexing', 'edge-case enumeration', 'clean loops'],
    prereqs: ['io-and-complexity'],
    brief: {
      invariant:
        'The statement is the algorithm. Your only job is to translate it without introducing a case it did not mention.',
      whenItFires:
        'Div. 2 A and most Div. 3 A/B. Small constraints, a long statement, and no obvious mathematical structure — that combination means the intended solution is "do the thing".',
      complexity: 'Usually O(n) or O(n^2) with n small enough that it does not matter.',
      traps: [
        '1-indexed statements written into 0-indexed arrays. Pick one convention per problem and write it in a comment.',
        'Reading the statement diagonally. These problems are lost on the sentence you skipped, not on the algorithm.',
        'Nested special cases. If you are on your fourth if-branch, the intended solution is almost certainly a reformulation.',
      ],
      links: [usaco('Introductory Problems', 'https://usaco.guide/bronze/rect-geo')],
    },
  },
  {
    slug: 'arithmetic-and-parity',
    name: 'Arithmetic, Parity & Overflow',
    tier: 'newbie',
    quota: 13,
    blurb:
      'Odd/even, sign, and whether the answer fits in 64 bits. Three questions that decide an entire class of A and B problems.',
    keyTechniques: ['parity arguments', 'integer overflow', 'floor/ceil division', 'sign handling'],
    prereqs: ['io-and-complexity'],
    brief: {
      invariant:
        'Parity is preserved by addition of even numbers and flipped by addition of odd ones. Most parity problems are that sentence applied to an operation the statement describes.',
      whenItFires:
        'The answer is Yes/No and the operation given changes something by a fixed amount; or the constraints multiply out past 2·10^9.',
      complexity: 'O(1) or O(n) — these are observations, not algorithms.',
      traps: [
        'int overflow. n ≤ 10^5 with values ≤ 10^9 means a sum up to 10^14 — use long long / long by default and stop thinking about it.',
        'Integer division truncates toward zero in C++/Java, not toward negative infinity. -7/2 is -3, not -4. Use floorDiv when you mean floor.',
        'Ceil via (a + b - 1) / b overflows when a is near the type maximum. a / b + (a % b != 0) does not.',
        'Comparing doubles. If the problem is about integers, never leave the integers.',
      ],
      links: [cp('Fundamentals — binary exponentiation', 'https://cp-algorithms.com/algebra/binary-exp.html')],
    },
  },
  {
    slug: 'sorting-and-comparators',
    name: 'Sorting & Comparators',
    tier: 'newbie',
    quota: 13,
    blurb:
      'Half of all greedy problems are "sort by the right key". Choosing that key is the problem; the sort is one line.',
    keyTechniques: ['custom comparators', 'sort by pair', 'stable sort', 'coordinate compression'],
    prereqs: ['implementation-simulation'],
    brief: {
      invariant:
        'A comparator must define a strict weak ordering: never return true for equal elements, and be transitive. Violate it and std::sort segfaults rather than sorting wrongly.',
      whenItFires:
        'The answer does not depend on input order, and pairs of elements have an obvious "this one should come first" relation.',
      complexity: 'O(n log n)',
      traps: [
        'A comparator that returns a <= b. That is not a strict weak ordering and it is undefined behaviour, which on Codeforces means a runtime error on test 40.',
        'Sorting values but needing original indices — sort pairs of (value, index) instead of losing the mapping.',
        'Coordinate compression that forgets to deduplicate, leaving gaps in the compressed range.',
      ],
      links: [usaco('Sorting with Custom Comparators', 'https://usaco.guide/silver/sorting-custom')],
    },
  },
  {
    slug: 'prefix-sums-difference',
    name: 'Prefix Sums & Difference Arrays',
    tier: 'newbie',
    quota: 19,
    blurb:
      'Precompute running totals so any range query is one subtraction — and run it backwards so any range update is two writes.',
    keyTechniques: ['1D prefix sums', '2D prefix grid', 'difference array', 'prefix + hash map'],
    prereqs: ['arithmetic-and-parity'],
    brief: {
      invariant:
        'sum(l..r) = pre[r] - pre[l-1]. The difference array is the same identity read the other way: adding v to a range is d[l] += v, d[r+1] -= v, and one prefix pass at the end.',
      whenItFires:
        'Many range-sum queries with no updates between them, or many range updates with all queries at the end. Either half of that sentence is the signal.',
      complexity: 'O(n) build, O(1) per query',
      traps: [
        'Off-by-one at l = 0. Size the prefix array n+1 and 1-index it — the guard disappears rather than being remembered.',
        'The 2D inclusion–exclusion sign. sum = P[r2][c2] - P[r1-1][c2] - P[r2][c1-1] + P[r1-1][c1-1]; the +1 term is the one people drop.',
        'Prefix sums of a modular sequence — the subtraction can go negative, so add the modulus back before taking the mod.',
        'Reaching for prefix sums when updates and queries interleave. That is a Fenwick tree, not this.',
      ],
      links: [
        usaco('Prefix Sums', 'https://usaco.guide/silver/prefix-sums'),
        usaco('More on Prefix Sums', 'https://usaco.guide/gold/PURS'),
      ],
    },
  },
  {
    slug: 'two-pointers-sliding',
    name: 'Two Pointers & Sliding Window',
    tier: 'newbie',
    quota: 19,
    blurb:
      'When the right end moving forward can never force the left end backwards, both walk the array once and the whole thing is O(n).',
    keyTechniques: ['opposite ends', 'expanding window', 'at most K trick', 'monotone shrink'],
    prereqs: ['prefix-sums-difference', 'sorting-and-comparators'],
    brief: {
      invariant:
        'Monotonicity of the window: if [l, r] is valid then [l+1, r] is valid too. That is what lets l never move backwards, and it is the thing to check before writing the loop.',
      whenItFires:
        'Longest/shortest subarray with a property; counting pairs in a sorted array; "at most K distinct" — which is also how you get "exactly K", as f(K) - f(K-1).',
      complexity: 'O(n), or O(n log n) if a sort is needed first',
      traps: [
        'Applying it to a non-monotone predicate. A window with negative numbers and a sum constraint is not monotone, and the two-pointer answer is silently wrong.',
        'Shrinking with if instead of while — one removal is not always enough to restore validity.',
        'Counting pairs and double-counting the (i, i) case, or counting each unordered pair twice.',
      ],
      links: [
        usaco('Two Pointers', 'https://usaco.guide/silver/two-pointers'),
        usaco('Sliding Window', 'https://usaco.guide/gold/sliding-window'),
      ],
    },
  },

  // ───────────────────────────────── TIER 1 · PUPIL ───────────────────────────
  {
    slug: 'greedy-exchange',
    name: 'Greedy & the Exchange Argument',
    tier: 'pupil',
    quota: 27,
    blurb:
      'Take the locally best option and prove that swapping it into any optimal solution does not make things worse. The proof is the technique.',
    keyTechniques: ['exchange argument', 'sort then take', 'earliest deadline', 'regret / heap greedy'],
    prereqs: ['sorting-and-comparators'],
    brief: {
      invariant:
        'Exchange argument: take any optimal solution that disagrees with your greedy at the first position, swap it to agree, and show the result is no worse. Repeat and you have transformed optimal into greedy without losing anything.',
      whenItFires:
        'Maximise/minimise with no obvious DP state, small statement, and an ordering that feels natural. If sorting by something makes the answer look obvious, this is the pattern.',
      complexity: 'O(n log n), dominated by the sort',
      traps: [
        'Not proving it. A greedy that passes the samples and fails test 6 is the single most common way to lose an hour on Codeforces — spend two minutes on the exchange argument first.',
        'Greedy on a problem where a choice now removes an option later in a way the sort key does not capture. That is DP wearing a greedy costume.',
        'Ties. When two elements compare equal, the order between them sometimes still matters — decide it deliberately.',
      ],
      links: [
        usaco('Greedy Algorithms with Sorting', 'https://usaco.guide/silver/greedy-sorting'),
        usaco('Sorted Sets for greedy with data structures', 'https://usaco.guide/silver/intro-sorted-sets'),
      ],
    },
  },
  {
    slug: 'binary-search-answer',
    name: 'Binary Search on the Answer',
    tier: 'pupil',
    quota: 24,
    blurb:
      'Stop searching for the answer and start testing it. If "is X achievable?" is monotone in X, the answer is a binary search over a check function.',
    keyTechniques: ['predicate monotonicity', 'check function', 'first true / last true', 'real-valued search'],
    prereqs: ['two-pointers-sliding'],
    brief: {
      invariant:
        'There is a threshold T such that check(x) is false for every x < T and true for every x ≥ T. Binary search finds T; the whole difficulty is writing check().',
      whenItFires:
        '"Minimise the maximum", "maximise the minimum", "the smallest k such that…". Those phrasings are almost a guarantee. Also whenever the answer is a number in a known range and verifying a candidate is easier than producing one.',
      complexity: 'O(n log(max answer)) — the check dominates, the log is free',
      traps: [
        'Predicate not actually monotone. Test it on paper: if check(5) is true and check(7) is false, this is not binary search.',
        'Infinite loop from the wrong midpoint rounding. Use lo < hi with mid = lo + (hi - lo) / 2 and hi = mid / lo = mid + 1, and never write both branches as mid.',
        'Binary searching on doubles with a while (l < r) loop — use a fixed 100 iterations instead, or you will hang on precision.',
        'Overflow in (lo + hi) / 2 when both are near 10^18.',
      ],
      links: [
        usaco('Binary Search', 'https://usaco.guide/silver/binary-search'),
        cp('Binary search', 'https://cp-algorithms.com/num_methods/binary_search.html'),
      ],
    },
  },
  {
    slug: 'hashing-frequency',
    name: 'Maps, Sets & Frequency Counting',
    tier: 'pupil',
    quota: 16,
    blurb:
      'Trade memory for time. A frequency map turns a nested scan into a single pass, and a set turns "have I seen this" into O(1).',
    keyTechniques: ['frequency map', 'set membership', 'index map', 'counting complements'],
    prereqs: ['implementation-simulation'],
    brief: {
      invariant:
        'Every element is inserted once and looked up a constant number of times, so the whole pass is linear in the number of elements rather than in the number of pairs.',
      whenItFires:
        'Counting pairs with a fixed difference or sum, detecting duplicates, "how many distinct", or anything where the naive solution is two nested loops over the same array.',
      complexity: 'O(n) expected with a hash map, O(n log n) guaranteed with an ordered one',
      traps: [
        'unordered_map on Codeforces is anti-testable — someone will hack it to O(n^2). Add a random seed to the hash, or use map / gp_hash_table.',
        'Counting each pair twice when both orders satisfy the condition.',
        'Iterating a map while erasing from it without advancing the iterator correctly.',
      ],
      links: [
        usaco('Introduction to Sets & Maps', 'https://usaco.guide/bronze/intro-sets'),
        usaco('Hashmaps and their pitfalls', 'https://usaco.guide/gold/hashmaps'),
      ],
    },
  },
  {
    slug: 'stacks-monotonic',
    name: 'Stacks & Monotonic Structures',
    tier: 'pupil',
    quota: 16,
    blurb:
      'When the answer depends on the nearest unresolved element, a stack that never breaks its own ordering answers every query in amortised O(1).',
    keyTechniques: ['bracket matching', 'next greater element', 'monotonic stack', 'monotonic deque'],
    prereqs: ['implementation-simulation'],
    brief: {
      invariant:
        'The stack holds exactly the elements that are still candidates to be somebody\'s answer, in sorted order. Popping an element is the moment its answer is found — each element is pushed and popped once, which is where the amortised O(n) comes from.',
      whenItFires:
        '"Nearest greater/smaller element to the left/right", largest rectangle in a histogram, sliding-window minimum, and any bracket or nesting question.',
      complexity: 'O(n) amortised',
      traps: [
        'Popping on >= instead of > (or the reverse) when equal elements matter — it decides whether ties count as "greater".',
        'Forgetting the elements left on the stack at the end; their answer is "none", and they still need writing.',
        'Using a monotonic deque for the sliding-window minimum and popping from the wrong end.',
      ],
      links: [usaco('Stacks', 'https://usaco.guide/gold/stacks')],
    },
  },
  {
    slug: 'number-theory-basics',
    name: 'GCD, Divisors & the Sieve',
    tier: 'pupil',
    quota: 19,
    blurb:
      'Factorisation, divisor counting and gcd. The three primitives that most 1200–1600 maths problems are assembled from.',
    keyTechniques: ['Euclidean gcd', 'trial division to sqrt(n)', 'sieve of Eratosthenes', 'smallest prime factor'],
    prereqs: ['arithmetic-and-parity'],
    brief: {
      invariant:
        'gcd(a, b) = gcd(b, a mod b), and every composite n has a prime factor ≤ sqrt(n). Those two facts generate almost everything at this level.',
      whenItFires:
        'Divisibility conditions, "how many pairs with gcd = k", counting divisors, prime factorisation, or anything where the constraint is on a number rather than on a sequence.',
      complexity: 'gcd O(log min(a,b)) · trial division O(sqrt n) · sieve O(n log log n)',
      traps: [
        'gcd(0, x) = x — useful, and a source of bugs when 0 is not expected in the input.',
        'Trial division with i * i <= n overflows when n is near 10^18; use i <= n / i.',
        'Sieving to 10^7 with a bool array is fine; with an int array it is 40MB and a memory-limit exceeded.',
        'Counting divisors by looping to n rather than to sqrt(n), then forgetting that a perfect square counts its root once.',
      ],
      links: [
        cp('Sieve of Eratosthenes', 'https://cp-algorithms.com/algebra/sieve-of-eratosthenes.html'),
        cp('Euclidean algorithm', 'https://cp-algorithms.com/algebra/euclid-algorithm.html'),
        cp('Divisors and number of divisors', 'https://cp-algorithms.com/algebra/divisors.html'),
      ],
    },
  },
  {
    slug: 'modular-arithmetic',
    name: 'Modular Arithmetic & Fast Power',
    tier: 'pupil',
    quota: 16,
    blurb:
      'Everything counted modulo 10^9+7, plus the two operations that are not obvious: exponentiation in O(log n) and division by inverse.',
    keyTechniques: ['binary exponentiation', 'modular inverse', 'Fermat little theorem', 'safe mod addition'],
    prereqs: ['number-theory-basics'],
    brief: {
      invariant:
        'Addition, subtraction and multiplication commute with mod. Division does not — a/b mod p is a · b^(p-2) mod p, and only when p is prime and b is not a multiple of it.',
      whenItFires:
        'The statement says "output the answer modulo 998244353" or "modulo 10^9+7". That line is not a formatting note, it is telling you the answer is astronomically large and counting is the problem.',
      complexity: 'O(log n) per power or inverse',
      traps: [
        'Multiplying two values under 10^9 in an int. The product is 10^18 and needs long long / long before the mod, every time.',
        'Subtraction going negative: write (a - b % m + m) % m, not (a - b) % m.',
        'Fermat\'s inverse on a non-prime modulus, or on a b that shares a factor with it. Use extended Euclid there.',
        '998244353 and 10^9+7 are both primes and are not interchangeable — read which one the statement asked for.',
      ],
      links: [
        cp('Binary exponentiation', 'https://cp-algorithms.com/algebra/binary-exp.html'),
        cp('Modular inverse', 'https://cp-algorithms.com/algebra/module-inverse.html'),
        usaco('Modular Arithmetic', 'https://usaco.guide/gold/modular'),
      ],
    },
  },
  {
    slug: 'constructive-basics',
    name: 'Constructive Algorithms I',
    tier: 'pupil',
    quota: 19,
    blurb:
      'Build any valid answer rather than the best one. The work is finding a pattern simple enough to state, then proving it always applies.',
    keyTechniques: ['small-case enumeration', 'invariant spotting', 'symmetric construction', 'parity-based impossibility'],
    prereqs: ['arithmetic-and-parity'],
    brief: {
      invariant:
        'Whatever quantity your construction preserves is also the thing that proves the impossible cases impossible. Find the invariant and you get both halves of the problem at once.',
      whenItFires:
        '"Output any valid …", or "-1 if impossible". Small n in the samples, no optimisation asked for, and an answer that is a whole object rather than a number.',
      complexity: 'Usually O(n) once found — the construction is cheap and the thinking is not',
      traps: [
        'Not writing out n = 1, 2, 3 by hand. Almost every constructive problem is solved on paper before it is solved in an editor.',
        'Missing the impossible case. If the statement mentions -1, there is one, and it is usually a parity or a counting bound.',
        'Finding a construction that works for even n and shipping it without checking odd n.',
      ],
      links: [
        usaco('Ad Hoc & constructive problems', 'https://usaco.guide/bronze/ad-hoc'),
        usaco('Greedy Algorithms with Sorting', 'https://usaco.guide/silver/greedy-sorting'),
      ],
    },
  },

  // ─────────────────────────────── TIER 2 · SPECIALIST ────────────────────────
  {
    slug: 'graph-traversal',
    name: 'BFS & DFS on Graphs and Grids',
    tier: 'specialist',
    quota: 24,
    blurb:
      'Connected components, reachability, shortest paths on unweighted edges, cycle detection, bipartite checks — all one traversal with different bookkeeping.',
    keyTechniques: ['adjacency list', 'BFS layers', 'DFS recursion & colouring', 'grid as implicit graph', 'multi-source BFS'],
    prereqs: ['stacks-monotonic'],
    brief: {
      invariant:
        'BFS visits vertices in non-decreasing order of distance from the source, which is exactly why it solves unweighted shortest paths and DFS does not.',
      whenItFires:
        'Anything phrased as reachability, components, "minimum number of moves" on an unweighted structure, or a grid with walls. A grid is a graph with 4 or 8 implicit edges per cell — do not build an edge list for it.',
      complexity: 'O(V + E)',
      traps: [
        'Marking visited when popping instead of when pushing. The queue fills with duplicates and the complexity degrades.',
        'Recursive DFS on 10^5+ vertices in a chain — stack overflow. Use an iterative DFS or raise the stack size.',
        'Multi-source BFS written as one BFS per source. Push every source at distance 0 instead; it is one pass.',
        'Grid bounds checked after indexing rather than before.',
      ],
      links: [
        cp('Breadth-first search', 'https://cp-algorithms.com/graph/breadth-first-search.html'),
        usaco('Graph Traversal', 'https://usaco.guide/silver/graph-traversal'),
      ],
    },
  },
  {
    slug: 'dsu',
    name: 'Disjoint Set Union',
    tier: 'specialist',
    quota: 16,
    blurb:
      'Merge sets and ask whether two things are in the same one, both in near-constant time. The right answer to a surprising number of problems that look nothing like sets.',
    keyTechniques: ['path compression', 'union by size/rank', 'component aggregates', 'offline / reverse-time DSU'],
    prereqs: ['graph-traversal'],
    brief: {
      invariant:
        'Each set has one representative and find() returns it. With both path compression and union by size the amortised cost is inverse-Ackermann — effectively constant.',
      whenItFires:
        'Dynamic connectivity where edges only get added, "are these two connected", counting components as things merge, Kruskal, and cycle detection in an undirected graph.',
      complexity: 'O(α(n)) amortised per operation — treat it as O(1)',
      traps: [
        'Only path compression, no union by size. Still fast in practice, but the worst case is O(log n) and there are problems built to hit it.',
        'Storing per-component data on the wrong node — it belongs on find(x), and must be merged when two roots join.',
        'Deletions. DSU cannot remove an edge; a problem with deletions is usually the same problem processed in reverse.',
      ],
      links: [
        cp('Disjoint Set Union', 'https://cp-algorithms.com/data_structures/disjoint_set_union.html'),
        usaco('Disjoint Set Union', 'https://usaco.guide/gold/dsu'),
      ],
    },
  },
  {
    slug: 'shortest-paths',
    name: 'Shortest Paths',
    tier: 'specialist',
    quota: 19,
    blurb:
      'Dijkstra for non-negative weights, 0-1 BFS for weights in {0,1}, Bellman–Ford for negatives, Floyd–Warshall for all pairs. Picking correctly is most of the work.',
    keyTechniques: ['Dijkstra with a heap', '0-1 BFS with a deque', 'Bellman–Ford & negative cycles', 'Floyd–Warshall', 'state-augmented graphs'],
    prereqs: ['graph-traversal'],
    brief: {
      invariant:
        'Dijkstra: once a vertex is popped from the priority queue its distance is final. That is only true with non-negative weights, and it is exactly what breaks when one edge is negative.',
      whenItFires:
        'Weighted "minimum cost to get from A to B". If the cost has a second dimension — fuel, keys held, moves used — the graph is (vertex, that dimension) and the algorithm is unchanged.',
      complexity: 'Dijkstra O(E log V) · 0-1 BFS O(V + E) · Bellman–Ford O(VE) · Floyd O(V^3)',
      traps: [
        'Dijkstra with negative weights. It compiles, it runs, it is wrong.',
        'Not skipping stale heap entries — check if (d > dist[v]) continue; or the complexity blows up.',
        'Initialising distances to INT_MAX and then adding a weight to it. Overflow. Use a large-but-addable sentinel like 4e18 for long long.',
        'Floyd–Warshall with the k loop anywhere but outermost. It silently computes something else.',
      ],
      links: [
        cp('Dijkstra', 'https://cp-algorithms.com/graph/dijkstra.html'),
        cp('0-1 BFS', 'https://cp-algorithms.com/graph/01_bfs.html'),
        usaco('Shortest Paths', 'https://usaco.guide/gold/shortest-paths'),
      ],
    },
  },
  {
    slug: 'topological-sort',
    name: 'Topological Sort & DAG DP',
    tier: 'specialist',
    quota: 13,
    blurb:
      'Order a DAG so every edge points forwards, then any DP over it becomes a single left-to-right pass.',
    keyTechniques: ["Kahn's algorithm", 'DFS post-order', 'cycle detection', 'longest path on a DAG'],
    prereqs: ['graph-traversal'],
    brief: {
      invariant:
        'In topological order, every predecessor of a vertex is processed before it. That is precisely the condition a DP recurrence needs, which is why DAG DP is just a loop over this order.',
      whenItFires:
        'Dependencies, prerequisites, "task B needs task A", or a longest/shortest path in a graph with no cycles — where Dijkstra is unnecessary and DP is linear.',
      complexity: 'O(V + E)',
      traps: [
        'Not detecting the cycle. If Kahn\'s output is shorter than V, the graph had one — and that is usually the "-1" case.',
        'Longest path on a general graph. It is NP-hard; the DAG is what makes it easy, so check acyclicity before assuming.',
        'Building the DP in input order instead of topological order and getting a subtly stale value.',
      ],
      links: [
        cp('Topological sorting', 'https://cp-algorithms.com/graph/topological-sort.html'),
        usaco('Topological Sort', 'https://usaco.guide/gold/toposort'),
      ],
    },
  },
  {
    slug: 'dp-linear',
    name: 'Linear DP',
    tier: 'specialist',
    quota: 24,
    blurb:
      'One dimension, one pass. Define what dp[i] means in a sentence, and the transition usually writes itself.',
    keyTechniques: ['state definition', 'transition from previous states', 'prefix optimisation', 'rolling array'],
    prereqs: ['prefix-sums-difference'],
    brief: {
      invariant:
        'dp[i] must be answerable without knowing anything about indices past i. If your transition needs the future, the state is wrong — not the code.',
      whenItFires:
        'Count the ways / find the best over a sequence where each element is taken, skipped, or grouped with its neighbours, and choices interact only locally.',
      complexity: 'O(n) states × O(1) or O(k) transition',
      traps: [
        'Writing the transition before writing down in words what dp[i] means. Every hard DP bug is a state that means two things.',
        'Wrong base case. dp[0] is the empty prefix, and it is 1 for counting and 0 for summing — mixing those up shifts everything.',
        'Iterating the wrong direction for an in-place (rolling) array, so a value is read after it has already been updated this round.',
      ],
      links: [
        usaco('Introduction to DP', 'https://usaco.guide/gold/intro-dp'),
        usaco('Paths on Grids', 'https://usaco.guide/gold/dp-paths'),
      ],
    },
  },
  {
    slug: 'dp-knapsack',
    name: 'Knapsack & Subset Sums',
    tier: 'specialist',
    quota: 19,
    blurb:
      'Items with weights and values, and a capacity. The template every "choose a subset with a budget" problem reduces to.',
    keyTechniques: ['0/1 knapsack', 'unbounded knapsack', 'subset sum reachability', 'bitset speedup'],
    prereqs: ['dp-linear'],
    brief: {
      invariant:
        'dp[w] after processing the first i items = the best achievable using exactly those items with capacity w. The loop direction is what encodes "each item once" versus "unlimited".',
      whenItFires:
        'A budget or capacity in the constraints, and items each usable a bounded number of times. Also every "can we make sum S from this multiset".',
      complexity: 'O(n · W). With a bitset, subset-sum reachability is O(n · W / 64)',
      traps: [
        'The 1D loop direction. 0/1 knapsack iterates capacity downwards; unbounded iterates upwards. Getting it backwards silently solves the other problem.',
        'W up to 10^9. That is not a knapsack — it is meet-in-the-middle or a greedy, and the constraint is telling you so.',
        'Bounded knapsack (k copies) done as k separate items when k is 10^9. Use binary splitting: 1, 2, 4, … copies.',
      ],
      links: [usaco('Knapsack DP', 'https://usaco.guide/gold/knapsack')],
    },
  },
  {
    slug: 'combinatorics-basics',
    name: 'Combinatorics & Inclusion–Exclusion',
    tier: 'specialist',
    quota: 16,
    blurb:
      'nCr with precomputed factorials, stars and bars, and the alternating-sign fix for overcounting.',
    keyTechniques: ['factorial precompute', 'nCr mod p', 'stars and bars', 'inclusion–exclusion', 'complementary counting'],
    prereqs: ['modular-arithmetic'],
    brief: {
      invariant:
        'Count each object exactly once. Inclusion–exclusion is the bookkeeping that turns "at least one" into "total minus none", with alternating signs for the overlaps.',
      whenItFires:
        'The answer is a count modulo a prime, the objects are arrangements or selections, and a direct DP would have too many states.',
      complexity: 'O(n) precompute, O(1) per nCr, O(2^k) for k-set inclusion–exclusion',
      traps: [
        'Recomputing factorials inside the loop. Precompute factorial and inverse factorial arrays once to n.',
        'nCr with r > n or r < 0 — return 0 explicitly rather than indexing out of bounds.',
        'Counting "at least one" directly. Almost always easier as total minus "none".',
        'Forgetting that inverse factorials can be built in one O(n) backwards pass rather than n modpows.',
      ],
      links: [
        cp('Binomial coefficients', 'https://cp-algorithms.com/combinatorics/binomial-coefficients.html'),
        cp('Inclusion–exclusion principle', 'https://cp-algorithms.com/combinatorics/inclusion-exclusion.html'),
      ],
    },
  },
  {
    slug: 'bit-manipulation',
    name: 'Bit Manipulation',
    tier: 'specialist',
    quota: 16,
    blurb:
      'Treat an integer as a set. Subset enumeration, XOR properties, and per-bit independence — three ideas that solve most bit problems.',
    keyTechniques: ['popcount & lowbit', 'subset enumeration', 'XOR basis intuition', 'bit-by-bit greedy'],
    prereqs: ['arithmetic-and-parity'],
    brief: {
      invariant:
        'Bits are independent under AND, OR and XOR. Most bit problems become 30 independent one-bit problems, solved separately and recombined.',
      whenItFires:
        'XOR in the statement, n ≤ 20 with subsets, "maximum AND/OR of a subsequence", or values bounded by 2^k where k is small.',
      complexity: 'O(n · 30) for per-bit passes, O(3^n) to enumerate all subsets of all subsets',
      traps: [
        '1 << k with k ≥ 31 in an int. Write 1LL << k.',
        'Operator precedence: (a & 1) == 0 needs those parentheses; a & 1 == 0 parses as a & (1 == 0).',
        'XOR prefix arrays and range XOR — the identity is the same as prefix sums, but subtraction is XOR, not minus.',
        'Enumerating submasks with the wrong loop; the idiom is for (int s = m; s; s = (s - 1) & m).',
      ],
      links: [
        usaco('Introduction to Bitwise Operators', 'https://usaco.guide/bronze/intro-bitwise'),
        cp('Submask enumeration', 'https://cp-algorithms.com/algebra/all-submasks.html'),
      ],
    },
  },
  {
    slug: 'strings-basics',
    name: 'String Processing, Z-function & KMP',
    tier: 'specialist',
    quota: 16,
    blurb:
      'Pattern matching in linear time, and the prefix-function table that also answers periodicity and border questions.',
    keyTechniques: ['prefix function (KMP)', 'Z-function', 'border & period', 'character counting'],
    prereqs: ['hashing-frequency'],
    brief: {
      invariant:
        'pi[i] is the length of the longest proper prefix of s[0..i] that is also a suffix of it. Everything KMP does — matching, periods, borders — is a reading of that array.',
      whenItFires:
        'Substring search, "is this string a repetition of a shorter one", counting occurrences, or the smallest number of characters to append to make a palindrome.',
      complexity: 'O(n + m)',
      traps: [
        'The minimal period is n - pi[n-1], and it only tiles the string when n is divisible by it.',
        'Z-function index 0 is conventionally n or 0 depending on the implementation — be consistent with whichever you use.',
        'Reaching for a suffix automaton when a prefix function does it. At this level it almost always does.',
      ],
      links: [
        cp('Prefix function — Knuth–Morris–Pratt', 'https://cp-algorithms.com/string/prefix-function.html'),
        cp('Z-function', 'https://cp-algorithms.com/string/z-function.html'),
      ],
    },
  },

  // ──────────────────────────────── TIER 3 · EXPERT ───────────────────────────
  {
    slug: 'dp-grid-interval',
    name: 'Grid & Interval DP',
    tier: 'expert',
    quota: 16,
    blurb:
      'Two-dimensional states. Grids go corner to corner; intervals grow outwards from every substring of length one.',
    keyTechniques: ['grid path DP', 'interval DP by length', 'split-point transition', 'palindrome DP'],
    prereqs: ['dp-linear'],
    brief: {
      invariant:
        'Interval DP: dp[l][r] depends only on strictly shorter intervals. Iterate by increasing length, not by increasing l, or the values you read are not there yet.',
      whenItFires:
        'Merging adjacent items with a cost, matrix-chain shapes, palindromic substructure, or a grid where you move only right and down.',
      complexity: 'O(n^2) states, O(1) or O(n) transition — so O(n^2) to O(n^3)',
      traps: [
        'Iterating l and r as a plain nested loop. Length must be the outer dimension.',
        'n ≤ 500 with an O(n^3) interval DP is 1.25·10^8 — fine in C++, borderline in Java. Check the language against the constraint.',
        'Off-by-one on the split point, so an interval either includes the divider twice or not at all.',
      ],
      links: [usaco('Range DP', 'https://usaco.guide/gold/dp-ranges')],
    },
  },
  {
    slug: 'dp-on-trees',
    name: 'DP on Trees & Rerooting',
    tier: 'expert',
    quota: 16,
    blurb:
      'Compute an answer for every subtree in one DFS — then, if the answer is needed for every root, get all n of them in a second pass rather than n DFS runs.',
    keyTechniques: ['subtree DP', 'merging children', 'rerooting technique', 'tree diameter'],
    prereqs: ['graph-traversal', 'dp-linear'],
    brief: {
      invariant:
        'dp[v] summarises everything inside v\'s subtree and nothing outside it. Rerooting adds a second array holding everything outside, so the two combine into the answer at any root.',
      whenItFires:
        'A tree in the input and a question about every vertex, or about subtrees. If the naive answer is "run a DFS from each vertex", rerooting turns O(n^2) into O(n).',
      complexity: 'O(n) for subtree DP, O(n) for rerooting',
      traps: [
        'Recursion depth on a path-shaped tree of 2·10^5 vertices. Iterative DFS, or increase the stack.',
        'Rerooting with a non-invertible merge (max, for instance). You cannot "subtract" a child — use prefix/suffix aggregates over the child list instead.',
        'Treating the parent as a child during the merge, which double-counts the whole rest of the tree.',
      ],
      links: [
        usaco('Tree DP', 'https://usaco.guide/gold/dp-trees'),
        usaco('DP on Trees — Solving for All Roots', 'https://usaco.guide/gold/all-roots'),
      ],
    },
  },
  {
    slug: 'sparse-table-rmq',
    name: 'Sparse Table & RMQ',
    tier: 'expert',
    quota: 11,
    blurb:
      'Static array, no updates, many range-minimum queries: precompute once and answer each in O(1).',
    keyTechniques: ['binary lifting table', 'idempotent operations', 'O(1) overlapping query', 'log precompute'],
    prereqs: ['prefix-sums-difference'],
    brief: {
      invariant:
        'The query works by covering [l, r] with two overlapping power-of-two blocks. That only gives the right answer for idempotent operations — min, max, gcd — where counting an element twice is harmless. Sums need a Fenwick tree instead.',
      whenItFires:
        'The array never changes and there are more queries than elements. If there is a single update anywhere in the statement, this is the wrong structure.',
      complexity: 'O(n log n) build, O(1) per query',
      traps: [
        'Using it for sums. The overlap double-counts and the answer is wrong, not slow.',
        'Recomputing log2 per query with a call rather than a precomputed table — it is the whole constant factor.',
        'Memory: n log n ints at n = 10^6 is 80MB. Check the limit before reaching for it.',
      ],
      links: [cp('Sparse Table', 'https://cp-algorithms.com/data_structures/sparse-table.html')],
    },
  },
  {
    slug: 'fenwick-segment',
    name: 'Fenwick & Segment Trees',
    tier: 'expert',
    quota: 21,
    blurb:
      'Point update, range query, both in O(log n). The workhorse structure of everything above 1600.',
    keyTechniques: ['Fenwick tree (BIT)', 'iterative segment tree', 'merge function design', 'descend on the tree'],
    prereqs: ['prefix-sums-difference', 'sparse-table-rmq'],
    brief: {
      invariant:
        'Each node owns a contiguous range and stores the merge of its children. Any query range decomposes into O(log n) such nodes, which is where the bound comes from — and why the merge must be associative.',
      whenItFires:
        'Updates and queries interleave. Also counting inversions, "how many elements smaller than x so far", and anything that becomes a prefix count after sorting.',
      complexity: 'O(n) build, O(log n) per update and per query',
      traps: [
        'Fenwick is 1-indexed. A 0-index write is an infinite loop, not an off-by-one.',
        'Fenwick does prefix aggregates of invertible operations — sums, XOR. Range minimum needs a segment tree.',
        'Segment tree array sized 2n instead of 4n on the recursive version. Overflow into someone else\'s node, silently.',
        'A merge function that is not associative. The structure is correct and the answer is not.',
      ],
      links: [
        cp('Fenwick Tree', 'https://cp-algorithms.com/data_structures/fenwick.html'),
        cp('Segment Tree', 'https://cp-algorithms.com/data_structures/segment_tree.html'),
        cf('Efficient and easy segment trees', 'https://codeforces.com/blog/entry/18051'),
      ],
    },
  },
  {
    slug: 'mst',
    name: 'Minimum Spanning Trees',
    tier: 'expert',
    quota: 11,
    blurb:
      'Kruskal with DSU, Prim with a heap — and the cut property that makes both of them obviously correct.',
    keyTechniques: ['Kruskal + DSU', 'Prim with a priority queue', 'cut property', 'second-best MST'],
    prereqs: ['dsu', 'shortest-paths'],
    brief: {
      invariant:
        'Cut property: for any partition of the vertices, the lightest edge crossing it is in some MST. Kruskal and Prim are two orders of applying that one fact.',
      whenItFires:
        '"Connect everything at minimum cost", or a problem where the answer only depends on the maximum edge on a path — which is an MST property, not a shortest-path one.',
      complexity: 'Kruskal O(E log E) · Prim O(E log V)',
      traps: [
        'Assuming the MST is unique. It is not when weights tie, and problems exploit that.',
        'Minimax path — the minimum possible maximum edge between two vertices — is the path in the MST. Reaching for Dijkstra there is a common and wrong instinct.',
        'Forgetting to check the graph was connected at all.',
      ],
      links: [
        cp("Kruskal's with DSU", 'https://cp-algorithms.com/graph/mst_kruskal_with_dsu.html'),
        usaco('Minimum Spanning Trees', 'https://usaco.guide/gold/mst'),
      ],
    },
  },
  {
    slug: 'game-theory',
    name: 'Game Theory & Sprague–Grundy',
    tier: 'expert',
    quota: 11,
    blurb:
      'Two players, perfect information, and a winner determined before the first move. Work backwards from the losing positions.',
    keyTechniques: ['win/lose states', 'Nim and xor', 'Grundy numbers', 'mex'],
    prereqs: ['dp-linear', 'bit-manipulation'],
    brief: {
      invariant:
        'A position is losing if every move from it leads to a winning position, and winning if some move leads to a losing one. Grundy generalises this to sums of independent games via xor.',
      whenItFires:
        'Alice and Bob alternate, both play optimally, and the question is who wins. If the game splits into independent piles, it is Sprague–Grundy.',
      complexity: 'O(states × moves) to compute Grundy values; often O(1) once the pattern is spotted',
      traps: [
        'Computing Grundy values for small n and not looking for the pattern. These problems almost always have one, and n is too large for the table.',
        'Xor-ing Grundy values of games that are not independent.',
        'mex is the smallest non-negative integer *not* in the set — including 0 as a candidate.',
      ],
      links: [
        cp('Sprague–Grundy theorem and Nim', 'https://cp-algorithms.com/game_theory/sprague-grundy-nim.html'),
        usaco('Games on Graphs', 'https://usaco.guide/adv/game-theory'),
      ],
    },
  },
  {
    slug: 'probability-expectation',
    name: 'Probability & Expected Value',
    tier: 'expert',
    quota: 11,
    blurb:
      'Linearity of expectation turns most of these from hard into one line — the expectation of a sum is the sum of expectations, whether or not the parts are independent.',
    keyTechniques: ['linearity of expectation', 'expected value DP', 'indicator variables', 'probability under a modulus'],
    prereqs: ['modular-arithmetic', 'dp-linear'],
    brief: {
      invariant:
        'E[X + Y] = E[X] + E[Y], always — independence is not required. Decomposing the answer into indicator variables and summing their individual probabilities is the whole technique.',
      whenItFires:
        '"Expected number of …", random choices in the process, or an answer required as p·q^-1 mod 998244353 (which is a probability wearing modular clothes).',
      complexity: 'Usually O(n) or O(n^2) DP over states',
      traps: [
        'Trying to compute the distribution when only the expectation is asked for.',
        'Expected-value DP with a self-loop — the state depends on itself, and you have to solve the linear equation rather than iterate.',
        'Working in doubles when the answer is required modulo a prime; probabilities there are modular inverses, not decimals.',
      ],
      links: [
        usaco('Inclusion–Exclusion & counting', 'https://usaco.guide/plat/PIE'),
        usaco('Introduction to Combinatorics', 'https://usaco.guide/gold/combo'),
      ],
    },
  },
  {
    slug: 'constructive-advanced',
    name: 'Constructive Algorithms II',
    tier: 'expert',
    quota: 13,
    blurb:
      'Constructions that need a real idea: recursive halving, explicit bijections, and answers built to hit a bound exactly.',
    keyTechniques: ['divide-and-conquer construction', 'bijection with a known object', 'bound-tight answers', 'randomised construction'],
    prereqs: ['constructive-basics'],
    brief: {
      invariant:
        'The construction and the impossibility proof are the same argument seen from two sides. Find the bound that says "no better than X is possible" and it usually tells you what a solution achieving X looks like.',
      whenItFires:
        'Output any object with a property, k ≤ some bound in the statement, and the samples show a structure with no obvious rule.',
      complexity: 'Varies — usually O(n) or O(n log n) once the idea is found',
      traps: [
        'Not checking your construction against the bound the statement gives. If it allows n + 5 operations and yours uses 2n, it is the wrong construction, not a slow one.',
        'Shipping without testing n = 1 and n = 2.',
        'A recursive construction whose base case does not actually satisfy the property.',
      ],
      links: [
        usaco('Ad Hoc & constructive problems', 'https://usaco.guide/bronze/ad-hoc'),
        cp('Miscellaneous constructive techniques', 'https://cp-algorithms.com/combinatorics/generating_combinations.html'),
      ],
    },
  },
  {
    slug: 'interactive-problems',
    name: 'Interactive Problems',
    tier: 'expert',
    quota: 11,
    blurb:
      'Ask the judge questions within a query budget. The budget is the hint: log2(n) queries means binary search, and 2n means something linear and clever.',
    keyTechniques: ['query budget reasoning', 'flush after every write', 'adaptive judges', 'binary search by query'],
    prereqs: ['binary-search-answer'],
    brief: {
      invariant:
        'Each query must eliminate a constant fraction of the remaining possibilities, or you cannot meet a logarithmic budget. Count the information a query buys before writing it.',
      whenItFires:
        'The statement says "interactive", describes a query format, and gives a maximum number of queries. That maximum is the strongest hint in the problem.',
      complexity: 'Measured in queries, not operations — usually O(log n) or O(n)',
      traps: [
        'Not flushing. cout << endl or fflush(stdout) after every query, always — a missing flush is an idle-limit-exceeded that looks like a wrong algorithm.',
        'Assuming the judge fixed its answer in advance. Adaptive judges answer to make you fail, so your solution has to be correct against any consistent adversary.',
        'Reading the response before the query has been sent.',
      ],
      links: [
        usaco('Binary Search', 'https://usaco.guide/silver/binary-search'),
        cp('Binary search', 'https://cp-algorithms.com/num_methods/binary_search.html'),
      ],
    },
  },
  {
    slug: 'divide-conquer',
    name: 'Divide & Conquer, Meet in the Middle',
    tier: 'expert',
    quota: 13,
    blurb:
      'Split the input in half, solve both, and do the work that spans the boundary. When n ≤ 40, splitting turns 2^40 into two 2^20s.',
    keyTechniques: ['merge-sort counting', 'cross-boundary work', 'meet in the middle', 'binary search on the halves'],
    prereqs: ['sorting-and-comparators', 'binary-search-answer'],
    brief: {
      invariant:
        'Every pair (i, j) with i < j is either entirely in the left half, entirely in the right, or straddles the split. Handling exactly the third case is the whole algorithm.',
      whenItFires:
        'Counting pairs with a property across an array, or n between 30 and 45 with an exponential-looking search — that range is meet-in-the-middle almost by definition.',
      complexity: 'O(n log n), or O(2^(n/2) · n/2) for meet in the middle',
      traps: [
        'Recomputing rather than merging. The point is that the recursive calls hand back sorted halves for free.',
        'Meet in the middle with 2^20 stored subsets and no sort — the combine step needs the halves ordered to binary search.',
        'Memory on the second half. 2^20 long longs is 8MB, and 2^24 is not.',
      ],
      links: [cp('Divide and conquer DP', 'https://cp-algorithms.com/dynamic_programming/divide-and-conquer-dp.html')],
    },
  },

  // ─────────────────────── TIER 4 · CANDIDATE MASTER ──────────────────────────
  {
    slug: 'dp-bitmask',
    name: 'Bitmask DP',
    tier: 'candidate-master',
    quota: 13,
    blurb:
      'The state is a subset. n ≤ 20 in the constraints is this pattern announcing itself.',
    keyTechniques: ['subset as state', 'submask enumeration', 'SOS DP', 'assignment problems'],
    prereqs: ['bit-manipulation', 'dp-knapsack'],
    brief: {
      invariant:
        'dp[mask] is the answer for exactly the elements in mask, with the rest not yet considered. Transitions add one element or split into submasks.',
      whenItFires:
        'n ≤ 20 (2^20 = 10^6 states) or n ≤ 22 with a cheap transition. Travelling-salesman shapes, assignment problems, tiling.',
      complexity: 'O(2^n · n) for add-one transitions, O(3^n) for submask enumeration, O(2^n · n) for SOS',
      traps: [
        'Popcount inside the inner loop instead of precomputed. It is the constant factor that decides TLE.',
        'Iterating masks out of order. dp[mask] must be finalised before any superset reads it.',
        'Memory. 2^24 ints is 64MB — check the limit before choosing the state.',
      ],
      links: [
        usaco('Bitmask DP', 'https://usaco.guide/gold/dp-bitmasks'),
        cf('SOS Dynamic Programming', 'https://codeforces.com/blog/entry/45223'),
      ],
    },
  },
  {
    slug: 'dp-digit',
    name: 'Digit DP',
    tier: 'candidate-master',
    quota: 11,
    blurb:
      'Count numbers in [L, R] with a property by building them digit by digit, carrying a "still equal to the bound" flag.',
    keyTechniques: ['tight flag', 'leading zeros flag', 'count to N then subtract', 'memo on free states'],
    prereqs: ['dp-linear', 'combinatorics-basics'],
    brief: {
      invariant:
        'Once the prefix is strictly less than the bound\'s prefix, every remaining digit is free — and that is the state worth memoising, because it no longer depends on the bound.',
      whenItFires:
        'Count numbers between L and R with a digit property, where R is up to 10^18 so iteration is impossible.',
      complexity: 'O(digits × states × 10)',
      traps: [
        'Memoising the tight states. They are only reachable on one path each; caching them across different bounds gives wrong answers.',
        'Leading zeros. "Number of distinct digits" treats 007 as 7, and that needs its own flag.',
        'Answering [L, R] directly instead of as f(R) - f(L-1).',
      ],
      links: [
        usaco('Digit DP', 'https://usaco.guide/gold/dp-digit'),
        usaco('Introduction to DP', 'https://usaco.guide/gold/intro-dp'),
      ],
    },
  },
  {
    slug: 'lazy-segment-tree',
    name: 'Lazy Propagation & Segment Tree Beats',
    tier: 'candidate-master',
    quota: 16,
    blurb:
      'Range update as well as range query. The lazy tag is a promise to push work down only when someone looks.',
    keyTechniques: ['lazy tags', 'tag composition', 'push down / pull up', 'segment tree beats'],
    prereqs: ['fenwick-segment'],
    brief: {
      invariant:
        'A node\'s stored value is already correct for its whole range; its lazy tag is an update that has been applied to the node but not to its children. Every descent pushes the tag down first.',
      whenItFires:
        'Range assign / range add together with range query. If both the update and the query span ranges, plain segment trees are not enough.',
      complexity: 'O(log n) amortised per operation; beats is O(log^2 n) amortised',
      traps: [
        'Non-commuting tags. "Assign" and "add" compose in one order only — an assign wipes a pending add, and the composition function has to know that.',
        'Forgetting to push down before a query descent, so the query reads a stale child.',
        'Applying the tag to the node\'s aggregate without scaling by the range length, for sums.',
      ],
      links: [
        cp('Segment tree — lazy propagation', 'https://cp-algorithms.com/data_structures/segment_tree.html'),
        usaco('Range Update Range Query', 'https://usaco.guide/plat/RURQ'),
      ],
    },
  },
  {
    slug: 'lca-binary-lifting',
    name: 'LCA & Binary Lifting',
    tier: 'candidate-master',
    quota: 13,
    blurb:
      'Precompute the 2^k-th ancestor of every vertex and any ancestor query, any path query, becomes O(log n).',
    keyTechniques: ['up[k][v] table', 'depth-first Euler tour', 'k-th ancestor', 'path aggregates'],
    prereqs: ['dp-on-trees', 'sparse-table-rmq'],
    brief: {
      invariant:
        'up[k][v] = up[k-1][up[k-1][v]] — the 2^k-th ancestor is two 2^(k-1) jumps. Every ancestor query is a binary decomposition of the jump distance.',
      whenItFires:
        'Path queries on a static tree, distance between two vertices, or any "k-th ancestor" question. Also the substrate for a lot of tree problems that never mention LCA.',
      complexity: 'O(n log n) build, O(log n) per query',
      traps: [
        'Not levelling the two vertices to the same depth before lifting them together.',
        'Aggregating along the path and forgetting that the LCA itself is counted once, not twice.',
        'LOG chosen too small for n. Use 20 for n ≤ 10^6, and compute it rather than hard-coding.',
      ],
      links: [
        cp('LCA with binary lifting', 'https://cp-algorithms.com/graph/lca_binary_lifting.html'),
        usaco('Binary Jumping', 'https://usaco.guide/plat/binary-jump'),
      ],
    },
  },
  {
    slug: 'scc-bridges',
    name: 'SCC, Bridges & 2-SAT',
    tier: 'candidate-master',
    quota: 13,
    blurb:
      'Condense a directed graph into a DAG of strongly connected components — then implication graphs, and 2-SAT, become reachability.',
    keyTechniques: ['Tarjan / Kosaraju', 'condensation DAG', 'bridges & articulation points', '2-SAT via implications'],
    prereqs: ['topological-sort', 'graph-traversal'],
    brief: {
      invariant:
        'Every directed graph condenses to a DAG of its SCCs. In 2-SAT, x and ¬x landing in the same SCC is exactly unsatisfiability, and reverse topological order gives an assignment.',
      whenItFires:
        'Directed cycles that should be treated as one unit; "which edges are critical" (bridges); or a constraint system of the form "a or b" over booleans.',
      complexity: 'O(V + E)',
      traps: [
        'Bridges in a graph with multi-edges — a doubled edge is never a bridge, and the parent-edge check has to be by edge id, not by vertex.',
        'Building the 2-SAT implication graph with only one direction. Every clause (a ∨ b) gives two implications.',
        'Reading the SCC order backwards. Tarjan emits reverse topological order already; Kosaraju does not.',
      ],
      links: [
        cp('Strongly connected components', 'https://cp-algorithms.com/graph/strongly-connected-components.html'),
        cp('2-SAT', 'https://cp-algorithms.com/graph/2SAT.html'),
        cp('Bridges', 'https://cp-algorithms.com/graph/bridge-searching.html'),
      ],
    },
  },
  {
    slug: 'string-hashing-suffix',
    name: 'String Hashing, Suffix Arrays & Automata',
    tier: 'candidate-master',
    quota: 13,
    blurb:
      'Compare any two substrings in O(1) with a rolling hash, or get every substring relationship at once from a suffix structure.',
    keyTechniques: ['polynomial rolling hash', 'double hashing', 'suffix array + LCP', 'suffix automaton'],
    prereqs: ['strings-basics'],
    brief: {
      invariant:
        'hash(s[l..r]) = (pre[r] - pre[l-1] · p^(r-l+1)) mod M. Two substrings with the same hash are equal with high probability; two with different hashes are definitely different.',
      whenItFires:
        'Many substring equality checks, longest common substring, counting distinct substrings, or palindrome queries — anything where the naive check is O(length) and you need O(1).',
      complexity: 'O(n) hash precompute, O(1) per comparison · suffix array O(n log n)',
      traps: [
        'A fixed base and modulus on Codeforces. It will be hacked. Randomise the base at runtime.',
        'Single hashing on n = 10^5 substrings — the birthday bound bites. Use two moduli, or one 64-bit prime.',
        'Suffix array LCP off by one between adjacent suffixes and arbitrary pairs — the latter needs an RMQ over the LCP array.',
      ],
      links: [
        cp('String hashing', 'https://cp-algorithms.com/string/string-hashing.html'),
        cp('Suffix array', 'https://cp-algorithms.com/string/suffix-array.html'),
        cp('Suffix automaton', 'https://cp-algorithms.com/string/suffix-automaton.html'),
        usaco('String Hashing', 'https://usaco.guide/gold/string-hashing'),
      ],
    },
  },
  {
    slug: 'offline-queries-mo',
    name: "Mo's Algorithm & Offline Queries",
    tier: 'candidate-master',
    quota: 11,
    blurb:
      'Nothing says the queries must be answered in the order they were asked. Sort them so consecutive queries are cheap to get between.',
    keyTechniques: ["Mo's ordering", 'add/remove pointers', 'offline sorting by answer', 'small-to-large merging'],
    prereqs: ['fenwick-segment', 'divide-conquer'],
    brief: {
      invariant:
        "Sorting queries by (l / blockSize, r) bounds the total pointer movement at O((n + q)·sqrt(n)). The add() and remove() operations must each be O(1) for that bound to be the real cost.",
      whenItFires:
        'Offline range queries with no updates, where the answer is hard to merge — distinct counts, mode, "number of pairs with equal value in the range".',
      complexity: "O((n + q)·sqrt(n))",
      traps: [
        'add/remove that are O(log n). That makes the whole thing O(n sqrt(n) log n) and it will not pass.',
        'Block size not tuned to n / sqrt(q). The default sqrt(n) is often 2× slower than the right one.',
        'Using it on a problem with updates — that is Mo\'s with time, a different and heavier algorithm.',
      ],
      links: [
        cp("Sqrt decomposition and Mo's algorithm", 'https://cp-algorithms.com/data_structures/sqrt_decomposition.html'),
        usaco('Square Root Decomposition', 'https://usaco.guide/plat/sqrt'),
      ],
    },
  },
  {
    slug: 'sqrt-decomposition',
    name: 'Sqrt Decomposition',
    tier: 'candidate-master',
    quota: 11,
    blurb:
      'Split into sqrt(n) blocks and accept O(sqrt(n)) per operation in exchange for being able to handle updates a segment tree cannot express.',
    keyTechniques: ['block aggregates', 'block-level lazy', 'rebuild threshold', 'sqrt on queries'],
    prereqs: ['fenwick-segment'],
    brief: {
      invariant:
        'A range touches at most two partial blocks and O(sqrt(n)) whole ones. Partial blocks are handled element-wise, whole blocks by their aggregate.',
      whenItFires:
        'An update or query a segment tree cannot merge — "add x to every element then count how many exceed k" — or when the merge is not associative at all.',
      complexity: 'O(sqrt(n)) per operation',
      traps: [
        'Rebuilding a block on every update rather than maintaining it incrementally.',
        'Block size fixed at 316 instead of tuned; the optimum trades update cost against query cost and is rarely exactly sqrt(n).',
        'Reaching for it when a segment tree works. It is slower, and it is the fallback, not the default.',
      ],
      links: [cp('Sqrt decomposition', 'https://cp-algorithms.com/data_structures/sqrt_decomposition.html')],
    },
  },

  // ──────────────────────────────── TIER 5 · MASTER ───────────────────────────
  {
    slug: 'flows-matching',
    name: 'Max Flow & Bipartite Matching',
    tier: 'master',
    quota: 11,
    blurb:
      'Dinic, min-cut, and the modelling skill that actually matters — recognising that a problem about assignments is a problem about flow.',
    keyTechniques: ['Dinic', 'max-flow min-cut', 'bipartite matching (Hopcroft–Karp / Kuhn)', 'min-cost max-flow'],
    prereqs: ['shortest-paths', 'graph-traversal'],
    brief: {
      invariant:
        'Max-flow equals min-cut. Most flow problems on Codeforces are really min-cut problems — "remove the cheapest set of things to disconnect A from B" — wearing a different statement.',
      whenItFires:
        'Assignment or matching between two groups, "select items with conflicts", project selection, or a vertex/edge-disjoint path count.',
      complexity: 'Dinic O(V^2·E), O(E·sqrt(V)) on unit-capacity graphs · Kuhn O(V·E)',
      traps: [
        'Forgetting the reverse edge, or giving it the wrong initial capacity. Flow is wrong, not slow.',
        'Integer capacities in an int when the total is 10^10.',
        'Modelling vertex capacities without splitting the vertex into in/out halves.',
      ],
      links: [
        cp('Maximum flow — Dinic', 'https://cp-algorithms.com/graph/dinic.html'),
        cp('Kuhn — maximum bipartite matching', 'https://cp-algorithms.com/graph/kuhn_maximum_bipartite_matching.html'),
        usaco('Maximum Flow', 'https://usaco.guide/adv/max-flow'),
      ],
    },
  },
  {
    slug: 'dp-optimizations',
    name: 'DP Optimisations',
    tier: 'master',
    quota: 11,
    blurb:
      'An O(n^2) DP with n = 10^5. Convex hull trick, divide-and-conquer, Knuth, or Aliens — the transition has structure and the structure is the speedup.',
    keyTechniques: ['convex hull trick', 'divide & conquer optimisation', 'Knuth optimisation', 'Lagrangian / Aliens trick'],
    prereqs: ['dp-linear', 'divide-conquer'],
    brief: {
      invariant:
        'Each optimisation is a claim about the transition: CHT needs the cost to be linear in the state; D&C needs the optimal split point to be monotone; Knuth needs the quadrangle inequality; Aliens needs the answer to be convex in the number of parts.',
      whenItFires:
        'You have a correct O(n^2) or O(n^2·k) DP and the constraints are one order of magnitude too large for it. The recurrence is right; the evaluation is not.',
      complexity: 'O(n log n) or O(n) depending on the technique',
      traps: [
        'Applying CHT without checking the slopes are monotone — otherwise it needs Li Chao or a fully dynamic hull.',
        'Assuming D&C optimisation applies. It needs opt[i] to be monotone in i, and that has to be argued, not hoped.',
        'The Aliens trick with ties — the binary search on the penalty needs care about which optimum it lands on.',
      ],
      links: [
        cp('Divide and conquer DP', 'https://cp-algorithms.com/dynamic_programming/divide-and-conquer-dp.html'),
        cp('Knuth optimisation', 'https://cp-algorithms.com/dynamic_programming/knuth-optimization.html'),
        cp('Convex hull trick & Li Chao tree', 'https://cp-algorithms.com/geometry/convex_hull_trick.html'),
      ],
    },
  },
  {
    slug: 'advanced-number-theory',
    name: 'CRT, Möbius & Multiplicative Functions',
    tier: 'master',
    quota: 11,
    blurb:
      'Counting with divisibility constraints: Euler phi, Möbius inversion, the Chinese remainder theorem, and linear sieves for any multiplicative function.',
    keyTechniques: ['Euler phi', 'Möbius function & inversion', 'Chinese remainder theorem', 'linear sieve'],
    prereqs: ['number-theory-basics', 'modular-arithmetic', 'combinatorics-basics'],
    brief: {
      invariant:
        'Möbius inversion converts "sum over multiples" into "sum over divisors with signs" — it is inclusion–exclusion over the divisor lattice, and that framing is what makes it usable.',
      whenItFires:
        'Counting pairs with gcd = 1 or gcd = k, sums of gcd over all pairs, or a system of congruences with different moduli.',
      complexity: 'Linear sieve O(n) · Möbius sums O(n log n) or O(n) with the right rearrangement',
      traps: [
        'CRT with non-coprime moduli. The general version exists and is a different formula.',
        'Overflow in CRT — the intermediate products exceed 64 bits well before the moduli do. Use __int128.',
        'Computing mu() per query rather than sieving it once.',
      ],
      links: [
        cp('Chinese remainder theorem', 'https://cp-algorithms.com/algebra/chinese-remainder-theorem.html'),
        cp('Euler totient function', 'https://cp-algorithms.com/algebra/phi-function.html'),
        cp('Linear sieve', 'https://cp-algorithms.com/algebra/prime-sieve-linear.html'),
        usaco('Extended Euclidean Algorithm', 'https://usaco.guide/adv/extend-euclid'),
      ],
    },
  },
  {
    slug: 'fft-ntt',
    name: 'FFT, NTT & Polynomials',
    tier: 'master',
    quota: 8,
    blurb:
      'Convolution in O(n log n). Once you see that "count pairs summing to k, for every k" is a polynomial product, a whole class of problems opens up.',
    keyTechniques: ['FFT', 'NTT mod 998244353', 'convolution as counting', 'polynomial inverse'],
    prereqs: ['modular-arithmetic', 'divide-conquer'],
    brief: {
      invariant:
        'The coefficient of x^k in A(x)·B(x) is the number of ways to pick i from A and j from B with i + j = k. Every FFT application is that sentence applied to a different pair of sequences.',
      whenItFires:
        '"For every k, count …" where the count is a sum over pairs; string matching with wildcards; or the modulus being 998244353 (which exists precisely because it is NTT-friendly).',
      complexity: 'O(n log n)',
      traps: [
        'FFT precision. With doubles, values above ~10^14 in the result lose accuracy — use NTT, or split the coefficients.',
        'Not padding to a power of two at least as large as the result length.',
        '998244353 works for NTT and 10^9+7 does not. If the statement gives the latter, you need three NTTs and CRT.',
      ],
      links: [cp('Fast Fourier transform', 'https://cp-algorithms.com/algebra/fft.html')],
    },
  },
  {
    slug: 'heavy-light',
    name: 'HLD & Tree Decompositions',
    tier: 'master',
    quota: 8,
    blurb:
      'Cut a tree into chains so any root-to-node path crosses O(log n) of them — then a segment tree over the chains answers path queries.',
    keyTechniques: ['heavy-light decomposition', 'Euler tour flattening', 'centroid decomposition', 'small-to-large on trees'],
    prereqs: ['lca-binary-lifting', 'lazy-segment-tree'],
    brief: {
      invariant:
        'Every vertex has at most one heavy child (the one with the largest subtree), so any root-to-leaf path changes chain at most log n times — because each change at least doubles the subtree size.',
      whenItFires:
        'Path updates and path queries on a tree, together. Subtree-only queries need just an Euler tour; it is the path half that forces HLD.',
      complexity: 'O(log^2 n) per path query with a segment tree over the chains',
      traps: [
        'Path queries with a non-commutative merge — the two halves of the path run in opposite directions and have to be combined in the right order.',
        'Including the LCA twice when combining the two upward walks.',
        'Reaching for HLD when centroid decomposition or an Euler tour is enough. It is the most code of the three.',
      ],
      links: [
        cp('Heavy-light decomposition', 'https://cp-algorithms.com/graph/hld.html'),
        usaco('Heavy-Light Decomposition', 'https://usaco.guide/plat/hld'),
      ],
    },
  },
  {
    slug: 'matrix-exponentiation',
    name: 'Matrix Exponentiation & Linear Recurrences',
    tier: 'master',
    quota: 8,
    blurb:
      'A linear recurrence evaluated at n = 10^18. Write the transition as a matrix and binary-exponentiate it.',
    keyTechniques: ['transition matrix', 'matrix power in O(k^3 log n)', 'path counting', 'Kitamasa / Berlekamp–Massey'],
    prereqs: ['modular-arithmetic', 'dp-linear'],
    brief: {
      invariant:
        'If the state vector at step i+1 is a fixed linear function of the state at step i, then the state at step n is M^n applied to the initial vector — and M^n is O(log n) multiplications.',
      whenItFires:
        'A DP with a small number of states and an enormous number of steps. n up to 10^18 with a recurrence is this pattern and essentially nothing else.',
      complexity: 'O(k^3 log n) for a k×k transition',
      traps: [
        'Building the transition matrix transposed. Multiply it out by hand for n = 1 and 2 before trusting it.',
        'Matrix multiplication without the mod inside the inner loop — 100 terms of 10^18 overflows.',
        'k^3 log n with k = 100 and n = 10^18 is 6·10^7 — fine; with k = 500 it is not.',
      ],
      links: [cp('Binary exponentiation — matrices', 'https://cp-algorithms.com/algebra/binary-exp.html')],
    },
  },

  // ─────────────────────────────── TIER 6 · ADVANCED ──────────────────────────
  {
    slug: 'geometry',
    name: 'Computational Geometry',
    tier: 'advanced',
    quota: 11,
    blurb:
      'Cross products, orientation, convex hulls and sweeps — with every calculation kept in integers for as long as it possibly can be.',
    keyTechniques: ['cross product & orientation', 'convex hull (Andrew monotone chain)', 'line intersection', 'rotating calipers', 'angular sweep'],
    prereqs: ['sorting-and-comparators', 'arithmetic-and-parity'],
    brief: {
      invariant:
        'The sign of the cross product (b-a) × (c-a) tells you whether c is left of, right of, or on the line ab. Nearly every geometry primitive is that one test.',
      whenItFires:
        'Points, polygons, lines, distances, areas. And any problem where sorting by angle around a point makes the structure obvious.',
      complexity: 'Convex hull O(n log n) · sweeps O(n log n)',
      traps: [
        'Floating point. Stay in integers — cross products, squared distances, doubled areas — and only convert at output.',
        'Cross products of coordinates up to 10^9 reach 10^18. long long is exactly enough; one more multiplication is not.',
        'Collinear points on the hull. Whether to keep them is a per-problem decision and the two answers differ.',
        'atan2 for angular sorting. It is slow and imprecise; sort by half-plane then by cross product.',
      ],
      links: [
        cp('Basic geometry', 'https://cp-algorithms.com/geometry/basic-geometry.html'),
        cp('Convex hull', 'https://cp-algorithms.com/geometry/convex-hull.html'),
        usaco('Geometry Primitives', 'https://usaco.guide/plat/geo-pri'),
      ],
    },
  },
  {
    slug: 'advanced-structures',
    name: 'Persistent & Advanced Structures',
    tier: 'advanced',
    quota: 8,
    blurb:
      'Persistent segment trees, treaps, Li Chao trees, DSU on tree. The structures you reach for when the standard ones cannot express the query.',
    keyTechniques: ['persistent segment tree', 'implicit treap', 'Li Chao tree', 'DSU on tree (small to large)'],
    prereqs: ['lazy-segment-tree', 'heavy-light'],
    brief: {
      invariant:
        'Persistence works because an update touches only O(log n) nodes — so a new version can share every untouched subtree with the old one, at O(log n) new nodes per version.',
      whenItFires:
        '"K-th smallest in a range", queries about historical versions, sequences with insert/erase in the middle, or a lower envelope of lines added in arbitrary order.',
      complexity: 'O(log n) per operation, O(n log n) memory for persistence',
      traps: [
        'Node pool sizing. n log n nodes at n = 2·10^5 is 4·10^6 — allocate up front, never with new per node.',
        'Treap with a fixed seed. Same hacking risk as fixed-modulus hashing.',
        'Reaching for persistence when an offline sort by query would do. It usually would.',
      ],
      links: [
        usaco('Sparse Segment Trees & persistence', 'https://usaco.guide/plat/sparse-seg'),
        usaco('Treaps', 'https://usaco.guide/adv/treaps'),
      ],
    },
  },
  {
    slug: 'randomization',
    name: 'Randomisation & Probabilistic Tricks',
    tier: 'advanced',
    quota: 8,
    blurb:
      'Random shuffles, random sampling and Zobrist hashing. When a deterministic solution is hard, a random one that fails with probability 10^-9 is a solution.',
    keyTechniques: ['random shuffle before a greedy', 'random sampling for majority elements', 'Zobrist hashing', 'Miller–Rabin'],
    prereqs: ['hashing-frequency', 'probability-expectation'],
    brief: {
      invariant:
        'If a single random trial succeeds with probability p, then k trials fail with probability (1-p)^k. Pick k so that number is below any threshold the judge could notice.',
      whenItFires:
        'Finding an element that appears in more than half a range; multiset equality; primality on 10^18; or any structure where a deterministic search is exponential but a random guess is usually right.',
      complexity: 'Varies — usually O(k · n) for k trials',
      traps: [
        'rand() on Codeforces. Its period is short and its low bits are poor. Use mt19937_64 seeded from chrono.',
        'A fixed seed. Anti-tests are written against exactly that.',
        'Not computing the failure probability. "Probably fine" is not an argument; (1/2)^30 is.',
      ],
      links: [
        cp('Primality tests — Miller–Rabin', 'https://cp-algorithms.com/algebra/primality_tests.html'),
        usaco('Hashmaps and anti-hash tests', 'https://usaco.guide/gold/hashmaps'),
      ],
    },
  },
];

/**
 * The seedable shape — `quota` is a curation instruction, not a document field,
 * so it is stripped here rather than being stored and never read.
 */
export const cpPatternDocs = CP_PATTERNS.map(({ quota, ...doc }, i) => ({
  ...doc,
  order: i + 1,
}));

export const CP_PATTERN_SLUGS = CP_PATTERNS.map((p) => p.slug);

export const quotaFor = (slug) => CP_PATTERNS.find((p) => p.slug === slug)?.quota ?? 8;
