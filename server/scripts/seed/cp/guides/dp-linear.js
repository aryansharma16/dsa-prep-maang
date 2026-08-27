import { code, cpp, h, java, link, links, p, table, tip, ul, warn } from '../../guides/blocks.js';

export default {
  patternSlug: 'dp-linear',
  title: 'Linear DP',
  summary:
    'One dimension, one pass. Define what dp[i] means in a sentence, and the transition usually writes itself.',
  blocks: [
    p(
      'Dynamic programming has a reputation for being hard that it mostly does not deserve at this level. What is hard is *stating the state* — writing down, in one unambiguous English sentence, what `dp[i]` holds. Once that sentence exists, the transition is nearly mechanical and the base case follows from the sentence too. Every genuinely confusing DP bug I have seen traces back to a state that quietly meant two different things.',
    ),
    p(
      'The other half is the constraint that makes it work: `dp[i]` must be computable without knowing anything about indices past `i`. If your transition needs the future, the state is wrong — not the loop, not the indices, the state. Redefining it is the fix; adding a second pass usually is not.',
    ),
    p(
      'Linear DP — one index, O(1) or O(k) work per step — covers a large share of 1400–1800. It is worth being fluent here before touching trees or bitmasks, because those are the same discipline with a more complicated index.',
    ),

    h('When to reach for it'),
    ul(
      'Count the ways, or find the best, over a sequence.',
      'Each element is taken, skipped, or grouped with its neighbours, and choices interact only locally.',
      'A greedy feels right but you can construct a case where an early choice ruins a later one.',
      'Constraints around n ≤ 10^5 with O(n) or O(n log n) needed, or n ≤ 5000 with O(n^2) allowed.',
      'The answer for the first `i` elements is a natural stepping stone to the answer for `i + 1`.',
    ),

    h('Write the sentence first'),
    p(
      'Not a slogan — a procedure. Before typing anything, complete this: "`dp[i]` is the ___ considering only the first `i` elements, where ___." If you cannot fill both blanks, you do not have a state yet and writing the loop will not give you one.',
    ),
    table(
      ['Problem', 'The sentence'],
      [
        ['Max sum, no two adjacent', '`dp[i]` = best sum from the first i elements, i-th free to use or not.'],
        ['Count ways to climb stairs', '`dp[i]` = number of ways to reach step i.'],
        ['Longest increasing subsequence', '`dp[i]` = length of the longest increasing subsequence ending exactly at i.'],
        ['Min cost to reach the end', '`dp[i]` = cheapest way to arrive at position i.'],
        ['Max subarray sum (Kadane)', '`dp[i]` = best sum of a subarray ending exactly at i.'],
      ],
    ),
    tip(
      'Notice how often the sentence says "ending exactly at i" rather than "in the first i". Those are different states with different transitions, and picking the wrong one is the most common way a DP becomes unnecessarily hard. "Ending exactly at i" usually makes the transition local; "in the first i" usually makes it a max over everything.',
    ),

    h('The shape'),
    p(
      'House robber, because it is the smallest problem where the state genuinely matters. `dp[i]` is the best you can do from the first `i` houses; you either skip house `i` or take it and add `dp[i-2]`.',
    ),
    code(
      java(`
// dp[i] = best total from the first i houses (1-indexed input).
long rob(int[] a) {
    int n = a.length;
    long[] dp = new long[n + 1];
    dp[0] = 0;                                 // no houses: nothing
    dp[1] = a[0];                              // one house: take it
    for (int i = 2; i <= n; i++) {
        dp[i] = Math.max(dp[i - 1],            // skip house i
                         dp[i - 2] + a[i - 1]); // take it
    }
    return dp[n];
}
      `),
      cpp(`
long long rob(vector<int>& a) {
    int n = a.size();
    vector<long long> dp(n + 1, 0);
    dp[0] = 0;
    dp[1] = a[0];
    for (int i = 2; i <= n; i++)
        dp[i] = max(dp[i - 1], dp[i - 2] + a[i - 1]);
    return dp[n];
}
      `),
    ),
    warn(
      'Base cases decide everything downstream, and the right value depends on what you are computing. For a *count*, `dp[0] = 1` — there is exactly one way to do nothing. For a *sum or max*, `dp[0] = 0`. For a minimisation where "impossible" matters, `dp[0] = 0` and everything else starts at infinity. Mixing these up shifts every value in the array by a constant, or by a factor.',
    ),

    h('Multiple states per index'),
    p(
      'When one number per index is not enough, use several. This is not a different technique — it is the same DP with the state widened, and it is nearly always the right move when you find yourself wanting to look backwards more than a couple of steps.',
    ),
    code(
      java(`
// Best profit with at most one stock holding at a time.
// hold[i]  = best balance at day i while holding a share
// free[i]  = best balance at day i while holding nothing
long maxProfit(int[] price) {
    long hold = Long.MIN_VALUE / 4, free = 0;
    for (int p : price) {
        long prevHold = hold, prevFree = free;
        hold = Math.max(prevHold, prevFree - p);   // keep holding, or buy today
        free = Math.max(prevFree, prevHold + p);   // stay out, or sell today
    }
    return free;                                   // never end holding
}
      `),
      cpp(`
long long maxProfit(vector<int>& price) {
    long long hold = LLONG_MIN / 4, free = 0;
    for (int p : price) {
        long long prevHold = hold, prevFree = free;
        hold = max(prevHold, prevFree - p);
        free = max(prevFree, prevHold + p);
    }
    return free;
}
      `),
    ),
    warn(
      'Both new values are computed from the *previous* pair. Writing `hold = max(hold, free - p)` and then using the updated `hold` on the next line silently allows buying and selling on the same day. Snapshot the previous row, or update in an order where that cannot happen.',
    ),

    h('Rolling the array'),
    p(
      'When `dp[i]` depends only on the last few entries, keep only those. It is a constant-factor memory win on 1D and the difference between fitting and not fitting on 2D — but the loop direction becomes load-bearing the moment the array is reused.',
    ),
    code(
      java(`
// Fibonacci-shaped recurrence with O(1) memory.
long ways(int n) {
    long prev2 = 1, prev1 = 1;                 // dp[0] = dp[1] = 1
    for (int i = 2; i <= n; i++) {
        long cur = prev1 + prev2;
        prev2 = prev1;
        prev1 = cur;
    }
    return prev1;
}
      `),
      cpp(`
long long ways(int n) {
    long long prev2 = 1, prev1 = 1;
    for (int i = 2; i <= n; i++) {
        long long cur = prev1 + prev2;
        prev2 = prev1;
        prev1 = cur;
    }
    return prev1;
}
      `),
    ),
    tip(
      'The rule for in-place rolling: if the transition reads a *smaller* index, iterate downwards; if it reads a *larger* one, iterate upwards. Getting it backwards does not crash — it solves a different problem, which is exactly the 0/1-versus-unbounded knapsack distinction.',
    ),

    h('Speeding up a transition'),
    p(
      'An O(n^2) DP where the inner loop is a max or a sum over a range is often an O(n log n) DP with a data structure in the middle. Longest increasing subsequence is the standard example: the O(n^2) version scans all earlier indices, and the O(n log n) version binary searches a maintained array instead.',
    ),
    code(
      java(`
// LIS in O(n log n). tails[k] = smallest possible tail of an increasing
// subsequence of length k + 1. tails is always sorted, so it can be searched.
int lis(int[] a) {
    ArrayList<Integer> tails = new ArrayList<>();
    for (int x : a) {
        int lo = 0, hi = tails.size();
        while (lo < hi) {                      // first index with tails[i] >= x
            int mid = (lo + hi) >>> 1;
            if (tails.get(mid) >= x) hi = mid; else lo = mid + 1;
        }
        if (lo == tails.size()) tails.add(x);
        else                    tails.set(lo, x);
    }
    return tails.size();
}
      `),
      cpp(`
int lis(vector<int>& a) {
    vector<int> tails;
    for (int x : a) {
        // lower_bound for strictly increasing; upper_bound for non-decreasing.
        auto it = lower_bound(tails.begin(), tails.end(), x);
        if (it == tails.end()) tails.push_back(x);
        else                   *it = x;
    }
    return (int)tails.size();
}
      `),
    ),
    warn(
      '`tails` is not the LIS. It has the right *length* and generally the wrong contents — reconstructing the actual subsequence needs a parent array recorded alongside. Printing `tails` as the answer is a classic and confusing mistake.',
    ),

    h('Common traps'),
    table(
      ['Symptom', 'Cause'],
      [
        ['Off by a constant factor', 'Wrong base case — `dp[0] = 0` where a count needs 1.'],
        ['State means two things', 'No sentence written down. Write it, then re-derive.'],
        ['Reads a value not yet computed', 'Transition depends on the future. Redefine the state.'],
        ['Rolling array gives the wrong answer', 'Wrong loop direction for an in-place update.'],
        ['Overflow', '`int` dp array. Counts and sums both need 64 bits.'],
        ['TLE at O(n^2)', 'Inner loop is a range max or sum — replace it with a structure.'],
        ['Cannot reconstruct the answer', 'No parent array recorded during the forward pass.'],
        ['Multi-state DP allows an illegal move', 'Using an updated value where the previous one was needed.'],
      ],
    ),

    h('Complexity'),
    p(
      'O(states × transition). Linear DP is O(n) states with an O(1) transition, or O(n^2) when the transition scans backwards. Memory is O(n), or O(1) with rolling. The useful instinct: count the states first — if `states × transition` exceeds about 10^8, either the transition needs a data structure or the state itself is wrong.',
    ),

    links(
      link('Introduction to DP — USACO Guide', 'https://usaco.guide/gold/intro-dp'),
      link('Paths on Grids — USACO Guide', 'https://usaco.guide/gold/dp-paths'),
      link('Range DP — USACO Guide', 'https://usaco.guide/gold/dp-ranges'),
    ),
  ],
};
