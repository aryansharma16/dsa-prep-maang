import { asked, cheat, code, h, js, link, links, nodeDoc, note, p, table, tip, ul, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Node.js is a **runtime** — a program that runs JavaScript outside a browser. It bundles Google\'s V8 engine to execute the language, and a C library called libuv to talk to the operating system: files, sockets, processes, timers. JavaScript itself gained nothing new; it was given a different set of things to talk to.',
    ),
    code(
      js(`
// This is the whole idea, in five lines.
// run: node hello.js
import { readFile } from 'node:fs/promises';

const text = await readFile('./package.json', 'utf8');
console.log(JSON.parse(text).name);
`),
    ),
    p(
      'No browser can do that. `readFile` is not part of JavaScript — it is part of Node, and it is implemented in C++ behind a JavaScript function.',
    ),

    h('What is in the box'),
    table(
      ['Piece', 'Written in', 'Does'],
      [
        ['**V8**', 'C++', 'Parses and runs JavaScript. Compiles hot code to machine code. Owns the heap and the garbage collector.'],
        ['**libuv**', 'C', 'The event loop, the thread pool, and cross-platform async I/O — epoll on Linux, kqueue on macOS, IOCP on Windows.'],
        ['**Node bindings**', 'C++', 'The bridge: `fs.readFile` in JavaScript reaching a libuv call and back again.'],
        ['**The standard library**', 'JavaScript', '`fs`, `http`, `path`, `stream`, `crypto` — the modules you import.'],
      ],
    ),
    note(
      'V8 also powers Chrome. libuv was written *for* Node and is now used by other projects. Neither knows anything about the other — Node is the code that makes them one program.',
    ),

    h('Node versus the browser'),
    table(
      ['', 'Browser', 'Node'],
      [
        ['Global object', '`window`', '`globalThis` — there is no `window`'],
        ['DOM', '`document`, `localStorage`', 'None. There are no pages.'],
        ['Files', 'Sandboxed, user-picked only', 'Full filesystem access as the OS user'],
        ['Modules', 'ESM only', 'ESM **and** CommonJS'],
        ['Networking', '`fetch`, restricted by CORS', '`http`, raw TCP/UDP sockets, `fetch` — no CORS, it is not a browser'],
        ['Who you trust', 'The user is the attacker', 'The client is the attacker'],
        ['Versions', 'Whatever the visitor has', 'The one you installed'],
      ],
    ),
    warn(
      'CORS does not apply to requests *made from* Node. It is a browser rule, enforced by browsers. This is why a request that fails in the browser succeeds from Postman or a Node script — and it is why CORS is not a security control for your server.',
    ),

    h('Non-blocking I/O, in one comparison'),
    p(
      'The design decision behind everything else. A traditional thread-per-request server blocks a whole OS thread while the database answers. Node registers interest in the result and moves on, so one thread can have thousands of requests in flight — all of them waiting, none of them occupying anything but a callback.',
    ),
    code(
      js(`
// Blocking: nothing else in this process happens for the duration.
const data = fs.readFileSync('big.log', 'utf8');
console.log('read done');
console.log('next');            // strictly after the read

// Non-blocking: the read is handed to libuv, execution continues.
fs.readFile('big.log', 'utf8', () => console.log('read done'));
console.log('next');            // prints FIRST
`),
    ),
    ul(
      '**Where Node wins** — many concurrent connections doing little work each: APIs, proxies, real-time, streaming, anything I/O-bound.',
      '**Where Node loses** — sustained CPU work: image processing, large encryption, heavy computation. One thread runs your JavaScript, so a busy loop stalls every other request. That is what worker threads exist for.',
    ),

    h('Where it runs'),
    p(
      'Node is one binary. The same runtime powers your API server, your CLI tools, your build tooling (Vite, ESLint, TypeScript all run on it), your test runner and your scripts. Learning it once pays several times.',
    ),

    h('Versions'),
    p(
      'Even-numbered releases become **LTS** (long-term support) and are what you run in production; odd numbers are development lines. Node 18 introduced a stable global `fetch`, Node 20 added a built-in test runner and `--watch`, Node 22 made `require()` of an ES module possible.',
    ),
    tip(
      'Pin the major version in `package.json` under `engines` and in your Dockerfile. "It works on my machine" between Node 18 and 22 is usually a module-resolution or a global-API difference.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Run JavaScript outside a browser', 'Node'],
      ['Run your JavaScript fast', 'V8'],
      ['Do async I/O without threads', 'libuv and the event loop'],
      ['Handle 10,000 idle connections', 'Node, comfortably'],
      ['Resize 10,000 images', 'Not on the main thread — worker threads or another service'],
      ['Know what version to run', 'The current even-numbered LTS'],
    ]),

    h('Interview'),
    asked([
      ['What is Node.js?', 'A JavaScript runtime built on V8 with libuv for async I/O — not a language and not a framework.'],
      ['What do V8 and libuv do?', 'V8 executes JavaScript; libuv provides the event loop, thread pool and cross-platform non-blocking I/O.'],
      ['How is Node different from browser JavaScript?', 'No DOM or `window`; full filesystem, process and raw network access; CommonJS as well as ESM; no CORS.'],
      ['Why is Node good for I/O-heavy work?', 'Non-blocking I/O means one thread can hold thousands of waiting connections instead of one thread each.'],
      ['When is Node the wrong choice?', 'Sustained CPU-bound work — it blocks the single JavaScript thread and stalls every other request.'],
      ['Is Node single-threaded?', 'Your JavaScript is. The process also has libuv\'s thread pool and V8\'s own threads.'],
    ]),

    links(
      nodeDoc('synopsis.html', 'Node.js synopsis'),
      link('About Node.js', 'https://nodejs.org/en/about'),
      link('Node.js release schedule', 'https://github.com/nodejs/release#release-schedule'),
    ),
  ],
};
