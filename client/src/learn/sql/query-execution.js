import { asked, cheat, code, h, links, note, p, result, sql, table, tip, ul, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'SQL is declarative: you describe the rows you want and say nothing about how to get them. Something has to decide the *how*, and that something is the **query optimiser** — the most sophisticated component of the database and the one whose decisions you spend most of your tuning time trying to influence.',
    ),

    h('The five stages'),
    table(
      ['stage', 'does', 'fails with'],
      [
        ['**1 · Parse**', 'Check the syntax, build a parse tree.', 'A syntax error.'],
        ['**2 · Bind / resolve**', 'Look up every table and column, check types and privileges.', '"Unknown column", "table does not exist", "access denied".'],
        ['**3 · Rewrite**', 'Expand views, flatten subqueries, simplify predicates, remove impossible conditions.', 'Nothing — this is invisible.'],
        ['**4 · Plan / optimise**', 'Enumerate ways to execute it, cost each, choose the cheapest.', 'Nothing — but a bad choice here *is* the slow query.'],
        ['**5 · Execute**', 'Run the chosen plan and return rows.', 'Timeouts, deadlocks, out of memory.'],
      ],
    ),
    note(
      'Stage 4 is the interesting one and the only one you can influence without changing what the query means. Stages 1 and 2 either work or produce an obvious error; stage 3 is mechanical; stage 5 does what it was told. **Almost every "why is this query slow" question is a question about stage 4.**',
    ),

    h('What the rewriter does before costing anything'),
    p('A set of transformations that provably do not change the result:'),
    code(
      sql(`
-- A view is expanded into the query that referenced it.
SELECT * FROM staff_directory WHERE location = 'Pune';
--   becomes the view's SELECT, with the predicate merged in

-- A subquery is flattened into a join where the semantics allow.
SELECT * FROM employees WHERE dept_id IN (SELECT id FROM departments WHERE …);
--   becomes a semi-join

-- Predicates are pushed down, so filtering happens before joining.
SELECT * FROM (SELECT * FROM employees) t WHERE t.dept_id = 1;
--   becomes  SELECT * FROM employees WHERE dept_id = 1

-- Impossible conditions are removed entirely.
WHERE 1 = 0 AND expensive_function(x)
--   the whole query is answered with zero rows, without executing anything
`),
    ),
    tip(
      '**Predicate pushdown** is the most valuable of these to know about, because it is what makes views and CTEs free — a filter written outside them is applied *inside*. It is also what stops working the moment the inner query aggregates, uses `DISTINCT`, or has a window function, because a filter cannot be pushed past a step that has already combined rows. That is precisely when a view becomes slow.',
    ),

    h('What the optimiser chooses between'),
    p('Even a two-table join has a surprising number of possible plans. The optimiser picks among:'),
    table(
      ['decision', 'options'],
      [
        ['**Access path**', 'Sequential scan · index scan · index-only scan · bitmap scan'],
        ['**Which index**', 'Any of the candidates, or none'],
        ['**Join order**', 'Which table drives — `A ⋈ B` or `B ⋈ A`. For n tables there are up to n! orders'],
        ['**Join algorithm**', 'Nested loop · hash join · merge join'],
        ['**Aggregation**', 'Sort then group · hash aggregate'],
        ['**Sort**', 'Explicit sort · use an index that is already ordered'],
        ['**Parallelism**', 'How many workers, if any'],
      ],
    ),

    h('The three join algorithms'),
    table(
      ['algorithm', 'how', 'cost', 'best when'],
      [
        [
          '**Nested loop**',
          'For each row of A, look up matches in B.',
          '`O(n × log m)` with an index on B; `O(n × m)` without.',
          'A is small and B is indexed on the join key.',
        ],
        [
          '**Hash join**',
          'Build a hash table on the smaller side, probe it with the larger.',
          '`O(n + m)`, plus memory for the hash table.',
          'Large tables, equality join, no useful index.',
        ],
        [
          '**Merge join**',
          'Sort both sides, then walk them together.',
          '`O(n log n + m log m)`, or `O(n + m)` if already sorted.',
          'Both sides are already ordered by the join key.',
        ],
      ],
    ),
    warn(
      'A nested loop with **no index on the inner side** is the classic catastrophe: it is `O(n × m)`, which on two ten-thousand-row tables is a hundred million comparisons for a query that should be instant. MySQL before 8.0.18 had *only* nested loops, which is why an unindexed join could be so dramatically slow there and merely slow in PostgreSQL, which has had hash joins for decades.',
    ),

    h('How cost is estimated'),
    p(
      'The optimiser does not run the alternatives — it **estimates** them, using statistics collected periodically about each table:',
    ),
    ul(
      '**Row count** — how many rows the table has.',
      '**Cardinality** — how many distinct values a column holds.',
      '**Histograms** — how values are distributed, so `WHERE status = \'pending\'` can be estimated even when 99% of rows are `\'done\'`.',
      '**Correlation** — how closely physical order matches index order, which decides whether an index scan is sequential or random.',
      '**Page counts** — how much of it is likely to be in memory.',
    ),
    code(
      sql(`
ANALYZE TABLE employees;                          -- MySQL
ANALYZE employees;                                -- PostgreSQL, or autovacuum does it

SELECT tablename, attname, n_distinct, correlation
FROM pg_stats WHERE tablename = 'employees';
`),
    ),
    result(
      ['tablename', 'attname', 'n_distinct', 'correlation'],
      [
        ['employees', 'id', '`-1`', '`1.0`'],
        ['employees', 'dept_id', '`3`', '`0.61`'],
        ['employees', 'salary', '`-1`', '`-0.14`'],
      ],
      'n_distinct of -1 means every value is unique',
    ),
    warn(
      '**Stale statistics are the single most common cause of a plan that was fast last month and is slow today.** Nothing about the query changed; the data did. A table that grew from a thousand rows to ten million while its statistics still say a thousand will be planned as if it were small — typically a nested loop that used to be right and is now quadratic. The fix is `ANALYZE`, and the symptom is a query that got dramatically slower with no deploy.',
    ),

    h('Estimated against actual'),
    p(
      'The number that matters most when reading a plan is the **ratio between the estimated and actual row counts**. Cost numbers are arbitrary units and comparable only against each other; the row estimate is a prediction you can check:',
    ),
    result(
      ['estimate vs actual', 'means', 'do'],
      [
        ['Within ~10×', 'The optimiser understands this query.', 'Look elsewhere — the plan is probably reasonable.'],
        ['Estimated 1, actual 400,000', '**A badly wrong estimate.** Almost certainly the cause.', '`ANALYZE`; check for correlated predicates or a function in the `WHERE`.'],
        ['Estimated 400,000, actual 1', 'Wrong the other way.', 'The same. It probably chose a hash join where a nested loop was right.'],
      ],
    ),
    tip(
      'This is the first thing to look at in any plan, before the join algorithms or the scan types. A bad plan is nearly always a **downstream consequence** of a bad row estimate — the optimiser chose correctly given what it believed, and what it believed was wrong. Fixing the estimate fixes the plan; overriding the plan with a hint leaves the wrong belief in place to cause the next problem.',
    ),

    h('The plan cache'),
    p('Parsing and planning are not free, so both engines avoid repeating them:'),
    table(
      ['engine', 'caches'],
      [
        ['**PostgreSQL**', 'Prepared statements. After five executions it may switch from re-planning each time to a **generic plan** reused for all parameter values.'],
        ['**MySQL**', 'Prepared statements per session. The old query cache was removed in 8.0 — it invalidated on every write to any referenced table and was a bottleneck under concurrency.'],
      ],
    ),
    warn(
      "Postgres's generic plan is a genuine trap on skewed data. A query filtering `WHERE status = ?` is planned for a *typical* parameter; if 99% of rows are `'done'` and you pass `'pending'`, the generic plan chose a scan where an index was right. `plan_cache_mode = force_custom_plan` disables it for that session.",
    ),

    h('Influencing it'),
    p('In roughly the order you should try them:'),
    table(
      ['approach', 'effect'],
      [
        ['**`ANALYZE`**', 'Fixes stale statistics. Free, safe, and fixes a large share of sudden slowdowns.'],
        ['**Add an index**', 'Gives the optimiser a better option. Usually the actual answer.'],
        ['**Rewrite the query**', 'Remove a function from a filter, replace `OR` with `UNION`, unnest a subquery.'],
        ['**Raise the statistics target**', '`ALTER TABLE … ALTER COLUMN … SET STATISTICS 1000` for a skewed column.'],
        ['**Extended statistics**', 'Postgres: tell it that two columns are correlated, which it cannot infer.'],
        ['**Hints**', 'MySQL: `USE INDEX`, `FORCE INDEX`, `JOIN_ORDER`. PostgreSQL: **no hints**, deliberately.'],
      ],
    ),
    note(
      'PostgreSQL refuses to implement query hints on principle, and the argument is a reasonable one: a hint freezes today\'s decision into the application, so when the data distribution changes the hint is still there, still wrong, and now invisible. The intended path is to fix the statistics or the schema so the optimiser reaches the right answer itself. MySQL provides hints, and the same caution applies to using them.',
    ),

    h('Interview'),
    asked([
      ['What happens between pressing enter and getting rows?', 'Parse, bind, rewrite, plan, execute.'],
      ['What does the optimiser choose between?', 'Access paths, indexes, join order, join algorithm, aggregation strategy, sorting and parallelism.'],
      ['Name the join algorithms.', 'Nested loop, hash join, merge join.'],
      ['When is a nested loop right?', 'A small outer table and an indexed inner one.'],
      ['When is a hash join right?', 'Two large tables, an equality condition, no useful index.'],
      ['What is the worst case?', 'A nested loop with no index on the inner side — O(n × m).'],
      ['How does the optimiser estimate cost?', 'From statistics: row counts, distinct values, histograms, correlation and page counts.'],
      ['Why does a query suddenly get slow with no code change?', 'Stale statistics — the data grew or its distribution shifted and the plan is based on the old picture.'],
      ['What is the first thing to check in a plan?', 'Estimated versus actual rows. A bad plan usually follows a bad estimate.'],
      ['What is predicate pushdown?', 'Applying a filter as early as possible — which is why views and CTEs are usually free, and why aggregation stops them being free.'],
      ['Does PostgreSQL support hints?', 'No, deliberately — a hint freezes a decision that should be re-made as the data changes.'],
      ['Why was the MySQL query cache removed?', 'Any write to a referenced table invalidated its entries, making it a contention point under concurrency.'],
    ]),

    h('Cheatsheet'),
    cheat([
      ['See the chosen plan', '`EXPLAIN`'],
      ['See what actually happened', '`EXPLAIN ANALYZE`'],
      ['Fix a suddenly-slow query', '`ANALYZE` the table first'],
      ['Give the optimiser a better option', 'An index'],
      ['Diagnose a bad plan', 'Compare estimated and actual rows'],
      ['Help it with a skewed column', 'Raise the statistics target'],
      ['Help it with correlated columns', 'Extended statistics (Postgres)'],
      ['Force a choice', 'A hint — MySQL only, and a last resort'],
    ]),

    links(
      wiki('Query_optimization', 'Query optimisation'),
      wiki('Hash_join', 'Hash join'),
      wiki('Sort-merge_join', 'Merge join'),
    ),
  ],
};
