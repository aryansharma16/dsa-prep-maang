import { asked, diagram, flow, h, links, p, quick, table, tip, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Serving a language model is not serving a model. **Generation is a loop** — one token per forward pass, each conditioned on everything before it — and every property of LLM infrastructure follows from that loop and from the memory it needs to run.',
    ),

    h('Prefill and decode'),
    diagram(
      `
   PREFILL                           DECODE
   process the whole prompt          generate one token at a time

   "Explain system design"           ──▶ "System"
        │                            ──▶ " design"
        │ all tokens in PARALLEL     ──▶ " is"
        ▼ one forward pass           ──▶ " the"
   compute-bound                     ...

   fast per token                    memory-BANDWIDTH-bound
   scales with prompt length         ~fixed cost per token
                                     N tokens = N forward passes

   ──▶ TIME TO FIRST TOKEN   = prefill
   ──▶ TOKENS PER SECOND     = decode

   these are DIFFERENT bottlenecks. a long prompt hurts the
   first; a long answer hurts the second.
`,
      'Two phases with opposite characteristics',
    ),
    table(
      ['', 'Prefill', 'Decode'],
      [
        ['Processes', 'The whole prompt at once', 'One token per pass'],
        ['Bound by', '**Compute**', '**Memory bandwidth**'],
        ['Parallelism', 'Across prompt tokens', 'Across requests in a batch only'],
        ['Cost driver', 'Input length', 'Output length'],
        ['User feels it as', 'Time to first token', 'Tokens per second'],
      ],
    ),
    tip(
      'Because decode is memory-bandwidth-bound rather than compute-bound, **batching helps enormously**: the weights are read once per pass regardless of how many sequences are in the batch. That is why a serving stack that batches well is many times cheaper per token.',
    ),

    h('The KV cache'),
    p(
      'Every generated token attends to all previous tokens. Recomputing their key and value tensors each step would be quadratic, so they are cached — and **that cache is what actually limits how many users one GPU can serve.**',
    ),
    diagram(
      `
   KV cache size ≈ 2 × layers × heads × head_dim
                     × seq_len × batch × bytes_per_value

   a 7B model, fp16, 4k context:  ~2 GB PER SEQUENCE

   an 80 GB GPU:
     weights (7B, fp16)     ~14 GB
     activations, overhead   ~6 GB
     ─────────────────────────────
     left for KV cache      ~60 GB  ──▶  ~30 concurrent sequences

   ──▶ CONCURRENCY IS A MEMORY PROBLEM, not a compute one.
   ──▶ doubling context length halves your concurrency.
`,
      'The constraint that decides everything',
    ),
    warn(
      'Context length is **not a free parameter.** Offering 128k context instead of 8k cuts your concurrent users by roughly sixteen for the same hardware — so context limits are a capacity decision, not just a product one.',
    ),

    h('Continuous batching'),
    diagram(
      `
   STATIC BATCHING                   CONTINUOUS BATCHING

   4 requests start together.        a finished slot is refilled
   the batch runs until the          IMMEDIATELY from the queue.
   LONGEST finishes.
                                     slot1 ████░ new ███████
   slot1 ████░░░░░░░░░ done early    slot2 ████████████░ new ██
   slot2 ████████████████            slot3 ██░ new ████████████
   slot3 ██░░░░░░░░░░░░ idle         slot4 ████████████████
   slot4 ████████████████
         └─ wasted ─┘                ✓ near-100% slot utilisation
                                     ✓ 2-4x the throughput
   ✗ short requests hold slots       ✓ lower waiting time
     hostage to the longest one
`,
      'The single biggest throughput win in LLM serving',
    ),
    table(
      ['Technique', 'What it does'],
      [
        ['**Continuous batching**', 'Refill finished slots mid-batch — 2–4x throughput'],
        ['**PagedAttention**', 'KV cache in fixed pages, like virtual memory. Removes fragmentation'],
        ['**Prefix caching**', 'A shared system prompt is prefilled once, reused across requests'],
        ['**Chunked prefill**', 'Interleave prefill with decode so a long prompt does not stall generation'],
        ['**Speculative decoding**', 'A small model drafts, the large one verifies several tokens at once'],
      ],
    ),
    tip(
      '**Prefix caching is nearly free and often the largest win in a real product.** A 2,000-token system prompt on every request is prefilled once and reused — cutting both cost and time-to-first-token for every user of that prompt.',
    ),

    h('Streaming'),
    flow(['Prefill', 'First token', 'Stream', 'Done'], 'Perceived latency is the first token'),
    p(
      'Stream over SSE and **time-to-first-token becomes the latency the user feels**. A response starting in 300ms and taking six seconds to finish is a better experience than one delivered whole in four — which makes streaming a product decision as much as a technical one.',
    ),
    table(
      ['Metric', 'Target', 'Driven by'],
      [
        ['**Time to first token**', '< 500 ms', 'Prefill, queue wait, prompt length'],
        ['**Tokens per second**', '> 20–30/s', 'Decode; model size; batch size'],
        ['**Total latency**', 'Varies', 'Output length — the dominant term'],
        ['**Throughput**', 'Tokens/s per GPU', 'Batching efficiency'],
      ],
    ),

    h('Cutting cost'),
    table(
      ['Lever', 'Saving', 'Cost'],
      [
        ['**Cap output tokens**', 'Large — output is the expensive half', 'Truncated answers'],
        ['**Shorter prompts**', 'Prefill and KV memory', 'Less context for the model'],
        ['**Prefix caching**', 'The shared prompt, on every request', 'None, essentially'],
        ['**Quantisation** (int8/int4)', '2–4x memory, so 2–4x concurrency', 'Slight quality loss'],
        ['**Smaller model with routing**', 'Most of the bill', 'Routing logic, and a quality gap on hard queries'],
        ['**Semantic cache**', '100% on a hit', 'Risk of a near-miss answer'],
      ],
    ),
    warn(
      'Output tokens are typically the dominant cost and latency term, and they are **the easiest thing to leave unbounded.** A `max_tokens` cap is one line and prevents a single request generating for minutes.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'Serving autoregressive generation efficiently'],
      ['The hard part', 'KV cache memory limits concurrency, not compute'],
      ['Use when', 'Any LLM on a request path'],
      ['Trade-off', 'Longer context and bigger batches trade against concurrency'],
      [
        '30-second answer',
        '"Two phases: prefill processes the prompt in parallel and is compute-bound; decode emits one token per pass and is memory-bandwidth-bound. The KV cache is the real constraint — gigabytes per sequence, so concurrency is a memory problem and doubling context halves your users. Continuous batching refills finished slots mid-batch for two to four times the throughput, and prefix caching makes a shared system prompt nearly free. Stream, so time-to-first-token is what users feel."',
      ],
    ]),
    asked([
      ['What is the KV cache and why does it matter?', 'Cached key/value tensors for previous tokens. It is gigabytes per sequence and is what limits concurrency.'],
      ['Why are TTFT and tokens per second separate?', 'They come from different phases — prefill is compute-bound, decode is memory-bandwidth-bound.'],
      ['What is continuous batching?', 'Refilling a finished slot mid-batch instead of waiting for the longest request. Two to four times the throughput.'],
      ['Why does context length cost so much?', 'KV cache grows with sequence length, so longer context means proportionally fewer concurrent users.'],
      ['How do you cut LLM cost fastest?', 'Cap output tokens, enable prefix caching, quantise, and route easy queries to a smaller model.'],
    ]),

    links(
      wiki('Large_language_model', 'Large language model'),
      wiki('Transformer_(deep_learning_architecture)', 'Transformer'),
    ),
  ],
};
