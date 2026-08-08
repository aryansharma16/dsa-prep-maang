import { code, cpp, h, java, link, links, p, table, tip, ul, warn } from './blocks.js';

export default {
  patternSlug: 'math-geometry',
  title: 'Math & Geometry',
  summary:
    'Matrix rotations, overflow-safe arithmetic and the occasional number-theory identity.',
  blocks: [
    p(
      'This pattern is the one without a unifying technique. What the problems share is that the difficulty is arithmetic rather than algorithmic: the loop is simple and the trap is an overflow, a sign, or an off-by-one in an index calculation. They reward care rather than insight, which is exactly why they get asked — an interviewer learns more about how carefully you handle edge cases here than from another graph traversal.',
    ),
    p(
      'Three clusters cover most of it. Matrix manipulation, where the whole problem is working out the index arithmetic and doing it in place. Digit and number work — reversing, palindromes, base conversion — where overflow is the entire challenge. And a handful of number-theory facts, mostly GCD and the sieve, that turn a brute force into a one-liner.',
    ),
    p(
      'The single most valuable habit here: before writing anything, ask what the largest and smallest values are and whether any intermediate result can exceed them. Most failures in this pattern are silent wraparounds, not wrong logic.',
    ),

    h('When to reach for it'),
    ul(
      'Rotate, transpose, spiral-traverse or zero out a matrix, usually in place.',
      'Reverse an integer, test a palindrome number, convert between bases.',
      'GCD, LCM, primes, or divisibility.',
      'Fast exponentiation, modular arithmetic, or "answer modulo 10^9 + 7".',
      'Coordinate geometry: collinear points, distances, rectangle overlap.',
      'The problem forbids extra space on a grid, which usually means marking the grid itself.',
    ),

    h('The core idea'),
    p(
      'Rotating a matrix in place. The trick that makes it easy: a 90-degree clockwise rotation is a transpose followed by reversing each row. Trying to do it as a single four-way cycle of swaps is possible but far more error-prone under pressure.',
    ),
    code(
      java(`
public void rotate(int[][] matrix) {
    int n = matrix.length;

    // 1. transpose — mirror across the main diagonal
    for (int r = 0; r < n; r++) {
        for (int c = r + 1; c < n; c++) {     // c starts at r+1, or you undo it
            int tmp = matrix[r][c];
            matrix[r][c] = matrix[c][r];
            matrix[c][r] = tmp;
        }
    }

    // 2. reverse each row
    for (int[] row : matrix) {
        int lo = 0, hi = n - 1;
        while (lo < hi) { int t = row[lo]; row[lo++] = row[hi]; row[hi--] = t; }
    }
}
      `),
      cpp(`
void rotate(vector<vector<int>>& matrix) {
    int n = matrix.size();
    for (int r = 0; r < n; r++)
        for (int c = r + 1; c < n; c++)
            swap(matrix[r][c], matrix[c][r]);

    for (auto& row : matrix) reverse(row.begin(), row.end());
}
      `),
    ),
    warn(
      'The inner loop must start at r + 1, not 0. Starting at 0 swaps every pair twice and leaves the matrix exactly as it was — a bug that produces no error and passes a 1×1 test case.',
    ),
    p(
      'Overflow-safe integer reversal. The check has to happen before the multiplication, not after: once it has overflowed the value is already wrong and testing it proves nothing.',
    ),
    code(
      java(`
public int reverse(int x) {
    int result = 0;
    while (x != 0) {
        int digit = x % 10;
        x /= 10;

        // check BEFORE multiplying — afterwards is too late
        if (result > Integer.MAX_VALUE / 10 ||
            (result == Integer.MAX_VALUE / 10 && digit > 7)) return 0;
        if (result < Integer.MIN_VALUE / 10 ||
            (result == Integer.MIN_VALUE / 10 && digit < -8)) return 0;

        result = result * 10 + digit;
    }
    return result;
}
      `),
      cpp(`
int reverse(int x) {
    int result = 0;
    while (x != 0) {
        int digit = x % 10;
        x /= 10;
        if (result > INT_MAX / 10 || (result == INT_MAX / 10 && digit > 7)) return 0;
        if (result < INT_MIN / 10 || (result == INT_MIN / 10 && digit < -8)) return 0;
        result = result * 10 + digit;
    }
    return result;
}
      `),
    ),
    p(
      'The 7 and −8 are the last digits of Integer.MAX_VALUE (2147483647) and Integer.MIN_VALUE (−2147483648). Note the asymmetry — the negative range is one larger, which is why Math.abs(Integer.MIN_VALUE) is itself, still negative.',
    ),

    h('Variations'),
    p(
      'Spiral traversal. Four boundaries that close inward. The two extra guards before the reverse passes are what stop a single remaining row or column being emitted twice.',
    ),
    code(
      java(`
public List<Integer> spiralOrder(int[][] matrix) {
    List<Integer> out = new ArrayList<>();
    int top = 0, bottom = matrix.length - 1;
    int left = 0, right = matrix[0].length - 1;

    while (top <= bottom && left <= right) {
        for (int c = left; c <= right; c++) out.add(matrix[top][c]);
        top++;
        for (int r = top; r <= bottom; r++) out.add(matrix[r][right]);
        right--;

        if (top <= bottom) {                       // guard: one row left
            for (int c = right; c >= left; c--) out.add(matrix[bottom][c]);
            bottom--;
        }
        if (left <= right) {                       // guard: one column left
            for (int r = bottom; r >= top; r--) out.add(matrix[r][left]);
            left++;
        }
    }
    return out;
}
      `),
    ),
    p(
      'Marking in place. "Set matrix zeroes with O(1) extra space" is really about finding somewhere to store the flags — and the first row and column are that somewhere, once you separately record whether they themselves were zero.',
    ),
    code(
      java(`
public void setZeroes(int[][] matrix) {
    int m = matrix.length, n = matrix[0].length;
    boolean firstRowZero = false, firstColZero = false;

    for (int c = 0; c < n; c++) if (matrix[0][c] == 0) firstRowZero = true;
    for (int r = 0; r < m; r++) if (matrix[r][0] == 0) firstColZero = true;

    for (int r = 1; r < m; r++)                       // record flags in row/col 0
        for (int c = 1; c < n; c++)
            if (matrix[r][c] == 0) { matrix[r][0] = 0; matrix[0][c] = 0; }

    for (int r = 1; r < m; r++)                       // apply them
        for (int c = 1; c < n; c++)
            if (matrix[r][0] == 0 || matrix[0][c] == 0) matrix[r][c] = 0;

    if (firstRowZero) for (int c = 0; c < n; c++) matrix[0][c] = 0;
    if (firstColZero) for (int r = 0; r < m; r++) matrix[r][0] = 0;
}
      `),
    ),
    p(
      'GCD and LCM. Euclid\'s algorithm is three lines and worth knowing cold; LCM follows from it. Divide before multiplying in the LCM or you overflow on values that the answer itself would fit.',
    ),
    code(
      java(`
public int gcd(int a, int b) {
    while (b != 0) { int t = b; b = a % b; a = t; }
    return a;
}

public long lcm(int a, int b) {
    return (long) a / gcd(a, b) * b;   // divide FIRST — a * b can overflow
}
      `),
      cpp(`
int gcd(int a, int b) { while (b) { int t = b; b = a % b; a = t; } return a; }
// C++17 also has std::gcd and std::lcm in <numeric>

long long lcm_(int a, int b) { return (long long)a / gcd(a, b) * b; }
      `),
    ),
    p(
      'Fast exponentiation. Squaring halves the exponent each step, turning O(n) multiplications into O(log n). The modular form is the one that shows up in counting problems.',
    ),
    code(
      java(`
// (base^exp) % mod, in O(log exp)
public long power(long base, long exp, long mod) {
    long result = 1;
    base %= mod;
    while (exp > 0) {
        if ((exp & 1) == 1) result = result * base % mod;   // odd: take one factor
        base = base * base % mod;                           // square
        exp >>= 1;
    }
    return result;
}
      `),
    ),
    p(
      'Sieve of Eratosthenes. All primes below n in O(n log log n). Start the inner loop at i·i — every smaller multiple already has a smaller factor that crossed it off.',
    ),
    code(
      java(`
public boolean[] sieve(int n) {
    boolean[] composite = new boolean[n + 1];
    for (int i = 2; (long) i * i <= n; i++) {
        if (!composite[i]) {
            for (int j = i * i; j <= n; j += i) composite[j] = true;  // start at i*i
        }
    }
    return composite;   // !composite[k] && k >= 2 means prime
}
      `),
    ),

    h('Language toolkit'),
    table(
      ['Java', 'What it does', 'C++ equivalent'],
      [
        ['Integer.MAX_VALUE / MIN_VALUE', '2147483647 / −2147483648.', 'INT_MAX / INT_MIN (<climits>)'],
        ['Long.MAX_VALUE', 'When int is not enough.', 'LLONG_MAX'],
        ['Math.floorMod(a, b)', 'Always non-negative modulo.', '((a % b) + b) % b'],
        ['Math.abs(x)', 'Careful: abs(MIN_VALUE) is negative.', 'std::abs — same trap'],
        ['(a + b - 1) / b', 'Ceiling division without floats.', 'same'],
        ['Math.sqrt(x)', 'Returns double — cast and verify.', 'std::sqrt'],
        ['—', 'GCD / LCM in the library.', 'std::gcd, std::lcm (C++17, <numeric>)'],
        ['1_000_000_007', 'The usual modulus; underscores are legal.', '1000000007'],
        ['(long) a * b', 'Widen before multiplying.', '(long long)a * b'],
      ],
    ),
    warn(
      'Casting after the multiplication does nothing. (long) (a * b) computes the int product, overflows, and then widens the wrong answer. It has to be (long) a * b so the multiplication itself happens in 64 bits.',
    ),

    h('Complexity'),
    table(
      ['Operation', 'Time', 'Space', 'Note'],
      [
        ['Matrix transpose / rotate', 'O(n²)', 'O(1)', 'In place — every cell touched once.'],
        ['Spiral traversal', 'O(m·n)', 'O(1)', 'Excluding the output list.'],
        ['Set matrix zeroes', 'O(m·n)', 'O(1)', 'Using row/col 0 as the flag store.'],
        ['GCD (Euclid)', 'O(log min(a, b))', 'O(1)', 'Iterative avoids the stack.'],
        ['Fast exponentiation', 'O(log exp)', 'O(1)', 'Beats the naive O(exp) loop.'],
        ['Sieve of Eratosthenes', 'O(n log log n)', 'O(n)', 'Effectively linear in practice.'],
        ['Primality by trial division', 'O(√n)', 'O(1)', 'Fine for a single query.'],
      ],
    ),

    h('Common mistakes'),
    ul(
      'Checking for overflow after it has already happened. Check before the multiply.',
      'Casting to long after the multiplication rather than before it.',
      'Starting the transpose inner loop at 0, undoing every swap.',
      'Forgetting the two guards in the spiral, so a single leftover row is emitted twice.',
      'Assuming Math.abs always returns a non-negative number. abs(Integer.MIN_VALUE) is negative.',
      'Negative modulo results in Java and C++ — normalise with floorMod when you need a bucket index.',
      'Multiplying before dividing in LCM.',
      'Using floating point for exact integer work. sqrt and division lose precision at large values.',
      'Starting the sieve inner loop at 2·i instead of i·i, which still works but does extra passes.',
    ),

    tip(
      'When constraints mention values near 10^9, assume int will overflow somewhere and reach for long by default. The cost is nothing; the alternative is a wrong answer that looks right on every small test.',
    ),

    links(
      link('Java Math — API reference', 'https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/Math.html'),
      link('Java Integer — API reference', 'https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/Integer.html'),
      link('C++ <numeric> gcd/lcm — reference', 'https://en.cppreference.com/w/cpp/numeric/gcd'),
    ),
  ],
};
