import { asked, cheat, code, h, js, link, links, nodeDoc, note, p, table, tip, ul, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'The sentence "Node is single-threaded" is half of a true statement. **Your JavaScript** runs on one thread. The process it runs in has several more — a thread pool for work the OS cannot do asynchronously, and V8\'s own threads for garbage collection and compilation. Understanding which work goes where is what makes the performance topics later make sense.',
    ),

    h('The layers'),
    code(
      js(`
       ┌─────────────────────────────────────────────┐
       │   Your JavaScript  (ONE thread)             │
       │   routes, handlers, business logic          │
       └──────────────┬──────────────────────────────┘
                      │  fs.readFile(), pool.query(), crypto.hash()
       ┌──────────────▼──────────────────────────────┐
       │   Node bindings  (C++)                      │
       │   translate a JS call into a libuv request  │
       └──────────────┬──────────────────────────────┘
                      │
       ┌──────────────▼──────────────────────────────┐
       │   libuv                                      │
       │                                              │
       │   EVENT LOOP  ──▶ epoll / kqueue / IOCP      │  network: OS does the waiting
       │        │                                     │
       │        └──────▶ THREAD POOL (4 by default)   │  files, dns, crypto, zlib
       └──────────────┬──────────────────────────────┘
                      │  result ready -> callback queued
                      ▼
              back to your JavaScript, on the one thread
`),
    ),

    h('Two different kinds of "async"'),
    p(
      'This is the distinction almost nobody makes, and it is the one that explains the performance surprises.',
    ),
    table(
      ['Work', 'Handled by', 'Scales to'],
      [
        ['**Network I/O** — sockets, HTTP, database queries', 'The OS, via epoll/kqueue/IOCP. **No thread is used.**', 'Tens of thousands of concurrent connections'],
        ['**File I/O**', 'The libuv thread pool — 4 threads by default', 'Four at a time; the fifth queues'],
        ['**`crypto.pbkdf2`, `bcrypt`, `zlib`, `dns.lookup`**', 'The same thread pool', 'Four at a time'],
        ['**Your JavaScript**', 'The single main thread', 'One thing at a time, always'],
      ],
    ),
    note(
      'So "Node handles 10,000 connections on one thread" is true because sockets never touch the pool. The OS keeps a readiness list and tells the loop which of them have data. Nothing is waiting *for* them.',
    ),
    warn(
      'The pool is why four concurrent `bcrypt.hash` calls are fast and the fifth waits. `UV_THREADPOOL_SIZE` can raise it (up to 1024), but it must be set before the first async call — usually as an environment variable, not in code.',
    ),
    code(
      js(`
// package.json
"scripts": { "start": "UV_THREADPOOL_SIZE=8 node src/index.js" }

// Check what it is doing:
console.log(require('node:os').cpus().length);
`),
    ),

    h('How one thread serves many requests'),
    p('Follow a single request through the whole machine:'),
    ul(
      '**1.** A socket becomes readable. The OS knows; libuv asks it for the list of ready descriptors.',
      '**2.** The loop invokes your handler on the main thread. It runs synchronously — nothing else can happen during it.',
      '**3.** The handler hits `await pool.query(...)`. Node hands the query to the socket layer and **the function suspends**. The main thread is free again.',
      '**4.** The loop picks up the next ready socket — another request entirely — and runs its handler.',
      '**5.** Postgres answers. That socket becomes readable, the continuation is queued, and on the next turn your handler resumes exactly where it stopped.',
    ),
    p(
      'At step 3, nothing is blocked and no thread is held. A thousand requests can be sitting at step 3 at once, and the cost of each is one small object on the heap.',
    ),

    h('What breaks the model'),
    code(
      js(`
// run: node block.js, then curl two endpoints at once
app.get('/fast', (req, res) => res.json({ ok: true }));

app.get('/slow', (req, res) => {
  let total = 0;
  for (let i = 0; i < 5e9; i++) total += i;   // ~5 seconds of pure CPU
  res.json({ total });
});
`),
    ),
    p(
      'Call `/slow`, then call `/fast`. `/fast` does not answer for five seconds. There is no queue jumping, no preemption — the loop cannot run anything until the `for` loop returns. One user just took the whole service down.',
    ),
    tip(
      'The fixes, in order of preference: do less work; move it off-process (a queue and a worker); move it off-thread (`worker_threads`); or, as a last resort, break it into chunks with `setImmediate` between them so the loop can breathe.',
    ),

    h('Threads that exist and are not yours'),
    ul(
      '**The main thread** — your JavaScript, plus the event loop itself.',
      '**The libuv thread pool** — 4 by default, for file, DNS, some crypto and zlib work.',
      '**V8 threads** — garbage collection, background compilation. Invisible, but they are why GC does not always stall everything.',
      '**Worker threads** — only if you create them. Each is a separate V8 isolate with its *own* event loop, not a shared-memory thread in the Java sense.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Serve many concurrent connections', 'Nothing to do — that is the default'],
      ['Understand why a slow query is fine', 'Sockets use the OS, not a thread'],
      ['Understand why 5 bcrypt calls queue', 'A 4-thread pool does that work'],
      ['Raise the pool size', '`UV_THREADPOOL_SIZE`, before the first async call'],
      ['Stop CPU work stalling requests', 'A queue and a worker process, or `worker_threads`'],
      ['See if the loop is stalling', 'Measure event loop lag — `perf_hooks.monitorEventLoopDelay`'],
    ]),

    h('Interview'),
    asked([
      ['If Node is single-threaded, how does it serve thousands of connections?', 'Sockets are watched by the OS through epoll/kqueue; no thread waits on any of them.'],
      ['Which operations use the libuv thread pool?', 'File I/O, `dns.lookup`, `zlib` and some `crypto` — not network sockets.'],
      ['How big is the thread pool and can you change it?', 'Four by default; `UV_THREADPOOL_SIZE` raises it up to 1024, set before the first async call.'],
      ['What happens when a request does heavy CPU work?', 'It blocks the main thread and every other request waits for it to finish.'],
      ['How do you handle CPU-bound work in Node?', 'Offload it — a background worker via a queue, or `worker_threads` for in-process parallelism.'],
      ['Is Node multi-threaded?', 'The process is; your JavaScript is not. One JS thread, a thread pool, and V8\'s own threads.'],
    ]),

    links(
      nodeDoc('cli.html#uv_threadpool_sizesize', 'UV_THREADPOOL_SIZE'),
      link('libuv design overview', 'https://docs.libuv.org/en/v1.x/design.html'),
      nodeDoc('worker_threads.html', 'worker_threads'),
    ),
  ],
};
