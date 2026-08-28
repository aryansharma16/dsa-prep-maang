import {
  asked,
  cheat,
  code,
  h,
  links,
  mysql,
  mysqlDoc,
  note,
  p,
  pgDoc,
  postgres,
  result,
  sql,
  table,
  tip,
  warn,
} from '../blocks.js';

export const doc = {
  blocks: [
    p(
      '`EXPLAIN` shows the plan the optimiser chose. It is the only way to answer "why is this slow" with evidence rather than a guess, and reading one is a skill worth having because the output looks intimidating and is answering about six questions at once.',
    ),

    h('EXPLAIN and EXPLAIN ANALYZE'),
    table(
      ['', '`EXPLAIN`', '`EXPLAIN ANALYZE`'],
      [
        ['Runs the query', '**No**', '**Yes**'],
        ['Row counts', 'Estimated', 'Estimated **and** actual'],
        ['Timings', 'None', 'Per node, in milliseconds'],
        ['Safe on a write', 'Yes', '**No** — it executes it'],
      ],
    ),
    warn(
      '`EXPLAIN ANALYZE UPDATE …` actually performs the update. To see a write plan without doing it, wrap it: `BEGIN; EXPLAIN ANALYZE UPDATE …; ROLLBACK;`.',
    ),

    h('Reading a Postgres plan'),
    code(
      postgres(`
EXPLAIN ANALYZE
SELECT e.name, d.name
FROM employees e
JOIN departments d ON e.dept_id = d.id
WHERE e.salary > 80000;
`),
    ),
    code(
      sql(`
Hash Join  (cost=1.09..2.21 rows=3 width=64) (actual time=0.031..0.038 rows=3 loops=1)
  Hash Cond: (e.dept_id = d.id)
  ->  Seq Scan on employees e  (cost=0.00..1.08 rows=3 width=36)
                               (actual time=0.010..0.012 rows=3 loops=1)
        Filter: (salary > 80000)
        Rows Removed by Filter: 3
  ->  Hash  (cost=1.04..1.04 rows=4 width=36) (actual time=0.008..0.009 rows=4 loops=1)
        ->  Seq Scan on departments d  (cost=0.00..1.04 rows=4 width=36)
                                       (actual time=0.003..0.004 rows=4 loops=1)
Planning Time: 0.184 ms
Execution Time: 0.071 ms
`),
    ),
    p('**Read it inside out and bottom up.** The most indented nodes run first; each feeds its parent.'),
    table(
      ['field', 'means'],
      [
        ['`cost=1.09..2.21`', '**Startup cost..total cost**, in arbitrary units. Only comparable against other nodes of the same plan.'],
        ['`rows=3`', 'The **estimate**. This is the number that matters most.'],
        ['`actual … rows=3`', 'What really happened. Compare it with the estimate.'],
        ['`loops=1`', 'How many times this node ran. **`actual time` is per loop** — multiply it.'],
        ['`Rows Removed by Filter`', 'Rows read and discarded. High here means an index would help.'],
        ['`Planning Time`', 'Time spent choosing the plan.'],
        ['`Execution Time`', 'Time actually running it.'],
      ],
    ),
    tip(
      '`loops` is the field that misleads people. A node showing `actual time=0.5 rows=1 loops=50000` did not take half a millisecond — it took **25 seconds**, because those figures are per loop. A nested loop with a large outer side hides its cost exactly here, and it is the most common misreading of a Postgres plan.',
    ),

    h('The scan types, worst to best'),
    table(
      ['node', 'means', 'verdict'],
      [
        ['`Seq Scan`', 'Read every row.', 'Fine on a small table; a problem on a large one with a selective filter.'],
        ['`Index Scan`', 'Walk the index, fetch each matching row from the table.', 'Good.'],
        ['`Index Only Scan`', 'Answer entirely from the index — the table is never touched.', '**Best.** A covering index.'],
        ['`Bitmap Heap Scan`', 'Collect matching row locations, sort them, then read the table sequentially.', 'Good for a medium number of scattered matches.'],
        ['`Function Scan` / `Values Scan`', 'Rows from a function or a literal list.', 'Neutral.'],
      ],
    ),
    note(
      'A `Seq Scan` is not automatically bad, and assuming otherwise sends people chasing the wrong thing. On six rows it is obviously right. On a query returning 40% of a large table it is *also* right — reading 40% of the rows through an index means 40% of the table in **random** order, which is slower than reading all of it sequentially. The optimiser knows this. A `Seq Scan` is a problem when the filter is genuinely selective and it chose one anyway.',
    ),

    h('The join nodes'),
    table(
      ['node', 'meaning', 'watch for'],
      [
        ['`Nested Loop`', 'For each outer row, probe the inner side.', 'A large `loops` count with an inner `Seq Scan` — the quadratic case.'],
        ['`Hash Join`', 'Build a hash table, probe it.', '`Batches: 4` — the hash did not fit in memory and spilled to disk.'],
        ['`Merge Join`', 'Both sides sorted, walked together.', 'A large explicit `Sort` feeding it.'],
      ],
    ),
    code(
      sql(`
-- The one to recognise on sight.
Nested Loop  (actual time=0.02..8452.11 rows=50000 loops=1)
  ->  Seq Scan on orders  (actual rows=50000 loops=1)
  ->  Seq Scan on customers  (actual time=0.16..0.16 rows=1 loops=50000)
        Filter: (id = orders.customer_id)
`),
    ),
    warn(
      'Fifty thousand sequential scans of `customers`, one per order, because `customers.id` has no usable index — 0.16 ms each is eight and a half seconds. The fix is an index on the inner side, and the tell is always the same: **`loops` in the thousands over a `Seq Scan`**.',
    ),

    h('MySQL EXPLAIN'),
    code(
      mysql(`
EXPLAIN
SELECT e.name, d.name FROM employees e
JOIN departments d ON e.dept_id = d.id
WHERE e.salary > 80000;
`),
    ),
    result(
      ['id', 'select_type', 'table', 'type', 'key', 'rows', 'filtered', 'Extra'],
      [
        ['`1`', 'SIMPLE', 'e', '**ALL**', '`NULL`', '`6`', '`33.33`', 'Using where'],
        ['`1`', 'SIMPLE', 'd', '**eq_ref**', 'PRIMARY', '`1`', '`100.00`', ''],
      ],
    ),
    p('The `type` column is the first thing to look at, and it is an ordered scale:'),
    table(
      ['type', 'means', 'verdict'],
      [
        ['`system` / `const`', 'One row, by primary key or unique index.', '**Best**'],
        ['`eq_ref`', 'One row from this table per row of the previous — a unique index join.', 'Excellent'],
        ['`ref`', 'Several rows matching an index value.', 'Good'],
        ['`range`', 'An index range — `BETWEEN`, `>`, `IN`.', 'Good'],
        ['`index`', 'A full scan **of the index**.', 'Mediocre — better than ALL, still everything'],
        ['`ALL`', 'A full table scan.', '**Worst.** Justify it or fix it.'],
      ],
    ),
    p('And then `Extra`, which is where the real warnings live:'),
    table(
      ['`Extra`', 'means'],
      [
        ['`Using index`', '**Covering index** — the table was never read. The best thing to see.'],
        ['`Using where`', 'Rows were filtered after being read. Normal.'],
        ['`Using filesort`', 'A sort that no index could satisfy. Not necessarily on disk, despite the name.'],
        ['`Using temporary`', 'A temporary table was built — common with `GROUP BY` on an unindexed column.'],
        ['`Using join buffer`', 'No index on the join. **Fix this.**'],
        ['`Impossible WHERE`', 'The optimiser proved no rows can match.'],
      ],
    ),
    tip(
      '`Using temporary; Using filesort` together on a `GROUP BY` is MySQL\'s way of saying it had to materialise the groups and then sort them. On a large table it is usually the whole cost of the query, and an index on the grouping columns removes both at once.',
    ),
    code(
      mysql(`
-- MySQL 8 also has the tree format, and EXPLAIN ANALYZE.
EXPLAIN FORMAT=TREE SELECT …;
EXPLAIN ANALYZE SELECT …;
`),
    ),

    h('Fixing one, start to finish'),
    p('**The problem** — six seconds:'),
    code(
      sql(`
SELECT * FROM employees WHERE YEAR(hired_on) = 2021 ORDER BY salary DESC LIMIT 10;
`),
    ),
    p('**The plan** — three separate things wrong:'),
    result(
      ['type', 'key', 'rows', 'Extra'],
      [['`ALL`', '`NULL`', '`2841203`', 'Using where; Using filesort']],
    ),
    p('**Reading it.** `type: ALL` and `key: NULL` — no index used, 2.8 million rows examined. `Using filesort` — and then all the survivors were sorted, to return ten.'),
    p('**Fix 1: unwrap the column**, so an index on it becomes usable at all:'),
    code(
      sql(`
SELECT * FROM employees
WHERE hired_on >= '2021-01-01' AND hired_on < '2022-01-01'
ORDER BY salary DESC LIMIT 10;
`),
    ),
    p('**Fix 2: index the filter and the sort together**, in that order — equality or range first, then the sort column:'),
    code(sql(`CREATE INDEX idx_hired_salary ON employees(hired_on, salary DESC);`)),
    p('**Fix 3: stop selecting `*`**, so the index can cover the query and the table is never touched:'),
    code(
      sql(`
SELECT id, name, salary, hired_on FROM employees
WHERE hired_on >= '2021-01-01' AND hired_on < '2022-01-01'
ORDER BY salary DESC LIMIT 10;
`),
    ),
    result(
      ['type', 'key', 'rows', 'Extra'],
      [['`range`', 'idx_hired_salary', '`4012`', 'Using where; **Using index**']],
      'The new plan',
    ),
    p('`ALL` → `range`, 2.8 million rows examined → 4,012, and `Using index` means the table was never read. Six seconds to a few milliseconds, from one index and two rewrites.'),

    h('A checklist'),
    table(
      ['see', 'do'],
      [
        ['MySQL `type: ALL` on a big table', 'Index the `WHERE` columns.'],
        ['`key: NULL`', 'There is no usable index — check for a function or a type mismatch on the column.'],
        ['`rows` far above what you expect', 'Stale statistics — `ANALYZE`.'],
        ['`Using filesort`', 'Index the `ORDER BY` columns, after the `WHERE` ones.'],
        ['`Using temporary`', 'Index the `GROUP BY` columns.'],
        ['`Using join buffer`', 'Index the join column on the inner table.'],
        ['Postgres `Seq Scan` with a selective filter', 'Add an index; check statistics.'],
        ['`loops` in the thousands', 'Index the inner side of the nested loop.'],
        ['Estimated 1, actual 400,000', '`ANALYZE`; look for correlated predicates.'],
        ['`Batches: 4` on a hash join', 'It spilled to disk — raise `work_mem`, or reduce the rows.'],
        ['`Index Scan` where `Index Only` is possible', 'Add the selected columns to the index; stop using `*`.'],
      ],
    ),

    h('Interview'),
    asked([
      ['What does EXPLAIN do?', 'Shows the plan the optimiser chose, without running the query.'],
      ['EXPLAIN vs EXPLAIN ANALYZE?', 'ANALYZE actually executes it and reports real row counts and timings.'],
      ['Is it safe on an UPDATE?', 'EXPLAIN yes; EXPLAIN ANALYZE performs the update. Wrap it in a transaction and roll back.'],
      ['How do you read a Postgres plan?', 'Inside out, bottom up — the most indented node runs first.'],
      ['What is the most important number?', 'Estimated versus actual rows. A bad plan usually follows a bad estimate.'],
      ['What does `loops` mean?', 'How many times the node ran — and `actual time` is per loop, so multiply.'],
      ['What is MySQL’s `type` column?', 'The access method, best to worst: const, eq_ref, ref, range, index, ALL.'],
      ['What does `Using index` mean?', 'A covering index — the query was answered without reading the table.'],
      ['What does `Using filesort` mean?', 'A sort no index could satisfy. Not necessarily on disk.'],
      ['Is a sequential scan always bad?', 'No. It is right for small tables and for queries returning a large fraction of the rows.'],
      ['What does `Using join buffer` indicate?', 'No index on the join column — the inner table is being scanned repeatedly.'],
    ]),

    h('Cheatsheet'),
    cheat([
      ['See the plan', '`EXPLAIN`'],
      ['See what really happened', '`EXPLAIN ANALYZE`'],
      ['A readable MySQL plan', '`EXPLAIN FORMAT=TREE`'],
      ['Check the plan of a write', '`BEGIN; EXPLAIN ANALYZE …; ROLLBACK;`'],
      ['Look at first', 'Estimated vs actual rows'],
      ['Then', 'MySQL `type`, or the Postgres scan node'],
      ['Then', '`Extra` — `filesort`, `temporary`, `join buffer`'],
      ['Aim for', '`Using index` / `Index Only Scan`'],
      ['Fix a bad estimate', '`ANALYZE`'],
      ['Fix a missing index', 'Index `WHERE` first, then `ORDER BY`'],
    ]),

    links(
      mysqlDoc('explain-output.html', 'EXPLAIN output (MySQL)'),
      pgDoc('using-explain.html', 'Using EXPLAIN (PostgreSQL)'),
    ),
  ],
};
