import { asked, code, diagram, h, links, p, quick, sql, table, tip, tradeoff, warn, wiki } from '../blocks.js';
import { seeAlso } from './shapes.js';

export const doc = {
  blocks: [
    p(
      'An index is a second copy of some of your data, kept sorted so a lookup does not have to read everything. The two structures underneath — **B-tree and LSM-tree** — are optimised for opposite workloads, and knowing which one you are on explains most of a database\'s performance character.',
    ),

    h('B-tree versus LSM-tree'),
    diagram(
      `
   B-TREE                            LSM-TREE
   update in place                   append, merge later

        ┌───────┐                    write ──▶ ┌──────────┐
        │  50   │                              │ memtable │ (RAM,
        └───┬───┘                              └────┬─────┘  sorted)
       ┌────┴────┐                                  │ flush
   ┌───▼──┐  ┌───▼──┐                               ▼
   │10,30 │  │70,90 │                          ┌──────────┐ L0
   └──────┘  └──────┘                          │  SSTable │
                                               └────┬─────┘
   write ──▶ find the page                          │ compact
          ──▶ read it                               ▼
          ──▶ modify                           ┌──────────┐ L1
          ──▶ write it back                    │  SSTable │
              (random I/O)                     └──────────┘

   ✓ reads are one path down        ✓ writes are SEQUENTIAL — fast
   ✓ predictable read latency       ✓ great compression
   ✗ random writes are slow         ✗ a read may check several levels
   ✗ pages fragment                 ✗ compaction competes for I/O
`,
      'Two ways to keep data sorted',
    ),
    table(
      ['', 'B-tree', 'LSM-tree'],
      [
        ['Write path', 'Random I/O, in place', '**Sequential append**'],
        ['Write throughput', 'Moderate', '**High**'],
        ['Read latency', '**Predictable**', 'Variable — may check several levels'],
        ['Write amplification', 'Lower', 'Higher — compaction rewrites data repeatedly'],
        ['Space amplification', 'Fragmentation, partly empty pages', 'Better compression; obsolete copies until compaction'],
        ['Latency spikes', 'Rare', '**Compaction stalls**'],
        ['Used by', 'Postgres, MySQL/InnoDB, Oracle', 'Cassandra, RocksDB, LevelDB, ScyllaDB'],
      ],
    ),
    tip(
      'The rule of thumb: **write-heavy and append-only favours LSM; read-heavy with predictable latency favours B-tree.** A time-series or event store is LSM-shaped; a transactional application database is B-tree-shaped, and that is why the defaults are what they are.',
    ),

    h('What an index actually costs'),
    tradeoff([
      ['**An index**', 'Turns a table scan into a lookup; can satisfy a query without touching the table at all', 'Every insert, update and delete must maintain it; it takes disk and memory; the optimiser has more to consider'],
    ]),
    table(
      ['Cost', 'Detail'],
      [
        ['Write cost', 'Five indexes means a write does **six** structures'],
        ['Disk and memory', 'An index on a wide column can rival the table'],
        ['Maintenance', 'Fragmentation, and stale statistics misleading the planner'],
        ['Unused indexes', 'All cost, no benefit — and they are surprisingly common'],
      ],
    ),
    warn(
      'Auditing for **unused indexes** is one of the highest-value, lowest-effort database tasks available. Every engine can report index usage, and a table with eight indexes of which three are never read is paying three times the write cost for nothing.',
    ),

    h('Covering indexes'),
    code(
      sql(`
-- The query
SELECT user_id, status, total
FROM orders
WHERE user_id = 42 AND status = 'shipped';

-- An ordinary index: find the rows, then fetch each from the table
CREATE INDEX idx_user_status ON orders (user_id, status);

-- A COVERING index: every column the query needs is in the index,
-- so the table is never touched. One structure read, not two.
CREATE INDEX idx_user_status_total ON orders (user_id, status)
  INCLUDE (total);            -- Postgres / SQL Server
-- MySQL: put it in the key instead — (user_id, status, total)
`),
    ),
    p(
      'The saving is real: an index lookup followed by a table fetch is **two random reads per row**, and a covering index is one sequential read of a much smaller structure. On a hot query it is often a bigger win than adding the index was in the first place.',
    ),

    h('Composite index order matters'),
    diagram(
      `
   INDEX (a, b, c)  — sorted by a, then b, then c

   usable for              NOT usable for
   ──────────              ──────────────
   WHERE a = ?             WHERE b = ?
   WHERE a = ? AND b = ?   WHERE c = ?
   WHERE a = ? AND b = ?   WHERE b = ? AND c = ?
         AND c = ?
   WHERE a = ? AND c = ?   ← uses only the 'a' part
         (leftmost prefix rule)

   think of a phone book sorted by (surname, forename):
     "everyone called Patel"        ✓
     "everyone called Patel, Asha"  ✓
     "everyone called Asha"         ✗ — scan the whole book
`,
      'The leftmost prefix rule',
    ),
    table(
      ['Put first', 'Why'],
      [
        ['Equality columns before range columns', 'A range stops the index being usable for anything after it'],
        ['The most selective column, usually', 'It narrows fastest — though the prefix rule matters more'],
        ['The column you always filter on', 'A prefix that is sometimes absent makes the index unusable'],
      ],
    ),

    h('When an index does not help'),
    table(
      ['Situation', 'Why'],
      [
        ['Low cardinality', '`WHERE active = true` matching 90% of rows — a scan is cheaper'],
        ['A function on the column', '`WHERE LOWER(email) = ?` cannot use an index on `email`. Index the expression'],
        ['Leading wildcard', '`LIKE \'%foo\'` has no prefix to seek to'],
        ['Type mismatch', 'A string compared to a number forces a cast and drops the index'],
        ['A small table', 'Reading the whole thing is one page'],
        ['`OR` across different columns', 'Often two scans; a union of two indexed queries can be faster'],
      ],
    ),

    h('Write amplification'),
    p(
      'One logical write becomes many physical ones: the write-ahead log, the table page, every index, the replication stream, and — on LSM engines — **every compaction level the data passes through**. Amplification of 10–30x is normal, and it is why a database\'s write ceiling is so much lower than its disk\'s.',
    ),
    tip(
      'This is the number to quote when asked why a database only does a few thousand writes a second on hardware that can do far more. **The disk is not the limit; the amplification is.**',
    ),

    h('Interview'),
    quick([
      ['What it is', 'Sorted structures that turn scans into lookups, and the engines beneath them'],
      ['Why it matters', 'Adding an index is the first fix for a slow database, and it is not free'],
      ['Use when', 'Before caching and long before sharding'],
      ['Trade-off', 'Faster reads, slower writes, and more disk'],
      [
        '30-second answer',
        '"B-trees update in place — predictable reads, random writes — and suit transactional work. LSM-trees append sequentially and compact in the background, so writes are fast and reads check several levels, which suits write-heavy data. An index costs a write on every mutation, so audit for unused ones. Composite indexes follow the leftmost prefix rule, and a covering index avoids the table entirely. Write amplification is why a database does thousands, not millions, of writes a second."',
      ],
    ]),
    asked([
      ['B-tree or LSM?', 'B-tree for read-heavy transactional work with predictable latency. LSM for write-heavy and append-only.'],
      ['What is a covering index?', 'One containing every column the query needs, so the table is never read.'],
      ['Why does column order matter?', 'The leftmost prefix rule — an index on (a,b,c) cannot serve a query filtering only on b.'],
      ['When does an index not help?', 'Low cardinality, a function on the column, a leading wildcard, or a very small table.'],
      ['What is write amplification?', 'One logical write becoming many physical ones — WAL, table, every index, replication, compaction.'],
    ]),

    seeAlso('SQL', 'Indexes', 'index types, EXPLAIN output and reading a query plan'),
    links(
      wiki('B-tree', 'B-tree'),
      wiki('Log-structured_merge-tree', 'LSM-tree'),
    ),
  ],
};
