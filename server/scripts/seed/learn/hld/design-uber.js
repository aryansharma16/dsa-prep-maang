import { asked, diagram, flow, h, links, p, quick, table, tip, warn, wiki } from '../blocks.js';
import { interviewLevel } from './shapes.js';

export const doc = {
  blocks: [
    p(
      'Matching riders to drivers in real time. Two things make it hard: **every driver reports their position every few seconds**, which is a write rate no ordinary database survives, and "find the nearest available driver" is a query no `WHERE` clause can answer.',
    ),

    flow(['Driver app', 'Location ingest', 'Geo index', 'Matching', 'Rider app', 'Trip service'], 'The loop'),
    diagram(
      `
   LOCATION FIRE-HOSE                  MATCHING

   1M drivers × every 4s               rider requests a ride
        = 250,000 writes/sec                  │
             │                                ▼
             ▼                          ┌───────────┐
      ┌─────────────┐                   │ find cell │ geohash/H3 of
      │  in-memory  │◀──────────────────│ + rings   │ the pickup point
      │  geo index  │   "who is near?"  └─────┬─────┘
      │  (sharded   │                         │
      │   by cell)  │                         ▼
      └──────┬──────┘                   ┌───────────┐
             │                          │ candidates│ ~20 drivers
             │ sampled                  └─────┬─────┘
             ▼                                ▼
      ┌─────────────┐                   ┌───────────┐
      │ durable log │  history,         │   rank    │ ETA, rating,
      │  (Kafka)    │  analytics,       │           │ utilisation
      └─────────────┘  billing          └─────┬─────┘
                                              ▼
                                        offer ──▶ accept ──▶ TRIP
   the hot path never touches disk.
`,
      'Two paths from one stream',
    ),

    h('The pieces'),
    table(
      ['Piece', 'What it does', 'Why it is there'],
      [
        ['**Location ingest**', 'Accepts pings over a persistent connection', 'HTTP per ping would be mostly handshake overhead'],
        ['**Geo index**', 'In-memory, sharded by geographic cell', 'The current position of every driver, queryable by area'],
        ['**Durable log**', 'Every ping, for history and billing', 'Separate from the hot path — different durability needs'],
        ['**Matching service**', 'Candidate search plus ranking', 'The core loop; must answer in a couple of seconds'],
        ['**Trip service**', 'Trip state machine, strongly consistent', 'A trip has one driver, and money depends on its states'],
        ['**Pricing**', 'Surge from supply/demand per cell', 'Computed per cell on a short interval'],
      ],
    ),
    tip(
      'The split in that diagram is the key insight: **current location is hot, ephemeral and in memory; location history is cold, durable and on disk.** Trying to serve both from one store is what makes naive designs fall over.',
    ),

    h('The hard part — geospatial indexing'),
    p(
      'A B-tree on `(lat, lng)` cannot answer "within 2km" — it orders on one dimension at a time. The standard answer is to **turn two dimensions into one** by cutting the world into cells with a string or integer id.',
    ),
    diagram(
      `
   GEOHASH / H3 — the world as addressable cells

   ┌─────┬─────┬─────┐     "nearest drivers to ●"
   │ tdr │ tds │ tdt │
   ├─────┼─────┼─────┤     1. compute the cell of ●     ──▶ "tdr1y"
   │ tdq │ tdr1│ tdu │     2. look up that cell         ──▶ 8 drivers
   │     │  ●  │     │     3. not enough? add the ring  ──▶ 8 neighbours
   ├─────┼─────┼─────┤     4. still not enough? widen
   │ tdm │ tdp │ tdv │
   └─────┴─────┴─────┘     a prefix is a bounding box:
                           "tdr1*" = everything in that cell
   longer id = smaller cell
   so precision is a substring
`,
      'Two dimensions into one sortable key',
    ),
    table(
      ['Structure', 'How it works', 'Trade-off'],
      [
        ['**Geohash**', 'Interleave lat/lng bits into a base-32 string', 'Simple, prefix-searchable; cells are not equal-area'],
        ['**H3 / S2**', 'Hexagonal or spherical cell hierarchy', 'Uniform neighbours and better area behaviour; more machinery'],
        ['**Quadtree**', 'Recursively subdivide until a cell is sparse', 'Adapts to density — dense cities get finer cells'],
        ['**PostGIS / R-tree**', 'A real spatial index in the database', 'Correct and convenient; not at 250k writes/sec'],
      ],
    ),
    warn(
      'Cells have edges, and the nearest driver is often **just across one**. Always search the surrounding ring, not only the containing cell — a match that ignores a driver 50m away because they are in the next cell is the classic bug in this design.',
    ),

    h('Sharding by geography'),
    p(
      'Rides are local: a rider in Mumbai is never matched with a driver in Delhi. That makes **geography a near-perfect shard key** — each city or region is an independent system with its own index, matching loop and pricing.',
    ),
    table(
      ['Benefit', 'Why'],
      [
        ['Natural isolation', 'A Mumbai outage does not touch Bengaluru'],
        ['Bounded index size', 'Each shard holds one city\'s drivers, not the world\'s'],
        ['Local latency', 'Run the shard in a region close to the city'],
        ['No cross-shard queries', 'The one thing sharding usually costs, and here it simply does not arise'],
      ],
    ),
    tip(
      'Say this out loud: **"rides are inherently local, so I would shard by city."** It disposes of most of the usual sharding objections in one sentence, and it is genuinely why this domain scales well.',
    ),

    h('The matching loop'),
    flow(['Request', 'Candidate cells', 'Filter available', 'Rank by ETA', 'Offer', 'Accept or next'], '~2 seconds'),
    table(
      ['Stage', 'Detail'],
      [
        ['Candidates', 'Cell plus ring; widen until enough or the radius cap is hit'],
        ['Filter', 'Available, right vehicle class, not mid-trip, not on a break'],
        ['Rank', 'ETA by road distance — not straight-line — plus rating and utilisation'],
        ['Offer', 'To one driver at a time, with a short timeout, or to a small batch'],
        ['Lock', 'The offered driver is held so two riders cannot be matched to them'],
        ['Fallback', 'No match in the radius → widen, raise surge, or decline honestly'],
      ],
    ),
    warn(
      'Straight-line distance is wrong in a city. A driver 200m away **across a river** is twenty minutes from you. Ranking has to use routing-engine ETA, which is why the matching service depends on a road-graph service.',
    ),

    h('Scale'),
    table(
      ['Dimension', 'Order of magnitude', 'What breaks first'],
      [
        ['Active drivers', '~1M concurrent globally', '—'],
        ['Location writes', '**~250k/s**', 'Any disk-backed store; hence in-memory'],
        ['Ride requests', '~1–5k/s', 'Matching, which is CPU work per request'],
        ['Trips in flight', 'Millions', 'Trip state store; sharded by city'],
        ['Geo index memory', 'Drivers × small record', 'Trivial per city — it is the write rate that hurts'],
      ],
    ),

    h('Failures'),
    table(
      ['What dies', 'Effect', 'Mitigation'],
      [
        ['Geo index shard', 'That city cannot match', 'Replicated; rebuild from the ping stream in seconds — it is derived data'],
        ['Location ingest', 'Positions go stale', 'Clients buffer and resend; matching widens its staleness tolerance'],
        ['Matching service', 'No new rides; trips in progress continue', 'Stateless and horizontally scaled'],
        ['Trip service', 'Serious — trips cannot change state', 'The one strongly consistent store; replicated with failover'],
        ['Routing/ETA service', 'Worse ranking', 'Fall back to straight-line distance and say ETAs are approximate'],
      ],
    ),
    p(
      'Note which is which: **the geo index can be thrown away and rebuilt, the trip store cannot.** Sorting components by whether their data is derived or authoritative is what tells you where to spend the reliability budget.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'Real-time matching of riders and drivers over a moving geospatial index'],
      ['The hard part', '250k location writes/sec and proximity queries on top of them'],
      ['Key decision', 'In-memory geo index sharded by city; durable log kept off the hot path'],
      ['Trade-off', 'Cell-based search is approximate at edges; ring search buys correctness for latency'],
      [
        '30-second answer',
        '"Drivers ping every few seconds — a quarter million writes a second — so current position lives in an in-memory geo index sharded by city, while the durable log goes to Kafka for history and billing. Proximity uses geohash or H3 cells: hash the pickup point, look up that cell and its ring, widen until there are enough candidates. Rank by routing ETA rather than straight-line distance, offer with a lock and a timeout. Rides are local, so city is a near-perfect shard key."',
      ],
    ]),
    asked([
      ['How do you find nearby drivers?', 'A cell-based geo index — geohash, H3 or a quadtree — searching the cell plus its surrounding ring.'],
      ['Why not a database with a spatial index?', 'It cannot take 250k writes a second. Current position is in memory; history goes to a log.'],
      ['What is the shard key?', 'Geography. Rides never cross cities, so there are no cross-shard queries.'],
      ['Why is straight-line distance wrong?', 'Rivers, one-way streets and traffic. Ranking has to use real routing ETA.'],
      ['How do you stop two riders getting the same driver?', 'Lock the driver when the offer is made, with a short timeout that releases them.'],
    ]),

    interviewLevel('Uber'),
    links(wiki('Geohash', 'Geohash'), wiki('Quadtree', 'Quadtree')),
  ],
};
