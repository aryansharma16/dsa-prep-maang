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
  postgres,
  result,
  sql,
  table,
  tip,
  warn,
} from '../blocks.js';
import { employees } from './sample-data.js';

export const doc = {
  blocks: [
    p(
      'Rows come out of a query in **no defined order** unless you ask for one. Not insertion order, not primary-key order — no order. It usually looks sorted, because a small table is often scanned in storage order, and then one day an index changes or a plan flips and the "order" you were relying on is gone. `ORDER BY` is the only guarantee there is.',
    ),
    employees(),

    h('ORDER BY'),
    code(
      sql(`
SELECT name, salary FROM employees ORDER BY salary DESC;
`),
    ),
    result(
      ['name', 'salary'],
      [
        ['Ada', '`95000.00`'],
        ['Barbara', '`91000.00`'],
        ['Grace', '`82000.00`'],
        ['Radia', '`78000.00`'],
        ['Linus', '`74000.00`'],
        ['Alan', '`68000.00`'],
      ],
    ),
    code(
      sql(`
-- Several keys: the second breaks ties in the first.
SELECT name, dept_id, salary
FROM employees
ORDER BY dept_id ASC, salary DESC;

-- ASC is the default, so it is usually left off.
SELECT name FROM employees ORDER BY name;

-- An alias works here — ORDER BY runs after SELECT.
SELECT name, salary * 12 AS annual FROM employees ORDER BY annual DESC;

-- An expression works too.
SELECT name FROM employees ORDER BY LENGTH(name), name;
`),
    ),
    result(
      ['name', 'dept_id', 'salary'],
      [
        ['Radia', '`NULL`', '`78000.00`'],
        ['Ada', '`1`', '`95000.00`'],
        ['Grace', '`1`', '`82000.00`'],
        ['Barbara', '`2`', '`91000.00`'],
        ['Linus', '`2`', '`74000.00`'],
        ['Alan', '`3`', '`68000.00`'],
      ],
      'dept_id ASC, salary DESC — in MySQL',
    ),
    note(
      'Radia is first because MySQL sorts NULLs **before** everything when ascending. PostgreSQL sorts them **last**. Neither is wrong — the standard leaves it to the implementation — which is exactly why a query whose ordering matters should say what it wants rather than inherit a default that changes with the engine.',
    ),

    h('Where the NULLs go'),
    code(
      mysql(`
-- MySQL has no NULLS LAST. Sort by "is it null" first: false (0) sorts before true (1).
SELECT name, dept_id FROM employees ORDER BY dept_id IS NULL, dept_id;
`),
      postgres(`
SELECT name, dept_id FROM employees ORDER BY dept_id NULLS LAST;
SELECT name, dept_id FROM employees ORDER BY dept_id DESC NULLS FIRST;
`),
    ),

    h('ORDER BY by position'),
    code(
      sql(`
-- Legal: sort by the 2nd column of the SELECT list.
SELECT name, salary FROM employees ORDER BY 2 DESC;
`),
    ),
    warn(
      'Valid, and worth avoiding outside a throwaway query. Add a column to the `SELECT` list and every positional `ORDER BY` in that query silently starts sorting by something else. It is the same failure mode as an `INSERT` without a column list, and it is deprecated in recent PostgreSQL for the same reason.',
    ),

    h('LIMIT and OFFSET'),
    code(
      mysql(`
SELECT name, salary FROM employees ORDER BY salary DESC LIMIT 3;

SELECT name, salary FROM employees ORDER BY salary DESC LIMIT 3 OFFSET 2;
SELECT name, salary FROM employees ORDER BY salary DESC LIMIT 2, 3;  -- offset, count
`),
      postgres(`
SELECT name, salary FROM employees ORDER BY salary DESC LIMIT 3 OFFSET 2;

-- The standard spelling, also supported by SQL Server and Oracle.
SELECT name, salary FROM employees
ORDER BY salary DESC
OFFSET 2 ROWS FETCH NEXT 3 ROWS ONLY;
`),
    ),
    result(
      ['name', 'salary'],
      [
        ['Grace', '`82000.00`'],
        ['Radia', '`78000.00`'],
        ['Linus', '`74000.00`'],
      ],
      'LIMIT 3 OFFSET 2',
    ),
    warn(
      "MySQL's `LIMIT 2, 3` puts the **offset first** and the count second, which is the reverse of how `LIMIT 3 OFFSET 2` reads. Both forms mean the same thing here. Prefer the explicit `OFFSET` spelling — it is portable and it cannot be misread.",
    ),

    h('A LIMIT without an ORDER BY is meaningless'),
    warn(
      '`SELECT * FROM employees LIMIT 3` returns *some* three rows. Which three is undefined and may change between runs, between versions, and after an index is added. "The first three" is not a thing a table has. If you are taking a subset, you are implicitly claiming an order — say it.',
    ),
    p(
      'The same applies to ties. `ORDER BY salary DESC LIMIT 3` is only deterministic if no two salaries are equal; where they might be, add a tiebreaker that is unique: `ORDER BY salary DESC, id`.',
    ),

    h('The Nth highest salary'),
    p('The most-asked SQL interview question, and `LIMIT`/`OFFSET` is the simplest answer:'),
    code(
      sql(`
-- 2nd highest: skip 1, take 1.
SELECT DISTINCT salary FROM employees ORDER BY salary DESC LIMIT 1 OFFSET 1;
`),
    ),
    result(['salary'], [['`91000.00`']]),
    p(
      '`DISTINCT` matters. Without it, two people on 95,000 would make the "second highest salary" also 95,000 — which is the second highest *row*, not the second highest *salary*. Ask which one the interviewer wants; they usually mean distinct.',
    ),
    p('The general form, and the two other ways it is asked:'),
    code(
      sql(`
-- Nth highest, parameterised. OFFSET takes N-1.
SELECT DISTINCT salary FROM employees ORDER BY salary DESC LIMIT 1 OFFSET 3;

-- Without LIMIT, using a correlated subquery — the classic textbook answer.
SELECT DISTINCT e1.salary FROM employees e1
WHERE 2 = (SELECT COUNT(DISTINCT e2.salary) FROM employees e2 WHERE e2.salary > e1.salary);

-- With a window function — the one to reach for in production.
SELECT salary FROM (
  SELECT salary, DENSE_RANK() OVER (ORDER BY salary DESC) AS rk
  FROM employees
) t
WHERE rk = 2;
`),
    ),
    tip(
      '`DENSE_RANK` rather than `RANK` in that last one, and it is deliberate: `RANK` leaves gaps after a tie, so with two people on 95,000 there is no rank 2 at all and the query returns nothing. `DENSE_RANK` never skips. This distinction has its own topic in the window-functions section, and it is a favourite follow-up here.',
    ),

    h('Pagination, and where it goes wrong'),
    code(
      sql(`
-- Page 1, page 2, page 3 …
SELECT id, name FROM employees ORDER BY id LIMIT 20 OFFSET 0;
SELECT id, name FROM employees ORDER BY id LIMIT 20 OFFSET 20;
`),
    ),
    p('Two problems, and both get worse with scale:'),
    table(
      ['problem', 'why', 'fix'],
      [
        [
          '**It gets slower every page**',
          '`OFFSET 100000` makes the database produce 100,020 rows and throw away 100,000. The work is proportional to the offset, not the page size.',
          'Keyset pagination, below.',
        ],
        [
          '**Rows are skipped or repeated**',
          'Someone inserts a row while you are on page 3. Everything shifts by one, so page 4 starts one row late — a row is never shown.',
          'Keyset pagination, again.',
        ],
      ],
    ),
    code(
      sql(`
-- Keyset (a.k.a. seek, or cursor) pagination: remember where you stopped.
SELECT id, name FROM employees ORDER BY id LIMIT 20;                 -- first page
SELECT id, name FROM employees WHERE id > 1042 ORDER BY id LIMIT 20; -- next page

-- Sorting on a non-unique column needs the tiebreaker in both places.
SELECT id, salary FROM employees
WHERE (salary, id) < (82000, 3)
ORDER BY salary DESC, id DESC
LIMIT 20;
`),
    ),
    note(
      'Keyset pagination is `O(page size)` regardless of how deep you are, because the `WHERE` seeks straight into the index. The trade is that you cannot jump to page 57 — only forwards and backwards from where you are. For an infinite-scroll feed that is not a limitation; for a table with numbered pages it is, and offset pagination remains the honest answer there.',
    ),

    h('Interview'),
    asked([
      ['What order do rows come back in without ORDER BY?', 'Undefined. Any apparent order is an accident of the plan.'],
      ['Is ASC or DESC the default?', 'ASC.'],
      ['Where do NULLs sort?', 'MySQL first when ascending, PostgreSQL last. Postgres has NULLS FIRST/LAST; in MySQL sort by `col IS NULL` first.'],
      ['Can ORDER BY use a SELECT alias?', 'Yes — it runs after SELECT.'],
      ['How do you get the second highest salary?', '`SELECT DISTINCT salary … ORDER BY salary DESC LIMIT 1 OFFSET 1`, or DENSE_RANK = 2.'],
      ['Why DENSE_RANK rather than RANK there?', 'RANK leaves gaps after ties, so rank 2 may not exist. DENSE_RANK never skips.'],
      ['Why is deep OFFSET slow?', 'The engine generates and discards every skipped row; cost grows with the offset.'],
      ['How can pagination skip a row?', 'An insert before your current page shifts everything down by one, so the next offset starts past it.'],
      ['What is keyset pagination?', 'Filtering on the last row’s key instead of counting rows — constant cost, but no jumping to an arbitrary page.'],
      ['Is LIMIT applied before or after ORDER BY?', 'After. It is the last step of all.'],
    ]),

    h('Cheatsheet'),
    cheat([
      ['Guarantee an order', '`ORDER BY` — nothing else does'],
      ['Break ties deterministically', 'Add a unique column: `ORDER BY salary DESC, id`'],
      ['Sort by a computed column', 'Use its alias — `ORDER BY` runs late'],
      ['Put NULLs last', '`NULLS LAST`, or `ORDER BY col IS NULL, col`'],
      ['Take the top N', '`ORDER BY … LIMIT n`'],
      ['Take the Nth', '`LIMIT 1 OFFSET n-1`, or `DENSE_RANK() = n`'],
      ['Paginate a feed', 'Keyset — `WHERE id > :last ORDER BY id LIMIT n`'],
      ['Paginate numbered pages', '`LIMIT … OFFSET …`, knowing the cost'],
    ]),

    links(
      mysqlDoc('select.html', 'SELECT and LIMIT (MySQL)'),
      mysqlDoc('order-by-optimization.html', 'ORDER BY optimisation'),
    ),
  ],
};
