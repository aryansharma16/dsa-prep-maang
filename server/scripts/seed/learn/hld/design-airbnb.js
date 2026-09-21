import { asked, diagram, flow, h, links, p, quick, table, tip, warn, wiki } from '../blocks.js';
import { interviewLevel } from './shapes.js';

export const doc = {
  blocks: [
    p(
      'A two-sided marketplace where the inventory is **a calendar, not a count**. You are not selling ten identical units of a phone; you are selling one specific room for one specific set of nights, and the same room for different nights is different inventory.',
    ),

    flow(['Search', 'Availability filter', 'Listing', 'Book', 'Payment', 'Confirmed'], 'Guest path'),
    diagram(
      `
   NORMAL INVENTORY            CALENDAR INVENTORY

   SKU: iphone                 listing #42
   stock: 1,000                 ┌──┬──┬──┬──┬──┬──┬──┐
                                │12│13│14│15│16│17│18│  June
   "is it available?"           ├──┼──┼──┼──┼──┼──┼──┤
     stock > 0 ?                │  │██│██│  │  │██│  │
                                └──┴──┴──┴──┴──┴──┴──┘
   one number.                        booked      booked

                               "available 14–17?"
                                 ALL of 14,15,16 free?
                                 ── a RANGE query, and
                                    the answer changes
                                    per query
`,
      'Why availability is the hard part',
    ),

    h('The pieces'),
    table(
      ['Piece', 'What it does', 'Why it is there'],
      [
        ['**Listing store**', 'Property details, photos, rules, host', 'Read-heavy, changes rarely, cached hard'],
        ['**Availability / calendar**', 'Per listing, per night: free, booked or blocked', 'The real inventory, and the contended resource'],
        ['**Pricing**', 'Per night, dynamic, with rules', 'A night is not one price; weekends and seasons differ'],
        ['**Search**', 'Geo + dates + guests + filters, ranked', 'Must filter on availability, which is the expensive part'],
        ['**Booking service**', 'Creates a reservation transactionally', 'The strongly consistent core'],
        ['**Messaging / reviews**', 'Two-sided communication and reputation', 'Both parties rate each other'],
        ['**Payments**', 'Charge guest now, pay host later', 'Escrow-shaped; money is held between the two events'],
      ],
    ),

    h('The hard part — searching on availability'),
    p(
      'Search must return only places free for the requested dates. Checking the calendar for millions of listings at query time is impossible; so is indexing every possible date range.',
    ),
    table(
      ['Approach', 'Verdict'],
      [
        ['Query the calendar per candidate', 'Correct, and far too slow for millions of listings'],
        ['Index every date range', 'Combinatorial explosion — a year has ~66,000 ranges'],
        ['**Index availability per night as a bitmap**', 'A range check becomes a bitwise AND over a few hundred bits'],
        ['**Filter geo + facets first, then availability**', 'Narrow to hundreds of candidates, then check exactly'],
      ],
    ),
    diagram(
      `
   TWO-STAGE, AND THE ORDER MATTERS

   stage 1  ──▶ geo + guests + price + filters   (indexed, fast)
                millions ──────────────▶ ~500 candidates

   stage 2  ──▶ availability for THESE dates     (exact, per candidate)
                ~500 ──────────────────▶ ~120 available

   stage 3  ──▶ rank                              (model)
                ~120 ─────────────────▶ top 20

   availability last, because it is the only filter that
   cannot be precomputed for an arbitrary date range.
`,
      'Cheap filters first, exact check last',
    ),
    tip(
      'A per-listing **availability bitmap** — one bit per night for the next two years, about 90 bytes — makes stage two almost free: "are nights 14–17 free" is a mask and an AND. It is the kind of answer that turns an impossible query into a trivial one.',
    ),

    h('The double-booking problem'),
    p(
      'Two guests book the same room for overlapping dates at the same moment. This is an **overlap constraint**, not a counter decrement, so the atomic-decrement trick from e-commerce does not apply.',
    ),
    table(
      ['Technique', 'How it works'],
      [
        ['**Exclusion constraint in the DB**', 'Postgres can reject any row whose date range overlaps an existing one — the database enforces it'],
        ['**Row-level lock on the listing**', 'Serialise bookings per listing. Contention is per property, so it is tiny'],
        ['**Insert per night**', 'One row per listing-night with a unique key; a conflict fails the transaction'],
        ['**Hold with a TTL**', 'Block the dates while the guest pays, release if they abandon'],
      ],
    ),
    warn(
      'Do not try to solve this in application code with a read-then-write. The correct answer is to **let the database enforce the constraint** — an exclusion constraint or a unique key per listing-night — because it is the only component that can see both transactions.',
    ),
    p(
      'Contention is naturally low: two people booking the same property for the same nights in the same second is rare. That is what makes a per-listing lock acceptable here, where the same approach on a flash-sale SKU would be a disaster.',
    ),

    h('Booking as a saga'),
    flow(['Hold dates', 'Authorise payment', 'Confirm booking', 'Notify host', 'Capture later'], 'Each step compensable'),
    table(
      ['Step', 'Compensate by'],
      [
        ['Hold dates', 'Release the hold on timeout'],
        ['Authorise payment', 'Void the authorisation, release the hold'],
        ['Confirm booking', 'Cancel and refund per policy'],
        ['Host declines (if not instant book)', 'Refund and release; suggest alternatives'],
      ],
    ),
    p(
      'Money is **authorised at booking and captured later** — often close to check-in. That gap is why the payment model is escrow-shaped rather than a simple charge, and why cancellation policy is a first-class part of the data model.',
    ),

    h('Scale'),
    table(
      ['Dimension', 'Order of magnitude', 'What breaks first'],
      [
        ['Listings', '~7M', 'Search index size — manageable'],
        ['Searches', 'Tens of thousands/s', 'The availability stage, without a bitmap'],
        ['Bookings', 'Hundreds/s', 'Low. Contention is per listing, so it is not a hot path'],
        ['Calendar rows', 'Listings × ~730 nights ≈ **5B**', 'The largest table; partition by listing'],
        ['Read:write ratio', 'Very high', 'Search dominates; booking is rare by comparison'],
      ],
    ),
    tip(
      'Note how gentle the write side is: **hundreds of bookings a second, spread across seven million listings.** Almost no two writes touch the same row, which is why strong consistency is affordable here and would not be on a flash sale.',
    ),

    h('Failures'),
    table(
      ['What dies', 'Effect', 'Mitigation'],
      [
        ['Search', 'Cannot discover listings', 'Replicated index; serve cached popular results'],
        ['Availability service', 'Search returns stale availability', 'Degrade to "check on the listing page"; the booking transaction is still exact'],
        ['Booking service', 'Cannot book', 'No safe degradation — this is the strongly consistent core'],
        ['Payment', 'Booking held but unpaid', 'The hold TTL releases it; retry or ask for another method'],
        ['Messaging', 'Guests and hosts cannot talk', 'Independent service; bookings unaffected'],
      ],
    ),

    h('Interview'),
    quick([
      ['What it is', 'A two-sided marketplace over calendar inventory'],
      ['The hard part', 'Searching on date availability, and never double-booking'],
      ['Key decision', 'Filter cheaply first and check availability last; let the DB enforce non-overlap'],
      ['Trade-off', 'A two-stage search may over-fetch candidates and keeps the query tractable'],
      [
        '30-second answer',
        '"Inventory is a calendar, not a count, so a date range is the query. Search filters on geo, guests and price first — all indexable — then checks availability exactly on a few hundred candidates, using a per-listing bitmap where a range check is a bitwise AND. Double booking is prevented by the database: an exclusion constraint on overlapping ranges, or a unique row per listing-night. Contention is per property and therefore tiny, so strong consistency is affordable here."',
      ],
    ]),
    asked([
      ['How do you prevent double bookings?', 'A database exclusion constraint on overlapping date ranges, or a unique key per listing-night. Not application code.'],
      ['How do you search by availability?', 'Filter on the cheap indexed attributes first, then check dates exactly on the surviving candidates.'],
      ['Why is a bitmap useful?', 'One bit per night makes "are these dates free" a mask and an AND — about 90 bytes for two years.'],
      ['Why is strong consistency affordable?', 'Bookings are rare per listing. Two writes almost never touch the same row.'],
      ['Why is payment authorised then captured?', 'Money is held between booking and check-in, so cancellation policy is part of the data model.'],
    ]),

    interviewLevel('Airbnb'),
    links(
      wiki('Two-sided_market', 'Two-sided market'),
      wiki('Bitmap_index', 'Bitmap index'),
    ),
  ],
};
