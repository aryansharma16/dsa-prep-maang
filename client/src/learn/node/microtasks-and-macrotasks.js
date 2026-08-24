import { asked, cheat, code, h, js, link, links, nodeDoc, note, p, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'There are two microtask queues and several macrotask queues, and they drain in a fixed order. This topic is the order, why it is that order, and the exact snippet interviewers use to check whether you know it.',
    ),

    h('The hierarchy'),
    table(
      ['Priority', 'Queue', 'Queued by'],
      [
        ['1', '**nextTick queue**', '`process.nextTick(fn)`'],
        ['2', '**Microtask queue**', '`Promise.then/catch/finally`, `await`, `queueMicrotask`'],
        ['3', 'Timers phase', '`setTimeout`, `setInterval`'],
        ['4', 'Poll phase', 'I/O completion callbacks'],
        ['5', 'Check phase', '`setImmediate`'],
      ],
    ),
    p(
      'Queues 1 and 2 are **not phases**. They drain completely between every callback the loop runs and at every phase boundary — so after any single callback finishes, Node empties the nextTick queue, then empties the microtask queue, and only then continues.',
    ),
    warn(
      '"Drain completely" means exactly that. A microtask that queues another microtask is run in the same drain. A `process.nextTick` that calls `process.nextTick` **never lets the loop advance** — the process spins at 100% CPU, serves nothing, and looks like a hang.',
    ),

    h('The interview snippet'),
    p('Predict the output before reading on. Getting this right is the whole topic.'),
    code(
      js(`
// run: node order.js
console.log('1');

setTimeout(() => console.log('2'), 0);

setImmediate(() => console.log('3'));

Promise.resolve().then(() => console.log('4'));

process.nextTick(() => console.log('5'));

(async () => {
  console.log('6');
  await null;
  console.log('7');
})();

console.log('8');
`),
    ),
    code(
      js(`
1        // synchronous
6        // synchronous — an async function body runs immediately until its first await
8        // synchronous
5        // nextTick queue drains first
4        // then microtasks, in the order they were queued
7        // the continuation after 'await null' — also a microtask
2        // timers phase   (2 and 3 may swap — see below)
3        // check phase
`),
    ),
    p('The reasoning, line by line:'),
    table(
      ['Output', 'Why it is there'],
      [
        ['`1`, `6`, `8`', 'All synchronous. An `async` function is not deferred — its body runs until the first `await`.'],
        ['`5`', '`nextTick` outranks everything, including promises.'],
        ['`4` then `7`', 'Microtask queue, FIFO. `4` was queued during the synchronous run; `7` was queued when `await null` yielded.'],
        ['`2` / `3`', 'Macrotasks, on the next turn of the loop. Their relative order is not guaranteed at the top level.'],
      ],
    ),

    h('nextTick vs Promise'),
    code(
      js(`
process.nextTick(() => console.log('tick 1'));
Promise.resolve().then(() => console.log('promise 1'));
process.nextTick(() => console.log('tick 2'));
Promise.resolve().then(() => console.log('promise 2'));

// tick 1
// tick 2      <- the WHOLE nextTick queue drains
// promise 1
// promise 2
`),
    ),
    note(
      '`process.nextTick` predates promises. It exists so a Node API can guarantee a callback fires *after* the current operation but *before* any I/O — for example, letting you attach an error listener to an object the constructor already knows has failed. It is an internal-consistency tool, not a scheduling primitive for application code.',
    ),
    tip(
      'In application code, reach for `queueMicrotask` if you want microtask timing and `setImmediate` if you want "after the current phase". `process.nextTick` starves the loop if you get it wrong, and the two alternatives cannot.',
    ),

    h('setTimeout 0 vs setImmediate'),
    code(
      js(`
// At the top level — genuinely non-deterministic. Run it five times.
setTimeout(() => console.log('timeout'), 0);
setImmediate(() => console.log('immediate'));

// Inside an I/O callback — ALWAYS immediate first.
require('node:fs').readFile(__filename, () => {
  setTimeout(() => console.log('timeout'), 0);
  setImmediate(() => console.log('immediate'));
  // immediate
  // timeout
});
`),
    ),
    p(
      'The reason: `setTimeout(fn, 0)` is clamped to 1 ms. At the top level, whether that millisecond has already passed when the loop first reaches the timers phase depends on how long the process took to boot. Inside an I/O callback you are already in the poll phase, and check comes next in the same turn — so `setImmediate` cannot lose.',
    ),

    h('await is a microtask'),
    code(
      js(`
async function f() {
  console.log('a');
  await g();          // g() runs SYNCHRONOUSLY up to its own first await
  console.log('c');   // this line is a microtask
}
async function g() { console.log('b'); }

f();
console.log('d');

// a, b, d, c
`),
    ),
    warn(
      '`await` on a non-promise still costs a microtask turn. `await 5` does not run the next line synchronously — it defers it. That is usually invisible, and occasionally the reason an ordering assumption in a test is wrong.',
    ),

    h('Where this actually matters'),
    p(
      'Ordering puzzles are an interview genre, but the underlying knowledge pays off in two real situations.',
    ),
    code(
      js(`
// 1. Breaking up CPU work so the loop can serve requests between chunks.
async function processAll(items) {
  for (let i = 0; i < items.length; i++) {
    heavyWork(items[i]);
    if (i % 100 === 0) await new Promise(setImmediate);   // yield to the loop
  }
}

// 2. Emitting an event from a constructor. Without the defer, no listener
//    can possibly be attached yet.
class Job extends EventEmitter {
  constructor() {
    super();
    process.nextTick(() => this.emit('ready'));   // NOT this.emit('ready')
  }
}
`),
    ),

    h('Cheatsheet'),
    cheat([
      ['Run before any I/O, right after this callback', '`process.nextTick` — carefully'],
      ['Run after the current synchronous work', '`queueMicrotask`'],
      ['Run after the current phase', '`setImmediate`'],
      ['Yield the loop inside a long job', '`await new Promise(setImmediate)`'],
      ['Emit from a constructor', 'Defer with `process.nextTick`'],
      ['Diagnose a 100% CPU hang with no output', 'Look for recursive `process.nextTick`'],
    ]),

    h('Interview'),
    asked([
      ['`process.nextTick` vs `setImmediate`?', '`nextTick` runs before any I/O, at the end of the current operation; `setImmediate` runs in the check phase of the current turn.'],
      ['nextTick vs a promise callback?', 'The whole nextTick queue drains before the first microtask.'],
      ['Do microtasks belong to a phase?', 'No — they drain between every callback and every phase transition.'],
      ['Why is `setTimeout(fn, 0)` vs `setImmediate` unpredictable?', 'The timeout is clamped to 1 ms, and whether it has elapsed on the first loop turn depends on start-up time.'],
      ['When is that order guaranteed?', 'Inside an I/O callback — check follows poll, so `setImmediate` always wins.'],
      ['How can `nextTick` starve the loop?', 'It drains fully, so a callback that re-queues itself never lets the loop advance a phase.'],
      ['Does an async function body run immediately?', 'Yes, synchronously up to its first `await`; everything after is a microtask.'],
    ]),

    links(
      link(
        'The event loop, timers and nextTick',
        'https://nodejs.org/en/learn/asynchronous-work/event-loop-timers-and-nexttick',
      ),
      nodeDoc('process.html#processnexttickcallback-args', 'process.nextTick'),
      nodeDoc('timers.html#setimmediatecallback-args', 'setImmediate'),
    ),
  ],
};
