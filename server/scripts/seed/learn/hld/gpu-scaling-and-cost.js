import { asked, diagram, flow, h, links, p, quick, table, tip, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'GPUs break the assumption every other part of this track rests on: **that capacity is available when you ask for it.** They are scarce, expensive, slow to start and cannot be fractionally allocated the way CPU can — so they are scheduled, not autoscaled.',
    ),

    h('Why they are different'),
    table(
      ['', 'CPU', 'GPU'],
      [
        ['Availability', 'Effectively unlimited', '**Often unavailable in a region**'],
        ['Cost', '~$0.05/hr', '**$1–40/hr** — 20–800x'],
        ['Start time', 'Seconds', '**Minutes**, plus weight loading'],
        ['Sharing', 'Naturally multiplexed', 'One process typically owns it'],
        ['Scale to zero', 'Fine', '**Minutes to come back**'],
        ['Utilisation at 30%', 'Mildly wasteful', '**Wasting most of the bill**'],
      ],
    ),
    warn(
      '"Capacity not available in this availability zone" is a real and common response for GPU instance types. **Autoscaling assumes the hardware exists** — with GPUs, a scale-up request can simply fail, so reserved capacity is a correctness concern as much as a cost one.',
    ),

    h('Utilisation is the game'),
    diagram(
      `
   one A100 at $3/hour, running 24/7 = ~$2,160/month

   at 100% utilisation   ──▶ full value
   at  50% utilisation   ──▶ $1,080/month wasted
   at  20% utilisation   ──▶ $1,728/month wasted

   a fleet of 50 at 30% utilisation is throwing away
   about $75,000 a month.

   WHERE IT GOES
     ▸ batch size too small        ──▶ tune dynamic batching
     ▸ waiting on data loading     ──▶ prefetch, more workers
     ▸ CPU preprocessing inline    ──▶ move it off the GPU host
     ▸ one model per GPU, idle     ──▶ multi-model hosting
     ▸ provisioned for peak        ──▶ queue + smaller warm pool
`,
      'The only number that matters',
    ),
    tip(
      'Before buying more GPUs, **measure utilisation on the ones you have.** Doubling throughput by tuning batch size is a day of work; doubling the fleet is a doubled bill forever, and it often does not help because the bottleneck was never the hardware.',
    ),

    h('Getting more out of one GPU'),
    table(
      ['Technique', 'Gains', 'Trade-off'],
      [
        ['**Dynamic batching**', '5–20x throughput', 'Queueing latency'],
        ['**Quantisation** int8/int4', '2–4x memory, faster', 'Slight quality loss'],
        ['**MIG** (partitioning)', 'Up to 7 isolated instances on one A100', 'Fixed partitions; each is small'],
        ['**Multi-model hosting**', 'Several small models share memory', 'Contention'],
        ['**LoRA adapters**', 'Many fine-tunes on one base', 'Limited expressiveness'],
        ['**Compilation** (TensorRT)', '2–5x', 'Build pipeline per hardware type'],
        ['**Move preprocessing off**', 'Frees the GPU host to do GPU work', 'An extra hop'],
      ],
    ),

    h('Buying strategies'),
    table(
      ['Type', 'Discount', 'Risk', 'Use for'],
      [
        ['**On-demand**', '—', 'None', 'Baseline serving'],
        ['**Reserved / committed**', '30–60%', 'A 1–3 year commitment', 'Predictable baseline'],
        ['**Spot / preemptible**', '**60–90%**', '**Reclaimed with ~30s notice**', '**Training, batch inference**'],
        ['**Serverless GPU**', 'Pay per second', 'Cold starts', 'Spiky, low-volume workloads'],
      ],
    ),
    p(
      'The standard pattern: **reserved for the baseline, on-demand for the peak, spot for anything interruptible.** Training and batch inference checkpoint and resume, so spot\'s risk costs almost nothing and saves most of the bill.',
    ),
    warn(
      'Spot instances are wrong for **interactive serving**. A thirty-second eviction notice mid-request is a dropped user, and re-loading weights on the replacement takes minutes — so the outage outlasts the saving.',
    ),

    h('Queue, do not autoscale'),
    flow(['Request', 'Queue', 'Warm GPU pool', 'Batch', 'Response'], 'The queue absorbs what GPUs cannot'),
    diagram(
      `
   TRADITIONAL                       GPU

   load rises                        load rises
       │                                 │
       ▼                                 ▼
   autoscale (30-60s)                QUEUE absorbs it
       │                                 │
       ▼                                 ▼
   capacity arrives                  warm pool drains it
   in time                           at full utilisation
                                         │
                                         ▼
                                    scale up on queue DEPTH,
                                    knowing it takes minutes

   ──▶ latency degrades gracefully instead of requests failing
   ──▶ and 100% utilisation is normal rather than alarming
`,
      'The queue is the elasticity',
    ),
    tip(
      'For GPU services, **100% utilisation with a short queue is the healthy state**, not a warning. On a CPU service that would mean saturation; here it means the expensive hardware is doing what you paid for, and the queue is absorbing the variance.',
    ),

    h('Routing to spend less'),
    table(
      ['Strategy', 'Saving'],
      [
        ['**Cache first**', '100% on a hit — always the first move'],
        ['**A classifier before the model**', 'Skip inference entirely for the easy cases'],
        ['**Small model, escalate on low confidence**', 'Most traffic on cheap hardware'],
        ['**CPU for small models**', 'Embeddings and classifiers often do not need a GPU'],
        ['**Batch what can wait**', 'Move it off the real-time path entirely'],
      ],
    ),
    p(
      'Cascading — **a small model handling the easy majority and escalating the rest** — routinely cuts cost by most of the bill, because request difficulty follows a power law and the expensive model only sees the tail.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'Scaling and paying for scarce, expensive accelerators'],
      ['Why it is different', 'Capacity is not guaranteed and cold starts are minutes'],
      ['Use when', 'Any GPU-backed inference or training'],
      ['Trade-off', 'Queueing latency, in exchange for utilisation and predictable cost'],
      [
        '30-second answer',
        '"GPUs cannot be autoscaled reactively — they are scarce, cost twenty to eight hundred times a CPU, and take minutes to be useful. So you keep a warm pool and put a queue in front: the queue is the elasticity, and 100% utilisation with a short queue is healthy rather than alarming. Utilisation is the whole economic game — a fleet at 30% is wasting most of its bill, and the fix is usually batching. Reserved for baseline, spot for training, and cascade easy requests to a smaller model."',
      ],
    ]),
    asked([
      ['Why can you not autoscale GPUs like web servers?', 'They are minutes to start, often unavailable on request, and far too expensive to keep idle.'],
      ['How do you keep utilisation high?', 'Dynamic batching first, then multi-model hosting, quantisation, and moving preprocessing off the GPU host.'],
      ['When are spot instances appropriate?', 'Training and batch inference, which checkpoint and resume. Never interactive serving.'],
      ['How do you handle a traffic spike?', 'A queue in front of a warm pool. Latency degrades gracefully instead of requests failing.'],
      ['What is the biggest cost saving?', 'Not calling the model — cache and cascade. Then batching, then quantisation.'],
    ]),

    links(
      wiki('Graphics_processing_unit', 'GPU'),
      wiki('Spot_instance', 'Spot instances'),
    ),
  ],
};
