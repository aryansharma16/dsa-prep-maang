import { asked, diagram, flow, h, links, p, quick, table, tip, warn, wiki } from '../blocks.js';
import { interviewLevel } from './shapes.js';

export const doc = {
  blocks: [
    p(
      'The canonical feed problem, in its purest form. A post is 300 bytes and takes a millisecond to store — and then has to reach up to a hundred million timelines. **The write is trivial and the fan-out is the entire system.**',
    ),

    flow(['Client', 'API', 'Timeline cache', 'Post store', 'Media CDN'], 'Read path'),
    diagram(
      `
   POST                                    READ TIMELINE

   ┌────────┐                              ┌──────────┐
   │  user  │                              │   user   │
   └───┬────┘                              └────┬─────┘
       │ POST /tweets                           │ GET /home
       ▼                                        ▼
   ┌────────┐                              ┌──────────┐
   │ write  │──▶ post store (sharded)      │  read    │
   │  svc   │         │                    │   svc    │
   └────────┘         │ event              └────┬─────┘
                      ▼                         │
                 ┌─────────┐                    ├──▶ my timeline cache
                 │  Kafka  │                    │    (precomputed ids)
                 └────┬────┘                    │
                      ▼                         ├──▶ + celebrity posts
             ┌─────────────────┐                │      fetched live
             │ fan-out workers │                │
             └────────┬────────┘                ▼
                      │                     merge · rank · hydrate
        ┌─────────────┴────────────┐
        ▼                          ▼
   follower < threshold      follower ≥ threshold
   push id into their        DO NOTHING
   timeline cache            (pulled at read time)
`,
      'The hybrid fan-out, drawn',
    ),

    h('The pieces'),
    table(
      ['Piece', 'What it does', 'Why it is there'],
      [
        ['**Post store**', 'The tweets themselves, sharded by `tweet_id`', 'Tiny rows, written once, read constantly'],
        ['**Social graph**', 'Follows, both directions', 'Fan-out needs followers; timelines need followees'],
        ['**Timeline cache**', 'Per user: ~800 recent post ids', 'Redis. Bounded — nobody scrolls past a few hundred'],
        ['**Fan-out workers**', 'Push ids into follower timelines', 'Async, from a queue; the heaviest component in the system'],
        ['**Ranking**', 'Scores candidates at read time', 'The home timeline is ranked; the following tab is chronological'],
        ['**Search / trends**', 'Inverted index plus a streaming counter', 'A separate system fed from the same event log'],
      ],
    ),
    tip(
      'The timeline cache is **capped**, at something like 800 ids. That bound is what makes the whole thing affordable: two billion users × 800 ids × 8 bytes is a large but finite amount of memory, and nobody scrolls far enough to notice the cap.',
    ),

    h('The hard part — one tweet, one hundred million timelines'),
    table(
      ['Followers', 'Strategy', 'Cost of a post'],
      [
        ['< ~10,000', '**Push** — fan out on write', 'A few thousand cache writes, done in a second'],
        ['≥ ~10,000', '**Pull** — do not fan out', 'One row. Read-time merge for their followers'],
        ['Reading', 'Precomputed list **+** live fetch from followed celebrities', 'One cache read plus a handful of small queries'],
      ],
    ),
    p(
      'Both halves stay small. A normal user\'s post fans out to a manageable number of caches; a celebrity\'s post is written once and merged in by the few people reading it right now. **Nobody follows ten thousand celebrities**, so the read-time merge is always short.',
    ),
    warn(
      'Pure fan-out on write is a real outage here, not a theoretical one: a single post from a hundred-million-follower account would be a hundred million cache writes, which takes minutes and starves every other post in the queue behind it.',
    ),

    h('Trends'),
    diagram(
      `
   tweets ──▶ Kafka ──▶ ┌──────────────────┐
                        │ streaming count  │  sliding window,
                        │ per hashtag/term │  per region
                        └────────┬─────────┘
                                 │
                                 ▼
                        ┌──────────────────┐
                        │ compare to the   │  trending = a SPIKE
                        │ usual rate       │  vs baseline, not
                        └────────┬─────────┘  raw volume
                                 ▼
                          top N ──▶ cache ──▶ UI
`,
      'Trending is a derivative, not a count',
    ),
    p(
      'The subtlety worth saying out loud: trending is not "most used". A term that is always popular is not trending — **trending is an unusual rate of change**, measured against that term\'s own baseline.',
    ),

    h('Scale'),
    table(
      ['Dimension', 'Order of magnitude', 'What breaks first'],
      [
        ['Users', '~500M', '—'],
        ['Posts/day', '~500M → ~6,000/s, ~20,000/s peak', 'Fan-out workers'],
        ['Timeline reads', '~300k QPS', 'Nothing — a Redis read'],
        ['Fan-out writes', 'Posts × avg followers ≈ **several M/s**', 'The dominant cost in the whole system'],
        ['Timeline cache memory', 'Users × 800 ids', 'RAM, which is why the cap exists'],
        ['Read:write ratio', '~50:1', 'Which is exactly why the write does the work'],
      ],
    ),

    h('When traffic spikes'),
    table(
      ['Event', 'What happens'],
      [
        ['A world event', 'Post rate multiplies; the fan-out queue grows and drains. Timelines lag by seconds'],
        ['A celebrity posts', 'Nothing happens on write. Their followers pull it on next read'],
        ['A tweet goes viral', 'It is one cached row plus CDN media, read many times. Cheap'],
        ['Trends recompute', 'Streaming aggregation — already designed for continuous load'],
      ],
    ),
    tip(
      'The graceful answer to a post-rate spike is **let the timeline lag**. A feed that is fifteen seconds behind is invisible to users, and it turns a capacity crisis into a queue depth graph.',
    ),

    h('Failures'),
    table(
      ['What dies', 'Effect', 'Mitigation'],
      [
        ['Fan-out workers', 'Timelines stop updating', 'Kafka retains the events; workers resume at their offsets'],
        ['Timeline cache node', 'Those users get slow timelines', 'Rebuild from the graph + post store; it is derived data'],
        ['Ranking service', 'Timeline still renders', 'Fall back to chronological'],
        ['Social graph store', 'Cannot fan out or follow', 'Read-mostly, so replicate and cache heavily'],
        ['Search', 'Search and trends degraded', 'Independent of the timeline path'],
      ],
    ),

    h('Interview'),
    quick([
      ['What it is', 'A feed system: tiny writes, enormous fan-out, ranked reads'],
      ['The hard part', 'A single post reaching a hundred million timelines'],
      ['Key decision', 'Hybrid fan-out with a follower threshold; capped timeline caches'],
      ['Trade-off', 'Precomputing timelines costs millions of writes per second and buys a 5ms read'],
      [
        '30-second answer',
        '"Read-heavy at about 50:1, so the write does the work. Posting writes one small row and emits an event; workers fan the post id out into each follower\'s capped Redis timeline. Above a follower threshold we skip fan-out entirely, and those posts are merged in at read time — which keeps both halves small, since nobody follows ten thousand celebrities. Reads are one cache lookup, a short merge, ranking, then hydration. Trends are a streaming rate-of-change, not a count."',
      ],
    ]),
    asked([
      ['How do you build the timeline?', 'Hybrid fan-out: push for normal accounts, pull for celebrities, merged at read.'],
      ['Why cap the timeline cache?', 'Memory. Nobody scrolls past a few hundred posts, so storing more is pure cost.'],
      ['What if fan-out falls behind?', 'Timelines lag by seconds. That is the designed degradation, not a failure.'],
      ['How does trending work?', 'A streaming count per term compared to its own baseline — a spike, not raw volume.'],
      ['Chronological or ranked?', 'Ranked for home, chronological as the fallback and as a user-visible option.'],
    ]),

    interviewLevel('Twitter/X'),
    links(wiki('Fan-out_(software)', 'Fan-out'), wiki('News_feed', 'News feed')),
  ],
};
