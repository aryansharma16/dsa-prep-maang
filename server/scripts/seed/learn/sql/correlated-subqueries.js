import { asked, cheat, code, h, links, note, p, result, sql, table, tip, warn, wiki } from '../blocks.js';
import { employees } from './sample-data.js';

export const doc = {
  blocks: [
    p(
      'A **correlated** subquery references a column from the outer query. That reference is what changes everything: it cannot be evaluated on its own, so it is re-evaluated **once per outer row** — which is what makes it powerful and what makes it the most reliable way to write an accidentally quadratic query.',
    ),
    employees(),

    h('The difference, in one column'),
    code(
      sql(`
-- Uncorrelated: self-contained. Runs once, the result is reused.
SELECT name FROM employees
WHERE salary > (SELECT AVG(salary) FROM employees);

-- Correlated: mentions e2 from the outer query. Runs once per row.
SELECT e1.name FROM employees e1
WHERE e1.salary > (SELECT AVG(e2.salary) FROM employees e2 WHERE e2.dept_id = e1.dept_id);
`),
    ),
    result(['name'], [['Ada'], ['Barbara']], 'The correlated one — above their own department average'),
    table(
      ['', 'Uncorrelated', 'Correlated'],
      [
        ['References the outer query', 'No', '**Yes**'],
        ['Can run standalone', 'Yes', 'No — the outer column is unbound'],
        ['Runs', 'Once', 'Conceptually once per outer row'],
        ['Answers', 'A global question', 'A per-row question'],
      ],
    ),
    note(
      '"Once per outer row" is the *semantics*, not necessarily the execution. A good optimiser recognises the shape and rewrites it — commonly into a join against a grouped derived table, which computes each department average once instead of once per employee. Whether it manages that depends on the engine, the version and the exact query, which is why the rewrite is worth knowing by hand.',
    ),

    h('Walking it'),
    p('The correlated query above, row by row. The inner query runs six times, with a different `e1.dept_id` each time:'),
    result(
      ['e1.name', 'e1.dept_id', 'e1.salary', 'inner AVG for that dept', 'kept?'],
      [
        ['Ada', '`1`', '`95000`', '`88500`', '**yes**'],
        ['Grace', '`1`', '`82000`', '`88500`', 'no'],
        ['Linus', '`2`', '`74000`', '`82500`', 'no'],
        ['Barbara', '`2`', '`91000`', '`82500`', '**yes**'],
        ['Alan', '`3`', '`68000`', '`68000`', 'no — not strictly greater'],
        ['Radia', '`NULL`', '`78000`', '**`NULL`**', 'no — the comparison is unknown'],
      ],
      'Six evaluations',
    ),
    warn(
      'The last row is the one worth stopping on. Radia\'s `dept_id` is `NULL`, so the inner query looks for rows where `x.dept_id = NULL` — which is never true — and matches **nothing**. `AVG` over zero rows returns `NULL`, so the comparison is `78000 > NULL`, which is `NULL`, which is not true. She is dropped. Nothing errors, and a query written as "everyone above their department average" has silently excluded the person who has no department. This is the NULL topic\'s three-valued logic arriving inside a subquery, and it is why a correlated query over a nullable join column deserves a second look.',
    ),

    h('The four things it is genuinely good at'),
    p('**1 · A per-row aggregate over a related set.**'),
    code(
      sql(`
SELECT e.name, e.salary,
  (SELECT COUNT(*) FROM employees x WHERE x.dept_id = e.dept_id) AS dept_size
FROM employees e;
`),
    ),
    p('**2 · Existence — does a related row exist?**'),
    code(
      sql(`
-- Managers: employees who have at least one report.
SELECT m.name FROM employees m
WHERE EXISTS (SELECT 1 FROM employees e WHERE e.manager_id = m.id);
`),
    ),
    result(['name'], [['Ada'], ['Barbara']]),
    p('**3 · Non-existence — the anti-join.**'),
    code(
      sql(`
-- Individual contributors: nobody reports to them.
SELECT e.name FROM employees e
WHERE NOT EXISTS (SELECT 1 FROM employees r WHERE r.manager_id = e.id);
`),
    ),
    result(['name'], [['Grace'], ['Linus'], ['Alan'], ['Radia']]),
    p('**4 · The greatest row per group** — the classic, and one of the most-asked interview queries:'),
    code(
      sql(`
-- The highest earner in each department.
SELECT e.name, e.dept_id, e.salary
FROM employees e
WHERE e.salary = (
  SELECT MAX(x.salary) FROM employees x WHERE x.dept_id = e.dept_id
);
`),
    ),
    result(
      ['name', 'dept_id', 'salary'],
      [
        ['Ada', '`1`', '`95000.00`'],
        ['Barbara', '`2`', '`91000.00`'],
        ['Alan', '`3`', '`68000.00`'],
      ],
      '3 rows — Radia is dropped again, for the same NULL reason',
    ),
    tip(
      'This form returns **every** row tied for the maximum, which is often what you want and occasionally not. `ROW_NUMBER() OVER (PARTITION BY dept_id ORDER BY salary DESC) = 1` returns exactly one per group, arbitrarily among ties; `RANK() = 1` returns all of them, like this query. Choosing between them is really choosing what to do about ties, and that is the question to ask before writing either.',
    ),

    h('EXISTS stops early'),
    p(
      '`EXISTS` returns as soon as the inner query produces its first row. It never counts, never sorts and never materialises a result set, which is why `SELECT 1` is the conventional inner select list — the value is discarded, so there is no point computing one.',
    ),
    code(
      sql(`
-- All three are identical. The first is conventional.
WHERE EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id)
WHERE EXISTS (SELECT * FROM orders o WHERE o.customer_id = c.id)
WHERE EXISTS (SELECT NULL FROM orders o WHERE o.customer_id = c.id)
`),
    ),
    warn(
      'Do not write `WHERE (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id) > 0`. It is the same question and it counts **every** matching row before comparing — for a customer with ten thousand orders, that is ten thousand rows read to answer "at least one?". `EXISTS` reads one.',
    ),

    h('When it is slow, and the rewrite'),
    p('The shape that bites is a correlated subquery in the `SELECT` list, evaluated for every row of a large result:'),
    code(
      sql(`
-- Correlated: the inner aggregate runs once per employee.
SELECT e.name,
  (SELECT COUNT(*) FROM employees x WHERE x.dept_id = e.dept_id) AS dept_size
FROM employees e;

-- Rewrite 1: join to a derived table. The aggregate runs once per department.
SELECT e.name, d.dept_size
FROM employees e
LEFT JOIN (
  SELECT dept_id, COUNT(*) AS dept_size FROM employees GROUP BY dept_id
) d ON e.dept_id = d.dept_id;

-- Rewrite 2: a window function. One pass, no join.
SELECT name, COUNT(*) OVER (PARTITION BY dept_id) AS dept_size
FROM employees;
`),
    ),
    table(
      ['form', 'aggregate computed', 'passes over the table'],
      [
        ['Correlated subquery', 'Once per **row**', 'Up to N + 1'],
        ['Derived table join', 'Once per **group**', '2'],
        ['Window function', 'Once', '**1**'],
      ],
    ),
    tip(
      'The window function is almost always the right answer where the engine has them, and it is also the most readable of the three. Reach for the derived-table join when you need the aggregate at a different grain from the rows, and for the correlated form when the relationship is genuinely per-row and cannot be grouped.',
    ),

    h('Correlated subqueries in UPDATE and DELETE'),
    code(
      sql(`
-- Give everyone their department's average as a new salary.
UPDATE employees e
SET salary = (SELECT AVG(x.salary) FROM employees x WHERE x.dept_id = e.dept_id);

-- Delete employees whose department has been removed.
DELETE FROM employees e
WHERE NOT EXISTS (SELECT 1 FROM departments d WHERE d.id = e.dept_id);
`),
    ),
    warn(
      'MySQL refuses to update a table while selecting from it in a subquery — *"You can\'t specify target table for update in FROM clause"*. The workaround is to wrap the inner query in a derived table, which forces MySQL to materialise it first: `(SELECT * FROM (SELECT … FROM employees) tmp)`. PostgreSQL has no such restriction.',
    ),
    warn(
      'The `DELETE` above also deletes everyone whose `dept_id` is `NULL` — `NOT EXISTS` is true when there is nothing to match, and there never is for a NULL. If "no department yet" should be kept, add `AND e.dept_id IS NOT NULL`.',
    ),

    h('Interview'),
    asked([
      ['What is a correlated subquery?', 'One that references a column from the outer query, so it is evaluated per outer row.'],
      ['How is it different from a normal subquery?', 'An uncorrelated subquery is self-contained and runs once; a correlated one cannot run standalone.'],
      ['Why are they often slow?', 'Conceptually one execution per outer row — quadratic if the inner query scans.'],
      ['How do you rewrite one?', 'Join to a derived table that pre-aggregates, or use a window function.'],
      ['Why is `SELECT 1` used inside EXISTS?', 'The value is discarded — EXISTS only asks whether a row was produced.'],
      ['EXISTS vs COUNT(*) > 0?', 'EXISTS stops at the first match; COUNT reads every matching row first.'],
      ['How do you find the maximum row per group?', 'A correlated `= (SELECT MAX(…) …)`, or `ROW_NUMBER`/`RANK` in a window.'],
      ['Which of those handles ties differently?', 'The correlated form and RANK return all tied rows; ROW_NUMBER returns one arbitrarily.'],
      ['Can MySQL update a table it selects from?', 'Not directly — wrap the subquery in a derived table so it is materialised first.'],
    ]),

    h('Cheatsheet'),
    cheat([
      ['Compare a row to its group', 'Correlated aggregate, or a window function'],
      ['Does a related row exist?', '`EXISTS (SELECT 1 …)`'],
      ['Does it not?', '`NOT EXISTS` — safe with NULLs, unlike `NOT IN`'],
      ['Max row per group', '`= (SELECT MAX(…) WHERE grp = outer.grp)`'],
      ['Exactly one row per group', '`ROW_NUMBER() … = 1`'],
      ['Speed up a correlated aggregate', 'Join to a grouped derived table'],
      ['Speed it up further', 'A window function — one pass'],
      ['Test existence', 'Never `COUNT(*) > 0`'],
    ]),

    links(
      wiki('Correlated_subquery', 'Correlated subquery'),
      wiki('Semi-join', 'Semi-joins and anti-joins'),
    ),
  ],
};
