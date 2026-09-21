import { asked, code, diagram, h, links, p, quick, sh, table, tip, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Kafka is not a queue. It is **an append-only log that consumers read at their own position**, and almost every property that makes it useful — replay, multiple independent consumers, enormous throughput — follows directly from that one difference.',
    ),

    h('A log, not a queue'),
    diagram(
      `
   QUEUE                              KAFKA LOG

   consume ──▶ message is GONE        read ──▶ message STAYS

   ┌──┬──┬──┬──┐                      offset: 0  1  2  3  4  5  6
   │m1│m2│m3│m4│                      ┌──┬──┬──┬──┬──┬──┬──┐
   └──┴──┴──┴──┘                      │m0│m1│m2│m3│m4│m5│m6│
      ▲ consumed = deleted            └──┴──┴──┴──┴──┴──┴──┘
                                            ▲        ▲
   one consumer, one shot                   │        │
   no history                          group A   group B
                                       at 2      at 5

   retention is TIME or SIZE, not consumption.
   ──▶ a new consumer can start at offset 0 and read
       everything that ever happened.
`,
      'The difference that everything else follows from',
    ),
    table(
      ['Property', 'Because it is a log'],
      [
        ['**Replay**', 'Reset the offset and reprocess history'],
        ['**Many consumers**', 'Each group tracks its own position independently'],
        ['**High throughput**', 'Sequential disk writes, zero-copy reads, batching'],
        ['**Ordering per partition**', 'A log is ordered by construction'],
        ['**Durability**', 'It is on disk and replicated, not in memory'],
      ],
    ),
    tip(
      '**Replay is the feature people actually come for.** A bug in a consumer is fixed by resetting its offset and reprocessing — no re-publishing, no data recovery, no asking upstream to send it again. That single capability is usually why a team chooses Kafka over SQS.',
    ),

    h('Partitions'),
    diagram(
      `
   topic "orders", 4 partitions

   p0  ┌──┬──┬──┬──┐     ◀── key hash % 4 = 0
   p1  ┌──┬──┬──┬──┐     ◀── ordering is guaranteed WITHIN a
   p2  ┌──┬──┬──┬──┐         partition, and nowhere else
   p3  ┌──┬──┬──┬──┐

   key = order_id  ──▶  all events for one order land on one
                        partition ──▶ processed in sequence

   consumer group "billing" with 3 consumers
        c1 ──▶ p0, p1
        c2 ──▶ p2
        c3 ──▶ p3

   add a 5th consumer? IT IDLES.
   partitions are the parallelism ceiling.
`,
      'Partitions are the unit of both ordering and parallelism',
    ),
    warn(
      '**Consumers cannot exceed partitions.** A backlog on a 4-partition topic cannot be drained faster by adding a fifth consumer — it sits idle. And increasing partitions later changes the key-to-partition mapping, which breaks per-key ordering across the boundary.',
    ),
    table(
      ['Choosing partition count', 'Guidance'],
      [
        ['Too few', 'A hard ceiling on consumer parallelism'],
        ['Too many', 'More files, more memory, longer rebalances, higher end-to-end latency'],
        ['Rule of thumb', 'Target peak throughput ÷ what one consumer handles, then **double it** for headroom'],
        ['Changing it', 'Can only increase, and it reshuffles keys. Over-provision at the start'],
      ],
    ),

    h('Offsets and delivery'),
    code(
      sh(`
# where a group is, and how far behind
kafka-consumer-groups --describe --group billing

GROUP    TOPIC   PARTITION  CURRENT-OFFSET  LOG-END-OFFSET  LAG
billing  orders  0          14203           14203           0
billing  orders  1          9871            15002           5131   ◀──
billing  orders  2          14980           14990           10
billing  orders  3          14771           14775           4

# consumer LAG is the number to alert on — it is the queue
# depth, and the only early warning of a consumer falling behind.
`),
    ),
    table(
      ['Commit strategy', 'Delivery', 'Risk'],
      [
        ['Commit **before** processing', 'At-most-once', 'A crash loses the message'],
        ['Commit **after** processing', '**At-least-once**', 'A crash reprocesses it — **the default, and correct**'],
        ['Transactional produce+commit', 'Effectively-once *within Kafka*', 'Does not extend to your database'],
      ],
    ),
    warn(
      'Kafka\'s "exactly-once semantics" applies to **Kafka-to-Kafka** processing. The moment your consumer writes to a database or calls an API, you are back to at-least-once and you need idempotency. This distinction is asked about often and answered incorrectly often.',
    ),

    h('Retention and compaction'),
    table(
      ['Policy', 'Keeps', 'For'],
      [
        ['**Time-based**', 'Everything for N days (7 is typical)', 'Event streams'],
        ['**Size-based**', 'Up to N bytes per partition', 'Bounded disk'],
        ['**Log compaction**', '**The latest value per key, forever**', 'A changelog — current state as a topic'],
      ],
    ),
    p(
      'Compaction is the underused one. A compacted topic keyed by `user_id` becomes **a durable, replayable snapshot of current state** — a new service can read it from the beginning and rebuild its own view of every user without querying anybody.',
    ),

    h('When not to use Kafka'),
    table(
      ['Situation', 'Better choice'],
      [
        ['A simple background job queue', 'SQS, RabbitMQ, or Redis — far less to operate'],
        ['Per-message TTL or priority', 'RabbitMQ. Kafka has neither'],
        ['Request/reply', 'An RPC call'],
        ['Low volume, small team', 'Kafka is a cluster with ZooKeeper or KRaft to run'],
        ['Delayed or scheduled delivery', 'A scheduler, or a sorted set in Redis'],
      ],
    ),
    tip(
      'Kafka has **no per-message delay, no priority and no selective acknowledgement** — a consumer reads a partition in order or not at all. Those absences are the clearest signal that a use case wants a broker rather than a log.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'A distributed, partitioned, replicated append-only log'],
      ['Why it exists', 'Multiple independent consumers, replay, and very high throughput'],
      ['Use when', 'Event streaming, CDC, many consumers of one stream, or replay matters'],
      ['Trade-off', 'Durability and replay, at the cost of running a cluster and no per-message control'],
      [
        '30-second answer',
        '"Kafka is a log, not a queue — reading does not delete, so retention is by time or size and any consumer can replay from any offset. Topics are split into partitions: ordering holds within a partition, and the partition count is the hard ceiling on consumer parallelism. Each consumer group tracks its own offsets, giving pub/sub across groups and queue semantics within one. Delivery is at-least-once in practice, so consumers must be idempotent. Alert on consumer lag."',
      ],
    ]),
    asked([
      ['How does Kafka guarantee ordering?', 'Within a partition only. Key by the entity that needs ordering so its events share a partition.'],
      ['What limits consumer parallelism?', 'The partition count. Extra consumers in a group sit idle.'],
      ['Is exactly-once real?', 'Within Kafka-to-Kafka processing. Once you write to a database it is at-least-once, so be idempotent.'],
      ['What is log compaction?', 'Retaining the latest value per key forever, turning a topic into a replayable snapshot of current state.'],
      ['When would you not use Kafka?', 'A simple job queue, or anything needing per-message priority, delay or TTL. Use a broker instead.'],
    ]),

    links(
      wiki('Apache_Kafka', 'Apache Kafka'),
      wiki('Log-structured_merge-tree', 'Log-structured storage'),
    ),
  ],
};
