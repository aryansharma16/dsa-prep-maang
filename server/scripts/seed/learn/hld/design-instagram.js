import { asked, diagram, flow, h, links, p, quick, table, tip, warn, wiki } from '../blocks.js';
import { interviewLevel } from './shapes.js';

export const doc = {
  blocks: [
    p(
      'Photo sharing and a news feed. The photos are the easy half — presigned upload, object storage, CDN. **The feed is the design**, and the feed is one question: do you build it when someone posts, or when someone reads?',
    ),

    flow(['Client', 'API', 'Feed cache', 'Post metadata', 'CDN for media'], 'Read path'),
    diagram(
      `
   POST                                READ

   user uploads ──▶ presigned URL      open app
        │                │                 │
        │                ▼                 ▼
        │           object storage    ┌──────────┐
        │                │            │  feed    │  a precomputed
        ▼                ▼            │  cache   │  list of post ids
   ┌─────────┐      ┌────────┐        └────┬─────┘
   │ post DB │      │ resize │             │
   └────┬────┘      │ + CDN  │             ▼
        │           └────────┘      hydrate posts from cache
        │ event                            │
        ▼                                  ▼
   ┌─────────┐                        media from CDN
   │ fan-out │──▶ push post id into
   │ workers │    each follower's feed
   └─────────┘
`,
      'Write does the work so the read is cheap',
    ),

    h('The pieces'),
    table(
      ['Piece', 'What it does', 'Why it is there'],
      [
        ['**Presigned upload**', 'Photo goes straight to object storage', 'Bytes never touch the app tier'],
        ['**Media pipeline**', 'Resize into a few sizes, strip EXIF, moderate', 'A phone photo is 4MB; a thumbnail is 20KB'],
        ['**Post DB**', 'Caption, author, timestamp, media keys', 'Sharded by `user_id`; the post itself is tiny'],
        ['**Graph store**', 'Who follows whom', 'Read constantly by fan-out; heavily cached'],
        ['**Feed cache**', 'Per user: a list of recent post ids', 'Redis. The feed is ids, never full posts'],
        ['**Fan-out workers**', 'Push a new post id to follower feeds', 'Off the request path, via a queue'],
        ['**Ranking**', 'Orders the feed', 'Applied at read time over the candidate ids'],
      ],
    ),
    tip(
      'The feed cache holds **post ids, not posts**. One post edited or deleted must not mean rewriting it in a million caches — you hydrate ids into posts at read time, from a cache that has one copy.',
    ),

    h('The hard part — fan-out on write versus read'),
    diagram(
      `
   FAN-OUT ON WRITE                  FAN-OUT ON READ

   post ──▶ for each follower:       post ──▶ stored once
              push id to their
              feed cache             read ──▶ for each followee:
                                                fetch recent posts
   read ──▶ read my list. done.              ──▶ merge, sort

   ✓ reads are O(1) and instant      ✓ writes are O(1)
   ✗ a 100M-follower post is         ✗ reads are expensive and
     100M writes                       get slower as you follow more

   normal user  ──▶  WRITE
   celebrity    ──▶  READ
   everyone else ─▶  BOTH, merged at read time
`,
      'The hybrid is the answer',
    ),
    table(
      ['Approach', 'Good for', 'Falls apart when'],
      [
        ['**Fan-out on write**', 'The 99.9% of users with a normal follower count', 'One account has tens of millions of followers'],
        ['**Fan-out on read**', 'Celebrity accounts — write once, read many', 'A user follows thousands of accounts'],
        ['**Hybrid**', 'Everyone', 'It is more code, and you must pick a threshold'],
      ],
    ),
    p(
      'The hybrid: fan out on write for normal accounts; for accounts above a follower threshold, **do not fan out at all**. At read time, take the user\'s precomputed feed and merge in recent posts from the handful of celebrities they follow. Both halves stay small.',
    ),
    warn(
      'Getting to the hybrid without being prompted is most of the score in this interview. Proposing pure fan-out on write and then being asked "what about someone with 100 million followers?" is the expected path — **arriving there yourself is better**.',
    ),

    h('Ranking'),
    flow(['Candidates', 'Feature lookup', 'Model score', 'Diversity rules', 'Final feed'], 'At read time'),
    p(
      'Candidate generation is cheap and precomputed; ranking runs over a few hundred candidates at request time. Diversity rules come last — no three posts from the same account in a row — because a purely score-ordered feed looks broken to a human.',
    ),

    h('Scale'),
    table(
      ['Dimension', 'Order of magnitude', 'What breaks first'],
      [
        ['Users', '~2B', '—'],
        ['Posts/day', '~100M → ~1,200/s, ~4,000/s peak', 'Fan-out workers'],
        ['Feed reads', '~100k QPS', 'Nothing — it is a Redis read'],
        ['Fan-out writes', 'Posts × average followers ≈ **10M+/s**', 'This is the real number; it is why fan-out is async'],
        ['Media storage', 'Exabytes', 'Cost; old media moves to colder tiers'],
      ],
    ),
    tip(
      'Notice the asymmetry: **reads are 100k/s and fan-out writes are 10M/s.** The system does a hundred times more work on the write side, deliberately, because that work happens off the request path and the read must be instant.',
    ),

    h('When traffic spikes'),
    table(
      ['Event', 'What happens'],
      [
        ['A celebrity posts', 'No fan-out at all — it is merged at read time. The spike is reads of one cached post'],
        ['New Year, everyone posts at once', 'The fan-out queue grows and drains. Feeds lag by seconds, which is acceptable'],
        ['A post goes viral', 'It is one row and one CDN object. Cache it hard'],
        ['Feed cache node dies', 'Rebuild from the post DB for affected users; serve a degraded chronological feed meanwhile'],
      ],
    ),

    h('Failures'),
    table(
      ['What dies', 'Effect', 'Mitigation'],
      [
        ['Fan-out workers', 'Feeds stop updating', 'Queue retains the work; feeds catch up. Nothing is lost'],
        ['Ranking service', 'Feed still renders', 'Fall back to reverse-chronological — degraded, not broken'],
        ['Feed cache', 'Slow feeds', 'Rebuild from posts + graph; this is why the cache is derived data'],
        ['Media pipeline', 'Photos show as processing', 'Async; the queue drains'],
        ['Graph store', 'Cannot fan out or follow', 'Heavily replicated and cached — it is read-mostly'],
      ],
    ),

    h('Interview'),
    quick([
      ['What it is', 'Photo sharing plus a ranked news feed'],
      ['The hard part', 'Feed generation, and the celebrity account that breaks fan-out'],
      ['Key decision', 'Hybrid fan-out: push for normal users, pull for celebrities, merge at read'],
      ['Trade-off', 'Precomputing feeds costs enormous write amplification and buys instant reads'],
      [
        '30-second answer',
        '"Photos upload straight to object storage with a presigned URL and go through a resize pipeline to a CDN. Posts are small rows sharded by user. The feed is the design: on posting, a queue fans the post id out into each follower\'s Redis feed list, so a read is one cache lookup plus hydration. That breaks for celebrities, so accounts above a follower threshold are not fanned out at all and are merged in at read time. Ranking runs over those candidates, with a chronological fallback."',
      ],
    ]),
    asked([
      ['Fan-out on write or read?', 'Both. Write for normal accounts, read for celebrities, merged at read time.'],
      ['Why store ids in the feed cache?', 'So editing or deleting a post does not require rewriting a million caches.'],
      ['How do you handle a 100M-follower account?', 'Do not fan out. Its posts are fetched and merged when followers read.'],
      ['What happens if ranking is down?', 'Serve the feed reverse-chronologically. Degrade the ordering, not the page.'],
      ['Where does the media go?', 'Presigned upload to object storage, resized by a worker, served by CDN — never through your servers.'],
    ]),

    interviewLevel('Instagram'),
    links(wiki('News_feed', 'News feed'), wiki('Fan-out_(software)', 'Fan-out')),
  ],
};
