import { asked, code, diagram, flow, h, js, links, p, quick, table, tip, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'A `LIKE \'%phone%\'` query scans every row, cannot rank, cannot handle a typo and cannot tell you *how* relevant a result is. Search is a different data structure — **the inverted index** — living in a different store, fed from your database.',
    ),

    h('The inverted index'),
    diagram(
      `
   DOCUMENTS                         INVERTED INDEX

   d1 "red running shoes"            red      ──▶ [d1, d3]
   d2 "blue running jacket"          running  ──▶ [d1, d2]
   d3 "red winter coat"              shoes    ──▶ [d1]
                                     blue     ──▶ [d2]
   a FORWARD index maps              jacket   ──▶ [d2]
   doc ──▶ terms                     winter   ──▶ [d3]
   (a table scan)                    coat     ──▶ [d3]

   query "red shoes"
     red   ──▶ [d1, d3]
     shoes ──▶ [d1]
              ───────── intersect ──▶ [d1]

   two sorted-list lookups and a merge. no scan, at any scale.
`,
      'Why it is a different structure, not a different query',
    ),

    h('Getting terms out of text'),
    flow(['Tokenise', 'Lowercase', 'Remove stopwords', 'Stem', 'Synonyms'], 'The analysis chain'),
    table(
      ['Step', 'Turns', 'Into'],
      [
        ['**Tokenise**', '"Red Running Shoes!"', '`[Red, Running, Shoes]`'],
        ['**Lowercase**', '`[Red, ...]`', '`[red, ...]`'],
        ['**Stopwords**', '`[the, red, ...]`', '`[red, ...]`'],
        ['**Stemming**', '`[running, shoes]`', '`[run, shoe]`'],
        ['**Synonyms**', '`[shoe]`', '`[shoe, sneaker, trainer]`'],
        ['**N-grams**', '`[shoe]`', '`[sh, ho, oe]` — for typo tolerance'],
      ],
    ),
    warn(
      'The **same analysis must run at index time and at query time.** Index "running" as `run` but search for the literal `running` and you match nothing — a silent, baffling failure that is among the most common search bugs.',
    ),

    h('Relevance'),
    table(
      ['Signal', 'Idea'],
      [
        ['**TF** — term frequency', 'More occurrences in a document means more relevant'],
        ['**IDF** — inverse document frequency', 'A rare term is more informative than a common one'],
        ['**BM25**', 'TF-IDF with saturation and length normalisation — **the default**'],
        ['**Field boosting**', 'A match in the title beats one in the body'],
        ['**Freshness**', 'Recent documents rank higher, for news-like content'],
        ['**Popularity / behaviour**', 'Click-through and conversion — usually the strongest signal you have'],
      ],
    ),
    tip(
      'Text relevance alone rarely produces a good product search. **Behavioural signals dominate** — what people clicked and bought for this query — so mature systems use BM25 to retrieve candidates and a learned model to rank them.',
    ),

    h('Keeping the index in step'),
    diagram(
      `
   the database is the TRUTH. the index is DERIVED.

   ┌──────────┐   CDC / outbox   ┌───────┐   ┌────────────┐
   │ database │─────────────────▶│ queue │──▶│  indexer   │
   └──────────┘                  └───────┘   └─────┬──────┘
                                                   ▼
                                            ┌────────────┐
                                            │   index    │
                                            └────────────┘

   ✓ derived ──▶ can lag, can be rebuilt, can be sharded
                 differently from the source
   ✗ dual-writing from application code WILL drift
     (the code path that forgets is the one you never test)

   REBUILDS: build into a NEW index, then swap the alias.
             never rebuild in place — you would have no search
             while it runs.
`,
      'Derived data, and the alias swap',
    ),
    table(
      ['Approach', 'Freshness', 'Reliability'],
      [
        ['Dual write from the app', 'Instant', '**Drifts** — no transaction spans both'],
        ['**Event or CDC driven**', 'Seconds', '**Reliable** — the DB emits it'],
        ['Periodic full reindex', 'Hours', 'Reliable, expensive'],
        ['Hybrid: CDC + nightly rebuild', 'Seconds, self-healing', '**What most do**'],
      ],
    ),

    h('Sharding'),
    code(
      js(`
// Partition by DOCUMENT, not by term. Each shard holds a slice of
// the corpus and is self-contained, so a query fans out and each
// shard returns only its top-k — not a whole postings list.
async function search(query, k = 10) {
  const perShard = await Promise.all(
    shards.map((s) =>
      // A deadline, not a promise of completeness: returning in
      // 200ms without one shard beats waiting for a straggler.
      s.topK(query, k).catch(() => []),
    ),
  );
  return perShard.flat().sort(byScore).slice(0, k);
}
`),
    ),
    p(
      'Term partitioning — shard 1 holds `a–f` — sounds appealing and fails: common words become hotspots, and intersecting two postings lists means shipping them across the network. **Document partitioning is what everyone uses**, and every query touching every shard is fine because each returns ten results.',
    ),

    h('Beyond keywords'),
    table(
      ['Type', 'Matches on', 'Good at', 'Bad at'],
      [
        ['**Keyword (BM25)**', 'Exact terms', 'Precision, names, codes, filters', 'Synonyms and paraphrase'],
        ['**Vector / semantic**', 'Embedding similarity', 'Meaning — "warm jacket" finds "winter coat"', 'Exact strings and rare identifiers'],
        ['**Hybrid**', 'Both, scores fused', '**Most real queries**', 'More to tune and operate'],
      ],
    ),
    tip(
      'Hybrid is the modern default and a good thing to name. **Keyword search cannot find "warm jacket" from "winter coat", and vector search cannot reliably find a part number** — so you run both and fuse the rankings.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'An inverted index with relevance ranking, kept in step with your data'],
      ['Why it exists', 'A relational query cannot rank, stem or tolerate typos'],
      ['Use when', 'Any free-text search over more than a trivial dataset'],
      ['Trade-off', 'Relevance and speed, for eventual consistency and a second store'],
      [
        '30-second answer',
        '"Search is an inverted index — term to sorted document list — so a query is a few lookups and a merge rather than a scan. Text goes through the same analysis chain at index and query time: tokenise, lowercase, stem, synonyms. Ranking is BM25 for retrieval plus behavioural signals for the real ordering. The index is derived data fed by CDC or an outbox, never dual-written, and rebuilt into a new index with an alias swap. Shard by document, not by term."',
      ],
    ]),
    asked([
      ['How does an inverted index work?', 'Term to a sorted list of document ids. A query intersects a few lists instead of scanning rows.'],
      ['Why not use LIKE?', 'No ranking, no stemming, no typo tolerance, and it scans every row.'],
      ['How do you keep the index fresh?', 'CDC or an outbox feeding an indexer. Dual-writing from application code drifts.'],
      ['How do you shard a search index?', 'By document. Term partitioning creates hotspots on common words and ships postings lists over the network.'],
      ['Keyword or vector search?', 'Hybrid. Keyword cannot handle paraphrase; vector cannot reliably match a part number.'],
    ]),

    links(wiki('Inverted_index', 'Inverted index'), wiki('Okapi_BM25', 'BM25')),
  ],
};
