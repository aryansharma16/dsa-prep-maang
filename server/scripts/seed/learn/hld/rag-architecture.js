import { asked, diagram, flow, h, links, p, quick, table, tip, tradeoff, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Retrieval-augmented generation is **search with a language model on the end.** The model supplies fluency; the retrieval supplies facts — and almost every RAG system that disappoints is failing at the search half, not the generation half.',
    ),

    h('The full pipeline'),
    diagram(
      `
   INGEST (offline)                  QUERY (per request)

   documents                         user question
      │                                  │
      ▼                                  ▼
   ┌──────────┐                     ┌──────────────┐
   │  parse   │  PDF, HTML, docs    │ rewrite      │ expand, resolve
   └────┬─────┘                     │ the query    │ "it", "that one"
        ▼                           └──────┬───────┘
   ┌──────────┐                            ▼
   │  chunk   │  ◀── the biggest      ┌──────────────┐
   └────┬─────┘      quality lever    │  retrieve    │ vector + keyword
        ▼                             │  top ~50     │ + metadata filter
   ┌──────────┐                       └──────┬───────┘
   │  embed   │                              ▼
   └────┬─────┘                       ┌──────────────┐
        ▼                             │   rerank     │ cross-encoder
   ┌──────────┐                       │  50 ──▶ 5    │ ◀── biggest
   │  index   │◀──────────────────────└──────┬───────┘     accuracy win
   └──────────┘   same embedding             ▼
                  model, both ends    ┌──────────────┐
                                      │   generate   │ + citations
                                      └──────┬───────┘
                                             ▼
                                      ┌──────────────┐
                                      │  grounding   │ is every claim
                                      │    check     │ supported?
                                      └──────────────┘
`,
      'Nine stages, and two of them decide everything',
    ),

    h('Where quality actually comes from'),
    table(
      ['Stage', 'Impact on answer quality', 'Effort'],
      [
        ['**Chunking**', '**Very high**', 'Low — it is a tuning exercise'],
        ['**Reranking**', '**Very high**', 'Low — one extra call'],
        ['Hybrid retrieval', 'High', 'Medium'],
        ['Query rewriting', 'Medium–high for conversations', 'Low'],
        ['Metadata filtering', 'High, where applicable', 'Low'],
        ['Embedding model', 'Medium', 'Low, but re-embedding is costly'],
        ['**A bigger generator**', '**Low**', 'High cost'],
      ],
    ),
    tip(
      'The last row is the point. **Teams reach for a bigger model when the retrieval is bad**, and a bigger model given the wrong context produces a more fluent wrong answer. Fix chunking and add a reranker first — they are cheap and they are where the quality is.',
    ),

    h('Reranking'),
    diagram(
      `
   RETRIEVAL (bi-encoder)            RERANK (cross-encoder)

   query ──▶ [vector]                query + document together
   doc   ──▶ [vector]                        │
             compare                         ▼
                                       one model pass per pair
   ✓ documents embedded in advance     ✓ far more accurate — the
   ✓ millisecond search                  model SEES both texts
   ✗ query and document never meet     ✗ cannot precompute
                                       ✗ ~50-100 ms per batch

   so: retrieve 50 cheaply, rerank to 5 accurately.

   this single step is typically the largest accuracy gain
   available in a RAG system.
`,
      'Two models, two jobs',
    ),

    h('Where RAG goes wrong'),
    table(
      ['Symptom', 'Cause', 'Fix'],
      [
        ['Retrieves the wrong chunks', 'Chunks split mid-idea', 'Structure-aware chunking; overlap'],
        ['Misses an obvious document', 'Vector-only retrieval', '**Hybrid** — add keyword search'],
        ['Right document, wrong section', 'Chunks too large', 'Smaller chunks, return the surrounding section'],
        ['Answers from the wrong tenant', '**Filter not applied**', 'Namespace per tenant, not a metadata filter'],
        ['Confidently wrong', 'Nothing relevant retrieved, model answered anyway', '**A relevance threshold — say "I do not know"**'],
        ['Ignores retrieved context', 'Too many chunks; the middle is lost', 'Fewer, better chunks after reranking'],
        ['Stale answers', 'Index not updated', 'CDC or event-driven ingestion'],
      ],
    ),
    warn(
      'The fifth row is the dangerous one. **When retrieval finds nothing relevant, the model will still answer** — from its training data, fluently, with no signal that it is unsupported. A minimum relevance score, below which you refuse, is the single most important guardrail in a RAG system.',
    ),

    h('Citations and grounding'),
    flow(['Retrieve with ids', 'Generate with markers', 'Verify each claim', 'Show sources'], 'Trust comes from this'),
    table(
      ['Technique', 'Gives'],
      [
        ['Chunk ids in the prompt', 'The model can cite them'],
        ['Require inline citation markers', 'Traceable claims'],
        ['**Post-hoc grounding check**', 'Each sentence verified against its cited chunk'],
        ['Show sources in the UI', 'The user can verify — which is most of perceived trust'],
        ['Refuse when unsupported', 'No answer beats a wrong one'],
      ],
    ),

    h('RAG or fine-tuning'),
    tradeoff([
      ['**RAG**', 'Knowledge updates instantly, sources are citable, per-tenant data is trivially isolated, and no retraining', 'Retrieval quality is the ceiling; every request carries context tokens'],
      ['**Fine-tuning**', 'Teaches tone, format and task behaviour; shorter prompts', 'Retraining to change facts; no citations; hard to isolate per tenant'],
    ]),
    tip(
      'They answer different questions. **RAG is for knowledge, fine-tuning is for behaviour** — and the common production answer is both: a fine-tuned model that follows your format, retrieving your current documents.',
    ),

    h('Operating it'),
    table(
      ['Concern', 'Handling'],
      [
        ['Ingestion freshness', 'Event-driven or CDC, not a nightly rebuild'],
        ['Re-embedding on model change', 'Dual index, shadow-compare, switch'],
        ['Cost per query', 'Retrieval is cheap; generation is not. Cache aggressively'],
        ['Evaluation', 'A golden question set with expected sources — measure **retrieval** separately from generation'],
        ['Multi-tenancy', 'Namespace per tenant. Never rely on a filter alone'],
      ],
    ),
    tip(
      'Measure retrieval separately. **Track whether the correct document was in the top-k at all**, independently of whether the answer was good — otherwise a retrieval regression and a generation regression are indistinguishable and you tune the wrong half.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'Retrieving relevant context and generating an answer from it'],
      ['The hard part', 'Retrieval quality — the generation is rarely the problem'],
      ['Use when', 'Answers must come from your own current data, with sources'],
      ['Trade-off', 'Fresh, citable knowledge, bounded by how good your search is'],
      [
        '30-second answer',
        '"Ingest by parsing, chunking, embedding and indexing; query by rewriting, retrieving hybrid vector plus keyword, reranking with a cross-encoder, then generating with citations. The quality lives in chunking and reranking, not in a bigger model — a bigger model given bad context is just more fluently wrong. The critical guardrail is a relevance threshold: when nothing relevant is retrieved, the model will answer anyway, so you must refuse instead."',
      ],
    ]),
    asked([
      ['Draw a RAG architecture.', 'Offline: parse, chunk, embed, index. Online: rewrite, hybrid retrieve, rerank, generate with citations, check grounding.'],
      ['Why does RAG retrieve the wrong chunks?', 'Usually chunking that splits ideas, or vector-only retrieval missing exact terms. Add structure-aware chunking and hybrid search.'],
      ['What is the biggest accuracy win?', 'A cross-encoder reranker over the top 50 candidates. One extra call, large gain.'],
      ['RAG or fine-tuning?', 'RAG for knowledge that changes and needs citing; fine-tuning for tone and format. Often both.'],
      ['How do you stop hallucination?', 'A minimum relevance threshold, mandatory citations, and a grounding check. Refusing beats answering unsupported.'],
    ]),

    links(
      wiki('Retrieval-augmented_generation', 'Retrieval-augmented generation'),
      wiki('Learning_to_rank', 'Learning to rank'),
    ),
  ],
};
