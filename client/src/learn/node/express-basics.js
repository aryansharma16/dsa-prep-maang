import { asked, cheat, code, h, js, link, links, note, p, sh, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Express is a thin layer over `node:http`. It adds a middleware chain, a router that understands `:params`, body parsers, and response helpers — and that is genuinely all. Underneath, `req` and `res` are still the same Node objects you used in `native-server`, with extra methods bolted on.',
    ),

    h('Setup'),
    code(
      sh(`
npm install express
`),
    ),
    code(
      js(`
// app.js — run: node app.js
import express from 'express';

const app = express();

app.use(express.json({ limit: '100kb' }));

app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(3000, () => console.log('http://localhost:3000'));
`),
    ),
    p(
      'Five lines, and it already does what the hand-rolled server took ninety to do badly — with a body-size limit, correct `Content-Type` handling and a `400` on malformed JSON, all from that one `express.json()` line.',
    ),

    h('The same /tasks service'),
    code(
      js(`
// app.js
import express from 'express';
import crypto from 'node:crypto';

const app = express();
app.use(express.json({ limit: '100kb' }));

const tasks = new Map();

app.get('/tasks', (req, res) => {
  let data = [...tasks.values()];
  if (req.query.done !== undefined) {
    data = data.filter(t => String(t.done) === req.query.done);
  }
  res.json({ data });
});

app.get('/tasks/:id', (req, res) => {
  const task = tasks.get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Not found' });
  res.json(task);
});

app.post('/tasks', (req, res) => {
  const { title } = req.body;
  if (typeof title !== 'string' || !title.trim()) {
    return res.status(422).json({ error: 'title is required' });
  }
  const task = { id: crypto.randomUUID(), title: title.trim(), done: false };
  tasks.set(task.id, task);
  res.status(201).location(\`/tasks/\${task.id}\`).json(task);
});

app.patch('/tasks/:id', (req, res) => {
  const task = tasks.get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Not found' });
  Object.assign(task, { done: req.body.done ?? task.done });
  res.json(task);
});

app.delete('/tasks/:id', (req, res) => {
  if (!tasks.delete(req.params.id)) return res.status(404).json({ error: 'Not found' });
  res.status(204).end();
});

app.listen(3000);
`),
    ),
    code(
      sh(`
curl -sX POST localhost:3000/tasks -H 'content-type: application/json' \\
  -d '{"title":"Ship it"}' | jq
curl -s 'localhost:3000/tasks?done=false' | jq
`),
    ),

    h('What disappeared'),
    table(
      ['By hand', 'Express'],
      [
        ['Compile a regex per route, match in a loop', '`app.get("/tasks/:id", …)`'],
        ['Read the stream, cap the size, parse, catch', '`express.json({ limit })`'],
        ['`new URL(req.url, …)`, then `searchParams`', '`req.query`'],
        ['`writeHead` + `JSON.stringify` + `Content-Length`', '`res.json(x)`'],
        ['A `try/catch` around every dispatch', 'One error middleware'],
        ['A `send()` helper you wrote', '`res.status().json()`'],
      ],
    ),

    h('The request object'),
    code(
      js(`
req.params.id           // from the route pattern — always strings
req.query.page          // from the query string — string, or array, or object
req.body                // only after a body parser has run
req.headers['x-thing']  // lowercase keys, as in plain Node
req.get('Content-Type') // case-insensitive lookup
req.method              // 'POST'
req.path                // '/tasks/7'   — no query string
req.originalUrl         // '/tasks/7?x=1' — before any router mounted a prefix
req.ip                  // needs 'trust proxy' behind a load balancer
`),
    ),
    warn(
      '`req.params` and `req.query` values are **always strings**, or arrays, or — with the default query parser — nested objects. `req.query.page` can be `"2"`, `["2","3"]` or `{ evil: "1" }` depending on what the client sent. Never do arithmetic or a database lookup on one without validating it first, which is the `validation` topic.',
    ),

    h('The response object'),
    code(
      js(`
res.json({ data });                       // sets Content-Type and stringifies
res.status(201).json(task);               // chainable
res.status(204).end();                    // no body
res.send('plain text');                   // guesses the type — avoid in an API
res.redirect(302, '/tasks');
res.location('/tasks/7');
res.set('X-Total-Count', '42');
res.sendFile(path.resolve('./report.pdf'));
res.sendStatus(404);                       // status + its text as the body
`),
    ),
    warn(
      'Only one response per request. A handler that calls `res.json()` and then falls through to another `res.json()` throws `ERR_HTTP_HEADERS_SENT`. The habit that prevents it is `return res.status(...)` on every early exit — as in the code above.',
    ),

    h('Built-in middleware'),
    code(
      js(`
app.use(express.json({ limit: '100kb' }));           // application/json
app.use(express.urlencoded({ extended: true }));      // HTML form posts
app.use(express.text());                              // text/plain
app.use(express.raw({ type: 'application/octet-stream' }));
app.use(express.static('public', { maxAge: '1d' }));  // files, with caching
`),
    ),
    tip(
      'Always pass a `limit` to `express.json()`. The default is 100 KB, which is reasonable, but stating it makes the decision visible — and some setups need it much smaller or much larger, and you want that written down.',
    ),
    note(
      'For a webhook whose signature is computed over the exact bytes, you need the raw body *before* it is parsed: `express.json({ verify: (req, res, buf) => { req.rawBody = buf; } })`. Re-stringifying `req.body` produces different bytes and the signature check fails.',
    ),

    h('Express 4 or 5'),
    table(
      ['', 'Express 4', 'Express 5'],
      [
        ['Async handler that rejects', 'Hangs — you must call `next(err)`', 'Forwarded to the error handler automatically'],
        ['Route patterns', '`/tasks/:id?` and regex strings', 'Stricter — `*` must be named, some patterns changed'],
        ['`req.query`', 'Nested objects by default', 'A simpler parser by default'],
        ['Status', 'What most codebases still run', 'The current release'],
      ],
    ),
    tip(
      'Check which you are on — `npm ls express` — before writing async route handlers. On Express 4 an unhandled rejection in a handler leaves the request hanging with nothing in the logs, and that is the single most confusing Express bug there is. The fix is in `express-errors`.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Create an app', '`const app = express()`'],
      ['Parse JSON bodies', '`app.use(express.json({ limit: "100kb" }))`'],
      ['Read a path param', '`req.params.id`'],
      ['Read a query param', '`req.query.page` — then validate it'],
      ['Send JSON', '`res.json(x)`'],
      ['Set a status', '`res.status(201).json(x)`'],
      ['Empty success', '`res.status(204).end()`'],
      ['Exit a handler early', '`return res.status(404).json(...)`'],
      ['Serve static files', '`app.use(express.static("public"))`'],
    ]),

    h('Interview'),
    asked([
      ['What is Express?', 'A minimal layer over `node:http` adding routing, middleware, body parsing and response helpers.'],
      ['What does `express.json()` do?', 'Reads and parses a JSON body into `req.body`, enforcing a size limit and returning `400` on bad JSON.'],
      ['What happens without a body parser?', '`req.body` is `undefined` — the stream is never consumed.'],
      ['Why are `req.params` values strings?', 'They come out of the URL text; nothing converts or validates them for you.'],
      ['What causes `ERR_HTTP_HEADERS_SENT` in Express?', 'Responding twice — usually a missing `return` before a second `res.*` call.'],
      ['Express 4 vs 5 for async handlers?', 'Express 5 forwards a rejected promise to the error handler; Express 4 leaves the request hanging.'],
    ]),

    links(
      link('Express — Hello world', 'https://expressjs.com/en/starter/hello-world.html'),
      link('Express — Request', 'https://expressjs.com/en/4x/api.html#req'),
      link('Express — Response', 'https://expressjs.com/en/4x/api.html#res'),
    ),
  ],
};
