import { asked, diagram, flow, h, links, p, quick, table, tip, warn, wiki } from '../blocks.js';
import { interviewLevel } from './shapes.js';

export const doc = {
  blocks: [
    p(
      'A UPI **app**, not a switch. The distinction is the whole design: it holds no money, owns no ledger, and is not the authority on whether a payment happened. What it owns is intent, identity, a cache of someone else\'s truth, and the user experience of a network it does not control.',
    ),

    flow(['User', 'App', 'PSP backend', 'Bank partner', 'UPI switch'], 'Where the app sits'),
    diagram(
      `
   WHAT YOU OWN              WHAT YOU DO NOT

   ┌────────────────┐        ┌────────────────┐
   │ app + UX       │        │ the ledger     │
   │ contacts       │        │ account balance│
   │ intent         │        │ the debit      │
   │ txn history    │◀ ─ ─ ─ │ the credit     │
   │  (a CACHE)     │  sync  │ final status   │
   │ notifications  │        │ reversals      │
   │ rewards        │        └────────────────┘
   └────────────────┘              bank + switch

   your database is a MIRROR. when it disagrees with
   the switch, the switch is right — always.
`,
      'The ownership boundary',
    ),

    h('The pieces'),
    table(
      ['Piece', 'What it does', 'Why it is there'],
      [
        ['**Client app**', 'Intent capture, PIN entry inside a secure component', 'The PIN is never seen by your servers'],
        ['**PSP backend**', 'Talks to the bank partner and the switch', 'The only component allowed to initiate payments'],
        ['**Transaction mirror**', 'Local copy of every transaction and its status', 'History, search and notifications. Not authoritative'],
        ['**Status poller**', 'Chases pending transactions to a final state', 'The most important background job in the system'],
        ['**Contacts / VPA resolution**', 'Person → `name@bank`', 'Cached, because directory lookups are slow and repetitive'],
        ['**Notification service**', 'Tells both parties what happened', 'Fan-out; must never fire on a non-final status'],
        ['**Rewards / offers**', 'Scratch cards, cashback', 'Entirely yours, and must settle only on confirmed payments'],
      ],
    ),

    h('The hard part — you find out last'),
    p(
      'Your server sends an instruction and then **loses visibility**. The switch talks to two banks; the answer may take seconds, may time out, and may arrive as a callback you never receive. Meanwhile a user is staring at a spinner holding their phone.',
    ),
    diagram(
      `
   t=0    user taps pay          ──▶ status: INITIATED
   t=1s   sent to switch         ──▶ status: PENDING
   t=3s   no response yet        ──▶ UI: "checking with your bank"
   t=5s   still nothing          ──▶ start polling
   t=8s   poll ──▶ SUCCESS       ──▶ status: SUCCESS  ✓ notify

   OR

   t=8s   poll ──▶ still pending ──▶ keep polling, backing off
   t=2m   poll ──▶ FAILED        ──▶ status: FAILED   ✓ notify
   t=2m   ...but money left the account
                                 ──▶ the SWITCH issues the reversal.
                                     you display it. you do not fix it.
`,
      'Three states, and only one is final',
    ),
    table(
      ['State', 'What the UI says', 'What the system does'],
      [
        ['`INITIATED`', '"Sending…"', 'Nothing yet'],
        ['`PENDING`', '**"Checking with your bank"**', 'Poll with backoff. Never say success or failure'],
        ['`SUCCESS`', '"Paid"', 'Notify, settle rewards, update the mirror'],
        ['`FAILED`', '"Payment failed"', 'Notify. Expect a reversal if money moved'],
        ['`DEEMED_FAILED`', '"Failed — refund on the way"', 'Terminal after the window; reconcile'],
      ],
    ),
    warn(
      'Never show success on an unknown status, and never let a retry create a second payment. The app\'s job is to be **honest about uncertainty** — "checking with your bank" is a real, designed state, not a loading spinner.',
    ),

    h('Retry, safely'),
    table(
      ['Rule', 'Why'],
      [
        ['One transaction id per user intent', 'A retry is the same payment, not a new one'],
        ['Retry the **status query**, not the payment', 'The payment may already have succeeded'],
        ['Exponential backoff with a cap', 'Banks are slow under load; hammering makes it worse'],
        ['A hard terminal deadline', 'After it, mark deemed-failed and let reconciliation settle'],
        ['Block duplicate intent in the UI', 'Stop the user creating a genuinely new payment by tapping again'],
      ],
    ),
    tip(
      'The distinction in row two is the one candidates miss: **you retry the query, not the instruction.** Re-sending a payment instruction after a timeout is how a user gets charged twice.',
    ),

    h('What is genuinely yours'),
    table(
      ['Feature', 'Design note'],
      [
        ['**Transaction history**', 'A mirror, reconciled against the switch. Cheap to rebuild'],
        ['**Search and categorisation**', 'Enrichment on top of the mirror — merchant names, categories'],
        ['**Contacts and VPA cache**', 'Resolution is slow, so cache with a TTL and invalidate on failure'],
        ['**Rewards**', 'Yours entirely. Settle only on confirmed payments, and make issuance idempotent'],
        ['**Notifications**', 'Fan-out to both parties; fire only on a final state'],
        ['**Fraud signals**', 'Device, velocity, new-payee checks — before you send, not after'],
      ],
    ),
    p(
      'Rewards deserve care precisely because they are yours: a scratch card issued on a `PENDING` payment that later fails is **money you gave away for a transaction that did not happen**, and it will be found and exploited.',
    ),

    h('Scale'),
    table(
      ['Dimension', 'Order of magnitude', 'What breaks first'],
      [
        ['Users', 'Hundreds of millions', '—'],
        ['Transactions/day', 'Hundreds of millions', 'The bank partner and the switch, not you'],
        ['Peak TPS', 'Tens of thousands', 'Your outbound concurrency limits with the switch'],
        ['Pending transactions at any moment', 'Large during an outage', 'The poller — it must scale independently'],
        ['History rows', 'Tens of billions', 'Partition by user and time; archive cold data'],
        ['Notification fan-out', '2 per transaction', 'Trivial, but must be idempotent'],
      ],
    ),
    tip(
      'The poller is the component to size for the **bad** day, not the good one. When a large bank slows down, the pending set can grow by orders of magnitude within minutes, and that is exactly when it must not fall behind.',
    ),

    h('Failures'),
    table(
      ['What dies', 'Effect', 'Mitigation'],
      [
        ['A bank partner', 'Payments to that bank fail', 'Circuit-break it; say which bank, so the user can choose another'],
        ['The switch', 'No payments at all', 'Nothing you can do. Fail clearly and stop accepting intent'],
        ['Your poller', 'Transactions stuck pending', 'Serious — it is the only path to a final state. Replicate it'],
        ['Your mirror DB', 'No history; payments still work', 'The payment path must not depend on the mirror'],
        ['Notifications', 'Users are not told', 'They see it on open. Mildly bad, not incorrect'],
        ['Rewards service', 'No scratch cards', 'Queue and issue later. Never block a payment on it'],
      ],
    ),

    h('Interview'),
    quick([
      ['What it is', 'A payment app over a network it does not own'],
      ['The hard part', 'Representing an outcome you learn about last, and sometimes not at all'],
      ['Key decision', 'Treat your database as a mirror; poll to a terminal state; retry the query, not the payment'],
      ['Trade-off', 'Honest pending states cost user comfort and prevent double payments'],
      [
        '30-second answer',
        '"The app owns intent, identity and a mirror of transaction history — the bank owns the ledger and the switch owns the outcome. A payment goes out with one transaction id per user intent, and then the design is about uncertainty: pending is a real state shown honestly, a background poller chases every transaction to a terminal status with backoff and a deadline, and retries hit the status query rather than the payment instruction. Rewards and notifications settle only on final states."',
      ],
    ]),
    asked([
      ['What state does the app keep versus the switch?', 'Intent, identity and a mirror of history. The switch owns the outcome and the bank owns the ledger.'],
      ['How do you handle a pending payment?', 'Show it honestly, poll with backoff to a terminal state, and deem it failed after a deadline.'],
      ['How do you avoid double payments?', 'One transaction id per intent, and retry the status query rather than re-sending the instruction.'],
      ['When do you issue a reward?', 'Only on a confirmed final success, and idempotently. A pending payment can still fail.'],
      ['What if your database disagrees with the switch?', 'The switch is right. Your copy is a cache and gets reconciled.'],
    ]),

    interviewLevel('Google Pay'),
    links(
      wiki('Idempotence', 'Idempotence'),
      wiki('Unified_Payments_Interface', 'Unified Payments Interface'),
    ),
  ],
};
