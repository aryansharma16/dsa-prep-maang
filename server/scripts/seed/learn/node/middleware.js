import { asked, cheat, code, h, js, link, links, note, p, sig, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Middleware is a function that runs between the request arriving and the response leaving. Every route handler is middleware; `express.json()` is middleware; your auth check is middleware. They are held in one ordered list, and each decides whether to respond, to pass control on, or to fail.',
    ),

    h('The signature'),
    sig([
      ['`req`', '`Request`', 'The request. Middleware is allowed to add to it — `req.user`, `req.id`.'],
      ['`res`', '`Response`', 'The response. Calling any `res.*` sender ends the chain.'],
      ['`next`', '`(err?) => void`', '**Pass control on.** With an argument, skip to the error handler.'],
    ]),
    code(
      js(`
function requestId(req, res, next) {
  req.id = req.headers['x-request-id'] ?? crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();                      // continue to the next middleware
}

app.use(requestId);
`),
    ),
    p('Each middleware must do exactly one of three things:'),
    table(
      ['Action', 'Code', 'Result'],
      [
        ['Continue', '`next()`', 'The next middleware runs'],
        ['Respond', '`res.json(...)`', 'The chain stops here — **do not also call `next()`**'],
        ['Fail', '`next(err)`', 'Skip to the error handler'],
      ],
    ),
    warn(
      'Doing none of them is the classic Express bug: the request hangs forever, the client times out, and nothing appears in your logs because nothing threw. If a handler ever forgets its `next()` on some branch, that branch is a silent hang.',
    ),

    h('Order is everything'),
    code(
      js(`
const app = express();

app.use(helmet());                   // 1. security headers on everything
app.use(cors());                     // 2. before routes, so preflights work
app.use(express.json());             // 3. body parsed before handlers read it
app.use(requestId);                  // 4. before logging, so logs carry it
app.use(httpLogger);                 // 5. before routes, to time them
app.use('/v1', apiRoutes);           // 6. the routes
app.use(notFound);                   // 7. nothing matched
app.use(errorHandler);               // 8. LAST, and takes four arguments
`),
    ),
    tip(
      'Read that list as a pipeline and each position explains itself: a body parser after the routes leaves `req.body` undefined; a logger after the routes never sees a request; a 404 handler before the routes catches everything.',
    ),

    h('Scoping'),
    code(
      js(`
app.use(middleware);                      // every request
app.use('/admin', requireAdmin);          // every path under /admin
router.use(requireAuth);                  // every route in this router
app.get('/tasks/:id', requireAuth, getTask);   // this one route only
app.get('/x', [a, b, c], handler);        // an array works too
`),
    ),

    h('Writing one'),
    code(
      js(`
// A logger that times the request. Note it hooks 'finish' rather than
// wrapping res.send — the response may end in many different ways.
export function httpLogger(req, res, next) {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    log.info({
      id: req.id,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      ms: Math.round(ms),
    });
  });

  next();
}
`),
    ),
    note(
      '`finish` fires when the response has been handed to the OS. `close` fires if the client disconnected first — log both if you care about abandoned requests, and note that a client hanging up mid-request is normal traffic, not an error.',
    ),

    h('Configurable middleware'),
    p(
      'A function that returns middleware. This is the closure from the language section, and it is the single most common shape in a real Express codebase.',
    ),
    code(
      js(`
export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return next(new UnauthorizedError());
  if (!roles.includes(req.user.role)) return next(new ForbiddenError());
  next();
};

router.delete('/:id', requireRole('admin', 'owner'), deleteTask);
`),
    ),
    code(
      js(`
// Validation, as middleware, parameterised by a schema.
export const validate = (schema, source = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) return next(new ValidationError(result.error.issues));
  req[source] = result.data;          // replace with the parsed, typed value
  next();
};

router.post('/', validate(createTaskSchema), createTask);
`),
    ),
    tip(
      'Assigning the parsed result back over `req.body` is the part people skip, and it is the point. Downstream code then works with validated, coerced data — a real `number`, a real `Date` — instead of re-checking strings in every handler.',
    ),

    h('Async middleware'),
    warn(
      'On **Express 4**, a rejected promise in an async middleware is not caught. Express never sees the error, `next` is never called, and the request hangs. Express 5 fixed this — until you are on 5, every async handler needs a wrapper.',
    ),
    code(
      js(`
// The wrapper. Ten lines that prevent an entire category of silent bug.
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.get('/:id', asyncHandler(async (req, res) => {
  const task = await service.findById(req.params.id);   // may reject
  if (!task) throw new NotFoundError('Task');
  res.json(task);
}));
`),
    ),

    h('Third-party middleware'),
    table(
      ['Package', 'Does'],
      [
        ['`helmet`', 'Sets a dozen security headers'],
        ['`cors`', 'Handles CORS headers and preflight'],
        ['`cookie-parser`', 'Populates `req.cookies`'],
        ['`compression`', 'gzip/brotli on responses'],
        ['`express-rate-limit`', 'Per-IP or per-key request limits'],
        ['`multer`', 'multipart/form-data — file uploads'],
        ['`morgan`', 'HTTP request logging (or use `pino-http`)'],
      ],
    ),

    h('Cost'),
    p(
      'Every `app.use` runs on **every** request. Ten cheap middlewares is nothing; one that hits Redis on every request — including your health check and your static assets — is a millisecond you pay a hundred thousand times a day.',
    ),
    code(
      js(`
// Mount expensive middleware where it is actually needed.
app.use('/v1', authenticate);          // not app.use(authenticate)

// And let the cheap checks bail out first.
app.get('/health', (req, res) => res.json({ ok: true }));   // before auth
`),
    ),

    h('Cheatsheet'),
    cheat([
      ['Run on every request', '`app.use(fn)`'],
      ['Run on one route', '`app.get(path, fn, handler)`'],
      ['Continue the chain', '`next()`'],
      ['Fail the chain', '`next(err)`'],
      ['Configure a middleware', 'A function returning the middleware'],
      ['Catch async errors on Express 4', 'An `asyncHandler` wrapper'],
      ['Time a request', 'Hook `res.on("finish")`'],
      ['Debug a hanging request', 'Find the branch that never calls `next` or responds'],
    ]),

    h('Interview'),
    asked([
      ['What is middleware?', 'A `(req, res, next)` function in an ordered chain that can inspect, modify, respond or delegate.'],
      ['What does `next()` do?', 'Passes control to the next middleware; with an argument it jumps to the error handler.'],
      ['Why does my request hang?', 'A middleware neither responded nor called `next()` on that branch.'],
      ['Why does middleware order matter?', 'It is a pipeline — a body parser after the routes leaves `req.body` undefined.'],
      ['How do you make configurable middleware?', 'A factory function that closes over the config and returns the handler.'],
      ['How do async errors reach the handler on Express 4?', 'They do not — wrap the handler so a rejection calls `next(err)`.'],
    ]),

    links(
      link('Using middleware', 'https://expressjs.com/en/guide/using-middleware.html'),
      link('Writing middleware', 'https://expressjs.com/en/guide/writing-middleware.html'),
      link('Express 5 migration guide', 'https://expressjs.com/en/guide/migrating-5.html'),
    ),
  ],
};
