import { asked, diagram, flow, h, links, p, quick, table, tip, warn, wiki } from '../blocks.js';
import { interviewLevel } from './shapes.js';

export const doc = {
  blocks: [
    p(
      'The same e-commerce shape as Amazon, designed around a different constraint: **the flash sale**. Ten million people want a thousand phones at exactly 12:00:00, and every one of them is refreshing. This is Hotstar\'s spike problem with money attached.',
    ),

    flow(['Waiting room', 'Admission token', 'Product page', 'Reserve', 'Pay', 'Order'], 'Sale path'),
    diagram(
      `
   12:00:00 — 10,000,000 clients, 1,000 units

   WITHOUT A GATE                    WITH A GATE

   10M ──▶ product page              10M ──▶ waiting room (static,
       ──▶ add to cart                        served by CDN)
       ──▶ checkout                       │
       ──▶ inventory row                  ▼ admit N per second
              │                      ┌─────────┐
              ▼                      │  token  │ signed, time-boxed
        ONE HOT ROW                  └────┬────┘
        10M writers                       │ only token holders
              │                           ▼ reach the real path
              ▼                      ┌─────────┐
        ✗ database melts             │ checkout│ ~5,000 concurrent
        ✗ nobody buys anything       └─────────┘
        ✗ site is down for                │
          non-sale customers too          ▼
                                     ✓ 1,000 units sold calmly
                                     ✓ the rest of the site is fine
`,
      'Admission control is the whole design',
    ),

    h('The pieces'),
    table(
      ['Piece', 'What it does', 'Why it is there'],
      [
        ['**Waiting room**', 'A static page, served by CDN, that polls for admission', 'The only thing that can absorb 10M concurrent clients'],
        ['**Admission service**', 'Issues signed, time-boxed tokens at a fixed rate', 'Converts an unbounded spike into a known arrival rate'],
        ['**Inventory counter**', 'Redis counter per SKU, decremented atomically', 'The database cannot take 10M writes on one row'],
        ['**Reservation**', 'Short TTL, created on successful decrement', 'Same pattern as Amazon, just far hotter'],
        ['**Order queue**', 'Accepts the order, processes asynchronously', 'The user gets a fast answer; the work happens behind'],
        ['**Payment**', 'With retries and a second acquirer', 'Gateways degrade under exactly this load too'],
      ],
    ),

    h('The hard part — one row, ten million writers'),
    p(
      'Even with admission control, inventory for one SKU is a **single hot key**. Two techniques make it survivable.',
    ),
    diagram(
      `
   1. COUNT IN REDIS, NOT THE DATABASE

      DECR stock:iphone   ──▶ atomic, single-threaded,
                              ~100k ops/sec, no lock contention
      returns < 0         ──▶ sold out, reject immediately

   2. SHARD THE COUNTER

      1,000 units ──▶ split across 10 buckets of 100

        stock:iphone:0  = 100    client hashes to a bucket
        stock:iphone:1  = 100    ──▶ 10x the throughput
        ...                      ──▶ empty bucket? try another
        stock:iphone:9  = 100        (or declare sold out)

      the last few units are slightly awkward.
      selling 998 of 1000 is an acceptable trade.
`,
      'Two fixes for a hot key',
    ),
    table(
      ['Technique', 'What it buys', 'What it costs'],
      [
        ['**Counter in Redis**', 'Atomic, in-memory, no row lock', 'A durability gap — reconcile against the DB afterwards'],
        ['**Sharded counter**', 'N times the write throughput', 'The final few units are hard to allocate exactly'],
        ['**Reject early**', 'Once zero, reject at the edge', 'Nothing. This is free and essential'],
        ['**Async order creation**', 'Checkout returns in milliseconds', 'The order is confirmed a moment later, by notification'],
      ],
    ),
    tip(
      '**Fail fast, at the outermost layer possible.** Once a SKU is sold out, that fact should be in the CDN and in every app server\'s local memory — a request that is going to be rejected must never reach the inventory store.',
    ),

    h('Fairness'),
    table(
      ['Approach', 'Perception', 'Reality'],
      [
        ['First come, first served', 'Feels fair', 'Rewards the fastest network, and bots'],
        ['Waiting room with a queue position', 'Feels fairest', 'Position is assigned on arrival, so still speed-based'],
        ['Random admission from the waiting pool', 'Feels arbitrary', 'Genuinely the fairest, and hostile to bots'],
        ['Pre-registration then a lottery', 'Transparent', 'Removes the spike entirely — the best answer where it is allowed'],
      ],
    ),
    warn(
      'Bots are a design input, not an afterthought. A sale with no defence is **won entirely by scripts** — which is why admission tokens are signed and bound to a session, and why rate limits sit per account and per device rather than per IP.',
    ),

    h('Protecting the rest of the site'),
    p(
      'A sale must not take down ordinary shopping. Bulkheading is what keeps the blast radius contained: **separate service pools, separate database connection pools, separate caches** for sale traffic.',
    ),
    flow(['Edge', 'Sale pool', 'Normal pool'], 'Split at the door'),

    h('Scale'),
    table(
      ['Dimension', 'At sale time', 'What breaks first'],
      [
        ['Concurrent clients', '~10M', 'Anything that is not static'],
        ['Waiting-room polls', 'Millions/s', 'Nothing — CDN with a short TTL'],
        ['Admitted rate', '~5,000/s, chosen by you', 'The number you tuned checkout to survive'],
        ['Inventory ops', '~100k/s on one key', 'Redis, which is why it is sharded'],
        ['Payment calls', 'Thousands/s', 'The gateway, usually before you do'],
      ],
    ),

    h('Failures'),
    table(
      ['What dies', 'Effect', 'Mitigation'],
      [
        ['Redis counter', 'Cannot sell', 'Replicated with failover; reconcile against the DB afterwards'],
        ['Payment gateway', 'Orders stuck pending', 'Second acquirer; hold the reservation and retry'],
        ['Order service', 'Orders queued, not created', 'The queue is the buffer; users see "confirming"'],
        ['Admission service', 'Nobody is admitted', 'The safest failure — the sale pauses, nothing is oversold'],
        ['A sale pool', 'Sale down, rest of the site fine', 'Exactly what bulkheading is for'],
      ],
    ),

    h('Interview'),
    quick([
      ['What it is', 'E-commerce optimised for extreme, scheduled spikes'],
      ['The hard part', '10M concurrent buyers against one inventory row'],
      ['Key decision', 'Admission control at the edge; sharded in-memory counters'],
      ['Trade-off', 'A waiting room adds friction and converts an unbounded spike into a rate you chose'],
      [
        '30-second answer',
        '"The spike is the design. A CDN-served waiting room absorbs ten million clients and an admission service issues signed tokens at whatever rate checkout can actually take — turning an unbounded spike into a known arrival rate. Inventory is a Redis counter, sharded into buckets so one SKU is not one hot key, decremented atomically to create a short-TTL reservation. Sold-out is pushed to the edge so rejected requests never reach the store, and sale traffic runs in its own bulkhead."',
      ],
    ]),
    asked([
      ['How do you handle 100x traffic for ten minutes?', 'Pre-scale, put a waiting room in front, and admit at a rate you have load-tested.'],
      ['How do you avoid a hot inventory row?', 'Count in Redis, shard the counter into buckets, and reject sold-out requests at the edge.'],
      ['Is first-come-first-served fair?', 'It rewards fast connections and bots. Random admission or a lottery is fairer.'],
      ['How do you protect normal shopping?', 'Bulkhead it — separate pools, connections and caches for sale traffic.'],
      ['What if Redis loses the counter?', 'Replicate with failover and reconcile against the durable inventory afterwards. Slight under-selling beats overselling.'],
    ]),

    interviewLevel('Flipkart'),
    links(
      wiki('Bulkhead_pattern', 'Bulkhead pattern'),
      wiki('Thundering_herd_problem', 'Thundering herd'),
    ),
  ],
};
