import { asked, cheat, code, h, js, links, nodeDoc, note, p, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'A `Buffer` is a fixed-length chunk of raw bytes, allocated outside V8\'s heap. It exists because JavaScript strings cannot hold arbitrary binary data — a string is text in some encoding, and a PNG is not text in any encoding. Every file read, every socket, every stream chunk in Node is a Buffer until you decide to interpret it.',
    ),
    note(
      'Technically `Buffer` is a subclass of `Uint8Array`, so every typed-array method works on it. Node added the encoding helpers and the pooled allocator on top.',
    ),

    h('Creating one'),
    code(
      js(`
Buffer.from('hello');                    // from a string, utf8 by default
Buffer.from('aGk=', 'base64');           // decode base64
Buffer.from([0x48, 0x69]);               // from byte values
Buffer.alloc(16);                        // 16 zero-filled bytes
Buffer.allocUnsafe(16);                  // faster, contains whatever was there
Buffer.concat([a, b]);                   // join several
`),
    ),
    warn(
      '`allocUnsafe` skips zeroing, so the memory may contain fragments of previously freed data — potentially another request\'s. Only use it when you immediately overwrite every byte. `alloc` is the safe default, and the difference only matters in a hot loop.',
    ),
    warn(
      'The `new Buffer()` constructor is deprecated and removed in recent Node. If you meet it in old code, `new Buffer(50)` allocated *uninitialised* memory while `new Buffer("50")` made a two-byte buffer — an ambiguity that caused real data-leak CVEs.',
    ),

    h('Encodings'),
    p(
      'An encoding is a rule for turning bytes into text and back. Getting it wrong is how `£` becomes `Â£`.',
    ),
    table(
      ['Encoding', 'For'],
      [
        ['`utf8`', 'Text. The default, and what you want almost always.'],
        ['`base64`', 'Binary carried inside JSON or a header. Grows by ~33%.'],
        ['`base64url`', 'The same, safe in URLs and JWTs — `-` and `_`, no padding.'],
        ['`hex`', 'Hashes, signatures. Exactly two characters per byte.'],
        ['`latin1`', 'One byte per character. Some legacy protocols and headers.'],
        ['`ascii`', '7-bit. Rarely what you actually mean.'],
      ],
    ),
    code(
      js(`
const buf = Buffer.from('hi ✓');

buf.length;                    // 6 — BYTES, not characters
buf.toString('utf8');          // 'hi ✓'
buf.toString('hex');           // '686920e29c93'
buf.toString('base64');        // 'aGkg4pyT'
buf.toString('base64url');     // 'aGkg4pyT'

Buffer.byteLength('hi ✓');     // 6  — what a Content-Length header needs
'hi ✓'.length;                 // 4  — what a text box needs
`),
    ),
    tip(
      'That last pair is the practical point of the whole topic. `string.length` counts UTF-16 code units; `Buffer.byteLength` counts bytes on the wire. Use `byteLength` for size limits, `Content-Length`, and anything a database column measures in bytes.',
    ),

    h('Reading and writing'),
    code(
      js(`
const buf = Buffer.alloc(8);

buf.writeUInt32BE(1000, 0);       // 4 bytes, big-endian, at offset 0
buf.writeUInt32BE(2000, 4);
buf.readUInt32BE(0);              // 1000

buf[0];                            // a single byte, 0-255
buf.subarray(0, 4);                // a VIEW — shares memory with buf
Buffer.from(buf.subarray(0, 4));   // a COPY
`),
    ),
    warn(
      '`subarray` (and the deprecated `slice`) returns a view over the same memory, unlike `Array.prototype.slice`. Writing to the view writes to the original. Wrap it in `Buffer.from` when you need an independent copy.',
    ),

    h('Where you actually meet them'),
    code(
      js(`
// 1. Files, with no encoding given.
const png = await readFile('logo.png');           // Buffer
const text = await readFile('a.txt', 'utf8');     // string

// 2. Stream chunks.
const chunks = [];
for await (const chunk of stream) chunks.push(chunk);   // Buffers
const body = Buffer.concat(chunks).toString('utf8');

// 3. Crypto output.
crypto.randomBytes(32).toString('base64url');     // an API key
crypto.createHash('sha256').update(data).digest('hex');

// 4. Uploads — multer gives you a Buffer for in-memory storage.
app.post('/avatar', upload.single('file'), (req, res) => {
  req.file.buffer;      // Buffer
  req.file.size;        // bytes
});
`),
    ),

    h('The multibyte split'),
    p(
      'The subtle stream bug: a chunk boundary can land in the middle of a multi-byte character, so decoding each chunk separately produces a replacement character where a valid one was split in half.',
    ),
    code(
      js(`
const buf = Buffer.from('café');    // 5 bytes — 'é' is two of them

buf.subarray(0, 4).toString('utf8');  // 'caf\\uFFFD'  <- broken
buf.toString('utf8');                  // 'café'

// The fix, if you must decode chunk by chunk:
import { StringDecoder } from 'node:string_decoder';
const decoder = new StringDecoder('utf8');
for await (const chunk of stream) process(decoder.write(chunk));  // holds
process(decoder.end());                                            // partials back
`),
    ),
    tip(
      'You rarely need `StringDecoder` directly. `stream.setEncoding("utf8")` uses it internally, and `for await (const chunk of stream)` on a stream with an encoding set gives you correctly split strings.',
    ),

    h('Memory'),
    p(
      'Buffers are allocated outside the V8 heap, so they show up under `external` in `process.memoryUsage()` and are **not** limited by `--max-old-space-size`. A Buffer leak therefore does not look like a heap leak, which is why it takes people longer to find.',
    ),
    code(
      js(`
const { heapUsed, external, arrayBuffers } = process.memoryUsage();
`),
    ),
    warn(
      'The reason to stream instead of buffering is exactly this. Ten concurrent 200 MB uploads read with `readFile` is 2 GB of external memory and an OOM kill. The same ten as streams is a few megabytes.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Make a buffer from text', '`Buffer.from(str)`'],
      ['Make an empty one', '`Buffer.alloc(n)` — never `allocUnsafe` unless you overwrite it'],
      ['Buffer to text', '`buf.toString("utf8")`'],
      ['Binary inside JSON', '`buf.toString("base64")`'],
      ['Binary in a URL or JWT', '`base64url`'],
      ['Byte length of a string', '`Buffer.byteLength(str)` — not `str.length`'],
      ['Join stream chunks', '`Buffer.concat(chunks)`'],
      ['Compare two secrets', '`crypto.timingSafeEqual(a, b)`'],
      ['Avoid holding a big file', 'Stream it'],
    ]),

    h('Interview'),
    asked([
      ['What is a Buffer?', 'A fixed-length array of raw bytes outside the V8 heap — a `Uint8Array` subclass with encoding helpers.'],
      ['Why does Node need Buffers?', 'JavaScript strings cannot represent arbitrary binary data; files and sockets are bytes.'],
      ['`alloc` vs `allocUnsafe`?', '`alloc` zero-fills; `allocUnsafe` is faster but can expose previously freed memory.'],
      ['`str.length` vs `Buffer.byteLength(str)`?', 'UTF-16 code units versus actual bytes — they differ for any non-ASCII text.'],
      ['Why can a chunked stream produce broken characters?', 'A chunk boundary can split a multi-byte UTF-8 character; `StringDecoder` buffers the partial.'],
      ['Do Buffers count against the V8 heap limit?', 'No — they are external memory, which is why a Buffer leak does not look like a heap leak.'],
    ]),

    links(
      nodeDoc('buffer.html', 'Buffer'),
      nodeDoc('buffer.html#buffers-and-character-encodings', 'Buffers and character encodings'),
      nodeDoc('string_decoder.html', 'StringDecoder'),
    ),
  ],
};
