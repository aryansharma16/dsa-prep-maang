import { asked, code, diagram, flow, h, links, p, quick, sh, table, tip, warn, wiki } from '../blocks.js';
import { seeAlso } from './shapes.js';

export const doc = {
  blocks: [
    p(
      'A CDN is a cache with a geography. It puts copies of your bytes in hundreds of locations so that **most requests never reach you at all** — which makes it simultaneously the biggest latency win and the biggest cost saving available in a user-facing system.',
    ),

    flow(['User', 'Nearest edge', 'Hit? serve', 'Miss? origin'], 'The whole idea'),

    h('Why it works'),
    diagram(
      `
   WITHOUT CDN                       WITH CDN

   user (Mumbai)                     user (Mumbai)
        │  150 ms                         │  5 ms
        ▼                                 ▼
   origin (Virginia)                 edge (Mumbai)
                                          │  miss only
   every request:                         ▼
     ▸ 150ms round trip              origin (Virginia)
     ▸ your bandwidth
     ▸ your CPU                      ~95% of requests stop at the edge
                                          │
   100 TB/month egress                    ▼
     ≈ $5,000+                       origin sees ~5% of traffic
`,
      'Distance is the cost, and the edge removes it',
    ),
    table(
      ['Saves', 'How much'],
      [
        ['**Latency**', '150ms → 5ms for a cache hit. Physics, not optimisation'],
        ['**Origin bandwidth**', '90–99% of bytes never leave your infrastructure'],
        ['**Origin CPU**', 'The request is never processed'],
        ['**Availability**', 'The edge serves even when origin is down, if configured to'],
        ['**DDoS absorption**', 'Hundreds of POPs absorb what one origin cannot'],
      ],
    ),

    h('Push versus pull'),
    table(
      ['', 'Pull (lazy)', 'Push (pre-positioned)'],
      [
        ['First request', 'Misses, fetches from origin', 'Already there'],
        ['Setup', 'Point the CDN at an origin. That is it', 'You upload to the CDN'],
        ['Good for', '**Almost everything** — long tail content', 'Known, scheduled, huge releases'],
        ['Storage cost', 'Only what is requested', 'Everything, everywhere'],
        ['Example', 'A social network\'s billions of images', 'A film released at midnight; a live event'],
      ],
    ),
    tip(
      'Pull is the default and almost always right. Push earns its place only when **the first request must be fast** — a scheduled launch, a live stream — because with pull, the first viewer at every edge pays the origin round trip.',
    ),

    h('Cache-Control is the contract'),
    code(
      sh(`
# immutable, hashed filename — cache for a year, never revalidate
Cache-Control: public, max-age=31536000, immutable

# HTML — always revalidate, but a hit is cheap
Cache-Control: public, no-cache

# CDN caches it for an hour, browser for a minute
Cache-Control: public, max-age=60, s-maxage=3600

# personalised — never store it anywhere shared
Cache-Control: private, no-store

# serve stale while fetching fresh in the background
Cache-Control: public, max-age=60, stale-while-revalidate=600
`),
    ),
    table(
      ['Directive', 'Means'],
      [
        ['`max-age`', 'Seconds any cache may serve it without asking'],
        ['`s-maxage`', 'Same, but for **shared** caches only — overrides `max-age` at the CDN'],
        ['`public` / `private`', 'May a shared cache store it? `private` means browser only'],
        ['`no-cache`', 'Store it, but revalidate before serving. **Not** "do not cache"'],
        ['`no-store`', 'Never write it down anywhere. This is the real one'],
        ['`immutable`', 'Never revalidate — the URL implies the content'],
        ['`stale-while-revalidate`', 'Serve stale immediately, refresh in the background'],
      ],
    ),
    warn(
      '`no-cache` and `no-store` are the most-confused pair in HTTP. **`no-cache` stores and revalidates; `no-store` never writes it down.** Using `no-cache` for a bank statement is a caching bug with a compliance consequence.',
    ),

    h('Invalidation'),
    p(
      'Purging across hundreds of POPs takes seconds to minutes and is rate-limited by most providers. So the good answer is to **avoid needing it**.',
    ),
    table(
      ['Strategy', 'How it works', 'Verdict'],
      [
        ['**Versioned URLs**', '`app.a3f9c1.js` — new content, new URL', '**The answer.** Cache forever, never purge'],
        ['**Short TTL**', 'Expires on its own', 'Fine for HTML; wasteful for assets'],
        ['**Purge by path**', 'Explicitly evict one URL', 'Works, slow, rate-limited'],
        ['**Purge by tag**', 'Evict everything tagged `product-42`', 'Best purge mechanism, if your CDN has it'],
        ['**Purge everything**', 'Nuclear', 'A thundering herd on your origin. Avoid'],
      ],
    ),
    tip(
      'The versioned-URL pattern is why build tools hash filenames: **content that can never change at a given URL never needs invalidating.** The only thing with a short TTL is the small HTML document that points at the hashed assets.',
    ),

    h('What the edge can do besides serve files'),
    table(
      ['Capability', 'Why it is useful'],
      [
        ['**TLS termination**', 'The handshake happens 5ms away instead of 150ms away'],
        ['**Compression and image transformation**', 'Resize and re-encode per device at the edge'],
        ['**Edge functions**', 'A/B routing, auth checks, redirects — without a round trip'],
        ['**WAF and bot filtering**', 'Drop bad traffic before it costs you anything'],
        ['**Origin shield**', 'A mid-tier cache so many POPs missing at once become one origin fetch'],
      ],
    ),
    warn(
      'Without an **origin shield**, a cold popular object is fetched from origin once per POP — hundreds of simultaneous identical requests. It is a cache stampede with geography, and the shield is the standard fix.',
    ),

    h('What not to put behind a CDN'),
    table(
      ['Content', 'Why'],
      [
        ['Personalised HTML', 'Cache key would have to include the user — hit rate near zero'],
        ['Authenticated API responses', 'Risk of serving one user\'s data to another'],
        ['Anything with `Set-Cookie`', 'A cached response can pin one session onto everyone'],
        ['Rapidly changing data', 'The TTL would be shorter than the propagation time'],
      ],
    ),

    h('Interview'),
    quick([
      ['What it is', 'A geographically distributed cache in front of your origin'],
      ['Why it exists', 'Distance costs latency and bandwidth costs money'],
      ['Use when', 'Any static or cacheable content served to users spread over a geography'],
      ['Trade-off', 'Cheap and fast, at the cost of staleness and slow invalidation'],
      [
        '30-second answer',
        '"A CDN caches content at hundreds of edge locations so most requests never reach the origin — 150ms becomes 5ms, and 90-plus percent of bandwidth disappears. Pull is the default; push only for scheduled launches where the first request must be fast. Cache-Control is the contract, and the key move is versioned URLs with hashed filenames, so assets are immutable and never need purging. Watch for per-POP stampedes on cold objects — that is what an origin shield fixes."',
      ],
    ]),
    asked([
      ['Push or pull CDN?', 'Pull almost always. Push only when the first request must not miss — a scheduled release or a live event.'],
      ['How do you invalidate a CDN?', 'Prefer not to — use versioned URLs. Otherwise purge by tag, then by path.'],
      ['no-cache vs no-store?', 'no-cache stores and revalidates. no-store never writes it down. They are frequently confused.'],
      ['What should not be cached?', 'Personalised or authenticated responses, and anything setting a cookie.'],
      ['What is an origin shield?', 'A mid-tier cache so hundreds of POPs missing simultaneously become one origin fetch.'],
    ]),

    seeAlso('Computer Networks', 'CDN and caching', 'how a POP is selected and the anycast routing underneath'),
    links(
      wiki('Content_delivery_network', 'Content delivery network'),
      wiki('Cache-Control', 'Cache-Control'),
    ),
  ],
};
