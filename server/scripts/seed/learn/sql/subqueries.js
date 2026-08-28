import { asked, cheat, code, h, links, note, p, result, sql, table, tip, warn, wiki } from '../blocks.js';
import { departments, employees } from './sample-data.js';

export const doc = {
  blocks: [
    p(
      'A **subquery** is a `SELECT` inside another statement. It lets one query use the answer to another, which is what you need whenever a filter depends on something you have to compute first — "everyone earning above average" cannot be written without knowing the average.',
    ),
    employees(),
    departments(),

    h('Classified by what they return'),
    table(
      ['kind', 'returns', 'usable with', 'example'],
      [
        ['**Scalar**', 'One row, one column', 'Anywhere a single value fits', '`(SELECT AVG(salary) FROM employees)`'],
        ['**Row**', 'One row, several columns', '`=`, `IN` with a tuple', '`(SELECT dept_id, salary FROM … LIMIT 1)`'],
        ['**Column**', 'Many rows, one column', '`IN`, `ANY`, `ALL`', '`(SELECT id FROM departments WHERE …)`'],
        ['**Table**', 'Many rows, many columns', '`FROM`, `JOIN`, `EXISTS`', '`(SELECT dept_id, AVG(salary) … GROUP BY dept_id)`'],
      ],
    ),

    h('In WHERE — a scalar subquery'),
    code(
      sql(`
SELECT name, salary
FROM employees
WHERE salary > (SELECT AVG(salary) FROM employees)
ORDER BY salary DESC;
`),
    ),
    result(
      ['name', 'salary'],
      [
        ['Ada', '`95000.00`'],
        ['Barbara', '`91000.00`'],
        ['Grace', '`82000.00`'],
      ],
      'Average is 81,333.33',
    ),
    p(
      'The inner query runs **once**, produces `81333.33`, and the outer query compares every row against that number. This is an *uncorrelated* subquery — it does not mention the outer query, so it can be evaluated independently and cached.',
    ),
    warn(
      'A scalar subquery that returns more than one row is a runtime error — `Subquery returns more than 1 row` — and it is the kind that passes in development and fails in production, because today the inner query happens to match one row and tomorrow it matches two. If more than one is possible, use `IN`, or force one with `LIMIT 1` and an `ORDER BY` that makes the choice deterministic.',
    ),

    h('In WHERE — a column subquery with IN'),
    code(
      sql(`
SELECT name
FROM employees
WHERE dept_id IN (SELECT id FROM departments WHERE location IN ('Bengaluru', 'Pune'));
`),
    ),
    result(['name'], [['Ada'], ['Grace'], ['Alan']]),
    p('Engineering is in Bengaluru and Design is in Pune, so departments 1 and 3 — which is Ada, Grace and Alan.'),
    warn(
      'If the inner column can be `NULL`, `NOT IN` returns **nothing at all** rather than what you expected. That is covered fully in the NULL topic; the rule to carry here is: `IN` is safe, `NOT IN` is safe only over a column you know has no NULLs, and `NOT EXISTS` is always safe.',
    ),

    h('In SELECT — a value per row'),
    code(
      sql(`
SELECT
  name,
  salary,
  (SELECT AVG(salary) FROM employees)                    AS company_avg,
  salary - (SELECT AVG(salary) FROM employees)           AS above_avg_by
FROM employees
ORDER BY above_avg_by DESC;
`),
    ),
    result(
      ['name', 'salary', 'company_avg', 'above_avg_by'],
      [
        ['Ada', '`95000.00`', '`81333.33`', '`13666.67`'],
        ['Barbara', '`91000.00`', '`81333.33`', '`9666.67`'],
        ['Grace', '`82000.00`', '`81333.33`', '`666.67`'],
        ['Radia', '`78000.00`', '`81333.33`', '`-3333.33`'],
        ['Linus', '`74000.00`', '`81333.33`', '`-7333.33`'],
        ['Alan', '`68000.00`', '`81333.33`', '`-13666.67`'],
      ],
    ),
    tip(
      'A subquery in the `SELECT` list must be **scalar** — one row, one column — because it is producing one cell. This particular shape is also exactly what a window function does more cheaply: `AVG(salary) OVER ()` computes the same number without a second pass over the table. Prefer the window function where your engine has them.',
    ),

    h('In FROM — a derived table'),
    p(
      'A subquery in `FROM` is a **derived table**: an anonymous result set the outer query treats as a table. It must be aliased — `t` below — and that alias is not optional in MySQL.',
    ),
    code(
      sql(`
SELECT dept_id, headcount
FROM (
  SELECT dept_id, COUNT(*) AS headcount
  FROM employees
  GROUP BY dept_id
) t
WHERE headcount > 1;
`),
    ),
    result(
      ['dept_id', 'headcount'],
      [
        ['`1`', '`2`'],
        ['`2`', '`2`'],
      ],
    ),
    note(
      'This particular example is better written with `HAVING`, and that is worth saying rather than hiding: a derived table earns its place when you need to filter on something `HAVING` cannot see — a window function, or an alias built from another alias. Wrapping a query to do what `HAVING` already does is a habit worth not forming.',
    ),

    h('The derived table that is genuinely necessary'),
    code(
      sql(`
-- Filtering on a window function. There is no other way to write this.
SELECT name, salary, rk
FROM (
  SELECT name, salary, DENSE_RANK() OVER (ORDER BY salary DESC) AS rk
  FROM employees
) ranked
WHERE rk <= 3;
`),
    ),
    result(
      ['name', 'salary', 'rk'],
      [
        ['Ada', '`95000.00`', '`1`'],
        ['Barbara', '`91000.00`', '`2`'],
        ['Grace', '`82000.00`', '`3`'],
      ],
    ),
    p(
      'Window functions are computed at step 5 and `WHERE` runs at step 2, so a window function can never be filtered in the same query that produced it. The wrap is not a workaround — it is the only order in which the question can be asked.',
    ),

    h('Joining to a derived table'),
    p('One of the most useful shapes there is — compare each row against its own group:'),
    code(
      sql(`
SELECT e.name, e.salary, d.dept_avg
FROM employees e
JOIN (
  SELECT dept_id, AVG(salary) AS dept_avg
  FROM employees
  GROUP BY dept_id
) d ON e.dept_id = d.dept_id
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
      'Everyone earning more than their own department average. The aggregate is computed once per department in the derived table, then joined back. A correlated subquery would compute it once **per row** — same answer, much more work, and that comparison is the next topic.',
    ),

    h('Where a subquery may appear'),
    table(
      ['clause', 'kind allowed', 'typical use'],
      [
        ['`SELECT`', 'Scalar only', 'A per-row computed value'],
        ['`FROM` / `JOIN`', 'Table', 'A derived table — pre-aggregate, or filter a window function'],
        ['`WHERE`', 'Scalar, column, or table with `EXISTS`', 'A filter that depends on other data'],
        ['`HAVING`', 'Scalar', 'Compare a group against a global figure'],
        ['`INSERT` / `UPDATE` / `DELETE`', 'Any', 'Choose rows or values from elsewhere'],
      ],
    ),
    code(
      sql(`
-- In HAVING.
SELECT dept_id, AVG(salary) AS avg_salary
FROM employees
GROUP BY dept_id
HAVING AVG(salary) > (SELECT AVG(salary) FROM employees);

-- In UPDATE.
UPDATE employees
SET salary = salary * 1.1
WHERE dept_id IN (SELECT id FROM departments WHERE location = 'Bengaluru');
`),
    ),
    result(
      ['dept_id', 'avg_salary'],
      [
        ['`1`', '`88500.00`'],
        ['`2`', '`82500.00`'],
      ],
      'Departments paying above the company average',
    ),

    h('Subquery or join'),
    table(
      ['use a', 'when'],
      [
        ['**Join**', 'You need columns from both tables in the result.'],
        ['**Subquery**', 'You only need the other table to *decide*, not to display.'],
        ['**`EXISTS`**', 'You are testing existence — it stops at the first match.'],
        ['**Derived table**', 'You need to pre-aggregate, or to filter on a window function.'],
        ['**CTE**', 'The same as a derived table, but named and readable. See the next topic but one.'],
      ],
    ),
    note(
      'The old advice that "joins are always faster than subqueries" is out of date. Modern optimisers rewrite an uncorrelated `IN` subquery into a semi-join and often produce an identical plan. Where a real difference remains it is usually a *correlated* subquery in the `SELECT` list, which can be genuinely quadratic — and the fix there is a join to a derived table, or a window function.',
    ),

    h('Interview'),
    asked([
      ['What is a subquery?', 'A SELECT nested inside another statement.'],
      ['Name the kinds by shape.', 'Scalar, row, column and table.'],
      ['Where can a subquery appear?', 'SELECT, FROM, WHERE, HAVING, and in INSERT, UPDATE and DELETE.'],
      ['What is a derived table?', 'A subquery in FROM, treated as a table. It must be aliased.'],
      ['What happens if a scalar subquery returns two rows?', 'A runtime error — which is why it often passes in dev and fails in production.'],
      ['Why must a window function be filtered in an outer query?', 'It is computed after WHERE, so WHERE cannot see it.'],
      ['Subquery or join?', 'Join when you need the other table’s columns; subquery when you only need it to decide.'],
      ['Are joins faster than subqueries?', 'Not reliably — optimisers rewrite uncorrelated subqueries into semi-joins. Correlated ones in the SELECT list are the ones that are genuinely slow.'],
      ['How do you find rows above their group average?', 'Join to a derived table that computes the per-group average.'],
    ]),

    h('Cheatsheet'),
    cheat([
      ['Compare against a single computed value', 'A scalar subquery in `WHERE`'],
      ['Filter by a list from another table', '`IN (SELECT …)`'],
      ['Exclude by a list', '`NOT EXISTS`, not `NOT IN`'],
      ['Show a global figure on every row', 'A scalar subquery in `SELECT`, or `AVG(x) OVER ()`'],
      ['Pre-aggregate then filter', 'A derived table in `FROM`'],
      ['Filter on a window function', 'A derived table — the only way'],
      ['Compare a row against its group', 'Join to a derived table of group aggregates'],
      ['Make it readable', 'A CTE instead of a derived table'],
    ]),

    links(wiki('Correlated_subquery', 'Subqueries'), wiki('Select_(SQL)#Subqueries', 'Subqueries in SELECT')),
  ],
};
