import { asked, cheat, code, h, links, mysqlDoc, note, p, pgDoc, result, sql, table, tip, warn } from '../blocks.js';
import { employees } from './sample-data.js';

export const doc = {
  blocks: [
    p(
      'A **view** is a stored `SELECT` that behaves like a table. It holds no data — querying it runs the underlying query — so a view is a **name for a query**, and that is both its entire cost and its entire value.',
    ),
    employees(),

    h('Creating and using one'),
    code(
      sql(`
CREATE VIEW staff_directory AS
SELECT e.id, e.name AS employee, d.name AS department, d.location
FROM employees e
LEFT JOIN departments d ON e.dept_id = d.id;

-- Then it is a table as far as anything reading it is concerned.
SELECT * FROM staff_directory WHERE location = 'Bengaluru';
SELECT department, COUNT(*) FROM staff_directory GROUP BY department;
`),
    ),
    result(
      ['id', 'employee', 'department', 'location'],
      [
        ['`1`', 'Ada', 'Engineering', 'Bengaluru'],
        ['`2`', 'Grace', 'Engineering', 'Bengaluru'],
      ],
      "WHERE location = 'Bengaluru'",
    ),
    note(
      'The filter is applied to the *combined* query, not to a stored result. The engine merges your `WHERE` into the view definition and plans the whole thing as one statement — so a view over a billion-row table with a selective filter is as fast as writing the query out by hand.',
    ),

    h('The four things they are for'),
    table(
      ['use', 'what it buys'],
      [
        [
          '**Security**',
          'Grant on the view, not the table. The support team reads `staff_directory` and there is no salary column in their world at all — this is the external schema from the three-schema topic, made real.',
        ],
        [
          '**Simplification**',
          'A five-table join becomes one name. Analysts write `SELECT … FROM staff_directory` instead of getting the joins wrong.',
        ],
        [
          '**A stable interface**',
          'Split `employees` into two tables and rebuild the old shape as a view — every existing query keeps working. This is logical data independence, and it is the main practical use.',
        ],
        [
          '**Consistent business rules**',
          '"Active employee" is defined once, in one view, rather than as `WHERE deleted_at IS NULL AND status = \'active\'` copied into forty queries, one of which will be missing a clause.',
        ],
      ],
    ),
    code(
      sql(`
-- Security: two audiences, two views, no salaries in one of them.
CREATE VIEW public_directory AS
  SELECT name, dept_id FROM employees;

GRANT SELECT ON public_directory TO 'support'@'%';
-- and no grant at all on employees
`),
    ),

    h('Updatable views'),
    p(
      'You can sometimes `INSERT`, `UPDATE` and `DELETE` **through** a view, and the writes land in the underlying table. It works only when the engine can unambiguously map a changed row back to exactly one base row:',
    ),
    table(
      ['a view is updatable if it has no…', 'because'],
      [
        ['`DISTINCT`', 'One view row may correspond to several base rows.'],
        ['`GROUP BY` or aggregate', 'A row is a summary of many; there is nothing single to update.'],
        ['`UNION`', 'The engine cannot tell which branch a row came from.'],
        ['Window function', 'The value depends on other rows.'],
        ['Subquery in the `SELECT` list', 'Same reason.'],
        ['Join', 'Not always fatal — MySQL allows updates that touch **one** base table.'],
      ],
    ),
    code(
      sql(`
CREATE VIEW engineering AS
SELECT id, name, salary FROM employees WHERE dept_id = 1;

UPDATE engineering SET salary = salary * 1.1 WHERE id = 1;   -- lands in employees

-- And the row can escape the view.
UPDATE engineering SET id = 99 WHERE id = 1;   -- allowed; now invisible in the view
`),
    ),
    warn(
      'That second update is the trap, and it has a name: a row updated or inserted through a view can end up **not satisfying the view\'s own condition**, at which point it silently disappears from the view while remaining in the table. `WITH CHECK OPTION` forbids it:',
    ),
    code(
      sql(`
CREATE VIEW engineering AS
SELECT id, name, dept_id, salary FROM employees WHERE dept_id = 1
WITH CHECK OPTION;

UPDATE engineering SET dept_id = 2 WHERE id = 1;
-- ERROR 1369: CHECK OPTION failed
`),
    ),
    tip(
      'Writing through views is possible and it is rarely a good idea outside a legacy-compatibility layer. The rules for when it works are subtle, differ between engines, and are invisible at the call site — a developer writing `UPDATE engineering …` cannot see whether it will work without reading the view definition. Read from views; write to tables.',
    ),

    h('Materialised views'),
    p(
      'A **materialised** view does store its result. It is a cached table that knows how to rebuild itself, and it trades freshness for speed:',
    ),
    table(
      ['', 'View', 'Materialised view'],
      [
        ['Stores data', 'No', '**Yes**'],
        ['Query cost', 'The underlying query, every time', 'A table read'],
        ['Freshness', '**Always current**', 'As of the last refresh'],
        ['Can be indexed', 'No', '**Yes**'],
        ['Storage', 'None', 'The full result'],
        ['Write cost', 'None', 'The refresh'],
      ],
    ),
    code(
      sql(`
-- PostgreSQL.
CREATE MATERIALIZED VIEW dept_summary AS
SELECT d.id, d.name, COUNT(e.id) AS headcount, COALESCE(SUM(e.salary), 0) AS wage_bill
FROM departments d
LEFT JOIN employees e ON e.dept_id = d.id
GROUP BY d.id, d.name;

CREATE UNIQUE INDEX ON dept_summary (id);     -- needed for CONCURRENTLY

REFRESH MATERIALIZED VIEW dept_summary;                -- locks readers out
REFRESH MATERIALIZED VIEW CONCURRENTLY dept_summary;   -- does not; needs the unique index
`),
    ),
    warn(
      '**MySQL has no materialised views.** The workaround is a real table plus a scheduled job — `CREATE TABLE dept_summary AS SELECT …`, then a periodic `TRUNCATE` and re-`INSERT`, or an event. This is asked as a MySQL question fairly often, and "MySQL does not have them, so you build one with a table and a refresh job" is the whole answer.',
    ),
    note(
      'A materialised view is the safest form of denormalisation, and for one reason: the database owns the copy and knows it is a copy. Nobody can update it by accident, and rebuilding it is one command rather than a hunt for every write path that should have maintained it.',
    ),

    h('What a view costs'),
    p('Views are free until they are not, and the two ways they stop being free are worth knowing:'),
    table(
      ['problem', 'what happens'],
      [
        [
          '**Stacked views**',
          'A view on a view on a view. Each layer looks cheap and the final query joins fourteen tables to return three columns. Nobody notices, because nobody sees the whole thing at once.',
        ],
        [
          '**Merge vs materialise**',
          'The engine either merges the view into your query — fast — or materialises it into a temporary table first. `DISTINCT`, `GROUP BY`, `UNION` and window functions force materialisation, so your `WHERE` is applied *after* the whole view has been built.',
        ],
      ],
    ),
    code(
      sql(`
-- If this view aggregates, the WHERE cannot be pushed down: the engine
-- computes every department first, then throws away all but one.
SELECT * FROM dept_summary_view WHERE id = 1;

EXPLAIN SELECT * FROM dept_summary_view WHERE id = 1;   -- check which happened
`),
    ),

    h('Managing them'),
    code(
      sql(`
SHOW CREATE VIEW staff_directory;                              -- MySQL
SELECT definition FROM pg_views WHERE viewname = 'staff_directory';  -- Postgres

SELECT table_name FROM information_schema.views WHERE table_schema = 'company';

CREATE OR REPLACE VIEW staff_directory AS SELECT …;   -- redefine in place
DROP VIEW IF EXISTS staff_directory;
`),
    ),
    warn(
      'A view does **not** track schema changes. Drop a column the view selects and the view is not updated — it breaks the next time somebody queries it, with an error naming a column that no longer exists. `SELECT *` inside a view is worse: MySQL expands it to the column list *at creation time*, so a column added to the table later never appears in the view, which is a difference that will confuse everyone who meets it.',
    ),

    h('Interview'),
    asked([
      ['What is a view?', 'A stored query that behaves like a table and holds no data.'],
      ['Does a view store data?', 'No. A materialised view does.'],
      ['What are views for?', 'Security, simplification, a stable interface over a changing schema, and defining a business rule once.'],
      ['Can you update through a view?', 'Sometimes — only if each view row maps to exactly one base row. No DISTINCT, GROUP BY, UNION or window functions.'],
      ['What does WITH CHECK OPTION do?', 'Rejects writes that would produce a row not visible in the view.'],
      ['View vs materialised view?', 'A view is always current and costs a query; a materialised view is stored, indexable and fast, but stale between refreshes.'],
      ['Does MySQL have materialised views?', 'No. Emulate them with a table and a refresh job.'],
      ['Are views slower than the equivalent query?', 'Not when the engine merges them. Aggregates, DISTINCT and UNION force materialisation, and then filters cannot be pushed down.'],
      ['What happens if you drop a column a view uses?', 'The view breaks at query time — it is not validated or updated when the table changes.'],
      ['Why avoid SELECT * in a view?', 'MySQL freezes the column list at creation, so later columns never appear.'],
    ]),

    h('Cheatsheet'),
    cheat([
      ['Hide columns from a role', 'A view, and grants on the view only'],
      ['Simplify a repeated join', 'A view'],
      ['Keep old queries working after a refactor', 'A view rebuilding the old shape'],
      ['Define "active" once', 'A view'],
      ['Speed up an expensive aggregate', 'A materialised view, refreshed on a schedule'],
      ['The same in MySQL', 'A real table plus a refresh job'],
      ['Stop rows escaping a view', '`WITH CHECK OPTION`'],
      ['Change a view', '`CREATE OR REPLACE VIEW`'],
      ['Check it is not being materialised', '`EXPLAIN` the query against it'],
    ]),

    links(
      mysqlDoc('views.html', 'Views (MySQL)'),
      pgDoc('sql-creatematerializedview.html', 'Materialized views (PostgreSQL)'),
    ),
  ],
};
