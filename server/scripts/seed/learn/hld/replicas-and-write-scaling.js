import { asked, code, diagram, flow, h, js, links, p, quick, table, tip, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Read replicas are the cheapest large win in a read-heavy system and they do **nothing at all for writes**. Knowing which of the two you are short of is the difference between a week of work and a quarter of it.',
    ),

    flow(['Primary', 'Replication log', 'Replica 1..N', 'Read traffic'], 'Reads spread, writes do not'),

    h('What replicas buy'),
    table(
      ['Buys', 'Detail'],
      [
        ['**Read capacity**', 'N replicas, roughly N times the read throughput'],
        ['**Availability**', 'A replica can be promoted when the primary fails'],
        ['**Locality**', 'A replica near the user removes a cross-region round trip'],
        ['**Isolation**', 'Analytics and backups run off a replica, not production'],
      ],
    ),
    warn(
      'They cost a little **write** throughput, not none: every replica applies every write. Twenty replicas do not slow the primary twenty-fold — replication is usually one stream — but they are not free, and they never add write capacity.',
    ),

    h('Replica lag, and the three anomalies'),
    diagram(
      `
   t=0   user writes "my new post"     ──▶ PRIMARY
   t=0   ack to the user
   t=1ms user's page reloads           ──▶ REPLICA (200ms behind)
                                            ──▶ post is not there

   "I posted it and it vanished"

   normal lag:     milliseconds
   during a bulk import, a long transaction, a network
   hiccup, or a replica restart:   SECONDS TO MINUTES

   designs that assume lag is always small break exactly
   when the system is already under stress.
`,
      'The bug report you will definitely receive',
    ),
    table(
      ['Anomaly', 'Symptom', 'Fix'],
      [
        ['**Read-your-writes**', 'Your own change is missing', 'Read from the primary for a few seconds after a write'],
        ['**Monotonic reads**', 'A count goes backwards', 'Pin the session to one replica'],
        ['**Causal**', 'A reply appears before the message', 'Carry a version token; wait for the replica to reach it'],
      ],
    ),
    code(
      js(`
// The read-your-writes fix, in the form most systems use: a short
// marker written on every mutation, checked on every read.
async function afterWrite(userId) {
  // 5 seconds comfortably exceeds normal lag. Under abnormal lag
  // this is still wrong — the real fix is to compare the replica's
  // applied position against the write's, where the driver exposes it.
  await redis.set(\`rw:\${userId}\`, '1', 'EX', 5);
}

async function readFor(userId, query) {
  const recentlyWrote = await redis.exists(\`rw:\${userId}\`);
  return recentlyWrote ? primary.query(query) : replica.query(query);
}
`),
    ),
    tip(
      'Routing **only the users who recently wrote** to the primary is what makes this affordable. A handful of users at any moment are in their five-second window, so the primary sees a rounding error of extra reads while everyone else still reads a replica.',
    ),

    h('Routing reads'),
    table(
      ['Strategy', 'How', 'Note'],
      [
        ['**All reads to replicas**', 'Simple', 'Accepts every anomaly above'],
        ['**Critical reads to primary**', 'Per query-type decision', 'The pragmatic default'],
        ['**Sticky after write**', 'As above, per user, briefly', 'Fixes the common complaint'],
        ['**Lag-aware routing**', 'Skip replicas lagging over a threshold', 'Needs lag monitoring; worth it at scale'],
        ['**Token-based**', 'Client carries a write position; wait for it', 'Correct; needs driver support'],
      ],
    ),

    h('When writes are the problem'),
    p('Replicas are now irrelevant. Four things to try, in this order.'),
    table(
      ['Step', 'What it does', 'Gains'],
      [
        ['**1. Reduce write amplification**', 'Drop unused indexes; batch inserts; stop writing what nobody reads', '**Often 2–5x, for a day of work**'],
        ['**2. Make writes async**', 'Accept to a queue, apply behind it', 'Absorbs spikes; does not raise steady-state capacity'],
        ['**3. Vertical scale**', 'Faster disks, more RAM, more cores', '2–10x, immediately, for money'],
        ['**4. Shard**', 'Split writes across primaries', '**Unbounded** — and irreversible'],
      ],
    ),
    tip(
      'Step one is consistently underrated. A table with eight indexes where three are never read is paying nearly **double the write cost for nothing**, and removing them is a migration you can do in an afternoon.',
    ),

    h('Connection limits'),
    diagram(
      `
   the arithmetic nobody does until it breaks

   50 app instances × 20 connections each = 1,000 connections
   Postgres max_connections                 =   100

                          ✗

   each connection costs memory AND a backend process.
   raising max_connections to 1,000 does not fix it —
   it moves the failure from "refused" to "thrashing".

   THE ANSWER: a connection POOLER

   apps (1,000) ──▶ pgbouncer ──▶ database (100)
                    multiplexes
`,
      'Why a pooler is not optional at scale',
    ),
    warn(
      'This is one of the most common scaling surprises. **Adding app servers can take the database down** — each new instance brings its own pool, and the database runs out of connections long before it runs out of CPU.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'Copies of the data serving reads, and what to do when writes are the limit'],
      ['Why it matters', 'Replicas are the cheap fix, and they solve only half the problem'],
      ['Use when', 'Read-heavy and the data tolerates a little lag'],
      ['Trade-off', 'Read capacity for replica lag and three user-visible anomalies'],
      [
        '30-second answer',
        '"Replicas scale reads and do nothing for writes. The cost is lag — normally milliseconds, occasionally minutes — which shows up as vanishing writes and counts going backwards. The standard fix is routing a user to the primary for a few seconds after they write, which costs almost nothing because only a handful of users are in that window. When writes are the limit, first remove unused indexes and batch, then scale vertically, and only then shard. And put a connection pooler in front."',
      ],
    ]),
    asked([
      ['Do read replicas help with writes?', 'No. They add read capacity and a small write cost. Only sharding scales writes.'],
      ['How do you handle replica lag?', 'Route a user to the primary for a few seconds after they write; pin sessions to one replica for monotonic reads.'],
      ['What do you do when writes do not fit?', 'Remove unused indexes and batch, make writes async, scale vertically, then shard.'],
      ['Why do you need a connection pooler?', 'Every app instance brings a pool. Fifty instances can exceed the database connection limit before CPU is touched.'],
      ['How much lag is normal?', 'Milliseconds usually, seconds to minutes during a bulk import, a long transaction or a restart.'],
    ]),

    links(
      wiki('Replication_(computing)', 'Replication'),
      wiki('Connection_pool', 'Connection pool'),
    ),
  ],
};
