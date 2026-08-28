import { asked, cheat, code, h, links, note, p, sql, table, tip, ul, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'A **relationship** is an association between entities — `Employee` **works in** `Department`. Drawn as a diamond. Two questions decide how it becomes tables, and getting either wrong is the most expensive mistake in schema design because fixing it later means moving data rather than adding a column.',
    ),
    ul(
      '**Cardinality** — *how many* of one side can pair with the other. 1:1, 1:N, M:N.',
      '**Participation** — whether taking part is optional or compulsory. Partial or total.',
    ),

    h('Cardinality, the three cases'),
    table(
      ['ratio', 'reads as', 'example', 'becomes'],
      [
        [
          '**1:1**',
          'Each side has at most one of the other.',
          'An employee heads at most one department; a department has one head.',
          'A foreign key on **either** side, `UNIQUE`. Put it on the side with total participation.',
        ],
        [
          '**1:N**',
          'One of A relates to many of B; each B to one A.',
          'A department has many employees; an employee is in one department.',
          'A foreign key on the **many** side. No new table.',
        ],
        [
          '**M:N**',
          'Many of each side to many of the other.',
          'An employee works on many projects; a project has many employees.',
          'A **junction table**, always. There is no other option.',
        ],
      ],
    ),
    note(
      'The rule that covers all three: **the foreign key goes on the "many" side.** In 1:N there is one many-side, so it goes there. In 1:1 there is no many-side, so you choose. In M:N *both* are the many-side, which is precisely why neither table can hold it and a third one has to exist.',
    ),

    h('1:N — the ordinary case'),
    code(
      sql(`
-- The FK is on employees, the many side. One column, no extra table.
CREATE TABLE employees (
  id      INT PRIMARY KEY,
  name    VARCHAR(50) NOT NULL,
  dept_id INT,                                       -- NULL = partial participation
  FOREIGN KEY (dept_id) REFERENCES departments(id)
);
`),
    ),
    p(
      'Putting it the other way round — a `employee_ids` column on `departments` holding a list — is the single most common beginner design, and it breaks 1NF, cannot be indexed, cannot be joined and cannot be constrained by a foreign key. There is never a reason for it.',
    ),

    h('M:N — the junction table'),
    p(
      'Neither side can hold the key, so a third table holds both. Its primary key is the pair, which is what stops the same employee being added to the same project twice:',
    ),
    code(
      sql(`
CREATE TABLE employee_projects (
  employee_id INT NOT NULL,
  project_id  INT NOT NULL,
  role        VARCHAR(30),                  -- an attribute *of the relationship*
  assigned_on DATE NOT NULL,
  PRIMARY KEY (employee_id, project_id),    -- the pair is unique
  FOREIGN KEY (employee_id) REFERENCES employees(id),
  FOREIGN KEY (project_id)  REFERENCES projects(id)
);
`),
    ),
    tip(
      '`role` and `assigned_on` are the reason this is called a *relationship* and not just a link. They are facts about the pairing that belong to neither table — an employee does not have a role, and a project does not have an assignment date; the *assignment* has both. Any time you find yourself wanting to store something like that, you have found an M:N relationship whether you had drawn one or not.',
    ),

    h('1:1 — and where to put the key'),
    p(
      'Genuinely rare, and usually a sign that the two entities are one entity split for a reason. Legitimate reasons exist: a rarely-read blob, a column set with different access permissions, or an optional extension.',
    ),
    code(
      sql(`
-- Head of department: 1:1. The FK sits on the side that must have one.
ALTER TABLE departments
  ADD COLUMN head_id INT UNIQUE,                     -- UNIQUE is what makes it 1:1
  ADD FOREIGN KEY (head_id) REFERENCES employees(id);
`),
    ),
    warn(
      'Drop the `UNIQUE` and you have silently built a 1:N. It is the only thing distinguishing the two designs at the SQL level, and it is one word.',
    ),

    h('Participation'),
    p('Whether an instance is *obliged* to take part. Drawn as a double line for total, single for partial.'),
    table(
      ['', 'means', 'in the diagram', 'in SQL'],
      [
        [
          '**Partial**',
          'An instance may exist without taking part.',
          'Single line',
          'The foreign key column is `NULL`-able.',
        ],
        [
          '**Total**',
          'Every instance must take part. Also called *existence dependency*.',
          'Double line',
          'The foreign key column is `NOT NULL`.',
        ],
      ],
    ),
    p(
      'In the track\'s sample data, Radia has `dept_id` set to `NULL`. That single fact is the whole of "employees have **partial** participation in `WORKS_IN`" — an employee is allowed to exist without a department. Make it total and she cannot be inserted:',
    ),
    code(
      sql(`
-- Total participation: every employee must be in a department.
ALTER TABLE employees MODIFY dept_id INT NOT NULL;
`),
    ),
    note(
      'Participation is asked about far less often than cardinality and is the half that actually shows up in your data as bugs. "Why does this LEFT JOIN return NULLs" is almost always "because that side is partial and nobody said so".',
    ),

    h('Degree'),
    p('How many entity types the relationship connects. Occasionally asked, cheap to know:'),
    ul(
      '**Unary / recursive** (degree 1) — an entity related to itself. `manager_id` on `employees`: an employee manages employees. This is what a self join queries.',
      '**Binary** (degree 2) — two entities. Almost everything.',
      '**Ternary** (degree 3) — three at once, where the fact genuinely needs all three: a *supplier* supplies a *part* to a *project*. It becomes a junction table with three foreign keys. Splitting it into three binary relationships loses information, and knowing why is a good answer.',
    ),

    h('Reading it back off our tables'),
    p('The sample schema encodes three relationships, all in foreign keys:'),
    table(
      ['relationship', 'degree', 'cardinality', 'participation', 'how it is stored'],
      [
        [
          'Employee **works in** Department',
          'Binary',
          '1:N',
          'Partial on both sides — Radia has no department, Legal has no employees',
          '`employees.dept_id`, nullable',
        ],
        [
          'Employee **manages** Employee',
          'Unary',
          '1:N',
          'Partial — Ada has no manager',
          '`employees.manager_id`, nullable, pointing at the same table',
        ],
      ],
    ),

    h('Interview'),
    asked([
      [
        'What are the three cardinalities?',
        '1:1, 1:N and M:N.',
      ],
      [
        'Where does the foreign key go?',
        'On the many side. In 1:1 you choose — put it on the side with total participation.',
      ],
      [
        'How do you implement M:N?',
        'A junction table whose primary key is the pair of foreign keys.',
      ],
      [
        'Why can M:N not be a column?',
        'Neither side is the "one" side, so neither table can hold a single value — and a list in a column breaks 1NF.',
      ],
      [
        'Total vs partial participation?',
        'Total means every instance must take part — a `NOT NULL` foreign key. Partial means it may not — nullable.',
      ],
      [
        'What is a recursive relationship?',
        'An entity related to itself, like `manager_id` on `employees`. Queried with a self join.',
      ],
      [
        'What distinguishes 1:1 from 1:N in SQL?',
        'A `UNIQUE` constraint on the foreign key column. Nothing else.',
      ],
      [
        'What is a ternary relationship?',
        'One needing three entities at once; it becomes a junction table with three FKs, and splitting it into binaries loses information.',
      ],
    ]),

    h('Cheatsheet'),
    cheat([
      ['One department, many employees', 'FK on `employees`'],
      ['Many employees, many projects', 'A junction table, PK on the pair'],
      ['Store *when* someone joined a project', 'A column on the junction table'],
      ['Exactly one head per department', 'FK plus `UNIQUE`'],
      ['Every employee must have a department', '`NOT NULL` on the FK — total participation'],
      ['An employee’s manager', 'A nullable FK to the same table'],
    ]),

    links(
      wiki('Cardinality_(data_modeling)', 'Cardinality'),
      wiki('Associative_entity', 'Associative entity (junction table)'),
    ),
  ],
};
