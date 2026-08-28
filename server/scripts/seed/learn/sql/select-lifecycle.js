import { asked, cheat, code, h, links, note, p, result, sql, table, tip, warn, wiki } from '../blocks.js';
import { departments, employees } from './sample-data.js';

/*
  The single highest-leverage topic in the Querying section. Almost every "why
  can't I do X" question in SQL — aliases in WHERE, HAVING vs WHERE, why
  DISTINCT can't see an ORDER BY column — is the same answer, and it is this
  one. So it goes first, and the rest of the section refers back to it.
*/
export const doc = {
  blocks: [
    p(
      'You write `SELECT` first. The engine runs it **sixth**. Nearly every confusing rule in SQL — why an alias works in `ORDER BY` and not in `WHERE`, why `HAVING` exists, why `SELECT *` with `GROUP BY` is an error — is a consequence of that one gap, and once you have the real order the rules stop needing to be memorised.',
    ),

    h('The two orders'),
    table(
      ['you write', 'the engine runs', 'and at that point'],
      [
        ['`SELECT`', '**1** `FROM` / `JOIN`', 'The rows exist. Nothing has been filtered or named.'],
        ['`FROM`', '**2** `WHERE`', 'Individual rows are filtered. **No groups yet, no aliases yet.**'],
        ['`JOIN`', '**3** `GROUP BY`', 'Rows collapse into groups.'],
        ['`WHERE`', '**4** `HAVING`', 'Groups are filtered. Aggregates are available.'],
        ['`GROUP BY`', '**5** `WINDOW` functions', 'Window functions are computed over the grouped result.'],
        ['`HAVING`', '**6** `SELECT`', '**Expressions are evaluated and aliases are created.**'],
        ['`ORDER BY`', '**7** `DISTINCT`', 'Duplicate result rows are removed.'],
        ['`LIMIT`', '**8** `ORDER BY`', 'Aliases exist by now, so they can be used.'],
        ['', '**9** `LIMIT` / `OFFSET`', 'The window of rows is taken, last of all.'],
      ],
    ),
    tip(
      'The mnemonic that sticks: **From Where Group Having Select Distinct Order Limit** — "**F**rom **W**here **G**roup **H**aving **S**elect **D**istinct **O**rder **L**imit". Whenever a query does something surprising, walk it in that order and the surprise usually disappears at step 2 or step 6.',
    ),
    note(
      'This is the *logical* order — the order that defines what the result means. The optimiser is free to execute it however it likes, and routinely pushes filters below joins and stops early on a `LIMIT`. It just has to produce the rows this order would have produced.',
    ),

    h('Puzzle 1 — an alias in WHERE'),
    employees(),
    code(
      sql(`
-- Fails.
SELECT name, salary * 12 AS annual
FROM employees
WHERE annual > 1000000;
-- ERROR 1054: Unknown column 'annual' in 'where clause'
`),
    ),
    p(
      '`WHERE` runs at step 2 and `SELECT` creates the alias at step 6. When the filter is evaluated, `annual` does not exist yet. Repeat the expression, or wrap the query:',
    ),
    code(
      sql(`
-- Repeat it.
SELECT name, salary * 12 AS annual
FROM employees
WHERE salary * 12 > 1000000;

-- Or make the alias exist before the filter runs, by putting it in an inner query.
SELECT * FROM (
  SELECT name, salary * 12 AS annual FROM employees
) t
WHERE annual > 1000000;
`),
    ),
    result(
      ['name', 'annual'],
      [
        ['Ada', '`1140000`'],
        ['Barbara', '`1092000`'],
      ],
      'Both forms',
    ),

    h('Puzzle 2 — an alias in ORDER BY'),
    p('The same alias, in a different clause, and now it works:'),
    code(
      sql(`
SELECT name, salary * 12 AS annual
FROM employees
ORDER BY annual DESC;
`),
    ),
    result(
      ['name', 'annual'],
      [
        ['Ada', '`1140000`'],
        ['Barbara', '`1092000`'],
        ['Grace', '`984000`'],
        ['Radia', '`936000`'],
        ['Linus', '`888000`'],
        ['Alan', '`816000`'],
      ],
    ),
    p(
      '`ORDER BY` is step 8, comfortably after `SELECT` at step 6. The alias exists by then. **The difference between the two puzzles is nothing but their position in the list**, which is why the list is worth knowing.',
    ),

    h('Puzzle 3 — WHERE cannot see an aggregate'),
    code(
      sql(`
-- Fails.
SELECT dept_id, COUNT(*) AS headcount
FROM employees
GROUP BY dept_id
WHERE COUNT(*) > 1;
-- ERROR: Invalid use of group function
`),
    ),
    p(
      '`WHERE` runs at step 2, before `GROUP BY` at step 3. There are no groups yet, so there is nothing for `COUNT(*)` to count. `HAVING` exists precisely to fill that gap — it is the filter that runs *after* grouping:',
    ),
    code(
      sql(`
SELECT dept_id, COUNT(*) AS headcount
FROM employees
GROUP BY dept_id
HAVING COUNT(*) > 1;
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
      'So `WHERE` filters **rows** before grouping and `HAVING` filters **groups** after it. That is the whole distinction, and it is a positional fact rather than a rule about aggregates: this is why `HAVING` can also reference a plain column, and why a filter that does not involve an aggregate belongs in `WHERE`, where it removes rows before the more expensive grouping happens.',
    ),

    h('Puzzle 4 — using both, on purpose'),
    departments(),
    p('Both filters, doing different jobs in one query:'),
    code(
      sql(`
SELECT d.name AS department, COUNT(*) AS headcount, AVG(e.salary) AS avg_salary
FROM employees e
JOIN departments d ON e.dept_id = d.id       -- 1. rows exist
WHERE e.salary > 70000                       -- 2. drop Alan (68000), per row
GROUP BY d.name                              -- 3. collapse into departments
HAVING COUNT(*) > 1                          -- 4. keep departments with 2+ left
ORDER BY avg_salary DESC;                    -- 8. alias is available here
`),
    ),
    p('Walk it: the join gives 5 rows (Radia has no department). `WHERE` drops Alan, leaving 4. Grouping gives Engineering (Ada, Grace) and Data (Linus, Barbara). `HAVING` keeps both, since both have 2.'),
    result(
      ['department', 'headcount', 'avg_salary'],
      [
        ['Engineering', '`2`', '`88500.00`'],
        ['Data', '`2`', '`82500.00`'],
      ],
    ),

    h('Puzzle 5 — DISTINCT and ORDER BY'),
    code(
      sql(`
-- Fails in PostgreSQL, and in MySQL with ONLY_FULL_GROUP_BY.
SELECT DISTINCT dept_id FROM employees ORDER BY salary;
-- ERROR: for SELECT DISTINCT, ORDER BY expressions must appear in select list
`),
    ),
    p(
      '`DISTINCT` is step 7 and `ORDER BY` is step 8. By the time the sort runs, `salary` has already been collapsed away — several salaries went into each surviving `dept_id` row, and there is no single value left to sort by. The error is the engine refusing to pick one arbitrarily.',
    ),

    h('Where window functions sit'),
    p(
      'Step 5 — after `HAVING`, before `SELECT`. That placement explains both of the things people find surprising about them:',
    ),
    code(
      sql(`
-- A window function sees post-grouping rows, so it cannot be filtered by WHERE.
SELECT name, salary, RANK() OVER (ORDER BY salary DESC) AS rk
FROM employees;

-- Fails: rk does not exist at step 2.
-- SELECT ... FROM employees WHERE RANK() OVER (...) <= 3;

-- Wrap it, so the ranking is complete before the filter runs.
SELECT * FROM (
  SELECT name, salary, RANK() OVER (ORDER BY salary DESC) AS rk
  FROM employees
) t
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
      'Top three earners',
    ),
    warn(
      'This wrapping — compute the window function inside, filter on it outside — is the single most reused pattern in interview SQL. "Top N per group", "the second highest salary", "the most recent row per customer" are all it. It is not a workaround; it is the only way, because a window function is defined to run after filtering.',
    ),

    h('Interview'),
    asked([
      ['What is the logical execution order?', 'FROM, WHERE, GROUP BY, HAVING, window functions, SELECT, DISTINCT, ORDER BY, LIMIT.'],
      ['Why can I not use an alias in WHERE?', 'WHERE runs before SELECT, so the alias does not exist yet.'],
      ['Why can I use one in ORDER BY?', 'ORDER BY runs after SELECT, so it does.'],
      ['WHERE vs HAVING?', 'WHERE filters rows before grouping; HAVING filters groups after it.'],
      ['Which is more efficient?', 'WHERE — it removes rows before the grouping work happens. Put a filter there whenever it does not need an aggregate.'],
      ['Where do window functions run?', 'After HAVING and before SELECT — which is why filtering on one needs a subquery.'],
      ['When is LIMIT applied?', 'Last, after ordering.'],
      ['Is the logical order the execution order?', 'No — the optimiser reorders freely, as long as the result matches what this order would produce.'],
    ]),

    h('Cheatsheet'),
    cheat([
      ['Filter rows', '`WHERE` — before grouping'],
      ['Filter groups', '`HAVING` — after grouping'],
      ['Filter on a window function', 'A subquery, then `WHERE` outside it'],
      ['Use an alias in a filter', 'Repeat the expression, or wrap the query'],
      ['Use an alias in a sort', 'Just use it — `ORDER BY` runs late'],
      ['Debug a surprising query', 'Walk F-W-G-H-S-D-O-L and find the step that breaks'],
    ]),

    links(
      wiki('Select_(SQL)', 'SELECT'),
      wiki('Order_of_operations', 'Order of operations'),
    ),
  ],
};
