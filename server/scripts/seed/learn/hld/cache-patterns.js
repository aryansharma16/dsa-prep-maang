import { asked, code, diagram, h, js, links, p, quick, table, tip, tradeoff, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Five ways to wire a cache to a database. They differ in **who is responsible for the cache** and **when the write reaches the store** — and each one hides a different failure.',
    ),

    h('The five, at a glance'),
    diagram(
      `
   CACHE-ASIDE                        READ-THROUGH
   the app manages the cache          the cache manages itself

   app ──▶ cache  (miss)              app ──▶ cache  (miss)
   app ──▶ db                                    │
   app ──▶ cache.set                             └──▶ db
                                                 cache.set
   ✓ cache down = still works         ✓ app code is one line
   ✗ cache logic in every caller      ✗ cache down = app down


   WRITE-THROUGH                      WRITE-BEHIND
   write both, synchronously          write cache, flush later

   app ──▶ cache ──▶ db               app ──▶ cache ──▶ (buffer)
           (both, then ack)                              │
                                                    ack  │ async
   ✓ never stale                                    ◀────┘ ──▶ db
   ✗ every write costs two
                                      ✓ very fast writes
                                      ✗ a crash LOSES acked writes
`,
      'Who owns the cache, and when the DB sees the write',
    ),

    h('Cache-aside — the default'),
    code(
      js(`
async function getUser(id) {
  const key = \`user:\${id}\`;

  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);          // hit

  const user = await db.users.findById(id);       // miss
  if (user) {
    // TTL is not optional. Without one, an entry that is never
    // written again is stale forever, and a bug in invalidation
    // becomes permanent rather than temporary.
    await redis.set(key, JSON.stringify(user), 'EX', 300);
  }
  return user;
}

async function updateUser(id, patch) {
  const user = await db.users.update(id, patch);
  // Delete, do not set. Two concurrent updates that both SET can
  // interleave and leave the older value in the cache; a DELETE
  // is idempotent and the next read repopulates from the truth.
  await redis.del(\`user:\${id}\`);
  return user;
}
`),
    ),
    tip(
      'The comment on that last line is the detail interviewers probe. **Invalidate by deleting, not by setting.** Two concurrent writers that both `SET` can interleave so the older value lands last; a `DEL` cannot get that wrong.',
    ),

    h('Comparison'),
    table(
      ['Pattern', 'Read miss', 'Write', 'Consistency', 'If the cache dies'],
      [
        ['**Cache-aside**', 'App fetches and populates', 'Write DB, delete key', 'Brief staleness window', '**Slower, still correct**'],
        ['**Read-through**', 'Cache fetches for you', 'Usually paired with write-through', 'Same as cache-aside', 'App is down'],
        ['**Write-through**', 'Same as read-through', 'Cache then DB, synchronously', '**Never stale**', 'App is down'],
        ['**Write-behind**', 'Same', 'Cache now, DB later', 'Never stale in the cache', '**Data loss**'],
        ['**Refresh-ahead**', 'Refreshed before expiry', 'Any', 'Rarely stale', 'Slower'],
      ],
    ),
    warn(
      'Read-through and write-through make the cache a **required dependency**, so it now multiplies into your availability. Cache-aside keeps it optional — if Redis is down you are slower, not broken — which is why it is the default despite being more code.',
    ),

    h('Write-behind'),
    tradeoff([
      ['**Write-behind**', 'Very fast writes; many updates to one key collapse into one DB write', 'A crash loses acknowledged writes; the DB is not the source of truth in real time'],
    ]),
    p(
      'It is the right answer for a narrow class of data: **high-frequency, low-value updates** where losing a few seconds is acceptable. View counts, last-seen timestamps, analytics. It is the wrong answer for anything a user would notice losing.',
    ),

    h('Refresh-ahead'),
    diagram(
      `
   TTL = 300s

   ordinary expiry                   refresh-ahead

   t=0    set, TTL 300               t=0    set, TTL 300
   t=299  hit                        t=270  hit ──▶ also kicks off
   t=300  EXPIRED                            a background refresh
   t=301  MISS ──▶ slow request      t=300  refreshed. no miss.
          (and if it is popular,
           MANY slow requests)       ✓ users never pay for a miss
                                     ✗ refreshes keys nobody
                                       will ask for again
`,
      'Pay the miss before anyone asks',
    ),
    p(
      'Worth it for a small set of **known-hot keys**. Applied to every key it wastes work refreshing things that will never be read again — so it is normally triggered on access near expiry, not on a timer.',
    ),

    h('Choosing'),
    table(
      ['Situation', 'Pattern'],
      [
        ['General purpose, unsure', '**Cache-aside**'],
        ['Cache outage must not be an outage', '**Cache-aside**'],
        ['Reads must never be stale', 'Write-through'],
        ['Write-heavy, low-value data', 'Write-behind'],
        ['A few very hot keys with a miss you cannot afford', 'Refresh-ahead'],
        ['You want the cache library to handle it', 'Read-through + write-through'],
      ],
    ),

    h('The race that cache-aside allows'),
    diagram(
      `
   reader                          writer
   ──────                          ──────
   t1  cache MISS
   t2  read db  ──▶ x = 1
                                   t3  write db  x = 2
                                   t4  DEL cache
   t5  cache.set(x = 1)   ◀── stale value, written AFTER
                              the delete. persists until TTL.

   FIXES
     ▸ a TTL — bounds the damage (always do this)
     ▸ set only if absent (SETNX) — the writer's delete wins
     ▸ delete again after a short delay ("double delete")
     ▸ write-through, if you cannot tolerate it at all
`,
      'Rare, real, and why TTLs are mandatory',
    ),
    tip(
      'A **TTL on every entry** is the cheap insurance for this whole class of bug. It does not prevent the race; it bounds how long you live with the result — which turns a permanent inconsistency into a temporary one.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'Five ways to wire a cache to a store'],
      ['Why it matters', 'Each one puts the failure in a different place'],
      ['Use when', 'Cache-aside by default; the others for specific needs'],
      ['Trade-off', 'Cache-aside keeps the cache optional and accepts a staleness window'],
      [
        '30-second answer',
        '"Cache-aside is the default: the app checks the cache, falls back to the database, and populates it — and on a write, it writes the database and deletes the key rather than setting it, because two concurrent sets can interleave. Read-through and write-through move that logic into the cache but make it a required dependency. Write-behind acknowledges before the database has the write, so it is only for cheap, high-frequency data. Always set a TTL."',
      ],
    ]),
    asked([
      ['Which pattern is the default?', 'Cache-aside — it keeps the cache optional, so an outage means slower rather than broken.'],
      ['Invalidate by delete or by set?', 'Delete. Two concurrent writers that both set can leave the older value behind.'],
      ['When is write-behind acceptable?', 'High-frequency, low-value data like view counts, where losing a few seconds is fine.'],
      ['Why is a TTL mandatory?', 'It bounds every invalidation bug and race, turning permanent staleness into temporary.'],
      ['Cache-aside vs read-through?', 'Cache-aside puts the logic in the app and keeps the cache optional. Read-through hides it and makes it required.'],
    ]),

    links(
      wiki('Cache_(computing)#Writing_policies', 'Cache writing policies'),
      wiki('Cache_stampede', 'Cache stampede'),
    ),
  ],
};
