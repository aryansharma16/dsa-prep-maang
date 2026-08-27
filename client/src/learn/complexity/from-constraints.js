import { code, h, java, js, link, links, note, p, table, tip, ul, warn } from '../blocks.js';

/*
  The one topic here that is a technique rather than a definition.

  Reading the target complexity off the constraints before writing anything is
  the highest-leverage habit in interview prep: it turns "think of something
  clever" into "find the O(n log n) one", which is a much smaller search. The
  thresholds are the USACO Guide's, which assume ~10⁸ operations a second.
*/
export const doc = {
  blocks: [
    p(
      'Before you write a line, the constraints have already told you which complexity is wanted. `n ≤ 10⁵` means `O(n log n)`. `n ≤ 20` means exponential. Reading that off first turns an open-ended "think of something clever" into a much smaller question: *what `O(n log n)` technique fits this problem?*',
    ),

    h('The one number to hold on to'),
    p(
      'A judge or a laptop does on the order of **10⁸ simple operations per second**. It is a conservative estimate — with cache-friendly code and cheap operations it can be closer to 5 × 10⁸ — but 10⁸ is the number to budget with, because it leaves room to be wrong.',
    ),
    p(
      'So the method is: take the largest `n` in the constraints, plug it into your candidate complexity, and see whether the result is under about 10⁸.',
    ),
    code(
      java(
        `
n = 100_000  and  O(n²)        ->  10¹⁰  ->  ~100 seconds   ->  too slow
n = 100_000  and  O(n log n)   ->  1.7 × 10⁶  ->  instant    ->  fine
n = 100_000  and  O(n √n)      ->  3.2 × 10⁷  ->  fine
n = 1000     and  O(n²)        ->  10⁶  ->  fine
n = 5000     and  O(n²)        ->  2.5 × 10⁷  ->  fine
n = 20       and  O(2ⁿ)        ->  10⁶  ->  fine
n = 25       and  O(2ⁿ)        ->  3.4 × 10⁷ ->  fine, but close
      `,
        'The arithmetic',
      ),
    ),

    h('The table'),
    p(
      'Largest `n`, and the biggest complexity that still passes. These thresholds are the USACO Guide\'s, for a typical one-second limit.',
    ),
    table(
      ['n up to', 'complexity that fits', 'what that looks like'],
      [
        ['`10`', '`O(n!)`, `O(n⁶)`', 'permutations, brute force over everything'],
        ['`20`', '`O(2ⁿ · n)`, `O(n⁵)`', 'subsets, bitmask DP'],
        ['`80`', '`O(n⁴)`', 'four nested loops'],
        ['`400`', '`O(n³)`', 'Floyd–Warshall, interval DP, matrix work'],
        ['`7,500`', '`O(n²)`', 'every pair, 2D DP over two sequences'],
        ['`7 × 10⁴`', '`O(n √n)`', 'square-root decomposition, Mo\'s algorithm'],
        ['`5 × 10⁵`', '`O(n log n)`', 'sorting, heaps, binary search, segment trees'],
        ['`5 × 10⁶`', '`O(n)`', 'one pass, two pointers, sliding window, counting'],
        ['`10¹⁸`', '`O(log n)`, `O(1)`', 'binary search on the answer, maths, bit tricks'],
      ],
    ),
    note(
      'Interview problems are gentler than contest problems and cluster tightly: **`n ≤ 10⁵` is by far the most common constraint you will see on LeetCode, and it means `O(n log n)` or better**. If you find yourself with an `O(n²)` idea and `n = 10⁵`, you have not found the intended solution yet — that is information, not failure.',
    ),

    h('Reading it backwards — the complexity names the technique'),
    p(
      'Once you know the target shape, the set of things that produce that shape is short. This is the table that turns a constraint into a shortlist.',
    ),
    table(
      ['target', 'techniques that get you there'],
      [
        ['`O(1)`', 'maths, a closed form, a bit trick, one hash lookup'],
        ['`O(log n)`', 'binary search, binary search **on the answer**, exponentiation by squaring, a balanced tree'],
        ['`O(n)`', 'one pass, two pointers, sliding window, prefix sums, hash map counting, monotonic stack, Kadane'],
        ['`O(n log n)`', 'sort then scan, heap of size `k`, binary search inside a loop, divide and conquer, segment/Fenwick tree'],
        ['`O(n √n)`', 'square-root decomposition, factorisation'],
        ['`O(n²)`', 'every pair, 2D DP over two strings, DP over intervals'],
        ['`O(2ⁿ)` / `O(n · 2ⁿ)`', 'subset enumeration, bitmask DP, meet in the middle'],
        ['`O(n!)`', 'permutations with backtracking and pruning'],
      ],
    ),
    tip(
      'Two constraints deserve their own reflex. **`n ≤ 20`** is a bitmask problem — 2²⁰ is a million, and the setter chose 20 for exactly that reason. **`n ≤ 10¹⁸`** cannot be iterated at all, so it is binary search on the answer, a formula, or digit DP.',
    ),

    h('A worked example'),
    p(
      '*"Given an array of up to 2 × 10⁵ integers, find whether any two of them sum to a target."*',
    ),
    ul(
      '`n = 2 × 10⁵`. `n²` is `4 × 10¹⁰` — about seven minutes. Dead.',
      '`n log n` is about `3.5 × 10⁶`. Fine. `n` is `2 × 10⁵`. Also fine.',
      'So the answer is `O(n log n)` or `O(n)`, and the shortlist above says: sort then two pointers (`n log n`, `O(1)` space), or a hash set in one pass (`n`, `O(n)` space).',
      'You have the solution before you have thought about the problem — which is the point.',
    ),
    code(
      java(`
// O(n log n) time, O(1) extra space — the other branch of the shortlist.
boolean hasPairSum(int[] a, int target) {
    Arrays.sort(a);
    int i = 0, j = a.length - 1;
    while (i < j) {
        int sum = a[i] + a[j];
        if (sum == target) return true;
        if (sum < target) i++; else j--;
    }
    return false;
}
      `),
      js(`
// O(n) time, O(n) space — reached by reading the constraint, not by insight.
function hasPairSum(a, target) {
  const seen = new Set();
  for (const x of a) {
    if (seen.has(target - x)) return true;
    seen.add(x);
  }
  return false;
}
      `),
    ),

    h('Where the rule of thumb breaks'),
    warn(
      'The 10⁸ figure counts *simple* operations. Division and modulo are several times slower than addition. A hash map lookup is `O(1)` but with a fat constant — perhaps 10–50× an array index. Anything that chases pointers through memory pays cache misses that Big-O cannot see. So `O(n)` with a hash map on `n = 10⁷` can lose to `O(n log n)` on a flat sorted array.',
    ),
    ul(
      '**Language matters.** C++ is the baseline the thresholds assume. Java is close for array work. JavaScript and Python are slower per operation, so shave the top of the range.',
      '**Recursion has a constant.** A recursive `O(n)` with 10⁶ frames may overflow the stack before it is slow.',
      '**Read the time limit.** Two seconds doubles the budget; a multi-test-case format divides it by the number of cases.',
      '**Look for a second variable.** `O(n · m)` with `n, m ≤ 1000` is 10⁶ and fine, even though "quadratic" sounds alarming.',
    ),

    h('Cheatsheet'),
    table(
      ['Want to', 'Reach for'],
      [
        ['Know the target before you start', 'plug the largest `n` into each candidate and keep the ones under 10⁸'],
        ['See `n ≤ 20`', 'bitmask or subset enumeration — `O(2ⁿ)` is intended'],
        ['See `n ≤ 5000`', '`O(n²)` is fine — 2D DP, every pair'],
        ['See `n ≤ 10⁵`', '`O(n log n)`: sort, heap, binary search'],
        ['See `n ≤ 10⁹` or larger', 'you cannot loop — binary search on the answer, or maths'],
        ['See two variables', 'multiply them before panicking — `n · m ≤ 10⁶` is fine'],
      ],
    ),

    links(
      link('Time Complexity — USACO Guide', 'https://usaco.guide/bronze/time-comp'),
      link('Big-O Cheat Sheet', 'https://www.bigocheatsheet.com/'),
      link('Knowing the complexity in competitive programming', 'https://www.geeksforgeeks.org/dsa/knowing-the-complexity-in-competitive-programming/'),
    ),
  ],
};
