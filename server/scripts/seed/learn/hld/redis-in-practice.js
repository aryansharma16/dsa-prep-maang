import { asked, code, diagram, h, links, p, quick, sh, table, tip, tradeoff, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Redis is the default answer to "and we put a cache here", and it is worth knowing why it is chosen over the simpler alternative — and where it stops being a cache and becomes **a data store you have accidentally made critical**.',
    ),

    h('Redis versus Memcached'),
    tradeoff([
      ['**Redis**', 'Data structures, persistence, pub/sub, scripting, replication, TTL per key', 'Single-threaded for commands; more to operate; easy to misuse as a database'],
      ['**Memcached**', 'Multi-threaded, simpler, slightly better raw throughput for plain get/set, less memory per key', 'Strings only, no persistence, no replication, no structures'],
    ]),
    table(
      ['Choose', 'When'],
      [
        ['**Memcached**', 'A pure key-value cache of serialised blobs, and nothing more'],
        ['**Redis**', '**Almost everything else** — and in practice, almost always'],
      ],
    ),
    tip(
      'Memcached is genuinely better at exactly one job and Redis is better at the other nine. The honest interview answer is "Memcached if it is purely a get/set blob cache, Redis otherwise" — **which is why you rarely see Memcached in a new system.**',
    ),

    h('The data structures are the point'),
    table(
      ['Structure', 'Replaces', 'Example'],
      [
        ['**String**', 'A plain cache entry', '`SET user:42 {...} EX 300`'],
        ['**Hash**', 'Reading a whole object to change one field', '`HSET user:42 name ada` — updates one field'],
        ['**List**', 'A queue or a recent-items feed', '`LPUSH feed:42 post:9` + `LTRIM feed:42 0 799`'],
        ['**Set**', 'Uniqueness and membership checks', '`SADD online 42` · `SISMEMBER`'],
        ['**Sorted set**', '**A leaderboard, a rate limiter, a delay queue**', '`ZADD scores 1500 ada` · `ZREVRANGE 0 9`'],
        ['**HyperLogLog**', 'Counting uniques exactly', '~12KB for a count of billions, ~1% error'],
        ['**Stream**', 'A lightweight log with consumer groups', 'A queue without running Kafka'],
        ['**Bitmap**', 'A boolean per user', 'Daily-active tracking in kilobytes'],
      ],
    ),
    p(
      'The sorted set is the one to remember. **A leaderboard, a sliding-window rate limiter and a scheduled-job queue are all the same structure** — score by points, by timestamp, by due time — and each of them is a few lines instead of a table and a cron job.',
    ),
    code(
      sh(`
# Top 10 leaderboard
ZADD leaderboard 1500 "ada"
ZREVRANGE leaderboard 0 9 WITHSCORES

# Sliding-window rate limit: 100 requests per 60s
ZREMRANGEBYSCORE rate:user42 0 <now-60s>   # drop what fell out
ZCARD rate:user42                          # how many remain
ZADD rate:user42 <now> <unique-id>         # record this one
EXPIRE rate:user42 60

# Delay queue: score is the due timestamp
ZADD jobs 1735689600 "send-email:42"
ZRANGEBYSCORE jobs 0 <now> LIMIT 0 10      # what is due
`),
    ),

    h('Single-threaded, and why that is fine'),
    diagram(
      `
   one thread executes commands, one at a time, in order

   ┌──────────────────────────────────────────┐
   │  client A: INCR x   ┐                    │
   │  client B: INCR x   ├──▶ [ event loop ]  │  no locks,
   │  client C: GET  x   ┘         │          │  no races,
   └───────────────────────────────┼──────────┘  every command
                                   ▼             is atomic
                              ~100k ops/s
                              per core

   ✓ INCR, SETNX, LPUSH are atomic for free
   ✓ no lock contention at any load
   ✗ ONE slow command blocks EVERYTHING

   the killers:  KEYS *        ──▶ use SCAN
                 FLUSHALL      ──▶ never, in production
                 huge LRANGE   ──▶ paginate
                 a Lua script  ──▶ keep it short
                 that loops
`,
      'Atomicity for free, at one cost',
    ),
    warn(
      '`KEYS *` on a production Redis is a genuine outage. It is O(n) over every key **on the single thread that serves every client**, so a million-key instance stops answering anyone for seconds. `SCAN` exists for exactly this reason and is cursor-based.',
    ),

    h('Persistence'),
    table(
      ['Mode', 'What it does', 'On crash you lose'],
      [
        ['**None**', 'Pure memory', 'Everything. Correct for a pure cache'],
        ['**RDB**', 'Point-in-time snapshots', 'Everything since the last snapshot — minutes'],
        ['**AOF (`everysec`)**', 'Appends every write, fsync once a second', '**~1 second** of writes'],
        ['**AOF (`always`)**', 'fsync every write', 'Nothing, and throughput drops a lot'],
        ['**RDB + AOF**', 'Both', 'The usual production choice'],
      ],
    ),
    warn(
      'Redis persistence is **not** a database durability guarantee. The default `everysec` loses about a second of writes on a crash, and replication is asynchronous so a failover can lose more. If losing a second of this data is unacceptable, it belongs in a database, not in Redis.',
    ),

    h('Clustering'),
    table(
      ['Mode', 'What it gives', 'Constraint'],
      [
        ['**Single node**', 'Simplicity', 'One machine\'s RAM; a single point of failure'],
        ['**Replication**', 'Read replicas, failover with Sentinel', 'Async — a failover can lose writes'],
        ['**Cluster**', '16,384 hash slots across nodes; horizontal memory', '**No multi-key ops across slots**'],
      ],
    ),
    tip(
      'The cluster constraint is the one that bites. A `MGET` or a transaction across keys on different slots simply fails. **Hash tags fix it** — `user:{42}:profile` and `user:{42}:settings` hash only on the braced part, so they land on the same slot and can be read together.',
    ),

    h('Ways teams get hurt'),
    table(
      ['Mistake', 'Consequence'],
      [
        ['Treating it as a durable database', 'Data loss on failover, and surprise'],
        ['No `maxmemory` policy', 'Writes start being rejected instead of evicting'],
        ['Keys with no TTL', 'Memory grows until it is full of things nobody reads'],
        ['Storing multi-MB values', 'One value blocks the thread and crowds out thousands of keys'],
        ['`KEYS` in application code', 'An outage, at the worst possible time'],
        ['Making it a hard dependency', 'Redis down becomes application down'],
      ],
    ),

    h('Interview'),
    quick([
      ['What it is', 'An in-memory data-structure server, used mostly as a cache'],
      ['Why it exists', 'Sub-millisecond shared state, with structures that replace application code'],
      ['Use when', 'Caching, sessions, rate limiting, leaderboards, locks, lightweight queues'],
      ['Trade-off', 'Speed and atomicity, at the cost of weak durability and a single thread'],
      [
        '30-second answer',
        '"Memcached is a faster plain blob cache; Redis wins on everything else, which is why it is the default. It is single-threaded, so every command is atomic with no locks — and one slow command like KEYS blocks every client. The data structures are the real value: a sorted set is a leaderboard, a sliding-window rate limiter and a delay queue. Persistence loses about a second on a crash, so it is a cache, not a database. And in cluster mode, multi-key operations need hash tags."',
      ],
    ]),
    asked([
      ['Redis or Memcached?', 'Memcached only for a pure get/set blob cache. Redis otherwise, which is almost always.'],
      ['Why is single-threaded not a problem?', 'It makes every command atomic with no locking, and one core still does ~100k ops/s. It is a problem only for slow commands.'],
      ['Is Redis durable?', 'Not really. AOF everysec loses about a second, and replication is async. Treat it as a cache.'],
      ['What is a sorted set good for?', 'Leaderboards, sliding-window rate limiters, and delay queues — all the same structure with a different score.'],
      ['What breaks in cluster mode?', 'Multi-key operations across hash slots. Use hash tags to co-locate related keys.'],
    ]),

    links(
      wiki('Redis', 'Redis'),
      wiki('Memcached', 'Memcached'),
    ),
  ],
};
