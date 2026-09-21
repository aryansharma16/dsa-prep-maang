import { asked, diagram, flow, h, links, p, quick, table, tip, warn, wiki } from '../blocks.js';
import { interviewLevel } from './shapes.js';

export const doc = {
  blocks: [
    p(
      'A switch between banks. UPI itself holds no money and no accounts — it **routes instructions** between the payer\'s bank and the payee\'s bank and makes two independent institutions agree on one outcome. Everything hard about it follows from that: the debit and the credit happen in different systems, and neither can be rolled back by the other.',
    ),

    flow(['Payer app', 'Payer PSP', 'UPI switch', 'Payer bank', 'Payee bank', 'Payee'], 'One payment'),
    diagram(
      `
   FOUR PARTIES

   payer ──▶ PSP app        (Google Pay, PhonePe, a bank app)
                 │
                 ▼
            ┌─────────┐
            │  UPI    │  the switch: routes, never holds money
            │ switch  │
            └────┬────┘
        ┌────────┴────────┐
        ▼                 ▼
   ┌─────────┐       ┌─────────┐
   │  payer  │       │  payee  │
   │  bank   │       │  bank   │   two separate institutions,
   └─────────┘       └─────────┘   two separate ledgers,
     DEBIT             CREDIT      no shared transaction
`,
      'Who is who',
    ),

    h('The pieces'),
    table(
      ['Piece', 'What it does', 'Why it is there'],
      [
        ['**VPA directory**', 'Maps `name@bank` to an account', 'So you never type an account number'],
        ['**PSP / app**', 'Collects intent and the PIN', 'The user-facing half; holds no money'],
        ['**Switch**', 'Routes, sequences, and records outcomes', 'The coordinator between two banks'],
        ['**Bank core**', 'The actual ledgers', 'Where the money really is'],
        ['**Reconciliation**', 'End-of-day comparison of both sides', 'The safety net that catches every disagreement'],
        ['**Dispute system**', 'Chargebacks and manual resolution', 'Because some failures need a human'],
      ],
    ),

    h('The hard part — two legs, no shared transaction'),
    diagram(
      `
   HAPPY PATH                       THE FAILURE THAT DEFINES IT

   1. debit payer    ✓              1. debit payer    ✓
   2. credit payee   ✓              2. credit payee   ✗ (timeout)
   3. both confirm   ✓                     │
                                           ▼
                                   money has LEFT the payer
                                   and not ARRIVED anywhere

                                   you cannot roll back step 1 —
                                   it is another bank's committed
                                   transaction.

                                   so: REVERSAL, a compensating
                                   credit, driven by the switch
                                   and settled in reconciliation.
`,
      'Why it is a saga, not a transaction',
    ),
    table(
      ['Outcome', 'What the switch does'],
      [
        ['Debit ✓, credit ✓', 'Success. Notify both sides'],
        ['Debit ✗', 'Fail cleanly. Nothing moved, nothing to undo'],
        ['Debit ✓, credit ✗', '**Reversal** — a compensating credit back to the payer'],
        ['Debit ✓, credit unknown (timeout)', 'The hard one — query the payee bank until it answers, then decide'],
        ['Still unresolved', 'Mark pending, settle at reconciliation, refund within a fixed window'],
      ],
    ),
    warn(
      'A timeout is **not a failure**. It is an unknown outcome, and treating it as a failure causes double credits when the first one actually succeeded. The switch must query for the real status rather than assume — this is the single most important rule in payment systems.',
    ),

    h('Idempotency is the foundation'),
    p(
      'Every message carries a unique transaction id, and every participant stores the outcome against it. A retried instruction **returns the original outcome instead of executing again** — which is what makes retrying safe at all, and retries are unavoidable when banks time out.',
    ),
    table(
      ['Without idempotency', 'With it'],
      [
        ['A retry debits twice', 'A retry returns the first result'],
        ['A duplicate network packet is a second payment', 'It is a no-op'],
        ['Client cannot safely retry', 'Client retries freely until it gets an answer'],
        ['Reconciliation finds mismatches daily', 'Mismatches are rare and investigable'],
      ],
    ),

    h('Reconciliation'),
    flow(['Switch log', 'Bank statements', 'Match by txn id', 'Exceptions', 'Auto-resolve or dispute'], 'End of day'),
    p(
      'Every party keeps its own record, and at the end of the day they are compared line by line. **Reconciliation is not a cleanup job — it is the correctness guarantee.** Real-time messaging is best-effort; the ledger being right is what reconciliation enforces.',
    ),
    table(
      ['Exception', 'Resolution'],
      [
        ['Debited, not credited', 'Auto-reversal to the payer'],
        ['Credited, not debited', 'Investigate; recover from the payee bank'],
        ['Amount mismatch', 'Manual — it should not happen and usually means a bug'],
        ['Duplicate transaction id', 'Idempotency should have prevented it; alert loudly'],
        ['Unknown at both ends', 'Mark failed after the window and refund'],
      ],
    ),

    h('Scale'),
    table(
      ['Dimension', 'Order of magnitude', 'What breaks first'],
      [
        ['Transactions/month', '**~15–20 billion**', '—'],
        ['Peak TPS', 'Tens of thousands', 'The slowest bank on the route'],
        ['Latency target', '**< 5 seconds end to end**', 'Bank core systems, which are often decades old'],
        ['Participants', 'Hundreds of banks, dozens of PSPs', 'Each is an independent failure domain'],
        ['Reconciliation volume', 'Billions of rows daily', 'Batch compute, but it must finish before the next day'],
      ],
    ),
    tip(
      'The defining operational fact: **you are only as fast and as reliable as the slowest bank on the route.** Per-bank circuit breakers and health-based routing are not optimisations here — without them one struggling bank degrades the whole network.',
    ),

    h('Failures'),
    table(
      ['What dies', 'Effect', 'Mitigation'],
      [
        ['One bank is down', 'Payments to/from it fail', 'Circuit-break that bank; fail fast with a clear message'],
        ['One bank is slow', 'Timeouts, then unknown outcomes', 'Per-bank timeouts and breakers; queue status queries'],
        ['The switch', 'The network stops', 'Multi-site, active-active. This is national infrastructure'],
        ['A PSP app', 'Its users cannot pay', 'Others unaffected — the account is reachable from any PSP'],
        ['Reversal fails', 'Customer is out of pocket', 'Retry, escalate to dispute, refund within a mandated window'],
      ],
    ),

    h('Interview'),
    quick([
      ['What it is', 'A payment switch routing instructions between independent banks'],
      ['The hard part', 'A debit and a credit in two systems with no shared transaction'],
      ['Key decision', 'Saga with reversal, idempotency on every message, reconciliation as the backstop'],
      ['Trade-off', 'Real-time messaging is best-effort; correctness is guaranteed at reconciliation'],
      [
        '30-second answer',
        '"The switch holds no money — it routes between two banks and makes them agree. There is no transaction spanning both, so it is a saga: debit the payer, credit the payee, and on a failed credit issue a compensating reversal. Every message carries a transaction id and every party stores the outcome against it, so retries are safe — and a timeout is an unknown outcome to be queried, never assumed to be a failure. End-of-day reconciliation compares both sides and is the real correctness guarantee."',
      ],
    ]),
    asked([
      ['What if the debit succeeds and the credit fails?', 'A reversal — a compensating credit back to the payer, settled through reconciliation.'],
      ['Why is a timeout dangerous?', 'It is an unknown outcome. Treating it as failure and retrying can credit twice.'],
      ['Why is idempotency essential?', 'Retries are unavoidable when banks time out, and without it every retry is a second payment.'],
      ['What does reconciliation actually do?', 'Compares every party\'s ledger daily and resolves exceptions. It is the correctness guarantee, not a cleanup.'],
      ['Why not two-phase commit across banks?', 'You cannot hold a prepare lock in another institution\'s core banking system for seconds.'],
    ]),

    interviewLevel('UPI'),
    links(
      wiki('Saga_pattern', 'Saga pattern'),
      wiki('Idempotence', 'Idempotence'),
    ),
  ],
};
