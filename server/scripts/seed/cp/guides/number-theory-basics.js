import { code, cpp, h, java, link, links, p, table, tip, ul, warn } from '../../guides/blocks.js';

export default {
  patternSlug: 'number-theory-basics',
  title: 'GCD, Divisors & the Sieve',
  summary:
    'Factorisation, divisor counting and gcd — the three primitives most 1200–1600 maths problems are assembled from.',
  blocks: [
    p(
      'Number theory at the lower end of the ladder is not deep. It is three facts and their consequences: the Euclidean algorithm computes gcd in logarithmic time, every composite `n` has a prime factor at most `√n`, and a sieve gives you every prime below `n` in barely more than linear time. Almost every 1200–1600 maths problem is one of those three applied to something the statement dressed up.',
    ),
    p(
      'What makes these problems feel hard is usually not the number theory — it is that the statement is about painting fences or distributing sweets, and the divisibility structure is hidden. The recognition to build is: whenever the answer depends on which numbers divide which, one of these three primitives is the machinery.',
    ),

    h('When to reach for it'),
    ul(
      'Divisibility conditions in the statement — "divisible by", "multiple of", "share a common factor".',
      '"How many pairs with gcd equal to k".',
      'Counting or enumerating divisors of a number.',
      'Prime factorisation, or "is this prime", with values up to 10^12 or so.',
      'Many queries about numbers in a fixed range — that is a sieve, precomputed once.',
      'LCM problems, which are gcd problems: `lcm(a,b) = a / gcd(a,b) * b`.',
    ),

    h('GCD'),
    p(
      'The Euclidean algorithm, in one line: `gcd(a, b) = gcd(b, a mod b)`, terminating when `b` is zero. It runs in O(log min(a, b)) — the worst case is consecutive Fibonacci numbers, and even there it is fast.',
    ),
    code(
      java(`
long gcd(long a, long b) { return b == 0 ? a : gcd(b, a % b); }

// lcm, without overflowing: divide BEFORE multiplying.
long lcm(long a, long b) { return a / gcd(a, b) * b; }
      `),
      cpp(`
long long gcd(long long a, long long b) { return b ? gcd(b, a % b) : a; }
// C++17 also ships std::gcd and std::lcm in <numeric>.

long long lcm(long long a, long long b) { return a / gcd(a, b) * b; }
      `),
    ),
    warn(
      '`a * b / gcd(a, b)` overflows where `a / gcd(a, b) * b` does not, and the two are otherwise identical. With `a` and `b` up to 10^9 the product is 10^18, which is inside a 64-bit range but only just — and an lcm accumulated over several values overflows immediately. Always divide first.',
    ),
    tip(
      '`gcd(0, x) == x`, which is genuinely useful: initialise a running gcd to 0 and fold the array into it without a special case for the first element. It is also a source of bugs when 0 appears in input you did not expect it in.',
    ),

    h('Factorisation'),
    p(
      'Trial division to `√n`. After the loop, whatever remains above 1 is itself a prime — that is the step people forget, and it silently drops the largest prime factor of every number with one.',
    ),
    code(
      java(`
// Prime factorisation of n. Works comfortably to about 10^12.
Map<Long, Integer> factorise(long n) {
    Map<Long, Integer> f = new LinkedHashMap<>();
    for (long p = 2; p <= n / p; p++) {        // p <= n/p, NOT p*p <= n
        while (n % p == 0) { f.merge(p, 1, Integer::sum); n /= p; }
    }
    if (n > 1) f.merge(n, 1, Integer::sum);    // the leftover prime
    return f;
}
      `),
      cpp(`
map<long long, int> factorise(long long n) {
    map<long long, int> f;
    for (long long p = 2; p <= n / p; p++) {   // p <= n/p avoids p*p overflow
        while (n % p == 0) { f[p]++; n /= p; }
    }
    if (n > 1) f[n]++;
    return f;
}
      `),
    ),
    warn(
      'The loop condition is `p <= n / p`, not `p * p <= n`. With `n` near 10^18, `p * p` overflows a signed 64-bit integer, the condition goes false early or wraps negative, and the factorisation is silently wrong for exactly the inputs that matter.',
    ),
    p(
      'Divisor enumeration is the same loop shape. Pair up `d` with `n / d` and stop at the square root — and count a perfect square\'s root exactly once.',
    ),
    code(
      java(`
List<Long> divisors(long n) {
    List<Long> d = new ArrayList<>();
    for (long i = 1; i <= n / i; i++) {
        if (n % i != 0) continue;
        d.add(i);
        if (i != n / i) d.add(n / i);          // do not add the root twice
    }
    Collections.sort(d);
    return d;
}
      `),
      cpp(`
vector<long long> divisors(long long n) {
    vector<long long> d;
    for (long long i = 1; i <= n / i; i++) {
        if (n % i) continue;
        d.push_back(i);
        if (i != n / i) d.push_back(n / i);
    }
    sort(d.begin(), d.end());
    return d;
}
      `),
    ),
    tip(
      'A number below 10^18 has at most 103,680 divisors, and below 10^9 at most 1,344. If a solution is "enumerate the divisors and try each", that bound is what makes it fast enough — worth knowing so you can talk yourself into the approach.',
    ),

    h('The sieve'),
    p(
      'For many queries in a fixed range, precompute. The plain sieve marks composites; the smallest-prime-factor variant is strictly more useful, because it also factorises any number in the range in O(log n) with no division loop at all.',
    ),
    code(
      java(`
// Smallest prime factor for every value up to N.
int[] spf = new int[N + 1];
List<Integer> primes = new ArrayList<>();
for (int i = 2; i <= N; i++) {
    if (spf[i] == 0) { spf[i] = i; primes.add(i); }
    for (int p : primes) {
        if (p > spf[i] || (long) i * p > N) break;
        spf[i * p] = p;                       // each composite marked once
    }
}

// Factorise anything <= N by walking down spf. No division loop.
Map<Integer, Integer> fastFactorise(int x, int[] spf) {
    Map<Integer, Integer> f = new LinkedHashMap<>();
    while (x > 1) { int p = spf[x]; f.merge(p, 1, Integer::sum); x /= p; }
    return f;
}
      `),
      cpp(`
vector<int> spf(N + 1, 0);
vector<int> primes;
for (int i = 2; i <= N; i++) {
    if (!spf[i]) { spf[i] = i; primes.push_back(i); }
    for (int p : primes) {
        if (p > spf[i] || (long long)i * p > N) break;
        spf[i * p] = p;
    }
}

map<int,int> fastFactorise(int x, vector<int>& spf) {
    map<int,int> f;
    while (x > 1) { int p = spf[x]; f[p]++; x /= p; }
    return f;
}
      `),
    ),
    warn(
      'Memory before speed. A `boolean[]` sieve to 10^7 is 10MB and fine; an `int[]` spf array to 10^7 is 40MB and will exceed a 256MB limit once the rest of the solution is allocated too. Check the limit before choosing which sieve you need.',
    ),

    h('The counting identity'),
    p(
      'The one derived technique worth learning here, because a large family of problems collapses onto it. To count pairs with `gcd == k`: first count pairs where `k` divides both — that is easy, it is the number of multiples of `k` choose two — then subtract the pairs whose gcd is a larger multiple of `k`. Working downwards means every subtraction is already computed.',
    ),
    code(
      java(`
// exactly[k] = number of pairs (i < j) with gcd(a[i], a[j]) == k.
long[] countByGcd(int[] a, int MAXV) {
    long[] cnt = new long[MAXV + 1];
    for (int x : a) cnt[x]++;

    long[] exactly = new long[MAXV + 1];
    for (int k = MAXV; k >= 1; k--) {
        long multiples = 0;
        for (int m = k; m <= MAXV; m += k) multiples += cnt[m];
        exactly[k] = multiples * (multiples - 1) / 2;
        // Remove pairs whose gcd is a proper multiple of k — already known.
        for (int m = 2 * k; m <= MAXV; m += k) exactly[k] -= exactly[m];
    }
    return exactly;
}
      `),
      cpp(`
vector<long long> countByGcd(vector<int>& a, int MAXV) {
    vector<long long> cnt(MAXV + 1, 0);
    for (int x : a) cnt[x]++;

    vector<long long> exactly(MAXV + 1, 0);
    for (int k = MAXV; k >= 1; k--) {
        long long multiples = 0;
        for (int m = k; m <= MAXV; m += k) multiples += cnt[m];
        exactly[k] = multiples * (multiples - 1) / 2;
        for (int m = 2 * k; m <= MAXV; m += k) exactly[k] -= exactly[m];
    }
    return exactly;
}
      `),
    ),
    p(
      'The nested loop looks quadratic and is not: summing `MAXV / k` over all `k` is the harmonic series, so the whole thing is O(MAXV log MAXV). That "sum over multiples" shape appears everywhere in this area and is always this complexity — recognising it saves you from talking yourself out of a correct approach.',
    ),

    h('Common traps'),
    table(
      ['Symptom', 'Cause'],
      [
        ['Wrong for large n only', '`p * p <= n` overflowing. Use `p <= n / p`.'],
        ['Missing the largest prime factor', 'No `if (n > 1)` after the trial-division loop.'],
        ['lcm overflows', '`a * b / g` instead of `a / g * b`.'],
        ['Perfect squares counted twice', 'No `i != n / i` guard in divisor enumeration.'],
        ['Memory limit exceeded', '`int[]` sieve where a `boolean[]` would do.'],
        ['TLE factorising many numbers', 'Trial division per query. Sieve the spf once.'],
        ['Off by one on gcd of an empty prefix', '`gcd(0, x) == x` — usually a feature, occasionally a bug.'],
      ],
    ),

    h('Complexity'),
    table(
      ['Operation', 'Cost'],
      [
        ['gcd(a, b)', 'O(log min(a, b))'],
        ['Trial-division factorisation', 'O(√n)'],
        ['Divisor enumeration', 'O(√n)'],
        ['Sieve of Eratosthenes', 'O(n log log n)'],
        ['Linear (spf) sieve', 'O(n)'],
        ['Factorise with spf', 'O(log n)'],
        ['Sum-over-multiples pass', 'O(n log n)'],
      ],
    ),

    links(
      link('Sieve of Eratosthenes — cp-algorithms', 'https://cp-algorithms.com/algebra/sieve-of-eratosthenes.html'),
      link('Euclidean algorithm — cp-algorithms', 'https://cp-algorithms.com/algebra/euclid-algorithm.html'),
      link('Divisors — cp-algorithms', 'https://cp-algorithms.com/algebra/divisors.html'),
      link('Linear sieve — cp-algorithms', 'https://cp-algorithms.com/algebra/prime-sieve-linear.html'),
    ),
  ],
};
