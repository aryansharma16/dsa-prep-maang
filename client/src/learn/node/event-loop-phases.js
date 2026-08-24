import { asked, cheat, code, h, js, link, links, note, p, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'The event loop is a `while` loop in libuv that repeatedly asks "what has finished, and whose callback should I run now?". It moves through a fixed sequence of **phases**, each with its own queue. Knowing the sequence is what turns "why did this log print second?" from a mystery into a lookup.',
    ),

    h('One full turn'),
    code(
      js(`
   ┌───────────────────────────────────────────────┐
   │                                               │
   │   ┌─────────────────────────┐                 │
   └──▶│         TIMERS          │  setTimeout, setInterval whose
       │                         │  time has come
       └────────────┬────────────┘
                    │  ◀── microtasks drain here (and after every callback)
       ┌────────────▼────────────┐
       │    PENDING CALLBACKS    │  some system errors, e.g. a TCP ECONNREFUSED
       └────────────┬────────────┘  deferred from the last turn
                    │
       ┌────────────▼────────────┐
       │   IDLE / PREPARE        │  libuv internal — you never see this
       └────────────┬────────────┘
                    │
       ┌────────────▼────────────┐
       │          POLL           │  ★ where the loop WAITS
       │                         │  new I/O: sockets readable, files read,
       │                         │  incoming requests. Runs their callbacks.
       └────────────┬────────────┘
                    │
       ┌────────────▼────────────┐
       │          CHECK          │  setImmediate callbacks
       └────────────┬────────────┘
                    │
       ┌────────────▼────────────┐
       │     CLOSE CALLBACKS     │  socket.on('close'), server.on('close')
       └────────────┬────────────┘
                    │
                    └──▶ anything left to do? ── yes ──▶ next turn
                                                └── no ──▶ process exits
`),
    ),
    note(
      'A single pass through all six phases is called a **tick**. The loop only exits when no timers are pending, no handles are open and no requests are outstanding — which is why a listening server keeps a process alive with no code running.',
    ),

    h('The phases that matter'),
    table(
      ['Phase', 'Runs', 'You queue into it with'],
      [
        ['**Timers**', 'Expired `setTimeout` / `setInterval` callbacks', '`setTimeout`, `setInterval`'],
        ['**Pending callbacks**', 'A few system-level errors deferred from the previous turn', 'Nothing directly'],
        ['**Poll**', 'I/O callbacks — the bulk of a server\'s work. **The loop blocks here waiting for events.**', 'Any file, socket or network operation'],
        ['**Check**', '`setImmediate` callbacks', '`setImmediate`'],
        ['**Close**', 'Cleanup for destroyed handles', '`stream.destroy()`, `socket.end()`'],
      ],
    ),

    h('The poll phase, in detail'),
    p(
      'Poll is where a server spends nearly all of its life, and it is the only phase that can *wait*. Its decision procedure:',
    ),
    code(
      js(`
if (there are I/O callbacks ready) {
  run them (up to a system-dependent limit, so it cannot starve the rest);
} else if (setImmediate callbacks are queued) {
  stop waiting -> go straight to CHECK;
} else if (timers are pending) {
  wait, but only until the nearest timer expires;
} else {
  wait for I/O indefinitely;    // an idle server, using no CPU at all
}
`),
    ),
    p(
      'That third branch is why `setTimeout` is *at least* the delay and never exactly it: the loop will not interrupt itself to service a timer. If poll is busy for 200 ms, your 10 ms timer fires at 200 ms.',
    ),

    h('Microtasks are not a phase'),
    warn(
      '`process.nextTick` and promise callbacks do **not** belong to any phase. Their queues drain completely between every single callback and between every phase transition. That is why they always beat a timer, and why an infinite `nextTick` recursion starves the loop permanently — the loop can never reach the next phase.',
    ),
    code(
      js(`
// The real order at every boundary:
//   1. drain the entire process.nextTick queue
//   2. drain the entire promise microtask queue
//   3. run the next thing in the current phase
`),
    ),
    p('The next topic is entirely about that ordering — it is the most-asked event loop question there is.'),

    h('Watching a tick happen'),
    code(
      js(`
// run: node loop.js
const fs = require('node:fs');

console.log('1: sync');

setTimeout(() => console.log('4: timers'), 0);
setImmediate(() => console.log('5: check'));

fs.readFile(__filename, () => {
  console.log('6: poll (I/O callback)');
  setTimeout(() => console.log('8: timers, next turn'), 0);
  setImmediate(() => console.log('7: check, same turn'));
});

process.nextTick(() => console.log('2: nextTick'));
Promise.resolve().then(() => console.log('3: promise'));

console.log('1b: sync');
`),
    ),
    code(
      js(`
1: sync
1b: sync
2: nextTick        <- microtasks, before the loop even starts a phase
3: promise
4: timers          <- (or 5 first — see the warning below)
5: check
6: poll            <- the file finished reading
7: check, same turn   <- inside an I/O callback, setImmediate ALWAYS wins
8: timers, next turn
`),
    ),
    warn(
      'At the top level, `setTimeout(fn, 0)` versus `setImmediate(fn)` is genuinely **non-deterministic**. `setTimeout(…, 0)` is clamped to 1 ms, and whether that millisecond has elapsed by the time the loop reaches the timers phase depends on how long the process took to start. Run the snippet a few times and the order will change.',
    ),
    tip(
      'Inside an I/O callback the order is guaranteed: `setImmediate` always runs before `setTimeout`, because you are already past the timers phase and check comes next in the same turn. If you need "after this I/O, before anything else", that is `setImmediate`.',
    ),

    h('What this explains'),
    table(
      ['Observation', 'Because'],
      [
        ['A 10 ms timer fires at 200 ms', 'The loop was busy; timers are a floor, not a schedule'],
        ['A server with no traffic uses no CPU', 'Poll blocks in the OS until an event arrives'],
        ['One CPU-heavy request stalls every other', 'The loop cannot reach the next phase until your callback returns'],
        ['`process.nextTick` beats a promise', 'Its queue drains first, before the microtask queue'],
        ['A process will not exit', 'An open handle — a listening server, an interval — keeps the loop alive'],
      ],
    ),

    h('Cheatsheet'),
    cheat([
      ['Run after the current operation completes', '`setImmediate`'],
      ['Run before anything else, right now', '`process.nextTick` — sparingly'],
      ['Run after a delay', '`setTimeout` — at least that long, never exactly'],
      ['Guarantee an order after I/O', '`setImmediate` inside the I/O callback'],
      ['Let a process exit despite a timer', '`timer.unref()`'],
      ['Find out why a process will not exit', '`process.getActiveResourcesInfo()`'],
    ]),

    h('Interview'),
    asked([
      ['Walk me through the event loop phases.', 'Timers, pending callbacks, idle/prepare, poll, check, close — repeating, with microtasks draining between every callback.'],
      ['What happens in the poll phase?', 'I/O callbacks run, and the loop blocks there waiting for new events when there is nothing else to do.'],
      ['`setTimeout(fn, 0)` vs `setImmediate(fn)`?', 'Non-deterministic at the top level; inside an I/O callback `setImmediate` always wins.'],
      ['Are microtasks part of a phase?', 'No — they drain completely between every callback and every phase transition.'],
      ['Why is `setTimeout` never exact?', 'It is a minimum. The loop finishes what it is doing before reaching the timers phase.'],
      ['When does a Node process exit?', 'When no timers, handles or pending requests remain to keep the loop alive.'],
    ]),

    links(
      link(
        'The event loop, timers and nextTick',
        'https://nodejs.org/en/learn/asynchronous-work/event-loop-timers-and-nexttick',
      ),
      link('Overview of blocking vs non-blocking', 'https://nodejs.org/en/learn/asynchronous-work/overview-of-blocking-vs-non-blocking'),
      link('libuv design overview', 'https://docs.libuv.org/en/v1.x/design.html'),
    ),
  ],
};
