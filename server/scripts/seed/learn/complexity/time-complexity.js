import { code, h, java, js, link, links, note, p, table, tip, ul, warn, wiki } from '../blocks.js';

/*
  The counting drill.

  One shape per section, each with the code that produces it, because the skill
  being taught is not "know that binary search is log n" — it is being able to
  look at unfamiliar code and derive the shape. Java first because it is the
  roadmap's default language; JS second because it is the one this reader
  writes every day.
*/
export const doc = {
  blocks: [
    p(
      'Time complexity is answered by one question, asked of the **innermost line**: *how many times does this run, as a function of `n`?* Everything below is that question asked of eight different shapes, until the shapes are recognisable on sight.',
    ),
    note(
      '`n` is always the size of the input, and you have to say which input. For an array it is the length. For a string it is the character count. For a graph it is two numbers, so write `O(V + E)` rather than `O(n)`. For a number given as a value — "is `n` prime" — it is the value itself, and a loop to `n` is exponential in the *bits* of `n`, which is a distinction worth knowing exists.',
    ),

    h('O(1) — constant'),
    p('The work does not depend on `n` at all. Not "one step" — a fixed number of steps, however large.'),
    code(
      java(`
int first(int[] a)      { return a[0]; }                  // O(1)
boolean even(int n)     { return (n & 1) == 0; }          // O(1)
int get(Map<String,Integer> m, String k) { return m.get(k); } // O(1) average
void push(Deque<Integer> s, int x) { s.push(x); }         // O(1)
      `),
      js(`
const first = (a) => a[0];                 // O(1)
const even = (n) => (n & 1) === 0;         // O(1)
map.get(key);                              // O(1) average
arr.push(x);                               // O(1) amortised
      `),
    ),
    warn(
      'Watch the ones that look constant and are not. `arr.shift()` and `arr.unshift()` in JavaScript are `O(n)` — every element moves. `list.remove(0)` on a Java `ArrayList` is `O(n)` for the same reason. Slicing, `substring` and spreading an array are all `O(n)` in the length copied.',
    ),

    h('O(log n) — logarithmic'),
    p(
      'The input is cut by a constant fraction each step. Twenty steps for a million items — see the **Logarithms** topic for why. The tell in code is a counter that is multiplied or divided, or a recursion that halves.',
    ),
    code(
      java(`
// Binary search — the archetype. Each pass throws away half the range.
int search(int[] a, int target) {
    int lo = 0, hi = a.length - 1;
    while (lo <= hi) {
        int mid = lo + (hi - lo) / 2;   // (lo+hi)/2 can overflow; this cannot
        if (a[mid] == target) return mid;
        if (a[mid] < target) lo = mid + 1;
        else hi = mid - 1;
    }
    return -1;
}
// n -> n/2 -> n/4 -> ... -> 1   is log₂ n passes   =>  O(log n)
      `),
      js(`
function search(a, target) {
  let lo = 0, hi = a.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (a[mid] === target) return mid;
    if (a[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}
// O(log n) — but only because the array is already sorted.
// Sorting it first costs O(n log n) and dominates a single search.
      `),
    ),

    h('O(n) — linear'),
    p('One pass. Also two passes, and seventeen passes — constants are dropped.'),
    code(
      java(`
int max(int[] a) {                        // O(n)
    int best = Integer.MIN_VALUE;
    for (int x : a) best = Math.max(best, x);
    return best;
}

// Two pointers: nested-looking, still O(n). Each pointer only moves forward,
// so the two of them take at most 2n steps between them.
boolean hasPairSum(int[] sorted, int target) {
    int i = 0, j = sorted.length - 1;
    while (i < j) {
        int sum = sorted[i] + sorted[j];
        if (sum == target) return true;
        if (sum < target) i++; else j--;
    }
    return false;
}
      `),
      js(`
const max = (a) => a.reduce((b, x) => (x > b ? x : b), -Infinity);  // O(n)

// Sliding window — the window edges each cross the array once. O(n), not O(n·k).
function longestUnique(s) {
  const seen = new Map();
  let start = 0, best = 0;
  for (let end = 0; end < s.length; end++) {
    const prev = seen.get(s[end]);
    if (prev >= start) start = prev + 1;
    seen.set(s[end], end);
    best = Math.max(best, end - start + 1);
  }
  return best;
}
      `),
    ),
    tip(
      'Two pointers and sliding windows are the two shapes most often miscounted as `O(n²)`. The test is simple: **does any index ever move backwards?** If both only advance, the total number of moves is bounded by `2n` and the loop is linear no matter how it is nested.',
    ),

    h('O(n log n) — linearithmic'),
    p(
      'Almost always one of two things: a sort, or `n` operations each costing `log n`. This is the ceiling for comparison sorting, and in practice the target complexity for most array problems with `n ≤ 10⁵`.',
    ),
    code(
      java(`
// A sort, then a linear pass. O(n log n) + O(n) = O(n log n).
boolean hasDuplicate(int[] a) {
    Arrays.sort(a);                                  // O(n log n)
    for (int i = 1; i < a.length; i++)               // O(n)
        if (a[i] == a[i - 1]) return true;
    return false;
}

// n pushes into a heap, each O(log n).
PriorityQueue<Integer> heap = new PriorityQueue<>();
for (int x : a) heap.add(x);                         // n × log n
      `),
      js(`
// Merge sort — the recursion tree is log n levels deep and each level
// touches all n elements once.
function mergeSort(a) {
  if (a.length <= 1) return a;                 // log n levels of splitting...
  const mid = a.length >> 1;
  const left = mergeSort(a.slice(0, mid));
  const right = mergeSort(a.slice(mid));
  return merge(left, right);                   // ...each doing O(n) merging
}
// T(n) = 2·T(n/2) + O(n)  =>  O(n log n)
      `),
    ),

    h('O(n²) — quadratic'),
    p('Every pair. Two honest nested loops over the same input, or one loop doing `O(n)` work inside.'),
    code(
      java(`
// Every pair, explicitly.
boolean hasPairSum(int[] a, int target) {           // O(n²)
    for (int i = 0; i < a.length; i++)
        for (int j = i + 1; j < a.length; j++)
            if (a[i] + a[j] == target) return true;
    return false;
}
// The inner loop runs n-1, then n-2, ... = n(n-1)/2 ≈ n²/2  ->  O(n²)

// The hidden one: an O(n) call inside an O(n) loop.
for (int x : a)
    if (list.contains(x)) count++;                  // contains is O(n)  ->  O(n²)
      `),
      js(`
// The same trap in JS — includes() and indexOf() are O(n).
for (const x of a) if (b.includes(x)) count++;      // O(n·m)

// Fixed with a hash set: O(n + m).
const set = new Set(b);
for (const x of a) if (set.has(x)) count++;         // O(n + m)
      `),
    ),
    warn(
      'The most common accidental `O(n²)` is not a nested loop you wrote — it is an `O(n)` library call inside an `O(n)` loop. `contains`, `includes`, `indexOf`, `list.remove(value)`, string concatenation in a loop, `array.shift()` in a loop. Look for the call, not just the `for`.',
    ),

    h('String concatenation, the classic trap'),
    p(
      'Strings are immutable in Java and JavaScript, so `s = s + c` builds a whole new string every time. `n` of those copies costs `1 + 2 + 3 + ... + n = O(n²)` characters copied.',
    ),
    code(
      java(`
// O(n²) — every += allocates and copies the whole string so far.
String s = "";
for (int i = 0; i < n; i++) s += i;

// O(n) — one growable buffer, amortised appends.
StringBuilder sb = new StringBuilder();
for (int i = 0; i < n; i++) sb.append(i);
String s2 = sb.toString();
      `),
      js(`
// Modern JS engines optimise += with ropes, so this is usually fine —
// but the array-join form is the one that is O(n) by construction.
const parts = [];
for (let i = 0; i < n; i++) parts.push(i);
const s = parts.join('');   // O(n)
      `),
    ),

    h('O(2ⁿ) and O(n!) — exponential and factorial'),
    p(
      'Recursion that branches without pruning. `2ⁿ` is "include it or do not" over `n` items; `n!` is "in what order" over `n` items.',
    ),
    code(
      java(`
// O(2ⁿ) — two calls per level, n levels deep. Note fib(n-1) and fib(n-2)
// recompute the same subtrees over and over.
int fib(int n) {
    if (n < 2) return n;
    return fib(n - 1) + fib(n - 2);
}

// The same problem memoised: each n computed once  ->  O(n) time, O(n) space.
int fib(int n, Integer[] memo) {
    if (n < 2) return n;
    if (memo[n] != null) return memo[n];
    return memo[n] = fib(n - 1, memo) + fib(n - 2, memo);
}
      `),
      js(`
// O(2ⁿ) — every subset of n items.
function subsets(a, i = 0, cur = [], out = []) {
  if (i === a.length) { out.push([...cur]); return out; }
  subsets(a, i + 1, cur, out);              // skip a[i]
  cur.push(a[i]);
  subsets(a, i + 1, cur, out);              // take a[i]
  cur.pop();
  return out;
}
// 2ⁿ subsets, each copied in O(n)  ->  O(n · 2ⁿ) strictly

// O(n!) — every ordering. n=10 is 3.6 million, n=13 is 6 billion.
      `),
    ),
    note(
      'Exponential is not automatically wrong. It is the *intended* answer when `n` is tiny — subsets over `n ≤ 20`, permutations over `n ≤ 10`. The constraint is the setter telling you which one they want.',
    ),

    h('Recursion: the one formula worth knowing'),
    p(
      'For divide-and-conquer, write the recurrence `T(n) = a·T(n/b) + f(n)` — `a` calls on inputs of size `n/b`, plus `f(n)` work to split and combine — and read the answer off the three common cases.',
    ),
    table(
      ['recurrence', 'result', 'algorithm'],
      [
        ['`T(n) = T(n/2) + O(1)`', '`O(log n)`', 'binary search'],
        ['`T(n) = T(n/2) + O(n)`', '`O(n)`', 'quickselect (average)'],
        ['`T(n) = 2T(n/2) + O(1)`', '`O(n)`', 'tree traversal, heapify'],
        ['`T(n) = 2T(n/2) + O(n)`', '`O(n log n)`', 'merge sort, quicksort (average)'],
        ['`T(n) = 2T(n − 1) + O(1)`', '`O(2ⁿ)`', 'naive fibonacci, subset enumeration'],
        ['`T(n) = n·T(n − 1) + O(1)`', '`O(n!)`', 'permutation generation'],
      ],
    ),
    tip(
      'For anything that is not divide-and-conquer, count the recursion **tree** instead: nodes × work per node. A backtracking search with `b` choices at each of `d` levels visits `O(bᵈ)` nodes — that is where `O(2ⁿ)`, `O(n!)` and `O(4ⁿ/√n)` all come from.',
    ),

    h('The summary you should be able to write from memory'),
    table(
      ['shape in the code', 'complexity'],
      [
        ['no loop, or a fixed number of steps', '`O(1)`'],
        ['counter multiplied or divided each step', '`O(log n)`'],
        ['one pass, two pointers, sliding window', '`O(n)`'],
        ['a sort, or `n` heap/BST/set-with-sort operations', '`O(n log n)`'],
        ['every pair — two nested loops over `n`', '`O(n²)`'],
        ['every triple, or Floyd–Warshall', '`O(n³)`'],
        ['every subset — recursion branching twice', '`O(2ⁿ)`'],
        ['every ordering — recursion branching `n` ways', '`O(n!)`'],
      ],
    ),

    links(
      wiki('Time_complexity', 'Time complexity'),
      wiki('Master_theorem_(analysis_of_algorithms)', 'Master theorem'),
      link('Big-O Cheat Sheet', 'https://www.bigocheatsheet.com/'),
    ),
  ],
};
