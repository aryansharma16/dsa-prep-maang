import { asked, cheat, code, h, js, link, links, note, p, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'One error handler at the bottom of the stack, and every failure anywhere in the app turns into a correct response through it. That is the goal: no `try/catch` in handlers, no ad-hoc `res.status(500)` scattered around, and one place that decides what a client is told and what only the logs see.',
    ),

    h('The four-argument handler'),
    p(
      'Express identifies an error handler by **arity**: four parameters means error handler. Three means ordinary middleware. This is not a style choice — it is how Express distinguishes them, so the unused `next` cannot be dropped.',
    ),
    code(
      js(`
// Registered LAST, after every route.
app.use((err, req, res, next) => {
  //   ^^^ four parameters, or Express treats this as normal middleware
  res.status(500).json({ error: 'Internal error' });
});
`),
    ),
    warn(
      'Writing `(err, req, res)` — three parameters — silently registers a normal middleware that receives the *request* as `err`. It will never run on an error, errors will fall through to Express\'s default HTML handler, and nothing will tell you why.',
    ),

    h('Getting errors into it'),
    code(
      js(`
// Synchronous throw — caught by Express automatically.
app.get('/a', (req, res) => { throw new NotFoundError('Task'); });

// Explicit.
app.get('/b', (req, res, next) => next(new NotFoundError('Task')));

// Async on Express 5 — also automatic.
app.get('/c', async (req, res) => { throw new NotFoundError('Task'); });

// Async on Express 4 — NOT automatic. The request hangs.
app.get('/d', async (req, res) => { throw new NotFoundError('Task'); });
`),
    ),
    code(
      js(`
// The Express 4 fix, applied at every async route.
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

app.get('/d', asyncHandler(async (req, res) => {
  throw new NotFoundError('Task');
}));
`),
    ),
    tip(
      'Rather than remembering the wrapper at every route, apply it once when you register them, or move to Express 5. A wrapper you sometimes forget is worse than no wrapper, because the failure is a silent hang rather than a visible crash.',
    ),

    h('The error classes'),
    p('The same shape from `errors-and-throwing`, now with the handler that consumes it:'),
    code(
      js(`
// errors.js
export class AppError extends Error {
  constructor(message, status = 500, options) {
    super(message, options);
    this.name = this.constructor.name;
    this.status = status;
    this.expected = true;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(issues) { super('Validation failed', 422); this.issues = issues; }
}
export class NotFoundError extends AppError {
  constructor(what = 'Resource') { super(\`\${what} not found\`, 404); }
}
export class UnauthorizedError extends AppError {
  constructor() { super('Not authenticated', 401); }
}
export class ForbiddenError extends AppError {
  constructor() { super('Not permitted', 403); }
}
export class ConflictError extends AppError {
  constructor(message = 'Already exists') { super(message, 409); }
}
`),
    ),

    h('The handler'),
    code(
      js(`
// middleware/errorHandler.js
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);     // too late — let Express abort it

  const status = err.status ?? err.statusCode ?? 500;
  const expected = err.expected === true || (status >= 400 && status < 500);

  // Log everything; log unexpected errors louder, with the stack.
  const entry = { requestId: req.id, method: req.method, path: req.originalUrl, status };
  if (expected) log.warn({ ...entry, message: err.message });
  else log.error({ ...entry, err });

  res.status(status).json({
    error: {
      // Never leak an unexpected error's message — it can contain a query,
      // a hostname, a path, or a fragment of someone else's data.
      message: expected ? err.message : 'Internal server error',
      code: err.code,
      ...(err.issues && { issues: err.issues }),
      requestId: req.id,
    },
  });
}
`),
    ),
    warn(
      'The `expected` split is the security-relevant line. A raw `err.message` from Postgres reads `relation "tasks" does not exist` and tells an attacker your schema; from a filesystem call it leaks an absolute path. Client-caused errors carry their own message; server-caused ones get a generic string and a request id.',
    ),
    tip(
      'Returning `requestId` in the error body is worth more than any message. A user pastes it into a support ticket and you grep straight to the exact log line with the full stack.',
    ),

    h('Translating library errors'),
    p(
      'Errors from Postgres, JWT libraries and body parsers arrive with their own shapes. Map them to yours in the handler so every response is consistent.',
    ),
    code(
      js(`
function normalise(err) {
  if (err.name === 'ZodError') return new ValidationError(err.issues);
  if (err.code === '23505') return new ConflictError('Already exists');   // pg unique
  if (err.code === '23503') return new ValidationError('Referenced row missing');
  if (err.name === 'TokenExpiredError') return new UnauthorizedError();
  if (err.name === 'JsonWebTokenError') return new UnauthorizedError();
  if (err.type === 'entity.too.large') return new AppError('Body too large', 413);
  if (err.type === 'entity.parse.failed') return new AppError('Invalid JSON', 400);
  return err;
}

export function errorHandler(err, req, res, next) {
  err = normalise(err);
  // ...as above
}
`),
    ),

    h('Wiring it up'),
    code(
      js(`
// app.js
app.use('/v1', apiRoutes);

// 404 — a normal middleware, because nothing errored, nothing matched.
app.use((req, res, next) => next(new NotFoundError('Route')));

// The error handler, absolutely last.
app.use(errorHandler);
`),
    ),
    note(
      'Order matters here as much as anywhere: the 404 middleware must come after every route, and the error handler after the 404. Register the error handler earlier and it will not see errors thrown by routes below it.',
    ),

    h('What the client sees'),
    code(
      js(`
// 422
{ "error": { "message": "Validation failed", "issues": [
    { "path": ["title"], "message": "String must contain at least 1 character" }
  ], "requestId": "8f3a..." } }

// 404
{ "error": { "message": "Task not found", "requestId": "8f3a..." } }

// 500 — no detail whatsoever
{ "error": { "message": "Internal server error", "requestId": "8f3a..." } }
`),
    ),

    h('Beyond the request'),
    p(
      'The error handler only sees errors *inside* a request. Everything else needs the process-level nets from `errors-and-throwing`.',
    ),
    code(
      js(`
process.on('unhandledRejection', (reason) => {
  log.fatal({ reason }, 'unhandled rejection');
  process.exit(1);
});
process.on('uncaughtException', (err) => {
  log.fatal({ err }, 'uncaught exception');
  process.exit(1);
});
`),
    ),

    h('Cheatsheet'),
    cheat([
      ['Register an error handler', '`app.use((err, req, res, next) => …)` — four args, last'],
      ['Fail from a handler', '`throw new NotFoundError()` — or `next(err)`'],
      ['Catch async errors on Express 4', 'An `asyncHandler` wrapper'],
      ['Give an error its status', 'A `status` field on a custom error class'],
      ['Avoid leaking internals', 'Generic message for anything unexpected'],
      ['Make an error traceable', 'Return a `requestId` and log it'],
      ['Handle a duplicate key', 'Map pg `23505` to a `409`'],
      ['Handle errors after headers are sent', '`if (res.headersSent) return next(err)`'],
    ]),

    h('Interview'),
    asked([
      ['How does Express know a middleware is an error handler?', 'It has four parameters. Three means ordinary middleware.'],
      ['Why is my async route error not caught?', 'On Express 4 a rejected promise is not forwarded — wrap the handler so it calls `next(err)`.'],
      ['Where does the error handler go?', 'Last, after the routes and the 404 middleware.'],
      ['How do you return consistent errors?', 'Custom error classes carrying a status, plus one handler that renders them all.'],
      ['Why not return `err.message` for a 500?', 'It leaks schema, paths and internals — return a generic message and a request id.'],
      ['What about errors outside a request?', 'Process-level `uncaughtException` and `unhandledRejection` handlers that log and exit.'],
    ]),

    links(
      link('Express error handling', 'https://expressjs.com/en/guide/error-handling.html'),
      link('Express 5 migration guide', 'https://expressjs.com/en/guide/migrating-5.html'),
      link('Postgres error codes', 'https://www.postgresql.org/docs/current/errcodes-appendix.html'),
    ),
  ],
};
