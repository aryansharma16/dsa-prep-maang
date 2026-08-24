import { asked, cheat, code, h, js, links, mdn, nodeDoc, note, p, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'An error is a value with a stack trace attached. How you create it, what you attach to it, and where you catch it are the three decisions that separate a service you can debug from one that logs `Error: undefined` at 3am.',
    ),

    h('Always throw an Error'),
    p(
      'You can `throw` anything — a string, a number, an object. Do not. Only an `Error` carries a stack trace, and every `catch` block in your codebase and every library you use assumes it has one.',
    ),
    code(
      js(`
throw 'Task not found';                    // no stack — you will regret this
throw { message: 'Task not found' };       // no stack either

throw new Error('Task not found');         // stack from the throw site
`),
    ),
    table(
      ['Property', 'What it holds'],
      [
        ['`message`', 'The human sentence. Keep it specific and free of secrets.'],
        ['`name`', '`"Error"` by default; subclasses set their own.'],
        ['`stack`', 'The call stack as a string, captured at construction.'],
        ['`cause`', 'The underlying error, when you wrap one. `new Error(msg, { cause: err })`.'],
        ['`code`', 'Not standard, but Node uses it everywhere — `ENOENT`, `ECONNREFUSED`.'],
      ],
    ),

    h('Wrapping, not swallowing'),
    p(
      'When you catch a low-level error and rethrow something more meaningful, keep the original with `cause`. Node prints the whole chain.',
    ),
    code(
      js(`
try {
  await pool.query(sql, params);
} catch (err) {
  throw new Error('Could not load tasks for user ' + userId, { cause: err });
}
// Error: Could not load tasks for user 42
//     at ...
//   [cause]: error: relation "task" does not exist
`),
    ),
    warn(
      'The opposite — `catch (err) { throw new Error("db failed") }` — is how a five-minute bug becomes a two-hour one. You threw away the only thing that said *which* query, on *which* table.',
    ),

    h('Custom error classes'),
    p(
      'One base class with an HTTP status, subclassed for the cases your API actually returns. This is what lets a single Express error handler turn any thrown error into the right response, which is the `express-errors` topic later.',
    ),
    code(
      js(`
// errors.js
export class AppError extends Error {
  constructor(message, status = 500, options) {
    super(message, options);
    this.name = this.constructor.name;
    this.status = status;
    this.expected = true;              // "we threw this on purpose"
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(what = 'Resource') { super(\`\${what} not found\`, 404); }
}
export class ValidationError extends AppError {
  constructor(details) {
    super('Validation failed', 400);
    this.details = details;
  }
}
export class UnauthorizedError extends AppError {
  constructor() { super('Not authenticated', 401); }
}
`),
    ),
    p(
      'The `expected` flag is the important one. It separates errors you predicted — a missing row, a bad body — from the ones you did not, and only the second kind should page anyone.',
    ),

    h('Operational vs programmer errors'),
    table(
      ['', 'Operational', 'Programmer'],
      [
        ['Examples', 'Row not found, bad input, connection refused, timeout', '`undefined is not a function`, a typo, a bad assumption'],
        ['Expected?', 'Yes — the world is unreliable', 'No — the code is wrong'],
        ['Response', 'Handle it: retry, 404, 400', 'Fix the code'],
        ['At runtime', 'Log at `warn`, return a clean response', 'Log at `error`, let the process restart'],
      ],
    ),
    note(
      'This distinction is the standard answer to "how do you handle errors in Node". Operational errors are handled; programmer errors are not caught at all, because catching a bug and continuing means running with corrupt state.',
    ),

    h('Async errors'),
    code(
      js(`
// Caught — await turns the rejection into a throw.
try { await save(task); } catch (err) { /* here */ }

// NOT caught — the promise rejects on a later tick, outside the try.
try { save(task); } catch (err) { /* never runs */ }

// NOT caught by an outer try — the throw is inside a callback.
try {
  setTimeout(() => { throw new Error('boom'); }, 0);
} catch (err) { /* never runs */ }
`),
    ),
    warn(
      'A throw inside a `setTimeout`, an event listener or any non-awaited callback escapes to the top of the event loop as an **uncaught exception**. There is no enclosing frame to catch it. Put the `try/catch` inside the callback.',
    ),

    h('The two process-level nets'),
    code(
      js(`
// index.js — last resort only
process.on('uncaughtException', (err) => {
  log.fatal({ err }, 'uncaught exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  log.fatal({ reason }, 'unhandled rejection');
  process.exit(1);
});
`),
    ),
    p(
      'Both should **log and exit**, never continue. After an uncaught exception the process is in an unknown state — a half-written transaction, a released lock that was not released. Restarting under a process manager is the safe move; limping on is not.',
    ),
    tip(
      'For a real server, exit *gracefully*: stop accepting connections, let in-flight requests finish with a short deadline, then exit. That is the `process-and-env` topic.',
    ),

    h('Node error codes'),
    p(
      'Built-in errors carry a stable `code` string. Match on `err.code`, never on `err.message` — messages change between versions, codes do not.',
    ),
    code(
      js(`
try {
  await fs.readFile(path);
} catch (err) {
  if (err.code === 'ENOENT') return null;      // file simply is not there
  throw err;
}

// Common ones: ENOENT (no such file), EACCES (permission),
// EADDRINUSE (port taken), ECONNREFUSED, ETIMEDOUT, EPIPE
`),
    ),

    h('Cheatsheet'),
    cheat([
      ['Throw something', 'Always `new Error(...)` or a subclass'],
      ['Add context without losing detail', '`new Error(msg, { cause: err })`'],
      ['Give an API error its status', 'A custom class with a `status` field'],
      ['Distinguish expected from unexpected', 'An `expected` flag on your base error'],
      ['Catch an async error', '`try/catch` around `await`, not around the call'],
      ['Handle a missing file', 'Check `err.code === "ENOENT"`'],
      ['Deal with an uncaught exception', 'Log fatally and exit — do not continue'],
    ]),

    h('Interview'),
    asked([
      ['How do you handle errors in Node?', 'Handle operational errors where they occur; let programmer errors crash the process and restart it.'],
      ['Why throw an `Error` and not a string?', 'Only an `Error` carries a stack trace, and every consumer assumes one.'],
      ['Why does my try/catch miss an async error?', 'The rejection happens after the block exits — you must `await` inside the `try`.'],
      ['What is an unhandled rejection?', 'A rejected promise with no handler. It terminates the process on Node 15 and later.'],
      ['Should you keep running after `uncaughtException`?', 'No — the state is unknown. Log and exit; let the supervisor restart.'],
      ['How do you preserve the original error when rethrowing?', 'The `cause` option, which Node prints as part of the stack.'],
    ]),

    links(
      nodeDoc('errors.html', 'Errors'),
      nodeDoc('errors.html#nodejs-error-codes', 'Node.js error codes'),
      mdn('Web/JavaScript/Reference/Global_Objects/Error/cause', 'Error.cause'),
    ),
  ],
};
