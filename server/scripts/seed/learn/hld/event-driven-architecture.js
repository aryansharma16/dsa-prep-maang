import { asked, code, diagram, h, js, links, p, quick, table, tip, tradeoff, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'In an event-driven system, services announce **what happened** rather than instructing each other what to do. The producer does not know who listens, which is the whole point — and also the source of every difficulty it brings.',
    ),

    h('Events versus commands'),
    diagram(
      `
   COMMAND                           EVENT
   "do this"                         "this happened"

   OrderService ──▶ SendEmail        OrderService ──▶ OrderPlaced
                    (to one handler)                      │
                                              ┌───────────┼───────────┐
   ✓ intent is explicit                       ▼           ▼           ▼
   ✓ one obvious handler                  email     inventory   analytics
   ✗ the producer must know
     every step that follows    ✓ add a consumer, change nothing upstream
                                ✗ nobody can see the whole flow

   past tense, immutable, a FACT     imperative, may be rejected
   OrderPlaced, PaymentFailed        SendEmail, ReserveStock
`,
      'Tense is the tell',
    ),
    table(
      ['', 'Command', 'Event'],
      [
        ['Name', 'Imperative — `ReserveStock`', 'Past tense — `StockReserved`'],
        ['Handlers', 'Exactly one', 'Zero or many'],
        ['Can be rejected', 'Yes', '**No** — it already happened'],
        ['Coupling', 'Producer knows the consumer', 'Producer knows nobody'],
        ['Carried on', 'A queue', 'A topic'],
      ],
    ),
    tip(
      'If you cannot name it in the past tense, it is a command. **`SendEmail` is not an event**; `OrderPlaced` is, and sending an email is one consumer\'s reaction to it. Getting this naming right prevents most of the design drift in an event system.',
    ),

    h('Choreography versus orchestration'),
    diagram(
      `
   CHOREOGRAPHY                      ORCHESTRATION
   each service reacts               one coordinator directs

   OrderPlaced                       ┌──────────────┐
      ├──▶ inventory ──▶ StockReserved│ Orchestrator │
      │                              └───┬───┬───┬──┘
      ├──▶ payment ──▶ PaymentTaken       │   │   │
      │                              1.   ▼   │   │
      └──▶ shipping ──▶ Shipped       inventory│   │
                                     2.       ▼   │
   ✓ no central component             payment     │
   ✓ services stay decoupled         3.           ▼
   ✗ NOBODY knows the whole flow      shipping
   ✗ debugging is archaeology
   ✗ a cycle is easy to create       ✓ the flow is in ONE place
                                     ✓ trivial to see and to change
                                     ✗ a component everything needs
                                     ✗ drifts toward a god service
`,
      'Two ways to sequence work',
    ),
    table(
      ['Use choreography', 'Use orchestration'],
      [
        ['Few steps, each independent', 'Many steps with real ordering'],
        ['Reactions are genuinely optional', 'Failure needs compensation'],
        ['Teams own their reactions', 'Someone must answer "where is order 42?"'],
        ['Notifications, analytics, caches', 'Checkout, onboarding, payouts'],
      ],
    ),
    tip(
      'The practical rule: **choreography for reactions, orchestration for processes.** "Send a receipt when an order is placed" is a reaction. "Take payment, then reserve stock, then ship, and undo it all if step two fails" is a process, and it needs someone in charge.',
    ),

    h('Event schemas'),
    p(
      'An event outlives the code that wrote it. A consumer added next year reads events published today, and a replayed topic hands you last year\'s shapes — so **schema evolution is a first-class problem**, not a detail.',
    ),
    code(
      js(`
// Every event carries its own identity, version and causality.
// None of these are optional at scale, and all of them are
// painful to add retrospectively.
const event = {
  eventId: '01HQ...',        // idempotency key for consumers
  eventType: 'OrderPlaced',
  version: 2,                // consumers branch on this
  occurredAt: '2026-03-04T10:15:00Z',
  correlationId: 'req-9f2',  // ties every event in one flow together
  causationId: '01HQ...',    // which event caused this one

  data: {
    orderId: '42',
    userId: '7',
    total: 1299,
    currency: 'INR',         // added in v2; v1 consumers ignore it
  },
};
`),
    ),
    table(
      ['Rule', 'Why'],
      [
        ['**Only add optional fields**', 'Old consumers keep working'],
        ['**Never change a field\'s meaning**', 'Nothing is more expensive to debug'],
        ['**Never remove a field in place**', 'Deprecate, wait, then remove in a new version'],
        ['**Version the event**', 'So a consumer can branch instead of guessing'],
        ['**Use a schema registry**', 'Compatibility checked at publish time, not in production'],
        ['**Carry a correlation id**', 'It is the only way to trace one flow across services'],
      ],
    ),
    warn(
      'The worst failure in an event system is a **silent semantic change** — `total` meaning pre-tax to the producer and post-tax to a consumer written a year later. No error is raised anywhere and the numbers are simply wrong.',
    ),

    h('Thin or fat events'),
    tradeoff([
      ['**Thin** (ids only)', 'Small, no stale data, no duplication', 'Every consumer calls back for details — a fan-in load on the producer'],
      ['**Fat** (the full state)', 'Consumers are self-sufficient; replays reconstruct the past exactly', 'Large messages, duplicated data, and a snapshot that can be stale'],
    ]),
    p(
      'The usual compromise is **an id plus the fields consumers actually need** — enough to act on without a callback, not so much that the event becomes a copy of the database. And for anything historical, fat is correct: a replay must see the world as it was, not as it is now.',
    ),

    h('What you give up'),
    table(
      ['Cost', 'Reality'],
      [
        ['**Debuggability**', 'A flow spans five services and no stack trace connects them'],
        ['**Eventual consistency**', 'The read model lags the write by seconds'],
        ['**Duplicate delivery**', 'At-least-once means every consumer must be idempotent'],
        ['**No global view**', 'Nobody can answer "what happens when an order is placed?" from the code'],
        ['**Ordering**', 'Only within a partition; cross-entity ordering is not guaranteed'],
      ],
    ),
    tip(
      'Distributed tracing with a **correlation id on every event** is not optional in this architecture. Without it, "the order was placed but no email went out" is an investigation across five services with no thread connecting them.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'Services announcing facts rather than instructing each other'],
      ['Why it exists', 'New consumers can be added without touching the producer'],
      ['Use when', 'Several independent systems react to the same thing'],
      ['Trade-off', 'Decoupling and extensibility, for eventual consistency and much harder debugging'],
      [
        '30-second answer',
        '"Events are past-tense facts with any number of listeners; commands are imperatives with exactly one handler. Use choreography for reactions and orchestration for processes — if failure needs compensation, someone has to be in charge. Events outlive the code that wrote them, so only add optional fields, version them, and never change a field\'s meaning. Every event carries an id for idempotency and a correlation id, because without tracing you cannot debug a flow at all."',
      ],
    ]),
    asked([
      ['Event or command?', 'Past tense with any number of listeners is an event. Imperative with one handler is a command.'],
      ['Choreography or orchestration?', 'Choreography for independent reactions. Orchestration when steps are ordered and failure needs compensation.'],
      ['How do you evolve an event schema?', 'Additive optional fields only, versioned, with a registry checking compatibility at publish time.'],
      ['Thin or fat events?', 'An id plus what consumers need. Fat for anything replayed historically, so the past is reconstructed accurately.'],
      ['What is the biggest downside?', 'Debuggability. A flow spans services with no stack trace, which is why correlation ids and tracing are mandatory.'],
    ]),

    links(
      wiki('Event-driven_architecture', 'Event-driven architecture'),
      wiki('Saga_pattern', 'Saga pattern'),
    ),
  ],
};
