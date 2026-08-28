import { asked, cheat, code, h, links, mdn, p, sh, table, tip, ul, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'You cannot make light travel faster, and London to Sydney is about 250 ms round trip on a good day. The only way to make a distant user’s request fast is to **stop it travelling so far** — put a copy of the answer near them. That is a CDN, and it is the highest-leverage networking decision available to most applications.',
    ),

    h('What a CDN is'),
    p(
      'A **content delivery network** is a few hundred data centres — **points of presence** — spread across the world, each running a caching reverse proxy. A user’s request lands at the nearest one. If it holds a fresh copy, that is the whole journey: 10 ms instead of 250.',
    ),
    code(
      sh(`
without a CDN                    with a CDN
Sydney -> London (250ms RTT)     Sydney -> Sydney PoP (10ms)   HIT  -> done
every asset, every user          on a miss: PoP -> origin, cached for everyone after
`),
    ),
    p('And the benefits do not stop at latency, which is worth saying out loud in a design answer:'),
    ul(
      '**Origin offload.** A 95% hit rate means your servers see 5% of the traffic.',
      '**Absorbing spikes.** A launch or a link from a big site hits the edge, not your database.',
      '**DDoS absorption.** Hundreds of PoPs with far more capacity than your origin — this is most of what Cloudflare sells.',
      '**TLS and HTTP/3 at the edge**, so the handshakes are local even when the content is not.',
      '**A warm connection to the origin**, already through slow start — even a miss is faster than the user connecting directly.',
    ),

    h('How the nearest PoP is chosen'),
    p(
      'Two mechanisms, and knowing which one a provider uses is a genuinely senior detail. **DNS-based** steering answers the lookup with the nearest PoP’s address. **Anycast** advertises the *same* IP address from every PoP and lets BGP deliver each packet to the topologically closest one. Anycast reacts instantly to an outage — the routes simply reconverge — where DNS has to wait out TTLs.',
    ),

    h('The cache headers that decide everything'),
    table(
      ['Header', 'Says'],
      [
        ['`Cache-Control: max-age=3600`', 'Any cache may keep this for an hour'],
        ['`Cache-Control: public` / `private`', 'Shared caches may store it / **browser only**'],
        ['`Cache-Control: no-store`', 'Never store this anywhere — for genuinely sensitive responses'],
        ['`Cache-Control: no-cache`', '**Store it, but revalidate every time.** Not “do not cache”'],
        ['`s-maxage=86400`', 'A lifetime for shared caches only — the CDN keeps it longer than the browser'],
        ['`ETag` + `If-None-Match`', 'A version tag; an unchanged resource returns `304` with no body'],
        ['`Last-Modified` + `If-Modified-Since`', 'The same idea by timestamp'],
        ['`stale-while-revalidate=60`', 'Serve the stale copy instantly and refresh in the background'],
        ['`Vary`', 'Which request headers change the answer — part of the cache key'],
      ],
    ),
    warn(
      '`no-cache` and `no-store` are opposites in effect and the names do not help. **`no-cache` stores and revalidates; `no-store` never writes it down.** Getting them backwards is how private data ends up in a shared cache.',
    ),

    h('The pattern that solves invalidation'),
    p(
      'Cache invalidation is famously hard, and for static assets there is a trick that removes the problem instead of solving it: **put a content hash in the filename**.',
    ),
    code(
      sh(`
/static/app.a3f9c21e.js     Cache-Control: public, max-age=31536000, immutable
/index.html                 Cache-Control: no-cache
`),
    ),
    ul(
      'The hashed asset is cached **for a year** and never needs invalidating — a new build produces a **different filename**, which is a cache miss by construction.',
      'The HTML is revalidated on every load. It is small, and it is what points at the new filenames.',
      '`immutable` tells the browser not to even revalidate on a refresh.',
    ),
    tip(
      'This is why every bundler emits hashed filenames by default, and it is the answer to “how do you ship a new version of an asset the CDN has cached for a year”. You do not invalidate; you change the name. Explicit purges then remain for emergencies — a leaked file, a wrong price — and they take seconds to minutes to propagate.',
    ),

    h('Caching things that are not static files'),
    p('The interesting cases are API responses and personalised pages, and there are three moves worth knowing:'),
    table(
      ['Situation', 'Move'],
      [
        ['Public API data that changes slowly', '`s-maxage` at the CDN plus a short `max-age` in the browser'],
        ['Per-user pages', 'Cache the shell, fetch the personal parts client-side — or ESI/edge composition'],
        ['Data that changes on a write', 'Short TTL plus `stale-while-revalidate`, or purge by **surrogate key** on write'],
        ['Anything with a session cookie', '`Cache-Control: private`, and make sure `Vary: Cookie` is honest'],
      ],
    ),
    warn(
      'The nightmare in this area is **caching a personalised response in a shared cache** — user A’s dashboard served to user B. It is caused by a missing `Vary`, a missing `private`, or a CDN configured to ignore cookies. Any response that depends on who is asking must say so.',
    ),

    h('The layers of cache a response passes'),
    code(
      sh(`
browser cache -> CDN edge -> reverse proxy cache -> application cache (Redis) -> database
     ms              10ms            1ms                  1ms                  10ms+
`),
    ),
    p(
      'Each layer answers what it can. A design answer that names this ladder — and says which layer a given piece of data belongs in — reads much better than “we would add a cache”.',
    ),

    h('Checking a cache'),
    code(
      sh(`
curl -I https://example.com/static/app.js
# x-cache: Hit from cloudfront          <- CloudFront
# cf-cache-status: HIT                  <- Cloudflare
# age: 3122                             <- seconds this copy has been cached
`),
    ),

    h('Cheatsheet'),
    cheat([
      ['Make a distant user fast', 'A CDN — shorten the distance, not the server'],
      ['Cache an asset forever', 'Hashed filename + `max-age=31536000, immutable`'],
      ['Keep HTML fresh', '`no-cache` — store and revalidate'],
      ['Cache at the CDN but not the browser', '`s-maxage`'],
      ['Never store a response', '`no-store`'],
      ['Hide slow refreshes', '`stale-while-revalidate`'],
      ['Protect personalised responses', '`private`, plus an honest `Vary`'],
      ['See whether it hit', '`curl -I` and read `x-cache` / `age`'],
    ]),

    h('Interview'),
    asked([
      ['How does a CDN make a site faster?', 'It serves a cached copy from a point of presence near the user, cutting round-trip time and offloading the origin.'],
      ['How is the nearest edge chosen?', 'DNS-based geo/latency steering, or anycast where every PoP advertises the same IP and BGP picks.'],
      ['no-cache vs no-store?', 'no-cache stores but revalidates every time; no-store never writes the response down at all.'],
      ['How do you invalidate a year-long cached asset?', 'You do not — content-hashed filenames make a new build a new URL; purges are for emergencies.'],
      ['What does ETag do?', 'Versions a response so a revalidation can return 304 with no body.'],
      ['What does Vary do, and why does it matter?', 'Names the request headers that change the response so shared caches key correctly — without it a cache can serve the wrong variant.'],
      ['Can you cache API responses?', 'Yes — short s-maxage plus stale-while-revalidate for public data; anything personalised must be private.'],
    ]),

    links(
      mdn('Web/HTTP/Guides/Caching', 'HTTP caching'),
      wiki('Content_delivery_network', 'Content delivery network'),
      wiki('Anycast', 'Anycast'),
    ),
  ],
};
