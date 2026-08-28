import { asked, cheat, code, h, js, links, nodeDoc, note, p, sh, sig, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'A Node HTTP server is five lines and no dependencies. Writing one before you touch Express is worth the twenty minutes: everything a framework does later — routing, body parsing, JSON responses, middleware — is something you will have done by hand first, so none of it is magic.',
    ),
    p(
      'This is also the start of the `/tasks` service that the next six sections keep building on.',
    ),

    h('The smallest server that works'),
    code(
      js(`
// server.js
import http from 'node:http';

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true }));
});

server.listen(3000, () => console.log('listening on http://localhost:3000'));
`),
    ),
    code(
      sh(`
node server.js
# in another terminal:
curl -i localhost:3000
# HTTP/1.1 200 OK
# Content-Type: application/json
# {"ok":true}
`),
    ),
    p(
      'The callback runs once **per request**. `req` and `res` are streams: `req` is Readable — the incoming body — and `res` is Writable. That is why the `streams` topic came first.',
    ),
    note(
      'The process does not exit after `listen`. A listening server is an open handle, so the event loop has a reason to keep running — the mechanism from the event loop topic, in practice.',
    ),

    h('The request object'),
    sig([
      ['`req.method`', '`string`', '`"GET"`, `"POST"` — always uppercase.'],
      ['`req.url`', '`string`', 'The path **and query only** — `"/tasks?done=1"`. Never the host.'],
      ['`req.headers`', '`object`', 'All lowercase keys.'],
      ['`req.socket.remoteAddress`', '`string`', 'The peer IP — the proxy\'s, if there is one.'],
      ['`req` itself', '`Readable`', 'The body. Nothing has read it yet.'],
    ]),
    code(
      js(`
const server = http.createServer((req, res) => {
  console.log(req.method, req.url);
  console.log(req.headers['content-type']);

  // req.url has no origin, so give the URL parser a base to work with.
  const url = new URL(req.url, \`http://\${req.headers.host}\`);
  console.log(url.pathname);                    // '/tasks'
  console.log(url.searchParams.get('done'));    // '1'
});
`),
    ),

    h('The response object'),
    code(
      js(`
res.statusCode = 201;
res.setHeader('Content-Type', 'application/json');
res.setHeader('Location', '/tasks/7');

// or both at once:
res.writeHead(201, { 'Content-Type': 'application/json', Location: '/tasks/7' });

res.write('{"id":7,');     // send a piece
res.write('"title":"a"}'); // send another
res.end();                 // finish — REQUIRED

res.end(JSON.stringify(task));   // the usual shorthand: write + end
`),
    ),
    warn(
      'Every header must be set **before** the first `write`. Once any body byte is sent the headers are already on the wire, and `setHeader` throws `ERR_HTTP_HEADERS_SENT`. The same error means you responded twice — usually a missing `return` after an early error response.',
    ),
    warn(
      'Forgetting `res.end()` leaves the connection open. The client waits, and eventually times out, with no error anywhere in your logs. Every code path through a handler must end the response exactly once.',
    ),

    h('A JSON helper'),
    p('Writing the same three lines in every branch gets old immediately. This is the first thing you would factor out — and it is, roughly, what `res.json()` is in Express.'),
    code(
      js(`
const send = (res, status, body) => {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
};

send(res, 404, { error: 'Not found' });
`),
    ),
    tip(
      '`Buffer.byteLength`, not `payload.length`. `Content-Length` is bytes, and any non-ASCII character in the response makes those two numbers differ — which produces a truncated body the client cannot parse.',
    ),

    h('The full /tasks server'),
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

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, \`http://\${req.headers.host}\`);

  if (req.method === 'GET' && url.pathname === '/tasks') {
    return send(res, 200, { data: [...tasks.values()] });
  }

  if (req.method === 'GET' && url.pathname.startsWith('/tasks/')) {
    const task = tasks.get(url.pathname.slice(7));
    return task ? send(res, 200, task) : send(res, 404, { error: 'Not found' });
  }

  if (req.method === 'POST' && url.pathname === '/tasks') {
    const task = { id: crypto.randomUUID(), title: 'placeholder', done: false };
    tasks.set(task.id, task);
    res.setHeader('Location', \`/tasks/\${task.id}\`);
    return send(res, 201, task);
  }

  send(res, 404, { error: 'Not found' });
});

server.listen(process.env.PORT ?? 3000, () => {
  console.log(\`listening on \${server.address().port}\`);
});
`),
    ),
    code(
      sh(`
curl -i -X POST localhost:3000/tasks
curl -s localhost:3000/tasks | jq
curl -i localhost:3000/tasks/nope        # 404
`),
    ),
    p(
      'The `POST` still ignores the request body — reading it needs a few more lines, which is the next topic. The routing is already a chain of `if` statements, which is the other half of the case Express makes.',
    ),

    h('Errors and shutdown'),
    code(
      js(`
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(\`port \${port} is already in use\`);
    process.exit(1);
  }
  throw err;
});

// A handler that throws does NOT crash the server — but it does leave the
// request hanging forever unless you catch it yourself.
const server = http.createServer(async (req, res) => {
  try {
    await handle(req, res);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) send(res, 500, { error: 'Internal error' });
  }
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
`),
    ),
    note(
      '`server.close()` stops accepting new connections and waits for in-flight requests to finish. It does **not** close idle keep-alive connections — `server.closeIdleConnections()` does, and `server.closeAllConnections()` is the blunt version. This is the graceful-shutdown machinery from `process-and-env`, on a real server.',
    ),

    h('Useful settings'),
    table(
      ['Setting', 'Default', 'Why change it'],
      [
        ['`server.keepAliveTimeout`', '5 s', 'Must be **longer** than your load balancer\'s idle timeout, or you get random 502s'],
        ['`server.headersTimeout`', '60 s', 'Caps how long a client may take to send headers — a slowloris defence'],
        ['`server.requestTimeout`', '300 s', 'Caps the whole request'],
        ['`server.maxHeadersCount`', '2000', 'Rarely touched'],
      ],
    ),

    h('Cheatsheet'),
    cheat([
      ['Create a server', '`http.createServer((req, res) => {})`'],
      ['Start it', '`server.listen(port, cb)`'],
      ['Parse the path and query', '`new URL(req.url, "http://" + req.headers.host)`'],
      ['Send JSON', '`writeHead(status, headers)` then `end(JSON.stringify(x))`'],
      ['Set `Content-Length`', '`Buffer.byteLength(payload)`'],
      ['Redirect', '`writeHead(302, { Location: "/x" }); res.end()`'],
      ['Handle a port clash', 'Listen for `error` and check `EADDRINUSE`'],
      ['Shut down cleanly', '`server.close()` on `SIGTERM`'],
    ]),

    h('Interview'),
    asked([
      ['How do you create an HTTP server without a framework?', '`http.createServer((req, res) => …)` and `server.listen(port)`.'],
      ['What are `req` and `res`?', 'Streams — `req` is Readable (the body), `res` is Writable.'],
      ['`res.write` vs `res.end`?', '`write` sends a piece; `end` sends the last piece and finishes the response. `end` is mandatory.'],
      ['Why does `res.url` not contain the host?', 'HTTP/1.1 sends only the path in the request line; the host is a header.'],
      ['What causes `ERR_HTTP_HEADERS_SENT`?', 'Setting a header or responding after the body has started — usually a missing `return`.'],
      ['Why must `keepAliveTimeout` exceed the load balancer\'s?', 'Otherwise Node closes an idle connection the balancer is about to reuse, and the balancer reports a 502.'],
    ]),

    links(
      nodeDoc('http.html#httpcreateserveroptions-requestlistener', 'http.createServer'),
      nodeDoc('http.html#class-httpserverresponse', 'http.ServerResponse'),
      nodeDoc('http.html#serverkeepalivetimeout', 'server.keepAliveTimeout'),
    ),
  ],
};
