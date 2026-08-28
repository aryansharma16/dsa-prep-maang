/**
 * The SQL track's table of contents.
 *
 * Metadata only, like the other three — every topic's body is its own module
 * behind `load`, and this file ships with the track page so the list and the
 * filter cost one small chunk.
 *
 * ---------------------------------------------------------------------------
 * Why this track exists when the Node track already has a PostgreSQL section.
 *
 * Those six topics are *Postgres from Node*: the pool, parameterised queries,
 * Prisma, the N+1. They are written for someone building an API, and they assume
 * you already know what a join is. This one is written for someone sitting in an
 * interview being asked to define BCNF, draw an ER diagram, and say what happens
 * to a second transaction when the first one has not committed yet. Different
 * reader, different question, so a different track rather than six more files in
 * a Node folder.
 * ---------------------------------------------------------------------------
 *
 * Section order is reading order, and it is an argument. Theory first — what a
 * database is, how one is designed, how it is normalised — because SQL is a
 * language for talking about relations and the sentences do not mean much until
 * you know what a relation is. Then the language, in the order the clauses run.
 * Then joins as their own section, because that is where people actually stall,
 * on the same two tables every time so a reader comparing INNER to LEFT is
 * comparing two results and not two datasets. Then the things a senior query
 * has that a junior one does not, the objects around the tables, and finally
 * transactions — the section interviews dig into hardest — and performance.
 *
 * Dialect: MySQL first, because it is what LeetCode grades and what interview
 * questions assume. Where a difference is real the topic carries a second tab
 * rather than a paragraph about it.
 */

export const title = 'SQL';

export const summary =
  'Databases from the ground up: what a DBMS is and why it beat files, designing a schema with ER diagrams and keys, normalising it to BCNF, then every SQL clause — with two sample tables and the result grid under each query — joins, subqueries, CTEs and window functions, transactions and isolation levels step by step, indexes, query plans, and the questions all of it gets asked as.';

export const sections = [
  {
    key: 'foundations',
    title: 'Foundations',
    blurb:
      'What a database actually is, and why nobody keeps a company in a folder of spreadsheets any more.',
    topics: [
      {
        slug: 'what-is-a-database',
        title: 'What a database is',
        summary:
          'Data, database, DBMS — three words people use interchangeably, and the difference between them.',
        tags: ['basics', 'dbms', 'vocabulary'],
        ask: [
          'Explain the difference between data, a database and a DBMS in plain words.',
          'Why do we need a DBMS at all instead of just files?',
        ],
        load: () => import('./what-is-a-database.js'),
      },
      {
        slug: 'dbms-vs-file-system',
        title: 'DBMS vs a file system',
        summary:
          'Redundancy, inconsistency, concurrent writes and no crash recovery — the five problems that ended the flat file.',
        tags: ['basics', 'dbms', 'interview'],
        ask: [
          'What problems does a DBMS solve that a file system does not?',
          'What is data redundancy and why does it cause inconsistency?',
        ],
        load: () => import('./dbms-vs-file-system.js'),
      },
      {
        slug: 'three-schema-architecture',
        title: 'The three-schema architecture',
        summary:
          'Physical, logical and view level — and the data independence the split was invented to buy.',
        tags: ['architecture', 'theory', 'interview'],
        ask: [
          'Explain the three-schema architecture with an example.',
          'What is the difference between physical and logical data independence?',
        ],
        load: () => import('./three-schema-architecture.js'),
      },
      {
        slug: 'data-models',
        title: 'Data models',
        summary:
          'Hierarchical, network, relational, object — what each one got wrong, and why the relational model won.',
        tags: ['theory', 'history', 'relational'],
        ask: [
          'Why did the relational model replace the hierarchical and network models?',
          'What is a data model, and which ones matter today?',
        ],
        load: () => import('./data-models.js'),
      },
    ],
  },

  {
    key: 'designing',
    title: 'Designing it',
    blurb: 'From a sentence about the business to a set of tables that can hold it.',
    topics: [
      {
        slug: 'er-model',
        title: 'The ER model',
        summary:
          'Entities and attributes: strong and weak, simple and composite, stored and derived — the vocabulary of a schema before it is a schema.',
        tags: ['design', 'er', 'interview'],
        ask: [
          'What is the difference between an entity and an attribute?',
          'What is a weak entity and how is it identified?',
        ],
        load: () => import('./er-model.js'),
      },
      {
        slug: 'relationships-and-cardinality',
        title: 'Relationships and cardinality',
        summary:
          'One-to-one, one-to-many, many-to-many, and the difference between total and partial participation.',
        tags: ['design', 'er', 'interview'],
        ask: [
          'Explain one-to-many and many-to-many with a real example.',
          'What is the difference between total and partial participation?',
        ],
        load: () => import('./relationships-and-cardinality.js'),
      },
      {
        slug: 'er-to-tables',
        title: 'Turning an ER diagram into tables',
        summary:
          'The seven mapping rules, worked on one diagram — including the junction table every many-to-many needs.',
        tags: ['design', 'er', 'schema'],
        ask: [
          'How do you convert a many-to-many relationship into tables?',
          'Walk me through mapping an ER diagram to a relational schema.',
        ],
        load: () => import('./er-to-tables.js'),
      },
      {
        slug: 'relational-model',
        title: 'The relational model',
        summary:
          'Relation, tuple, attribute, domain, degree, cardinality — the words a theory question is asked in.',
        tags: ['theory', 'relational', 'interview'],
        ask: [
          'What is a relation, a tuple and a domain?',
          'What is the difference between a schema and an instance?',
        ],
        load: () => import('./relational-model.js'),
      },
      {
        slug: 'keys',
        title: 'Keys',
        summary:
          'Super, candidate, primary, alternate, composite, foreign and surrogate — seven names, and how they nest.',
        tags: ['keys', 'design', 'interview'],
        ask: [
          'What is the difference between a candidate key and a super key?',
          'Can a primary key be NULL? Can a foreign key?',
        ],
        load: () => import('./keys.js'),
      },
      {
        slug: 'constraints',
        title: 'Constraints',
        summary:
          'NOT NULL, UNIQUE, CHECK, DEFAULT and the referential actions — the rules the database enforces so your code does not have to.',
        tags: ['constraints', 'ddl', 'integrity'],
        ask: [
          'What is referential integrity and what does ON DELETE CASCADE do?',
          'What are the different types of integrity constraints?',
        ],
        load: () => import('./constraints.js'),
      },
    ],
  },

  {
    key: 'normalisation',
    title: 'Normalisation',
    blurb:
      'The anomalies that come from putting everything in one table, and the forms that remove them.',
    topics: [
      {
        slug: 'functional-dependencies',
        title: 'Functional dependencies',
        summary:
          'A → B, closure, and Armstrong’s axioms — the arithmetic every normal form is defined in terms of.',
        tags: ['normalisation', 'theory', 'interview'],
        ask: [
          'What is a functional dependency, with an example?',
          'How do I compute the closure of a set of attributes?',
        ],
        load: () => import('./functional-dependencies.js'),
      },
      {
        slug: 'normal-forms',
        title: '1NF, 2NF and 3NF',
        summary:
          'One badly-designed table, carried through all three forms, with the anomaly each one fixes named.',
        tags: ['normalisation', 'design', 'interview'],
        ask: [
          'Explain 1NF, 2NF and 3NF with one example carried through all three.',
          'What is a partial dependency and what is a transitive dependency?',
        ],
        load: () => import('./normal-forms.js'),
      },
      {
        slug: 'bcnf-and-beyond',
        title: 'BCNF, 4NF and lossless joins',
        summary:
          'The case 3NF lets through, why BCNF is stricter, and what "lossless" and "dependency-preserving" are protecting.',
        tags: ['normalisation', 'theory', 'interview'],
        ask: [
          'What is the difference between 3NF and BCNF?',
          'What makes a decomposition lossless?',
        ],
        load: () => import('./bcnf-and-beyond.js'),
      },
      {
        slug: 'denormalisation',
        title: 'Denormalisation',
        summary:
          'Breaking the rules on purpose: when a redundant column is the right call, and what it costs to keep true.',
        tags: ['normalisation', 'performance', 'design'],
        ask: [
          'When should you denormalise a schema?',
          'What are the risks of storing a derived column?',
        ],
        load: () => import('./denormalisation.js'),
      },
    ],
  },

  {
    key: 'language',
    title: 'The language',
    blurb: 'The five command families, the types a column can hold, and the statements that change data.',
    topics: [
      {
        slug: 'sql-overview',
        title: 'SQL, and its five families',
        summary:
          'DDL, DML, DQL, DCL, TCL — which statement belongs to which, and which of them you can roll back.',
        tags: ['basics', 'ddl', 'dml', 'interview'],
        ask: [
          'What are DDL, DML, DCL and TCL, with examples of each?',
          'Which SQL statements can be rolled back and which cannot?',
        ],
        load: () => import('./sql-overview.js'),
      },
      {
        slug: 'data-types',
        title: 'Data types',
        summary:
          'Numbers, strings, dates and booleans — plus why money is never a FLOAT and NULL is not a value.',
        tags: ['types', 'ddl', 'basics'],
        ask: [
          'What is the difference between CHAR and VARCHAR?',
          'Why should you never store money in a FLOAT?',
        ],
        load: () => import('./data-types.js'),
      },
      {
        slug: 'creating-tables',
        title: 'Creating and altering tables',
        summary:
          'CREATE TABLE with its constraints inline, then ALTER to add, drop, rename and change a column.',
        tags: ['ddl', 'schema', 'basics'],
        ask: [
          'Write a CREATE TABLE with a primary key and a foreign key.',
          'How do I add a NOT NULL column to a table that already has rows?',
        ],
        load: () => import('./creating-tables.js'),
      },
      {
        slug: 'insert-update-delete',
        title: 'INSERT, UPDATE, DELETE',
        summary:
          'Getting rows in, changing them, taking them out — and the missing WHERE that changes every row you own.',
        tags: ['dml', 'basics', 'interview'],
        ask: [
          'What happens if you run an UPDATE without a WHERE clause?',
          'How do I insert a row only if it does not already exist?',
        ],
        load: () => import('./insert-update-delete.js'),
      },
      {
        slug: 'delete-truncate-drop',
        title: 'DELETE vs TRUNCATE vs DROP',
        summary:
          'Three ways to remove things, compared on the four axes an interview asks about.',
        tags: ['dml', 'ddl', 'interview'],
        ask: [
          'What is the difference between DELETE, TRUNCATE and DROP?',
          'Can you roll back a TRUNCATE?',
        ],
        load: () => import('./delete-truncate-drop.js'),
      },
    ],
  },

  {
    key: 'querying',
    title: 'Querying',
    blurb:
      'Reading data back out, one clause at a time — and the execution order that makes the rest of it obvious.',
    topics: [
      {
        slug: 'select-lifecycle',
        title: 'How a SELECT actually runs',
        summary:
          'You write SELECT first and the engine runs it sixth. The real order, and the three puzzles it solves.',
        tags: ['select', 'basics', 'interview'],
        ask: [
          'What is the logical execution order of a SELECT statement?',
          'Why can I not use a column alias in the WHERE clause?',
        ],
        load: () => import('./select-lifecycle.js'),
      },
      {
        slug: 'where-and-operators',
        title: 'WHERE and its operators',
        summary:
          'Comparison, AND/OR/NOT, BETWEEN, IN, LIKE and the wildcards — filtering rows before anything else happens.',
        tags: ['select', 'filtering', 'basics'],
        ask: [
          'What is the difference between IN and EXISTS?',
          'How do LIKE wildcards work, and why is a leading % slow?',
        ],
        load: () => import('./where-and-operators.js'),
      },
      {
        slug: 'null-handling',
        title: 'NULL, and three-valued logic',
        summary:
          'NULL is not zero and not empty — it is "unknown", and it makes every comparison a third thing.',
        tags: ['null', 'gotcha', 'interview'],
        ask: [
          'Why does NOT IN return nothing when the subquery contains a NULL?',
          'Does COUNT(column) count NULLs? Does AVG skip them?',
        ],
        load: () => import('./null-handling.js'),
      },
      {
        slug: 'order-and-limit',
        title: 'ORDER BY and LIMIT',
        summary:
          'Sorting, ties, where NULLs land, and paginating without skipping a row.',
        tags: ['select', 'sorting', 'pagination'],
        ask: [
          'How do I get the second-highest salary using LIMIT and OFFSET?',
          'Why can pagination with OFFSET skip or repeat rows?',
        ],
        load: () => import('./order-and-limit.js'),
      },
      {
        slug: 'distinct-and-aliases',
        title: 'DISTINCT and aliases',
        summary:
          'Removing duplicates across the whole row, and naming things so the rest of the query can talk about them.',
        tags: ['select', 'basics'],
        ask: [
          'Does DISTINCT apply to one column or the whole row?',
          'What is the difference between DISTINCT and GROUP BY?',
        ],
        load: () => import('./distinct-and-aliases.js'),
      },
      {
        slug: 'aggregate-functions',
        title: 'Aggregate functions',
        summary:
          'COUNT, SUM, AVG, MIN, MAX — and the difference between COUNT(*) and COUNT(column) that gets asked every time.',
        tags: ['aggregates', 'basics', 'interview'],
        ask: [
          'What is the difference between COUNT(*), COUNT(1) and COUNT(column)?',
          'How do aggregate functions treat NULL?',
        ],
        load: () => import('./aggregate-functions.js'),
      },
      {
        slug: 'group-by-having',
        title: 'GROUP BY and HAVING',
        summary:
          'Collapsing rows into groups, filtering the groups afterwards, and why HAVING exists at all.',
        tags: ['aggregates', 'grouping', 'interview'],
        ask: [
          'What is the difference between WHERE and HAVING?',
          'Why must every non-aggregated column be in the GROUP BY?',
        ],
        load: () => import('./group-by-having.js'),
      },
    ],
  },

  {
    key: 'joins',
    title: 'Joins',
    blurb:
      'Every join type on the same two tables, with the rows it returns printed underneath — so the difference is something you read rather than something you remember.',
    topics: [
      {
        slug: 'joins-overview',
        title: 'What a join really is',
        summary:
          'Every join is a filtered cross product. Once you have seen the 24 rows underneath, the types stop needing memorising.',
        tags: ['joins', 'basics', 'interview'],
        ask: [
          'What is a join, in terms of the cartesian product?',
          'What is the difference between the ON clause and the WHERE clause in a join?',
        ],
        load: () => import('./joins-overview.js'),
      },
      {
        slug: 'inner-join',
        title: 'INNER JOIN',
        summary:
          'Rows that matched on both sides, and nothing else — the join you want nine times in ten.',
        tags: ['joins', 'basics'],
        ask: [
          'What does an INNER JOIN return, exactly?',
          'Is a comma join the same as an INNER JOIN?',
        ],
        load: () => import('./inner-join.js'),
      },
      {
        slug: 'left-and-right-join',
        title: 'LEFT and RIGHT JOIN',
        summary:
          'Keep every row from one side whether it matched or not — and the NULL-padded rows that fall out.',
        tags: ['joins', 'outer', 'interview'],
        ask: [
          'What is the difference between a LEFT JOIN and an INNER JOIN?',
          'How do I find rows in A that have no match in B?',
        ],
        load: () => import('./left-and-right-join.js'),
      },
      {
        slug: 'full-and-cross-join',
        title: 'FULL OUTER and CROSS JOIN',
        summary:
          'Everything from both sides, everything against everything — and how to fake a FULL OUTER in MySQL.',
        tags: ['joins', 'outer', 'mysql'],
        ask: [
          'MySQL has no FULL OUTER JOIN — how do I emulate one?',
          'When would you actually want a CROSS JOIN?',
        ],
        load: () => import('./full-and-cross-join.js'),
      },
      {
        slug: 'self-join',
        title: 'SELF JOIN',
        summary:
          'Joining a table to itself, for hierarchies and for comparing a row against its neighbours.',
        tags: ['joins', 'interview', 'patterns'],
        ask: [
          'How do I list every employee next to their manager’s name?',
          'How do I find rows whose value is higher than the previous row?',
        ],
        load: () => import('./self-join.js'),
      },
      {
        slug: 'set-operations',
        title: 'UNION, INTERSECT, EXCEPT',
        summary:
          'Stacking result sets rather than widening them — and the deduplication UNION does that UNION ALL does not.',
        tags: ['sets', 'joins', 'interview'],
        ask: [
          'What is the difference between UNION and UNION ALL?',
          'What is the difference between a UNION and a JOIN?',
        ],
        load: () => import('./set-operations.js'),
      },
    ],
  },

  {
    key: 'further',
    title: 'Going further',
    blurb:
      'The four things that separate a query someone can follow from a query someone can maintain.',
    topics: [
      {
        slug: 'subqueries',
        title: 'Subqueries',
        summary:
          'A query inside a query — scalar, row and table — and the three clauses one can appear in.',
        tags: ['subqueries', 'interview'],
        ask: [
          'What are the different kinds of subquery?',
          'When should I use a subquery instead of a join?',
        ],
        load: () => import('./subqueries.js'),
      },
      {
        slug: 'correlated-subqueries',
        title: 'Correlated subqueries',
        summary:
          'The subquery that runs once per outer row because it refers back to it — powerful, and the classic accidental quadratic.',
        tags: ['subqueries', 'performance', 'interview'],
        ask: [
          'What is a correlated subquery and how does it differ from a normal one?',
          'Why are correlated subqueries often slow?',
        ],
        load: () => import('./correlated-subqueries.js'),
      },
      {
        slug: 'exists-in-any-all',
        title: 'EXISTS, IN, ANY and ALL',
        summary:
          'Four ways to ask "is it in that set" — with different NULL behaviour and different costs.',
        tags: ['subqueries', 'null', 'interview'],
        ask: [
          'What is the difference between EXISTS and IN?',
          'Why does NOT IN behave strangely with NULLs but NOT EXISTS does not?',
        ],
        load: () => import('./exists-in-any-all.js'),
      },
      {
        slug: 'ctes',
        title: 'CTEs, including recursive ones',
        summary:
          'WITH: naming a subquery so the query reads top to bottom — and the recursive form that walks a hierarchy.',
        tags: ['cte', 'readability', 'recursive'],
        ask: [
          'What is a CTE and when should I use one instead of a subquery?',
          'Write a recursive CTE that walks a manager hierarchy.',
        ],
        load: () => import('./ctes.js'),
      },
      {
        slug: 'window-functions',
        title: 'Window functions',
        summary:
          'Aggregate without collapsing: OVER, PARTITION BY, and ROW_NUMBER vs RANK vs DENSE_RANK.',
        tags: ['window', 'advanced', 'interview'],
        ask: [
          'What is the difference between ROW_NUMBER, RANK and DENSE_RANK?',
          'How is a window function different from GROUP BY?',
        ],
        load: () => import('./window-functions.js'),
      },
      {
        slug: 'window-frames-lag-lead',
        title: 'Frames, LAG and LEAD',
        summary:
          'Running totals, moving averages, and comparing a row to the one before it — the frame clause explained.',
        tags: ['window', 'advanced', 'patterns'],
        ask: [
          'How do I write a running total with a window function?',
          'What is the difference between ROWS and RANGE in a window frame?',
        ],
        load: () => import('./window-frames-lag-lead.js'),
      },
    ],
  },

  {
    key: 'objects',
    title: 'Beyond the query',
    blurb: 'The objects a real schema has that a tutorial one does not.',
    topics: [
      {
        slug: 'views',
        title: 'Views',
        summary:
          'A stored query that behaves like a table — what it costs, when it is updatable, and what a materialised view changes.',
        tags: ['views', 'schema', 'interview'],
        ask: [
          'What is a view and what is it for?',
          'What is the difference between a view and a materialised view?',
        ],
        load: () => import('./views.js'),
      },
      {
        slug: 'stored-procedures-and-functions',
        title: 'Stored procedures and functions',
        summary:
          'Code that lives in the database: the difference between the two, and the argument about whether to use them.',
        tags: ['procedures', 'interview'],
        ask: [
          'What is the difference between a stored procedure and a function?',
          'What are the pros and cons of putting logic in the database?',
        ],
        load: () => import('./stored-procedures-and-functions.js'),
      },
      {
        slug: 'triggers',
        title: 'Triggers',
        summary:
          'Code that fires on INSERT, UPDATE or DELETE — for audit trails, and the reason they are easy to regret.',
        tags: ['triggers', 'interview'],
        ask: [
          'What is a trigger and when would you use one?',
          'What is the difference between a BEFORE and an AFTER trigger?',
        ],
        load: () => import('./triggers.js'),
      },
      {
        slug: 'indexes',
        title: 'Indexes',
        summary:
          'The B-tree under the hood, clustered vs non-clustered, composite indexes and the leftmost-prefix rule.',
        tags: ['indexes', 'performance', 'interview'],
        ask: [
          'How does a B-tree index actually make a lookup faster?',
          'What is the difference between a clustered and a non-clustered index?',
        ],
        load: () => import('./indexes.js'),
      },
      {
        slug: 'grants-and-injection',
        title: 'Privileges and SQL injection',
        summary:
          'GRANT and REVOKE, least privilege, and the one line of code that ends injection for good.',
        tags: ['security', 'injection', 'interview'],
        ask: [
          'How does a parameterised query prevent SQL injection?',
          'What does the principle of least privilege mean for a database user?',
        ],
        load: () => import('./grants-and-injection.js'),
      },
    ],
  },

  {
    key: 'transactions',
    title: 'Transactions and concurrency',
    blurb:
      'What happens when two people write at the same time — the section an interview digs into hardest, worked step by step.',
    topics: [
      {
        slug: 'transactions',
        title: 'Transactions',
        summary:
          'BEGIN, COMMIT, ROLLBACK and SAVEPOINT — the bank transfer, one statement at a time.',
        tags: ['transactions', 'tcl', 'interview'],
        ask: [
          'Walk me through a bank transfer as a transaction, step by step.',
          'What does a SAVEPOINT do?',
        ],
        load: () => import('./transactions.js'),
      },
      {
        slug: 'acid',
        title: 'ACID',
        summary:
          'Four letters, each with the exact thing that breaks without it — and which component of the database provides each.',
        tags: ['transactions', 'acid', 'interview'],
        ask: [
          'Explain ACID with an example of what breaks without each property.',
          'How does a database actually implement durability?',
        ],
        load: () => import('./acid.js'),
      },
      {
        slug: 'read-phenomena',
        title: 'Dirty, non-repeatable and phantom reads',
        summary:
          'The three things a concurrent reader can see that it should not, each shown as a two-session timeline.',
        tags: ['transactions', 'concurrency', 'interview'],
        ask: [
          'What is a dirty read, with a timeline of two transactions?',
          'What is the difference between a non-repeatable read and a phantom read?',
        ],
        load: () => import('./read-phenomena.js'),
      },
      {
        slug: 'isolation-levels',
        title: 'Isolation levels',
        summary:
          'Read Uncommitted to Serializable: what each one allows, what it costs, and what your database actually defaults to.',
        tags: ['transactions', 'concurrency', 'interview'],
        ask: [
          'What are the four isolation levels and what does each one prevent?',
          'What is the default isolation level in MySQL and in PostgreSQL?',
        ],
        load: () => import('./isolation-levels.js'),
      },
      {
        slug: 'locks-and-deadlocks',
        title: 'Locks and deadlocks',
        summary:
          'Shared and exclusive locks, two-phase locking, and the deadlock that comes from two people being polite in the wrong order.',
        tags: ['locks', 'concurrency', 'interview'],
        ask: [
          'Show me a deadlock between two transactions and how the database resolves it.',
          'What is two-phase locking?',
        ],
        load: () => import('./locks-and-deadlocks.js'),
      },
      {
        slug: 'mvcc',
        title: 'MVCC',
        summary:
          'How Postgres and InnoDB let readers and writers ignore each other — by keeping more than one version of a row.',
        tags: ['concurrency', 'advanced', 'interview'],
        ask: [
          'What is MVCC and how does it avoid read locks?',
          'Why does PostgreSQL need VACUUM?',
        ],
        load: () => import('./mvcc.js'),
      },
    ],
  },

  {
    key: 'performance',
    title: 'Fast, and asked',
    blurb: 'Why a query is slow, how to find out, and the questions all of this gets asked as.',
    topics: [
      {
        slug: 'query-execution',
        title: 'How a query is executed',
        summary:
          'Parse, rewrite, plan, execute — what the optimiser is choosing between, and why statistics decide it.',
        tags: ['performance', 'internals', 'interview'],
        ask: [
          'What happens between me pressing enter and the rows coming back?',
          'What does the query optimiser actually optimise?',
        ],
        load: () => import('./query-execution.js'),
      },
      {
        slug: 'reading-explain',
        title: 'Reading EXPLAIN',
        summary:
          'The plan for a real query, line by line — seq scan vs index scan, nested loop vs hash join, and the number that matters.',
        tags: ['performance', 'explain', 'interview'],
        ask: [
          'Walk me through reading an EXPLAIN output.',
          'What is the difference between EXPLAIN and EXPLAIN ANALYZE?',
        ],
        load: () => import('./reading-explain.js'),
      },
      {
        slug: 'query-killers',
        title: 'What makes a query slow',
        summary:
          'Ten things that stop an index being used or turn one query into a thousand — each with the rewrite.',
        tags: ['performance', 'optimisation', 'interview'],
        ask: [
          'Why does wrapping a column in a function stop the index being used?',
          'What is the N+1 query problem and how do I fix it?',
        ],
        load: () => import('./query-killers.js'),
      },
      {
        slug: 'interview-questions',
        title: 'The questions, and the classic queries',
        summary:
          'Fifty theory questions answered in a line each, then the twelve queries that get asked by name — Nth highest salary, duplicates, consecutive rows, top-N per group.',
        tags: ['interview', 'patterns', 'revision'],
        ask: [
          'Ask me ten DBMS interview questions and check my answers.',
          'Write the query for the Nth highest salary and explain it.',
        ],
        load: () => import('./interview-questions.js'),
      },
    ],
  },
];
