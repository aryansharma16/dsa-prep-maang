import { asked, diagram, flow, h, links, p, quick, table, tip, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Monitoring answers **questions you thought of in advance**. Observability is being able to answer ones you did not — which matters because the outage you are having is, by definition, the one nobody predicted.',
    ),

    h('The three pillars'),
    diagram(
      `
   METRICS              LOGS                 TRACES
   numbers over time    discrete events      one request's path

   "error rate is 3%"   "order 991 failed:   "this request spent
                         card declined"       840ms in pricing"

   ┌──────────┐         2026-03-04T10:15     ┌─────────────────┐
   │ ▁▂▃█▅▂▁  │         level=error          │gateway ▓        │
   └──────────┘         order=991            │ auth   ▓        │
                        user=42              │ pricing ▓▓▓▓▓▓▓ │
   cheap, aggregated    reason=declined      │ db      ▓       │
   answers WHAT                              └─────────────────┘
                        expensive at scale
   ✗ cannot tell you    answers WHY          answers WHERE
     which request                           ✗ sampled, so not
                        ✗ hard to aggregate    every request
`,
      'Three questions, three tools',
    ),
    table(
      ['', 'Metrics', 'Logs', 'Traces'],
      [
        ['Answers', '**What** is wrong, and how much', '**Why** this one failed', '**Where** the time went'],
        ['Shape', 'Numbers over time', 'Structured events', 'Spans in a tree'],
        ['Cost at scale', 'Low — aggregated', '**High** — every event', 'Medium — sampled'],
        ['Cardinality', '**Must stay low**', 'Unlimited', 'Unlimited'],
        ['Alert on it', '**Yes**', 'Sometimes', 'Rarely'],
        ['Retention', 'Months', 'Days to weeks', 'Days'],
      ],
    ),
    tip(
      'The workflow they form is the point: **a metric alerts you, a trace localises it, and a log explains it.** Any system missing one of the three leaves a gap in that chain — usually the middle one, which is why "it is slow somewhere" incidents take hours.',
    ),

    h('What to instrument first'),
    flow(['RED per service', 'USE per resource', 'Business metrics'], 'In this order'),
    table(
      ['Method', 'For', 'Measure'],
      [
        ['**RED**', 'Every request-serving service', '**R**ate, **E**rrors, **D**uration'],
        ['**USE**', 'Every resource', '**U**tilisation, **S**aturation, **E**rrors'],
        ['**Business**', 'The product', 'Orders placed, payments succeeded, signups'],
      ],
    ),
    p(
      'Business metrics catch what technical ones miss. **Every service can be green while orders have stopped** — a bad deploy that returns 200 with an empty list breaks nothing technically, and the only signal is that the order rate went to zero.',
    ),

    h('Structured logs'),
    table(
      ['Instead of', 'Log'],
      [
        ['`console.log("order failed")`', '`{ level, event: "order.failed", orderId, userId, reason, traceId }`'],
        ['A human sentence', 'Fields that can be filtered and aggregated'],
        ['Logging everything', 'Logging decisions and failures'],
      ],
    ),
    warn(
      'The single most valuable field is **`traceId` on every log line.** Without it, correlating logs across five services during an incident means matching timestamps by eye — and timestamps are the one thing distributed systems disagree about.',
    ),

    h('The cardinality trap'),
    diagram(
      `
   metrics are cheap ONLY because they are aggregated

   http_requests{service="api", status="500"}        ✓ ~10 series
   http_requests{service="api", endpoint="/orders"}  ✓ ~100 series

   http_requests{service="api", user_id="42"}        ✗ 10,000,000
                                                       SERIES

   each unique label combination is a separate time series,
   stored forever.

   ──▶ high-cardinality dimensions (user id, request id,
       trace id, raw URL with ids in it) belong in LOGS
       and TRACES, never in metric labels.

   this is the most common way a monitoring bill explodes
   and a Prometheus falls over.
`,
      'Why user ids do not go in metric labels',
    ),

    h('Sampling'),
    table(
      ['Strategy', 'How', 'Trade-off'],
      [
        ['**Head-based**', 'Decide at the start, e.g. 1%', 'Cheap; misses most errors'],
        ['**Tail-based**', 'Decide after, keeping errors and slow requests', '**Far better data**; needs buffering'],
        ['**Always-on for errors**', '100% of failures, 1% of successes', 'The pragmatic default'],
        ['Adaptive', 'Rate varies with traffic', 'Complex; good at very large scale'],
      ],
    ),
    tip(
      'Tail-based sampling is worth the complexity because **the requests you want are exactly the rare ones** — the errors and the p99. Random 1% head sampling keeps a representative set of the requests that were fine.',
    ),

    h('What good looks like'),
    table(
      ['Question', 'Should take'],
      [
        ['"Is anything wrong?"', 'One dashboard, ten seconds'],
        ['"Which service?"', 'A drill-down, a minute'],
        ['"Which requests?"', 'A trace search, a minute'],
        ['"Why did this one fail?"', 'Logs filtered by trace id, a minute'],
        ['"Has it happened before?"', 'A query over retained data'],
        ['"Did the deploy cause it?"', 'A deploy marker on the graph'],
      ],
    ),
    warn(
      'Deploy markers on dashboards are one of the cheapest wins available. **Most incidents correlate with a release**, and a vertical line on the error graph answers in one glance what otherwise takes a scramble through a chat channel.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'Being able to explain a system\'s behaviour from its outputs'],
      ['Why it matters', 'Every design round ends with "how would you know this broke?"'],
      ['Use when', 'Wrapping up any design — one sentence is enough'],
      ['Trade-off', 'More telemetry costs storage and money; cardinality costs the most'],
      [
        '30-second answer',
        '"Three pillars with three jobs: metrics tell you what is wrong and are what you alert on, traces tell you where the time went, logs tell you why this one failed. A metric alerts, a trace localises, a log explains. Instrument RED per service, USE per resource, plus business metrics — because every service can be green while orders have stopped. Keep high-cardinality fields like user id out of metric labels, and put a trace id on every log line."',
      ],
    ]),
    asked([
      ['Monitoring versus observability?', 'Monitoring answers predefined questions. Observability lets you answer ones you did not anticipate.'],
      ['What should you instrument first?', 'Rate, errors and duration per service, then resource saturation, then business metrics.'],
      ['Why is cardinality a problem?', 'Each label combination is a separate stored time series. A user id label means millions of them.'],
      ['What ties the three pillars together?', 'A trace id propagated through every service and included on every log line.'],
      ['Head or tail sampling?', 'Tail — it keeps errors and slow requests, which are exactly the ones you want.'],
    ]),

    links(wiki('Observability_(software)', 'Observability'), wiki('OpenTelemetry', 'OpenTelemetry')),
  ],
};
