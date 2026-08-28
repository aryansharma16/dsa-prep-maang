import { asked, cheat, code, h, js, links, nodeDoc, note, p, sig, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      '`EventEmitter` is the publish/subscribe primitive most of Node is built on. An HTTP server, a socket, a stream, a child process and the `process` object are all emitters — so learning the six methods below is how you read the standard library, not just how you write your own events.',
    ),

    h('The API'),
    sig([
      ['`on(event, fn)`', '→ `this`', 'Listen every time. Aliased as `addListener`.'],
      ['`once(event, fn)`', '→ `this`', 'Listen once, then remove automatically.'],
      ['`emit(event, ...args)`', '→ `boolean`', 'Call every listener **synchronously**, in order. `false` if there were none.'],
      ['`off(event, fn)`', '→ `this`', 'Remove one listener. Needs the *same function reference*.'],
      ['`removeAllListeners(event)`', '→ `this`', 'Remove all of them.'],
      ['`listenerCount(event)`', '→ `number`', 'How many are attached — useful for leak checks.'],
    ]),
    code(
      js(`
// run: node emitter.js
import { EventEmitter } from 'node:events';

const bus = new EventEmitter();

bus.on('task:created', (task) => console.log('created', task.id));
bus.on('task:created', (task) => search.index(task));   // several listeners, in order
bus.once('ready', () => console.log('only once'));

bus.emit('task:created', { id: 7 });
bus.emit('ready');
bus.emit('ready');        // nothing — the once listener is gone
`),
    ),

    h('emit is synchronous'),
    p(
      'This surprises people who expect an event bus to be a queue. `emit` calls every listener in order, right now, on the current stack, and only returns when the last one has finished.',
    ),
    code(
      js(`
bus.on('x', () => console.log('listener'));
console.log('before');
bus.emit('x');
console.log('after');

// before
// listener
// after
`),
    ),
    warn(
      'So a slow listener blocks the emitter, and a listener that throws propagates the exception up through `emit` into the caller. An event bus is not a queue and does not decouple you in time — it decouples you in *code*.',
    ),
    code(
      js(`
// If a listener must not block the emitter:
bus.on('task:created', (task) => {
  setImmediate(() => slowWork(task));
});

// If the work must survive a crash, it is not an event — it is a job.
bus.on('task:created', (task) => queue.add('index-task', { id: task.id }));
`),
    ),

    h('The error event'),
    p(
      '`error` is special-cased. Emitting it with no listener attached **throws**, which by default takes the process down.',
    ),
    code(
      js(`
const bus = new EventEmitter();
bus.emit('error', new Error('boom'));   // Uncaught Error: boom — process dies

bus.on('error', (err) => log.error({ err }));
bus.emit('error', new Error('boom'));   // handled
`),
    ),
    tip(
      'This is deliberate: an error nobody is listening for is a bug, and failing loudly beats failing silently. It is also why every stream in your codebase needs an error handler — streams are emitters, and this rule applies to all of them.',
    ),

    h('Extending it'),
    code(
      js(`
class JobRunner extends EventEmitter {
  async run(job) {
    this.emit('start', job);
    try {
      const result = await job.execute();
      this.emit('done', job, result);
      return result;
    } catch (err) {
      // Only safe because we know a listener exists — otherwise this throws.
      if (this.listenerCount('error')) this.emit('error', err, job);
      throw err;
    }
  }
}

const runner = new JobRunner();
runner.on('start', (job) => log.info({ jobId: job.id }, 'starting'));
runner.on('error', (err, job) => log.error({ err, jobId: job.id }));
`),
    ),
    warn(
      'Never `emit` from a constructor. The object is not returned yet, so no caller has had a chance to attach a listener and the event is lost. Defer it with `process.nextTick(() => this.emit("ready"))`.',
    ),

    h('The listener leak'),
    p(
      'The most common real bug with emitters. Node warns after 11 listeners on one event — not because 11 is too many, but because a growing count almost always means you are adding in a loop and never removing.',
    ),
    code(
      js(`
// MaxListenersExceededWarning after 11 requests.
app.get('/watch', (req, res) => {
  bus.on('update', (data) => res.write(JSON.stringify(data)));
});

// Fixed: name it, and remove it when the request ends.
app.get('/watch', (req, res) => {
  const onUpdate = (data) => res.write(JSON.stringify(data));
  bus.on('update', onUpdate);
  res.on('close', () => bus.off('update', onUpdate));
});
`),
    ),
    code(
      js(`
// Simpler still — an AbortSignal removes the listener for you.
const ac = new AbortController();
bus.on('update', onUpdate, { signal: ac.signal });
res.on('close', () => ac.abort());
`),
    ),
    table(
      ['Symptom', 'Check'],
      [
        ['`MaxListenersExceededWarning`', '`emitter.listenerCount(event)` over time'],
        ['Memory grows with request count', 'Listeners added per request, never removed'],
        ['`off()` appears to do nothing', 'You passed a different function — a fresh arrow or a new `.bind()`'],
      ],
    ),
    tip(
      'Raising `setMaxListeners` to silence the warning is almost always the wrong fix. The warning is usually correct. Raise it only when you genuinely have many long-lived subscribers, and then set it on that one emitter, not globally.',
    ),

    h('Promise helpers'),
    code(
      js(`
import { once, on } from 'node:events';

// Wait for a single event as a promise. Rejects if 'error' fires first.
const [data] = await once(bus, 'ready');
await once(server, 'listening');

// Iterate a stream of events.
for await (const [chunk] of on(readable, 'data')) {
  process(chunk);
}
`),
    ),
    note(
      '`events.once` is the clean way to await something event-based — a server listening, a child process exiting, a socket connecting. It handles the `error` case for you, which the hand-rolled `new Promise` wrapper usually forgets.',
    ),

    h('Where Node uses it'),
    table(
      ['Object', 'Events you will handle'],
      [
        ['`http.Server`', '`request`, `listening`, `close`, `error`'],
        ['Streams', '`data`, `end`, `error`, `finish`, `close`, `drain`'],
        ['`req` / `res`', '`close`, `aborted`, `finish`'],
        ['`process`', '`SIGTERM`, `exit`, `uncaughtException`, `unhandledRejection`'],
        ['`ChildProcess`', '`exit`, `close`, `message`, `error`'],
        ['Database pools', '`connect`, `error`, `remove`'],
      ],
    ),

    h('Cheatsheet'),
    cheat([
      ['Subscribe', '`emitter.on(event, fn)`'],
      ['Subscribe once', '`emitter.once(event, fn)`'],
      ['Await one event', '`await once(emitter, "ready")`'],
      ['Unsubscribe', '`off` with the *same reference*, or an `AbortSignal`'],
      ['Stop a slow listener blocking', '`setImmediate` inside it'],
      ['Emit from a constructor', 'Defer with `process.nextTick`'],
      ['Avoid crashing on `error`', 'Always attach an `error` listener'],
      ['Diagnose a leak', '`listenerCount(event)` over time'],
    ]),

    h('Interview'),
    asked([
      ['Is `emit` synchronous?', 'Yes — every listener runs in order on the current stack before `emit` returns.'],
      ['What is special about the `error` event?', 'Emitting it with no listener throws and crashes the process.'],
      ['What causes `MaxListenersExceededWarning`?', 'Listeners added repeatedly — usually per request — and never removed.'],
      ['Why does `off()` sometimes not remove a listener?', 'It matches by reference; a fresh arrow or a new `.bind()` is a different function.'],
      ['Where does Node use EventEmitter internally?', 'Servers, sockets, streams, `process`, child processes — most of the async standard library.'],
      ['Event emitter or a queue?', 'An emitter is in-process and synchronous; anything that must survive a restart belongs in a queue.'],
    ]),

    links(
      nodeDoc('events.html', 'Events'),
      nodeDoc('events.html#error-events', 'Error events'),
      nodeDoc('events.html#eventsonceemitter-name-options', 'events.once'),
    ),
  ],
};
