import { code, cpp, h, java, link, links, p, table, tip, ul, warn } from './blocks.js';

export default {
  patternSlug: 'prefix-sum',
  title: 'Prefix Sum',
  summary: 'Precompute running totals so any range query becomes one subtraction.',
  blocks: [
    p(
      'If someone asks you for the sum of elements between index i and j, the obvious answer is a loop. If they ask a thousand times, the loop is the problem — you keep re-adding the same numbers. A prefix array fixes this once: prefix[k] holds the sum of everything before index k, so the sum of any range is prefix[j+1] − prefix[i]. One subtraction, no loop, however many queries come.',
    ),
    p(
      'The deeper use is subtler and shows up far more often in interviews. Once you have running totals, "does a subarray summing to k exist?" becomes "have I seen the value (current − k) before?" — which is a hash-map lookup. That single reframing turns an O(n²) scan over all subarrays into one pass, and it is the reason this pattern sits next to hashing rather than off on its own.',
    ),

    h('When to reach for it'),
    ul(
      'Repeated range-sum queries over an array that does not change between queries.',
      'Counting subarrays whose sum equals, or is divisible by, some target.',
      'The words "contiguous subarray" plus a sum, product, or XOR condition.',
      'A 2-D grid with repeated rectangle-sum queries.',
      'Many range updates followed by one read — that is the difference array, the inverse of this trick.',
    ),
    warn(
      'Prefix sums assume the array is static. If elements change between queries you want a Fenwick tree or segment tree instead — rebuilding the prefix array after every update is O(n) per update and defeats the point.',
    ),

    h('The core idea'),
    p(
      'Build the array with one extra slot at the front holding 0. That sentinel is not decoration — it is what makes the range formula work when i is 0, without a special case.',
    ),
    code(
      java(`
// prefix[k] = sum of nums[0..k-1], so prefix[0] = 0
int[] prefix = new int[nums.length + 1];
for (int i = 0; i < nums.length; i++) {
    prefix[i + 1] = prefix[i] + nums[i];
}

// sum of nums[i..j] inclusive — O(1)
int rangeSum(int i, int j) {
    return prefix[j + 1] - prefix[i];
}
      `),
      cpp(`
vector<long long> prefix(nums.size() + 1, 0);
for (size_t i = 0; i < nums.size(); i++) {
    prefix[i + 1] = prefix[i] + nums[i];
}

// sum of nums[i..j] inclusive — O(1)
long long rangeSum(int i, int j) {
    return prefix[j + 1] - prefix[i];
}
      `),
    ),
    tip(
      'Use long / long long for the prefix array whenever the values can be large. n elements of up to 10^9 overflow a 32-bit int at around n = 3. This is the single most common silent failure in the pattern.',
    ),

    h('Variations'),
    p(
      'Prefix plus hash map — counting subarrays that sum to k. Walk the array keeping a running sum. At each index, the number of subarrays ending here with sum k is the number of times the running sum has previously been (sum − k). Seed the map with {0: 1} so a prefix that equals k on its own is counted.',
    ),
    code(
      java(`
public int subarraySum(int[] nums, int k) {
    Map<Integer, Integer> seen = new HashMap<>();
    seen.put(0, 1);              // the empty prefix — do not forget this

    int sum = 0, count = 0;
    for (int n : nums) {
        sum += n;
        count += seen.getOrDefault(sum - k, 0);
        seen.merge(sum, 1, Integer::sum);
    }
    return count;
}
      `),
      cpp(`
int subarraySum(vector<int>& nums, int k) {
    unordered_map<long long, int> seen{{0, 1}};
    long long sum = 0;
    int count = 0;
    for (int n : nums) {
        sum += n;
        auto it = seen.find(sum - k);
        if (it != seen.end()) count += it->second;
        seen[sum]++;
    }
    return count;
}
      `),
    ),
    p(
      'The map stores counts, not indices, because the question is "how many", not "where". If the question were the longest such subarray, the map would store the earliest index for each prefix and you would never overwrite an existing entry.',
    ),
    p(
      'Divisibility by k. Instead of the raw sum, key the map by sum mod k. Two prefixes with the same remainder bound a subarray whose sum is divisible by k. In Java the modulo of a negative number is negative, so you must normalise it back into range.',
    ),
    code(
      java(`
int r = ((sum % k) + k) % k;   // Java: -1 % 5 == -1, so add k and mod again
count += seen.getOrDefault(r, 0);
seen.merge(r, 1, Integer::sum);
      `),
      cpp(`
int r = ((sum % k) + k) % k;   // C++ has the same truncated-division behaviour
count += seen[r];
seen[r]++;
      `),
    ),
    p(
      'Two-dimensional prefix. For rectangle sums, prefix[r][c] holds the sum of the whole rectangle from the origin. Any sub-rectangle is inclusion–exclusion: total, minus the strip above, minus the strip left, plus the corner you subtracted twice.',
    ),
    code(
      java(`
// pre[r+1][c+1] = sum of grid[0..r][0..c]
int[][] pre = new int[m + 1][n + 1];
for (int r = 0; r < m; r++)
    for (int c = 0; c < n; c++)
        pre[r + 1][c + 1] = grid[r][c]
                          + pre[r][c + 1] + pre[r + 1][c]
                          - pre[r][c];               // added twice, remove once

// sum of the rectangle (r1,c1)..(r2,c2) inclusive
int region(int r1, int c1, int r2, int c2) {
    return pre[r2 + 1][c2 + 1] - pre[r1][c2 + 1] - pre[r2 + 1][c1] + pre[r1][c1];
}
      `),
    ),
    p(
      'Difference array — the mirror image. When you have many range updates and only read at the end, do the opposite: record +v at the start and −v just past the end, then take a prefix sum once to materialise the array. Each update becomes O(1) instead of O(range).',
    ),
    code(
      java(`
int[] diff = new int[n + 1];
for (int[] op : operations) {          // add v to [l, r]
    diff[op[0]] += op[2];
    diff[op[1] + 1] -= op[2];
}
int[] out = new int[n];
int running = 0;
for (int i = 0; i < n; i++) {
    running += diff[i];
    out[i] = running;
}
      `),
    ),

    h('Language toolkit'),
    table(
      ['Java', 'What it does', 'C++ equivalent'],
      [
        ['new long[n + 1]', 'Zero-filled; the +1 is the sentinel slot.', 'vector<long long> p(n+1, 0)'],
        ['Math.floorMod(a, b)', 'Always-non-negative modulo — no manual fix-up.', '((a % b) + b) % b'],
        ['Arrays.fill(a, v)', 'Bulk initialise.', 'fill(v.begin(), v.end(), x)'],
        ['map.merge(k, 1, Integer::sum)', 'Count occurrences of a prefix value.', 'm[k]++'],
        ['new int[m + 1][n + 1]', 'Rectangular 2-D array, zero-filled.', 'vector<vector<int>> p(m+1, vector<int>(n+1))'],
        ['Integer.MAX_VALUE', '2147483647 — the ceiling you overflow past.', 'INT_MAX (<climits>)'],
      ],
    ),
    tip(
      'Math.floorMod(sum, k) is the clean way to handle negative remainders in Java — it is what ((sum % k) + k) % k is doing, with the intent visible in the name.',
    ),

    h('Complexity'),
    table(
      ['Operation', 'Time', 'Space', 'Note'],
      [
        ['Build the prefix array', 'O(n)', 'O(n)', 'Paid once.'],
        ['One range query', 'O(1)', '—', 'The entire point.'],
        ['q queries, naive', 'O(n·q)', 'O(1)', 'What you are replacing.'],
        ['q queries, prefix', 'O(n + q)', 'O(n)', 'Worth it as soon as q is more than a couple.'],
        ['Subarray-sum-equals-k', 'O(n)', 'O(n)', 'Prefix + hash map, one pass.'],
        ['2-D build / query', 'O(m·n) / O(1)', 'O(m·n)', 'Four array reads per query.'],
      ],
    ),

    h('Common mistakes'),
    ul(
      'Overflowing int on the running sum. Use long in Java, long long in C++, and do it before it bites.',
      'Forgetting seen.put(0, 1) in the hash-map variant, which loses every subarray that starts at index 0.',
      'Off-by-one in the range formula. With the leading zero, the sum of nums[i..j] is prefix[j+1] − prefix[i] — write it down once and stop re-deriving it under pressure.',
      'Negative modulo in Java producing a negative bucket key. Normalise with floorMod.',
      'Storing counts when the question asks for the longest subarray. Longest needs the earliest index, and you must not overwrite an existing entry.',
      'Using prefix sums on an array that gets updated between queries — that is a Fenwick tree problem wearing a prefix-sum disguise.',
    ),

    links(
      link('LeetCode Explore — Arrays 101', 'https://leetcode.com/explore/learn/card/fun-with-arrays/'),
      link('Java Math.floorMod — API reference', 'https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/Math.html'),
    ),
  ],
};
