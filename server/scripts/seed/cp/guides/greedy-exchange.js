import { code, cpp, h, java, link, links, p, table, tip, ul, warn } from '../../guides/blocks.js';

export default {
  patternSlug: 'greedy-exchange',
  title: 'Greedy & the Exchange Argument',
  summary:
    'Take the locally best option and prove that swapping it into any optimal solution does not make things worse. The proof is the technique.',
  blocks: [
    p(
      'Greedy is the most-attempted and least-understood pattern in competitive programming. Writing a greedy is easy — sort by something, walk the array, take what looks best. Knowing whether it is *correct* is the entire skill, and the gap between those two is where most of the wrong-answer-on-test-6 submissions in any Div. 2 come from.',
    ),
    p(
      'The tool that closes the gap is the exchange argument, and it is short enough to do in your head. Take any optimal solution. Find the first place it disagrees with what your greedy would have chosen. Show that you can swap the optimal solution\'s choice for the greedy\'s choice without making the answer worse. If you can, then by repeating the swap you can turn any optimal solution into the greedy one — so the greedy is optimal too.',
    ),
    p(
      'Two minutes on that argument before you start typing is the single highest-return habit at 1200–1600. It either convinces you, or it fails in a specific way that hands you the counterexample — and a counterexample tells you the problem is DP, which is also worth knowing before you have written eighty lines.',
    ),

    h('When to reach for it'),
    ul(
      'Maximise or minimise, with no obvious DP state and no dependency between distant choices.',
      'Sorting by *some* key makes the answer look obvious — the difficulty is picking the key.',
      'Scheduling, matching, or assignment where each item has one or two numbers attached.',
      '"Take the largest each time" or "process in deadline order" feels natural and the constraints are large enough to rule out DP.',
      'Constraints up to 2·10^5 with an answer that is a single number. That size forbids O(n^2), which forbids most DP.',
    ),
    warn(
      'The negative signal matters as much: if taking an item *now* removes an option later in a way your sort key cannot see, greedy is wrong and you are looking at DP. Knapsack with weights is the standard example — sorting by value/weight is right for the fractional version and wrong for the 0/1 version, and the statement barely changes.',
    ),

    h('The exchange argument, worked'),
    p(
      'Interval scheduling: choose the largest set of non-overlapping intervals. The greedy is "repeatedly take the interval that finishes earliest among those still compatible". Here is the proof, in full, because it is the shape every other exchange argument copies.',
    ),
    ul(
      'Let `G` be the greedy solution and `O` any optimal one, both sorted by finish time.',
      'Suppose they agree on the first `k` intervals and disagree at position `k+1`.',
      'The greedy picked `g`, the interval with the earliest finish time among those compatible with the first `k`. So `finish(g) ≤ finish(o)`.',
      'Replace `o` with `g` in `O`. Everything after `o` in `O` started after `finish(o) ≥ finish(g)`, so it is still compatible. The size of `O` is unchanged, so it is still optimal.',
      'Now `O` agrees with `G` on `k+1` intervals. Repeat. `G` is optimal.',
    ),
    code(
      java(`
// Maximum set of non-overlapping intervals.
int maxNonOverlapping(int[][] iv) {
    Arrays.sort(iv, (x, y) -> Integer.compare(x[1], y[1]));   // by FINISH time
    int taken = 0, lastEnd = Integer.MIN_VALUE;
    for (int[] cur : iv) {
        if (cur[0] >= lastEnd) { taken++; lastEnd = cur[1]; }
    }
    return taken;
}
      `),
      cpp(`
int maxNonOverlapping(vector<pair<int,int>> iv) {
    // sort by finish time: pair is (start, end), so reorder or use a lambda
    sort(iv.begin(), iv.end(), [](auto& a, auto& b){ return a.second < b.second; });
    int taken = 0, lastEnd = INT_MIN;
    for (auto& [s, e] : iv) {
        if (s >= lastEnd) { taken++; lastEnd = e; }
    }
    return taken;
}
      `),
    ),
    tip(
      'Sorting by *start* time is the classic wrong answer here, and by *length* is the second. Both pass the samples. The exchange argument only goes through for finish time, which is the point — the proof selects the key, not intuition.',
    ),

    h('Sorting by the right comparator'),
    p(
      'A large family of greedy problems reduces to "what order should these go in", and the answer comes from a pairwise question: for two adjacent items, which order is better? Whatever inequality answers that *is* the comparator. This is an exchange argument on adjacent elements, and it is mechanical.',
    ),
    p(
      'Example: jobs with a duration and a penalty rate; total cost is the sum over jobs of (finish time × rate). For two adjacent jobs `a` then `b`, the cost difference between the two orders is `dur[a]·rate[b]` versus `dur[b]·rate[a]`. So `a` goes first exactly when `dur[a]·rate[b] < dur[b]·rate[a]`.',
    ),
    code(
      java(`
// Order jobs to minimise sum of (finish time * rate).
Integer[] idx = new Integer[n];
for (int i = 0; i < n; i++) idx[i] = i;

Arrays.sort(idx, (x, y) -> {
    // a before b iff dur[a]*rate[b] < dur[b]*rate[a]
    long left  = (long) dur[x] * rate[y];
    long right = (long) dur[y] * rate[x];
    return Long.compare(left, right);       // strict, and never returns 0 wrongly
});
      `),
      cpp(`
vector<int> idx(n);
iota(idx.begin(), idx.end(), 0);

sort(idx.begin(), idx.end(), [&](int x, int y) {
    return (long long)dur[x] * rate[y] < (long long)dur[y] * rate[x];
});
      `),
    ),
    warn(
      'Cast before multiplying. `dur[x] * rate[y]` with both up to 10^9 overflows a 32-bit int and the comparator starts returning nonsense — which in C++ is not merely a wrong sort but undefined behaviour, and `std::sort` will happily segfault or read out of bounds. This is the most common way a correct greedy crashes.',
    ),
    warn(
      'A comparator must be a strict weak ordering: it must return `false` for equal elements. Writing `<=` instead of `<` is undefined behaviour in C++ and throws "Comparison method violates its general contract" in Java. Both failures look nothing like a comparator bug.',
    ),

    h('Greedy with a heap'),
    p(
      'When the greedy choice depends on what you have already taken, a priority queue carries the state. The "regret" pattern is the one worth knowing: take everything greedily, and when a constraint is violated, undo the worst thing you took.',
    ),
    code(
      java(`
// Maximise jobs done, each with a deadline and a duration.
// Take jobs in deadline order; if the schedule overruns, drop the longest so far.
Arrays.sort(jobs, (a, b) -> Integer.compare(a[1], b[1]));   // by deadline
PriorityQueue<Integer> taken = new PriorityQueue<>(Comparator.reverseOrder());
long time = 0;
for (int[] job : jobs) {
    int dur = job[0], deadline = job[1];
    taken.add(dur);
    time += dur;
    if (time > deadline) time -= taken.poll();   // regret the longest job
}
return taken.size();
      `),
      cpp(`
sort(jobs.begin(), jobs.end(), [](auto& a, auto& b){ return a.second < b.second; });
priority_queue<int> taken;                       // max-heap
long long time = 0;
for (auto& [dur, deadline] : jobs) {
    taken.push(dur);
    time += dur;
    if (time > deadline) { time -= taken.top(); taken.pop(); }
}
return (int)taken.size();
      `),
    ),
    tip(
      'The regret pattern generalises: whenever "take it and undo the worst choice later" is cheaper than "decide correctly now", a heap turns an apparently-DP problem into an O(n log n) greedy.',
    ),

    h('When greedy is wrong'),
    table(
      ['Looks greedy', 'Actually', 'Tell'],
      [
        ['0/1 knapsack', 'DP', 'Taking an item removes capacity others needed.'],
        ['Longest increasing subsequence', 'DP / patience', 'A short prefix can enable a long suffix.'],
        ['Coin change, arbitrary coins', 'DP', 'Greedy works for canonical systems only.'],
        ['Partition into k equal parts', 'DP / search', 'Local balance does not imply global balance.'],
        ['Min cost path in a grid', 'DP', 'The cheap first step can lead into an expensive region.'],
        ['Matching with preferences', 'Flow / matching', 'Choices interact across the whole graph.'],
      ],
    ),
    p(
      'The unifying tell is in the third column: greedy fails exactly when a choice now changes what is *available* later in a way the sort key cannot express. If you can state that interaction, you have found your DP state.',
    ),

    h('Common traps'),
    table(
      ['Symptom', 'Cause'],
      [
        ['Passes samples, fails test 4', 'No exchange argument. The greedy is simply wrong.'],
        ['Runtime error in sort (C++)', 'Comparator returns true for equal elements, or overflows.'],
        ['"Comparison method violates contract" (Java)', 'Same — non-strict or inconsistent comparator.'],
        ['Wrong on ties only', 'Tie order matters and was left to the sort. Decide it explicitly.'],
        ['Correct but O(n^2)', 'Rescanning for the best remaining item. Use a heap or a sorted set.'],
        ['Off by one on the last item', 'Loop consumes the greedy choice before checking feasibility.'],
      ],
    ),

    h('Complexity'),
    p(
      'Almost always O(n log n), dominated by the sort. The greedy pass itself is O(n), or O(n log n) when a heap carries the state. If your greedy is O(n^2) you are rescanning — a priority queue or a `set` usually removes the inner loop outright.',
    ),

    links(
      link('Greedy Algorithms with Sorting — USACO Guide', 'https://usaco.guide/silver/greedy-sorting'),
      link('Sorted Sets — USACO Guide', 'https://usaco.guide/silver/intro-sorted-sets'),
      link('Sorting with Custom Comparators — USACO Guide', 'https://usaco.guide/silver/sorting-custom'),
    ),
  ],
};
