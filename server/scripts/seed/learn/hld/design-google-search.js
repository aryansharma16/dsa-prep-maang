import { asked, diagram, flow, h, links, p, quick, table, tip, warn, wiki } from '../blocks.js';
import { interviewLevel } from './shapes.js';

export const doc = {
  blocks: [
    p(
      'Three systems that barely talk to each other: a crawler running continuously, an indexer running as a pipeline, and a serving path that must answer in **under 200 milliseconds** from an index of hundreds of billions of documents. Only the third one is on the critical path.',
    ),

    flow(['Crawler', 'Document store', 'Indexer', 'Inverted index', 'Serving', 'Ranking'], 'Offline → online'),
    diagram(
      `
   OFFLINE (continuous)              ONLINE (200ms budget)

   ┌─────────┐                       query "system design"
   │ crawler │◀── URL frontier              │
   └────┬────┘    (priority queue)          ▼
        │                              ┌─────────┐
        ▼                              │  parse  │ spelling, synonyms
   ┌─────────┐                         └────┬────┘
   │  doc    │                              ▼
   │ store   │                         ┌─────────┐
   └────┬────┘                         │ scatter │──┬──▶ shard 1
        │                              └─────────┘  ├──▶ shard 2
        ▼                                   ▲       ├──▶ ...
   ┌─────────┐                              │       └──▶ shard N
   │ indexer │──▶ inverted index ───────────┘            (by DOCUMENT)
   └─────────┘    term ──▶ [doc ids]              each returns top-k
                                                        │
                                                        ▼
                                                   ┌─────────┐
                                                   │ gather  │ merge,
                                                   │ + rank  │ re-rank,
                                                   └─────────┘ snippet
`,
      'Two systems, one index between them',
    ),

    h('The pieces'),
    table(
      ['Piece', 'What it does', 'Why it is there'],
      [
        ['**URL frontier**', 'Prioritised queue of what to crawl next', 'You cannot crawl the web evenly; importance and freshness decide'],
        ['**Crawler**', 'Fetches, respects robots.txt, politeness-limited per host', 'Distributed by host so one site is not hammered'],
        ['**Document store**', 'Raw pages, deduplicated by content hash', 'The web is full of near-identical copies'],
        ['**Indexer**', 'Tokenises, builds postings lists', 'A batch pipeline; the index is rebuilt and swapped'],
        ['**Inverted index**', 'term → sorted list of doc ids + positions', 'The one data structure that makes search possible'],
        ['**Serving tier**', 'Scatter-gather across index shards', 'No single machine holds the index'],
        ['**Ranking**', 'Scores the candidates', 'Retrieval finds thousands; ranking picks ten'],
      ],
    ),

    h('The hard part — sharding the index'),
    p(
      'There are two ways to split an inverted index, and **only one of them works at this scale**.',
    ),
    diagram(
      `
   BY TERM                          BY DOCUMENT
   (partition the dictionary)       (partition the corpus)

   shard 1: a–f                     shard 1: docs 0–1B
   shard 2: g–m                     shard 2: docs 1B–2B
   shard 3: n–z                     shard 3: docs 2B–3B

   query "system design"            query "system design"
     ──▶ shard 3 (system)             ──▶ ALL shards
     ──▶ shard 1 (design)             each returns its top-k
     ──▶ INTERSECT two huge           merge the k-lists
         postings lists ACROSS
         the network                ✓ each shard is self-contained
                                    ✓ adding docs = adding shards
   ✗ enormous network transfer      ✓ one slow shard ≠ wrong answer
   ✗ "the" lands on one shard         (just serve without it)
   ✗ hotspots by letter             ✗ every query hits every shard
`,
      'Document partitioning wins',
    ),
    table(
      ['', 'By term', 'By document'],
      [
        ['Shards touched per query', 'Few', '**All**'],
        ['Data over the network', 'Whole postings lists', 'Only top-k per shard'],
        ['Hotspots', 'Severe — common words', 'None'],
        ['Adding documents', 'Rewrites existing shards', 'Add a shard'],
        ['One shard slow', 'Wrong or blocked answer', 'Answer without it, slightly degraded'],
        ['Verdict', 'Theoretically appealing', '**What everyone actually does**'],
      ],
    ),
    tip(
      'That last row is the interview answer. Hitting every shard sounds worse until you notice that each one returns ten results instead of a hundred-million-entry postings list — **the network cost is what decides it**, not the number of machines involved.',
    ),

    h('Retrieval then ranking'),
    flow(['Query', 'Retrieve ~1000s', 'Cheap scoring', 'Expensive re-rank ~100s', 'Top 10'], 'A funnel'),
    p(
      'Ranking is a funnel because the expensive signals cannot be run on millions of documents. Cheap term-match scoring narrows to thousands, a heavier model re-ranks hundreds, and only the top handful get snippet generation.',
    ),
    table(
      ['Stage', 'Documents', 'What runs'],
      [
        ['Retrieval', 'Billions → thousands', 'Postings list intersection'],
        ['Cheap scoring', 'Thousands → hundreds', 'TF-IDF/BM25, static page quality'],
        ['Re-ranking', 'Hundreds → tens', 'Learned model, query-document features, personalisation'],
        ['Presentation', 'Tens → ten', 'Snippet generation, deduplication, diversity'],
      ],
    ),

    h('Caching'),
    table(
      ['Cache', 'Hit rate', 'Why'],
      [
        ['**Result cache** (query → results)', 'Very high', 'Query distribution is extremely long-tailed but head-heavy'],
        ['**Postings cache**', 'High', 'Common terms appear in most queries'],
        ['**Document/snippet cache**', 'High', 'Popular pages appear in many result sets'],
      ],
    ),
    warn(
      'A result cache is only safe because results change slowly. Anything personalised or freshness-sensitive — news, "near me" — **must bypass it**, which is why a cache key includes far more than the query string.',
    ),

    h('Scale'),
    table(
      ['Dimension', 'Order of magnitude', 'What breaks first'],
      [
        ['Indexed documents', 'Hundreds of billions', 'Index size — hence thousands of shards'],
        ['Queries', '~100k QPS', 'Fan-out amplification: 100k × N shards'],
        ['Latency budget', '**< 200ms end to end**', 'The slowest shard — hence tail-tolerant serving'],
        ['Index size', '~100+ PB', 'Storage and the cost of rebuilding'],
        ['Crawl rate', 'Billions of pages/day', 'Politeness limits, not your capacity'],
      ],
    ),
    tip(
      'Fan-out amplification is the number people miss: at 100k QPS across 1,000 shards, the **serving tier internally handles 100 million requests a second**. That is why each shard is small, in memory, and returns almost nothing.',
    ),

    h('Failures'),
    table(
      ['What dies', 'Effect', 'Mitigation'],
      [
        ['One index shard', 'Slightly worse results', 'Return without it — a missing 0.1% of the corpus is invisible'],
        ['One shard is slow', 'Would blow the latency budget', 'Hedged requests to a replica; answer at the deadline regardless'],
        ['Ranking model service', 'Worse ordering', 'Fall back to the cheap scorer'],
        ['Crawler', 'Index goes stale', 'Not user-visible for hours'],
        ['Indexer', 'New pages are not searchable', 'The live index keeps serving; it is swapped, not mutated'],
      ],
    ),
    p(
      '**Answer at the deadline** is the architectural principle here: the serving tier returns whatever it has when the budget expires rather than waiting for a straggler. Completeness is traded for latency, on every single query.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'Web-scale search: crawl, index, serve in 200ms'],
      ['The hard part', 'Sharding an index of hundreds of billions of documents'],
      ['Key decision', 'Partition by document, not by term; scatter-gather with a hard deadline'],
      ['Trade-off', 'Every query touches every shard, and the answer is cut off at the deadline'],
      [
        '30-second answer',
        '"Three decoupled systems. A crawler works a prioritised URL frontier into a deduplicated document store. An indexer builds an inverted index, sharded by document rather than term — so each shard is self-contained and returns only its top-k, keeping network cost flat. Serving scatters the query to all shards, gathers, and re-ranks in a funnel: cheap scoring on thousands, a learned model on hundreds. Results are heavily cached, and the tier answers at the deadline even if a shard is slow."',
      ],
    ]),
    asked([
      ['How do you shard an inverted index?', 'By document. Term partitioning creates hotspots on common words and ships huge postings lists over the network.'],
      ['Why does every query hit every shard?', 'Because each shard holds a slice of the corpus. It is fine — each returns ten results, not a postings list.'],
      ['How do you hit 200ms?', 'In-memory shards, heavy caching, a ranking funnel, and answering at the deadline rather than waiting.'],
      ['What if one shard is slow?', 'Hedge to a replica and return without it. Missing a fraction of the corpus is invisible.'],
      ['How is ranking separated from retrieval?', 'Retrieval finds candidates cheaply; ranking is a funnel that gets more expensive as the set gets smaller.'],
    ]),

    interviewLevel('Google'),
    links(
      wiki('Inverted_index', 'Inverted index'),
      wiki('Okapi_BM25', 'BM25'),
    ),
  ],
};
