import { asked, diagram, h, links, p, quick, table, tip, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Two shapes with one piece of infrastructure between them. **A queue distributes work — one message, one consumer. Pub/sub broadcasts events — one message, every subscriber.** Picking the wrong one produces either duplicated work or missing consumers.',
    ),

    h('The difference'),
    diagram(
      `
   QUEUE — competing consumers        PUB/SUB — fan-out

   producer                           publisher
      │                                   │
      ▼                                   ▼
   ┌─────────────────┐              ┌──────────┐
   │ m1 m2 m3 m4 m5  │              │  topic   │
   └────┬───┬───┬────┘              └─┬───┬──┬─┘
        ▼   ▼   ▼                     ▼   ▼  ▼
      ┌──┐┌──┐┌──┐                 ┌──┐┌──┐┌──┐
      │C1││C2││C3│                 │S1││S2││S3│
      └──┘└──┘└──┘                 └──┘└──┘└──┘
      m1  m2  m3                    m1  m1  m1
      each message to               every message to
      exactly ONE consumer          EVERY subscriber

   "resize this image"               "an order was placed"
   one worker should do it           inventory, email, analytics
                                     all care

   scale by adding consumers         scale by... adding topics?
                                     (each subscriber scales itself)
`,
      'Work distribution versus event broadcast',
    ),
    table(
      ['', 'Queue', 'Pub/sub'],
      [
        ['Message goes to', 'One consumer', '**All subscribers**'],
        ['Adding consumers', 'More throughput', 'More copies of the work'],
        ['Producer knows consumers?', 'No, and there is one logical consumer', 'No, and there are many'],
        ['Message semantics', 'A **command** — "do this"', 'An **event** — "this happened"'],
        ['Coupling', 'Producer knows work needs doing', 'Producer does not care who listens'],
        ['Adding a new listener', 'Needs a new queue', '**Just subscribe**'],
      ],
    ),
    tip(
      'The last row is why event-driven systems are built on pub/sub. **Adding a fourth consumer of "order placed" requires no change to the producer at all** — which is the entire decoupling argument, and it is a real one.',
    ),

    h('Consumer groups — having both'),
    diagram(
      `
   Kafka (and SQS with multiple queues) gives you both at once

   topic: orders  ──▶ partitions p0 p1 p2 p3

   GROUP "inventory"         GROUP "email"        GROUP "analytics"
   ┌────┐ ┌────┐             ┌────┐               ┌────┐
   │ c1 │ │ c2 │             │ c1 │               │ c1 │
   └────┘ └────┘             └────┘               └────┘
   p0,p1  p2,p3              p0-p3                p0-p3

   ACROSS groups   ──▶ pub/sub  (every group sees every message)
   WITHIN a group  ──▶ queue    (each partition to one consumer)

   so "each message processed once per concern, and concerns
   scale independently" — which is what you actually want.
`,
      'Queue semantics inside, pub/sub semantics across',
    ),

    h('Visibility timeout'),
    p(
      'A consumer takes a message and then crashes. Without a mechanism, that message is either **lost** (deleted on delivery) or **stuck forever** (never redelivered). The visibility timeout is the answer: the message is hidden but not deleted, and reappears if not acknowledged in time.',
    ),
    diagram(
      `
   t=0    consumer receives m1
          m1 becomes INVISIBLE to other consumers (30s)
   t=5    consumer is working...
   t=12   consumer ACKs   ──▶ m1 deleted. done.

   OR

   t=0    consumer receives m1, invisible for 30s
   t=8    consumer CRASHES
   t=30   timeout expires ──▶ m1 VISIBLE again
   t=31   another consumer picks it up   ✓ nothing lost

   OR — the trap

   t=0    receives m1, invisible for 30s
   t=45   still processing (the job takes 60s)
   t=30   m1 became visible ──▶ ANOTHER consumer starts it
                             ──▶ the job runs TWICE
`,
      'And the timeout that is too short',
    ),
    warn(
      'A visibility timeout shorter than the actual processing time causes **duplicate processing, silently**, and the symptom is two emails or two charges rather than an error. Either extend the timeout while working (a heartbeat), or make the work idempotent — preferably both.',
    ),

    h('Ordering'),
    table(
      ['Guarantee', 'How you get it', 'Cost'],
      [
        ['**None**', 'The default for most queues', 'Free, and usually fine'],
        ['**Per key**', 'Partition or message-group by that key', 'Parallelism is limited by key count'],
        ['**Global**', 'One partition, one consumer', '**No parallelism at all**'],
      ],
    ),
    p(
      'Global ordering and horizontal scaling are mutually exclusive, and almost nobody needs global ordering. **Per-key is the useful middle**: all events for one order in sequence, while different orders process in parallel.',
    ),

    h('Choosing a shape'),
    table(
      ['Need', 'Use'],
      [
        ['One worker should do this task', '**Queue**'],
        ['Several systems care that this happened', '**Pub/sub**'],
        ['Both, with independent scaling', '**Topic + consumer groups**'],
        ['Events replayed later, or a new consumer reads history', '**A log** — Kafka, not a queue'],
        ['Request/reply', 'Not a queue. Use an RPC call'],
      ],
    ),
    tip(
      'The naming convention that keeps this straight: **commands go on queues, events go on topics.** `ResizeImage` is a command with one rightful handler; `OrderPlaced` is an event that anyone may care about. If you find yourself publishing a command to a topic, the design has drifted.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'Queues distribute work; pub/sub broadcasts events'],
      ['Why it matters', 'The wrong shape means duplicated work or a missing consumer'],
      ['Use when', 'Queue for tasks with one owner; pub/sub when several systems care'],
      ['Trade-off', 'Pub/sub decouples producers from consumers and makes delivery harder to reason about'],
      [
        '30-second answer',
        '"A queue is competing consumers — one message, one worker, and adding consumers adds throughput. Pub/sub is fan-out — every subscriber gets a copy, so a new listener needs no producer change. Kafka gives both: queue semantics within a consumer group, pub/sub across groups. Watch the visibility timeout — shorter than the processing time means silent duplicate work. And commands go on queues, events go on topics."',
      ],
    ]),
    asked([
      ['Queue or pub/sub?', 'Queue when one worker should handle it. Pub/sub when several independent systems care that it happened.'],
      ['What is a visibility timeout?', 'A received message is hidden rather than deleted, and reappears if not acknowledged — so a crash loses nothing.'],
      ['What if processing outlives the timeout?', 'Another consumer picks it up and the work runs twice. Heartbeat to extend it, and be idempotent.'],
      ['How do you get ordering?', 'Partition by key. Global ordering means one partition and one consumer, which means no parallelism.'],
      ['How do consumer groups work?', 'Each group gets every message; within a group each partition goes to one consumer.'],
    ]),

    links(
      wiki('Publish%E2%80%93subscribe_pattern', 'Publish–subscribe'),
      wiki('Message_queue', 'Message queue'),
    ),
  ],
};
