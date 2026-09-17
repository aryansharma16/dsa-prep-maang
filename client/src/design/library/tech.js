/**
 * The technology catalogue behind the component library's `tech` element.
 *
 * One entry per thing you would draw on a system design board. An entry shows
 * either a brand logo (`brand`, a Simple Icons slug — paths are generated into
 * brandPaths.generated.js and loaded lazily) or one of this module's own glyphs
 * (`glyph`), in `color`. Brands Simple Icons no longer carries (AWS, Azure,
 * Oracle, Memcached…) use a generic glyph in the brand's colour.
 *
 * `about` is one line of "what it is and when you reach for it" — the inspector
 * shows it, search matches it. Phase 4 adds capacity specs to these entries.
 *
 * Pure data; the element stores only `tech: <id>`, so entries can be renamed
 * or recoloured without touching saved boards. Never remove an id — a board
 * that uses it would fall back to the generic box.
 */

export const TECH_CATEGORIES = [
  { id: 'clients', label: 'Clients' },
  { id: 'network', label: 'Network & edge' },
  { id: 'compute', label: 'Compute' },
  { id: 'sql', label: 'SQL databases' },
  { id: 'nosql', label: 'NoSQL databases' },
  { id: 'cache', label: 'Caches' },
  { id: 'messaging', label: 'Queues & streams' },
  { id: 'storage', label: 'Storage & analytics' },
  { id: 'search', label: 'Search & vectors' },
  { id: 'processing', label: 'Data processing' },
  { id: 'observability', label: 'Observability' },
  { id: 'platform', label: 'Cloud & platform' },
  { id: 'security', label: 'Identity & security' },
  { id: 'services', label: 'Third-party services' },
  { id: 'runtime', label: 'Languages & frameworks' },
  { id: 'devops', label: 'APIs & DevOps' },
];

const e = (id, name, category, look, color, about, keywords = '') => ({ id, name, category, ...look, color, about, keywords });
const brand = (slug) => ({ brand: slug });
const glyph = (name) => ({ glyph: name });

export const TECH = [
  // Clients
  e('user', 'User', 'clients', glyph('user'), '#64748b', 'A person using the system — where traffic and latency budgets start.', 'actor person customer'),
  e('browser', 'Web browser', 'clients', glyph('browser'), '#64748b', 'A web client; talks HTTP(S) or WebSocket to your edge.', 'web client spa'),
  e('mobile', 'Mobile app', 'clients', glyph('mobile'), '#64748b', 'iOS/Android client; flaky networks, offline sync and push notifications.', 'phone ios android client'),
  e('desktop', 'Desktop app', 'clients', glyph('desktop'), '#64748b', 'A native or Electron client.', 'client pc'),
  e('iot', 'IoT device', 'clients', glyph('iot'), '#64748b', 'Many small devices sending telemetry; think MQTT and bursty writes.', 'sensor device mqtt'),

  // Network & edge
  e('dns', 'DNS', 'network', glyph('dns'), '#0ea5e9', 'Resolves names to IPs; GeoDNS and weighted records steer traffic between regions.', 'route53 domain'),
  e('cdn', 'CDN', 'network', glyph('cdn'), '#f97316', 'Caches static and cacheable responses at edge locations near users.', 'edge cache cloudfront akamai'),
  e('load-balancer', 'Load balancer', 'network', glyph('loadBalancer'), '#8b5cf6', 'Spreads requests across instances (L4 or L7); health checks remove bad nodes.', 'lb elb alb nlb round robin'),
  e('api-gateway', 'API gateway', 'network', glyph('gateway'), '#6366f1', 'One entry point for APIs: routing, auth, rate limiting, request shaping.', 'gateway edge bff'),
  e('reverse-proxy', 'Reverse proxy', 'network', glyph('proxy'), '#22c55e', 'Terminates TLS and forwards to upstream servers; often also caches and compresses.', 'proxy tls termination'),
  e('firewall', 'Firewall / WAF', 'network', glyph('firewall'), '#ef4444', 'Filters traffic; a WAF blocks malicious HTTP (SQLi, XSS, bots).', 'waf security'),
  e('rate-limiter', 'Rate limiter', 'network', glyph('rateLimiter'), '#eab308', 'Caps requests per client (token bucket, sliding window) to protect the backend.', 'throttle token bucket'),
  e('nginx', 'NGINX', 'network', brand('nginx'), '#009639', 'Web server and reverse proxy / L7 load balancer.', 'proxy web server'),
  e('haproxy', 'HAProxy', 'network', glyph('loadBalancer'), '#1f6fb2', 'High-performance TCP/HTTP load balancer.', 'lb proxy'),
  e('envoy', 'Envoy', 'network', brand('envoyproxy'), '#ac6199', 'L7 proxy used as sidecar and edge; the data plane of most service meshes.', 'proxy mesh sidecar'),
  e('traefik', 'Traefik', 'network', brand('traefikproxy'), '#24a1c1', 'Reverse proxy that configures itself from Docker/Kubernetes.', 'proxy ingress'),
  e('caddy', 'Caddy', 'network', brand('caddy'), '#1f88c0', 'Web server with automatic HTTPS.', 'proxy tls'),
  e('cloudflare', 'Cloudflare', 'network', brand('cloudflare'), '#f38020', 'CDN, DNS, DDoS protection and edge compute.', 'cdn ddos edge workers'),
  e('kong', 'Kong', 'network', brand('kong'), '#1a7a8a', 'API gateway built on NGINX with plugins for auth and rate limiting.', 'gateway'),

  // Compute
  e('server', 'Server', 'compute', glyph('server'), '#3b82f6', 'An application server — stateless if you want to scale it horizontally.', 'app backend host instance vm'),
  e('service', 'Microservice', 'compute', glyph('service'), '#6366f1', 'One independently deployable service owning one capability and its data.', 'microservice api'),
  e('worker', 'Worker', 'compute', glyph('worker'), '#14b8a6', 'Consumes jobs from a queue and does slow work off the request path.', 'consumer background job'),
  e('function', 'Serverless function', 'compute', glyph('function'), '#f59e0b', 'Runs code per event, scales to zero; watch cold starts and time limits.', 'lambda faas cloud function'),
  e('aws-lambda', 'AWS Lambda', 'compute', glyph('function'), '#ff9900', 'AWS serverless functions triggered by HTTP, queues, streams or schedules.', 'serverless faas amazon'),
  e('container', 'Container', 'compute', glyph('container'), '#0ea5e9', 'A packaged process with its dependencies.', 'pod image'),
  e('scheduler', 'Scheduler / cron', 'compute', glyph('clock'), '#a855f7', 'Triggers work on a schedule; make jobs idempotent in case they run twice.', 'cron timer job'),
  e('docker', 'Docker', 'compute', brand('docker'), '#2496ed', 'Builds and runs containers.', 'container'),
  e('kubernetes', 'Kubernetes', 'compute', brand('kubernetes'), '#326ce5', 'Orchestrates containers: scheduling, self-healing, rolling deploys, autoscaling.', 'k8s orchestration'),

  // SQL databases
  e('database', 'Database', 'sql', glyph('database'), '#3b82f6', 'A relational database: ACID transactions, joins, a schema.', 'db sql rdbms'),
  e('replica', 'Read replica', 'sql', glyph('replica'), '#60a5fa', 'A copy that serves reads; asynchronous replication means reads can be slightly stale.', 'replication follower secondary'),
  e('postgresql', 'PostgreSQL', 'sql', brand('postgresql'), '#4169e1', 'Relational database with strong SQL, JSONB, extensions; the safe default.', 'postgres sql'),
  e('mysql', 'MySQL', 'sql', brand('mysql'), '#4479a1', 'Widely used relational database; InnoDB, good read scaling with replicas.', 'sql'),
  e('mariadb', 'MariaDB', 'sql', brand('mariadb'), '#1f6f8f', 'Community fork of MySQL.', 'mysql sql'),
  e('sqlite', 'SQLite', 'sql', brand('sqlite'), '#1f78a8', 'Embedded single-file database; great on devices and for small services.', 'embedded sql'),
  e('oracle', 'Oracle Database', 'sql', glyph('database'), '#f80000', 'Enterprise relational database.', 'sql'),
  e('sql-server', 'SQL Server', 'sql', glyph('database'), '#cc2927', 'Microsoft relational database.', 'mssql sql'),
  e('cockroachdb', 'CockroachDB', 'sql', brand('cockroachlabs'), '#6933ff', 'Distributed SQL: Postgres-compatible, survives node and region failures.', 'distributed sql newsql'),
  e('tidb', 'TiDB', 'sql', brand('tidb'), '#dc150b', 'Distributed MySQL-compatible SQL with HTAP.', 'distributed sql'),
  e('vitess', 'Vitess', 'sql', brand('vitess'), '#f16728', 'Shards MySQL horizontally behind one logical database (YouTube, Slack).', 'sharding mysql'),
  e('planetscale', 'PlanetScale', 'sql', brand('planetscale'), '#64748b', 'Managed MySQL built on Vitess.', 'mysql vitess'),
  e('neon', 'Neon', 'sql', brand('neon'), '#34d59a', 'Serverless Postgres with branching.', 'postgres serverless'),
  e('supabase', 'Supabase', 'sql', brand('supabase'), '#3fcf8e', 'Postgres with auth, storage and realtime APIs.', 'postgres baas'),

  // NoSQL databases
  e('key-value', 'Key-value store', 'nosql', glyph('keyValue'), '#ef4444', 'Get/put by key at very high throughput; no joins, design around access patterns.', 'kv nosql'),
  e('document-db', 'Document database', 'nosql', glyph('document'), '#22c55e', 'Stores JSON-like documents; flexible schema, denormalised reads.', 'nosql json'),
  e('wide-column', 'Wide-column store', 'nosql', glyph('wideColumn'), '#0ea5e9', 'Partition key + clustering key; huge write throughput (Cassandra, Bigtable).', 'nosql column family'),
  e('graph-db', 'Graph database', 'nosql', glyph('graph'), '#8b5cf6', 'Nodes and edges; fast multi-hop relationship queries.', 'nosql graph'),
  e('time-series', 'Time-series database', 'nosql', glyph('timeSeries'), '#f59e0b', 'Append-heavy timestamped data with rollups and retention.', 'tsdb metrics'),
  e('mongodb', 'MongoDB', 'nosql', brand('mongodb'), '#47a248', 'Document database with replica sets and sharding.', 'nosql document'),
  e('cassandra', 'Apache Cassandra', 'nosql', brand('apachecassandra'), '#1287b1', 'Leaderless wide-column store; tunable consistency, linear write scaling.', 'nosql wide column'),
  e('scylladb', 'ScyllaDB', 'nosql', brand('scylladb'), '#3fb6c8', 'Cassandra-compatible, written in C++ for lower latency.', 'nosql wide column'),
  e('dynamodb', 'DynamoDB', 'nosql', glyph('keyValue'), '#4053d6', 'AWS managed key-value/document store; single-digit ms at any scale, design by access pattern.', 'aws nosql kv amazon'),
  e('couchbase', 'Couchbase', 'nosql', brand('couchbase'), '#ea2328', 'Document database with a built-in memory-first cache.', 'nosql document'),
  e('couchdb', 'Apache CouchDB', 'nosql', brand('apachecouchdb'), '#e42528', 'Document database with multi-master sync.', 'nosql document'),
  e('hbase', 'Apache HBase', 'nosql', brand('apachehbase'), '#be160c', 'Wide-column store on HDFS (Bigtable model).', 'nosql hadoop'),
  e('neo4j', 'Neo4j', 'nosql', brand('neo4j'), '#4581c3', 'Graph database queried with Cypher.', 'graph'),
  e('arangodb', 'ArangoDB', 'nosql', brand('arangodb'), '#b5b52f', 'Multi-model: documents, graphs and key-value.', 'graph document'),
  e('firebase', 'Firebase', 'nosql', brand('firebase'), '#dd2c00', 'Realtime/Firestore databases, auth and hosting for apps.', 'firestore baas'),
  e('influxdb', 'InfluxDB', 'nosql', brand('influxdb'), '#22adf6', 'Time-series database for metrics and events.', 'tsdb'),
  e('timescale', 'TimescaleDB', 'nosql', brand('timescale'), '#e0a000', 'Time-series on top of Postgres.', 'tsdb postgres'),

  // Caches
  e('cache', 'Cache', 'cache', glyph('cache'), '#ef4444', 'Keeps hot data in memory; decide the eviction policy and how it is invalidated.', 'in-memory lru'),
  e('redis', 'Redis', 'cache', brand('redis'), '#ff4438', 'In-memory data structures: cache, sessions, rate limits, leaderboards, pub/sub, streams.', 'cache kv in-memory'),
  e('memcached', 'Memcached', 'cache', glyph('cache'), '#2e8b57', 'Simple multi-threaded in-memory key-value cache.', 'cache kv'),
  e('upstash', 'Upstash', 'cache', brand('upstash'), '#00c98d', 'Serverless Redis billed per request, plus QStash messaging and a vector store.', 'redis serverless qstash'),

  // Queues & streams
  e('queue', 'Message queue', 'messaging', glyph('queue'), '#14b8a6', 'Buffers work between producers and consumers; smooths spikes, enables retries.', 'mq async jobs'),
  e('topic', 'Pub/sub topic', 'messaging', glyph('topic'), '#0ea5e9', 'Fan-out: every subscriber gets each message.', 'pubsub broadcast fanout'),
  e('event-stream', 'Event stream', 'messaging', glyph('stream'), '#6366f1', 'An ordered, replayable log of events partitioned by key.', 'log stream events'),
  e('kafka', 'Apache Kafka', 'messaging', brand('apachekafka'), '#64748b', 'Partitioned, replicated commit log; ordering per partition, consumer groups, replay.', 'stream log mq'),
  e('rabbitmq', 'RabbitMQ', 'messaging', brand('rabbitmq'), '#ff6600', 'Message broker with exchanges, routing keys, acks and dead-letter queues.', 'mq amqp broker'),
  e('pulsar', 'Apache Pulsar', 'messaging', brand('apachepulsar'), '#188fff', 'Streaming and queueing with tiered storage, separated compute and storage.', 'stream mq'),
  e('nats', 'NATS', 'messaging', brand('natsdotio'), '#27aae1', 'Lightweight messaging; JetStream adds persistence.', 'mq pubsub'),
  e('sqs', 'Amazon SQS', 'messaging', glyph('queue'), '#e7157b', 'AWS managed queue; at-least-once delivery, visibility timeout, FIFO option.', 'aws queue amazon'),
  e('celery', 'Celery', 'messaging', brand('celery'), '#37814a', 'Python distributed task queue.', 'jobs python'),
  e('temporal', 'Temporal', 'messaging', brand('temporal'), '#64748b', 'Durable workflows that survive crashes and retries (sagas, long processes).', 'workflow saga'),

  // Storage & analytics
  e('object-storage', 'Object storage', 'storage', glyph('bucket'), '#22c55e', 'Cheap, durable blobs by key (images, videos, backups); serve through a CDN.', 'blob s3 bucket files'),
  e('s3', 'Amazon S3', 'storage', glyph('bucket'), '#3f8624', 'AWS object storage; eleven nines of durability.', 'aws blob bucket amazon'),
  e('data-warehouse', 'Data warehouse', 'storage', glyph('warehouse'), '#8b5cf6', 'Columnar store for analytics over large history.', 'olap analytics'),
  e('minio', 'MinIO', 'storage', brand('minio'), '#c72e49', 'S3-compatible object storage you run yourself.', 's3 blob'),
  e('ceph', 'Ceph', 'storage', brand('ceph'), '#ef5c55', 'Distributed object, block and file storage.', 'storage'),
  e('snowflake', 'Snowflake', 'storage', brand('snowflake'), '#29b5e8', 'Cloud data warehouse with separate storage and compute.', 'warehouse olap'),
  e('bigquery', 'BigQuery', 'storage', brand('googlebigquery'), '#669df6', 'Google serverless data warehouse.', 'warehouse olap gcp'),
  e('clickhouse', 'ClickHouse', 'storage', brand('clickhouse'), '#d4a800', 'Very fast columnar OLAP database for real-time analytics.', 'olap column'),
  e('databricks', 'Databricks', 'storage', brand('databricks'), '#ff3621', 'Lakehouse platform on Spark.', 'lakehouse spark'),
  e('duckdb', 'DuckDB', 'storage', brand('duckdb'), '#c9bd00', 'In-process analytical SQL database.', 'olap embedded'),

  // Search & vectors
  e('search', 'Search index', 'search', glyph('search'), '#f59e0b', 'Inverted index for full-text search, filters and relevance ranking.', 'full text index'),
  e('vector-db', 'Vector database', 'search', glyph('vector'), '#a855f7', 'Nearest-neighbour search over embeddings.', 'embeddings ann similarity'),
  e('elasticsearch', 'Elasticsearch', 'search', brand('elasticsearch'), '#00a3a3', 'Distributed search and analytics engine on Lucene.', 'search elk'),
  e('opensearch', 'OpenSearch', 'search', brand('opensearch'), '#005eb8', 'Open-source fork of Elasticsearch.', 'search'),
  e('solr', 'Apache Solr', 'search', brand('apachesolr'), '#d9411e', 'Search platform on Lucene.', 'search'),
  e('algolia', 'Algolia', 'search', brand('algolia'), '#003dff', 'Hosted search-as-you-type.', 'search saas'),
  e('meilisearch', 'Meilisearch', 'search', brand('meilisearch'), '#ff5caa', 'Fast, typo-tolerant search engine.', 'search'),
  e('qdrant', 'Qdrant', 'search', brand('qdrant'), '#dc244c', 'Vector similarity search engine.', 'vector'),
  e('milvus', 'Milvus', 'search', brand('milvus'), '#00a1ea', 'Distributed vector database.', 'vector'),

  // Data processing
  e('batch-job', 'Batch job', 'processing', glyph('batch'), '#64748b', 'Processes large data on a schedule (ETL, reports, reindexing).', 'etl mapreduce'),
  e('stream-processor', 'Stream processor', 'processing', glyph('streamProcessor'), '#0ea5e9', 'Transforms and aggregates events continuously (windows, joins).', 'streaming realtime'),
  e('spark', 'Apache Spark', 'processing', brand('apachespark'), '#e25a1c', 'Distributed batch and micro-batch processing.', 'batch big data'),
  e('flink', 'Apache Flink', 'processing', brand('apacheflink'), '#e6526f', 'Stateful stream processing with exactly-once state.', 'streaming'),
  e('hadoop', 'Apache Hadoop', 'processing', brand('apachehadoop'), '#4fb3e6', 'HDFS storage and MapReduce batch processing.', 'hdfs mapreduce'),
  e('airflow', 'Apache Airflow', 'processing', brand('apacheairflow'), '#017cee', 'Schedules and orchestrates data pipelines as DAGs.', 'orchestration etl'),
  e('druid', 'Apache Druid', 'processing', brand('apachedruid'), '#1fb5c0', 'Real-time analytics database for event data.', 'olap'),
  e('trino', 'Trino', 'processing', brand('trino'), '#dd00a1', 'Distributed SQL query engine over many data sources.', 'presto query'),

  // Observability
  e('metrics', 'Metrics', 'observability', glyph('metrics'), '#f97316', 'Counters, gauges and histograms (RED/USE) scraped or pushed.', 'monitoring'),
  e('logs', 'Logs', 'observability', glyph('logs'), '#64748b', 'Structured event records shipped to a central store.', 'logging'),
  e('tracing', 'Tracing', 'observability', glyph('tracing'), '#8b5cf6', 'Follows one request across services to find where latency goes.', 'distributed tracing spans'),
  e('alerting', 'Alerting', 'observability', glyph('alert'), '#ef4444', 'Pages a human when an SLO is at risk.', 'oncall pager'),
  e('prometheus', 'Prometheus', 'observability', brand('prometheus'), '#e6522c', 'Pull-based metrics and alerting with PromQL.', 'metrics'),
  e('grafana', 'Grafana', 'observability', brand('grafana'), '#f46800', 'Dashboards for metrics, logs and traces.', 'dashboards'),
  e('datadog', 'Datadog', 'observability', brand('datadog'), '#632ca6', 'Hosted monitoring, APM and logs.', 'apm monitoring'),
  e('jaeger', 'Jaeger', 'observability', brand('jaeger'), '#4fb8d0', 'Distributed tracing.', 'tracing'),
  e('opentelemetry', 'OpenTelemetry', 'observability', brand('opentelemetry'), '#f5a800', 'Vendor-neutral SDKs and collector for traces, metrics and logs.', 'otel tracing'),
  e('kibana', 'Kibana', 'observability', brand('kibana'), '#e8478b', 'Search and dashboards over Elasticsearch (ELK).', 'elk logs'),
  e('logstash', 'Logstash', 'observability', brand('logstash'), '#00a9a5', 'Log ingestion pipeline (ELK).', 'elk logs'),
  e('fluentd', 'Fluentd', 'observability', brand('fluentd'), '#0e83c8', 'Unified log collector.', 'logs'),
  e('sentry', 'Sentry', 'observability', brand('sentry'), '#7b5fc8', 'Error tracking with stack traces and releases.', 'errors'),
  e('new-relic', 'New Relic', 'observability', brand('newrelic'), '#1ce783', 'Hosted APM and observability.', 'apm'),
  e('pagerduty', 'PagerDuty', 'observability', brand('pagerduty'), '#06ac38', 'On-call scheduling and incident alerts.', 'oncall'),

  // Cloud & platform
  e('aws', 'AWS', 'platform', glyph('cloud'), '#ff9900', 'Amazon Web Services.', 'amazon cloud'),
  e('azure', 'Azure', 'platform', glyph('cloud'), '#0078d4', 'Microsoft cloud.', 'microsoft cloud'),
  e('gcp', 'Google Cloud', 'platform', brand('googlecloud'), '#4285f4', 'Google Cloud Platform.', 'gcp cloud'),
  e('digitalocean', 'DigitalOcean', 'platform', brand('digitalocean'), '#0080ff', 'Simple cloud VMs, managed databases and Kubernetes.', 'cloud'),
  e('vercel', 'Vercel', 'platform', brand('vercel'), '#64748b', 'Frontend hosting with edge functions.', 'hosting edge'),
  e('netlify', 'Netlify', 'platform', brand('netlify'), '#00a99d', 'Static site hosting and functions.', 'hosting'),
  e('region', 'Region / zone', 'platform', glyph('region'), '#64748b', 'A failure domain; replicate across zones for availability, regions for disasters.', 'availability zone az datacenter'),
  e('terraform', 'Terraform', 'platform', brand('terraform'), '#844fba', 'Infrastructure as code.', 'iac'),
  e('helm', 'Helm', 'platform', brand('helm'), '#5b6ee1', 'Package manager for Kubernetes.', 'k8s charts'),
  e('istio', 'Istio', 'platform', brand('istio'), '#466bb0', 'Service mesh: mTLS, retries, traffic splitting via Envoy sidecars.', 'mesh'),
  e('linkerd', 'Linkerd', 'platform', brand('linkerd'), '#20c997', 'Lightweight service mesh.', 'mesh'),
  e('zookeeper', 'ZooKeeper', 'platform', glyph('coordination'), '#c6862d', 'Coordination service: leader election, config, locks (consensus via ZAB).', 'coordination leader election'),
  e('etcd', 'etcd', 'platform', brand('etcd'), '#419eda', 'Raft-based key-value store for configuration and leader election (Kubernetes state).', 'raft consensus kv'),
  e('consul', 'Consul', 'platform', brand('consul'), '#f24c53', 'Service discovery, health checks and KV config.', 'discovery'),
  e('vault', 'Vault', 'platform', brand('vault'), '#c9a800', 'Secrets management and encryption as a service.', 'secrets'),

  // Identity & security
  e('auth', 'Auth service', 'security', glyph('lock'), '#6366f1', 'Issues and validates tokens/sessions; keep it on the hot path cheap.', 'authentication jwt oauth sessions'),
  e('auth0', 'Auth0', 'security', brand('auth0'), '#eb5424', 'Hosted authentication and authorization.', 'auth identity'),
  e('okta', 'Okta', 'security', brand('okta'), '#007dc1', 'Enterprise identity and SSO.', 'sso identity'),
  e('keycloak', 'Keycloak', 'security', brand('keycloak'), '#64748b', 'Open-source identity and access management.', 'sso oauth oidc'),
  e('secrets', 'Secrets manager', 'security', glyph('key'), '#eab308', 'Stores credentials and keys; rotate them without redeploying.', 'kms keys'),

  // Third-party services
  e('payment-gateway', 'Payment gateway', 'services', glyph('card'), '#22c55e', 'Charges cards/UPI; design for idempotent retries and async webhooks.', 'payments psp'),
  e('stripe', 'Stripe', 'services', brand('stripe'), '#635bff', 'Payments platform.', 'payments'),
  e('razorpay', 'Razorpay', 'services', brand('razorpay'), '#3395ff', 'Payments platform (India: cards, UPI, netbanking).', 'payments upi'),
  e('notification', 'Notification service', 'services', glyph('bell'), '#f97316', 'Sends push, email and SMS; fan-out through a queue, respect user preferences.', 'push email sms'),
  e('email', 'Email service', 'services', glyph('mail'), '#0ea5e9', 'Transactional email delivery (SES, SendGrid).', 'smtp ses sendgrid'),
  e('sms', 'SMS gateway', 'services', glyph('sms'), '#14b8a6', 'Sends OTPs and alerts (Twilio, MSG91).', 'otp twilio'),
  e('maps', 'Maps / geo service', 'services', glyph('pin'), '#ef4444', 'Geocoding, routing, ETA; index locations with geohash or quadtrees.', 'location geohash'),

  // Languages & frameworks
  e('nodejs', 'Node.js', 'runtime', brand('nodedotjs'), '#5fa04e', 'JavaScript runtime; event loop suits I/O-heavy services.', 'javascript'),
  e('go', 'Go', 'runtime', brand('go'), '#00add8', 'Compiled language with goroutines; common for infrastructure services.', 'golang'),
  e('java', 'Java', 'runtime', brand('openjdk'), '#64748b', 'JVM language behind many large backends.', 'jvm openjdk'),
  e('python', 'Python', 'runtime', brand('python'), '#3776ab', 'Scripting, data and ML services.', 'py'),
  e('rust', 'Rust', 'runtime', brand('rust'), '#64748b', 'Memory-safe systems language.', 'systems'),
  e('kotlin', 'Kotlin', 'runtime', brand('kotlin'), '#7f52ff', 'JVM and Android language.', 'jvm android'),
  e('php', 'PHP', 'runtime', brand('php'), '#777bb4', 'Web backend language.', 'web'),
  e('ruby', 'Ruby', 'runtime', brand('ruby'), '#cc342d', 'Language behind Rails.', 'rails'),
  e('spring', 'Spring', 'runtime', brand('spring'), '#6db33f', 'Java framework for services (Spring Boot).', 'java boot'),
  e('django', 'Django', 'runtime', brand('django'), '#2e8b57', 'Python web framework.', 'python'),
  e('fastapi', 'FastAPI', 'runtime', brand('fastapi'), '#009688', 'Async Python API framework.', 'python'),
  e('express', 'Express', 'runtime', brand('express'), '#64748b', 'Minimal Node.js web framework.', 'node'),
  e('nestjs', 'NestJS', 'runtime', brand('nestjs'), '#e0234e', 'Structured Node.js framework.', 'node typescript'),
  e('react', 'React', 'runtime', brand('react'), '#149eca', 'UI library for web clients.', 'frontend'),
  e('nextjs', 'Next.js', 'runtime', brand('nextdotjs'), '#64748b', 'React framework with server rendering.', 'react ssr'),
  e('android', 'Android', 'runtime', brand('android'), '#3ddc84', 'Android client.', 'mobile'),
  e('ios', 'iOS', 'runtime', brand('apple'), '#64748b', 'Apple platforms client.', 'apple mobile'),
  e('linux', 'Linux', 'runtime', brand('linux'), '#d9a400', 'The operating system under most servers.', 'os'),

  // APIs & DevOps
  e('rest-api', 'REST API', 'devops', glyph('api'), '#3b82f6', 'Resource-oriented HTTP API; version it, paginate lists, make writes idempotent.', 'http json'),
  e('graphql', 'GraphQL', 'devops', brand('graphql'), '#e10098', 'Client-shaped queries over one endpoint; watch N+1 queries.', 'api'),
  e('grpc', 'gRPC', 'devops', glyph('api'), '#244c5a', 'Binary RPC over HTTP/2 with protobuf; streaming, good between services.', 'rpc protobuf'),
  e('websocket', 'WebSocket', 'devops', glyph('websocket'), '#64748b', 'Long-lived bidirectional connection for realtime (chat, presence, live updates).', 'realtime socket'),
  e('webhook', 'Webhook', 'devops', glyph('webhook'), '#a855f7', 'The server calls you on an event; verify signatures, handle retries.', 'callback'),
  e('socketio', 'Socket.IO', 'devops', brand('socketdotio'), '#64748b', 'Realtime library with fallbacks and rooms.', 'websocket realtime'),
  e('github', 'GitHub', 'devops', brand('github'), '#64748b', 'Source hosting.', 'git'),
  e('github-actions', 'GitHub Actions', 'devops', brand('githubactions'), '#2088ff', 'CI/CD workflows.', 'ci cd'),
  e('gitlab', 'GitLab', 'devops', brand('gitlab'), '#fc6d26', 'Source hosting and CI/CD.', 'git ci'),
  e('jenkins', 'Jenkins', 'devops', brand('jenkins'), '#d24939', 'Self-hosted CI server.', 'ci'),
  e('argo', 'Argo CD', 'devops', brand('argo'), '#ef7b4d', 'GitOps deployments to Kubernetes.', 'gitops cd'),
  e('swagger', 'OpenAPI / Swagger', 'devops', brand('swagger'), '#5fb31e', 'API description and docs.', 'openapi'),
  e('postman', 'Postman', 'devops', brand('postman'), '#ff6c37', 'API client and testing.', 'api testing'),
];

export const TECH_BY_ID = Object.fromEntries(TECH.map((entry) => [entry.id, entry]));

/**
 * How well `{ id, name, keywords, about }` matches a trimmed, lower-cased query:
 * 3 name starts with it, 2 name contains it, 1.5 keywords or id, 1 description, 0 no match.
 * Shared by the whole library (`library/search.js`) so every tab ranks the same way.
 */
export function matchScore(q, { id, name, keywords = '', about = '' }) {
  const lower = name.toLowerCase();
  if (lower.startsWith(q)) return 3;
  if (lower.includes(q)) return 2;
  if (keywords.includes(q) || id.includes(q)) return 1.5;
  if (about.toLowerCase().includes(q)) return 1;
  return 0;
}

/** `[score, entry]` for every entry that matches, best first; `fields(entry)` supplies what `matchScore` reads. */
export function rankMatches(q, entries, fields = (entry) => entry) {
  const scored = [];
  for (const entry of entries) {
    const score = matchScore(q, fields(entry));
    if (score) scored.push([score, entry]);
  }
  return scored.sort((a, b) => b[0] - a[0]);
}

/** Catalogue entries matching a search, best matches first (name start, name, keywords/about). */
export function searchTech(query, entries = TECH) {
  const q = query.trim().toLowerCase();
  if (!q) return entries;
  return rankMatches(q, entries).map(([, entry]) => entry);
}
