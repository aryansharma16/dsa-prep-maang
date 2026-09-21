import { asked, code, diagram, flow, h, js, links, p, quick, table, tip, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Logs are **discrete events you read**; metrics are **numbers you aggregate and alert on**. They fail in opposite ways at scale — logs get expensive, metrics get useless — and the mistakes are avoidable.',
    ),

    h('Logging levels, used properly'),
    table(
      ['Level', 'Means', 'In production'],
      [
        ['`ERROR`', 'Something failed that should not', '**Someone should look.** If nobody does, it is a warning'],
        ['`WARN`', 'Unexpected, handled, worth noticing', 'Retries, fallbacks, deprecated usage'],
        ['`INFO`', 'A significant business event', 'Order placed, user registered'],
        ['`DEBUG`', 'Developer detail', 'Off by default; on for one service when investigating'],
        ['`TRACE`', 'Everything', 'Never on in production'],
      ],
    ),
    warn(
      'An `ERROR` nobody acts on trains everyone to ignore errors. **If a log line fires routinely and requires no action, it is not an error** — and the day a real one appears, it scrolls past with the rest.',
    ),

    h('Structured, always'),
    code(
      js(`
// Unqueryable. You can grep it and nothing more.
logger.error(\`Payment failed for order \${orderId}: \${err.message}\`);

// Queryable, aggregatable, and joinable with traces.
logger.error({
  event: 'payment.failed',
  orderId,
  userId: user.id,
  amount,
  provider: 'razorpay',
  reason: err.code,          // a FIELD, so you can group by it
  traceId: ctx.traceId,      // the single most valuable field
  durationMs: Date.now() - start,
}, 'payment failed');
`),
    ),
    table(
      ['Field', 'Why it earns its place'],
      [
        ['`traceId`', 'The only way to follow one request across services'],
        ['`event`', 'A stable name to filter and count on'],
        ['`userId` / entity id', 'Answering "what happened to this customer?"'],
        ['`durationMs`', 'Turns a log into a latency dataset'],
        ['`reason` as a code', 'Groupable — free text is not'],
        ['Service, version, region', 'Localising to one deploy or one zone'],
      ],
    ),

    h('What logs cost'),
    diagram(
      `
   1,000 req/s × 5 log lines × 500 bytes  =  2.5 MB/s
                                          =  ~216 GB/day
                                          =  ~6.5 TB/month

   at a typical managed rate, that is thousands of dollars
   a month to store lines nobody reads.

   REDUCE
     ▸ sample INFO on high-volume paths, keep 100% of errors
     ▸ shorter retention — hot 7d, cold 90d, then delete
     ▸ do not log request and response bodies by default
     ▸ move per-request detail into TRACES instead
`,
      'The arithmetic, once',
    ),
    warn(
      'Never log **secrets, tokens, card numbers or personal data.** Logs are widely readable, retained for months, and shipped to third parties — and a token in a log is a credential leak with an audit trail attached.',
    ),

    h('The four metric types'),
    table(
      ['Type', 'Is', 'Example', 'Query'],
      [
        ['**Counter**', 'Only goes up', '`requests_total`', '`rate()` over a window'],
        ['**Gauge**', 'Goes up and down', '`queue_depth`, `memory_bytes`', 'Current value'],
        ['**Histogram**', 'Bucketed distribution', '`request_duration`', '**Percentiles**'],
        ['**Summary**', 'Client-computed quantiles', '`request_duration`', 'Cannot be aggregated across instances'],
      ],
    ),
    tip(
      'Use a **histogram**, not a summary, for latency. Summaries compute percentiles per instance, and **percentiles cannot be averaged** — the p99 of ten servers is not the average of their p99s. Histograms aggregate buckets, which does work.',
    ),

    h('RED and USE'),
    flow(['RED for services', 'USE for resources'], 'Two checklists'),
    table(
      ['RED — per service', 'USE — per resource'],
      [
        ['**Rate** — requests per second', '**Utilisation** — % of time busy'],
        ['**Errors** — failures per second', '**Saturation** — queued work waiting'],
        ['**Duration** — latency distribution', '**Errors** — failed operations'],
      ],
    ),
    p(
      '**Saturation is the one people omit and the one that predicts trouble.** Utilisation at 100% may be fine; a growing queue behind it is not, and it is the earliest available warning that capacity is about to run out.',
    ),

    h('Cardinality, again'),
    diagram(
      `
   total series = product of every label's distinct values

   http_requests{service, endpoint, status, method}
                   10   ×   50   ×  10  ×  5      = 25,000  ✓

   ...add user_id (10M)                    = 250 BILLION  ✗
   ...add trace_id (unbounded)             = unbounded    ✗
   ...add a raw URL with ids in it         = unbounded    ✗

   NORMALISE the label instead:
     /orders/991/items  ──▶  endpoint="/orders/:id/items"
`,
      'Labels multiply',
    ),
    table(
      ['Safe as a label', 'Never a label'],
      [
        ['service, endpoint pattern, method', 'User id, order id, session id'],
        ['status code, error class', 'Trace id, request id'],
        ['region, availability zone', 'Raw URL, raw query string'],
        ['version, deploy id (bounded)', 'Email, IP address'],
      ],
    ),

    h('Pull versus push'),
    table(
      ['', 'Pull (Prometheus)', 'Push (StatsD, OTLP)'],
      [
        ['Who initiates', 'The collector scrapes', 'The app sends'],
        ['Discovery', 'The collector needs to find targets', 'The app needs an endpoint'],
        ['Short-lived jobs', '**Hard** — a job may end between scrapes', '**Natural**'],
        ['Target health', 'Free — a failed scrape is a signal', 'Silence is ambiguous'],
        ['Firewalls', 'The collector must reach every target', 'One outbound direction'],
      ],
    ),
    tip(
      'Pull gives you **liveness for free**: a target that cannot be scraped is visibly down, whereas a push-based service that stops sending is indistinguishable from one with no traffic. Use a push gateway for batch jobs, which is the case pull genuinely cannot cover.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'Events you read, and numbers you aggregate'],
      ['Why it matters', 'They are what alerts fire on and what incidents are debugged from'],
      ['Use when', 'Every service, from the first one'],
      ['Trade-off', 'More detail costs storage; more labels cost far more than you expect'],
      [
        '30-second answer',
        '"Logs are structured JSON events with a trace id on every line, sampled on high-volume paths and never containing secrets — a thousand requests a second is terabytes a month. Metrics are counters, gauges and histograms, and latency must be a histogram because percentiles cannot be averaged across instances. Follow RED per service and USE per resource, and keep cardinality bounded: user ids and raw URLs belong in logs and traces, never in metric labels."',
      ],
    ]),
    asked([
      ['What should a log line contain?', 'Structured fields — event name, entity ids, a reason code, duration, and always a trace id.'],
      ['Histogram or summary for latency?', 'Histogram. Summaries compute per-instance quantiles and percentiles cannot be aggregated.'],
      ['What is saturation?', 'Work queued and waiting. It is the earliest warning, and the metric people most often omit.'],
      ['Why is cardinality dangerous?', 'Series count is the product of label values. One unbounded label is an unbounded number of series.'],
      ['How do you reduce logging cost?', 'Sample INFO on hot paths, keep all errors, shorten retention, and move per-request detail into traces.'],
    ]),

    links(wiki('Prometheus_(software)', 'Prometheus'), wiki('Structured_logging', 'Structured logging')),
  ],
};
