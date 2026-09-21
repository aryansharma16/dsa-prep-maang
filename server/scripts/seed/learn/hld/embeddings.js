import { asked, code, diagram, flow, h, js, links, p, quick, table, tip, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'An embedding is **a list of numbers positioned so that similar things are close together.** That is the whole idea: meaning becomes geometry, and "find things like this" becomes "find nearby points".',
    ),

    h('The idea'),
    diagram(
      `
   text ──▶ model ──▶ [0.021, -0.44, 0.87, ... ]   1536 numbers

   arranged so DISTANCE means SIMILARITY

              ▲
              │        ● dog
              │      ● puppy
              │   ● cat
              │
              │                    ● car
              │                  ● truck
              │
              └────────────────────────────▶

   "puppy" is near "dog" because the model placed them there,
   not because they share letters.

   ──▶ this is why embedding search finds "winter coat" for a
       query of "warm jacket", and keyword search does not.
`,
      'Meaning as position',
    ),

    h('Similarity'),
    table(
      ['Metric', 'Measures', 'Use'],
      [
        ['**Cosine**', 'The angle between vectors', '**The default** — ignores magnitude'],
        ['**Dot product**', 'Angle and magnitude', 'Same as cosine **if vectors are normalised**'],
        ['**Euclidean (L2)**', 'Straight-line distance', 'Some image models'],
      ],
    ),
    tip(
      'Normalise your vectors and cosine and dot product become the same thing — and dot product is faster. **Most embedding APIs return normalised vectors already**, which is why nearly every vector index defaults to cosine or inner product.',
    ),

    h('Dimensionality'),
    table(
      ['Dimensions', 'Storage (fp32)', 'Quality', 'Note'],
      [
        ['384', '1.5 KB', 'Good', 'Small models; fast, cheap'],
        ['768', '3 KB', 'Better', 'A common middle'],
        ['1536', '6 KB', 'Better still', 'Typical for large API models'],
        ['3072', '12 KB', 'Marginally better', 'Often not worth the cost'],
      ],
    ),
    diagram(
      `
   10 million documents

   1536 dims × 4 bytes = 6 KB each    ──▶  60 GB
   int8 quantised (1 byte)            ──▶  15 GB
   binary (1 bit)                     ──▶  1.9 GB

   plus the index structure on top (HNSW roughly doubles it).

   ──▶ memory is the cost driver, and quantisation is a
       4x to 32x reduction for a few percent of recall.
`,
      'Why quantisation is standard at scale',
    ),
    warn(
      'More dimensions is not reliably better. **Doubling dimensions doubles storage and slows every search**, and the quality gain past about 1024 is usually marginal — measure recall on your own data before paying for it.',
    ),

    h('The migration problem'),
    p(
      'Embeddings from different models are **not comparable.** Change the model and every stored vector becomes meaningless relative to new queries — there is no conversion, only re-embedding.',
    ),
    diagram(
      `
   you upgrade the embedding model.

   stored vectors: model A            query vector: model B
        │                                  │
        └──────────── compare ─────────────┘
                        │
                        ▼
                  MEANINGLESS. the spaces are unrelated.

   THE MIGRATION

   1. new index, embed everything with model B   (expensive, slow)
   2. dual-write: new documents into both
   3. shadow-query B, compare quality against A
   4. switch reads to B
   5. delete A

   ──▶ budget for a full re-embed. 10M documents at
       API rates is real money and real time.
`,
      'Budget for this before you choose a model',
    ),
    tip(
      'Store the **model name and version alongside every vector.** Without it, an index silently containing vectors from two models produces quietly wrong results that no error message explains — and you cannot tell which rows need re-embedding.',
    ),

    h('Chunking'),
    p(
      'You cannot embed a long document usefully in one vector — detail averages out. So documents are split, and **how you split them is the single biggest lever on retrieval quality.**',
    ),
    table(
      ['Strategy', 'Good', 'Bad'],
      [
        ['**Fixed size (500 tokens)**', 'Simple, predictable', 'Cuts mid-sentence, splitting meaning'],
        ['**Fixed + overlap (~10%)**', 'Context spans the boundary', 'Duplicated content'],
        ['**By structure** (heading, paragraph)', '**Respects meaning**', 'Very uneven sizes'],
        ['**Semantic**', 'Splits where the topic changes', 'Expensive to compute'],
        ['**Small chunks, large retrieval unit**', '**Precise matching, full context returned**', 'Two things to store'],
      ],
    ),
    tip(
      'The last row is the technique worth knowing: **embed small chunks for precise matching, but return the surrounding section to the model.** You get the retrieval accuracy of small chunks and the context of large ones.',
    ),

    h('What they are used for'),
    flow(['Embed', 'Index', 'Query', 'Nearest neighbours'], 'One pattern, many products'),
    table(
      ['Use', 'How'],
      [
        ['**Semantic search**', 'Embed the query, find nearby documents'],
        ['**RAG retrieval**', 'The same, feeding a language model'],
        ['**Recommendations**', 'Items near the ones a user engaged with'],
        ['**Deduplication**', 'Near-identical vectors are near-duplicate content'],
        ['**Classification**', 'Nearest labelled example'],
        ['**Clustering**', 'Group by proximity to find topics'],
      ],
    ),
    code(
      js(`
// Batch, always. Per-item calls waste most of the throughput
// and most of the rate limit.
const vectors = await embedder.embed(chunks.map((c) => c.text));

await index.upsert(
  chunks.map((chunk, i) => ({
    id: chunk.id,
    vector: vectors[i],
    metadata: {
      docId: chunk.docId,
      // The model, stored with the vector. Without it you cannot
      // tell which rows need re-embedding after an upgrade.
      model: 'embed-v3',
      tenantId: chunk.tenantId,   // filterable at query time
    },
  })),
);
`),
    ),

    h('Interview'),
    quick([
      ['What it is', 'A vector placing similar things near each other'],
      ['Why it exists', 'It turns "find things like this" into a geometry problem'],
      ['Use when', 'Semantic search, RAG, recommendations, deduplication'],
      ['Trade-off', 'Meaning-based matching, at the cost of exact-match precision and memory'],
      [
        '30-second answer',
        '"An embedding maps content to a vector positioned so that similar things are close, which is why it finds \\"winter coat\\" for \\"warm jacket\\" where keyword search cannot. Compare with cosine, or dot product on normalised vectors. Dimensionality drives memory — ten million documents at 1536 dimensions is 60GB, so quantisation to int8 is standard. And embeddings from different models are incomparable, so an upgrade means re-embedding everything: store the model version with every vector."',
      ],
    ]),
    asked([
      ['What is an embedding?', 'A vector representation where distance encodes similarity, so nearest neighbours are semantically related.'],
      ['Cosine or dot product?', 'Equivalent for normalised vectors, and dot product is faster. Most models return normalised output.'],
      ['What happens when you change model?', 'Every stored vector becomes incomparable. You must re-embed everything — budget for it.'],
      ['How do you choose chunk size?', 'Embed small chunks for precision but return the surrounding section for context.'],
      ['Are more dimensions better?', 'Only marginally past about 1024, and they cost storage and search time linearly.'],
    ]),

    links(
      wiki('Word_embedding', 'Word embedding'),
      wiki('Cosine_similarity', 'Cosine similarity'),
    ),
  ],
};
