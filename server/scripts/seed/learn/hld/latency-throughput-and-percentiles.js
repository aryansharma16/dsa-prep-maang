import { asked, diagram, h, links, p, quick, table, tip, tradeoff, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Latency is **how long one request takes**. Throughput is **how many you finish per second**. They are not the same dial, they often move in opposite directions, and confusing them is how a system gets optimised in the wrong direction.',
    ),

    diagram(
      `
   a checkout at a supermarket

   LATENCY                        THROUGHPUT
   how long YOU wait              how many customers per hour

   one till, fast cashier         ten tills, slow cashiers
   latency:    2 min  ✓           latency:    6 min  ✗
   throughput: 30/hr  ✗           throughput: 100/hr ✓

   adding tills   ──▶ throughput up, latency unchanged
   faster cashier ──▶ both improve
   a long queue   ──▶ latency up, throughput unchanged

   the queue is the thing people forget.
`,
      'Two different numbers',
    ),

    h('The relationship'),
    tradeoff([
      ['**Batching**', 'Throughput way up — fewer round trips, better locality', 'Latency up — you wait for the batch to fill'],
      ['**More parallelism**', 'Throughput up', 'Latency up past saturation, from contention'],
      ['**Caching**', 'Both improve', 'Staleness'],
      ['**Bigger machines**', 'Both improve', 'Cost, and a ceiling'],
    ]),
    warn(
      'Past saturation they **invert**. Adding load to a saturated system raises latency without raising throughput — requests queue. That is the knee in the curve, and finding it is the whole point of load testing.',
    ),

    h('Why the average lies'),
    p(
      'Report an average and you describe a user who does not exist. Latency distributions have a long right tail, and the tail is where the anger is.',
    ),
    diagram(
      `
   1000 requests

   count
     │  ████
     │  ████
     │  ████ ███
     │  ████ ███ ██
     │  ████ ███ ██ █           ·      ·          ·
     └──┴────┴───┴──┴───────────┴──────┴──────────┴────▶ ms
        20   40  60  80        400    900       2400

        mean = 95ms       ← "we're fast!"
        p50  = 45ms       ← the typical request
        p99  = 900ms      ← 1 in 100 users
        p999 = 2400ms     ← your most active users, constantly

   the mean is dragged right by the tail and describes nobody.
`,
      'One distribution, four different stories',
    ),
    table(
      ['Metric', 'Means', 'Use it for'],
      [
        ['**p50 / median**', 'Half are faster', 'The typical experience'],
        ['**p95**', '1 in 20 is slower', 'The normal SLO target'],
        ['**p99**', '1 in 100 is slower', 'Where real problems show up first'],
        ['**p99.9**', '1 in 1,000 is slower', 'Your heaviest users hit this constantly'],
        ['**Mean**', 'Arithmetic average', 'Capacity planning. Never user experience'],
        ['**Max**', 'The worst one', 'Noise, usually — one GC pause'],
      ],
    ),
    tip(
      'The counter-intuitive one: **your best customers live in the tail.** Someone making 200 requests per session has a near-certainty of hitting your p99 at least twice. The 1% is not 1% of users, it is most users, some of the time.',
    ),

    h('Tail amplification'),
    p(
      'A request that fans out to many services takes the **slowest** of them, not the average. This is why p99 latency gets worse as you add services, even when every individual service gets faster.',
    ),
    diagram(
      `
   one request ──▶ fans out to 10 services in parallel
                   each has p99 = 100ms

   P(all ten under 100ms) = 0.99^10 = 0.904

   so ~10% of requests hit at least one slow service.
   your p99 is now roughly the services' p99.9.

   fan out to 100 services: 0.99^100 = 0.366
   ──▶ 63% of requests are slow.

   more components means a worse tail, for free.
`,
      'The maths of fan-out',
    ),
    table(
      ['Fix', 'How it works'],
      [
        ['**Hedged requests**', 'Send a duplicate to a replica after p95; take the first answer'],
        ['**Deadlines**', 'Return what you have when the budget expires; do not wait for stragglers'],
        ['**Fewer hops**', 'The cheapest fix, and the one nobody wants to do'],
        ['**Fix the source**', 'GC pauses, cold caches, noisy neighbours — the tail is usually one specific cause'],
      ],
    ),

    h('Where latency actually goes'),
    table(
      ['Source', 'Typical', 'Fix'],
      [
        ['Network to the user', '20–150ms', 'CDN, edge termination, a closer region'],
        ['TLS handshake', '1 extra round trip', 'Session resumption, keep-alive, HTTP/2'],
        ['Service-to-service hop', '~0.5–5ms each', 'Fewer hops; parallelise what is left'],
        ['Database query', '1–100ms', 'Index, then cache'],
        ['Queue wait', 'Unbounded', 'More consumers, or shed load'],
        ['GC / runtime pause', '10–500ms', 'Tune it — a classic tail contributor'],
        ['Cold start', '100ms–10s', 'Keep instances warm'],
      ],
    ),

    h('Little\'s Law'),
    p(
      '**Concurrency = arrival rate × latency.** At 1,000 requests per second with 200ms latency, 200 requests are in flight at any moment — so your thread pool, connection pool and memory must hold 200 concurrent requests. Halve the latency and you halve the concurrency you must provision.',
    ),
    tip(
      'This is the bridge between the two numbers, and it is worth being able to state. It is also the reason **reducing latency reduces cost**: less time in flight means fewer resources held per request.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'Latency is per-request time; throughput is requests per second'],
      ['Why it matters', 'They trade against each other, and averages hide the problem'],
      ['Use when', 'Stating SLOs, and any time someone says "it is fast"'],
      ['Trade-off', 'Batching and parallelism buy throughput and cost latency'],
      [
        '30-second answer',
        '"Latency is how long one request takes, throughput is how many finish per second, and they often move in opposite directions — batching raises throughput and raises latency. Always quote percentiles, never the mean: the distribution has a long tail and the mean describes nobody. p99 matters because a fan-out request takes the slowest branch, so tail latency amplifies with every service you add. Little\'s Law ties them together: concurrency equals rate times latency."',
      ],
    ]),
    asked([
      ['Latency or throughput — which do you optimise?', 'Depends on the product. A user-facing read is latency; a batch pipeline is throughput.'],
      ['Why p99 and not the average?', 'The distribution is long-tailed. The mean is dragged right and describes no real user.'],
      ['Why does p99 matter if it is only 1%?', 'A user making many requests hits it repeatedly. The tail is most users, some of the time.'],
      ['What is tail amplification?', 'A fan-out request takes the slowest branch, so p99 across ten services approaches each one\'s p99.9.'],
      ['What is Little\'s Law?', 'Concurrency = arrival rate × latency. It tells you how many requests are in flight, and what to provision.'],
    ]),

    links(
      wiki('Percentile', 'Percentile'),
      wiki("Little's_law", "Little's law"),
    ),
  ],
};
