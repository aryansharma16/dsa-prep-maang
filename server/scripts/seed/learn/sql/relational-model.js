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
import { departments, employees } from './sample-data.js';

export const doc = {
  blocks: [
    p(
      'The relational model is a table with a mathematical vocabulary bolted on, and the vocabulary is the only reason this topic exists: an interview question about the relational model is a question about **words**. "What is the degree of this relation" is asking how many columns it has, and the person asking wants to hear the word "degree" come back.',
    ),

    h('The vocabulary, against a real table'),
    employees(),
    table(
      ['formal', 'informal', 'in the table above'],
      [
        ['**Relation**', 'Table', '`employees`'],
        ['**Tuple**', 'Row', "`(1, 'Ada', 1, 95000, NULL, '2019-03-04')`"],
        ['**Attribute**', 'Column', '`salary`'],
        ['**Domain**', 'The set of values an attribute may take', '`DECIMAL(10,2)`, non-negative'],
        ['**Degree** / arity', 'Number of columns', '**6**'],
        ['**Cardinality**', 'Number of rows', '**6**'],
        ['**Relation schema**', 'The definition — name and columns', '`employees(id, name, dept_id, salary, manager_id, hired_on)`'],
        ['**Relation instance**', 'The rows in it right now', 'Those six people'],
        ['**Database schema**', 'Every relation schema together', '`employees` + `departments`'],
      ],
    ),
    note(
      'Degree and cardinality both being 6 here is a coincidence of the sample data. Degree is about the *schema* and essentially never changes; cardinality is about the *instance* and changes on every insert. Interviewers like this pair because swapping them is a common slip.',
    ),

    h('The properties of a relation'),
    p(
      'Six rules a relation obeys, and each one is quietly violated by real SQL — which is worth knowing, because "SQL is not truly relational" is a real answer to a real question.',
    ),
    table(
      ['property', 'means', 'does SQL honour it?'],
      [
        [
          '**Atomic values**',
          'Every cell holds one indivisible value — no lists, no nested tables.',
          'By convention. Nothing stops a comma-separated column; 1NF is the rule against it.',
        ],
        [
          '**No duplicate tuples**',
          'A relation is a *set*, so two identical rows cannot both exist.',
          '**No.** A SQL table is a multiset — duplicates are allowed unless a key forbids them. This is the biggest gap.',
        ],
        [
          '**Rows are unordered**',
          'There is no "first row". Order is something you ask for.',
          'Yes — which is exactly why a query with no `ORDER BY` has no guaranteed order.',
        ],
        [
          '**Columns are unordered**',
          'An attribute is identified by name, not position.',
          'Mostly. `SELECT *` and `INSERT` without a column list both depend on position.',
        ],
        [
          '**Values come from a domain**',
          'Every value in a column is of that column’s type.',
          'Yes, via types and `CHECK` constraints.',
        ],
        [
          '**Each attribute has a distinct name**',
          'No two columns in one relation share a name.',
          'Yes within a table; a join result can carry two `name` columns, which is why you alias them.',
        ],
      ],
    ),
    tip(
      'That second row is the highest-value fact on this page. Because a table is a bag rather than a set, `SELECT dept_id FROM employees` returns duplicates and `SELECT DISTINCT dept_id` does not — and `UNION` deduplicates while `UNION ALL` does not. All of that is one design decision, made because deduplicating every result would be enormously expensive and usually unwanted.',
    ),

    h('The two integrity rules'),
    p('Codd named two rules that any relational database must enforce. They are asked by name.'),
    ul(
      '**Entity integrity** — no part of a primary key may be `NULL`. A row you cannot identify is a row that should not be there, and `NULL` means "unknown", so a `NULL` key says "this row is some row, we are not sure which".',
      '**Referential integrity** — a foreign key must either be `NULL` or match an existing primary key. It may never point at a row that is not there.',
    ),
    code(
      sql(`
-- Entity integrity: rejected, id is part of the primary key.
INSERT INTO employees (id, name, salary, hired_on)
VALUES (NULL, 'Nobody', 50000, '2024-01-01');
-- ERROR: Column 'id' cannot be null

-- Referential integrity: rejected, there is no department 9.
INSERT INTO employees (id, name, dept_id, salary, hired_on)
VALUES (7, 'Ghost', 9, 50000, '2024-01-01');
-- ERROR: Cannot add or update a child row: a foreign key constraint fails

-- Allowed: NULL means "no department yet", not "a department that does not exist".
INSERT INTO employees (id, name, dept_id, salary, hired_on)
VALUES (7, 'Radia', NULL, 78000, '2023-02-20');
`),
    ),
    departments(),
    warn(
      'A foreign key being nullable is not a loophole in referential integrity — it is the model distinguishing "points at nothing" from "points at something absent". The first is a fact about the world; the second is corruption.',
    ),

    h('Relational algebra — the six operators worth knowing'),
    p(
      'The formal language underneath SQL. You will rarely write it, and the optimiser reasons in it constantly: every rewrite it is allowed to make is a theorem about these operators.',
    ),
    table(
      ['operator', 'symbol', 'does', 'SQL'],
      [
        ['Selection', 'σ (sigma)', 'Picks **rows** matching a predicate', '`WHERE`'],
        ['Projection', 'π (pi)', 'Picks **columns**', 'the `SELECT` list'],
        ['Union', '∪', 'All tuples from either, deduplicated', '`UNION`'],
        ['Set difference', '−', 'In the first and not the second', '`EXCEPT`'],
        ['Cartesian product', '×', 'Every row against every row', '`CROSS JOIN`'],
        ['Rename', 'ρ (rho)', 'Renames a relation or attribute', '`AS`'],
        ['Join', '⋈', 'Product then selection — derived, not primitive', '`JOIN … ON`'],
      ],
    ),
    note(
      'Selection takes rows and projection takes columns. They are swapped by candidates constantly, and the mnemonic that sticks: **pro**jection is about the **pro**perties — the columns.',
    ),
    p(
      'The last row is why the joins section of this track opens with a cross product: a join is *defined* as `σ (A × B)`, and that is not a teaching analogy, it is the definition.',
    ),

    h('Interview'),
    asked([
      ['What is a relation?', 'A table — formally, a set of tuples over a set of attributes.'],
      ['Degree vs cardinality?', 'Degree is the number of columns (a schema fact); cardinality is the number of rows (an instance fact).'],
      ['Schema vs instance?', 'The schema is the definition; the instance is the data in it at a moment.'],
      ['What is a domain?', 'The set of permitted values for an attribute — its type plus any constraints.'],
      ['State entity integrity.', 'No part of a primary key may be NULL.'],
      ['State referential integrity.', 'A foreign key must be NULL or match an existing primary key.'],
      [
        'Is a SQL table a relation?',
        'Not strictly — it is a multiset, so it allows duplicate rows, and column order is observable.',
      ],
      ['Selection vs projection?', 'Selection filters rows (`WHERE`); projection picks columns (the SELECT list).'],
      ['Why is result order not guaranteed?', 'A relation is unordered; order exists only when `ORDER BY` asks for it.'],
    ]),

    h('Cheatsheet'),
    cheat([
      ['Say how many columns a table has', '"Its degree is 6"'],
      ['Say how many rows', '"Its cardinality is 6"'],
      ['Guarantee no duplicate rows', 'A primary key or unique constraint — the table will not do it for you'],
      ['Guarantee a row is identifiable', 'Entity integrity — a non-null primary key'],
      ['Guarantee a reference is real', 'Referential integrity — a foreign key'],
      ['Get a predictable order', '`ORDER BY`, always. There is no default'],
    ]),

    links(
      wiki('Relational_model', 'Relational model'),
      wiki('Relational_algebra', 'Relational algebra'),
      wiki('Codd%27s_12_rules', "Codd's 12 rules"),
    ),
  ],
};
