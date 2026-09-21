import { asked, diagram, flow, h, links, p, quick, table, tip, warn, wiki } from '../blocks.js';
import { interviewLevel } from './shapes.js';

export const doc = {
  blocks: [
    p(
      'Probably the worst traffic shape of any system on this list. At 10:00:00 sharp, **millions of people click for a few thousand Tatkal seats** — and unlike a flash sale, a seat is not interchangeable: it is a specific berth, on a specific train, for a specific set of legs of a journey.',
    ),

    flow(['Queue at the gate', 'Search trains', 'Select seats', 'Block inventory', 'Pay', 'Ticket'], 'Tatkal path'),
    diagram(
      `
   THE LEG PROBLEM  —  why a seat is not a counter

   train:  DEL ──▶ AGR ──▶ JHS ──▶ BPL ──▶ NGP ──▶ BOM
   legs:      L1     L2      L3      L4      L5

   passenger A books DEL ▶ JHS     occupies L1, L2
   passenger B books BPL ▶ BOM     occupies L4, L5

   berth 23:  L1 ███ L2 ███ L3 ░░░ L4 ███ L5 ███

                          └── still sellable to
                              a JHS ▶ BPL passenger!

   ONE berth can carry several passengers on one run.
   "seats available" is a question about a RANGE OF LEGS,
   not a number.
`,
      'Inventory is per leg, not per train',
    ),

    h('The pieces'),
    table(
      ['Piece', 'What it does', 'Why it is there'],
      [
        ['**Queue / gate**', 'Admits users at a controlled rate', 'Millions of concurrent clients must not reach the booking core'],
        ['**Train / schedule store**', 'Routes, timings, stations, fares', 'Read-only during the day; cached completely'],
        ['**Availability service**', 'Seats free per class, per leg range', 'The hottest read in the system, and it changes constantly'],
        ['**Inventory / allocation**', 'The authoritative seat map', 'Strongly consistent, and the single point of contention'],
        ['**Booking service**', 'PNR creation, passenger details', 'Transactional with allocation'],
        ['**Payment**', 'Gateway integration, with retries', 'A famously flaky dependency at exactly the wrong moment'],
        ['**Waitlist / RAC**', 'Ordered queue for when seats free up', 'A first-class feature, not an error case'],
      ],
    ),

    h('The hard part — surviving 10:00:00'),
    diagram(
      `
   requests/sec
       │
   10M ┤        ╷
       │        │
    5M ┤        │
       │        │
    1M ┤        │
       │        │
     0 ┤────────┴────────────────────────
       └─────────────────────────────────▶
            10:00:00   10:00:30   10:05

   the entire day's contention in ninety seconds.
   you do not autoscale into this. you sit behind a gate.
`,
      'The shape of Tatkal',
    ),
    table(
      ['Layer', 'What it does'],
      [
        ['**1. Static everything**', 'Schedules, fares and station lists are on a CDN. They do not change at 10am'],
        ['**2. Pre-authenticate**', 'Log in and fill passenger details *before* the window opens'],
        ['**3. Admission queue**', 'A signed position issued at the gate; the booking core sees a fixed arrival rate'],
        ['**4. Bot defence**', 'CAPTCHA, device binding, per-account rate limits — most of the traffic is scripts'],
        ['**5. Fail fast**', 'Once a class is exhausted, reject at the edge. Never let it reach allocation'],
        ['**6. Short transactions**', 'Block the berth, then let the user pay. Never hold a lock across the gateway'],
      ],
    ),
    warn(
      'The defining constraint: **a seat cannot be oversold.** Unlike a feed or a cache, there is no acceptable eventual-consistency story here — two people with the same berth is a person standing in a corridor. Every shortcut has to preserve that.',
    ),

    h('Block, then pay'),
    flow(['Select', 'Block berth (TTL ~10 min)', 'Pay', 'Confirm', 'PNR'], 'Never one transaction'),
    table(
      ['Step', 'Guarantee'],
      [
        ['**Block**', 'A short transaction marks specific berths held, with an expiry'],
        ['**Pay**', 'Happens outside any database lock, and may take minutes'],
        ['**Confirm**', 'Block becomes an allocation; PNR is issued'],
        ['**Expire**', 'Payment never completed → berths return to the pool automatically'],
        ['**Reconcile**', 'Payment succeeded after expiry → refund, or re-allocate if still free'],
      ],
    ),
    p(
      'That last row is real and must be designed for. A gateway can confirm a payment **after** your hold expired, and the system has to have an answer: refund automatically rather than leave a customer charged with no ticket.',
    ),

    h('Waitlist and RAC'),
    table(
      ['State', 'Meaning', 'Design implication'],
      [
        ['**Confirmed**', 'A specific berth is yours', 'An allocation row'],
        ['**RAC**', 'You may board; a shared berth', 'A separate, smaller pool with its own counter'],
        ['**Waitlisted**', 'Position N in an ordered queue', 'A strictly ordered list — position is a promise'],
        ['**Chart preparation**', 'Hours before departure, everything resolves', 'A big batch job that promotes the queue and finalises the chart'],
      ],
    ),
    tip(
      'Waitlist promotion is a **batch job, not a trigger**. Cancellations happen all day; resolving them one at a time against a contended seat map is far more expensive than periodically running the queue in order — and chart preparation is the deadline that makes batching correct rather than lazy.',
    ),

    h('Fairness'),
    table(
      ['Mechanism', 'Effect'],
      [
        ['Queue position at the gate', 'Deterministic order; removes the refresh war'],
        ['Per-account booking limits', 'One account cannot take a whole coach'],
        ['Device and payment binding', 'Raises the cost of running a hundred fake accounts'],
        ['Staggered Tatkal windows by class', 'Splits one enormous spike into several smaller ones'],
        ['CAPTCHA at the gate', 'Crude, unpopular, and genuinely effective against scripts'],
      ],
    ),

    h('Scale'),
    table(
      ['Dimension', 'Order of magnitude', 'What breaks first'],
      [
        ['Peak concurrent users', 'Millions in one minute', 'Anything not behind the gate'],
        ['Bookings/day', '~1–2M', 'Modest — it is the concentration that hurts'],
        ['Peak booking rate', 'Thousands/s, for ~60 seconds', 'The allocation store'],
        ['Availability queries', 'Far higher than bookings', 'Cached with a very short TTL, and accepted as approximate'],
        ['Trains × legs × classes × days', 'Tens of millions of rows', 'Partition by train and date'],
      ],
    ),
    tip(
      'Availability is allowed to be **approximate and stale by seconds**; allocation never is. Splitting the system along that line is what makes the read side cacheable while the write side stays correct.',
    ),

    h('Failures'),
    table(
      ['What dies', 'Effect', 'Mitigation'],
      [
        ['Payment gateway', 'Bookings held but unconfirmed', 'Multiple gateways; holds expire and release; reconcile late payments'],
        ['Allocation store', 'No bookings at all', 'The one component that must not fail — replicated, with failover'],
        ['Availability cache', 'Users see stale counts', 'Acceptable. The block step is the real check'],
        ['Admission queue', 'Nobody is admitted', 'The safest failure: nothing is oversold, the window just pauses'],
        ['Search', 'Cannot find trains', 'Static and CDN-served, so it rarely fails'],
      ],
    ),

    h('Interview'),
    quick([
      ['What it is', 'Seat reservation with extreme, scheduled contention'],
      ['The hard part', 'Millions of concurrent buyers against an inventory that is per-leg, not a count'],
      ['Key decision', 'Admission gate in front; short block transaction, payment outside any lock'],
      ['Trade-off', 'Availability is stale and approximate; allocation is exact and serialised'],
      [
        '30-second answer',
        '"A seat is not a counter — a berth sells per leg, so availability is a range query. The spike is the constraint: schedules are static and CDN-served, users pre-authenticate, and an admission gate turns millions of concurrent clients into an arrival rate allocation can take. Booking is a short transaction blocking specific berths with a TTL; payment happens outside any lock and expiry returns them. Waitlists resolve in a batch job at chart preparation."',
      ],
    ]),
    asked([
      ['Why is a seat not just a counter?', 'A berth is sold per leg. Two passengers can share one berth on different sections of the route.'],
      ['How do you handle the 10am spike?', 'Static content on a CDN, pre-authentication, and an admission gate that fixes the arrival rate.'],
      ['Why block then pay?', 'Never hold a database lock across a payment gateway. Block briefly, pay outside the transaction, expire on failure.'],
      ['What if payment confirms after the hold expired?', 'Reconcile — refund automatically, or re-allocate if the berth is still free.'],
      ['How does the waitlist work?', 'A strictly ordered queue promoted by a batch job, finalised at chart preparation.'],
    ]),

    interviewLevel('IRCTC'),
    links(
      wiki('Concurrency_control', 'Concurrency control'),
      wiki('Two-phase_locking', 'Two-phase locking'),
    ),
  ],
};
