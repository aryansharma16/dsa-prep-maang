import { asked, cheat, code, h, js, links, nodeDoc, note, p, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Node ships a standard library that covers more than people expect. Knowing what is already there is the cheapest dependency reduction available — a `uuid` package, a `dotenv`, a `rimraf` and a test runner are all in the box now.',
    ),

    h('The map'),
    table(
      ['Module', 'For', 'Covered in'],
      [
        ['`node:fs` / `node:fs/promises`', 'Files and directories', 'Its own topic'],
        ['`node:path`', 'Building and parsing file paths', '`paths-and-directories`'],
        ['`node:http` / `node:https`', 'Servers and clients', 'The HTTP section'],
        ['`node:stream`', 'Data in pieces', '`streams`'],
        ['`node:buffer`', 'Binary data', '`buffers`'],
        ['`node:events`', '`EventEmitter`', '`event-emitter`'],
        ['`node:crypto`', 'Hashing, HMAC, random, encryption', 'Below'],
        ['`node:url`', 'Parsing and building URLs', 'Below'],
        ['`node:os`', 'CPU count, memory, platform, tmpdir', 'Below'],
        ['`node:util`', 'promisify, parseArgs, inspect, deprecate', 'Below'],
        ['`node:child_process`', 'Running other programs', 'Pass 2'],
        ['`node:worker_threads`', 'CPU work off the main thread', 'Pass 2'],
        ['`node:test`', 'The built-in test runner', 'Pass 2'],
        ['`node:zlib`', 'gzip, brotli', ''],
        ['`node:perf_hooks`', 'Timing and event-loop lag', '`blocking-the-event-loop`'],
        ['`node:async_hooks`', '`AsyncLocalStorage` for request context', 'Logging, in pass 2'],
      ],
    ),

    h('crypto'),
    p(
      'The one to know. It covers ids, hashing, signing and randomness, and it is where a surprising number of dependencies become unnecessary.',
    ),
    code(
      js(`
import crypto from 'node:crypto';

// Ids — this replaces the 'uuid' package entirely.
crypto.randomUUID();                                  // 'a3f1c8...'

// A random token for a password reset or an API key.
crypto.randomBytes(32).toString('hex');               // 64 hex chars
crypto.randomBytes(32).toString('base64url');         // URL-safe

// A hash — for content addressing, ETags, cache keys. NOT for passwords.
crypto.createHash('sha256').update(body).digest('hex');

// An HMAC — verifying a webhook signature.
const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

// Comparing secrets: constant time, so the comparison cannot be timed.
crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
`),
    ),
    warn(
      'Never hash a password with `createHash`. SHA-256 is designed to be fast, which is exactly wrong for passwords — a GPU tries billions per second. Use `bcrypt`, `argon2`, or the built-in `crypto.scrypt`. That is the `passwords` topic.',
    ),
    tip(
      '`===` on a signature leaks information: it returns as soon as two bytes differ, so the time it takes reveals how much of the guess was right. `timingSafeEqual` always compares the whole buffer. Use it for webhook signatures, API keys and reset tokens.',
    ),

    h('url'),
    code(
      js(`
const url = new URL('https://api.test:8443/v1/tasks?done=true&tag=api#top');

url.protocol;    // 'https:'
url.hostname;    // 'api.test'
url.port;        // '8443'
url.pathname;    // '/v1/tasks'
url.searchParams.get('done');       // 'true'
url.searchParams.getAll('tag');     // ['api']
url.hash;        // '#top'

// Building one safely — every value is encoded for you.
const target = new URL('/search', 'https://api.test');
target.searchParams.set('q', 'a b&c');
target.toString();       // 'https://api.test/search?q=a+b%26c'
`),
    ),
    note(
      'The old `url.parse()` is deprecated and has known parsing differences that have caused security bugs. Use the `URL` class — it is the same one browsers have.',
    ),

    h('os'),
    code(
      js(`
import os from 'node:os';

os.cpus().length;        // 8   — how many cluster workers to start
os.totalmem();           // bytes
os.freemem();
os.platform();           // 'linux'
os.tmpdir();             // '/tmp'
os.hostname();
os.loadavg();            // [1m, 5m, 15m] — Unix only
`),
    ),
    warn(
      'Inside a container, `os.cpus()` and `os.totalmem()` report the **host** machine, not the cgroup limit. Starting `os.cpus().length` workers on a 0.5-CPU container is a classic way to make things slower. Read the limit from an environment variable your orchestrator sets, or use `os.availableParallelism()` on Node 19+.',
    ),

    h('util'),
    code(
      js(`
import util from 'node:util';

util.promisify(fn);                       // error-first callback -> promise
util.parseArgs({ options: { … } });       // real CLI flag parsing
util.inspect(obj, { depth: null, colors: true });   // what console.log uses
util.isDeepStrictEqual(a, b);             // real structural comparison
util.styleText('red', 'error');           // terminal colour, Node 20+
util.deprecate(fn, 'use newFn instead');  // warn once per process
`),
    ),

    h('Things you no longer need a package for'),
    table(
      ['Instead of', 'Use'],
      [
        ['`uuid`', '`crypto.randomUUID()`'],
        ['`dotenv`', '`node --env-file=.env` (Node 20+)'],
        ['`node-fetch` / `axios`', 'Global `fetch` (Node 18+)'],
        ['`rimraf`', '`fs.rm(path, { recursive: true, force: true })`'],
        ['`mkdirp`', '`fs.mkdir(path, { recursive: true })`'],
        ['`nodemon`', '`node --watch` (Node 18+)'],
        ['`jest` / `mocha` for simple cases', '`node:test` with `node --test`'],
        ['`glob`, for simple patterns', '`fs.glob` (Node 22+)'],
        ['`minimist` / `yargs`, for simple cases', '`util.parseArgs`'],
      ],
    ),
    tip(
      'This is not dependency purism. Every package is code you did not review, a version you must keep patched, and a name someone could typosquat. When the built-in does the job, the built-in is genuinely the lower-risk option.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Generate an id', '`crypto.randomUUID()`'],
      ['Generate a secret token', '`crypto.randomBytes(32).toString("base64url")`'],
      ['Verify a webhook signature', '`createHmac` + `timingSafeEqual`'],
      ['Hash a password', 'Not `crypto.createHash` — `bcrypt`, `argon2` or `scrypt`'],
      ['Parse or build a URL', '`new URL(...)` and `searchParams`'],
      ['Decide how many workers to run', '`os.availableParallelism()`, not `os.cpus()`'],
      ['Turn a callback API into promises', '`util.promisify`'],
      ['Print a deeply nested object', '`util.inspect(obj, { depth: null })`'],
    ]),

    h('Interview'),
    asked([
      ['Which Node built-ins do you use most?', '`fs`, `path`, `http`, `crypto`, `stream`, `events`, `util` — and `os` for sizing.'],
      ['How do you generate a UUID in Node?', '`crypto.randomUUID()`. No dependency required.'],
      ['How do you verify a webhook signature?', 'HMAC the raw body with the shared secret and compare using `timingSafeEqual`.'],
      ['Why not compare secrets with `===`?', 'It short-circuits, so response timing leaks how many bytes matched.'],
      ['Why can `os.cpus()` mislead in Docker?', 'It reports host CPUs, not the container\'s cgroup limit.'],
      ['Which popular packages are now redundant?', '`uuid`, `dotenv`, `node-fetch`, `rimraf`, `mkdirp`, `nodemon` — all have built-in equivalents.'],
    ]),

    links(
      nodeDoc('crypto.html', 'crypto'),
      nodeDoc('util.html', 'util'),
      nodeDoc('os.html', 'os'),
    ),
  ],
};
