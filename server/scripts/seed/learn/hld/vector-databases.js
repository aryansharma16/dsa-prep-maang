import { asked, code, diagram, h, js, links, p, quick, table, tip, tradeoff, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Finding the nearest vector among ten million by comparing all of them is **ten million dot products per query**. A vector database trades exactness for speed: it finds *almost* the nearest neighbours, in milliseconds, and the dial between those two is the whole product.',
    ),

    h('Approximate nearest neighbour'),
    diagram(
      `
   EXACT (brute force)               APPROXIMATE (ANN)

   compare the query to every        navigate a structure that
   vector                            skips most of the data

   10M × 1536 dims                   ~log(N) comparisons
   ≈ 15 billion operations
   ≈ seconds                         ≈ single-digit milliseconds

   ✓ perfectly correct               ✓ 100-1000x faster
   ✗ unusable past ~100k             ✗ RECALL < 100%
                                        you may miss a true
                                        neighbour occasionally

   recall 0.95 means: of the true top 10, you found ~9.5.
   for search and RAG, that is invisible. for an exact-match
   requirement, it is wrong.
`,
      'The trade the whole category is built on',
    ),

    h('HNSW'),
    p(
      'The dominant index. A **multi-layer graph** — sparse at the top for long jumps, dense at the bottom for precision — searched greedily from the top down.',
    ),
    diagram(
      `
   layer 2   ●───────────────────●          few nodes, long edges
              ╲                 ╱            (the express train)
   layer 1   ●───●─────────●───●            more nodes
              ╲   ╲       ╱   ╱
   layer 0   ●─●─●─●─●─●─●─●─●─●            EVERY node
                     ▲
                   query

   1. enter at the top, greedily move toward the query
   2. drop a layer, repeat with finer granularity
   3. at layer 0, explore the local neighbourhood

   ──▶ ~log(N) hops instead of N comparisons
`,
      'Long jumps first, then precision',
    ),
    table(
      ['Parameter', 'Controls', 'Raising it'],
      [
        ['`M`', 'Edges per node', 'Better recall, more memory'],
        ['`efConstruction`', 'Effort at build time', 'Better index, slower to build'],
        ['`efSearch`', '**Effort at query time**', '**Better recall, slower queries** — the live dial'],
      ],
    ),
    tip(
      '`efSearch` is tunable **per query**, which is more useful than it sounds: run a low value for an autocomplete dropdown and a high one for a RAG retrieval where a missed document changes the answer. One index, two quality levels.',
    ),

    h('The index families'),
    table(
      ['Index', 'How', 'Strength', 'Weakness'],
      [
        ['**HNSW**', 'Layered graph', '**Best recall/speed; the default**', 'Memory-hungry; slow to build'],
        ['**IVF**', 'Cluster, search the nearest clusters', 'Memory-efficient, fast build', 'Recall depends on cluster count'],
        ['**IVF-PQ**', 'IVF plus compressed vectors', '**Huge datasets on modest memory**', 'Lower recall'],
        ['**Flat**', 'Brute force', '**Exact**', 'Only viable below ~100k'],
        ['**ScaNN / DiskANN**', 'Optimised or disk-backed', 'Billions of vectors', 'More complex to operate'],
      ],
    ),
    tradeoff([
      ['**HNSW**', 'Excellent recall at single-digit milliseconds', 'Roughly doubles the memory the raw vectors need'],
      ['**IVF-PQ**', 'Fits billions of vectors in reasonable memory', 'Noticeably lower recall; more tuning'],
    ]),

    h('Filtering — the part that bites'),
    warn(
      'Almost every real query is filtered: *this tenant*, *these documents*, *not archived*. **Filtering interacts badly with ANN indexes**, and getting it wrong is the most common cause of "the vector search returns nothing".',
    ),
    diagram(
      `
   POST-FILTER                       PRE-FILTER
   search, then filter               filter, then search

   top 100 by similarity             find matching ids first
        │                                 │
        ▼ keep those matching             ▼ search only those
   tenant = acme                     ✓ always returns k results
        │                            ✗ a small subset may fall
        ▼                              back to brute force
   3 results. or zero.
   ✗ the filter threw away almost    HYBRID (what good engines do)
     everything                      filter DURING graph traversal
`,
      'Three strategies, one usable',
    ),
    tip(
      'For multi-tenant systems, **a namespace or partition per tenant beats a metadata filter.** It is exact, it removes the filtering problem entirely, and it means one tenant\'s data cannot be returned to another even if a filter is forgotten.',
    ),

    h('Do you need a dedicated one?'),
    table(
      ['Option', 'Good up to', 'When'],
      [
        ['**pgvector**', '~1M vectors comfortably', '**Already on Postgres. Start here**'],
        ['**Elasticsearch / OpenSearch**', 'Millions', 'Already running it; hybrid search built in'],
        ['**Dedicated (Pinecone, Weaviate, Qdrant, Milvus)**', 'Billions', 'Scale, or you want it managed'],
        ['**In-process (FAISS, hnswlib)**', 'Millions', 'A static index in a single service'],
      ],
    ),
    p(
      'The honest default is **pgvector**. Transactions with your other data, one system to operate, and your vectors and their source rows stay in step — which is a real operational advantage over a separate store that can drift.',
    ),

    h('Hybrid search'),
    code(
      js(`
// Reciprocal rank fusion: combine two rankings without needing
// their scores to be on comparable scales, which they are not.
function fuse(keywordHits, vectorHits, k = 60) {
  const scores = new Map();
  const add = (hits) =>
    hits.forEach((hit, rank) => {
      scores.set(hit.id, (scores.get(hit.id) ?? 0) + 1 / (k + rank + 1));
    });

  add(keywordHits);   // finds exact terms, part numbers, names
  add(vectorHits);    // finds paraphrase and meaning
  return [...scores].sort((a, b) => b[1] - a[1]);
}
`),
    ),
    warn(
      'Pure vector search **cannot reliably find an exact string** — a product code or an error identifier may not be near its query in embedding space. Hybrid search is not an optimisation; it is what makes the feature correct for a whole class of query.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'An index for approximate nearest-neighbour search over vectors'],
      ['Why it exists', 'Exact search is linear and unusable past a hundred thousand vectors'],
      ['Use when', 'Semantic search, RAG, recommendations at scale'],
      ['Trade-off', 'Recall against latency and memory, tunable per query'],
      [
        '30-second answer',
        '"Exact nearest-neighbour is linear and unusable past about a hundred thousand vectors, so these indexes are approximate — HNSW navigates a layered graph in log time, with efSearch as a live dial between recall and latency. The part that bites is filtering: post-filtering can return nothing, so use an engine that filters during traversal, or a namespace per tenant. And start with pgvector — a dedicated store earns its place at tens of millions of vectors, not before."',
      ],
    ]),
    asked([
      ['How does HNSW work?', 'A layered graph — sparse upper layers for long jumps, dense bottom layer for precision, searched greedily in log time.'],
      ['What is recall and why accept less than 100%?', 'The share of true neighbours found. Exact search is orders of magnitude slower and the difference is invisible for search.'],
      ['Do you need a dedicated vector database?', 'Not below a few million vectors. pgvector keeps them transactional with your source data.'],
      ['Why is filtering hard?', 'Post-filtering can discard nearly all results. Pre-filtering can degrade to brute force. Filter during traversal.'],
      ['Why hybrid search?', 'Vector search cannot reliably match an exact part number; keyword search cannot match a paraphrase.'],
    ]),

    links(
      wiki('Nearest_neighbor_search', 'Nearest neighbour search'),
      wiki('Hierarchical_navigable_small_world', 'HNSW'),
    ),
  ],
};
