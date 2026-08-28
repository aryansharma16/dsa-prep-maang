import { asked, cheat, code, h, js, links, mdn, note, p, sh, table, tip, ul, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'CORS is the error every frontend developer meets in week one and very few can explain. The explanation is short: **the browser enforces a rule that a page from one origin may not read a response from another**, and CORS is the mechanism by which the *server* opts out of that rule.',
    ),
    note(
      'This is the browser-side view. The Node track’s `cors-and-headers` topic is the server-side configuration. Read this one to understand *why* the error happens, and that one to fix it in Express.',
    ),

    h('What an origin is'),
    p('An origin is the triple **scheme + host + port**. All three must match exactly. Not the path, not the query.'),
    table(
      ['URL', 'Same origin as `https://app.example.com`?'],
      [
        ['`https://app.example.com/other/path`', '**Yes** — path is irrelevant'],
        ['`http://app.example.com`', 'No — different scheme'],
        ['`https://api.example.com`', 'No — different host'],
        ['`https://app.example.com:8443`', 'No — different port'],
        ['`https://example.com`', 'No — a subdomain is a different host'],
      ],
    ),
    warn(
      '`localhost:3000` and `localhost:8080` are **different origins**. That is why your React dev server hits CORS against your local API, and why a proxy in the dev server config is the usual fix.',
    ),

    h('The same-origin policy, and why it exists'),
    p(
      'Without it, any site you visit could `fetch("https://yourbank.com/accounts")` from your browser — **with your cookies attached** — and read the answer. The same-origin policy is what stops a random page reading your logged-in data from another site.',
    ),
    p(
      'Crucially the policy blocks **reading**, not sending. This is the single most misunderstood point:',
    ),
    ul(
      '`<img src="https://other.com/x.png">` — loads fine. You can display it, you cannot read its pixels cross-origin.',
      '`<script src="https://cdn.com/lib.js">` — runs fine. That is how every CDN works.',
      '`<form action="https://bank.com/transfer" method="POST">` — **submits fine**. The request happens. This is exactly why CSRF exists as a separate problem needing a separate defence.',
      '`fetch("https://other.com/api")` — the request is usually sent; the **response is withheld** from your JavaScript.',
    ),

    h('Why your server saw the request but the browser still failed'),
    p(
      'This is the confusing part of every CORS bug. For a **simple request** the browser sends it, the server processes it — writes to the database, sends the email — and then the browser checks the response headers and, finding no permission, refuses to hand the body to your code. **The side effects happened.** Only the reading was blocked.',
    ),
    code(
      sh(`
GET /api/tasks HTTP/1.1
Origin: https://app.example.com          <- browser adds this automatically

HTTP/1.1 200 OK
Access-Control-Allow-Origin: https://app.example.com     <- server's permission
`),
    ),
    p('Without that response header the browser logs the CORS error and your `.then` never sees the data.'),

    h('Preflight — the OPTIONS request'),
    p(
      'For anything beyond a “simple” request the browser asks permission **first**, with an `OPTIONS` request, before sending the real one. That protects servers written before CORS existed from receiving a cross-origin `DELETE` they never expected.',
    ),
    table(
      ['Simple — no preflight', 'Triggers a preflight'],
      [
        ['`GET`, `HEAD`, `POST`', '`PUT`, `PATCH`, `DELETE`'],
        ['`Content-Type: text/plain`, `application/x-www-form-urlencoded`, `multipart/form-data`', '**`Content-Type: application/json`**'],
        ['No custom headers', 'Any custom header — `Authorization`, `X-Request-Id`'],
      ],
    ),
    p(
      'Which means the ordinary case — a JSON POST with a bearer token — **always** preflights. That is why you see paired OPTIONS and POST entries in the network tab.',
    ),
    code(
      sh(`
OPTIONS /api/tasks HTTP/1.1
Origin: https://app.example.com
Access-Control-Request-Method: POST
Access-Control-Request-Headers: content-type, authorization

HTTP/1.1 204 No Content
Access-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Methods: GET, POST, PUT, DELETE
Access-Control-Allow-Headers: content-type, authorization
Access-Control-Max-Age: 86400            <- cache this permission for a day
`),
    ),
    tip(
      '`Access-Control-Max-Age` is free performance. Without it every cross-origin JSON request costs **two** round trips instead of one. Set it to 86400 and the preflight happens once a day per browser.',
    ),

    h('Credentials — the strict mode'),
    p('Sending cookies cross-origin turns on a stricter set of rules, and all three of these must line up:'),
    ul(
      'The client sets `credentials: "include"` on the fetch.',
      'The server sends `Access-Control-Allow-Credentials: true`.',
      'The server sends an **exact origin** in `Access-Control-Allow-Origin`. **`*` is forbidden with credentials** — the browser rejects it outright.',
    ),
    code(
      js(`
// Client
fetch('https://api.example.com/me', { credentials: 'include' });

// Server — echo the origin from an allowlist, never reflect it blindly
const ALLOWED = new Set(['https://app.example.com', 'https://admin.example.com']);
if (ALLOWED.has(req.headers.origin)) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Vary', 'Origin');        // or a cache will serve one origin's answer to another
}
`),
    ),
    warn(
      'Reflecting **any** `Origin` back with credentials enabled is a real vulnerability: it lets every site on the internet make authenticated requests as your logged-in users and read the answers. Always match against an allowlist. And always send `Vary: Origin`, or a shared cache will hand one origin’s permission to another.',
    ),

    h('The other question: is CORS security?'),
    p(
      'CORS **relaxes** a browser restriction. It is not a server-side access control — `curl`, Postman, a mobile app and any server ignore it entirely, because there is no browser to enforce anything. Your API still needs authentication and authorisation exactly as if CORS did not exist.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Define an origin', 'Scheme + host + port, all three exactly'],
      ['Allow one frontend', '`Access-Control-Allow-Origin: https://app.example.com`'],
      ['Allow a public read-only API', '`Access-Control-Allow-Origin: *` — no credentials'],
      ['Send cookies cross-origin', 'Exact origin + `Allow-Credentials: true` + `credentials: "include"`'],
      ['Stop the double round trip', '`Access-Control-Max-Age`'],
      ['Avoid CORS entirely', 'Same origin — a path prefix behind one load balancer, or a dev-server proxy'],
      ['Keep caches honest', '`Vary: Origin`'],
    ]),

    h('Interview'),
    asked([
      ['What is an origin?', 'Scheme, host and port together; any difference makes it cross-origin.'],
      ['What does the same-origin policy prevent?', 'A page reading responses from another origin — sending is largely still allowed.'],
      ['Why did my request reach the server but still fail?', 'The browser sent it and then withheld the response because the CORS headers did not permit reading it.'],
      ['What triggers a preflight?', 'Any method beyond GET/HEAD/POST, a JSON content type, or custom headers such as Authorization.'],
      ['Why can Allow-Origin not be * with credentials?', 'It would let every site make authenticated requests as your users and read the responses.'],
      ['Is CORS a security feature?', 'It is a browser-enforced relaxation of a browser restriction — no substitute for authentication and authorisation.'],
      ['How do you avoid CORS?', 'Serve the API from the same origin, or proxy it during development.'],
    ]),

    links(
      mdn('Web/HTTP/Guides/CORS', 'Cross-Origin Resource Sharing'),
      mdn('Web/Security/Same-origin_policy', 'Same-origin policy'),
    ),
  ],
};
