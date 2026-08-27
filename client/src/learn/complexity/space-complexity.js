import { code, h, java, js, link, links, note, p, table, tip, ul, warn, wiki } from '../blocks.js';

/*
  The half people skip.

  Written second-person and short, because space is the easier of the two to
  count and the one most likely to be forgotten out loud in an interview — the
  fix is a habit ("and the space is...") rather than a technique.
*/
export const doc = {
  blocks: [
    p(
      'Space complexity is the same question as time, asked about memory: **how much extra memory does this need, as a function of `n`?** It is counted the same way, simplified the same way, and quoted alongside the time in every answer worth giving.',
    ),

    h('Auxiliary space, not total space'),
    p(
      'The input already exists — you were handed it. What is being counted is what you **allocate on top of it**, which is called *auxiliary* space, and it is what everyone means by "the space complexity" unless they say otherwise.',
    ),
    ul(
      'An algorithm that sorts an array in place is `O(1)` space, even though the array is `n` long.',
      'An algorithm that builds a hash set of every element is `O(n)` space.',
      'The **output** is conventionally not counted either — a function returning all `n!` permutations is not usually described as `O(n!)` space, because producing the answer is the job. Say "`O(n)` auxiliary, plus the output" when it matters.',
    ),

    h('The call stack is space'),
    p(
      'The single most missed source. Every pending recursive call holds a frame — parameters, locals, the return address — so **recursion depth is space**, whether or not you allocated anything yourself.',
    ),
    code(
      java(`
// O(1) auxiliary — a couple of ints, no matter how big the array.
void reverse(int[] a) {
    for (int i = 0, j = a.length - 1; i < j; i++, j--) {
        int t = a[i]; a[i] = a[j]; a[j] = t;
    }
}

// O(log n) space — no allocation at all, but the stack is log n deep
// because each call halves the range.
int search(int[] a, int lo, int hi, int target) {
    if (lo > hi) return -1;
    int mid = lo + (hi - lo) / 2;
    if (a[mid] == target) return mid;
    return a[mid] < target ? search(a, mid + 1, hi, target)
                           : search(a, lo, mid - 1, target);
}

// O(n) space — the stack goes n deep, and on a large n this is
// StackOverflowError rather than a slow program.
long sum(int[] a, int i) {
    return i == a.length ? 0 : a[i] + sum(a, i + 1);
}
      `),
      js(`
// The same three, in JS. The third one throws RangeError:
// "Maximum call stack size exceeded" somewhere around 10⁴ frames.
const reverseInPlace = (a) => {                    // O(1)
  for (let i = 0, j = a.length - 1; i < j; i++, j--) [a[i], a[j]] = [a[j], a[i]];
};

const reversed = (a) => [...a].reverse();          // O(n) — a copy

const sum = (a, i = 0) =>                          // O(n) stack
  i === a.length ? 0 : a[i] + sum(a, i + 1);
      `),
    ),
    warn(
      'A tree recursion is `O(h)` space where `h` is the height — `O(log n)` for a balanced tree, `O(n)` for a degenerate one that is really a linked list. Quote both: "`O(log n)` on a balanced tree, `O(n)` worst case" is the answer that shows you know why balancing exists.',
    ),

    h('What each structure costs'),
    table(
      ['what you allocate', 'space', 'note'],
      [
        ['a few variables, counters, pointers', '`O(1)`', 'any fixed number of them'],
        ['a copy of the input, a result array, a hash set of the input', '`O(n)`', 'the common case'],
        ['a boolean `visited[]` over `n` nodes', '`O(n)`', 'graph traversals'],
        ['a queue or stack in BFS/DFS', '`O(n)`', 'worst case the whole frontier is queued'],
        ['a 2D DP table over two strings', '`O(n · m)`', 'usually reducible — see below'],
        ['a trie over `n` words of length `k`', '`O(n · k)`', 'characters stored, not words'],
        ['merge sort\'s temporary arrays', '`O(n)`', 'the reason heapsort exists'],
        ['quicksort\'s recursion', '`O(log n)`', 'if you recurse on the smaller side'],
      ],
    ),

    h('The trade you will actually be asked to make'),
    p(
      'Nearly every "can you do better than `O(n²)`" question is answered by spending memory to buy time. It is worth being able to say the trade out loud.',
    ),
    code(
      java(`
// Two-sum, O(n²) time and O(1) space — every pair.
for (int i = 0; i < n; i++)
    for (int j = i + 1; j < n; j++)
        if (a[i] + a[j] == target) return new int[]{i, j};

// Two-sum, O(n) time and O(n) space — remember what you have seen.
Map<Integer,Integer> seen = new HashMap<>();
for (int i = 0; i < n; i++) {
    if (seen.containsKey(target - a[i])) return new int[]{seen.get(target - a[i]), i};
    seen.put(a[i], i);
}
      `),
      js(`
// The same trade in JS. n² time and O(1) space, or n time and O(n) space.
const seen = new Map();
for (let i = 0; i < a.length; i++) {
  if (seen.has(target - a[i])) return [seen.get(target - a[i]), i];
  seen.set(a[i], i);
}
      `),
    ),
    tip(
      'The reverse trade is worth knowing too: **rolling arrays**. A DP over a 2D table where row `i` only reads row `i-1` needs two rows, not `n` of them — `O(n · m)` space becomes `O(m)`. Same time, and it is the follow-up question after you get the DP right.',
    ),

    h('Sorting, where the space actually differs'),
    p('Every comparison sort is `O(n log n)` average. What separates them in practice is the memory.'),
    table(
      ['sort', 'time (worst)', 'space', 'stable'],
      [
        ['Merge sort', '`O(n log n)`', '`O(n)`', 'yes'],
        ['Heapsort', '`O(n log n)`', '`O(1)`', 'no'],
        ['Quicksort', '`O(n²)`', '`O(log n)` stack', 'no'],
        ['Timsort (Java objects, JS, Python)', '`O(n log n)`', '`O(n)`', 'yes'],
        ['Introsort (C++ `std::sort`)', '`O(n log n)`', '`O(log n)`', 'no'],
        ['Insertion sort', '`O(n²)`', '`O(1)`', 'yes'],
      ],
    ),
    note(
      'This is why the library sort you get depends on what you are sorting. Java sorts primitives with a dual-pivot quicksort — no stability to preserve, no extra array — and sorts objects with Timsort, which is stable and pays `O(n)` memory for it. C++ `std::sort` is introsort: quicksort that switches to heapsort when the recursion goes too deep, which is how it gets an `O(n log n)` worst case with `O(log n)` space.',
    ),

    h('Saying it in an interview'),
    p(
      'Give both numbers, unprompted, in one sentence: **"this is `O(n log n)` time and `O(n)` space, because the sort dominates and the merge needs a temporary array."** The `because` is the part being marked — it shows you counted rather than recalled.',
    ),
    ul(
      'Name what dominates. "The sort dominates" is a complete justification for `O(n log n)`.',
      'Say where the space goes. "`O(n)` for the hash map" beats a bare "`O(n)` space".',
      'If recursion is involved, mention the stack before you are asked about it.',
      'If you traded space for time on purpose, say so — that is a design decision, not an accident.',
    ),

    h('Cheatsheet'),
    table(
      ['Want to', 'Reach for'],
      [
        ['Count space', 'what you allocate **on top of** the input, plus the recursion depth'],
        ['Turn `O(n²)` time into `O(n)`', 'a hash map of what you have already seen — costs `O(n)` space'],
        ['Get rid of `O(n · m)` DP space', 'a rolling array — keep the previous row only'],
        ['Sort with no extra memory', 'heapsort, or quicksort if the worst case is acceptable'],
        ['Sort stably', 'merge sort or Timsort — and pay `O(n)`'],
        ['Avoid a stack overflow on deep recursion', 'convert to an explicit stack and a loop — same `O(n)`, on the heap'],
      ],
    ),

    links(
      wiki('Space_complexity', 'Space complexity'),
      wiki('In-place_algorithm', 'In-place algorithm'),
      link('Big-O Cheat Sheet — sorting space', 'https://www.bigocheatsheet.com/'),
    ),
  ],
};
