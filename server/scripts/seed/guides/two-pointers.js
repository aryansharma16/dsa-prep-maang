import { code, cpp, h, java, link, links, p, table, tip, ul, warn } from './blocks.js';

export default {
  patternSlug: 'two-pointers',
  title: 'Two Pointers',
  summary:
    'On sorted or symmetric data, walk from both ends and let the comparison decide which side moves.',
  blocks: [
    p(
      'Two pointers is what you get when a nested loop has enough structure that you never need to go backwards. In a brute-force pair search you try every i with every j. But if the array is sorted, the comparison at any pair tells you something about every pair you have not tried yet — if the sum is too small, no smaller j will help, so the left pointer can move forward and never come back. Each pointer crosses the array at most once, so two nested loops become one pass.',
    ),
    p(
      'The pattern shows up in three distinct shapes that people often lump together. Opposite ends, where two pointers close in on each other. Fast and slow, where both start at the front and move at different rates. And read/write, where one pointer scans and the other marks where the next kept element goes. They share a name because they share the discipline: every step must make provable progress, and the loop must be able to argue why it never skipped an answer.',
    ),

    h('When to reach for it'),
    ul(
      'The input is sorted, or you are allowed to sort it, and you are looking for a pair or triple with some property.',
      'The problem is symmetric — palindromes, reversal, matching from both ends.',
      'You are removing or de-duplicating in place and the interviewer said O(1) extra space.',
      'You need a cycle, a midpoint, or the k-th node from the end of a linked list in one pass.',
      'The brute force is O(n²) but the check at each pair is monotonic — too small always means "move left up", too big always means "move right down".',
    ),
    warn(
      'Sorting to enable two pointers costs O(n log n) and destroys the original indices. If the answer must report original positions, either store index pairs before sorting or use a hash map instead.',
    ),

    h('The core idea'),
    p(
      'Opposite ends. Start wide, and let the comparison pick a side. The invariant is that the answer, if it exists, always lies between the two pointers — which is exactly why discarding one side is safe.',
    ),
    code(
      java(`
// Two Sum II — input is sorted, return 1-indexed positions
public int[] twoSum(int[] numbers, int target) {
    int lo = 0, hi = numbers.length - 1;
    while (lo < hi) {
        int sum = numbers[lo] + numbers[hi];
        if (sum == target)   return new int[] { lo + 1, hi + 1 };
        else if (sum < target) lo++;   // need bigger; only lo can help
        else                   hi--;   // need smaller; only hi can help
    }
    return new int[] {};
}
      `),
      cpp(`
// Two Sum II — input is sorted, return 1-indexed positions
vector<int> twoSum(vector<int>& numbers, int target) {
    int lo = 0, hi = (int)numbers.size() - 1;
    while (lo < hi) {
        int sum = numbers[lo] + numbers[hi];
        if (sum == target)   return { lo + 1, hi + 1 };
        else if (sum < target) lo++;
        else                   hi--;
    }
    return {};
}
      `),
    ),
    p(
      'The loop condition is lo < hi, not lo <= hi. With <= the two pointers land on the same element and it pairs with itself — the same self-pairing bug that bites Two Sum, wearing a different hat.',
    ),

    h('Variations'),
    p(
      'Sort then scan, with duplicate skipping. 3Sum is the archetype: fix one element, two-pointer the rest. The part people get wrong is not the pointers, it is the de-duplication — you must skip repeats at all three positions, and only after recording a hit.',
    ),
    code(
      java(`
public List<List<Integer>> threeSum(int[] nums) {
    Arrays.sort(nums);
    List<List<Integer>> out = new ArrayList<>();

    for (int i = 0; i < nums.length - 2; i++) {
        if (nums[i] > 0) break;                       // sorted: no triple can reach 0
        if (i > 0 && nums[i] == nums[i - 1]) continue; // skip duplicate anchors

        int lo = i + 1, hi = nums.length - 1;
        while (lo < hi) {
            int sum = nums[i] + nums[lo] + nums[hi];
            if (sum < 0) lo++;
            else if (sum > 0) hi--;
            else {
                out.add(List.of(nums[i], nums[lo], nums[hi]));
                lo++; hi--;
                // only now skip duplicates, or you skip the answer itself
                while (lo < hi && nums[lo] == nums[lo - 1]) lo++;
                while (lo < hi && nums[hi] == nums[hi + 1]) hi--;
            }
        }
    }
    return out;
}
      `),
      cpp(`
vector<vector<int>> threeSum(vector<int>& nums) {
    sort(nums.begin(), nums.end());
    vector<vector<int>> out;
    int n = nums.size();

    for (int i = 0; i < n - 2; i++) {
        if (nums[i] > 0) break;
        if (i > 0 && nums[i] == nums[i - 1]) continue;

        int lo = i + 1, hi = n - 1;
        while (lo < hi) {
            int sum = nums[i] + nums[lo] + nums[hi];
            if (sum < 0) lo++;
            else if (sum > 0) hi--;
            else {
                out.push_back({nums[i], nums[lo], nums[hi]});
                lo++; hi--;
                while (lo < hi && nums[lo] == nums[lo - 1]) lo++;
                while (lo < hi && nums[hi] == nums[hi + 1]) hi--;
            }
        }
    }
    return out;
}
      `),
    ),
    p(
      'Read and write. One pointer reads every element, the other marks where the next kept element belongs. Everything before the write pointer is the finished answer; everything between them is garbage you are allowed to overwrite. This is how you get O(1) space in-place removal.',
    ),
    code(
      java(`
// Remove duplicates from a sorted array, return the new length
public int removeDuplicates(int[] nums) {
    if (nums.length == 0) return 0;
    int write = 1;                                   // nums[0] is always kept
    for (int read = 1; read < nums.length; read++) {
        if (nums[read] != nums[write - 1]) {
            nums[write++] = nums[read];
        }
    }
    return write;                                    // nums[0..write) is the answer
}
      `),
      cpp(`
int removeDuplicates(vector<int>& nums) {
    if (nums.empty()) return 0;
    int write = 1;
    for (int read = 1; read < (int)nums.size(); read++) {
        if (nums[read] != nums[write - 1]) nums[write++] = nums[read];
    }
    return write;
}
      `),
    ),
    p(
      'Fast and slow. Both start at the front; one takes two steps per one of the other. On a linked list this finds the middle in a single pass, and it is the whole of Floyd\'s cycle detection: if there is a loop, the fast pointer laps the slow one and they must meet.',
    ),
    code(
      java(`
// Middle of a linked list — slow lands on the middle when fast runs out
ListNode slow = head, fast = head;
while (fast != null && fast.next != null) {
    slow = slow.next;
    fast = fast.next.next;
}
// slow is the middle (the second one, for even length)

// Cycle detection — same skeleton, different question
boolean hasCycle(ListNode head) {
    ListNode s = head, f = head;
    while (f != null && f.next != null) {
        s = s.next;
        f = f.next.next;
        if (s == f) return true;    // reference equality, not .equals
    }
    return false;
}
      `),
      cpp(`
ListNode* slow = head; ListNode* fast = head;
while (fast && fast->next) {
    slow = slow->next;
    fast = fast->next->next;
}
// slow is the middle

bool hasCycle(ListNode* head) {
    ListNode* s = head; ListNode* f = head;
    while (f && f->next) {
        s = s->next;
        f = f->next->next;
        if (s == f) return true;
    }
    return false;
}
      `),
    ),
    p(
      'The null check is fast != null && fast.next != null, in that order. Checking fast.next first dereferences a null pointer on an even-length list — Java gives you a NullPointerException, C++ gives you a segfault or worse.',
    ),

    h('Language toolkit'),
    table(
      ['Java', 'What it does', 'C++ equivalent'],
      [
        ['Arrays.sort(nums)', 'Dual-pivot quicksort on primitives, O(n log n).', 'sort(v.begin(), v.end())'],
        ['Arrays.sort(arr, cmp)', 'Comparator sort — needs a boxed array, not int[].', 'sort(v.begin(), v.end(), cmp)'],
        ['s.charAt(i)', 'Character at an index without allocating.', 's[i]'],
        ['Character.isLetterOrDigit(c)', 'The filter valid-palindrome problems want.', 'isalnum((unsigned char)c)'],
        ['Character.toLowerCase(c)', 'Case-fold one char.', "tolower((unsigned char)c)"],
        ['new StringBuilder(s).reverse()', 'Reverse a string, O(n).', 'reverse(s.begin(), s.end())'],
        ['List.of(a, b, c)', 'Immutable fixed-size list — handy for triples.', '{a, b, c}'],
      ],
    ),
    warn(
      'Arrays.sort on int[] is a dual-pivot quicksort with an O(n²) adversarial worst case; on Integer[] and other objects it is a stable merge sort with a guaranteed O(n log n). It almost never matters in an interview, but it is the right answer if someone asks.',
    ),

    h('Complexity'),
    table(
      ['Shape', 'Time', 'Space', 'Note'],
      [
        ['Opposite ends on sorted input', 'O(n)', 'O(1)', 'Each pointer moves at most n times.'],
        ['Sort then two-pointer', 'O(n log n)', 'O(1)–O(n)', 'The sort dominates; space depends on the sort.'],
        ['3Sum', 'O(n²)', 'O(1)', 'n anchors × an O(n) scan each.'],
        ['Read/write in-place', 'O(n)', 'O(1)', 'The reason to prefer it over building a new array.'],
        ['Fast & slow', 'O(n)', 'O(1)', 'Beats the hash-set cycle check on space.'],
      ],
    ),

    h('Common mistakes'),
    ul(
      'Using lo <= hi on the opposite-ends loop, letting an element pair with itself.',
      'Skipping duplicates before recording the hit instead of after, which drops the very triple you just found.',
      'Forgetting that sorting invalidates original indices — if the answer is a list of positions, sort pairs of (value, index) or use a map.',
      'Dereferencing fast.next before checking fast — the null check order is not stylistic.',
      'Moving only one pointer after a match in 3Sum. Move both: with a fixed anchor, keeping one side pinned can only produce a duplicate or a miss.',
      'Comparing linked list nodes with .equals() in Java when you mean identity. Floyd\'s needs reference equality (==).',
      'Sorting when the problem never said the order could change. In-place sorting is a mutation the caller may not expect.',
    ),

    tip(
      'Before you write the loop, finish this sentence: "if the current pair is too small, moving hi down can only make it smaller, so lo must move." If that argument does not hold, the data is not monotonic enough for two pointers and you want a hash map or binary search instead.',
    ),

    links(
      link('LeetCode Explore — Two Pointer Technique', 'https://leetcode.com/explore/learn/card/array-and-string/205/array-two-pointer-technique/'),
      link('Java Arrays.sort — API reference', 'https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/Arrays.html'),
      link('C++ std::sort — reference', 'https://en.cppreference.com/w/cpp/algorithm/sort'),
    ),
  ],
};
