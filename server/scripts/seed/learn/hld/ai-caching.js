import { asked, code, diagram, flow, h, js, links, p, quick, table, tip, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Three caches with three different keys, and three different risks. A cache hit on an inference call saves **close to 100% of its cost and latency** — which makes caching the highest-leverage decision in an AI system, and the semantic one the most dangerous.',
    ),

    h('The three'),
    diagram(
      `
   1. EXACT CACHE            key = hash(model, prompt, params)

      identical request ──▶ stored response
      ✓ always safe        ✗ hit rate is low for free text


   2. PREFIX / PROMPT CACHE  key = the shared prefix

      [ system prompt · 2000 tokens ][ user question ]
      └──── prefilled ONCE, reused ──┘└─ computed per request ─┘

      ✓ safe, large saving  ✗ prefix must be byte-identical
      ✓ cuts cost AND time-to-first-token


   3. SEMANTIC CACHE         key = the embedding of the query

      "how do I reset my password"   ─┐
      "I forgot my password"          ├─ similar ──▶ same answer
      "password reset steps"         ─┘

      ✓ high hit rate       ✗ SIMILAR IS NOT THE SAME
`,
      'Three keys, three risk levels',
    ),
    table(
      ['Cache', 'Hit rate', 'Risk', 'Saving on a hit'],
      [
        ['**Exact**', 'Low for free text; high for templates', '**None**', '~100%'],
        ['**Prefix**', 'Very high with a shared system prompt', '**None**', 'Prefill cost + TTFT'],
        ['**Semantic**', 'High', '**Wrong answers**', '~100%'],
        ['**Embedding cache**', 'High on repeated content', 'None', 'The embedding call'],
      ],
    ),

    h('Prefix caching — start here'),
    p(
      'If a system prompt, a set of instructions or a shared document precedes every request, its prefill is being **recomputed on every single call.** Prefix caching computes it once and reuses the resulting state.',
    ),
    diagram(
      `
   typical request:  2,000-token system prompt + 50-token question

   WITHOUT prefix cache     prefill 2,050 tokens, every time
   WITH prefix cache        prefill 50 tokens

   ──▶ ~97% less prefill compute
   ──▶ noticeably faster time-to-first-token
   ──▶ no behaviour change, no risk

   the catch: the prefix must be BYTE-IDENTICAL. so put
   anything variable — a timestamp, a user name — AFTER
   the shared block, never inside it.
`,
      'Free, once you order the prompt correctly',
    ),
    tip(
      'Prompt ordering is now a performance decision. **Stable content first, variable content last** — a user id interpolated into the middle of a system prompt destroys the shared prefix for every request and nobody notices except the bill.',
    ),

    h('Semantic caching, and where it bites'),
    warn(
      'Similar questions do not always have the same answer. **"What is my account balance"** and **"what was my account balance last month"** are close in embedding space and must never share a cached response — and a threshold tuned on average queries will happily conflate them.',
    ),
    table(
      ['Safe for', 'Dangerous for'],
      [
        ['FAQ and documentation answers', 'Anything personalised'],
        ['Generic explanations', 'Anything with a date or time qualifier'],
        ['Classification of common inputs', 'Numbers, quantities, negations'],
        ['Deterministic, stable content', 'Anything the user can act on financially'],
      ],
    ),
    code(
      js(`
async function semanticLookup(query, opts) {
  const vector = await embed(query);
  const [best] = await cacheIndex.search(vector, {
    topK: 1,
    // Namespaced, because two tenants asking the same question
    // may still require different answers.
    namespace: opts.tenantId,
  });

  // 0.97 is deliberately strict. At 0.85 you will serve the answer
  // to a different question, and the failure is silent — nobody
  // reports a plausible answer as a bug.
  if (best && best.score >= 0.97) {
    metrics.increment('ai.cache.semantic.hit');
    return best.payload.response;
  }
  return null;
}
`),
    ),
    tip(
      '**Start the threshold high and lower it with evidence.** Log near-misses with their scores and review them; a cache that occasionally answers the wrong question produces no errors, no alerts and no bug reports — only quietly worse answers.',
    ),

    h('What to cache besides responses'),
    table(
      ['Cache', 'Why'],
      [
        ['**Embeddings**', 'Content that has not changed does not need re-embedding'],
        ['**Retrieved chunks**', 'A repeated query re-runs the whole retrieval otherwise'],
        ['**Rerank scores**', 'Query-document pairs recur'],
        ['**Tool results**', 'An agent calling the same tool with the same arguments'],
        ['**Partial generations**', 'A shared beginning, where responses have a fixed structure'],
      ],
    ),

    h('Invalidation'),
    flow(['Source changes', 'Version key', 'Old entries orphaned'], 'The familiar pattern'),
    table(
      ['Trigger', 'Must invalidate'],
      [
        ['**Model version changes**', '**Everything** — put the model in the key'],
        ['Prompt template changes', 'Everything using it — version the template'],
        ['Source documents change', 'Cached RAG answers citing them'],
        ['Temperature or parameters change', 'Entries generated with the old ones'],
        ['A user corrects an answer', 'That entry, immediately'],
      ],
    ),
    warn(
      'Put the **model version and prompt template version in the cache key.** Without them, a model upgrade serves answers from the previous model indefinitely — and a prompt fix appears not to have worked, for reasons nobody can find.',
    ),

    h('Measuring it'),
    table(
      ['Metric', 'Watch for'],
      [
        ['Hit rate per layer', 'Which cache is actually earning its place'],
        ['**Cost saved**', 'The number that justifies the complexity'],
        ['Semantic near-miss distribution', 'Whether the threshold is safe'],
        ['**Negative feedback on cached answers**', '**The signal that the threshold is too loose**'],
        ['Staleness complaints', 'Invalidation is not firing'],
      ],
    ),
    tip(
      'Track feedback **separately for cached and generated responses.** If cached answers get materially more thumbs-down, the semantic threshold is too loose — and that comparison is the only reliable way to detect it.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'Three caches keyed on exact match, shared prefix and meaning'],
      ['Why it matters', 'A hit saves essentially the whole cost of an inference'],
      ['Use when', 'Always for exact and prefix; carefully for semantic'],
      ['Trade-off', 'Semantic caching buys hit rate and risks answering a different question'],
      [
        '30-second answer',
        '"Three layers. An exact cache is free and safe but has a low hit rate on free text. Prefix caching prefills a shared system prompt once — often 97% of the prefill, plus faster first token, at no risk — which makes prompt ordering a performance decision. A semantic cache matches by embedding similarity and is the dangerous one, because similar questions can need different answers. Keep the threshold strict, namespace per tenant, and put the model and prompt versions in every cache key."',
      ],
    ]),
    asked([
      ['What is prompt caching?', 'Reusing the prefilled state of a shared prompt prefix, so only the variable tail is computed.'],
      ['Why is semantic caching risky?', 'Similar questions can need different answers — negations, dates and personalisation are close in embedding space.'],
      ['What threshold should a semantic cache use?', 'Start strict, around 0.95 or higher, and lower it only with evidence from logged near-misses.'],
      ['What belongs in the cache key?', 'Model version, prompt template version, parameters and tenant. Otherwise an upgrade serves old answers.'],
      ['How do you know the cache is hurting quality?', 'Compare feedback on cached versus generated answers. It produces no errors, only worse results.'],
    ]),

    links(wiki('Cache_(computing)', 'Caching'), wiki('Semantic_search', 'Semantic search')),
  ],
};
