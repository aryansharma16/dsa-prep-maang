import { asked, cheat, code, h, links, note, p, pgDoc, result, sql, table, tip, warn, wiki } from '../blocks.js';
import { employees } from './sample-data.js';

export const doc = {
  blocks: [
    p(
      'The third part of `OVER` is the **frame**: which rows *within* the partition the function actually sees. It is what turns a window function from "an aggregate per group" into running totals, moving averages, and comparisons against the row before.',
    ),
    p(
      'It is also the source of the single most surprising default in SQL, and that default is worth meeting first.',
    ),
    employees(),

    h('The default frame, and why it matters'),
    table(
      ['`OVER` contains', 'the frame is', 'so the function sees'],
      [
        ['No `ORDER BY`', 'The whole partition', 'Every row. A plain per-group aggregate.'],
        [
          'An `ORDER BY`',
          '`RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`',
          '**Only the rows up to and including this one.** A running total.',
        ],
      ],
    ),
    warn(
      'Adding an `ORDER BY` to a window silently changes what the aggregate means. `SUM(salary) OVER ()` is the payroll total on every row; `SUM(salary) OVER (ORDER BY hired_on)` is a **running** total that differs on every row. Nothing warns you — the query is valid either way, and this is the most common way a window function quietly returns a different number than intended.',
    ),
    code(
      sql(`
SELECT name, hired_on, salary,
  SUM(salary) OVER ()                    AS total_payroll,
  SUM(salary) OVER (ORDER BY hired_on)   AS running_total
FROM employees
ORDER BY hired_on;
`),
    ),
    result(
      ['name', 'hired_on', 'salary', 'total_payroll', 'running_total'],
      [
        ['Barbara', '`2018-11-02`', '`91000.00`', '`488000.00`', '`91000.00`'],
        ['Ada', '`2019-03-04`', '`95000.00`', '`488000.00`', '`186000.00`'],
        ['Grace', '`2020-07-15`', '`82000.00`', '`488000.00`', '`268000.00`'],
        ['Linus', '`2021-01-11`', '`74000.00`', '`488000.00`', '`342000.00`'],
        ['Alan', '`2022-05-30`', '`68000.00`', '`488000.00`', '`410000.00`'],
        ['Radia', '`2023-02-20`', '`78000.00`', '`488000.00`', '`488000.00`'],
      ],
    ),
    p('Same function, same column, one extra clause — and two completely different columns. The running total reaches the grand total on the last row, which is the check that it is doing what you think.'),

    h('Writing the frame'),
    code(
      sql(`
ROWS BETWEEN <start> AND <end>
`),
    ),
    table(
      ['bound', 'means'],
      [
        ['`UNBOUNDED PRECEDING`', 'The first row of the partition'],
        ['`n PRECEDING`', 'n rows before the current one'],
        ['`CURRENT ROW`', 'This row'],
        ['`n FOLLOWING`', 'n rows after'],
        ['`UNBOUNDED FOLLOWING`', 'The last row of the partition'],
      ],
    ),
    code(
      sql(`
-- Running total, said explicitly. Identical to the default above.
SUM(salary) OVER (ORDER BY hired_on ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)

-- Three-row moving average: previous, current, next.
AVG(salary) OVER (ORDER BY hired_on ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING)

-- Trailing three, inclusive of this row.
AVG(salary) OVER (ORDER BY hired_on ROWS BETWEEN 2 PRECEDING AND CURRENT ROW)

-- The whole partition, even with an ORDER BY present.
SUM(salary) OVER (ORDER BY hired_on ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING)
`),
    ),

    h('ROWS or RANGE'),
    p('Two ways to count the frame, and they differ **only when there are ties** in the `ORDER BY`:'),
    table(
      ['', '`ROWS`', '`RANGE`'],
      [
        ['Counts', 'Physical rows', 'Rows with the same `ORDER BY` **value**'],
        ['On a tie', 'Each tied row sees a different frame', '**All tied rows see the same frame**'],
        ['`1 PRECEDING` means', 'exactly one row back', 'all rows whose value is one less'],
        ['Is the default', 'No', '**Yes**'],
      ],
    ),
    tip(
      '**Write `ROWS` unless you specifically want `RANGE`.** With `RANGE`, a running total over a date with several rows per day jumps by the whole day at once, and every row of that day shows the same value — which is sometimes exactly right and is usually a surprise. `ROWS` counts rows, which is what "the last three" almost always means.',
    ),

    h('LAG and LEAD'),
    p(
      'Reach into the row before or after, without a self join. `LAG(col, n, default)` looks **backwards**; `LEAD` looks **forwards**. Both default `n` to 1 and the fallback to `NULL`.',
    ),
    code(
      sql(`
SELECT name, hired_on, salary,
  LAG(name)    OVER (ORDER BY hired_on) AS hired_before,
  LEAD(name)   OVER (ORDER BY hired_on) AS hired_after,
  LAG(salary)  OVER (ORDER BY hired_on) AS prev_salary,
  salary - LAG(salary) OVER (ORDER BY hired_on) AS diff
FROM employees
ORDER BY hired_on;
`),
    ),
    result(
      ['name', 'hired_on', 'salary', 'hired_before', 'hired_after', 'prev_salary', 'diff'],
      [
        ['Barbara', '`2018-11-02`', '`91000.00`', '`NULL`', 'Ada', '`NULL`', '`NULL`'],
        ['Ada', '`2019-03-04`', '`95000.00`', 'Barbara', 'Grace', '`91000.00`', '`4000.00`'],
        ['Grace', '`2020-07-15`', '`82000.00`', 'Ada', 'Linus', '`95000.00`', '`-13000.00`'],
        ['Linus', '`2021-01-11`', '`74000.00`', 'Grace', 'Alan', '`82000.00`', '`-8000.00`'],
        ['Alan', '`2022-05-30`', '`68000.00`', 'Linus', 'Radia', '`74000.00`', '`-6000.00`'],
        ['Radia', '`2023-02-20`', '`78000.00`', 'Alan', '`NULL`', '`68000.00`', '`10000.00`'],
      ],
    ),
    p(
      'The first row has no predecessor and the last has no successor, so both get `NULL` — and `95000 - NULL` is `NULL`, which is why `diff` is empty on the first row rather than showing the full salary.',
    ),
    code(
      sql(`
-- The third argument is the fallback, which removes the NULL arithmetic.
SELECT name, salary,
  LAG(salary, 1, 0) OVER (ORDER BY hired_on)          AS prev_or_zero,
  salary - LAG(salary, 1, salary) OVER (ORDER BY hired_on) AS diff_or_zero
FROM employees;
`),
    ),
    note(
      'Before window functions this needed a correlated subquery finding `MAX(hired_on) < current`, or a self join on a numbered sequence — both fragile, both slow, and both shown in the self-join topic for exactly this comparison. `LAG` is one function call and one pass over the data.',
    ),

    h('Partitioned, so the chain restarts'),
    code(
      sql(`
-- Salary gap to the next person down, within each department.
SELECT name, dept_id, salary,
  LEAD(salary) OVER (PARTITION BY dept_id ORDER BY salary DESC) AS next_lower,
  salary - LEAD(salary) OVER (PARTITION BY dept_id ORDER BY salary DESC) AS gap
FROM employees
ORDER BY dept_id, salary DESC;
`),
    ),
    result(
      ['name', 'dept_id', 'salary', 'next_lower', 'gap'],
      [
        ['Radia', '`NULL`', '`78000.00`', '`NULL`', '`NULL`'],
        ['Ada', '`1`', '`95000.00`', '`82000.00`', '`13000.00`'],
        ['Grace', '`1`', '`82000.00`', '`NULL`', '`NULL`'],
        ['Barbara', '`2`', '`91000.00`', '`74000.00`', '`17000.00`'],
        ['Linus', '`2`', '`74000.00`', '`NULL`', '`NULL`'],
        ['Alan', '`3`', '`68000.00`', '`NULL`', '`NULL`'],
      ],
    ),
    p('`LEAD` does not cross a partition boundary — the last row of each department has no successor, so the chain restarts rather than running on into the next department.'),

    h('FIRST_VALUE, LAST_VALUE, and the trap'),
    code(
      sql(`
SELECT name, dept_id, salary,
  FIRST_VALUE(name) OVER (PARTITION BY dept_id ORDER BY salary DESC) AS top_earner,
  LAST_VALUE(name)  OVER (PARTITION BY dept_id ORDER BY salary DESC) AS wrong,
  LAST_VALUE(name)  OVER (PARTITION BY dept_id ORDER BY salary DESC
                          ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS right
FROM employees;
`),
    ),
    result(
      ['name', 'dept_id', 'salary', 'top_earner', 'wrong', 'right'],
      [
        ['Ada', '`1`', '`95000.00`', 'Ada', '**Ada**', 'Grace'],
        ['Grace', '`1`', '`82000.00`', 'Ada', '**Grace**', 'Grace'],
        ['Barbara', '`2`', '`91000.00`', 'Barbara', '**Barbara**', 'Linus'],
        ['Linus', '`2`', '`74000.00`', 'Barbara', '**Linus**', 'Linus'],
      ],
      'Departments 1 and 2 only',
    ),
    warn(
      '`LAST_VALUE` with no explicit frame returns **the current row**, every time — because the default frame ends at the current row, so "the last row of the frame" *is* the current row. `FIRST_VALUE` works as expected only because the default frame *starts* at the beginning of the partition. This asymmetry is a favourite interview trick, and the fix is always the same: state the frame as `UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING`.',
    ),
    tip(
      'Or avoid the problem: `FIRST_VALUE(name) OVER (PARTITION BY dept_id ORDER BY salary ASC)` — reverse the sort and ask for the first. Shorter, no frame clause, and impossible to get wrong.',
    ),

    h('Named windows'),
    p('When several functions share a window, name it once with `WINDOW` rather than repeating it:'),
    code(
      sql(`
SELECT name, salary,
  RANK()       OVER w AS rk,
  LAG(salary)  OVER w AS prev,
  SUM(salary)  OVER w AS running
FROM employees
WINDOW w AS (ORDER BY hired_on)
ORDER BY hired_on;
`),
    ),
    note(
      'The `WINDOW` clause sits between `HAVING` and `ORDER BY`. Beyond saving keystrokes it removes a real class of bug: three copies of a window definition are three chances for one of them to drift, and a `PARTITION BY` added to two of three is a query that is wrong in a way nobody will spot in review.',
    ),

    h('The patterns these unlock'),
    table(
      ['want', 'write'],
      [
        ['Running total', '`SUM(x) OVER (ORDER BY d)`'],
        ['Running total per group', '`SUM(x) OVER (PARTITION BY g ORDER BY d)`'],
        ['7-day moving average', '`AVG(x) OVER (ORDER BY d ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)`'],
        ['Change from the previous row', '`x - LAG(x) OVER (ORDER BY d)`'],
        ['Percentage change', '`(x - LAG(x) OVER w) / LAG(x) OVER w`'],
        ['Days since the last event', '`DATEDIFF(d, LAG(d) OVER (PARTITION BY user ORDER BY d))`'],
        ['Share of the group total', '`x / SUM(x) OVER (PARTITION BY g)`'],
        ['Gaps and islands', '`ROW_NUMBER()` minus the value — equal differences mark a run'],
        ['The first and last of a group', '`FIRST_VALUE` and `LAST_VALUE` with an explicit frame'],
      ],
    ),
    code(
      sql(`
-- Each person's share of their department's wage bill.
SELECT name, dept_id, salary,
  ROUND(100.0 * salary / SUM(salary) OVER (PARTITION BY dept_id), 1) AS pct_of_dept
FROM employees
ORDER BY dept_id, salary DESC;
`),
    ),
    result(
      ['name', 'dept_id', 'salary', 'pct_of_dept'],
      [
        ['Radia', '`NULL`', '`78000.00`', '`100.0`'],
        ['Ada', '`1`', '`95000.00`', '`53.7`'],
        ['Grace', '`1`', '`82000.00`', '`46.3`'],
        ['Barbara', '`2`', '`91000.00`', '`55.2`'],
        ['Linus', '`2`', '`74000.00`', '`44.8`'],
        ['Alan', '`3`', '`68000.00`', '`100.0`'],
      ],
    ),

    h('Interview'),
    asked([
      ['What is a window frame?', 'The subset of the partition a window function actually sees.'],
      ['What is the default frame?', 'The whole partition with no ORDER BY; `RANGE UNBOUNDED PRECEDING TO CURRENT ROW` once there is one.'],
      ['Why does adding ORDER BY change my SUM?', 'It changes the default frame from the whole partition to everything up to the current row — a running total.'],
      ['ROWS vs RANGE?', 'ROWS counts physical rows; RANGE groups rows sharing the ORDER BY value. They differ only on ties.'],
      ['Which should you write?', 'ROWS, unless you specifically want tied rows to share a frame.'],
      ['What do LAG and LEAD do?', 'Return a column from a previous or following row of the partition.'],
      ['What do they return at the edges?', 'NULL, unless a third argument supplies a default.'],
      ['Do they cross partitions?', 'No — the chain restarts in each partition.'],
      ['Why does LAST_VALUE return the current row?', 'The default frame ends at the current row. Specify UNBOUNDED FOLLOWING.'],
      ['How do you write a 7-day moving average?', '`AVG(x) OVER (ORDER BY d ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)`.'],
      ['How do you compute a share of a group total?', '`x / SUM(x) OVER (PARTITION BY g)`.'],
      ['What is the WINDOW clause for?', 'Naming a window used by several functions, so the definition exists once.'],
    ]),

    h('Cheatsheet'),
    cheat([
      ['Running total', '`SUM(x) OVER (ORDER BY d)`'],
      ['Grand total on every row', '`SUM(x) OVER ()` — no `ORDER BY`'],
      ['Moving average of n', '`ROWS BETWEEN n-1 PRECEDING AND CURRENT ROW`'],
      ['Previous row’s value', '`LAG(x)`'],
      ['Next row’s value', '`LEAD(x)`'],
      ['Change since last row', '`x - LAG(x) OVER (ORDER BY d)`'],
      ['Avoid NULL at the first row', '`LAG(x, 1, default)`'],
      ['Group maximum on every row', '`MAX(x) OVER (PARTITION BY g)`'],
      ['Last row of the partition', '`LAST_VALUE` **with an explicit frame**'],
      ['Share of the group', '`x / SUM(x) OVER (PARTITION BY g)`'],
      ['Reuse one window', 'The `WINDOW` clause'],
    ]),

    links(
      wiki('Window_function_(SQL)', 'Window functions'),
      pgDoc('sql-expressions.html#SYNTAX-WINDOW-FUNCTIONS', 'Window function calls (PostgreSQL)'),
    ),
  ],
};
