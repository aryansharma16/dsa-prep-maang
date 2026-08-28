import { asked, cheat, code, h, js, link, links, nodeDoc, note, p, sh, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Blocking the event loop is the failure mode unique to Node. One request runs a slow synchronous operation, the single JavaScript thread cannot do anything else, and **every** other request in the process waits — including your health check, which is how a blocked process gets marked healthy right up until it is killed for timing out.',
    ),

    h('See it happen'),
    code(
      js(`
// run: node block.js
// then: curl localhost:3000/slow & curl -w '%{time_total}\\n' localhost:3000/fast
import express from 'express';
const app = express();

app.get('/fast', (req, res) => res.json({ ok: true }));

app.get('/slow', (req, res) => {
  let total = 0;
  for (let i = 0; i < 5e9; i++) total += i;      // ~5s of pure CPU
  res.json({ total });
});

app.listen(3000);
`),
    ),
    p(
      '`/fast` takes 5 seconds. It was not slow — it was not running. Nothing was, except the loop in `/slow`. One user with one request just made the service unavailable for everyone.',
    ),

    h('What blocks'),
    table(
      ['Blocks the loop', 'Does not'],
      [
        ['Any `*Sync` call — `readFileSync`, `execSync`', 'The async version of the same call'],
        ['`JSON.parse` / `stringify` on a large payload', 'Streaming JSON, or a size limit'],
        ['A loop over a large array', 'Chunking, or doing it in the database'],
        ['`bcrypt.hashSync`, `crypto.pbkdf2Sync`', 'The async form — it uses the thread pool'],
        ['A catastrophic regular expression', 'A linear-time pattern, or a length cap'],
        ['`Array.sort` on hundreds of thousands of rows', '`ORDER BY` in SQL'],
        ['Template rendering a huge page', 'Streaming the response'],
        ['`zlib.gzipSync`', '`zlib.gzip`'],
      ],
    ),
    warn(
      'Note where `bcrypt` sits. The **async** form moves the work to the libuv thread pool, so it does not block the loop — but the pool is only four threads by default, so the fifth concurrent login still queues. Blocking and pool exhaustion are different problems with different fixes.',
    ),

    h('Regular expressions'),
    p(
      'ReDoS — a regular-expression denial of service — is the one people miss, because the code looks harmless and it only fails on adversarial input.',
    ),
    code(
      js(`
// Nested quantifiers: catastrophic backtracking.
const bad = /^(a+)+$/;
bad.test('a'.repeat(30) + 'b');        // effectively forever

// Also risky, and it appears in real validation code:
const email = /^([a-zA-Z0-9_.-])+@(([a-zA-Z0-9-])+.)+([a-zA-Z0-9]{2,4})+$/;
`),
    ),
    p(
      'The defences, in order: cap the input length before you match it, avoid nested quantifiers, and prefer a real parser or a schema library over a clever regular expression for structured input.',
    ),

    h('Measuring lag'),
    p(
      'Event loop lag is how long a callback waited past its scheduled time. It is the single best number for "is this process healthy" — better than CPU, because a blocked loop and a busy one look identical from outside.',
    ),
    code(
      js(`
import { monitorEventLoopDelay } from 'node:perf_hooks';

const h = monitorEventLoopDelay({ resolution: 20 });
h.enable();

setInterval(() => {
  console.log({
    meanMs: +(h.mean / 1e6).toFixed(2),
    p99Ms: +(h.percentile(99) / 1e6).toFixed(2),
    maxMs: +(h.max / 1e6).toFixed(2),
  });
  h.reset();
}, 10_000).unref();
`),
    ),
    table(
      ['p99 lag', 'Verdict'],
      [
        ['under ~10 ms', 'Healthy'],
        ['10–100 ms', 'Something synchronous is running. Worth finding.'],
        ['over 100 ms', 'Users are feeling it'],
        ['seconds', 'The process is effectively down'],
      ],
    ),
    tip(
      'Export loop lag as a metric and alert on the p99, not the mean. A mean of 2 ms with a p99 of 800 ms is one slow endpoint hiding inside a healthy-looking average — and it is exactly what a `JSON.parse` on an occasional large payload looks like.',
    ),

    h('Finding the culprit'),
    code(
      sh(`
# Sample the stack while it is stuck — the CPU profile shows the hot frame.
node --cpu-prof --cpu-prof-dir=./prof src/index.js
# load the .cpuprofile in Chrome DevTools -> Performance

# Or attach to a running process and take a profile live.
node --inspect src/index.js     # chrome://inspect -> Profiler
`),
    ),
    code(
      js(`
// A cheap always-on detector: measure how late a fixed interval is.
let last = process.hrtime.bigint();
setInterval(() => {
  const now = process.hrtime.bigint();
  const lagMs = Number(now - last) / 1e6 - 500;
  if (lagMs > 100) log.warn({ lagMs: Math.round(lagMs) }, 'event loop blocked');
  last = now;
}, 500).unref();
`),
    ),

    h('The four fixes'),
    p('In the order you should try them:'),
    table(
      ['Fix', 'When', 'Cost'],
      [
        ['**Do less**', 'Paginate, add a `LIMIT`, cap request body size, aggregate in SQL', 'Usually free — and usually enough'],
        ['**Yield**', 'A long loop you control', 'A few lines; the work still competes for the thread'],
        ['**Move off-thread**', 'CPU-bound and unavoidable in-process — hashing, image work', '`worker_threads`; message passing, and a pool to manage'],
        ['**Move off-process**', 'Reports, video, batch jobs', 'A queue and a worker service — the most robust answer'],
      ],
    ),
    code(
      js(`
// Yielding: let the loop breathe every N items.
async function processAll(items) {
  for (let i = 0; i < items.length; i++) {
    heavy(items[i]);
    if ((i & 0xff) === 0) await new Promise(setImmediate);   // every 256
  }
}
`),
    ),
    note(
      'Yielding does not make the work faster and does not stop it competing for the thread — it just stops any single request monopolising it. For genuinely heavy work, a queue and a separate worker process is the answer, and it is the `queues` section in the next pass of this track.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Never call in a request handler', 'Anything ending in `Sync`'],
      ['Stop a huge body blocking the parser', '`express.json({ limit: "100kb" })`'],
      ['Sort or aggregate a lot of rows', 'In SQL, not in JavaScript'],
      ['Break up a long loop', '`await new Promise(setImmediate)` every N items'],
      ['Hash a password without blocking', 'The async `bcrypt.hash` — and watch the pool size'],
      ['Measure loop health', '`monitorEventLoopDelay`, alert on p99'],
      ['Find the blocking line', '`--cpu-prof`, then read the flame chart'],
      ['Handle genuinely heavy work', 'A queue and a worker process'],
    ]),

    h('Interview'),
    asked([
      ['What happens if one request does heavy CPU work?', 'It blocks the single JS thread, so every other request in that process waits.'],
      ['Name things that block the loop.', '`*Sync` calls, large `JSON.parse`, big loops and sorts, catastrophic regexes, synchronous crypto.'],
      ['How do you detect it in production?', 'Event loop lag via `perf_hooks.monitorEventLoopDelay`, alerting on the p99.'],
      ['How do you fix CPU-bound work?', 'Do less, yield with `setImmediate`, move to `worker_threads`, or move to a queued worker process.'],
      ['Does async `bcrypt` block the loop?', 'No — it uses the libuv thread pool, but only four threads by default, so concurrent hashes still queue.'],
      ['What is ReDoS?', 'A regex with catastrophic backtracking that a crafted input can make run effectively forever, blocking the loop.'],
    ]),

    links(
      link(
        "Don't block the event loop",
        'https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop',
      ),
      nodeDoc('perf_hooks.html#perf_hooksmonitoreventloopdelayoptions', 'monitorEventLoopDelay'),
      nodeDoc('cli.html#--cpu-prof', '--cpu-prof'),
    ),
  ],
};
