import { asked, cheat, code, h, links, mysqlDoc, note, p, pgDoc, sql, table, tip, ul, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'A **constraint** is a rule the database enforces on every write, from every client, forever. That last part is the whole argument for them: a rule in your application code holds until somebody writes a second application, an import script, or a manual fix at 2am. A rule on the table holds for all three.',
    ),
    p(
      'There are five, plus the referential actions that decide what happens to children when a parent is deleted.',
    ),

    h('The five'),
    table(
      ['constraint', 'guarantees', 'per'],
      [
        ['`NOT NULL`', 'The column always has a value.', 'Column'],
        ['`UNIQUE`', 'No two rows share this value — NULLs excepted.', 'Column or set of columns'],
        ['`PRIMARY KEY`', '`NOT NULL` **and** `UNIQUE`, and this is the row’s identity.', 'One per table'],
        ['`FOREIGN KEY`', 'The value exists in another table, or is NULL.', 'Column or set of columns'],
        ['`CHECK`', 'An arbitrary boolean holds for the row.', 'Column or table'],
        ['`DEFAULT`', 'Not strictly a constraint — supplies a value when none is given.', 'Column'],
      ],
    ),
    note(
      '`PRIMARY KEY` is not a sixth kind of rule; it is `NOT NULL` plus `UNIQUE` plus a declaration of intent. Saying that out loud is a good answer to "what is the difference between a primary key and a unique constraint" — the other half being that a unique column may be NULL and there may be many of them.',
    ),

    h('Declared inline'),
    code(
      sql(`
CREATE TABLE employees (
  id         INT           PRIMARY KEY AUTO_INCREMENT,
  email      VARCHAR(255)  NOT NULL UNIQUE,
  name       VARCHAR(50)   NOT NULL,
  salary     DECIMAL(10,2) NOT NULL CHECK (salary >= 0),
  dept_id    INT,
  manager_id INT,
  hired_on   DATE          NOT NULL DEFAULT (CURRENT_DATE),
  status     VARCHAR(10)   NOT NULL DEFAULT 'active'
                           CHECK (status IN ('active', 'leave', 'left')),

  CONSTRAINT fk_dept    FOREIGN KEY (dept_id)    REFERENCES departments(id)
                        ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_manager FOREIGN KEY (manager_id) REFERENCES employees(id)
                        ON DELETE SET NULL,
  CONSTRAINT ck_not_own_manager CHECK (manager_id <> id)
);
`),
    ),
    tip(
      'The last one is a **table-level** check rather than a column-level one, and it has to be: it mentions two columns. A column-level `CHECK` can only see its own column. Anything comparing two columns goes at the end of the definition.',
    ),

    h('Added afterwards'),
    p('Constraints can be added and dropped on an existing table, and this is where the interesting failure lives:'),
    code(
      sql(`
ALTER TABLE employees ADD CONSTRAINT uq_email UNIQUE (email);
ALTER TABLE employees ADD CONSTRAINT ck_salary CHECK (salary >= 0);
ALTER TABLE employees ADD CONSTRAINT fk_dept
  FOREIGN KEY (dept_id) REFERENCES departments(id);

ALTER TABLE employees DROP CONSTRAINT ck_salary;   -- Postgres, MySQL 8+
ALTER TABLE employees DROP INDEX uq_email;         -- MySQL, for a UNIQUE
ALTER TABLE employees DROP FOREIGN KEY fk_dept;    -- MySQL, for an FK
`),
    ),
    warn(
      'Adding a constraint to a table with rows in it **validates every existing row**, and fails if any one of them breaks the rule. That is correct behaviour and it is also why "add NOT NULL to a column with nulls in it" fails in production and not in your empty dev database. The fix is three steps: add it nullable, backfill the nulls, then apply the constraint.',
    ),

    h('Referential actions'),
    p(
      'When a parent row is deleted or its key updated, five things can happen to the children. This is asked by name, and `CASCADE` is the one people know and the one that most often turns out to be wrong.',
    ),
    table(
      ['action', 'on delete of the parent', 'use it when'],
      [
        [
          '`RESTRICT`',
          'The delete is **refused** while children exist.',
          'The child is a real fact you must not silently lose — an order for a customer.',
        ],
        [
          '`NO ACTION`',
          'The same refusal, but checked at the end of the statement rather than immediately.',
          'The SQL standard default. In practice identical to `RESTRICT` unless the constraint is deferred.',
        ],
        [
          '`CASCADE`',
          'The children are **deleted too**.',
          'The child cannot exist without the parent — a weak entity. Order lines with their order.',
        ],
        [
          '`SET NULL`',
          'The child’s foreign key becomes `NULL`.',
          'The relationship is optional. Deleting a department should not delete its people.',
        ],
        [
          '`SET DEFAULT`',
          'The foreign key becomes its default value.',
          'Rarely — the default has to reference a row guaranteed to exist.',
        ],
      ],
    ),
    warn(
      '`ON DELETE CASCADE` is recursive. Deleting one customer can remove their orders, then those orders’ lines, then those lines’ shipment records — from one statement, with no confirmation and no easy way back. Use it where the relationship genuinely means "part of", and use `RESTRICT` everywhere the answer to "should this delete succeed?" is "someone should probably look at that first".',
    ),
    p('The default, if you write nothing, is `NO ACTION` — the safe one. That is worth knowing both ways round.'),

    h('CHECK, and the two things it cannot do'),
    p(
      'A `CHECK` is an arbitrary boolean over one row. Useful for ranges, enumerations, and cross-column rules:',
    ),
    code(
      sql(`
CHECK (salary BETWEEN 0 AND 10000000)
CHECK (status IN ('active', 'leave', 'left'))
CHECK (end_date IS NULL OR end_date >= start_date)
CHECK (CHAR_LENGTH(pincode) = 6)
`),
    ),
    ul(
      '**It cannot see other rows.** "No more than five people per department" is not a `CHECK` — the row being inserted cannot count its siblings. That is a trigger, or a unique index on a derived column, or application logic in a transaction.',
      '**It cannot be non-deterministic.** No `CURRENT_DATE`, no subqueries, in most engines. A constraint that changes its mind tomorrow would mean rows that were legal on insert are illegal now.',
    ),
    note(
      'MySQL only began *enforcing* `CHECK` in **8.0.16** — before that it parsed and silently ignored them, which is a genuinely nasty piece of history to know about, because a schema written for MySQL 5.7 may contain checks that never did anything. PostgreSQL has always enforced them.',
    ),

    h('Seeing what a table actually enforces'),
    code(
      sql(`
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_schema = 'company' AND table_name = 'employees';

SHOW CREATE TABLE employees;   -- MySQL: the whole definition back
`),
    ),

    h('Interview'),
    asked([
      ['Name the integrity constraints.', 'NOT NULL, UNIQUE, PRIMARY KEY, FOREIGN KEY, CHECK — plus DEFAULT, which supplies rather than enforces.'],
      ['Primary key vs unique?', 'A primary key is unique *and* not null, and there is one per table; a unique column may be null and there may be many.'],
      ['What is referential integrity?', 'Every foreign key value either is NULL or matches an existing primary key.'],
      ['What does ON DELETE CASCADE do?', 'Deletes the child rows when the parent goes — and does so recursively.'],
      ['What is the default referential action?', 'NO ACTION — the parent delete is refused while children exist.'],
      ['When would you use SET NULL?', 'When the relationship is optional and the child should outlive the parent.'],
      ['Can a CHECK constraint reference another table?', 'No. It sees one row; cross-row or cross-table rules need a trigger or application logic in a transaction.'],
      ['Why enforce rules in the database rather than the app?', 'Because the app is not the only writer — scripts, other services and manual fixes all bypass it.'],
      ['What happens if you add a constraint to a table that violates it?', 'The ALTER fails. Backfill first, then constrain.'],
    ]),

    h('Cheatsheet'),
    cheat([
      ['A column must have a value', '`NOT NULL`'],
      ['No two rows share an email', '`UNIQUE (email)`'],
      ['A salary is never negative', '`CHECK (salary >= 0)`'],
      ['A status is one of three words', "`CHECK (status IN ('a','b','c'))`"],
      ['An end date is after its start', '`CHECK (end_date IS NULL OR end_date >= start_date)` — table level'],
      ['Order lines die with the order', '`ON DELETE CASCADE`'],
      ['People survive their department', '`ON DELETE SET NULL`'],
      ['Refuse to delete a customer with orders', '`ON DELETE RESTRICT`'],
      ['Count rows across a table', 'Not a constraint — a trigger or a transaction'],
    ]),

    links(
      mysqlDoc('create-table-foreign-keys.html', 'Foreign keys in MySQL'),
      mysqlDoc('create-table-check-constraints.html', 'CHECK constraints in MySQL'),
      pgDoc('ddl-constraints.html', 'Constraints in PostgreSQL'),
    ),
  ],
};
