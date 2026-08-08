import { code, cpp, h, java, link, links, p, table, tip, ul, warn } from './blocks.js';

export default {
  patternSlug: 'strings',
  title: 'Strings',
  summary:
    'Most string problems are an array pattern wearing a costume — parsing, counting or two pointers.',
  blocks: [
    p(
      'A string is a read-only array of characters with worse ergonomics. Almost every string problem you will meet is a pattern you already know — counting with a hash map, two pointers from both ends, a sliding window — applied to characters instead of integers. The difficulty is rarely the algorithm. It is that the language fights you: strings are immutable in Java, indices and Unicode get slippery, and the obvious idiom is often quietly quadratic.',
    ),
    p(
      'So the useful thing to learn here is not a new technique but the cost model. Concatenating in a loop is O(n²). Substring is a copy. Comparing with == compares references. Once those are reflexes, string problems become the array problems they always were.',
    ),

    h('When to reach for it'),
    ul(
      'Anagram, palindrome, or "is one string a rearrangement of another" — those are frequency counts.',
      'Parsing: tokenising a sentence, reversing words, normalising input before comparing.',
      'Building output character by character — reversal, compression, run-length encoding.',
      'Matching or searching for a pattern inside a larger string.',
      'Anything where the alphabet is bounded, which means an int[26] beats a hash map.',
    ),

    h('The core idea'),
    p(
      'Counting characters. The workhorse. When the alphabet is lowercase letters, a 26-slot array is the right structure — no hashing, no boxing, and comparing two counts is a single Arrays.equals.',
    ),
    code(
      java(`
// Valid anagram — O(n) time, O(1) space
public boolean isAnagram(String s, String t) {
    if (s.length() != t.length()) return false;   // cheap reject first

    int[] count = new int[26];
    for (int i = 0; i < s.length(); i++) {
        count[s.charAt(i) - 'a']++;
        count[t.charAt(i) - 'a']--;               // one pass, both strings
    }
    for (int c : count) if (c != 0) return false;
    return true;
}
      `),
      cpp(`
bool isAnagram(string s, string t) {
    if (s.size() != t.size()) return false;

    array<int, 26> count{};
    for (size_t i = 0; i < s.size(); i++) {
        count[s[i] - 'a']++;
        count[t[i] - 'a']--;
    }
    return all_of(count.begin(), count.end(), [](int c) { return c == 0; });
}
      `),
    ),
    p(
      'Building strings. Java strings are immutable, so s += c allocates a whole new string every iteration — n concatenations copy 1 + 2 + ... + n characters, which is O(n²). StringBuilder is the fix and it is not optional.',
    ),
    code(
      java(`
// O(n) — the only correct way to build in a loop
StringBuilder sb = new StringBuilder();
for (char c : s.toCharArray()) {
    if (c != ' ') sb.append(c);
}
String out = sb.toString();

// O(n^2) — never do this
String bad = "";
for (char c : s.toCharArray()) bad += c;
      `),
      cpp(`
// C++ strings are mutable and amortised O(1) to append — += is fine here
string out;
out.reserve(s.size());        // one allocation instead of a handful
for (char c : s) {
    if (c != ' ') out += c;
}
      `),
    ),
    warn(
      'This is the single biggest difference between the two languages in string problems. In C++, s += c is amortised O(1) and idiomatic. In Java the same line is O(n) per call. Do not carry the C++ habit across.',
    ),

    h('Variations'),
    p(
      'Two pointers from the ends — palindromes. The interesting part is usually the filtering, not the comparison: skip anything that is not alphanumeric, and case-fold as you go rather than building a cleaned copy first.',
    ),
    code(
      java(`
public boolean isPalindrome(String s) {
    int lo = 0, hi = s.length() - 1;
    while (lo < hi) {
        while (lo < hi && !Character.isLetterOrDigit(s.charAt(lo))) lo++;
        while (lo < hi && !Character.isLetterOrDigit(s.charAt(hi))) hi--;
        if (Character.toLowerCase(s.charAt(lo)) != Character.toLowerCase(s.charAt(hi))) {
            return false;
        }
        lo++; hi--;
    }
    return true;
}
      `),
      cpp(`
bool isPalindrome(string s) {
    int lo = 0, hi = (int)s.size() - 1;
    while (lo < hi) {
        while (lo < hi && !isalnum((unsigned char)s[lo])) lo++;
        while (lo < hi && !isalnum((unsigned char)s[hi])) hi--;
        if (tolower((unsigned char)s[lo]) != tolower((unsigned char)s[hi])) return false;
        lo++; hi--;
    }
    return true;
}
      `),
    ),
    p(
      'Expand around centre — longest palindromic substring. Every palindrome has a centre, and there are 2n − 1 of them (n characters plus n − 1 gaps). Try each, push outwards while the characters match. O(n²) time, O(1) space, and far easier to get right under pressure than the DP formulation.',
    ),
    code(
      java(`
public String longestPalindrome(String s) {
    int start = 0, len = 0;
    for (int centre = 0; centre < s.length(); centre++) {
        int odd  = expand(s, centre, centre);       // aba
        int even = expand(s, centre, centre + 1);   // abba
        int best = Math.max(odd, even);
        if (best > len) {
            len = best;
            start = centre - (best - 1) / 2;        // walk back to the left edge
        }
    }
    return s.substring(start, start + len);
}

private int expand(String s, int lo, int hi) {
    while (lo >= 0 && hi < s.length() && s.charAt(lo) == s.charAt(hi)) { lo--; hi++; }
    return hi - lo - 1;    // the loop overshoots by one on each side
}
      `),
    ),
    p(
      'In-place reversal. Strings themselves cannot be mutated in Java, but a char[] can — and that is what "reverse in place, O(1) space" actually means there.',
    ),
    code(
      java(`
public void reverseString(char[] s) {
    int lo = 0, hi = s.length - 1;
    while (lo < hi) {
        char tmp = s[lo]; s[lo++] = s[hi]; s[hi--] = tmp;
    }
}
// whole-string reverse when you are allowed to allocate:
String r = new StringBuilder(s).reverse().toString();
      `),
      cpp(`
void reverseString(vector<char>& s) {
    reverse(s.begin(), s.end());
}
// or by hand
int lo = 0, hi = (int)s.size() - 1;
while (lo < hi) swap(s[lo++], s[hi--]);
      `),
    ),
    p(
      'Tokenising. Splitting on whitespace is the usual ask, and the usual bug is empty tokens from repeated spaces. Java split with a + quantifier handles that; C++ has no split, so a stringstream is the idiom.',
    ),
    code(
      java(`
String[] words = s.trim().split("\\\\s+");   // collapses runs of whitespace
      `),
      cpp(`
vector<string> words;
istringstream iss(s);
string w;
while (iss >> w) words.push_back(w);   // >> skips whitespace runs for you
      `),
    ),

    h('Language toolkit'),
    table(
      ['Java', 'What it does', 'C++ equivalent'],
      [
        ['s.charAt(i)', 'Char at an index. Bounds-checked.', 's[i] / s.at(i)'],
        ['s.length()', 'Length. Note: () unlike arrays.', 's.size() / s.length()'],
        ['s.substring(a, b)', 'Copy of [a, b) — O(n), not a view.', 's.substr(a, b - a)'],
        ['s.toCharArray()', 'Mutable copy for in-place work.', 'string is already mutable'],
        ['s.equals(t)', 'Content comparison. == compares references!', 's == t (compares content)'],
        ['s.compareTo(t)', 'Lexicographic ordering.', 's.compare(t) or <'],
        ['s.indexOf(t)', 'First occurrence, or −1.', 's.find(t), npos if absent'],
        ['new StringBuilder()', 'Amortised O(1) append. Mandatory in loops.', 'string with += / reserve()'],
        ['sb.reverse()', 'In-place reverse of the builder.', 'reverse(s.begin(), s.end())'],
        ['String.valueOf(x)', 'Number to string.', 'to_string(x)'],
        ['Integer.parseInt(s)', 'String to int; throws on garbage.', 'stoi(s)'],
        ['Character.isLetterOrDigit(c)', 'Unicode-aware classification.', 'isalnum((unsigned char)c)'],
        ['String.join(" ", list)', 'Join without a manual loop.', 'manual loop or ranges'],
      ],
    ),
    warn(
      'Comparing Java strings with == tests reference identity, not content. It appears to work for short literals because the compiler interns them, then fails on strings built at runtime. Always use .equals(). In C++, == on std::string does compare content — another habit that does not transfer.',
    ),

    h('Complexity'),
    table(
      ['Operation', 'Java', 'C++', 'Note'],
      [
        ['Index a character', 'O(1)', 'O(1)', ''],
        ['substring / substr', 'O(n)', 'O(n)', 'A copy in both. Not a view.'],
        ['s += c in a loop', 'O(n²)', 'O(n) amortised', 'The one that catches people out.'],
        ['StringBuilder.append', 'O(1) amortised', 'O(1) amortised', 'Occasional resize.'],
        ['equals / ==', 'O(n)', 'O(n)', 'Length check first makes mismatch O(1).'],
        ['Counting with int[26]', 'O(n)', 'O(n)', 'O(1) space for a bounded alphabet.'],
        ['Expand around centre', 'O(n²)', 'O(n²)', 'O(1) space — usually the right trade.'],
      ],
    ),

    h('Common mistakes'),
    ul(
      'Building a string with += inside a loop in Java. Use StringBuilder.',
      'Comparing strings with == instead of .equals() in Java.',
      'Calling substring inside a loop to test candidates, turning O(n) into O(n²).',
      'Indexing count[c - \'a\'] on input that is not guaranteed lowercase. Check the constraints, or use int[128].',
      'Forgetting length() is a method on String but a field on arrays — s.length() versus arr.length.',
      'Assuming one char is one character. Java char is a UTF-16 code unit; emoji and other astral characters take two. Use codePointAt when the problem is genuinely Unicode.',
      'Mutating a C++ string while iterating it with a range-for, which can invalidate the iteration.',
    ),

    tip(
      'Before writing anything, ask what the alphabet is. Lowercase only means int[26] and O(1) space. Full ASCII means int[128]. Arbitrary Unicode means a hash map. That one question decides the data structure.',
    ),

    links(
      link('Java String — API reference', 'https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/String.html'),
      link('Java StringBuilder — API reference', 'https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/StringBuilder.html'),
      link('C++ std::string — reference', 'https://en.cppreference.com/w/cpp/string/basic_string'),
    ),
  ],
};
