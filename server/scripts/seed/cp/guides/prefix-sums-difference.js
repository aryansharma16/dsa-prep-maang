import { code, cpp, h, java, link, links, p, table, tip, ul, warn } from '../../guides/blocks.js';

export default {
  patternSlug: 'prefix-sums-difference',
  title: 'Prefix Sums & Difference Arrays',
  summary:
    'Precompute running totals so any range query is one subtraction — and run it backwards so any range update is two writes.',
  blocks: [
    p(
      'Prefix sums are the cheapest trick in competitive programming and the one that shows up in the most disguises. The whole idea is a single identity: if `pre[i]` is the sum of the first `i` elements, then the sum of any range `l..r` is `pre[r] - pre[l-1]`. One subtraction, O(1), for as many queries as you like. Build it once in O(n) and every range-sum question in the problem becomes free.',
    ),
    p(
      'The difference array is the same identity read from the other end, and it is the half people forget. If you need to add `v` to every element of a range — many times — you do not touch the range at all. You write `d[l] += v` and `d[r+1] -= v`, and after every update you take one prefix sum of `d` to recover the final array. n updates and one pass, instead of n range walks.',
    ),
    p(
      'Between them these two cover a surprising amount of ground: range sums, range adds, counting overlapping intervals, 2D submatrix sums, and — once you notice that a prefix sum of a boolean array is a count — "how many elements in `l..r` satisfy P".',
    ),

    h('When to reach for it'),
    ul(
      'Many range-sum queries and no updates between them. That is prefix sums, exactly.',
      'Many range updates and all the queries at the end. That is a difference array, exactly.',
      'Counting how many intervals cover each point — the classic difference-array problem in disguise.',
      'A 2D grid with repeated "sum of this submatrix" questions.',
      '"How many indices in l..r have value x" — build one prefix array per distinct value when the alphabet is small.',
    ),
    warn(
      'If updates and queries *interleave*, this pattern is the wrong answer and a Fenwick tree is the right one. The moment the statement says "after each update, print the sum", stop reaching for prefix sums.',
    ),

    h('The core idea'),
    p(
      'Size the prefix array `n + 1` and 1-index it. This is not a style preference — it is what makes the `l = 0` case disappear instead of needing a guard, and the guard is where the bug lives.',
    ),
    code(
      java(`
// pre[i] = sum of a[0..i-1]. pre[0] = 0 is the empty prefix.
long[] pre = new long[n + 1];
for (int i = 0; i < n; i++) pre[i + 1] = pre[i] + a[i];

// Sum of a[l..r], both inclusive, 0-indexed input:
long rangeSum(long[] pre, int l, int r) {
    return pre[r + 1] - pre[l];      // no special case for l == 0
}
      `),
      cpp(`
// pre[i] = sum of a[0..i-1]. pre[0] = 0 is the empty prefix.
vector<long long> pre(n + 1, 0);
for (int i = 0; i < n; i++) pre[i + 1] = pre[i] + a[i];

long long rangeSum(const vector<long long>& pre, int l, int r) {
    return pre[r + 1] - pre[l];
}
      `),
    ),
    warn(
      'Use `long long` / `long` for the prefix array, always. n up to 2·10^5 with values up to 10^9 gives a sum of 2·10^14, which overflows a 32-bit int at about element 3. The array being `int` is the single most common cause of a prefix-sum solution failing on test 3 with no visible logic error.',
    ),

    h('The difference array'),
    p(
      'Range update in O(1), read the whole array back in O(n) at the end. The `r + 1` write is why the array is sized `n + 1` — otherwise the last update runs off the end.',
    ),
    code(
      java(`
long[] d = new long[n + 2];          // n + 2 so d[r + 1] is always in range

void rangeAdd(long[] d, int l, int r, long v) {
    d[l] += v;
    d[r + 1] -= v;
}

// After every update, one pass recovers the real array:
long[] finalArray(long[] d, int n) {
    long[] a = new long[n];
    long running = 0;
    for (int i = 0; i < n; i++) { running += d[i]; a[i] = running; }
    return a;
}
      `),
      cpp(`
vector<long long> d(n + 2, 0);

void rangeAdd(vector<long long>& d, int l, int r, long long v) {
    d[l] += v;
    d[r + 1] -= v;
}

vector<long long> finalArray(vector<long long>& d, int n) {
    vector<long long> a(n);
    long long running = 0;
    for (int i = 0; i < n; i++) { running += d[i]; a[i] = running; }
    return a;
}
      `),
    ),
    tip(
      'The classic application: given n intervals, find how many cover each point. `rangeAdd(l, r, 1)` for each, then one prefix pass. It is O(n + m) where the obvious solution is O(n·m), and it turns up in Div. 2 B constantly.',
    ),

    h('Two dimensions'),
    p(
      'The 2D version is inclusion–exclusion. Building it and querying it use the same four terms with the signs swapped, which is a useful thing to notice because it means if you get one right you can derive the other.',
    ),
    code(
      java(`
// P[i][j] = sum of the submatrix (0,0)..(i-1,j-1)
long[][] P = new long[n + 1][m + 1];
for (int i = 0; i < n; i++)
    for (int j = 0; j < m; j++)
        P[i + 1][j + 1] = g[i][j] + P[i][j + 1] + P[i + 1][j] - P[i][j];

// Sum of (r1,c1)..(r2,c2), all inclusive, 0-indexed:
long submatrix(long[][] P, int r1, int c1, int r2, int c2) {
    return P[r2 + 1][c2 + 1] - P[r1][c2 + 1] - P[r2 + 1][c1] + P[r1][c1];
}
      `),
      cpp(`
vector<vector<long long>> P(n + 1, vector<long long>(m + 1, 0));
for (int i = 0; i < n; i++)
    for (int j = 0; j < m; j++)
        P[i + 1][j + 1] = g[i][j] + P[i][j + 1] + P[i + 1][j] - P[i][j];

long long submatrix(vector<vector<long long>>& P, int r1, int c1, int r2, int c2) {
    return P[r2 + 1][c2 + 1] - P[r1][c2 + 1] - P[r2 + 1][c1] + P[r1][c1];
}
      `),
    ),
    warn(
      'The `+ P[r1][c1]` term is the one people drop. The top-left block gets subtracted twice — once by each of the two middle terms — so it has to be added back exactly once. If your 2D sums are wrong by exactly the value of one corner block, this is why.',
    ),

    h('Prefix sums with a hash map'),
    p(
      'The combination that solves "count subarrays with sum k". Walk the array keeping the running sum; at each position, the number of subarrays ending here with sum `k` is the number of earlier prefixes equal to `running - k`. A map of prefix counts answers that in O(1) per step.',
    ),
    code(
      java(`
// Number of subarrays with sum exactly k. Works with negatives.
long countSubarrays(int[] a, long k) {
    HashMap<Long, Integer> seen = new HashMap<>();
    seen.put(0L, 1);                     // the empty prefix — do not omit this
    long running = 0, count = 0;
    for (int x : a) {
        running += x;
        count += seen.getOrDefault(running - k, 0);
        seen.merge(running, 1, Integer::sum);
    }
    return count;
}
      `),
      cpp(`
long long countSubarrays(vector<int>& a, long long k) {
    map<long long, int> seen;
    seen[0] = 1;                          // the empty prefix
    long long running = 0, count = 0;
    for (int x : a) {
        running += x;
        auto it = seen.find(running - k);
        if (it != seen.end()) count += it->second;
        seen[running]++;
    }
    return count;
}
      `),
    ),
    warn(
      'On Codeforces, prefer `map` or a randomly-seeded `unordered_map` here. A plain `unordered_map<long long, int>` has a deterministic hash and is routinely hacked to O(n^2) — the anti-test is a known, published construction.',
    ),
    tip(
      'Two variants worth recognising as the same problem. Subarrays with sum divisible by k: key the map on `running mod k` instead of on `running` (and normalise negatives with `((running % k) + k) % k`). Subarrays with equal counts of two values: map one to +1 and the other to −1, then count subarrays with sum 0.',
    ),

    h('Common traps'),
    table(
      ['Symptom', 'Cause'],
      [
        ['Wrong answer on large inputs only', '`int` prefix array. Use `long long` / `long`.'],
        ['Off-by-one at the start of the array', '0-indexed prefix array. Size it n+1 and 1-index it.'],
        ['2D sums off by one corner block', 'Missing the `+ P[r1][c1]` inclusion–exclusion term.'],
        ['Difference array crashes on the last update', 'Array sized n, not n+1. `d[r+1]` runs off the end.'],
        ['Negative results under a modulus', '`(pre[r] - pre[l] + MOD) % MOD` — subtraction can go below zero.'],
        ['TLE with a correct algorithm', 'Rebuilding the prefix array inside the query loop.'],
        ['Hacked on Codeforces', 'Unseeded `unordered_map`. Randomise the hash or use `map`.'],
      ],
    ),

    h('Complexity'),
    table(
      ['Operation', 'Prefix sums', 'Difference array'],
      [
        ['Build', 'O(n)', 'O(n)'],
        ['Range query', 'O(1)', 'O(n) — only at the end'],
        ['Range update', 'O(n) — rebuild', 'O(1)'],
        ['Point update', 'O(n) — rebuild', 'O(1)'],
        ['Memory', 'O(n)', 'O(n)'],
      ],
    ),
    p(
      'The table is the whole decision. If the problem is read-heavy, prefix sums; write-heavy with reads at the end, difference array; both interleaved, neither — go and read the Fenwick tree guide.',
    ),

    links(
      link('Prefix Sums — USACO Guide', 'https://usaco.guide/silver/prefix-sums'),
      link('More on Prefix Sums — USACO Guide', 'https://usaco.guide/gold/PURS'),
      link('Fenwick Tree — cp-algorithms', 'https://cp-algorithms.com/data_structures/fenwick.html'),
    ),
  ],
};
