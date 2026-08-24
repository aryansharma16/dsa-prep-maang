import { asked, cheat, code, h, js, links, nodeDoc, p, sig, tip, ul, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'A callback is a function you hand to another function so it can call you back when it is done. Before promises existed it was the only way to say "later", and because Node predates promises, its entire standard library was built on one specific convention that you still meet in older code and in every `EventEmitter`-shaped API.',
    ),

    h('The error-first convention'),
    p(
      'Node callbacks take the error as the **first** parameter and the result second. There is no `try/catch` around asynchronous work, so the error has to travel through the same channel as the result.',
    ),
    sig([
      ['`err`', '`Error | null`', '`null` when it worked. Always check this first, before touching the result.'],
      ['`result`', 'any', 'Present only when `err` is `null`. Reading it otherwise gives `undefined`.'],
    ]),
    code(
      js(`
// run: node read.js
const fs = require('node:fs');

fs.readFile('config.json', 'utf8', (err, data) => {
  if (err) {
    console.error('could not read config:', err.message);
    return;                      // the return matters — see below
  }
  console.log(JSON.parse(data));
});

console.log('this line runs first');
`),
    ),
    p(
      'The last line printing first is the whole point: `readFile` registered your callback and returned immediately. Nothing waited.',
    ),
    warn(
      'The missing `return` after handling an error is the classic callback bug. Without it, execution falls through and runs the success path with `data` as `undefined` — so a file-read failure becomes a `JSON.parse(undefined)` crash somewhere else, with a stack trace pointing at the wrong line.',
    ),

    h('Why try/catch does not work'),
    code(
      js(`
// This catches nothing.
try {
  fs.readFile('missing.json', 'utf8', (err, data) => {
    throw new Error('boom');       // thrown on a later tick, long after the try block
  });
} catch (e) {
  console.log('never reached');
}
`),
    ),
    p(
      'By the time the callback runs, the `try` block has finished and its stack frame is gone. The throw escapes to the top of the event loop as an `uncaughtException`, which by default kills the process. This is the flaw promises were invented to fix.',
    ),

    h('Callback hell'),
    p(
      'Each step needs the previous result, so each nests inside the last. Three levels is uncomfortable, five is unreadable, and the error handling is duplicated at every level.',
    ),
    code(
      js(`
getUser(userId, (err, user) => {
  if (err) return done(err);
  getTasks(user.id, (err, tasks) => {
    if (err) return done(err);
    getComments(tasks[0].id, (err, comments) => {
      if (err) return done(err);
      render(user, tasks, comments, (err, html) => {
        if (err) return done(err);
        done(null, html);
      });
    });
  });
});
`),
    ),
    p('The same thing with `async`/`await`, which is where this section is heading:'),
    code(
      js(`
try {
  const user = await getUser(userId);
  const tasks = await getTasks(user.id);
  const comments = await getComments(tasks[0].id);
  return await render(user, tasks, comments);
} catch (err) {
  return done(err);
}
`),
    ),

    h('Converting a callback API'),
    p(
      'You rarely write callbacks now — you convert them. Node has `util.promisify` for anything following the error-first convention, and most built-ins ship a promise version already.',
    ),
    code(
      js(`
const { promisify } = require('node:util');
const fs = require('node:fs');

const readFile = promisify(fs.readFile);
const data = await readFile('config.json', 'utf8');

// But for fs specifically, the promise API already exists:
const fsp = require('node:fs/promises');
const data2 = await fsp.readFile('config.json', 'utf8');
`),
    ),
    p('For an API that does not follow the convention, wrap it by hand:'),
    code(
      js(`
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const query = (sql, params) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
`),
    ),
    tip(
      'The `new Promise` constructor should only ever appear when wrapping a callback or an event API. If you are writing it around something that already returns a promise, you have written the "promise constructor anti-pattern" and swallowed its errors.',
    ),

    h('Where callbacks are still correct'),
    p(
      'A promise settles once. Anything that produces **many** values over time still uses callbacks, and always will.',
    ),
    ul(
      '**Event listeners** — `server.on("request", handler)`, `stream.on("data", chunk)`. Many calls, no single result.',
      '**Array methods** — `map`, `filter`, `reduce`. Synchronous callbacks, no "later" involved.',
      '**Express middleware** — `(req, res, next)` is a callback API, and `next(err)` is the error-first convention in disguise.',
      '**Timers** — `setInterval` fires repeatedly.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Handle an error in a callback', '`if (err) return cb(err);` — with the `return`'],
      ['Turn a Node-style callback into a promise', '`util.promisify(fn)`'],
      ['Turn any async API into a promise', '`new Promise((resolve, reject) => ...)`'],
      ['Read a file with await', '`require("node:fs/promises")`'],
      ['Await a delay', '`new Promise(r => setTimeout(r, ms))`, or `timers/promises`'],
      ['Handle many values over time', 'Stay with an event listener or a stream'],
    ]),

    h('Interview'),
    asked([
      ['What is the error-first callback convention?', 'The callback receives `(err, result)`; `err` is `null` on success and must be checked before the result is used.'],
      ['Why does `try/catch` not catch a callback error?', 'The callback runs on a later tick, after the `try` block\'s frame is gone.'],
      ['What is callback hell?', 'Deep nesting from sequential async steps, with error handling repeated at every level.'],
      ['How do you promisify a callback function?', '`util.promisify` for error-first APIs, or wrap it in `new Promise` manually.'],
      ['Are callbacks obsolete?', 'No — anything emitting many values over time (streams, events, timers) still uses them.'],
    ]),

    links(
      nodeDoc('util.html#utilpromisifyoriginal', 'util.promisify'),
      nodeDoc('errors.html#error-first-callbacks', 'Error-first callbacks'),
      nodeDoc('fs.html#promises-api', 'fs Promises API'),
    ),
  ],
};
