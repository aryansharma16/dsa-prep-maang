import { asked, code, diagram, h, js, links, p, quick, table, tip, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Rate limiting protects a system from traffic it cannot serve — abusive, accidental or simply more than you provisioned for. **Four algorithms, and the differences show up at the boundaries between windows.**',
    ),

    h('The four'),
    diagram(
      `
   FIXED WINDOW                      SLIDING WINDOW LOG
   count per clock interval          timestamps of every request

   |--- 100 ---|--- 100 ---|         drop entries older than 60s,
   0s         60s        120s        count what remains

   ✗ THE BOUNDARY BURST:             ✓ perfectly accurate
     100 at 0:59 + 100 at 1:01       ✗ memory per request
     = 200 in 2 seconds

   TOKEN BUCKET                      LEAKY BUCKET
   tokens refill at a fixed rate     requests drain at a fixed rate

   ┌─────────┐ refill 10/s           in ──▶ ┌─────────┐
   │ ●●●●●●  │ capacity 100                 │ queue   │ ──▶ out
   └─────────┘                              └─────────┘   10/s
   take 1 per request                       full? reject
   empty? reject
                                     ✓ perfectly smooth output
   ✓ ALLOWS BURSTS up to capacity    ✗ no bursts at all
   ✓ cheap: two numbers per key      ✗ adds queueing latency
`,
      'Four shapes, four behaviours',
    ),
    table(
      ['Algorithm', 'Allows bursts', 'Accuracy', 'Memory', 'Use for'],
      [
        ['**Fixed window**', 'At boundaries — badly', 'Poor', 'One counter', 'Crude internal limits'],
        ['**Sliding log**', 'No', '**Perfect**', 'One entry per request', 'Low volume, strict limits'],
        ['**Sliding counter**', 'Slightly', 'Good', 'Two counters', 'A good general default'],
        ['**Token bucket**', '**Yes, deliberately**', 'Good', 'Two numbers', '**Public APIs — the usual choice**'],
        ['**Leaky bucket**', 'No', 'Good', 'A queue', 'Protecting a fixed-capacity downstream'],
      ],
    ),
    tip(
      'Token bucket is the default for public APIs because **bursts are normal and legitimate**. A client that is idle for a minute and then makes twenty requests is not abusive, and a limiter that rejects them is producing a worse product for no protection.',
    ),

    h('Token bucket, distributed'),
    code(
      js(`
// Redis, in one atomic Lua script. It must be atomic: a GET,
// compute, SET from application code lets two servers both see
// the same token count and both allow the request.
const SCRIPT = \`
  local tokens_key = KEYS[1]
  local rate     = tonumber(ARGV[1])   -- tokens per second
  local capacity = tonumber(ARGV[2])
  local now      = tonumber(ARGV[3])

  local data = redis.call('HMGET', tokens_key, 'tokens', 'ts')
  local tokens = tonumber(data[1]) or capacity
  local last   = tonumber(data[2]) or now

  -- Refill lazily: no background job, just compute how many
  -- tokens would have accumulated since we last looked.
  tokens = math.min(capacity, tokens + (now - last) * rate)

  local allowed = tokens >= 1
  if allowed then tokens = tokens - 1 end

  redis.call('HMSET', tokens_key, 'tokens', tokens, 'ts', now)
  redis.call('EXPIRE', tokens_key, math.ceil(capacity / rate) * 2)
  return { allowed and 1 or 0, tokens }
\`;
`),
    ),
    warn(
      'Lazy refill is the trick worth knowing: **no timer, no background job.** You store the token count and the timestamp, and compute the refill on the next request. A limiter with a background refill job per key does not scale past a few thousand keys.',
    ),

    h('Limiting across many servers'),
    table(
      ['Approach', 'Accuracy', 'Cost'],
      [
        ['**Local, limit ÷ N**', 'Poor — uneven load balancing breaks it', 'Free'],
        ['**Centralised (Redis)**', '**Accurate**', 'A round trip per request'],
        ['**Local with async sync**', 'Approximate', 'Cheap, slightly over-permissive'],
        ['**Sticky by key**', 'Accurate', 'Requires consistent routing'],
      ],
    ),
    p(
      'Redis is the usual answer, and the round trip is acceptable because the check happens at the edge where everything is already fast. **Approximate is fine** — a limiter that occasionally allows 105 requests instead of 100 has still done its job.',
    ),

    h('What to limit by'),
    table(
      ['Key', 'Protects against', 'Weakness'],
      [
        ['**IP**', 'Crude floods', 'NAT punishes shared networks; trivially rotated'],
        ['**API key / account**', 'Abuse by a known client', 'Requires authentication first'],
        ['**User id**', 'Per-user fairness', 'Signed-in users only'],
        ['**Endpoint**', 'Expensive operations specifically', 'Not per-caller'],
        ['**Composite**', 'Most things', 'More keys to store'],
      ],
    ),
    tip(
      'Layer them: **a broad IP limit at the edge, a per-account quota at the gateway, and a tight limit on the three expensive endpoints.** One global limit is either too loose to protect the expensive path or too tight for the cheap one.',
    ),

    h('Responding well'),
    table(
      ['Header / code', 'Meaning'],
      [
        ['`429 Too Many Requests`', 'The correct status'],
        ['`Retry-After: 30`', '**When to come back.** Without it clients retry immediately'],
        ['`X-RateLimit-Limit`', 'The ceiling'],
        ['`X-RateLimit-Remaining`', 'What is left, so a good client can pace itself'],
        ['`X-RateLimit-Reset`', 'When the window resets'],
      ],
    ),
    warn(
      'Rejecting must be **cheap**, and it must happen at the outermost layer possible. A limiter that authenticates, queries a database and then returns 429 has done most of the work of serving the request — which means a flood still costs you everything.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'Capping request rate per caller to protect capacity'],
      ['Why it exists', 'Abuse, runaway clients, and fair sharing of finite capacity'],
      ['Use when', 'Any public API, and any expensive endpoint'],
      ['Trade-off', 'Accurate limiting costs a round trip; local limiting is cheap and approximate'],
      [
        '30-second answer',
        '"Token bucket for public APIs — it allows legitimate bursts up to a capacity and refills at a steady rate, stored as two numbers per key. Fixed windows have a boundary problem where two windows allow double the limit in a moment. Across servers, hold state in Redis behind an atomic script, refilling lazily rather than with a background job. Layer the keys — IP at the edge, account at the gateway, tighter on expensive endpoints — and always return 429 with Retry-After."',
      ],
    ]),
    asked([
      ['Which algorithm would you use?', 'Token bucket for public APIs — it allows bursts. Sliding window counter when bursts must be limited.'],
      ['What is wrong with fixed windows?', 'The boundary burst — 100 at the end of one window and 100 at the start of the next is 200 in two seconds.'],
      ['How do you rate limit across servers?', 'Centralised counters in Redis, updated by an atomic script. Approximate is acceptable.'],
      ['What should you limit by?', 'Layered keys: IP at the edge, account or API key at the gateway, plus per-endpoint limits.'],
      ['What do you return?', '429 with Retry-After, plus limit, remaining and reset headers so good clients can self-pace.'],
    ]),

    links(
      wiki('Token_bucket', 'Token bucket'),
      wiki('Rate_limiting', 'Rate limiting'),
    ),
  ],
};
