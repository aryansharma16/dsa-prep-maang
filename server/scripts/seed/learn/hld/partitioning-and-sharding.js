import { asked, diagram, flow, h, links, p, quick, table, tip, tradeoff, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Sharding is splitting one logical dataset across many machines so that **each write goes to exactly one of them**. It is the only technique that scales writes, and it is the only one on the scaling ladder you cannot easily undo — which is why it is last.',
    ),

    flow(['Index', 'Cache', 'Read replicas', 'Shard'], 'Shard last, always'),

    h('Vertical versus horizontal'),
    diagram(
      `
   VERTICAL PARTITIONING            HORIZONTAL (= SHARDING)
   split by COLUMN                  split by ROW

   users                            users
   ┌────┬──────┬─────────┐          ┌────┬──────┬─────────┐
   │ id │ name │ bio(4KB)│          │ 1  │ ada  │ ...     │ shard 1
   └────┴──────┴─────────┘          │ 2  │ grace│ ...     │
         │         │                ├────┼──────┼─────────┤
         ▼         ▼                │ 3  │ linus│ ...     │ shard 2
   ┌────┬──────┐ ┌────┬─────┐       │ 4  │ alan │ ...     │
   │ id │ name │ │ id │ bio │       └────┴──────┴─────────┘
   └────┴──────┘ └────┴─────┘
     hot, small     cold, big       same schema everywhere,
                                    different rows
   keeps the hot table small
   ── a schema decision             ── a scaling decision
`,
      'Two different things with similar names',
    ),

    h('Three ways to assign a row to a shard'),
    table(
      ['Strategy', 'Shard = ', 'Good', 'Bad'],
      [
        ['**Range**', 'A key range — `A–F`, `G–M`', 'Range scans stay on one shard; easy to reason about', '**Hotspots** — recent dates and common letters cluster'],
        ['**Hash**', '`hash(key) % N`', 'Even distribution, almost always', 'Range scans hit every shard; resizing moves everything'],
        ['**Directory**', 'A lookup table', 'Total flexibility; move a tenant at will', 'The directory is a dependency and a single point of failure'],
        ['**Geographic**', 'Region or city', 'Data locality, and legal residency', 'Uneven — one city may dwarf the rest'],
      ],
    ),
    tip(
      'Hash is the default. Range looks attractive because range queries stay local, but **time-ordered or alphabetical keys concentrate writes on one shard** — and in practice the newest range is always the hottest.',
    ),

    h('Choosing a shard key'),
    p('This decision is expensive to reverse, and four properties decide whether it was right.'),
    table(
      ['Property', 'Why', 'Bad example'],
      [
        ['**High cardinality**', 'More distinct values than shards, by a wide margin', '`country` — most traffic is one value'],
        ['**Even distribution**', 'No value should dominate', '`status` — 95% are `active`'],
        ['**Matches your queries**', 'Reads should target one shard', 'Sharding orders by `order_id` when you always query by `user_id`'],
        ['**Immutable**', 'Changing it means moving the row between shards', '`email` — people change it'],
      ],
    ),
    diagram(
      `
   THE SAME DATA, THREE SHARD KEYS

   shard by ORDER_ID                shard by USER_ID
   ┌──────┬──────┬──────┐           ┌──────┬──────┬──────┐
   │ s1   │ s2   │ s3   │           │ s1   │ s2   │ s3   │
   └──────┴──────┴──────┘           └──────┴──────┴──────┘
   "orders for user 7"              "orders for user 7"
     ──▶ ALL shards. scatter-         ──▶ ONE shard. done.
         gather on every query

   shard by DATE
   ┌──────┬──────┬──────┐
   │ Jan  │ Feb  │ MAR  │  ◀── every write today lands here
   └──────┴──────┴──────┘      one hot shard, two idle
`,
      'The key is decided by the query, not the entity',
    ),
    warn(
      '**Pick the shard key from your dominant access pattern**, not from what feels like the natural identifier. Sharding orders by `order_id` is intuitive and turns your most common query — "show me my orders" — into a scatter-gather across every shard.',
    ),

    h('What you give up'),
    tradeoff([
      ['**Sharding**', 'Writes and data volume scale out; blast radius shrinks; hot shards can be isolated', 'No cross-shard joins, no global sort or count, no cross-shard transactions, and resharding is a project'],
    ]),
    table(
      ['Lost', 'What you do instead'],
      [
        ['Cross-shard `JOIN`', 'Denormalise, or join in the application'],
        ['Global `COUNT` / `ORDER BY`', 'Scatter-gather and merge, or keep a precomputed aggregate'],
        ['Cross-shard transaction', 'A saga, or design so a transaction never crosses shards'],
        ['`AUTO_INCREMENT`', 'Snowflake-style IDs, or a per-shard offset'],
        ['Unique constraint across shards', 'A separate lookup table, or include the shard key in the constraint'],
      ],
    ),

    h('When to shard'),
    table(
      ['Signal', 'Actually means'],
      [
        ['Writes exceed one primary', '**Shard.** This is the real reason'],
        ['Data exceeds one machine\'s disk', '**Shard.** Or archive cold data first'],
        ['Reads are slow', 'Index, cache, replicas. **Not sharding**'],
        ['Tables are large but fit', 'Partition within one database first — most engines support it'],
        ['"We might need it later"', 'You will not, yet. Defer'],
      ],
    ),
    tip(
      'Native **table partitioning** — same database, many internal partitions — is the underrated middle step. You get partition pruning and cheap old-data deletion without giving up joins or transactions, and it buys a lot of runway before real sharding.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'Splitting a dataset across machines so each write targets one'],
      ['Why it exists', 'The only way to scale writes and data volume past one machine'],
      ['Use when', 'Writes or volume exceed one primary — never for reads alone'],
      ['Trade-off', 'Unbounded write scale, at the cost of joins, transactions and reversibility'],
      [
        '30-second answer',
        '"Sharding splits rows across machines so each write hits one. Hash sharding by default — range keys cluster writes on the newest range. The shard key is chosen from the dominant query, not the natural identifier: shard orders by user_id, not order_id, or every read becomes a scatter-gather. You give up cross-shard joins, global counts and transactions, and resharding is a project — so index, cache and add replicas first. Sharding is only for writes and volume."',
      ],
    ]),
    asked([
      ['How do you choose a shard key?', 'High cardinality, even distribution, matches the dominant query, and never changes.'],
      ['Range or hash sharding?', 'Hash by default. Range concentrates writes on the newest range unless keys are naturally uniform.'],
      ['When do you shard?', 'When writes or data volume exceed one primary. Reads are solved by caching and replicas.'],
      ['What do you lose?', 'Cross-shard joins, global aggregates, transactions across shards, and auto-increment IDs.'],
      ['Is there a step before sharding?', 'Yes — native table partitioning inside one database keeps joins and transactions.'],
    ]),

    links(
      wiki('Shard_(database_architecture)', 'Database sharding'),
      wiki('Partition_(database)', 'Database partitioning'),
    ),
  ],
};
