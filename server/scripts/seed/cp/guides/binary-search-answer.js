import { code, cpp, h, java, link, links, p, table, tip, ul, warn } from '../../guides/blocks.js';

export default {
  patternSlug: 'binary-search-answer',
  title: 'Binary Search on the Answer',
  summary:
    'Stop searching for the answer and start testing it. If "is X achievable?" is monotone in X, the answer is a binary search over a check function.',
  blocks: [
    p(
      'Most people meet binary search as "find a value in a sorted array" and never quite escape that framing. In competitive programming the useful form is different and far more common: you are asked to minimise or maximise something, you have no idea how to construct the optimum directly, but given a candidate answer you can *check* whether it works. That check is the algorithm. The binary search is four lines of boilerplate around it.',
    ),
    p(
      'The requirement is monotonicity, and it is worth stating precisely. There must be a threshold `T` such that `check(x)` is false for every `x < T` and true for every `x ≥ T` (or the mirror image). If that holds, the search space is sorted — not the input, the *answers* — and you can halve it every step. If it does not hold, binary search returns a number that looks plausible and is wrong, which is much worse than failing loudly.',
    ),
    p(
      'The phrasing in the statement is usually a giveaway. "Minimise the maximum", "maximise the minimum", "the smallest k such that", "the least time in which all of this can be done" — those are nearly a guarantee. Once you have seen fifteen of these the recognition becomes instant, which is exactly why this pattern is worth grinding at 1400 rather than waiting to meet it at 1900.',
    ),

    h('When to reach for it'),
    ul(
      'The statement asks for a minimum maximum, a maximum minimum, or "the smallest/largest X such that…".',
      'The answer is a single number in a range you can bound, and verifying a candidate is easier than constructing the optimum.',
      'Constraints look like n ≤ 10^5 and answers up to 10^9 or 10^18 — the log factor is free, the linear check is the budget.',
      'A greedy feels right but you cannot decide the parameter it needs. Binary search the parameter.',
      'Real-valued answers with a required precision, e.g. "print with absolute error at most 10^-6".',
    ),
    tip(
      'The check before the code: pick two candidate answers, one small and one large, and ask whether `check` could possibly be true for the small one and false for the large one. If you can construct such a case, the predicate is not monotone and this pattern does not apply.',
    ),

    h('The template'),
    p(
      'One template, used every time. Half-open bounds, `while (lo < hi)`, `hi = mid` on success and `lo = mid + 1` on failure. It converges on the first `x` for which `check(x)` is true, with no special cases and no post-loop adjustment.',
    ),
    code(
      java(`
// Smallest x in [lo, hi] with check(x) == true.
// Precondition: check is monotone false...false,true...true, and check(hi) is true.
long lo = 1, hi = 1_000_000_000L;
while (lo < hi) {
    long mid = lo + (hi - lo) / 2;      // NOT (lo + hi) / 2 — overflows
    if (check(mid)) hi = mid;           // mid might BE the answer — keep it
    else            lo = mid + 1;       // mid is ruled out — discard it
}
// lo == hi == the answer
      `),
      cpp(`
long long lo = 1, hi = 1e9;
while (lo < hi) {
    long long mid = lo + (hi - lo) / 2;
    if (check(mid)) hi = mid;
    else            lo = mid + 1;
}
// lo == hi == the answer
      `),
    ),
    warn(
      'The asymmetry is load-bearing. `hi = mid` (not `mid - 1`) because `mid` may itself be the answer; `lo = mid + 1` (not `mid`) because `mid` is ruled out and `lo = mid` never shrinks the range — the loop hangs forever. Any template that assigns `mid` to both bounds will hang on some input. If your submission times out on test 1 with a trivially small case, this is why.',
    ),
    p(
      'For the maximising direction — largest `x` with `check(x)` true — do not write a second template from scratch. Search for the smallest `x` where `check(x)` is *false* and subtract one, or negate the predicate. Two templates in your head is one template too many under contest pressure.',
    ),

    h('A worked example'),
    p(
      'The canonical shape: split an array into at most `k` contiguous parts, minimising the largest part sum. Constructing the optimal split is fiddly; checking a candidate is a five-line greedy.',
    ),
    code(
      java(`
// Can we split a[] into at most k parts, each with sum <= cap?
boolean check(int[] a, int k, long cap) {
    int parts = 1;
    long current = 0;
    for (int x : a) {
        if (x > cap) return false;      // one element alone exceeds the cap
        if (current + x > cap) { parts++; current = 0; }
        current += x;
    }
    return parts <= k;
}

long solve(int[] a, int k) {
    long lo = 0, hi = 0;
    for (int x : a) { lo = Math.max(lo, x); hi += x; }   // tightest valid bounds
    while (lo < hi) {
        long mid = lo + (hi - lo) / 2;
        if (check(a, k, mid)) hi = mid;
        else                  lo = mid + 1;
    }
    return lo;
}
      `),
      cpp(`
bool check(vector<int>& a, int k, long long cap) {
    int parts = 1;
    long long current = 0;
    for (int x : a) {
        if (x > cap) return false;
        if (current + x > cap) { parts++; current = 0; }
        current += x;
    }
    return parts <= k;
}

long long solve(vector<int>& a, int k) {
    long long lo = 0, hi = 0;
    for (int x : a) { lo = max(lo, (long long)x); hi += x; }
    while (lo < hi) {
        long long mid = lo + (hi - lo) / 2;
        if (check(a, k, mid)) hi = mid;
        else                  lo = mid + 1;
    }
    return lo;
}
      `),
    ),
    tip(
      'Note the bounds: `lo` starts at the largest element (no cap below that can ever work) and `hi` at the total (one part always works). Tight bounds are not an optimisation here — a `lo` that is too low is harmless, but a `hi` for which `check(hi)` is false breaks the precondition and the search returns nonsense.',
    ),

    h('Real-valued answers'),
    p(
      'When the answer is a real number, `lo < hi` never terminates — floating-point values keep having a midpoint. Run a fixed number of iterations instead. A hundred halvings takes any starting range below any precision a problem will ask for, and it is a hundred iterations of a cheap loop, so there is nothing to tune.',
    ),
    code(
      java(`
double lo = 0, hi = 1e9;
for (int iter = 0; iter < 100; iter++) {    // fixed count — never while (lo < hi)
    double mid = (lo + hi) / 2;
    if (check(mid)) hi = mid;
    else            lo = mid;               // NOT mid + 1 — this is a real number
}
System.out.printf("%.9f%n", lo);
      `),
      cpp(`
double lo = 0, hi = 1e9;
for (int iter = 0; iter < 100; iter++) {
    double mid = (lo + hi) / 2;
    if (check(mid)) hi = mid;
    else            lo = mid;
}
printf("%.9f\\n", lo);
      `),
    ),
    warn(
      'Do not mix the two. `lo = mid + 1` on a double search is a bug that produces a plausible answer off by up to 1, and `while (fabs(hi - lo) > 1e-9)` can spin forever when the range cannot be halved further in floating point.',
    ),

    h('Where it hides'),
    table(
      ['Statement says', 'Binary search on'],
      [
        ['Minimum time to finish all tasks', 'The time. Check: can everything finish by T?'],
        ['Maximum minimum distance between k points', 'The distance. Check: can we place k points that far apart?'],
        ['Smallest capacity to ship in D days', 'The capacity. Check: does it fit in D days?'],
        ['Largest k with at least m subarrays of length k', 'k. Check: count the qualifying subarrays.'],
        ['Median of a huge implicit set', 'The value. Check: how many elements are ≤ x?'],
        ['Kth smallest in a sorted matrix', 'The value, not the index. Check: count entries ≤ x.'],
      ],
    ),
    p(
      'The last two are the ones worth internalising. Whenever a problem asks for the k-th smallest of something you cannot materialise, binary search the *value* and count how many things are at most that value. Counting is almost always easy; enumerating is almost always impossible.',
    ),

    h('Common traps'),
    table(
      ['Symptom', 'Cause'],
      [
        ['Infinite loop on a tiny input', '`lo = mid` in an integer search. Must be `mid + 1`.'],
        ['Wrong by exactly one', 'Searching for the wrong boundary — first-true vs last-true.'],
        ['Wrong answer, no obvious bug', 'Predicate is not actually monotone. Verify before coding.'],
        ['Overflow on large ranges', '`(lo + hi) / 2` with both near 10^18. Use `lo + (hi - lo) / 2`.'],
        ['TLE', '`check` is O(n log n) inside an O(log A) search. Get `check` to O(n).'],
        ['Nonsense answer at the top of the range', '`check(hi)` is false — the upper bound is not valid.'],
        ['Hangs on a double search', '`while (lo < hi)` on floating point. Use a fixed 100 iterations.'],
      ],
    ),

    h('Complexity'),
    p(
      'O(log(hi − lo)) calls to `check`, so the total is the cost of `check` times about 30 for a range up to 10^9, or 60 up to 10^18. The log is never the problem. If you are getting TLE, the check is too slow — that is the only thing to optimise here.',
    ),

    links(
      link('Binary Search — USACO Guide', 'https://usaco.guide/silver/binary-search'),
      link('Binary search — cp-algorithms', 'https://cp-algorithms.com/num_methods/binary_search.html'),
      link('Ternary search — cp-algorithms', 'https://cp-algorithms.com/num_methods/ternary_search.html'),
    ),
  ],
};
