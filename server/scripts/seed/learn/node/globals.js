import { asked, cheat, code, h, js, links, nodeDoc, note, p, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'A handful of names exist in every Node file without being imported. Some are the same ones the browser has, some are Node-only, and a few are neither — they look global but are actually injected per-module, which is exactly the pair that trips people up when they switch to ES modules.',
    ),

    h('What is available'),
    table(
      ['Name', 'Is', 'Notes'],
      [
        ['`globalThis`', 'The global object', 'The portable name. `global` is the Node-only alias.'],
        ['`console`', 'Logging', '`log`, `error`, `warn`, `table`, `time`, `dir`.'],
        ['`process`', 'The running process', 'argv, env, exit, signals, memory. Its own topic next.'],
        ['`Buffer`', 'Binary data', 'Node-only. Covered in `buffers`.'],
        ['`setTimeout` etc.', 'Timers', 'Plus `setImmediate`, which the browser does not have.'],
        ['`fetch`', 'HTTP client', 'Global and stable since Node 18. No dependency needed.'],
        ['`URL`, `URLSearchParams`', 'URL parsing', 'The same objects the browser has.'],
        ['`AbortController`', 'Cancellation', 'Passed as `signal` to `fetch`, `fs`, streams and more.'],
        ['`structuredClone`', 'Deep copy', 'Handles Dates, Maps, Sets and cycles.'],
        ['`crypto`', 'Web Crypto', '`crypto.randomUUID()` is the one you will use most.'],
        ['`TextEncoder` / `TextDecoder`', 'Bytes ↔ text', 'For UTF-8 without a Buffer.'],
      ],
    ),
    code(
      js(`
// run: node globals.js — no imports needed for any of this
console.log(crypto.randomUUID());        // 'f9a4...'
console.log(new URL('/tasks?done=1', 'https://api.test').searchParams.get('done'));

const res = await fetch('https://api.github.com/repos/nodejs/node');
console.log((await res.json()).stargazers_count);
`),
    ),
    note(
      'Global `fetch` means most services no longer need `axios` or `node-fetch`. It is the same API as the browser\'s, including `Response`, `Headers` and `FormData`.',
    ),

    h('The module-scoped four'),
    p(
      'These are **not** globals. In CommonJS, Node wraps every file in a function and passes them in as parameters — which is why they exist in every `.cjs` file and in none of your `.mjs` ones.',
    ),
    code(
      js(`
// What Node actually runs for a CommonJS file:
(function (exports, require, module, __filename, __dirname) {
  // your file's code
});
`),
    ),
    table(
      ['Name', 'CommonJS', 'ES module'],
      [
        ['`require`', 'Yes', 'No — use `import`, or `createRequire`'],
        ['`module` / `exports`', 'Yes', 'No — use `export`'],
        ['`__dirname`', 'Yes', '**No** — use `import.meta.dirname`'],
        ['`__filename`', 'Yes', '**No** — use `import.meta.filename`'],
      ],
    ),
    code(
      js(`
// In an ES module, Node 20.11+ :
console.log(import.meta.dirname);      // '/app/src'
console.log(import.meta.filename);     // '/app/src/index.js'

// On older Node, the long way round:
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
const __dirname = dirname(fileURLToPath(import.meta.url));
`),
    ),
    warn(
      '`__dirname is not defined` is the single most common error when a project switches to `"type": "module"`. It is not a bug in your build — those names genuinely do not exist in ESM.',
    ),

    h('Do not add your own'),
    p(
      'You can assign to `globalThis`. Almost every time, it is the wrong answer to "how do I share this".',
    ),
    code(
      js(`
// Tempting, and a problem later.
globalThis.db = new Pool();

// Better: a module that exports it. Node caches modules, so this is
// a singleton already — with a name, an import graph, and a test seam.
// db.js
export const pool = new Pool();
`),
    ),
    p(
      'A global is invisible in the import graph, cannot be mocked in a test without leaking into the next one, and gives you no error until something reads it before it was set. A module export gives you all three for free.',
    ),
    tip(
      'The legitimate uses are narrow: a polyfill for an older runtime, and per-request context via `AsyncLocalStorage` — which is a real API for exactly this, not a global variable.',
    ),

    h('AbortController'),
    p(
      'The standard way to cancel asynchronous work. It is worth knowing early because it appears throughout the Node API surface, not just in `fetch`.',
    ),
    code(
      js(`
const ac = new AbortController();
setTimeout(() => ac.abort(), 2000);

try {
  const res = await fetch(url, { signal: ac.signal });
} catch (err) {
  if (err.name === 'AbortError') console.log('gave up after 2s');
}

// The shorthand for exactly that:
await fetch(url, { signal: AbortSignal.timeout(2000) });

// Also accepted by fs, streams, events and readline:
await readFile(path, { signal: ac.signal });
`),
    ),

    h('Cheatsheet'),
    cheat([
      ['Make an HTTP request', 'Global `fetch` — no dependency'],
      ['Generate an id', '`crypto.randomUUID()`'],
      ['Get the current directory in ESM', '`import.meta.dirname`'],
      ['Deep copy an object', '`structuredClone(obj)`'],
      ['Cancel an async operation', '`AbortController`, or `AbortSignal.timeout(ms)`'],
      ['Parse a URL or query string', '`new URL(...)`, `URLSearchParams`'],
      ['Share a connection pool', 'Export it from a module — not `globalThis`'],
      ['Carry per-request context', '`AsyncLocalStorage`'],
    ]),

    h('Interview'),
    asked([
      ['Which globals does Node have that browsers do not?', '`process`, `Buffer`, `setImmediate`, `global`, and in CommonJS `require`/`module`/`__dirname`.'],
      ['Why is `__dirname` undefined in my ES module?', 'It is a CommonJS wrapper parameter, not a global. Use `import.meta.dirname`.'],
      ['`global` vs `globalThis`?', 'Same object; `globalThis` is the standard name that also works in browsers.'],
      ['Do you need axios in modern Node?', 'No — `fetch` is global and stable since Node 18.'],
      ['Why avoid attaching things to `globalThis`?', 'It hides dependencies, breaks test isolation and fails silently when read too early.'],
      ['How do you cancel an in-flight request?', 'An `AbortController`, passing its `signal` to `fetch`, `fs` or a stream.'],
    ]),

    links(
      nodeDoc('globals.html', 'Global objects'),
      nodeDoc('esm.html#importmeta', 'import.meta'),
      nodeDoc('globals.html#class-abortcontroller', 'AbortController'),
    ),
  ],
};
