import { asked, cheat, code, h, js, links, mdn, nodeDoc, note, p, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'A promise is an object standing in for a value that is not here yet. It gives asynchronous work two things callbacks could not: a **return value** you can pass around before it has resolved, and an error channel that propagates instead of vanishing.',
    ),

    h('Three states, one transition'),
    table(
      ['State', 'Means', 'Next'],
      [
        ['pending', 'Still running', 'Can become fulfilled or rejected'],
        ['fulfilled', 'Finished with a value', '**Final** — nothing can change it'],
        ['rejected', 'Finished with a reason, usually an `Error`', '**Final**'],
      ],
    ),
    p(
      'A promise settles exactly once. Calling `resolve` twice does nothing the second time, which is why promises cannot model a stream of events — that is still what `EventEmitter` is for.',
    ),
    code(
      js(`
// run: node promise.js
const p = new Promise((resolve, reject) => {
  setTimeout(() => resolve('done'), 100);
});

console.log(p);                 // Promise { <pending> }
p.then(v => console.log(v));    // 'done', 100ms later
`),
    ),

    h('then, catch, finally'),
    code(
      js(`
fetchUser(id)
  .then(user => fetchTasks(user.id))     // return a promise -> the chain waits for it
  .then(tasks => tasks.filter(t => !t.done))
  .catch(err => {                        // catches a rejection from ANY step above
    console.error(err);
    return [];                           // returning here RESUMES the chain
  })
  .finally(() => release());             // always runs; cannot change the value
`),
    ),
    p('Three rules cover almost everything the chain does:'),
    code(
      js(`
// 1. Returning a value passes it to the next .then
.then(() => 5).then(v => console.log(v))            // 5

// 2. Returning a promise makes the chain wait for it
.then(() => fetchUser(1)).then(user => ...)          // user, not a promise

// 3. Throwing skips every .then until the next .catch
.then(() => { throw new Error('nope'); })
.then(() => console.log('skipped'))
.catch(err => console.log(err.message));             // 'nope'
`),
    ),
    warn(
      'A `.catch` that returns a value marks the chain as **handled and successful** again. The `.then` after it will run. That is useful for defaults and disastrous when you meant to stop — rethrow if the chain should not continue.',
    ),

    h('Forgetting to return'),
    p(
      'The most common promise bug in Node code: a `then` that starts asynchronous work without returning it. The chain does not wait, the ordering is wrong, and an error inside it becomes an unhandled rejection.',
    ),
    code(
      js(`
// Broken — the chain does not wait for saveUser.
fetchUser(id)
  .then(user => { saveUser(user); })
  .then(() => console.log('saved'));    // logs before the save finishes

// Fixed.
fetchUser(id)
  .then(user => saveUser(user))
  .then(() => console.log('saved'));
`),
    ),
    tip(
      'This class of bug is why `async`/`await` won: `await` cannot be forgotten in the same way, because the linter and the missing value both point at it.',
    ),

    h('Creating one'),
    p(
      'You almost never need `new Promise`. It exists to wrap something that is not promise-based yet — a callback API, an event, a timer.',
    ),
    code(
      js(`
// Wrapping a callback API. Note both paths are covered.
const query = (sql, params) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

// Wrapping an event API — resolve on success, reject on error.
const once = (emitter, event) =>
  new Promise((resolve, reject) => {
    emitter.once(event, resolve);
    emitter.once('error', reject);
  });

// The already-settled shortcuts.
Promise.resolve(42);
Promise.reject(new AppError('nope', 400));
`),
    ),
    warn(
      'The **promise constructor anti-pattern**: `new Promise(res => fetchUser().then(res))`. You already had a promise. Wrapping it adds nothing and loses the rejection, because nothing calls `reject`. If a function already returns a promise, return it.',
    ),
    note(
      'Node has `Promise.withResolvers()` since v22 for the rarer case where you need `resolve` and `reject` outside the executor — a deferred, in older terminology.',
    ),

    h('Eager, not lazy'),
    p(
      'A promise starts running the moment it is created, not when you `await` it. This is unlike a lazy future in some other languages, and it is what makes the parallel patterns in the next topics work.',
    ),
    code(
      js(`
// Both requests are already in flight before the first await.
const userP = fetchUser(id);
const tasksP = fetchTasks(id);

const user = await userP;
const tasks = await tasksP;      // no extra wait — it resolved alongside
`),
    ),

    h('Unhandled rejections'),
    p(
      'A promise that rejects with nothing attached to catch it is an **unhandled rejection**. Since Node 15 that terminates the process by default, with an exit code of 1 — the same as an uncaught exception.',
    ),
    code(
      js(`
// Crashes the process on modern Node.
fetchUser(id);      // no .catch, no await

// Fine — the rejection has somewhere to go.
fetchUser(id).catch(err => log.error(err));

// A last-resort net at the top of your entry file:
process.on('unhandledRejection', (reason) => {
  log.fatal({ reason }, 'unhandled rejection');
  process.exit(1);
});
`),
    ),
    tip(
      'Log and exit in that handler rather than swallowing it. A process that has thrown an error nobody handled is in an unknown state; your process manager restarting it cleanly is safer than letting it limp on.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Wrap a callback API', '`new Promise((resolve, reject) => ...)` — once'],
      ['Chain dependent steps', 'Return the next promise from `.then`'],
      ['Handle any error in a chain', 'One `.catch` at the end'],
      ['Clean up either way', '`.finally()`'],
      ['Start two things at once', 'Create both promises, then `await` both'],
      ['Return an already-known value', '`Promise.resolve(v)`'],
      ['Avoid a crash from a floating promise', '`await` it or attach `.catch`'],
    ]),

    h('Interview'),
    asked([
      ['What are the three states of a promise?', 'Pending, fulfilled, rejected — and it settles exactly once.'],
      ['Is a promise lazy?', 'No. The executor runs immediately on construction; `await` only decides when you read the result.'],
      ['What does returning a promise from `.then` do?', 'The chain waits for it and passes its resolved value to the next `.then`.'],
      ['What happens after a `.catch` returns a value?', 'The chain is handled again and subsequent `.then`s run — rethrow if you want it to stop.'],
      ['What is the promise constructor anti-pattern?', 'Wrapping something that already returns a promise in `new Promise`, which loses the rejection path.'],
      ['What happens to an unhandled rejection?', 'Since Node 15 it crashes the process by default.'],
    ]),

    links(
      mdn('Web/JavaScript/Reference/Global_Objects/Promise', 'Promise'),
      mdn('Web/JavaScript/Guide/Using_promises', 'Using promises'),
      nodeDoc('process.html#event-unhandledrejection', 'unhandledRejection'),
    ),
  ],
};
