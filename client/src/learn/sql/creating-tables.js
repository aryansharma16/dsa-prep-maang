import { asked, cheat, code, h, links, mysqlDoc, mysql, note, p, pgDoc, postgres, sql, table, tip, warn } from '../blocks.js';
import { SCHEMA_SQL } from './sample-data.js';

export const doc = {
  blocks: [
    p(
      '`CREATE TABLE` is where the schema, the types and the constraints all arrive at once. Everything you decided in the design section is written here, and this is the statement the rest of the track queries.',
    ),

    h('The two tables this track runs on'),
    p('Every query in every topic after this one runs against these:'),
    code(sql(SCHEMA_SQL)),
    p(
      '`departments` is created **first**, and it has to be: `employees` has a foreign key pointing at it, and you cannot reference a table that does not exist yet. Dropping goes in the opposite order for the same reason.',
    ),

    h('Reading the definition back'),
    table(
      ['line', 'says'],
      [
        ['`id INT PRIMARY KEY`', 'Whole number, unique, not null, the row’s identity.'],
        ['`name VARCHAR(50) NOT NULL UNIQUE`', 'Up to 50 characters, always present, no two the same.'],
        ['`salary DECIMAL(10,2) NOT NULL`', 'Exact to two decimal places, up to 10 digits, always present.'],
        ['`dept_id INT`', 'Nullable — an employee may have no department. Partial participation.'],
        ['`FOREIGN KEY (dept_id) REFERENCES departments(id)`', 'If it is not null, it must exist over there.'],
        ['`FOREIGN KEY (manager_id) REFERENCES employees(id)`', 'A self-reference — the recursive relationship.'],
      ],
    ),

    h('Auto-generated keys'),
    p('Three dialects, three spellings of the same idea:'),
    code(
      mysql(`
CREATE TABLE employees (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL
);
`),
      postgres(`
CREATE TABLE employees (
  id   INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,   -- SERIAL also works, and is older
  name VARCHAR(50) NOT NULL
);
`),
    ),
    note(
      'Auto-increment values are **not** reused and **not** guaranteed contiguous. A rolled-back insert consumes its number and leaves a gap. That is correct — the sequence is a counter, not a row count — and code that assumes `id = n` means "the nth row" is wrong.',
    ),

    h('Creating from a query'),
    code(
      sql(`
-- MySQL and PostgreSQL: structure and data.
CREATE TABLE senior_staff AS
SELECT id, name, salary FROM employees WHERE salary > 80000;

-- Structure only, no rows.
CREATE TABLE employees_archive LIKE employees;              -- MySQL
CREATE TABLE employees_archive (LIKE employees INCLUDING ALL);  -- PostgreSQL
`),
    ),
    warn(
      '`CREATE TABLE … AS SELECT` copies the columns and the data and **not the constraints**. No primary key, no foreign keys, no indexes, no defaults. It is a snapshot, useful for a one-off, and not a way to clone a table you intend to keep writing to.',
    ),

    h('ALTER — changing an existing table'),
    code(
      sql(`
-- Add
ALTER TABLE employees ADD COLUMN email VARCHAR(255);
ALTER TABLE employees ADD COLUMN active BOOLEAN NOT NULL DEFAULT TRUE;

-- Change a type or nullability (note the dialect split)
ALTER TABLE employees MODIFY COLUMN name VARCHAR(100) NOT NULL;      -- MySQL
ALTER TABLE employees ALTER COLUMN name TYPE VARCHAR(100);           -- PostgreSQL

-- Rename
ALTER TABLE employees RENAME COLUMN email TO work_email;
ALTER TABLE employees RENAME TO staff;

-- Remove
ALTER TABLE employees DROP COLUMN work_email;

-- Constraints
ALTER TABLE employees ADD CONSTRAINT uq_email UNIQUE (email);
ALTER TABLE employees ADD CONSTRAINT ck_salary CHECK (salary >= 0);
ALTER TABLE employees DROP FOREIGN KEY fk_dept;                      -- MySQL
ALTER TABLE employees DROP CONSTRAINT fk_dept;                       -- PostgreSQL
`),
    ),

    h('Adding a NOT NULL column to a table with rows in it'),
    p(
      'The most common `ALTER` that fails in production and passes in development, because development had no rows. Adding `NOT NULL` with no default asks the database what to put in the existing rows, and it has no answer:',
    ),
    code(
      sql(`
-- Fails: every existing row would need a value.
ALTER TABLE employees ADD COLUMN email VARCHAR(255) NOT NULL;

-- Works: three steps, and each one is safe on its own.
ALTER TABLE employees ADD COLUMN email VARCHAR(255);              -- 1. nullable
UPDATE employees SET email = CONCAT(LOWER(name), '@company.com')  -- 2. backfill
  WHERE email IS NULL;
ALTER TABLE employees MODIFY COLUMN email VARCHAR(255) NOT NULL;  -- 3. constrain
`),
    ),
    tip(
      'The same three steps apply to adding any constraint to a populated table — `UNIQUE`, `CHECK`, a foreign key. Add, repair, then enforce. Doing it in one statement works only on an empty table, which is exactly why it works on your machine.',
    ),

    h('What ALTER costs on a large table'),
    warn(
      'On MySQL, some `ALTER`s copy the whole table and hold a metadata lock while doing it — on ten million rows that is minutes of a blocked table, which is an outage. MySQL 8 does many changes in place, and adding a nullable column with no default is instant, but changing a column type is not. On PostgreSQL, adding a nullable column is instant and always has been; adding one **with a default** was a full rewrite before version 11 and is instant after it. Check what your version does before running it against production, and reach for `pt-online-schema-change` or `gh-ost` when it is going to copy.',
    ),

    h('DROP and IF EXISTS'),
    code(
      sql(`
DROP TABLE employees;                    -- errors if it is not there
DROP TABLE IF EXISTS employees;          -- silent if it is not
CREATE TABLE IF NOT EXISTS employees (...);

-- Order matters: the child goes first.
DROP TABLE employees;
DROP TABLE departments;
`),
    ),
    p(
      '`DROP TABLE` removes the structure and the data and cannot be rolled back in MySQL. `IF EXISTS` is what makes a migration script re-runnable.',
    ),

    h('Interview'),
    asked([
      ['Which table do you create first?', 'The one being referenced — the parent. Foreign keys cannot point at a table that does not exist.'],
      ['Does CREATE TABLE AS SELECT copy constraints?', 'No — columns and data only. No keys, indexes or defaults.'],
      ['Why does adding a NOT NULL column fail?', 'Existing rows would have no value. Add nullable, backfill, then constrain.'],
      ['Are auto-increment ids contiguous?', 'No. A rolled-back insert consumes its number and leaves a gap.'],
      ['How do you add a foreign key later?', '`ALTER TABLE … ADD CONSTRAINT … FOREIGN KEY … REFERENCES …` — it validates existing rows and fails if any violate it.'],
      ['What does IF EXISTS buy you?', 'A re-runnable migration — no error when the object is already gone.'],
      ['Is ALTER TABLE safe on a big table?', 'Not always. Some changes copy the table and lock it; check the engine and version, and use an online schema change tool when it does.'],
      ['Can you roll back a CREATE TABLE?', 'In PostgreSQL yes; in MySQL no — DDL implicitly commits.'],
    ]),

    h('Cheatsheet'),
    cheat([
      ['A new table', '`CREATE TABLE t (...)` — parents before children'],
      ['A generated id', '`AUTO_INCREMENT` / `GENERATED ALWAYS AS IDENTITY`'],
      ['A column', '`ALTER TABLE t ADD COLUMN c TYPE`'],
      ['A required column on a live table', 'Add nullable → backfill → `MODIFY … NOT NULL`'],
      ['A copy of the structure', '`CREATE TABLE b LIKE a` — not `AS SELECT`'],
      ['A re-runnable script', '`IF EXISTS` / `IF NOT EXISTS`'],
      ['Remove a table', '`DROP TABLE` — child first, and it is not coming back'],
    ]),

    links(
      mysqlDoc('create-table.html', 'CREATE TABLE (MySQL)'),
      mysqlDoc('alter-table.html', 'ALTER TABLE (MySQL)'),
      pgDoc('sql-createtable.html', 'CREATE TABLE (PostgreSQL)'),
    ),
  ],
};
