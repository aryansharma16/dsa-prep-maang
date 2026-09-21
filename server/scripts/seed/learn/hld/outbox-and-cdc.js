import { asked, code, diagram, flow, h, links, p, quick, sql, table, tip, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'You saved the order and published `OrderPlaced`. Two systems, two writes, **no transaction across them** — so one can succeed while the other fails, silently. This is the dual-write problem, and it has exactly two good solutions.',
    ),

    h('The dual-write problem'),
    diagram(
      `
   await db.orders.insert(order);      ✓ committed
   await kafka.publish('OrderPlaced'); ✗ crash / timeout

   ──▶ the order exists. no email, no inventory update,
       no analytics. nothing knows.


   ORDER REVERSED

   await kafka.publish('OrderPlaced'); ✓ published
   await db.orders.insert(order);      ✗ fails

   ──▶ three services react to an order that does not exist.


   AND THE SUBTLE ONE

   await db.orders.insert(order);      ✓ committed
   await kafka.publish('OrderPlaced'); ✓ published
        ...but the transaction is ROLLED BACK afterwards

   ──▶ an event for an order that never existed.

   there is no ordering of these two lines that is safe.
`,
      'Every arrangement is broken',
    ),
    warn(
      'This is not a rare race. It happens on every deploy, every timeout and every crash — and the symptom is **data that quietly disagrees**, discovered weeks later by a reconciliation job or a customer.',
    ),

    h('Solution 1 — the transactional outbox'),
    p(
      'Write the event **into the same database, in the same transaction** as the data. There is now only one write, so it either both happens or neither does. A separate process publishes from that table.',
    ),
    diagram(
      `
   BEGIN
     INSERT INTO orders  (...)
     INSERT INTO outbox  (event_type, payload)
   COMMIT                    ◀── one atomic write. no gap.

        │
        ▼
   ┌──────────┐   polls or tails the table
   │ relay    │ ──────────────────────────▶ Kafka
   └──────────┘   marks rows published

   ✓ no dual write — the event cannot be lost
   ✓ ordering preserved
   ✗ at-least-once (a crash after publish, before marking)
     ──▶ consumers must be idempotent. they always must anyway.
`,
      'One transaction, two tables',
    ),
    code(
      sql(`
CREATE TABLE outbox (
  id          BIGSERIAL PRIMARY KEY,   -- also the publish order
  aggregate   VARCHAR(64) NOT NULL,    -- 'order'
  event_type  VARCHAR(64) NOT NULL,    -- 'OrderPlaced'
  payload     JSONB       NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  published_at TIMESTAMPTZ NULL        -- NULL = not yet sent
);

-- The relay's query. FOR UPDATE SKIP LOCKED lets several relay
-- instances run without processing the same row twice.
SELECT * FROM outbox
WHERE published_at IS NULL
ORDER BY id
LIMIT 100
FOR UPDATE SKIP LOCKED;
`),
    ),
    tip(
      '`FOR UPDATE SKIP LOCKED` is the detail that makes a polling relay scale. Without it, two relay instances contend on the same rows; with it, each instance takes a different batch and **the relay itself becomes horizontally scalable.**',
    ),

    h('Solution 2 — change data capture'),
    p(
      'Skip the outbox table and read the database\'s own **replication log**. Every committed change becomes an event, with no application code involved at all — so no code path can forget to publish.',
    ),
    diagram(
      `
   ┌──────────┐  WAL / binlog   ┌──────────┐    ┌───────┐
   │ Postgres │────────────────▶│ Debezium │───▶│ Kafka │
   └──────────┘                 └──────────┘    └───┬───┘
                                                    │
                          ┌─────────────────────────┼──────────┐
                          ▼                         ▼          ▼
                     warehouse              search index     cache
                                                            invalidation

   ✓ application code is untouched — it CANNOT forget
   ✓ ordered, complete, replayable
   ✓ retrofits onto a legacy system with no changes
   ✗ events are ROW CHANGES, not business events:
       "orders row inserted" ≠ "OrderPlaced"
   ✗ coupled to the schema — a rename breaks consumers
`,
      'Read the log, not the tables',
    ),

    h('Choosing'),
    table(
      ['', 'Outbox', 'CDC'],
      [
        ['Event shape', '**Business events you designed**', 'Row-level changes'],
        ['Application changes', 'Insert a row per event', '**None**'],
        ['Schema coupling', 'None — the payload is yours', '**Tight** — consumers see columns'],
        ['Retrofitting', 'Needs code changes', '**Works on a legacy system as-is**'],
        ['Extra infrastructure', 'A relay process', 'Debezium plus Kafka Connect'],
        ['Can forget to publish?', 'Yes, if a code path skips the insert', '**No**'],
        ['Best for', 'New services emitting domain events', 'Sync to warehouse, search, cache'],
      ],
    ),
    tip(
      'They are complementary rather than competing, and a common setup uses both: **outbox for business events other services consume, CDC for keeping derived stores — warehouse, search index, cache — in step.** The first is a contract; the second is a copy.',
    ),

    h('The outbox is more than events'),
    flow(['Outbox', 'Relay', 'Queue'], 'The same pattern for side effects'),
    table(
      ['Use it for', 'Why'],
      [
        ['Publishing events', 'The original case'],
        ['**Enqueueing jobs**', 'Same problem: commit the row and enqueue atomically'],
        ['**Sending emails**', 'Never send inside a transaction that may roll back'],
        ['**Calling a webhook**', 'A retryable record, committed with the change'],
      ],
    ),
    warn(
      'Any external side effect triggered from inside a transaction has this bug. **Sending an email in a transaction that later rolls back** tells the customer something that did not happen — and unlike a database write, you cannot take it back.',
    ),

    h('Operating it'),
    table(
      ['Concern', 'Handling'],
      [
        ['Table growth', 'Delete published rows on a schedule, or partition by day'],
        ['Relay lag', 'Alert on the age of the oldest unpublished row'],
        ['Duplicates', 'At-least-once by design — consumers dedupe on event id'],
        ['Ordering', 'Publish in `id` order; partition by aggregate id'],
        ['Poison events', 'A retry count and a dead-letter path'],
      ],
    ),

    h('Interview'),
    quick([
      ['What it is', 'Publishing an event and committing data without a transaction across both'],
      ['Why it exists', 'A dual write can half-succeed in every possible ordering'],
      ['Use when', 'Any service that both persists and publishes'],
      ['Trade-off', 'Outbox needs a relay and a table; CDC needs no code but couples to the schema'],
      [
        '30-second answer',
        '"Writing to the database and publishing to Kafka is a dual write — every ordering can half-succeed, and the symptom is data quietly disagreeing. The outbox pattern writes the event into the same database in the same transaction, and a relay publishes from that table, so there is only one write and it cannot be lost. CDC is the alternative: read the replication log, so application code cannot forget — but events are row changes coupled to your schema, not business events."',
      ],
    ]),
    asked([
      ['What is the dual-write problem?', 'Writing to two systems without a shared transaction. Any ordering can half-succeed silently.'],
      ['How does the outbox pattern fix it?', 'The event is inserted in the same transaction as the data, and a separate relay publishes it.'],
      ['Outbox or CDC?', 'Outbox for business events you designed. CDC to sync derived stores without touching application code.'],
      ['Does the outbox give exactly-once?', 'No — at-least-once. A crash between publishing and marking republishes it, so consumers dedupe.'],
      ['Why not just send the email in the transaction?', 'The transaction may roll back, and you cannot unsend an email.'],
    ]),

    links(
      wiki('Change_data_capture', 'Change data capture'),
      wiki('Write-ahead_logging', 'Write-ahead logging'),
    ),
  ],
};
