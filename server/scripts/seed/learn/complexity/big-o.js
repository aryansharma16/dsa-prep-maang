import { code, h, java, js, link, links, note, p, table, tip, ul, warn, wiki } from '../blocks.js';

/*
  The notation itself, before any counting.

  Deliberately spends its first half on what Big-O is *not* — not seconds, not
  a benchmark, not a promise about small inputs — because every wrong intuition
  about complexity traces back to reading it as a speed rather than as a shape.
*/
export const doc = {
  blocks: [
    p(
      'Big-O describes **how the cost of an algorithm grows as the input grows**. It is not a measurement of speed, it is a shape. `O(n)` says "double the input and the work roughly doubles". `O(n²)` says "double the input and the work quadruples". That is the entire content of the notation.',
    ),
    p(
      'It exists because the alternative — timing your code — answers a question nobody asked. A benchmark on your laptop with 100 items tells you nothing about a server with 10 million, and it changes when you close a browser tab. Growth does not: an `O(n²)` algorithm is `O(n²)` on every machine that will ever exist.',
    ),

    h('The two simplification rules'),
    p('Everything you do with Big-O is these two rules, applied until nothing is left to apply them to.'),
    ul(
      '**Drop the constants.** `O(3n)` is `O(n)`. `O(n / 2)` is `O(n)`. Three passes over an array is still one shape — a machine twice as fast would erase the difference, and the notation is about what a faster machine *cannot* fix.',
      '**Drop the lower-order terms.** `O(n² + n)` is `O(n²)`. At `n = 1,000,000` the `n²` term is a trillion and the `n` term is a million: the smaller one is a rounding error, and it only gets more so as `n` grows.',
    ),
    code(
      java(`
// Count the steps honestly, then simplify.
int f(int[] a) {
    int n = a.length;
    int total = 0;
    for (int x : a) total += x;              // n
    for (int x : a) total += x;              // n
    for (int i = 0; i < n; i++)              // n
        for (int j = 0; j < n; j++)          //   × n
            total += a[i] * a[j];            // = n²
    return total;
}
// 2n + n²  ->  drop constants  ->  n + n²  ->  drop lower terms  ->  O(n²)
      `),
      js(`
function f(a) {
  const n = a.length;
  let total = 0;
  for (const x of a) total += x;             // n
  for (const x of a) total += x;             // n
  for (let i = 0; i < n; i++)                // n
    for (let j = 0; j < n; j++)              //   × n
      total += a[i] * a[j];                  // = n²
  return total;
}
// 2n + n²  ->  O(n²)
      `),
    ),

    h('Reading it off the structure'),
    p('Two rules again, and they cover most code you will be asked to analyse in an interview.'),
    table(
      ['structure', 'rule', 'example'],
      [
        ['One loop after another', '**add** them, then keep the biggest', '`O(n) + O(n log n)` → `O(n log n)`'],
        ['One loop inside another', '**multiply** them', '`O(n)` outer × `O(n)` inner → `O(n²)`'],
        ['A loop calling an `O(log n)` operation', 'multiply', '`n` inserts into a heap → `O(n log n)`'],
        ['A branch (`if`/`else`)', 'take the **worse** side', '`if (x) O(1) else O(n)` → `O(n)`'],
        ['Work that does not depend on `n`', '`O(1)`, whatever the line count', 'a 400-line function with no loop is still `O(1)`'],
      ],
    ),
    warn(
      'Nested loops are not automatically `O(n²)`. What matters is how many times the innermost line actually runs. `for (j = i; j < n; j++)` inside `for (i = 0; i < n; i++)` runs `n(n+1)/2` times — which simplifies to `O(n²)` anyway — but a two-pointer loop where `i` and `j` only ever move forward runs `2n` times and is `O(n)`, despite looking nested. **Count, do not pattern-match.**',
    ),

    h('O, Ω and Θ — and why nobody says Θ'),
    p(
      'Three symbols, one idea, three different bounds on the same growth curve. You will see all three on the cheat-sheet tables and hear only one in interviews.',
    ),
    table(
      ['symbol', 'name', 'means', 'in one word'],
      [
        ['`O(f)`', 'Big-O', 'grows **no faster** than `f` — an upper bound', 'ceiling'],
        ['`Ω(f)`', 'Big-Omega', 'grows **no slower** than `f` — a lower bound', 'floor'],
        ['`Θ(f)`', 'Big-Theta', 'both at once — the bound is **tight**', 'exactly'],
      ],
    ),
    p(
      'So merge sort is `Θ(n log n)`: never better, never worse. Quicksort is `O(n²)` and `Ω(n log n)` — its ceiling and floor are different shapes, which is precisely what "average `n log n`, worst `n²`" means.',
    ),
    note(
      'Technically `O(n²)` is a correct statement about a merge sort, since a ceiling of `n²` is a true if useless claim. In practice everyone says "O" and means "Θ" — the tightest bound they can state. Say `O(n log n)` for merge sort in an interview; nobody will correct you, and stating a loose bound on purpose reads as hedging.',
    ),

    h('Best, average and worst'),
    p(
      'A separate axis from `O`/`Ω`/`Θ`, and the one people actually confuse. Best/average/worst is about **which input** you get; `O`/`Ω`/`Θ` is about how tightly you are bounding a given case.',
    ),
    ul(
      '**Worst case** — the input designed to hurt. This is the default: when someone says "what is the complexity", they mean worst case unless they say otherwise.',
      '**Average case** — over random inputs. The honest number for hash tables and quicksort, both of which have ugly worst cases that essentially never happen.',
      '**Best case** — the lucky input. Almost never interesting, with one exception: it is how you justify an early exit, like insertion sort being `Ω(n)` on already-sorted data.',
    ),
    code(
      java(`
// Linear search.
int find(int[] a, int target) {
    for (int i = 0; i < a.length; i++)
        if (a[i] == target) return i;
    return -1;
}
// best:    O(1)  — the target is at index 0
// average: O(n)  — halfway in, and n/2 is O(n)
// worst:   O(n)  — last, or absent. This is "the" complexity.
      `),
      js(`
function find(a, target) {
  for (let i = 0; i < a.length; i++)
    if (a[i] === target) return i;
  return -1;
}
// best O(1) · average O(n) · worst O(n) — quote the worst
      `),
    ),

    h('Amortised: the average that is not an average'),
    p(
      'One more word you will meet on the tables. **Amortised** cost is the cost per operation *averaged over a long run*, where an occasional expensive operation is paid for by the cheap ones around it — and unlike an average case, it is a guarantee rather than a probability.',
    ),
    p(
      'The canonical example is the dynamic array — `ArrayList`, `vector`, a JS array. Appending is `O(1)`, except when the backing array is full, where it allocates a new one of double the size and copies everything: `O(n)`. But that doubling means the expensive copy happens ever more rarely, and the total cost of `n` appends is `O(n)`. So an append is **`O(1)` amortised**, worst case `O(n)`.',
    ),
    tip(
      'The tell is doubling. Whenever a structure grows by *multiplying* its capacity rather than adding a fixed amount, the rare expensive step amortises away. If it grew by a fixed +10 slots, `n` appends would cost `O(n²)` and nothing would amortise.',
    ),

    h('The growth ladder'),
    p('Every complexity you will meet in this curriculum, in order, with what it costs at a realistic size.'),
    table(
      ['complexity', 'name', 'n = 1,000', 'n = 1,000,000', 'typical of'],
      [
        ['`O(1)`', 'constant', '1', '1', 'hash lookup, array index, stack push'],
        ['`O(log n)`', 'logarithmic', '10', '20', 'binary search, balanced BST, heap push'],
        ['`O(n)`', 'linear', '1,000', '1,000,000', 'one pass, two pointers, sliding window'],
        ['`O(n log n)`', 'linearithmic', '10,000', '20,000,000', 'sorting, heap of n items, divide and conquer'],
        ['`O(n²)`', 'quadratic', '1,000,000', '10¹² — hopeless', 'nested loops, comparing all pairs'],
        ['`O(n³)`', 'cubic', '10⁹', 'hopeless', 'triple loops, Floyd–Warshall'],
        ['`O(2ⁿ)`', 'exponential', 'hopeless', 'hopeless', 'every subset, naive recursion on two branches'],
        ['`O(n!)`', 'factorial', 'hopeless', 'hopeless', 'every permutation, brute-force TSP'],
      ],
    ),
    warn(
      'The two rows to feel in your gut are `O(n log n)` and `O(n²)`. At a million items the first is 20 million steps — well under a second. The second is a trillion — about three hours. Almost every "optimise this" interview question is the walk between those two rows.',
    ),

    h('What Big-O deliberately hides'),
    ul(
      '**Constant factors.** `O(n)` with a disk read per item is slower than `O(n log n)` in memory. Big-O compares shapes, not implementations.',
      '**Small inputs.** Insertion sort beats merge sort below about 30 elements, which is why real library sorts switch to it — Java\'s and V8\'s both do.',
      '**Memory behaviour.** A cache-friendly `O(n²)` over a flat array can beat a pointer-chasing `O(n log n)`. The notation counts operations, not cache misses.',
      '**Which `n`.** `O(n)` in a graph problem is ambiguous until you say whether `n` is vertices or edges. Write `O(V + E)` and the ambiguity is gone.',
    ),
    note(
      'None of this makes Big-O less useful — it makes it a *first* filter rather than the last word. Get the shape right first; a constant factor is a tuning problem, and a wrong shape is a rewrite.',
    ),

    h('Cheatsheet'),
    table(
      ['Want to', 'Reach for'],
      [
        ['State a complexity', 'the **worst case**, with constants and lower terms dropped'],
        ['Combine two sequential blocks', 'add, then keep the larger'],
        ['Combine nested loops', 'multiply — after checking the inner loop really runs `n` times'],
        ['Describe a hash table', '`O(1)` average, `O(n)` worst — say both'],
        ['Describe a dynamic array append', '`O(1)` amortised'],
        ['Justify an early exit', 'best case, `Ω(...)` — the only time best case is worth saying'],
      ],
    ),

    links(
      wiki('Big_O_notation', 'Big O notation'),
      wiki('Time_complexity', 'Time complexity'),
      wiki('Amortized_analysis', 'Amortized analysis'),
      link('Big-O Cheat Sheet', 'https://www.bigocheatsheet.com/'),
    ),
  ],
};
