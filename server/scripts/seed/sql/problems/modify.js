/**
 * Modify & design — INSERT, UPDATE, DELETE and DDL.
 *
 * The category that only exists because of `checkSql`. An `UPDATE` returns no
 * rows, so there is nothing to compare a reader's result against — instead
 * their statements run for their side effects, and then a check query the
 * problem carries runs against the database they left behind. That result is
 * what is graded.
 *
 * It is also the category where the sample tables shown beside the statement
 * are the state *before* the change, and the expected grid is the state after,
 * which reads naturally and is worth knowing when writing one.
 */

export default [
  {
    slug: 'give-a-raise',
    title: 'Give one department a raise',
    category: 'modify',
    difficulty: 'Easy',
    statement:
      'Give everyone in department 1 a **10% raise**. Leave everybody else alone.\n\nSalaries are whole numbers; round to the nearest whole number.\n\nYou are graded on the table afterwards, not on anything you return.',
    setupSql: `
CREATE TABLE employees (
  id      INTEGER PRIMARY KEY,
  name    TEXT NOT NULL,
  dept_id INTEGER NOT NULL,
  salary  INTEGER NOT NULL
);
INSERT INTO employees VALUES
  (1, 'Ada',     1, 95000),
  (2, 'Grace',   1, 82000),
  (3, 'Linus',   2, 74000),
  (4, 'Barbara', 2, 91000),
  (5, 'Alan',    3, 68000);
`,
    solutionSql:
      'UPDATE employees SET salary = ROUND(salary * 1.1) WHERE dept_id = 1;',
    checkSql: 'SELECT id, name, salary FROM employees ORDER BY id;',
    expectRows: 5,
    orderMatters: true,
    hints: [
      'A `WHERE` clause is what stops this changing every row in the table.',
      'A 10% raise is `salary * 1.1`.',
      'The salary column is an integer, so wrap it in `ROUND(...)`.',
    ],
    explanation:
      'The whole risk in this problem is the `WHERE`. `UPDATE employees SET salary = ROUND(salary * 1.1)` is a valid statement that raises everyone, reports success, and tells you how many rows it changed — which would be five rather than two. There is no undo outside a transaction.\n\nThe habit worth forming: write the `WHERE` as a `SELECT` first and look at what comes back, then change `SELECT *` to `UPDATE … SET`. It costs one run and it is the difference between changing two rows and changing the table.',
    learnTopic: 'sql/insert-update-delete',
    topicTags: ['update', 'where'],
  },

  {
    slug: 'delete-duplicate-emails',
    title: 'Delete the duplicate emails',
    category: 'modify',
    difficulty: 'Medium',
    statement:
      'Some people were entered twice. Delete the duplicates, keeping **the row with the lowest `id`** for each email address.\n\nYou are graded on the table afterwards.',
    setupSql: `
CREATE TABLE people (
  id    INTEGER PRIMARY KEY,
  name  TEXT NOT NULL,
  email TEXT NOT NULL
);
INSERT INTO people VALUES
  (1, 'Ada',     'ada@example.com'),
  (2, 'Grace',   'grace@example.com'),
  (3, 'Ada L.',  'ada@example.com'),
  (4, 'Linus',   'linus@example.com'),
  (5, 'Grace H', 'grace@example.com'),
  (6, 'Ada Lov', 'ada@example.com');
`,
    solutionSql: `
DELETE FROM people
WHERE id NOT IN (SELECT MIN(id) FROM people GROUP BY email);`,
    checkSql: 'SELECT id, name, email FROM people ORDER BY id;',
    expectRows: 3,
    orderMatters: true,
    hints: [
      'First work out which rows to *keep*: the lowest id per email.',
      '`SELECT MIN(id) FROM people GROUP BY email` is that list.',
      'Then delete everything not in it.',
    ],
    explanation:
      'Expressing it as "keep the minimum, delete the rest" is what makes it one statement. The alternative — a self join, `DELETE p1 FROM people p1 JOIN people p2 ON p1.email = p2.email AND p1.id > p2.id` — is the form MySQL interview questions usually expect, and it works there.\n\n`NOT IN` is safe here for a reason worth checking rather than assuming: `MIN(id)` over a `GROUP BY` can never return NULL for a non-empty group, so the subquery has no NULL in it and the usual `NOT IN` trap does not fire.',
    learnTopic: 'sql/insert-update-delete',
    /*
      One of the five SQL 50 problems the Lab authored rather than linked — see
      the skip list at the top of `leetcode-sql-50.js`. The credit is here so
      the verifier's LeetCode-id dedupe can actually see it.
    */
    source: { platform: 'leetcode', url: 'https://leetcode.com/problems/delete-duplicate-emails/', lcId: 196 },
    topicTags: ['delete', 'duplicates', 'group-by'],
  },

  {
    slug: 'insert-or-update',
    title: 'Insert, or update if it is already there',
    category: 'modify',
    difficulty: 'Medium',
    statement:
      'The `settings` table holds one row per key.\n\nSet `theme` to `dark` and `locale` to `en-IN`. `theme` already exists and must be updated; `locale` does not and must be inserted. Do it **without** first checking which is which.\n\nYou are graded on the table afterwards.',
    setupSql: `
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT INTO settings VALUES
  ('theme',    'light'),
  ('timezone', 'Asia/Kolkata');
`,
    solutionSql: `
INSERT INTO settings (key, value) VALUES ('theme', 'dark'), ('locale', 'en-IN')
ON CONFLICT (key) DO UPDATE SET value = excluded.value;`,
    checkSql: 'SELECT key, value FROM settings ORDER BY key;',
    expectRows: 3,
    orderMatters: true,
    hints: [
      'One statement handles both cases — an upsert.',
      "SQLite and PostgreSQL spell it `ON CONFLICT (key) DO UPDATE SET …`; MySQL spells it `ON DUPLICATE KEY UPDATE …`.",
      '`excluded` is the row that would have been inserted, had there been no conflict.',
    ],
    explanation:
      'An upsert, and the reason it is one statement rather than a check followed by a write: between the check and the write another connection can insert the same key, and then your insert fails or your update touches a row you never read. One statement has no gap for that to happen in.\n\n`excluded` (PostgreSQL and SQLite) is the row that was about to be inserted — MySQL calls the same thing `VALUES(value)`, or `new.value` from 8.0.20. Note that `REPLACE INTO` is *not* the same thing: it deletes and re-inserts, so any column you did not mention reverts to its default.',
    dialectNote:
      'MySQL writes this as `INSERT … ON DUPLICATE KEY UPDATE value = VALUES(value)`. The engine here is SQLite, which uses the PostgreSQL-style `ON CONFLICT … DO UPDATE` — so write that form for this problem.',
    learnTopic: 'sql/insert-update-delete',
    topicTags: ['insert', 'upsert', 'on-conflict'],
  },

  {
    slug: 'swap-the-gender-column',
    title: 'Swap the values in a column',
    category: 'modify',
    difficulty: 'Easy',
    statement:
      'The `sex` column was imported the wrong way round. Swap it — every `m` becomes `f` and every `f` becomes `m` — in **one** statement.\n\nOne row was imported as `x` and one is empty. Neither is an `m` or an `f`, so neither may change.\n\nYou are graded on the table afterwards.',
    setupSql: `
CREATE TABLE staff (
  id   INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  sex  TEXT
);
INSERT INTO staff VALUES
  (1, 'Ada',     'f'),
  (2, 'Linus',   'm'),
  (3, 'Grace',   'f'),
  (4, 'Sam',     'x'),
  (5, 'Alex',    NULL);
`,
    solutionSql: `
UPDATE staff
SET sex = CASE sex
            WHEN 'm' THEN 'f'
            WHEN 'f' THEN 'm'
            ELSE sex
          END;`,
    checkSql: 'SELECT id, name, sex FROM staff ORDER BY id;',
    expectRows: 5,
    orderMatters: true,
    hints: [
      'Try it as two `UPDATE`s and look at the result. Then work out why it happened.',
      'One statement needs one expression that produces the new value from the old — a `CASE`.',
      'The `ELSE` matters: without it, `x` and the NULL become NULL.',
    ],
    explanation:
      'The point of the problem is why the obvious approach fails.\n\n```\nUPDATE staff SET sex = \'f\' WHERE sex = \'m\';\nUPDATE staff SET sex = \'m\' WHERE sex = \'f\';\n```\n\nThe first turns every `m` into `f`. The second then turns **all** of them back into `m` — the originals and the ones just converted, since it cannot tell them apart. The table ends up all `m`, the statements both report success, and the data is gone. A swap needs a single statement that reads the old value and writes the new one in one pass, and `CASE` is that expression.\n\nThe `ELSE sex` is the second half of the problem. `CASE` with no `ELSE` returns NULL when nothing matches, so Sam\'s `x` and Alex\'s NULL would both be overwritten with NULL — an `UPDATE` with no `WHERE` touches every row, so every value not named in a `WHEN` has to be named in the `ELSE`. Writing `WHERE sex IN (\'m\', \'f\')` on the statement is the other way to say it, and is the version to prefer when the table is large: it updates two rows instead of five.\n\nMySQL can also write this as `SET sex = IF(sex = \'m\', \'f\', IF(sex = \'f\', \'m\', sex))`, which is the same logic and harder to read. `CASE` is standard SQL and runs everywhere.',
    learnTopic: 'sql/insert-update-delete',
    topicTags: ['update', 'case', 'null'],
  },

  {
    slug: 'archive-and-remove',
    title: 'Move the old orders to the archive',
    category: 'modify',
    difficulty: 'Medium',
    statement:
      'Every order placed **before 2024-01-01** should be copied into `orders_archive` and then removed from `orders`. The newer ones stay where they are.\n\nYou are graded on both tables afterwards.',
    setupSql: `
CREATE TABLE orders (
  id        INTEGER PRIMARY KEY,
  placed_on TEXT NOT NULL,
  total     INTEGER NOT NULL
);
INSERT INTO orders VALUES
  (1, '2023-06-14', 4200),
  (2, '2023-11-30', 1900),
  (3, '2023-12-31',  850),
  (4, '2024-01-01', 3300),
  (5, '2024-02-18',  760),
  (6, '2024-05-02', 5100);

CREATE TABLE orders_archive (
  id        INTEGER PRIMARY KEY,
  placed_on TEXT NOT NULL,
  total     INTEGER NOT NULL
);
`,
    solutionSql: `
INSERT INTO orders_archive (id, placed_on, total)
SELECT id, placed_on, total FROM orders WHERE placed_on < '2024-01-01';

DELETE FROM orders WHERE placed_on < '2024-01-01';`,
    checkSql: `
SELECT 'archive' AS which, id FROM orders_archive
UNION ALL
SELECT 'live', id FROM orders
ORDER BY which, id;`,
    expectRows: 6,
    orderMatters: true,
    hints: [
      '`INSERT INTO … SELECT …` copies rows between tables without listing any values.',
      'Two statements, and the order they run in is not a preference.',
      'Order 4 is dated exactly 2024-01-01. `<` and `<=` disagree about it — read the question again.',
    ],
    explanation:
      '`INSERT INTO target (cols) SELECT cols FROM source WHERE …` is the copy, and it is worth knowing as a shape: the `SELECT` can be any query at all, so this is also how a table is backfilled, denormalised or re-partitioned.\n\n**Copy first, delete second.** Reversed, the `DELETE` removes the rows and the `INSERT` then copies nothing — and it does so quietly, reporting a successful insert of zero rows. This is the ordering mistake that costs data rather than time.\n\n**Both statements need the same `WHERE`.** They are two independent statements, and nothing connects the set the first one copied to the set the second one removes except that the predicates happen to match. In production the pair belongs inside a transaction — `BEGIN; INSERT …; DELETE …; COMMIT;` — so that a failure between them cannot leave orders archived and still live, or deleted and never archived. On PostgreSQL and SQL Server, `DELETE … RETURNING` (or `OUTPUT`) does the whole thing as one statement, which removes the question entirely.\n\nAnd the boundary. Order 4 is dated exactly 2024-01-01 and "before 2024-01-01" excludes it. `<` against the first instant of the period is the form to use for date ranges generally — it is the one that stays right when the column gains a time component, where `<= \'2023-12-31\'` would start dropping everything that happened during that last day.',
    learnTopic: 'sql/insert-update-delete',
    topicTags: ['insert-select', 'delete', 'transaction', 'date-range'],
  },

  {
    slug: 'add-a-column-and-backfill',
    title: 'Add a column and fill it in',
    category: 'modify',
    difficulty: 'Medium',
    statement:
      'Add a `domain` column to `users` and fill it with the part of each email after the `@`.\n\nYou are graded on the table afterwards — the column has to exist and every row has to have the right value in it.',
    setupSql: `
CREATE TABLE users (
  id    INTEGER PRIMARY KEY,
  email TEXT NOT NULL
);
INSERT INTO users VALUES
  (1, 'ada@example.com'),
  (2, 'grace@navy.mil'),
  (3, 'linus@kernel.org'),
  (4, 'radia@example.com');
`,
    solutionSql: `
ALTER TABLE users ADD COLUMN domain TEXT;

UPDATE users SET domain = SUBSTR(email, INSTR(email, '@') + 1);`,
    checkSql: 'SELECT id, email, domain FROM users ORDER BY id;',
    expectRows: 4,
    orderMatters: true,
    hints: [
      'Two statements: one changes the shape of the table, the other fills it in.',
      '`ALTER TABLE users ADD COLUMN domain TEXT;` — a new column starts as NULL on every existing row.',
      '`INSTR(email, \'@\')` is where the `@` is; `SUBSTR(email, that + 1)` with no length runs to the end of the string.',
    ],
    explanation:
      'The pair is one of the most common real migrations there is: **add the column, then backfill it.** They are separate statements because they are separate kinds of change — one is DDL, altering the shape of the table, and the other is DML, changing what is in it.\n\nAdding a nullable column is cheap on a modern engine: it is a catalogue change, and existing rows are simply read as NULL. Adding one that is `NOT NULL` **with a default** used to rewrite the whole table, and on MySQL before 8.0 or Postgres before 11 that meant a long lock on a big table. The safe sequence people learned from that is still the right one: add it nullable, backfill in batches, then add the constraint.\n\n`SUBSTR` with two arguments runs to the end of the string, which is what "everything after the `@`" means. `INSTR` is 1-based, so `+ 1` steps past the `@` itself rather than including it.\n\nOne thing this problem deliberately does not do is make `domain` a generated column. `ALTER TABLE users ADD COLUMN domain TEXT GENERATED ALWAYS AS (SUBSTR(email, INSTR(email, \'@\') + 1))` exists in both SQLite and MySQL, and where the value is *derived* rather than *entered* it is the better answer — it cannot drift out of step with the email the way a backfilled copy can the moment somebody updates one.',
    dialectNote:
      'SQLite\'s `ALTER TABLE` only adds columns and renames things; dropping or retyping one means rebuilding the table. MySQL would declare this `ADD COLUMN domain VARCHAR(255)`, and would write the extraction as `SUBSTRING_INDEX(email, \'@\', -1)`.',
    learnTopic: 'sql/creating-tables',
    topicTags: ['alter-table', 'ddl', 'update', 'backfill'],
  },
];
