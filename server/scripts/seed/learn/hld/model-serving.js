import { asked, diagram, flow, h, links, p, quick, table, tip, tradeoff, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'A model server turns weights into an API. Everything hard about it comes from one fact: **the hardware is expensive and only efficient when kept busy**, so the design is a continuous negotiation between latency and utilisation.',
    ),

    flow(['Request', 'Queue', 'Batch', 'GPU forward pass', 'Response'], 'The inner loop'),

    h('Batching'),
    diagram(
      `
   a GPU is a parallel machine. one request at a time wastes it.

   NO BATCHING                       BATCH OF 32

   req ──▶ [GPU] ──▶ 20 ms           32 reqs ──▶ [GPU] ──▶ 35 ms
   50 req/s                          ~900 req/s

   ✗ 3% utilisation                  ✓ near-full utilisation
   ✓ 20 ms latency                   ✗ 35 ms + wait for the batch

   DYNAMIC BATCHING — the usual compromise

   collect requests for up to N ms, or until the batch is full,
   whichever first.

   max_batch = 32, max_wait = 10 ms
     ▸ busy   ──▶ batch fills instantly, no added latency
     ▸ quiet  ──▶ waits 10 ms, then runs a small batch

   the knob that matters: max_wait. it is a direct trade of
   p99 latency for throughput per dollar.
`,
      'Why batching is not optional',
    ),
    tradeoff([
      ['**Larger batches**', 'Far higher throughput per GPU, so far lower cost per request', 'Added queueing latency, and more memory per batch'],
    ]),

    h('Cold starts'),
    table(
      ['Phase', 'Duration', 'Why'],
      [
        ['Provision a GPU instance', '**1–5 minutes**', 'They are scarce; sometimes unavailable'],
        ['Pull the container image', '1–5 minutes', 'Multi-gigabyte images with CUDA'],
        ['Load weights into GPU memory', '**30s–5 minutes**', 'Tens of gigabytes from storage'],
        ['Warm up', '10–60 seconds', 'Kernel compilation, cache allocation'],
        ['**Total**', '**3–15 minutes**', ''],
      ],
    ),
    warn(
      'This is why **GPU services cannot autoscale reactively.** By the time capacity arrives the spike is over and you have paid for both the outage and the instances. Queue the excess, keep warm headroom, and pre-scale for anything predictable.',
    ),
    table(
      ['Mitigation', 'How'],
      [
        ['**Keep a warm pool**', 'Minimum replicas that never scale to zero'],
        ['**Pre-scale on a schedule**', 'For known daily or event-driven peaks'],
        ['**Queue and degrade**', 'Accept the request, answer late, or answer smaller'],
        ['**Cache weights locally**', 'Load from local NVMe rather than object storage'],
        ['**Scale on queue depth**', 'It leads the latency signal by a useful margin'],
      ],
    ),

    h('Versioning and rollout'),
    flow(['Register', 'Shadow', 'Canary 1%', 'Compare metrics', 'Promote'], 'Never a straight swap'),
    table(
      ['Stage', 'What it catches'],
      [
        ['**Offline eval**', 'An obvious regression, before any traffic'],
        ['**Shadow**', 'Serve v1, also run v2, compare outputs. No user impact'],
        ['**Canary 1%**', 'Real-traffic quality and latency'],
        ['**Gradual promotion**', 'Regressions visible only at volume'],
        ['**Instant rollback**', 'Keep the previous version loaded and routable'],
      ],
    ),
    tip(
      'Shadow deployment is far more valuable here than in ordinary services. **You can compare two models\' outputs on identical real traffic** without a single user seeing the new one — which is the only honest way to know whether an offline eval score translates.',
    ),

    h('Packing more onto one GPU'),
    table(
      ['Technique', 'Effect', 'Cost'],
      [
        ['**Quantisation** (fp16 → int8/int4)', '**2–4x less memory**, faster', 'Small accuracy loss'],
        ['**Distillation**', 'A much smaller model approximating a larger one', 'Training effort; a quality gap'],
        ['**Multi-model hosting**', 'Several small models on one GPU', 'Contention between them'],
        ['**LoRA adapters**', 'One base model, many fine-tunes swapped in', 'Limited to what an adapter can express'],
        ['**Compilation** (TensorRT, ONNX)', '2–5x throughput', 'Build complexity, per-hardware'],
      ],
    ),
    p(
      'LoRA adapters are the neat one for multi-tenant products: **one base model in GPU memory, a small per-customer adapter loaded per request.** You get per-tenant behaviour without a GPU per tenant, which is otherwise the cost that makes such a product impossible.',
    ),

    h('What to monitor'),
    table(
      ['Metric', 'Watch for'],
      [
        ['**GPU utilisation**', 'Low means you are wasting the expensive thing'],
        ['**Batch size achieved**', 'Consistently small means `max_wait` is too low'],
        ['**Queue depth and wait**', 'The leading indicator for scaling'],
        ['**GPU memory**', 'OOM is the common crash; batch size is usually the cause'],
        ['**p50 vs p99 latency**', 'A wide gap means batch waits are hurting the tail'],
        ['**Cost per thousand requests**', 'The number that decides architecture'],
      ],
    ),
    tip(
      'GPU utilisation is **the** number. A fleet at 30% is paying three times what it needs to, and the fix is almost always batching configuration rather than more hardware — which makes it the cheapest large saving available in an inference system.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'Serving model inference as an API, efficiently'],
      ['The hard part', 'Keeping scarce, expensive hardware busy without hurting latency'],
      ['Use when', 'Any model on a request path'],
      ['Trade-off', 'Batching buys throughput per dollar and costs tail latency'],
      [
        '30-second answer',
        '"An inference server batches requests because a GPU idle on one request is wasting the expensive thing — dynamic batching collects for up to a few milliseconds or until the batch is full, which directly trades p99 latency for cost per request. Cold starts are minutes, so it cannot autoscale reactively: keep a warm pool, pre-scale for known peaks, and scale on queue depth. Roll out with shadow then canary, and watch GPU utilisation — 30% means you are paying three times over."',
      ],
    ]),
    asked([
      ['Why batch inference requests?', 'A GPU is parallel hardware; one request at a time leaves most of it idle. Batching multiplies throughput.'],
      ['How do you autoscale a 5-minute cold start?', 'You do not, reactively. Warm pool, scheduled pre-scaling, queue the excess, and scale on queue depth.'],
      ['How do you roll out a new model?', 'Offline eval, then shadow on real traffic, then a canary, comparing quality and latency before promoting.'],
      ['How do you fit more on one GPU?', 'Quantisation, compilation, a distilled model, and LoRA adapters over one shared base.'],
      ['What is the key metric?', 'GPU utilisation. Low utilisation is wasted money, and the fix is usually batching, not more GPUs.'],
    ]),

    links(wiki('Quantization_(signal_processing)', 'Quantisation'), wiki('Inference_engine', 'Inference')),
  ],
};
