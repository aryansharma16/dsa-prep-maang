import { asked, diagram, flow, h, links, p, quick, table, tip, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Two workloads with opposite shapes: **OLTP touches a few rows very often, OLAP touches every row occasionally**. Running them on the same database means one of them is always the wrong shape, and it is usually the one paying your salary that suffers.',
    ),

    h('The two shapes'),
    table(
      ['', 'OLTP', 'OLAP'],
      [
        ['Query', '"This user\'s last 20 orders"', '"Revenue by region by month, 3 years"'],
        ['Rows touched', 'A handful', '**Millions to billions**'],
        ['Columns touched', 'Most of the row', '**Three of forty**'],
        ['Frequency', 'Thousands/second', 'A few per minute'],
        ['Latency target', 'Milliseconds', 'Seconds to minutes is fine'],
        ['Writes', 'Constant, small', 'Bulk loads'],
        ['Storage', '**Row-oriented**', '**Column-oriented**'],
        ['Example', 'Postgres, MySQL, DynamoDB', 'BigQuery, Snowflake, Redshift, ClickHouse'],
      ],
    ),

    h('Why columnar wins for analytics'),
    diagram(
      `
   SELECT region, SUM(total) FROM orders GROUP BY region

   ROW STORE — rows are contiguous on disk
   ┌────────────────────────────────────────────────┐
   │ id,user,region,total,status,created,address,...│  ← read ALL of
   │ id,user,region,total,status,created,address,...│    this to get
   │ id,user,region,total,status,created,address,...│    two columns
   └────────────────────────────────────────────────┘

   COLUMN STORE — columns are contiguous
   ┌──────┬──────┬────────┬───────┬────────┬─────────┐
   │  id  │ user │ region │ total │ status │ created │
   │      │      │ ██████ │ █████ │        │         │
   └──────┴──────┴────────┴───────┴────────┴─────────┘
                    read only these two

   ✓ ~20x less I/O for a query touching 2 of 40 columns
   ✓ a column of one type compresses 10x better
   ✓ vectorised execution over contiguous values
   ✗ reading one whole row means touching every column
`,
      'Same data, opposite layout',
    ),
    tip(
      'Compression is the underrated half. A column of `region` values is thousands of repeats of a handful of strings — **dictionary encoding turns it into almost nothing**, whereas the same values scattered through rows compress poorly. Less data on disk is less I/O, which is most of the speed.',
    ),

    h('Why they must be separated'),
    warn(
      'One analytics query scanning three years of orders will **evict your entire buffer pool**, hold a read snapshot open for minutes, and — on an MVCC engine — block cleanup of every version created while it runs. The checkout page gets slow, and the cause is a dashboard nobody was watching.',
    ),
    table(
      ['Separation', 'Cost', 'Good for'],
      [
        ['**Read replica for analytics**', 'Almost none', 'Small scale; keeps row storage, so still slow'],
        ['**Nightly dump to a warehouse**', 'Data is up to a day old', 'Most companies. Simple and cheap'],
        ['**CDC streaming into a warehouse**', 'A pipeline to operate', 'Near-real-time analytics'],
        ['**HTAP database**', 'Cost and complexity', 'Where the two genuinely cannot be separated'],
      ],
    ),

    h('Getting the data across'),
    flow(['OLTP', 'CDC or batch extract', 'Raw zone', 'Transform', 'Warehouse'], 'The pipeline'),
    table(
      ['', 'ETL', 'ELT'],
      [
        ['Order', 'Extract, transform, **then** load', 'Extract, load, **then** transform'],
        ['Transform runs', 'In a separate processing tier', 'In the warehouse itself'],
        ['Raw data kept', 'Usually not', '**Yes** — reprocess when logic changes'],
        ['Why it won', '—', 'Warehouse compute became cheap and elastic'],
      ],
    ),
    p(
      'ELT is the modern default for one reason: **keeping the raw data means a transformation bug is re-runnable.** With ETL, the untransformed data is gone and the mistake is permanent.',
    ),

    h('Change data capture'),
    diagram(
      `
   the database's own replication log is the event stream

   ┌──────────┐   WAL / binlog   ┌──────────┐   ┌────────────┐
   │ Postgres │─────────────────▶│ Debezium │──▶│   Kafka    │
   └──────────┘                  └──────────┘   └─────┬──────┘
                                                      │
                            ┌─────────────────────────┼──────────┐
                            ▼                         ▼          ▼
                       warehouse            search index      cache
                                                             invalidation

   ✓ no application code involved — it cannot forget
   ✓ no dual-write problem
   ✓ ordered, complete, replayable
   ✗ the log is coupled to the database's internals
   ✗ a schema change flows through and breaks consumers
`,
      'Reading the log instead of the tables',
    ),
    tip(
      'CDC is worth knowing beyond analytics: **it is the reliable way to keep a search index, a cache and a warehouse in step**, because the event comes from the database itself rather than from application code that might forget to publish it.',
    ),

    h('Warehouse and lake'),
    table(
      ['Term', 'Is', 'Schema'],
      [
        ['**Data warehouse**', 'Structured, modelled, query-ready', 'On write'],
        ['**Data lake**', 'Raw files in object storage', 'On read'],
        ['**Lakehouse**', 'Lake storage with warehouse semantics (Iceberg, Delta)', 'On read, with transactions'],
        ['**Data mart**', 'A slice of the warehouse for one team', 'On write'],
      ],
    ),

    h('Interview'),
    quick([
      ['What it is', 'Transactional and analytical workloads, and why they need different stores'],
      ['Why it matters', 'Analytics on a production database degrades the product'],
      ['Use when', 'Asked about reporting, dashboards or "how do we analyse this?"'],
      ['Trade-off', 'A separate warehouse costs a pipeline and staleness, and protects the transactional path'],
      [
        '30-second answer',
        '"OLTP reads a few rows very often and is row-oriented; OLAP scans billions of rows across a few columns and is column-oriented, which is roughly twenty times less I/O plus much better compression. They must be separated, because one analytics query evicts the buffer pool and pins MVCC versions, and the checkout page gets slow. Data moves across by nightly batch or by CDC reading the replication log — which is also the reliable way to keep a search index and cache in step."',
      ],
    ]),
    asked([
      ['Why do analytics need a separate database?', 'A full scan evicts the buffer pool and holds a long snapshot, degrading the transactional workload.'],
      ['Why is columnar faster for analytics?', 'It reads only the columns queried, and a single-type column compresses far better.'],
      ['ETL or ELT?', 'ELT, usually. Keeping raw data means a transformation bug can be re-run rather than being permanent.'],
      ['What is CDC?', 'Reading the database replication log as an event stream — no application code, so it cannot forget.'],
      ['Warehouse or lake?', 'Warehouse is modelled and schema-on-write; a lake is raw files with schema-on-read. A lakehouse is both.'],
    ]),

    links(
      wiki('Online_analytical_processing', 'OLAP'),
      wiki('Change_data_capture', 'Change data capture'),
    ),
  ],
};
