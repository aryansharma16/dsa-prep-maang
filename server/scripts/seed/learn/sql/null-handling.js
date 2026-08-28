import { asked, cheat, code, h, links, mysqlDoc, note, p, result, sql, table, tip, warn, wiki } from '../blocks.js';
import { employees } from './sample-data.js';

/*
  The topic that produces the most silent wrong answers in real systems, and one
  of the most reliable interview questions. Everything on this page follows from
  one substitution — read NULL as "unknown" — so that is the frame, and every
  surprising result is then re-derived rather than listed.
*/
export const doc = {
  blocks: [
    p(
      '`NULL` means **unknown**. Not zero, not empty string, not false — *we do not know*. Substitute the word "unknown" every time you see it and every strange thing SQL does with it becomes obvious. `salary > 50000` where the salary is unknown is not true and not false: it is **unknown**.',
    ),
    p(
      'That third value is why SQL has **three-valued logic**, and why more production bugs come from this page than from any other in the track — because the failure mode is a query that returns the wrong rows without erroring.',
    ),
    employees(),
    p('Radia has no `dept_id`, and Ada has no `manager_id`. Those two NULLs are what every example below turns on.'),

    h('Nothing is equal to NULL'),
    code(
      sql(`
SELECT NULL = NULL;      -- NULL
SELECT NULL <> NULL;     -- NULL
SELECT NULL = 0;         -- NULL
SELECT NULL > 0;         -- NULL
SELECT NULL + 1;         -- NULL
SELECT CONCAT('a', NULL); -- NULL
`),
    ),
    p(
      'Two unknown things cannot be known to be equal, so the comparison is itself unknown. And **any arithmetic or string operation involving NULL is NULL**, because a calculation on an unknown input has an unknown result. That last one bites hardest: one nullable column in a `CONCAT` makes the whole string vanish.',
    ),
    code(
      sql(`
-- Silently returns nothing.
SELECT name FROM employees WHERE dept_id = NULL;

-- The only way to ask.
SELECT name FROM employees WHERE dept_id IS NULL;
`),
    ),
    result(['name'], [['Radia']], 'IS NULL'),

    h('Three-valued logic'),
    p('`WHERE` keeps a row only when the condition is **true**. Unknown is not true, so an unknown row is dropped — the same as false, but for a different reason.'),
    table(
      ['`AND`', '`TRUE`', '`FALSE`', '`NULL`'],
      [
        ['`TRUE`', 'TRUE', 'FALSE', '**NULL**'],
        ['`FALSE`', 'FALSE', 'FALSE', '**FALSE**'],
        ['`NULL`', 'NULL', '**FALSE**', 'NULL'],
      ],
    ),
    table(
      ['`OR`', '`TRUE`', '`FALSE`', '`NULL`'],
      [
        ['`TRUE`', 'TRUE', 'TRUE', '**TRUE**'],
        ['`FALSE`', 'TRUE', 'FALSE', '**NULL**'],
        ['`NULL`', '**TRUE**', 'NULL', 'NULL'],
      ],
    ),
    tip(
      'Both tables have one interesting cell and it is the same idea twice. `FALSE AND NULL` is **FALSE**, not NULL — if one side is definitely false the answer is definitely false, whatever the unknown turns out to be. `TRUE OR NULL` is **TRUE** for the mirror reason. Everywhere else, unknown wins.',
    ),

    h('The one that costs money'),
    p('`WHERE dept_id <> 1` does not return everyone who is not in department 1:'),
    code(
      sql(`
SELECT name, dept_id FROM employees WHERE dept_id <> 1;
`),
    ),
    result(
      ['name', 'dept_id'],
      [
        ['Linus', '`2`'],
        ['Barbara', '`2`'],
        ['Alan', '`3`'],
      ],
    ),
    warn(
      '**Radia is missing.** Her `dept_id` is unknown, so "is it different from 1" is unknown, so the row is dropped. Reading the query in English — "everyone not in department 1" — she should obviously be there. This is the single most common way a report quietly under-counts.',
    ),
    code(
      sql(`
-- Say what you mean.
SELECT name, dept_id FROM employees WHERE dept_id <> 1 OR dept_id IS NULL;

-- Or make the unknown into a value that can be compared.
SELECT name, dept_id FROM employees WHERE COALESCE(dept_id, -1) <> 1;
`),
    ),
    result(
      ['name', 'dept_id'],
      [
        ['Linus', '`2`'],
        ['Barbara', '`2`'],
        ['Alan', '`3`'],
        ['Radia', '`NULL`'],
      ],
      'With the NULL accounted for',
    ),
    note(
      'The first form is better. The second wraps the column in a function, which stops the index being used — see the performance section — and it needs a sentinel value that can never legitimately appear, which is a rule nobody will remember later.',
    ),

    h('NOT IN, and the empty result'),
    code(
      sql(`
-- Returns NOTHING, because departments contains no NULL... but if it did:
SELECT name FROM employees
WHERE dept_id NOT IN (SELECT dept_id FROM employees WHERE name = 'Radia');
`),
    ),
    p(
      'That subquery returns a single `NULL`. `x NOT IN (NULL)` expands to `x <> NULL`, which is `NULL`, which is not true — **for every row**. The query returns an empty result and no error.',
    ),
    warn(
      'The result is **zero rows**, and there is no error and no warning. A query that should have listed five people lists none, the report shows a blank section, and nothing anywhere records that a NULL was responsible.',
    ),
    code(
      sql(`
-- NOT EXISTS is immune: it asks whether a row was found, which is never unknown.
SELECT e.name FROM employees e
WHERE NOT EXISTS (
  SELECT 1 FROM employees r WHERE r.name = 'Radia' AND r.dept_id = e.dept_id
);

-- Or exclude the NULLs from the list.
SELECT name FROM employees
WHERE dept_id NOT IN (
  SELECT dept_id FROM employees WHERE name = 'Radia' AND dept_id IS NOT NULL
);
`),
    ),
    tip(
      '**Prefer `NOT EXISTS` to `NOT IN` whenever the inner column is nullable.** It is not a style preference — the two give different answers, and `NOT EXISTS` gives the one you meant. `NOT IN` is fine over a literal list you wrote yourself.',
    ),

    h('Aggregates skip NULLs — except one'),
    code(
      sql(`
SELECT
  COUNT(*)          AS all_rows,       -- 6
  COUNT(dept_id)    AS with_dept,      -- 5  — Radia is not counted
  COUNT(manager_id) AS with_manager,   -- 5  — Ada is not counted
  SUM(salary)       AS total,          -- 488000
  AVG(salary)       AS avg_salary,     -- 81333.33
  MIN(dept_id)      AS min_dept,       -- 1
  MAX(dept_id)      AS max_dept        -- 3
FROM employees;
`),
    ),
    result(
      ['all_rows', 'with_dept', 'with_manager', 'total', 'avg_salary', 'min_dept', 'max_dept'],
      [['`6`', '`5`', '`5`', '`488000.00`', '`81333.33`', '`1`', '`3`']],
    ),
    p(
      '**`COUNT(*)` counts rows. `COUNT(column)` counts non-NULL values.** That is the entire difference, it is asked in most SQL interviews, and this table is the demonstration: 6 versus 5, with the gap being exactly Radia.',
    ),
    warn(
      '`AVG` skipping NULLs is the one that produces subtly wrong numbers. `AVG(bonus)` over ten employees where four have no bonus divides by **six**, not ten. If a missing bonus means zero, say so: `AVG(COALESCE(bonus, 0))`. If it means unknown, the skip is correct. The database cannot tell which you meant, and it will not ask.',
    ),
    note(
      'The exception in the heading is `COUNT(*)`. Every other aggregate ignores NULLs. And an aggregate over *zero* rows returns `NULL`, not 0 — so `SUM(salary)` on an empty table is `NULL`, which is why `COALESCE(SUM(x), 0)` is such a common wrapper.',
    ),

    h('Handling it'),
    table(
      ['function', 'does', 'portable?'],
      [
        ['`COALESCE(a, b, c)`', 'The first non-NULL of any number of arguments.', '**Yes** — standard SQL'],
        ['`IFNULL(a, b)`', 'Two arguments only.', 'MySQL, SQLite'],
        ['`ISNULL(a, b)`', 'The same.', 'SQL Server'],
        ['`NVL(a, b)`', 'The same.', 'Oracle'],
        ['`NULLIF(a, b)`', 'NULL if `a = b`, else `a`. The inverse.', 'Yes'],
      ],
    ),
    code(
      sql(`
SELECT
  name,
  COALESCE(dept_id, 0)             AS dept_or_zero,
  COALESCE(manager_id, id)         AS manager_or_self,
  NULLIF(salary, 0)                AS salary_or_null   -- guards a division
FROM employees;
`),
    ),
    p('`NULLIF` is the one people forget, and its main use is preventing a division by zero:'),
    code(
      sql(`
-- Errors, or returns NULL, when the denominator is 0.
SELECT total / count_col FROM t;

-- Returns NULL cleanly instead.
SELECT total / NULLIF(count_col, 0) FROM t;
`),
    ),

    h('NULLs in ORDER BY, GROUP BY and UNIQUE'),
    p('Three places where NULLs behave inconsistently with everything above, and each is asked about:'),
    table(
      ['clause', 'behaviour'],
      [
        [
          '`ORDER BY`',
          'NULLs sort together, but *where* differs: MySQL puts them **first** ascending, PostgreSQL puts them **last**. Postgres offers `NULLS FIRST` / `NULLS LAST`; in MySQL you sort by `col IS NULL` first.',
        ],
        [
          '`GROUP BY`',
          'All NULLs form **one group**, as if they were equal. Inconsistent with `=`, and it is what you want.',
        ],
        [
          '`DISTINCT`',
          'Treats NULLs as duplicates of each other — one NULL survives.',
        ],
        [
          '`UNIQUE`',
          'Allows **many** NULLs, because they are not equal. The opposite of `GROUP BY`, in the same database.',
        ],
        ['`PRIMARY KEY`', 'Forbids NULL entirely — entity integrity.'],
      ],
    ),
    code(
      sql(`
-- Force NULLs last in MySQL.
SELECT name, dept_id FROM employees ORDER BY dept_id IS NULL, dept_id;

-- PostgreSQL says it directly.
SELECT name, dept_id FROM employees ORDER BY dept_id NULLS LAST;
`),
    ),

    h('Interview'),
    asked([
      ['What does NULL mean?', 'Unknown — not zero, not empty, not false.'],
      ['Why is `NULL = NULL` not true?', 'Two unknowns cannot be known to be equal; the result is unknown.'],
      ['How do you test for NULL?', '`IS NULL` / `IS NOT NULL`.'],
      ['What is three-valued logic?', 'True, false and unknown. WHERE keeps only true.'],
      ['What is `FALSE AND NULL`?', 'FALSE — one definitely-false side settles it.'],
      ['What is `TRUE OR NULL`?', 'TRUE, for the mirror reason.'],
      ['Why does `col <> 1` miss NULL rows?', 'The comparison is unknown, so the row is not kept. Add `OR col IS NULL`.'],
      ['Why does NOT IN with a NULL return nothing?', 'It becomes a chain of `<>` including `<> NULL`, which is never true.'],
      ['COUNT(*) vs COUNT(col)?', 'Rows versus non-NULL values in that column.'],
      ['Does AVG ignore NULLs?', 'Yes — it divides by the count of non-NULL values, which is often not what you meant.'],
      ['What does SUM return over zero rows?', 'NULL, not 0.'],
      ['Can a UNIQUE column hold two NULLs?', 'Yes — they are not equal, so they do not collide.'],
      ['Do NULLs group together in GROUP BY?', 'Yes, into one group — inconsistent with `=`, and deliberate.'],
    ]),

    h('Cheatsheet'),
    cheat([
      ['Test for absence', '`IS NULL`'],
      ['"Not equal to x", including unknowns', '`col <> x OR col IS NULL`'],
      ['Exclude a nullable subquery', '`NOT EXISTS`, never `NOT IN`'],
      ['Default a missing value', '`COALESCE(col, fallback)`'],
      ['Guard a division by zero', '`x / NULLIF(y, 0)`'],
      ['Sum an empty set as 0', '`COALESCE(SUM(x), 0)`'],
      ['Average treating missing as zero', '`AVG(COALESCE(x, 0))`'],
      ['Count rows', '`COUNT(*)`'],
      ['Count present values', '`COUNT(col)`'],
      ['Put NULLs last in MySQL', '`ORDER BY col IS NULL, col`'],
    ]),

    links(
      wiki('Null_(SQL)', 'NULL in SQL'),
      wiki('Three-valued_logic', 'Three-valued logic'),
      mysqlDoc('working-with-null.html', 'Working with NULL (MySQL)'),
    ),
  ],
};
