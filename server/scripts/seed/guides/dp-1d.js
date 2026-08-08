import { code, cpp, h, java, link, links, p, table, tip, ul, warn } from './blocks.js';

export default {
  patternSlug: 'dp-1d',
  title: '1-D Dynamic Programming',
  summary: 'Define what dp[i] means in one sentence. If you cannot, the recurrence will not come.',
  blocks: [
    p(
      'Dynamic programming is recursion that stops repeating itself. The naive recursive solution to Fibonacci recomputes fib(3) an exponential number of times; writing down each answer the first time you compute it collapses that to a linear walk. Everything else in this pattern is bookkeeping around that one idea.',
    ),
    p(
      'The part that actually decides whether you solve the problem is the definition of the state. Say precisely what dp[i] means, as an English sentence, before writing anything: "dp[i] is the maximum amount robbable from the first i houses" or "dp[i] is true if the first i characters can be segmented". A vague definition produces a recurrence you cannot justify and off-by-one errors you cannot find. A sharp one usually makes the recurrence obvious.',
    ),
    p(
      'Once the state is fixed, there are three questions left, always the same three. What is the base case? How does dp[i] follow from smaller indices? And in what order must you fill the table so the values you read are already computed? Answer those and the code writes itself.',
    ),

    h('When to reach for it'),
    ul(
      'The problem asks for a maximum, minimum, count, or yes/no over choices — not the choices themselves.',
      'A greedy choice can be shown to fail, but the problem still decomposes into smaller versions of itself.',
      'The recursive solution has overlapping subproblems — the same arguments recur down different branches.',
      '"In how many ways", "minimum number of", "longest such that" over a linear sequence.',
      'Constraints around n ≤ 10^4 with an exponential brute force.',
    ),
    warn(
      'If the problem wants the actual list of solutions rather than a count or an optimum, that is backtracking. DP compresses the search space precisely by forgetting how it got there.',
    ),

    h('The core idea'),
    p(
      'Climbing stairs is the smallest complete example. dp[i] is the number of distinct ways to reach step i. To be on step i you arrived from i−1 or i−2, so the ways add.',
    ),
    code(
      java(`
// dp[i] = number of distinct ways to reach step i
public int climbStairs(int n) {
    if (n <= 2) return n;
    int[] dp = new int[n + 1];
    dp[1] = 1;                      // base cases
    dp[2] = 2;
    for (int i = 3; i <= n; i++) {
        dp[i] = dp[i - 1] + dp[i - 2];      // arrived from one below or two below
    }
    return dp[n];
}
      `),
      cpp(`
int climbStairs(int n) {
    if (n <= 2) return n;
    vector<int> dp(n + 1);
    dp[1] = 1;
    dp[2] = 2;
    for (int i = 3; i <= n; i++) dp[i] = dp[i-1] + dp[i-2];
    return dp[n];
}
      `),
    ),
    p(
      'Rolling variables. When dp[i] only looks back a fixed distance, the array is waste — keep the two values you need and slide them. This is the O(n) time, O(1) space version interviewers ask for as a follow-up, and it is mechanical once the recurrence is written.',
    ),
    code(
      java(`
public int climbStairs(int n) {
    int twoBack = 1, oneBack = 2;
    if (n <= 2) return n;
    for (int i = 3; i <= n; i++) {
        int current = oneBack + twoBack;
        twoBack = oneBack;
        oneBack = current;
    }
    return oneBack;
}
      `),
      cpp(`
int climbStairs(int n) {
    if (n <= 2) return n;
    int twoBack = 1, oneBack = 2;
    for (int i = 3; i <= n; i++) {
        int current = oneBack + twoBack;
        twoBack = oneBack;
        oneBack = current;
    }
    return oneBack;
}
      `),
    ),
    tip(
      'Write the tabulation first, get it correct, then compress to rolling variables. Trying to write the compressed version directly is how people end up with variables updated in the wrong order.',
    ),

    h('Variations'),
    p(
      'House robber — the decide-or-skip shape. At each element you either take it (and give up the previous one) or skip it (and keep whatever the previous state was). Most 1-D DP problems are a variation of this single recurrence.',
    ),
    code(
      java(`
// dp[i] = most money robbable from houses 0..i-1
public int rob(int[] nums) {
    int prev = 0, curr = 0;      // prev = dp[i-2], curr = dp[i-1]
    for (int money : nums) {
        int take = prev + money;     // rob this one, skipping the neighbour
        int skip = curr;             // leave it, keep the running best
        prev = curr;
        curr = Math.max(take, skip);
    }
    return curr;
}
      `),
      cpp(`
int rob(vector<int>& nums) {
    int prev = 0, curr = 0;
    for (int money : nums) {
        int take = prev + money;
        int skip = curr;
        prev = curr;
        curr = max(take, skip);
    }
    return curr;
}
      `),
    ),
    p(
      'Unbounded choice — coin change. The state is the amount, and the transition tries every coin. Note the direction of the loops: iterating amounts outward and coins inward counts combinations with repetition, which is what "fewest coins" needs.',
    ),
    code(
      java(`
// dp[a] = fewest coins summing to exactly a
public int coinChange(int[] coins, int amount) {
    int[] dp = new int[amount + 1];
    Arrays.fill(dp, amount + 1);      // sentinel: bigger than any real answer
    dp[0] = 0;                        // zero coins make zero

    for (int a = 1; a <= amount; a++) {
        for (int coin : coins) {
            if (coin <= a) dp[a] = Math.min(dp[a], dp[a - coin] + 1);
        }
    }
    return dp[amount] > amount ? -1 : dp[amount];
}
      `),
      cpp(`
int coinChange(vector<int>& coins, int amount) {
    vector<int> dp(amount + 1, amount + 1);
    dp[0] = 0;
    for (int a = 1; a <= amount; a++) {
        for (int coin : coins) {
            if (coin <= a) dp[a] = min(dp[a], dp[a - coin] + 1);
        }
    }
    return dp[amount] > amount ? -1 : dp[amount];
}
      `),
    ),
    warn(
      'Using Integer.MAX_VALUE as the unreachable sentinel then writing dp[a - coin] + 1 overflows to a negative number, and the min silently picks it. Use amount + 1 — large enough to lose every comparison, small enough not to wrap.',
    ),
    p(
      'Longest increasing subsequence. The O(n²) version is the honest DP: dp[i] is the length of the best subsequence ending at i, and you look back at every smaller index. There is an O(n log n) version using binary search over a "tails" array — worth knowing exists, worth writing only if asked.',
    ),
    code(
      java(`
// dp[i] = length of the LIS that ENDS at index i
public int lengthOfLIS(int[] nums) {
    int[] dp = new int[nums.length];
    Arrays.fill(dp, 1);                    // every element alone is a subsequence
    int best = 1;

    for (int i = 1; i < nums.length; i++) {
        for (int j = 0; j < i; j++) {
            if (nums[j] < nums[i]) dp[i] = Math.max(dp[i], dp[j] + 1);
        }
        best = Math.max(best, dp[i]);
    }
    return best;
}
      `),
    ),
    p(
      'Memoisation, when the recurrence is easier to see top-down. Same complexity, different shape: write the recursion you would write anyway and cache the answers. Useful when the state space is sparse or the iteration order is awkward to work out.',
    ),
    code(
      java(`
private Integer[] memo;

public int solve(int i) {
    if (i < 0) return 0;                    // base case
    if (memo[i] != null) return memo[i];    // already computed
    return memo[i] = Math.max(solve(i - 1), solve(i - 2) + nums[i]);
}
      `),
      cpp(`
vector<int> memo;   // -1 = not computed

int solve(int i) {
    if (i < 0) return 0;
    if (memo[i] != -1) return memo[i];
    return memo[i] = max(solve(i - 1), solve(i - 2) + nums[i]);
}
      `),
    ),

    h('Language toolkit'),
    table(
      ['Java', 'What it does', 'C++ equivalent'],
      [
        ['new int[n + 1]', 'Zero-filled table with room for the base case.', 'vector<int> dp(n + 1, 0)'],
        ['Arrays.fill(dp, v)', 'Initialise to a sentinel.', 'vector<int> dp(n, v)'],
        ['Integer[] memo', 'null means "not computed" — no magic number.', 'vector<int> memo(n, -1)'],
        ['Math.max / Math.min', 'The transition.', 'max / min'],
        ['Boolean[] / boolean[]', 'Yes/no DP such as word break.', 'vector<bool>'],
        ['long[] dp', 'When counts overflow int.', 'vector<long long>'],
        ['dp[i] % 1_000_000_007', 'Modulo for count problems.', 'dp[i] % 1000000007'],
      ],
    ),
    tip(
      'Integer[] with null rather than int[] with a sentinel is worth the boxing in memoisation: it makes "not yet computed" unambiguous, which matters when 0 or −1 is a legitimate answer.',
    ),

    h('Complexity'),
    table(
      ['Problem', 'Time', 'Space', 'Note'],
      [
        ['Climbing stairs / Fibonacci', 'O(n)', 'O(1)', 'Rolling variables.'],
        ['House robber', 'O(n)', 'O(1)', 'Two variables suffice.'],
        ['Coin change', 'O(n · amount)', 'O(amount)', 'n = number of coin types.'],
        ['Word break', 'O(n² · L)', 'O(n)', 'L = dictionary lookup cost.'],
        ['LIS, tabulation', 'O(n²)', 'O(n)', 'The one to write under pressure.'],
        ['LIS, patience sorting', 'O(n log n)', 'O(n)', 'Binary search over tails.'],
        ['Naive recursion', 'O(2^n)', 'O(n)', 'What memoisation removes.'],
      ],
    ),
    p(
      'The general shape: time is the number of states times the cost per transition, and space is the number of states — before compression. Saying it that way makes the analysis fall out of the definition instead of needing to be guessed.',
    ),

    h('Common mistakes'),
    ul(
      'Starting to code before defining dp[i] in words. Nearly every DP failure traces back to this.',
      'Off-by-one between "the first i elements" and "ending at index i". They are different definitions with different base cases — pick one deliberately.',
      'Wrong base case. dp[0] must be the identity for whatever you are combining: 0 for sums, 1 for products or counts, true for reachability.',
      'Filling the table in an order that reads values not yet written.',
      'Using Integer.MAX_VALUE as a sentinel and overflowing when you add to it.',
      'Compressing to rolling variables before the tabulated version is correct, then updating them in the wrong order.',
      'Forgetting the modulo in counting problems, so the answer silently overflows.',
      'Reaching for DP when a greedy sweep is provably correct — it works, but it is more code and slower.',
    ),

    links(
      link('LeetCode Explore — Dynamic Programming', 'https://leetcode.com/explore/learn/card/dynamic-programming/'),
      link('Java Arrays — API reference', 'https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/Arrays.html'),
    ),
  ],
};
