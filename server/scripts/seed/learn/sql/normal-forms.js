import { asked, cheat, code, data, h, links, note, p, sql, table, tip, ul, warn, wiki } from '../blocks.js';

/*
  One table, carried through all three forms, with the anomaly each step fixes
  named before the step is taken. Written this way because the standard
  presentation — three definitions, three unrelated examples — is why people
  come out of it able to recite 2NF and unable to apply it.
*/
export const doc = {
  blocks: [
    p(
      '**Normalisation** is splitting tables so that every fact is stored in exactly one place. It is not an aesthetic exercise: a fact stored twice is a fact that can disagree with itself, and that is a class of bug no amount of careful application code can prevent.',
    ),
    p(
      'We will take one badly-designed table and carry it through 1NF, 2NF and 3NF, naming the specific thing that goes wrong before each step.',
    ),

    h('The table we are fixing'),
    data(
      'enrolments — every mistake at once',
      ['student_id', 'student_name', 'phone', 'course_id', 'course_name', 'instructor', 'inst_email', 'grade'],
      [
        ['`1`', 'Ada', '`9001, 9002`', '`CS101`', 'Databases', 'Codd', 'codd@uni.edu', '`A`'],
        ['`1`', 'Ada', '`9001, 9002`', '`CS102`', 'Networks', 'Cerf', 'cerf@uni.edu', '`B`'],
        ['`2`', 'Grace', '`9003`', '`CS101`', 'Databases', 'Codd', 'codd@uni.edu', '`A`'],
        ['`3`', 'Linus', '`9004`', '`CS101`', 'Databases', 'Codd', 'codd@uni.edu', '`C`'],
      ],
    ),

    h('The three anomalies'),
    p('Every normal form exists to remove one of these. Name them in an interview before you name the forms:'),
    table(
      ['anomaly', 'what happens', 'in this table'],
      [
        [
          '**Insertion**',
          'You cannot record one fact without inventing another.',
          'A new course with no students yet cannot be added — `student_id` is part of the key and there is nobody to put in it.',
        ],
        [
          '**Update**',
          'One change has to be made in many rows, and might not be.',
          "Codd's email changes. Three rows to update. Miss one and the table holds two emails for one person.",
        ],
        [
          '**Deletion**',
          'Removing one fact destroys an unrelated one.',
          'Linus drops `CS101` and, if he were the last student, the fact that Codd teaches Databases goes with him.',
        ],
      ],
    ),

    h('1NF — atomic values, and no repeating groups'),
    p('A table is in **first normal form** when:'),
    ul(
      'Every cell holds a **single** value — no lists, no nested structures.',
      'There are no repeating groups of columns (`phone1`, `phone2`, `phone3`).',
      'Every row is unique, i.e. there is a key.',
    ),
    p(
      '`phone` holds `9001, 9002`. That breaks it. And the damage is concrete rather than theoretical: you cannot index a phone number, cannot join on one, cannot constrain the format, and `LIKE \'%9001%\'` will happily match `19001`.',
    ),
    p('The fix is never more columns. It is another table:'),
    code(
      sql(`
CREATE TABLE student_phones (
  student_id INT NOT NULL,
  phone      VARCHAR(15) NOT NULL,
  PRIMARY KEY (student_id, phone)
);
`),
    ),
    data(
      'enrolments — now in 1NF',
      ['student_id', 'student_name', 'course_id', 'course_name', 'instructor', 'inst_email', 'grade'],
      [
        ['`1`', 'Ada', '`CS101`', 'Databases', 'Codd', 'codd@uni.edu', '`A`'],
        ['`1`', 'Ada', '`CS102`', 'Networks', 'Cerf', 'cerf@uni.edu', '`B`'],
        ['`2`', 'Grace', '`CS101`', 'Databases', 'Codd', 'codd@uni.edu', '`A`'],
        ['`3`', 'Linus', '`CS101`', 'Databases', 'Codd', 'codd@uni.edu', '`C`'],
      ],
    ),
    warn(
      'Splitting the list into `phone1, phone2, phone3` is the tempting alternative and it is *also* not 1NF — that is the "repeating group" clause. It caps the count arbitrarily, wastes columns for everyone with one phone, and turns "find the student with this number" into a search across three columns.',
    ),

    h('2NF — no partial dependencies'),
    p(
      'In **second normal form** when it is in 1NF **and** every non-key attribute depends on the *whole* key, not part of it.',
    ),
    note(
      '2NF is only ever an issue when the primary key is **composite**. With a single-column key there is no "part of the key" to depend on, so a 1NF table with a simple key is automatically in 2NF. That is a free mark in an interview.',
    ),
    p('Our key is `{student_id, course_id}`. Look at what depends on what:'),
    table(
      ['attribute', 'actually determined by', 'verdict'],
      [
        ['`student_name`', '`student_id`', '**Partial** — half the key'],
        ['`course_name`', '`course_id`', '**Partial**'],
        ['`instructor`', '`course_id`', '**Partial**'],
        ['`inst_email`', '`instructor`', 'Not even key-related — 3NF’s problem, below'],
        ['`grade`', '`{student_id, course_id}`', 'Full. This one is fine.'],
      ],
    ),
    p('Split each partial dependency out to sit beside its own determinant. Three tables:'),
    code(
      sql(`
CREATE TABLE students (
  student_id   INT PRIMARY KEY,
  student_name VARCHAR(50) NOT NULL
);

CREATE TABLE courses (
  course_id   VARCHAR(10) PRIMARY KEY,
  course_name VARCHAR(50) NOT NULL,
  instructor  VARCHAR(50) NOT NULL,
  inst_email  VARCHAR(100) NOT NULL      -- still wrong; 3NF deals with it
);

CREATE TABLE enrolments (
  student_id INT NOT NULL,
  course_id  VARCHAR(10) NOT NULL,
  grade      CHAR(1),
  PRIMARY KEY (student_id, course_id),
  FOREIGN KEY (student_id) REFERENCES students(student_id),
  FOREIGN KEY (course_id)  REFERENCES courses(course_id)
);
`),
    ),
    p(
      'The insertion anomaly is already gone: a course with no students is now just a row in `courses`.',
    ),

    h('3NF — no transitive dependencies'),
    p(
      'In **third normal form** when it is in 2NF **and** no non-key attribute depends on another non-key attribute.',
    ),
    p('In `courses`, the key is `course_id`. But:'),
    ul('`course_id → instructor`', '`instructor → inst_email`', 'So `course_id → inst_email` **transitively**, through a non-key attribute.'),
    p(
      "The consequence is the update anomaly we started with. Codd teaches three courses; his email is stored three times; changing it means three updates. Split again:",
    ),
    code(
      sql(`
CREATE TABLE instructors (
  instructor VARCHAR(50) PRIMARY KEY,
  inst_email VARCHAR(100) NOT NULL
);

CREATE TABLE courses (
  course_id   VARCHAR(10) PRIMARY KEY,
  course_name VARCHAR(50) NOT NULL,
  instructor  VARCHAR(50) NOT NULL,
  FOREIGN KEY (instructor) REFERENCES instructors(instructor)
);
`),
    ),
    p('Four tables, and every fact appears exactly once:'),
    data('students', ['student_id', 'student_name'], [['`1`', 'Ada'], ['`2`', 'Grace'], ['`3`', 'Linus']]),
    data(
      'instructors',
      ['instructor', 'inst_email'],
      [['Codd', 'codd@uni.edu'], ['Cerf', 'cerf@uni.edu']],
    ),
    data(
      'courses',
      ['course_id', 'course_name', 'instructor'],
      [['`CS101`', 'Databases', 'Codd'], ['`CS102`', 'Networks', 'Cerf']],
    ),
    data(
      'enrolments',
      ['student_id', 'course_id', 'grade'],
      [
        ['`1`', '`CS101`', '`A`'],
        ['`1`', '`CS102`', '`B`'],
        ['`2`', '`CS101`', '`A`'],
        ['`3`', '`CS101`', '`C`'],
      ],
    ),
    p(
      "Codd's email is in one cell. All three anomalies are gone, and the price is that answering \"who teaches Ada\" now needs a join — which is the trade normalisation always makes, and the one the whole argument is about.",
    ),

    h('The one-line summary'),
    p(
      'The mnemonic, and it is genuinely the definition: **every non-key attribute must depend on the key, the whole key, and nothing but the key.**',
    ),
    table(
      ['form', 'requires', 'removes', 'the phrase'],
      [
        ['**1NF**', 'Atomic values, no repeating groups', 'Lists in cells', '—'],
        ['**2NF**', '1NF + no partial dependency', 'Dependence on part of a composite key', '"the **whole** key"'],
        ['**3NF**', '2NF + no transitive dependency', 'Dependence on a non-key attribute', '"**nothing but** the key"'],
        ['**BCNF**', 'Every determinant is a super key', "3NF's remaining edge case", 'the next topic'],
      ],
    ),
    tip(
      'The first phrase — "depend on the key" — is 1NF, in the sense that it presumes a key exists at all. The sentence is attributed to Bill Kent, and finishing it with "so help me Codd" is a joke old enough that an interviewer will either laugh or not have heard it.',
    ),

    h('How far to go'),
    p(
      '**3NF is the working answer.** It removes every anomaly that actually bites, and almost every well-designed OLTP schema is in 3NF or BCNF without anyone having consciously normalised it — because putting each entity in its own table gets you there by accident.',
    ),
    warn(
      'The interview follow-up is "is more normalisation always better", and the answer is no. Each step adds a join. A reporting table read a thousand times a second and written once a day is a reasonable place to store a redundant column on purpose — see the denormalisation topic. What is *not* reasonable is arriving at that by accident.',
    ),

    h('Interview'),
    asked([
      ['What is normalisation?', 'Splitting tables so each fact is stored once, removing insert, update and delete anomalies.'],
      ['Name the three anomalies.', 'Insertion, update and deletion.'],
      ['What is 1NF?', 'Atomic values, no repeating groups, and a key.'],
      ['What is 2NF?', '1NF plus no non-key attribute depending on only part of a composite key.'],
      ['When is 2NF automatic?', 'When the primary key is a single column — there is no partial key to depend on.'],
      ['What is 3NF?', '2NF plus no non-key attribute depending on another non-key attribute.'],
      ['Give the one-line rule.', 'Every non-key attribute depends on the key, the whole key, and nothing but the key.'],
      ['Which form is enough in practice?', '3NF, or BCNF. Beyond that is rarely worth the joins.'],
      ['What does normalisation cost?', 'Joins — more tables to read for the same answer.'],
      ['Is a comma-separated column ever acceptable?', 'Only if you never filter, join or constrain on its contents — which in practice means almost never.'],
    ]),

    h('Cheatsheet'),
    cheat([
      ['A cell holds a list', 'Not 1NF → its own table'],
      ['`phone1, phone2, phone3`', 'Not 1NF → its own table'],
      ['A composite key, and a column depending on half of it', 'Not 2NF → split out that half'],
      ['A non-key column determined by another non-key column', 'Not 3NF → split the determinant out'],
      ['The same text repeated down a column', 'Almost always a missing table'],
      ['A single-column primary key and atomic values', 'Already 2NF; check only for transitive dependencies'],
    ]),

    links(
      wiki('Database_normalization', 'Database normalization'),
      wiki('Third_normal_form', 'Third normal form'),
    ),
  ],
};
