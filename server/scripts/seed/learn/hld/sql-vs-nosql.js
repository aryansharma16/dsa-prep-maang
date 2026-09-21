import { asked, diagram, h, links, p, quick, table, tip, tradeoff, warn, wiki } from '../blocks.js';
import { seeAlso } from './shapes.js';

export const doc = {
  blocks: [
    p(
      'The most common question in a design round, and the most commonly answered badly. "NoSQL scales better" is **not a reason** — a well-sharded relational database scales fine, and the real decision is about the shape of your data and your queries.',
    ),

    h('The actual difference'),
    diagram(
      `
   RELATIONAL                        NON-RELATIONAL

   design the SCHEMA                 design the ACCESS PATTERNS
   then write any query              then store data to match them

   users ──┬── orders ──── items     order_by_user:
           └── addresses               PK: user#42
                                       SK: order#2024-01-15
   "any question I have not              { everything needed
    thought of yet is a JOIN"              to render the row }

   ✓ flexible queries                ✓ every read is one lookup
   ✓ one copy of the truth           ✓ scales horizontally by design
   ✗ joins do not shard              ✗ a new query may need a new
   ✗ writes bound by one primary       table, and a backfill
`,
      'Schema-first versus query-first',
    ),
    tip(
      'That is the sentence worth saying: **relational is schema-first, non-relational is query-first.** It explains why a NoSQL design that starts with entities always goes wrong, and why a relational design copes with a question nobody anticipated.',
    ),

    h('The decision table'),
    table(
      ['Signal', 'Points to'],
      [
        ['Queries are unknown or will change', '**SQL** — you can write a new one tomorrow'],
        ['Relationships and joins are central', '**SQL**'],
        ['Multi-row transactions matter', '**SQL** — money, inventory, bookings'],
        ['Strong consistency is a requirement', '**SQL** (or a CP NoSQL store)'],
        ['Access patterns are few and fixed', '**NoSQL**'],
        ['Writes exceed one primary, permanently', '**NoSQL**, or a sharded SQL'],
        ['Each item is self-contained', '**NoSQL** — document or key-value'],
        ['Scale is genuinely enormous and uniform', '**NoSQL**'],
        ['You are not sure', '**SQL.** It is the recoverable mistake'],
      ],
    ),
    warn(
      'That last row is the honest default. **Migrating from Postgres to DynamoDB is hard; migrating the other way is harder** — you have built application code around one access pattern and the data is denormalised into a shape only that pattern can use.',
    ),

    h('The families'),
    table(
      ['Family', 'Shape', 'Good at', 'Examples'],
      [
        ['**Key-value**', '`key → blob`', 'Sessions, caches, simple lookups at huge scale', 'Redis, DynamoDB, Memcached'],
        ['**Document**', '`key → JSON`', 'Self-contained objects with varying fields', 'MongoDB, Couchbase, Firestore'],
        ['**Wide-column**', '`row key → sparse columns`', 'Enormous write volume, time-series, per-row flexibility', 'Cassandra, HBase, Bigtable'],
        ['**Graph**', 'Nodes and edges', 'Traversals — "friends of friends", fraud rings', 'Neo4j, Neptune'],
        ['**Time-series**', 'Timestamped points', 'Metrics, IoT, anything append-only by time', 'InfluxDB, TimescaleDB, Prometheus'],
        ['**Search**', 'Inverted index', 'Text relevance, facets, fuzzy matching', 'Elasticsearch, OpenSearch'],
      ],
    ),
    p(
      'Wide-column is the one worth understanding properly, because it is the family people mean by "NoSQL at scale". **A Cassandra table is a partition key plus a clustering key**, and that pair decides every query it can answer — there is no other way in.',
    ),

    h('What you give up'),
    tradeoff([
      ['**Relational**', 'Joins, transactions, constraints, ad-hoc queries, one copy of the truth', 'Write throughput bound by one primary; sharding is a project'],
      ['**Non-relational**', 'Horizontal write scaling, predictable latency, flexible per-item schema', 'No joins, limited transactions, denormalisation, data can disagree with itself'],
    ]),
    table(
      ['Lose', 'Live with it by'],
      [
        ['`JOIN`', 'Denormalising, or joining in the application'],
        ['Multi-row transactions', 'Designing so writes touch one item; sagas otherwise'],
        ['Foreign keys and constraints', 'Enforcing them in the application, and accepting drift'],
        ['Ad-hoc queries', 'Adding a table, or a search index, per new question'],
        ['One copy of the truth', 'Accepting that copies can disagree, and fixing them in batch'],
      ],
    ),

    h('The modern middle'),
    p(
      'The boundary has blurred and the interview answer should say so. Postgres has `JSONB` with indexes, arrays, full-text search and logical replication — **so "I need a flexible schema" is no longer a reason to leave it.** And NewSQL stores offer horizontal scaling with real transactions.',
    ),
    table(
      ['Option', 'What it is'],
      [
        ['**Postgres + JSONB**', 'Relational, with a document column where the schema genuinely varies'],
        ['**NewSQL** (CockroachDB, Spanner, TiDB)', 'Distributed SQL with real transactions; pay in latency and cost'],
        ['**Managed serverless** (Aurora, DynamoDB)', 'Someone else does the operating'],
        ['**Polyglot persistence**', 'Postgres for core data, Redis for cache, Elasticsearch for search'],
      ],
    ),
    tip(
      'Polyglot persistence is the realistic answer for most systems, and naming it is a strong move: **relational for the core, a cache for speed, a search index for text, object storage for blobs.** Each store is used for what it is good at, rather than one store forced to be all four.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'Choosing between schema-first and query-first data stores'],
      ['Why it matters', 'It is the decision everything else in the data layer follows from'],
      ['Use when', 'Right after the data model, before you draw the services'],
      ['Trade-off', 'SQL gives flexibility and transactions; NoSQL gives write scale and denormalisation'],
      [
        '30-second answer',
        '"Relational is schema-first — design the schema, then write any query. Non-relational is query-first — design the access patterns, then store data to match. So choose SQL when queries will change, relationships matter, or transactions do; choose NoSQL when access patterns are few and fixed and writes exceed one primary. \\"It scales better\\" is not a reason. And in practice most systems are polyglot: Postgres for the core, Redis for cache, Elasticsearch for search."',
      ],
    ]),
    asked([
      ['SQL or NoSQL for this system?', 'Depends on whether queries are known and fixed. Unknown queries and real transactions mean SQL.'],
      ['Is NoSQL faster?', 'For its designed access pattern, yes. For anything else it is slower or impossible.'],
      ['What are the NoSQL families?', 'Key-value, document, wide-column, graph, time-series and search. Each solves a different shape.'],
      ['Why is denormalisation necessary in NoSQL?', 'There are no joins, so everything a read needs must already be in the item.'],
      ['What if you are unsure?', 'Relational. It is the recoverable mistake — the migration out is easier than the migration back.'],
    ]),

    seeAlso('SQL', 'What a database is', 'the relational model, keys, normalisation and the query language itself'),
    links(wiki('NoSQL', 'NoSQL'), wiki('Relational_database', 'Relational database')),
  ],
};
