/**
 * The Node.js track's table of contents.
 *
 * Metadata only — no prose, same rule as the React index. Every topic body is
 * its own module behind `load`, so this file ships with the track page and the
 * words do not.
 *
 * Section order is reading order, and here that order is the point: the track
 * opens on the language, because most Node confusion is really closure and
 * promise confusion wearing a server costume. Sections 07 to 12 then build one
 * `/tasks` API across topics — native server, Express, REST, Postgres, login,
 * hardening — so the examples accumulate instead of restarting.
 *
 * `tags` are what the filter matches besides title and summary, so they carry
 * the words you would search when you have forgotten the name of the thing.
 * Every topic is tagged `interview` where its interview table is the main event.
 *
 * `ask` is at most three questions, written as what someone stuck on that page
 * would actually type.
 */

export const title = 'Node.js';

export const summary =
  'From `map` and closures to a hardened API. Each topic is the definition, the smallest example you can actually run, how it works underneath, what goes wrong, and the questions an interview asks about it.';

export const sections = [
  {
    key: 'js-foundations',
    title: 'JavaScript foundations',
    blurb: 'The language Node runs. Most "Node is confusing" is really this, unlearned.',
    topics: [
      {
        slug: 'values-and-types',
        title: 'Values and types',
        summary: 'Primitives and objects, copying by value or by reference, and the equality you should use.',
        tags: ['javascript', 'basics', 'types', 'equality'],
        ask: [
          'Why does changing one object change the other one too in JavaScript?',
          'When is == ever the right choice over ===?',
        ],
        load: () => import('./values-and-types.js'),
      },
      {
        slug: 'functions',
        title: 'Functions',
        summary: 'Declarations, expressions, arrows, and functions as values you pass around.',
        tags: ['javascript', 'basics', 'functions', 'arrow'],
        ask: [
          'What is the real difference between an arrow function and a normal one?',
          'What does it mean that functions are first class in JavaScript?',
        ],
        load: () => import('./functions.js'),
      },
      {
        slug: 'scope-and-closures',
        title: 'Scope and closures',
        summary: 'The scope chain, hoisting, the TDZ, and why a function remembers where it was born.',
        tags: ['javascript', 'closures', 'scope', 'hoisting', 'interview'],
        ask: [
          'Explain closures in JavaScript with a real example.',
          'Why does my loop with var print the same number every time?',
        ],
        load: () => import('./scope-and-closures.js'),
      },
      {
        slug: 'this-and-context',
        title: 'this and context',
        summary: 'Four rules that decide what `this` is, and the one that arrows opt out of.',
        tags: ['javascript', 'this', 'bind', 'interview'],
        ask: [
          'Why is this undefined inside my callback?',
          'What is the difference between call, apply and bind?',
        ],
        load: () => import('./this-and-context.js'),
      },
      {
        slug: 'objects-and-destructuring',
        title: 'Objects and destructuring',
        summary: 'Spread, destructuring, optional chaining, and the copy that is shallower than you think.',
        tags: ['javascript', 'objects', 'spread', 'destructuring'],
        ask: [
          'How do I deep clone an object in Node without lodash?',
          'What is the difference between spread and Object.assign?',
        ],
        load: () => import('./objects-and-destructuring.js'),
      },
      {
        slug: 'array-methods',
        title: 'Array methods',
        summary: 'map, filter, reduce, find, some, sort, flat — which loop each one replaces.',
        tags: ['javascript', 'arrays', 'map', 'filter', 'reduce'],
        ask: [
          'When should I use reduce instead of a for loop?',
          'What is the difference between map, forEach and filter?',
        ],
        load: () => import('./array-methods.js'),
      },
      {
        slug: 'classes-and-prototypes',
        title: 'Classes and prototypes',
        summary: 'The prototype chain, what `class` desugars to, and inheritance you will actually use.',
        tags: ['javascript', 'classes', 'prototype', 'oop', 'interview'],
        ask: [
          'What is the prototype chain in JavaScript?',
          'Is class in JavaScript real inheritance or just syntax sugar?',
        ],
        load: () => import('./classes-and-prototypes.js'),
      },
    ],
  },
  {
    key: 'js-async',
    title: 'Async JavaScript',
    blurb: 'Callbacks, promises and await — the three ways to say "later", in the order they were invented.',
    topics: [
      {
        slug: 'callbacks',
        title: 'Callbacks',
        summary: 'The error-first convention, and the nesting that made promises necessary.',
        tags: ['javascript', 'async', 'callbacks', 'basics'],
        ask: [
          'What is the error-first callback convention in Node?',
          'What is callback hell and how do promises fix it?',
        ],
        load: () => import('./callbacks.js'),
      },
      {
        slug: 'promises',
        title: 'Promises',
        summary: 'A value that is not here yet: states, chaining, and turning a callback API into one.',
        tags: ['javascript', 'async', 'promises', 'interview'],
        ask: [
          'What are the three states of a promise?',
          'How do I promisify an old callback-based function?',
        ],
        load: () => import('./promises.js'),
      },
      {
        slug: 'async-await',
        title: 'async and await',
        summary: 'Promises that read like straight-line code, and the loop that quietly made it serial.',
        tags: ['javascript', 'async', 'await', 'interview'],
        ask: [
          'Why is my await inside a for loop so slow?',
          'Does await block the Node event loop?',
        ],
        load: () => import('./async-await.js'),
      },
      {
        slug: 'promise-combinators',
        title: 'Promise combinators',
        summary: 'all, allSettled, race, any — and running a hundred jobs without opening a hundred sockets.',
        tags: ['javascript', 'async', 'concurrency', 'promise.all'],
        ask: [
          'What is the difference between Promise.all and Promise.allSettled?',
          'How do I limit concurrency when calling an API 500 times?',
        ],
        load: () => import('./promise-combinators.js'),
      },
      {
        slug: 'errors-and-throwing',
        title: 'Errors and throwing',
        summary: 'Error objects, custom classes, and the rejection that takes the process down with it.',
        tags: ['javascript', 'errors', 'async', 'interview'],
        ask: [
          'Why does my try/catch not catch the error from this async function?',
          'What is an unhandled promise rejection and what happens on newer Node?',
        ],
        load: () => import('./errors-and-throwing.js'),
      },
    ],
  },
  {
    key: 'node-fundamentals',
    title: 'Node fundamentals',
    blurb: 'What the runtime is made of, and the commands to make it run something.',
    topics: [
      {
        slug: 'what-is-node',
        title: 'What is Node.js',
        summary: 'A runtime, not a language: V8, libuv, and what the browser gave up to get here.',
        tags: ['node', 'basics', 'v8', 'libuv', 'interview'],
        ask: [
          'What exactly is Node.js and how is it different from JavaScript in the browser?',
          'What do V8 and libuv each do in Node?',
        ],
        load: () => import('./what-is-node.js'),
      },
      {
        slug: 'node-architecture',
        title: 'Node architecture',
        summary: 'One JS thread, a thread pool behind it, and the OS doing the waiting.',
        tags: ['node', 'architecture', 'event loop', 'threads', 'interview'],
        ask: [
          'If Node is single threaded, how does it handle thousands of connections?',
          'Which operations actually use the libuv thread pool?',
        ],
        load: () => import('./node-architecture.js'),
      },
      {
        slug: 'first-script',
        title: 'Your first script',
        summary: 'Install it, check the version, run a file, use the REPL — the commands, in order.',
        tags: ['node', 'setup', 'cli', 'basics', 'commands'],
        ask: [
          'How do I install and switch Node versions with nvm?',
          'What does the node: prefix on an import mean?',
        ],
        load: () => import('./first-script.js'),
      },
      {
        slug: 'npm-and-package-json',
        title: 'npm and package.json',
        summary: 'Dependencies, scripts, semver ranges, and why the lockfile is the file that matters.',
        tags: ['node', 'npm', 'setup', 'package.json', 'semver'],
        ask: [
          'What is the difference between npm install and npm ci?',
          'What do the ^ and ~ in package.json versions actually allow?',
        ],
        load: () => import('./npm-and-package-json.js'),
      },
      {
        slug: 'globals',
        title: 'Globals',
        summary: 'What exists without importing anything: process, Buffer, console, timers, fetch.',
        tags: ['node', 'globals', 'basics', 'process', 'buffer'],
        ask: [
          'Which globals does Node have that the browser does not?',
          'Why are __dirname and __filename missing in my ES module?',
        ],
        load: () => import('./globals.js'),
      },
      {
        slug: 'process-and-env',
        title: 'process and the environment',
        summary: 'argv, env, exit codes and signals — how a Node program talks to whatever started it.',
        tags: ['node', 'process', 'env', 'signals', 'cli'],
        ask: [
          'How do I read command line arguments in Node?',
          'What is the right way to handle SIGTERM in a Node server?',
        ],
        load: () => import('./process-and-env.js'),
      },
    ],
  },
  {
    key: 'modules',
    title: 'Modules',
    blurb: 'Two module systems, one resolution algorithm, and a standard library worth a tour.',
    topics: [
      {
        slug: 'commonjs',
        title: 'CommonJS',
        summary: 'require, module.exports, the wrapper function, and the cache that surprises everyone once.',
        tags: ['node', 'modules', 'commonjs', 'require', 'interview'],
        ask: [
          'How does require() actually work under the hood?',
          'Why does my module only run its top-level code once?',
        ],
        load: () => import('./commonjs.js'),
      },
      {
        slug: 'es-modules',
        title: 'ES modules',
        summary: 'import, export, "type": "module", top-level await — and what breaks on the way over.',
        tags: ['node', 'modules', 'esm', 'import', 'interview'],
        ask: [
          'What is the difference between CommonJS and ES modules in Node?',
          'Why do I get "Cannot use import statement outside a module"?',
        ],
        load: () => import('./es-modules.js'),
      },
      {
        slug: 'module-resolution',
        title: 'Module resolution',
        summary: 'How a bare specifier becomes a file, and what an exports map decides.',
        tags: ['node', 'modules', 'resolution', 'node_modules'],
        ask: [
          'How does Node find a package in node_modules?',
          'What does the exports field in package.json do?',
        ],
        load: () => import('./module-resolution.js'),
      },
      {
        slug: 'builtin-modules',
        title: 'The built-in modules',
        summary: 'A tour of the standard library: path, url, os, crypto, util — and what each is for.',
        tags: ['node', 'modules', 'stdlib', 'crypto', 'path'],
        ask: [
          'Which Node built-in modules should I actually know?',
          'How do I hash or generate a random token without a dependency?',
        ],
        load: () => import('./builtin-modules.js'),
      },
    ],
  },
  {
    key: 'event-loop',
    title: 'The event loop',
    blurb: 'The heart of the runtime, phase by phase — and every ordering question it answers.',
    topics: [
      {
        slug: 'event-loop-phases',
        title: 'Event loop phases',
        summary: 'One full turn of the loop, in order, with what queues into each phase.',
        tags: ['node', 'event loop', 'async', 'architecture', 'interview'],
        ask: [
          'Walk me through the phases of the Node event loop.',
          'Which phase does a setTimeout callback run in?',
        ],
        load: () => import('./event-loop-phases.js'),
      },
      {
        slug: 'microtasks-and-macrotasks',
        title: 'Microtasks and macrotasks',
        summary: 'nextTick, promises, setImmediate, setTimeout — predict the output, then run it.',
        tags: ['node', 'event loop', 'nexttick', 'setimmediate', 'interview'],
        ask: [
          'What is the difference between process.nextTick and setImmediate?',
          'In what order do these logs print? Explain why.',
        ],
        load: () => import('./microtasks-and-macrotasks.js'),
      },
      {
        slug: 'timers',
        title: 'Timers',
        summary: 'setTimeout, setInterval, drift, unref, and why 0 does not mean now.',
        tags: ['node', 'timers', 'event loop', 'settimeout'],
        ask: [
          'Why does setTimeout with 0 not run immediately?',
          'How do I stop a timer from keeping my Node process alive?',
        ],
        load: () => import('./timers.js'),
      },
      {
        slug: 'blocking-the-event-loop',
        title: 'Blocking the event loop',
        summary: 'CPU-bound work in an I/O-bound runtime: how to see it, measure it, and move it.',
        tags: ['node', 'event loop', 'performance', 'blocking', 'interview'],
        ask: [
          'What happens to other requests when one request does heavy CPU work?',
          'How do I measure event loop lag in production?',
        ],
        load: () => import('./blocking-the-event-loop.js'),
      },
      {
        slug: 'async-patterns',
        title: 'Async patterns',
        summary: 'Serial, parallel, batched and queued — choosing the shape on purpose.',
        tags: ['node', 'async', 'concurrency', 'patterns'],
        ask: [
          'Should these two awaits run in sequence or in parallel?',
          'How do I process a huge list of items without exhausting memory?',
        ],
        load: () => import('./async-patterns.js'),
      },
    ],
  },
  {
    key: 'files-and-streams',
    title: 'Files, buffers and streams',
    blurb: 'Reading the disk without reading it all into memory, and the events underneath.',
    topics: [
      {
        slug: 'fs-module',
        title: 'The fs module',
        summary: 'Read, write, append, delete — and the three API flavours to pick between.',
        tags: ['node', 'fs', 'files', 'basics'],
        ask: [
          'Should I use fs, fs/promises or fs sync methods?',
          'How do I check whether a file exists in Node?',
        ],
        load: () => import('./fs-module.js'),
      },
      {
        slug: 'paths-and-directories',
        title: 'Paths and directories',
        summary: 'path.join over string concatenation, plus mkdir, readdir and stat.',
        tags: ['node', 'fs', 'path', 'directories'],
        ask: [
          'Why should I use path.join instead of just adding strings?',
          'How do I walk a directory tree recursively in Node?',
        ],
        load: () => import('./paths-and-directories.js'),
      },
      {
        slug: 'buffers',
        title: 'Buffers',
        summary: 'Fixed-length binary data, encodings, and why a string is the wrong tool for bytes.',
        tags: ['node', 'buffer', 'binary', 'encoding', 'interview'],
        ask: [
          'What is a Buffer in Node and when do I need one?',
          'How do I convert between a Buffer, a string and base64?',
        ],
        load: () => import('./buffers.js'),
      },
      {
        slug: 'streams',
        title: 'Streams',
        summary: 'Readable, Writable, Duplex, Transform — data in pieces, at constant memory.',
        tags: ['node', 'streams', 'pipeline', 'interview'],
        ask: [
          'Why use a stream instead of reading the whole file into memory?',
          'What is the difference between pipe and pipeline?',
        ],
        load: () => import('./streams.js'),
      },
      {
        slug: 'backpressure',
        title: 'Backpressure',
        summary: 'What happens when the writer is slower than the reader, and who is supposed to notice.',
        tags: ['node', 'streams', 'backpressure', 'memory', 'interview'],
        ask: [
          'What is backpressure in Node streams?',
          'Why does my file copy use gigabytes of memory?',
        ],
        load: () => import('./backpressure.js'),
      },
      {
        slug: 'event-emitter',
        title: 'EventEmitter',
        summary: 'The pattern most of Node is built on: on, once, emit — and the listener leak.',
        tags: ['node', 'events', 'eventemitter', 'patterns'],
        ask: [
          'How does EventEmitter work and where does Node use it internally?',
          'What causes a MaxListenersExceededWarning?',
        ],
        load: () => import('./event-emitter.js'),
      },
    ],
  },
  {
    key: 'http',
    title: 'HTTP and your first server',
    blurb: 'The protocol, then a server with no framework — so you know what a framework is doing.',
    topics: [
      {
        slug: 'http-fundamentals',
        title: 'HTTP fundamentals',
        summary: 'Request, response, headers, body, and every part of a URL named.',
        tags: ['http', 'basics', 'protocol', 'interview'],
        ask: [
          'Walk me through what happens between a browser request and a response.',
          'What is the difference between a query string, a path param and a body?',
        ],
        load: () => import('./http-fundamentals.js'),
      },
      {
        slug: 'http-methods-and-status',
        title: 'Methods and status codes',
        summary: 'GET to DELETE, safe vs idempotent, and the twenty codes worth knowing cold.',
        tags: ['http', 'rest', 'status codes', 'idempotency', 'interview'],
        ask: [
          'What does idempotent mean and which HTTP methods are?',
          'When do I return 401 vs 403, or 400 vs 422?',
        ],
        load: () => import('./http-methods-and-status.js'),
      },
      {
        slug: 'native-server',
        title: 'Your first server',
        summary: 'http.createServer, listen, respond with JSON — running in ten lines, no dependencies.',
        tags: ['node', 'http', 'server', 'setup', 'basics'],
        ask: [
          'How do I create a basic HTTP server in Node without Express?',
          'What is the difference between res.write and res.end?',
        ],
        load: () => import('./native-server.js'),
      },
      {
        slug: 'routing-by-hand',
        title: 'Routing by hand',
        summary: 'Parsing a JSON body and matching a URL yourself — the case Express makes for itself.',
        tags: ['node', 'http', 'routing', 'server', 'interview'],
        ask: [
          'How do I read a JSON request body without a framework?',
          'What does Express actually do that plain http does not?',
        ],
        load: () => import('./routing-by-hand.js'),
      },
      {
        slug: 'headers-and-cookies',
        title: 'Headers and cookies',
        summary: 'Content types, caching, Set-Cookie and the flags that make a cookie safe.',
        tags: ['http', 'headers', 'cookies', 'caching', 'security'],
        ask: [
          'What do HttpOnly, Secure and SameSite actually do?',
          'How do ETag and Cache-Control work together?',
        ],
        load: () => import('./headers-and-cookies.js'),
      },
    ],
  },
  {
    key: 'express',
    title: 'Express',
    blurb: 'The same server, rewritten — then given the structure a real service needs.',
    topics: [
      {
        slug: 'express-basics',
        title: 'Express basics',
        summary: 'Install it, port the native server over, and see what disappeared.',
        tags: ['express', 'server', 'setup', 'basics'],
        ask: [
          'How do I set up a minimal Express server?',
          'What does express.json() do and what happens without it?',
        ],
        load: () => import('./express-basics.js'),
      },
      {
        slug: 'routing',
        title: 'Routing',
        summary: 'Params, query, body, Router — and why route order decides which one wins.',
        tags: ['express', 'routing', 'router', 'basics'],
        ask: [
          'How do I split Express routes across multiple files?',
          'Why does my /users/new route hit the /users/:id handler?',
        ],
        load: () => import('./routing.js'),
      },
      {
        slug: 'middleware',
        title: 'Middleware',
        summary: 'The one signature everything in Express shares, and what next() really does.',
        tags: ['express', 'middleware', 'next', 'interview'],
        ask: [
          'What is middleware in Express and how does next() work?',
          'Why does my request hang and never send a response?',
        ],
        load: () => import('./middleware.js'),
      },
      {
        slug: 'express-errors',
        title: 'Error handling',
        summary: 'The four-argument handler, async errors, and one error class for the whole API.',
        tags: ['express', 'errors', 'middleware', 'interview'],
        ask: [
          'Why is my Express error handler not catching errors from async routes?',
          'How do I return a consistent error shape from every endpoint?',
        ],
        load: () => import('./express-errors.js'),
      },
      {
        slug: 'project-structure',
        title: 'Project structure',
        summary: 'routes → controllers → services → repositories, and what belongs in each.',
        tags: ['express', 'architecture', 'structure', 'layers', 'interview'],
        ask: [
          'How should I structure a Node and Express project that will grow?',
          'What is the difference between a controller and a service?',
        ],
        load: () => import('./project-structure.js'),
      },
      {
        slug: 'config-and-env',
        title: 'Config and environments',
        summary: 'One validated config object, loaded once, so nothing reads process.env twice.',
        tags: ['node', 'config', 'env', 'setup', 'production'],
        ask: [
          'What is the right way to handle environment variables in Node?',
          'How do I fail fast when a required env var is missing?',
        ],
        load: () => import('./config-and-env.js'),
      },
    ],
  },
  {
    key: 'rest-api',
    title: 'REST APIs',
    blurb: 'Turning endpoints into an interface someone else can use without asking you.',
    topics: [
      {
        slug: 'rest-principles',
        title: 'REST principles',
        summary: 'Resources, statelessness, and the CRUD-to-HTTP mapping the whole style rests on.',
        tags: ['rest', 'api', 'design', 'interview'],
        ask: [
          'What does REST actually require, and what is just convention?',
          'What does it mean for an API to be stateless?',
        ],
        load: () => import('./rest-principles.js'),
      },
      {
        slug: 'api-design',
        title: 'API design',
        summary: 'Naming, status codes, and one response and error envelope used everywhere.',
        tags: ['rest', 'api', 'design', 'errors'],
        ask: [
          'What should a good REST API error response look like?',
          'Should my endpoints be plural nouns, and where do actions go?',
        ],
        load: () => import('./api-design.js'),
      },
      {
        slug: 'pagination-filtering-sorting',
        title: 'Pagination, filtering, sorting',
        summary: 'Offset vs cursor, safe filters, safe sorts — and the page that skips a row.',
        tags: ['rest', 'api', 'pagination', 'cursor', 'interview'],
        ask: [
          'What is the difference between offset and cursor pagination?',
          'Why does page 2 of my list sometimes repeat an item from page 1?',
        ],
        load: () => import('./pagination-filtering-sorting.js'),
      },
      {
        slug: 'validation',
        title: 'Validation',
        summary: 'Zod at the edge on body, query and params — and 400 vs 422.',
        tags: ['rest', 'validation', 'zod', 'security'],
        ask: [
          'How do I validate request bodies in Express with Zod?',
          'Should invalid input be a 400 or a 422?',
        ],
        load: () => import('./validation.js'),
      },
      {
        slug: 'versioning-and-idempotency',
        title: 'Versioning and idempotency',
        summary: 'Changing an API without breaking callers, and a retry that does not double-charge.',
        tags: ['rest', 'api', 'versioning', 'idempotency', 'interview'],
        ask: [
          'How do I version a REST API without breaking existing clients?',
          'How do idempotency keys stop a duplicate POST?',
        ],
        load: () => import('./versioning-and-idempotency.js'),
      },
    ],
  },
  {
    key: 'postgres',
    title: 'PostgreSQL',
    blurb: 'SQL worth writing by hand, then the driver, the ORM, and the query plan.',
    topics: [
      {
        slug: 'sql-basics',
        title: 'SQL basics',
        summary: 'Tables, keys, constraints, and the four statements that do almost everything.',
        tags: ['sql', 'postgres', 'database', 'basics'],
        ask: [
          'What is the difference between a primary key and a unique constraint?',
          'How do foreign keys and ON DELETE CASCADE work?',
        ],
        load: () => import('./sql-basics.js'),
      },
      {
        slug: 'joins-and-aggregates',
        title: 'Joins and aggregates',
        summary: 'Join types, GROUP BY, HAVING, CTEs and window functions — read one, write one.',
        tags: ['sql', 'postgres', 'joins', 'window functions', 'interview'],
        ask: [
          'What is the difference between an INNER JOIN and a LEFT JOIN?',
          'When do I need a window function instead of GROUP BY?',
        ],
        load: () => import('./joins-and-aggregates.js'),
      },
      {
        slug: 'node-postgres',
        title: 'Postgres from Node',
        summary: 'The pg pool, parameterised queries, and never building SQL with a template string.',
        tags: ['postgres', 'node', 'pg', 'pool', 'security'],
        ask: [
          'Should I use a client or a pool with node-postgres?',
          'How do parameterised queries prevent SQL injection?',
        ],
        load: () => import('./node-postgres.js'),
      },
      {
        slug: 'transactions',
        title: 'Transactions and concurrency',
        summary: 'ACID, isolation levels, lost updates, deadlocks — and locking a row on purpose.',
        tags: ['postgres', 'transactions', 'acid', 'concurrency', 'interview'],
        ask: [
          'Explain ACID and what isolation level Postgres uses by default.',
          'Two requests decrement the same stock count — how do I stop overselling?',
        ],
        load: () => import('./transactions.js'),
      },
      {
        slug: 'prisma',
        title: 'Prisma',
        summary: 'Schema, relations, migrations, typed queries — and where you still drop to SQL.',
        tags: ['postgres', 'prisma', 'orm', 'migrations'],
        ask: [
          'How do Prisma migrations work in development versus production?',
          'When should I use Prisma raw queries instead of the query API?',
        ],
        load: () => import('./prisma.js'),
      },
      {
        slug: 'indexes-and-performance',
        title: 'Indexes and performance',
        summary: 'What an index costs, reading EXPLAIN, and killing the N+1 query.',
        tags: ['postgres', 'performance', 'indexes', 'explain', 'n+1', 'interview'],
        ask: [
          'How do I tell whether my query is using an index?',
          'What is the N+1 query problem and how do I fix it?',
        ],
        load: () => import('./indexes-and-performance.js'),
      },
    ],
  },
  {
    key: 'auth',
    title: 'Authentication',
    blurb: 'Who is calling, and what they are allowed to do — done the boring, correct way.',
    topics: [
      {
        slug: 'auth-vs-authorization',
        title: 'Authentication vs authorization',
        summary: 'Two questions people merge into one, and the two layers that answer them.',
        tags: ['auth', 'security', 'basics', 'interview'],
        ask: [
          'What is the difference between authentication and authorization?',
          'Which one does a 401 mean, and which one is a 403?',
        ],
        load: () => import('./auth-vs-authorization.js'),
      },
      {
        slug: 'passwords',
        title: 'Passwords',
        summary: 'Hashing with bcrypt or argon2, register, log in, reset — and never storing the password.',
        tags: ['auth', 'passwords', 'bcrypt', 'security', 'interview'],
        ask: [
          'Why is bcrypt used for passwords instead of SHA-256?',
          'How should a forgotten-password reset flow work securely?',
        ],
        load: () => import('./passwords.js'),
      },
      {
        slug: 'jwt',
        title: 'JWT',
        summary: 'What is really inside a token, access vs refresh, expiry, and rotation.',
        tags: ['auth', 'jwt', 'tokens', 'security', 'interview'],
        ask: [
          'How does a JWT work and is it encrypted?',
          'Why do I need a refresh token if I already have an access token?',
        ],
        load: () => import('./jwt.js'),
      },
      {
        slug: 'sessions-and-cookies',
        title: 'Sessions and cookies',
        summary: 'Server-side sessions, cookie flags, and choosing between this and a JWT.',
        tags: ['auth', 'sessions', 'cookies', 'security', 'interview'],
        ask: [
          'Should I use sessions or JWTs for my API?',
          'How do I log a user out if JWTs are stateless?',
        ],
        load: () => import('./sessions-and-cookies.js'),
      },
      {
        slug: 'authorization-rbac',
        title: 'Authorization and RBAC',
        summary: 'Roles, permissions, and the ownership check that role checks always miss.',
        tags: ['auth', 'rbac', 'permissions', 'security', 'interview'],
        ask: [
          'How do I implement role-based access control in Express?',
          'How do I stop a user from reading another user record by changing the id?',
        ],
        load: () => import('./authorization-rbac.js'),
      },
    ],
  },
  {
    key: 'security',
    title: 'Security',
    blurb: 'The attacks that actually reach a Node API, and the line of code that stops each one.',
    topics: [
      {
        slug: 'api-threats',
        title: 'The threats that matter',
        summary: 'What a public API is attacked with, ranked by how often it works.',
        tags: ['security', 'owasp', 'api', 'interview'],
        ask: [
          'What are the most common security holes in a Node REST API?',
          'What should I check before putting an API on the public internet?',
        ],
        load: () => import('./api-threats.js'),
      },
      {
        slug: 'injection',
        title: 'Injection',
        summary: 'SQL and NoSQL injection, command injection, and why parameterising ends all three.',
        tags: ['security', 'sql injection', 'nosql', 'interview'],
        ask: [
          'Show me a SQL injection and the fix in Node.',
          'What is NoSQL injection and how does it work in MongoDB?',
        ],
        load: () => import('./injection.js'),
      },
      {
        slug: 'xss-and-csrf',
        title: 'XSS and CSRF',
        summary: 'Two browser attacks, why one still hits your JSON API, and where each is stopped.',
        tags: ['security', 'xss', 'csrf', 'cookies', 'interview'],
        ask: [
          'Does a JSON API need CSRF protection?',
          'Where should I store a JWT — localStorage or a cookie?',
        ],
        load: () => import('./xss-and-csrf.js'),
      },
      {
        slug: 'cors-and-headers',
        title: 'CORS and security headers',
        summary: 'What CORS is really protecting, the preflight, and what helmet sets for you.',
        tags: ['security', 'cors', 'headers', 'helmet', 'interview'],
        ask: [
          'Explain CORS and what the preflight request is for.',
          'Why does my request work in Postman but fail in the browser?',
        ],
        load: () => import('./cors-and-headers.js'),
      },
      {
        slug: 'secrets-and-rate-limiting',
        title: 'Secrets and rate limiting',
        summary: 'Keeping keys out of the repo, and keeping one client from being all your traffic.',
        tags: ['security', 'secrets', 'rate limiting', 'production'],
        ask: [
          'How should secrets be managed in a production Node app?',
          'How do I rate limit an API endpoint properly?',
        ],
        load: () => import('./secrets-and-rate-limiting.js'),
      },
    ],
  },
];
