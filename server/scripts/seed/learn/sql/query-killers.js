import {
  asked,
  cheat,
  code,
  h,
  js,
  link,
  links,
  mysqlDoc,
  p,
  pgDoc,
  result,
  sql,
  table,
  tip,
  warn,
} from '../blocks.js';

/*
  A list, and unapologetically so — this is the topic you scan when something is
  slow. Every entry is the same shape: the query, why it is slow, the rewrite.
  Ten of them, ordered by how often they turn out to be the answer.
*/
export const doc = {
  blocks: [
    p(
      'Ten things that make a query slow, in roughly the order they turn out to be the cause. Each is the same shape: the symptom, the reason, the rewrite. Nine of the ten are about **stopping the database using an index it already has** — because that is what almost all of them are.',
    ),

    h('1 · A function on the filtered column'),
    p('The most common of all, and the most reliably fixable.'),
    code(
      sql(`
-- Slow: every row must have YEAR() computed before it can be compared.
WHERE YEAR(hired_on) = 2021
WHERE UPPER(name) = 'ADA'
WHERE DATE(created_at) = '2024-03-01'
WHERE salary * 12 > 1000000

-- Fast: the raw column is compared, so the index can seek.
WHERE hired_on >= '2021-01-01' AND hired_on < '2022-01-01'
WHERE name = 'Ada'                      -- with a case-insensitive collation
WHERE created_at >= '2024-03-01' AND created_at < '2024-03-02'
WHERE salary > 83333.33
`),
    ),
    p(
      'An index stores the **raw** values, in sorted order. `YEAR(hired_on)` is not in the index, so the engine has no choice but to read every row and compute it. Move the arithmetic to the other side of the comparison and the column is bare again.',
    ),
    tip(
      'When the function is genuinely unavoidable — case-insensitive matching in a case-sensitive collation, say — index the expression instead: `CREATE INDEX idx ON employees((LOWER(name)))`. Then `WHERE LOWER(name) = \'ada\'` uses it. Postgres has had expression indexes for years; MySQL 8 supports them via functional indexes.',
    ),

    h('2 · A leading wildcard'),
    code(
      sql(`
WHERE name LIKE '%ada%'      -- full scan, always
WHERE name LIKE 'ada%'       -- index range scan
`),
    ),
    p(
      'An index is sorted, so "starts with ada" is a contiguous range and "contains ada" is not — a matching value could be anywhere in the order. No index can help, and no rewrite of the `LIKE` will change that.',
    ),
    code(
      sql(`
-- Full-text search is the actual answer.
ALTER TABLE articles ADD FULLTEXT INDEX ft_body (body);
SELECT * FROM articles WHERE MATCH(body) AGAINST('database' IN NATURAL LANGUAGE MODE);

-- PostgreSQL: a GIN index over tsvector.
CREATE INDEX idx_body ON articles USING GIN (to_tsvector('english', body));
SELECT * FROM articles WHERE to_tsvector('english', body) @@ to_tsquery('database');

-- Or a trigram index, which does make LIKE '%x%' indexable.
CREATE EXTENSION pg_trgm;
CREATE INDEX idx_name_trgm ON employees USING GIN (name gin_trgm_ops);
`),
    ),

    h('3 · The N+1 query'),
    warn(
      'The most expensive mistake on this page, and the one least visible in SQL — because each individual query is fast. It lives in application code, and it is one query for the list plus one *per row*.',
    ),
    code(
      js(`
// 1 + 1000 queries, and each one is a network round trip.
const employees = await db.query('SELECT * FROM employees');
for (const e of employees) {
  e.department = await db.query('SELECT * FROM departments WHERE id = ?', [e.dept_id]);
}
`),
    ),
    code(
      js(`
// One query.
const rows = await db.query(\`
  SELECT e.*, d.name AS dept_name
  FROM employees e
  LEFT JOIN departments d ON e.dept_id = d.id
\`);

// Or two, when a join would multiply rows — the batched form.
const employees = await db.query('SELECT * FROM employees');
const ids = [...new Set(employees.map((e) => e.dept_id).filter(Boolean))];
const depts = await db.query('SELECT * FROM departments WHERE id IN (?)', [ids]);
`),
    ),
    tip(
      'Each of the thousand queries takes a millisecond, so nothing looks slow in a profiler that shows query times. What is slow is 1,000 round trips — a second of pure latency for data one join would have returned. The tell is a **query count that scales with the result size**; log it per request and the problem becomes visible immediately. Every ORM has an eager-loading option (`include`, `joinedload`, `with`) that exists for exactly this.',
    ),

    h('4 · SELECT *'),
    code(
      sql(`
-- Slow: reads every column, so a covering index cannot be used.
SELECT * FROM employees WHERE dept_id = 1;

-- Fast: answered from an index on (dept_id, name, salary) without touching the table.
SELECT name, salary FROM employees WHERE dept_id = 1;
`),
    ),
    table(
      ['cost', 'detail'],
      [
        ['Breaks covering indexes', 'One index traversal becomes one traversal plus a random read per row.'],
        ['Moves unwanted data', 'A `TEXT` body column crosses the network on every row of a list page.'],
        ['Blocks index-only scans', 'The single biggest available win on a wide table.'],
        ['Breaks silently', 'A new column changes your result shape.'],
      ],
    ),

    h('5 · Type mismatch'),
    code(
      sql(`
-- phone is VARCHAR. Comparing it to a number makes MySQL convert
-- THE COLUMN, row by row — a function on the column by another name.
WHERE phone = 9001        -- index unused
WHERE phone = '9001'      -- index used
`),
    ),
    warn(
      'This one hides better than any other item here, because the query returns **correct results** — nothing is wrong except the speed, and nothing in the code points at it. Only the plan shows it. It also happens across a join when two tables define the same id as `INT` and `BIGINT`, or with different collations.',
    ),

    h('6 · OR across different columns'),
    code(
      sql(`
-- One index cannot serve both branches.
SELECT * FROM employees WHERE dept_id = 1 OR salary > 90000;

-- Two indexed queries, combined.
SELECT * FROM employees WHERE dept_id = 1
UNION
SELECT * FROM employees WHERE salary > 90000;
`),
    ),
    p(
      '`UNION` deduplicates, which matters here — a row matching both branches would otherwise appear twice. Postgres often does this itself with a `BitmapOr`; MySQL\'s index merge is available and rarely chosen.',
    ),

    h('7 · Deep OFFSET'),
    code(
      sql(`
-- Generates 100,020 rows and discards 100,000 of them.
SELECT * FROM employees ORDER BY id LIMIT 20 OFFSET 100000;

-- Keyset pagination: seeks straight to the position. Constant cost.
SELECT * FROM employees WHERE id > 100000 ORDER BY id LIMIT 20;
`),
    ),
    p(
      'The cost of `OFFSET n` is proportional to `n`, so page 5,000 is five thousand times the work of page 1 — and it is the same query, which is why nobody suspects it. Keyset pagination is covered in the ordering topic.',
    ),

    h('8 · An unindexed join or foreign key'),
    code(
      sql(`
-- Without an index on employees.dept_id, the join is a scan per row.
SELECT e.name, d.name FROM employees e JOIN departments d ON e.dept_id = d.id;

CREATE INDEX idx_employees_dept ON employees(dept_id);
`),
    ),
    warn(
      '**PostgreSQL does not index the referencing column of a foreign key.** It indexes the referenced primary key, because it must, and leaves the child column bare — so every join from the child side, and every `ON DELETE` check, scans the child table. MySQL/InnoDB creates that index automatically with the constraint. This is one of the most common missing indexes in a Postgres schema, and it is invisible because the constraint looks like it did the work.',
    ),

    h('9 · Sorting or grouping without a supporting index'),
    code(
      sql(`
-- Sorts the whole result to return ten rows: "Using filesort".
SELECT * FROM employees ORDER BY salary DESC LIMIT 10;

-- The index is already in that order — the sort disappears.
CREATE INDEX idx_salary ON employees(salary DESC);

-- Filter and sort together, in that order.
CREATE INDEX idx_dept_salary ON employees(dept_id, salary DESC);
SELECT * FROM employees WHERE dept_id = 1 ORDER BY salary DESC LIMIT 10;
`),
    ),
    p(
      'The column order is the whole thing: **equality columns first, then the sort column.** `(dept_id, salary)` filters and then reads in salary order. `(salary, dept_id)` does neither well.',
    ),

    h('10 · Doing it row by row'),
    code(
      sql(`
-- A cursor: one UPDATE per row, each with its own index maintenance and logging.
DECLARE cur CURSOR FOR SELECT id FROM employees WHERE dept_id = 1;
-- ... LOOP ... UPDATE employees SET salary = salary * 1.1 WHERE id = v_id; ...

-- One statement.
UPDATE employees SET salary = salary * 1.1 WHERE dept_id = 1;
`),
    ),
    p(
      'The same applies in application code: a loop issuing one `INSERT` per iteration should be one multi-row `INSERT`, or a bulk load. The difference is not a percentage.',
    ),
    tip(
      'The exception is a genuinely huge write. `UPDATE` over ten million rows is one transaction holding ten million locks, and it will block everything and may exhaust the undo log. Batch it — `UPDATE … WHERE id BETWEEN ? AND ? LIMIT 10000` in a loop, committing between batches. That is set-based *within* each batch, which is the part that matters.',
    ),

    h('The others, briefly'),
    table(
      ['problem', 'fix'],
      [
        ['`WHERE col != x`', 'Negation matches most rows; a scan may genuinely be correct.'],
        ['`NOT IN` over a nullable column', '`NOT EXISTS` — different answer *and* a better plan.'],
        ['`DISTINCT` hiding a bad join', 'A join multiplying rows, then deduplicated. Fix the join.'],
        ['`ORDER BY RAND()`', 'Sorts the whole table. Pick a random id range instead.'],
        ['A correlated subquery in `SELECT`', 'A window function, or a join to a grouped derived table.'],
        ['Too many indexes', 'Every write maintains all of them. Drop the unused ones.'],
        ['Stale statistics', '`ANALYZE`.'],
        ['A transaction left open', 'Blocks writers and, in Postgres, blocks vacuum database-wide.'],
      ],
    ),

    h('Finding the slow ones'),
    code(
      sql(`
-- PostgreSQL: total time by query shape. The single best query on this page.
CREATE EXTENSION pg_stat_statements;
SELECT calls, mean_exec_time, total_exec_time, query
FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 20;

-- MySQL: the same idea.
SELECT digest_text, count_star, avg_timer_wait/1e9 AS avg_ms
FROM performance_schema.events_statements_summary_by_digest
ORDER BY sum_timer_wait DESC LIMIT 20;

-- Or the slow query log.
SET GLOBAL slow_query_log = 1;
SET GLOBAL long_query_time = 1;
`),
    ),
    result(
      ['calls', 'mean_exec_time', 'total_exec_time', 'query'],
      [
        ['`1240000`', '`0.8`', '**`992000`**', 'SELECT * FROM departments WHERE id = $1'],
        ['`12`', '`4200`', '`50400`', 'SELECT … FROM orders JOIN …'],
      ],
      'Ordered by total time, not average',
    ),
    tip(
      '**Order by total time, not average.** The first row there is an N+1: 0.8 ms is fast, and 1.24 million calls make it the most expensive thing in the database by a factor of twenty. Sorted by mean, it would be on the last page and the four-second query would look like the problem. This one ordering decision is why `pg_stat_statements` finds things that reading the slow log does not.',
    ),

    h('Interview'),
    asked([
      ['Why does a function on a column stop the index working?', 'The index holds raw values; the function must be computed per row before comparing.'],
      ['How do you filter by year and keep the index?', 'A half-open date range, not `YEAR(col) = n`.'],
      ['Why is `LIKE \'%x%\'` slow?', 'A sorted index cannot locate a substring; matches can be anywhere in the order. Use full-text or trigram indexes.'],
      ['What is the N+1 problem?', 'One query per row of a result set. Fix with a join or a batched `IN`.'],
      ['Why is it hard to spot?', 'Each query is fast; the cost is a query count that scales with the result size.'],
      ['Why avoid SELECT *?', 'It breaks covering indexes, moves unneeded data, and changes shape silently.'],
      ['How can a type mismatch cause a scan?', 'The engine converts the column per row to compare — a function on the column, with correct results and no clue.'],
      ['Why is deep OFFSET slow?', 'Every skipped row is generated and discarded; cost grows with the offset.'],
      ['Does PostgreSQL index foreign keys?', 'It indexes the referenced primary key only. The referencing column needs an index you create.'],
      ['How do you avoid a filesort?', 'An index covering the WHERE columns then the ORDER BY columns, in that order.'],
      ['How do you find your slowest queries?', 'pg_stat_statements or performance_schema, ordered by **total** time.'],
      ['Why total rather than average?', 'A 0.8 ms query called a million times costs more than a four-second one called twelve times.'],
    ]),

    h('Cheatsheet'),
    cheat([
      ['Filter on a date part', 'A range, not `YEAR(col)`'],
      ['Case-insensitive match', 'A collation, or an expression index'],
      ['Search inside text', 'Full-text or trigram, not `LIKE \'%x%\'`'],
      ['Load related rows', 'One join, or one batched `IN` — never a loop'],
      ['List page', 'Name the columns; let an index cover it'],
      ['Compare to a string column', 'Quote the literal'],
      ['`OR` on two columns', '`UNION` of two indexed queries'],
      ['Page deeply', 'Keyset, not `OFFSET`'],
      ['Join', 'Index the child-side column — always in Postgres'],
      ['Sort', 'Index `WHERE` columns then `ORDER BY` columns'],
      ['Update many rows', 'One statement, batched if huge'],
      ['Find the real problem', '`pg_stat_statements`, by total time'],
    ]),

    links(
      pgDoc('pgstatstatements.html', 'pg_stat_statements'),
      mysqlDoc('slow-query-log.html', 'The slow query log (MySQL)'),
      link('Use The Index, Luke', 'https://use-the-index-luke.com/'),
    ),
  ],
};
