/**
 * The plan itself — twenty-four weeks, written down.
 *
 * Authored here rather than stored, like the Learn track's prose and for the
 * same reason: it is a document, identical for every render, and editing a
 * sentence should be a commit and not a migration. What *is* stored is the
 * three things this file cannot know — when it started, what has been ticked,
 * and what the retro line said. See server/src/models/Playbook.js.
 *
 * Everything else the page shows is derived at render time from rows that
 * already exist: a phase's progress bar is the real solved count of its
 * patterns, read out of RoadmapContext. Nothing here has to be told what has
 * been done.
 *
 * ---------------------------------------------------------------------------
 * Who this was written for, because a plan that does not say so is a template.
 *
 * Two to three years since college DSA. Comfortable reaching a brute force on
 * arrays, prefix sums, two pointers, linked lists, recursion and backtracking,
 * and rarely reaching the optimal one. Everything from binary search onward is
 * effectively new. A working Node/React full-stack developer, so the language,
 * the tooling and the API-shaped half of system design are not the gap —
 * algorithms and scale vocabulary are.
 *
 * Self-described average pace: slow to understand, durable once it lands, needs
 * revision to keep it. That single sentence is what shaped the whole schedule.
 * It is why every phase ends in a consolidation week with no new patterns, why
 * the evening block is revision before anything new, and why the target is
 * "solved twice from an empty file" rather than "solved".
 *
 * Capacity, from the hours actually available:
 *
 *   Mon–Fri  07:00–09:00   2h   new problems
 *   Mon–Fri  20:00–22:00   2h   revision, re-solves, notes
 *   Sat                  6.5h   pattern deep-dive, ladder, mock, review
 *   Sun                  6.5h   ladder, revision sweep, system design, planning
 *                       ────
 *                        33h /week  ·  ~790h across the plan
 *
 * The problem targets below are weighted, not divided: an Easy counts 0.6, a
 * Medium 1.0, a Hard 1.6, and the 429 roadmap problems come to 448 weighted
 * units. Spread over the eighteen weeks that carry new work, that is ~25 units
 * a week, which is what each week is actually built to.
 * ---------------------------------------------------------------------------
 */

export const PLAN_WEEKS = 24;

/** The four acts, and what each one is for. */
export const PHASES = [
  {
    id: 'p1',
    n: 1,
    name: 'Rebuild the base',
    from: 1,
    to: 5,
    hue: 'teal',
    aim: 'Re-do what you already half-know, for the optimal solution this time.',
    detail:
      'You can already reach a brute force on most of these. That is not a weakness to skip past — it is the first half of the answer every interviewer wants to hear. The work in these five weeks is turning "I got it working" into "I got it working, here is why it is O(n²), and here is the O(n)".',
    patterns: [
      'arrays-hashing',
      'two-pointers',
      'prefix-sum',
      'sliding-window',
      'bit-manipulation',
      'stack',
      'linked-list',
    ],
    cpTier: 'newbie',
    cpTarget: 40,
  },
  {
    id: 'p2',
    n: 2,
    name: 'The core machine',
    from: 6,
    to: 13,
    hue: 'blue',
    aim: 'The eight patterns that decide most interview loops.',
    detail:
      'Everything here is new ground. Binary search on the answer, trees, heaps, graphs and backtracking are what a MAANG phone screen is actually made of, and this is the longest phase on purpose. Week 13 adds nothing new — it is the week the previous seven settle.',
    patterns: [
      'binary-search',
      'trees',
      'bst',
      'heap',
      'backtracking',
      'intervals',
      'graphs',
      'greedy',
      'tries',
      'strings',
      'math-geometry',
    ],
    cpTier: 'pupil',
    cpTarget: 60,
  },
  {
    id: 'p3',
    n: 3,
    name: 'Hard mode',
    from: 14,
    to: 18,
    hue: 'violet',
    aim: 'DP, hard graphs, and the first system-design blocks.',
    detail:
      'The part everyone finds hard, taken slowly and on a brain that has had thirteen weeks of practice. One pattern a week, no stacking. System design starts here — four hours a week, and your day job has already taught you half of it.',
    patterns: ['dp-1d', 'dp-2d', 'advanced-graphs', 'design'],
    cpTier: 'specialist',
    cpTarget: 60,
  },
  {
    id: 'p4',
    n: 4,
    name: 'Interview mode',
    from: 19,
    to: 24,
    hue: 'amber',
    aim: 'No new patterns. Recall, speed, and talking while you code.',
    detail:
      'Six weeks of doing it the way it will actually happen: cold, random, timed, narrated out loud. Every problem you have solved gets seen once more, the company-tagged sets get drilled, and system design goes to eight hours a week. Applications went out in week 16, so the loops start landing in here.',
    patterns: [],
    cpTier: null,
    cpTarget: 40,
  },
];

const pad = (n) => String(n).padStart(2, '0');

/**
 * The four things every week asks for, regardless of which patterns it holds.
 *
 * Generated rather than written out twenty-four times, because they are the
 * same four commitments each week and a typo in one of ninety-six literals is a
 * checkbox that silently never persists.
 */
const standardTasks = (n, opts = {}) => [
  { id: `w${pad(n)}-target`, label: 'Hit this week’s problem target' },
  ...(opts.cp === 0 ? [] : [{ id: `w${pad(n)}-cp`, label: 'Two ladder sessions (Sat + Sun)' }]),
  ...(n >= 6
    ? [{ id: `w${pad(n)}-mock`, label: 'Saturday mock — 2 problems, 45 min, spoken aloud' }]
    : []),
  { id: `w${pad(n)}-retro`, label: 'Sunday retro — one honest line about the week' },
];

/**
 * The twenty-four weeks.
 *
 * `target` is roadmap problems newly solved that week; `cp` is ladder problems.
 * A week with `patterns: []` is deliberate rest for the pattern list and hard
 * work for everything else — those are the consolidation weeks, and skipping
 * them to "get ahead" is how the middle of a plan like this collapses.
 */
export const WEEKS = [
  // ---- Phase 1 · Rebuild the base -----------------------------------------
  {
    n: 1,
    phase: 'p1',
    focus: 'Arrays & hashing',
    patterns: ['arrays-hashing'],
    target: 32,
    cp: 6,
    extras: [
      'Write the brute force out loud before every optimal one — every problem, no exceptions this week',
      'Set your Codeforces handle on Pro Coder and sync it',
    ],
  },
  {
    n: 2,
    phase: 'p1',
    focus: 'Two pointers & prefix sums',
    patterns: ['two-pointers', 'prefix-sum'],
    target: 30,
    cp: 8,
    extras: ['Note the trigger for each: sorted input → two pointers, "subarray sum" → prefix'],
  },
  {
    n: 3,
    phase: 'p1',
    focus: 'Sliding window & bits',
    patterns: ['sliding-window', 'bit-manipulation'],
    target: 30,
    cp: 8,
    extras: ['Write the fixed-window and variable-window templates from memory once, Sunday'],
  },
  {
    n: 4,
    phase: 'p1',
    focus: 'Stacks & monotonic stacks',
    patterns: ['stack'],
    target: 25,
    cp: 8,
    extras: ['Monotonic stack is one template — derive Daily Temperatures and Largest Rectangle from it'],
  },
  {
    n: 5,
    phase: 'p1',
    focus: 'Linked lists, then consolidate',
    patterns: ['linked-list'],
    target: 19,
    cp: 10,
    milestone: 'Phase 1 done — 136 problems',
    extras: [
      'Re-solve every problem still flagged from weeks 1–4, from an empty file',
      'First self-check: can you name the pattern of 10 random solved problems from the title alone?',
    ],
  },

  // ---- Phase 2 · The core machine -----------------------------------------
  {
    n: 6,
    phase: 'p2',
    focus: 'Binary search — including on the answer',
    patterns: ['binary-search'],
    target: 25,
    cp: 8,
    extras: [
      'Learn one template and one only. Every off-by-one you hit this week goes in the notes',
      'Mocks start this Saturday and never stop',
    ],
  },
  {
    n: 7,
    phase: 'p2',
    focus: 'Trees — traversals, construction, paths',
    patterns: ['trees'],
    target: 36,
    cp: 8,
    extras: ['The heaviest week in the plan. Sunday is the buffer — use it, do not skip revision'],
  },
  {
    n: 8,
    phase: 'p2',
    focus: 'BSTs & heaps',
    patterns: ['bst', 'heap'],
    target: 33,
    cp: 8,
    extras: ['"Top K", "median", "merge k" → heap. Make that reflex automatic'],
  },
  {
    n: 9,
    phase: 'p2',
    focus: 'Backtracking & intervals',
    patterns: ['backtracking', 'intervals'],
    target: 29,
    cp: 8,
    extras: ['One backtracking skeleton: choose → recurse → un-choose. Everything else is the pruning'],
  },
  {
    n: 10,
    phase: 'p2',
    focus: 'Graphs — BFS, DFS, union-find',
    patterns: ['graphs'],
    target: 27,
    cp: 8,
    extras: ['Grid problems are graph problems. Write BFS and DFS from memory before you start'],
  },
  {
    n: 11,
    phase: 'p2',
    focus: 'Greedy & tries',
    patterns: ['greedy', 'tries'],
    target: 32,
    cp: 8,
    extras: ['Greedy needs a proof. If you cannot say why the exchange works, it is not solved'],
  },
  {
    n: 12,
    phase: 'p2',
    focus: 'Strings & math',
    patterns: ['strings', 'math-geometry'],
    target: 27,
    cp: 8,
    extras: ['Lighter week by design — the next one has no new problems at all'],
  },
  {
    n: 13,
    phase: 'p2',
    focus: 'Consolidate · system design begins',
    patterns: [],
    target: 0,
    cp: 12,
    milestone: 'Half the roadmap done — 345 problems',
    extras: [
      'No new problems. Re-solve everything flagged since week 1, from empty',
      'Two full mocks this week instead of one',
      'System design block 1 starts — 4h this week, Tue and Thu evenings plus Sunday',
    ],
  },

  // ---- Phase 3 · Hard mode -------------------------------------------------
  {
    n: 14,
    phase: 'p3',
    focus: '1-D dynamic programming',
    patterns: ['dp-1d'],
    target: 27,
    cp: 8,
    extras: [
      'Every DP problem gets the same four lines written down: state, transition, base case, order',
      'Recursion + memo first, table second. Always, this whole phase',
    ],
  },
  {
    n: 15,
    phase: 'p3',
    focus: '2-D dynamic programming',
    patterns: ['dp-2d'],
    target: 26,
    cp: 8,
    extras: ['Grids, two strings, intervals. Nine Hards in here — expect a slow week and plan for it'],
  },
  {
    n: 16,
    phase: 'p3',
    focus: 'Advanced graphs',
    patterns: ['advanced-graphs'],
    target: 21,
    cp: 8,
    milestone: 'Start applying — referrals out, loops take 4–8 weeks to schedule',
    extras: [
      'Dijkstra, Bellman-Ford, Floyd-Warshall, Prim, Kruskal, topological sort — write each from memory once',
      'This is the week you start applying. Not week 24 — the calendar is the long pole',
    ],
  },
  {
    n: 17,
    phase: 'p3',
    focus: 'Design problems · full DP revision',
    patterns: ['design'],
    target: 10,
    cp: 8,
    extras: [
      'LRU, LFU, Min Stack, Twitter, Median from Data Stream — the ones that look like system design in miniature',
      'Re-solve every DP problem from weeks 14–15 from an empty file',
    ],
  },
  {
    n: 18,
    phase: 'p3',
    focus: 'Consolidate — all 429 seen',
    patterns: [],
    target: 0,
    cp: 12,
    milestone: 'Roadmap complete — every one of the 429 attempted',
    extras: [
      'Mixed random sets only — use Pick one, no pattern labels, no warning',
      'Three mocks this week',
      'Honest audit: which patterns still need the editorial? Those are weeks 19–21',
    ],
  },

  // ---- Phase 4 · Interview mode -------------------------------------------
  {
    n: 19,
    phase: 'p4',
    focus: 'Revision sweep A + interviews begin',
    patterns: [],
    target: 0,
    cp: 8,
    extras: [
      'Arrays, hashing, two pointers, prefix, sliding window, stack, linked list — every one, timed, from empty',
      'Two mocks. System design goes to 8h/week from here',
    ],
  },
  {
    n: 20,
    phase: 'p4',
    focus: 'Revision sweep B',
    patterns: [],
    target: 0,
    cp: 8,
    extras: [
      'Binary search, trees, BST, heap, backtracking, graphs, greedy, tries',
      'Two mocks, both with a system design round attached',
    ],
  },
  {
    n: 21,
    phase: 'p4',
    focus: 'Revision sweep C',
    patterns: [],
    target: 0,
    cp: 8,
    extras: ['DP, advanced graphs, design, strings, math', 'Two mocks'],
  },
  {
    n: 22,
    phase: 'p4',
    focus: 'Company sets — Amazon & Google',
    patterns: [],
    target: 0,
    cp: 6,
    extras: [
      'Filter the roadmap by company, frequency ≥ 60. Amazon first, Google second',
      'Timed: 2 problems in 45 minutes, spoken, no pausing',
    ],
  },
  {
    n: 23,
    phase: 'p4',
    focus: 'Company sets & behavioural',
    patterns: [],
    target: 0,
    cp: 6,
    extras: [
      'Meta, Microsoft, Bloomberg sets',
      'Write 8 STAR stories from your actual Node/React work. Rehearse them out loud, timed to 2 minutes',
    ],
  },
  {
    n: 24,
    phase: 'p4',
    focus: 'Taper',
    patterns: [],
    target: 0,
    cp: 4,
    milestone: 'Interview-ready',
    extras: [
      'Two problems a day, no more. You are not learning now, you are staying warm',
      'One system design rehearsal a day, out loud, 45 minutes',
      'Sleep. A tired brain fails easy problems, and that is the only way this goes wrong now',
    ],
  },
].map((week) => ({
  ...week,
  tasks: [
    ...standardTasks(week.n, { cp: week.cp }),
    ...(week.extras || []).map((label, i) => ({ id: `w${pad(week.n)}-x${i}`, label })),
  ],
}));

/**
 * The week, laid out against the hours that actually exist.
 *
 * The morning block is new work because that is when the thinking is cheapest,
 * and the evening block is revision because recall is what a tired brain can
 * still do well. Swapping them is the single most common way a schedule like
 * this stops working.
 */
export const TIMETABLE = [
  {
    id: 'am',
    days: 'Mon – Fri',
    time: '07:00 – 09:00',
    hours: 2,
    title: 'New problems',
    kind: 'dsa',
    detail:
      'Three or four problems. Twenty-five minutes of real thinking each, then the editorial — not a minute more, and not a minute less. Anything you needed the editorial for is flagged for tonight.',
  },
  {
    id: 'pm',
    days: 'Mon – Fri',
    time: '20:00 – 22:00',
    hours: 2,
    title: 'Revision, re-solves, notes',
    kind: 'revision',
    detail:
      'Revision queue first, always — 30 minutes. Then re-solve this morning’s flagged problems from an empty file, 60 minutes. Then one trigger line per problem you saw today, 15 minutes.',
  },
  {
    id: 'pm-sd',
    days: 'Tue & Thu (from week 13)',
    time: '20:00 – 21:00',
    hours: 1,
    title: 'System design — replaces the re-solve hour',
    kind: 'design',
    detail:
      'The revision queue still runs first. This takes the re-solve hour twice a week, which is why weeks 13 onward have lighter problem targets.',
  },
  {
    id: 'sat',
    days: 'Saturday',
    time: '10:00 – 17:00',
    hours: 6.5,
    title: 'Deep-dive · ladder · mock · review',
    kind: 'dsa',
    detail:
      'Three hours on the week’s pattern — the Hards you did not reach on weekdays. Ninety minutes on the ladder. One hour of timed mock, spoken aloud. One hour writing up what the week taught you.',
  },
  {
    id: 'sun',
    days: 'Sunday',
    time: '10:00 – 17:00',
    hours: 6.5,
    title: 'Ladder · sweep · design · plan',
    kind: 'revision',
    detail:
      'Ninety minutes on the ladder. Two hours of revision sweep across every pattern so far. Two hours of system design from week 13. One hour setting up next week — and this hour is also the buffer that absorbs a week that slipped.',
  },
];

/**
 * How the work is done, which matters more than which problems get done.
 *
 * Eight rules, and the first three are the ones that turn a brute-force habit
 * into an interview strength rather than a thing to apologise for.
 */
export const RULES = [
  {
    id: 'r1',
    title: 'Twenty-five minutes, then the editorial',
    body: 'Not forty, not "a bit longer". Twenty-five minutes of honest thinking is where the learning is; minute forty is where the demoralising is. Read the editorial, close it, and write the solution from an empty file the same day.',
  },
  {
    id: 'r2',
    title: 'Brute force out loud, every time, before the optimal',
    body: 'You already do this — it is the habit you called a weakness. It is not. Stating the O(n²) and then improving it is exactly the narration an interviewer is scoring. What you are adding is the second half, not replacing the first.',
  },
  {
    id: 'r3',
    title: 'Solved means written twice, from empty',
    body: 'Once when you learn it, once the next evening from a blank file with no reference. Anything that fails the second pass is not solved — it is read. Mark it Needs revision and let the queue bring it back.',
  },
  {
    id: 'r4',
    title: 'One trigger line per problem',
    body: 'In the notes, in one sentence: what in the statement told you which technique to reach for. "Sorted array and a pair sum" → two pointers. Recall in an interview is trigger recognition, not solution memory, and this line is the only thing that trains it.',
  },
  {
    id: 'r5',
    title: 'Revision before anything new',
    body: 'The queue runs first every evening, no exceptions. You said it yourself: once it lands it stays, but it needs revision to stay. A missed queue day costs more than a missed problem day.',
  },
  {
    id: 'r6',
    title: 'One timed mock every Saturday, from week 6',
    body: 'Two problems, 45 minutes, talking the whole time to an empty room or a friend. Most strong coders who fail these loops fail here, not on the algorithm.',
  },
  {
    id: 'r7',
    title: 'The ladder is for speed, never for rating',
    body: 'Foundations through Specialist only — 409 of the 800. The 391 above that are a genuinely good curriculum for a sport you are not currently playing. After the offer, not before.',
  },
  {
    id: 'r8',
    title: 'Sunday absorbs the slippage',
    body: 'A week will go wrong — an office deadline, a bad night, a pattern that takes three days instead of one. Sunday’s planning hour is where that gets absorbed. Do not absorb it by cutting revision, and do not absorb it by cutting sleep.',
  },
];

/**
 * The system design track — twelve weeks, weeks 13 to 24.
 *
 * Shorter than a from-scratch syllabus would be, deliberately. Three years of
 * building Node APIs with React on top means the request path, the database,
 * the cache and the queue are already familiar objects; what is missing is the
 * scale vocabulary, the numbers, and the shape of the 45-minute conversation.
 * So the first block is estimation and the last is rehearsal, and the middle is
 * mostly naming things you have already used.
 */
export const SYSTEM_DESIGN = [
  {
    id: 'sd-b1',
    block: 'Foundations',
    weeks: '13 – 14',
    items: [
      {
        id: 'sd-numbers',
        title: 'Latency numbers & back-of-envelope',
        body: 'Memory vs SSD vs network vs cross-region, to an order of magnitude. QPS from DAU, storage from row size. Every design starts here and most candidates skip it.',
      },
      {
        id: 'sd-scaling',
        title: 'Vertical vs horizontal, stateless services',
        body: 'Why the session in memory is the thing that stops you scaling out — you have hit this in Node already. Name it.',
      },
      {
        id: 'sd-lb',
        title: 'Load balancers & health checks',
        body: 'L4 vs L7, round-robin vs least-connections vs consistent hashing, what happens to in-flight requests on a deploy.',
      },
      {
        id: 'sd-api',
        title: 'API design, idempotency, pagination',
        body: 'The half you already know from work. Add: idempotency keys, cursor vs offset pagination, and why retries need both.',
      },
    ],
  },
  {
    id: 'sd-b2',
    block: 'Data',
    weeks: '15 – 16',
    items: [
      {
        id: 'sd-sqlnosql',
        title: 'SQL vs NoSQL, and how to answer it without hand-waving',
        body: 'Access patterns decide it, not preference. Be able to say what you would lose either way for the specific design on the board.',
      },
      {
        id: 'sd-index',
        title: 'Indexing & query cost',
        body: 'B-tree vs hash, composite index order, covering indexes, why a query got slow. Mongo counts — you use it here.',
      },
      {
        id: 'sd-replica',
        title: 'Replication & read replicas',
        body: 'Leader/follower, replication lag, read-your-own-writes, failover.',
      },
      {
        id: 'sd-shard',
        title: 'Sharding & consistent hashing',
        body: 'Range vs hash vs directory, hot shards, resharding, the virtual-node trick.',
      },
      {
        id: 'sd-cap',
        title: 'CAP, PACELC, consistency models',
        body: 'Strong, eventual, causal, read-after-write. Which one each design actually needs, said out loud.',
      },
    ],
  },
  {
    id: 'sd-b3',
    block: 'Scale & async',
    weeks: '17 – 18',
    items: [
      {
        id: 'sd-cache',
        title: 'Caching end to end',
        body: 'Cache-aside vs write-through vs write-behind, TTL and eviction, thundering herd, stampede protection, cache invalidation. Redis specifics.',
      },
      {
        id: 'sd-queue',
        title: 'Queues & event-driven work',
        body: 'Kafka vs SQS vs RabbitMQ, at-least-once vs exactly-once, consumer groups, dead-letter queues, backpressure.',
      },
      {
        id: 'sd-rate',
        title: 'Rate limiting',
        body: 'Token bucket, leaky bucket, sliding window counter — and the distributed version, which is the interview question.',
      },
      {
        id: 'sd-cdn',
        title: 'CDN, blob storage, presigned uploads',
        body: 'You have already built the S3 side of this app. Say it in system-design words: origin, edge, cache-control, signed URLs.',
      },
      {
        id: 'sd-observ',
        title: 'Observability & failure',
        body: 'Metrics vs logs vs traces, SLI/SLO, circuit breakers, retries with jitter, graceful degradation.',
      },
    ],
  },
  {
    id: 'sd-b4',
    block: 'Designs, round one',
    weeks: '19 – 20',
    items: [
      { id: 'sd-d-url', title: 'URL shortener', body: 'Key generation, collisions, redirect path, analytics. The canonical warm-up.' },
      { id: 'sd-d-rate', title: 'Distributed rate limiter', body: 'The block-3 theory, now on a whiteboard with real numbers.' },
      { id: 'sd-d-feed', title: 'News feed', body: 'Fan-out on write vs read, the celebrity problem, ranking, pagination.' },
      { id: 'sd-d-chat', title: 'Chat / WhatsApp', body: 'WebSockets, presence, delivery receipts, message ordering, offline delivery.' },
    ],
  },
  {
    id: 'sd-b5',
    block: 'Designs, round two',
    weeks: '21 – 22',
    items: [
      { id: 'sd-d-video', title: 'YouTube / Netflix', body: 'Upload pipeline, transcoding queue, CDN, adaptive bitrate, metadata store.' },
      { id: 'sd-d-drive', title: 'Google Drive / Dropbox', body: 'Chunking, dedup, sync conflicts, metadata vs blob split.' },
      { id: 'sd-d-uber', title: 'Uber / ride matching', body: 'Geospatial indexing, quadtree vs geohash, real-time location, matching.' },
      { id: 'sd-d-search', title: 'Typeahead / search', body: 'Trie at scale, ranking, sharded index, near-real-time updates. Your tries week pays off here.' },
    ],
  },
  {
    id: 'sd-b6',
    block: 'Rehearsal',
    weeks: '23 – 24',
    items: [
      {
        id: 'sd-frame',
        title: 'The 45-minute frame, drilled',
        body: 'Requirements 5 min → estimates 5 min → high level 10 min → deep dive 15 min → bottlenecks and trade-offs 10 min. Run it to the clock until the shape is automatic.',
      },
      {
        id: 'sd-redo',
        title: 'Six designs again, cold and spoken',
        body: 'Pick six from blocks 4 and 5 at random, 45 minutes each, out loud, on a whiteboard or paper. Record one and listen back — it is unpleasant and it is the fastest fix available.',
      },
      {
        id: 'sd-yours',
        title: 'Design this app, and the one at work',
        body: 'The strongest answer you have is a system you actually built. Be able to draw Ember’s architecture and your office system, with the trade-offs you really made and what you would change at 100× the traffic.',
      },
    ],
  },
];

/** The dates that matter, pinned to weeks. */
export const MILESTONES = WEEKS.filter((w) => w.milestone).map((w) => ({
  week: w.n,
  label: w.milestone,
}));

/** Totals the header reads, computed once from the plan rather than restated. */
export const PLAN_TOTALS = {
  roadmap: WEEKS.reduce((n, w) => n + w.target, 0),
  cp: WEEKS.reduce((n, w) => n + w.cp, 0),
  designTopics: SYSTEM_DESIGN.reduce((n, b) => n + b.items.length, 0),
  hoursPerWeek: TIMETABLE.filter((s) => s.id !== 'pm-sd').reduce(
    (n, s) => n + s.hours * (s.days.startsWith('Mon') ? 5 : 1),
    0,
  ),
};

/** The week number a date falls in, 1-based, or null before the plan starts. */
export function weekOf(startedAt, now = Date.now()) {
  if (!startedAt) return null;
  const start = new Date(startedAt).getTime();
  if (!Number.isFinite(start)) return null;
  const days = Math.floor((now - start) / 86_400_000);
  if (days < 0) return null;
  return Math.min(PLAN_WEEKS, Math.floor(days / 7) + 1);
}

export const phaseOf = (weekNumber) =>
  PHASES.find((p) => weekNumber >= p.from && weekNumber <= p.to) || null;

export const weekAt = (weekNumber) => WEEKS.find((w) => w.n === weekNumber) || null;
