import { asked, cheat, code, h, js, links, mdn, note, p, sh, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'HTTP is a request/response protocol made of text. A client sends a method, a path, some headers and optionally a body; the server sends back a status code, some headers and optionally a body. Everything else — REST, cookies, auth, caching — is a convention built on those two messages.',
    ),

    h('What actually goes over the wire'),
    code(
      sh(`
POST /v1/tasks?notify=true HTTP/1.1
Host: api.example.com
Content-Type: application/json
Content-Length: 32
Authorization: Bearer eyJhbGciOi...
Accept: application/json

{"title":"Ship it","done":false}
`),
    ),
    code(
      sh(`
HTTP/1.1 201 Created
Content-Type: application/json
Location: /v1/tasks/7
Content-Length: 45

{"id":7,"title":"Ship it","done":false}
`),
    ),
    p(
      'A blank line separates the headers from the body. That is the entire framing rule, and it is what the `routing-by-hand` topic later will have you parse yourself.',
    ),

    h('The request line'),
    table(
      ['Part', 'Example', 'Is'],
      [
        ['Method', '`POST`', 'What you want done'],
        ['Path', '`/v1/tasks`', 'Which resource'],
        ['Query string', '`?notify=true`', 'Parameters that modify the request'],
        ['Version', '`HTTP/1.1`', 'The protocol version'],
      ],
    ),

    h('Anatomy of a URL'),
    code(
      sh(`
https://api.example.com:443/v1/tasks/7?done=true&tag=api#notes
└─┬─┘   └──────┬───────┘ └┬┘└───┬────┘ └───────┬───────┘└─┬─┘
scheme      host        port  path          query      fragment
`),
    ),
    table(
      ['Part', 'Sent to the server?', 'Where it appears in Express'],
      [
        ['Path segment', 'Yes', '`req.params` — with a route like `/tasks/:id`'],
        ['Query string', 'Yes', '`req.query`'],
        ['Body', 'Yes', '`req.body`'],
        ['Headers', 'Yes', '`req.headers`'],
        ['**Fragment** (`#notes`)', '**No — never leaves the browser**', 'Nowhere'],
      ],
    ),
    note(
      'The fragment is browser-only. It is why a `#access_token=...` in an OAuth redirect never reaches your server logs, and why you cannot route on it.',
    ),
    p('Which one to use for what:'),
    table(
      ['Use', 'For'],
      [
        ['Path', 'Identifying the resource — `/tasks/7`'],
        ['Query', 'Filtering, sorting, paginating, options — `?status=open&page=2`'],
        ['Body', 'The data being created or updated'],
        ['Headers', 'Metadata about the request — auth, content type, caching'],
      ],
    ),
    warn(
      'Never put a secret in a path or a query string. URLs are logged by every proxy, load balancer and browser history along the way. Tokens go in the `Authorization` header or a cookie.',
    ),

    h('Headers worth knowing'),
    table(
      ['Header', 'Direction', 'Says'],
      [
        ['`Content-Type`', 'Both', 'The format of *this* message\'s body — `application/json`'],
        ['`Accept`', 'Request', 'The formats the client can handle'],
        ['`Content-Length`', 'Both', 'Body size in **bytes**'],
        ['`Authorization`', 'Request', '`Bearer <token>` or `Basic <base64>`'],
        ['`Cookie` / `Set-Cookie`', 'Request / Response', 'Session state'],
        ['`Location`', 'Response', 'Where the new resource is, or where to redirect'],
        ['`Cache-Control`', 'Both', 'How long this may be cached'],
        ['`ETag` / `If-None-Match`', 'Response / Request', 'A version tag for conditional requests'],
        ['`X-Forwarded-For`', 'Request', 'The original client IP, added by a proxy'],
      ],
    ),
    p(
      'Header names are case-insensitive. Node lowercases every incoming one, so `req.headers["content-type"]` always works and `req.headers["Content-Type"]` never does.',
    ),

    h('Statelessness'),
    p(
      'Each request is independent — the server keeps nothing between them by default. Everything needed to serve a request must be *in* that request: the token, the parameters, the body.',
    ),
    code(
      js(`
// Stateful: only works if the same process handles both requests.
let currentUser;
app.post('/login', (req, res) => { currentUser = req.body.user; });
app.get('/me', (req, res) => res.json(currentUser));   // breaks with 2 instances

// Stateless: the request carries its own identity.
app.get('/me', authenticate, (req, res) => res.json(req.user));
`),
    ),
    tip(
      'This is why statelessness is a scaling property, not a purity argument. The moment you run two instances behind a load balancer, in-memory per-user state is wrong — the second request lands on the other instance and finds nothing.',
    ),

    h('Connections'),
    table(
      ['Version', 'Connections', 'Notes'],
      [
        ['HTTP/1.0', 'One per request', 'A new TCP handshake every time'],
        ['HTTP/1.1', 'Kept alive and reused', 'But one request at a time per connection — head-of-line blocking'],
        ['HTTP/2', 'One connection, many multiplexed streams', 'Binary framing, header compression, server push'],
        ['HTTP/3', 'The same over QUIC/UDP', 'No TCP head-of-line blocking'],
      ],
    ),
    note(
      'In practice a Node service usually speaks HTTP/1.1, with a reverse proxy (nginx, an ALB, Cloudflare) terminating TLS and HTTP/2 in front of it. That is the `deployment` topic — but it is why your Node server can stay simple.',
    ),

    h('Seeing it yourself'),
    code(
      sh(`
curl -v https://api.github.com/repos/nodejs/node    # > request, < response
curl -i localhost:3000/tasks                        # response headers + body
curl -X POST localhost:3000/tasks \\
  -H 'Content-Type: application/json' \\
  -d '{"title":"Ship it"}'
curl -s -o /dev/null -w '%{http_code} %{time_total}\\n' localhost:3000/tasks
`),
    ),

    h('Cheatsheet'),
    cheat([
      ['Identify a resource', 'The path'],
      ['Filter or paginate', 'The query string'],
      ['Send data', 'The body, with a `Content-Type`'],
      ['Send a token', 'The `Authorization` header — never the URL'],
      ['Say where a new thing lives', 'A `Location` header with `201`'],
      ['Find the real client IP behind a proxy', '`X-Forwarded-For`, and trust it only from your proxy'],
      ['Debug a request', '`curl -v`'],
    ]),

    h('Interview'),
    asked([
      ['What happens between a request and a response?', 'DNS, TCP (and TLS), the request line plus headers and optional body, then a status line plus headers and body.'],
      ['Path param vs query param vs body?', 'Path identifies the resource, query modifies the request, body carries the data.'],
      ['What does stateless mean?', 'The server keeps nothing between requests; each one carries everything needed to serve it.'],
      ['Why does the fragment never reach the server?', 'Browsers strip it — it is a client-side anchor, not part of the request.'],
      ['Why not put a token in the URL?', 'URLs are logged by proxies, browsers and analytics along the whole path.'],
      ['HTTP/1.1 vs HTTP/2?', 'Keep-alive with one request at a time versus multiplexed streams over one connection with header compression.'],
    ]),

    links(
      mdn('Web/HTTP/Overview', 'An overview of HTTP'),
      mdn('Web/HTTP/Messages', 'HTTP messages'),
      mdn('Web/HTTP/Headers', 'HTTP headers'),
    ),
  ],
};
