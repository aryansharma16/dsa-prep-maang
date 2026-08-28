import { asked, cheat, code, h, js, link, links, nodeDoc, note, p, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Backpressure is what happens when the producer is faster than the consumer. Reading a file from a local SSD at 2 GB/s and uploading it over a 10 MB/s connection means the difference has to go **somewhere** — and if nobody is applying backpressure, that somewhere is your process memory, until it is killed.',
    ),

    h('Seeing it'),
    code(
      js(`
// run: node leak.js — watch RSS climb
const rs = createReadStream('10gb.bin');
const ws = createWriteStream('/dev/slow-disk/copy.bin');

rs.on('data', (chunk) => {
  ws.write(chunk);            // return value IGNORED — this is the bug
});
`),
    ),
    p(
      '`ws.write()` returns `false` when its internal buffer is over the high-water mark: "I have taken this chunk, but stop sending". Ignoring that return value means the reader keeps pushing at full speed, the writer keeps queuing, and every unwritten chunk stays in memory. RSS climbs until the process is OOM-killed.',
    ),

    h('The mechanism'),
    table(
      ['Signal', 'Means'],
      [
        ['`write()` returns `true`', 'Buffer is below the high-water mark — keep going'],
        ['`write()` returns `false`', '**Stop.** Wait before writing more'],
        ['The `drain` event', 'The buffer has emptied — resume writing'],
        ['`readable.pause()`', 'Stop emitting `data`'],
        ['`readable.resume()`', 'Start again'],
      ],
    ),
    p(
      'The default high-water mark is 64 KB for byte streams and 16 objects in object mode. It is not a hard limit — it is the threshold at which the stream starts telling you to slow down.',
    ),

    h('Handling it by hand'),
    code(
      js(`
// What correct manual backpressure looks like.
rs.on('data', (chunk) => {
  if (!ws.write(chunk)) {
    rs.pause();                          // stop reading
    ws.once('drain', () => rs.resume()); // resume when the writer has caught up
  }
});
rs.on('end', () => ws.end());
`),
    ),
    p('That is four lines you should almost never write, because two APIs do it for you:'),
    code(
      js(`
// pipe handles backpressure — but not errors, and it does not clean up.
rs.pipe(ws);

// pipeline handles backpressure AND errors AND cleanup, and it is awaitable.
import { pipeline } from 'node:stream/promises';
await pipeline(rs, ws);

// for await handles backpressure too — the loop body is the throttle.
for await (const chunk of rs) {
  await save(chunk);        // the read stream cannot outrun this
}
`),
    ),
    tip(
      'The one-line summary of this whole topic: **use `pipeline`**. It is the only API that gets backpressure, error propagation and resource cleanup all correct, and it is the reason you rarely have to think about any of them.',
    ),

    h('Where it breaks anyway'),
    p('Three patterns that silently opt out of backpressure even when the rest of your code is correct.'),
    code(
      js(`
// 1. An async callback inside a 'data' handler. The stream does not know
//    about the promise, so it keeps emitting while you are still awaiting.
rs.on('data', async (chunk) => { await db.insert(chunk); });   // unbounded

// Fix: for await, which does respect the await.
for await (const chunk of rs) { await db.insert(chunk); }
`),
    ),
    code(
      js(`
// 2. Collecting everything "just to parse it". This is buffering with
//    extra steps — the memory profile is identical to readFile.
const chunks = [];
for await (const c of rs) chunks.push(c);
const all = Buffer.concat(chunks);
`),
    ),
    code(
      js(`
// 3. A Transform that pushes more than it receives, with no regard for
//    the return value of push().
transform(chunk, enc, cb) {
  for (const row of expand(chunk)) this.push(row);   // may exceed the mark
  cb();
}
`),
    ),

    h('In an HTTP server'),
    p(
      'This is where backpressure stops being theoretical. `res` is a Writable, and a slow client is a slow consumer — one that an attacker can be deliberately.',
    ),
    code(
      js(`
// A slow reader makes this hold the whole result set in memory.
app.get('/export', async (req, res) => {
  for (const row of await db.allRows()) res.write(toCsv(row));
  res.end();
});

// Backpressure respected end to end: the database is only read as fast
// as the client can accept.
app.get('/export', async (req, res) => {
  res.setHeader('Content-Type', 'text/csv');
  await pipeline(db.queryStream('select * from events'), toCsvTransform(), res);
});
`),
    ),
    warn(
      'This is a real denial-of-service vector — a "slow read" attack. A handful of clients that open a large export and then read one byte per second can pin gigabytes of your memory. Streaming with real backpressure is the defence, because a client that will not read is a client you stop producing for.',
    ),

    h('Tuning the high-water mark'),
    code(
      js(`
createReadStream('big.bin', { highWaterMark: 1024 * 1024 });   // 1 MB chunks
new Transform({ highWaterMark: 100, objectMode: true });        // 100 objects
`),
    ),
    note(
      'Raising it trades memory for fewer, larger syscalls — sometimes worth it for large sequential file copies. Lowering it reduces memory per connection, which matters when you have thousands. Measure before changing it; the default is a good default.',
    ),

    h('Diagnosing'),
    code(
      js(`
// Is the writer falling behind?
console.log(ws.writableLength, ws.writableHighWaterMark);   // queued vs limit
console.log(ws.writableNeedDrain);                           // true = it said stop

// Is memory climbing under load but the heap looks fine?
process.memoryUsage();   // 'external' climbing = buffered Buffers
`),
    ),

    h('Cheatsheet'),
    cheat([
      ['Copy or pipe anything', '`await pipeline(a, b, c)`'],
      ['Consume a stream with async work', '`for await`, awaiting inside'],
      ['Never ignore', 'The return value of `write()`'],
      ['Resume after a `false`', 'Wait for `drain`'],
      ['Stream a big HTTP response', '`await pipeline(source, res)`'],
      ['See if a writer is behind', '`ws.writableLength`'],
      ['Diagnose growing memory with a flat heap', 'Buffered stream chunks — `external` in `memoryUsage()`'],
    ]),

    h('Interview'),
    asked([
      ['What is backpressure?', 'The consumer signalling the producer to slow down, so the difference in speed does not accumulate in memory.'],
      ['How does a Writable signal it?', '`write()` returns `false`; you resume when it emits `drain`.'],
      ['What happens if you ignore it?', 'Chunks queue in memory unbounded until the process is OOM-killed.'],
      ['Does `pipe` handle backpressure?', 'Yes — but not errors or cleanup, which is why `pipeline` is preferred.'],
      ['Why is an async `data` handler wrong?', 'The stream does not await your promise, so it keeps emitting while you are still working.'],
      ['How does this relate to a slow client?', 'A slow reader is a slow consumer; without backpressure a few of them can exhaust your memory deliberately.'],
    ]),

    links(
      link(
        'Backpressuring in streams',
        'https://nodejs.org/en/learn/modules/backpressuring-in-streams',
      ),
      nodeDoc('stream.html#buffering', 'Stream buffering'),
      nodeDoc('stream.html#writablewritechunk-encoding-callback', 'writable.write'),
    ),
  ],
};
