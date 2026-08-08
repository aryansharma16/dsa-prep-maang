import { code, cpp, h, java, link, links, p, table, tip, ul, warn } from './blocks.js';

export default {
  patternSlug: 'bit-manipulation',
  title: 'Bit Manipulation',
  summary:
    'XOR cancels pairs, n & (n-1) clears the lowest set bit. Most problems are one of those two.',
  blocks: [
    p(
      'Bit manipulation looks like a grab-bag of tricks until you notice that interview problems draw on a very small set of them. Two facts carry most of the weight. XOR is its own inverse, so anything appearing twice cancels to zero — which turns "find the one unpaired element" into a single fold with no extra memory. And n & (n − 1) clears the lowest set bit, so counting set bits becomes a loop that runs once per set bit rather than once per bit position.',
    ),
    p(
      'The third use is treating an integer as a set. With n up to about 20, a bitmask represents any subset in a single int: bit i means "element i is in". Union is |, intersection is &, membership is a shift and a test. That is what makes exhaustive subset enumeration a simple counting loop, and it is the foundation of bitmask DP.',
    ),
    p(
      'What actually catches people out is not the tricks but the arithmetic details underneath — signed shifts, overflow, and the fact that shifting by 32 does not do what you would expect. Those are worth getting right once because they fail silently.',
    ),

    h('When to reach for it'),
    ul(
      '"Every element appears twice except one" — that is XOR.',
      'Counting set bits, or asking whether a number is a power of two.',
      'Enumerating all subsets of a small collection.',
      'The constraints mention n ≤ 20 and every subset needs considering — bitmask DP.',
      'Adding, swapping or comparing without arithmetic operators.',
      'Compressing a boolean state into a single integer for memoisation.',
    ),

    h('The core idea'),
    p(
      'XOR cancellation. a ^ a is 0 and a ^ 0 is a, so folding XOR across an array annihilates every pair and leaves the loner. Order does not matter, which is why no sorting or hashing is needed.',
    ),
    code(
      java(`
// Every element appears twice except one — O(n) time, O(1) space
public int singleNumber(int[] nums) {
    int result = 0;
    for (int n : nums) result ^= n;    // pairs cancel to 0
    return result;
}

// Missing number in 0..n — XOR the indices against the values
public int missingNumber(int[] nums) {
    int result = nums.length;
    for (int i = 0; i < nums.length; i++) result ^= i ^ nums[i];
    return result;
}
      `),
      cpp(`
int singleNumber(vector<int>& nums) {
    int result = 0;
    for (int n : nums) result ^= n;
    return result;
}

int missingNumber(vector<int>& nums) {
    int result = nums.size();
    for (size_t i = 0; i < nums.size(); i++) result ^= i ^ nums[i];
    return result;
}
      `),
    ),
    p(
      'Clearing the lowest set bit. n & (n − 1) turns off the rightmost 1. Subtracting one flips that bit to 0 and everything below it to 1; the AND then wipes the whole tail. It gives you a set-bit count that runs in as many iterations as there are set bits, and a one-line power-of-two test.',
    ),
    code(
      java(`
// Count set bits — loops once per set bit, not 32 times
public int countBits(int n) {
    int count = 0;
    while (n != 0) {
        n &= (n - 1);       // clear the lowest set bit
        count++;
    }
    return count;
}

// A power of two has exactly one set bit
public boolean isPowerOfTwo(int n) {
    return n > 0 && (n & (n - 1)) == 0;    // n > 0 matters: 0 would pass otherwise
}

// The library versions — say you know them, then write the loop if asked
Integer.bitCount(n);
Integer.highestOneBit(n);
      `),
      cpp(`
int countBits(int n) {
    int count = 0;
    while (n) { n &= (n - 1); count++; }
    return count;
}

bool isPowerOfTwo(int n) {
    return n > 0 && (n & (n - 1)) == 0;
}

// Builtins (GCC/Clang); C++20 adds <bit>
__builtin_popcount(n);
std::popcount((unsigned)n);   // C++20
      `),
    ),
    tip(
      'n & -n does the opposite of n & (n−1): it isolates the lowest set bit rather than clearing it. That is the operation a Fenwick tree is built on, and it is worth recognising when you see it.',
    ),

    h('Variations'),
    p(
      'The standard operations, worth being able to write without thinking. Note the mask construction — 1 << i, not i itself.',
    ),
    code(
      java(`
int get   = (n >> i) & 1;      // read bit i
int set   = n |  (1 << i);     // turn bit i on
int clear = n & ~(1 << i);     // turn bit i off
int flip  = n ^  (1 << i);     // toggle bit i

// Careful with long: the shift amount must also be long
long bigMask = 1L << 40;       // 1 << 40 silently wraps to 256
      `),
      cpp(`
int get   = (n >> i) & 1;
int set   = n |  (1 << i);
int clear = n & ~(1 << i);
int flip  = n ^  (1 << i);

long long bigMask = 1LL << 40;   // 1 << 40 is undefined behaviour on 32-bit int
      `),
    ),
    warn(
      'In Java the shift distance is taken modulo 32 for int and modulo 64 for long, so 1 << 32 is 1, not 0 — a silent wrap rather than an error. In C++ shifting by more than the width is undefined behaviour outright. Either way, use 1L / 1LL when the target is 64 bits.',
    ),
    p(
      'Enumerating subsets with a bitmask. Every integer from 0 to 2^n − 1 is a distinct subset of n elements. This is the cleanest way to write exhaustive subset generation, and it is iterative rather than recursive.',
    ),
    code(
      java(`
// All 2^n subsets of nums
public List<List<Integer>> subsets(int[] nums) {
    int n = nums.length;
    List<List<Integer>> out = new ArrayList<>();

    for (int mask = 0; mask < (1 << n); mask++) {     // 1 << n == 2^n
        List<Integer> subset = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            if ((mask & (1 << i)) != 0) subset.add(nums[i]);   // bit i is in
        }
        out.add(subset);
    }
    return out;
}
      `),
      cpp(`
vector<vector<int>> subsets(vector<int>& nums) {
    int n = nums.size();
    vector<vector<int>> out;
    for (int mask = 0; mask < (1 << n); mask++) {
        vector<int> subset;
        for (int i = 0; i < n; i++) {
            if (mask & (1 << i)) subset.push_back(nums[i]);
        }
        out.push_back(subset);
    }
    return out;
}
      `),
    ),
    p(
      'A mask as a DP state. When the state is "which of these n things have I already used", the mask is the memo key. This is how travelling-salesman-shaped problems become tractable for small n.',
    ),
    code(
      java(`
// dp[mask] = best result having already used exactly the elements in mask
int[] dp = new int[1 << n];
Arrays.fill(dp, -1);
...
for (int i = 0; i < n; i++) {
    if ((mask & (1 << i)) != 0) continue;       // already used
    int next = mask | (1 << i);                 // mark it used
    ...
}
      `),
    ),
    p(
      'Addition without +. Occasionally asked as a puzzle. XOR gives the sum ignoring carries; AND shifted left gives the carries; repeat until there is nothing left to carry.',
    ),
    code(
      java(`
public int getSum(int a, int b) {
    while (b != 0) {
        int carry = (a & b) << 1;   // bits where both are 1, moved up one place
        a = a ^ b;                  // sum without carrying
        b = carry;
    }
    return a;
}
      `),
    ),

    h('Language toolkit'),
    table(
      ['Java', 'What it does', 'C++ equivalent'],
      [
        ['Integer.bitCount(n)', 'Number of set bits.', '__builtin_popcount(n) / std::popcount'],
        ['Integer.toBinaryString(n)', 'Binary text — invaluable for debugging.', 'std::bitset<32>(n).to_string()'],
        ['Integer.highestOneBit(n)', 'Isolates the most significant set bit.', '1 << (31 - __builtin_clz(n))'],
        ['Integer.numberOfTrailingZeros(n)', 'Index of the lowest set bit.', '__builtin_ctz(n)'],
        ['Integer.reverse(n)', 'Reverses all 32 bits.', 'no builtin — loop'],
        ['>>>', 'Unsigned right shift — fills with zeros.', '>> on an unsigned type'],
        ['>>', 'Signed shift — propagates the sign bit.', '>> on a signed type'],
        ['1L << i', '64-bit mask.', '1LL << i'],
        ['Integer.MIN_VALUE', '−2^31; its own negation.', 'INT_MIN'],
      ],
    ),
    warn(
      'Java has no unsigned int, which is why it has a separate >>> operator. For a negative n, n >> 1 keeps the sign and n >>> 1 does not — using the wrong one in a bit-counting loop makes it run forever, because the sign bit keeps refilling.',
    ),

    h('Complexity'),
    table(
      ['Operation', 'Time', 'Space', 'Note'],
      [
        ['XOR fold over n elements', 'O(n)', 'O(1)', 'Replaces a hash map.'],
        ['Set-bit count via n & (n−1)', 'O(set bits)', 'O(1)', 'At most 32 iterations.'],
        ['Bit-by-bit scan', 'O(32) = O(1)', 'O(1)', 'Constant for a fixed width.'],
        ['Enumerating all subsets', 'O(n · 2^n)', 'O(1) working', 'Output dominates.'],
        ['Bitmask DP', 'O(2^n · n)', 'O(2^n)', 'Practical to about n = 20.'],
        ['Single bit read/write', 'O(1)', 'O(1)', 'One machine instruction.'],
      ],
    ),

    h('Common mistakes'),
    ul(
      'Using 1 << i where the result needs 64 bits. In Java the shift wraps modulo 32; in C++ it is undefined behaviour.',
      'Using >> instead of >>> on negative numbers in Java, so a loop never terminates.',
      'Forgetting the n > 0 guard in the power-of-two test — 0 & −1 is 0, so zero passes without it.',
      'Comparing (n & mask) == 1 instead of != 0. The extracted bit sits at position i, not position 0.',
      'Operator precedence: & and | bind more loosely than == in both languages, so (a & b) needs its parentheses.',
      'Assuming int is 32 bits in C++. It is on every mainstream platform but not guaranteed; long long when it matters.',
      'Reaching for bit tricks where a hash map is clearer. XOR for the single-number problem is elegant; XOR for something a map solves plainly is just harder to read.',
    ),

    tip(
      'Print Integer.toBinaryString(n) while debugging. Nearly every bit bug is obvious the moment you can see the bits and completely opaque while you are reasoning about decimal values.',
    ),

    links(
      link('Java Integer — API reference', 'https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/Integer.html'),
      link('C++ <bit> — reference', 'https://en.cppreference.com/w/cpp/header/bit'),
    ),
  ],
};
