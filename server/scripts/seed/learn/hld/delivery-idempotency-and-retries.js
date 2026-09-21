import { asked, code, diagram, flow, h, js, links, p, quick, table, tip, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Messages get delivered twice. Networks time out without saying whether the work happened. **Exactly-once delivery does not exist**, and every reliable system is built the same way: at-least-once delivery plus consumers that do not care.',
    ),

    h('The three semantics'),
    diagram(
      `
   AT-MOST-ONCE            AT-LEAST-ONCE          "EXACTLY-ONCE"
   ack before work         ack after work         a marketing term

   receive                 receive                at-least-once
   ack          ◀── crash  process    ◀── crash        +
   process      here loses ack        here repeats  idempotent
                the message           the work        consumer
                                                          │
   ✓ never duplicated      ✓ never lost                    ▼
   ✗ silently loses        ✗ duplicates            ✓ the ONLY thing
                                                     that actually
   use: metrics, logs      use: EVERYTHING           works
`,
      'Two real options, and one that is a composition',
    ),
    warn(
      'Exactly-once **delivery** is impossible — there is no way to atomically deliver a message and record that it was delivered across a network. Exactly-once **processing** is achievable, and it is at-least-once delivery with a consumer that detects duplicates. The distinction is the answer to a very common interview question.',
    ),

    h('Idempotency'),
    p(
      'An operation is idempotent if doing it twice has the same effect as doing it once. Some are naturally so; the rest have to be made that way.',
    ),
    table(
      ['Operation', 'Idempotent?', 'Make it so by'],
      [
        ['`SET status = shipped`', '**Yes**', '—'],
        ['`DELETE WHERE id = 42`', '**Yes**', '—'],
        ['`balance = balance - 100`', '**No**', 'A key, recorded with the result'],
        ['`INSERT INTO orders`', '**No**', 'A unique constraint on a client-supplied id'],
        ['`POST /charge`', '**No**', 'An idempotency key'],
        ['Send an email', '**No**', 'A dedupe key with a TTL'],
        ['`counter++`', '**No**', 'Record which event ids were counted'],
      ],
    ),
    code(
      js(`
// The idempotency-key pattern, as payment APIs implement it.
async function charge(idempotencyKey, amount, card) {
  // The unique constraint is what makes this safe under
  // concurrency — two simultaneous retries cannot both insert.
  const existing = await db.idempotency.findByKey(idempotencyKey);
  if (existing) {
    if (existing.status === 'in_progress') {
      // A concurrent attempt is mid-flight. Returning "in progress"
      // is correct; charging again is not.
      throw new ConflictError('already in progress');
    }
    return existing.result;                  // replay the first answer
  }

  await db.idempotency.create({ key: idempotencyKey, status: 'in_progress' });

  try {
    const result = await paymentGateway.charge(amount, card);
    // Store the RESULT, not just the fact. A retry must get the
    // same charge id back, not a fresh success.
    await db.idempotency.complete(idempotencyKey, result);
    return result;
  } catch (err) {
    await db.idempotency.fail(idempotencyKey, err);
    throw err;
  }
}
`),
    ),
    tip(
      'Store the **result**, not just a "seen" flag. A retry must return the original charge id, because the client is retrying precisely because it never learned what happened the first time.',
    ),

    h('Retries'),
    diagram(
      `
   NAIVE RETRY — the self-inflicted DDoS

   service is briefly slow
        │
        ▼
   1,000 clients time out at t=1s
        │
        ▼
   1,000 retries at t=2s, all together   ◀── synchronised
        │
        ▼
   service, already struggling, now gets 2,000/s
        │
        ▼
   worse ──▶ more timeouts ──▶ more retries ──▶ collapse


   EXPONENTIAL BACKOFF WITH JITTER

   attempt 1: immediate
   attempt 2: 1s  + random(0, 1s)
   attempt 3: 2s  + random(0, 2s)
   attempt 4: 4s  + random(0, 4s)
   attempt 5: 8s  + random(0, 8s)   then give up

   the JITTER is what matters. backoff alone still
   synchronises everyone onto the same schedule.
`,
      'Why jitter is not optional',
    ),
    table(
      ['Rule', 'Why'],
      [
        ['**Exponential backoff**', 'Gives the dependency room to recover'],
        ['**Jitter**', 'Without it, retries stay synchronised and arrive as one wave'],
        ['**A cap on attempts**', 'Infinite retries turn a bad message into an infinite loop'],
        ['**Retry only what is retryable**', '5xx and timeouts, yes. 400 and 404, never'],
        ['**A retry budget**', 'Cap retries as a share of traffic, so they cannot become the load'],
        ['**Idempotency first**', 'Retrying a non-idempotent operation is how you charge twice'],
      ],
    ),

    h('Dead-letter queues'),
    flow(['Consume', 'Fail', 'Retry ×N', 'DLQ', 'Alert'], 'Where poison messages go'),
    p(
      'A message that will never succeed — malformed, referencing deleted data, hitting a bug — must not be retried forever. After N attempts it goes to a **dead-letter queue**, which unblocks the main queue and preserves the message for investigation.',
    ),
    table(
      ['Without a DLQ', 'With one'],
      [
        ['A poison message blocks the partition', 'It is moved aside; processing continues'],
        ['Infinite retries burn capacity', 'Bounded attempts'],
        ['The message is eventually dropped or lost', 'It is kept, with its failure reason'],
        ['Nobody notices', '**DLQ depth is an alert**'],
      ],
    ),
    warn(
      'A DLQ nobody monitors is a **silent data-loss mechanism**. The messages are safe and completely ignored. DLQ depth must be alerted on and the queue must have an owner, or it is just a place failures go to be forgotten.',
    ),

    h('Backpressure'),
    p(
      'When producers outpace consumers the backlog grows without bound. Backpressure is the system **telling the producer to slow down** rather than quietly accumulating until memory or disk runs out.',
    ),
    table(
      ['Mechanism', 'How'],
      [
        ['**Bounded queues**', 'A full queue rejects or blocks the producer'],
        ['**Rate limiting at the edge**', 'Cap arrivals to what the system can drain'],
        ['**Load shedding**', 'Drop low-value work deliberately, rather than failing everything'],
        ['**Reactive streams**', 'The consumer requests N items; the producer sends no more'],
        ['**Monitoring lag**', 'Queue depth and consumer lag are the early warning'],
      ],
    ),
    tip(
      'An unbounded queue is not resilience, it is **deferred failure**. A queue that grows all day either exhausts its storage or delivers work so late it is worthless — and shedding load early is almost always the better outcome.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'Delivery guarantees, and what consumers must do about them'],
      ['Why it matters', 'Duplicate delivery is certain, and money makes it expensive'],
      ['Use when', 'Every queue, every retry, every external API call'],
      ['Trade-off', 'At-least-once never loses and always duplicates; the consumer absorbs that'],
      [
        '30-second answer',
        '"Exactly-once delivery does not exist — you choose at-most-once, which loses messages, or at-least-once, which duplicates them. Everyone picks at-least-once and makes consumers idempotent: an idempotency key stored with its result, so a retry replays the original answer instead of charging again. Retries need exponential backoff with jitter, a cap, and a retry budget. Poison messages go to a dead-letter queue that is alerted on, and bounded queues give you backpressure."',
      ],
    ]),
    asked([
      ['Is exactly-once possible?', 'Not for delivery. Exactly-once processing is at-least-once delivery plus an idempotent consumer.'],
      ['How do you make an endpoint idempotent?', 'A client-supplied key, stored with the result, so a retry returns the original outcome.'],
      ['Why does jitter matter?', 'Backoff alone keeps retries synchronised, so they arrive as one wave and finish the outage off.'],
      ['What is a dead-letter queue?', 'Where a message goes after N failed attempts, so it stops blocking the queue and can be investigated.'],
      ['What is backpressure?', 'Signalling producers to slow down rather than letting an unbounded queue defer the failure.'],
    ]),

    links(
      wiki('Idempotence', 'Idempotence'),
      wiki('Exponential_backoff', 'Exponential backoff'),
    ),
  ],
};
