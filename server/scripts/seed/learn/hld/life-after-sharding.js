import { asked, code, diagram, flow, h, js, links, p, quick, table, tip, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Sharding solved the write problem and created four new ones: **queries that span shards, generating unique ids, keeping data consistent across shards, and changing the number of shards while the system is running.** This is the bill.',
    ),

    h('Cross-shard queries'),
    diagram(
      `
   SINGLE-SHARD (what you designed for)

   SELECT * FROM orders WHERE user_id = 7
        ──▶ shard(7) = s2 ──▶ one query. fast.


   CROSS-SHARD (what you also have to serve)

   SELECT * FROM orders ORDER BY total DESC LIMIT 10
        ──▶ ┌──▶ s1: top 10
            ├──▶ s2: top 10      scatter
            ├──▶ s3: top 10
            └──▶ s4: top 10
                    │
                    ▼  gather
            merge 40 rows, take 10

   cost = slowest shard, not average shard.
   and LIMIT 10 OFFSET 1000 needs 1010 rows from EVERY shard.
`,
      'Scatter-gather, and where it stops working',
    ),
    table(
      ['Query', 'Cost', 'What to do'],
      [
        ['By shard key', 'One shard', 'Nothing. This is the design working'],
        ['Global top-N', 'All shards, merge N per shard', 'Acceptable for small N'],
        ['Deep pagination', 'All shards, `offset+limit` rows each', '**Use a cursor**, not an offset'],
        ['Global `COUNT`', 'All shards', 'Keep a maintained counter, or accept an estimate'],
        ['`JOIN` across shards', 'Impossible in the database', 'Denormalise, or join in the application'],
        ['Search by a non-shard field', 'All shards', 'A secondary index service, or Elasticsearch'],
      ],
    ),
    warn(
      'Deep pagination is the one that quietly destroys a sharded system. `OFFSET 100000 LIMIT 10` requires each of your shards to produce **100,010 rows** and throw almost all of them away. Cursor pagination — "give me rows after this key" — is the only approach that scales.',
    ),

    h('Secondary indexes'),
    table(
      ['Approach', 'How', 'Trade-off'],
      [
        ['**Local index**', 'Each shard indexes its own rows', 'Fast writes; a lookup by that field scatters'],
        ['**Global index**', 'A separate sharded table: `field → (shard, pk)`', 'Fast lookups; two writes, and they can diverge'],
        ['**Search engine**', 'Stream changes into Elasticsearch', 'Best for text and facets; eventually consistent'],
      ],
    ),
    tip(
      'A global secondary index is itself a sharded table with the same problems one level down — and it introduces a **dual write**. If you build one, populate it from a change stream rather than writing to both places in application code.',
    ),

    h('Unique IDs without a shared sequence'),
    p(
      '`AUTO_INCREMENT` needs one authority. Across shards there is none, so ids have to be generated in a way that is unique by construction.',
    ),
    diagram(
      `
   SNOWFLAKE — 64 bits, and roughly sortable by time

   ┌─┬───────────────────────────┬──────────┬────────────┐
   │0│  timestamp (41 bits)      │ node(10) │ seq (12)   │
   └─┴───────────────────────────┴──────────┴────────────┘
     ▲         ~69 years            1024       4096 per ms
     │                              nodes      per node
   sign bit, always 0
   (so it is a positive signed 64-bit integer)

   ✓ no coordination between generators
   ✓ sortable by creation time — a real feature
   ✓ fits in a BIGINT
   ✗ needs unique node ids
   ✗ clock going backwards breaks it
`,
      'The one worth being able to draw',
    ),
    code(
      js(`
// Snowflake, in miniature.
const EPOCH = 1700000000000;

function makeGenerator(nodeId) {
  let lastMs = -1;
  let seq = 0;

  return function nextId() {
    let now = Date.now();

    // The clock moved backwards — NTP correction, VM migration.
    // Waiting is the only safe answer: emitting anyway risks a
    // duplicate id, which is worse than a few milliseconds of pause.
    while (now < lastMs) now = Date.now();

    if (now === lastMs) {
      seq = (seq + 1) & 0xfff;          // 4096 per millisecond
      if (seq === 0) {                   // exhausted — wait for the next ms
        while (Date.now() <= lastMs);
        now = Date.now();
      }
    } else {
      seq = 0;
    }
    lastMs = now;

    return (BigInt(now - EPOCH) << 22n) | (BigInt(nodeId) << 12n) | BigInt(seq);
  };
}
`),
    ),
    table(
      ['Scheme', 'Sortable', 'Coordination', 'Note'],
      [
        ['**UUIDv4**', 'No', 'None', 'Random — terrible as a clustered index key'],
        ['**UUIDv7**', '**Yes**', 'None', 'Time-ordered UUID; the modern default'],
        ['**Snowflake**', 'Yes', 'Node id assignment', '64 bits, fits a `BIGINT`'],
        ['**Ticket server**', 'Yes', 'A central service', 'Simple; a single point of failure'],
        ['**Per-shard offset**', 'Per shard only', 'Configuration', 'Shard 1 gets 1, 5, 9…; brittle when resharding'],
      ],
    ),
    tip(
      'Sortability is not cosmetic. A random UUID as a primary key causes **page splits and terrible insert locality** in a B-tree, because every insert lands in a random place. UUIDv7 and Snowflake both insert at the end, which is what the index wants.',
    ),

    h('Resharding without downtime'),
    flow(['Dual write', 'Backfill', 'Verify', 'Switch reads', 'Stop old writes'], 'Weeks, not hours'),
    table(
      ['Step', 'Detail'],
      [
        ['**1. Dual write**', 'Write to old and new layouts simultaneously; reads still go to the old one'],
        ['**2. Backfill**', 'Copy historical data in batches, throttled so it does not affect production'],
        ['**3. Verify**', 'Compare both layouts continuously. Do not skip this step'],
        ['**4. Shadow read**', 'Read from the new one, serve the old one, log every difference'],
        ['**5. Switch**', 'Flip reads to the new layout behind a flag, ready to flip back'],
        ['**6. Stop dual writes**', 'Only after a soak period long enough to trust it'],
      ],
    ),
    warn(
      'Steps 3 and 4 are the ones that get cut for time, and they are the ones that catch the bug. **A silent divergence found after the cutover is a data-loss incident**, because by then the old copy has stopped being updated.',
    ),
    p(
      'The way to avoid this entirely: **shard into far more logical shards than you have physical machines.** 1,024 logical shards mapped onto 8 servers means growing is moving whole logical shards between machines — a config change, not a rehash of every key.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'The four problems sharding creates: cross-shard queries, ids, consistency, resharding'],
      ['Why it matters', 'These are the follow-up questions after you propose sharding'],
      ['Use when', 'Immediately after saying "and then we shard"'],
      ['Trade-off', 'Logical over-sharding costs a little complexity now and saves a migration later'],
      [
        '30-second answer',
        '"Queries by the shard key stay fast; everything else becomes scatter-gather, and deep pagination has to become cursor-based or each shard produces a hundred thousand rows. Joins move into the application or get denormalised. IDs come from Snowflake or UUIDv7 — unique without coordination and sortable, which matters for index locality. And resharding is a weeks-long dual-write and backfill, which is why you create far more logical shards than machines up front."',
      ],
    ]),
    asked([
      ['How do you generate IDs across shards?', 'Snowflake or UUIDv7 — unique without coordination and roughly time-sortable.'],
      ['Why is UUIDv4 a bad primary key?', 'It is random, so every insert lands in a random B-tree page. Poor locality and page splits.'],
      ['How do you paginate across shards?', 'Cursor-based. Offset pagination makes every shard produce offset+limit rows.'],
      ['How do you reshard live?', 'Dual write, backfill, verify, shadow read, switch behind a flag, then stop dual writes.'],
      ['How do you avoid resharding?', 'Create many more logical shards than machines, then move logical shards between them.'],
    ]),

    links(
      wiki('Snowflake_ID', 'Snowflake ID'),
      wiki('Universally_unique_identifier', 'UUID'),
    ),
  ],
};
