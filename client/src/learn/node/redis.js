import { asked, cheat, code, h, js, link, links, note, p, sh, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Redis is an in-memory data structure server. Everything lives in RAM, so a read is tens of microseconds against a database\'s milliseconds — and it is single-threaded for commands, which means every operation is atomic without you asking. Those two properties are why it ends up doing four unrelated jobs in most backends: caching, sessions, rate limiting and queues.',
    ),

    h('Getting one running'),
    code(
      sh(`
docker run --name redis -p 6379:6379 -d redis:7-alpine

redis-cli
> set greeting hello
> get greeting
> ttl greeting        # -1 = no expiry
> keys *              # NEVER in production — see below
> info memory
`),
    ),
    code(
      sh(`
npm install redis          # the official client
# or: npm install ioredis  # the other common one; better cluster support
`),
    ),
    code(
      js(`
// db/redis.js — one client per process, like the Postgres pool
import { createClient } from 'redis';

export const redis = createClient({ url: config.redisUrl });

redis.on('error', (err) => log.error({ err }, 'redis error'));
await redis.connect();
`),
    ),
    warn(
      'A Redis client that loses its connection emits `error`. With no listener that is an unhandled `error` event, and the process dies — the same `EventEmitter` rule from earlier in the track. Attach the listener before you connect.',
    ),

    h('The data types'),
    table(
      ['Type', 'Is', 'Used for'],
      [
        ['**String**', 'Bytes, up to 512 MB', 'Cached JSON, counters, flags'],
        ['**Hash**', 'A map of field → value', 'An object where you update one field'],
        ['**List**', 'A linked list', 'Simple queues, recent-items feeds'],
        ['**Set**', 'Unordered, unique', 'Tags, "who is online", deduplication'],
        ['**Sorted set**', 'Unique members, each with a score', 'Leaderboards, sliding-window rate limits, delayed jobs'],
        ['**Stream**', 'An append-only log with consumer groups', 'Event streams, durable queues'],
      ],
    ),
    code(
      js(`
// Strings — the 90% case
await redis.set('user:7', JSON.stringify(user), { EX: 300 });   // 5 min TTL
const raw = await redis.get('user:7');
await redis.del('user:7');
await redis.incr('views:page:1');                                // atomic

// Hash — update one field without rewriting the object
await redis.hSet('user:7', { name: 'Ada', role: 'admin' });
await redis.hGet('user:7', 'role');
await redis.hGetAll('user:7');

// Set — membership
await redis.sAdd('online', userId);
await redis.sIsMember('online', userId);
await redis.sCard('online');                                     // count

// Sorted set — ranked
await redis.zAdd('leaderboard', { score: 120, value: 'ada' });
await redis.zRangeWithScores('leaderboard', 0, 9, { REV: true }); // top 10
`),
    ),
    tip(
      'Redis stores bytes, not objects. Everything is `JSON.stringify` on the way in and `JSON.parse` on the way out — so a `Date` comes back a string, and `undefined` fields vanish. Wrap that in one `getJson`/`setJson` pair rather than repeating it.',
    ),

    h('Expiry'),
    code(
      js(`
await redis.set('k', v, { EX: 300 });        // expire in 300 seconds
await redis.set('k', v, { PX: 500 });        // milliseconds
await redis.set('k', v, { EX: 300, NX: true });  // only if it does not exist
await redis.expire('k', 60);                 // add a TTL to an existing key
await redis.ttl('k');                        // seconds left, -1 none, -2 gone
`),
    ),
    warn(
      '**Every cache key needs a TTL.** A key without one lives until something deletes it, and the thing that eventually deletes it is the eviction policy under memory pressure — which evicts whatever it likes, including your session store. Set `maxmemory-policy` deliberately: `allkeys-lru` for a pure cache, `volatile-lru` when the same instance also holds data that must not vanish.',
    ),

    h('Cache-aside'),
    p('The pattern you will write most: look in the cache, fall back to the database, put the result back.'),
    code(
      js(`
// services/tasks.service.js
const KEY = (id) => \`task:\${id}\`;
const TTL = 300;

export async function getTask(id) {
  const cached = await redis.get(KEY(id));
  if (cached) return JSON.parse(cached);           // hit

  const task = await repo.findById(id);            // miss
  if (!task) return null;

  await redis.set(KEY(id), JSON.stringify(task), { EX: TTL });
  return task;
}

// Any write invalidates. Delete, do not update — see below.
export async function updateTask(id, patch) {
  const task = await repo.update(id, patch);
  await redis.del(KEY(id));
  return task;
}
`),
    ),
    tip(
      'Invalidate by **deleting**, not by writing the new value in. A write-through under concurrency can leave a stale value permanently: two requests interleave, the slower one writes its older result last, and nothing corrects it until the TTL. A delete has no such ordering problem — the next read repopulates from the source of truth.',
    ),

    h('The three cache failures'),
    table(
      ['Problem', 'Is', 'Fix'],
      [
        ['**Stampede**', 'A hot key expires and 500 concurrent requests all miss and all hit the database at once', 'A short lock so one request refills, or refresh slightly before expiry'],
        ['**Penetration**', 'Requests for an id that does not exist never populate the cache, so every one reaches the database', 'Cache the negative result too, with a short TTL'],
        ['**Avalanche**', 'Many keys written together expire together, so the miss arrives as one spike', 'Add jitter to the TTL'],
      ],
    ),
    code(
      js(`
// Negative caching plus TTL jitter — a few lines that prevent two of the three.
const NOTHING = '\\u0000';

export async function getTask(id) {
  const cached = await redis.get(KEY(id));
  if (cached === NOTHING) return null;             // known-absent
  if (cached) return JSON.parse(cached);

  const task = await repo.findById(id);

  if (!task) {
    await redis.set(KEY(id), NOTHING, { EX: 30 }); // short, so a later insert appears
    return null;
  }

  const ttl = TTL + Math.floor(Math.random() * 60);   // jitter
  await redis.set(KEY(id), JSON.stringify(task), { EX: ttl });
  return task;
}
`),
    ),
    code(
      js(`
// Stampede: let one caller rebuild, make the others wait briefly and re-read.
async function withRebuildLock(key, rebuild) {
  const lock = \`lock:\${key}\`;
  const token = crypto.randomUUID();
  const got = await redis.set(lock, token, { NX: true, EX: 10 });

  if (!got) {
    await sleep(50);
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);
  }

  try { return await rebuild(); }
  finally { await releaseLock(lock, token); }      // see the lock section below
}
`),
    ),

    h('Rate limiting'),
    code(
      js(`
// Fixed window. Two commands, and INCR is atomic so no race exists.
export async function hit(key, limit, windowSec) {
  const n = await redis.incr(key);
  if (n === 1) await redis.expire(key, windowSec);
  return { allowed: n <= limit, count: n };
}

const { allowed } = await hit(\`rl:\${req.ip}\`, 100, 60);
if (!allowed) return res.status(429).set('Retry-After', '60').json({ … });
`),
    ),
    code(
      js(`
// Sliding window, with a sorted set. Accurate, and no boundary burst.
export async function slidingHit(key, limit, windowMs) {
  const now = Date.now();

  const results = await redis.multi()
    .zRemRangeByScore(key, 0, now - windowMs)          // drop what aged out
    .zAdd(key, { score: now, value: \`\${now}-\${Math.random()}\` })
    .zCard(key)
    .pExpire(key, windowMs)
    .exec();

  return results[2] <= limit;
}
`),
    ),
    note(
      '`multi()` pipelines the commands and runs them as one atomic block — no other client can interleave between them. That is what makes the read-modify-write above correct without a lock.',
    ),

    h('Distributed locks'),
    code(
      js(`
// Acquire: set only if absent, always with a TTL so a crash cannot deadlock.
const token = crypto.randomUUID();
const acquired = await redis.set('lock:report', token, { NX: true, EX: 30 });
if (!acquired) return;                    // someone else has it

// Release: ONLY if the token is still ours. This must be atomic, so it is Lua.
const RELEASE = \`
  if redis.call('get', KEYS[1]) == ARGV[1] then
    return redis.call('del', KEYS[1])
  else
    return 0
  end
\`;
await redis.eval(RELEASE, { keys: ['lock:report'], arguments: [token] });
`),
    ),
    warn(
      'The token check is not optional. Without it: your work overruns the 30-second TTL, the lock expires, another worker takes it, and then **you delete their lock**. Two workers now hold it. The Lua script makes "check it is mine, then delete" a single atomic step.',
    ),
    tip(
      'A Redis lock is best-effort, not a correctness guarantee — a failover can lose it. Use it to avoid duplicate *work*; use a database transaction or a unique constraint when duplicate work would corrupt *data*.',
    ),

    h('Pub/Sub'),
    code(
      js(`
// A subscriber connection cannot run normal commands — duplicate the client.
const sub = redis.duplicate();
await sub.connect();

await sub.subscribe('task:updated', (message) => {
  broadcastToWebSockets(JSON.parse(message));
});

await redis.publish('task:updated', JSON.stringify({ id, done: true }));
`),
    ),
    warn(
      'Pub/Sub is **fire and forget**. A subscriber that is down, restarting or mid-deploy misses the message permanently — there is no delivery guarantee and no replay. It is right for "tell every instance to drop its local cache" and wrong for anything that must happen. That is what the next topic is for.',
    ),

    h('What not to do'),
    table(
      ['Never', 'Because', 'Instead'],
      [
        ['`KEYS *`', 'O(n) over every key, and Redis is single-threaded — it blocks the whole server', '`SCAN` with a cursor'],
        ['A key with no TTL, in a cache', 'It lives until eviction picks it arbitrarily', 'Always `EX`'],
        ['Treat it as the source of truth', 'It is memory; a restart without persistence loses everything', 'Postgres owns the data'],
        ['Store megabytes in one key', 'One big value stalls the single thread on every read', 'Split it, or do not cache it'],
        ['`FLUSHALL` on a shared instance', 'It empties every database on it', 'Namespaced keys and targeted deletes'],
      ],
    ),
    code(
      js(`
// Deleting by pattern, safely. node-redis v5+ yields a BATCH of keys per
// iteration, not one key — so this is also one DEL round trip per batch.
for await (const keys of redis.scanIterator({ MATCH: 'task:*', COUNT: 100 })) {
  if (keys.length) await redis.del(keys);
}
`),
    ),
    warn(
      'That loop variable is a batch on node-redis v5 and later, and a single key on v4. Copying a v4 snippet into a v5 project silently passes an array where a string is expected — check which major you are on before trusting an example from an old answer.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Cache a row', 'Cache-aside: `get` → miss → query → `set` with `EX`'],
      ['Invalidate', '`del` the key — never write the new value in'],
      ['Prevent a stampede', 'A short `NX` lock, or refresh before expiry'],
      ['Prevent penetration', 'Cache the miss too, briefly'],
      ['Prevent an avalanche', 'Jitter the TTL'],
      ['Count something atomically', '`INCR`'],
      ['Rate limit', '`INCR` + `EXPIRE`, or a sorted set for sliding'],
      ['Lock across instances', '`SET NX EX` + a Lua release keyed on a token'],
      ['Run commands atomically', '`multi()`'],
      ['Find keys', '`SCAN`, never `KEYS`'],
    ]),

    h('Interview'),
    asked([
      ['What is Redis used for?', 'Caching, sessions, rate limiting, locks, queues and pub/sub — an in-memory data structure server, not just a key-value cache.'],
      ['Explain cache-aside.', 'Read the cache, fall back to the database on a miss, write the result back with a TTL, and delete the key on writes.'],
      ['Why delete rather than update the cache on a write?', 'Concurrent writes can land out of order and leave a stale value until the TTL; a delete cannot.'],
      ['What is a cache stampede?', 'A hot key expires and every concurrent request misses at once, hitting the database together. Fixed with a rebuild lock or early refresh.'],
      ['How do you rate limit with Redis?', '`INCR` plus `EXPIRE` for a fixed window, or a sorted set of timestamps for a sliding one.'],
      ['How do you build a safe distributed lock?', '`SET key token NX EX`, and release with a Lua script that deletes only if the token matches.'],
      ['Why is `KEYS *` dangerous?', 'It scans every key while Redis is single-threaded, blocking every other client. Use `SCAN`.'],
      ['Is Redis Pub/Sub reliable?', 'No — no persistence or replay. A subscriber that is down misses the message. Use a queue or a stream instead.'],
    ]),

    links(
      link('Redis data types', 'https://redis.io/docs/latest/develop/data-types/'),
      link('node-redis', 'https://github.com/redis/node-redis'),
      link('Redis key eviction', 'https://redis.io/docs/latest/develop/reference/eviction/'),
    ),
  ],
};
