import { asked, cheat, code, h, links, mysqlDoc, note, p, result, sql, table, tip, warn } from '../blocks.js';
import { departments, employees } from './sample-data.js';

export const doc = {
  blocks: [
    p(
      '`GROUP BY` collapses rows that share a value into one row each, and every aggregate in the `SELECT` list is then computed **per group** rather than over the whole table. `HAVING` filters the groups afterwards.',
    ),
    employees(),

    h('One group per value'),
    code(
      sql(`
SELECT dept_id, COUNT(*) AS headcount, AVG(salary) AS avg_salary
FROM employees
GROUP BY dept_id;
`),
    ),
    result(
      ['dept_id', 'headcount', 'avg_salary'],
      [
        ['`NULL`', '`1`', '`78000.00`'],
        ['`1`', '`2`', '`88500.00`'],
        ['`2`', '`2`', '`82500.00`'],
        ['`3`', '`1`', '`68000.00`'],
      ],
    ),
    p(
      'Four groups from six rows. **All the NULLs form one group** — `GROUP BY` treats them as equal to each other, which is inconsistent with `=` and is what you want. If you would rather they were not a group, filter them out in `WHERE`.',
    ),

    h('The rule about what may appear'),
    p(
      'Every column in the `SELECT` list must either be **in the `GROUP BY`** or **inside an aggregate**. There is no third option, and the reason is arithmetic rather than pedantry:',
    ),
    code(
      sql(`
-- Rejected. There are two names in department 1 and one output row.
SELECT dept_id, name, COUNT(*) FROM employees GROUP BY dept_id;
-- ERROR 1055: Expression #2 of SELECT list is not in GROUP BY clause
--             and contains a nonaggregated column
`),
    ),
    warn(
      'MySQL before 5.7 allowed this and returned an arbitrary name. It was not returning the wrong answer — there is no right answer, and picking one silently is worse than refusing. `ONLY_FULL_GROUP_BY` has been on by default since 5.7 and PostgreSQL has always rejected it. If you meet a legacy MySQL that permits it, the query is broken regardless of what it returns.',
    ),
    p('Three ways to fix it, depending on what you actually wanted:'),
    code(
      sql(`
-- 1. Group by it too — one row per (dept, name), which here is one row per person.
SELECT dept_id, name, COUNT(*) FROM employees GROUP BY dept_id, name;

-- 2. Aggregate it — collapse the names into one value.
SELECT dept_id, GROUP_CONCAT(name) AS team, COUNT(*) FROM employees GROUP BY dept_id;

-- 3. You wanted a per-row value beside a per-group one: that is a window function.
SELECT name, dept_id, COUNT(*) OVER (PARTITION BY dept_id) AS dept_size FROM employees;
`),
    ),
    tip(
      'The third is the one people reach for `GROUP BY` and fail to get. "Show me each employee **and** how many people are in their department" is not a grouping question at all — grouping destroys the individual rows, and a window function keeps them. That distinction is the whole point of the window-functions topic.',
    ),

    h('Grouping by more than one column'),
    departments(),
    code(
      sql(`
SELECT d.location, e.dept_id, COUNT(*) AS headcount
FROM employees e
JOIN departments d ON e.dept_id = d.id
GROUP BY d.location, e.dept_id
ORDER BY d.location;
`),
    ),
    result(
      ['location', 'dept_id', 'headcount'],
      [
        ['Bengaluru', '`1`', '`2`'],
        ['Hyderabad', '`2`', '`2`'],
        ['Pune', '`3`', '`1`'],
      ],
    ),
    p(
      'One group per **distinct combination**. Radia is absent because the inner join dropped her — she has no department — which is a reminder that `GROUP BY` groups whatever the earlier steps handed it.',
    ),

    h('HAVING'),
    p('`WHERE` cannot see an aggregate, because it runs before the groups exist. `HAVING` is the filter that runs after:'),
    code(
      sql(`
SELECT dept_id, COUNT(*) AS headcount, AVG(salary) AS avg_salary
FROM employees
GROUP BY dept_id
HAVING COUNT(*) > 1;
`),
    ),
    result(
      ['dept_id', 'headcount', 'avg_salary'],
      [
        ['`1`', '`2`', '`88500.00`'],
        ['`2`', '`2`', '`82500.00`'],
      ],
    ),

    h('WHERE and HAVING together'),
    p('They are not alternatives. A good query usually has both, doing different jobs:'),
    code(
      sql(`
SELECT d.name AS department, COUNT(*) AS headcount, SUM(e.salary) AS wage_bill
FROM employees e
JOIN departments d ON e.dept_id = d.id
WHERE e.hired_on < '2022-01-01'      -- per row, before grouping: drops Alan
GROUP BY d.name
HAVING SUM(e.salary) > 150000        -- per group, after: keeps the expensive teams
ORDER BY wage_bill DESC;
`),
    ),
    p(
      'Walk it. The join gives 5 rows. `WHERE` drops Alan (hired 2022) — Radia was already gone. Four rows remain: Ada and Grace in Engineering, Linus and Barbara in Data. Grouping gives two groups with wage bills of 177,000 and 165,000. `HAVING` keeps both.',
    ),
    result(
      ['department', 'headcount', 'wage_bill'],
      [
        ['Engineering', '`2`', '`177000.00`'],
        ['Data', '`2`', '`165000.00`'],
      ],
    ),
    table(
      ['', '`WHERE`', '`HAVING`'],
      [
        ['Runs', 'Step 2 — before grouping', 'Step 4 — after grouping'],
        ['Filters', 'Rows', 'Groups'],
        ['Can use an aggregate', '**No**', '**Yes**'],
        ['Can use a plain column', 'Yes', 'Yes, if it is in the `GROUP BY`'],
        ['Can use a `SELECT` alias', 'No', 'MySQL yes, PostgreSQL no'],
        ['Cost', 'Cheaper — removes rows before the work', 'Later, so the work is already done'],
      ],
    ),
    warn(
      '**Put a filter in `WHERE` whenever it does not need an aggregate.** `HAVING dept_id = 1` is legal and does the same thing as `WHERE dept_id = 1`, after grouping every other department for nothing. On six rows that is invisible; on six million it is the query.',
    ),

    h('The pattern: finding duplicates'),
    p('`GROUP BY` plus `HAVING COUNT(*) > 1` is the canonical duplicate finder, and it comes up in interviews constantly:'),
    code(
      sql(`
-- Which names appear more than once?
SELECT name, COUNT(*) AS copies
FROM employees
GROUP BY name
HAVING COUNT(*) > 1;

-- Duplicate on a combination of columns.
SELECT name, dept_id, COUNT(*) AS copies
FROM employees
GROUP BY name, dept_id
HAVING COUNT(*) > 1;

-- And the rows themselves, not just the keys.
SELECT * FROM employees
WHERE name IN (SELECT name FROM employees GROUP BY name HAVING COUNT(*) > 1)
ORDER BY name;
`),
    ),

    h('ROLLUP — subtotals for free'),
    code(
      sql(`
SELECT dept_id, COUNT(*) AS headcount, SUM(salary) AS wage_bill
FROM employees
GROUP BY dept_id WITH ROLLUP;
`),
    ),
    result(
      ['dept_id', 'headcount', 'wage_bill'],
      [
        ['`NULL`', '`1`', '`78000.00`'],
        ['`1`', '`2`', '`177000.00`'],
        ['`2`', '`2`', '`165000.00`'],
        ['`3`', '`1`', '`68000.00`'],
        ['`NULL`', '`6`', '`488000.00`'],
      ],
      'The last row is the grand total',
    ),
    note(
      'The grand-total row carries `NULL` in the grouped column — which is indistinguishable from the genuine `NULL` group at the top, and this is a real reporting bug rather than a curiosity. `GROUPING(dept_id)` returns 1 for a rollup row and 0 for a real one, and is the only reliable way to tell them apart. PostgreSQL spells the whole thing `GROUP BY ROLLUP(dept_id)`.',
    ),

    h('Interview'),
    asked([
      ['What does GROUP BY do?', 'Collapses rows sharing a value into one row per distinct value, with aggregates computed per group.'],
      ['What may appear in the SELECT list?', 'Only grouped columns and aggregates.'],
      ['Why?', 'Any other column has many values per group and one output row, so there is no correct answer.'],
      ['WHERE vs HAVING?', 'WHERE filters rows before grouping; HAVING filters groups after it.'],
      ['Which should a non-aggregate filter go in?', 'WHERE — it removes rows before the grouping work happens.'],
      ['Can HAVING be used without GROUP BY?', 'Yes — the whole table is one group, so `HAVING COUNT(*) > 5` filters that single row.'],
      ['Do NULLs form a group?', 'Yes, all of them together as one group.'],
      ['How do you find duplicates?', '`GROUP BY col HAVING COUNT(*) > 1`.'],
      ['How do you show a per-group figure beside each row?', 'A window function, not GROUP BY — grouping destroys the individual rows.'],
      ['What is WITH ROLLUP?', 'Adds subtotal and grand-total rows; use `GROUPING()` to distinguish them from real NULL groups.'],
    ]),

    h('Cheatsheet'),
    cheat([
      ['Count per category', '`GROUP BY category`'],
      ['Count per combination', '`GROUP BY a, b`'],
      ['Filter rows first', '`WHERE`'],
      ['Filter groups', '`HAVING`'],
      ['Find duplicates', '`GROUP BY col HAVING COUNT(*) > 1`'],
      ['Groups above a threshold', '`HAVING SUM(x) > n`'],
      ['A per-group value beside each row', '`COUNT(*) OVER (PARTITION BY …)`'],
      ['Subtotals and a grand total', '`WITH ROLLUP`, plus `GROUPING()`'],
      ['Names of the group members', '`GROUP_CONCAT` / `STRING_AGG`'],
    ]),

    links(
      mysqlDoc('group-by-modifiers.html', 'GROUP BY modifiers (MySQL)'),
      mysqlDoc('group-by-handling.html', 'GROUP BY handling'),
    ),
  ],
};
