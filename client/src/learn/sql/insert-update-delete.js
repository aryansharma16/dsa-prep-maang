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
  pgDoc,
  postgres,
  result,
  sql,
  table,
  tip,
  warn,
} from '../blocks.js';
import { departments, employees } from './sample-data.js';

export const doc = {
  blocks: [
    p(
      'Three statements change data, and between them they are the whole of DML. They are simple, they are all transactional, and one of them has a failure mode severe enough that it is worth a habit rather than care.',
    ),
    employees(),

    h('INSERT'),
    code(
      sql(`
-- One row, naming the columns. Always name them.
INSERT INTO employees (id, name, dept_id, salary, manager_id, hired_on)
VALUES (7, 'Katherine', 2, 88000, 4, '2024-06-01');

-- Several at once: one statement, one round trip, one transaction.
INSERT INTO employees (id, name, dept_id, salary, manager_id, hired_on) VALUES
  (8, 'Margaret', 1, 99000, 1,    '2024-07-15'),
  (9, 'Shafi',    2, 86000, 4,    '2024-08-01'),
  (10, 'Vint',    NULL, 71000, NULL, '2024-09-10');

-- From a query.
INSERT INTO employees_archive (id, name, salary)
SELECT id, name, salary FROM employees WHERE hired_on < '2020-01-01';
`),
    ),
    warn(
      '`INSERT INTO employees VALUES (7, \'Katherine\', ...)` without the column list is valid and is a latent bug. It binds values to columns **by position**, so the day somebody adds a column in the middle — or reorders two — every such statement starts writing values into the wrong fields, silently, with no error. Naming the columns costs one line and removes the entire failure mode.',
    ),

    h('Inserting only if it is not already there'),
    p('Four ways, and they do genuinely different things:'),
    code(
      mysql(`
-- Skip the row if it collides with a key. Also skips *other* errors — be careful.
INSERT IGNORE INTO departments (id, name) VALUES (1, 'Engineering');

-- Insert, or update the existing row. The usual answer.
INSERT INTO departments (id, name, location)
VALUES (1, 'Engineering', 'Pune')
ON DUPLICATE KEY UPDATE location = VALUES(location);

-- Delete-then-insert. Not the same thing: it fires delete triggers,
-- loses columns you did not supply, and takes a new auto-increment id.
REPLACE INTO departments (id, name, location) VALUES (1, 'Engineering', 'Pune');
`),
      postgres(`
-- Skip on conflict.
INSERT INTO departments (id, name) VALUES (1, 'Engineering')
ON CONFLICT (id) DO NOTHING;

-- Upsert. EXCLUDED is the row that would have been inserted.
INSERT INTO departments (id, name, location)
VALUES (1, 'Engineering', 'Pune')
ON CONFLICT (id) DO UPDATE SET location = EXCLUDED.location;
`),
    ),
    note(
      '`REPLACE` is the trap of the four. It is a `DELETE` followed by an `INSERT`, so any column you did not mention reverts to its default rather than keeping its value, `ON DELETE CASCADE` fires on the children, and the row gets a new auto-increment id. When you mean "update if present", say `ON DUPLICATE KEY UPDATE`.',
    ),

    h('UPDATE'),
    code(
      sql(`
UPDATE employees SET salary = 99000 WHERE id = 1;

-- Several columns, and an expression referring to the current value.
UPDATE employees
SET salary  = salary * 1.10,
    dept_id = 2
WHERE dept_id = 1 AND hired_on < '2021-01-01';

-- From another table.
UPDATE employees e
JOIN departments d ON e.dept_id = d.id
SET e.salary = e.salary * 1.05
WHERE d.location = 'Bengaluru';
`),
    ),
    departments(),
    p(
      'That last one raises everyone in a Bengaluru department by 5%. Ada is in Engineering, which is in Bengaluru, so she goes from 95,000 to 99,750. Grace, in the same department, goes from 82,000 to 86,100. Nobody else moves.',
    ),
    result(
      ['name', 'salary'],
      [
        ['Ada', '`99750.00`'],
        ['Grace', '`86100.00`'],
      ],
      'The two rows that changed',
    ),

    h('The missing WHERE'),
    warn(
      '`UPDATE employees SET salary = 0` is a valid statement that sets every salary in the table to zero. There is no confirmation, no undo outside a transaction, and no error — it reports success and tells you how many rows it changed, which will be all of them. The same is true of `DELETE FROM employees`.',
    ),
    p('Three habits, in order of how much they help:'),
    code(
      sql(`
-- 1. Write it as a SELECT first. Same WHERE, and you see what you are about to hit.
SELECT * FROM employees WHERE dept_id = 1;

-- 2. Wrap it. Look at the row count, then decide.
START TRANSACTION;
  UPDATE employees SET salary = salary * 1.10 WHERE dept_id = 1;
  -- "Rows matched: 2  Changed: 2"  — expected 2. Good.
COMMIT;   -- or ROLLBACK

-- 3. On MySQL, make the mistake impossible in an interactive session.
SET SQL_SAFE_UPDATES = 1;   -- refuses UPDATE/DELETE with no key in the WHERE
`),
    ),
    tip(
      'The second habit is the one that generalises. It costs two words, it works in every client, and the row count is the check — if you expected to change two rows and it says 4,182, you `ROLLBACK` and go and read your `WHERE` clause again.',
    ),

    h('DELETE'),
    code(
      sql(`
DELETE FROM employees WHERE id = 6;

DELETE FROM employees WHERE hired_on < '2019-01-01';

-- Using another table, MySQL. Note the alias before FROM: it says which table to delete from.
DELETE e FROM employees e
JOIN departments d ON e.dept_id = d.id
WHERE d.location = 'Mumbai';

-- Every row. The table remains, and so does the auto-increment counter.
DELETE FROM employees;
`),
    ),
    p(
      'A `DELETE` blocked by a foreign key is the constraint working. `departments` cannot lose Engineering while Ada and Grace point at it — unless the constraint says `ON DELETE CASCADE`, in which case they go too, or `SET NULL`, in which case they stay and lose their department.',
    ),

    h('Soft deletes'),
    p(
      'Most production systems do not really delete. A flag preserves the row for audit, for undo, and for the foreign keys pointing at it:',
    ),
    code(
      sql(`
ALTER TABLE employees ADD COLUMN deleted_at DATETIME NULL;

UPDATE employees SET deleted_at = NOW() WHERE id = 6;

-- And every read has to remember.
SELECT * FROM employees WHERE deleted_at IS NULL;
`),
    ),
    note(
      'The cost is in that last line: **every** query in the system must now exclude deleted rows, and the one that forgets is a bug that shows a customer a record they deleted. A view over the live rows, queried instead of the table, moves the rule to one place — which is what the external schema in the three-schema topic was for.',
    ),

    h('Returning what changed'),
    code(
      postgres(`
-- PostgreSQL: get the affected rows back from the same statement.
INSERT INTO employees (name, salary, hired_on)
VALUES ('Katherine', 88000, '2024-06-01')
RETURNING id, name;

UPDATE employees SET salary = salary * 1.1 WHERE dept_id = 1 RETURNING id, salary;
DELETE FROM employees WHERE id = 6 RETURNING *;
`),
      mysql(`
-- MySQL has no RETURNING. For a generated id:
INSERT INTO employees (name, salary, hired_on)
VALUES ('Katherine', 88000, '2024-06-01');
SELECT LAST_INSERT_ID();
`),
    ),

    h('Interview'),
    asked([
      ['What happens if you UPDATE without a WHERE?', 'Every row is updated. It succeeds, reports the count, and there is no undo outside a transaction.'],
      ['Why name columns in an INSERT?', 'Otherwise values bind by position, and adding or reordering a column silently corrupts every such statement.'],
      ['How do you insert-or-update?', '`ON DUPLICATE KEY UPDATE` in MySQL, `ON CONFLICT … DO UPDATE` in PostgreSQL.'],
      ['Why avoid REPLACE?', 'It deletes then inserts — unmentioned columns revert, delete triggers and cascades fire, and the id changes.'],
      ['Can you UPDATE using another table?', 'Yes — `UPDATE … JOIN … SET` in MySQL, `UPDATE … FROM` in PostgreSQL.'],
      ['What is a soft delete?', 'Marking a row deleted with a flag instead of removing it — at the cost of every read having to filter on it.'],
      ['What happens deleting a parent with children?', 'It depends on the referential action: refused by default, cascaded, or the child FK set to NULL.'],
      ['How do you get a generated id back?', '`RETURNING` in PostgreSQL; `LAST_INSERT_ID()` in MySQL.'],
      ['How do you make a bulk change safely?', 'Run the WHERE as a SELECT, then do it inside a transaction and check the row count before committing.'],
    ]),

    h('Cheatsheet'),
    cheat([
      ['Add a row', '`INSERT INTO t (cols) VALUES (...)` — always name the columns'],
      ['Add many rows', 'One `INSERT` with several `VALUES` tuples'],
      ['Copy rows in', '`INSERT INTO t (cols) SELECT ...`'],
      ['Insert or update', '`ON DUPLICATE KEY UPDATE` / `ON CONFLICT DO UPDATE`'],
      ['Change rows', '`UPDATE t SET c = v WHERE ...` — check the `WHERE` as a `SELECT` first'],
      ['Change using another table', '`UPDATE … JOIN … SET`'],
      ['Remove rows', '`DELETE FROM t WHERE ...`'],
      ['Remove without losing them', 'A `deleted_at` column, plus a view that filters it'],
      ['Do it safely', '`START TRANSACTION`, check the count, then `COMMIT`'],
    ]),

    links(
      mysqlDoc('insert.html', 'INSERT (MySQL)'),
      mysqlDoc('insert-on-duplicate.html', 'ON DUPLICATE KEY UPDATE'),
      pgDoc('sql-insert.html', 'INSERT (PostgreSQL)'),
    ),
  ],
};
