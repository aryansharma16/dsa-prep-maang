import { asked, cheat, code, h, js, links, nodeDoc, note, p, sh, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'The server from the last topic answers, but it ignores request bodies and routes with a chain of `if` statements. Fixing both by hand takes about sixty lines — and those sixty lines are precisely what Express replaces, which is the best possible argument for using it.',
    ),

    h('Reading the body'),
    p(
      '`req` is a Readable stream. Nothing has read it, so the body is not "in" the request object — you have to consume it.',
    ),
    code(
      js(`
// The modern way: async iteration.
async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

// The events version, which you will meet in older code.
function readBodyEvents(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}
`),
    ),
    warn(
      'Both of those will happily read a 10 GB body into memory. An unbounded body reader is a denial-of-service hole — one request can exhaust the process. **Every** body reader needs a limit.',
    ),
    code(
      js(`
const MAX_BODY = 100 * 1024;   // 100 KB

async function readJson(req) {
  const type = req.headers['content-type'] ?? '';
  if (!type.includes('application/json')) {
    throw Object.assign(new Error('Expected application/json'), { status: 415 });
  }

  // Reject early if the client told us it is too big.
  const declared = Number(req.headers['content-length'] ?? 0);
  if (declared > MAX_BODY) {
    throw Object.assign(new Error('Body too large'), { status: 413 });
  }

  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    // And enforce it as it arrives, because Content-Length can lie.
    if (size > MAX_BODY) {
      req.destroy();
      throw Object.assign(new Error('Body too large'), { status: 413 });
    }
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw Object.assign(new Error('Invalid JSON'), { status: 400 });
  }
}
`),
    ),
    tip(
      'Both checks are needed. `Content-Length` is a claim by the client, and a chunked request may not send one at all — so you check the claim to fail fast, and you count the bytes to actually be safe.',
    ),
    note(
      'A malformed body must be a `400`, not a `500`. Without that `try/catch`, `JSON.parse` throws, your handler rejects, and a client typo shows up in your logs as a server error and in your alerting as an incident.',
    ),

    h('A router'),
    p(
      'The `if` chain does not scale past a handful of routes and cannot extract `:id`. A small table plus a regular expression handles both.',
    ),
    code(
      js(`
// Turn '/tasks/:id' into /^\\/tasks\\/([^/]+)$/ and remember the names.
function compile(pattern) {
  const names = [];
  const source = pattern
    .replace(/\\/:([^/]+)/g, (_, name) => { names.push(name); return '/([^/]+)'; });
  return { regex: new RegExp(\`^\${source}$\`), names };
}

const routes = [];
const route = (method, pattern, handler) =>
  routes.push({ method, ...compile(pattern), handler });

function match(method, pathname) {
  for (const r of routes) {
    if (r.method !== method) continue;
    const m = pathname.match(r.regex);
    if (!m) continue;
    const params = Object.fromEntries(r.names.map((n, i) => [n, m[i + 1]]));
    return { handler: r.handler, params };
  }
  return null;
}
`),
    ),

    h('Putting it together'),
    code(
      js(`
// server.js — run: node server.js
import http from 'node:http';
import crypto from 'node:crypto';

const tasks = new Map();

const send = (res, status, body) => {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
};

route('GET', '/tasks', (req, res, { query }) => {
  let data = [...tasks.values()];
  if (query.get('done')) data = data.filter(t => String(t.done) === query.get('done'));
  send(res, 200, { data });
});

route('GET', '/tasks/:id', (req, res, { params }) => {
  const task = tasks.get(params.id);
  if (!task) return send(res, 404, { error: 'Not found' });
  send(res, 200, task);
});

route('POST', '/tasks', async (req, res) => {
  const body = await readJson(req);
  if (typeof body.title !== 'string' || !body.title.trim()) {
    return send(res, 422, { error: 'title is required' });
  }
  const task = { id: crypto.randomUUID(), title: body.title.trim(), done: false };
  tasks.set(task.id, task);
  res.setHeader('Location', \`/tasks/\${task.id}\`);
  send(res, 201, task);
});

route('DELETE', '/tasks/:id', (req, res, { params }) => {
  if (!tasks.delete(params.id)) return send(res, 404, { error: 'Not found' });
  res.writeHead(204).end();
});

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, \`http://\${req.headers.host}\`);
  const matched = match(req.method, url.pathname);

  if (!matched) return send(res, 404, { error: 'Not found' });

  try {
    await matched.handler(req, res, { params: matched.params, query: url.searchParams });
  } catch (err) {
    if (!res.headersSent) send(res, err.status ?? 500, { error: err.message });
    if (!err.status) console.error(err);
  }
});

server.listen(3000, () => console.log('http://localhost:3000'));
`),
    ),
    code(
      sh(`
curl -sX POST localhost:3000/tasks -H 'content-type: application/json' \\
  -d '{"title":"Ship it"}' | jq
curl -s 'localhost:3000/tasks?done=false' | jq
curl -i -X DELETE localhost:3000/tasks/<id>
curl -sX POST localhost:3000/tasks -H 'content-type: application/json' -d '{}' | jq
# { "error": "title is required" }
`),
    ),

    h('What is still missing'),
    p(
      'That server works, and it is roughly 90 lines. Here is what a real one needs that it does not have:',
    ),
    table(
      ['Missing', 'Express gives you'],
      [
        ['Body parsing for forms and multipart', '`express.urlencoded()`, `multer`'],
        ['A middleware chain — auth, logging, CORS', '`app.use(...)`, run in order'],
        ['Grouping routes across files', '`express.Router()`'],
        ['One error handler for everything', 'The 4-argument error middleware'],
        ['`405` when the path exists but the verb does not', 'Route matching that knows the difference'],
        ['Content negotiation, `ETag`, ranges', '`res.json`, `res.sendFile`, built-in ETags'],
        ['Static files', '`express.static()`'],
        ['Query parsing beyond flat strings', '`req.query` with nested objects and arrays'],
      ],
    ),
    tip(
      'Nothing above is impossible without a framework — it is all a few dozen more lines. The reason to use Express is not capability, it is that these particular few dozen lines are load-bearing, security-relevant, and have already been debugged by a very large number of people.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Read a request body', '`for await (const c of req)`, then `Buffer.concat`'],
      ['Cap the body size', 'Check `content-length` **and** count bytes as they arrive'],
      ['Reject a bad `Content-Type`', '`415`'],
      ['Handle unparseable JSON', '`400`, never a 500'],
      ['Extract `:id`', 'Compile the pattern to a regex, capture the names'],
      ['Handle an async handler that throws', 'One `try/catch` around the dispatch'],
      ['Avoid a double response', 'Check `res.headersSent`'],
    ]),

    h('Interview'),
    asked([
      ['How do you read a JSON body without a framework?', 'Consume `req` as a stream, concatenate the chunks, parse — with a size limit and a `try/catch`.'],
      ['Why is an unbounded body reader dangerous?', 'One request can allocate unlimited memory and take the process down.'],
      ['Is `Content-Length` enough to enforce a limit?', 'No — it is a client claim, and chunked requests may omit it. Count the bytes too.'],
      ['What does Express actually give you?', 'Middleware, routing with params, body parsers, a central error handler, static files and response helpers.'],
      ['How do you avoid responding twice?', 'Return after every response and check `res.headersSent` in the error path.'],
      ['What status for unparseable JSON?', '`400` — the client is wrong, not the server.'],
    ]),

    links(
      nodeDoc('http.html#class-httpincomingmessage', 'http.IncomingMessage'),
      nodeDoc('stream.html#readablereadsize', 'Reading a stream'),
      nodeDoc('url.html#class-url', 'The URL class'),
    ),
  ],
};
