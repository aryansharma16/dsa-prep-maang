import { asked, code, diagram, flow, h, js, links, p, quick, table, tip, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Five patterns that stop one broken dependency taking everything else with it. They work together, and **in this order**: a timeout makes failure detectable, a breaker makes it cheap, a bulkhead contains it, and degradation keeps the product alive.',
    ),

    flow(['Timeout', 'Retry + jitter', 'Circuit breaker', 'Bulkhead', 'Degrade'], 'Layered, not alternatives'),

    h('1 · Timeouts'),
    p(
      'Without a timeout, "slow" and "dead" are the same thing and neither is detectable. **Every network call needs one** — and the default in most HTTP clients is either minutes or infinite.',
    ),
    diagram(
      `
   NO TIMEOUT                        TIMEOUT 500ms

   dependency hangs                  dependency hangs
        │                                 │
        ▼                                 ▼
   thread waits 60s                  fail at 500ms
        │                                 │
        ▼                                 ▼
   200 threads all waiting           threads freed, breaker
        │                            opens, fallback served
        ▼
   pool exhausted                    ✓ contained
        │
        ▼
   EVERY endpoint is down,
   including ones that never
   touched this dependency
`,
      'How one slow dependency becomes a total outage',
    ),
    table(
      ['Rule', 'Why'],
      [
        ['Timeout < the caller\'s timeout', 'Otherwise the caller gives up while you still hold resources'],
        ['Base it on p99, not the average', '~2–3x p99 is the usual figure'],
        ['Separate connect and read timeouts', 'An unreachable host should fail in milliseconds'],
        ['**Propagate a deadline**', 'Pass the remaining budget down the chain so nobody works past it'],
      ],
    ),

    h('2 · Retry, carefully'),
    table(
      ['Retry', 'Do not retry'],
      [
        ['Timeouts and connection failures', '`400` — it will fail again'],
        ['`503`, `429` (honouring `Retry-After`)', '`401`, `403`, `404`'],
        ['Idempotent operations', '**Anything non-idempotent without a key**'],
      ],
    ),
    warn(
      'Retries are **load multipliers during an outage.** Three retries against a struggling service is 4x the traffic at the worst possible moment. Exponential backoff with jitter, a hard cap, and a retry budget that limits retries to a small share of total traffic.',
    ),

    h('3 · Circuit breaker'),
    diagram(
      `
        ┌────────────────────────────────────┐
        │                                    │
        ▼         failures > threshold       │
   ┌────────┐ ──────────────────────▶ ┌──────────┐
   │ CLOSED │                          │   OPEN   │
   │        │ ◀────────────────────── │          │
   └────────┘      probe succeeded     └────┬─────┘
        ▲                                   │ after cooldown
        │                                   ▼
        │                            ┌──────────────┐
        └─────────────────────────── │  HALF-OPEN   │
              probe failed           │ let ONE test │
              ──▶ back to OPEN       │   request    │
                                     └──────────────┘

   CLOSED     calls pass; failures counted
   OPEN       fail INSTANTLY. no call, no timeout, no waiting
   HALF-OPEN  one probe decides whether to recover
`,
      'Three states',
    ),
    code(
      js(`
// The point is not that it prevents failure — it makes failure
// CHEAP. An open breaker turns a 500ms timeout into a 0ms error,
// so callers are never blocked and the struggling dependency gets
// the quiet it needs to recover.
const breaker = new CircuitBreaker(callPricingService, {
  timeout: 500,
  errorThresholdPercentage: 50,  // open at 50% failures
  volumeThreshold: 20,           // ...but only after 20 calls, so
                                 // 1-of-2 failing does not open it
  resetTimeout: 30000,           // try one probe after 30s
});

breaker.fallback(() => cachedPrices());  // degrade, do not fail
`),
    ),
    tip(
      'The `volumeThreshold` matters more than people expect. **Without it, one failure out of the first two calls opens the breaker** and a healthy service is cut off by statistical noise on a low-traffic endpoint.',
    ),

    h('4 · Bulkheads'),
    p(
      'Separate resource pools per dependency, so exhausting one cannot starve the others. Named after ship compartments: **a hull breach floods one compartment, not the vessel.**',
    ),
    diagram(
      `
   SHARED POOL (100 connections)      BULKHEADED

   ┌──────────────────────────┐       ┌────┐ ┌────┐ ┌──────────┐
   │ ████████████████████████ │       │ 20 │ │ 20 │ │    60    │
   │ all 100 held by calls to │       │ A  │ │ B  │ │ database │
   │ slow service A           │       └────┘ └────┘ └──────────┘
   └──────────────────────────┘        ████   ░░░░   ░░░░░░░░░░
                                       full   fine   fine
   ✗ database calls cannot get
     a connection either               ✓ A is degraded
   ✗ everything is down                ✓ everything else works
`,
      'One compartment, not the hull',
    ),

    h('5 · Graceful degradation'),
    table(
      ['Component fails', 'Degrade to', 'Not'],
      [
        ['Recommendations', 'Best-sellers', 'An error page'],
        ['Search', 'Category browse', 'An error page'],
        ['Ranking', 'Chronological order', 'An empty feed'],
        ['Personalisation', 'Generic content', 'A blank page'],
        ['Reviews', 'Hide the section', 'A broken product page'],
        ['**Payment**', '**Fail honestly**', 'Never pretend it worked'],
      ],
    ),
    warn(
      'The last row is the boundary. Degrading a **read** to something less personal is good; degrading a **write** by pretending it succeeded is a bug that becomes a support ticket and possibly a refund.',
    ),

    h('Put together'),
    table(
      ['Layer', 'Turns'],
      [
        ['**Timeout**', 'An indefinite hang into a bounded failure'],
        ['**Retry + jitter**', 'A transient blip into a success'],
        ['**Circuit breaker**', 'A repeated slow failure into an instant one'],
        ['**Bulkhead**', 'One failing dependency into one degraded feature'],
        ['**Degradation**', 'A degraded feature into a slightly worse page'],
      ],
    ),
    tip(
      'Reciting that table in order is a complete, well-structured answer to "what happens when a downstream service fails?" — which is asked in essentially every design round.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'Five layered patterns for surviving a failing dependency'],
      ['Why it exists', 'A slow dependency takes down services that do not even call it'],
      ['Use when', 'Every cross-service and third-party call'],
      ['Trade-off', 'Failing fast rejects requests that might have succeeded'],
      [
        '30-second answer',
        '"Layered. A timeout makes failure detectable — without one, slow and dead are identical and thread pools exhaust. Retries with exponential backoff, jitter and a budget, only for idempotent operations. A circuit breaker opens after a failure threshold so calls fail instantly instead of timing out, with one probe to recover. Bulkheads give each dependency its own pool so one cannot starve the rest. And then degrade: recommendations become best-sellers rather than an error page."',
      ],
    ]),
    asked([
      ['How does a circuit breaker work?', 'Closed passes calls and counts failures; open fails instantly; half-open sends one probe to decide recovery.'],
      ['Why is a timeout the first thing?', 'Without it a hanging dependency holds threads indefinitely and exhausts the pool.'],
      ['Why can retries make an outage worse?', 'They multiply load on a struggling service, and without jitter they arrive synchronised.'],
      ['What is a bulkhead?', 'Separate resource pools per dependency, so one exhausting its pool cannot starve the others.'],
      ['What should you never degrade?', 'A write. Reads can become less personal; a payment must fail honestly.'],
    ]),

    links(
      wiki('Circuit_breaker_design_pattern', 'Circuit breaker'),
      wiki('Bulkhead_pattern', 'Bulkhead pattern'),
    ),
  ],
};
