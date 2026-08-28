import { asked, cheat, code, h, links, mysqlDoc, note, p, result, sql, table, tip, warn } from '../blocks.js';
import { employees } from './sample-data.js';

export const doc = {
  blocks: [
    p(
      'Two small features that are worth a page between them because both are routinely misunderstood in the same way: `DISTINCT` is assumed to apply to one column when it applies to the whole row, and an alias is assumed to exist everywhere when it exists only from step 6 onwards.',
    ),
    employees(),

    h('DISTINCT applies to the whole row'),
    code(
      sql(`
SELECT dept_id FROM employees;
`),
    ),
    result(
      ['dept_id'],
      [['`1`'], ['`1`'], ['`2`'], ['`2`'], ['`3`'], ['`NULL`']],
      '6 rows — a table is a multiset',
    ),
    code(
      sql(`
SELECT DISTINCT dept_id FROM employees;
`),
    ),
    result(['dept_id'], [['`1`'], ['`2`'], ['`3`'], ['`NULL`']], '4 rows'),
    p(
      'Note that the `NULL` survives, once. `DISTINCT` treats all NULLs as duplicates of each other — the opposite of how `=` treats them, and the same as `GROUP BY`. It is what you want, and it is inconsistent with `UNIQUE`, which allows many NULLs in one column.',
    ),
    warn(
      '`DISTINCT` is not a function and does not take an argument. `SELECT DISTINCT(dept_id), name` looks like it de-duplicates `dept_id` and does not — the brackets are just brackets, and the statement de-duplicates the **pair**. Since every name is different, nothing is removed at all:',
    ),
    code(
      sql(`
SELECT DISTINCT dept_id, name FROM employees;
`),
    ),
    result(
      ['dept_id', 'name'],
      [
        ['`1`', 'Ada'],
        ['`1`', 'Grace'],
        ['`2`', 'Linus'],
        ['`2`', 'Barbara'],
        ['`3`', 'Alan'],
        ['`NULL`', 'Radia'],
      ],
      'All 6 rows — every pair is unique',
    ),
    tip(
      'If you want one row per department, you are asking for `GROUP BY`, not `DISTINCT` — and then you have to say what to do with the names, because there are two of them per department. That question ("which name?") is exactly what `GROUP BY` forces you to answer and `DISTINCT` lets you avoid asking.',
    ),

    h('DISTINCT or GROUP BY'),
    code(
      sql(`
SELECT DISTINCT dept_id FROM employees;
SELECT dept_id FROM employees GROUP BY dept_id;    -- identical result and, usually, identical plan
`),
    ),
    table(
      ['use', 'when'],
      [
        ['`DISTINCT`', 'You only want to remove duplicate rows. Says what you mean.'],
        ['`GROUP BY`', 'You want to remove duplicates **and compute something per group**.'],
      ],
    ),
    p(
      'The moment you need a count, a sum or a maximum alongside the distinct values, `DISTINCT` cannot help and `GROUP BY` is the only answer. Where both work, prefer `DISTINCT` — a reader seeing `GROUP BY` with no aggregate has to stop and check whether an aggregate was forgotten.',
    ),

    h('COUNT(DISTINCT x)'),
    code(
      sql(`
SELECT
  COUNT(*)                AS rows_total,     -- 6
  COUNT(dept_id)          AS non_null,       -- 5
  COUNT(DISTINCT dept_id) AS departments     -- 3  — NULL is not counted
FROM employees;
`),
    ),
    result(['rows_total', 'non_null', 'departments'], [['`6`', '`5`', '`3`']]),
    note(
      'Three different numbers from one column, and each answers a different question. `COUNT(DISTINCT dept_id)` is 3 rather than 4 because `COUNT` of a column never counts NULLs — unlike `SELECT DISTINCT dept_id`, which returned four rows including the NULL. Both behaviours are consistent with their own rules and they disagree, which is why this is a good interview question.',
    ),

    h('Aliases'),
    code(
      sql(`
-- Column aliases. AS is optional and worth writing anyway.
SELECT
  name          AS employee,
  salary * 12   AS annual_salary,
  hired_on      AS started
FROM employees;

-- A quoted alias, for a label with spaces or a reserved word.
SELECT name AS "Employee Name", salary AS "Annual Salary" FROM employees;
`),
    ),
    code(
      sql(`
-- Table aliases. These are what make a join readable.
SELECT e.name, d.name AS department
FROM employees   e
JOIN departments d ON e.dept_id = d.id;
`),
    ),
    p(
      'A table alias is not decoration once two tables both have a `name` column. Without `e.` and `d.` that query is ambiguous and the engine refuses it; with them, it is obvious which is which at every use.',
    ),
    warn(
      'A table alias, once declared, **replaces** the table name for the whole statement. `SELECT employees.name FROM employees e` is an error — after `FROM employees e` the name `employees` no longer refers to anything. This surprises people who expect the alias to be an addition rather than a rename.',
    ),

    h('Where an alias may be used'),
    table(
      ['clause', 'column alias available?', 'because'],
      [
        ['`WHERE`', '**No**', 'Runs at step 2; the alias is created at step 6.'],
        ['`GROUP BY`', 'MySQL and Postgres: yes. Standard: no.', 'An extension, not portable.'],
        ['`HAVING`', 'MySQL: yes. Postgres: no.', 'Same extension.'],
        ['`ORDER BY`', '**Yes**, everywhere', 'Runs at step 8, after SELECT.'],
        ['Another `SELECT` expression', '**No**', 'All the expressions are evaluated together.'],
      ],
    ),
    code(
      sql(`
-- Fails everywhere: one SELECT expression cannot see another's alias.
SELECT salary * 12 AS annual, annual * 0.3 AS tax FROM employees;

-- Works: compute it once, in an inner query.
SELECT annual, annual * 0.3 AS tax
FROM (SELECT salary * 12 AS annual FROM employees) t;
`),
    ),
    result(
      ['annual', 'tax'],
      [
        ['`1140000`', '`342000.0`'],
        ['`984000`', '`295200.0`'],
        ['`888000`', '`266400.0`'],
        ['`1092000`', '`327600.0`'],
        ['`816000`', '`244800.0`'],
        ['`936000`', '`280800.0`'],
      ],
    ),

    h('SELECT *'),
    p('Fine at a prompt while you are exploring. A liability in code that ships:'),
    table(
      ['problem', 'what happens'],
      [
        ['Fetches columns nobody wants', 'A `TEXT` body column crosses the network on every row of a list page.'],
        ['Breaks a covering index', 'The index has the three columns you need; `*` forces a lookup back into the table for every row.'],
        ['Changes under you', 'Someone adds a column and your result shape changes silently — fatal with positional access.'],
        ['Ambiguous in a join', 'Two `name` columns come back, and which one your driver hands you is anyone’s guess.'],
        ['Hides intent', 'A reader cannot tell which columns the code actually uses.'],
      ],
    ),
    tip(
      '`SELECT COUNT(*)` is the exception and is not affected by any of this — the `*` there is not a column list, it is notation meaning "count rows". `COUNT(*)`, `COUNT(1)` and `COUNT(id)` on a non-null column all produce the same plan in every modern engine; the folklore that `COUNT(1)` is faster is about twenty years out of date.',
    ),

    h('Interview'),
    asked([
      ['Does DISTINCT apply to one column or the row?', 'The entire selected row. It is not a function and takes no argument.'],
      ['Does DISTINCT remove NULLs?', 'No — it keeps one, treating all NULLs as duplicates of each other.'],
      ['DISTINCT vs GROUP BY?', 'Same result when there is no aggregate, and usually the same plan. Use GROUP BY when you need to compute something per group.'],
      ['Why is COUNT(DISTINCT col) sometimes one less than SELECT DISTINCT col?', 'COUNT of a column ignores NULLs; SELECT DISTINCT keeps one.'],
      ['Can WHERE use a column alias?', 'No — WHERE runs before SELECT creates it.'],
      ['Can ORDER BY?', 'Yes — it runs after.'],
      ['Can one SELECT expression use another’s alias?', 'No. Wrap it in a subquery, or repeat the expression.'],
      ['Why avoid SELECT *?', 'Wasted I/O, broken covering indexes, a result shape that changes silently, and ambiguity in joins.'],
      ['Is COUNT(1) faster than COUNT(*)?', 'No — identical plans in every current engine.'],
      ['What happens to the table name after you alias it?', 'It is replaced. Referring to the original name is an error.'],
    ]),

    h('Cheatsheet'),
    cheat([
      ['Unique values of one column', '`SELECT DISTINCT col`'],
      ['Unique combinations', '`SELECT DISTINCT a, b`'],
      ['Count unique values', '`COUNT(DISTINCT col)` — NULLs excluded'],
      ['Unique values plus a per-group number', '`GROUP BY`, not `DISTINCT`'],
      ['Name a computed column', '`expr AS alias`, then use it in `ORDER BY`'],
      ['Reuse a computed column', 'A subquery — aliases are not visible sideways'],
      ['Disambiguate two tables', 'Table aliases, `e.` and `d.`'],
      ['List columns in shipped code', 'Name them. Never `*`'],
    ]),

    links(
      mysqlDoc('distinct-optimization.html', 'DISTINCT optimisation (MySQL)'),
      mysqlDoc('select.html', 'SELECT syntax'),
    ),
  ],
};
