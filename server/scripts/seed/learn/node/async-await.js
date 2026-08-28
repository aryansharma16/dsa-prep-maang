import { asked, cheat, code, h, js, links, mdn, note, p, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      '`async`/`await` is promises with the plumbing hidden. An `async` function always returns a promise; `await` pauses that function until a promise settles, then gives you the value or throws the reason. Nothing new is happening underneath — it is the same promise, read top to bottom.',
    ),

    h('The two keywords'),
    code(
      js(`
// run: node await.js
async function getTaskCount(userId) {
  const user = await findUser(userId);      // pause here, resume with the value
  const tasks = await findTasks(user.id);
  return tasks.length;                      // becomes Promise<number>
}

// An async function ALWAYS returns a promise, even returning a plain number.
getTaskCount(1);            // Promise { <pending> }
await getTaskCount(1);      // 3
`),
    ),
    table(
      ['Written', 'Means'],
      [
        ['`return 5` in an async function', 'The promise fulfils with `5`'],
        ['`throw err` in an async function', 'The promise rejects with `err`'],
        ['`await promise`', 'Pause; resume with the value, or throw the reason'],
        ['`await 5`', 'Legal — non-promises are wrapped, and you still wait one microtask'],
      ],
    ),

    h('await does not block the event loop'),
    p(
      'This is the point people get wrong, and it is the most important sentence on this page. `await` suspends **the function you are in**, not the thread. Node registers the continuation as a microtask and goes straight back to the event loop to handle other requests. Ten thousand suspended handlers cost ten thousand small objects, not ten thousand threads.',
    ),
    code(
      js(`
app.get('/tasks', async (req, res) => {
  const rows = await db.query('select * from tasks');  // this request waits
  res.json(rows);                                      // other requests do not
});
`),
    ),
    warn(
      'What *does* block is synchronous work: a big `JSON.parse`, a `for` loop over a million rows, `bcrypt.hashSync`, `fs.readFileSync`. `await` cannot help with those, because there is nothing to wait for — the CPU is busy. That is the `blocking-the-event-loop` topic later in this track.',
    ),

    h('Errors'),
    p(
      'Because `await` throws, ordinary `try/catch` finally works on asynchronous code — the thing callbacks could not do.',
    ),
    code(
      js(`
async function loadTask(id) {
  try {
    return await findTask(id);
  } catch (err) {
    if (err.code === 'ENOTFOUND') return null;
    throw err;                       // rethrow what you cannot handle
  } finally {
    metrics.increment('task.load');  // runs on both paths
  }
}
`),
    ),
    tip(
      'Note `return await findTask(id)` rather than `return findTask(id)` inside a `try`. Without the `await`, the promise is returned before it rejects, the `try` block has already exited, and your `catch` never runs. Outside a `try/catch` the `await` is redundant and you can drop it.',
    ),

    h('The serial loop'),
    p(
      'The single most common performance bug in Node code. Each iteration waits for the last, so 50 independent 100 ms calls take 5 seconds instead of 100 ms.',
    ),
    code(
      js(`
// Serial — 50 x 100ms = 5000ms
const results = [];
for (const id of ids) {
  results.push(await fetchOne(id));
}

// Parallel — ~100ms
const results2 = await Promise.all(ids.map(id => fetchOne(id)));
`),
    ),
    p('Serial is sometimes what you want. Choose it on purpose, not by accident:'),
    table(
      ['Use serial when', 'Use parallel when'],
      [
        ['Each step needs the previous result', 'The calls are independent'],
        ['You are rate-limited by the other side', 'The other side can take the load'],
        ['Order of writes matters', 'You only need all the results'],
        ['A million items would blow memory', 'The list is bounded and small'],
      ],
    ),
    note(
      'For a large list that is independent but too big to fire at once, you want bounded concurrency — a pool of N in flight. That is in `promise-combinators`, the next topic.',
    ),

    h('Two awaits that should have been one'),
    code(
      js(`
// Sequential: 200ms total, for no reason.
const user = await fetchUser(id);
const settings = await fetchSettings(id);

// Concurrent: 100ms. Both requests start before either is awaited.
const [user2, settings2] = await Promise.all([fetchUser(id), fetchSettings(id)]);
`),
    ),

    h('Top-level await'),
    p(
      'Legal at the top level of an ES module — a `.mjs` file, or any file in a package with `"type": "module"`. Not available in CommonJS, which is one of the concrete reasons to prefer ESM for new services.',
    ),
    code(
      js(`
// config.js, in an ESM project
const raw = await readFile('./config.json', 'utf8');
export const config = JSON.parse(raw);
`),
    ),
    warn(
      'A module doing top-level await delays every module that imports it. Fine for reading a config at boot; not fine for a network call that might hang, because your process will never finish starting and never tell you why.',
    ),

    h('async in array callbacks'),
    code(
      js(`
// forEach ignores the returned promises entirely — errors vanish, nothing waits.
items.forEach(async (i) => { await save(i); });
console.log('done');                    // lies

// for...of awaits properly, one at a time.
for (const i of items) await save(i);

// map + Promise.all awaits properly, all at once.
await Promise.all(items.map(i => save(i)));
`),
    ),

    h('Cheatsheet'),
    cheat([
      ['Wait for one thing', '`await promise`'],
      ['Wait for several independent things', '`await Promise.all([...])`'],
      ['Handle an async error', '`try/catch` around the `await`'],
      ['Catch an error from a returned promise', '`return await` inside the `try`'],
      ['Loop and wait one at a time', '`for (const x of xs) await f(x)`'],
      ['Loop in parallel', '`await Promise.all(xs.map(f))`'],
      ['Never use', '`forEach` with an async callback'],
    ]),

    h('Interview'),
    asked([
      ['Does `await` block the event loop?', 'No — it suspends that one function; the loop carries on with other work.'],
      ['What does an async function return?', 'Always a promise, even if the body returns a plain value.'],
      ['Why is my loop with `await` slow?', 'Each iteration waits for the last. Use `Promise.all` when the calls are independent.'],
      ['`return` vs `return await` inside try/catch?', 'Without `await` the promise leaves the `try` before it rejects, so the `catch` never fires.'],
      ['Can you use `await` in `forEach`?', 'No — `forEach` discards the promises. Use `for...of` or `Promise.all(map(...))`.'],
      ['What is top-level await?', 'Awaiting at module scope, ESM only, and it delays every importer of that module.'],
    ]),

    links(
      mdn('Web/JavaScript/Reference/Statements/async_function', 'async function'),
      mdn('Web/JavaScript/Reference/Operators/await', 'await'),
      mdn('Web/JavaScript/Guide/Using_promises', 'Using promises'),
    ),
  ],
};
