import { asked, code, diagram, flow, h, js, links, p, quick, table, tip, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'The data changed. Now every copy of it, at every layer, in every region, is wrong. **Invalidation is hard because a cache has no idea it is stale** — it is holding a perfectly valid answer to a question that was asked at the wrong time.',
    ),

    h('Four strategies'),
    table(
      ['Strategy', 'How', 'Staleness', 'Complexity'],
      [
        ['**TTL only**', 'Let it expire', 'Up to the TTL', '**None**'],
        ['**Explicit delete**', 'Delete the key on write', 'Milliseconds', 'Low — until you have many keys per entity'],
        ['**Versioned keys**', 'The key contains a version', '**Zero**', 'Low, and elegant'],
        ['**Event-driven**', 'A change stream invalidates downstream', 'Seconds', 'High, but it scales'],
      ],
    ),
    tip(
      '**TTL-only is a legitimate answer and it is underused.** If the data can be sixty seconds stale, a sixty-second TTL is the entire design — no invalidation code, no missed key, no race. Reach for the other three only when that is genuinely not acceptable.',
    ),

    h('Versioned keys'),
    diagram(
      `
   INSTEAD OF DELETING, CHANGE THE KEY

   v1 ──▶  product:42:v1  ──▶ { name, price: 100 }
                                     │
                     price changes   │
                                     ▼
   v2 ──▶  product:42:v2  ──▶ { name, price: 120 }

   the old entry is now UNREACHABLE. nobody deleted it;
   nothing can construct its key any more. it ages out on
   its own TTL.

   ✓ no race — the new key appears atomically
   ✓ no purge across nodes or regions
   ✓ rolling back is changing the version back
   ✗ old entries occupy memory until they expire

   where does the version come from?
     ▸ a column on the row (updated_at, or a counter)
     ▸ a per-entity version key in Redis
     ▸ a global version, for "invalidate everything"
`,
      'The best answer to a hard problem',
    ),
    code(
      js(`
// The version is read from the same place as the data, so there is
// no window where the key is new and the row is old.
async function getProduct(id) {
  const version = await redis.get(\`product:\${id}:ver\`) ?? '0';
  const key = \`product:\${id}:v\${version}\`;

  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);

  const product = await db.products.findById(id);
  await redis.set(key, JSON.stringify(product), 'EX', 3600);
  return product;
}

async function updateProduct(id, patch) {
  const product = await db.products.update(id, patch);
  // One INCR invalidates every cached shape of this product at
  // once — the list row, the detail page, the search snippet —
  // without knowing what any of them are called.
  await redis.incr(\`product:\${id}:ver\`);
  return product;
}
`),
    ),

    h('The many-keys problem'),
    p(
      'One product appears in a dozen cached shapes: the detail page, three list pages, a search result, a recommendation row, a sitemap fragment. **Explicit deletion requires knowing all of them**, and the one you forget is the bug.',
    ),
    table(
      ['Approach', 'How it copes'],
      [
        ['**Versioned entity key**', 'Every shape includes the version; one `INCR` orphans all of them'],
        ['**Tag-based invalidation**', 'Tag entries `product:42`; purge by tag. Needs cache support'],
        ['**Key registry**', 'Track which keys contain which entity. Works, and is another thing to keep correct'],
        ['**Short TTLs on derived shapes**', 'Accept staleness on the shapes that are cheap to recompute'],
      ],
    ),
    warn(
      'Do not build a key registry unless you must. It is **a second cache of cache metadata**, it can drift from reality, and when it drifts the symptom is stale data that no amount of deleting fixes. Versioned keys get the same result with no extra state.',
    ),

    h('Across layers'),
    flow(['Browser', 'CDN', 'App cache', 'Redis', 'DB'], 'Each has its own idea of fresh'),
    table(
      ['Layer', 'How to invalidate', 'Speed'],
      [
        ['**Browser**', '**You cannot.** Change the URL', 'Never — hence hashed filenames'],
        ['**CDN**', 'Purge by path or tag', 'Seconds to minutes; rate-limited'],
        ['**In-process**', 'Pub/sub message to every instance', 'Fast, and easy to miss an instance'],
        ['**Redis**', '`DEL`, or bump a version', 'Immediate'],
        ['**Database**', 'It is the truth', '—'],
      ],
    ),
    p(
      'The browser row is why **versioned URLs won**. You cannot reach into a user\'s cache, so the only reliable invalidation at that layer is making the old URL irrelevant — which is exactly what a content hash in the filename does.',
    ),

    h('Event-driven invalidation'),
    diagram(
      `
   db write ──▶ CDC / outbox ──▶ event stream
                                      │
              ┌───────────────────────┼───────────────────────┐
              ▼                       ▼                       ▼
        invalidate Redis      invalidate in-process    purge CDN tag
                              (via pub/sub)

   ✓ one write, every layer notified
   ✓ works across regions and services
   ✓ no service needs to know who else caches this
   ✗ eventually consistent — a window of seconds
   ✗ a whole pipeline to operate
`,
      'The answer at scale',
    ),
    tip(
      'Driving invalidation from a **change stream rather than from application code** is what makes it reliable at scale: the event is emitted by the database itself, so a code path that forgets to invalidate cannot exist.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'Making cached copies stop being wrong after a write'],
      ['Why it is hard', 'A stale cache looks exactly like a fresh one'],
      ['Use when', 'Any cache over data that changes'],
      ['Trade-off', 'TTL-only is free and stale; explicit invalidation is fresh and easy to get wrong'],
      [
        '30-second answer',
        '"Four options. TTL-only is free and often enough — if sixty seconds of staleness is acceptable, that is the whole design. Explicit deletion is fresh but you must know every key holding that entity, and the one you forget is the bug. Versioned keys are the elegant answer: put a version in the key and one INCR makes every cached shape unreachable at once, with no race and no purge. At scale, drive that from a change stream so no code path can forget."',
      ],
    ]),
    asked([
      ['Why is cache invalidation hard?', 'A stale entry is indistinguishable from a fresh one, and one entity appears in many cached shapes.'],
      ['What are versioned keys?', 'The version is part of the key, so bumping it orphans every cached shape at once. No purge, no race.'],
      ['How do you invalidate a browser cache?', 'You cannot. Change the URL — that is why asset filenames contain a content hash.'],
      ['Is TTL-only acceptable?', 'Often yes. If the staleness window is tolerable it removes an entire class of bug.'],
      ['How do you invalidate reliably across services?', 'From a change stream or outbox, so the event comes from the database rather than from code that might forget.'],
    ]),

    links(
      wiki('Cache_invalidation', 'Cache invalidation'),
      wiki('Change_data_capture', 'Change data capture'),
    ),
  ],
};
