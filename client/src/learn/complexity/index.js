/**
 * The Complexity track's table of contents.
 *
 * Metadata only, like the other tracks — every topic's body is its own module
 * behind `load`, and this file ships with the track page so the list and the
 * filter cost one small chunk.
 *
 * The odd one out in Learn, and deliberately: React and Node.js are notes about
 * somebody's API, and this is the maths under the roadmap. It lives here rather
 * than in a pattern guide because a pattern guide is about one technique, and
 * "what does `O(n log n)` mean" is a thing you need before the first guide makes
 * sense — and again on every problem after it.
 *
 * Section order is reading order, and it is an argument: logarithms before
 * Big-O, because the notation is unreadable if the `log` in it is a mystery;
 * counting before the tables, because a cheat sheet you cannot derive is a
 * thing you forget by Thursday.
 */

export const title = 'Complexity';

export const summary =
  'Logarithms from scratch, then Big-O: what each shape costs, how to count it off your own code, how to read the target complexity out of a problem’s constraints, and the tables worth knowing cold.';

export const sections = [
  {
    key: 'foundations',
    title: 'The idea',
    blurb: 'The maths first — one page of it — and then what the notation is actually claiming.',
    topics: [
      {
        slug: 'logarithms',
        title: 'Logarithms, from scratch',
        summary: 'How many times can you halve n before you hit 1 — and why that is the whole idea.',
        tags: ['basics', 'maths', 'log'],
        ask: [
          'Explain log base 2 to me like I have never seen a logarithm before.',
          'Why is binary search O(log n) and not O(n/2)?',
          'Why does the base of the logarithm not matter in Big-O?',
        ],
        load: () => import('./logarithms.js'),
      },
      {
        slug: 'big-o',
        title: 'Big-O in plain words',
        summary: 'Growth, not seconds: dropping constants, O vs Ω vs Θ, best/average/worst, and amortised.',
        tags: ['basics', 'notation', 'interview'],
        ask: [
          'What is the difference between O, Omega and Theta, and which should I say out loud?',
          'Why do we drop constants and lower-order terms in Big-O?',
          'What does amortised O(1) actually guarantee?',
        ],
        load: () => import('./big-o.js'),
      },
    ],
  },
  {
    key: 'counting',
    title: 'Counting it',
    blurb: 'Reading a complexity off code you have never seen — the drill, one shape at a time.',
    topics: [
      {
        slug: 'time-complexity',
        title: 'Time complexity, counted off the code',
        summary: 'Every shape from O(1) to O(n!), each with the code that produces it, plus recursion and the traps.',
        tags: ['time', 'examples', 'recursion'],
        ask: [
          'Walk me through counting the time complexity of a nested loop where the inner one starts at i.',
          'Why is a two-pointer loop O(n) when it looks nested?',
          'How do I work out the complexity of a recursive function?',
        ],
        load: () => import('./time-complexity.js'),
      },
      {
        slug: 'space-complexity',
        title: 'Space complexity',
        summary: 'Auxiliary space, the call stack you forgot to count, and trading memory for time on purpose.',
        tags: ['space', 'memory', 'recursion'],
        ask: [
          'Does the recursion call stack count towards space complexity?',
          'What is the difference between auxiliary space and total space?',
          'How do I turn an O(n·m) DP table into O(m) space?',
        ],
        load: () => import('./space-complexity.js'),
      },
    ],
  },
  {
    key: 'using-it',
    title: 'Using it',
    blurb: 'The two things you do with complexity in a real interview: pick the target before you start, and know the numbers.',
    topics: [
      {
        slug: 'from-constraints',
        title: 'Reading the constraints',
        summary: 'n ≤ 10⁵ means O(n log n). Turning the input size into a target complexity, and the target into a shortlist of techniques.',
        tags: ['interview', 'strategy', 'constraints'],
        ask: [
          'The problem says n ≤ 2 × 10⁵ — what complexity should I be aiming for?',
          'Why does n ≤ 20 usually mean a bitmask solution?',
          'How many operations per second should I assume when I estimate?',
        ],
        load: () => import('./from-constraints.js'),
      },
      {
        slug: 'cheatsheet',
        title: 'The cheat sheet',
        summary: 'Every table: data structures, sorting, Java collections, the C++ STL, JS built-ins, and the graph algorithms.',
        tags: ['reference', 'tables', 'revision'],
        ask: [
          'Why is a hash table O(1) average but O(n) worst case?',
          'Why is building a heap O(n) when each insert is O(log n)?',
          'When is a TreeMap the right choice over a HashMap?',
        ],
        load: () => import('./cheatsheet.js'),
      },
    ],
  },
];
