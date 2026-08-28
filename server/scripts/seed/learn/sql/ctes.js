import {
  asked,
  cheat,
  code,
  h,
  links,
  mysql,
  note,
  p,
  pgDoc,
  postgres,
  result,
  sql,
  table,
  tip,
  warn,
  wiki,
} from '../blocks.js';
import { employees } from './sample-data.js';

export const doc = {
  blocks: [
    p(
      'A **common table expression** is a named subquery, written before the query that uses it. `WITH name AS (…) SELECT … FROM name`. It does nothing a derived table cannot do — and it makes a query read top to bottom instead of inside out, which on anything non-trivial is the difference between code you can review and code you can only run.',
    ),
    employees(),

    h('The same query, twice'),
    code(
      sql(`
-- Derived table: read the middle first, then outwards.
SELECT e.name, e.salary, d.dept_avg
FROM employees e
JOIN (
  SELECT dept_id, AVG(salary) AS dept_avg FROM employees GROUP BY dept_id
) d ON e.dept_id = d.dept_id
WHERE e.salary > d.dept_avg;

-- CTE: read it in the order it happens.
WITH dept_averages AS (
  SELECT dept_id, AVG(salary) AS dept_avg
  FROM employees
  GROUP BY dept_id
)
SELECT e.name, e.salary, d.dept_avg
FROM employees e
JOIN dept_averages d ON e.dept_id = d.dept_id
WHERE e.salary > d.dept_avg;
`),
    ),
    result(
      ['name', 'salary', 'dept_avg'],
      [
        ['Ada', '`95000.00`', '`88500.00`'],
        ['Barbara', '`91000.00`', '`82500.00`'],
      ],
    ),
    p(
      'Identical results, identical plans in most engines. The second one has a **name** for the intermediate step, and that name is doing real work: `dept_averages` says what the subquery is *for*, which the brackets around a derived table never can.',
    ),

    h('Several CTEs, building on each other'),
    p('This is where they stop being cosmetic. Each step is named, and later steps use earlier ones:'),
    code(
      sql(`
WITH dept_stats AS (
  SELECT dept_id, COUNT(*) AS headcount, AVG(salary) AS avg_salary
  FROM employees
  GROUP BY dept_id
),
big_departments AS (
  SELECT * FROM dept_stats WHERE headcount > 1
),
company AS (
  SELECT AVG(salary) AS company_avg FROM employees
)
SELECT b.dept_id, b.headcount, b.avg_salary, c.company_avg
FROM big_departments b
CROSS JOIN company c
WHERE b.avg_salary > c.company_avg;
`),
    ),
    result(
      ['dept_id', 'headcount', 'avg_salary', 'company_avg'],
      [
        ['`1`', '`2`', '`88500.00`', '`81333.33`'],
        ['`2`', '`2`', '`82500.00`', '`81333.33`'],
      ],
    ),
    note(
      'One `WITH`, then commas — not a second `WITH`. And a CTE can reference any CTE **declared before it**, which is why `big_departments` can build on `dept_stats`. Forward references are not allowed; the list is read in order.',
    ),
    tip(
      '`CROSS JOIN company` is the idiomatic way to attach a single computed constant to every row. `company` returns exactly one row, so the cross product adds a column rather than multiplying rows — one of the few places a deliberate cross join is the clearest thing to write.',
    ),

    h('Referenced more than once'),
    p('The thing a derived table genuinely cannot do — reuse the same intermediate result twice in one query:'),
    code(
      sql(`
WITH dept_stats AS (
  SELECT dept_id, AVG(salary) AS avg_salary FROM employees GROUP BY dept_id
)
SELECT
  (SELECT dept_id FROM dept_stats ORDER BY avg_salary DESC LIMIT 1) AS best_paid_dept,
  (SELECT dept_id FROM dept_stats ORDER BY avg_salary ASC  LIMIT 1) AS worst_paid_dept;
`),
    ),
    result(['best_paid_dept', 'worst_paid_dept'], [['`1`', '`3`']]),
    p('As derived tables this would be the same aggregate written out twice — two copies to keep in step every time the definition changes.'),

    h('Materialised, or inlined?'),
    warn(
      'Whether a CTE referenced twice is *computed* twice is up to the engine, and the answer differs by engine and by version. **PostgreSQL before 12** always materialised a CTE — an optimisation fence, sometimes helpful and often not. **Postgres 12+** inlines a CTE referenced once and not recursive, unless you say `MATERIALIZED`. **MySQL 8** may merge or materialise. If it matters for performance, check the plan rather than assume.',
    ),
    code(
      postgres(`
-- Force it, in either direction.
WITH expensive AS MATERIALIZED     (SELECT … )  -- compute once, reuse
WITH cheap     AS NOT MATERIALIZED (SELECT … )  -- inline into the outer query
`),
    ),
    note(
      'The practical rule: a CTE is for **readability**, not for performance. It is not a temporary table, it is not cached between statements, and it does not exist after the query ends. If you need a genuine intermediate result reused across several statements, that is a temporary table.',
    ),

    h('Recursive CTEs'),
    p(
      'The one thing a CTE can do that nothing else in SQL can: refer to **itself**. This is how you walk a hierarchy of unknown depth — the limitation the self-join topic ran into.',
    ),
    p('The shape is always the same three parts:'),
    table(
      ['part', 'does'],
      [
        ['**Anchor**', 'The starting rows. Runs once.'],
        ['`UNION ALL`', 'Joins the anchor to the recursive part. `ALL`, almost always — see below.'],
        ['**Recursive member**', 'References the CTE by name. Runs repeatedly until it returns nothing.'],
      ],
    ),
    code(
      sql(`
WITH RECURSIVE org_chart AS (
  -- Anchor: the top of the tree. Ada has no manager.
  SELECT id, name, manager_id, 1 AS level, CAST(name AS CHAR(200)) AS path
  FROM employees
  WHERE manager_id IS NULL

  UNION ALL

  -- Recursive: everyone reporting to somebody already in org_chart.
  SELECT e.id, e.name, e.manager_id, o.level + 1, CONCAT(o.path, ' > ', e.name)
  FROM employees e
  JOIN org_chart o ON e.manager_id = o.id
)
SELECT level, name, path FROM org_chart ORDER BY path;
`),
    ),
    result(
      ['level', 'name', 'path'],
      [
        ['`1`', 'Ada', 'Ada'],
        ['`2`', 'Barbara', 'Ada > Barbara'],
        ['`3`', 'Alan', 'Ada > Barbara > Alan'],
        ['`3`', 'Radia', 'Ada > Barbara > Radia'],
        ['`2`', 'Grace', 'Ada > Grace'],
        ['`2`', 'Linus', 'Ada > Linus'],
      ],
      'The whole org chart, any depth',
    ),
    p('Iteration by iteration:'),
    table(
      ['pass', 'produces', 'because'],
      [
        ['Anchor', 'Ada', 'The only row with no manager.'],
        ['1', 'Grace, Linus, Barbara', 'Their `manager_id` is 1, and Ada is in the CTE.'],
        ['2', 'Alan, Radia', 'Their `manager_id` is 4, and Barbara arrived in pass 1.'],
        ['3', 'nothing', 'Nobody reports to Alan or Radia. **The recursion stops.**'],
      ],
    ),
    tip(
      'The recursion terminates when a pass produces zero rows — that is the only stopping condition, and it is why the join must be to the CTE rather than to the base table. Joining to `employees` on both sides is an infinite loop.',
    ),

    h('Going the other way, and stopping safely'),
    code(
      sql(`
-- Upwards: Radia's whole management chain.
WITH RECURSIVE chain AS (
  SELECT id, name, manager_id FROM employees WHERE name = 'Radia'
  UNION ALL
  SELECT e.id, e.name, e.manager_id
  FROM employees e JOIN chain c ON e.id = c.manager_id
)
SELECT name FROM chain;
`),
    ),
    result(['name'], [['Radia'], ['Barbara'], ['Ada']]),
    code(
      mysql(`
-- A depth guard. Without one, a cycle in the data runs forever.
WITH RECURSIVE org AS (
  SELECT id, name, manager_id, 1 AS level FROM employees WHERE manager_id IS NULL
  UNION ALL
  SELECT e.id, e.name, e.manager_id, o.level + 1
  FROM employees e JOIN org o ON e.manager_id = o.id
  WHERE o.level < 10
)
SELECT * FROM org;
`),
    ),
    warn(
      'A cycle in the data — A manages B manages A, from a bad import — makes the recursion run until the server runs out of memory. MySQL has `cte_max_recursion_depth`, defaulting to 1000; PostgreSQL has no limit at all. **Put a `level` guard in any recursive CTE over data you do not fully control**, or track the visited path and exclude ids already in it.',
    ),
    warn(
      '`UNION` rather than `UNION ALL` in a recursive CTE looks like a cheap cycle guard and is a trap: deduplication makes each pass compare against everything seen so far, which is far more expensive, and it silently drops legitimately repeated rows — the same employee reached by two paths in a graph that is not a tree. Use `UNION ALL` and guard explicitly.',
    ),

    h('Generating a series'),
    p('A recursive CTE with no table at all — useful for building the date spine a report needs:'),
    code(
      sql(`
WITH RECURSIVE months AS (
  SELECT 1 AS n
  UNION ALL
  SELECT n + 1 FROM months WHERE n < 12
)
SELECT n FROM months;
`),
    ),
    p(
      'PostgreSQL has `generate_series(1, 12)` built in, which is shorter and faster. MySQL has no equivalent, so this is the idiom there.',
    ),

    h('CTE, derived table or temporary table'),
    table(
      ['', 'CTE', 'Derived table', 'Temporary table'],
      [
        ['Named', 'Yes', 'By its alias', 'Yes'],
        ['Readable order', '**Top to bottom**', 'Inside out', 'Top to bottom'],
        ['Reusable in the same query', 'Yes', 'No', 'Yes'],
        ['Survives the statement', 'No', 'No', '**Yes**'],
        ['Can be indexed', 'No', 'No', '**Yes**'],
        ['Recursive', '**Yes**', 'No', 'No'],
        ['Reach for it when', 'Almost always', 'A one-line inline wrap', 'Reused across statements, or needs an index'],
      ],
    ),

    h('Interview'),
    asked([
      ['What is a CTE?', 'A named subquery declared with WITH, available to the statement that follows it.'],
      ['CTE vs subquery?', 'Same capability; a CTE is named, reads top to bottom, and can be referenced more than once.'],
      ['Is a CTE materialised?', 'Engine- and version-dependent. Postgres 12+ inlines single-use non-recursive ones unless told MATERIALIZED.'],
      ['Does a CTE improve performance?', 'Not by itself. It is a readability feature; the plan is usually the same as the equivalent derived table.'],
      ['What are the parts of a recursive CTE?', 'An anchor, UNION ALL, and a recursive member that references the CTE by name.'],
      ['When does the recursion stop?', 'When a pass returns zero rows.'],
      ['Why UNION ALL rather than UNION?', 'UNION deduplicates every pass — expensive, and it silently drops legitimately repeated rows.'],
      ['How do you prevent an infinite loop?', 'A depth column with a guard, or tracking the visited path. Cycles in the data will otherwise run forever.'],
      ['Can a CTE reference a later CTE?', 'No — only ones declared before it.'],
      ['CTE or temporary table?', 'CTE within one statement; a temporary table when the result is reused across statements or needs an index.'],
    ]),

    h('Cheatsheet'),
    cheat([
      ['Name an intermediate step', '`WITH step AS (…)`'],
      ['Several steps', 'One `WITH`, comma-separated'],
      ['Reuse a result twice in one query', 'A CTE — a derived table cannot'],
      ['Walk a hierarchy', '`WITH RECURSIVE`, anchor + `UNION ALL` + recursive member'],
      ['Walk upwards instead', 'Swap the join: `e.id = c.manager_id`'],
      ['Stop a runaway recursion', 'A `level` column and `WHERE level < n`'],
      ['Generate a number series', 'A recursive CTE, or `generate_series` in Postgres'],
      ['Attach one constant to every row', '`CROSS JOIN` a one-row CTE'],
      ['Reuse across statements', 'A temporary table, not a CTE'],
    ]),

    links(
      wiki('Hierarchical_and_recursive_queries_in_SQL', 'Recursive queries in SQL'),
      pgDoc('queries-with.html', 'WITH queries (PostgreSQL)'),
    ),
  ],
};
