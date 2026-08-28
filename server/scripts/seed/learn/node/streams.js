import { asked, cheat, code, h, js, links, nodeDoc, note, p, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'A stream processes data **in pieces** instead of all at once. The memory a stream uses is the size of one chunk, not the size of the data — so the same code that copies a 1 KB file copies a 100 GB one, and an HTTP response can start arriving before the source has finished producing it.',
    ),
    code(
      js(`
// Reads the whole file into memory. 2 GB file -> 2 GB of RAM -> crash.
const data = await readFile('huge.csv');
await writeFile('copy.csv', data);

// Constant memory, whatever the size.
await pipeline(
  createReadStream('huge.csv'),
  createWriteStream('copy.csv'),
);
`),
    ),

    h('The four types'),
    table(
      ['Type', 'Does', 'Examples'],
      [
        ['**Readable**', 'Produces data', '`fs.createReadStream`, an HTTP request, `process.stdin`'],
        ['**Writable**', 'Consumes data', '`fs.createWriteStream`, an HTTP response, `process.stdout`'],
        ['**Duplex**', 'Both, independently', 'A TCP socket'],
        ['**Transform**', 'A Duplex where output derives from input', '`zlib.createGzip()`, a CSV parser, a cipher'],
      ],
    ),

    h('Reading'),
    p('Three ways, in order of preference:'),
    code(
      js(`
// 1. Async iteration — the modern default. Backpressure is handled for you.
for await (const chunk of createReadStream('a.txt', { encoding: 'utf8' })) {
  process(chunk);
}

// 2. Piping into something else.
createReadStream('a.txt').pipe(process.stdout);

// 3. Events — what the others are built on.
const rs = createReadStream('a.txt');
rs.on('data', (chunk) => process(chunk));
rs.on('end', () => console.log('done'));
rs.on('error', (err) => console.error(err));    // NEVER omit this
`),
    ),
    warn(
      'An unhandled `error` event on a stream throws as an uncaught exception and kills the process. Every stream needs an error handler — which is the main reason to use `pipeline` over `pipe`, since it attaches them for you.',
    ),

    h('pipe vs pipeline'),
    code(
      js(`
// pipe: does NOT forward errors, and does not clean up the other streams.
// If the gzip step fails, the read stream is left open — a file descriptor leak.
createReadStream('a.txt')
  .pipe(createGzip())
  .pipe(createWriteStream('a.txt.gz'));

// pipeline: propagates errors, destroys every stream on failure, and awaits.
import { pipeline } from 'node:stream/promises';

await pipeline(
  createReadStream('a.txt'),
  createGzip(),
  createWriteStream('a.txt.gz'),
);
`),
    ),
    tip(
      'Use `pipeline` from `node:stream/promises` for every multi-stage stream. `pipe` is fine for a single hop where you already handle errors, and nowhere else.',
    ),

    h('Writing a Transform'),
    p(
      'The stream you will actually write yourself: take a chunk, change it, push it on.',
    ),
    code(
      js(`
import { Transform } from 'node:stream';

const upperCase = new Transform({
  transform(chunk, encoding, callback) {
    callback(null, chunk.toString().toUpperCase());
  },
});

// Line-by-line, holding a partial line between chunks — the classic case.
const toLines = new Transform({
  readableObjectMode: true,
  transform(chunk, _enc, cb) {
    this.buffer = (this.buffer ?? '') + chunk;
    const lines = this.buffer.split('\\n');
    this.buffer = lines.pop();              // keep the incomplete last line
    for (const line of lines) this.push(line);
    cb();
  },
  flush(cb) {                                // called once at the end
    if (this.buffer) this.push(this.buffer);
    cb();
  },
});
`),
    ),
    note(
      'The `flush` hook exists precisely for that leftover. Forgetting it silently drops the last line of every file that does not end in a newline — a bug that survives testing because most files do.',
    ),
    code(
      js(`
// Or, more simply, an async generator — no class needed.
async function* upper(source) {
  for await (const chunk of source) yield chunk.toString().toUpperCase();
}

await pipeline(createReadStream('a.txt'), upper, createWriteStream('b.txt'));
`),
    ),

    h('Object mode'),
    p(
      'By default streams carry Buffers or strings. In object mode each chunk is any JavaScript value — which is how you stream database rows or parsed records through the same machinery.',
    ),
    code(
      js(`
// Stream 10 million rows into a CSV file, at constant memory.
await pipeline(
  pgQueryStream('select * from events'),        // objectMode: rows
  new Transform({
    writableObjectMode: true,
    transform(row, _enc, cb) { cb(null, \`\${row.id},\${row.name}\\n\`); },
  }),
  createWriteStream('events.csv'),
);
`),
    ),

    h('HTTP is streams'),
    p(
      'This is the part that makes streams feel less abstract: in Node, `req` is a Readable and `res` is a Writable. You have been using streams since your first server.',
    ),
    code(
      js(`
// Serve a large file without ever holding it.
app.get('/export', async (req, res) => {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=export.csv');
  await pipeline(createReadStream('export.csv'), res);
});

// Accept an upload without holding it either.
app.put('/upload', async (req, res) => {
  await pipeline(req, createWriteStream('./uploads/incoming'));
  res.status(201).end();
});
`),
    ),
    tip(
      'Streaming a download also fixes time-to-first-byte. The client starts receiving immediately instead of waiting for you to build the whole response — and a proxy in between will not time out on a slow-but-progressing response.',
    ),

    h('Web streams'),
    p(
      'Node also supports the standard `ReadableStream` from the browser, which is what `fetch` responses use. `Stream.Readable.fromWeb` and `.toWeb` convert between the two worlds.',
    ),
    code(
      js(`
import { Readable } from 'node:stream';

const res = await fetch(url);
await pipeline(Readable.fromWeb(res.body), createWriteStream('download.bin'));
`),
    ),

    h('Cheatsheet'),
    cheat([
      ['Read a big file', '`createReadStream` + `for await`'],
      ['Connect several stages', '`pipeline` from `node:stream/promises`'],
      ['Transform each chunk', 'An async generator, or a `Transform`'],
      ['Stream a download', '`await pipeline(fileStream, res)`'],
      ['Stream an upload', '`await pipeline(req, fileStream)`'],
      ['Stream database rows', 'Object mode'],
      ['Handle the last partial line', 'The `flush` hook'],
      ['Consume a `fetch` body', '`Readable.fromWeb(res.body)`'],
    ]),

    h('Interview'),
    asked([
      ['Why use a stream instead of reading the whole file?', 'Constant memory, and the first byte is available before the last one is produced.'],
      ['What are the four stream types?', 'Readable, Writable, Duplex, and Transform — a Duplex whose output derives from its input.'],
      ['`pipe` vs `pipeline`?', '`pipe` does not forward errors or clean up on failure; `pipeline` does both and is awaitable.'],
      ['What happens to an unhandled stream `error` event?', 'It throws as an uncaught exception and kills the process.'],
      ['What is object mode?', 'Chunks are arbitrary JavaScript values rather than Buffers — used for rows and parsed records.'],
      ['Where do you already use streams without noticing?', 'Every HTTP request and response — `req` is Readable, `res` is Writable.'],
    ]),

    links(
      nodeDoc('stream.html', 'Stream'),
      nodeDoc('stream.html#streampipelinestreams-options', 'stream.pipeline'),
      nodeDoc('stream.html#object-mode', 'Object mode'),
    ),
  ],
};
