import { asked, diagram, flow, h, links, p, quick, table, tip, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'The lookup table. Something is slow or falling over — this says what to add, **in the order you would actually add it**, and when each one stops helping. Every row goes cheapest and least invasive first, because the first fix is usually free and the last one is a quarter of engineering time.',
    ),

    h('The order, always'),
    flow(['Measure', 'Remove work', 'Cache it', 'Spread it', 'Split it'], 'Cheapest first'),
    p(
      'Skipping straight to the last box is the single most common mistake in a design round. **Sharding a database that is missing an index** is a real thing people propose out loud.',
    ),

    h('The database is the bottleneck'),
    table(
      ['In order', 'What it does', 'Stops helping when'],
      [
        ['**1. Find the slow query**', 'One bad query is usually the whole problem', 'The slow queries are all fast now'],
        ['**2. Add an index**', 'Turns a table scan into a lookup', 'Writes slow down — every index is a write cost'],
        ['**3. Fix N+1**', 'One query instead of 500 from a loop', 'The remaining queries are all necessary'],
        ['**4. Cache**', 'The same read stops reaching the DB', 'Data is too fresh or too varied to cache'],
        ['**5. Read replicas**', 'Reads spread across machines', 'It is the **writes** that do not fit'],
        ['**6. Shard**', 'Writes and data volume both scale out', 'You have cross-shard queries you cannot avoid'],
      ],
    ),
    tip(
      'Steps 1–3 are free and fix most cases. Step 5 fixes only reads. **Step 6 is the only one that scales writes**, and it is the only one that is irreversible.',
    ),

    h('Traffic is too high'),
    table(
      ['In order', 'What it does', 'Stops helping when'],
      [
        ['**1. CDN**', 'Static bytes never reach you at all', 'The traffic is dynamic and personalised'],
        ['**2. Load balancer + more app servers**', 'Horizontal capacity at the tier that is easy to grow', 'The app tier is not the constraint — something behind it is'],
        ['**3. Autoscaling**', 'Capacity follows demand instead of peak', 'The spike is faster than the warm-up time'],
        ['**4. Rate limiting**', 'Protects the system from the traffic you do not want', 'The traffic is all legitimate'],
        ['**5. Queue the writes**', 'Accept fast, process at your own pace', 'The user needs the answer synchronously'],
      ],
    ),
    warn(
      'Autoscaling is not a spike answer. A node takes 30–120 seconds to be useful; a spike that arrives in 10 seconds is served by **pre-scaled capacity** or not at all.',
    ),

    h('Requests are slow'),
    diagram(
      `
   where did the 800ms go?

   client ──── 120ms ────▶ edge ──── 40ms ────▶ service ─┐
                                                         │
        ┌────────── 30ms ◀── cache ◀─────────────────────┤
        │                                                │
        └────────── 610ms ◀── database ◀─────────────────┘
                              ▲
                              └── this is the answer.
                                  find it before fixing anything.
`,
      'Measure first, and per hop',
    ),
    table(
      ['Where the time is', 'What to reach for'],
      [
        ['Network to the user', 'CDN, edge termination, a closer region'],
        ['Waiting on the database', 'Index, cache, replica — in that order'],
        ['Waiting on another service', 'Timeout + circuit breaker, then parallelise the calls'],
        ['Doing slow work inline', 'Move it to a queue and return immediately'],
        ['Many sequential calls', 'Fan out in parallel; the cost becomes the slowest, not the sum'],
        ['Serialisation / payload size', 'Send less, compress, paginate'],
      ],
    ),

    h('Something keeps failing'),
    table(
      ['Symptom', 'Fix', 'Why'],
      [
        ['One service dies and takes others with it', '**Circuit breaker**', 'Stop calling a thing that is already failing'],
        ['Retries make the outage worse', '**Backoff + jitter**, retry budget', 'Synchronised retries are a self-inflicted DDoS'],
        ['A slow dependency ties up every thread', '**Timeout + bulkhead**', 'Isolate the pool so one callee cannot starve the rest'],
        ['A machine dies and takes data with it', '**Replication**', 'More than one copy, on more than one box'],
        ['The whole region is gone', '**Multi-region failover**', 'Redundancy above the level that failed'],
        ['A retry charged the card twice', '**Idempotency keys**', 'The same request applied twice must mean once'],
      ],
    ),

    h('The cache is the problem'),
    table(
      ['Symptom', 'Name', 'Fix'],
      [
        ['Cache restarts, database falls over', 'Cold cache', 'Warm it before taking traffic; stagger restarts'],
        ['One key expires, 10,000 requests hit the DB at once', 'Stampede', 'Lock-and-fill, or serve stale while one caller refreshes'],
        ['Everything expires at the same moment', 'Avalanche', 'Jitter the TTLs'],
        ['One key gets a disproportionate share of traffic', 'Hot key', 'Replicate the key across nodes, or cache it locally too'],
        ['Requests for things that do not exist miss every time', 'Penetration', 'Cache the negative result too'],
        ['Users see old data after they changed it', 'Stale read', 'Write-through, or read your own writes from the primary'],
      ],
    ),

    h('The queue is backing up'),
    table(
      ['In order', 'What it does'],
      [
        ['**1. Add consumers**', 'The usual answer, and often the only one needed'],
        ['**2. Add partitions**', 'Consumers cannot exceed partitions in Kafka — this is the real ceiling'],
        ['**3. Make the consumer faster**', 'Batch the writes it makes; stop doing one round trip per message'],
        ['**4. Shed load**', 'Drop or downgrade what does not matter. A backlog that never drains is worse than dropped work'],
        ['**5. Backpressure upstream**', 'Slow the producer down before the queue becomes the outage'],
      ],
    ),
    warn(
      'A growing queue is a **capacity problem wearing a disguise**. Adding consumers buys time; if the backlog grows again the next day, the consumers were never the constraint.',
    ),

    h('The one-page version'),
    table(
      ['If this is the bottleneck', 'Add, in this order'],
      [
        ['**Database reads**', 'Index → cache → read replicas'],
        ['**Database writes**', 'Batch → queue → shard'],
        ['**Traffic volume**', 'CDN → load balancer → horizontal scale → autoscale'],
        ['**Response time**', 'Measure → cache → parallelise → async'],
        ['**Failures cascading**', 'Timeout → retry with jitter → circuit breaker → bulkhead'],
        ['**One hot shard or key**', 'Add a suffix to the key → replicate it → dedicated capacity'],
        ['**Cost**', 'Right-size → cache harder → tier storage → spot/reserved capacity'],
        ['**One region is too far**', 'CDN → read replica in region → full multi-region'],
      ],
    ),
    tip(
      'Say the ladder out loud in the interview even when you jump to the end: *"long term this needs sharding, but I would index and cache first because they are a day of work and this is a quarter."* That sentence is most of the score.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'A lookup from symptom to fix, ordered cheapest-first'],
      ['Why it matters', 'Design rounds are mostly "and what if that is not fast enough?"'],
      ['Use when', 'The interviewer adds pressure to a design you already drew'],
      ['Trade-off', 'Every fix down the list buys scale and costs complexity'],
      [
        '30-second answer',
        '"First I would measure where the time actually goes. Then remove work — indexes, N+1, payload size. Then cache it. Then spread it across more machines. Only then split the data itself, because sharding is the one step you cannot walk back."',
      ],
    ]),
    asked([
      ['The database is slow. What do you do?', 'Profile it. Index the slow query. Then cache, then replicas, then shard.'],
      ['When do read replicas not help?', 'When writes are the constraint. Replicas add read capacity and a little write cost.'],
      ['How do you handle a sudden 10x spike?', 'Pre-scale if it is predictable, shed load and queue if it is not. Autoscaling is too slow.'],
      ['A service is timing out. What now?', 'Timeout, then circuit breaker so callers fail fast, then degrade that feature rather than the page.'],
      ['What is the first thing you always do?', 'Measure. Every fix here is wasted if it targets the wrong hop.'],
    ]),

    links(wiki('Bottleneck_(production)', 'Bottleneck'), wiki('Amdahl%27s_law', "Amdahl's law")),
  ],
};
