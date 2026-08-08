import { code, cpp, h, java, link, links, p, table, tip, ul, warn } from './blocks.js';

export default {
  patternSlug: 'binary-search',
  title: 'Binary Search',
  summary:
    'Not just for sorted arrays — binary search the answer whenever feasibility is monotonic.',
  blocks: [
    p(
      'Binary search is usually taught as "find a number in a sorted array", which undersells it badly. The real requirement is weaker and far more useful: you need a search space and a yes/no test that flips exactly once across it. If everything below some threshold answers no and everything above answers yes, you can find the threshold in O(log n) — whether the space is an array of numbers or the abstract range of possible answers to the question you were actually asked.',
    ),
    p(
      'That second form is what interviewers mean by "binary search the answer". Can we ship all packages in 8 days? If yes, try fewer days; if no, try more. The array is never sorted because there is no array — the sorted thing is the boolean answer to your own feasibility function. Recognising that is worth more than memorising the loop.',
    ),
    p(
      'The loop itself is where people lose points, and always for the same three reasons: an overflowing midpoint, a boundary update that fails to shrink the range, and confusion about whether the invariant is inclusive or exclusive. Pick one template, understand its invariant, and use it every time.',
    ),

    h('When to reach for it'),
    ul(
      'The input is sorted, or rotated-sorted, and you need a position.',
      'You need the first or last element satisfying some property — lower bound, upper bound, insertion point.',
      'The answer is a number in a known range and you can cheaply test whether a candidate works.',
      'The constraints show n up to 10^5 or more with a required complexity better than O(n) per query.',
      'Words like "minimum capacity", "smallest k such that", "minimise the maximum".',
    ),
    tip(
      'A quick check for the answer-space form: fix a candidate answer and ask "if this works, does every larger value also work?" If yes, the predicate is monotonic and binary search applies.',
    ),

    h('The core idea'),
    p(
      'The classic. Note the midpoint: writing (lo + hi) / 2 overflows once lo + hi exceeds 2^31 − 1, which is reachable with large arrays. lo + (hi − lo) / 2 never does.',
    ),
    code(
      java(`
// Exact match on a sorted array — inclusive bounds
public int search(int[] nums, int target) {
    int lo = 0, hi = nums.length - 1;
    while (lo <= hi) {                       // <= because hi is a real index
        int mid = lo + (hi - lo) / 2;        // NOT (lo + hi) / 2 — overflow
        if (nums[mid] == target) return mid;
        if (nums[mid] < target) lo = mid + 1;
        else                    hi = mid - 1;
    }
    return -1;
}
      `),
      cpp(`
int search(vector<int>& nums, int target) {
    int lo = 0, hi = (int)nums.size() - 1;
    while (lo <= hi) {
        int mid = lo + (hi - lo) / 2;
        if (nums[mid] == target) return mid;
        if (nums[mid] < target) lo = mid + 1;
        else                    hi = mid - 1;
    }
    return -1;
}
      `),
    ),
    p(
      'The boundary template. This is the one worth memorising, because it answers more questions than exact match does: it finds the first index where a predicate becomes true. Bounds are half-open, the loop runs while lo < hi, and it converges on a single index without any special-casing.',
    ),
    code(
      java(`
// First index where predicate(i) is true. Returns nums.length if never.
int lo = 0, hi = nums.length;          // hi is one PAST the last index
while (lo < hi) {                      // < because hi is exclusive
    int mid = lo + (hi - lo) / 2;
    if (predicate(mid)) hi = mid;      // mid might be the answer — keep it
    else                lo = mid + 1;  // mid is definitely not — discard it
}
return lo;                             // lo == hi == the boundary
      `),
      cpp(`
int lo = 0, hi = (int)nums.size();
while (lo < hi) {
    int mid = lo + (hi - lo) / 2;
    if (predicate(mid)) hi = mid;
    else                lo = mid + 1;
}
return lo;
      `),
    ),
    warn(
      'The asymmetry is deliberate. hi = mid, not mid − 1, because mid may itself be the answer. lo = mid + 1, not mid, because mid has been ruled out and lo = mid would loop forever. Any template that sets both to mid will hang.',
    ),

    h('Variations'),
    p(
      'First and last occurrence. With the boundary template, both fall out of the same function: the first index where value >= target, and the first where value > target. The count of a value is the gap between them.',
    ),
    code(
      java(`
private int lowerBound(int[] a, int target) {      // first index with a[i] >= target
    int lo = 0, hi = a.length;
    while (lo < hi) {
        int mid = lo + (hi - lo) / 2;
        if (a[mid] >= target) hi = mid; else lo = mid + 1;
    }
    return lo;
}
private int upperBound(int[] a, int target) {      // first index with a[i] > target
    int lo = 0, hi = a.length;
    while (lo < hi) {
        int mid = lo + (hi - lo) / 2;
        if (a[mid] > target) hi = mid; else lo = mid + 1;
    }
    return lo;
}
// occurrences of target == upperBound - lowerBound
      `),
      cpp(`
// The STL already has these — same semantics, on any sorted range
auto lo = lower_bound(a.begin(), a.end(), target);   // first >= target
auto hi = upper_bound(a.begin(), a.end(), target);   // first  > target
int count = hi - lo;
bool present = lo != a.end() && *lo == target;
      `),
    ),
    p(
      'Rotated sorted array. Half of the array is always sorted, even after a rotation. Work out which half by comparing the midpoint with the left end, then decide whether the target lies inside that sorted half.',
    ),
    code(
      java(`
public int search(int[] nums, int target) {
    int lo = 0, hi = nums.length - 1;
    while (lo <= hi) {
        int mid = lo + (hi - lo) / 2;
        if (nums[mid] == target) return mid;

        if (nums[lo] <= nums[mid]) {                 // left half is sorted
            if (nums[lo] <= target && target < nums[mid]) hi = mid - 1;
            else                                          lo = mid + 1;
        } else {                                     // right half is sorted
            if (nums[mid] < target && target <= nums[hi]) lo = mid + 1;
            else                                          hi = mid - 1;
        }
    }
    return -1;
}
      `),
    ),
    p(
      'Binary search on the answer. The search space is a range of candidate answers, and the predicate is a helper that simulates the problem. Koko eating bananas is the archetype: speed is the answer, and feasible(speed) counts the hours needed.',
    ),
    code(
      java(`
// Smallest eating speed that finishes within h hours
public int minEatingSpeed(int[] piles, int h) {
    int lo = 1, hi = 0;
    for (int p : piles) hi = Math.max(hi, p);     // fastest useful speed

    while (lo < hi) {                              // boundary template again
        int mid = lo + (hi - lo) / 2;
        if (feasible(piles, mid, h)) hi = mid;
        else                          lo = mid + 1;
    }
    return lo;
}

private boolean feasible(int[] piles, int speed, int h) {
    long hours = 0;
    for (int p : piles) hours += (p + speed - 1) / speed;   // ceil without floats
    return hours <= h;
}
      `),
      cpp(`
int minEatingSpeed(vector<int>& piles, int h) {
    int lo = 1, hi = *max_element(piles.begin(), piles.end());
    auto feasible = [&](int speed) {
        long long hours = 0;
        for (int p : piles) hours += (p + speed - 1) / speed;
        return hours <= h;
    };
    while (lo < hi) {
        int mid = lo + (hi - lo) / 2;
        if (feasible(mid)) hi = mid; else lo = mid + 1;
    }
    return lo;
}
      `),
    ),
    tip(
      'Ceiling division without floating point: (a + b − 1) / b for non-negative integers. Doubles lose precision at large values and will fail a hidden test case eventually.',
    ),

    h('Language toolkit'),
    table(
      ['Java', 'What it does', 'C++ equivalent'],
      [
        ['Arrays.binarySearch(a, key)', 'Index if found, else −(insertion point) − 1.', 'lower_bound + a check'],
        ['—', 'First element >= value.', 'lower_bound(first, last, v)'],
        ['—', 'First element > value.', 'upper_bound(first, last, v)'],
        ['—', 'Membership test on a sorted range.', 'binary_search(first, last, v)'],
        ['Collections.binarySearch(list, k)', 'Same contract for Lists.', 'lower_bound on a vector'],
        ['TreeMap.ceilingKey(k) / floorKey(k)', 'Binary search over a sorted map.', 'map::lower_bound(k)'],
        ['TreeMap.higherKey / lowerKey', 'Strictly greater / strictly less.', 'map::upper_bound(k)'],
        ['lo + (hi - lo) / 2', 'Overflow-safe midpoint.', 'lo + (hi - lo) / 2'],
      ],
    ),
    warn(
      'Arrays.binarySearch has a hostile return value: a negative number encoding the insertion point as −(point) − 1, and undefined behaviour if the array is not sorted. It also gives no guarantee about which index you get among duplicates. For anything involving duplicates or boundaries, write the loop.',
    ),

    h('Complexity'),
    table(
      ['Operation', 'Time', 'Space', 'Note'],
      [
        ['Search a sorted array', 'O(log n)', 'O(1)', 'Iterative; recursion costs O(log n) stack.'],
        ['Sort, then binary search', 'O(n log n)', 'O(1)–O(n)', 'Only worth it for repeated queries.'],
        ['Binary search on the answer', 'O(log R · C)', 'O(1)', 'R = range size, C = cost of the check.'],
        ['lower_bound / upper_bound', 'O(log n)', 'O(1)', 'Random-access iterators only.'],
        ['TreeMap ceiling / floor', 'O(log n)', 'O(1)', 'Red-black tree, not an array.'],
      ],
    ),
    p(
      'For the answer-space form, note the range is over values rather than indices, so the log is of the numeric range, not n. A range of 10^9 is 30 iterations — cheap even when the feasibility check is O(n).',
    ),

    h('Common mistakes'),
    ul(
      'Using (lo + hi) / 2 and overflowing int. It is a real failure at large n, and interviewers watch for it.',
      'Mixing templates: inclusive hi with a lo < hi loop, or exclusive hi with lo <= hi. Pick one and keep the invariant straight.',
      'Setting hi = mid inside a lo <= hi loop, which never terminates when lo == hi.',
      'Returning mid from a boundary search instead of lo. The loop converges on lo; mid is stale.',
      'Forgetting that the predicate must be monotonic. If feasibility flips more than once, binary search finds an arbitrary flip, not the one you wanted.',
      'Binary searching an unsorted array because the problem said "search" — check the ordering assumption first.',
      'Using floating-point division for ceilings instead of (a + b − 1) / b.',
    ),

    links(
      link('LeetCode Explore — Binary Search', 'https://leetcode.com/explore/learn/card/binary-search/'),
      link('Java Arrays.binarySearch — API reference', 'https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/Arrays.html'),
      link('C++ std::lower_bound — reference', 'https://en.cppreference.com/w/cpp/algorithm/lower_bound'),
    ),
  ],
};
