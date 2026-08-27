import { code, cpp, h, java, link, links, p, table, tip, ul, warn } from '../../guides/blocks.js';

export default {
  patternSlug: 'dp-knapsack',
  title: 'Knapsack & Subset Sums',
  summary:
    'Items with weights and values, and a capacity. The template every "choose a subset with a budget" problem reduces to.',
  blocks: [
    p(
      'Knapsack is worth learning as a *template* rather than as a problem, because an unusual number of statements are it in disguise. Anything of the form "choose some of these things, subject to a budget, optimising something" is knapsack. So is "can we make sum S from this multiset", which is knapsack with values thrown away and only reachability kept.',
    ),
    p(
      'The whole family turns on one line: the direction of the capacity loop. Iterate capacity downwards and each item is used at most once; iterate upwards and it can be reused freely. Those two loops differ by a single character and solve genuinely different problems, and getting it backwards produces a confident wrong answer rather than a crash.',
    ),

    h('When to reach for it'),
    ul(
      'A capacity, budget, or total in the constraints, and items each usable a bounded number of times.',
      '"Can we make exactly S" from a multiset of numbers.',
      'Partition into two halves with equal (or closest) sums.',
      'Counting the number of subsets with a given sum.',
      'Constraints where n × capacity is around 10^7 or less. That product is the whole feasibility test.',
    ),
    warn(
      'If the capacity is up to 10^9, this is not knapsack — the table cannot exist. That constraint is the statement telling you the intended solution is a greedy, a meet-in-the-middle, or a mathematical characterisation. Read the capacity bound before reaching for a table.',
    ),

    h('0/1 knapsack'),
    p(
      'Each item once. The 1D form is the one to memorise; the capacity loop runs downwards so that `dp[w - weight]` still refers to the state *before* this item was considered.',
    ),
    code(
      java(`
// Max value with total weight <= W, each item usable once.
int knapsack01(int[] weight, int[] value, int W) {
    int[] dp = new int[W + 1];                 // dp[w] = best value at capacity w
    for (int i = 0; i < weight.length; i++) {
        for (int w = W; w >= weight[i]; w--) { // DOWNWARDS — each item once
            dp[w] = Math.max(dp[w], dp[w - weight[i]] + value[i]);
        }
    }
    return dp[W];
}
      `),
      cpp(`
int knapsack01(vector<int>& weight, vector<int>& value, int W) {
    vector<int> dp(W + 1, 0);
    for (int i = 0; i < (int)weight.size(); i++)
        for (int w = W; w >= weight[i]; w--)   // DOWNWARDS
            dp[w] = max(dp[w], dp[w - weight[i]] + value[i]);
    return dp[W];
}
      `),
    ),
    p(
      'Why downwards: `dp[w - weight[i]]` must not already include item `i`. Going downwards, every index below `w` is still holding its value from the previous item, so reading it is reading the "without item i" state. Going upwards, it has already been updated with item `i` — which is precisely the unbounded case.',
    ),

    h('Unbounded knapsack'),
    p(
      'Same table, same line, loop reversed. Each item may be used any number of times, which is exactly what reading an already-updated `dp[w - weight[i]]` expresses.',
    ),
    code(
      java(`
// Unlimited copies of each item.
int knapsackUnbounded(int[] weight, int[] value, int W) {
    int[] dp = new int[W + 1];
    for (int i = 0; i < weight.length; i++) {
        for (int w = weight[i]; w <= W; w++) { // UPWARDS — reuse allowed
            dp[w] = Math.max(dp[w], dp[w - weight[i]] + value[i]);
        }
    }
    return dp[W];
}
      `),
      cpp(`
int knapsackUnbounded(vector<int>& weight, vector<int>& value, int W) {
    vector<int> dp(W + 1, 0);
    for (int i = 0; i < (int)weight.size(); i++)
        for (int w = weight[i]; w <= W; w++)   // UPWARDS
            dp[w] = max(dp[w], dp[w - weight[i]] + value[i]);
    return dp[W];
}
      `),
    ),
    tip(
      'One reliable way to catch a direction bug: test with a single item of weight 1 and value 1, and capacity 5. The 0/1 answer is 1; the unbounded answer is 5. It takes ten seconds and catches the mistake immediately.',
    ),

    h('Counting, not maximising'),
    p(
      'The same recurrence with `max` replaced by `+` counts subsets instead of optimising them. Note the base case: `dp[0] = 1`, because there is exactly one way to make a sum of zero — take nothing.',
    ),
    code(
      java(`
// Number of subsets summing to exactly S, modulo MOD.
long countSubsets(int[] a, int S, long MOD) {
    long[] dp = new long[S + 1];
    dp[0] = 1;                                 // one way to make nothing
    for (int x : a)
        for (int s = S; s >= x; s--)           // downwards: each element once
            dp[s] = (dp[s] + dp[s - x]) % MOD;
    return dp[S];
}
      `),
      cpp(`
long long countSubsets(vector<int>& a, int S, long long MOD) {
    vector<long long> dp(S + 1, 0);
    dp[0] = 1;
    for (int x : a)
        for (int s = S; s >= x; s--)
            dp[s] = (dp[s] + dp[s - x]) % MOD;
    return dp[S];
}
      `),
    ),
    warn(
      'An element equal to 0 breaks the "each element once" argument for counting — it can be included or not without changing the sum, so the count doubles per zero. Handle zeros separately (multiply the answer by 2^zeros) rather than letting them into the loop.',
    ),

    h('Reachability with a bitset'),
    p(
      'When you only need to know *whether* a sum is reachable, the value array collapses to a bit per sum, and the whole item step becomes one shift-and-or. That is a 64× constant-factor win and it is the difference between passing and not at n·S near 10^9.',
    ),
    code(
      java(`
// Which sums are reachable, using java.util.BitSet.
BitSet reachable(int[] a, int S) {
    BitSet dp = new BitSet(S + 1);
    dp.set(0);
    for (int x : a) {
        // shifted = dp << x, then OR back in. One pass per item.
        BitSet shifted = new BitSet(S + 1);
        for (int i = dp.nextSetBit(0); i >= 0 && i + x <= S; i = dp.nextSetBit(i + 1)) {
            shifted.set(i + x);
        }
        dp.or(shifted);
    }
    return dp;
}
      `),
      cpp(`
// C++ std::bitset makes this a one-liner per item, and it is genuinely 64x.
const int MAXS = 100005;
bitset<MAXS> reachable(vector<int>& a) {
    bitset<MAXS> dp;
    dp[0] = 1;
    for (int x : a) dp |= dp << x;             // the whole item step
    return dp;
}
      `),
    ),
    tip(
      'The C++ `dp |= dp << x` idiom is worth memorising outright. Subset-sum reachability at n = 100, S = 10^5 is 10^7 bit-operations — about 150,000 word operations — and runs in milliseconds.',
    ),

    h('Bounded knapsack'),
    p(
      'Each item available `k` times. Expanding it into `k` copies is correct and is O(n·k·W), which is hopeless when `k` is large. Binary splitting fixes it: replace `k` copies with copies of size 1, 2, 4, 8, … and a remainder. Any count from 0 to `k` is then a subset of those, and there are only log k of them.',
    ),
    code(
      java(`
// k copies of an item -> log(k) virtual items, then run 0/1 knapsack.
void addBounded(List<int[]> items, int weight, int value, int k) {
    for (int chunk = 1; k > 0; chunk <<= 1) {
        int take = Math.min(chunk, k);
        items.add(new int[]{weight * take, value * take});
        k -= take;
    }
}
      `),
      cpp(`
void addBounded(vector<pair<int,int>>& items, int weight, int value, int k) {
    for (int chunk = 1; k > 0; chunk <<= 1) {
        int take = min(chunk, k);
        items.push_back({weight * take, value * take});
        k -= take;
    }
}
      `),
    ),
    p(
      'The `min(chunk, k)` and the trailing remainder are what make every count from 0 to k representable. Dropping the remainder — using only exact powers of two — leaves some counts unreachable, and the resulting answer is wrong only on inputs where the optimum needed one of them.',
    ),

    h('The variants, at a glance'),
    table(
      ['Problem', 'Change from 0/1'],
      [
        ['Unbounded', 'Capacity loop upwards.'],
        ['Count subsets', '`max` becomes `+`, and `dp[0] = 1`.'],
        ['Exactly S, not at most', 'Initialise to −infinity except `dp[0] = 0`.'],
        ['Reachability only', 'Drop values; use a bitset.'],
        ['Bounded (k copies)', 'Binary-split into log k virtual items.'],
        ['Partition into equal halves', 'Reachability at S = total/2, odd total is instantly no.'],
        ['Minimum coins for S', '`max` becomes `min`, init to infinity, `dp[0] = 0`.'],
      ],
    ),

    h('Common traps'),
    table(
      ['Symptom', 'Cause'],
      [
        ['Items reused when they should not be', 'Capacity loop going upwards.'],
        ['Items not reused when they should be', 'Capacity loop going downwards.'],
        ['Counts are one too many, or zero', 'Wrong `dp[0]` — 1 to count, 0 to sum.'],
        ['"At most" answer where "exactly" was asked', 'Initialised all to 0 instead of −infinity.'],
        ['Memory limit exceeded', '2D table where the 1D rolling form works.'],
        ['TLE with k copies', 'Expanding into k items instead of binary splitting.'],
        ['Wrong with zero-weight items', 'Zeros double the count; handle them outside the loop.'],
        ['Overflow', 'Value sums in `int`. Counts especially need 64 bits or a modulus.'],
      ],
    ),

    h('Complexity'),
    table(
      ['Variant', 'Time', 'Memory'],
      [
        ['0/1 and unbounded', 'O(n · W)', 'O(W)'],
        ['Bounded, binary split', 'O(n · log k · W)', 'O(W)'],
        ['Reachability with a bitset', 'O(n · W / 64)', 'O(W / 8) bytes'],
        ['With reconstruction', 'O(n · W)', 'O(n · W) — the 2D table is needed'],
      ],
    ),
    p(
      'The last row is the one that catches people. Reconstructing *which* items were chosen needs the full 2D table, so the O(W) memory trick is unavailable — check whether the problem actually asks for the set before optimising memory away.',
    ),

    links(
      link('Knapsack DP — USACO Guide', 'https://usaco.guide/gold/knapsack'),
      link('Introduction to DP — USACO Guide', 'https://usaco.guide/gold/intro-dp'),
    ),
  ],
};
