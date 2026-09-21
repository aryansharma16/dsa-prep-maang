import { asked, code, diagram, h, js, links, p, quick, table, tip, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'The four ways a cache turns from a shield into the thing that took the site down. They share one shape: **the cache stops absorbing traffic and the database receives all of it at once**, at a moment when it has been sized on the assumption that it never would.',
    ),

    h('The four'),
    table(
      ['Name', 'What happens', 'Trigger'],
      [
        ['**Stampede**', 'One hot key expires; thousands of requests all miss and hit the DB', 'A popular key\'s TTL ends'],
        ['**Avalanche**', 'Many keys expire at once, or the cache restarts empty', 'Synchronised TTLs; a restart or failover'],
        ['**Hot key**', 'One key gets so much traffic it saturates one cache node', 'A celebrity, a viral item, a flash sale'],
        ['**Penetration**', 'Requests for data that does not exist miss every single time', 'Scans, enumeration, an attack'],
      ],
    ),

    h('Stampede'),
    diagram(
      `
   t=299  ┌──────────────────────────────────┐
          │ cache: homepage_feed  (hot key)  │  10,000 req/s
          └──────────────────────────────────┘  all HITTING
   t=300  ┌──────────────────────────────────┐
          │ EXPIRED                          │
          └──────────────────────────────────┘
   t=300  10,000 requests all MISS
              │
              ▼
          ┌──────────────────────────────────┐
          │ database: 10,000 identical        │  ← designed for 500
          │ expensive queries, simultaneously │
          └──────────────────────────────────┘
              │
              ▼
          slow ──▶ timeouts ──▶ retries ──▶ worse
`,
      'One key, ten thousand identical misses',
    ),
    table(
      ['Fix', 'How it works', 'Trade-off'],
      [
        ['**Lock and fill**', 'One caller acquires a lock and recomputes; the rest wait or serve stale', 'The best general answer'],
        ['**Serve stale while revalidating**', 'Return the expired value, refresh in the background', '**Nobody waits.** Slightly stale'],
        ['**Probabilistic early expiry**', 'Each reader has a small chance of refreshing before the TTL', 'Elegant; spreads the work naturally'],
        ['**Refresh-ahead**', 'Refresh hot keys before they expire', 'Only practical for known-hot keys'],
      ],
    ),
    code(
      js(`
// Lock-and-fill with a stale fallback. Two keys per value: the
// value with a long TTL, and a short "fresh" marker. When the
// marker is gone, one caller refreshes and everyone else keeps
// being served the slightly-old value rather than queueing.
async function getWithStampedeGuard(key, ttl, compute) {
  const [value, isFresh] = await redis.mget(key, \`\${key}:fresh\`);

  if (value && isFresh) return JSON.parse(value);

  // NX means only one caller wins. The lock's own TTL is what
  // stops a crashed refresher blocking every future reader.
  const gotLock = await redis.set(\`\${key}:lock\`, '1', 'NX', 'EX', 30);

  if (!gotLock) {
    // Someone else is refreshing. Stale beats waiting, and beats
    // adding one more query to a database that is already busy.
    if (value) return JSON.parse(value);
    await sleep(50);
    return getWithStampedeGuard(key, ttl, compute);
  }

  try {
    const fresh = await compute();
    await redis.set(key, JSON.stringify(fresh), 'EX', ttl * 3);
    await redis.set(\`\${key}:fresh\`, '1', 'EX', ttl);
    return fresh;
  } finally {
    await redis.del(\`\${key}:lock\`);
  }
}
`),
    ),

    h('Avalanche'),
    diagram(
      `
   CAUSE 1 — synchronised TTLs        CAUSE 2 — cold start

   deploy warms 50,000 keys           Redis restarts / fails over
   all at t=0, all TTL 300                  │
              │                             ▼
              ▼                        cache is EMPTY
   t=300: 50,000 keys expire                │
          in the same second                ▼
              │                        100% miss rate,
              ▼                        every request to the DB
   database sees its entire
   working set requested at once      ──▶ the database was never
                                          sized for 100% of reads

   FIXES
     TTL + random(0..20%)             warm before taking traffic
     stagger the warm-up              stagger node restarts
                                      circuit-break the DB
                                      shed load rather than die
`,
      'Two causes, one outcome',
    ),
    warn(
      'The cold-start case is the more dangerous one, because it happens **during an incident** — you failed over Redis, and now the database takes 100% of the read traffic it has never been sized for. A cache failover can cause a database outage, which is a surprising and very common failure chain.',
    ),

    h('Hot key'),
    p(
      'One key is one slot on one cache node. At a million requests per second for `product:viral`, that node saturates while the rest of the cluster is idle — **consistent hashing cannot help, because the problem is one key, not the spread of keys.**',
    ),
    table(
      ['Fix', 'How'],
      [
        ['**Local cache in front**', 'Each app instance holds hot keys in-process for a second or two'],
        ['**Replicate the key**', '`product:42:copy0..9`; read a random one'],
        ['**Client-side tracking**', 'Redis can notify clients which keys are hot so they cache locally'],
        ['**Dedicated capacity**', 'Give the known hot keys their own cache cluster'],
      ],
    ),
    tip(
      'A **one-second in-process cache** is the cheapest and most effective fix for a read hot key. It caps the traffic any one key can send to Redis at one request per instance per second, and one second of staleness on a viral item is invisible.',
    ),

    h('Penetration'),
    diagram(
      `
   request for user:99999999  (does not exist)

   cache ──▶ MISS
   db    ──▶ null
   cache ──▶ (nothing cached — there is nothing to cache)

   next identical request: MISS again. and again. forever.

   an attacker enumerating ids sends 100% of traffic
   straight through the cache to the database.

   FIXES
     ▸ CACHE THE NULL, with a short TTL (30-60s)
     ▸ a bloom filter of ids that exist — reject before the DB
     ▸ validate the id format first (a 40-char "id" is not real)
     ▸ rate limit by client
`,
      'Caching nothing is still caching',
    ),
    warn(
      'Caching negative results needs a **short** TTL and invalidation on create. Otherwise a user who signs up is told they do not exist for the next hour — a real bug that comes directly from the fix.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'The four ways a cache stops protecting the database'],
      ['Why it matters', 'These cause outages, and they cause them during other incidents'],
      ['Use when', 'Asked "what happens when the cache fails?" — which is always'],
      ['Trade-off', 'Every fix trades a little staleness for a lot of protection'],
      [
        '30-second answer',
        '"Four, and they all end the same way — the database takes traffic it was never sized for. A stampede is one hot key expiring into thousands of identical misses: fix with lock-and-fill, serving stale while one caller refreshes. An avalanche is many keys expiring together or the cache restarting empty, so jitter TTLs and warm before taking traffic. A hot key saturates one node, so cache it in-process for a second. Penetration is repeated misses for data that does not exist — cache the null."',
      ],
    ]),
    asked([
      ['What is a cache stampede?', 'A hot key expires and every concurrent request misses at once, hitting the database simultaneously.'],
      ['How do you prevent one?', 'Lock-and-fill so one caller recomputes, and serve the stale value to everyone else meanwhile.'],
      ['What happens when the cache restarts?', '100% miss rate against a database sized for a fraction of reads. Warm it before taking traffic.'],
      ['How do you handle a hot key?', 'A short in-process cache in every app instance, or replicate the key across suffixes.'],
      ['What is cache penetration?', 'Requests for non-existent data miss every time. Cache the null result with a short TTL, or use a bloom filter.'],
    ]),

    links(
      wiki('Cache_stampede', 'Cache stampede'),
      wiki('Thundering_herd_problem', 'Thundering herd'),
    ),
  ],
};
