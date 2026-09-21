import { asked, diagram, flow, h, links, p, quick, table, tip, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'A transaction across three services has no `COMMIT`. **Two-phase commit exists and almost nobody uses it**, so the practical answer is a saga: a sequence of local transactions, each with an undo, coordinated by somebody.',
    ),

    h('Two-phase commit, and why it lost'),
    diagram(
      `
   PHASE 1 — prepare                 PHASE 2 — commit

   coordinator ──▶ A: prepare?       coordinator ──▶ A: commit
               ──▶ B: prepare?                   ──▶ B: commit
               ──▶ C: prepare?                   ──▶ C: commit
                    │                                 │
               all say YES                        all apply
                    │
               any says NO ──▶ abort everyone

   THE PROBLEM

   coordinator sends "prepare", everyone votes yes,
   coordinator DIES before phase 2.
        │
        ▼
   A, B and C are all holding LOCKS, waiting.
   none of them may commit or abort — only the coordinator knows.
   they block until it returns. possibly forever.

   ✗ blocking protocol      ✗ locks held across a network
   ✗ coordinator is a SPOF  ✗ unusable at latency or volume
`,
      'Correct, and not survivable',
    ),
    warn(
      'The killer is not slowness, it is that 2PC is a **blocking** protocol: participants hold locks and cannot decide alone. A coordinator failure at the wrong moment leaves rows locked in three databases with no safe way to proceed.',
    ),

    h('Sagas'),
    p(
      'Give up atomicity and keep the outcome. Each step is a **local** transaction that commits immediately; if a later step fails, you run compensating actions to undo the earlier ones.',
    ),
    diagram(
      `
   HAPPY PATH

   [1] reserve stock  ✓ ──▶ [2] charge card ✓ ──▶ [3] create order ✓
                                                  ──▶ [4] ship

   FAILURE AT STEP 3

   [1] reserve stock  ✓ ──▶ [2] charge card ✓ ──▶ [3] create order ✗
                                                        │
                            ◀── compensate ─────────────┘
   [1'] release stock ◀── [2'] refund card

   compensation is FORWARD motion, not a rollback.
   a refund is a new transaction. the charge still happened
   and still appears on the statement.
`,
      'Undo by doing something new',
    ),
    table(
      ['Step', 'Compensating action'],
      [
        ['Reserve stock', 'Release the reservation'],
        ['Charge the card', 'Issue a refund'],
        ['Create the order', 'Cancel it'],
        ['Send a confirmation email', '**Send a correction** — you cannot unsend'],
        ['Ship the parcel', '**Nothing.** Forward-only; it becomes a return'],
      ],
    ),
    tip(
      'The last two rows are the design constraint: **put irreversible steps last.** Ship after payment, email after the order is confirmed. A saga whose second step cannot be compensated is a saga that cannot fail safely.',
    ),

    h('Choreography versus orchestration'),
    table(
      ['', 'Choreography', 'Orchestration'],
      [
        ['Who sequences', 'Each service reacts to events', 'A coordinator calls each step'],
        ['Where the flow lives', '**Nowhere** — spread across services', '**One place**'],
        ['Adding a step', 'Subscribe to an event', 'Change the orchestrator'],
        ['Debugging', 'Archaeology across services', 'Read the state machine'],
        ['Coupling', 'Low', 'Services depend on the coordinator'],
        ['Good for', '2–3 simple steps', '**4+ steps, or any compensation**'],
      ],
    ),
    p(
      'For anything with real compensation logic, orchestration wins: **somebody has to know what to undo and in what order**, and encoding that in five independent event handlers is how you get a flow nobody can reason about.',
    ),

    h('What a saga requires'),
    flow(['Idempotent steps', 'Idempotent compensations', 'Persisted state', 'Timeouts', 'A DLQ'], 'All five'),
    table(
      ['Requirement', 'Why'],
      [
        ['**Every step idempotent**', 'Retries are certain; a retried charge must not charge twice'],
        ['**Every compensation idempotent**', 'The undo gets retried too'],
        ['**Saga state persisted**', 'A crashed orchestrator must resume, not restart'],
        ['**Timeouts per step**', 'A step that never answers must eventually be compensated'],
        ['**Manual intervention path**', 'Some sagas will get stuck. Someone must be able to fix one'],
      ],
    ),
    warn(
      'A saga is **not atomic and not isolated.** Mid-saga, the world sees a half-finished state: stock reserved but no order exists. Other transactions can observe that. If your domain cannot tolerate an intermediate state being visible, a saga is the wrong pattern.',
    ),

    h('Avoiding the problem'),
    table(
      ['Instead of a distributed transaction', 'Do this'],
      [
        ['Put the two entities in one service', '**The best answer** — it becomes a local transaction'],
        ['Make the second step idempotent and retry until it succeeds', 'No compensation needed'],
        ['Accept eventual consistency with reconciliation', 'A periodic job fixes discrepancies'],
        ['Reorder so the irreversible step is last', 'Everything before it can be undone'],
      ],
    ),
    tip(
      'That first row is worth saying out loud. **A distributed transaction is often a sign the service boundary is in the wrong place** — if two things must change together, they probably belong to the same service.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'Changing data in several services when no transaction spans them'],
      ['Why it exists', 'Microservices removed the shared database and its COMMIT'],
      ['Use when', 'A multi-step business process across service boundaries'],
      ['Trade-off', 'Availability and scale, for lost atomicity and visible intermediate states'],
      [
        '30-second answer',
        '"Two-phase commit is correct and blocking — participants hold locks and cannot decide if the coordinator dies, so it is avoided. A saga instead runs local transactions with a compensating action for each, so a failure at step three refunds and releases the earlier steps. Compensation is forward motion, not rollback — a refund is a new transaction. Use orchestration once there are more than a few steps, make every step and compensation idempotent, and put irreversible steps last."',
      ],
    ]),
    asked([
      ['Why avoid two-phase commit?', 'It blocks — participants hold locks and cannot decide alone if the coordinator fails.'],
      ['How does a saga undo a committed step?', 'A compensating transaction. It does not roll back; it does something new, like a refund.'],
      ['Choreography or orchestration?', 'Orchestration past a few steps or wherever compensation is involved — the flow needs to live in one place.'],
      ['What can a saga not give you?', 'Isolation. Other transactions can observe the half-finished intermediate state.'],
      ['How do you avoid needing one?', 'Put the entities that change together in the same service, so it is a local transaction again.'],
    ]),

    links(
      wiki('Saga_pattern', 'Saga pattern'),
      wiki('Two-phase_commit_protocol', 'Two-phase commit'),
    ),
  ],
};
