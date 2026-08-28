import { code, h, java, js, links, mdn, note, p, table, tip, ul, warn, wiki } from '../blocks.js';

/*
  The topic that has to assume nothing.

  Everything else in this track leans on `log n`, and a reader who half
  remembers logarithms from school gets no value from a page that opens with
  "clearly binary search is O(log n)". So this one starts from doubling and
  halving, which is a thing you can count on your fingers, and only names the
  notation once the idea is already there.
*/
export const doc = {
  blocks: [
    p(
      'A logarithm is one question, asked about repeated doubling: **how many times do I have to double 1 before I reach n?** That is it. `log₂ 8 = 3` because 1 → 2 → 4 → 8 is three doublings, and nothing more mysterious than that is ever needed to read a complexity.',
    ),
    p(
      'The same question runs backwards, and backwards is the form you will meet in code: **how many times can I halve n before I hit 1?** Halving 8 gives 4, then 2, then 1 — three halvings. Doubling up and halving down count the same steps, so they give the same answer.',
    ),

    h('Count it once, by hand'),
    p(
      'Take `n = 1000`. Halve it and keep halving: 1000, 500, 250, 125, 62, 31, 15, 7, 3, 1. That is **ten steps**. So `log₂ 1000 ≈ 10`, and a thousand-item list can be cut in half exactly ten times before there is nothing left to cut.',
    ),
    p(
      'Now take a million. Your instinct says a thousand times more work. It is not — it is **twice** the work:',
    ),
    table(
      ['n', 'log₂ n', 'in words'],
      [
        ['`8`', '`3`', 'three halvings'],
        ['`64`', '`6`', 'six'],
        ['`1,024`', '`10`', 'ten — a thousand items, ten steps'],
        ['`1,000,000`', '`≈ 20`', 'a million items, twenty steps'],
        ['`1,000,000,000`', '`≈ 30`', 'a billion items, thirty steps'],
        ['`10¹⁸`', '`≈ 60`', 'more than there are grains of sand, sixty steps'],
      ],
    ),
    p(
      'That table is the whole reason logarithms matter to you. **`n` grows like a wall; `log n` grows like a staircase.** Multiplying the input by a thousand adds ten steps. This is why `O(log n)` is treated as "basically free" and why halving the search space is the single most reused trick in this curriculum.',
    ),

    h('Where the base comes from'),
    p(
      'The little `2` is the *branching factor* — how many pieces you cut the problem into each step. Binary search throws away half, so it is base 2. A ternary search throws away two thirds, so it is base 3. A B-tree node with 100 children is base 100.',
    ),
    ul(
      '`log₂ n` — halving. Binary search, a balanced BST, heap sift-up, merge sort depth.',
      '`log₁₀ n` — the number of decimal digits in `n`, near enough. `log₁₀ 1000 = 3`, and 1000 has 4 digits.',
      '`ln n` (base `e`) — the one your calculator calls `log` sometimes and mathematicians mean by default. It never changes an answer here.',
    ),
    note(
      'In Big-O the base does not matter and is normally dropped, because changing base only multiplies by a constant: `log₁₀ n = log₂ n / 3.32`. `O(log₂ n)` and `O(log₁₀ n)` are the same class. When someone writes `O(log n)` with no base, read "base 2" and move on.',
    ),

    h('The four rules worth memorising'),
    table(
      ['rule', 'what it says', 'why you meet it'],
      [
        ['`log(a·b) = log a + log b`', 'multiplying inside becomes adding outside', 'why `n` doublings of a list cost `n` in total'],
        ['`log(a/b) = log a − log b`', 'dividing inside becomes subtracting', 'each halving takes exactly 1 off the count'],
        ['`log(aᵏ) = k·log a`', 'an exponent inside becomes a multiplier outside', 'why `O(log n²) = O(2 log n) = O(log n)`'],
        ['`log_b n = log₂ n / log₂ b`', 'changing base is multiplying by a constant', 'why the base is dropped in Big-O'],
      ],
    ),
    p(
      'And the one identity that ties the two directions together: `2^(log₂ n) = n`. Doubling `log₂ n` times gets you back to `n`, which is the definition read left to right.',
    ),

    h('In code'),
    p(
      'Two ways to see it. The first counts halvings in a loop — this is the shape of binary search with the search taken out. The second just asks the standard library.',
    ),
    code(
      java(`
// How many times can n be halved before it reaches 1?
int steps = 0;
for (int n = 1000; n > 1; n /= 2) steps++;
// steps == 10

// The library answer, for exact powers of two:
int bits = 32 - Integer.numberOfLeadingZeros(1000); // 10
double exact = Math.log(1000) / Math.log(2);        // 9.9657...
      `),
      js(`
// How many times can n be halved before it reaches 1?
let steps = 0;
for (let n = 1000; n > 1; n = Math.floor(n / 2)) steps++;
// steps === 10

Math.log2(1000);          // 9.965784284662087
Math.ceil(Math.log2(1000)); // 10  — the number of halvings
      `),
    ),
    p(
      'Whenever you see a loop whose variable is **multiplied or divided** rather than incremented, the loop runs `log n` times. That single observation is most of what this track asks you to do with logarithms:',
    ),
    code(
      java(`
for (int i = 1; i < n; i *= 2)  { /* ... */ }   // log₂ n iterations
for (int i = n; i > 0; i /= 2)  { /* ... */ }   // log₂ n iterations
for (int i = 0; i < n; i += 1)  { /* ... */ }   // n iterations — not a log
      `),
      js(`
for (let i = 1; i < n; i *= 2) { /* ... */ }    // log₂ n iterations
for (let i = n; i > 0; i = (i / 2) | 0) { }     // log₂ n iterations
for (let i = 0; i < n; i += 1) { /* ... */ }    // n iterations — not a log
      `),
    ),

    h('The other direction: exponentials'),
    p(
      'A logarithm run backwards is an exponential, and that is the shape of the algorithms that blow up. `2ⁿ` asks "what do I get if I double `n` times", and the answers get silly fast: `2¹⁰ = 1024`, `2²⁰ ≈ a million`, `2³⁰ ≈ a billion`, `2⁶⁴ ≈ 1.8 × 10¹⁹`.',
    ),
    p(
      'So `log` and `2ⁿ` are the two ends of the same idea, and knowing one tells you the other: **if a problem says `n ≤ 20`, the setter is inviting an `O(2ⁿ)` solution**, because 2²⁰ is about a million and a million is nothing — see **Reading the constraints** later in this track.',
    ),

    h('The mistake to avoid'),
    warn(
      '`log n` is not "a bit smaller than `n`" — it is **absurdly** smaller, and the gap widens as `n` grows. At `n = 1,000,000`, `n` is a million and `log₂ n` is twenty: fifty thousand times apart. Anything you can turn from `O(n)` into `O(log n)` is not a tuning win, it is a different algorithm.',
    ),
    tip(
      'A sanity check you can do in your head: `log₂ n` is roughly "the number of binary digits in `n`". A million needs 20 bits, a billion needs 30. If you can guess the bit width, you can guess the log.',
    ),

    h('Cheatsheet'),
    table(
      ['Want to', 'Reach for'],
      [
        ['Read `log n` out loud', '"how many halvings from `n` down to 1"'],
        ['Estimate `log₂ n` in your head', 'the bit width of `n` — 10 for a thousand, 20 for a million, 30 for a billion'],
        ['Spot a log in code', 'a loop whose counter is `*= 2` or `/= 2`, or a recursion that halves its input'],
        ['Spot an exponential in code', 'a recursion that makes two calls on `n - 1`, or a subset/permutation walk'],
        ['Decide whether the base matters', 'it does not, in Big-O — a change of base is a constant factor'],
      ],
    ),

    links(
      wiki('Logarithm', 'Logarithm'),
      wiki('Binary_logarithm', 'Binary logarithm — log₂'),
      mdn('Web/JavaScript/Reference/Global_Objects/Math/log2', 'Math.log2()'),
    ),
  ],
};
