import { asked, cheat, code, h, links, mysqlDoc, note, p, result, sql, table, tip, warn } from '../blocks.js';
import { employees } from './sample-data.js';

export const doc = {
  blocks: [
    p(
      'An **aggregate function** takes many rows and returns one value. With no `GROUP BY` the whole table is one group, so the result is a single row — which is why `SELECT COUNT(*) FROM employees` gives you one number rather than six.',
    ),
    employees(),

    h('The five'),
    code(
      sql(`
SELECT
  COUNT(*)    AS headcount,
  SUM(salary) AS wage_bill,
  AVG(salary) AS average,
  MIN(salary) AS lowest,
  MAX(salary) AS highest
FROM employees;
`),
    ),
    result(
      ['headcount', 'wage_bill', 'average', 'lowest', 'highest'],
      [['`6`', '`488000.00`', '`81333.33`', '`68000.00`', '`95000.00`']],
    ),
    table(
      ['function', 'returns', 'ignores NULL?', 'works on'],
      [
        ['`COUNT(*)`', 'Number of rows', '**No** — counts every row', 'anything'],
        ['`COUNT(col)`', 'Number of non-NULL values', 'Yes', 'anything'],
        ['`COUNT(DISTINCT col)`', 'Number of distinct non-NULL values', 'Yes', 'anything'],
        ['`SUM(col)`', 'Total', 'Yes', 'numbers'],
        ['`AVG(col)`', 'Mean', 'Yes — **and divides by the non-NULL count**', 'numbers'],
        ['`MIN` / `MAX`', 'Smallest / largest', 'Yes', 'numbers, dates, strings'],
      ],
    ),

    h('COUNT(*) vs COUNT(column)'),
    p('The most-asked question in this topic, and the sample data answers it directly:'),
    code(
      sql(`
SELECT
  COUNT(*)                AS rows_in_table,   -- 6
  COUNT(dept_id)          AS have_a_dept,     -- 5   Radia's is NULL
  COUNT(manager_id)       AS have_a_manager,  -- 5   Ada's is NULL
  COUNT(DISTINCT dept_id) AS distinct_depts,  -- 3   NULL not counted
  COUNT(1)                AS also_rows        -- 6   identical to COUNT(*)
FROM employees;
`),
    ),
    result(
      ['rows_in_table', 'have_a_dept', 'have_a_manager', 'distinct_depts', 'also_rows'],
      [['`6`', '`5`', '`5`', '`3`', '`6`']],
    ),
    note(
      '`COUNT(*)` counts **rows**; `COUNT(col)` counts **values**. `COUNT(1)`, `COUNT(*)` and `COUNT(id)` on a `NOT NULL` column produce identical plans in every current engine — the claim that `COUNT(1)` is faster is folklore from a much older generation of optimisers, and repeating it in an interview invites a follow-up you cannot win.',
    ),

    h('AVG, and the division you did not choose'),
    p('Suppose a nullable bonus column, where four of six people have no bonus recorded:'),
    code(
      sql(`
SELECT
  AVG(bonus)                AS avg_of_present,   -- sum / 2
  AVG(COALESCE(bonus, 0))   AS avg_over_all,     -- sum / 6
  SUM(bonus) / COUNT(*)     AS also_over_all     -- sum / 6
FROM employees;
`),
    ),
    warn(
      'These are different numbers and both are defensible. `AVG(bonus)` answers "of the people who have a bonus, what is the average" — it divides by 2. `AVG(COALESCE(bonus, 0))` answers "across the whole company" — it divides by 6. The database cannot tell which you meant and will not warn you. **Decide what a missing value means before you average a nullable column.**',
    ),
    tip(
      'The same trap in a different costume: `SUM` over zero rows returns `NULL`, not `0`. A dashboard that shows a blank instead of a zero is usually this. `COALESCE(SUM(x), 0)` fixes it.',
    ),

    h('MIN and MAX are not just for numbers'),
    code(
      sql(`
SELECT
  MIN(hired_on) AS first_hire,     -- earliest date
  MAX(hired_on) AS latest_hire,
  MIN(name)     AS alphabetically_first,
  MAX(name)     AS alphabetically_last
FROM employees;
`),
    ),
    result(
      ['first_hire', 'latest_hire', 'alphabetically_first', 'alphabetically_last'],
      [['`2018-11-02`', '`2023-02-20`', 'Ada', 'Radia']],
    ),
    warn(
      'A classic mistake follows from that. `SELECT MAX(salary), name FROM employees` does **not** give you the highest earner\'s name — the aggregate and the bare column come from different rows, and MySQL without `ONLY_FULL_GROUP_BY` will happily return an arbitrary one rather than erroring. To get the row that holds the maximum you need `ORDER BY … LIMIT 1`, a subquery, or a window function:',
    ),
    code(
      sql(`
-- Wrong: 95000 paired with whichever name the engine happened to have.
SELECT MAX(salary), name FROM employees;

-- Right, three ways.
SELECT name, salary FROM employees ORDER BY salary DESC LIMIT 1;

SELECT name, salary FROM employees
WHERE salary = (SELECT MAX(salary) FROM employees);   -- returns all ties

SELECT name, salary FROM (
  SELECT name, salary, RANK() OVER (ORDER BY salary DESC) rk FROM employees
) t WHERE rk = 1;
`),
    ),
    result(['name', 'salary'], [['Ada', '`95000.00`']]),

    h('Aggregating a condition'),
    p(
      'A `CASE` inside an aggregate counts or sums only the rows you want, without a second query. This is one of the most reusable patterns in reporting SQL:',
    ),
    code(
      sql(`
SELECT
  COUNT(*)                                            AS total,
  SUM(CASE WHEN salary > 80000 THEN 1 ELSE 0 END)     AS well_paid,
  COUNT(CASE WHEN salary > 80000 THEN 1 END)          AS well_paid_too,
  AVG(CASE WHEN dept_id = 1 THEN salary END)          AS avg_engineering,
  SUM(CASE WHEN dept_id IS NULL THEN 1 ELSE 0 END)    AS unassigned
FROM employees;
`),
    ),
    result(
      ['total', 'well_paid', 'well_paid_too', 'avg_engineering', 'unassigned'],
      [['`6`', '`3`', '`3`', '`88500.00`', '`1`']],
    ),
    tip(
      'The two `well_paid` columns are the same trick written two ways. `SUM(CASE … THEN 1 ELSE 0 END)` adds ones; `COUNT(CASE … THEN 1 END)` relies on the missing `ELSE` producing `NULL`, which `COUNT` ignores. The second is shorter; the first is clearer to a reader who has not met the idiom. Note that `AVG(CASE WHEN dept_id = 1 THEN salary END)` averages only Engineering — over 2 rows, not 6 — for the same reason.',
    ),

    h('The rule about mixing'),
    warn(
      'You cannot select a plain column alongside an aggregate without grouping by it. `SELECT name, COUNT(*) FROM employees` is a category error: there are six names and one count, so there is no such row. PostgreSQL rejects it. MySQL used to return an arbitrary name and now rejects it too, because `ONLY_FULL_GROUP_BY` has been on by default since 5.7 — if you meet an old MySQL that allows it, the answer it gives is not wrong, it is meaningless.',
    ),

    h('Statistical extras'),
    table(
      ['function', 'does', 'available'],
      [
        ['`STDDEV` / `STDDEV_POP`', 'Standard deviation', 'MySQL, PostgreSQL'],
        ['`VARIANCE` / `VAR_POP`', 'Variance', 'MySQL, PostgreSQL'],
        ['`GROUP_CONCAT(col)`', 'Joins values into one string', 'MySQL'],
        ['`STRING_AGG(col, sep)`', 'The same', 'PostgreSQL'],
        ['`ARRAY_AGG(col)`', 'Collects values into an array', 'PostgreSQL'],
        ['`PERCENTILE_CONT(0.5)`', 'Median — there is no `MEDIAN` in either engine', 'PostgreSQL'],
      ],
    ),
    code(
      sql(`
-- Everyone in each department, on one line. Extremely useful in reports.
SELECT dept_id, GROUP_CONCAT(name ORDER BY name SEPARATOR ', ') AS team
FROM employees GROUP BY dept_id;
`),
    ),
    result(
      ['dept_id', 'team'],
      [
        ['`NULL`', 'Radia'],
        ['`1`', 'Ada, Grace'],
        ['`2`', 'Barbara, Linus'],
        ['`3`', 'Alan'],
      ],
    ),

    h('Interview'),
    asked([
      ['COUNT(*) vs COUNT(col)?', 'Rows versus non-NULL values in that column.'],
      ['Is COUNT(1) faster?', 'No. Identical plans in every modern engine.'],
      ['Do aggregates ignore NULL?', 'All of them except COUNT(*).'],
      ['What does AVG do with NULLs?', 'Skips them and divides by the non-NULL count — often not what was intended.'],
      ['What does SUM return over zero rows?', 'NULL. Wrap it in COALESCE if you want 0.'],
      ['Why is `SELECT MAX(salary), name` wrong?', 'The aggregate and the column come from different rows. Use ORDER BY LIMIT 1, a subquery, or a window function.'],
      ['How do you count rows matching a condition?', '`SUM(CASE WHEN … THEN 1 ELSE 0 END)` or `COUNT(CASE WHEN … THEN 1 END)`.'],
      ['Do MIN and MAX work on strings?', 'Yes, and on dates — by collation order and chronologically.'],
      ['Can you nest aggregates?', 'Not directly — `MAX(COUNT(*))` needs a subquery or a window function.'],
      ['What is ONLY_FULL_GROUP_BY?', 'The MySQL mode, on by default since 5.7, that rejects selecting an ungrouped column beside an aggregate.'],
    ]),

    h('Cheatsheet'),
    cheat([
      ['Count rows', '`COUNT(*)`'],
      ['Count present values', '`COUNT(col)`'],
      ['Count distinct values', '`COUNT(DISTINCT col)`'],
      ['Count rows matching a condition', '`SUM(CASE WHEN c THEN 1 ELSE 0 END)`'],
      ['Total, with 0 for an empty set', '`COALESCE(SUM(x), 0)`'],
      ['Average treating missing as zero', '`AVG(COALESCE(x, 0))`'],
      ['The row holding the maximum', '`ORDER BY x DESC LIMIT 1` — not `MAX(x)` with a bare column'],
      ['All rows tied for the maximum', '`WHERE x = (SELECT MAX(x) …)`'],
      ['Names on one line per group', '`GROUP_CONCAT` / `STRING_AGG`'],
    ]),

    links(
      mysqlDoc('aggregate-functions.html', 'Aggregate functions (MySQL)'),
      mysqlDoc('group-by-handling.html', 'ONLY_FULL_GROUP_BY'),
    ),
  ],
};
