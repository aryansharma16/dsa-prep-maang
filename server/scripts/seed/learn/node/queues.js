import { asked, cheat, code, h, js, link, links, note, p, sh, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'A queue moves slow or unreliable work out of the request. The user gets their response in 40 ms instead of 4 seconds, the work happens on a machine that is allowed to take its time, and — the part that actually matters — **the work survives a crash, a restart and a deploy**, which nothing inside a request handler does.',
    ),

    h('The problem'),
    code(
      js(`
// Everything wrong with doing it inline.
app.post('/orders', async (req, res) => {
  const order = await service.create(req.body);

  await sendConfirmationEmail(order);    // 2s, and the provider is down 1% of the time
  await generateInvoicePdf(order);       // 3s of CPU — blocks the event loop
  await notifyWarehouse(order);          // their API times out sometimes

  res.status(201).json(order);           // 5s later, if nothing failed
});
`),
    ),
    table(
      ['Failure', 'What the user sees'],
      [
        ['The email provider is down', 'A 500 — even though the order was created'],
        ['The PDF takes 3 s of CPU', 'Every other request in the process waits'],
        ['The deploy restarts mid-request', 'The order exists; the email never happens, and nothing records that'],
        ['Traffic spikes', 'Every slow dependency multiplies your response time'],
      ],
    ),
    code(
      js(`
// With a queue: three durable jobs, and a response immediately.
app.post('/orders', async (req, res) => {
  const order = await service.create(req.body);

  await queue.addBulk([
    { name: 'send-confirmation', data: { orderId: order.id } },
    { name: 'generate-invoice',  data: { orderId: order.id } },
    { name: 'notify-warehouse',  data: { orderId: order.id } },
  ]);

  res.status(201).json(order);           // ~40ms
});
`),
    ),
    warn(
      'Note what changed conceptually: the response no longer means "the email was sent". It means "the order exists and the email **will** be sent". If a caller genuinely needs the result, give them a `202 Accepted` and a status endpoint to poll — do not pretend the work is done.',
    ),

    h('The vocabulary'),
    table(
      ['Term', 'Is'],
      [
        ['**Producer**', 'Whoever adds a job — usually your API'],
        ['**Job**', 'A name plus a small JSON payload'],
        ['**Queue**', 'Where jobs wait. In BullMQ, Redis'],
        ['**Worker**', 'A separate process that pulls jobs and runs them'],
        ['**Concurrency**', 'How many jobs one worker runs at once'],
        ['**Retry / backoff**', 'Trying again after a failure, with a growing delay'],
        ['**Dead-letter**', 'Where a job goes after its last attempt fails'],
        ['**Idempotency**', 'Running the job twice having the same effect as once'],
      ],
    ),

    h('BullMQ'),
    code(
      sh(`
# BullMQ v6 no longer bundles its Redis client — install both.
npm install bullmq ioredis
`),
    ),
    code(
      js(`
// queues/index.js — the producer side
import { Queue } from 'bullmq';

const connection = { url: config.redisUrl };

export const emailQueue = new Queue('email', {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 1000 },   // 1s, 2s, 4s, 8s, 16s
    removeOnComplete: { age: 3600, count: 1000 },     // do not fill Redis
    removeOnFail: { age: 7 * 24 * 3600 },             // keep failures a week
  },
});

await emailQueue.add('welcome', { userId: user.id });
await emailQueue.add('digest', { userId }, { delay: 60_000 });         // later
await emailQueue.add('report', {}, { repeat: { pattern: '0 9 * * *' } }); // cron
`),
    ),
    code(
      js(`
// workers/email.worker.js — a SEPARATE process. Not part of your web server.
import { Worker } from 'bullmq';

const worker = new Worker('email', async (job) => {
  switch (job.name) {
    case 'welcome': return sendWelcome(job.data.userId);
    case 'digest':  return sendDigest(job.data.userId);
    default: throw new Error(\`Unknown job \${job.name}\`);
  }
}, {
  connection,
  concurrency: 5,               // 5 jobs at once in this process
  limiter: { max: 100, duration: 60_000 },   // and at most 100/min, for the provider
});

worker.on('completed', (job) => log.info({ jobId: job.id }, 'done'));
worker.on('failed', (job, err) =>
  log.error({ jobId: job?.id, attempt: job?.attemptsMade, err }, 'job failed'));

// Let in-flight jobs finish before the process exits.
process.on('SIGTERM', async () => { await worker.close(); process.exit(0); });
`),
    ),
    code(
      sh(`
# package.json — two entry points, two deploys, scaled independently
"scripts": {
  "start": "node src/index.js",
  "worker": "node src/workers/email.worker.js"
}
`),
    ),
    tip(
      'Run workers as a **separate process**, not inside the web server. That is the whole point: CPU-heavy work then cannot block request handling, and you can run four web instances and twenty workers when the backlog grows — or zero workers during an incident, with jobs simply waiting.',
    ),

    h('Retries and backoff'),
    code(
      js(`
// A failure is a throw. BullMQ retries according to the job's options.
new Worker('email', async (job) => {
  const res = await provider.send(job.data);

  if (res.status === 429 || res.status >= 500) {
    throw new Error(\`Transient: \${res.status}\`);      // retry
  }
  if (res.status >= 400) {
    // A bad address will fail identically forever. Do not burn 5 attempts.
    throw new UnrecoverableError(\`Permanent: \${res.status}\`);
  }
});
`),
    ),
    warn(
      'Retrying a permanent failure is wasted work that also delays every job behind it. Distinguish transient (timeout, `429`, `5xx`) from permanent (`400`, validation, a deleted record) and fail the second kind immediately — `UnrecoverableError` in BullMQ skips the remaining attempts.',
    ),
    p('Exponential backoff with jitter, for the same reason as in the `timers` topic — so every job that failed during an outage does not retry in the same instant.'),
    code(
      js(`
backoff: {
  type: 'custom',
  // attemptsMade is 1-based
  strategy: (attempts) => Math.min(60_000, 1000 * 2 ** attempts)
                          + Math.floor(Math.random() * 1000),
}
`),
    ),

    h('Idempotency'),
    p(
      'A queue guarantees **at-least-once** delivery, not exactly-once. A worker that finishes the work and then crashes before acknowledging will see the job again. Assume every job can run twice.',
    ),
    code(
      js(`
// Not idempotent — a retry charges the customer again.
await stripe.charges.create({ amount, customer });

// Idempotent — the provider deduplicates on the key.
await stripe.charges.create(
  { amount, customer },
  { idempotencyKey: \`order-\${orderId}-charge\` },
);

// Idempotent by a database constraint — the cheapest version.
// create unique index on emails_sent (order_id, kind);
try {
  await repo.recordEmailSent(orderId, 'confirmation');   // 23505 if already sent
  await provider.send(…);
} catch (err) {
  if (err.code === '23505') return;                       // already done, fine
  throw err;
}
`),
    ),
    code(
      js(`
// Deduplicate the JOB itself: a fixed id means adding it twice adds it once.
// NOTE: a custom jobId may not contain ':' — BullMQ throws. Use another separator.
await emailQueue.add('welcome', { userId }, { jobId: \`welcome-\${userId}\` });
`),
    ),
    tip(
      'Order the two steps so a crash is recoverable in the direction you prefer. Record-then-send risks an email that is marked sent but never went; send-then-record risks a duplicate email. For a receipt, prefer the duplicate; for a payment, prefer the miss and reconcile.',
    ),

    h('The transactional outbox'),
    warn(
      'Writing to Postgres and then adding to Redis is **not atomic**. If the process dies between them, the order exists and the email job does not — and nothing will ever notice. This is the most common correctness bug in queue-based systems.',
    ),
    code(
      js(`
// The fix: write the job into the same transaction as the data.
await withTransaction(async (client) => {
  const order = await repo.insertOrder(client, input);
  await repo.insertOutbox(client, {                 // same transaction
    kind: 'send-confirmation',
    payload: { orderId: order.id },
  });
  return order;
});

// A relay moves outbox rows into the queue. Safe to run repeatedly: it can
// only ever duplicate a job, never lose one — and jobs are idempotent.
setInterval(async () => {
  const rows = await repo.claimOutbox(50);     // for update skip locked
  for (const row of rows) {
    await emailQueue.add(row.kind, row.payload, { jobId: \`outbox-\${row.id}\` });
    await repo.markOutboxSent(row.id);
  }
}, 1000).unref();
`),
    ),
    note(
      'That `for update skip locked` is the pattern from the `transactions` topic, and it is why several relay instances can run at once without claiming the same row. If you want a queue with no Redis at all, the same query over a `jobs` table *is* a working queue — enough for a great many applications.',
    ),

    h('Operating it'),
    code(
      js(`
const counts = await emailQueue.getJobCounts();
// { waiting: 12, active: 5, completed: 40312, failed: 3, delayed: 88 }

const failed = await emailQueue.getFailed(0, 20);
await failed[0].retry();                       // after fixing the cause
await emailQueue.drain();                      // remove waiting + delayed
`),
    ),
    table(
      ['Alert on', 'Because'],
      [
        ['`waiting` growing steadily', 'Workers cannot keep up — scale them or the job is too slow'],
        ['`active` stuck above zero with no completions', 'A job is hung; check for a missing timeout'],
        ['`failed` rising', 'A dependency is broken, or a job is not idempotent'],
        ['Oldest waiting job age', 'The number users actually feel — better than a raw count'],
      ],
    ),
    tip(
      'Install a dashboard on day one — `bull-board` or Taskforce mount into Express in a few lines. Debugging a queue by reading Redis keys is miserable, and you will be doing it during an incident.',
    ),

    h('Choosing a queue'),
    table(
      ['Tool', 'Good for', 'Cost'],
      [
        ['**BullMQ + Redis**', 'The default for Node. Retries, delays, cron, priorities, rate limits', 'Redis is memory; not built for a permanent event log'],
        ['**Postgres + `SKIP LOCKED`**', 'You already have Postgres. Transactional with your data, no new service', 'You write the retry and scheduling logic'],
        ['**SQS**', 'Managed, effectively infinite scale', 'At-least-once, limited ordering, another cloud dependency'],
        ['**RabbitMQ**', 'Complex routing — fanout, topics, priorities', 'A broker to operate'],
        ['**Kafka**', 'High-volume event streaming with replay', 'Heavyweight; it is a log, not a task queue'],
      ],
    ),
    p(
      'For a Node service the honest answer is usually the first or the second. Kafka in particular is a common interview trap — reaching for it to send welcome emails signals that you have not thought about the actual requirement.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Get slow work out of a request', 'Add a job, return `202` or the created resource'],
      ['Run jobs', 'A separate worker process — never in the web server'],
      ['Handle a flaky dependency', '`attempts` + exponential backoff with jitter'],
      ['Stop retrying a permanent failure', '`UnrecoverableError`'],
      ['Survive an at-least-once redelivery', 'Make the job idempotent'],
      ['Deduplicate a job', 'A deterministic `jobId` — no colons in it'],
      ['Never lose a job on a crash', 'The transactional outbox'],
      ['Respect a provider rate limit', 'The worker `limiter`'],
      ['Shut down cleanly', '`await worker.close()` on `SIGTERM`'],
      ['Know it is healthy', 'Alert on the oldest waiting job'],
    ]),

    h('Interview'),
    asked([
      ['Why use a queue?', 'To take slow or unreliable work out of the request and make it durable across crashes, restarts and deploys.'],
      ['What happens to fire-and-forget work on a deploy?', 'It is lost with no record it was attempted — which is why it belongs in a queue.'],
      ['At-least-once vs exactly-once?', 'Real queues give at-least-once; exactly-once is achieved by making the consumer idempotent, not by the broker.'],
      ['How do you make a job idempotent?', 'A unique constraint, a provider idempotency key, or a deterministic job id.'],
      ['How should retries be spaced?', 'Exponentially with jitter, and not at all for permanent failures.'],
      ['The DB write succeeded but the job was never queued — how do you prevent that?', 'The transactional outbox: write the job in the same transaction, then relay it.'],
      ['Where do workers run?', 'A separate process, scaled independently, so CPU-heavy jobs cannot block request handling.'],
      ['BullMQ or Kafka?', 'BullMQ for task queues; Kafka is an event log for high-volume streaming with replay, and is overkill for sending email.'],
    ]),

    links(
      link('BullMQ documentation', 'https://docs.bullmq.io'),
      link('BullMQ — retrying failing jobs', 'https://docs.bullmq.io/guide/retrying-failing-jobs'),
      link('Transactional outbox pattern', 'https://microservices.io/patterns/data/transactional-outbox.html'),
    ),
  ],
};
