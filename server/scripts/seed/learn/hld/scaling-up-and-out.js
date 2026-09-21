import { asked, diagram, flow, h, links, p, quick, table, tip, tradeoff, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Two ways to handle more load: **a bigger machine, or more machines.** The first is nearly free in engineering effort and has a hard ceiling; the second has no ceiling and costs you every assumption you were making about state.',
    ),

    diagram(
      `
   VERTICAL (scale up)              HORIZONTAL (scale out)

        ┌─────────┐                 ┌───┐ ┌───┐ ┌───┐ ┌───┐
        │         │                 └───┘ └───┘ └───┘ └───┘
        │ BIGGER  │                        ▲
        │   BOX   │                        │
        │         │                 ┌──────────────┐
        └─────────┘                 │ load balancer│
                                    └──────────────┘

   ✓ no code changes                ✓ no ceiling
   ✓ no distributed anything        ✓ redundancy is free
   ✗ hard ceiling                   ✗ state has to go somewhere
   ✗ one machine to lose            ✗ coordination, partial failure
   ✗ price is super-linear          ✗ you now own a distributed system
`,
      'The two axes',
    ),

    h('The comparison'),
    tradeoff([
      ['**Vertical**', 'No architectural change; transactions and locks still work', 'A ceiling, a single point of failure, and cost that rises faster than capacity'],
      ['**Horizontal**', 'Unbounded capacity, and redundancy comes with it', 'Statelessness, coordination, partial failure, and much harder debugging'],
    ]),
    table(
      ['', 'Vertical', 'Horizontal'],
      [
        ['Effort', 'Change an instance type', 'Re-architect state'],
        ['Ceiling', '~hundreds of cores, ~TBs of RAM', 'None in practice'],
        ['Failure', 'The whole thing', 'One node of many'],
        ['Cost curve', 'Super-linear at the top end', 'Roughly linear'],
        ['Downtime to scale', 'Usually a restart', 'None — add a node'],
        ['Good for', '**Databases**, anything with shared state', '**Stateless services**, workers, caches'],
      ],
    ),
    tip(
      'The honest answer in most interviews: **scale the app tier out and the database up, for as long as you can get away with it.** A single large database with replicas serves a very large product, and sharding is a project you defer until writes genuinely do not fit.',
    ),

    h('The price of scaling out — statelessness'),
    p(
      'A load balancer can send request two to a different server than request one. Everything the first server remembered is gone. **Every piece of in-process state is a bug waiting for the second server.**',
    ),
    table(
      ['State that breaks', 'Where it has to go instead'],
      [
        ['Session in memory', 'Redis, or a signed cookie on the client'],
        ['Uploaded file on local disk', 'Object storage'],
        ['In-process cache of authoritative data', 'A shared cache, or accept per-node divergence'],
        ['A counter in a variable', 'The database, or Redis'],
        ['A scheduled job on every box', 'One leader, or a distributed scheduler'],
        ['WebSocket connection', 'It genuinely is stateful — route to it, see below'],
        ['A local lock', 'A distributed lock, or redesign to avoid needing one'],
      ],
    ),
    warn(
      '**Sticky sessions are a workaround, not a solution.** They pin a user to one server, which breaks even load distribution, makes deploys disruptive, and turns a single node failure into a logout. Use them to buy time while you move the state out.',
    ),

    h('Stateless does not mean no state'),
    diagram(
      `
   it means the state is not IN THE SERVER

   ┌──────┐  ┌──────┐  ┌──────┐   any request can
   │ app1 │  │ app2 │  │ app3 │   go to any box
   └───┬──┘  └───┬──┘  └───┬──┘
       └─────────┼─────────┘
                 ▼
        ┌────────────────┐
        │ Redis · DB · S3│   the state lives here,
        └────────────────┘   shared and durable

   the app servers become DISPOSABLE — and that is the
   property everything else depends on: autoscaling,
   rolling deploys, surviving a node failure.
`,
      'Disposable is the goal',
    ),

    h('What cannot be made stateless'),
    table(
      ['Component', 'Why', 'How it scales instead'],
      [
        ['**Databases**', 'They are the state', 'Replicas for reads, sharding for writes'],
        ['**WebSocket servers**', 'A socket lives on one machine', 'A session registry plus a pub/sub bus to route to it'],
        ['**Stream consumers**', 'Own a partition and its offset', 'Partition count is the parallelism limit'],
        ['**Caches**', 'The data is the point', 'Consistent hashing across nodes'],
      ],
    ),

    h('Scaling the data tier'),
    flow(['One DB', 'Bigger DB', 'Read replicas', 'Cache', 'Shard'], 'In this order'),
    table(
      ['Step', 'Scales', 'Cost'],
      [
        ['Vertical', 'Everything, to a point', 'Money; a hard ceiling'],
        ['Read replicas', 'Reads only', 'Replica lag'],
        ['Cache', 'Repeated reads', 'Staleness and invalidation'],
        ['**Sharding**', '**Writes and volume**', 'No cross-shard joins; irreversible'],
      ],
    ),
    p(
      'Only the last row scales writes. Everything above it is a way of not sharding yet — which is the right goal, because **sharding is the one step you cannot walk back**.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'Bigger machines versus more machines'],
      ['Why it matters', 'Scaling out requires statelessness, which is an architectural commitment'],
      ['Use when', 'Vertical until the ceiling or the single point of failure bites; horizontal after'],
      ['Trade-off', 'Horizontal buys unbounded capacity and costs you shared state and simple transactions'],
      [
        '30-second answer',
        '"Vertical is a bigger box — no code changes, but a ceiling, a single point of failure and super-linear cost. Horizontal is more boxes behind a load balancer, which is unbounded and brings redundancy, but requires the app to be stateless: sessions to Redis, files to object storage, no in-process state. In practice you scale the app tier out and the database up for as long as possible, because sharding is the only step that scales writes and the only one you cannot undo."',
      ],
    ]),
    asked([
      ['When is vertical scaling right?', 'Early, for databases, and any time the engineering cost of going distributed exceeds the hardware cost.'],
      ['Why must services be stateless to scale out?', 'Any request can land on any node, so anything remembered in-process is lost.'],
      ['Where does session state go?', 'A shared store like Redis, or a signed token on the client.'],
      ['Are sticky sessions acceptable?', 'As a temporary measure. They break load distribution and make node failure a logout.'],
      ['What actually scales writes?', 'Sharding. Replicas and caches only scale reads.'],
    ]),

    links(wiki('Scalability', 'Scalability'), wiki('Shared_nothing_architecture', 'Shared-nothing architecture')),
  ],
};
