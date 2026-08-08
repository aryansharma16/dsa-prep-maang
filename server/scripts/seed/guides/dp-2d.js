import { code, cpp, h, java, link, links, p, table, tip, ul, warn } from './blocks.js';

export default {
  patternSlug: 'dp-2d',
  title: '2-D Dynamic Programming',
  summary: 'Two changing inputs means a grid — strings against strings, items against capacity.',
  blocks: [
    p(
      'One-dimensional DP works when a single index describes where you are. The moment two things vary independently — a position in string A and a position in string B, or which items you have considered and how much capacity is left — you need a state with two coordinates, and the table becomes a grid.',
    ),
    p(
      'That is genuinely the only change. Everything from 1-D carries over: define the state in a sentence, find the recurrence, get the base cases right, fill in an order that respects dependencies. The new difficulty is that the fill order now has two directions, and the answer is not always in the corner you expect.',
    ),
    p(
      'Three families cover most of what gets asked. Two strings compared character by character — edit distance, longest common subsequence. Items against a budget — the knapsack family, including subset-sum and partition problems that do not look like knapsack until you squint. And paths through a grid, which is the most literal case since the DP table has the same shape as the input.',
    ),

    h('When to reach for it'),
    ul(
      'Two sequences compared against each other — subsequences, edit operations, interleaving.',
      'Choosing a subset of items subject to a numeric budget, capacity or target sum.',
      'Counting or optimising paths through a grid with obstacles or costs.',
      'A 1-D DP where you find yourself needing a second piece of state to make the recurrence work.',
      'Palindrome problems over substrings, where the state is a range (i, j).',
    ),

    h('The core idea'),
    p(
      'Longest common subsequence is the archetype for the string family. dp[i][j] is the LCS length of the first i characters of A and the first j of B. The extra row and column of zeros are the empty-prefix base cases, and they remove every boundary check from the loop.',
    ),
    code(
      java(`
// dp[i][j] = LCS of a[0..i-1] and b[0..j-1]
public int longestCommonSubsequence(String a, String b) {
    int m = a.length(), n = b.length();
    int[][] dp = new int[m + 1][n + 1];      // row/col 0 = empty prefix, all zeros

    for (int i = 1; i <= m; i++) {
        for (int j = 1; j <= n; j++) {
            if (a.charAt(i - 1) == b.charAt(j - 1)) {
                dp[i][j] = dp[i - 1][j - 1] + 1;              // match: take it
            } else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);  // drop one side
            }
        }
    }
    return dp[m][n];
}
      `),
      cpp(`
int longestCommonSubsequence(string a, string b) {
    int m = a.size(), n = b.size();
    vector<vector<int>> dp(m + 1, vector<int>(n + 1, 0));

    for (int i = 1; i <= m; i++) {
        for (int j = 1; j <= n; j++) {
            if (a[i-1] == b[j-1]) dp[i][j] = dp[i-1][j-1] + 1;
            else                  dp[i][j] = max(dp[i-1][j], dp[i][j-1]);
        }
    }
    return dp[m][n];
}
      `),
    ),
    warn(
      'The index shift is where these go wrong. dp[i][j] talks about the first i characters, so the character it refers to is at index i − 1. Mixing the two conventions in one loop produces answers that are right on some inputs and wrong on others.',
    ),
    p(
      'Edit distance is the same grid with three transitions instead of two, and base cases that are no longer zero: turning a prefix into an empty string costs one deletion per character.',
    ),
    code(
      java(`
public int minDistance(String a, String b) {
    int m = a.length(), n = b.length();
    int[][] dp = new int[m + 1][n + 1];

    for (int i = 0; i <= m; i++) dp[i][0] = i;    // delete every character
    for (int j = 0; j <= n; j++) dp[0][j] = j;    // insert every character

    for (int i = 1; i <= m; i++) {
        for (int j = 1; j <= n; j++) {
            if (a.charAt(i - 1) == b.charAt(j - 1)) {
                dp[i][j] = dp[i - 1][j - 1];                 // free
            } else {
                dp[i][j] = 1 + Math.min(dp[i - 1][j - 1],    // replace
                              Math.min(dp[i - 1][j],         // delete
                                       dp[i][j - 1]));       // insert
            }
        }
    }
    return dp[m][n];
}
      `),
    ),

    h('Variations'),
    p(
      '0/1 knapsack. State is (items considered, capacity used). Each item is taken once or not at all. The 1-D compression is the classic trick, and it depends entirely on iterating capacity downward — going upward would let the same item be taken twice.',
    ),
    code(
      java(`
// Full 2-D form: dp[i][c] = best value using the first i items within capacity c
public int knapsack(int[] weights, int[] values, int capacity) {
    int n = weights.length;
    int[][] dp = new int[n + 1][capacity + 1];

    for (int i = 1; i <= n; i++) {
        for (int c = 0; c <= capacity; c++) {
            dp[i][c] = dp[i - 1][c];                       // skip item i
            if (weights[i - 1] <= c) {                     // or take it
                dp[i][c] = Math.max(dp[i][c],
                                    dp[i - 1][c - weights[i - 1]] + values[i - 1]);
            }
        }
    }
    return dp[n][capacity];
}

// Compressed to one row — capacity descends so each item is used at most once
public int knapsack1D(int[] weights, int[] values, int capacity) {
    int[] dp = new int[capacity + 1];
    for (int i = 0; i < weights.length; i++) {
        for (int c = capacity; c >= weights[i]; c--) {     // DOWNWARD
            dp[c] = Math.max(dp[c], dp[c - weights[i]] + values[i]);
        }
    }
    return dp[capacity];
}
      `),
      cpp(`
int knapsack1D(vector<int>& weights, vector<int>& values, int capacity) {
    vector<int> dp(capacity + 1, 0);
    for (size_t i = 0; i < weights.size(); i++) {
        for (int c = capacity; c >= weights[i]; c--) {     // DOWNWARD
            dp[c] = max(dp[c], dp[c - weights[i]] + values[i]);
        }
    }
    return dp[capacity];
}
      `),
    ),
    tip(
      'Descending capacity means 0/1 — each item used at most once. Ascending means unbounded — each item reusable. That single loop direction is the entire difference between the two knapsack families, and it is worth memorising as a pair.',
    ),
    p(
      'Partition equal subset sum is 0/1 knapsack wearing a disguise: can any subset reach exactly half the total? The value being optimised is just reachability, so the table is boolean.',
    ),
    code(
      java(`
public boolean canPartition(int[] nums) {
    int total = 0;
    for (int n : nums) total += n;
    if (total % 2 != 0) return false;         // odd total can never split evenly

    int target = total / 2;
    boolean[] dp = new boolean[target + 1];
    dp[0] = true;                              // the empty subset sums to 0

    for (int num : nums) {
        for (int t = target; t >= num; t--) {  // downward: each number used once
            dp[t] = dp[t] || dp[t - num];
        }
    }
    return dp[target];
}
      `),
    ),
    p(
      'Grid paths. The most literal 2-D DP — the table mirrors the input. Every cell is reached from above or from the left, so the count adds and an obstacle zeroes the cell out.',
    ),
    code(
      java(`
public int uniquePathsWithObstacles(int[][] grid) {
    int m = grid.length, n = grid[0].length;
    int[] dp = new int[n];                     // one row, updated in place
    dp[0] = grid[0][0] == 1 ? 0 : 1;

    for (int r = 0; r < m; r++) {
        for (int c = 0; c < n; c++) {
            if (grid[r][c] == 1) dp[c] = 0;               // blocked
            else if (c > 0)      dp[c] += dp[c - 1];      // from above + from left
        }
    }
    return dp[n - 1];
}
      `),
    ),
    p(
      'Interval DP. When the state is a range rather than a prefix — longest palindromic subsequence, burst balloons — the fill order must go by increasing range length, because a range depends on the shorter ranges inside it.',
    ),
    code(
      java(`
// dp[i][j] = longest palindromic subsequence within s[i..j]
public int longestPalindromeSubseq(String s) {
    int n = s.length();
    int[][] dp = new int[n][n];
    for (int i = 0; i < n; i++) dp[i][i] = 1;        // single characters

    for (int len = 2; len <= n; len++) {             // by LENGTH, not by index
        for (int i = 0; i + len - 1 < n; i++) {
            int j = i + len - 1;
            if (s.charAt(i) == s.charAt(j)) dp[i][j] = dp[i + 1][j - 1] + 2;
            else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j - 1]);
        }
    }
    return dp[0][n - 1];                             // the answer is a corner here
}
      `),
    ),

    h('Language toolkit'),
    table(
      ['Java', 'What it does', 'C++ equivalent'],
      [
        ['new int[m + 1][n + 1]', 'Rectangular table, zero-filled.', 'vector<vector<int>> dp(m+1, vector<int>(n+1))'],
        ['new boolean[target + 1]', 'Reachability table.', 'vector<bool> dp(target + 1)'],
        ['for (int[] row : dp) Arrays.fill(row, v)', 'Fill a 2-D table.', 'vector<vector<int>>(m, vector<int>(n, v))'],
        ['s.charAt(i - 1)', 'The character dp[i] refers to.', 's[i - 1]'],
        ['Math.min(a, Math.min(b, c))', 'Three-way minimum.', 'min({a, b, c})'],
        ['long[][] dp', 'When counts overflow int.', 'vector<vector<long long>>'],
        ['int[] dp (one row)', 'Space-compressed 2-D.', 'vector<int> dp'],
      ],
    ),
    p(
      'C++ has min({a, b, c}) with an initializer list, which is cleaner than Java\'s nested Math.min for the three-way transition in edit distance.',
    ),

    h('Complexity'),
    table(
      ['Problem', 'Time', 'Space', 'Compressed'],
      [
        ['LCS / edit distance', 'O(m·n)', 'O(m·n)', 'O(min(m, n)) with one row'],
        ['0/1 knapsack', 'O(n·C)', 'O(n·C)', 'O(C) with one row, descending'],
        ['Partition equal subset', 'O(n·S)', 'O(S)', 'S = total / 2'],
        ['Unique paths on a grid', 'O(m·n)', 'O(m·n)', 'O(n) with one row'],
        ['Interval DP', 'O(n²) states', 'O(n²)', 'often O(n³) with an inner split'],
        ['Longest palindromic subsequence', 'O(n²)', 'O(n²)', 'O(n) is fiddly — usually not worth it'],
      ],
    ),
    warn(
      'Knapsack is O(n·C) where C is the capacity value, not the input length — that is pseudo-polynomial, and it means a capacity of 10^9 is intractable even with a handful of items. Say so if the constraints are large; interviewers ask about it deliberately.',
    ),

    h('Common mistakes'),
    ul(
      'Mixing up "first i characters" with "index i", so dp[i][j] and charAt(i) disagree by one.',
      'Iterating capacity upward in compressed 0/1 knapsack, which silently allows reusing an item.',
      'Wrong base row or column. Edit distance needs dp[i][0] = i, not zeros.',
      'Filling an interval DP by index instead of by range length, reading cells that are not yet computed.',
      'Assuming the answer is at dp[m][n]. For interval DP it is dp[0][n−1], and for "ending at" definitions it is the max over the table.',
      'Allocating an O(m·n) table when a single row would do, then being surprised by memory limits.',
      'Forgetting the modulo in counting problems.',
      'Treating capacity as if it were bounded by n when quoting complexity.',
    ),

    tip(
      'Draw the first three rows and columns by hand for a tiny input before coding. Every base-case and index-shift bug in this pattern is visible in that little grid and invisible in the loop.',
    ),

    links(
      link('LeetCode Explore — Dynamic Programming', 'https://leetcode.com/explore/learn/card/dynamic-programming/'),
      link('Java Arrays — API reference', 'https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/Arrays.html'),
    ),
  ],
};
