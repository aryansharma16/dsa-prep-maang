import { asked, cheat, code, h, js, links, nodeDoc, note, p, sh, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      '`process` is the Node program\'s handle on itself and on whatever started it: the arguments it was given, the environment it inherited, the exit code it will return, and the signals it can be sent. Every deployment concern later in this track — config, graceful shutdown, health checks — is built on this one object.',
    ),

    h('Arguments'),
    code(
      js(`
// run: node migrate.js up --dry-run
console.log(process.argv);
// [ '/usr/bin/node', '/app/migrate.js', 'up', '--dry-run' ]

const [, , command, ...flags] = process.argv;   // 'up', ['--dry-run']
`),
    ),
    p(
      'Index 0 is the Node binary and index 1 is your script; your own arguments start at 2. For anything past a flag or two, Node has a parser built in.',
    ),
    code(
      js(`
import { parseArgs } from 'node:util';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    dryRun: { type: 'boolean', default: false },
    limit:  { type: 'string', short: 'l' },
  },
});
// node migrate.js up --dry-run -l 100
// values      -> { dryRun: true, limit: '100' }
// positionals -> [ 'up' ]
`),
    ),

    h('Environment'),
    code(
      js(`
process.env.NODE_ENV;         // 'production' — or undefined
process.env.PORT;             // '3000'  <- ALWAYS a string, even for numbers
process.env.DEBUG;            // '' is falsy but the variable IS set
`),
    ),
    warn(
      'Every value in `process.env` is a string. `process.env.PORT + 1` is `"30001"`, and `process.env.FEATURE_ON === true` is always false. Convert at the boundary: `Number(process.env.PORT)`, `process.env.FEATURE_ON === "true"`.',
    ),
    code(
      sh(`
# .env
DATABASE_URL=postgres://localhost:5432/tasks
PORT=3000
JWT_SECRET=dev-only-not-a-real-secret
`),
    ),
    code(
      sh(`
node --env-file=.env src/index.js      # Node 20+, no dependency
`),
    ),
    tip(
      'Read `process.env` in exactly one module, validate it there, and export a typed config object. Everything else imports that. A missing variable should crash at boot with a clear message, not produce `undefined` in a connection string at 2am — that is the `config-and-env` topic.',
    ),

    h('Useful properties'),
    table(
      ['', 'Gives'],
      [
        ['`process.cwd()`', 'Where the process was **started**, not where the file lives. Not the same as `__dirname`.'],
        ['`process.pid`', 'The process id — what you `kill`.'],
        ['`process.version`', '`"v22.11.0"`.'],
        ['`process.platform`', '`"linux"`, `"darwin"`, `"win32"`.'],
        ['`process.uptime()`', 'Seconds since start. Useful in a health endpoint.'],
        ['`process.memoryUsage()`', '`rss`, `heapTotal`, `heapUsed`, `external` — in bytes.'],
        ['`process.hrtime.bigint()`', 'A monotonic nanosecond clock, for timing.'],
      ],
    ),
    code(
      js(`
// A health endpoint that says something useful.
app.get('/health', (req, res) => {
  const { heapUsed, rss } = process.memoryUsage();
  res.json({
    status: 'ok',
    uptime: Math.round(process.uptime()),
    memory: { heapUsedMb: Math.round(heapUsed / 1e6), rssMb: Math.round(rss / 1e6) },
    version: process.version,
  });
});
`),
    ),
    note(
      '`process.cwd()` versus `import.meta.dirname` matters more than it looks. Reading `./config.json` resolves against the *current working directory*, so the same code works when run from the project root and fails when run from anywhere else. Build paths from the module\'s own directory.',
    ),

    h('Exit codes'),
    code(
      js(`
process.exit(0);        // success
process.exit(1);        // failure — the convention for "something went wrong"

// Better than exit(): set the code and let the process finish naturally.
process.exitCode = 1;
`),
    ),
    warn(
      '`process.exit()` is immediate and brutal. Pending writes are lost — including a `console.log` on the line above it, if stdout is a pipe. Prefer setting `process.exitCode` and letting the event loop drain, and reserve `exit()` for the moment after everything is closed.',
    ),

    h('Signals'),
    p(
      'The OS, your process manager, Docker and Kubernetes all communicate with your process by signal. Handling `SIGTERM` is the difference between a deploy that drops in-flight requests and one that does not.',
    ),
    table(
      ['Signal', 'Sent by', 'Means'],
      [
        ['`SIGINT`', 'Ctrl-C', 'A person asked you to stop'],
        ['`SIGTERM`', '`kill`, Docker stop, Kubernetes', 'Please shut down cleanly'],
        ['`SIGKILL`', '`kill -9`, or the grace period expiring', 'You are being killed. **Cannot be handled.**'],
      ],
    ),
    code(
      js(`
// run: node server.js, then Ctrl-C, and watch it close cleanly
const server = app.listen(port);

const shutdown = async (signal) => {
  console.log(\`\${signal} received, shutting down\`);

  server.close(() => console.log('http server closed'));   // stop accepting new
  setTimeout(() => process.exit(1), 10_000).unref();       // hard deadline

  try {
    await pool.end();          // close the database pool
    await redis.quit();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
`),
    ),
    p(
      'The order is what matters: stop accepting new connections **first**, let in-flight requests finish, then close the pools, then exit. The `unref`\'d timer is the promise you make to the orchestrator that you will be gone before it sends `SIGKILL` — Kubernetes waits 30 seconds by default.',
    ),

    h('Process events'),
    code(
      js(`
process.on('uncaughtException', (err) => { log.fatal({ err }); process.exit(1); });
process.on('unhandledRejection', (reason) => { log.fatal({ reason }); process.exit(1); });
process.on('exit', (code) => { /* SYNCHRONOUS ONLY — no awaits here */ });
process.on('warning', (warn) => log.warn({ warn }));
`),
    ),
    warn(
      'The `exit` handler runs after the loop has stopped. Asynchronous work inside it never runs — no final flush of logs, no closing a connection. Do the cleanup in the signal handler instead.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Read CLI arguments', '`process.argv.slice(2)`, or `util.parseArgs`'],
      ['Read config', '`process.env` — once, validated, at boot'],
      ['Convert an env var to a number', '`Number(process.env.PORT)`'],
      ['Load a .env file', '`node --env-file=.env`'],
      ['Fail a script', '`process.exitCode = 1`'],
      ['Shut down cleanly', '`SIGTERM` → `server.close()` → close pools → exit'],
      ['Guarantee you exit in time', 'An `unref`\'d timeout that force-exits'],
      ['Report health', '`process.uptime()` and `process.memoryUsage()`'],
    ]),

    h('Interview'),
    asked([
      ['How do you read command-line arguments?', '`process.argv`, skipping the first two entries — or `util.parseArgs` for real flags.'],
      ['Why is `process.env.PORT` a string?', 'The environment is strings only; convert explicitly at the boundary.'],
      ['How do you shut down a Node server gracefully?', 'Handle `SIGTERM`, stop accepting connections, drain in-flight requests, close pools, exit — with a hard deadline.'],
      ['Why not call `process.exit()` directly?', 'It abandons pending I/O, so logs and writes in flight are lost.'],
      ['Can you handle `SIGKILL`?', 'No. That is why the grace period on `SIGTERM` matters.'],
      ['`process.cwd()` vs `__dirname`?', 'Where the process was started versus where the file lives — they differ whenever the app is run from another directory.'],
    ]),

    links(
      nodeDoc('process.html', 'process'),
      nodeDoc('process.html#signal-events', 'Signal events'),
      nodeDoc('util.html#utilparseargsconfig', 'util.parseArgs'),
    ),
  ],
};
