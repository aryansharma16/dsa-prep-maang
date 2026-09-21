import { asked, code, diagram, flow, h, links, p, quick, sql, table, tip, warn, wiki } from '../blocks.js';
import { seeAlso } from './shapes.js';

export const doc = {
  blocks: [
    p(
      'A normalised schema is correct and a denormalised one is fast, and at scale you need both in different places. **The data model is decided by the queries, not by the entities** — which is the opposite of how most people are taught to design one.',
    ),

    h('Start from the access patterns'),
    flow(['List the queries', 'Rank by volume', 'Model for the top ones', 'Handle the rest separately'], 'The order'),
    table(
      ['Write down', 'Example'],
      [
        ['The query', '"Orders for a user, newest first, 20 at a time"'],
        ['Its volume', '10,000/s — the dominant read'],
        ['Its latency budget', '< 50 ms'],
        ['How fresh it must be', 'Seconds is fine'],
      ],
    ),
    p(
      'Do that for the top five queries and the schema designs itself. **The one that runs ten thousand times a second gets a data model built for it**; the one that runs twice a day can be a slow scan or a separate analytics store.',
    ),

    h('Denormalisation'),
    diagram(
      `
   NORMALISED                        DENORMALISED

   orders                            orders
   ┌────┬─────────┬───────┐          ┌────┬─────────┬───────────┬───────┐
   │ id │ user_id │ total │          │ id │ user_id │ user_name │ total │
   └────┴─────────┴───────┘          └────┴─────────┴───────────┴───────┘
   users                                            ▲
   ┌────┬───────┐                                   │
   │ id │ name  │                          copied in at write time
   └────┴───────┘

   read:  JOIN                       read:  one row. no join.
   write: one place                  write: rename a user ──▶ update
                                            every order they made
   ✓ one copy of the truth
   ✗ joins do not cross shards       ✓ reads are trivial and shardable
                                     ✗ N copies that can disagree
`,
      'You are trading write cost for read cost',
    ),
    table(
      ['Denormalise when', 'Do not when'],
      [
        ['Reads vastly outnumber writes', 'Writes are frequent'],
        ['The join crosses a shard boundary', 'Everything is on one database that copes'],
        ['The copied field rarely changes', 'It changes constantly'],
        ['A stale copy is tolerable', 'The copy must always agree'],
        ['The read is on the critical path', 'It is a background report'],
      ],
    ),
    warn(
      'Every denormalised field is **a synchronisation job you now own forever**. Copying `user_name` into orders means a rename must fan out to every order — and the day that job fails silently, your data disagrees with itself and nothing alerts.',
    ),
    tip(
      'A useful middle ground: denormalise **immutable** facts freely. The price at the time of purchase, the address it shipped to, the name on the invoice — these are not copies of current data, they are **historical records that should not change** when the source does. That is not denormalisation, it is correctness.',
    ),

    h('Modelling for a key-value or wide-column store'),
    p(
      'There are no joins and no secondary lookups unless you build them, so **the primary key must encode the query.** A composite key of partition plus sort is how one table answers several related questions.',
    ),
    diagram(
      `
   single table, one access pattern per key shape

   PK              SK                     attributes
   ─────────────   ────────────────────   ──────────────────
   USER#42         PROFILE                name, email
   USER#42         ORDER#2024-01-15#a1    total, status
   USER#42         ORDER#2024-02-03#b7    total, status
   USER#42         ADDRESS#home           line1, city

   "everything about user 42"     PK = USER#42
   "user 42's orders"             PK = USER#42, SK begins_with ORDER#
   "orders since February"        PK = USER#42, SK > ORDER#2024-02
   "just the profile"             PK = USER#42, SK = PROFILE

   one query shape. four questions. zero joins.
`,
      'The single-table pattern',
    ),
    warn(
      'The cost is stated plainly: **a question you did not design for may be unanswerable.** "All orders over ₹10,000, across all users" requires a full scan or a second table with a different key — and populating that second table is a backfill.',
    ),

    h('Schema changes with no downtime'),
    p('Adding a column is easy. Changing the meaning of one, or splitting a table, is a multi-week dance — and it is the same dance every time.'),
    table(
      ['Phase', 'What happens', 'Reversible?'],
      [
        ['**1. Add**', 'New nullable column or table. Nothing reads it', 'Yes'],
        ['**2. Dual write**', 'Write both old and new. Reads still use old', 'Yes'],
        ['**3. Backfill**', 'Fill historical rows in throttled batches', 'Yes'],
        ['**4. Verify**', 'Compare old and new continuously', 'Yes'],
        ['**5. Switch reads**', 'Read new, behind a flag', '**Yes — this is why the flag exists**'],
        ['**6. Stop writing old**', 'After a soak period', 'Getting harder'],
        ['**7. Drop old**', 'Remove the column', 'No'],
      ],
    ),
    code(
      sql(`
-- Phase 1: additive only. Never NOT NULL with a default on a large
-- table in one statement — on older engines that rewrites every row
-- while holding a lock.
ALTER TABLE orders ADD COLUMN currency VARCHAR(3) NULL;

-- Phase 3: backfill in batches, with a pause between them, so
-- replication lag and lock contention stay bounded.
UPDATE orders SET currency = 'INR'
WHERE currency IS NULL AND id BETWEEN ? AND ?;

-- Phase 7, much later: only once nothing reads or writes it.
ALTER TABLE orders DROP COLUMN legacy_amount;
`),
    ),
    tip(
      '**Never deploy a schema change and the code that requires it at the same time.** Additive change first, deploy code that tolerates both shapes, then the destructive change later — otherwise a rollback of the code leaves you on a schema it cannot read.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'Shaping data around the queries that matter most'],
      ['Why it matters', 'The model decides what can be sharded, cached and scaled'],
      ['Use when', 'Right after requirements — before drawing services'],
      ['Trade-off', 'Denormalisation buys read speed and costs write amplification and drift'],
      [
        '30-second answer',
        '"List the queries, rank by volume, model for the top few. Normalise by default, then denormalise where reads dominate and the join would cross a shard — every copied field is a sync job you own. Immutable historical facts like the price at purchase are always copied. In key-value stores the primary key encodes the query, so a composite partition and sort key answers several questions. Schema changes go additive, backfill, verify, switch behind a flag, drop last."',
      ],
    ]),
    asked([
      ['When do you denormalise?', 'When reads dominate, the join crosses a shard, and the copied field rarely changes.'],
      ['What does denormalisation cost?', 'Write amplification and a synchronisation job that can silently drift.'],
      ['How do you model for DynamoDB?', 'Access patterns first. The composite key encodes the query; a question you did not design for needs a new table.'],
      ['How do you change a schema with no downtime?', 'Additive, dual write, backfill, verify, switch reads behind a flag, then drop.'],
      ['Should the price be copied onto the order?', 'Yes. It is a historical fact, not a cached copy — it must not change when the product price does.'],
    ]),

    seeAlso('SQL', 'Normal forms', 'normalisation from first through BCNF, and when denormalising is correct'),
    links(
      wiki('Denormalization', 'Denormalization'),
      wiki('Database_normalization', 'Database normalization'),
    ),
  ],
};
