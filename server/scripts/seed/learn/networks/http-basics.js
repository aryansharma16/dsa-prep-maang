import { asked, cheat, code, h, links, mdn, note, p, sh, table, tip, ul, warn } from '../blocks.js';

/*
  The Node track already teaches HTTP from inside a server — req, res, headers,
  routing. This one is deliberately the outside view: what is on the wire, what
  the status families mean to a proxy, and which headers change how far a
  response travels. Where they overlap the prose says which page to read.
*/
export const doc = {
  blocks: [
    p(
      'HTTP is a **text request and a text response**, over a TCP connection, with a blank line separating headers from body. Everything you know as "the web" — REST, cookies, auth, caching, CORS — is convention layered on those two messages.',
    ),
    note(
      'The Node track covers HTTP from **inside a server**: `req`, `res`, routing, middleware. This page is the outside view — what is on the wire, and which parts of it the proxies, load balancers and caches between you and the user actually read.',
    ),

    h('On the wire'),
    code(
      sh(`
POST /v1/tasks?notify=true HTTP/1.1        <- request line
Host: api.example.com                      <- headers
Content-Type: application/json
Content-Length: 32
Authorization: Bearer eyJhbGciOi...
                                           <- blank line
{"title":"Ship it","done":false}           <- body
`),
    ),
    code(
      sh(`
HTTP/1.1 201 Created                       <- status line
Content-Type: application/json
Location: /v1/tasks/7
Cache-Control: no-store

{"id":7,"title":"Ship it","done":false}
`),
    ),
    p(
      '`Host` is load-bearing: it is what lets one IP address serve thousands of sites, because the server cannot otherwise tell which one you meant. HTTP/1.0 lacked it, which is why virtual hosting arrived with 1.1.',
    ),

    h('The methods, and the two properties that matter'),
    table(
      ['Method', 'Does', 'Safe', 'Idempotent'],
      [
        ['`GET`', 'Read', 'Yes', 'Yes'],
        ['`HEAD`', 'Read headers only', 'Yes', 'Yes'],
        ['`OPTIONS`', 'Ask what is allowed — used by CORS preflight', 'Yes', 'Yes'],
        ['`POST`', 'Create, or “do something”', 'No', '**No**'],
        ['`PUT`', 'Replace at a known URL', 'No', 'Yes'],
        ['`PATCH`', 'Partially update', 'No', 'Not necessarily'],
        ['`DELETE`', 'Remove', 'No', 'Yes'],
      ],
    ),
    ul(
      '**Safe** — does not change anything. A crawler or a prefetch may call it without asking. Never put a state change behind a `GET`.',
      '**Idempotent** — calling it five times leaves the same state as calling it once. This is what makes automatic **retries** safe, and it is why a proxy, a load balancer or an HTTP client will happily retry a `GET` or a `PUT` and refuse to retry a `POST`.',
    ),
    tip(
      'That retry rule is the practical reason interviewers ask about idempotency. If a `POST /payments` times out you do not know whether it happened — hence idempotency keys, which the Node track’s `versioning-and-idempotency` topic covers.',
    ),

    h('Status codes'),
    table(
      ['Family', 'Means', 'You will use'],
      [
        ['**1xx**', 'Informational', '`101 Switching Protocols` — the WebSocket upgrade'],
        ['**2xx**', 'It worked', '`200 OK`, `201 Created`, `204 No Content`'],
        ['**3xx**', 'Go elsewhere', '`301` permanent, `302`/`307` temporary, `304 Not Modified`'],
        ['**4xx**', '**You** got it wrong', '`400`, `401`, `403`, `404`, `409`, `422`, `429`'],
        ['**5xx**', '**The server** got it wrong', '`500`, `502`, `503`, `504`'],
      ],
    ),
    table(
      ['Code', 'Precisely'],
      [
        ['`304 Not Modified`', 'Your cached copy is still good — no body sent. The ETag mechanism'],
        ['`401 Unauthorized`', 'Actually *unauthenticated* — you have not proved who you are'],
        ['`403 Forbidden`', 'We know who you are and you still may not'],
        ['`409 Conflict`', 'The request clashes with current state — a duplicate, a stale version'],
        ['`429 Too Many Requests`', 'Rate limited. Send `Retry-After`'],
        ['`502 Bad Gateway`', 'A proxy got an invalid response from upstream — **your app is broken or down**'],
        ['`503 Service Unavailable`', 'Deliberately not serving — overloaded, or in maintenance'],
        ['`504 Gateway Timeout`', 'A proxy gave up waiting — **your app is too slow**'],
      ],
    ),
    warn(
      'The 502/504 distinction is asked constantly and is genuinely useful at 3am: **502 means an answer came back and it was garbage or the connection was refused; 504 means no answer came back in time.** One points at a crash, the other at a slow query or a deadlock.',
    ),

    h('The headers that decide how far a response travels'),
    p('The proxies, CDNs and browsers in between read a small subset of headers, and these are the ones that change their behaviour:'),
    table(
      ['Header', 'Effect'],
      [
        ['`Host`', 'Which site on this IP — routing at every proxy'],
        ['`Cache-Control`', 'Whether and for how long anyone may cache this'],
        ['`ETag` / `If-None-Match`', 'Revalidation — enables the empty-bodied `304`'],
        ['`Vary`', 'Which request headers change the response — a cache key modifier'],
        ['`Content-Encoding` / `Accept-Encoding`', 'gzip or brotli compression'],
        ['`Connection: keep-alive`', 'Reuse this TCP connection for the next request'],
        ['`X-Forwarded-For` / `X-Forwarded-Proto`', 'The original client IP and scheme, added by proxies'],
        ['`Strict-Transport-Security`', 'Never speak plain HTTP to this host again'],
      ],
    ),
    warn(
      'Forgetting `Vary: Accept-Encoding` — or `Vary: Origin` on a CORS response — is how a CDN serves a gzipped body to a client that cannot decompress it, or one origin’s CORS headers to a different origin. Cache keys are a networking bug, not an application one.',
    ),

    h('Statelessness'),
    p(
      'HTTP keeps nothing between requests. Every request must carry everything needed to serve it — the token, the parameters, the body. This is not a purity argument: the moment you run two instances behind a load balancer, in-memory per-user state is simply wrong, because the next request lands on the other instance.',
    ),
    p(
      'Cookies and tokens do not make HTTP stateful. They make each request **self-describing**, so that state can live somewhere both instances can see — a database, Redis, or the signed token itself.',
    ),

    h('Seeing it'),
    code(
      sh(`
curl -v https://api.example.com/tasks              # > request, < response, TLS details
curl -I https://example.com                        # headers only (HEAD)
curl -s -o /dev/null -w '%{http_code} %{time_total}s\\n' https://example.com
curl --http1.1 -v https://example.com              # force a version
`),
    ),

    h('Cheatsheet'),
    cheat([
      ['Serve many sites on one IP', 'The `Host` header'],
      ['Make a retry safe', 'Use an idempotent method, or an idempotency key'],
      ['Say “created”', '`201` with a `Location` header'],
      ['Say “nothing to send back”', '`204`'],
      ['Say “your cached copy is fine”', '`304`, via `ETag`'],
      ['Say “rate limited”', '`429` with `Retry-After`'],
      ['Diagnose 502 vs 504', 'Bad answer versus no answer in time'],
      ['Stop a CDN mixing up variants', '`Vary` on the headers that change the body'],
    ]),

    h('Interview'),
    asked([
      ['What does an HTTP request contain?', 'A method, path and version; headers; a blank line; and an optional body.'],
      ['Safe vs idempotent?', 'Safe changes nothing; idempotent means repeating it has the same effect as doing it once — which is what makes retries safe.'],
      ['Is POST idempotent?', 'No, which is why clients and proxies will not retry it automatically and why idempotency keys exist.'],
      ['401 vs 403?', 'Not authenticated versus authenticated but not permitted.'],
      ['502 vs 504?', '502 is an invalid or refused upstream response; 504 is upstream not responding in time.'],
      ['Why is HTTP called stateless?', 'The server keeps nothing between requests; each one carries everything needed, which is what lets any instance serve it.'],
      ['What does Vary do?', 'Tells caches which request headers change the response, so they key their entries correctly.'],
    ]),

    links(
      mdn('Web/HTTP/Guides/Overview', 'An overview of HTTP'),
      mdn('Web/HTTP/Status', 'HTTP status codes'),
      mdn('Web/HTTP/Methods', 'HTTP request methods'),
    ),
  ],
};
