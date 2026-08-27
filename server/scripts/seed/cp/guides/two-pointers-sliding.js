import { code, cpp, h, java, link, links, p, table, tip, ul, warn } from '../../guides/blocks.js';

export default {
  patternSlug: 'two-pointers-sliding',
  title: 'Two Pointers & Sliding Window',
  summary:
    'When the right end moving forward can never force the left end backwards, both walk the array once and the whole thing is O(n).',
  blocks: [
    p(
      'Two pointers is what you get when you notice that a nested loop never needs to go backwards. The outer loop advances `r`; the inner loop advances `l`; and crucially, when `r` moves forward, the correct `l` never moves back. Each pointer therefore travels the length of the array exactly once, and an O(n^2) scan collapses to O(n) — without a clever data structure, just an observation about the problem.',
    ),
    p(
      'That observation has a name: monotonicity of the window. If `[l, r]` is a valid window, then `[l+1, r]` must also be valid. Shrinking never breaks validity. That is the property to check before you write the loop, because when it does not hold — and with negative numbers it often does not — two pointers produces a wrong answer silently, with no crash and no obvious symptom.',
    ),
    p(
      'The pattern splits into two shapes that look different and are the same idea. Opposite ends, walking inwards, on sorted or symmetric data. And a sliding window, both pointers walking forwards, maintaining some property of the elements between them.',
    ),

    h('When to reach for it'),
    ul(
      'Longest or shortest contiguous subarray with some property.',
      'Count pairs in a sorted array with a given sum or difference.',
      '"At most K distinct" — and therefore "exactly K", as f(K) − f(K−1).',
      'The naive solution is two nested loops over the same array and the constraint is 10^5 or more.',
      'Merging two sorted sequences, or partitioning an array in place.',
    ),
    warn(
      'The killer precondition: all values non-negative, for the sum-based windows. With negatives, extending the window can *decrease* the sum, so "shrink until valid" is not well-defined and the window is not monotone. Those problems are prefix sums plus a map, not two pointers.',
    ),

    h('Sliding window: the template'),
    p(
      'One loop, `r` advancing every iteration, `l` catching up. The `while` — never an `if` — is the part people get wrong: one removal is not always enough to restore validity.',
    ),
    code(
      java(`
// Longest subarray with sum <= K. Non-negative values.
int longestAtMost(int[] a, long K) {
    int best = 0, l = 0;
    long sum = 0;
    for (int r = 0; r < a.length; r++) {
        sum += a[r];                       // extend
        while (sum > K) {                  // while, NOT if
            sum -= a[l];
            l++;
        }
        best = Math.max(best, r - l + 1);  // window [l, r] is valid here
    }
    return best;
}
      `),
      cpp(`
int longestAtMost(vector<int>& a, long long K) {
    int best = 0, l = 0;
    long long sum = 0;
    for (int r = 0; r < (int)a.size(); r++) {
        sum += a[r];
        while (sum > K) { sum -= a[l]; l++; }
        best = max(best, r - l + 1);
    }
    return best;
}
      `),
    ),
    tip(
      'Each element enters the window once and leaves once, so the inner `while` runs at most n times *in total* across the whole outer loop. That is why a nested loop here is still O(n) — an amortised argument, not a bound on the inner loop alone.',
    ),

    h('Windows with a counter'),
    p(
      'When the property is about *distinct* values rather than a sum, the window carries a frequency map. The shape is identical; only the "is it valid" test and the add/remove operations change.',
    ),
    code(
      java(`
// Longest subarray with at most K distinct values.
int atMostKDistinct(int[] a, int K) {
    HashMap<Integer, Integer> freq = new HashMap<>();
    int best = 0, l = 0;
    for (int r = 0; r < a.length; r++) {
        freq.merge(a[r], 1, Integer::sum);
        while (freq.size() > K) {
            int leaving = a[l++];
            // Remove the key entirely at zero, or size() counts dead entries.
            if (freq.merge(leaving, -1, Integer::sum) == 0) freq.remove(leaving);
        }
        best = Math.max(best, r - l + 1);
    }
    return best;
}
      `),
      cpp(`
int atMostKDistinct(vector<int>& a, int K) {
    map<int,int> freq;
    int best = 0, l = 0;
    for (int r = 0; r < (int)a.size(); r++) {
        freq[a[r]]++;
        while ((int)freq.size() > K) {
            int leaving = a[l++];
            if (--freq[leaving] == 0) freq.erase(leaving);
        }
        best = max(best, r - l + 1);
    }
    return best;
}
      `),
    ),
    warn(
      'Erasing at zero is mandatory, not tidiness. A key left at count 0 still counts towards `size()`, so the window thinks it holds more distinct values than it does and shrinks forever. This is the classic silent bug in this template.',
    ),
    tip(
      'The "exactly K" trick: `exactly(K) = atMost(K) - atMost(K - 1)`. Counting windows with exactly K distinct values directly is fiddly; counting "at most" is the template above, and the subtraction is free. This turns up constantly at 1500–1700.',
    ),

    h('Opposite ends'),
    p(
      'On sorted data, start at both ends and let the comparison decide which side moves. Each step eliminates one element from consideration permanently, which is where the linear bound comes from.',
    ),
    code(
      java(`
// Count pairs (i < j) with a[i] + a[j] <= K, on a sorted array.
long countPairs(int[] a, long K) {
    Arrays.sort(a);
    long count = 0;
    int l = 0, r = a.length - 1;
    while (l < r) {
        if ((long) a[l] + a[r] <= K) {
            // Every index between l+1 and r pairs with l and also works.
            count += r - l;
            l++;
        } else {
            r--;
        }
    }
    return count;
}
      `),
      cpp(`
long long countPairs(vector<int> a, long long K) {
    sort(a.begin(), a.end());
    long long count = 0;
    int l = 0, r = (int)a.size() - 1;
    while (l < r) {
        if ((long long)a[l] + a[r] <= K) { count += r - l; l++; }
        else r--;
    }
    return count;
}
      `),
    ),
    p(
      'The `count += r - l` line is the whole trick and the place to slow down. If `a[l] + a[r]` works, then `a[l]` paired with anything from `l+1` up to `r` also works, because the array is sorted — that is `r - l` pairs counted in one step rather than one at a time.',
    ),

    h('Recognising the shape'),
    table(
      ['Statement', 'Shape'],
      [
        ['Longest subarray with sum ≤ K, values ≥ 0', 'Forward window, shrink while invalid.'],
        ['Shortest subarray with sum ≥ K, values ≥ 0', 'Forward window, shrink while *still* valid.'],
        ['At most / exactly K distinct', 'Forward window with a frequency map.'],
        ['Pairs summing to K in a sorted array', 'Opposite ends.'],
        ['Container with most water', 'Opposite ends, move the smaller side.'],
        ['Subarray sum equals K, values can be negative', 'NOT this pattern — prefix sums plus a hash map.'],
        ['Minimum window containing all of T', 'Forward window with a "how many still missing" counter.'],
      ],
    ),

    h('Common traps'),
    table(
      ['Symptom', 'Cause'],
      [
        ['Wrong answer with negative numbers', 'Window is not monotone. Use prefix sums plus a map.'],
        ['Window shrinks to nothing', '`if` instead of `while`, or a frequency key left at 0.'],
        ['Off by one in the window length', '`r - l + 1` for inclusive bounds — not `r - l`.'],
        ['Counting each pair twice', 'Loop covers both orders. Enforce `l < r`.'],
        ['Overflow in the sum', 'Window sum in `int`. 10^5 values of 10^9 is 10^14.'],
        ['O(n^2) after all', 'Recomputing the window property from scratch instead of incrementally.'],
        ['Forgot to sort', 'Opposite-ends only works on sorted data.'],
      ],
    ),

    h('Complexity'),
    p(
      'O(n) for the window itself; O(n log n) if a sort is needed first, or if the window carries an ordered map rather than a hash map. Memory is O(1) for sum-based windows and O(distinct values) when a frequency map is involved.',
    ),

    links(
      link('Two Pointers — USACO Guide', 'https://usaco.guide/silver/two-pointers'),
      link('Sliding Window — USACO Guide', 'https://usaco.guide/gold/sliding-window'),
      link('Hashmaps and their pitfalls — USACO Guide', 'https://usaco.guide/gold/hashmaps'),
    ),
  ],
};
