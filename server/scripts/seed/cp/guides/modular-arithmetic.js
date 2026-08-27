import { code, cpp, h, java, link, links, p, table, tip, ul, warn } from '../../guides/blocks.js';

export default {
  patternSlug: 'modular-arithmetic',
  title: 'Modular Arithmetic & Fast Power',
  summary:
    'Everything counted modulo 10^9+7, plus the two operations that are not obvious: exponentiation in O(log n) and division by inverse.',
  blocks: [
    p(
      '"Output the answer modulo 998244353" is not a formatting instruction. It is the statement telling you the answer is astronomically large, that counting it exactly is the problem, and that you will be working in a finite field for the rest of the solution. Once you read that line, every addition and multiplication in your code needs a `% MOD` and every division needs a modular inverse.',
    ),
    p(
      'Addition, subtraction and multiplication behave exactly as you expect — they commute with the modulus, so you can reduce whenever you like. Division does not. `a / b mod p` is not `(a mod p) / (b mod p)`; it is `a · b^(p−2) mod p`, and only when `p` is prime and `b` is not a multiple of it. That asymmetry is the whole content of this pattern.',
    ),

    h('When to reach for it'),
    ul(
      'The statement says "modulo 10^9+7" or "modulo 998244353".',
      'Counting problems where the answer grows factorially or exponentially.',
      'Anything asking for a probability as `p·q^-1 mod M` — that is a fraction in modular clothing.',
      'A recurrence evaluated at n up to 10^18 — fast exponentiation, possibly on matrices.',
      'Combinatorics: nCr, arrangements, derangements, Catalan numbers.',
    ),

    h('The safe primitives'),
    p(
      'Write these once and use them everywhere. The subtraction one in particular is worth having as a function, because `(a - b) % m` returning a negative number is a bug that survives every sample test and fails on a hidden one.',
    ),
    code(
      java(`
static final long MOD = 1_000_000_007L;

static long add(long a, long b) { return (a + b) % MOD; }
static long sub(long a, long b) { return (a - b % MOD + MOD) % MOD; }
static long mul(long a, long b) { return a % MOD * (b % MOD) % MOD; }
      `),
      cpp(`
const long long MOD = 1'000'000'007LL;

long long add(long long a, long long b) { return (a + b) % MOD; }
long long sub(long long a, long long b) { return (a - b % MOD + MOD) % MOD; }
long long mul(long long a, long long b) { return a % MOD * (b % MOD) % MOD; }
      `),
    ),
    warn(
      'Multiplication is where 32-bit types die. Two values under 10^9 multiply to nearly 10^18, which needs 64 bits before the `%` ever runs. In C++ that means `long long`; in Java, `long`. An `int` here produces a plausible-looking wrong answer, not a crash.',
    ),
    warn(
      '`%` in both C++ and Java returns a value with the sign of the *dividend*, so `(-3) % 7` is `-3`, not `4`. Any subtraction chain needs the `+ MOD` correction — and note that `b` must be reduced first, or `a - b` can still land below `-MOD`.',
    ),

    h('Binary exponentiation'),
    p(
      'Computing `a^n mod m` by multiplying `n` times is O(n) and hopeless when `n` is 10^18. Squaring repeatedly is O(log n): read the exponent in binary, square the base at every bit, and multiply into the result where the bit is set.',
    ),
    code(
      java(`
static long power(long base, long exp, long mod) {
    long result = 1;
    base %= mod;
    if (base < 0) base += mod;                 // negative bases are real inputs
    while (exp > 0) {
        if ((exp & 1) == 1) result = result * base % mod;
        base = base * base % mod;
        exp >>= 1;
    }
    return result;
}
      `),
      cpp(`
long long power(long long base, long long exp, long long mod) {
    long long result = 1;
    base %= mod;
    if (base < 0) base += mod;
    while (exp > 0) {
        if (exp & 1) result = result * base % mod;
        base = base * base % mod;
        exp >>= 1;
    }
    return result;
}
      `),
    ),
    tip(
      'The same routine, with `long long` swapped for a matrix and `*` for matrix multiply, is matrix exponentiation — which evaluates any linear recurrence at n = 10^18 in O(k^3 log n). The exponent loop is unchanged; only the type it operates on differs.',
    ),

    h('Modular inverse'),
    p(
      "Fermat's little theorem: for prime `p` and `b` not divisible by `p`, `b^(p−1) ≡ 1`, so `b^(p−2)` is the inverse of `b`. Both common competition moduli are prime, so this is almost always the tool.",
    ),
    code(
      java(`
// Requires MOD prime and b % MOD != 0.
static long inverse(long b) { return power(b, MOD - 2, MOD); }

static long divide(long a, long b) { return a % MOD * inverse(b) % MOD; }
      `),
      cpp(`
long long inverse(long long b) { return power(b, MOD - 2, MOD); }

long long divide(long long a, long long b) { return a % MOD * inverse(b) % MOD; }
      `),
    ),
    warn(
      "Fermat's inverse is wrong on a composite modulus, and undefined when `b` shares a factor with `p`. For a composite modulus use the extended Euclidean algorithm, which needs only that `gcd(b, m) == 1`. Reaching for `power(b, m - 2, m)` on a modulus like 10^9 (not prime!) gives a number that is not an inverse of anything.",
    ),
    code(
      java(`
// Extended Euclid: finds x with b*x ≡ 1 (mod m). Works for any coprime b, m.
static long inverseAnyMod(long b, long m) {
    long[] r = {b % m, m}, x = {1, 0};
    while (r[1] != 0) {
        long q = r[0] / r[1];
        long tr = r[0] - q * r[1]; r[0] = r[1]; r[1] = tr;
        long tx = x[0] - q * x[1]; x[0] = x[1]; x[1] = tx;
    }
    if (r[0] != 1) return -1;                  // no inverse: gcd(b, m) != 1
    return (x[0] % m + m) % m;
}
      `),
      cpp(`
long long inverseAnyMod(long long b, long long m) {
    long long r0 = b % m, r1 = m, x0 = 1, x1 = 0;
    while (r1) {
        long long q = r0 / r1;
        long long tr = r0 - q * r1; r0 = r1; r1 = tr;
        long long tx = x0 - q * x1; x0 = x1; x1 = tx;
    }
    if (r0 != 1) return -1;                    // gcd(b, m) != 1
    return (x0 % m + m) % m;
}
      `),
    ),

    h('Factorials and nCr'),
    p(
      'Precompute factorials and their inverses once, then every binomial coefficient is two multiplications. The backwards pass for inverse factorials is the part worth learning — it computes all `n` of them from a single modpow rather than `n` of them.',
    ),
    code(
      java(`
static long[] fact, invFact;

static void precompute(int n) {
    fact = new long[n + 1];
    invFact = new long[n + 1];
    fact[0] = 1;
    for (int i = 1; i <= n; i++) fact[i] = fact[i - 1] * i % MOD;

    // One modpow, then walk down: invFact[i-1] = invFact[i] * i.
    invFact[n] = power(fact[n], MOD - 2, MOD);
    for (int i = n; i > 0; i--) invFact[i - 1] = invFact[i] * i % MOD;
}

static long nCr(int n, int r) {
    if (r < 0 || r > n) return 0;              // guard BEFORE indexing
    return fact[n] * invFact[r] % MOD * invFact[n - r] % MOD;
}
      `),
      cpp(`
vector<long long> fact, invFact;

void precompute(int n) {
    fact.assign(n + 1, 1);
    invFact.assign(n + 1, 1);
    for (int i = 1; i <= n; i++) fact[i] = fact[i - 1] * i % MOD;

    invFact[n] = power(fact[n], MOD - 2, MOD);
    for (int i = n; i > 0; i--) invFact[i - 1] = invFact[i] * i % MOD;
}

long long nCr(int n, int r) {
    if (r < 0 || r > n) return 0;
    return fact[n] * invFact[r] % MOD * invFact[n - r] % MOD;
}
      `),
    ),
    tip(
      'The `r < 0 || r > n` guard is not defensive padding. Combinatorial formulas routinely produce out-of-range arguments in their edge cases, and returning 0 is the mathematically correct answer as well as the thing that stops an array index exception.',
    ),

    h('The two moduli'),
    table(
      ['Modulus', 'Why it exists'],
      [
        ['10^9 + 7', 'Prime, fits comfortably in 32 bits, products fit in 64. The default.'],
        ['998244353', 'Prime, and equals 119·2^23 + 1 — so it has a 2^23-th root of unity and supports NTT.'],
      ],
    ),
    p(
      'They are not interchangeable, and the choice tells you something. A problem specifying 998244353 is often signalling that the intended solution is a convolution, whether or not you end up needing one. Read which one the statement asked for, and use exactly that.',
    ),

    h('Common traps'),
    table(
      ['Symptom', 'Cause'],
      [
        ['Wrong answer, plausible magnitude', '`int` multiplication overflowing before the `%`.'],
        ['Negative output', 'Subtraction without `+ MOD`.'],
        ['Inverse is nonsense', 'Fermat on a composite modulus, or on a multiple of `p`.'],
        ['TLE in a counting loop', 'A modpow inside the loop. Precompute inverse factorials.'],
        ['Array index out of bounds in nCr', 'No `r > n` guard.'],
        ['Off by a factor', 'Mixing the two moduli within one solution.'],
        ['`power` returns 0 for a valid base', 'Base was negative and not normalised before the loop.'],
      ],
    ),

    h('Complexity'),
    table(
      ['Operation', 'Cost'],
      [
        ['add / sub / mul', 'O(1)'],
        ['power(a, n)', 'O(log n)'],
        ['inverse via Fermat', 'O(log p)'],
        ['inverse via extended Euclid', 'O(log m)'],
        ['Precompute factorials to n', 'O(n) plus one O(log p) modpow'],
        ['nCr after precompute', 'O(1)'],
      ],
    ),

    links(
      link('Binary exponentiation — cp-algorithms', 'https://cp-algorithms.com/algebra/binary-exp.html'),
      link('Modular inverse — cp-algorithms', 'https://cp-algorithms.com/algebra/module-inverse.html'),
      link('Binomial coefficients — cp-algorithms', 'https://cp-algorithms.com/combinatorics/binomial-coefficients.html'),
      link('Modular Arithmetic — USACO Guide', 'https://usaco.guide/gold/modular'),
    ),
  ],
};
