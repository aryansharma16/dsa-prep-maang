import { asked, diagram, flow, h, links, p, quick, table, tip, warn, wiki } from '../blocks.js';
import { interviewLevel } from './shapes.js';

export const doc = {
  blocks: [
    p(
      'A feed plus a graph — and unlike Twitter\'s follow graph, this one is **symmetric and traversed by degree**. "2nd degree connection" appears on almost every page, and computing it on demand for a billion members is the problem the whole design bends around.',
    ),

    flow(['Client', 'API', 'Graph service', 'Feed cache', 'Search', 'Profile store'], 'Most pages touch all five'),
    diagram(
      `
   ┌──────────────────────────────────────────────────┐
   │                   API gateway                     │
   └──┬──────────┬──────────┬──────────┬──────────────┘
      ▼          ▼          ▼          ▼
   ┌──────┐  ┌───────┐  ┌───────┐  ┌────────┐
   │profile│ │ graph │  │ feed  │  │ search │
   └───┬──┘  └───┬───┘  └───┬───┘  └───┬────┘
       │         │          │          │
       ▼         ▼          ▼          ▼
   ┌──────┐  ┌───────┐  ┌───────┐  ┌────────┐
   │  DB  │  │ graph │  │ Redis │  │inverted│
   │      │  │ store │  │       │  │ index  │
   └──────┘  └───────┘  └───────┘  └────────┘
                 ▲
                 │  every other service asks it
                 │  "how are these two connected?"
                 └──────────────────────────────
`,
      'The graph service is the hub',
    ),

    h('The pieces'),
    table(
      ['Piece', 'What it does', 'Why it is there'],
      [
        ['**Profile store**', 'The profile document', 'Read enormously more than written; cache aggressively'],
        ['**Graph service**', 'Connections and degree queries', 'The component everything else depends on'],
        ['**Feed**', 'Posts from your network, ranked', 'Same hybrid fan-out as any feed'],
        ['**Search**', 'People, jobs, companies, posts', 'Must be **personalised** — results depend on who is asking'],
        ['**PYMK pipeline**', '"People you may know"', 'Offline graph mining; far too expensive at request time'],
        ['**Notification service**', 'Someone viewed you, someone posted', 'Batched and digested, not per event'],
      ],
    ),

    h('The hard part — degrees of connection'),
    p(
      'A member has hundreds of connections; each of those has hundreds. **Second degree is easily 100,000 people**, and third degree can be millions. Computing that per page view, for every result on a search page, is not possible on demand.',
    ),
    diagram(
      `
   NAIVE                            WHAT WORKS

   for each search result:          precompute a compact set
     BFS from me to them              per member:
       │                              ├─ 1st degree: the list
       ▼                              └─ 2nd degree: a BLOOM FILTER
   100k+ node traversal                    or hashed id set
   per result, per page view                  │
       │                                      ▼
       ▼                            lookup is O(1) per result
   ✗ impossible                     "is X in my 2nd degree set?"
                                         │
                                         ▼
                                    exact path computed lazily,
                                    only for the profile you open
`,
      'Precompute the membership test, not the path',
    ),
    table(
      ['Technique', 'What it buys', 'What it costs'],
      [
        ['**Precomputed 1st-degree list**', 'Exact, small, cached per member', 'Rewritten on every new connection'],
        ['**Bloom filter for 2nd degree**', 'O(1) membership in kilobytes', 'False positives — never false negatives'],
        ['**Lazy exact path**', 'The "connected through X" line on a profile', 'A real traversal, but only on one profile at a time'],
        ['**Cap the degree**', 'Stop at 3rd; beyond that everyone is connected', 'Nothing — it is genuinely meaningless past 3'],
      ],
    ),
    tip(
      'The bloom filter is the move worth knowing here. **A false positive says "2nd degree" when it is 3rd** — a cosmetic error on a badge — and it never says "not connected" about someone who is. Trading exactness for two orders of magnitude of memory is exactly the right trade for a badge.',
    ),

    h('People you may know'),
    flow(['Graph snapshot', 'Mutual-connection mining', 'Signal blending', 'Rank', 'Per-member cache'], 'Offline, nightly'),
    table(
      ['Signal', 'Why it works'],
      [
        ['Mutual connections', 'The strongest single predictor, by a wide margin'],
        ['Same company or school, overlapping dates', 'You probably met'],
        ['Profile co-views', 'People who viewed both of you'],
        ['Contact-book overlap', 'Direct evidence, where it has been shared'],
      ],
    ),
    p(
      'This is a **graph batch job**, not a query. Triangle counting across a billion-node graph runs on a cluster overnight and lands in a per-member cache, which the page then reads in a millisecond.',
    ),

    h('Search is personalised'),
    warn(
      'A search for "software engineer" must return **different results for different members** — your own network first. That means the ranking stage needs graph distance as a feature, which is why search depends on the graph service and cannot be a pure inverted-index lookup.',
    ),
    flow(['Query', 'Inverted index', 'Candidates', 'Graph distance + model', 'Ranked results'], 'Retrieve, then personalise'),

    h('Scale'),
    table(
      ['Dimension', 'Order of magnitude', 'What breaks first'],
      [
        ['Members', '~1B', '—'],
        ['Edges in the graph', 'Tens of billions', 'The graph store; it is partitioned and replicated'],
        ['Profile views', 'Very high; read-dominated', 'Nothing — cached'],
        ['Feed reads', '~100k QPS', 'Same feed design as elsewhere'],
        ['2nd-degree set size', '~100k per member', 'Memory, which is why it is a bloom filter'],
        ['PYMK compute', 'Billions of triangles, nightly', 'Batch cluster cost, not latency'],
      ],
    ),

    h('Failures'),
    table(
      ['What dies', 'Effect', 'Mitigation'],
      [
        ['Graph service', 'No degree badges; search loses personalisation', 'Degrade to unpersonalised results rather than an error page'],
        ['PYMK pipeline', 'Stale suggestions', 'Serve yesterday\'s. Invisible to users'],
        ['Feed', 'No feed', 'Profile, search and messaging are independent services'],
        ['Search index', 'Search degraded', 'Rebuild from the source of truth; fall back to exact-match'],
        ['Notification service', 'Delayed notifications', 'Queued and digested anyway — latency is already loose'],
      ],
    ),
    tip(
      'The recurring theme across this whole design: **every expensive graph answer is precomputed and cached, and degrades to a less personal answer rather than to an error.** Nothing about the page is fatal if the graph is slow.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'A professional network: symmetric graph, ranked feed, personalised search'],
      ['The hard part', 'Degree-of-connection answers for a graph with tens of billions of edges'],
      ['Key decision', 'Precompute a bloom filter for 2nd degree; compute exact paths lazily'],
      ['Trade-off', 'Bloom filters give O(1) badges and accept occasional false positives'],
      [
        '30-second answer',
        '"Profiles are a cached read-heavy store and the feed is the usual hybrid fan-out. The graph service is what makes this different: degree appears on every page, so each member gets a precomputed first-degree list and a bloom filter of their second degree — O(1) membership in kilobytes, where a false positive only mis-labels a badge. Exact paths are computed lazily. People-you-may-know is an overnight graph job cached per member, and search re-ranks index hits by graph distance."',
      ],
    ]),
    asked([
      ['How do you compute 2nd-degree connections?', 'Precompute a bloom filter per member. O(1) membership instead of a live traversal.'],
      ['Why is a false positive acceptable?', 'It mislabels a badge. A false negative would hide a real connection, and bloom filters never produce those.'],
      ['How does "people you may know" scale?', 'It does not run at request time. It is an offline graph job, cached per member.'],
      ['Why is search harder here than on a normal site?', 'Results must be personalised by network distance, so ranking depends on the graph.'],
      ['What if the graph service is down?', 'Serve unpersonalised results and drop the degree badges. Degrade, do not fail.'],
    ]),

    interviewLevel('LinkedIn'),
    links(
      wiki('Bloom_filter', 'Bloom filter'),
      wiki('Social_graph', 'Social graph'),
    ),
  ],
};
