import { code, cpp, h, java, link, links, p, table, tip, ul, warn } from './blocks.js';

export default {
  patternSlug: 'sliding-window',
  title: 'Sliding Window',
  summary: 'Grow the window while it stays valid, shrink from the left the moment it breaks.',
  blocks: [
    p(
      'A sliding window is two pointers with a rule. The right pointer only ever moves forward, adding elements. The left pointer only ever moves forward, removing them. Between them sits a contiguous stretch of the array — the window — and the entire algorithm is one question asked at every step: is this window still valid? If yes, record it and keep growing. If no, shrink from the left until it is valid again.',
    ),
    p(
      'Because neither pointer ever moves backwards, the total work is 2n even though the code looks like a nested loop. That is the thing to say out loud in an interview: the inner while loop does not make it quadratic, because across the whole run the left pointer advances at most n times in total. Every element is added once and removed at most once.',
    ),
    p(
      'The pattern only applies when the validity condition is monotonic — when adding an element can only push the window toward invalid, and removing one can only push it back toward valid. Sum of positive numbers has that property. Sum of numbers that may be negative does not, which is exactly why "subarray sum equals k" is a prefix-sum problem and not a window problem.',
    ),

    h('When to reach for it'),
    ul(
      'The problem says "contiguous subarray" or "substring" plus longest, shortest, or a fixed size k.',
      'You are tracking a running property — sum, distinct count, character frequency — over a moving range.',
      'The brute force enumerates every subarray and checks each one, and the check can be updated incrementally.',
      'Words like "at most K distinct", "no repeating characters", "minimum window containing".',
    ),
    warn(
      'Negative numbers break the variable-size window. With negatives, growing the window can lower the sum, so "too big, shrink" is no longer sound. Reach for prefix sums plus a hash map instead.',
    ),

    h('The core idea'),
    p(
      'Fixed size k is the simpler shape and worth writing separately: add the incoming element, and once the window is full, remove the outgoing one. There is no inner loop at all.',
    ),
    code(
      java(`
// Maximum sum of any window of exactly k elements
public int maxSum(int[] nums, int k) {
    int sum = 0, best = Integer.MIN_VALUE;
    for (int r = 0; r < nums.length; r++) {
        sum += nums[r];
        if (r >= k) sum -= nums[r - k];     // slide: drop what fell off the left
        if (r >= k - 1) best = Math.max(best, sum);
    }
    return best;
}
      `),
      cpp(`
int maxSum(vector<int>& nums, int k) {
    long long sum = 0;
    int best = INT_MIN;
    for (int r = 0; r < (int)nums.size(); r++) {
        sum += nums[r];
        if (r >= k) sum -= nums[r - k];
        if (r >= k - 1) best = max<long long>(best, sum);
    }
    return best;
}
      `),
    ),
    p(
      'Variable size is the shape most problems want. The skeleton never changes: expand unconditionally, shrink while invalid, record after the window is valid again.',
    ),
    code(
      java(`
// Longest substring without repeating characters
public int lengthOfLongestSubstring(String s) {
    Map<Character, Integer> count = new HashMap<>();
    int left = 0, best = 0;

    for (int right = 0; right < s.length(); right++) {
        char c = s.charAt(right);
        count.merge(c, 1, Integer::sum);          // 1. expand

        while (count.get(c) > 1) {                // 2. shrink while invalid
            char out = s.charAt(left++);
            if (count.merge(out, -1, Integer::sum) == 0) count.remove(out);
        }

        best = Math.max(best, right - left + 1);  // 3. record, now valid
    }
    return best;
}
      `),
      cpp(`
int lengthOfLongestSubstring(string s) {
    unordered_map<char, int> count;
    int left = 0, best = 0;

    for (int right = 0; right < (int)s.size(); right++) {
        count[s[right]]++;                        // 1. expand

        while (count[s[right]] > 1) {             // 2. shrink while invalid
            if (--count[s[left]] == 0) count.erase(s[left]);
            left++;
        }

        best = max(best, right - left + 1);       // 3. record
    }
    return best;
}
      `),
    ),
    p(
      'Removing the key when its count hits zero is not tidiness. When validity is measured by map size — "at most K distinct characters" — a lingering zero-count entry inflates the size and silently breaks the condition.',
    ),

    h('Variations'),
    p(
      'Shortest instead of longest. The only structural change is where you record: shrink as far as you can while the window is still valid, and take the minimum inside that loop rather than after it.',
    ),
    code(
      java(`
// Smallest subarray with sum >= target (positive numbers only)
public int minSubArrayLen(int target, int[] nums) {
    int left = 0, sum = 0, best = Integer.MAX_VALUE;
    for (int right = 0; right < nums.length; right++) {
        sum += nums[right];
        while (sum >= target) {                       // still valid — try smaller
            best = Math.min(best, right - left + 1);
            sum -= nums[left++];
        }
    }
    return best == Integer.MAX_VALUE ? 0 : best;
}
      `),
    ),
    p(
      'Window plus a counter map — the "minimum window substring" shape. Track how many required characters are still unsatisfied rather than comparing whole maps, so validity is an integer test instead of an O(alphabet) scan.',
    ),
    code(
      java(`
public String minWindow(String s, String t) {
    if (t.length() > s.length()) return "";
    int[] need = new int[128];
    for (char c : t.toCharArray()) need[c]++;

    int missing = t.length();          // how many still to satisfy
    int left = 0, bestLen = Integer.MAX_VALUE, bestStart = 0;

    for (int right = 0; right < s.length(); right++) {
        // only characters we still need decrement "missing"
        if (need[s.charAt(right)]-- > 0) missing--;

        while (missing == 0) {                       // valid — tighten
            if (right - left + 1 < bestLen) {
                bestLen = right - left + 1;
                bestStart = left;
            }
            if (++need[s.charAt(left++)] > 0) missing++;
        }
    }
    return bestLen == Integer.MAX_VALUE ? "" : s.substring(bestStart, bestStart + bestLen);
}
      `),
    ),
    p(
      'The "at most K" trick. Problems asking for exactly K distinct are usually easier solved as atMost(K) − atMost(K−1). Exact counts do not slide monotonically; at-most counts do, so you write one clean window function and call it twice.',
    ),
    code(
      java(`
public int exactlyK(int[] nums, int k) {
    return atMost(nums, k) - atMost(nums, k - 1);
}

private int atMost(int[] nums, int k) {
    Map<Integer, Integer> count = new HashMap<>();
    int left = 0, total = 0;
    for (int right = 0; right < nums.length; right++) {
        count.merge(nums[right], 1, Integer::sum);
        while (count.size() > k) {
            if (count.merge(nums[left], -1, Integer::sum) == 0) count.remove(nums[left]);
            left++;
        }
        total += right - left + 1;   // every window ending at right is valid
    }
    return total;
}
      `),
    ),

    h('Language toolkit'),
    table(
      ['Java', 'What it does', 'C++ equivalent'],
      [
        ['s.charAt(i)', 'Char at an index, no allocation.', 's[i]'],
        ['s.substring(a, b)', 'Copy of [a, b). O(n) since Java 7 — do it once at the end.', 's.substr(a, b - a)'],
        ['map.merge(k, -1, Integer::sum)', 'Decrement and read the new value in one call.', '--m[k]'],
        ['map.remove(k)', 'Drop a zero count so size() stays honest.', 'm.erase(k)'],
        ['map.size()', 'Distinct-element count — the validity test.', 'm.size()'],
        ['new int[128]', 'ASCII counting table; faster than a map.', 'array<int,128> a{}'],
        ['ArrayDeque<Integer>', 'Monotonic deque for sliding-window max.', 'std::deque<int>'],
      ],
    ),
    warn(
      'Java substring is a real copy, not a view — it has been O(n) since Java 7. Calling it inside the loop to test candidates turns an O(n) window into O(n²). Track indices and slice once at the end.',
    ),

    h('Complexity'),
    table(
      ['Shape', 'Time', 'Space', 'Note'],
      [
        ['Fixed window of k', 'O(n)', 'O(1)', 'No inner loop at all.'],
        ['Variable window', 'O(n)', 'O(k)', 'Each pointer advances at most n times in total.'],
        ['Window + counter map', 'O(n)', 'O(alphabet)', 'O(1) space when the alphabet is bounded.'],
        ['Sliding-window maximum', 'O(n)', 'O(k)', 'Monotonic deque; each index enters and leaves once.'],
        ['Brute force over all subarrays', 'O(n²) or O(n³)', 'O(1)', 'What the window replaces.'],
      ],
    ),

    h('Common mistakes'),
    ul(
      'Using if instead of while to shrink. One removal is rarely enough to restore validity.',
      'Recording the answer before restoring validity, so an invalid window gets counted.',
      'Leaving zero-count keys in the map when the validity test is map.size().',
      'Applying a window to an array with negative numbers. Growing can shrink the sum, so the shrink rule is unsound.',
      'Calling substring or building a new string inside the loop, quietly making it O(n²).',
      'Off-by-one in the length: it is right − left + 1 when both ends are inclusive.',
      'Forgetting that a fixed-size window only has an answer once r >= k − 1.',
    ),

    tip(
      'Write the three comments — expand, shrink while invalid, record — before you write any code. Nearly every sliding-window bug is one of those three steps in the wrong order.',
    ),

    links(
      link('LeetCode Explore — Arrays and Strings', 'https://leetcode.com/explore/learn/card/array-and-string/'),
      link('Java String — API reference', 'https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/String.html'),
    ),
  ],
};
