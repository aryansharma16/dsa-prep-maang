import { asked, cheat, code, h, js, links, mdn, nodeDoc, note, p, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Four static methods take an iterable of promises and return one promise. Choosing the right one is choosing what "done" means: all of them succeeded, all of them finished, the first one finished, or the first one succeeded.',
    ),

    h('The four'),
    table(
      ['Method', 'Fulfils when', 'Rejects when', 'Gives you'],
      [
        ['`Promise.all`', 'Every one fulfils', '**Any** one rejects — immediately', 'An array of values, in input order'],
        ['`Promise.allSettled`', 'Every one settles', 'Never', 'An array of `{status, value}` / `{status, reason}`'],
        ['`Promise.race`', 'The first to **settle** fulfils', 'The first to settle rejects', 'That one result'],
        ['`Promise.any`', 'The first to **fulfil**', 'All of them reject', 'That one value, or an `AggregateError`'],
      ],
    ),
    code(
      js(`
// run: node combinators.js
const ok = (v, ms) => new Promise(r => setTimeout(() => r(v), ms));
const bad = (e, ms) => new Promise((_, j) => setTimeout(() => j(new Error(e)), ms));

await Promise.all([ok('a', 50), ok('b', 10)]);          // ['a', 'b']  — input order
await Promise.all([ok('a', 50), bad('x', 10)]);         // throws Error: x after 10ms

await Promise.allSettled([ok('a', 50), bad('x', 10)]);
// [ { status: 'fulfilled', value: 'a' },
//   { status: 'rejected', reason: Error: x } ]

await Promise.race([ok('a', 50), bad('x', 10)]);        // throws — x settled first
await Promise.any([ok('a', 50), bad('x', 10)]);         // 'a'  — rejections ignored
`),
    ),
    note(
      '`Promise.all` returns values **in the order you passed them**, not in the order they finished. That is what makes destructuring the result safe.',
    ),

    h('Promise.all — the default'),
    code(
      js(`
// The dashboard case: three independent queries, one round of waiting.
const [user, tasks, stats] = await Promise.all([
  db.findUser(id),
  db.findTasks(id),
  db.countByStatus(id),
]);
`),
    ),
    warn(
      '`Promise.all` rejects on the first failure but **does not cancel the others** — promises cannot be cancelled. The remaining calls still run to completion, and if one of them rejects afterwards with nobody listening you get an unhandled rejection. When partial failure is acceptable, use `allSettled`.',
    ),

    h('Promise.allSettled — when partial failure is fine'),
    code(
      js(`
// Notify five subscribers. One bad webhook must not fail the request.
const results = await Promise.allSettled(hooks.map(h => post(h.url, payload)));

const failed = results.filter(r => r.status === 'rejected');
if (failed.length) log.warn({ count: failed.length }, 'some webhooks failed');

const delivered = results
  .filter(r => r.status === 'fulfilled')
  .map(r => r.value);
`),
    ),

    h('Promise.race — timeouts'),
    p(
      'The main real use is racing work against a timer, because most Node clients will happily wait forever.',
    ),
    code(
      js(`
const timeout = (ms) =>
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error(\`timed out after \${ms}ms\`)), ms).unref());

const rows = await Promise.race([db.query(sql), timeout(2000)]);
`),
    ),
    tip(
      'Prefer real cancellation where the API supports it. `AbortSignal.timeout(2000)` passed to `fetch` actually aborts the request, whereas a raced timer only stops *you* waiting — the query keeps running and keeps holding a connection.',
    ),
    code(
      js(`
// Better, when the callee understands signals:
const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
`),
    ),

    h('Promise.any — first success wins'),
    code(
      js(`
// Three mirrors, take whichever answers first and ignore the ones that fail.
try {
  const data = await Promise.any([get(mirrorA), get(mirrorB), get(mirrorC)]);
} catch (err) {
  // AggregateError — err.errors holds all three reasons
  log.error({ errors: err.errors }, 'every mirror failed');
}
`),
    ),

    h('Bounded concurrency'),
    p(
      'The gap none of the four fill: 5,000 items to process, and `Promise.all` over all of them opens 5,000 sockets, exhausts the database pool and gets you rate-limited. You want *N* in flight at a time.',
    ),
    code(
      js(`
// run: node pool.js
async function mapWithLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;

  const worker = async () => {
    while (next < items.length) {
      const i = next++;               // claim an index, then await
      results[i] = await fn(items[i], i);
    }
  };

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

const enriched = await mapWithLimit(ids, 10, (id) => fetchOne(id));
`),
    ),
    p(
      'Ten workers pull from a shared cursor until the list is empty. `next++` is safe because JavaScript is single-threaded — no two workers can interleave between reading and incrementing.',
    ),
    note(
      'In production most people use `p-limit` or `p-map` rather than writing this. It is worth writing once anyway: it is a common interview exercise, and it makes clear why the answer is not `Promise.all`.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Several independent calls, all must succeed', '`Promise.all`'],
      ['Several calls, partial failure is fine', '`Promise.allSettled`'],
      ['Add a timeout to something', '`Promise.race` with a rejecting timer — or `AbortSignal.timeout`'],
      ['First successful mirror wins', '`Promise.any`'],
      ['Thousands of items, limited resources', 'A worker pool — `mapWithLimit`, `p-limit`'],
      ['Know which input failed in `allSettled`', 'Zip the results back against the input by index'],
    ]),

    h('Interview'),
    asked([
      ['`Promise.all` vs `allSettled`?', '`all` rejects on the first failure; `allSettled` always fulfils with a per-item status.'],
      ['Does `Promise.all` cancel the rest when one rejects?', 'No — promises cannot be cancelled. The others keep running.'],
      ['Is `Promise.all` output in completion order?', 'No, input order. That is what makes destructuring it safe.'],
      ['`race` vs `any`?', '`race` settles with the first to *settle*, success or failure; `any` waits for the first *success*.'],
      ['How do you cap concurrency at 10?', 'A pool of 10 workers pulling from a shared index, or a library like `p-limit`.'],
      ['How do you add a timeout to a promise?', 'Race it against a rejecting timer, or better, pass an `AbortSignal` the callee honours.'],
    ]),

    links(
      mdn('Web/JavaScript/Reference/Global_Objects/Promise/all', 'Promise.all'),
      mdn('Web/JavaScript/Reference/Global_Objects/Promise/allSettled', 'Promise.allSettled'),
      nodeDoc('globals.html#class-abortsignal', 'AbortSignal'),
    ),
  ],
};
