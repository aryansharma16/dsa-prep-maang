import { asked, cheat, code, h, links, note, p, sql, table, tip, ul, wiki } from '../blocks.js';

/*
  Pure theory, and one of the few topics here where the *reason* is more
  interesting than the content. The three levels are trivial to memorise and
  mean nothing until you have seen the thing they buy — so data independence
  leads, and the levels are introduced as the mechanism that produces it.
*/
export const doc = {
  blocks: [
    p(
      'ANSI/SPARC, 1975: a database should be described at **three levels**, and a change at one level should not force a change at the ones above it. That last clause is the whole point. The three levels are the mechanism; **data independence** is the product.',
    ),
    p(
      'It is asked constantly, usually as "explain the three-schema architecture", and the answer that scores is the one that names what each level hides from the one above.',
    ),

    h('The three levels'),
    table(
      ['level', 'also called', 'what it describes', 'who cares'],
      [
        [
          '**External**',
          'View level',
          'What one group of users is allowed to see — a subset, renamed, recombined. There are *many* external schemas.',
          'The application, the analyst, the support agent',
        ],
        [
          '**Conceptual**',
          'Logical level',
          'Every table, column, type, key and constraint in the whole database. Exactly **one** of these.',
          'The DBA, the schema designer',
        ],
        [
          '**Internal**',
          'Physical level',
          'How the bytes actually sit: files, pages, index structures, compression, ordering. Exactly **one**.',
          'The DBMS, and the DBA tuning it',
        ],
      ],
    ),
    note(
      'The counts matter and are asked directly: **one internal, one conceptual, many external.** A database has one physical layout and one logical design, and as many views onto it as there are audiences.',
    ),

    h('The same data at all three levels'),
    p('**Internal** — nothing here is SQL. It is the DBMS describing its own storage:'),
    ul(
      '`employees` is stored as a B-tree clustered on `id`, in 8 KB pages.',
      'There is a secondary B-tree index on `dept_id`.',
      '`name` is variable length, stored inline up to 40 bytes and off-page beyond that.',
    ),
    p('**Conceptual** — the whole logical design, written as DDL:'),
    code(
      sql(`
CREATE TABLE employees (
  id         INT PRIMARY KEY,
  name       VARCHAR(50) NOT NULL,
  dept_id    INT,
  salary     DECIMAL(10,2) NOT NULL,
  manager_id INT,
  hired_on   DATE NOT NULL,
  FOREIGN KEY (dept_id) REFERENCES departments(id)
);
`),
    ),
    p(
      '**External** — two different audiences, two different pictures of the same table. The support team gets no salaries at all:',
    ),
    code(
      sql(`
CREATE VIEW staff_directory AS
SELECT e.name AS employee, d.name AS department, d.location
FROM employees e
LEFT JOIN departments d ON e.dept_id = d.id;

CREATE VIEW payroll_summary AS
SELECT d.name AS department, COUNT(*) AS headcount, SUM(e.salary) AS wage_bill
FROM employees e
JOIN departments d ON e.dept_id = d.id
GROUP BY d.name;
`),
    ),
    p(
      'A support agent querying `staff_directory` cannot see a salary — not because they were asked not to, but because the column is not in their picture of the database.',
    ),

    h('Data independence — what the split buys'),
    p(
      'Between each pair of levels there is a **mapping**, and independence is the promise that a change below the mapping does not propagate above it.',
    ),
    table(
      ['kind', 'the change', 'what does *not* have to change', 'realistic?'],
      [
        [
          '**Physical data independence**',
          'Add an index, re-order the rows on disk, switch storage engine, compress a column, move to a different disk.',
          'Every table definition, and every query in the application.',
          'Yes — this one genuinely works, and you rely on it every time you add an index without telling anyone.',
        ],
        [
          '**Logical data independence**',
          'Add a column, split one table into two, rename something.',
          'The views, and the applications reading through them.',
          'Harder. Adding a column is free; splitting a table only stays invisible if the old shape can be rebuilt as a view.',
        ],
      ],
    ),
    tip(
      'If you are asked which is harder to achieve, the answer is **logical**, and the reason is worth saying: physical changes are invisible because SQL never mentions storage in the first place, whereas a logical change is a change to the very thing the application named in its query. A view can hide some of it. It cannot hide all of it.',
    ),

    h('Seeing it in a real database'),
    p(
      'The conceptual schema is not an abstraction the vendor invented for textbooks — you can query it. Every database exposes its own logical design as tables:',
    ),
    code(
      sql(`
-- The conceptual schema, as data.
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'company'
ORDER BY table_name, ordinal_position;
`),
    ),

    h('Interview'),
    asked([
      [
        'What are the three levels?',
        'External (per-user views), conceptual (the whole logical design), internal (physical storage).',
      ],
      [
        'How many of each does a database have?',
        'One internal, one conceptual, many external.',
      ],
      [
        'What is physical data independence?',
        'Changing how data is stored without changing the logical schema or any query.',
      ],
      [
        'What is logical data independence?',
        'Changing the logical schema without changing the external views or the applications.',
      ],
      ['Which is harder, and why?', 'Logical — applications name the very objects being changed; a physical change is invisible to SQL by construction.'],
      [
        'What implements an external schema in practice?',
        'A view — and permissions granted on the view rather than the table.',
      ],
      ['Why does the architecture exist at all?', 'To buy data independence. The three levels are the mechanism, not the goal.'],
    ]),

    h('Cheatsheet'),
    cheat([
      ['Show one team a subset of the data', 'An external schema — a `VIEW`, with grants on it'],
      ['Describe every table in the database', 'The conceptual schema — your DDL'],
      ['Speed a query up without touching it', 'An internal change — an index. Physical independence is why it works'],
      ['Add a column without breaking readers', 'Logical independence — and never `SELECT *` in application code'],
    ]),

    links(
      wiki('Three-schema_approach', 'Three-schema approach'),
      wiki('Data_independence', 'Data independence'),
    ),
  ],
};
