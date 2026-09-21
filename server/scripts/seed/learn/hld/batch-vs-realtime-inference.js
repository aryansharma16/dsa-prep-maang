import { asked, diagram, h, links, p, quick, table, tip, tradeoff, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Compute the prediction **before** it is asked for, or **when** it is asked for. Batch is an order of magnitude cheaper and always slightly stale; real-time is fresh and expensive — and most production systems run both.',
    ),

    h('The two'),
    diagram(
      `
   BATCH                             REAL-TIME

   nightly job                       request arrives
        │                                 │
        ▼                                 ▼
   score every user × item           gather features
        │                                 │
        ▼                                 ▼
   write to a key-value store        model inference
        │                                 │
        ▼                                 ▼
   request ──▶ LOOKUP ──▶ 5 ms       response ──▶ 50-500 ms

   ✓ 10-100x cheaper per prediction  ✓ always current
   ✓ trivially scalable reads        ✓ handles UNSEEN inputs
   ✓ GPU utilisation ~100%           ✓ uses request context
   ✗ stale by up to the interval     ✗ expensive, and must be
   ✗ only for enumerable inputs        capacity-planned
   ✗ cost scales with the whole      ✗ latency on the hot path
     cross product
`,
      'Precompute, or compute on demand',
    ),
    tradeoff([
      ['**Batch**', 'An order of magnitude cheaper, perfect hardware utilisation, and reads are a key-value lookup', 'Predictions are stale, and only work for inputs you can enumerate in advance'],
      ['**Real-time**', 'Fresh, context-aware, and works for anything', 'Cost per request, latency on the critical path, and GPU capacity to plan'],
    ]),

    h('Which one a problem needs'),
    table(
      ['Use batch when', 'Use real-time when'],
      [
        ['Inputs are enumerable — users, products', 'Input is arbitrary — free text, an uploaded image'],
        ['A few hours of staleness is fine', 'The answer depends on **this** session'],
        ['The same prediction is reused', 'Every request is unique'],
        ['Cost matters more than freshness', 'Freshness is the product'],
        ['**Weekly playlists, daily digests, churn scores**', '**Fraud checks, search ranking, chat**'],
      ],
    ),
    warn(
      'The batch constraint people miss is the **cross product**. Scoring every user against every item is `users × items` predictions — ten million users and a hundred thousand items is a trillion, which is not a nightly job. Batch only works where candidates are pre-narrowed.',
    ),

    h('The hybrid, which is what actually ships'),
    diagram(
      `
   OFFLINE (nightly / hourly)        ONLINE (per request)

   ┌──────────────────┐              request
   │ heavy embeddings │                  │
   │ candidate sets   │                  ▼
   │ user/item feats  │        ┌────────────────────┐
   └────────┬─────────┘        │ fetch precomputed  │  5 ms
            │                  │ candidates + feats │
            ▼                  └─────────┬──────────┘
   ┌──────────────────┐                  ▼
   │ feature store /  │◀────────┌────────────────────┐
   │ candidate store  │         │ light re-rank with │  20 ms
   └──────────────────┘         │ live context       │
                                └─────────┬──────────┘
   expensive work, amortised              ▼
   cheap work, per request           response, 25 ms

   ──▶ 95% of the compute is batch, and the answer is fresh
       where freshness actually matters.
`,
      'Heavy offline, light online',
    ),
    tip(
      'This split is the answer to almost every recommendation and ranking question in an interview. **Narrow to a few hundred candidates offline, then apply live context online** — you get batch economics with real-time relevance.',
    ),

    h('Near-real-time'),
    table(
      ['Approach', 'Freshness', 'Cost', 'Use for'],
      [
        ['Nightly batch', 'Up to 24h', 'Lowest', 'Weekly playlists, churn scores'],
        ['Hourly batch', '1h', 'Low', 'Trending content'],
        ['**Streaming (micro-batch)**', '**Seconds to minutes**', 'Medium', 'Session-aware feeds, live counters'],
        ['Real-time', 'Instant', 'Highest', 'Fraud, chat, search'],
      ],
    ),
    p(
      'Streaming is the underused middle. **A consumer updating features as events arrive** gives session-aware behaviour at a fraction of per-request inference cost — and for most personalisation, seconds-fresh is indistinguishable from instant.',
    ),

    h('Operating a batch pipeline'),
    table(
      ['Concern', 'Handling'],
      [
        ['**The job fails**', 'Serve yesterday\'s output. Never serve nothing'],
        ['**It runs long**', 'Alert on duration, not just failure — creeping runtime is the real signal'],
        ['**Output is bad**', 'Validate before swapping: row counts, score distributions'],
        ['**Atomic swap**', 'Write to a new location, then flip a pointer. Never update in place'],
        ['**Cold start**', 'A new user has no precomputed row — have a default ready'],
      ],
    ),
    warn(
      'The **cold-start row** is the bug that ships. A user who signed up an hour ago has no entry in a store written last night, and the code path that handles a missing row is the one nobody tested. Every batch-served feature needs a defined fallback.',
    ),

    h('Cost'),
    diagram(
      `
   10M users, one prediction each per day

   REAL-TIME  10M × $0.001         = $10,000/day
              plus GPUs sized for peak QPS

   BATCH      10M predictions, batched at high utilisation
              ~4 GPU-hours × $3    = ~$12/day
              plus a key-value store

   ──▶ roughly THREE ORDERS OF MAGNITUDE, for staleness
       nobody notices in a recommendation.
`,
      'Why batch wins wherever it can be used',
    ),

    h('Interview'),
    quick([
      ['What it is', 'Precomputing predictions versus computing them per request'],
      ['Why it matters', 'It is the single biggest cost decision in an ML system'],
      ['Use when', 'Batch wherever inputs are enumerable and staleness is tolerable'],
      ['Trade-off', 'Orders of magnitude of cost, against freshness'],
      [
        '30-second answer',
        '"Batch precomputes into a key-value store, so serving is a 5ms lookup and the cost is orders of magnitude lower — but it only works where inputs are enumerable and staleness is acceptable. Real-time handles arbitrary input and live context at real cost and latency. Production usually runs a hybrid: heavy candidate generation and embeddings offline, a light re-rank with session context online. And every batch-served feature needs a fallback for the user with no precomputed row."',
      ],
    ]),
    asked([
      ['Batch or real-time?', 'Batch when inputs are enumerable and staleness is fine — it is orders of magnitude cheaper. Real-time when input is arbitrary or context matters.'],
      ['What does the hybrid look like?', 'Offline candidate generation and features; online light re-ranking with live session context.'],
      ['Why does batch not always work?', 'The cross product. Scoring every user against every item is not a nightly job.'],
      ['What if the batch job fails?', 'Serve yesterday\'s output, and alert on runtime as well as failure.'],
      ['What about a brand new user?', 'No precomputed row. Have an explicit default — it is the path that ships broken.'],
    ]),

    links(wiki('Batch_processing', 'Batch processing'), wiki('Stream_processing', 'Stream processing')),
  ],
};
