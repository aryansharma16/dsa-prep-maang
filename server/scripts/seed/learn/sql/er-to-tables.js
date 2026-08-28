import { asked, cheat, code, h, links, note, p, sql, table, tip, ul, warn, wiki } from '../blocks.js';

/*
  The most mechanical topic in the section, and deliberately written as a
  procedure: seven rules, applied in order, to one diagram. It is asked as
  "convert this ER diagram" and the answer is a checklist, so this is a
  checklist.
*/
export const doc = {
  blocks: [
    p(
      'Converting an ER diagram to tables is **mechanical**. Seven rules, applied in order, and the result is a schema already in 3NF if the diagram was sensible. This is asked directly — "here is a diagram, give me the tables" — and it is one of the few interview questions with a single correct procedure.',
    ),

    h('The diagram we will convert'),
    p('A small company schema, with one of each thing worth converting:'),
    ul(
      '**Employee** (strong) — `emp_id` (key), `name`, `address` (composite: street, city, pincode), `skills` (multivalued), `dob`, `age` (derived).',
      '**Department** (strong) — `dept_id` (key), `name`, `location`.',
      '**Project** (strong) — `proj_id` (key), `title`, `budget`.',
      '**Dependant** (weak, owned by Employee) — `seq` (partial key), `name`, `relation`.',
      '**WORKS_IN** — Employee to Department, 1:N, employee side total.',
      '**HEADS** — Employee to Department, 1:1, department side total.',
      '**WORKS_ON** — Employee to Project, M:N, with `hours` on the relationship.',
      '**MANAGES** — Employee to Employee, 1:N recursive, partial.',
    ),

    h('Rule 1 · Every strong entity becomes a table'),
    p(
      'Its simple attributes become columns; its key attribute becomes the primary key. Nothing clever happens here.',
    ),
    code(
      sql(`
CREATE TABLE departments (
  dept_id  INT PRIMARY KEY,
  name     VARCHAR(50) NOT NULL UNIQUE,
  location VARCHAR(50)
);

CREATE TABLE projects (
  proj_id INT PRIMARY KEY,
  title   VARCHAR(100) NOT NULL,
  budget  DECIMAL(12,2)
);
`),
    ),

    h('Rule 2 · Composite attributes flatten; derived ones vanish'),
    p(
      'A composite attribute becomes **one column per leaf** — never one column holding the whole thing. A derived attribute becomes **no column**: store what it is derived from and compute it on the way out.',
    ),
    code(
      sql(`
CREATE TABLE employees (
  emp_id   INT PRIMARY KEY,
  name     VARCHAR(50) NOT NULL,
  street   VARCHAR(100),          -- address, flattened
  city     VARCHAR(50),           --   "
  pincode  CHAR(6),               --   "
  dob      DATE NOT NULL
  -- age is derived: TIMESTAMPDIFF(YEAR, dob, CURDATE()). No column.
);
`),
    ),
    tip(
      'Flatten rather than concatenate because the parts are what you filter and group by. `WHERE city = \'Pune\'` can use an index; `WHERE address LIKE \'%Pune%\'` cannot, and will also match a street called Pune Road.',
    ),

    h('Rule 3 · Every multivalued attribute becomes its own table'),
    p(
      'One row per value, keyed on the owner plus the value. This is the rule people skip, and skipping it is how a comma-separated `skills` column gets into a schema.',
    ),
    code(
      sql(`
CREATE TABLE employee_skills (
  emp_id INT NOT NULL,
  skill  VARCHAR(40) NOT NULL,
  PRIMARY KEY (emp_id, skill),          -- no duplicate skills per person
  FOREIGN KEY (emp_id) REFERENCES employees(emp_id) ON DELETE CASCADE
);
`),
    ),
    warn(
      "`skills VARCHAR(255)` holding `'sql,python,go'` is the alternative, and it fails at everything: you cannot index a skill, cannot join on one, cannot constrain the values, and `LIKE '%go%'` matches `mongodb`. It is the canonical 1NF violation.",
    ),

    h('Rule 4 · Weak entities take the owner’s key into their own'),
    p(
      'The primary key is **owner key + partial key**, and the foreign key cascades — the whole meaning of "weak" is that it cannot outlive its owner.',
    ),
    code(
      sql(`
CREATE TABLE dependants (
  emp_id   INT NOT NULL,
  seq      INT NOT NULL,
  name     VARCHAR(50) NOT NULL,
  relation VARCHAR(20),
  PRIMARY KEY (emp_id, seq),
  FOREIGN KEY (emp_id) REFERENCES employees(emp_id) ON DELETE CASCADE
);
`),
    ),

    h('Rule 5 · 1:N becomes a foreign key on the many side'),
    p(
      'No new table. Total participation on the many side means `NOT NULL`; partial means nullable. `MANAGES` is the same rule applied to one table twice — a recursive relationship is not a special case.',
    ),
    code(
      sql(`
ALTER TABLE employees
  ADD COLUMN dept_id INT NOT NULL,                 -- WORKS_IN, total → NOT NULL
  ADD COLUMN manager_id INT NULL,                  -- MANAGES, partial → nullable
  ADD FOREIGN KEY (dept_id)    REFERENCES departments(dept_id),
  ADD FOREIGN KEY (manager_id) REFERENCES employees(emp_id);
`),
    ),

    h('Rule 6 · 1:1 becomes a foreign key with UNIQUE'),
    p(
      'Put it on the side with **total** participation, so the column can be `NOT NULL` and you avoid a table full of NULLs. A department must have a head; an employee need not head anything — so the column goes on `departments`.',
    ),
    code(
      sql(`
ALTER TABLE departments
  ADD COLUMN head_id INT NOT NULL UNIQUE,          -- UNIQUE is what makes it 1:1
  ADD FOREIGN KEY (head_id) REFERENCES employees(emp_id);
`),
    ),
    note(
      'Had you put it on `employees` instead, five of six rows would carry `NULL` for `heads_dept_id`. Same information, more nulls, and the `NOT NULL` that expresses "every department has a head" becomes impossible to write.',
    ),

    h('Rule 7 · M:N becomes a junction table'),
    p(
      'The primary key is the pair. Attributes *of the relationship* — `hours` here — become columns on the junction table, because they belong to neither entity.',
    ),
    code(
      sql(`
CREATE TABLE works_on (
  emp_id  INT NOT NULL,
  proj_id INT NOT NULL,
  hours   DECIMAL(5,1) NOT NULL DEFAULT 0,
  PRIMARY KEY (emp_id, proj_id),
  FOREIGN KEY (emp_id)  REFERENCES employees(emp_id),
  FOREIGN KEY (proj_id) REFERENCES projects(proj_id)
);
`),
    ),

    h('The seven rules, on one card'),
    table(
      ['in the diagram', 'in the schema'],
      [
        ['Strong entity', 'A table; its key attribute is the PK'],
        ['Weak entity', 'A table; PK = owner PK + partial key; FK cascades'],
        ['Simple attribute', 'A column'],
        ['Composite attribute', 'One column per leaf'],
        ['Derived attribute', 'No column — compute it'],
        ['Multivalued attribute', 'Its own table, PK = (owner, value)'],
        ['1:1 relationship', 'FK + `UNIQUE`, on the total-participation side'],
        ['1:N relationship', 'FK on the many side'],
        ['M:N relationship', 'Junction table, PK = the pair'],
        ['Attribute on a relationship', 'A column on the junction table'],
        ['Ternary relationship', 'Junction table with three FKs'],
        ['Total participation', '`NOT NULL` on the FK'],
        ['Partial participation', 'Nullable FK'],
        ['ISA / specialisation', 'One of the three strategies below'],
      ],
    ),

    h('Specialisation — the one rule with three answers'),
    p(
      '`Employee` ISA `Contractor` / `Permanent`. Unlike the rest, this has no single right conversion, and naming the trade is the answer:',
    ),
    table(
      ['strategy', 'shape', 'good', 'bad'],
      [
        [
          '**Single table** (one table, a `type` column)',
          'Every subclass column in one wide table',
          'No joins; querying all employees is trivial',
          'Columns that must be `NULL` for the wrong type — the DBMS cannot enforce "contractors have a rate"',
        ],
        [
          '**Table per subclass**',
          '`contractors` and `permanents`, each complete',
          'No nulls, each table constrained properly',
          '"All employees" is a `UNION`; shared attributes are duplicated',
        ],
        [
          '**Table per type** (class table inheritance)',
          '`employees` + `contractors(emp_id, rate)` + `permanents(emp_id, notice_period)`',
          'No nulls, no duplication, shared columns in one place',
          'Every subclass read is a join; nothing stops a row being in both children',
        ],
      ],
    ),

    h('Interview'),
    asked([
      ['How do you convert a multivalued attribute?', 'Its own table, one row per value, keyed on owner plus value.'],
      ['How do you convert a weak entity?', 'A table whose PK is the owner’s PK plus the partial key, with a cascading FK.'],
      ['Where does the FK go in 1:N?', 'On the many side.'],
      ['How do you convert M:N?', 'A junction table with a composite PK of both FKs.'],
      ['Where do relationship attributes go?', 'On the junction table for M:N; on the many side for 1:N.'],
      ['How do you convert 1:1?', 'FK plus UNIQUE, placed on the side with total participation.'],
      ['How is total participation expressed?', '`NOT NULL` on the foreign key.'],
      ['How do you convert a derived attribute?', 'You do not store it — you compute it from what you did store.'],
      [
        'Three ways to convert an ISA hierarchy?',
        'Single table with a type column, table per subclass, or table per type — trading joins against nullable columns.',
      ],
    ]),

    h('Cheatsheet'),
    cheat([
      ['A person has many phone numbers', 'A table, `PRIMARY KEY (person_id, phone)`'],
      ['An order has many lines', 'A weak entity — `PRIMARY KEY (order_id, line_no)`'],
      ['A student takes many courses', 'A junction table'],
      ['Store the grade for that enrolment', 'A column on the junction table'],
      ['A department must have a head', 'FK `NOT NULL UNIQUE` on `departments`'],
      ['An employee may have a manager', 'A nullable self-referencing FK'],
    ]),

    links(
      wiki('Entity–relationship_model#Relationships', 'ER relationships'),
      wiki('Associative_entity', 'Junction tables'),
    ),
  ],
};
