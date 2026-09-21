import { asked, diagram, h, links, p, quick, table, tip, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'A cache trades **freshness for speed and load**. It is the cheapest order of magnitude available in most systems, and the only reason not to reach for one first is that everything it makes faster, it also makes potentially wrong.',
    ),

    h('Every layer a cache lives at'),
    diagram(
      `
   request ──▶ each layer can answer, and the earlier it does,
               the cheaper everything downstream becomes

   ┌──────────────────────────────────────────────────────┐
   │ 1. BROWSER          memory + disk, per user     0 ms │
   │ 2. CDN / EDGE       shared, geographic          5 ms │
   │ 3. REVERSE PROXY    shared, your origin         1 ms │
   │ 4. APPLICATION      in-process, per instance  0.01ms │
   │ 5. DISTRIBUTED      Redis / Memcached           1 ms │
   │ 6. DATABASE         buffer pool, query cache    1 ms │
   │ 7. DISK             the thing you were avoiding 5 ms │
   └──────────────────────────────────────────────────────┘

   the question is never "should I cache" but
   "at which of these seven, and with what TTL"
`,
      'Seven layers, and each one is a decision',
    ),
    table(
      ['Layer', 'Shared?', 'Best for', 'Watch out for'],
      [
        ['**Browser**', 'No', 'Static assets, the user\'s own data', 'You cannot invalidate it'],
        ['**CDN**', 'Yes, globally', 'Anything public and static', 'Purges are slow; personalisation kills hit rate'],
        ['**App in-process**', 'No', 'Config, feature flags, hot lookups', 'Every instance has a different copy'],
        ['**Distributed (Redis)**', 'Yes', 'Sessions, computed results, hot rows', 'A network hop; a new dependency'],
        ['**Database buffer pool**', 'Per node', 'Recently read pages', 'Free — just give it enough RAM'],
      ],
    ),
    warn(
      'An **in-process cache is not one cache**, it is one per instance. Ten app servers means ten copies that can disagree, and an invalidation must reach all ten. It is excellent for data that is effectively static and a trap for anything else.',
    ),

    h('The arithmetic'),
    p('Whether a cache is worth adding is a calculation, not an instinct.'),
    diagram(
      `
   effective latency = (hit% × hit_latency) + (miss% × miss_latency)

   DB alone:            100% × 50 ms              = 50.0 ms

   80% hit rate:        0.80 × 1  +  0.20 × 51    = 11.0 ms
   95% hit rate:        0.95 × 1  +  0.05 × 51    =  3.5 ms
   99% hit rate:        0.99 × 1  +  0.01 × 51    =  1.5 ms

   note the miss path costs 51, not 50 — a miss pays the
   cache lookup AND the database.

   and the load saved:
     95% hit rate ──▶ the database sees 1/20th of the traffic
                  ──▶ 20x headroom, for one Redis instance
`,
      'Hit rate is the only number that matters',
    ),
    table(
      ['Hit rate', 'Effective latency', 'DB load', 'Verdict'],
      [
        ['**50%**', '~26 ms', '50%', 'Barely worth the complexity'],
        ['**80%**', '~11 ms', '20%', 'Good'],
        ['**95%**', '~3.5 ms', '5%', 'Excellent — the usual target'],
        ['**99%**', '~1.5 ms', '1%', 'Diminishing returns past here'],
      ],
    ),
    tip(
      'Below about 80%, question whether the cache is earning its place: you have added a dependency, an invalidation problem and a staleness window for a modest gain. **A low hit rate usually means the wrong key or too short a TTL**, not that caching was the wrong idea.',
    ),

    h('What caches well'),
    table(
      ['Cache it', 'Do not'],
      [
        ['Read far more often than written', 'Written as often as read'],
        ['Expensive to compute or fetch', 'Already a fast primary-key lookup'],
        ['Tolerates being seconds old', 'Must be exactly current — balances, stock'],
        ['Shared across many users', 'Unique per request'],
        ['Small enough to hold in memory', 'Multi-megabyte blobs (use object storage + CDN)'],
      ],
    ),
    p(
      'The bottom-left and bottom-right of that table are the two mistakes: caching something already fast adds a hop for nothing, and caching something per-request gives you a cache with a 0% hit rate and full memory.',
    ),

    h('Keys'),
    table(
      ['Principle', 'Example'],
      [
        ['Namespace them', '`user:42:profile`, not `42`'],
        ['Include everything the value depends on', '`product:42:v3:en-GB:mobile`'],
        ['Include a version for bulk invalidation', 'Bump `v3` → `v4` and the whole class is orphaned'],
        ['Keep them short', 'Keys live in memory too'],
        ['Never include a timestamp', 'A unique key per second is a cache that never hits'],
      ],
    ),
    tip(
      'A **version segment in the key** is the cheapest invalidation mechanism there is. Changing the rendering logic? Bump the version and every old entry becomes unreachable and ages out on its own — no purge, no scan, no coordination.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'A fast copy of data that is expensive to fetch or compute'],
      ['Why it exists', 'Reads dominate, and the same reads repeat'],
      ['Use when', 'Read-heavy, expensive to produce, and tolerant of staleness'],
      ['Trade-off', 'Latency and load for freshness, plus a new dependency and an invalidation problem'],
      [
        '30-second answer',
        '"Caches exist at seven layers, from the browser to the database buffer pool, and the question is which layer and what TTL. Hit rate is the whole calculation: at 95% the database sees one-twentieth of the traffic and effective latency drops from 50ms to about 3. Cache what is read far more than written, expensive to produce and tolerant of staleness. Namespace keys, include everything the value depends on, and put a version segment in them so bulk invalidation is a config change."',
      ],
    ]),
    asked([
      ['Where should the cache go?', 'As close to the user as the data allows. Static goes to the CDN; per-user computed results go in Redis.'],
      ['How much does a 90% hit rate save?', 'The database sees a tenth of the traffic, and effective latency is roughly a fifth.'],
      ['What should not be cached?', 'Data written as often as read, data that must be exact, and anything unique per request.'],
      ['In-process or distributed cache?', 'In-process for near-static config. Distributed for anything that must agree across instances.'],
      ['How do you invalidate a whole class of entries?', 'Put a version in the key and bump it. Old entries become unreachable and expire.'],
    ]),

    links(
      wiki('Cache_(computing)', 'Cache'),
      wiki('Cache_replacement_policies', 'Cache replacement policies'),
    ),
  ],
};
