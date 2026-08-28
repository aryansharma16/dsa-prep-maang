import { asked, cheat, code, h, links, mysqlDoc, note, p, result, sql, table, tip, warn } from '../blocks.js';
import { employees } from './sample-data.js';

export const doc = {
  blocks: [
    p(
      '`WHERE` decides which **rows** survive, and it runs second — right after the tables are read, before grouping, before the `SELECT` list is evaluated. Everything downstream is cheaper for every row `WHERE` removes, which is why "can this filter go in the WHERE clause" is usually the first performance question worth asking about a slow query.',
    ),
    employees(),

    h('Comparison'),
    table(
      ['operator', 'means', 'example'],
      [
        ['`=`', 'Equal', '`WHERE dept_id = 1`'],
        ['`<>` or `!=`', 'Not equal — `<>` is the standard spelling', "`WHERE name <> 'Ada'`"],
        ['`<` `>` `<=` `>=`', 'Ordering — works on numbers, dates and strings', '`WHERE salary >= 80000`'],
        ['`BETWEEN a AND b`', '`>= a AND <= b` — **inclusive at both ends**', '`WHERE salary BETWEEN 70000 AND 90000`'],
        ['`IN (...)`', 'Equal to any of a list', '`WHERE dept_id IN (1, 2)`'],
        ['`LIKE`', 'Pattern match', "`WHERE name LIKE 'A%'`"],
        ['`IS NULL`', 'Is absent — **the only way to test for NULL**', '`WHERE dept_id IS NULL`'],
      ],
    ),
    code(
      sql(`
SELECT name, salary FROM employees WHERE salary BETWEEN 70000 AND 90000;
`),
    ),
    result(
      ['name', 'salary'],
      [
        ['Grace', '`82000.00`'],
        ['Linus', '`74000.00`'],
        ['Radia', '`78000.00`'],
      ],
    ),
    warn(
      '`BETWEEN` is inclusive, and on dates that is a trap. `hired_on BETWEEN \'2024-01-01\' AND \'2024-01-31\'` misses nothing for a `DATE` column — but on a `DATETIME`, `2024-01-31 09:15:00` is **greater than** `2024-01-31 00:00:00`, so the whole last day disappears. Use a half-open range instead: `>= \'2024-01-01\' AND < \'2024-02-01\'`. It is correct for both types and needs no thought about month lengths.',
    ),

    h('AND, OR and the brackets'),
    code(
      sql(`
-- AND binds tighter than OR, so this is (a AND b) OR c.
SELECT name FROM employees
WHERE dept_id = 1 AND salary > 90000 OR dept_id = 2;
-- Ada (dept 1, 95000), Linus and Barbara (dept 2)

-- Almost certainly what was meant.
SELECT name FROM employees
WHERE (dept_id = 1 OR dept_id = 2) AND salary > 90000;
`),
    ),
    result(['name'], [['Ada'], ['Barbara']], 'The bracketed version'),
    tip(
      'Bracket any mixture of `AND` and `OR`, even where the precedence happens to be what you wanted. The reader of the query cannot tell the difference between "correct" and "correct by accident", and neither can you in six months.',
    ),

    h('IN and NOT IN'),
    code(
      sql(`
SELECT name FROM employees WHERE dept_id IN (1, 3);

-- Equivalent, and worse to read as the list grows.
SELECT name FROM employees WHERE dept_id = 1 OR dept_id = 3;

-- With a subquery.
SELECT name FROM employees
WHERE dept_id IN (SELECT id FROM departments WHERE location = 'Bengaluru');
`),
    ),
    result(['name'], [['Ada'], ['Grace'], ['Alan']], 'dept_id IN (1, 3)'),
    warn(
      '**`NOT IN` with a NULL in the list returns nothing at all.** `WHERE dept_id NOT IN (1, NULL)` is `dept_id <> 1 AND dept_id <> NULL`, and the second half is `NULL` — never true — so every row is rejected. It does not error; it returns an empty result, which is far worse. Use `NOT EXISTS`, or filter the NULLs out of the subquery. The NULL topic goes into this properly.',
    ),

    h('LIKE'),
    table(
      ['pattern', 'matches', 'example'],
      [
        ['`%`', 'Any run of characters, including none', "`'A%'` → Ada, Alan"],
        ['`_`', 'Exactly one character', "`'A__'` → Ada, but not Alan"],
        ['`%x%`', 'Contains x anywhere', "`'%a%'` → any name with an a"],
        ['`ESCAPE`', 'Treats the next character literally', "`LIKE '100!%' ESCAPE '!'` → the literal 100%"],
      ],
    ),
    code(
      sql(`
SELECT name FROM employees WHERE name LIKE 'A%';    -- Ada, Alan
SELECT name FROM employees WHERE name LIKE 'A__';   -- Ada only — exactly three letters
SELECT name FROM employees WHERE name LIKE '%a%';   -- every name containing 'a'
`),
    ),
    note(
      "`LIKE 'A%'` can use an index on `name` — the engine knows the value starts with A, so it can seek straight to that part of the B-tree and stop when it passes it. `LIKE '%a%'` **cannot**, ever: a value containing an `a` could be anywhere in the sort order, so every row must be examined. That asymmetry is the single most important fact about `LIKE`, and full-text search exists because of it.",
    ),
    p(
      'Case sensitivity depends on the **collation**, not on `LIKE`. MySQL\'s default collation is case-insensitive, so `LIKE \'a%\'` finds Ada; PostgreSQL is case-sensitive and has `ILIKE` for when you do not want that.',
    ),

    h('Filtering on dates'),
    code(
      sql(`
SELECT name, hired_on FROM employees WHERE hired_on >= '2021-01-01';

-- Everyone hired in 2021 or later, written as a half-open range.
SELECT name FROM employees
WHERE hired_on >= '2021-01-01' AND hired_on < '2022-01-01';

-- Works, and is much slower on a large table. See the warning.
SELECT name FROM employees WHERE YEAR(hired_on) = 2021;
`),
    ),
    result(
      ['name', 'hired_on'],
      [
        ['Linus', '`2021-01-11`'],
        ['Alan', '`2022-05-30`'],
        ['Radia', '`2023-02-20`'],
      ],
      'hired_on >= 2021-01-01',
    ),
    warn(
      'Wrapping an indexed column in a function makes the index unusable. `YEAR(hired_on) = 2021` asks the engine to compute `YEAR()` for every row before it can compare anything, so it reads all of them. `hired_on >= \'2021-01-01\' AND hired_on < \'2022-01-01\'` asks the same question of the raw column and can be answered by a range seek on the index. This rule is completely general — it applies to `UPPER(name)`, `DATE(created_at)`, `salary * 12`, and it has a whole topic in the performance section.',
    ),

    h('Which rows have no department'),
    code(
      sql(`
SELECT name FROM employees WHERE dept_id IS NULL;      -- Radia
SELECT name FROM employees WHERE dept_id IS NOT NULL;  -- everyone else

SELECT name FROM employees WHERE dept_id = NULL;       -- returns nothing, ever
`),
    ),
    p(
      'The last one is not an error and returns zero rows. `= NULL` evaluates to `NULL`, which is not true, so no row passes. This is the most common single mistake in SQL and it fails silently.',
    ),

    h('Putting it together'),
    code(
      sql(`
SELECT name, salary, hired_on
FROM employees
WHERE dept_id IN (1, 2)
  AND salary > 75000
  AND hired_on < '2021-01-01'
  AND name NOT LIKE 'X%'
ORDER BY salary DESC;
`),
    ),
    result(
      ['name', 'salary', 'hired_on'],
      [
        ['Ada', '`95000.00`', '`2019-03-04`'],
        ['Barbara', '`91000.00`', '`2018-11-02`'],
        ['Grace', '`82000.00`', '`2020-07-15`'],
      ],
    ),

    h('Interview'),
    asked([
      ['Is BETWEEN inclusive?', 'Yes, at both ends — which is why a half-open range is safer on datetimes.'],
      ['How do you test for NULL?', '`IS NULL`. `= NULL` is always NULL and matches nothing.'],
      ['Why does NOT IN with a NULL return nothing?', 'It expands to a chain of `<>`, and `x <> NULL` is NULL — never true — so every row is rejected.'],
      ['Which LIKE patterns can use an index?', 'Only those anchored at the start, like `\'A%\'`. A leading wildcard forces a full scan.'],
      ['Precedence of AND and OR?', 'AND binds tighter. Bracket any mixture regardless.'],
      ['Why avoid a function on a filtered column?', 'It stops the index being used — the engine must compute the function for every row.'],
      ['IN vs a chain of ORs?', 'Identical in meaning and usually in plan. IN is readable.'],
      ['Is LIKE case-sensitive?', 'It depends on the collation. MySQL defaults to insensitive; PostgreSQL is sensitive and offers ILIKE.'],
    ]),

    h('Cheatsheet'),
    cheat([
      ['One of several values', '`IN (a, b, c)`'],
      ['A numeric or date range', '`>= lo AND < hi` — half-open'],
      ['Starts with', "`LIKE 'x%'` — index-friendly"],
      ['Contains', "`LIKE '%x%'` — full scan; consider full-text search"],
      ['Exactly one unknown character', '`_`'],
      ['Missing value', '`IS NULL`'],
      ['Exclude a list that may contain NULL', '`NOT EXISTS`, not `NOT IN`'],
      ['Filter a year', 'A date range, never `YEAR(col) = n`'],
    ]),

    links(
      mysqlDoc('comparison-operators.html', 'Comparison operators (MySQL)'),
      mysqlDoc('pattern-matching.html', 'Pattern matching (MySQL)'),
    ),
  ],
};
