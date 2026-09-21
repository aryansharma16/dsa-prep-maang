import { asked, diagram, h, links, p, quick, table, tip, tradeoff, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'The question is simple: **does the user need the answer before the response returns?** Almost always, less needs to happen on the request path than you think — and moving the rest off it is what lets a system absorb a spike instead of falling over in one.',
    ),

    h('The same feature, two ways'),
    diagram(
      `
   SYNCHRONOUS                       ASYNCHRONOUS

   POST /orders                      POST /orders
     ├─ validate          10ms         ├─ validate          10ms
     ├─ reserve stock     20ms         ├─ reserve stock     20ms
     ├─ charge card     1500ms         ├─ save order        10ms
     ├─ save order        10ms         ├─ enqueue           2ms
     ├─ send email       400ms         └─ 202 Accepted    ~40ms
     ├─ notify warehouse 300ms
     ├─ update analytics 100ms       ┌─── queue ───┐
     └─ 200 OK         ~2340ms       │ charge      │
                                     │ email       │ happens behind
   ✓ the answer is final             │ warehouse   │ the response
   ✗ 2.3 seconds                     │ analytics   │
   ✗ email provider down             └─────────────┘
     = order fails
   ✗ a spike hits everything         ✓ 40ms, and a spike queues
                                     ✗ "your order is confirming"
`,
      'Where the 2.3 seconds went',
    ),

    h('What belongs where'),
    table(
      ['Keep synchronous', 'Make asynchronous'],
      [
        ['Validation — the user must be told now', 'Emails, push, SMS'],
        ['Authorisation', 'Analytics and metrics'],
        ['Anything the response body contains', 'Image and video processing'],
        ['Reserving a contended resource', 'Search index updates'],
        ['Anything that decides success or failure', 'Third-party sync'],
        ['', 'Report generation'],
        ['', 'Webhooks to other systems'],
      ],
    ),
    tip(
      'The test: **if this step failed, would the request have to fail?** If not, it does not belong on the request path. Sending a confirmation email is not a reason to fail an order that has already been paid for.',
    ),

    h('The trade'),
    tradeoff([
      ['**Synchronous**', 'Simple, immediate, easy to debug, the answer is final', 'The caller waits for the slowest step; any dependency failing fails the request; a spike hits everything at once'],
      ['**Asynchronous**', 'Fast responses, spikes absorbed, failures isolated, retries are free', 'Eventual results, duplicate delivery, a backlog to operate, and much harder to trace'],
    ]),
    warn(
      'Async is not free. You have accepted **at-least-once delivery, out-of-order processing, a queue to monitor and a new failure mode** — a backlog that grows faster than it drains. Moving work to a queue converts a latency problem into an operations problem.',
    ),

    h('Telling the user'),
    table(
      ['Pattern', 'How it works', 'Use for'],
      [
        ['**Fire and forget**', 'Accept, never report back', 'Analytics, logging'],
        ['**202 + status endpoint**', 'Return an id; the client polls it', 'Reports, exports, long jobs'],
        ['**202 + webhook**', 'Return an id; call the client back', 'Server-to-server'],
        ['**202 + push**', 'Return; notify over WebSocket or push', 'User-facing, where the wait matters'],
        ['**Optimistic UI**', 'Show it as done; reconcile if it fails', 'High-success-rate actions'],
      ],
    ),
    p(
      'Most systems get this wrong by picking fire-and-forget for something the user cares about. **If a user would ask "did that work?", you owe them a way to find out** — a status endpoint is a few lines and removes an entire category of support ticket.',
    ),

    h('Absorbing a spike'),
    diagram(
      `
   incoming                          SYNCHRONOUS
   10,000/s                          ──▶ 10,000/s hits the database
      │                                   which handles 2,000/s
      ▼                                   ──▶ timeouts, retries,
   ┌──────┐                                   cascade, outage
   │ app  │
   └──┬───┘                          ASYNCHRONOUS
      │                              ──▶ 10,000/s into the queue
      ▼                                  (queues are cheap)
   ┌──────────────────────┐          ──▶ workers drain at 2,000/s
   │ ████████░░░░░░░░░░░░ │          ──▶ backlog peaks, then clears
   │   queue: 40k deep    │          ──▶ nothing fails, some work
   └──────────┬───────────┘              is just late
              ▼  2,000/s
         ┌─────────┐
         │ workers │
         └─────────┘

   the queue converts a CAPACITY failure into a LATENCY delay.
`,
      'Why a queue is a shock absorber',
    ),
    tip(
      'That is the sentence to use in an interview: **a queue converts a capacity failure into a latency delay.** It does not add throughput — the workers still drain at 2,000 a second — it just means the excess waits instead of failing.',
    ),

    h('When async is the wrong answer'),
    table(
      ['Situation', 'Why'],
      [
        ['The user needs the result now', 'A status endpoint plus polling is worse UX than waiting 200ms'],
        ['The operation is already fast', 'You added a queue, a worker and a failure mode for nothing'],
        ['Ordering is strictly required', 'You now need partitioning and careful key selection'],
        ['It must happen exactly once', 'It will not. You need idempotency regardless'],
        ['The system is small', 'A queue is a whole component to operate'],
      ],
    ),

    h('Interview'),
    quick([
      ['What it is', 'Deciding what must finish before the response returns'],
      ['Why it matters', 'The request path\'s length is the product\'s latency and its fragility'],
      ['Use when', 'Any step that is slow, third-party, or not needed for the answer'],
      ['Trade-off', 'Fast responses and absorbed spikes, for eventual results and a queue to operate'],
      [
        '30-second answer',
        '"The test is whether the request would have to fail if this step failed. Validation and reserving a contended resource stay synchronous; emails, image processing, analytics and third-party calls go on a queue. That turns a 2-second checkout into 40 milliseconds and stops an email provider outage failing orders. The cost is eventual results, at-least-once delivery and a backlog to monitor — so tell the user with a status endpoint or a push rather than fire-and-forget."',
      ],
    ]),
    asked([
      ['What belongs in a background job?', 'Anything whose failure would not have to fail the request — email, analytics, media processing, third-party sync.'],
      ['Does a queue add throughput?', 'No. It absorbs bursts. It converts a capacity failure into a latency delay.'],
      ['How do you tell the user?', 'Return 202 with an id, then a status endpoint, a webhook or a push. Fire-and-forget only for things nobody asks about.'],
      ['What does async cost?', 'Eventual consistency, duplicate delivery, harder tracing, and a backlog you must monitor.'],
      ['When is async wrong?', 'When the operation is already fast, or the user genuinely needs the answer in the response.'],
    ]),

    links(
      wiki('Message_queue', 'Message queue'),
      wiki('Asynchrony_(computer_programming)', 'Asynchrony'),
    ),
  ],
};
