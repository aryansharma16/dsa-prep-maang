import { asked, cheat, code, h, js, links, nodeDoc, note, p, sig, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Node has four timer functions. They look like the browser\'s, but they are backed by the event loop rather than by a browser scheduler, and two of their behaviours — the minimum delay and the way a timer keeps the process alive — matter in production.',
    ),

    h('The four'),
    sig([
      ['`setTimeout(fn, ms, ...args)`', '→ `Timeout`', 'Run once, after **at least** `ms`. Timers phase.'],
      ['`setInterval(fn, ms, ...args)`', '→ `Timeout`', 'Run repeatedly, at least `ms` apart.'],
      ['`setImmediate(fn, ...args)`', '→ `Immediate`', 'Run in the check phase of the current turn. Node-only.'],
      ['`queueMicrotask(fn)`', '→ `undefined`', 'Run as a microtask, before the loop advances at all.'],
    ]),
    code(
      js(`
const t = setTimeout(() => console.log('later'), 1000);
clearTimeout(t);

const i = setInterval(poll, 5000);
clearInterval(i);

const im = setImmediate(() => console.log('soon'));
clearImmediate(im);

// Extra arguments are passed straight through — no closure needed.
setTimeout((id, action) => log(id, action), 100, taskId, 'retry');
`),
    ),

    h('The delay is a floor'),
    p(
      'A timer is a request to run "no earlier than". The loop finishes whatever it is doing first, so a busy process delivers timers late — sometimes very late.',
    ),
    code(
      js(`
// run: node drift.js
const start = Date.now();
setTimeout(() => console.log('fired after', Date.now() - start, 'ms'), 10);

// Block the thread for 500ms.
const end = Date.now() + 500;
while (Date.now() < end) {}

// fired after 500 ms   — not 10
`),
    ),
    table(
      ['Written', 'Actually'],
      [
        ['`setTimeout(fn, 0)`', 'Clamped to 1 ms'],
        ['`setTimeout(fn, 10)` on a busy loop', 'Whenever the loop next reaches the timers phase'],
        ['`setTimeout(fn, 2 ** 31)`', '**Fires immediately.** The delay overflows a 32-bit int'],
      ],
    ),
    warn(
      'The overflow is real and bites: any delay above 2,147,483,647 ms (about 24.8 days) wraps to 1 and the callback runs at once. Scheduling "in 60 days" with a single `setTimeout` runs it now. Use a scheduler or a queue with a persisted run-at time.',
    ),

    h('setInterval drift'),
    p(
      '`setInterval` schedules the *next* run relative to when the current one was dispatched, not to a fixed grid — and it does not wait for an async callback to finish. Two problems follow.',
    ),
    code(
      js(`
// Problem: if the job takes longer than the interval, runs overlap
// and pile up. Nothing here waits.
setInterval(async () => { await syncEverything(); }, 1000);

// Fix: reschedule after the work finishes.
async function loop() {
  try { await syncEverything(); }
  catch (err) { log.error({ err }); }
  finally { setTimeout(loop, 1000).unref(); }
}
loop();
`),
    ),
    tip(
      'A self-rescheduling `setTimeout` is almost always the right shape for a recurring async job. It guarantees no overlap, survives a slow run, and lets you back off after an error by changing the delay.',
    ),

    h('unref — the one that matters in production'),
    p(
      'A pending timer keeps the event loop alive, so the process will not exit. `unref()` says "you are still a timer, but you do not count as a reason to stay running".',
    ),
    code(
      js(`
// This process hangs for 60 seconds after its work is done.
setInterval(() => collectMetrics(), 60_000);

// This one exits as soon as the real work finishes.
setInterval(() => collectMetrics(), 60_000).unref();
`),
    ),
    code(
      js(`
// The pattern you will write in every shutdown handler:
const forceExit = setTimeout(() => {
  log.error('shutdown took too long, forcing exit');
  process.exit(1);
}, 10_000);
forceExit.unref();     // do not let THIS timer be the reason we stay up
`),
    ),
    note(
      'The general question "why will my script not exit?" is usually an interval, a listening server, or an open database pool. `process.getActiveResourcesInfo()` lists exactly what is holding it.',
    ),

    h('Promise-based timers'),
    p(
      '`node:timers/promises` gives awaitable versions, with `AbortSignal` support. This replaces the hand-rolled `sleep` in most codebases.',
    ),
    code(
      js(`
import { setTimeout as sleep, setInterval as every } from 'node:timers/promises';

await sleep(1000);                       // a real await, no wrapper
const value = await sleep(50, 'done');   // resolves with 'done'

// Cancellable.
const ac = new AbortController();
try {
  await sleep(5000, undefined, { signal: ac.signal });
} catch (err) {
  if (err.name === 'AbortError') { /* cancelled */ }
}

// An async iterator, which cannot overlap by construction.
for await (const _ of every(1000)) {
  await syncEverything();
}
`),
    ),

    h('Retry with backoff'),
    code(
      js(`
import { setTimeout as sleep } from 'node:timers/promises';

async function withRetry(fn, { attempts = 3, base = 200 } = {}) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === attempts - 1) throw err;
      const delay = base * 2 ** i;                 // 200, 400, 800
      const jitter = Math.random() * delay * 0.3;  // spread the retries out
      await sleep(delay + jitter);
    }
  }
}
`),
    ),
    tip(
      'The jitter is not decoration. Without it, every client that failed during an outage retries at the same instant and knocks the service over again the moment it recovers — a thundering herd.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Wait, with await', '`await sleep(ms)` from `node:timers/promises`'],
      ['Run a recurring async job', 'A self-rescheduling `setTimeout`, not `setInterval`'],
      ['Stop a timer holding the process open', '`.unref()`'],
      ['Cancel a wait', 'Pass an `AbortSignal`'],
      ['Retry a flaky call', 'Exponential backoff with jitter'],
      ['Schedule further than 24 days out', 'A queue or scheduler — never one `setTimeout`'],
      ['Find what is keeping the process alive', '`process.getActiveResourcesInfo()`'],
    ]),

    h('Interview'),
    asked([
      ['Is `setTimeout(fn, 100)` exactly 100 ms?', 'No — a minimum. The loop must finish its current work before reaching the timers phase.'],
      ['Why does `setTimeout(fn, 0)` not run immediately?', 'It is clamped to 1 ms and still has to wait for the timers phase.'],
      ['What does `unref()` do?', 'Stops the timer counting as a reason to keep the event loop alive.'],
      ['Why avoid `setInterval` for async work?', 'It does not wait for the callback, so slow runs overlap and pile up.'],
      ['What happens with a delay over 24 days?', 'It overflows 32 bits and fires immediately.'],
      ['How do you implement retry with backoff?', 'A loop with `await sleep(base * 2 ** attempt + jitter)`, rethrowing on the last attempt.'],
    ]),

    links(
      nodeDoc('timers.html', 'Timers'),
      nodeDoc('timers.html#timers-promises-api', 'Timers Promises API'),
      nodeDoc('timers.html#timeoutunref', 'timeout.unref()'),
    ),
  ],
};
