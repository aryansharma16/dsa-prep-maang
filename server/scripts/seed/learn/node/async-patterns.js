import { asked, cheat, code, h, js, links, nodeDoc, note, p, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Once you can write `await`, the remaining decisions are about *shape*: how many things run at once, what happens when one fails, and whether anything ever stops. This topic collects the patterns worth recognising, with the failure each one prevents.',
    ),

    h('Choosing a shape'),
    table(
      ['Shape', 'Code', 'Choose when'],
      [
        ['Serial', '`for (const x of xs) await f(x)`', 'Each step needs the last, or writes must be ordered'],
        ['Parallel', '`await Promise.all(xs.map(f))`', 'Independent, and the list is small and bounded'],
        ['Bounded', 'A worker pool of N', 'Independent, but the list is large or the callee is rate-limited'],
        ['Batched', 'Chunks of N, serial between chunks', 'The downstream accepts bulk operations'],
        ['Fire and forget', '`void f().catch(log)`', 'The caller genuinely must not wait — and you accept losing it'],
        ['Queued', 'Push a job, a worker consumes it', 'It must survive a crash, a restart, or a deploy'],
      ],
    ),

    h('Bounded concurrency'),
    p(
      'The default answer for "process this list of 5,000 things". `Promise.all` over all of them opens 5,000 connections; a serial loop takes an hour.',
    ),
    code(
      js(`
async function mapWithLimit(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;

  const worker = async () => {
    while (cursor < items.length) {
      const i = cursor++;                 // safe: single-threaded
      results[i] = await fn(items[i], i);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  return results;
}

const enriched = await mapWithLimit(userIds, 10, (id) => api.fetchUser(id));
`),
    ),
    tip(
      'Match the limit to the narrowest resource, not to what feels fast. If your Postgres pool is 10 connections, a concurrency of 50 just makes 40 tasks queue inside the pool where you cannot see them.',
    ),

    h('Batching'),
    code(
      js(`
// 10,000 inserts as 10,000 round trips is the slow way.
for (const row of rows) await db.insert(row);

// One round trip per 500 rows.
const chunk = (arr, size) =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size));

for (const batch of chunk(rows, 500)) {
  await db.insertMany(batch);
}
`),
    ),
    note(
      'Batching serially is often faster *and* safer than parallelising: one connection, predictable memory, and a failure that tells you exactly which batch stopped.',
    ),

    h('Streaming instead of loading'),
    warn(
      'Any pattern that starts with "load all the rows" has a size at which it stops working. A million-row export is not a `Promise.all` problem — it is a streaming problem, and the fix is to never hold the whole set in memory.',
    ),
    code(
      js(`
// Holds every row in memory. Fine at 1,000 rows, fatal at 10 million.
const rows = await db.query('select * from events');

// Constant memory, whatever the row count.
import { pipeline } from 'node:stream/promises';

await pipeline(
  db.queryStream('select * from events'),
  toCsvTransform(),
  fs.createWriteStream('events.csv'),
);
`),
    ),

    h('Fire and forget'),
    code(
      js(`
// Silently swallows errors AND crashes the process on rejection.
sendWelcomeEmail(user);

// At minimum, handle the rejection and say you meant it.
void sendWelcomeEmail(user).catch(err => log.error({ err }, 'welcome email failed'));

// What you actually want in production: it survives a restart.
await queue.add('welcome-email', { userId: user.id });
`),
    ),
    warn(
      'Fire and forget in an HTTP handler means the work dies with the process. A deploy restarts every instance; anything mid-flight is simply gone, with no record that it was ever attempted. If it matters, it goes in a queue.',
    ),

    h('Timeouts'),
    p(
      'Most Node clients wait forever by default. A dependency that hangs turns into your requests hanging, your connection pool filling, and a cascade.',
    ),
    code(
      js(`
// Real cancellation — the request is actually aborted.
const res = await fetch(url, { signal: AbortSignal.timeout(2000) });

// When the callee does not understand signals, race it — but know that
// the underlying work keeps running and keeps holding its resource.
const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(\`timeout after \${ms}ms\`)), ms).unref()),
  ]);
`),
    ),

    h('Idempotency and retries'),
    code(
      js(`
// Retrying is only safe if the operation is idempotent.
await withRetry(() => api.get(\`/users/\${id}\`));            // safe — GET
await withRetry(() => api.post('/charges', { amount }));   // NOT safe

// Make it safe by giving the operation an identity the server can dedupe on.
await withRetry(() =>
  api.post('/charges', { amount }, {
    headers: { 'Idempotency-Key': chargeId },
  }));
`),
    ),
    p(
      'Retry only what is safe to repeat: `GET`, `PUT` and `DELETE` by definition, and `POST` only with an idempotency key. Retry only transient failures — a timeout, a 429, a 5xx — never a 400, which will fail identically every time.',
    ),

    h('AsyncLocalStorage'),
    p(
      'Carrying a request id through ten call layers without adding a parameter to every function. Node keeps the store attached to the async context, so it survives every `await`.',
    ),
    code(
      js(`
import { AsyncLocalStorage } from 'node:async_hooks';

export const ctx = new AsyncLocalStorage();

// Middleware: open a store for the lifetime of the request.
app.use((req, res, next) => {
  ctx.run({ requestId: crypto.randomUUID(), userId: req.user?.id }, next);
});

// Anywhere, however deep, with nothing threaded through:
export const log = (msg, extra) =>
  logger.info({ ...ctx.getStore(), ...extra }, msg);
`),
    ),
    tip(
      'This is the correct use of "ambient" state in Node, and it is what request-scoped logging in Pino and every tracing library is built on. It is not a general global — the store is scoped to one async tree and cannot leak into a concurrent request.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Independent calls, small list', '`Promise.all`'],
      ['Independent calls, large list', 'A worker pool with a limit'],
      ['Many writes to one database', 'Batch them and go serially'],
      ['Unbounded data', 'Stream it — never load it all'],
      ['Work that must survive a restart', 'A queue, not fire and forget'],
      ['A dependency that might hang', 'An `AbortSignal.timeout`'],
      ['A safe retry of a POST', 'An idempotency key'],
      ['A request id in every log line', '`AsyncLocalStorage`'],
    ]),

    h('Interview'),
    asked([
      ['How do you process 10,000 items without falling over?', 'Bounded concurrency sized to the narrowest resource, or batching — not `Promise.all` over everything.'],
      ['When is serial better than parallel?', 'Dependent steps, ordered writes, rate limits, or when parallelism would exhaust memory or a pool.'],
      ['What is wrong with fire and forget?', 'The work is lost on restart and its errors are invisible. Use a queue.'],
      ['Which requests are safe to retry?', 'Idempotent ones — `GET`/`PUT`/`DELETE`, and `POST` only with an idempotency key.'],
      ['Why add jitter to backoff?', 'So every client that failed together does not retry together and re-break the service.'],
      ['How do you pass a request id through deep call stacks?', '`AsyncLocalStorage`, which survives awaits without threading a parameter.'],
    ]),

    links(
      nodeDoc('async_context.html#class-asynclocalstorage', 'AsyncLocalStorage'),
      nodeDoc('globals.html#static-method-abortsignaltimeoutdelay', 'AbortSignal.timeout'),
      nodeDoc('stream.html#streampipelinesource-transforms-destination-callback', 'stream.pipeline'),
    ),
  ],
};
