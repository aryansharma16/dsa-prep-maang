import { asked, diagram, flow, h, links, p, quick, table, tip, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Two reasons to run in more than one region: **users are far away, or losing one region is unacceptable.** Neither is a reason on its own to go multi-region — it roughly doubles cost and forces you to solve replication, which is the hardest problem in this track.',
    ),

    h('Start with the cheaper answers'),
    flow(['CDN', 'Edge compute', 'Read replica in region', 'Full multi-region'], 'In cost order'),
    table(
      ['Step', 'Fixes', 'Cost'],
      [
        ['**CDN**', 'Static latency — often most of the perceived problem', 'Low'],
        ['**Edge functions**', 'Auth checks, redirects, personalisation at the edge', 'Low'],
        ['**Read replica in region**', 'Read latency', 'Medium — one-way replication only'],
        ['**Full multi-region writes**', 'Write latency and regional failure', '**High — conflicts and coordination**'],
      ],
    ),
    tip(
      'A CDN plus a regional read replica solves the latency complaint for most read-heavy products. **The step people jump to — writes in every region — is the expensive one**, and it is only required when writes must succeed while a region is unreachable.',
    ),

    h('The physics you cannot argue with'),
    diagram(
      `
   round-trip times, and they are a floor

   within one AZ           ~0.5 ms
   between AZs             ~1-2 ms
   within a continent      ~20-40 ms
   across an ocean         ~80-150 ms

   speed of light in fibre ≈ 200,000 km/s
   Mumbai ──▶ Virginia ≈ 13,000 km ≈ 65 ms one way, minimum

   ──▶ a synchronous write to another continent costs 150 ms
       BEFORE the database does anything.

   ──▶ this is why cross-region writes are asynchronous, and
       why asynchronous means conflicts.
`,
      'Why cross-region consistency is expensive',
    ),

    h('Sorting your data'),
    p(
      'The whole design reduces to one exercise: **which data must be the same everywhere, and which does not.** Almost none of it does.',
    ),
    table(
      ['Category', 'Examples', 'Strategy'],
      [
        ['**Regional**', 'Posts, orders, sessions, media', 'Lives in the user\'s region; replicated elsewhere read-only'],
        ['**Global, read-mostly**', 'Product catalogue, config, feature flags', 'One writer, replicated everywhere'],
        ['**Global, must be consistent**', 'Identity, balances, unique usernames', '**Single writer, or consensus.** The expensive category'],
        ['**Derived**', 'Search indexes, caches, analytics', 'Rebuild per region from the source'],
      ],
    ),
    tip(
      'The third row is where the cost is, and it is usually tiny. **Identity, money and uniqueness** are a small fraction of the data — pin them to one region or a consensus store, and everything else becomes a regional problem with no coordination.',
    ),

    h('Routing users'),
    table(
      ['Mechanism', 'Granularity', 'Failover speed'],
      [
        ['**Geo / latency DNS**', 'Per resolver', 'TTL — minutes'],
        ['**Anycast**', 'Per network path', '**Seconds**'],
        ['**Global load balancer**', 'Per request', '**Seconds**'],
        ['**Client-side**', 'Per client', 'Immediate, and you must ship the logic'],
      ],
    ),
    warn(
      'Routing on **latency** is usually better than on geography. Network paths are not straight lines, and the nearest region by map is regularly not the fastest by measurement — particularly for users behind a provider that backhauls traffic.',
    ),

    h('Data gravity'),
    diagram(
      `
   the trap: routing without moving the data

   user (Mumbai) ──▶ app (Mumbai)   ← 5 ms.
                          │
                          ▼
                     database (Virginia)   ← 150 ms, EVERY query
                          │
                     8 queries per request
                          │
                          ▼
                     1,200 ms response

   the app moved. the data did not. this is SLOWER than
   serving everything from Virginia, because now there are
   eight cross-ocean round trips instead of one.

   ──▶ move the data, or do not move the app.
`,
      'The failure mode of a half-done migration',
    ),
    warn(
      'This is the single most common multi-region mistake, and it makes things **worse rather than better**. An application tier in a new region with its database still in the old one turns one long round trip into N of them.',
    ),

    h('What gets harder'),
    table(
      ['Concern', 'In one region', 'Across regions'],
      [
        ['Writes', 'One primary', 'Conflicts, or one region owns them'],
        ['Transactions', 'Normal', '**Effectively unavailable** across regions'],
        ['Unique constraints', 'A database constraint', 'A global service, or partitioned key space'],
        ['Caching', 'One cluster', 'Per region; invalidation must fan out'],
        ['Sessions', 'One store', 'Sticky to a region, or replicated'],
        ['Deploys', 'One rollout', 'Ordered, with version compatibility across regions'],
        ['Debugging', 'One set of logs', 'Correlated across regions'],
        ['Cost', 'Baseline', '**~2x, plus inter-region transfer**'],
      ],
    ),

    h('Interview'),
    quick([
      ['What it is', 'Running in more than one geographic region'],
      ['Why it exists', 'Latency for distant users, and surviving a region loss'],
      ['Use when', 'Users are genuinely far away, or availability demands it'],
      ['Trade-off', 'Roughly double the cost, and replication becomes your hardest problem'],
      [
        '30-second answer',
        '"Try the cheap answers first — a CDN and edge functions fix most latency complaints, and a regional read replica fixes read latency without any write coordination. Full multi-region is for when writes must survive a region loss. Then the exercise is sorting data: regional data stays local, and only identity, money and uniqueness need global consistency — which is a small fraction. Route on measured latency, and never move the app tier without moving its data."',
      ],
    ]),
    asked([
      ['When is multi-region worth it?', 'When users are far enough away that a CDN does not fix it, or losing a region is unacceptable.'],
      ['What is the cheaper first step?', 'A CDN, then edge compute, then a read replica in the region. Write coordination is the expensive part.'],
      ['Does all data need to be global?', 'Almost none. Only identity, money and uniqueness constraints; everything else can be regional.'],
      ['What is data gravity?', 'Moving the app tier without its data turns one cross-ocean round trip into one per query.'],
      ['Geo routing or latency routing?', 'Latency. Network paths are not straight lines and the nearest region is often not the fastest.'],
    ]),

    links(wiki('Geo-replication', 'Geo-replication'), wiki('Anycast', 'Anycast')),
  ],
};
