import {
  asked,
  cheat,
  code,
  h,
  links,
  note,
  p,
  sql,
  table,
  tip,
  ul,
  warn,
  wiki,
} from '../blocks.js';
import { employees } from './sample-data.js';

/*
  Seven names for what is nearly one idea, and the reason people find it
  confusing is that they are usually presented as a list of definitions rather
  than as a nesting. So the nesting leads, and the definitions hang off it.
*/
export const doc = {
  blocks: [
    p(
      'A **key** is a set of columns whose values identify a row. There are seven names for slight variations on that, they are asked about constantly, and they are much easier to hold onto once you see that four of them are simply progressively stricter versions of the same thing.',
    ),

    h('The nesting'),
    p('Read this top to bottom — each line is the one above it with one more condition:'),
    ul(
      '**Super key** — any set of columns that is unique. `{id}` is one. So is `{id, name}`. So is every column in the table. Uniqueness is the *only* requirement, so a table with N columns has a great many super keys.',
      '**Candidate key** — a super key with **nothing to spare**: remove any column and it stops being unique. `{id, name}` is not one, because `{id}` alone already works. Formally: a *minimal* super key.',
      '**Primary key** — the candidate key you **chose**. Exactly one per table. The choice is yours; nothing about the data decides it.',
      '**Alternate key** — every candidate key you did *not* choose. Usually given a `UNIQUE` constraint so the database still enforces it.',
    ),
    note(
      'The one-word answer to "super key vs candidate key" is **minimality**. Both are unique; only the candidate key has nothing removable. Almost every version of this question is testing that word.',
    ),

    h('On a real table'),
    employees(),
    p(
      'Suppose a company where no two employees ever share a name. Then the keys are:',
    ),
    table(
      ['set', 'unique?', 'minimal?', 'so it is'],
      [
        ['`{id}`', 'Yes', 'Yes', '**Candidate key** — and the one we chose, so the **primary key**'],
        ['`{name}`', 'Yes (given the assumption)', 'Yes', '**Candidate key**, unchosen → an **alternate key**'],
        ['`{id, name}`', 'Yes', 'No — `{id}` suffices', 'Super key only'],
        ['`{id, salary, hired_on}`', 'Yes', 'No', 'Super key only'],
        ['`{dept_id}`', 'No — Ada and Grace share `1`', '—', 'Not a key at all'],
        ['`{salary}`', 'Yes here, by luck', 'Yes', '**Not a key** — see the warning below'],
      ],
    ),
    warn(
      'That last row is the trap. A key is a property of the **schema**, not of the rows that happen to be present. No two of our six salaries repeat, but two employees obviously *may* earn the same, so `salary` is not a candidate key. Deciding keys by looking at current data is how a schema acquires a constraint that fails in production six months later.',
    ),

    h('The other three'),
    table(
      ['name', 'is', 'example'],
      [
        [
          '**Composite key**',
          'Any key made of more than one column. Not a separate category — a primary or candidate key can be composite.',
          '`PRIMARY KEY (employee_id, project_id)` on a junction table',
        ],
        [
          '**Foreign key**',
          'A column referencing another table’s primary key. It is a *reference*, not an identifier — the one name in this list that does not identify the row it is on.',
          '`employees.dept_id` → `departments.id`',
        ],
        [
          '**Surrogate key**',
          'A meaningless generated identifier — auto-increment or UUID — used as the primary key instead of real data.',
          '`id INT AUTO_INCREMENT`',
        ],
      ],
    ),
    p(
      'The opposite of a surrogate key is a **natural key**: real data that happens to be unique, like an email address or an ISBN.',
    ),

    h('Surrogate or natural'),
    p(
      'Asked as an opinion question, and there is a defensible answer: **surrogate, with a unique constraint on the natural key.** You get a stable identifier *and* the database still enforces the real rule.',
    ),
    table(
      ['', 'Surrogate (`id INT`)', 'Natural (`email`)'],
      [
        ['Stable', 'Always — it means nothing, so nothing can change it', 'No. People change email addresses, countries renumber postcodes'],
        ['Size in a foreign key', '4–8 bytes', 'As long as the value, in every child row and every index'],
        ['Readable in a join', 'No — `dept_id = 1` tells you nothing', 'Yes'],
        ['Needs an extra unique constraint', 'Yes, on the natural key', 'No'],
        ['Leaks information', 'Sequential ids leak row counts and ordering', 'Only what is already public'],
      ],
    ),
    code(
      sql(`
-- Both: a surrogate primary key, and the real rule still enforced.
CREATE TABLE users (
  id    INT PRIMARY KEY AUTO_INCREMENT,   -- surrogate: stable, small, joinable
  email VARCHAR(255) NOT NULL UNIQUE,     -- alternate key: the actual constraint
  name  VARCHAR(50)  NOT NULL
);
`),
    ),
    tip(
      'Skipping the `UNIQUE` is the mistake this pattern exists to prevent. A surrogate key makes every row distinct by construction, so without it the table will cheerfully hold the same person twice — and the bug appears as duplicate rows in a report months later, not as an error at insert time.',
    ),

    h('NULL, and the two rules'),
    table(
      ['', 'may be NULL?', 'why'],
      [
        [
          '**Primary key**',
          '**Never**',
          'Entity integrity. `NULL` means "unknown", and a row you cannot identify has no business existing.',
        ],
        [
          '**Unique / alternate key**',
          'Yes — usually many times',
          'Two `NULL`s are not *equal*, so they do not collide. MySQL, Postgres and Oracle all allow repeated NULLs in a unique column.',
        ],
        [
          '**Foreign key**',
          'Yes',
          '`NULL` means "references nothing", which is partial participation. Only a *non-null* value must match.',
        ],
      ],
    ),
    p(
      'That middle row surprises people, and it is worth being able to demonstrate: a `UNIQUE` column can hold `NULL` in as many rows as you like, because uniqueness is checked with `=` and `NULL = NULL` is not true.',
    ),

    h('Writing them'),
    code(
      sql(`
CREATE TABLE employees (
  id         INT PRIMARY KEY AUTO_INCREMENT,       -- surrogate primary key
  email      VARCHAR(255) NOT NULL UNIQUE,         -- alternate key
  name       VARCHAR(50)  NOT NULL,
  dept_id    INT,                                  -- foreign key, nullable
  manager_id INT,                                  -- foreign key, to this table
  CONSTRAINT fk_dept    FOREIGN KEY (dept_id)    REFERENCES departments(id),
  CONSTRAINT fk_manager FOREIGN KEY (manager_id) REFERENCES employees(id)
);

-- Composite primary key: the pair is the identity.
CREATE TABLE employee_projects (
  employee_id INT NOT NULL,
  project_id  INT NOT NULL,
  PRIMARY KEY (employee_id, project_id)
);
`),
    ),
    tip(
      'Naming a constraint costs two words and pays them back in the error message. An unnamed foreign key fails with `CONSTRAINT employees_ibfk_1 fails`, which tells you a constraint was violated and nothing about which one; `CONSTRAINT fk_dept fails` tells you where to look. It is also the name you need to `DROP` it later.',
    ),

    h('Finding a table’s keys'),
    code(
      sql(`
SELECT column_name, constraint_name, referenced_table_name
FROM information_schema.key_column_usage
WHERE table_schema = 'company' AND table_name = 'employees';
`),
    ),

    h('Interview'),
    asked([
      ['Super key vs candidate key?', 'Both are unique; a candidate key is minimal — remove any column and uniqueness is lost.'],
      ['Candidate key vs primary key?', 'The primary key is the candidate key you picked. The rest become alternate keys.'],
      ['How many primary keys can a table have?', 'One — though it may be composite, made of several columns.'],
      ['Can a primary key be NULL?', 'No. Entity integrity forbids it.'],
      ['Can a unique column be NULL?', 'Yes, and repeatedly — two NULLs are not equal, so they do not collide.'],
      ['Can a foreign key be NULL?', 'Yes; that means it references nothing. A non-null value must match an existing key.'],
      ['What is a composite key?', 'A key made of two or more columns — typical on junction tables.'],
      ['Surrogate vs natural key?', 'Surrogate is generated and meaningless but stable; natural is real data and can change. Prefer surrogate plus a UNIQUE on the natural key.'],
      ['Is `salary` a key if no two rows share one?', 'No — a key is a schema property, not an accident of the current rows.'],
      ['Can a foreign key reference its own table?', 'Yes — that is a recursive relationship, like `manager_id`.'],
    ]),

    h('Cheatsheet'),
    cheat([
      ['Identify a row', 'Primary key — one per table, never NULL'],
      ['Enforce a second unique rule', '`UNIQUE` — an alternate key'],
      ['Identify a junction row', 'Composite primary key on the pair'],
      ['Point at another table', 'Foreign key; nullable if the relationship is optional'],
      ['Pick a primary key for a new table', 'Surrogate `id`, plus `UNIQUE` on the natural key'],
      ['Allow "not known yet"', 'A nullable column — never a placeholder like `0` or `-1`'],
    ]),

    links(
      wiki('Unique_key', 'Candidate and unique keys'),
      wiki('Primary_key', 'Primary key'),
      wiki('Surrogate_key', 'Surrogate key'),
    ),
  ],
};
