import { code, cpp, h, java, link, links, p, table, tip, ul, warn } from './blocks.js';

export default {
  patternSlug: 'greedy',
  title: 'Greedy',
  summary: 'Take the locally best move — but only after you can argue why it never loses.',
  blocks: [
    p(
      'A greedy algorithm makes the choice that looks best right now and never revisits it. That is the whole idea, and it is why greedy solutions are short, fast, and dangerous. The code is usually a sort followed by one loop; the difficulty is entirely in knowing whether the greedy choice is actually safe, because when it is not, you get a plausible answer that is quietly wrong on inputs you did not think of.',
    ),
    p(
      'The property you need is the exchange argument: if some optimal solution disagrees with your greedy choice, you can swap the greedy choice in without making the solution worse. If that holds at every step, greedy is optimal. If it does not, you are looking at a dynamic programming problem — and the tell is usually that a locally worse choice now unlocks something much better later.',
    ),
    p(
      'Coin change is the standard illustration. With coins {1, 5, 10, 25} greedily taking the largest works. With {1, 3, 4} and a target of 6, greedy takes 4 + 1 + 1 = three coins while the optimum is 3 + 3 = two. Same algorithm, same code, different coin set — and nothing in the code tells you which case you are in. That is why the argument matters more than the implementation.',
    ),

    h('When to reach for it'),
    ul(
      '"Maximum number of", "minimum number of", "can you reach" with an obvious local move.',
      'Interval scheduling: fit the most meetings, remove the fewest overlaps.',
      'Jump games and reachability where you track the furthest point attainable so far.',
      'Problems that become trivial once sorted by the right key.',
      'A running best or running deficit — maximum subarray, gas station, stock profit.',
    ),
    warn(
      'If a locally suboptimal choice can pay off later, greedy is wrong. Test your instinct against a small adversarial example before committing — that thirty seconds is the difference between a correct solution and one that fails a hidden case.',
    ),

    h('The core idea'),
    p(
      'Sort by the right key, then sweep. Choosing that key is the entire problem. For non-overlapping intervals, sorting by end time is correct and sorting by start time is not: finishing earliest leaves the most room for everything after it.',
    ),
    code(
      java(`
// Maximum number of non-overlapping intervals
public int maxNonOverlapping(int[][] intervals) {
    Arrays.sort(intervals, Comparator.comparingInt(a -> a[1]));   // by END time

    int count = 0, lastEnd = Integer.MIN_VALUE;
    for (int[] interval : intervals) {
        if (interval[0] >= lastEnd) {      // starts after the last one finished
            count++;
            lastEnd = interval[1];
        }
    }
    return count;
}
      `),
      cpp(`
int maxNonOverlapping(vector<vector<int>>& intervals) {
    sort(intervals.begin(), intervals.end(),
         [](const auto& a, const auto& b) { return a[1] < b[1]; });   // by END

    int count = 0;
    int lastEnd = INT_MIN;
    for (auto& interval : intervals) {
        if (interval[0] >= lastEnd) {
            count++;
            lastEnd = interval[1];
        }
    }
    return count;
}
      `),
    ),
    p(
      'The exchange argument here: take any optimal schedule. Its first meeting ends no earlier than the greedy first choice, so swapping in the greedy one cannot cause a conflict and leaves at least as much room. Repeat, and greedy matches the optimum. That paragraph is what an interviewer wants to hear.',
    ),
    p(
      'Running best. Kadane\'s algorithm is greedy in disguise: at each element, decide whether the best subarray ending here extends the previous one or starts fresh. A negative running sum can never help, so drop it.',
    ),
    code(
      java(`
public int maxSubArray(int[] nums) {
    int best = nums[0], current = nums[0];
    for (int i = 1; i < nums.length; i++) {
        // extending a negative prefix is never better than starting over
        current = Math.max(nums[i], current + nums[i]);
        best = Math.max(best, current);
    }
    return best;
}
      `),
      cpp(`
int maxSubArray(vector<int>& nums) {
    int best = nums[0], current = nums[0];
    for (size_t i = 1; i < nums.size(); i++) {
        current = max(nums[i], current + nums[i]);
        best = max(best, current);
    }
    return best;
}
      `),
    ),

    h('Variations'),
    p(
      'Furthest reachable. Jump Game does not need to try every jump — it only needs the furthest index reachable so far. If the loop ever stands beyond that, the array is impassable.',
    ),
    code(
      java(`
public boolean canJump(int[] nums) {
    int furthest = 0;
    for (int i = 0; i < nums.length; i++) {
        if (i > furthest) return false;                 // a gap we cannot cross
        furthest = Math.max(furthest, i + nums[i]);
    }
    return true;
}

// Minimum jumps — the same idea, counting level boundaries like a BFS
public int jump(int[] nums) {
    int jumps = 0, currentEnd = 0, furthest = 0;
    for (int i = 0; i < nums.length - 1; i++) {
        furthest = Math.max(furthest, i + nums[i]);
        if (i == currentEnd) {          // exhausted this jump's range
            jumps++;
            currentEnd = furthest;
        }
    }
    return jumps;
}
      `),
    ),
    p(
      'Running deficit. Gas Station looks like it needs every start tried, but there is a two-part argument that makes it one pass: if total gas is at least total cost a solution exists, and if you run dry between i and j then no station in that range can be the answer, so restart at j + 1.',
    ),
    code(
      java(`
public int canCompleteCircuit(int[] gas, int[] cost) {
    int total = 0, tank = 0, start = 0;
    for (int i = 0; i < gas.length; i++) {
        int diff = gas[i] - cost[i];
        total += diff;
        tank  += diff;
        if (tank < 0) {          // nothing from start..i can work
            start = i + 1;
            tank = 0;
        }
    }
    return total >= 0 ? start : -1;
}
      `),
    ),
    p(
      'Greedy with a heap. Sometimes the local best is not available from a sort because it changes as you go — then the priority queue supplies it. Scheduling the most frequent task first, or always merging the two cheapest piles, both take this shape.',
    ),
    code(
      java(`
// Always consume the currently most frequent item
PriorityQueue<Integer> heap = new PriorityQueue<>(Comparator.reverseOrder());
for (int count : frequencies) heap.offer(count);

while (heap.size() > 1) {
    int a = heap.poll(), b = heap.poll();      // the two largest right now
    if (--a > 0) heap.offer(a);
    if (--b > 0) heap.offer(b);
    steps++;
}
      `),
    ),
    tip(
      'When the greedy key changes as you consume elements, that is the signal for a heap rather than a sort. A sort fixes the order once; a heap re-derives the best choice after every step.',
    ),

    h('Language toolkit'),
    table(
      ['Java', 'What it does', 'C++ equivalent'],
      [
        ['Arrays.sort(a, Comparator.comparingInt(x -> x[1]))', 'Sort by a chosen key.', 'sort(v.begin(), v.end(), lambda)'],
        ['Comparator.comparingInt(...).thenComparing(...)', 'Tie-break on a second key.', 'compare .first then .second'],
        ['Comparator.reverseOrder()', 'Descending.', 'greater<T>()'],
        ['Integer.MIN_VALUE / MAX_VALUE', 'Sentinels for running best/worst.', 'INT_MIN / INT_MAX'],
        ['Math.max(a, b)', 'Running best.', 'max(a, b)'],
        ['PriorityQueue', 'Local best that changes as you go.', 'priority_queue'],
        ['Integer.compare(a, b)', 'Overflow-safe comparison in a comparator.', 'a < b'],
      ],
    ),
    warn(
      'Arrays.sort on an int[][] sorts rows by the comparator you give — but there is no default row ordering, so the comparator is not optional. And never write (a, b) -> a[0] - b[0] with large values; the subtraction overflows.',
    ),

    h('Complexity'),
    table(
      ['Shape', 'Time', 'Space', 'Note'],
      [
        ['Sort then one sweep', 'O(n log n)', 'O(1)–O(n)', 'The sort dominates.'],
        ['Single pass, running best', 'O(n)', 'O(1)', 'Kadane, jump game, gas station.'],
        ['Greedy with a heap', 'O(n log n)', 'O(n)', 'A heap operation per step.'],
        ['Interval scheduling', 'O(n log n)', 'O(1)', 'Sort by end, then sweep.'],
        ['DP alternative', 'O(n²) or worse', 'O(n)', 'What greedy saves you — when it is valid.'],
      ],
    ),

    h('Common mistakes'),
    ul(
      'Assuming greedy works because it passes the examples. Construct a small counter-example on purpose before committing.',
      'Sorting by start time for interval scheduling instead of end time.',
      'Using greedy where a locally worse move unlocks a better outcome — that is DP.',
      'Overflowing a comparator with subtraction.',
      'Forgetting the tie-break, which for intervals decides whether touching endpoints count as overlapping. Read the problem on whether [1,2] and [2,3] conflict.',
      'Not handling the empty or single-element input, which greedy loops with a "previous" variable often break on.',
      'Re-sorting inside a loop, turning O(n log n) into O(n² log n).',
    ),

    tip(
      'Write the exchange argument as one sentence before writing code: "swapping the greedy choice into any optimal solution keeps it optimal, because …". If you cannot finish it, do not trust the algorithm.',
    ),

    links(
      link('Java Comparator — API reference', 'https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/Comparator.html'),
      link('LeetCode Explore — Arrays 101', 'https://leetcode.com/explore/learn/card/fun-with-arrays/'),
    ),
  ],
};
