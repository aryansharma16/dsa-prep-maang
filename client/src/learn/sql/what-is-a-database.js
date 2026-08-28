import { asked, cheat, code, h, links, mysqlDoc, note, p, sql, table, ul, wiki } from '../blocks.js';

/*
  The topic that assumes nothing at all.

  It is first because the three words in its title get used interchangeably in
  every conversation about this subject, including by people who are about to
  interview you, and a reader who cannot separate them is going to find the ER
  model confusing for a reason that has nothing to do with the ER model.
*/
export const doc = {
  blocks: [
    p(
      'A **database** is a collection of related data, stored so that it can be found again. A **DBMS** — a database management system — is the software that stores it and answers questions about it. **MySQL, PostgreSQL, Oracle and SQL Server are DBMSs**; the thing your company keeps its customers in is a database. People say "the database is down" when they mean the DBMS, and that is fine in conversation and wrong in an interview.',
    ),
    p(
      'The distinction is worth thirty seconds because everything else in this track is a property of the *management system*, not of the data. Transactions, indexes, constraints, concurrent access, recovery after a power cut — none of those are things data does. They are things the software around it does on your behalf.',
    ),

    h('The three words, apart'),
    table(
      ['term', 'what it is', 'example'],
      [
        [
          '**Data**',
          'Raw facts, with no meaning attached yet.',
          '`95000`, `Ada`, `2019-03-04`',
        ],
        [
          '**Information**',
          'Data with context, so it answers something.',
          '"Ada earns 95,000 and joined in March 2019."',
        ],
        [
          '**Database**',
          'Related data, organised so it can be found and changed.',
          'The `employees` and `departments` tables',
        ],
        [
          '**DBMS**',
          'The software that owns the database and mediates every access to it.',
          'MySQL, PostgreSQL, SQLite, Oracle',
        ],
        [
          '**Database system**',
          'The DBMS plus the database plus the applications talking to it.',
          'Your API, its connection pool, and Postgres behind it',
        ],
      ],
    ),

    h('What a DBMS is actually doing for you'),
    p(
      'A file can store data. What it cannot do is any of this, and each line below is a whole topic later in the track:',
    ),
    ul(
      '**Answer questions you did not anticipate.** `SELECT` is a general query language, so "who earns more than their manager" needs no new code in the storage layer.',
      '**Keep the data true.** A `FOREIGN KEY` means a row cannot point at a department that does not exist — the database refuses the write rather than trusting every application that ever connects to it.',
      "**Let many people write at once** without one of them losing the other's change — a whole section of this track, further down.",
      '**Survive being killed.** A committed change is on disk before you are told it committed, so pulling the plug loses nothing that was acknowledged.',
      '**Find a row without reading them all.** An index turns a million-row scan into about twenty comparisons.',
      '**Control who sees what**, down to the column.',
    ),

    h('Relational, and what that word means'),
    p(
      'Almost every database in an interview is a **relational** one: the data lives in tables, a table is a set of rows, and rows in different tables are connected by *values* rather than by pointers. `employees.dept_id` holds `1`, and `1` is the `id` of a row in `departments`. Nothing is stored about where that row physically is — the connection is made at query time by matching values, which is exactly what a join does.',
    ),
    note(
      'That is why it is called relational, and it is *not* because tables relate to each other. A **relation** is the mathematical name for a table — a set of tuples. The word comes from the theory, and an interviewer asking "why is it called the relational model" is usually checking whether you know that.',
    ),

    h('The smallest complete example'),
    p(
      'A table is created, a row is put in it, and a question is asked. Those three statements are DDL, DML and DQL respectively, and the rest of this track is largely detail on them.',
    ),
    code(
      sql(`
CREATE TABLE departments (
  id       INT PRIMARY KEY,
  name     VARCHAR(50) NOT NULL,
  location VARCHAR(50)
);

INSERT INTO departments (id, name, location)
VALUES (1, 'Engineering', 'Bengaluru');

SELECT name FROM departments WHERE location = 'Bengaluru';
`),
    ),

    h('Where SQL and NoSQL part company'),
    p(
      'A relational database makes you declare the shape of your data up front and then guarantees it. A document database (MongoDB), a key-value store (Redis) or a wide-column store (Cassandra) relaxes that in exchange for something else — usually easier horizontal scaling or a shape that fits an object better.',
    ),
    table(
      ['', 'Relational', 'Document / NoSQL'],
      [
        ['Shape', 'Declared up front, enforced by the DBMS', 'Per document, enforced by your code'],
        ['Language', 'SQL, standardised across vendors', "Each product's own API"],
        ['Joins', 'First class', 'Usually absent or discouraged'],
        ['Transactions', 'Across many rows and tables, by default', 'Often limited to one document'],
        ['Scaling out', 'Harder — one primary, read replicas, then sharding', 'Designed for it'],
        ['Reach for it when', 'The data has relationships you will query across', 'The shape varies, or scale beats consistency'],
      ],
    ),
    p(
      'The honest summary is that "SQL vs NoSQL" is a bad framing of "do I want the database to enforce my invariants, or do I want to". Most systems that regretted the choice regretted it in that direction.',
    ),

    h('Interview'),
    asked([
      [
        'What is a database?',
        'An organised collection of related data, stored so it can be queried and changed.',
      ],
      [
        'What is a DBMS?',
        'The software that manages a database — storage, querying, integrity, concurrency and recovery.',
      ],
      [
        'Difference between data and information?',
        'Data is raw facts; information is data in a context that makes it answer something.',
      ],
      [
        'Why is it called the *relational* model?',
        'Because a table is formally a relation — a set of tuples. Not because tables relate to each other.',
      ],
      [
        'Name four things a DBMS gives you over files.',
        'Ad-hoc querying, enforced integrity, concurrent access, and crash recovery.',
      ],
      [
        'SQL or NoSQL?',
        'SQL when the data has relationships and invariants worth enforcing; NoSQL when the shape varies or you need to scale writes horizontally.',
      ],
    ]),

    h('Cheatsheet'),
    cheat([
      ['Store related data with enforced rules', 'A relational DBMS'],
      ['Ask a question nobody designed for', '`SELECT` — that is the whole point of a query language'],
      ['Guarantee a reference is real', 'A `FOREIGN KEY`, not a check in your application'],
      ['Change several rows all-or-nothing', 'A transaction'],
    ]),

    links(
      wiki('Database', 'Database'),
      wiki('Relational_model', 'Relational model'),
      mysqlDoc('what-is-mysql.html', 'What is MySQL?'),
    ),
  ],
};
