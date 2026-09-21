import { asked, diagram, flow, h, links, p, quick, scaleTable, table, tip, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'You do not know what your system can take until you have broken it deliberately. **Load testing finds the knee in the curve; capacity planning puts you a safe distance below it**; cost work decides how much that distance is worth.',
    ),

    h('The four kinds of test'),
    table(
      ['Test', 'Asks', 'Shape'],
      [
        ['**Load**', 'Does it meet SLOs at expected peak?', 'Ramp to target, hold'],
        ['**Stress**', '**Where does it break, and how?**', 'Ramp until failure'],
        ['**Soak**', 'Does it survive 24 hours?', 'Moderate load, long duration'],
        ['**Spike**', 'Does it survive a step change?', 'Instant 10x, then drop'],
      ],
    ),
    tip(
      'Stress testing is the one most teams skip and the one that teaches most. **How a system fails matters more than when** — graceful degradation versus a cascade is the difference between a slow hour and an outage, and you only find out by pushing past the limit.',
    ),

    h('The knee'),
    diagram(
      `
   throughput                        latency
      │                                 │
      │      ╭────────╮                 │              ╱
      │     ╱          ╲                │             ╱
      │    ╱            ╲               │            ╱
      │   ╱              ╲              │      ─────╯
      │  ╱                ╲             │  ────
      └─┴──────┴──────┴────┴──▶ load    └─────┴──────┴──▶ load
             KNEE    limit                   KNEE

   BEFORE the knee   throughput rises, latency flat
   AT the knee       the usable ceiling
   AFTER the knee    latency climbs, throughput FALLS
                     (queueing, contention, retries, thrashing)

   ──▶ capacity planning targets ~50-70% of the knee,
       not 95%. the headroom is for the spike you did
       not predict and the node you just lost.
`,
      'Throughput can go down',
    ),
    warn(
      'Past the knee **throughput gets worse, not just latency.** Time goes into queueing and context switching, timeouts trigger retries, retries add load — a system pushed 20% past its limit can deliver less than half its peak throughput.',
    ),

    h('Testing it honestly'),
    table(
      ['Do', 'Because'],
      [
        ['Test against production-like infrastructure', 'A half-size environment finds half-size problems'],
        ['Use realistic data volumes', 'Queries on 1,000 rows behave nothing like on 100 million'],
        ['Mirror the real traffic mix', 'Not 100% of the cheapest endpoint'],
        ['Include the cold-start path', 'Empty caches are the realistic worst case'],
        ['Ramp, do not step', 'A step measures your ramp, not your ceiling'],
        ['Watch dependencies too', 'You may break a third party and find out from them'],
      ],
    ),
    warn(
      'Load testing production dependencies you do not own — payment gateways, SMS providers, partner APIs — is a real way to be **rate-limited or suspended**. Stub them, or arrange it with them first.',
    ),

    h('Capacity planning'),
    flow(['Measure per-instance capacity', 'Project peak', 'Apply headroom', 'Plan for failure', 'Recheck'], 'A repeated loop'),
    diagram(
      `
   1. one instance serves          ~1,000 req/s at SLO
   2. expected peak                 50,000 req/s
   3. instances needed              50
   4. headroom, target 60%          83
   5. survive losing one AZ of 3    125
   6. round up                      130

   that last two steps are the ones people forget.
   "enough for peak" means zero spare when a zone goes away
   at the same moment as the peak — which is exactly when
   zones go away.
`,
      'The arithmetic, with the two forgotten steps',
    ),
    scaleTable([
      ['**Predictable daily peak**', 'Scheduled scaling', 'The shape is known to the minute'],
      ['**A known event**', 'Pre-scale hours ahead', 'Autoscaling is too slow for the ramp'],
      ['**Gradual growth**', 'Autoscaling plus a monthly review', 'Capacity follows demand'],
      ['**Unpredictable spikes**', 'Headroom, plus load shedding', 'You cannot provision for the unknown'],
      ['**A zone or region loss**', 'N+1 across failure domains', 'Failure and peak coincide'],
    ]),

    h('Cost versus performance'),
    table(
      ['Lever', 'Saves', 'Costs'],
      [
        ['**Right-sizing**', '20–50%, commonly', 'Measurement work; the usual first win'],
        ['**Reserved / committed capacity**', '30–70%', 'A commitment, and less flexibility'],
        ['**Spot instances**', '60–90%', 'Can be reclaimed — fine for workers, not for state'],
        ['**Caching harder**', 'Origin compute and egress', 'Staleness'],
        ['**Storage tiering**', 'Most of a storage bill', 'Slow retrieval for cold data'],
        ['**A CDN**', 'Egress, which is often the largest line', 'Cache management'],
        ['**Autoscaling down**', 'Off-peak spend', 'Cold-start risk on the next spike'],
      ],
    ),
    tip(
      'Right-sizing is almost always the biggest available saving and the least interesting work. **Most fleets are provisioned from a guess made once** and never revisited — measuring actual utilisation and resizing typically removes a third of the bill before any architecture changes.',
    ),

    h('What to measure per instance'),
    table(
      ['Metric', 'Tells you'],
      [
        ['Requests/second at SLO', 'The number capacity planning multiplies'],
        ['Saturation', 'How close to the knee you currently are'],
        ['Cost per request', 'Whether an optimisation is worth engineering time'],
        ['Warm-up duration', 'How much headroom the spike case needs'],
        ['Utilisation at trough', 'Whether off-peak scaling is worth it'],
      ],
    ),

    h('Interview'),
    quick([
      ['What it is', 'Finding the limit deliberately, then staying a safe distance from it'],
      ['Why it matters', 'Capacity is a number you measure, not one you assume'],
      ['Use when', 'Before a known event, and whenever "how many servers?" is asked'],
      ['Trade-off', 'Headroom costs money and buys surviving the unplanned'],
      [
        '30-second answer',
        '"Ramp load until it breaks to find the knee, where latency climbs and throughput actually falls. Plan capacity at about 60% of that, then add enough to survive losing a failure domain — because a zone going away and peak traffic coincide. Test on production-like infrastructure with production-like data, include the cold-cache path, and stub third parties so you do not get rate-limited. On cost, right-sizing usually beats every architectural change and is the least interesting work."',
      ],
    ]),
    asked([
      ['How do you find the breaking point?', 'A stress test — ramp until SLOs fail, and watch how it fails, not just when.'],
      ['Why does throughput fall past the knee?', 'Queueing and contention consume time, and timeouts cause retries that add load.'],
      ['How much headroom should you keep?', 'Target around 60% of the knee, plus enough to lose a failure domain at peak.'],
      ['How do you plan for a known spike?', 'Pre-scale hours ahead. Autoscaling takes a minute or two to be useful.'],
      ['What is the biggest cost saving?', 'Right-sizing, usually. Most fleets are provisioned from a guess and never rechecked.'],
    ]),

    links(
      wiki('Load_testing', 'Load testing'),
      wiki('Capacity_planning', 'Capacity planning'),
    ),
  ],
};
