import { asked, diagram, flow, h, links, p, quick, table, tip, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'One architecture per rung. Nothing here is a target to build towards — **each step exists because the one below it broke**, and the only honest way to read this page is backwards from wherever you actually are. Most systems never leave rung three.',
    ),

    h('1K users — one box'),
    flow(['Client', 'Server', 'Database'], '~10 requests/sec'),
    p(
      'Application and database on one machine. No load balancer, no cache, no queue. This is not a toy: it will serve a real product with real customers, and every component you add from here is a component you have to operate.',
    ),
    table(
      ['What you have', 'What it costs you'],
      [
        ['One deployable, one database', 'One outage takes everything'],
        ['No network hop between app and DB', 'No way to scale either independently'],
        ['Any change is one deploy', 'A deploy is downtime unless you plan for it'],
      ],
    ),
    tip(
      'The first change to make here is not a load balancer. It is **separating the database onto its own machine**, so the two can be sized and restarted independently. That single move buys more than the next three rungs.',
    ),

    h('100K users — more than one server'),
    flow(['Client', 'Load balancer', 'App × N', 'Database'], '~1,000 requests/sec'),
    diagram(
      `
                      ┌─────────┐
                 ┌───▶│  app 1  │──┐
   client ──▶ LB ├───▶│  app 2  │──┼──▶  database
                 └───▶│  app 3  │──┘      (one primary)
                      └─────────┘

   the app tier is now DISPOSABLE — any box can die
   the database is not
`,
      'Horizontal, at the app tier only',
    ),
    p(
      'The load balancer is the easy half. The hard half is that the app must become **stateless** first: no session in memory, no uploaded file on local disk, no in-process cache that has to be right. Session goes to Redis or into a signed cookie, files go to object storage.',
    ),
    warn(
      'The database is still one machine, and it is now the single point of failure for a system that looks redundant. A load balancer in front of three app servers buys availability for the tier that was never the problem.',
    ),

    h('1M users — stop asking the database'),
    flow(
      ['Client', 'CDN', 'Load balancer', 'App × N', 'Redis', 'Primary + read replicas'],
      '~10,000 requests/sec',
    ),
    diagram(
      `
   static bytes            dynamic reads              writes
        │                        │                       │
        ▼                        ▼                       ▼
      ┌─────┐            ┌──────────────┐        ┌──────────────┐
      │ CDN │            │    Redis     │        │   primary    │
      └─────┘            └──────┬───────┘        └──────┬───────┘
     90% of bytes           miss │                      │ replication
     never reach you             ▼                      ▼
                          ┌──────────────┐       ┌──────────────┐
                          │   replica    │◀──────│   replica    │
                          └──────────────┘       └──────────────┘
`,
      'Three ways to keep a read off the primary',
    ),
    table(
      ['Added', 'Solves', 'New problem it brings'],
      [
        ['**CDN**', 'Images, JS and video never touch your servers', 'Stale assets until the cache expires or is purged'],
        ['**Redis**', 'The same query is not run 10,000 times a minute', 'Invalidation, and a cold cache after a restart'],
        ['**Read replicas**', 'Reads scale out; the primary only writes', 'Replica lag — a user may not see their own write'],
      ],
    ),
    tip(
      'Before any of these, **add the missing index**. A single well-chosen index has ended more scaling projects than every cache in this table.',
    ),

    h('10M users — split the work up'),
    flow(
      ['CDN', 'LB', 'Services', 'Cache', 'Queue', 'Workers', 'Sharded DB'],
      '~100,000 requests/sec',
    ),
    diagram(
      `
   ┌──────────────────────────────────────────────────────────┐
   │                      API gateway                          │
   └───┬──────────────┬──────────────┬──────────────┬─────────┘
       ▼              ▼              ▼              ▼
   ┌────────┐    ┌────────┐    ┌────────┐    ┌──────────┐
   │ users  │    │ orders │    │ search │    │ payments │
   └───┬────┘    └───┬────┘    └───┬────┘    └────┬─────┘
       │             │             │              │
       │             ▼             ▼              │
       │        ┌─────────┐  ┌──────────┐         │
       │        │  Kafka  │  │  search  │         │
       │        └────┬────┘  │  index   │         │
       │             ▼       └──────────┘         │
       │        ┌─────────┐                       │
       │        │ workers │                       │
       │        └─────────┘                       │
       ▼                                          ▼
   ┌──────────────┐                       ┌──────────────┐
   │ shard 1..N   │                       │  own store   │
   └──────────────┘                       └──────────────┘
`,
      'Services own their data; the queue decouples them',
    ),
    table(
      ['Added', 'Solves', 'New problem it brings'],
      [
        ['**Services**', 'Teams deploy independently; hot paths scale alone', 'Network calls fail; a debug now spans four systems'],
        ['**Queue**', 'Spikes are absorbed, slow work leaves the request path', 'Eventual consistency, duplicate delivery, a backlog to watch'],
        ['**Sharding**', 'Writes and data volume both scale out', 'No cross-shard joins, no global counts, resharding is a project'],
      ],
    ),
    warn(
      'This rung is where most designs go wrong in an interview — reached for at 100K users, where it buys nothing and costs a distributed transaction problem you did not have.',
    ),

    h('100M+ users — more than one region'),
    flow(
      ['Geo DNS', 'Region A ⇄ Region B', 'Edge compute', 'Distributed services', 'Global + regional stores'],
      '1M+ requests/sec',
    ),
    diagram(
      `
                        ┌──────────────┐
             ┌──────────│   geo DNS    │──────────┐
             │          └──────────────┘          │
             ▼                                    ▼
    ┌────────────────┐                   ┌────────────────┐
    │   REGION eu    │                   │   REGION us    │
    │  ┌──────────┐  │   async repl.     │  ┌──────────┐  │
    │  │ services │  │◀─────────────────▶│  │ services │  │
    │  └────┬─────┘  │   (150ms away)    │  └────┬─────┘  │
    │       ▼        │                   │       ▼        │
    │  ┌──────────┐  │                   │  ┌──────────┐  │
    │  │ regional │  │                   │  │ regional │  │
    │  │   data   │  │                   │  │   data   │  │
    │  └──────────┘  │                   │  └──────────┘  │
    └────────────────┘                   └────────────────┘
             │                                    │
             └──────────┬─────────────────────────┘
                        ▼
             ┌────────────────────┐
             │  global data       │  identity, billing —
             │  (single writer)   │  small, and worth the latency
             └────────────────────┘
`,
      'Regional by default, global only where it must be',
    ),
    p(
      'The question stops being "how do I serve this much traffic" and becomes **"which data has to be the same everywhere"**. Almost none of it does. Sort data into regional (a user\'s posts, their orders) and global (identity, money, unique usernames), and only the second list is hard.',
    ),

    h('The whole ladder'),
    table(
      ['Users', 'Shape', 'What forced the step'],
      [
        ['**1K**', 'Client → Server → DB', '—'],
        ['**100K**', 'Client → LB → App×N → DB', 'One box ran out of CPU'],
        ['**1M**', '+ CDN, Redis, read replicas', 'The database ran out of reads'],
        ['**10M**', '+ services, queues, sharding', 'The database ran out of writes'],
        ['**100M**', '+ multi-region, geo routing', 'Users are 200ms away, and one region is one outage'],
      ],
    ),
    tip(
      'In an interview, **start at rung one and walk up**, saying what broke each time. It shows the thing being scored: that you add components because of pressure, not because you know their names.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'The five architectures a system passes through as traffic grows'],
      ['Why it matters', 'Every component has a reason; the reason is what an interviewer is listening for'],
      ['Use when', 'Opening a design round — build up, do not start at the top'],
      ['Trade-off', 'Each rung buys scale and pays in operational complexity and consistency'],
      [
        '30-second answer',
        '"Start with one server and a database. Split them, then put a load balancer in front of a stateless app tier. Then keep reads off the database — CDN, cache, replicas. When writes stop fitting, shard and move slow work onto a queue. Only go multi-region when latency or an outage forces it, and then only replicate the data that truly has to be global."',
      ],
    ]),
    asked([
      ['What is the first thing that breaks?', 'The database, and almost always on reads before writes.'],
      ['When do I add a cache?', 'When the same read is repeated and the data tolerates being slightly stale.'],
      ['When do I shard?', 'When writes or data volume exceed one primary — not when reads do. Replicas fix reads.'],
      ['When do I split into services?', 'When teams block each other on deploys, or one path needs to scale alone. Not for tidiness.'],
      ['When is multi-region right?', 'When users are far away, or losing one region is unacceptable. It is the most expensive rung.'],
    ]),

    links(
      wiki('Scalability', 'Scalability'),
      wiki('Load_balancing_(computing)', 'Load balancing'),
    ),
  ],
};
