import { asked, diagram, h, links, p, quick, table, tip, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Four brokers that get named in interviews, compared on the four things that actually decide it: **ordering, retention, routing and how much of your life you want to spend operating it.**',
    ),

    h('The comparison'),
    table(
      ['', 'Kafka', 'RabbitMQ', 'SQS', 'Redis Streams'],
      [
        ['Model', '**Log**', 'Broker with exchanges', 'Managed queue', 'Log, in memory'],
        ['Retention', 'Time or size', 'Until acknowledged', 'Up to 14 days', 'Capped length'],
        ['**Replay**', '**Yes**', 'No', 'No', 'Yes, while retained'],
        ['Ordering', 'Per partition', 'Per queue', 'FIFO queues only', 'Per stream'],
        ['Routing', 'Topic + partition', '**Rich — exchanges, bindings, patterns**', 'Queue, or SNS fan-out', 'Stream'],
        ['Per-message delay', 'No', 'Yes', 'Yes', 'No'],
        ['Priority', 'No', '**Yes**', 'No', 'No'],
        ['Throughput', '**Very high**', 'High', 'High', 'High'],
        ['Ops burden', '**Highest**', 'Medium', '**None**', 'Low if you run Redis already'],
      ],
    ),

    h('Choosing, in one page'),
    diagram(
      `
   do several independent systems need the same events?
        │
        ├── no ──▶ is it a simple background job queue?
        │              │
        │              ├── yes ──▶ already on AWS?  ──▶ SQS
        │              │           already on Redis? ──▶ Redis Streams
        │              │           need priority or
        │              │           per-message delay? ──▶ RabbitMQ
        │              │
        │              └── no ───▶ complex routing rules?
        │                              └──▶ RabbitMQ
        │
        └── yes ──▶ do you need to REPLAY history?
                        │
                        ├── yes ──▶ KAFKA
                        └── no  ──▶ SNS + SQS, or RabbitMQ fanout
`,
      'Replay and fan-out are the two real questions',
    ),
    tip(
      'The deciding question is almost always **"will a new consumer ever need to read history?"** If yes, you want a log and that means Kafka. If no, a managed queue is less infrastructure for the same outcome.',
    ),

    h('Kafka'),
    table(
      ['Choose it when', 'Avoid it when'],
      [
        ['Multiple teams consume the same stream', 'One producer, one consumer, low volume'],
        ['Replay or reprocessing matters', 'You need per-message priority or delay'],
        ['Volume is genuinely very high', 'Nobody on the team has operated a cluster'],
        ['It is also your CDC and event backbone', 'A managed queue would do'],
      ],
    ),
    warn(
      'Kafka is **a cluster to run** — brokers, replication, partitions, consumer group rebalances, retention tuning. Managed offerings remove most of this and cost accordingly. Choosing Kafka for a job queue is the most common over-engineering answer in design interviews.',
    ),

    h('RabbitMQ'),
    p(
      'The one with real **routing**. An exchange can send a message to queues by exact key, by pattern, or to everything — so "route `order.created.in` to these three queues and `order.*.uk` to those two" is configuration rather than code.',
    ),
    diagram(
      `
   publisher ──▶ EXCHANGE ──┬── binding "order.created.*" ──▶ queue A
                            ├── binding "order.#"         ──▶ queue B
                            └── binding "*.*.urgent"      ──▶ queue C

   direct   exact routing key match
   topic    wildcard patterns, as above
   fanout   every bound queue, ignore the key
   headers  match on message headers

   plus: per-message TTL, priority, delayed delivery, and a
   dead-letter exchange — none of which Kafka has.
`,
      'Where RabbitMQ is genuinely better',
    ),

    h('SQS'),
    table(
      ['Strength', 'Limitation'],
      [
        ['Zero operations', 'AWS only'],
        ['Effectively infinite scale', 'No replay; 14-day maximum retention'],
        ['Cheap at low volume', 'FIFO queues are slower and rate-limited'],
        ['Built-in DLQ and visibility timeouts', 'No routing — fan-out needs SNS in front'],
      ],
    ),
    tip(
      '**SNS + SQS is the AWS answer to pub/sub**: SNS fans one message out to several SQS queues, each consumed independently. It gives most of what a topic with consumer groups gives, without a cluster — and without replay.',
    ),

    h('Redis Streams'),
    p(
      'Worth knowing because the honest answer is often "we already run Redis". It has consumer groups, acknowledgements and a pending-entries list, so it is a **real** queue rather than a `LPUSH`/`BRPOP` improvisation — bounded by memory, and by Redis\'s durability, which is weak.',
    ),
    warn(
      'Redis persistence loses roughly a second of writes on a crash and replication is asynchronous. For a job queue where losing a few jobs is survivable that is fine; **for anything financial it is not.**',
    ),

    h('The answer that scores'),
    table(
      ['Say', 'Rather than'],
      [
        ['"A queue here so a spike does not reach the database. SQS, since we are on AWS and do not need replay."', '"And then Kafka."'],
        ['"Kafka, because inventory, search and analytics all consume this and we want replay."', '"Kafka, because it scales."'],
        ['"RabbitMQ — we need per-message priority and routing rules."', '"RabbitMQ, because it is a message queue."'],
      ],
    ),
    p(
      'The pattern is the same in all three: **name the requirement, then the tool.** An interviewer is listening for whether the broker follows from a need or from familiarity.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'Choosing between a log, a broker and a managed queue'],
      ['Why it matters', 'Naming a broker without a reason is the classic over-engineering tell'],
      ['Use when', 'Immediately after saying "we put a queue here"'],
      ['Trade-off', 'Kafka gives replay and fan-out for real operational cost; managed queues give neither and no cost'],
      [
        '30-second answer',
        '"Two questions decide it. Do several independent systems need the same events, and will anyone need to replay history? Both yes means Kafka — a log with per-partition ordering and consumer groups, at the cost of running a cluster. Fan-out without replay is SNS plus SQS. A plain background job queue is SQS, or Redis Streams if Redis is already there. And RabbitMQ when you need routing rules, per-message priority or delayed delivery, none of which Kafka has."',
      ],
    ]),
    asked([
      ['Kafka or RabbitMQ?', 'Kafka for replay, high volume and many independent consumers. RabbitMQ for routing rules, priority and per-message delay.'],
      ['When is SQS enough?', 'A background job queue on AWS with no replay requirement — which covers most cases.'],
      ['How do you do pub/sub on AWS without Kafka?', 'SNS fanning out to several SQS queues, each consumed independently.'],
      ['Why would you not choose Kafka?', 'It is a cluster to operate, and it has no per-message priority, delay or TTL.'],
      ['Is Redis a real queue?', 'Redis Streams is, with consumer groups and acknowledgements. Durability is weak, so not for financial work.'],
    ]),

    links(
      wiki('Apache_Kafka', 'Apache Kafka'),
      wiki('RabbitMQ', 'RabbitMQ'),
    ),
  ],
};
