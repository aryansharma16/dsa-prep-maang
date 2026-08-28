import { asked, cheat, code, h, links, note, p, sh, table, tip, ul, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'A **proxy** is a machine that makes requests on someone else’s behalf. There is only one idea here and it has two names, decided entirely by **who it is standing in for**: a *forward* proxy acts for the clients, a *reverse* proxy acts for the servers. Same software, often literally the same nginx binary, pointed the other way.',
    ),

    h('The two directions'),
    code(
      sh(`
FORWARD PROXY — sits with the clients, hides them from the internet
  [employees] -> [corporate proxy] -> the internet
  the website sees the proxy's address, not the employee's

REVERSE PROXY — sits with the servers, hides them from the internet
  clients -> [nginx / ALB / Cloudflare] -> [app1] [app2] [app3]
  the client sees one address; it has no idea how many servers exist
`),
    ),
    table(
      ['', 'Forward proxy', 'Reverse proxy'],
      [
        ['Acts for', 'The client', 'The server'],
        ['Who configures it', 'The client, or their network', 'The service owner'],
        ['Client knows it exists', 'Usually yes', '**No**'],
        ['Typical use', 'Corporate filtering, caching, anonymity, geo-bypass', 'Load balancing, TLS, caching, security'],
        ['Examples', 'Squid, a VPN, Tor', '**nginx, HAProxy, ALB, CloudFront, Cloudflare**'],
      ],
    ),
    note(
      'You will configure a reverse proxy in every real job and a forward proxy almost never — except as `HTTP_PROXY` environment variables when a build machine inside a corporate network cannot reach npm directly.',
    ),

    h('What a reverse proxy takes off your application'),
    p(
      'This is the useful half of the topic. Everything below can be done in Node; all of it is better done in front, by software written for it:',
    ),
    table(
      ['Job', 'Why in front'],
      [
        ['**TLS termination**', 'One place holds the certificate; the app speaks plain HTTP behind it'],
        ['**Load balancing**', 'Spread requests across instances, skip unhealthy ones'],
        ['**Static files**', 'nginx serves a file far faster than an application runtime'],
        ['**Compression**', 'gzip and brotli, without spending your event loop on it'],
        ['**Rate limiting**', 'Reject a flood before it reaches your code'],
        ['**Request buffering**', 'Absorb slow clients so a slow uploader does not hold an app worker'],
        ['**Caching**', 'Answer repeat requests without touching the app at all'],
        ['**Routing**', '`/api` to one service, `/` to the frontend — one origin, so no CORS'],
        ['**Timeouts and retries**', 'Give up on a hung upstream on a policy, not per handler'],
        ['**Header hygiene**', 'Strip internal headers, add security headers'],
      ],
    ),
    tip(
      'The routing row solves a problem people usually solve the hard way. Serve the frontend at `/` and the API at `/api` through **one** proxy and they are the **same origin** — no CORS, no preflights, no credential rules. It is worth designing for.',
    ),
    code(
      sh(`
server {
  listen 443 ssl;
  server_name example.com;

  location /api/ { proxy_pass http://app_servers; }     # -> Node on :3000
  location /     { root /var/www/frontend; try_files $uri /index.html; }
}
`),
    ),

    h('The header every proxy adds — and the trap in it'),
    p(
      'Once a proxy is in front, every connection your app sees comes **from the proxy**. The real client address arrives in a header instead:',
    ),
    table(
      ['Header', 'Carries'],
      [
        ['`X-Forwarded-For`', 'The original client IP — and every proxy appends, so it becomes a list'],
        ['`X-Forwarded-Proto`', '`https` or `http` — what the *user* used'],
        ['`X-Forwarded-Host`', 'The host the user asked for'],
        ['`Forwarded`', 'The standardised single-header version of all three'],
      ],
    ),
    warn(
      '**A client can send `X-Forwarded-For` too.** Trusting it blindly means anyone can forge their IP address — which breaks rate limiting, IP allowlists and audit logs all at once. Trust it only from your own proxy: in Express that is `app.set("trust proxy", 1)`, meaning "one hop I control", not `true`.',
    ),
    p(
      '`X-Forwarded-Proto` has a second consequence: without it your app thinks every request is plain HTTP, so it will refuse to set `Secure` cookies and will build `http://` redirect URLs. That is the cause of the classic infinite redirect loop behind a load balancer.',
    ),

    h('Where the words overlap'),
    ul(
      'A **load balancer** is a reverse proxy whose defining job is distribution. An ALB is both.',
      'An **API gateway** is a reverse proxy with API concerns bolted on: auth, quotas, request transformation, per-route keys.',
      'A **CDN** is a globally distributed reverse proxy that caches. Cloudflare is a reverse proxy for millions of sites at once.',
      'A **service mesh sidecar** is a proxy attached to each service, handling retries, mTLS and telemetry between them.',
    ),
    p('Four names, one shape. Being able to say that is a better answer than defining each separately.'),

    h('Cheatsheet'),
    cheat([
      ['Hide clients from the internet', 'Forward proxy'],
      ['Hide servers from the internet', 'Reverse proxy'],
      ['Terminate TLS once', 'The reverse proxy holds the certificate'],
      ['Avoid CORS between app and API', 'Route both under one origin at the proxy'],
      ['Get the real client IP', '`X-Forwarded-For`, trusted only from your proxy'],
      ['Fix a redirect loop behind a load balancer', 'Honour `X-Forwarded-Proto`'],
      ['Stop a slow client tying up a worker', 'Request buffering at the proxy'],
    ]),

    h('Interview'),
    asked([
      ['Forward vs reverse proxy?', 'A forward proxy acts for clients and hides them; a reverse proxy acts for servers and hides them.'],
      ['Why put nginx in front of a Node app?', 'TLS, static files, compression, buffering, rate limiting, routing and load balancing — all cheaper outside the runtime.'],
      ['What is X-Forwarded-For and when can you trust it?', 'The original client IP added by proxies; trust only the hop your own infrastructure appended.'],
      ['Why are all my users showing the same IP?', 'You are reading the connection address, which is the proxy — read the forwarded header instead.'],
      ['How is a CDN related to a proxy?', 'It is a globally distributed caching reverse proxy.'],
      ['How can a proxy remove your CORS problem?', 'By serving the app and the API under one origin.'],
    ]),

    links(
      wiki('Proxy_server', 'Proxy server'),
      wiki('Reverse_proxy', 'Reverse proxy'),
    ),
  ],
};
