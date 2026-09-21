/**
 * System Design (HLD) — the track index.
 *
 * Sixteen sections, and the order is the order you would actually learn them:
 * the vocabulary and the arithmetic first, then the path a request takes, then
 * the theory that decides what you are allowed to promise, then the four
 * machines every design is assembled from — partitioning, caching, databases,
 * queues. Reliability, patterns, real-time and operations after that, because
 * each of them is a thing you do *to* a design that already exists.
 *
 * Then the three sections that are the reason the track is shaped like this.
 * **AI system design** is a full section rather than an appendix, because a
 * 2026 design round asks about vector databases and GPU scheduling the way a
 * 2016 one asked about sharding. **Cheatsheets** is the part you read on the
 * train. **Real-world systems** is nineteen end-to-end drawings, which is what
 * an interviewer is actually asking you to produce.
 *
 * ---------------------------------------------------------------------------
 * How this track differs from the other five.
 *
 * It is written to be *revised*, not read. Every other Learn track is notes you
 * work through once; this one is a page you skim in two minutes the night
 * before, so each topic opens with a picture inside the first screen and closes
 * with a `quick(...)` box holding the thirty-second answer. `diagram` and
 * `flow` were added to the block vocabulary for exactly this — see
 * `../blocks.js` and `docs/learn.md`.
 *
 * Its sections 2, 3 and 6 overlap the Networks and SQL tracks on purpose and
 * stay short, because they are answering a different question: not *how does
 * TCP work* but *where does it sit in my architecture and what does it cost
 * me*. Those topics link across rather than restating the other track.
 * ---------------------------------------------------------------------------
 *
 * Reading order is array order — `../index.js` numbers topics from their
 * position as it walks these sections, and `order` is never written by hand.
 */

export const title = 'System Design (HLD)';

export const summary =
  'High-level design, written as revision notes rather than a textbook. Every topic is one picture, one trade-off table and a thirty-second answer: the request path, CAP and consistency, sharding, caching, queues, the reliability patterns, the AI-era stack, nineteen real systems drawn end to end, and the ladder from 1K users to 100M.';

export const sections = [
  {
    key: 'foundations',
    title: 'Foundations',
    blurb:
      'The vocabulary and the arithmetic. What a design round is testing, how to size a system on the back of an envelope, and the numbers you are expected to know without looking them up.',
    topics: [
      {
        slug: 'what-is-high-level-design',
        title: 'What high-level design is',
        summary:
          'HLD versus LLD, what a design round is actually scoring, and the building blocks every answer is assembled from.',
        tags: ['basics', 'interview', 'hld', 'lld'],
        ask: [
          'What is the difference between high-level and low-level design?',
          'What is an interviewer actually scoring in a system design round?',
        ],
        load: () => import('./what-is-high-level-design.js'),
      },
      {
        slug: 'requirements-and-estimation',
        title: 'Requirements and estimation',
        summary:
          'Functional versus non-functional requirements, the questions to ask first, and back-of-the-envelope maths for QPS, storage and bandwidth.',
        tags: ['requirements', 'estimation', 'capacity', 'interview'],
        ask: [
          'How do I do a back-of-the-envelope capacity estimate?',
          'What non-functional requirements should I ask about first?',
        ],
        load: () => import('./requirements-and-estimation.js'),
      },
      {
        slug: 'latency-throughput-and-percentiles',
        title: 'Latency, throughput and percentiles',
        summary:
          'Why latency and throughput are different problems, why p99 is the number that matters, and the latency table worth knowing cold.',
        tags: ['latency', 'throughput', 'percentiles', 'p99'],
        ask: [
          'Why do we measure p99 instead of the average latency?',
          'What is the difference between latency and throughput?',
        ],
        load: () => import('./latency-throughput-and-percentiles.js'),
      },
      {
        slug: 'scaling-up-and-out',
        title: 'Scaling up and scaling out',
        summary:
          'Vertical versus horizontal scaling, why stateless services are the price of scaling out, and where to put session state instead.',
        tags: ['scaling', 'vertical', 'horizontal', 'stateless'],
        ask: [
          'When is vertical scaling the right answer?',
          'Why do services have to be stateless to scale horizontally?',
        ],
        load: () => import('./scaling-up-and-out.js'),
      },
      {
        slug: 'availability-and-slas',
        title: 'Availability, SLAs and nines',
        summary:
          'What three nines buys you in minutes, how availability multiplies through a chain of services, and the difference between an SLA, an SLO and an SLI.',
        tags: ['availability', 'sla', 'slo', 'sli', 'reliability'],
        ask: [
          'How much downtime is 99.9% availability per month?',
          'What is the difference between an SLA, an SLO and an SLI?',
        ],
        load: () => import('./availability-and-slas.js'),
      },
    ],
  },

  {
    key: 'request-path',
    title: 'The request path',
    blurb:
      'Everything between a user and your code, in the order a packet meets it. Short, because the Computer Networks track already explains how each one works — these ask where it sits and what it costs.',
    topics: [
      {
        slug: 'dns-and-traffic-routing',
        title: 'DNS and traffic routing',
        summary:
          'How a name becomes an address, and how DNS becomes a routing tool: geo-routing, weighted records, anycast and the TTL that decides how fast you can fail over.',
        tags: ['dns', 'routing', 'anycast', 'failover', 'geo'],
        ask: [
          'How is DNS used to route traffic to the nearest region?',
          'Why does a low DNS TTL matter for failover?',
        ],
        load: () => import('./dns-and-traffic-routing.js'),
      },
      {
        slug: 'load-balancers',
        title: 'Load balancers',
        summary:
          'Layer 4 versus layer 7, the balancing algorithms and when each one is wrong, health checks, and why sticky sessions are a smell.',
        tags: ['load-balancer', 'l4', 'l7', 'health-check', 'round-robin'],
        ask: [
          'What is the difference between an L4 and an L7 load balancer?',
          'When would I use least-connections instead of round-robin?',
        ],
        load: () => import('./load-balancers.js'),
      },
      {
        slug: 'proxies-and-api-gateway',
        title: 'Reverse proxies and the API gateway',
        summary:
          'Forward versus reverse proxy, what an API gateway adds on top, the backend-for-frontend pattern, and when a gateway becomes the bottleneck.',
        tags: ['proxy', 'reverse-proxy', 'api-gateway', 'bff', 'nginx'],
        ask: [
          'What does an API gateway do that a reverse proxy does not?',
          'What is a backend-for-frontend and when do I need one?',
        ],
        load: () => import('./proxies-and-api-gateway.js'),
      },
      {
        slug: 'cdn-and-the-edge',
        title: 'CDN and the edge',
        summary:
          'Why bytes travel badly, push versus pull CDNs, cache-control headers, purging, and what else the edge can do besides serve files.',
        tags: ['cdn', 'edge', 'cache-control', 'static-assets'],
        ask: [
          'How does a CDN decide whether to serve from cache or go to origin?',
          'What is the difference between a push and a pull CDN?',
        ],
        load: () => import('./cdn-and-the-edge.js'),
      },
      {
        slug: 'protocols-for-design',
        title: 'Protocols worth choosing between',
        summary:
          'TCP versus UDP, what HTTP/2 and HTTP/3 change, REST versus gRPC versus GraphQL, and why connection pooling shows up in every scaling story.',
        tags: ['tcp', 'udp', 'http', 'grpc', 'graphql', 'rest'],
        ask: [
          'When would I choose gRPC over REST between services?',
          'Why does connection pooling matter at scale?',
        ],
        load: () => import('./protocols-for-design.js'),
      },
    ],
  },

  {
    key: 'distributed',
    title: 'Distributed systems',
    blurb:
      'The theory that decides what you are allowed to promise. Four of these five are the reason an interviewer asks "and what happens if that node is unreachable?"',
    topics: [
      {
        slug: 'cap-and-pacelc',
        title: 'CAP and PACELC',
        summary:
          'What CAP actually says, why "pick two" is a misreading, and why PACELC is the version that describes the system you are really building.',
        tags: ['cap', 'pacelc', 'consistency', 'availability', 'partition'],
        ask: [
          'What does the CAP theorem actually say?',
          'Why is PACELC a better model than CAP?',
        ],
        load: () => import('./cap-and-pacelc.js'),
      },
      {
        slug: 'consistency-models',
        title: 'Consistency models',
        summary:
          'Strong, eventual, causal, read-your-writes and monotonic reads — what each one promises, and the bug each one still lets through.',
        tags: ['consistency', 'eventual', 'causal', 'linearizability'],
        ask: [
          'What is read-your-writes consistency and why do I need it?',
          'What is the difference between eventual and causal consistency?',
        ],
        load: () => import('./consistency-models.js'),
      },
      {
        slug: 'replication',
        title: 'Replication',
        summary:
          'Leader-follower, multi-leader and leaderless replication, synchronous versus asynchronous, and what replica lag breaks in each.',
        tags: ['replication', 'leader', 'follower', 'replica-lag'],
        ask: [
          'What breaks when a read hits a lagging replica?',
          'When is multi-leader replication worth the conflicts?',
        ],
        load: () => import('./replication.js'),
      },
      {
        slug: 'quorums',
        title: 'Quorums and tunable consistency',
        summary:
          'Why R + W > N gives you a consistent read, what happens when it does not, and how Dynamo-style stores let you dial the trade per query.',
        tags: ['quorum', 'dynamo', 'consistency', 'cassandra'],
        ask: [
          'Why does R + W > N guarantee a consistent read?',
          'What does a quorum write actually cost in latency?',
        ],
        load: () => import('./quorums.js'),
      },
      {
        slug: 'fault-tolerance-and-failover',
        title: 'Fault tolerance and failover',
        summary:
          'The failure modes worth designing for, redundancy that actually helps, automatic failover, and how split-brain happens.',
        tags: ['fault-tolerance', 'failover', 'redundancy', 'split-brain', 'ha'],
        ask: [
          'What is split-brain and how do systems prevent it?',
          'What is the difference between fault tolerance and high availability?',
        ],
        load: () => import('./fault-tolerance-and-failover.js'),
      },
    ],
  },

  {
    key: 'partitioning',
    title: 'Partitioning and sharding',
    blurb:
      'What to do when one database is no longer enough — and the four problems you have bought yourself the moment you split it.',
    topics: [
      {
        slug: 'partitioning-and-sharding',
        title: 'Partitioning and sharding',
        summary:
          'Vertical versus horizontal partitioning, range versus hash versus directory sharding, and how to pick a shard key you will not regret.',
        tags: ['sharding', 'partitioning', 'shard-key', 'scaling'],
        ask: [
          'How do I choose a shard key?',
          'What is the difference between range and hash sharding?',
        ],
        load: () => import('./partitioning-and-sharding.js'),
      },
      {
        slug: 'consistent-hashing',
        title: 'Consistent hashing',
        summary:
          'Why modulo hashing moves every key when a node joins, how the ring fixes it, and what virtual nodes are actually for.',
        tags: ['consistent-hashing', 'ring', 'virtual-nodes', 'rebalancing'],
        ask: [
          'Why not just use hash(key) % N to pick a shard?',
          'What problem do virtual nodes solve in consistent hashing?',
        ],
        load: () => import('./consistent-hashing.js'),
      },
      {
        slug: 'hotspots-and-skew',
        title: 'Hotspots and skew',
        summary:
          'The celebrity problem, sequential keys that pin every write to one shard, and the four standard fixes for a shard that runs hot.',
        tags: ['hotspot', 'skew', 'celebrity', 'hot-key'],
        ask: [
          'What is the celebrity problem and how do I design around it?',
          'Why are sequential IDs a bad shard key?',
        ],
        load: () => import('./hotspots-and-skew.js'),
      },
      {
        slug: 'life-after-sharding',
        title: 'Life after sharding',
        summary:
          'Cross-shard queries, joins and counts, resharding without downtime, and generating unique IDs when there is no single sequence left.',
        tags: ['sharding', 'resharding', 'snowflake', 'distributed-id'],
        ask: [
          'How do I generate unique IDs across shards?',
          'How do you reshard a live database without downtime?',
        ],
        load: () => import('./life-after-sharding.js'),
      },
    ],
  },

  {
    key: 'caching',
    title: 'Caching',
    blurb:
      'The cheapest order-of-magnitude in system design, and the one that fails in the most interesting ways. Five topics: where caches live, how to write to them, how to evict, how to invalidate, and how they fall over.',
    topics: [
      {
        slug: 'caching-basics',
        title: 'Caching basics',
        summary:
          'Every layer a cache can live at, from the browser to the database buffer pool, and the hit-ratio arithmetic that decides whether one is worth adding.',
        tags: ['cache', 'hit-ratio', 'layers', 'latency'],
        ask: [
          'Where should I put a cache in this architecture?',
          'How much does a 90% cache hit ratio actually save?',
        ],
        load: () => import('./caching-basics.js'),
      },
      {
        slug: 'cache-patterns',
        title: 'Cache patterns',
        summary:
          'Cache-aside, read-through, write-through, write-behind and refresh-ahead — the write path each one implies and the failure each one hides.',
        tags: ['cache-aside', 'write-through', 'write-behind', 'read-through'],
        ask: [
          'What is the difference between cache-aside and read-through?',
          'When is write-behind caching worth the risk of losing writes?',
        ],
        load: () => import('./cache-patterns.js'),
      },
      {
        slug: 'eviction-and-ttl',
        title: 'Eviction and TTL',
        summary:
          'LRU, LFU, FIFO and random, what each one is good at, how to size a cache, and why a TTL is a correctness decision rather than a memory one.',
        tags: ['eviction', 'lru', 'lfu', 'ttl', 'memory'],
        ask: [
          'When is LFU better than LRU?',
          'How do I choose a TTL for a cached value?',
        ],
        load: () => import('./eviction-and-ttl.js'),
      },
      {
        slug: 'cache-invalidation',
        title: 'Cache invalidation',
        summary:
          'The genuinely hard problem: TTL versus explicit purge versus versioned keys, and why invalidating on write is harder than it sounds.',
        tags: ['invalidation', 'staleness', 'versioned-keys', 'purge'],
        ask: [
          'How do I keep a cache in sync with the database?',
          'What are versioned cache keys and why do they help?',
        ],
        load: () => import('./cache-invalidation.js'),
      },
      {
        slug: 'cache-failure-modes',
        title: 'How caches fall over',
        summary:
          'Stampede, hot keys, penetration and avalanche — the four ways a cache turns from a shield into the thing that took the site down, and the fix for each.',
        tags: ['stampede', 'thundering-herd', 'hot-key', 'avalanche'],
        ask: [
          'What is a cache stampede and how do I prevent it?',
          'What happens to my database the moment the cache restarts empty?',
        ],
        load: () => import('./cache-failure-modes.js'),
      },
      {
        slug: 'redis-in-practice',
        title: 'Redis in practice',
        summary:
          'Redis versus Memcached, the data structures that replace application code, persistence options, and what Redis Cluster does and does not give you.',
        tags: ['redis', 'memcached', 'cluster', 'persistence'],
        ask: [
          'When would I choose Memcached over Redis?',
          'What does Redis persistence actually guarantee?',
        ],
        load: () => import('./redis-in-practice.js'),
      },
    ],
  },

  {
    key: 'databases',
    title: 'Databases at scale',
    blurb:
      'Choosing a store and then living with the choice. The SQL track teaches the language; these seven are about the decision and what it costs at ten million rows.',
    topics: [
      {
        slug: 'sql-vs-nosql',
        title: 'SQL versus NoSQL',
        summary:
          'The decision table, the five NoSQL families with what each is actually for, and why "NoSQL scales better" is the wrong reason to pick one.',
        tags: ['sql', 'nosql', 'document', 'key-value', 'wide-column'],
        ask: [
          'How do I decide between SQL and NoSQL for this system?',
          'What are the NoSQL families and what is each one good at?',
        ],
        load: () => import('./sql-vs-nosql.js'),
      },
      {
        slug: 'data-modelling-for-scale',
        title: 'Data modelling for scale',
        summary:
          'Designing from access patterns instead of entities, when denormalisation is correct, and how to evolve a schema with no downtime.',
        tags: ['modelling', 'denormalisation', 'access-patterns', 'migration'],
        ask: [
          'When should I denormalise?',
          'How do I run a schema migration with no downtime?',
        ],
        load: () => import('./data-modelling-for-scale.js'),
      },
      {
        slug: 'transactions-and-isolation',
        title: 'Transactions and isolation',
        summary:
          'ACID in one page, the four isolation levels and the anomaly each one still permits, and what a transaction costs you under load.',
        tags: ['acid', 'transactions', 'isolation', 'mvcc'],
        ask: [
          'Which isolation level should I use and why?',
          'What anomalies does read-committed still allow?',
        ],
        load: () => import('./transactions-and-isolation.js'),
      },
      {
        slug: 'indexing-and-storage-engines',
        title: 'Indexing and storage engines',
        summary:
          'B-tree versus LSM-tree and why your write pattern picks one, covering indexes, write amplification, and the cost of an index nobody uses.',
        tags: ['index', 'b-tree', 'lsm', 'write-amplification'],
        ask: [
          'When is an LSM-tree better than a B-tree?',
          'What is a covering index and why is it faster?',
        ],
        load: () => import('./indexing-and-storage-engines.js'),
      },
      {
        slug: 'replicas-and-write-scaling',
        title: 'Read replicas and scaling writes',
        summary:
          'How far read replicas take you, what replica lag breaks, and the four things to try when it is the writes that will not fit.',
        tags: ['read-replica', 'replica-lag', 'write-scaling', 'connection-pool'],
        ask: [
          'How do I handle replica lag in a read-after-write flow?',
          'What do I do when writes no longer fit on one primary?',
        ],
        load: () => import('./replicas-and-write-scaling.js'),
      },
      {
        slug: 'object-storage',
        title: 'Object storage',
        summary:
          'What S3-style storage is for, why blobs do not belong in your database, storage classes, and the consistency guarantees you actually get.',
        tags: ['s3', 'object-storage', 'blob', 'static'],
        ask: [
          'Why should I not store images in the database?',
          'When is object storage the wrong choice?',
        ],
        load: () => import('./object-storage.js'),
      },
      {
        slug: 'oltp-vs-olap',
        title: 'OLTP versus OLAP',
        summary:
          'Why analytics kills a production database, the warehouse and the lake, row versus column storage, and how data gets from one to the other.',
        tags: ['oltp', 'olap', 'warehouse', 'columnar', 'cdc', 'etl'],
        ask: [
          'Why do analytics queries need a separate database?',
          'What is change data capture and where does it fit?',
        ],
        load: () => import('./oltp-vs-olap.js'),
      },
    ],
  },

  {
    key: 'messaging',
    title: 'Async and messaging',
    blurb:
      'Taking work off the request path. Queues are how a system survives a spike it cannot serve in real time, and the delivery guarantees are where the bugs live.',
    topics: [
      {
        slug: 'sync-vs-async',
        title: 'Synchronous versus asynchronous',
        summary:
          'What belongs on the request path and what does not, how async changes the user-facing contract, and the latency you trade for throughput.',
        tags: ['async', 'sync', 'queue', 'background-job'],
        ask: [
          'How do I decide whether work belongs in a background job?',
          'What do I tell the user while an async job is still running?',
        ],
        load: () => import('./sync-vs-async.js'),
      },
      {
        slug: 'queues-and-pubsub',
        title: 'Queues and pub/sub',
        summary:
          'Point-to-point queues versus publish/subscribe, competing consumers, visibility timeouts, and which shape each problem wants.',
        tags: ['queue', 'pubsub', 'consumer', 'sqs', 'fan-out'],
        ask: [
          'What is the difference between a queue and pub/sub?',
          'What is a visibility timeout and what breaks without one?',
        ],
        load: () => import('./queues-and-pubsub.js'),
      },
      {
        slug: 'kafka',
        title: 'Kafka',
        summary:
          'The log as a primitive: partitions, consumer groups, offsets, ordering guarantees and retention — and why replay is the feature people actually come for.',
        tags: ['kafka', 'log', 'partition', 'consumer-group', 'offset'],
        ask: [
          'How does Kafka guarantee ordering, and at what granularity?',
          'What does a consumer group actually do?',
        ],
        load: () => import('./kafka.js'),
      },
      {
        slug: 'choosing-a-broker',
        title: 'Choosing a broker',
        summary:
          'Kafka versus RabbitMQ versus SQS versus Redis Streams, compared on the four things that decide it: ordering, retention, routing and operational cost.',
        tags: ['kafka', 'rabbitmq', 'sqs', 'redis-streams', 'broker'],
        ask: [
          'Kafka or RabbitMQ for this use case?',
          'When is SQS enough?',
        ],
        load: () => import('./choosing-a-broker.js'),
      },
      {
        slug: 'event-driven-architecture',
        title: 'Event-driven architecture',
        summary:
          'Events versus commands, choreography versus orchestration, event schemas that can change, and the debugging cost nobody mentions.',
        tags: ['events', 'eda', 'choreography', 'orchestration', 'schema'],
        ask: [
          'What is the difference between an event and a command?',
          'Choreography or orchestration — how do I choose?',
        ],
        load: () => import('./event-driven-architecture.js'),
      },
      {
        slug: 'delivery-idempotency-and-retries',
        title: 'Delivery, idempotency and retries',
        summary:
          'At-most-once, at-least-once and the truth about exactly-once; idempotency keys, deduplication, retry with jitter, dead-letter queues and backpressure.',
        tags: ['idempotency', 'exactly-once', 'retry', 'backoff', 'dlq', 'backpressure'],
        ask: [
          'Is exactly-once delivery actually possible?',
          'How do I make this endpoint idempotent?',
        ],
        load: () => import('./delivery-idempotency-and-retries.js'),
      },
    ],
  },

  {
    key: 'services',
    title: 'Services and reliability',
    blurb:
      'How a system made of many services keeps working when some of them are not. Seven topics, and five of them are about failing well.',
    topics: [
      {
        slug: 'monolith-vs-microservices',
        title: 'Monolith versus microservices',
        summary:
          'What splitting actually buys and what it costs, where the seams should be, and why the honest answer in an interview is usually "start with a monolith".',
        tags: ['microservices', 'monolith', 'bounded-context', 'coupling'],
        ask: [
          'When is a monolith the right answer?',
          'Where should the boundaries between microservices go?',
        ],
        load: () => import('./monolith-vs-microservices.js'),
      },
      {
        slug: 'service-communication-and-discovery',
        title: 'Service communication and discovery',
        summary:
          'How services find each other, client-side versus server-side discovery, the service mesh, and when a synchronous call between services is a mistake.',
        tags: ['service-discovery', 'mesh', 'grpc', 'sidecar', 'registry'],
        ask: [
          'How do services find each other in a dynamic environment?',
          'What does a service mesh actually do for me?',
        ],
        load: () => import('./service-communication-and-discovery.js'),
      },
      {
        slug: 'rate-limiting',
        title: 'Rate limiting',
        summary:
          'Token bucket, leaky bucket, fixed and sliding window — the four algorithms drawn, what each one does at a boundary, and how to limit across many servers.',
        tags: ['rate-limit', 'token-bucket', 'sliding-window', 'throttling'],
        ask: [
          'Which rate-limiting algorithm should I use and why?',
          'How do I rate limit across a fleet of servers?',
        ],
        load: () => import('./rate-limiting.js'),
      },
      {
        slug: 'failing-well',
        title: 'Failing well',
        summary:
          'Timeouts, retries with backoff and jitter, circuit breakers, bulkheads and graceful degradation — the five patterns that stop one slow service taking the rest down.',
        tags: ['circuit-breaker', 'timeout', 'backoff', 'bulkhead', 'degradation'],
        ask: [
          'How does a circuit breaker work?',
          'Why do retries make an outage worse without jitter?',
        ],
        load: () => import('./failing-well.js'),
      },
      {
        slug: 'distributed-locks-and-leader-election',
        title: 'Distributed locks and leader election',
        summary:
          'Why a lock across machines is hard, what Redlock does and does not promise, fencing tokens, leases, and how a cluster picks a leader.',
        tags: ['distributed-lock', 'redlock', 'leader-election', 'fencing', 'lease'],
        ask: [
          'Is Redlock safe? What is a fencing token?',
          'How does leader election work in practice?',
        ],
        load: () => import('./distributed-locks-and-leader-election.js'),
      },
      {
        slug: 'consensus',
        title: 'Consensus',
        summary:
          'Raft in one page, why consensus needs a majority, and what ZooKeeper and etcd actually give you that a database does not.',
        tags: ['consensus', 'raft', 'paxos', 'zookeeper', 'etcd', 'quorum'],
        ask: [
          'Explain Raft in two minutes.',
          'Why does consensus need an odd number of nodes?',
        ],
        load: () => import('./consensus.js'),
      },
      {
        slug: 'deployment-and-autoscaling',
        title: 'Deployment and autoscaling',
        summary:
          'Rolling, blue-green and canary releases, feature flags, backward-compatible migrations, and choosing the metric an autoscaler should watch.',
        tags: ['deployment', 'canary', 'blue-green', 'autoscaling', 'feature-flag'],
        ask: [
          'What is the difference between blue-green and canary deployment?',
          'What metric should I autoscale on?',
        ],
        load: () => import('./deployment-and-autoscaling.js'),
      },
    ],
  },

  {
    key: 'data-patterns',
    title: 'Distributed data patterns',
    blurb:
      'Three answers to one question: how do you change data in two places when there is no transaction that spans both?',
    topics: [
      {
        slug: 'distributed-transactions-and-saga',
        title: 'Distributed transactions and sagas',
        summary:
          'Two-phase commit and why almost nobody uses it, the saga pattern, compensating actions, and choreography versus orchestration for a saga.',
        tags: ['2pc', 'saga', 'compensation', 'distributed-transaction'],
        ask: [
          'Why is two-phase commit avoided in practice?',
          'How does a saga undo a step that already committed?',
        ],
        load: () => import('./distributed-transactions-and-saga.js'),
      },
      {
        slug: 'outbox-and-cdc',
        title: 'The outbox pattern and CDC',
        summary:
          'The dual-write problem, the transactional outbox that solves it, and change data capture reading the database log instead.',
        tags: ['outbox', 'cdc', 'dual-write', 'debezium', 'wal'],
        ask: [
          'What is the dual-write problem?',
          'When should I use CDC instead of an outbox table?',
        ],
        load: () => import('./outbox-and-cdc.js'),
      },
      {
        slug: 'cqrs-and-event-sourcing',
        title: 'CQRS and event sourcing',
        summary:
          'Splitting reads from writes, storing events instead of state, the read models you rebuild from them, and the price you pay for both.',
        tags: ['cqrs', 'event-sourcing', 'read-model', 'projection'],
        ask: [
          'What problem does CQRS actually solve?',
          'When is event sourcing worth the complexity?',
        ],
        load: () => import('./cqrs-and-event-sourcing.js'),
      },
    ],
  },

  {
    key: 'realtime',
    title: 'Real-time, media and search',
    blurb:
      'The three payloads that break a plain request/response design: a connection that stays open, a file too big to post, and a query that a WHERE clause cannot answer.',
    topics: [
      {
        slug: 'push-vs-pull',
        title: 'Push versus pull',
        summary:
          'Short polling, long polling, server-sent events and WebSockets, compared on the four things that decide it — direction, cost, proxies and reconnection.',
        tags: ['websocket', 'sse', 'long-polling', 'polling', 'realtime'],
        ask: [
          'WebSockets or SSE for this feature?',
          'When is long polling still the right answer?',
        ],
        load: () => import('./push-vs-pull.js'),
      },
      {
        slug: 'realtime-architecture',
        title: 'Real-time architecture',
        summary:
          'Connection servers and why they are stateful, presence, fan-out on write versus fan-out on read, and routing a message to a socket on another box.',
        tags: ['realtime', 'fan-out', 'presence', 'websocket', 'pubsub'],
        ask: [
          'How do I deliver a message to a user connected to a different server?',
          'Fan-out on write or on read — how do I choose?',
        ],
        load: () => import('./realtime-architecture.js'),
      },
      {
        slug: 'notification-systems',
        title: 'Notification systems',
        summary:
          'One pipeline for push, email and SMS: fan-out, per-channel providers, preferences and quiet hours, deduplication, and retries that do not spam.',
        tags: ['notifications', 'push', 'email', 'sms', 'fan-out'],
        ask: [
          'How do I design a notification system for millions of users?',
          'How do I stop a retry storm sending the same push five times?',
        ],
        load: () => import('./notification-systems.js'),
      },
      {
        slug: 'file-upload-and-media',
        title: 'File upload and media',
        summary:
          'Presigned URLs so bytes never touch your servers, chunked and resumable uploads, deduplication by hash, and the processing pipeline behind them.',
        tags: ['upload', 'presigned-url', 'chunked', 'resumable', 's3'],
        ask: [
          'How does a presigned upload URL work?',
          'How do I support resumable uploads for a 5GB file?',
        ],
        load: () => import('./file-upload-and-media.js'),
      },
      {
        slug: 'video-streaming',
        title: 'Video streaming',
        summary:
          'Transcoding into a ladder of renditions, HLS and DASH, adaptive bitrate, and why live streaming is a different problem from video on demand.',
        tags: ['video', 'hls', 'dash', 'transcoding', 'abr', 'streaming'],
        ask: [
          'How does adaptive bitrate streaming work?',
          'What makes live streaming harder than video on demand?',
        ],
        load: () => import('./video-streaming.js'),
      },
      {
        slug: 'search-systems',
        title: 'Search systems',
        summary:
          'The inverted index drawn out, how documents get into it, relevance scoring, and why search lives beside your database rather than inside it.',
        tags: ['search', 'elasticsearch', 'inverted-index', 'relevance', 'lucene'],
        ask: [
          'How does an inverted index work?',
          'Why can I not just use a LIKE query for search?',
        ],
        load: () => import('./search-systems.js'),
      },
    ],
  },

  {
    key: 'operations',
    title: 'Observability and operations',
    blurb:
      'Running it after it ships. An interviewer asks "how would you know this was broken?" and this section is the answer.',
    topics: [
      {
        slug: 'observability',
        title: 'Observability',
        summary:
          'Logs, metrics and traces — what each one answers that the others cannot, and what to instrument first in a system you have just designed.',
        tags: ['observability', 'logs', 'metrics', 'traces', 'monitoring'],
        ask: [
          'What is the difference between monitoring and observability?',
          'What should I instrument first?',
        ],
        load: () => import('./observability.js'),
      },
      {
        slug: 'logging-and-metrics',
        title: 'Logging and metrics',
        summary:
          'Structured logs and what they cost at scale, the RED and USE method for choosing metrics, cardinality as the thing that blows up your bill.',
        tags: ['logging', 'metrics', 'prometheus', 'cardinality', 'red', 'use'],
        ask: [
          'What metrics should a service expose?',
          'Why is high-cardinality labelling a problem?',
        ],
        load: () => import('./logging-and-metrics.js'),
      },
      {
        slug: 'distributed-tracing',
        title: 'Distributed tracing',
        summary:
          'Traces and spans, propagating context across services and queues, sampling strategies, and the question tracing answers that metrics cannot.',
        tags: ['tracing', 'spans', 'opentelemetry', 'sampling', 'context'],
        ask: [
          'How does trace context survive a hop through a message queue?',
          'What sampling rate should I use for tracing?',
        ],
        load: () => import('./distributed-tracing.js'),
      },
      {
        slug: 'alerting-and-oncall',
        title: 'Alerting and on-call',
        summary:
          'Alerting on symptoms rather than causes, error budgets, runbooks, and why the page that fires every night is worse than no page at all.',
        tags: ['alerting', 'oncall', 'error-budget', 'runbook', 'slo'],
        ask: [
          'What should actually page a human at 3am?',
          'How does an error budget change what we ship?',
        ],
        load: () => import('./alerting-and-oncall.js'),
      },
      {
        slug: 'load-testing-and-capacity',
        title: 'Load testing, capacity and cost',
        summary:
          'Load, stress and soak tests, finding the knee in the curve, planning capacity for a known spike, and the cost-versus-performance trade in plain numbers.',
        tags: ['load-testing', 'capacity', 'cost', 'stress-test', 'benchmark'],
        ask: [
          'How do I find the breaking point of a service?',
          'How do I plan capacity for a known traffic spike?',
        ],
        load: () => import('./load-testing-and-capacity.js'),
      },
    ],
  },

  {
    key: 'security',
    title: 'Security and tenancy',
    blurb:
      'The part of a design round that gets skipped until the interviewer asks. Five topics: who you are, what you may do, and how one customer stays out of another one.',
    topics: [
      {
        slug: 'authn-and-authz',
        title: 'Authentication and authorization',
        summary:
          'The two words people swap by mistake, where each belongs in the request path, and RBAC versus ABAC for deciding what someone may do.',
        tags: ['authentication', 'authorization', 'rbac', 'abac', 'security'],
        ask: [
          'What is the difference between authentication and authorization?',
          'RBAC or ABAC — which fits this system?',
        ],
        load: () => import('./authn-and-authz.js'),
      },
      {
        slug: 'sessions-tokens-and-jwt',
        title: 'Sessions, tokens and JWT',
        summary:
          'Server sessions versus stateless tokens, what a JWT really is, the revocation problem, and why refresh tokens exist.',
        tags: ['jwt', 'session', 'token', 'refresh-token', 'cookie'],
        ask: [
          'How do I revoke a JWT before it expires?',
          'Sessions or JWTs for this system?',
        ],
        load: () => import('./sessions-tokens-and-jwt.js'),
      },
      {
        slug: 'oauth-and-oidc',
        title: 'OAuth 2 and OIDC',
        summary:
          'The authorization code flow drawn step by step, what OIDC adds on top, and the difference between an access token and an ID token.',
        tags: ['oauth', 'oidc', 'sso', 'access-token', 'id-token'],
        ask: [
          'Walk me through the OAuth authorization code flow.',
          'What does OIDC add that OAuth 2 does not have?',
        ],
        load: () => import('./oauth-and-oidc.js'),
      },
      {
        slug: 'securing-a-system',
        title: 'Securing a system',
        summary:
          'TLS everywhere, encryption at rest, secret management, least privilege, and the handful of attacks a design round expects you to have thought about.',
        tags: ['tls', 'encryption', 'secrets', 'ddos', 'owasp', 'least-privilege'],
        ask: [
          'How would I defend this system against a DDoS?',
          'Where should secrets live in a deployed system?',
        ],
        load: () => import('./securing-a-system.js'),
      },
      {
        slug: 'multi-tenancy',
        title: 'Multi-tenancy',
        summary:
          'Shared, siloed and hybrid tenancy models, where the isolation boundary goes, noisy neighbours, and per-tenant limits that actually hold.',
        tags: ['multi-tenancy', 'isolation', 'saas', 'noisy-neighbour'],
        ask: [
          'Shared database or one per tenant?',
          'How do I stop one tenant degrading everyone else?',
        ],
        load: () => import('./multi-tenancy.js'),
      },
    ],
  },

  {
    key: 'geo',
    title: 'Geography and resilience',
    blurb:
      'Surviving the loss of a whole region, and serving users who are nowhere near your servers. The section that starts with "what if the data centre floods".',
    topics: [
      {
        slug: 'multi-region',
        title: 'Multi-region architecture',
        summary:
          'Why you would go multi-region and why you would not, routing users to the nearest one, and data gravity as the thing that makes it hard.',
        tags: ['multi-region', 'geo', 'latency', 'data-gravity'],
        ask: [
          'When is multi-region worth the complexity?',
          'How do I route a user to the nearest region?',
        ],
        load: () => import('./multi-region.js'),
      },
      {
        slug: 'active-active-vs-active-passive',
        title: 'Active-active versus active-passive',
        summary:
          'Two ways to run a second region, what each costs while nothing is wrong, and how long each takes to take over when something is.',
        tags: ['active-active', 'active-passive', 'failover', 'standby'],
        ask: [
          'Active-active or active-passive for this system?',
          'How fast can an active-passive setup actually fail over?',
        ],
        load: () => import('./active-active-vs-active-passive.js'),
      },
      {
        slug: 'cross-region-replication',
        title: 'Cross-region replication',
        summary:
          'Replicating data across a 150ms link, conflict resolution when both sides accept writes, and picking which data has to be global.',
        tags: ['replication', 'cross-region', 'conflict', 'last-write-wins', 'crdt'],
        ask: [
          'How do I resolve write conflicts between two regions?',
          'Does all of my data need to be in every region?',
        ],
        load: () => import('./cross-region-replication.js'),
      },
      {
        slug: 'disaster-recovery-and-backups',
        title: 'Disaster recovery and backups',
        summary:
          'RTO and RPO as the two numbers that decide everything, the four DR strategies by cost, point-in-time restore, and testing that a restore works.',
        tags: ['disaster-recovery', 'rto', 'rpo', 'backup', 'restore', 'pitr'],
        ask: [
          'What are RTO and RPO, and how do they change my design?',
          'What are the four disaster recovery strategies?',
        ],
        load: () => import('./disaster-recovery-and-backups.js'),
      },
    ],
  },

  {
    key: 'ai',
    title: 'AI system design',
    blurb:
      'A full section rather than an appendix, because a design round in 2026 asks about vector databases and GPU scheduling the way one in 2016 asked about sharding. Twelve topics, same shape as the rest.',
    topics: [
      {
        slug: 'ai-system-design-basics',
        title: 'What changes with AI in the loop',
        summary:
          'Where an AI system differs from a classic one: inference cost, GPU scarcity, non-determinism, unbounded latency, and evaluation instead of tests.',
        tags: ['ai', 'inference', 'gpu', 'latency', 'cost'],
        ask: [
          'How is designing an AI system different from a normal backend?',
          'What do I do about latency I cannot bound?',
        ],
        load: () => import('./ai-system-design-basics.js'),
      },
      {
        slug: 'model-serving',
        title: 'Model serving',
        summary:
          'What an inference server does, batching for throughput, model versioning and rollout, cold starts, and autoscaling something that takes 90 seconds to warm up.',
        tags: ['model-serving', 'inference', 'batching', 'triton', 'cold-start'],
        ask: [
          'How does batching improve inference throughput?',
          'How do I autoscale a service with a 90-second cold start?',
        ],
        load: () => import('./model-serving.js'),
      },
      {
        slug: 'llm-serving',
        title: 'LLM serving',
        summary:
          'Prefill versus decode, the KV cache and why it dominates memory, continuous batching, token streaming, and what context length really costs.',
        tags: ['llm', 'kv-cache', 'continuous-batching', 'streaming', 'vllm'],
        ask: [
          'What is the KV cache and why does it limit concurrency?',
          'Why is time-to-first-token a separate metric from tokens per second?',
        ],
        load: () => import('./llm-serving.js'),
      },
      {
        slug: 'batch-vs-realtime-inference',
        title: 'Batch versus real-time inference',
        summary:
          'Precomputing predictions versus computing them on request, the freshness-cost trade, and the hybrid most production systems actually run.',
        tags: ['batch', 'realtime', 'inference', 'precompute', 'freshness'],
        ask: [
          'Should these predictions be precomputed or computed on request?',
          'What does a hybrid batch/real-time inference setup look like?',
        ],
        load: () => import('./batch-vs-realtime-inference.js'),
      },
      {
        slug: 'gpu-scaling-and-cost',
        title: 'GPU scaling and cost',
        summary:
          'Why GPUs are scheduled rather than autoscaled, utilisation as the number that matters, queueing, spot capacity, and sharing one GPU between models.',
        tags: ['gpu', 'scaling', 'cost', 'utilisation', 'scheduling', 'spot'],
        ask: [
          'How do I keep GPU utilisation high?',
          'Why can I not just autoscale GPUs like web servers?',
        ],
        load: () => import('./gpu-scaling-and-cost.js'),
      },
      {
        slug: 'embeddings',
        title: 'Embeddings',
        summary:
          'What an embedding is in one picture, dimensionality and what it costs to store, similarity metrics, and the migration problem when you change model.',
        tags: ['embeddings', 'vectors', 'cosine', 'dimensionality'],
        ask: [
          'What actually is an embedding?',
          'What happens to my index when I upgrade the embedding model?',
        ],
        load: () => import('./embeddings.js'),
      },
      {
        slug: 'vector-databases',
        title: 'Vector databases',
        summary:
          'Approximate nearest neighbour search, HNSW versus IVF, the recall-latency dial, metadata filtering, and when a vector column in Postgres is enough.',
        tags: ['vector-db', 'ann', 'hnsw', 'ivf', 'pgvector', 'recall'],
        ask: [
          'How does HNSW search work?',
          'Do I need a dedicated vector database or is pgvector enough?',
        ],
        load: () => import('./vector-databases.js'),
      },
      {
        slug: 'rag-architecture',
        title: 'RAG architecture',
        summary:
          'The full pipeline drawn: ingest, chunk, embed, index, retrieve, rerank, generate — plus chunking strategy, hybrid search and where RAG actually goes wrong.',
        tags: ['rag', 'retrieval', 'chunking', 'reranking', 'hybrid-search'],
        ask: [
          'Draw the architecture of a RAG system.',
          'Why does my RAG system retrieve the wrong chunks?',
        ],
        load: () => import('./rag-architecture.js'),
      },
      {
        slug: 'ai-caching',
        title: 'Caching for AI systems',
        summary:
          'Three caches with three different keys — exact response, prompt prefix and semantic similarity — what each one saves, and how each one goes wrong.',
        tags: ['cache', 'semantic-cache', 'prompt-cache', 'llm', 'cost'],
        ask: [
          'What is a semantic cache and when is it dangerous?',
          'How does prompt caching reduce cost?',
        ],
        load: () => import('./ai-caching.js'),
      },
      {
        slug: 'recommendation-systems',
        title: 'Recommendation systems',
        summary:
          'The candidate generation, ranking and re-ranking funnel, collaborative versus content-based signals, the cold-start problem, and the offline/online split.',
        tags: ['recommendations', 'ranking', 'collaborative-filtering', 'cold-start'],
        ask: [
          'Design a recommendation system for a feed.',
          'How do you handle cold start for a brand new user?',
        ],
        load: () => import('./recommendation-systems.js'),
      },
      {
        slug: 'feature-stores-and-ml-pipelines',
        title: 'Feature stores and ML pipelines',
        summary:
          'Offline and online feature stores, training-serving skew and why it silently ruins a model, and the pipeline from raw event to deployed prediction.',
        tags: ['feature-store', 'ml-pipeline', 'training-serving-skew', 'mlops'],
        ask: [
          'What is training-serving skew and how does a feature store prevent it?',
          'What does an ML pipeline look like end to end?',
        ],
        load: () => import('./feature-stores-and-ml-pipelines.js'),
      },
      {
        slug: 'ai-agents',
        title: 'AI agents',
        summary:
          'Agentic architecture as a system design problem: the tool loop, memory, orchestration, guardrails, and bounding cost and latency when the model decides how many steps to take.',
        tags: ['agents', 'agentic', 'tools', 'memory', 'orchestration', 'guardrails'],
        ask: [
          'How do I design an agent system that cannot run up an unbounded bill?',
          'Where does state live in an agentic architecture?',
        ],
        load: () => import('./ai-agents.js'),
      },
    ],
  },

  {
    key: 'cheatsheets',
    title: 'Cheatsheets',
    blurb:
      'The five pages to reread on the way to the interview. Almost no prose — a ladder, a lookup table, the numbers, the script, and the trade-offs in one line each.',
    topics: [
      {
        slug: 'the-scale-ladder',
        title: 'The scale ladder',
        summary:
          'One architecture per rung from 1K users to 100M+, what broke to force each step, and what the new component actually solved.',
        tags: ['scale', 'cheatsheet', 'architecture', 'evolution'],
        ask: [
          'How does an architecture evolve from 1K to 10M users?',
          'What is the first thing to break as traffic grows?',
        ],
        load: () => import('./the-scale-ladder.js'),
      },
      {
        slug: 'bottleneck-to-fix',
        title: 'Bottleneck → fix',
        summary:
          'The lookup table: if X is the bottleneck, here is what you add, in the order you would add it, and here is when each one stops helping.',
        tags: ['bottleneck', 'cheatsheet', 'troubleshooting', 'scaling'],
        ask: [
          'The database is the bottleneck — what do I add, in what order?',
          'What do I reach for when requests are slow?',
        ],
        load: () => import('./bottleneck-to-fix.js'),
      },
      {
        slug: 'numbers-to-know',
        title: 'Numbers to know',
        summary:
          'Latency numbers, throughput ceilings per component, storage and bandwidth constants, and rough costs — everything an estimate needs, on one page.',
        tags: ['numbers', 'cheatsheet', 'latency', 'estimation', 'capacity'],
        ask: [
          'What are the latency numbers every engineer should know?',
          'Roughly how many requests per second can one server handle?',
        ],
        load: () => import('./numbers-to-know.js'),
      },
      {
        slug: 'the-45-minute-script',
        title: 'The 45-minute script',
        summary:
          'Minute by minute: what to ask, what to draw and what to say, from "what are we building" to "here is what I would fix first".',
        tags: ['interview', 'cheatsheet', 'framework', 'script'],
        ask: [
          'How should I structure a 45-minute system design interview?',
          'What do I do in the first five minutes?',
        ],
        load: () => import('./the-45-minute-script.js'),
      },
      {
        slug: 'trade-offs-and-mistakes',
        title: 'Trade-offs and common mistakes',
        summary:
          'Every major trade-off in one line each, and the dozen mistakes that cost candidates the round — mostly answers given before the question was understood.',
        tags: ['trade-offs', 'cheatsheet', 'interview', 'mistakes'],
        ask: [
          'What are the most common system design interview mistakes?',
          'Give me every major trade-off in one line each.',
        ],
        load: () => import('./trade-offs-and-mistakes.js'),
      },
    ],
  },

  {
    key: 'real-world',
    title: 'Real-world systems',
    blurb:
      'Nineteen systems drawn end to end. Each one is an interview-level architecture — the design you would defend on a whiteboard, not a claim about what the company actually runs, which is not public and would not fit in forty-five minutes anyway.',
    topics: [
      {
        slug: 'design-netflix',
        title: 'Netflix',
        summary:
          'Video on demand at continental scale: why the CDN is the product, how transcoding works, and what happens when everyone presses play at 8pm.',
        tags: ['netflix', 'video', 'cdn', 'streaming', 'real-world'],
        ask: [
          'Design Netflix.',
          'Why does Netflix put servers inside ISP networks?',
        ],
        load: () => import('./design-netflix.js'),
      },
      {
        slug: 'design-youtube',
        title: 'YouTube',
        summary:
          'Upload, transcode, store and serve user-generated video — plus the view counter, which is a harder distributed systems problem than the video.',
        tags: ['youtube', 'video', 'upload', 'transcoding', 'real-world'],
        ask: [
          'Design YouTube.',
          'How do you count views on a video with 10 million viewers?',
        ],
        load: () => import('./design-youtube.js'),
      },
      {
        slug: 'design-hotstar',
        title: 'Hotstar',
        summary:
          'Live sport for 50 million concurrent viewers: the spike that arrives in ninety seconds, pre-scaling, and graceful degradation when it is bigger than planned.',
        tags: ['hotstar', 'live', 'streaming', 'spike', 'real-world'],
        ask: [
          'Design a live streaming system for an IPL final.',
          'How do you prepare for a traffic spike you cannot autoscale into?',
        ],
        load: () => import('./design-hotstar.js'),
      },
      {
        slug: 'design-spotify',
        title: 'Spotify',
        summary:
          'Audio streaming, the difference that small files make, playlists, offline sync, and how a recommendation pipeline feeds a weekly playlist.',
        tags: ['spotify', 'audio', 'streaming', 'recommendations', 'real-world'],
        ask: [
          'Design Spotify.',
          'How is streaming audio different from streaming video?',
        ],
        load: () => import('./design-spotify.js'),
      },
      {
        slug: 'design-instagram',
        title: 'Instagram',
        summary:
          'Photo upload and the news feed: fan-out on write versus read, the celebrity problem in its natural habitat, and the feed cache.',
        tags: ['instagram', 'feed', 'fan-out', 'photos', 'real-world'],
        ask: [
          'Design Instagram.',
          'How do you build a news feed for a user following 2000 accounts?',
        ],
        load: () => import('./design-instagram.js'),
      },
      {
        slug: 'design-whatsapp',
        title: 'WhatsApp',
        summary:
          'Messaging: the connection layer, delivery receipts, offline queueing, group fan-out, and what end-to-end encryption rules out of your design.',
        tags: ['whatsapp', 'messaging', 'websocket', 'e2e', 'real-world'],
        ask: [
          'Design WhatsApp.',
          'How do the two blue ticks actually work?',
        ],
        load: () => import('./design-whatsapp.js'),
      },
      {
        slug: 'design-twitter',
        title: 'Twitter / X',
        summary:
          'The timeline at scale: the hybrid fan-out that handles both a normal user and one with 100 million followers, plus search and trends.',
        tags: ['twitter', 'timeline', 'fan-out', 'feed', 'real-world'],
        ask: [
          'Design Twitter.',
          'How do you handle a tweet from an account with 100M followers?',
        ],
        load: () => import('./design-twitter.js'),
      },
      {
        slug: 'design-linkedin',
        title: 'LinkedIn',
        summary:
          'The social graph as the hard part: degrees of connection, "people you may know", the feed, and search over a graph rather than a table.',
        tags: ['linkedin', 'graph', 'feed', 'search', 'real-world'],
        ask: [
          'Design LinkedIn.',
          'How do you compute second-degree connections at scale?',
        ],
        load: () => import('./design-linkedin.js'),
      },
      {
        slug: 'design-google-search',
        title: 'Google Search',
        summary:
          'Crawl, index, serve: the inverted index across thousands of machines, ranking as a separate stage, and why the answer has to arrive in 200ms.',
        tags: ['search', 'google', 'crawler', 'inverted-index', 'real-world'],
        ask: [
          'Design a web search engine.',
          'How is a web-scale inverted index sharded?',
        ],
        load: () => import('./design-google-search.js'),
      },
      {
        slug: 'design-amazon',
        title: 'Amazon',
        summary:
          'E-commerce end to end: catalogue and search, the cart, inventory that must not oversell, checkout, and order fulfilment as an async saga.',
        tags: ['amazon', 'ecommerce', 'inventory', 'cart', 'saga', 'real-world'],
        ask: [
          'Design Amazon.',
          'How do you stop two people buying the last item?',
        ],
        load: () => import('./design-amazon.js'),
      },
      {
        slug: 'design-flipkart',
        title: 'Flipkart',
        summary:
          'E-commerce built for a sale event: flash sales, queueing at the gate, inventory reservation under a hundred-times spike, and payment retries.',
        tags: ['flipkart', 'ecommerce', 'flash-sale', 'inventory', 'real-world'],
        ask: [
          'Design a flash sale system.',
          'How do you handle 100x traffic for a ten-minute sale?',
        ],
        load: () => import('./design-flipkart.js'),
      },
      {
        slug: 'design-swiggy',
        title: 'Swiggy',
        summary:
          'Food delivery: restaurant discovery by location, order state as a workflow, assigning a delivery partner, and live tracking on the map.',
        tags: ['swiggy', 'delivery', 'geo', 'matching', 'tracking', 'real-world'],
        ask: [
          'Design Swiggy.',
          'How do you assign a delivery partner to an order?',
        ],
        load: () => import('./design-swiggy.js'),
      },
      {
        slug: 'design-zomato',
        title: 'Zomato',
        summary:
          'The discovery half of the same problem: geo search over restaurants, ratings and reviews, menus that change, and the read-heavy traffic shape.',
        tags: ['zomato', 'geo-search', 'reviews', 'discovery', 'real-world'],
        ask: [
          'Design Zomato.',
          'How do you serve "restaurants near me" for millions of users?',
        ],
        load: () => import('./design-zomato.js'),
      },
      {
        slug: 'design-uber',
        title: 'Uber',
        summary:
          'Matching riders to drivers in real time: geospatial indexing, location updates at scale, the matching loop, surge pricing and trip state.',
        tags: ['uber', 'geo', 'matching', 'quadtree', 'surge', 'real-world'],
        ask: [
          'Design Uber.',
          'How do you find the nearest available drivers in a city?',
        ],
        load: () => import('./design-uber.js'),
      },
      {
        slug: 'design-airbnb',
        title: 'Airbnb',
        summary:
          'Search over availability and price, the double-booking problem, a two-sided marketplace, and why the calendar is the hardest table in the system.',
        tags: ['airbnb', 'booking', 'search', 'availability', 'real-world'],
        ask: [
          'Design Airbnb.',
          'How do you prevent a double booking?',
        ],
        load: () => import('./design-airbnb.js'),
      },
      {
        slug: 'design-irctc',
        title: 'IRCTC',
        summary:
          'Train booking under the worst traffic shape in the world: Tatkal at 10am, seat inventory per leg of a journey, queueing and fairness.',
        tags: ['irctc', 'booking', 'tatkal', 'inventory', 'queue', 'real-world'],
        ask: [
          'Design IRCTC Tatkal booking.',
          'How do you allocate seats fairly when a million people click at once?',
        ],
        load: () => import('./design-irctc.js'),
      },
      {
        slug: 'design-upi',
        title: 'UPI',
        summary:
          'A payment switch between banks: the four parties, the two-leg debit and credit, idempotency, reconciliation, and what happens when a bank times out.',
        tags: ['upi', 'payments', 'idempotency', 'reconciliation', 'real-world'],
        ask: [
          'Design UPI.',
          'What happens when the debit succeeds and the credit fails?',
        ],
        load: () => import('./design-upi.js'),
      },
      {
        slug: 'design-google-pay',
        title: 'Google Pay',
        summary:
          'A UPI app rather than a switch: the client, tokenised credentials, transaction history, and the part where you are a thin layer over someone else’s ledger.',
        tags: ['google-pay', 'payments', 'upi', 'wallet', 'real-world'],
        ask: [
          'Design a UPI payment app.',
          'What state does a payment app keep versus the switch?',
        ],
        load: () => import('./design-google-pay.js'),
      },
      {
        slug: 'design-razorpay',
        title: 'Razorpay',
        summary:
          'A payment gateway: routing to acquirers, webhooks that must arrive exactly once, the ledger, refunds, settlement and idempotent retries.',
        tags: ['razorpay', 'payments', 'gateway', 'webhook', 'ledger', 'real-world'],
        ask: [
          'Design a payment gateway.',
          'How do you guarantee a webhook is delivered exactly once?',
        ],
        load: () => import('./design-razorpay.js'),
      },
    ],
  },
];
