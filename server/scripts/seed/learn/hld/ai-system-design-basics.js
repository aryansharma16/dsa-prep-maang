import { asked, diagram, flow, h, links, p, quick, table, tip, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Everything in this track still applies — caching, queues, sharding, circuit breakers. What changes is the **cost and latency profile of one call**: an inference request can cost a thousand times a database query, take seconds, and return something different each time.',
    ),

    h('What is different'),
    table(
      ['Dimension', 'Classic backend', 'AI system'],
      [
        ['Cost per request', 'Fractions of a cent', '**Cents to dollars** — 100–1000x'],
        ['Latency', '10–100ms', '**Seconds**, and not tightly bounded'],
        ['Determinism', 'Same input, same output', '**Not guaranteed**'],
        ['Scaling unit', 'CPU — abundant, elastic', '**GPU** — scarce, slow to acquire'],
        ['Cold start', 'Seconds', '**Minutes** — model weights must load'],
        ['Correctness', 'Tests pass or fail', '**Evaluations with scores**'],
        ['Capacity', 'Add instances', 'Add instances **if any exist**'],
        ['Failure', 'An error', '**A confident wrong answer**'],
      ],
    ),
    warn(
      'That last row is the one with no equivalent elsewhere. A database returning the wrong row is a bug that raises an error somewhere; **a model returning a plausible wrong answer raises nothing**, and no amount of monitoring the infrastructure detects it.',
    ),

    h('The shape of an inference system'),
    flow(['Client', 'Gateway', 'Cache', 'Queue', 'Inference', 'Post-process'], 'Familiar, with a new middle'),
    diagram(
      `
   request ──▶ ┌────────────┐
               │ rate limit │  per tenant, by TOKEN not by request
               └─────┬──────┘  (requests vary 1000x in cost)
                     ▼
               ┌────────────┐
               │   cache    │  exact ──▶ prompt prefix ──▶ semantic
               └─────┬──────┘  a hit is ~100% of the cost saved
                     │ miss
                     ▼
               ┌────────────┐
               │   queue    │  GPUs cannot autoscale into a spike.
               └─────┬──────┘  the queue is what absorbs it.
                     ▼
               ┌────────────┐
               │ inference  │  batched. utilisation is the
               │  workers   │  whole economic game.
               └─────┬──────┘
                     ▼
               ┌────────────┐
               │ guardrails │  validate, filter, fall back
               └────────────┘
`,
      'Cache, queue, batch, guard',
    ),
    tip(
      'Rate limit by **tokens, not requests.** One request can be a hundred tokens or a hundred thousand, and a per-request limit lets one caller consume a thousand times another\'s share while appearing equal on every dashboard.',
    ),

    h('Unbounded latency'),
    table(
      ['Technique', 'What it gives'],
      [
        ['**Stream tokens**', 'Time-to-first-token becomes the perceived latency'],
        ['**Async + status**', 'Accept, return an id, deliver via push or polling'],
        ['**A smaller model first**', 'Answer the easy majority fast; escalate the rest'],
        ['**Hard deadline with a fallback**', 'Return a cached or simpler answer rather than waiting'],
        ['**Cap output length**', 'Output tokens are the dominant latency term'],
      ],
    ),
    p(
      '**Time to first token and tokens per second are separate metrics** and users feel them differently. A response that starts in 300ms and streams slowly feels fast; one that arrives complete after four seconds does not, even if it finished first.',
    ),

    h('Cost as a design constraint'),
    diagram(
      `
   1M requests/day

   classic API     1M × $0.000002  =      $2/day
   LLM call        1M × $0.01      = $10,000/day   ◀── 5000x

   so the levers are, in order of impact:

   1. DO NOT CALL IT      cache, rules, a classifier first
   2. CALL A SMALLER ONE  route by difficulty
   3. SEND LESS           shorter prompts, less retrieved context
   4. GENERATE LESS       cap output; it is the expensive half
   5. BATCH               higher GPU utilisation per dollar
`,
      'Why cost engineering is architecture here',
    ),
    warn(
      'Cost per request is a **first-class design constraint**, not an optimisation to do later. A feature that is delightful at ten thousand users can be unshippable at a million, and that is an architecture problem discovered far too late.',
    ),

    h('Evaluation instead of tests'),
    table(
      ['Classic', 'AI'],
      [
        ['Unit tests pass or fail', 'An eval set with a score'],
        ['A regression is obvious', 'A regression is a few points on a metric'],
        ['Deploy when green', 'Deploy when the score does not drop'],
        ['Staging catches it', '**Production distribution differs** from your eval set'],
        ['Monitor errors', 'Monitor **quality** — thumbs, edits, escalations, refusals'],
      ],
    ),
    tip(
      'Ship a **feedback signal from day one** — thumbs, a correction, whether a user edited the output, whether they escalated to a human. It is the only measurement that reflects the real distribution, and retrofitting it means months with no idea whether quality is improving.',
    ),

    h('Guardrails'),
    table(
      ['Guardrail', 'Catches'],
      [
        ['Output schema validation', 'Malformed structured output — retry or repair'],
        ['Content filtering', 'Unsafe generations'],
        ['Grounding checks', 'Claims not supported by the retrieved context'],
        ['Token and cost caps', 'A runaway loop or a prompt-injection attempt'],
        ['Timeouts', 'A generation that will not stop'],
        ['**A deterministic fallback**', 'Everything — a rules-based answer beats no answer'],
      ],
    ),

    h('Interview'),
    quick([
      ['What it is', 'System design where one call is slow, expensive and non-deterministic'],
      ['Why it matters', 'Design rounds now include AI infrastructure as a matter of course'],
      ['Use when', 'Any product with a model on the request path'],
      ['Trade-off', 'Quality against cost and latency, on nearly every decision'],
      [
        '30-second answer',
        '"The same patterns, different cost profile: one inference is a hundred to a thousand times a database query, takes seconds, and can be confidently wrong. So cache at several levels, rate limit by tokens rather than requests, queue in front of GPUs because they cannot autoscale into a spike, and batch for utilisation. Stream tokens so time-to-first-token is the perceived latency, add guardrails and a deterministic fallback, and measure quality with a feedback signal."',
      ],
    ]),
    asked([
      ['How is designing an AI system different?', 'Cost per call is orders of magnitude higher, latency is seconds and unbounded, and a failure can be a confident wrong answer.'],
      ['How do you handle unbounded latency?', 'Stream tokens, cap output length, set a deadline with a fallback, or go async with a status endpoint.'],
      ['How do you control cost?', 'Do not call the model — cache or use rules. Then a smaller model, shorter prompts, less output, and batching.'],
      ['Why rate limit by tokens?', 'Requests vary a thousandfold in cost, so a per-request limit is not a limit on consumption.'],
      ['How do you know quality regressed?', 'An eval set plus a production feedback signal. Infrastructure monitoring cannot see a wrong answer.'],
    ]),

    links(wiki('Inference_engine', 'Inference'), wiki('MLOps', 'MLOps')),
  ],
};
