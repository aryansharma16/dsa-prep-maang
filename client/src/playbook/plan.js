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
 * ---------------------------------------------------------------------------
 * And what he is aiming at, because that decided what is in here.
 *
 * MAANG-bar Indian product companies — Swiggy, Razorpay, Flipkart, Uber, CRED,
 * PhonePe, Atlassian and the like — alongside the MAANG loops themselves. That
 * target is why this plan has three tracks and not one, because those loops are
 * not only DSA:
 *
 *   DSA          two rounds, mediums under a clock. The bulk of the plan.
 *   Machine      one round, 60–120 min, write something that RUNS and can be
 *   coding/LLD   extended live. Common at Swiggy, Razorpay and Flipkart, and
 *                the round this candidate is closest to passing already — the
 *                RBAC system on his resume is an LLD answer he has shipped.
 *   HLD          one round, the 45-minute whiteboard conversation.
 *   SQL          a screen or a round at most product companies, and cheap to
 *                buy back: he already writes SQL at work.
 *
 * A plan that spent twenty-four weeks on DSA alone would leave him strong in
 * the round he shares with every other candidate and untested in the two rounds
 * where three years of shipping backend code is an advantage. So DSA still owns
 * about three quarters of the hours, and the other two tracks are funded — see
 * below — rather than wished for.
 *
 * ---------------------------------------------------------------------------
 * Capacity, from the hours actually available:
 *
 *   Mon–Fri  07:00–09:00        2h   new problems
 *   Mon–Thu  20:00–23:00        2h   revision, re-solves, notes  (2h of work
 *                                    inside a 3h window — the spare hour is
 *                                    what absorbs a late evening at the office,
 *                                    not extra work)
 *   Friday   20:00–23:00        2h   revision queue, then the SQL Lab (w4–15)
 *   Sat                       6.5h   pattern deep-dive, ladder, mock, review
 *   Sun                       6.5h   sweep, design, planning
 *                            ────
 *                             33h /week  ·  ~790h across the plan
 *
 * The problem targets below are weighted, not divided: an Easy counts 0.6, a
 * Medium 1.0, a Hard 1.6. The sixteen weeks that carry new work come to 429
 * weighted units, ~27 a week, which is what each week is actually built to.
 *
 * ---------------------------------------------------------------------------
 * What the other two tracks cost, and what paid for them.
 *
 * Nothing was added on top. 33 hours was already a full week beside a full-time
 * job, and a plan that quietly asks for 38 is a plan you fail in week three.
 * Both new tracks are funded by moving hours that were buying less:
 *
 *  - SQL (w4–15, 90 min every Friday) takes the Friday evening re-solve hour.
 *    Friday night after a work week is the worst DSA hour in the schedule and
 *    the first one to get skipped; SQL is the lowest-activation-energy thing on
 *    the list for someone who already writes it. Friday morning's flagged
 *    problems roll into Saturday's deep-dive instead. 117 problems, twelve
 *    sessions, done by the time phase 3 starts.
 *
 *  - LLD (w14–22, 90 min every Sunday) takes the Sunday ladder session, which
 *    halves the ladder from week 14 — 150 CP problems rather than 192. This is
 *    the cheapest hour in the plan to spend: rule 7 already says the ladder is
 *    bought for implementation speed and never for rating, and by week 14 that
 *    speed is largely bought. No interviewer at Swiggy or Razorpay will ask for
 *    a Codeforces handle; one of them will ask for a parking lot that compiles.
 *
 * Both trades are stated here rather than buried because the honest version of
 * "I added system design" is always "I removed something else".
 *
 * ---------------------------------------------------------------------------
 * The plan targets 396 of the roadmap's 517 problems, and that gap is the point.
 *
 * It used to target all 429, back when 429 was the whole roadmap. Then the
 * roadmap grew to 517 and the arithmetic stopped working: covering everything in
 * the same twenty-four weeks means 34 units a week against a 33h/week budget
 * that was already full, which does not produce a better-prepared candidate — it
 * produces a plan you are behind on by week six and a drift line you learn to
 * ignore.
 *
 * So the schedule targets a subset and the roadmap keeps the rest. The subset is
 * every problem on Striver's SDE Sheet or NeetCode 150, plus every problem
 * reported asked at a named company in 2025-26 (`askedRecently`). That is 401
 * problems and exactly 429 weighted units — very slightly *lighter* per week
 * than the plan already was, so the twenty-four weeks and the target date hold
 * without being renegotiated.
 *
 * Two consequences worth stating, because both look like bugs otherwise:
 *
 *  - The phase bars still measure against every problem in the pattern, not
 *    against the targeted subset. They answer "how much of this pattern have I
 *    done", which is a question about you; the weekly target answers "what does
 *    this week ask for", which is a question about the schedule. Restricting the
 *    bars to the subset would mean solving an untargeted problem moved nothing,
 *    and a bar that ignores real work is worse than one that never reaches 100%.
 *  - `concurrency` is targeted by no week at all. It is 6 problems asked in a
 *    dedicated round at Databricks and Netflix, neither of which is on the
 *    target list, and it is not an algorithm pattern — putting it in the ramp
 *    would cost a week of the ramp to buy nothing. It stays on the roadmap.
 *
 * 5 of the subset's 401 are concurrency problems, which is why the sixteen week
 * targets sum to 396 rather than 401.
 * ---------------------------------------------------------------------------
 */

export const PLAN_WEEKS = 24;

/**
 * A line that reads one way for the account this plan was written for, and
 * another way for everybody else.
 *
 * The playbook is an ordinary module now — every role gets it, see
 * server/src/config/modules.js — and most of this document travels fine. A
 * schedule, a solve loop and a revision ladder are the same advice whoever is
 * reading them.
 *
 * What does not travel is the handful of lines that lean on one CV: the systems
 * that person built, the stack they work in, the sentences they said while the
 * plan was being written. Left alone those read as a plan addressed to somebody
 * else, which is the fastest way to stop trusting one — and they put one
 * account's employment history in front of every other account.
 *
 * So they are authored twice, side by side in the same call, and `speak()`
 * collapses the document to one reading before anything renders. Side by side
 * rather than in a second file, because the only real risk here is drift: a
 * generic line reworded six months from now should have its personal twin on
 * the next line, not in a module nobody remembers to open.
 *
 * Both readings ship in the client bundle either way. This is a presentation
 * split, not a privacy boundary — the same trade the Learn prose makes. Whoever
 * reads the bundle finds both, so anything that genuinely must not reach
 * another account cannot be authored in this file at all.
 */
const voiced = (generic, own) => ({ generic, own });

/**
 * Collapse every `voiced()` node in a structure to one of its two readings.
 *
 * Structural rather than a lookup table of ids, so a voiced line can be added
 * anywhere in the document — a week's extras, a track's lead, a rule's body —
 * without also registering it somewhere. The two readings are resolved once at
 * module load, not per render: there are exactly two possible documents and
 * rebuilding either on every keystroke would be work spent on nothing.
 */
const speak = (node, own) => {
  if (Array.isArray(node)) return node.map((item) => speak(item, own));
  if (node && typeof node === 'object') {
    if (typeof node.generic === 'string' && typeof node.own === 'string') {
      return own ? node.own : node.generic;
    }
    return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, speak(v, own)]));
  }
  return node;
};

/** The four acts, and what each one is for. */
const PHASES = [
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
    cpTarget: 68,
  },
  {
    id: 'p3',
    n: 3,
    name: 'Hard mode',
    from: 14,
    to: 18,
    hue: 'violet',
    aim: 'DP, hard graphs, and both design tracks running.',
    detail:
      'The part everyone finds hard, taken slowly and on a brain that has had thirteen weeks of practice. One pattern a week, no stacking. Both design tracks are live from here: high-level design took the Tuesday and Thursday evening hour in week 13, and low-level design takes the Sunday ladder session from week 14. The ladder halves to pay for it — that is deliberate, and it is the cheapest hour in the plan to move.',
    patterns: ['dp-1d', 'dp-2d', 'advanced-graphs', 'design'],
    cpTier: 'specialist',
    cpTarget: 22,
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
      'Six weeks of doing it the way it will actually happen: cold, random, timed, narrated out loud. Every problem you have solved gets seen once more, the company-tagged sets get drilled, design goes to eight hours a week, and Saturday’s pattern deep-dive becomes a timed machine-coding build — because by now there is no new pattern left to dive into, and that round is the one you can still move furthest on. Applications went out in week 16, so the loops start landing in here.',
    patterns: [],
    cpTier: null,
    cpTarget: 20,
  },
];

const pad = (n) => String(n).padStart(2, '0');

/** The weeks the SQL Lab owns the Friday evening block. */
export const SQL_WEEKS = { from: 4, to: 15 };

/** The weeks low-level design owns the Sunday ladder session. */
export const LLD_WEEKS = { from: 14, to: 22 };

/**
 * The commitments every week asks for, regardless of which patterns it holds.
 *
 * Generated rather than written out twenty-four times, because they are the
 * same handful of commitments each week and a typo in one of a hundred literals
 * is a checkbox that silently never persists.
 *
 * Three of them are conditional on the week, and each condition is a schedule
 * decision written once here rather than remembered every Sunday: the ladder
 * drops to a single session in week 14 when low-level design takes the other
 * one, SQL owns Friday evening for twelve weeks, and mocks start in week 6.
 * The ids do not change when a label does, so a week already ticked stays
 * ticked across a re-word.
 */
const standardTasks = (n, opts = {}) => [
  { id: `w${pad(n)}-target`, label: 'Hit this week’s problem target' },
  ...(opts.cp === 0
    ? []
    : [
        {
          id: `w${pad(n)}-cp`,
          label:
            n >= LLD_WEEKS.from
              ? 'One ladder session (Saturday) — Sunday’s is LLD now'
              : 'Two ladder sessions (Sat + Sun)',
        },
      ]),
  ...(n >= SQL_WEEKS.from && n <= SQL_WEEKS.to
    ? [{ id: `w${pad(n)}-sql`, label: 'Friday SQL block — 90 minutes, ~10 problems' }]
    : []),
  ...(n >= LLD_WEEKS.from && n <= LLD_WEEKS.to
    ? [{ id: `w${pad(n)}-lld`, label: 'Sunday LLD block — 90 minutes' }]
    : []),
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
const WEEKS = [
  // ---- Phase 1 · Rebuild the base -----------------------------------------
  {
    n: 1,
    phase: 'p1',
    focus: 'Arrays & hashing',
    patterns: ['arrays-hashing'],
    target: 38,
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
    target: 22,
    cp: 8,
    extras: ['Note the trigger for each: sorted input → two pointers, "subarray sum" → prefix'],
  },
  {
    n: 3,
    phase: 'p1',
    focus: 'Sliding window & bits',
    patterns: ['sliding-window', 'bit-manipulation'],
    target: 21,
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
    extras: [
      'Monotonic stack is one template — derive Daily Temperatures and Largest Rectangle from it',
      'SQL starts Friday and runs to week 15 — 90 minutes, joins first. It is the cheapest round on the loop to pass',
    ],
  },
  {
    n: 5,
    phase: 'p1',
    focus: 'Linked lists, then consolidate',
    patterns: ['linked-list'],
    target: 22,
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
    target: 42,
    cp: 8,
    extras: ['The heaviest week in the plan. Sunday is the buffer — use it, do not skip revision'],
  },
  {
    n: 8,
    phase: 'p2',
    focus: 'BSTs & heaps',
    patterns: ['bst', 'heap'],
    target: 29,
    cp: 8,
    extras: ['"Top K", "median", "merge k" → heap. Make that reflex automatic'],
  },
  {
    n: 9,
    phase: 'p2',
    focus: 'Backtracking & intervals',
    patterns: ['backtracking', 'intervals'],
    target: 28,
    cp: 8,
    extras: ['One backtracking skeleton: choose → recurse → un-choose. Everything else is the pruning'],
  },
  {
    n: 10,
    phase: 'p2',
    focus: 'Graphs — BFS, DFS, union-find',
    patterns: ['graphs'],
    target: 20,
    cp: 8,
    extras: ['Grid problems are graph problems. Write BFS and DFS from memory before you start'],
  },
  {
    n: 11,
    phase: 'p2',
    focus: 'Greedy & tries',
    patterns: ['greedy', 'tries'],
    target: 30,
    cp: 8,
    extras: ['Greedy needs a proof. If you cannot say why the exchange works, it is not solved'],
  },
  {
    n: 12,
    phase: 'p2',
    focus: 'Strings & math',
    patterns: ['strings', 'math-geometry'],
    target: 30,
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
      'High-level design block 1 starts — 4h this week, Tue and Thu evenings plus Sunday',
    ],
  },

  // ---- Phase 3 · Hard mode -------------------------------------------------
  {
    n: 14,
    phase: 'p3',
    focus: '1-D DP · low-level design begins',
    patterns: ['dp-1d'],
    target: 25,
    cp: 4,
    extras: [
      'Every DP problem gets the same four lines written down: state, transition, base case, order',
      'Recursion + memo first, table second. Always, this whole phase',
      'LLD starts Sunday and takes the ladder session. The ladder is half from here — that is the trade, and it is the right one',
    ],
  },
  {
    n: 15,
    phase: 'p3',
    focus: '2-D dynamic programming',
    patterns: ['dp-2d'],
    target: 17,
    cp: 4,
    extras: [
      'Grids, two strings, intervals. Nine Hards in here — expect a slow week and plan for it',
      'Last SQL Friday. Finish the bank — window functions and the six Hards are what is left',
    ],
  },
  {
    n: 16,
    phase: 'p3',
    focus: 'Advanced graphs',
    patterns: ['advanced-graphs'],
    target: 17,
    cp: 4,
    milestone: 'Start applying — referrals out, loops take 4–8 weeks to schedule',
    extras: [
      'Dijkstra, Bellman-Ford, Floyd-Warshall, Prim, Kruskal, topological sort — write each from memory once',
      'This is the week you start applying. Not week 24 — the calendar is the long pole',
      'Applying means referrals first. Swiggy, Razorpay, Flipkart, CRED, PhonePe, Atlassian, Uber — one warm intro beats twenty cold forms',
      'Read the JD for the round list. If it names a machine-coding or LLD round, weeks 17–22 are the ones that decide it',
    ],
  },
  {
    n: 17,
    phase: 'p3',
    focus: 'Design problems · full DP revision',
    patterns: ['design'],
    target: 5,
    cp: 4,
    extras: [
      'LRU, LFU, Min Stack, Twitter, Median from Data Stream — the ones that look like system design in miniature',
      'Re-solve every DP problem from weeks 14–15 from an empty file',
    ],
  },
  {
    n: 18,
    phase: 'p3',
    focus: 'Consolidate — all 396 seen',
    patterns: [],
    target: 0,
    cp: 6,
    milestone: 'Plan complete — every one of the 396 targeted problems attempted',
    extras: [
      'Mixed random sets only — use Pick one, no pattern labels, no warning',
      'Three mocks this week',
      'Honest audit: which patterns still need the editorial? Those are weeks 19–21',
      'First full machine-coding build under the clock — 90 minutes, runnable, with a main() that demonstrates it',
    ],
  },

  // ---- Phase 4 · Interview mode -------------------------------------------
  {
    n: 19,
    phase: 'p4',
    focus: 'Revision sweep A + interviews begin',
    patterns: [],
    target: 0,
    cp: 4,
    extras: [
      'Arrays, hashing, two pointers, prefix, sliding window, stack, linked list — every one, timed, from empty',
      'Two mocks. Design goes to 8h/week from here — 4h high-level, 4h low-level',
      'Saturday’s pattern deep-dive becomes the machine-coding build. There is no new pattern left to dive into',
    ],
  },
  {
    n: 20,
    phase: 'p4',
    focus: 'Revision sweep B',
    patterns: [],
    target: 0,
    cp: 4,
    extras: [
      'Binary search, trees, BST, heap, backtracking, graphs, greedy, tries',
      'Two mocks, both with a design round attached — one high-level, one machine coding',
      'SQL refresher: one hour, the window-function and Hard rows you left in week 15',
    ],
  },
  {
    n: 21,
    phase: 'p4',
    focus: 'Revision sweep C',
    patterns: [],
    target: 0,
    cp: 4,
    extras: [
      'DP, advanced graphs, design, strings, math',
      'Two mocks',
      voiced(
        'Take the largest system you have built at work and draw it as an LLD answer — entities, interfaces, and how the next feature gets added without touching the core',
        'Draw the RBAC system you built at work, as an LLD answer. Entities, interfaces, how a new permission type gets added without touching the checker',
      ),
    ],
  },
  {
    n: 22,
    phase: 'p4',
    focus: 'Company sets — the product-company pool',
    patterns: [],
    target: 0,
    cp: 3,
    extras: [
      'Filter the roadmap by company, frequency ≥ 60 — Flipkart, Uber, Atlassian, Goldman Sachs, then Amazon',
      'Swiggy, Razorpay, CRED and PhonePe are not tags in this roadmap. They draw from the same medium pool those five do, so those five are the proxy — do not go looking for a filter that does not exist',
      'Timed: 2 problems in 45 minutes, spoken, no pausing',
    ],
  },
  {
    n: 23,
    phase: 'p4',
    focus: 'Company sets & behavioural',
    patterns: [],
    target: 0,
    cp: 3,
    extras: [
      'Google, Meta, Microsoft, Bloomberg sets',
      voiced(
        'Write 8 STAR stories from your own work — the biggest thing you shipped, the incident you owned, the number you actually moved. Rehearse them out loud, timed to 2 minutes',
        'Write 8 STAR stories from your actual Node/React work — the RBAC rollout, the BullMQ queue, the 40% event lift. Rehearse them out loud, timed to 2 minutes',
      ),
      'One of the eight has to be a failure with a real cost and what you changed after. Every loop asks, and a polished answer to it is rarer than a polished algorithm',
    ],
  },
  {
    n: 24,
    phase: 'p4',
    focus: 'Taper',
    patterns: [],
    target: 0,
    cp: 2,
    milestone: 'Interview-ready',
    extras: [
      'Two problems a day, no more. You are not learning now, you are staying warm',
      'One design rehearsal a day, out loud, 45 minutes — alternate high-level and machine coding',
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
 *
 * Three slots carry `replaces`: they do not add hours to the week, they take
 * over a block that already existed. That flag is also what keeps
 * `PLAN_TOTALS.hoursPerWeek` honest — a replacement counted as an addition
 * would advertise a 38-hour week to someone who has 33.
 */
const TIMETABLE = [
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
    time: '20:00 – 23:00',
    hours: 2,
    title: 'Revision, re-solves, notes',
    kind: 'revision',
    detail:
      'Two hours of work inside a three-hour window — the spare hour is what absorbs a late evening at the office, not extra work. Revision queue first, always, 30 minutes. Then re-solve this morning’s flagged problems from an empty file, 60 minutes. Then one trigger line per problem you saw today, 15 minutes.',
  },
  {
    id: 'pm-sd',
    days: 'Tue & Thu (from week 13)',
    time: '20:00 – 21:00',
    hours: 1,
    replaces: 'pm',
    title: 'High-level design — replaces the re-solve hour',
    kind: 'design',
    detail:
      'The revision queue still runs first. This takes the re-solve hour twice a week, which is why weeks 13 onward have lighter problem targets.',
  },
  {
    id: 'fri-sql',
    days: 'Friday (weeks 4 – 15)',
    time: '20:00 – 23:00',
    hours: 2,
    replaces: 'pm',
    title: 'SQL Lab — takes the whole Friday evening',
    kind: 'sql',
    detail:
      'Revision queue for 30 minutes, then 90 minutes in the SQL Lab, ~10 problems. Friday night after a work week is the worst DSA hour in the schedule and the first one you will skip; SQL is the one thing on this list you can already do tired. Friday morning’s flagged problems roll into Saturday instead.',
  },
  {
    id: 'sat',
    days: 'Saturday',
    time: '10:00 – 17:00',
    hours: 6.5,
    title: 'Deep-dive · ladder · mock · review',
    kind: 'dsa',
    detail:
      'Three hours on the week’s pattern — the Hards you did not reach on weekdays, plus Friday’s rollover. Ninety minutes on the ladder. One hour of timed mock, spoken aloud. One hour writing up what the week taught you. From week 19 the deep-dive hours become the machine-coding build: there is no new pattern left to dive into.',
  },
  {
    id: 'sun',
    days: 'Sunday',
    time: '10:00 – 17:00',
    hours: 6.5,
    title: 'Sweep · design · plan',
    kind: 'revision',
    detail:
      'Ninety minutes on the ladder until week 14, then low-level design takes that slot. Two hours of revision sweep across every pattern so far. Two hours of high-level design from week 13. One hour setting up next week — and this hour is also the buffer that absorbs a week that slipped.',
  },
];

/**
 * How the work is done, which matters more than which problems get done.
 *
 * The first three are the ones that turn a brute-force habit into an interview
 * strength rather than a thing to apologise for. The last three exist because
 * a twenty-four week plan meets a bad week around week six, and what you cut
 * that week decides whether the other eighteen still work.
 */
const RULES = [
  {
    id: 'r1',
    title: 'Twenty-five minutes, then the editorial',
    body: 'Not forty, not "a bit longer". Twenty-five minutes of honest thinking is where the learning is; minute forty is where the demoralising is. Read the editorial, close it, and write the solution from an empty file the same day.',
  },
  {
    id: 'r2',
    title: 'Brute force out loud, every time, before the optimal',
    body: voiced(
      'Reaching a brute force first is not a weakness to skip past — it is the first half of the answer every interviewer wants to hear. Stating the O(n²) and then improving it is exactly the narration being scored. The optimal solution is the second half, not a replacement for the first.',
      'You already do this — it is the habit you called a weakness. It is not. Stating the O(n²) and then improving it is exactly the narration an interviewer is scoring. What you are adding is the second half, not replacing the first.',
    ),
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
    body: voiced(
      'The queue runs first every evening, no exceptions. Understanding fades a good deal faster than it feels like it does, and a solution you cannot rebuild is one you have read rather than learned. A missed queue day costs more than a missed problem day.',
      'The queue runs first every evening, no exceptions. You said it yourself: once it lands it stays, but it needs revision to stay. A missed queue day costs more than a missed problem day.',
    ),
  },
  {
    id: 'r6',
    title: 'One timed mock every Saturday, from week 6',
    body: 'Two problems, 45 minutes, talking the whole time to an empty room or a friend. Most strong coders who fail these loops fail here, not on the algorithm.',
  },
  {
    id: 'r7',
    title: 'The ladder is for speed, never for rating',
    body: 'Foundations through Specialist only — 562 of the 1,100. The 538 above that are a genuinely good curriculum for a sport you are not currently playing. After the offer, not before. And it halves in week 14, because by then the speed is bought and low-level design is not.',
  },
  {
    id: 'r8',
    title: 'Machine coding means code that runs',
    body: voiced(
      'In an LLD round nothing scores until it compiles and a main() demonstrates it. A beautiful class diagram with three unfinished methods loses to a plain solution that runs and takes the extension they add at minute 75. Build in whichever language you are fastest in rather than the one you think they want — speed beats idiom over ninety minutes, and most companies let you choose. Read the JD before you assume.',
      'In an LLD round nothing scores until it compiles and a main() demonstrates it. A beautiful class diagram with three unfinished methods loses to a plain solution that runs and takes the extension they add at minute 75. Build in the language you are fastest in — for you that is JavaScript, and every company on your list accepts it — unless a JD says otherwise.',
    ),
  },
  {
    id: 'r9',
    title: 'Sunday absorbs the slippage',
    body: 'A week will go wrong — an office deadline, a bad night, a pattern that takes three days instead of one. Sunday’s planning hour is where that gets absorbed. Do not absorb it by cutting revision, and do not absorb it by cutting sleep.',
  },
  {
    id: 'r10',
    title: 'When you must cut, cut in this order',
    body: 'Ladder first. Then the new-problem target. Then the mock. Never the revision queue, and never sleep. The order is not a preference: the queue is the only thing standing between twenty weeks of work and not being able to recall it, and every hour of the plan is written on the assumption that you slept.',
  },
  {
    id: 'r11',
    title: 'A missed day is a missed day, not a missed plan',
    body: 'The failure mode for an average-pace learner is not slowness, it is quitting after a bad week. Miss Tuesday, run the queue on Wednesday, keep the week. The drift line will tell you the truth about where you are — read it, adjust the target, and do not restart the plan from week one to feel clean.',
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
const SYSTEM_DESIGN = [
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
        body: voiced(
          'Why the session held in memory is the thing that stops you scaling out. If you have ever run two instances of an API behind a load balancer, you have met this. Name it.',
          'Why the session in memory is the thing that stops you scaling out — you have hit this in Node already. Name it.',
        ),
      },
      {
        id: 'sd-lb',
        title: 'Load balancers & health checks',
        body: 'L4 vs L7, round-robin vs least-connections vs consistent hashing, what happens to in-flight requests on a deploy.',
      },
      {
        id: 'sd-api',
        title: 'API design, idempotency, pagination',
        body: voiced(
          'The half most working developers already know. Add: idempotency keys, cursor vs offset pagination, and why retries need both.',
          'The half you already know from work. Add: idempotency keys, cursor vs offset pagination, and why retries need both.',
        ),
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
        body: voiced(
          'B-tree vs hash, composite index order, covering indexes, why a query got slow. Whatever database you use daily counts — bring an index you have actually added and the query that made you add it.',
          'B-tree vs hash, composite index order, covering indexes, why a query got slow. Mongo counts — you use it here.',
        ),
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
        body: voiced(
          'If you have ever wired up an upload to object storage, you have built one side of this already. Say it in system-design words: origin, edge, cache-control, signed URLs.',
          'You have already built the S3 side of this app. Say it in system-design words: origin, edge, cache-control, signed URLs.',
        ),
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
        title: voiced('Design the system you actually built', 'Design this app, and the one at work'),
        body: voiced(
          'The strongest answer you have is a system you have really run. Pick the biggest thing you have shipped and be able to draw it end to end — the trade-offs you actually made, the thing that broke, and what you would change at 100× the traffic.',
          'The strongest answer you have is a system you actually built. Be able to draw Ember’s architecture and your office system, with the trade-offs you really made and what you would change at 100× the traffic.',
        ),
      },
    ],
  },
];

/**
 * The low-level design track — nine weeks, weeks 14 to 22.
 *
 * This is the round the plan used to be missing entirely, and for the target
 * list it is the one with the best return on an hour. Swiggy, Razorpay and
 * Flipkart commonly run a machine-coding round: sixty to a hundred and twenty
 * minutes to build something small that RUNS, followed by "now add this" while
 * they watch. It is scored on whether it works, whether the responsibilities
 * are separated, and whether the extension lands in one place instead of six.
 *
 * It is also the round a working backend developer is closest to passing on the
 * day he starts. Three years of shipping Node services means classes,
 * interfaces, dependency injection and state machines are objects he has used,
 * not concepts he has read — the RBAC system on his resume, with modules,
 * submodules, actions and roles composed at runtime, is a machine-coding answer
 * he has already shipped to ten thousand users. What is missing is the clock,
 * the vocabulary, and the habit of designing for the extension before it is
 * asked for.
 *
 * So this track is short on theory and long on builds. Two blocks of reading,
 * one block on the clock itself, and eight things actually built.
 */
const LLD_TRACK = [
  {
    id: 'lld-b1',
    block: 'Principles, applied',
    weeks: '14 – 15',
    items: [
      {
        id: 'lld-solid',
        title: 'SOLID, as five smells rather than five acronyms',
        body: 'You do not recite these in the room, you avoid the smells they name: a class that changes for two reasons, an if-chain that grows every time a type is added, a subclass that throws on a parent method, an interface whose implementers stub half of it, a constructor that news up its own database. Find one of each in code you have written — that is the exercise.',
      },
      {
        id: 'lld-composition',
        title: 'Composition over inheritance, and when inheritance is right',
        body: 'A deep hierarchy is the most common way a machine-coding answer dies at minute 75, because the extension always arrives across the grain of the tree. Default to holding a collaborator rather than extending a base. Inheritance earns its place for a genuine is-a with a stable contract, and almost nowhere else.',
      },
      {
        id: 'lld-interfaces',
        title: 'Interfaces at the boundaries, concrete in the middle',
        body: 'Anything you would swap in a test or a requirement change gets an interface: pricing strategies, notification channels, eviction policies, payment providers. Anything else stays a plain class. An interface per class is as wrong as none at all, and it costs you the minutes you needed for the demo.',
      },
      {
        id: 'lld-entities',
        title: 'Entities, value objects, and where state lives',
        body: 'Which objects have identity and a lifecycle, which are just values, and which single object owns each piece of mutable state. Most machine-coding failures are two objects that both think they own the same field. Write the state owner down before you write a method.',
      },
      {
        id: 'lld-concurrency',
        title: 'Thread safety, enough to answer for it',
        body: voiced(
          'If your day job is single-threaded — Node, or anything behind a request-per-process runtime — this has been hidden from you and the interviewer will not hide it. Know what a race on a shared counter looks like, why the parking-lot slot allocator needs a lock, what atomicity buys you, and what you would say if they asked for two threads. Enough to reason out loud, not enough to write a scheduler.',
          'You write Node, so the runtime has been hiding this from you and the interviewer will not. Know what a race on a shared counter looks like, why the parking-lot slot allocator needs a lock, what atomicity buys you, and what you would say if they asked for two threads. Enough to reason out loud, not enough to write a scheduler.',
        ),
      },
    ],
  },
  {
    id: 'lld-b2',
    block: 'The seven patterns that actually come up',
    weeks: '15 – 16',
    items: [
      {
        id: 'lld-strategy',
        title: 'Strategy — the one you will use every single time',
        body: 'Pricing, parking fees, eviction, ranking, discounting, retry policy. Any sentence in the requirements containing "depending on" is a strategy. If you learn one pattern properly this is the one.',
      },
      {
        id: 'lld-factory',
        title: 'Factory & builder',
        body: 'Creation with a decision in it, and construction with too many arguments. Both keep the if-chain out of the caller — which is the whole point, and the reason the extension lands in one file.',
      },
      {
        id: 'lld-observer',
        title: 'Observer — every notification requirement, ever',
        body: voiced(
          '"When an order is placed, notify the restaurant, the rider and the customer." Three subscribers, one event, and a fourth added without touching the publisher. If you have ever wired a job queue or an event bus at work, you have built this — this is its name.',
          '"When an order is placed, notify the restaurant, the rider and the customer." Three subscribers, one event, and a fourth added without touching the publisher. You have built this with BullMQ; this is its name.',
        ),
      },
      {
        id: 'lld-state',
        title: 'State — every lifecycle requirement, ever',
        body: 'Order placed → accepted → picked → delivered. Vending machine idle → has-money → dispensing. Model the transitions explicitly and the illegal ones become impossible instead of unhandled. Interviewers probe exactly there.',
      },
      {
        id: 'lld-decorator',
        title: 'Decorator & chain of responsibility',
        body: voiced(
          'Toppings on a pizza, middleware on a request, a validation chain. Every web framework has a middleware pipeline and it is this pattern — naming that in the room is a strong answer.',
          'Toppings on a pizza, middleware on a request, a validation chain. You already write Express middleware — same shape, and saying so in the room is a strong answer.',
        ),
      },
      {
        id: 'lld-repository',
        title: 'Repository & dependency injection',
        body: 'In-memory maps behind an interface, injected in. It is what makes the thing testable in a round with no database, and it is a single sentence of justification that reads as senior.',
      },
      {
        id: 'lld-singleton',
        title: 'Singleton, and why to say no to it',
        body: 'Know it, use it for at most one thing, and be able to say why it makes testing hard. Reaching for it twice in a machine-coding round is a small red flag; declining it with a reason is a small green one.',
      },
    ],
  },
  {
    id: 'lld-b3',
    block: 'The clock',
    weeks: '16 – 17',
    items: [
      {
        id: 'lld-frame',
        title: 'The 90-minute frame, drilled',
        body: 'Clarify and list requirements 10 min → entities, enums and state owners on paper 10 min → interfaces for the two or three things that vary 10 min → core happy path 40 min → main() that demonstrates it 10 min → the extension they add 10 min. Write the frame on the page before you write a class, every time, until it is automatic.',
      },
      {
        id: 'lld-scope',
        title: 'Scoping out loud, in the first ten minutes',
        body: '"I am going to build single-threaded, in memory, no persistence, no framework, and I will keep the storage behind an interface so a database drops in later — does that work for you?" That one sentence buys the scope you need and signals judgement. Say it every time.',
      },
      {
        id: 'lld-runs',
        title: 'Always runnable, never half-refactored',
        body: 'Commit to a working vertical slice by minute 50 even if it is ugly, then improve. A perfect half-built design scores nothing; an honest complete one scores the round. If time is short, cut features, never cut running.',
      },
      {
        id: 'lld-extend',
        title: 'The extension question, rehearsed',
        body: 'They will add a requirement at minute 75 — a new vehicle type, a second pricing rule, a new notification channel. Practise answering it in code within ten minutes, and practise saying which file you are about to open and why before you open it.',
      },
    ],
  },
  {
    id: 'lld-b4',
    block: 'Builds, round one',
    weeks: '17 – 19',
    items: [
      {
        id: 'lld-d-parking',
        title: 'Parking lot',
        body: 'The canonical one, and it is canonical because every principle shows up: vehicle types, slot allocation strategy, a pricing strategy, a ticket lifecycle. Build it twice — once slowly, once in ninety minutes.',
      },
      {
        id: 'lld-d-splitwise',
        title: 'Splitwise',
        body: 'Equal, exact and percentage splits behind one interface, a balance sheet that nets out, and simplify-debts as the extension. Money plus strategy plus a non-trivial data structure.',
      },
      {
        id: 'lld-d-vending',
        title: 'Vending machine or ATM',
        body: 'The state-machine build. Get the illegal transitions to be unrepresentable rather than guarded by ifs, and be ready for "add refunds".',
      },
      {
        id: 'lld-d-cache',
        title: 'In-memory cache with pluggable eviction',
        body: 'LRU first, then LFU behind the same interface without touching the cache. You solved LRU as a DSA problem in week 17 — this is the same object with a design round wrapped round it, and the contrast between the two is worth noticing.',
      },
    ],
  },
  {
    id: 'lld-b5',
    block: 'Builds, round two — shaped like the target list',
    weeks: '20 – 22',
    items: [
      {
        id: 'lld-d-order',
        title: 'Food-delivery order lifecycle',
        body: 'Restaurant, order, rider assignment, state transitions, notifications on each. Swiggy-shaped on purpose, and it composes state, observer and strategy in one build.',
      },
      {
        id: 'lld-d-ledger',
        title: 'Payments: a ledger with idempotency',
        body: 'Razorpay-shaped. Double-entry balance, idempotency keys on retry, refunds as their own entries rather than mutations, statuses as a state machine. You know idempotency keys from the API side — this is the object model under them.',
      },
      {
        id: 'lld-d-rate',
        title: 'Rate limiter, as objects',
        body: 'Token bucket and sliding window behind one interface, per-key configuration, and clean composition with the HLD version you learn in the same weeks. Two rounds, one topic, two very different answers — be able to give both.',
      },
      {
        id: 'lld-d-rbac',
        title: voiced(
          'The biggest thing you have shipped, presented cold',
          'Your own RBAC system, presented cold',
        ),
        body: voiced(
          'Pick a system you have really run and draw it in forty-five minutes: the entities, the trade-offs you actually made, where it breaks at ten times the load, and how the next feature is added without touching the core. The strongest LLD answer available to anyone is one they have already shipped, and it is worth rehearsing until it is smooth.',
          'Modules, submodules, actions, roles, multi-tenant scoping — draw it in forty-five minutes with the trade-offs you actually made, where it would break at ten times the tenants, and how a new permission type is added without touching the checker. The strongest LLD answer available to you is a system you have already shipped, and it is worth rehearsing until it is smooth.',
        ),
      },
    ],
  },
];

/**
 * The SQL track — twelve Fridays, weeks 4 to 15, the whole 117-problem bank.
 *
 * The one track that is nearly free. He writes SQL at work, so this is recall
 * and edge cases rather than learning, and it sits on the Friday evening block
 * precisely because that is the block a tired brain would otherwise skip. Most
 * product companies put a SQL screen or a SQL round somewhere in the loop, and
 * it is the only round on the list you can fully finish before week 16.
 *
 * The week ranges follow the bank's own categories, easiest and most common
 * first: everything before joins is warm-up, joins is where the actual
 * interview questions live, and window functions are the part he has probably
 * never needed in a Mongo shop.
 */
const SQL_TRACK = [
  {
    id: 'sql-b1',
    block: 'Select & sorting',
    weeks: '4 – 5',
    count: 25,
    items: [
      {
        id: 'sql-select',
        title: 'select · 18 problems',
        body: 'Filtering, DISTINCT, NULL semantics, CASE. Fast — the point of these two weeks is to get the whole bank moving, not to learn anything.',
      },
      {
        id: 'sql-sorting',
        title: 'sorting · 7 problems',
        body: 'ORDER BY with ties, LIMIT/OFFSET, NULLS FIRST/LAST. Watch the dialect notes: the bank runs SQLite and flags where MySQL and Postgres differ.',
      },
    ],
  },
  {
    id: 'sql-b2',
    block: 'Joins — the block that matters',
    weeks: '6 – 8',
    count: 30,
    items: [
      {
        id: 'sql-joins',
        title: 'joins · 30 problems',
        body: 'INNER, LEFT, self-joins, anti-joins, and the two questions asked in every SQL round: rows the other table does not have, and a table joined to itself. Three Fridays, ten a night. If one block of this bank is worth slowing down for, it is this one.',
      },
    ],
  },
  {
    id: 'sql-b3',
    block: 'Aggregation',
    weeks: '9 – 10',
    count: 21,
    items: [
      {
        id: 'sql-agg',
        title: 'aggregation · 21 problems',
        body: 'GROUP BY, HAVING versus WHERE, COUNT(*) versus COUNT(col) on NULLs, aggregates over joins and the duplicate-row trap that comes with them.',
      },
    ],
  },
  {
    id: 'sql-b4',
    block: 'Subqueries, strings & dates',
    weeks: '11 – 12',
    count: 24,
    items: [
      {
        id: 'sql-sub',
        title: 'subqueries · 12 problems',
        body: 'Correlated versus not, EXISTS versus IN on NULLs, and CTEs — write the CTE version of anything nested twice, because readability is scored out loud.',
      },
      {
        id: 'sql-strings',
        title: 'strings & dates · 12 problems',
        body: 'The dialect minefield. Learn one dialect properly and know that the function names move.',
      },
    ],
  },
  {
    id: 'sql-b5',
    block: 'Window functions & writes',
    weeks: '13 – 15',
    count: 17,
    items: [
      {
        id: 'sql-window',
        title: 'window · 11 problems',
        body: 'ROW_NUMBER, RANK, DENSE_RANK, LAG/LEAD, running totals, top-N-per-group. Almost certainly new to you, and it is what separates a passing SQL round from a strong one. Give it two of the three Fridays.',
      },
      {
        id: 'sql-modify',
        title: 'modify · 6 problems',
        body: 'INSERT/UPDATE/DELETE, upserts, and deleting duplicates while keeping one — that last one is a real interview question.',
      },
      {
        id: 'sql-hard',
        title: 'The six Hards, and a clean finish',
        body: 'Week 15 is the last SQL Friday. Whatever is left of the bank ends here; anything still red gets one refresher hour in week 20 and nothing after that.',
      },
    ],
  },
];

/**
 * How a single problem is worked. The answer to "how do I actually solve one".
 *
 * The morning block is three or four of these and nothing else. Every step has
 * a clock on it because the failure mode for a careful, average-pace learner is
 * not giving up too early — it is sitting on one problem for ninety minutes,
 * getting it, and having learned a quarter of what four problems would have
 * taught.
 */
const SOLVE_LOOP = [
  {
    id: 'sl-1',
    at: '0 – 3 min',
    title: 'Read it twice. Restate it in one sentence. Write the constraints down.',
    body: 'The constraints are not decoration, they are the answer to "what complexity am I aiming for", and reading them first is the single habit that most separates people who find the optimal solution from people who find a solution. n ≤ 20 means exponential or bitmask is fine. n ≤ 500 means O(n²) or 2-D DP. n ≤ 10⁵ means O(n log n) — so sorting, a heap, or binary search. n ≤ 10⁹ means the answer is math or binary search on the answer, never a loop over n.',
  },
  {
    id: 'sl-2',
    at: '3 – 8 min',
    title: 'One small example, by hand, on paper.',
    body: 'Not the sample in the statement — your own, small enough to finish and awkward enough to be interesting. Most patterns become visible while you are doing this and never while you are staring at the statement. If you cannot produce the right output by hand you do not understand the problem yet, and no amount of typing fixes that.',
  },
  {
    id: 'sl-3',
    at: '8 – 12 min',
    title: 'State the brute force out loud, with its complexity.',
    body: 'Always, even when it is obviously too slow, and even when you can already see the optimal. This is the half of the answer you are already good at, and in the room it is scored: it proves you understood the problem before you optimised it. Saying "this is O(n²) because for every i I rescan j" is also what tells you what to attack.',
  },
  {
    id: 'sl-4',
    at: '12 – 25 min',
    title: 'Attack the brute force with the four questions.',
    body: 'What am I recomputing that I could remember? (hash map, prefix sum, DP.) Would sorting make the answer obvious? (two pointers, greedy, intervals.) Do I only ever need the biggest or smallest few? (heap.) Is the answer monotonic — if x works, does x+1 always work? (binary search on the answer.) Four questions, and between them they open most mediums. Ask them in order rather than waiting for insight to arrive.',
  },
  {
    id: 'sl-5',
    at: '25 min · hard stop',
    title: 'Editorial. Not at forty minutes. Twenty-five.',
    body: 'Minute 25 to 40 is where the demoralising happens and almost none of the learning. Read the editorial until you have the idea — then close it, and write the whole solution from an empty file with nothing open. If you cannot, read it again and repeat. The problem is not finished when you understand it; it is finished when you have typed it unaided.',
  },
  {
    id: 'sl-6',
    at: '+2 min',
    title: 'Flag it, and write the trigger line.',
    body: 'Anything that needed the editorial gets flagged — that is tonight’s re-solve, and the queue will bring it back on its own. Then one sentence in the notes: what in the statement should have told you which technique to reach for. That line is the only artefact of the morning that is still working for you in week 20.',
  },
];

/**
 * Owning a pattern: the five stages, and what each one costs.
 *
 * "How do I get comfortable with a big pattern" is the question this answers,
 * and the honest answer is that comfort is a stage you arrive at, not a feeling
 * you wait for — stage four is where it happens, and most people never get
 * there because they stop at stage three, where everything still feels fine
 * because the label is on.
 */
const PATTERN_LADDER = [
  {
    id: 'pl-1',
    stage: 'Stage 1',
    cost: '30 – 45 min',
    title: 'Read the pattern guide before you touch a problem.',
    body: 'Every pattern on the roadmap has a guide behind the book icon. Read it once, and write down the one sentence that says when this pattern applies. That sentence is what you are actually building here; the problems come after.',
  },
  {
    id: 'pl-2',
    stage: 'Stage 2',
    cost: '1 – 1.5 h',
    title: 'Get the template onto paper from memory.',
    body: 'One canonical shape per pattern — the sliding-window skeleton, the binary-search-on-answer skeleton, the choose/recurse/un-choose skeleton. Write it, close everything, write it again from empty. A pattern you cannot start without looking something up will cost you fifteen minutes in an interview you had forty-five for.',
  },
  {
    id: 'pl-3',
    stage: 'Stage 3',
    cost: '5 – 8 h',
    title: 'Eight to twelve problems with the label on.',
    body: 'You know it is sliding window, so the only thing being learned is the variation: fixed versus variable, the shrink condition, what the map holds. This is the mornings of the week, it is the bulk of the hours, and it is also the stage that feels like mastery and is not.',
  },
  {
    id: 'pl-4',
    stage: 'Stage 4',
    cost: '2 – 3 h',
    title: 'Six to eight problems with the label OFF. This is where comfort happens.',
    body: 'Pattern drill and Pick one, no pattern shown, mixed with everything you already know. Recognising the pattern is a separate skill from executing it, it is the skill the interview actually tests, and it is trained nowhere else. Skipping this stage is the most common reason a person who has solved four hundred problems freezes on a medium.',
  },
  {
    id: 'pl-5',
    stage: 'Stage 5',
    cost: '20 min',
    title: 'Teach it to an empty room in five minutes.',
    body: 'Trigger, template, complexity, one gotcha — out loud, no notes. Where you stumble is precisely what has not landed, and it is a cheaper diagnostic than another five problems. If you cannot do this, go back to stage three; if you can, the pattern is done and moves onto maintenance.',
  },
];

/**
 * What a pattern costs once you have it — the answer to "how much time do I
 * spend on a pattern I am already confident in".
 *
 * The numbers are the point. "Keep revising" is advice nobody can act on;
 * "two problems a month, thirty minutes, and here is what re-opens it" is.
 */
const PATTERN_BUDGET = {
  learn: '12 – 16 h for a big pattern (trees, graphs, DP), 4 – 6 h for a small one (bits, intervals). That is one week and half a week of your schedule respectively, which is exactly how the weeks on the plan tab are sized — trees get a week to themselves, bits share one.',
  confident:
    'Three unseen mediums in a row, solved from an empty file, inside 25 minutes, with no pattern label shown. Not "I understand it" — that feeling arrives about two weeks before it is true.',
  maintain:
    '2 problems a month, about 30 minutes. That is all a confident pattern needs, and spending more on it is the most common way this plan gets wasted: the hour is being taken from a pattern that would have moved.',
  reopen:
    'Two misses in a row on that pattern, or the leak report showing attempts-per-solve above 2.5. Then it goes back to stage 3 for four problems — not the full week, just enough to re-seat it.',
  arithmetic:
    '18 patterns × 2 problems a month ≈ 9 problems a week of maintenance ≈ 2 hours. That is the Sunday sweep, and it is why the Sunday sweep is two hours and not one.',
};

/**
 * The revision schedule, with its real weekly cost.
 *
 * He said it himself: slow to understand, durable once it lands, needs revision
 * to keep it. So this is the part of the plan that is least negotiable, and the
 * one place where the honest answer to "how much time" is a percentage of the
 * whole week rather than a number of minutes.
 */
const REVISION_SCHEDULE = [
  {
    id: 'rv-1',
    when: 'D + 1',
    cost: '~15 min each',
    title: 'The next evening, from an empty file.',
    body: 'Every problem you needed the editorial for. This is the expensive interval and the one that does all the work — a solution re-derived once, the day after, is worth more than four rereads. If a day only has time for one thing, it is this.',
  },
  {
    id: 'rv-2',
    when: 'D + 7',
    cost: '~10 min each',
    title: 'A week later, but only if D+1 was rough.',
    body: 'Anything that failed its D+1 re-solve, or needed a second look at the editorial. Clean first passes skip this interval entirely — the queue schedules it, so there is nothing to decide.',
  },
  {
    id: 'rv-3',
    when: 'D + 21',
    cost: '~8 min each',
    title: 'The Sunday sweep picks it up.',
    body: 'Two hours across every pattern seen so far, mixed, no labels. Roughly nine problems, which is the maintenance budget for eighteen patterns falling out exactly where it should.',
  },
  {
    id: 'rv-4',
    when: 'D + 60',
    cost: 'free',
    title: 'Phase 4 does it for you.',
    body: 'The three revision sweeps in weeks 19–21 and the company sets in 22–23 are the sixty-day interval for everything learned before week 14. You do not schedule this one; the plan already did.',
  },
];

/**
 * The weekly price of the schedule above, stated once so it can be argued with.
 */
const REVISION_COST = {
  weekly: '4.5 hours a week — 30 minutes every evening plus the two-hour Sunday sweep. Fourteen per cent of the budget, and the fourteen per cent that decides whether the other eighty-six are still there in February.',
  queueRule:
    'If the revision queue passes about 25 items, you are solving faster than you are retaining. Cut this week’s new-problem target until it drains. Never drain it by skipping it — a queue you have started ignoring is the point where a plan like this quietly becomes a reading list.',
};

/**
 * Mental models — what actually gets stored, and in what shape.
 *
 * An interview is a retrieval test under time pressure, not a derivation test.
 * Four artefacts, and between them they are the difference between four hundred
 * problems solved and four hundred problems available.
 */
const MENTAL_MODELS = [
  {
    id: 'mm-1',
    title: 'The trigger table is the whole thing',
    body: 'One line per problem: what in the statement told you which technique to reach for. "Sorted array, find a pair" → two pointers. "Longest/shortest substring with a constraint" → sliding window. "Next greater/smaller" → monotonic stack. "Minimum maximum" or "maximum minimum" → binary search on the answer. "Top K" → heap. "All combinations" → backtracking. By week 20 that file is two hundred lines, and re-reading it takes twenty minutes and is worth more than twenty problems.',
  },
  {
    id: 'mm-2',
    title: 'One canonical problem per pattern',
    body: 'For each of the eighteen patterns, pick the single problem you would re-derive the template from, and be able to write it from empty on any day. Sliding window → Longest Substring Without Repeating Characters. Binary search on the answer → Koko Eating Bananas. Monotonic stack → Daily Temperatures. Backtracking → Subsets. 1-D DP → House Robber. Graphs → Number of Islands. Eighteen problems is a small enough set to genuinely own, and each one is a doorway back into its whole pattern.',
  },
  {
    id: 'mm-3',
    title: 'Every pattern has one invariant. Say it in a sentence.',
    body: 'Two pointers: everything outside [l, r] is already decided. Sliding window: the window is always valid after the shrink. Monotonic stack: the stack is decreasing, so a pop is exactly the moment I found the next greater. Binary search on the answer: everything ≥ x works and everything < x does not. If you cannot state the invariant you have memorised the code and not the idea — and memorised code is what disappears under pressure.',
  },
  {
    id: 'mm-4',
    title: 'Complexity comes from the constraints, before the code',
    body: 'Read n, decide the target complexity, and only then choose the technique. It turns "think of something clever" — which is not a repeatable process — into "find the O(n log n) approach", which is. It is also the narration interviewers score highest, and it is free: you already read the constraints in the first three minutes.',
  },
];

/** The dates that matter, pinned to weeks. */
const MILESTONES = WEEKS.filter((w) => w.milestone).map((w) => ({
  week: w.n,
  label: w.milestone,
}));

/** Every checkable item on both design tracks, in the order they are worked. */
const DESIGN_TRACKS = [
  {
    id: 'hld',
    name: 'High-level design',
    weeks: '13 – 24',
    lead: voiced(
      'Four hours a week from week 13, eight from week 19. Deliberately shorter than a from-scratch syllabus: a few years of shipping web services means the request path, the database, the cache and the queue are already familiar objects. What is missing is the scale vocabulary, the numbers, and the shape of a forty-five minute conversation.',
      'Four hours a week from week 13, eight from week 19. Deliberately shorter than a from-scratch syllabus: three years of Node and React means the request path, the database, the cache and the queue are already familiar objects. What is missing is the scale vocabulary, the numbers, and the shape of a forty-five minute conversation.',
    ),
    blocks: SYSTEM_DESIGN,
  },
  {
    id: 'lld',
    name: 'Low-level design & machine coding',
    weeks: '14 – 22',
    lead: voiced(
      'Ninety minutes every Sunday from week 14, taking the slot the ladder used to have. This is the round Swiggy, Razorpay and Flipkart commonly run, and for anyone who has shipped backend code it is the round they are closest to passing on day one — you have written answers of this shape already, just without a clock on them. Short on theory, long on builds: eight things actually built and run.',
      'Ninety minutes every Sunday from week 14, taking the slot the ladder used to have. This is the round Swiggy, Razorpay and Flipkart commonly run and the one you are closest to passing on day one — the RBAC system you built is a machine-coding answer you have already shipped. Short on theory, long on builds: eight things actually built and run.',
    ),
    blocks: LLD_TRACK,
  },
];

/** Totals the header reads, computed once from the plan rather than restated. */
export const PLAN_TOTALS = {
  roadmap: WEEKS.reduce((n, w) => n + w.target, 0),
  cp: WEEKS.reduce((n, w) => n + w.cp, 0),
  sql: SQL_TRACK.reduce((n, b) => n + b.count, 0),
  designTopics: DESIGN_TRACKS.reduce(
    (n, t) => n + t.blocks.reduce((m, b) => m + b.items.length, 0),
    0,
  ),
  /*
    A slot that `replaces` another one is not extra time — it takes over a block
    that is already in the total. Counting the SQL Friday and the design evening
    as additions would advertise a 38-hour week to somebody who has 33, which is
    the arithmetic error that makes a plan quietly impossible to follow.
  */
  hoursPerWeek: TIMETABLE.filter((s) => !s.replaces).reduce(
    (n, s) => n + s.hours * (s.days.startsWith('Mon') ? 5 : 1),
    0,
  ),
};

/**
 * Page copy that carries the same two readings the document does.
 *
 * Authored here rather than as JSX literals in the five components that show
 * it, which is where it used to live. A sentence that has a personal and a
 * generic reading is part of the document, and splitting the document across a
 * data file and five render functions would mean the next person to reword one
 * of these has to find it first.
 */
const COPY = {
  start: voiced(
    'Four phases, twenty-four weeks, built on 33 hours: two in the morning, two in the evening, six and a half on each weekend day. If your week is a different shape, keep the shape of the plan and scale the weekly targets. Pick the day you start and the clock begins — every week number, target and countdown on this page is measured from it.',
    'Four phases, twenty-four weeks, built around your hours: two in the morning, two in the evening, six and a half on each weekend day. Pick the day you start and the clock begins — every week number, target and countdown on this page is measured from it.',
  ),
  designLead: voiced(
    'Nothing here runs before week 13. The first three months are ninety per cent algorithms, because that is what the loop weights when algorithms are the weakest link — and a design track started in week 2 is a design track you have forgotten by the time anyone asks about it.',
    'Nothing here runs before week 13. The first three months are ninety per cent algorithms, which is what you asked for and what the loop weights at your level — and a design track started in week 2 is a design track you have forgotten by the time anyone asks about it.',
  ),
  sqlLead: voiced(
    'The one track that is nearly free if you already write SQL at work — recall and edge cases rather than learning. Most product companies put a SQL screen somewhere in the loop, and it is the only round here you can fully finish before week 16.',
    'The one track that is nearly free — you write SQL at work, so this is recall and edge cases rather than learning. Most product companies put a SQL screen somewhere in the loop, and it is the only round on your list you can fully finish before week 16.',
  ),
  revisionLead: voiced(
    'Slow to understand, durable once it lands, needs revision to keep it — that is the learner this plan assumes, and the reason revision is its least negotiable part. The queue schedules all four intervals, so there is nothing to remember and nothing to decide.',
    'Slow to understand, durable once it lands, needs revision to keep it — your words, and the reason this is the least negotiable part of the plan. The queue schedules all four intervals, so there is nothing to remember and nothing to decide.',
  ),
  phaseFoot: voiced(
    'they exist because retention, not exposure, is what decides whether week 4 is still there in week 20',
    'they exist because you said you need revision to keep what you learn',
  ),
};

/*
  The two documents, resolved once at module load.

  `bind` adds the lookups that have to read the *resolved* weeks and phases —
  `weekAt` returns a week whose task labels may be voiced, so a single shared
  copy of it would hand the wrong reading to whichever caller asked second.
  `PLAN_TOTALS` is the opposite case and stays shared: every number in it is
  counted off fields no voice touches.
*/
const bind = (doc) => ({
  ...doc,
  PLAN_TOTALS,
  weekAt: (n) => doc.WEEKS.find((w) => w.n === n) || null,
  phaseOf: (n) => doc.PHASES.find((phase) => n >= phase.from && n <= phase.to) || null,
  /** Problems the plan expected to be finished by the end of week `n`. */
  expectedBy: (n) => doc.WEEKS.filter((w) => w.n <= n).reduce((sum, w) => sum + w.target, 0),
});

const DOCUMENT = {
  PHASES,
  WEEKS,
  TIMETABLE,
  RULES,
  SOLVE_LOOP,
  PATTERN_LADDER,
  PATTERN_BUDGET,
  REVISION_SCHEDULE,
  REVISION_COST,
  MENTAL_MODELS,
  SQL_TRACK,
  DESIGN_TRACKS,
  MILESTONES,
  COPY,
};

const READING = { own: bind(speak(DOCUMENT, true)), generic: bind(speak(DOCUMENT, false)) };

/**
 * The plan, in the reading this account should see.
 *
 * The only way out of this module for anything the voice touches — the raw
 * structures above are deliberately not exported, so a component cannot import
 * `WEEKS` directly and render `[object Object]` where a voiced line should be.
 * Use the `usePlan()` hook rather than calling this directly; it knows which
 * account is looking.
 */
export const planFor = (own) => (own ? READING.own : READING.generic);

/** The week number a date falls in, 1-based, or null before the plan starts. */
export function weekOf(startedAt, now = Date.now()) {
  if (!startedAt) return null;
  const start = new Date(startedAt).getTime();
  if (!Number.isFinite(start)) return null;
  const days = Math.floor((now - start) / 86_400_000);
  if (days < 0) return null;
  return Math.min(PLAN_WEEKS, Math.floor(days / 7) + 1);
}

