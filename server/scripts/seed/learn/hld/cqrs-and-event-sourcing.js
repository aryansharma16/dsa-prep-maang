import { asked, code, diagram, flow, h, js, links, p, quick, table, tip, tradeoff, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Two patterns that travel together and are not the same thing. **CQRS separates the write model from the read model. Event sourcing stores changes instead of state.** Each is useful alone; both together are a serious commitment.',
    ),

    h('CQRS'),
    diagram(
      `
   ONE MODEL                          CQRS

   ┌─────────────┐                    writes ──▶ ┌────────────┐
   │   service   │                               │ write model│
   └──────┬──────┘                               │ normalised │
          │                                      └──────┬─────┘
          ▼                                             │ events
   ┌─────────────┐                                      ▼
   │  database   │  one schema serving             ┌────────────┐
   └─────────────┘  two opposite jobs              │ read model │
                                                   │ denormalised│
   the write path wants                            └──────┬─────┘
   normalised, constrained                                │
   the read path wants                             reads ─┘
   denormalised, fast
                                     each side is shaped for its job
   ──▶ one of them loses             ──▶ and scales independently
`,
      'Two models, one truth',
    ),
    table(
      ['', 'Write model', 'Read model'],
      [
        ['Shape', 'Normalised, constrained', 'Denormalised, pre-joined'],
        ['Optimised for', 'Correctness', 'Query speed'],
        ['Scaling', 'Usually modest', 'Often the heavy side'],
        ['Count', 'One', '**As many as you have query shapes**'],
        ['Storage', 'Relational, typically', 'Whatever fits — Elasticsearch, Redis, a document store'],
      ],
    ),
    tip(
      'CQRS does **not** require event sourcing, two databases or a message bus. "Write through the ORM, read through a hand-tuned SQL view" is CQRS, and it is a Tuesday afternoon of work rather than an architecture.',
    ),

    h('Event sourcing'),
    diagram(
      `
   STATE-ORIENTED                     EVENT-SOURCED

   account 42                         account 42
   ┌─────────────┐                    ┌──────────────────────┐
   │ balance: 70 │                    │ 1 Opened              │
   └─────────────┘                    │ 2 Deposited  100      │
                                      │ 3 Withdrew    50      │
   an UPDATE overwrote the past.      │ 4 Deposited   20      │
   how did it get to 70?              └──────────────────────┘
   nobody knows.                        state = fold(events) = 70

                                      ✓ the full history IS the data
                                      ✓ "what was it on 3 March?" —
                                        replay to that point
                                      ✓ a new read model = replay
                                      ✗ no UPDATE, no DELETE
                                      ✗ replaying millions of events
                                        needs snapshots
`,
      'Store the changes, derive the state',
    ),
    code(
      js(`
// State is a left fold over the event log.
const apply = (state, event) => {
  switch (event.type) {
    case 'Opened':    return { ...state, balance: 0, open: true };
    case 'Deposited': return { ...state, balance: state.balance + event.amount };
    case 'Withdrew':  return { ...state, balance: state.balance - event.amount };
    case 'Closed':    return { ...state, open: false };
    default:          return state;   // an event type this version
  }                                   // does not know about yet
};

// Snapshots exist because folding 2 million events on every read
// is not viable. Snapshot every N, then replay only the tail.
function currentState(snapshot, eventsSince) {
  return eventsSince.reduce(apply, snapshot ?? {});
}
`),
    ),

    h('What event sourcing buys'),
    tradeoff([
      ['**Event sourcing**', 'A complete audit trail by construction; time travel; new read models built by replay; a bug can be fixed and history reprocessed', 'No updates or deletes; every schema change must handle old events forever; snapshots; GDPR deletion is genuinely hard; a much steeper learning curve'],
    ]),
    warn(
      '**GDPR is the practical blocker people hit.** An append-only log cannot delete a user\'s data, and "the right to be forgotten" is not optional. The usual workaround is crypto-shredding — encrypt personal data per user and destroy the key — which is a design decision you must make at the start.',
    ),

    h('When each is worth it'),
    table(
      ['Pattern', 'Worth it when', 'Not worth it when'],
      [
        ['**CQRS alone**', 'Read and write loads differ sharply; queries need a different shape', 'CRUD over a moderate dataset'],
        ['**Event sourcing alone**', 'Audit is a hard requirement; the history is genuinely the product', 'You just want an audit log — a table will do'],
        ['**Both**', 'Finance, trading, anything regulated; complex domains with real temporal logic', '**Most systems.** This is a large commitment'],
      ],
    ),
    tip(
      'Domains where it genuinely pays: **banking, trading, insurance, logistics** — anywhere "what did we know and when" is a business question rather than a debugging one. Everywhere else, an audit table gets you 80% of the benefit for 5% of the cost.',
    ),

    h('The consistency gap'),
    flow(['Command', 'Write model', 'Event', 'Projector', 'Read model'], 'Milliseconds to seconds'),
    warn(
      'The read model **lags the write model**, so a user who submits a form and is redirected to a list may not see their own change. Every CQRS system must answer this: read from the write model immediately after a write, return the new state in the response, or make the UI optimistic.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'Separate read and write models; store events instead of state'],
      ['Why they exist', 'Reads and writes want opposite shapes; some domains need full history'],
      ['Use when', 'CQRS when the two loads genuinely differ; event sourcing when audit is the requirement'],
      ['Trade-off', 'Flexibility and auditability, for eventual consistency and substantial complexity'],
      [
        '30-second answer',
        '"CQRS separates the write model from the read model, so each is shaped and scaled for its job — and it needs no event bus; a read replica with a tuned view is CQRS. Event sourcing stores the events and derives state by folding them, which gives a complete audit trail and lets you build a new read model by replaying history. The costs are real: eventual consistency between the models, snapshots, old event versions forever, and GDPR deletion becoming a design problem."',
      ],
    ]),
    asked([
      ['Does CQRS require event sourcing?', 'No. Separate read and write models is enough — even a tuned SQL view counts.'],
      ['What does event sourcing give you?', 'Full history, time travel, and new read models built by replaying events.'],
      ['What does it cost?', 'No updates or deletes, snapshots for performance, handling old event versions forever, and hard GDPR deletion.'],
      ['How do you handle the read model lag?', 'Read from the write model right after a write, return the new state in the response, or update the UI optimistically.'],
      ['When would you use both?', 'Regulated or financial domains where history is a business requirement. Rarely otherwise.'],
    ]),

    links(
      wiki('Command_Query_Responsibility_Segregation', 'CQRS'),
      wiki('Event_store', 'Event store'),
    ),
  ],
};
