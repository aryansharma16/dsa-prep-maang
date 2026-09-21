import { asked, code, diagram, h, js, links, p, quick, sh, table, tip, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'A request touches six services and a queue. Something took two seconds. **Metrics say the system is slow and logs say six different things** — a trace is the only artefact that shows one request\'s path through all of it, with timings.',
    ),

    h('Traces and spans'),
    diagram(
      `
   one TRACE = one request. one SPAN = one operation in it.

   trace 7f3a9c                                      total 840ms
   ├─ gateway                     ▓                        12ms
   │  ├─ auth.verify              ▓                         8ms
   │  └─ orders.create            ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓      815ms
   │     ├─ db.insert             ▓                         14ms
   │     ├─ pricing.calculate     ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓        780ms  ◀──
   │     │  └─ tax-api (external) ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓         760ms  ◀──
   │     └─ queue.publish         ▓                          5ms
   └─ response                    ▓                          3ms

   the answer is visible in one glance: a third-party tax API.
   no amount of staring at metrics would have said that.

   each span carries: trace id, span id, parent span id,
                      start, duration, service, attributes
`,
      'The artefact itself',
    ),

    h('Context propagation'),
    p(
      'The whole mechanism is **passing the trace id along**. Break the chain anywhere and the trace splits into unrelated fragments — which is why the boring parts, queues and background jobs, are where tracing usually fails.',
    ),
    code(
      sh(`
# W3C Trace Context — the standard header, on every hop
traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
             │  │                                │                │
             │  trace id (16 bytes)              parent span id   flags
             version                                              (sampled?)
`),
    ),
    table(
      ['Hop', 'How context travels', 'Commonly broken by'],
      [
        ['HTTP', 'The `traceparent` header', 'A client that does not forward headers'],
        ['gRPC', 'Metadata', 'Rarely — instrumentation is good'],
        ['**Message queue**', '**In the message itself**', '**Forgetting to put it there** — the usual break'],
        ['Background job', 'Stored with the job record', 'Jobs enqueued without context'],
        ['Thread or async boundary', 'Context-local storage', 'A library that loses it across an await'],
      ],
    ),
    warn(
      'A queue is where traces almost always break: the producing request ends, the consumer starts a **new** trace, and the causal link is lost. The trace id must be written **into the message body or headers**, and read back on the other side — nothing does this for you.',
    ),
    code(
      js(`
// Producer: carry the context in the message, not just in the process.
await queue.publish('order.created', {
  orderId,
  _trace: { traceparent: propagation.inject() },
});

// Consumer: continue the SAME trace, do not start a new one. The
// consumer span is a CHILD of the producing span, so the trace
// shows the queue wait as a real gap rather than as two traces.
const ctx = propagation.extract(msg._trace);
await tracer.startActiveSpan('order.created.handle', { ctx }, async (span) => {
  await handle(msg);
  span.end();
});
`),
    ),

    h('What to put on a span'),
    table(
      ['Attribute', 'Why'],
      [
        ['Service, operation, version', 'Which code did this'],
        ['Status and error class', 'Filtering to failed traces'],
        ['Entity ids — order, user', '**High cardinality is fine here**, unlike metrics'],
        ['DB statement (parameterised)', 'Which query was slow'],
        ['Queue name, partition, lag', 'Where async time went'],
        ['Retry count', 'Distinguishing slow from retried'],
      ],
    ),
    tip(
      'Traces are the **right home for high-cardinality data**. Order ids and user ids ruin metrics and are exactly what makes a trace useful — "show me the traces for this customer\'s failed checkout" is a question only traces can answer.',
    ),

    h('Sampling'),
    table(
      ['Strategy', 'Decides', 'Keeps', 'Cost'],
      [
        ['**Head-based**', 'At the first span', 'A random N%', 'Lowest'],
        ['**Tail-based**', 'After the trace completes', '**Errors and slow traces**', 'Buffering, and a collector tier'],
        ['**Rules**', 'Per route or customer', 'What you said matters', 'Configuration drift'],
        ['**Always-on**', 'Nothing', 'Everything', 'Impractical past small scale'],
      ],
    ),
    warn(
      'A trace must be sampled **consistently across services** — if the gateway keeps it and the pricing service independently drops it, you get a trace with a hole in the middle. That is what the `sampled` flag in `traceparent` is for: the decision is made once and propagated.',
    ),

    h('What traces answer that nothing else does'),
    table(
      ['Question', 'Metrics', 'Logs', 'Traces'],
      [
        ['Is the system slow?', '**Yes**', 'No', 'No'],
        ['Which service is slow?', 'Maybe', 'No', '**Yes**'],
        ['Where did *this* request\'s time go?', 'No', 'No', '**Yes**'],
        ['Is the slowness in a dependency?', 'No', 'No', '**Yes**'],
        ['What exactly failed?', 'No', '**Yes**', 'Partly'],
        ['What is the critical path?', 'No', 'No', '**Yes**'],
      ],
    ),
    tip(
      'The **critical path** row is the underrated one. A trace shows which spans are sequential and which are parallel, so it tells you not just what was slow but **what to fix first** — parallelising two 300ms calls saves 300ms; optimising one of them saves nothing.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'One request\'s path across services, as a tree of timed spans'],
      ['Why it exists', 'Metrics and logs cannot follow a single request across a boundary'],
      ['Use when', 'More than two services, or any "it is slow somewhere" problem'],
      ['Trade-off', 'Enormous debugging value, for instrumentation and storage'],
      [
        '30-second answer',
        '"A trace is one request; a span is one operation carrying a trace id, span id and parent. Context propagates in the traceparent header, and the place it breaks is queues — the id must go into the message and be read back, or the consumer starts a fresh trace and the causal link is gone. Sample tail-based so you keep errors and slow traces, deciding once and propagating it. Traces are where high-cardinality ids belong, and they show the critical path."',
      ],
    ]),
    asked([
      ['How does trace context survive a queue?', 'The trace id is written into the message and extracted by the consumer, which continues the same trace.'],
      ['What sampling rate should you use?', 'Tail-based, keeping all errors and slow traces plus a small share of successes.'],
      ['Why must sampling be consistent?', 'If one service drops what another kept, the trace has a hole in the middle.'],
      ['What can traces do that logs cannot?', 'Show where time went across services, and which spans are on the critical path.'],
      ['Can you put user ids on spans?', 'Yes — traces are the right home for high-cardinality data, unlike metrics.'],
    ]),

    links(
      wiki('Tracing_(software)', 'Distributed tracing'),
      wiki('OpenTelemetry', 'OpenTelemetry'),
    ),
  ],
};
