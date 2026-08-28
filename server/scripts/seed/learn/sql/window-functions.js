import { asked, cheat, code, h, links, note, p, pgDoc, result, sql, table, tip, warn, wiki } from '../blocks.js';
import { employees } from './sample-data.js';

export const doc = {
  blocks: [
    p(
      'A **window function** computes across a set of rows related to the current one, **without collapsing them**. That is the whole idea and the whole difference from `GROUP BY`: grouping turns six rows into three, and a window function leaves six rows and adds a column.',
    ),
    p(
      '"Show each employee **and** their department average" is not a grouping question. Grouping destroys the individual rows, which is exactly what you did not want.',
    ),
    employees(),

    h('The difference, side by side'),
    code(
      sql(`
-- GROUP BY: 4 rows out. The employees are gone.
SELECT dept_id, AVG(salary) AS dept_avg FROM employees GROUP BY dept_id;

-- OVER: 6 rows out. Every employee, with their department's average beside them.
SELECT name, dept_id, salary,
       AVG(salary) OVER (PARTITION BY dept_id) AS dept_avg
FROM employees;
`),
    ),
    result(
      ['name', 'dept_id', 'salary', 'dept_avg'],
      [
        ['Ada', '`1`', '`95000.00`', '`88500.00`'],
        ['Grace', '`1`', '`82000.00`', '`88500.00`'],
        ['Linus', '`2`', '`74000.00`', '`82500.00`'],
        ['Barbara', '`2`', '`91000.00`', '`82500.00`'],
        ['Alan', '`3`', '`68000.00`', '`68000.00`'],
        ['Radia', '`NULL`', '`78000.00`', '`78000.00`'],
      ],
      '6 rows — nothing was collapsed',
    ),
    note(
      'Radia gets her own partition. `PARTITION BY` groups NULLs together exactly as `GROUP BY` does — all the NULLs form one window, and here that window contains only her.',
    ),

    h('The OVER clause'),
    p('Three optional parts, and each one narrows what the function can see:'),
    code(
      sql(`
function() OVER (
  PARTITION BY col    -- split into windows. Omit = the whole result is one window.
  ORDER BY col        -- order within the window. Required by RANK, LAG, running totals.
  ROWS BETWEEN …      -- the frame: which rows around the current one. Next topic.
)
`),
    ),
    table(
      ['written', 'the window is'],
      [
        ['`OVER ()`', 'Every row in the result. A global figure on each row.'],
        ['`OVER (PARTITION BY dept_id)`', 'The rows sharing this row’s department.'],
        ['`OVER (ORDER BY salary)`', 'Every row, ordered — so "rows up to here" is meaningful.'],
        ['`OVER (PARTITION BY dept_id ORDER BY salary)`', 'The department, ordered by salary.'],
      ],
    ),
    code(
      sql(`
SELECT name, salary,
  AVG(salary) OVER ()                        AS company_avg,
  salary - AVG(salary) OVER ()               AS diff_from_avg,
  SUM(salary) OVER ()                        AS total_payroll,
  COUNT(*) OVER (PARTITION BY dept_id)       AS dept_size
FROM employees;
`),
    ),
    result(
      ['name', 'salary', 'company_avg', 'diff_from_avg', 'total_payroll', 'dept_size'],
      [
        ['Ada', '`95000.00`', '`81333.33`', '`13666.67`', '`488000.00`', '`2`'],
        ['Grace', '`82000.00`', '`81333.33`', '`666.67`', '`488000.00`', '`2`'],
        ['Linus', '`74000.00`', '`81333.33`', '`-7333.33`', '`488000.00`', '`2`'],
        ['Barbara', '`91000.00`', '`81333.33`', '`9666.67`', '`488000.00`', '`2`'],
        ['Alan', '`68000.00`', '`81333.33`', '`-13666.67`', '`488000.00`', '`1`'],
        ['Radia', '`78000.00`', '`81333.33`', '`-3333.33`', '`488000.00`', '`1`'],
      ],
    ),

    h('The three ranking functions'),
    p(
      'Asked in almost every SQL interview, and the answer is entirely about **what they do with ties**. To show it, rank by department size — where Engineering and Data are genuinely tied:',
    ),
    code(
      sql(`
WITH sizes AS (
  SELECT dept_id, COUNT(*) AS headcount FROM employees GROUP BY dept_id
)
SELECT dept_id, headcount,
  ROW_NUMBER() OVER (ORDER BY headcount DESC) AS row_number,
  RANK()       OVER (ORDER BY headcount DESC) AS rank,
  DENSE_RANK() OVER (ORDER BY headcount DESC) AS dense_rank
FROM sizes;
`),
    ),
    result(
      ['dept_id', 'headcount', 'row_number', 'rank', 'dense_rank'],
      [
        ['`1`', '`2`', '`1`', '`1`', '`1`'],
        ['`2`', '`2`', '`2`', '**`1`**', '**`1`**'],
        ['`3`', '`1`', '`3`', '**`3`**', '**`2`**'],
        ['`NULL`', '`1`', '`4`', '**`3`**', '**`2`**'],
      ],
    ),
    table(
      ['function', 'ties get', 'then', 'use for'],
      [
        ['`ROW_NUMBER()`', 'Different numbers, chosen arbitrarily', 'Always 1, 2, 3, 4…', 'Deduplication; exactly one row per group'],
        ['`RANK()`', 'The **same** number', '**Skips** — two 1s then 3', 'Competition ranking, where "joint first, no second" is right'],
        ['`DENSE_RANK()`', 'The **same** number', 'Does **not** skip — two 1s then 2', '"The Nth distinct value", like the Nth highest salary'],
      ],
    ),
    warn(
      'That skip is why `RANK() = 2` is the wrong way to ask for the second-highest salary. If two people share the top salary there is no rank 2 at all, and the query returns nothing — silently, on exactly the data that makes the question interesting. `DENSE_RANK() = 2` is the right answer, every time.',
    ),
    tip(
      '`ROW_NUMBER()` breaks ties *arbitrarily*, and arbitrarily means it can change between runs. If which row wins matters, put a unique tiebreaker in the `ORDER BY`: `ORDER BY salary DESC, id`. This is the same rule as `ORDER BY` with `LIMIT`, for the same reason.',
    ),

    h('Ranking within a partition'),
    code(
      sql(`
SELECT name, dept_id, salary,
  RANK() OVER (PARTITION BY dept_id ORDER BY salary DESC) AS rank_in_dept
FROM employees
ORDER BY dept_id, rank_in_dept;
`),
    ),
    result(
      ['name', 'dept_id', 'salary', 'rank_in_dept'],
      [
        ['Radia', '`NULL`', '`78000.00`', '`1`'],
        ['Ada', '`1`', '`95000.00`', '`1`'],
        ['Grace', '`1`', '`82000.00`', '`2`'],
        ['Barbara', '`2`', '`91000.00`', '`1`'],
        ['Linus', '`2`', '`74000.00`', '`2`'],
        ['Alan', '`3`', '`68000.00`', '`1`'],
      ],
    ),
    p('**The rank restarts at 1 in every partition.** That is what makes the next pattern work.'),

    h('Top-N per group'),
    p(
      'The most reused window-function pattern there is, and it appears in interviews under many names — the highest-paid person per department, the most recent order per customer, the top three products per category. Always the same two steps: **rank inside the partition, then filter the rank in an outer query.**',
    ),
    code(
      sql(`
SELECT name, dept_id, salary
FROM (
  SELECT name, dept_id, salary,
         ROW_NUMBER() OVER (PARTITION BY dept_id ORDER BY salary DESC, id) AS rn
  FROM employees
) ranked
WHERE rn = 1;
`),
    ),
    result(
      ['name', 'dept_id', 'salary'],
      [
        ['Radia', '`NULL`', '`78000.00`'],
        ['Ada', '`1`', '`95000.00`'],
        ['Barbara', '`2`', '`91000.00`'],
        ['Alan', '`3`', '`68000.00`'],
      ],
    ),
    warn(
      'The outer query is not optional. Window functions are computed at step 5 and `WHERE` runs at step 2, so `WHERE ROW_NUMBER() OVER (…) = 1` is an error in the same query — the rank does not exist yet. The wrap is the only order in which the question can be asked, and remembering that is remembering the execution order from the `SELECT` lifecycle topic.',
    ),
    p('Swap the function to change what happens to ties, and this is the decision to make consciously:'),
    table(
      ['want', 'use'],
      [
        ['Exactly one row per group, ties broken arbitrarily', '`ROW_NUMBER() = 1`'],
        ['Every row tied for the top', '`RANK() = 1`'],
        ['The top three **distinct** salaries, however many people', '`DENSE_RANK() <= 3`'],
        ['The top three **people**', '`ROW_NUMBER() <= 3`'],
      ],
    ),

    h('The other useful ones'),
    table(
      ['function', 'returns'],
      [
        ['`NTILE(n)`', 'Splits the window into n buckets and returns the bucket number. Quartiles, deciles.'],
        ['`PERCENT_RANK()`', '`(rank - 1) / (rows - 1)` — 0 for the first row, 1 for the last.'],
        ['`CUME_DIST()`', 'The fraction of rows at or below this one.'],
        ['`FIRST_VALUE(col)` / `LAST_VALUE(col)`', 'The value from the first or last row of the frame.'],
        ['`NTH_VALUE(col, n)`', 'The value from the nth row of the frame.'],
      ],
    ),
    code(
      sql(`
SELECT name, salary,
  NTILE(2)      OVER (ORDER BY salary DESC) AS half,
  PERCENT_RANK() OVER (ORDER BY salary DESC) AS pct
FROM employees;
`),
    ),
    result(
      ['name', 'salary', 'half', 'pct'],
      [
        ['Ada', '`95000.00`', '`1`', '`0.0`'],
        ['Barbara', '`91000.00`', '`1`', '`0.2`'],
        ['Grace', '`82000.00`', '`1`', '`0.4`'],
        ['Radia', '`78000.00`', '`2`', '`0.6`'],
        ['Linus', '`74000.00`', '`2`', '`0.8`'],
        ['Alan', '`68000.00`', '`2`', '`1.0`'],
      ],
    ),
    warn(
      '`LAST_VALUE` almost never does what people expect, and it is a favourite trick question. With an `ORDER BY` and no explicit frame, the default frame ends at the *current row*, so `LAST_VALUE` returns the current row rather than the last one in the partition. Fixing it means writing the frame explicitly — which is the next topic.',
    ),

    h('Availability'),
    p(
      'Window functions are standard SQL and are in **MySQL 8.0+**, **PostgreSQL 8.4+**, SQL Server 2005+, Oracle 8i+, and SQLite 3.25+. MySQL 5.7 does not have them, which is why so much older MySQL code uses correlated subqueries and user variables to do the same work — and why an interviewer on a legacy stack may ask you to write it both ways.',
    ),

    h('Interview'),
    asked([
      ['What is a window function?', 'One that computes over a set of related rows without collapsing them — the rows survive and a column is added.'],
      ['Window function vs GROUP BY?', 'GROUP BY collapses rows into one per group; a window function keeps every row.'],
      ['What does PARTITION BY do?', 'Splits the rows into independent windows. Omit it and the whole result is one window.'],
      ['ROW_NUMBER vs RANK vs DENSE_RANK?', 'On ties: ROW_NUMBER gives different numbers, RANK gives the same and then skips, DENSE_RANK gives the same and does not skip.'],
      ['Which for the Nth highest salary?', 'DENSE_RANK — RANK can skip past N entirely when there is a tie.'],
      ['How do you get the top row per group?', 'ROW_NUMBER partitioned by the group, ordered by the metric, filtered to 1 in an outer query.'],
      ['Why does it need an outer query?', 'Window functions are evaluated after WHERE, so WHERE cannot reference them.'],
      ['Is ROW_NUMBER deterministic?', 'Only if the ORDER BY is unique. Add a tiebreaker column.'],
      ['Does PARTITION BY group NULLs?', 'Yes, into one partition, like GROUP BY.'],
      ['Which MySQL version added them?', '8.0. Before that, correlated subqueries or user variables.'],
      ['Why does LAST_VALUE return the current row?', 'The default frame with an ORDER BY ends at the current row. Specify the frame explicitly.'],
    ]),

    h('Cheatsheet'),
    cheat([
      ['A global figure on every row', '`AVG(x) OVER ()`'],
      ['A per-group figure on every row', '`AVG(x) OVER (PARTITION BY g)`'],
      ['Number the rows', '`ROW_NUMBER() OVER (ORDER BY …)`'],
      ['Competition ranking with gaps', '`RANK()`'],
      ['The Nth distinct value', '`DENSE_RANK() = n`'],
      ['One row per group', '`ROW_NUMBER() … = 1`, filtered outside'],
      ['All rows tied for top', '`RANK() = 1`'],
      ['Quartiles', '`NTILE(4)`'],
      ['Deduplicate', '`ROW_NUMBER() OVER (PARTITION BY key ORDER BY …) = 1`'],
      ['Make it deterministic', 'A unique tiebreaker in the `ORDER BY`'],
    ]),

    links(
      wiki('Window_function_(SQL)', 'Window functions'),
      pgDoc('tutorial-window.html', 'Window functions (PostgreSQL)'),
    ),
  ],
};
