import { asked, diagram, flow, h, links, p, quick, table, tip, warn, wiki } from '../blocks.js';
import { interviewLevel } from './shapes.js';

export const doc = {
  blocks: [
    p(
      'A payment gateway sits between a merchant and the banking system. It does three jobs a merchant does not want to do: **route a payment to whichever acquirer will accept it, keep a ledger that always balances, and tell the merchant what happened** — reliably enough that they can ship an order on the strength of it.',
    ),

    flow(['Customer', 'Merchant site', 'Gateway', 'Acquirer / network', 'Issuer bank'], 'Authorisation path'),
    diagram(
      `
   ┌──────────┐   order    ┌──────────┐
   │ merchant │───────────▶│ gateway  │
   └──────────┘            └────┬─────┘
        ▲                       │ route by method, cost,
        │                       │ success rate, health
        │                       ▼
        │                 ┌───────────┐
        │                 │ acquirer  │──▶ card network ──▶ issuer
        │                 │ (A, B, C) │──▶ UPI switch
        │                 └─────┬─────┘──▶ netbanking
        │                       │
        │    WEBHOOK            ▼
        └───────────────── outcome
             at-least-once,
             signed, retried

   the webhook is the product. a merchant ships goods on it.
`,
      'Route in, notify out',
    ),

    h('The pieces'),
    table(
      ['Piece', 'What it does', 'Why it is there'],
      [
        ['**Payment API**', 'Creates a payment intent for a merchant order', 'The merchant-facing contract'],
        ['**Checkout**', 'Hosted UI collecting card or UPI details', 'Keeps card data out of the merchant\'s systems entirely'],
        ['**Routing engine**', 'Chooses an acquirer per transaction', 'Success rate, cost and health differ per acquirer and per bank'],
        ['**Vault / tokenisation**', 'Stores card tokens, never raw PANs', 'Compliance, and it enables saved cards'],
        ['**Ledger**', 'Double-entry record of every movement', 'The authoritative financial truth'],
        ['**Webhook service**', 'Delivers outcomes to merchants', 'At-least-once, signed, retried with backoff'],
        ['**Settlement**', 'Pays merchants on a schedule, net of fees', 'Money arrives from acquirers in batches, not per payment'],
        ['**Reconciliation**', 'Matches acquirer files to the ledger', 'Catches everything the real-time path got wrong'],
      ],
    ),

    h('Smart routing'),
    p(
      'Not every acquirer succeeds equally. A specific issuer bank may be failing 30% of transactions through acquirer A and 2% through acquirer B — **and that changes hour to hour.** Routing on live success rates is a large part of a gateway\'s value.',
    ),
    table(
      ['Signal', 'What it does'],
      [
        ['Live success rate per acquirer × issuer × method', 'The primary routing input'],
        ['Cost per transaction', 'Acquirers charge differently; route cheap when quality is equal'],
        ['Health / circuit breaker', 'Take a failing acquirer out of rotation automatically'],
        ['Retry on a different acquirer', 'A soft decline through A may succeed through B'],
        ['Merchant preference', 'Contracts and settlement terms sometimes override the optimiser'],
      ],
    ),
    warn(
      'Retrying a declined payment through another acquirer is only safe for **soft declines** — timeouts and technical failures. Retrying a hard decline (insufficient funds, stolen card) is at best useless and at worst fraud-adjacent.',
    ),

    h('The hard part — webhooks that must not be missed'),
    p(
      'A merchant ships a phone because your webhook said the payment succeeded. If it never arrives, they lose a sale; if it arrives twice and they do not handle it, they ship twice.',
    ),
    diagram(
      `
   EXACTLY-ONCE DELIVERY DOES NOT EXIST.
   so: AT-LEAST-ONCE + IDEMPOTENT CONSUMER.

   outcome ──▶ ┌──────────┐
               │  outbox  │  written in the SAME transaction
               │  (in DB) │  as the ledger entry
               └────┬─────┘
                    │  no dual-write problem
                    ▼
               ┌──────────┐
               │ deliverer│  POST, signed with HMAC
               └────┬─────┘
                    │  2xx? done.
                    │  else: retry 1m, 5m, 30m, 2h, 6h, 24h
                    ▼
               ┌──────────┐
               │   DLQ    │  after N attempts → alert + a
               └──────────┘  polling API the merchant can call

   every webhook carries an EVENT ID.
   the merchant stores it and ignores repeats.
`,
      'Outbox, sign, retry, and give them a fallback',
    ),
    table(
      ['Guarantee', 'How'],
      [
        ['**Never lost**', 'Outbox written in the same transaction as the state change'],
        ['**Retried**', 'Exponential backoff over hours, then a dead-letter queue'],
        ['**Authentic**', 'HMAC signature over the body with a per-merchant secret'],
        ['**Deduplicable**', 'A stable event id the merchant keys on'],
        ['**Ordered enough**', 'Events carry a sequence; late arrivals are detectable'],
        ['**Recoverable**', 'A polling API, because some merchants will always miss webhooks'],
      ],
    ),
    tip(
      'The outbox is the detail worth naming. Writing "payment succeeded" to the database and *then* publishing an event is a dual write — **a crash between them loses the notification silently.** Writing both in one transaction removes the gap entirely.',
    ),

    h('The ledger'),
    p(
      'Double-entry, append-only, immutable. Every movement is two entries that sum to zero, nothing is ever updated or deleted, and a correction is a **new reversing entry** rather than an edit.',
    ),
    table(
      ['Rule', 'Why'],
      [
        ['Double entry', 'Every debit has a credit; the books always balance or you have a bug'],
        ['Append-only', 'An auditor must be able to replay history exactly'],
        ['Corrections are new entries', 'Never mutate the past — reverse it and re-post'],
        ['Balances are derived', 'Computed from entries, snapshotted for speed'],
        ['Idempotent posting', 'The same event posted twice must not move money twice'],
      ],
    ),

    h('Refunds and settlement'),
    flow(['Capture', 'Hold period', 'Net of fees', 'Payout to merchant', 'Reconcile'], 'Money out'),
    table(
      ['Concept', 'Detail'],
      [
        ['**Authorise vs capture**', 'Authorisation reserves; capture takes. Some flows separate them by days'],
        ['**Refund**', 'Forward-only — a new transaction, not an undo. May outlive the original settlement'],
        ['**Settlement**', 'Batched on a schedule, net of fees and refunds'],
        ['**Chargeback**', 'The customer disputes weeks later; money is clawed back from the merchant'],
        ['**Reserve**', 'A held percentage, because chargebacks arrive after payout'],
      ],
    ),

    h('Scale'),
    table(
      ['Dimension', 'Order of magnitude', 'What breaks first'],
      [
        ['Transactions/day', 'Tens of millions', 'Acquirer capacity, usually before yours'],
        ['Peak TPS', 'Thousands, spiking on sale events', 'The slowest acquirer on the route'],
        ['Webhook deliveries', '2–5 per payment', 'The deliverer, when a merchant endpoint is down'],
        ['Ledger entries', 'Billions, append-only', 'Storage and query time; partition by time'],
        ['Reconciliation files', 'Millions of rows nightly', 'Must finish before the next settlement run'],
      ],
    ),

    h('Failures'),
    table(
      ['What dies', 'Effect', 'Mitigation'],
      [
        ['One acquirer', 'Its share of payments fails', 'Circuit-break and route around it — the core value of multi-acquirer'],
        ['All acquirers for a method', 'That method is down', 'Offer another method in checkout rather than failing the sale'],
        ['Webhook deliverer', 'Merchants are not notified', 'Outbox retains everything; drains on recovery. Plus the polling API'],
        ['A merchant endpoint', 'Their webhooks pile up', 'Backoff, DLQ, alert them — not your outage'],
        ['Ledger', 'Cannot record money movement', 'Stop accepting payments. Never take money you cannot record'],
        ['Reconciliation', 'Discrepancies go unnoticed', 'Alert on a missed run; it is a correctness control'],
      ],
    ),
    warn(
      'That fifth row is the rule that separates payments from every other system on this list: **if you cannot record it, do not do it.** Accepting money you have no ledger entry for is worse than rejecting the payment.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'A gateway: routing, a ledger, and merchant notification'],
      ['The hard part', 'Webhook delivery a merchant can ship goods on'],
      ['Key decision', 'Transactional outbox + at-least-once signed retries + idempotent consumers'],
      ['Trade-off', 'At-least-once means duplicates, pushed onto the merchant as an event id to dedupe'],
      [
        '30-second answer',
        '"Three jobs. Routing picks an acquirer per transaction on live success rate, cost and health, with a circuit breaker and soft-decline retries elsewhere. The ledger is double-entry and append-only — corrections are reversing entries, and nothing is accepted that cannot be recorded. Webhooks are the product: written to an outbox in the same transaction as the state change, signed, retried into a DLQ, carrying an event id so merchants dedupe — plus a polling API."',
      ],
    ]),
    asked([
      ['How do you guarantee webhook delivery?', 'You cannot guarantee exactly-once. Outbox plus at-least-once with retries, an event id, and a polling fallback.'],
      ['What is the outbox pattern for?', 'It removes the dual-write gap — the state change and the event are written in one transaction.'],
      ['Why multiple acquirers?', 'Success rates vary by issuer and change hourly, and one acquirer failing should not stop payments.'],
      ['Why is the ledger append-only?', 'Auditability. A correction is a reversing entry, so history can be replayed exactly.'],
      ['Is it safe to retry a decline elsewhere?', 'Only soft declines — timeouts and technical errors. Never insufficient funds or a stolen card.'],
    ]),

    interviewLevel('Razorpay'),
    links(
      wiki('Double-entry_bookkeeping', 'Double-entry bookkeeping'),
      wiki('Webhook', 'Webhook'),
    ),
  ],
};
