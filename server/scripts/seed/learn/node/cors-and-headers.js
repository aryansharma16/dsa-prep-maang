import { asked, cheat, code, h, js, link, links, note, p, sh, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'CORS is the most misunderstood thing in web development, and the misunderstanding has a single root: **CORS is enforced by the browser, to protect the user, and it protects your server from nothing.** Once that is clear, everything else about it follows.',
    ),

    h('What it actually is'),
    p(
      'The **same-origin policy** is the browser rule: script on `a.com` cannot read a response from `b.com`. That is what stops a random page reading your bank\'s API using your cookies. CORS is the mechanism by which `b.com` can say "actually, `a.com` may read this".',
    ),
    table(
      ['CORS is', 'CORS is not'],
      [
        ['A **relaxation** of the same-origin policy', 'A restriction you are adding'],
        ['Enforced by browsers', 'Enforced by your server'],
        ['Protection for the **user**', 'Protection for your server'],
        ['About **reading the response**', 'About the request arriving'],
      ],
    ),
    warn(
      'Two consequences people get wrong. Your request succeeded in Postman and fails in the browser because **Postman is not a browser** — there is no policy to enforce. And a blocked request usually still **reached your server and ran**; the browser only refused to hand the response to the script.',
    ),

    h('An origin'),
    code(
      sh(`
https://app.example.com:443
└─┬──┘  └───────┬──────┘└┬┘
scheme       host      port      — all three must match

https://app.example.com   vs  http://app.example.com    different (scheme)
https://app.example.com   vs  https://api.example.com   different (host)
https://app.example.com   vs  https://app.example.com:8080  different (port)
`),
    ),

    h('Simple and preflighted'),
    p(
      'Some requests go straight out; others are preceded by an `OPTIONS` request asking permission. Which is which explains most confusing CORS behaviour.',
    ),
    table(
      ['Simple — no preflight', 'Preflighted'],
      [
        ['`GET`, `HEAD`, `POST`', 'Any other method — `PUT`, `PATCH`, `DELETE`'],
        ['`Content-Type` of `text/plain`, `application/x-www-form-urlencoded` or `multipart/form-data`', '`application/json` — **this is why almost every API call is preflighted**'],
        ['Only a short list of headers', 'Any custom header, including `Authorization`'],
      ],
    ),
    code(
      sh(`
# The preflight
OPTIONS /v1/tasks HTTP/1.1
Origin: https://app.example.com
Access-Control-Request-Method: POST
Access-Control-Request-Headers: content-type, authorization

# The permission
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Methods: GET, POST, PATCH, DELETE
Access-Control-Allow-Headers: content-type, authorization
Access-Control-Allow-Credentials: true
Access-Control-Max-Age: 86400
`),
    ),
    note(
      'A "simple" `POST` with `Content-Type: text/plain` is sent with no preflight and no permission needed — which is exactly the CSRF case from the last topic. CORS never had a say in it.',
    ),

    h('Configuring it'),
    code(
      sh(`
npm install cors
`),
    ),
    code(
      js(`
import cors from 'cors';

app.use(cors({
  origin: config.corsOrigins,        // ['https://app.example.com'] — a list
  credentials: true,                 // allow cookies
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['X-Total-Count', 'X-Request-Id'],
  maxAge: 86400,                     // cache the preflight for a day
}));
`),
    ),
    code(
      js(`
// A function, when the list is dynamic.
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);              // curl, server-to-server
    if (config.corsOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
`),
    ),
    warn(
      '`origin: "*"` and `credentials: true` are **incompatible** — browsers reject the combination outright, because it would let any site on the internet make credentialed requests to you. The dangerous workaround is reflecting whatever `Origin` was sent, which is `*` with the safety removed. Use a real list.',
    ),
    code(
      js(`
// The vulnerable pattern, in case you meet it:
res.setHeader('Access-Control-Allow-Origin', req.headers.origin);   // reflects ANY
res.setHeader('Access-Control-Allow-Credentials', 'true');
`),
    ),

    h('Debugging it'),
    table(
      ['Message', 'Means'],
      [
        ['"No `Access-Control-Allow-Origin` header"', 'The server sent none — CORS is off, or the request errored before it'],
        ['"…does not match the supplied origin"', 'Your allowlist does not contain that exact origin. Check scheme and port'],
        ['"…cannot be `*` when credentials mode is include"', 'You have `origin: "*"` with `credentials: true`'],
        ['"Method PATCH is not allowed"', 'Add it to `methods`'],
        ['"Request header `x-foo` is not allowed"', 'Add it to `allowedHeaders`'],
        ['The preflight returns 401', 'Auth middleware runs before CORS — `OPTIONS` carries no credentials'],
      ],
    ),
    tip(
      'That last one is the classic. `app.use(cors())` must come **before** any authentication middleware, because a preflight is anonymous by design. Put CORS at the very top of the stack.',
    ),
    code(
      js(`
app.use(helmet());
app.use(cors({ … }));            // BEFORE auth
app.use(express.json());
app.use('/v1', requireAuth, routes);
`),
    ),

    h('Security headers'),
    code(
      js(`
app.use(helmet());               // sensible defaults for everything below
app.disable('x-powered-by');     // helmet does this too
`),
    ),
    table(
      ['Header', 'Stops'],
      [
        ['`Strict-Transport-Security`', 'Any future plain-HTTP request to your domain — including the first redirect'],
        ['`X-Content-Type-Options: nosniff`', 'The browser guessing a type you did not send'],
        ['`Content-Security-Policy`', 'Injected script running — the strongest XSS defence'],
        ['`X-Frame-Options: DENY` / `frame-ancestors`', 'Clickjacking via an invisible iframe'],
        ['`Referrer-Policy`', 'Your URLs, with their ids, leaking to third parties'],
        ['`Permissions-Policy`', 'Camera, microphone and geolocation access'],
        ['`Cross-Origin-Resource-Policy`', 'Other origins embedding your resources'],
      ],
    ),
    code(
      js(`
// The two worth tuning by hand.
app.use(helmet.hsts({ maxAge: 31536000, includeSubDomains: true, preload: true }));

app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    frameAncestors: ["'none'"],
    objectSrc: ["'none'"],
  },
}));
`),
    ),
    warn(
      'HSTS with `preload` is close to irreversible — browsers ship the list baked in, and removal takes months. Do not enable `includeSubDomains` until you are certain every subdomain, including internal ones, serves HTTPS.',
    ),
    note(
      'For a pure JSON API, most of these headers do very little — there is no page to frame or inject into. They cost nothing, `helmet()` is one line, and the day someone serves an HTML page from that origin they are already there.',
    ),

    h('Checking your work'),
    code(
      sh(`
curl -I https://api.example.com/health          # see the headers

# Simulate a preflight.
curl -X OPTIONS https://api.example.com/v1/tasks \\
  -H 'Origin: https://app.example.com' \\
  -H 'Access-Control-Request-Method: POST' \\
  -H 'Access-Control-Request-Headers: content-type' -i

# Third-party graders:
# https://securityheaders.com    https://observatory.mozilla.org
`),
    ),

    h('Cheatsheet'),
    cheat([
      ['Allow a front end to call your API', '`cors({ origin: [...], credentials: true })`'],
      ['Never', '`origin: "*"` with `credentials: true`'],
      ['Never', 'Reflecting `req.headers.origin` unchecked'],
      ['Fix a 401 on the preflight', 'Put `cors()` before the auth middleware'],
      ['Reduce preflight traffic', '`maxAge: 86400`'],
      ['Let the client read a custom header', '`exposedHeaders`'],
      ['Add baseline security headers', '`app.use(helmet())`'],
      ['Force HTTPS forever', 'HSTS — carefully, with subdomains checked first'],
    ]),

    h('Interview'),
    asked([
      ['What is CORS?', 'A browser mechanism that relaxes the same-origin policy so a named origin may read your responses.'],
      ['Does CORS protect the server?', 'No — it protects the user. The request still arrives and executes.'],
      ['Why does it work in Postman but not the browser?', 'Only browsers enforce the same-origin policy.'],
      ['What triggers a preflight?', 'A non-simple method, a custom header, or `Content-Type: application/json`.'],
      ['Why can `*` not be used with credentials?', 'It would let any site make credentialed requests to you, so browsers reject the combination.'],
      ['Why is my preflight returning 401?', 'Auth middleware runs before CORS; `OPTIONS` requests carry no credentials.'],
      ['Which security headers matter most?', 'CSP for XSS, HSTS for transport, `nosniff` for content-type confusion, `frame-ancestors` for clickjacking.'],
    ]),

    links(
      link('MDN — Cross-Origin Resource Sharing', 'https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS'),
      link('Helmet', 'https://helmetjs.github.io'),
      link('OWASP — HTTP Headers Cheat Sheet', 'https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html'),
    ),
  ],
};
