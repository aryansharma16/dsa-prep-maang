import { asked, diagram, flow, h, links, p, quick, table, tip, warn, wiki } from '../blocks.js';
import { interviewLevel } from './shapes.js';

export const doc = {
  blocks: [
    p(
      'E-commerce end to end. Browsing is an ordinary read-heavy web problem and the catalogue caches beautifully — **the interesting part starts at checkout**, where inventory must not oversell, payment must not double-charge, and the order has to survive the six services it passes through.',
    ),

    flow(['Browse', 'Cart', 'Checkout', 'Payment', 'Order', 'Fulfilment'], 'The funnel'),
    diagram(
      `
   READ PATH (99% of traffic)        WRITE PATH (the hard part)

   ┌──────────┐                      ┌──────────┐
   │  search  │──▶ index             │ checkout │
   └──────────┘                      └────┬─────┘
   ┌──────────┐                           │ reserve inventory
   │ product  │──▶ cache ──▶ DB           ▼
   │   page   │                      ┌──────────┐
   └──────────┘                      │ payment  │ idempotency key
   ┌──────────┐                      └────┬─────┘
   │  recos   │──▶ precomputed            │
   └──────────┘                           ▼
                                     ┌──────────┐
   cacheable, shardable,             │  order   │──▶ event
   embarrassingly scalable           └────┬─────┘
                                          ▼
                              ┌────────────────────────┐
                              │ SAGA: warehouse ▸ pack │
                              │  ▸ ship ▸ notify       │
                              │ each step compensable  │
                              └────────────────────────┘
`,
      'Two completely different problems',
    ),

    h('The pieces'),
    table(
      ['Piece', 'What it does', 'Why it is there'],
      [
        ['**Catalogue**', 'Products, prices, images', 'Read-mostly; cached at every layer'],
        ['**Search**', 'Query → products, with facets', 'An inverted index, not a `LIKE` query'],
        ['**Cart**', 'Per-user, short-lived, high write rate', 'Key-value store keyed by user; loss is survivable'],
        ['**Inventory**', 'How many of each item exist, where', 'The one store that must be strongly consistent'],
        ['**Payment**', 'Charges, refunds, idempotency', 'Money. Every call carries an idempotency key'],
        ['**Order**', 'The immutable record of what was agreed', 'The event that starts fulfilment'],
        ['**Fulfilment**', 'Warehouse, packing, shipping, tracking', 'A long-running saga across many systems'],
      ],
    ),
    tip(
      'Sorting stores by consistency requirement is the strongest opening move here: **cart is eventually consistent and cheap, inventory and payment are strongly consistent and expensive.** Treating them all the same is what makes designs either slow or wrong.',
    ),

    h('The hard part — not overselling the last item'),
    p(
      'Two customers, one unit in stock, both click buy within the same millisecond. A read-then-write is a race; a lock held across a payment gateway call is a disaster.',
    ),
    diagram(
      `
   WRONG                              RIGHT — reserve, then confirm

   read stock  (= 1)                  atomic conditional decrement:
   ...payment (3 seconds)...
   write stock (= 0)                    UPDATE inventory
        │                               SET available = available - 1
        ▼                               WHERE sku = ? AND available > 0
   both customers read 1                       │
   both write 0                                ▼ 0 rows = sold out
   ✗ two sold, one in stock            reservation created, TTL 15 min
                                               │
   OR: lock across payment                     ▼
        │                              payment succeeds ──▶ confirm
        ▼                              payment fails/expires
   ✗ one slow gateway blocks                   │
     every buyer of that SKU                   ▼
                                       reservation released,
                                       stock returns automatically
`,
      'A reservation with a TTL',
    ),
    table(
      ['Step', 'Guarantee'],
      [
        ['**Atomic conditional decrement**', 'The database decides the winner; no read-then-write race'],
        ['**Reservation with a TTL**', 'Stock is held only while checkout is live, then self-heals'],
        ['**Confirm on payment success**', 'The reservation becomes a real allocation'],
        ['**Release on failure or expiry**', 'An abandoned cart cannot hold stock forever'],
      ],
    ),
    warn(
      'Never hold a database lock across a third-party call. A payment gateway that takes eight seconds would serialise every purchase of that item behind it — and if the call hangs, the lock outlives the request.',
    ),

    h('Checkout as a saga'),
    flow(['Reserve stock', 'Charge card', 'Create order', 'Notify warehouse', 'Ship'], 'Each step compensable'),
    table(
      ['Step', 'If it fails, compensate by'],
      [
        ['Reserve inventory', 'Nothing yet — fail fast, show "out of stock"'],
        ['Charge payment', 'Release the reservation'],
        ['Create order', 'Refund the charge, release the reservation'],
        ['Notify warehouse', 'Retry — it is idempotent and must eventually succeed'],
        ['Ship', 'Forward-only. Problems become returns, not rollbacks'],
      ],
    ),
    p(
      'There is no distributed transaction across payment, inventory and the warehouse. **The saga is a sequence of local transactions with an undo for each**, and the later steps are forward-only because you cannot un-ship a parcel.',
    ),

    h('Idempotency, everywhere'),
    p(
      'The client retries; the network duplicates; the queue delivers twice. Every mutating call carries a client-generated **idempotency key**, and the service stores the result against that key so the second attempt returns the first answer instead of charging again.',
    ),

    h('Scale'),
    table(
      ['Dimension', 'Order of magnitude', 'What breaks first'],
      [
        ['Product page views', 'Millions/s at peak', 'Nothing — cached and CDN-fronted'],
        ['Search QPS', 'Hundreds of thousands', 'The index tier'],
        ['Cart writes', 'Very high', 'Key-value store; shard by user'],
        ['Checkouts', 'Thousands/s at peak', 'Inventory — the only strongly consistent hot path'],
        ['Catalogue size', 'Billions of SKUs', 'Index size; search is the constraint, not storage'],
      ],
    ),
    tip(
      'The ratio is the design: **millions of reads per second, thousands of writes.** Almost everything is cache, and the small strongly-consistent core is the only part that needs careful engineering.',
    ),

    h('When traffic spikes'),
    table(
      ['Event', 'What happens'],
      [
        ['Prime Day / a sale', 'Pre-scale everything; the date is known months ahead'],
        ['One product goes viral', 'Hot SKU — cache the page hard; inventory row becomes a hot key, so shard stock across buckets'],
        ['Checkout surge', 'Queue the post-payment saga; the synchronous path stays short'],
        ['Payment gateway slows', 'Circuit breaker, then fail over to a second acquirer'],
      ],
    ),

    h('Failures'),
    table(
      ['What dies', 'Effect', 'Mitigation'],
      [
        ['Recommendations', 'Generic product page', 'Fall back to best-sellers — degrade, never block the buy button'],
        ['Search', 'Cannot find products', 'Serious. Multi-replica; fall back to category browse'],
        ['Cart store', 'Carts lost', 'Replicate; also persist client-side as a backstop'],
        ['Payment', 'Cannot check out', 'Multiple acquirers; queue and retry authorised-but-unconfirmed orders'],
        ['Warehouse system', 'Orders accepted, shipping delayed', 'The saga waits. The customer already has their confirmation'],
      ],
    ),

    h('Interview'),
    quick([
      ['What it is', 'E-commerce: cached browse, strongly consistent checkout'],
      ['The hard part', 'Not overselling, and not double-charging, without a distributed transaction'],
      ['Key decision', 'Atomic reservation with a TTL; checkout as a compensable saga'],
      ['Trade-off', 'Reservations briefly under-sell inventory in exchange for never overselling'],
      [
        '30-second answer',
        '"Browse is read-heavy and caches everywhere — catalogue, search index, precomputed recommendations. Checkout is the real system. Inventory is an atomic conditional decrement that creates a reservation with a TTL, so a race has one winner and an abandoned cart self-heals. Payment carries an idempotency key so a retry cannot double-charge. After that it is a saga — order, warehouse, ship — with a compensating action per step, because there is no transaction spanning payment and a warehouse."',
      ],
    ]),
    asked([
      ['How do you stop two people buying the last item?', 'An atomic conditional decrement in the database, not a read-then-write. Zero rows affected means sold out.'],
      ['Why reservations with a TTL?', 'So stock is held during checkout but returns automatically if the customer disappears.'],
      ['Why not a distributed transaction?', '2PC across payment, inventory and a warehouse is slow and fragile. A saga with compensations is the practical answer.'],
      ['How do you avoid double-charging?', 'A client-supplied idempotency key; the payment service returns the stored result for a repeat.'],
      ['What is cached and what is not?', 'Everything on the browse path. Nothing on the inventory or payment path.'],
    ]),

    interviewLevel('Amazon'),
    links(wiki('Saga_pattern', 'Saga pattern'), wiki('Idempotence', 'Idempotence')),
  ],
};
