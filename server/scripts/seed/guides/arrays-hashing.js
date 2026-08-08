import { code, cpp, h, java, link, links, p, table, tip, ul, warn } from './blocks.js';

export default {
  patternSlug: 'arrays-hashing',
  title: 'Arrays & Hashing',
  summary: 'Trade memory for time — a hash map turns a nested scan into a single pass.',
  blocks: [
    p(
      'Almost every brute-force array solution has the same shape: for each element, look at every other element. That is O(n²), and it is O(n²) because you keep re-deriving facts you already had. A hash map is how you stop. You walk the array once, and at each step you ask a question about everything you have already seen — "have I seen 7 before?", "how many times has this letter appeared?", "which index held this value?" — and get the answer in constant time instead of another loop.',
    ),
    p(
      'That is the whole trade: memory for time. You spend O(n) extra space storing what you have seen so that you never have to look at it again. Once you internalise that, most "easy" array problems collapse into four or five lines, and the interesting question stops being "how do I search this?" and becomes "what exactly should the key be, and what should the value be?"',
    ),

    h('When to reach for it'),
    ul(
      'The brute force is a nested loop where the inner loop is only checking membership, counting, or looking up a position.',
      'The problem says "duplicate", "distinct", "anagram", "frequency", "how many times", or "has appeared before".',
      'You need to pair up elements that satisfy some arithmetic relation — the classic target − x.',
      'You need to group things: anagrams together, numbers by remainder, words by sorted letters. The group identity becomes the key.',
      'The values are unbounded or non-numeric, so you cannot index an array by them directly.',
    ),
    tip(
      'If the values are small bounded integers — lowercase letters, digits, ASCII — use a plain int[26] or int[128] instead of a HashMap. Same algorithm, no hashing, no boxing, noticeably faster.',
    ),

    h('The core idea'),
    p(
      'The canonical example is Two Sum. The brute force checks every pair. The hash-map version asks, for each element, whether its complement has already gone past — and since you insert as you go, a match is guaranteed to be a different index.',
    ),
    code(
      java(`
// Two Sum — one pass, seen[value] = index
public int[] twoSum(int[] nums, int target) {
    Map<Integer, Integer> seen = new HashMap<>();
    for (int i = 0; i < nums.length; i++) {
        int need = target - nums[i];
        if (seen.containsKey(need)) {
            return new int[] { seen.get(need), i };
        }
        seen.put(nums[i], i);   // insert AFTER the check
    }
    return new int[] {};
}
      `),
      cpp(`
// Two Sum — one pass, seen[value] = index
vector<int> twoSum(vector<int>& nums, int target) {
    unordered_map<int, int> seen;
    for (int i = 0; i < (int)nums.size(); i++) {
        int need = target - nums[i];
        auto it = seen.find(need);
        if (it != seen.end()) return { it->second, i };
        seen[nums[i]] = i;      // insert AFTER the check
    }
    return {};
}
      `),
    ),
    p(
      'Note the ordering: the lookup happens before the insert. Reverse those two lines and an element pairs with itself whenever target is exactly double it. This is the single most common bug in the pattern.',
    ),

    h('Variations'),
    p(
      'Frequency counting. Instead of a position, the value is a count. In Java, merge and getOrDefault both do the "add one, starting from zero" dance in one line; in C++, operator[] value-initialises to 0 for you, so ++ just works.',
    ),
    code(
      java(`
Map<Character, Integer> freq = new HashMap<>();
for (char c : s.toCharArray()) {
    freq.merge(c, 1, Integer::sum);
    // equivalent: freq.put(c, freq.getOrDefault(c, 0) + 1);
}

// Bounded alphabet? Skip the map entirely.
int[] count = new int[26];
for (char c : s.toCharArray()) count[c - 'a']++;
      `),
      cpp(`
unordered_map<char, int> freq;
for (char c : s) freq[c]++;   // operator[] inserts a 0 first

// Bounded alphabet? Skip the map entirely.
array<int, 26> count{};       // {} zero-initialises
for (char c : s) count[c - 'a']++;
      `),
    ),
    p(
      'Set membership. When you only care whether something exists and never about a value, use a set. Contains-duplicate is three lines, and the early exit matters — you can bail the moment the size stops growing.',
    ),
    code(
      java(`
public boolean containsDuplicate(int[] nums) {
    Set<Integer> seen = new HashSet<>();
    for (int n : nums) {
        if (!seen.add(n)) return true;   // add returns false if already present
    }
    return false;
}
      `),
      cpp(`
bool containsDuplicate(vector<int>& nums) {
    unordered_set<int> seen;
    for (int n : nums) {
        if (!seen.insert(n).second) return true;  // .second is false if present
    }
    return false;
}
      `),
    ),
    p(
      'Grouping by a derived key. The art here is choosing a key that is identical for everything that belongs together. For anagrams, that is either the sorted string or a 26-length count signature — the count version is O(n·k) instead of O(n·k log k).',
    ),
    code(
      java(`
public List<List<String>> groupAnagrams(String[] strs) {
    Map<String, List<String>> groups = new HashMap<>();
    for (String s : strs) {
        int[] count = new int[26];
        for (char c : s.toCharArray()) count[c - 'a']++;
        String key = Arrays.toString(count);      // stable, collision-free key
        groups.computeIfAbsent(key, k -> new ArrayList<>()).add(s);
    }
    return new ArrayList<>(groups.values());
}
      `),
      cpp(`
vector<vector<string>> groupAnagrams(vector<string>& strs) {
    unordered_map<string, vector<string>> groups;
    for (auto& s : strs) {
        string key(26, '0');
        for (char c : s) key[c - 'a']++;
        groups[key].push_back(s);
    }
    vector<vector<string>> out;
    for (auto& [_, group] : groups) out.push_back(group);
    return out;
}
      `),
    ),
    p(
      'Bucketing by count. When the question is "top K frequent" and K is bounded by n, you do not need a heap or a sort — index an array by frequency. Frequencies run 1..n, so an array of n+1 lists holds every possible bucket, and one backward walk collects the answer in O(n).',
    ),
    code(
      java(`
// Top K frequent — O(n), no sorting
List<Integer>[] buckets = new List[nums.length + 1];
Map<Integer, Integer> freq = new HashMap<>();
for (int n : nums) freq.merge(n, 1, Integer::sum);

for (var e : freq.entrySet()) {
    int c = e.getValue();
    if (buckets[c] == null) buckets[c] = new ArrayList<>();
    buckets[c].add(e.getKey());
}

List<Integer> out = new ArrayList<>();
for (int c = nums.length; c >= 1 && out.size() < k; c--) {
    if (buckets[c] != null) out.addAll(buckets[c]);
}
      `),
    ),

    h('Language toolkit'),
    p('The methods worth knowing by heart. Java first, C++ underneath.'),
    table(
      ['Java', 'What it does', 'C++ equivalent'],
      [
        [
          'map.getOrDefault(k, d)',
          'Value for k, or d if absent. Does not insert.',
          'm.count(k) ? m[k] : d',
        ],
        [
          'map.merge(k, 1, Integer::sum)',
          'Insert 1, or add 1 to what is there. The counting idiom.',
          'm[k]++',
        ],
        [
          'map.computeIfAbsent(k, f)',
          'Get, creating via f if missing. Builds maps of lists.',
          'm[k] (value-initialises)',
        ],
        ['map.putIfAbsent(k, v)', 'Only writes when the key is absent.', 'm.try_emplace(k, v)'],
        ['map.containsKey(k)', 'Membership, no value fetched.', 'm.contains(k) — C++20'],
        ['map.entrySet()', 'Iterate keys and values together.', 'for (auto& [k, v] : m)'],
        ['set.add(x)', 'Returns false if already present — free duplicate check.', 's.insert(x).second'],
        ['new int[26]', 'Zero-filled by the JVM. Bounded-alphabet counting.', 'array<int,26> a{};'],
        ['Arrays.toString(arr)', 'Turns a count array into a usable map key.', 'string built by hand'],
      ],
    ),
    warn(
      'C++ operator[] inserts a default-constructed value when the key is missing. Using it inside a read-only check silently grows the map — and m[k] on a const map will not compile. Use find() or count() to look without writing, and at() when you want an out_of_range throw instead.',
    ),

    h('Complexity'),
    table(
      ['Operation', 'Average', 'Worst', 'Note'],
      [
        ['Hash map get / put', 'O(1)', 'O(n)', 'Worst case is everything colliding into one bucket.'],
        ['Building a map over n items', 'O(n)', '—', 'The pattern turns O(n²) brute force into this.'],
        ['Iterating a HashMap', 'O(capacity + size)', '—', 'Proportional to buckets, not just entries.'],
        ['Extra space', 'O(n)', '—', 'The thing you are trading away.'],
        ['int[26] counting', 'O(n)', 'O(n)', 'No hashing at all — prefer it when you can.'],
      ],
    ),
    p(
      'The Java documentation states HashMap "provides constant-time performance for the basic operations (get and put), assuming the hash function disperses the elements properly among the buckets" — the assumption is doing real work in that sentence. Interviewers who ask for worst case want to hear O(n).',
    ),

    h('Common mistakes'),
    ul(
      'Inserting before checking in Two Sum, so an element matches itself. Check first, insert after.',
      'Using == on boxed Integer keys in Java. Values outside −128..127 are not cached, so == compares references. Use .equals(), or keep the comparison inside the map.',
      'Reading a C++ map with operator[] inside a loop and wondering why size() grew. That read was a write.',
      'Reaching for a HashMap when the keys are 26 letters. An int[26] is the same algorithm without the hashing, the boxing, or the allocation.',
      'Assuming iteration order. HashMap and unordered_map give you no order at all — if the answer depends on order, you need LinkedHashMap / TreeMap or a sort at the end.',
      'Using a mutable object as a key and then mutating it. The hash is computed at insert time; mutate the key and the entry becomes unreachable.',
    ),

    tip(
      'When you get stuck, say the map out loud: "the key is the remainder, the value is the earliest index that produced it." If you cannot finish that sentence, the map is not the right one yet — and no amount of code will fix it.',
    ),

    links(
      link('Java HashMap — API reference', 'https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/HashMap.html'),
      link('C++ std::unordered_map — reference', 'https://en.cppreference.com/w/cpp/container/unordered_map'),
      link('LeetCode Explore — Hash Table', 'https://leetcode.com/explore/learn/card/hash-table/'),
    ),
  ],
};
