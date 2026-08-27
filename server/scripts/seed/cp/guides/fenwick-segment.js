import { code, cpp, h, java, link, links, p, table, tip, ul, warn } from '../../guides/blocks.js';

export default {
  patternSlug: 'fenwick-segment',
  title: 'Fenwick & Segment Trees',
  summary:
    'Point update, range query, both in O(log n). The workhorse structure of everything above 1600.',
  blocks: [
    p(
      'Prefix sums answer range queries in O(1) and cannot handle an update. Rebuilding on every update is O(n). Fenwick and segment trees sit between: O(log n) for both, which is what you need the moment a problem interleaves updates and queries — and above 1600, most of them do.',
    ),
    p(
      'The idea behind both is the same. Each node owns a contiguous range and stores the merge of its children; any query range decomposes into O(log n) such nodes. That is where the bound comes from, and it is also the constraint on what these structures can do: the merge must be associative, or the decomposition is meaningless.',
    ),
    p(
      'Pick between them on capability, not taste. A Fenwick tree is half the code and twice the speed, and it does prefix aggregates of *invertible* operations — sums, XOR — because a range query is the difference of two prefixes. Range minimum has no inverse, so it needs a segment tree. Start with Fenwick; reach for the segment tree when Fenwick cannot express the operation.',
    ),

    h('When to reach for it'),
    ul(
      'Updates and queries interleave. This is the defining signal.',
      'Counting inversions, or "how many elements smaller than x have I seen".',
      'Range minimum, maximum, sum, gcd, or "count of values in a range" after compression.',
      'A problem that becomes a prefix count once the input is sorted.',
      'Sweep-line problems where a structure is updated as the sweep advances.',
    ),
    warn(
      'If there are no updates at all, do not reach for these. Prefix sums (O(1) queries) or a sparse table (O(1) range minimum) are both faster and shorter. These structures are the price of mutability.',
    ),

    h('Fenwick tree'),
    p(
      'Twenty lines, and worth writing from memory. The trick is `i & -i`, which isolates the lowest set bit — that is the size of the range node `i` is responsible for, and adding or subtracting it walks the tree.',
    ),
    code(
      java(`
class Fenwick {
    private final long[] t;
    private final int n;

    Fenwick(int n) { this.n = n; this.t = new long[n + 1]; }   // 1-INDEXED

    void add(int i, long delta) {                // i is 1-based
        for (; i <= n; i += i & -i) t[i] += delta;
    }

    long prefix(int i) {                         // sum of 1..i
        long s = 0;
        for (; i > 0; i -= i & -i) s += t[i];
        return s;
    }

    long range(int l, int r) { return prefix(r) - prefix(l - 1); }
}
      `),
      cpp(`
struct Fenwick {
    int n;
    vector<long long> t;
    Fenwick(int n) : n(n), t(n + 1, 0) {}        // 1-INDEXED

    void add(int i, long long delta) {
        for (; i <= n; i += i & -i) t[i] += delta;
    }
    long long prefix(int i) {
        long long s = 0;
        for (; i > 0; i -= i & -i) s += t[i];
        return s;
    }
    long long range(int l, int r) { return prefix(r) - prefix(l - 1); }
};
      `),
    ),
    warn(
      'A Fenwick tree is 1-indexed and cannot be made 0-indexed. `add(0, x)` is an infinite loop, not an off-by-one: `0 & -0` is 0, so `i += 0` never advances. If your submission hangs on the first test, this is why. Shift 0-indexed input by one on the way in.',
    ),
    p(
      'The canonical application: counting inversions. Sweep left to right, and for each element ask how many already-seen elements are greater than it.',
    ),
    code(
      java(`
// Number of pairs i < j with a[i] > a[j]. Values compressed to 1..n.
long inversions(int[] a, int maxValue) {
    Fenwick fw = new Fenwick(maxValue);
    long count = 0;
    for (int i = 0; i < a.length; i++) {
        // Already-seen values strictly greater than a[i].
        count += fw.range(a[i] + 1, maxValue);
        fw.add(a[i], 1);
    }
    return count;
}
      `),
      cpp(`
long long inversions(vector<int>& a, int maxValue) {
    Fenwick fw(maxValue);
    long long count = 0;
    for (int x : a) {
        count += fw.range(x + 1, maxValue);
        fw.add(x, 1);
    }
    return count;
}
      `),
    ),
    tip(
      'When values are up to 10^9 but n is only 2·10^5, compress first: sort the distinct values, and replace each value by its rank. The structure is then sized n rather than 10^9. Forgetting to deduplicate before ranking leaves gaps and is the usual bug in compression.',
    ),

    h('Segment tree'),
    p(
      'The iterative bottom-up form. It is shorter than the recursive version, has no `4n` sizing trap, and is fast — the whole tree is one array of `2n`, leaves at `n..2n-1`, and every internal node is the merge of its two children.',
    ),
    code(
      java(`
class SegTree {
    private final int n;
    private final long[] t;
    private static final long IDENTITY = Long.MIN_VALUE;   // for max

    private static long merge(long a, long b) { return Math.max(a, b); }

    SegTree(long[] a) {
        n = a.length;
        t = new long[2 * n];
        System.arraycopy(a, 0, t, n, n);                   // leaves
        for (int i = n - 1; i > 0; i--) t[i] = merge(t[2 * i], t[2 * i + 1]);
    }

    void set(int i, long value) {                          // 0-based
        for (t[i += n] = value; i > 1; i >>= 1)
            t[i >> 1] = merge(t[i], t[i ^ 1]);
    }

    // Half-open [l, r). Ask for [l, r+1) if your bounds are inclusive.
    long query(int l, int r) {
        long res = IDENTITY;
        for (l += n, r += n; l < r; l >>= 1, r >>= 1) {
            if ((l & 1) != 0) res = merge(res, t[l++]);
            if ((r & 1) != 0) res = merge(res, t[--r]);
        }
        return res;
    }
}
      `),
      cpp(`
struct SegTree {
    int n;
    vector<long long> t;
    static const long long IDENTITY = LLONG_MIN;           // for max

    static long long merge(long long a, long long b) { return max(a, b); }

    SegTree(vector<long long>& a) : n(a.size()), t(2 * a.size()) {
        copy(a.begin(), a.end(), t.begin() + n);
        for (int i = n - 1; i > 0; i--) t[i] = merge(t[2 * i], t[2 * i + 1]);
    }

    void set(int i, long long value) {
        for (t[i += n] = value; i > 1; i >>= 1)
            t[i >> 1] = merge(t[i], t[i ^ 1]);
    }

    long long query(int l, int r) {                        // half-open [l, r)
        long long res = IDENTITY;
        for (l += n, r += n; l < r; l >>= 1, r >>= 1) {
            if (l & 1) res = merge(res, t[l++]);
            if (r & 1) res = merge(res, t[--r]);
        }
        return res;
    }
};
      `),
    ),
    warn(
      'Change the merge and you must change the identity with it. Sum pairs with 0, max with negative infinity, min with positive infinity, gcd with 0, and product with 1. An identity left at 0 under a `max` merge silently clamps every negative answer to zero — which passes any test whose answer happens to be positive.',
    ),
    warn(
      'The merge must be associative, or the decomposition into O(log n) nodes is not well-defined and the structure returns confident nonsense. Subtraction and "the second largest" are not associative; sum, min, max, gcd, XOR and matrix product are.',
    ),

    h('Choosing between them'),
    table(
      ['Need', 'Fenwick', 'Segment tree'],
      [
        ['Prefix / range sum', 'Yes — ideal', 'Yes'],
        ['Range min / max', 'No — not invertible', 'Yes'],
        ['Range gcd', 'No', 'Yes'],
        ['Point update', 'Yes', 'Yes'],
        ['Range update, point query', 'Yes — build it over a difference array', 'Yes'],
        ['Range update, range query', 'Two Fenwicks, or awkward', 'Yes, with lazy propagation'],
        ['Descend to find a position', 'Possible, fiddly', 'Natural'],
        ['Lines of code', '~15', '~35'],
        ['Constant factor', 'Very small', 'About 2-3× Fenwick'],
      ],
    ),
    p(
      'The practical rule: use a Fenwick tree if it can express the operation, because it is shorter to write correctly under time pressure. Go to the segment tree the moment you need a non-invertible merge, and to lazy propagation the moment updates span ranges as well.',
    ),

    h('Range update, point query'),
    p(
      'A Fenwick tree over a *difference array* handles this without any extra machinery. `add(l, v)` and `add(r + 1, −v)`, and the value at position `i` is the prefix sum up to `i` — the same identity as a plain difference array, made updatable.',
    ),
    code(
      java(`
// Range add, point read — one ordinary Fenwick over the differences.
Fenwick fw = new Fenwick(n);

void rangeAdd(Fenwick fw, int l, int r, long v) {
    fw.add(l, v);
    if (r + 1 <= n) fw.add(r + 1, -v);
}

long pointValue(Fenwick fw, int i) { return fw.prefix(i); }
      `),
      cpp(`
Fenwick fw(n);

void rangeAdd(Fenwick& fw, int l, int r, long long v) {
    fw.add(l, v);
    if (r + 1 <= fw.n) fw.add(r + 1, -v);
}

long long pointValue(Fenwick& fw, int i) { return fw.prefix(i); }
      `),
    ),

    h('Common traps'),
    table(
      ['Symptom', 'Cause'],
      [
        ['Hangs on the first test', 'Fenwick `add(0, …)`. It is 1-indexed.'],
        ['Negative answers clamped to 0', 'Wrong identity for the merge.'],
        ['Wrong answers, structure looks right', 'Non-associative merge function.'],
        ['Array index out of bounds', 'Recursive segment tree sized 2n instead of 4n.'],
        ['Off by one on every query', 'Half-open vs inclusive bounds. Pick one and write it down.'],
        ['Overflow', '`int` tree over 10^5 values of 10^9.'],
        ['Memory limit exceeded', 'Compressing values would have avoided a 10^9-sized tree.'],
        ['Range min gives garbage', 'Used a Fenwick tree. Min is not invertible.'],
      ],
    ),

    h('Complexity'),
    table(
      ['Operation', 'Fenwick', 'Segment tree'],
      [
        ['Build', 'O(n log n), or O(n) in place', 'O(n)'],
        ['Point update', 'O(log n)', 'O(log n)'],
        ['Range query', 'O(log n)', 'O(log n)'],
        ['Range update (lazy)', 'n/a', 'O(log n)'],
        ['Memory', 'n + 1', '2n iterative, 4n recursive'],
      ],
    ),

    links(
      link('Fenwick Tree — cp-algorithms', 'https://cp-algorithms.com/data_structures/fenwick.html'),
      link('Segment Tree — cp-algorithms', 'https://cp-algorithms.com/data_structures/segment_tree.html'),
      link('Efficient and easy segment trees — Codeforces', 'https://codeforces.com/blog/entry/18051'),
      link('Point Update Range Sum — USACO Guide', 'https://usaco.guide/gold/PURS'),
    ),
  ],
};
