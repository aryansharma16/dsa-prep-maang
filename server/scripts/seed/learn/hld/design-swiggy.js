import { asked, diagram, flow, h, links, p, quick, table, tip, warn, wiki } from '../blocks.js';
import { interviewLevel } from './shapes.js';

export const doc = {
  blocks: [
    p(
      'Food delivery is Uber with a third party in the middle. Uber matches two entities; this matches three — **customer, restaurant and delivery partner** — and the restaurant is the one you do not control, cannot scale, and whose cooking time you can only estimate.',
    ),

    flow(['Discover', 'Order', 'Restaurant accepts', 'Assign partner', 'Pickup', 'Deliver'], 'Order lifecycle'),
    diagram(
      `
   THREE CLOCKS THAT MUST MEET

   restaurant  │──── accept ────│─── cooking 18 min ───│ ready
                                                        │
   partner     │       idle     │─ assigned ─│─ riding ─│ arrives
                                             ▲          │
                                             │          ▼
                                    assign LATE on      pickup
                                    purpose, so the     │
                                    partner is not      ▼
                                    waiting             deliver

   assign too early ──▶ partner idles at the restaurant (costly)
   assign too late  ──▶ food sits and goes cold (worse)

   the whole optimisation is predicting "ready at" correctly.
`,
      'The scheduling problem underneath',
    ),

    h('The pieces'),
    table(
      ['Piece', 'What it does', 'Why it is there'],
      [
        ['**Discovery**', 'Restaurants near me, open, delivering here', 'Geo query plus availability — read-heavy and cacheable'],
        ['**Menu service**', 'Items, prices, stock-outs', 'Changes during service; cached with a short TTL'],
        ['**Order service**', 'The order state machine', 'The authoritative record; strongly consistent'],
        ['**Restaurant app**', 'Accept, mark ready', 'The human in the loop, and the source of the biggest delays'],
        ['**Assignment engine**', 'Picks a delivery partner, timed to readiness', 'The optimisation problem in the middle'],
        ['**Tracking**', 'Partner location → customer map', 'Same geo pipeline as Uber, lower write rate'],
        ['**ETA service**', 'Predicts prep time and travel time', 'Feeds both the promise and the assignment timing'],
      ],
    ),

    h('Discovery — a geo query with filters'),
    p(
      'Unlike Uber, the supply side barely moves. Restaurants are **static points**, so their geo index can be precomputed and cached per delivery zone rather than rebuilt from a location stream.',
    ),
    table(
      ['Filter', 'Why it is not just distance'],
      [
        ['Serviceability', 'Is this address inside that restaurant\'s delivery polygon?'],
        ['Open now', 'Opening hours, plus a manual "too busy" switch'],
        ['Partner availability', 'No riders in the zone means nothing can be delivered'],
        ['Menu availability', 'Half the menu sold out is effectively closed'],
        ['Rain / surge', 'Zones get switched off dynamically under load'],
      ],
    ),
    tip(
      'Because restaurants do not move, the **entire home feed for a zone can be precomputed** — ranked, cached, and invalidated only when a restaurant opens, closes or runs out. That is why the app opens instantly.',
    ),

    h('The hard part — assignment timing'),
    flow(['Predict ready-at', 'Find candidates', 'Rank', 'Offer', 'Batch if possible'], 'The assignment loop'),
    table(
      ['Input', 'What it contributes'],
      [
        ['**Predicted prep time**', 'Per restaurant, per item, per hour of day — a model, not a constant'],
        ['**Partner ETA to restaurant**', 'Routing distance, traffic, mode of transport'],
        ['**Current load**', 'How many orders that restaurant already has cooking'],
        ['**Batching potential**', 'Two orders from the same restaurant going the same way'],
        ['**Partner state**', 'Already carrying an order, and how far along'],
      ],
    ),
    p(
      'Batching is where the economics live. **Two deliveries on one trip roughly halves the cost per order** — so the engine is willing to make one customer wait a few extra minutes to pair their order with another going the same way. That trade is a business decision expressed as a weight in the ranking function.',
    ),
    warn(
      'The restaurant is not under your control. It can accept an order and start cooking twenty minutes later, or never mark it ready. The design must **tolerate a partner in the loop that has no SLA** — which means timeouts, reassignment, and predicted rather than reported readiness.',
    ),

    h('Order state machine'),
    diagram(
      `
   PLACED ──▶ ACCEPTED ──▶ PREPARING ──▶ READY ──▶ PICKED_UP ──▶ DELIVERED
      │           │                                    │
      │           │                                    └──▶ (no way back)
      ▼           ▼
   REJECTED   CANCELLED ──▶ refund saga

   every transition:
     ▸ is idempotent            (the app retries on a flaky network)
     ▸ emits an event           (tracking, notifications, analytics)
     ▸ is append-only in a log  (disputes need the full history)
`,
      'One order, one authoritative machine',
    ),
    p(
      'Money and food both move here, so the order store is the strongly consistent core — but **every transition emits an event**, and everything downstream (customer notifications, partner app, analytics, the restaurant dashboard) is an eventually consistent consumer of that stream.',
    ),

    h('Scale'),
    table(
      ['Dimension', 'Order of magnitude', 'What breaks first'],
      [
        ['Orders/day', 'Millions → hundreds/s, thousands at peak', 'Assignment, which is CPU-heavy optimisation'],
        ['Peak shape', '**Two sharp peaks a day**', 'Lunch and dinner; capacity is scheduled, not reactive'],
        ['Discovery QPS', 'Tens of thousands', 'Nothing — precomputed and cached per zone'],
        ['Partner location pings', 'Far lower than Uber', 'Fewer partners, and only while on a trip'],
        ['Restaurants', '~hundreds of thousands', 'Menu freshness, not scale'],
      ],
    ),
    tip(
      'The daily double peak is the operational shape worth naming: traffic is **predictable to the minute**, so this is a pre-scaling problem rather than an autoscaling one — and there is a long quiet stretch overnight to run batch work in.',
    ),

    h('Failures'),
    table(
      ['What dies', 'Effect', 'Mitigation'],
      [
        ['Assignment engine', 'Orders accepted, no partner assigned', 'Queue them; fall back to nearest-available instead of optimal'],
        ['ETA model', 'Bad promises and bad timing', 'Fall back to a per-restaurant historical average'],
        ['Restaurant app offline', 'Order not accepted', 'Timeout, auto-cancel and refund, or route to a call centre'],
        ['Tracking', 'No live map', 'Cosmetic — show the status text instead'],
        ['Payment', 'Cannot place orders', 'Retry, second acquirer, or allow cash on delivery'],
        ['Order service', 'Total outage', 'The one component with no graceful degradation. Replicate hard'],
      ],
    ),

    h('Interview'),
    quick([
      ['What it is', 'Three-sided marketplace: customer, restaurant, delivery partner'],
      ['The hard part', 'Assigning a partner to arrive exactly when the food is ready'],
      ['Key decision', 'Precomputed zone-level discovery; assignment driven by a prep-time prediction'],
      ['Trade-off', 'Batching cuts cost per delivery and costs some customers a few minutes'],
      [
        '30-second answer',
        '"Discovery is a geo query over static restaurant points, so it is precomputed and cached per zone. The order is a strongly consistent state machine emitting an event per transition, and everything downstream consumes that stream. Assignment is the hard part: predict when food will be ready, then pick a partner whose ETA lands at that moment — too early they idle, too late the food is cold. Batching two orders on one trip is where the economics are."',
      ],
    ]),
    asked([
      ['How is this different from Uber?', 'Three parties instead of two, and the restaurant is a dependency with no SLA whose prep time you must predict.'],
      ['How do you assign a partner?', 'Predict ready-at, find nearby partners, rank on ETA and batching potential, offer with a timeout.'],
      ['Why not assign immediately?', 'The partner would idle at the restaurant. Assignment is timed to predicted readiness.'],
      ['How does discovery scale?', 'Restaurants do not move, so the ranked feed per zone is precomputed and cached.'],
      ['What is the traffic shape?', 'Two sharp daily peaks. Predictable, so you pre-scale rather than autoscale.'],
    ]),

    interviewLevel('Swiggy'),
    links(
      wiki('Vehicle_routing_problem', 'Vehicle routing problem'),
      wiki('Geohash', 'Geohash'),
    ),
  ],
};
