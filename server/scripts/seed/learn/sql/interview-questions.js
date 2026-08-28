import {
  asked,
  cheat,
  code,
  h,
  links,
  note,
  p,
  result,
  sql,
  table,
  tip,
  warn,
  wiki,
} from '../blocks.js';
import { departments, employees } from './sample-data.js';

/*
  The revision page. Two halves: the theory, as one-line answers you should be
  able to say out loud, and the twelve queries that get asked by name — each
  written against the same two tables the rest of the track uses, with the
  result printed, so this page can be worked through without a database.
*/
export const doc = {
  blocks: [
    p(
      'The last page, and the one to come back to. First the theory — fifty questions, answered in a line each, in the order this track covered them. Then the twelve queries that get asked **by name**, written against the same two tables you have been reading all track, with the answers printed.',
    ),

    h('Foundations'),
    asked([
      ['What is a database?', 'An organised collection of related data, stored so it can be queried and changed.'],
      ['What is a DBMS?', 'The software managing it — storage, querying, integrity, concurrency, recovery.'],
      ['Why not just use files?', 'Redundancy, inconsistency, no ad-hoc querying, no enforced integrity, no atomicity, no concurrency control, no recovery.'],
      ['What are the three schema levels?', 'External (per-user views), conceptual (the whole logical design), internal (physical storage).'],
      ['How many of each?', 'One internal, one conceptual, many external.'],
      ['What is physical data independence?', 'Changing storage without changing the schema or any query.'],
      ['What is logical data independence?', 'Changing the logical schema without changing the views above it. Harder.'],
      ['Why did the relational model win?', 'Values instead of pointers, so any relationship is queryable, and a declarative language, so the optimiser owns the plan.'],
      ['Who proposed it?', 'Edgar F. Codd, IBM, 1970.'],
      ['Is the ER model a storage model?', 'No — a design notation you convert into relational tables.'],
    ]),

    h('Design and keys'),
    asked([
      ['What is a weak entity?', 'One with no key of its own, identified by its owner’s key plus a partial key, with total participation.'],
      ['How is a multivalued attribute stored?', 'Its own table — a column holding several values breaks 1NF.'],
      ['How do you implement M:N?', 'A junction table whose primary key is the pair of foreign keys.'],
      ['Where does the FK go in 1:N?', 'On the many side.'],
      ['What distinguishes 1:1 from 1:N in SQL?', 'A UNIQUE constraint on the foreign key. Nothing else.'],
      ['Total vs partial participation?', 'A NOT NULL foreign key versus a nullable one.'],
      ['Super key vs candidate key?', 'Both unique; a candidate key is minimal — nothing can be removed.'],
      ['Candidate vs primary key?', 'The primary key is the candidate key you chose; the rest are alternate keys.'],
      ['Can a primary key be NULL?', 'No — entity integrity.'],
      ['Can a UNIQUE column be NULL?', 'Yes, and repeatedly, because NULLs are not equal to each other.'],
      ['Can a foreign key be NULL?', 'Yes — that means it references nothing.'],
      ['Surrogate vs natural key?', 'Generated and stable versus real data that can change. Prefer surrogate plus UNIQUE on the natural key.'],
      ['State referential integrity.', 'A foreign key is NULL or matches an existing primary key.'],
      ['What does ON DELETE CASCADE do?', 'Deletes the children with the parent — recursively.'],
      ['What is the default referential action?', 'NO ACTION — the delete is refused while children exist.'],
      ['Can a CHECK reference another table?', 'No. It sees one row.'],
    ]),

    h('Normalisation'),
    asked([
      ['What is normalisation?', 'Splitting tables so each fact is stored once, removing insert, update and delete anomalies.'],
      ['Name the anomalies.', 'Insertion, update, deletion.'],
      ['What is 1NF?', 'Atomic values, no repeating groups, and a key.'],
      ['What is 2NF?', '1NF plus no partial dependency on part of a composite key.'],
      ['When is 2NF automatic?', 'With a single-column primary key — there is no partial key to depend on.'],
      ['What is 3NF?', '2NF plus no transitive dependency through a non-key attribute.'],
      ['Give the one-line rule.', 'Every non-key attribute depends on the key, the whole key, and nothing but the key.'],
      ['What is BCNF?', 'Every determinant is a super key.'],
      ['How does it differ from 3NF?', '3NF allows a determinant that is not a super key when the dependent attribute is prime. BCNF does not.'],
      ['When do they differ?', 'Only with overlapping composite candidate keys.'],
      ['What is a lossless decomposition?', 'One where rejoining reproduces the original rows exactly — the shared attributes are a super key of one piece.'],
      ['What is the BCNF trade-off?', 'Always lossless, not always dependency preserving. 3NF can always be both.'],
      ['What is a functional dependency?', 'X → Y: rows agreeing on X must agree on Y.'],
      ['What is attribute closure for?', 'Testing whether a set is a super key, and finding candidate keys.'],
      ['How far do you normalise?', '3NF or BCNF, then denormalise deliberately where a measured read path needs it.'],
    ]),

    h('SQL'),
    asked([
      ['Name the command families.', 'DDL, DML, DQL, DCL, TCL.'],
      ['DELETE vs TRUNCATE vs DROP?', 'DELETE is DML — WHERE, logged, rollbackable, fires triggers. TRUNCATE is DDL — all rows, no WHERE, no triggers, resets AUTO_INCREMENT. DROP removes the table.'],
      ['Why is TRUNCATE faster?', 'It deallocates pages rather than logging each row deletion.'],
      ['Can you TRUNCATE a referenced table?', 'No — even with CASCADE, because cascade is per row.'],
      ['What is the execution order of a SELECT?', 'FROM, WHERE, GROUP BY, HAVING, window functions, SELECT, DISTINCT, ORDER BY, LIMIT.'],
      ['Why can WHERE not use an alias?', 'It runs before SELECT creates it.'],
      ['WHERE vs HAVING?', 'WHERE filters rows before grouping; HAVING filters groups after.'],
      ['What does NULL mean?', 'Unknown. Not zero, not empty, not false.'],
      ['Why is NULL = NULL not true?', 'Two unknowns cannot be known to be equal.'],
      ['COUNT(*) vs COUNT(col)?', 'Rows versus non-NULL values.'],
      ['Why does NOT IN with a NULL return nothing?', 'It becomes a chain of `<>` including `<> NULL`, which is never true.'],
      ['Why does `col <> 1` miss NULLs?', 'The comparison is unknown, so the row is dropped. Add `OR col IS NULL`.'],
      ['UNION vs UNION ALL?', 'UNION deduplicates and is slower; UNION ALL concatenates.'],
      ['UNION vs JOIN?', 'UNION adds rows; JOIN adds columns.'],
      ['DISTINCT vs GROUP BY?', 'Same result without an aggregate, usually the same plan. GROUP BY when you need a per-group figure.'],
    ]),

    h('Joins'),
    asked([
      ['What is a join, formally?', 'A filtered cartesian product — plus NULL-padded unmatched rows for outer joins.'],
      ['Name the join types.', 'INNER, LEFT, RIGHT, FULL OUTER, CROSS, and SELF as a use of any of them.'],
      ['What happens to NULL join keys in an INNER JOIN?', 'The rows are dropped silently — NULL never equals anything.'],
      ['Why does my LEFT JOIN act like an INNER JOIN?', 'A WHERE condition on the right table; the padded NULLs fail it. Move it into ON.'],
      ['When is a WHERE on the right table correct?', 'When it is IS NULL — that is the anti-join.'],
      ['How do you find rows with no match?', 'LEFT JOIN … WHERE right.pk IS NULL, or NOT EXISTS.'],
      ['Why is COUNT(*) wrong over a LEFT JOIN?', 'It counts the padded row, so an empty group shows 1. Use COUNT(right.col).'],
      ['Does MySQL support FULL OUTER JOIN?', 'No — emulate it with LEFT JOIN UNION RIGHT JOIN.'],
      ['What is a self join for?', 'Hierarchies, and comparing a row against others in the same table.'],
      ['IN vs EXISTS?', 'IN compares against a set; EXISTS asks whether a query returned any row, short-circuits, and never returns NULL.'],
      ['What does `> ALL` compare against?', 'The maximum. `> ANY` compares against the minimum.'],
      ['Why can a join return more rows than either table?', 'One row per matching pair — a non-unique key on both sides multiplies.'],
    ]),

    h('Advanced SQL'),
    asked([
      ['What is a correlated subquery?', 'One referencing the outer query, so it is evaluated per outer row.'],
      ['How do you make one faster?', 'Join to a grouped derived table, or use a window function.'],
      ['What is a CTE?', 'A named subquery declared with WITH.'],
      ['Does a CTE improve performance?', 'Not by itself. It is for readability; the plan usually matches the derived table.'],
      ['What are the parts of a recursive CTE?', 'Anchor, UNION ALL, recursive member referencing the CTE.'],
      ['When does the recursion stop?', 'When a pass returns no rows.'],
      ['Window function vs GROUP BY?', 'GROUP BY collapses rows; a window function keeps them and adds a column.'],
      ['ROW_NUMBER vs RANK vs DENSE_RANK?', 'On ties: different numbers; the same then skipping; the same without skipping.'],
      ['Which for the Nth highest salary?', 'DENSE_RANK — RANK can skip past N entirely.'],
      ['Why must you filter a window function in an outer query?', 'It is computed after WHERE.'],
      ['Why does adding ORDER BY change a window SUM?', 'It changes the default frame to everything up to the current row — a running total.'],
      ['Why does LAST_VALUE return the current row?', 'The default frame ends at the current row. Specify UNBOUNDED FOLLOWING.'],
      ['What is a view?', 'A stored query that behaves like a table and holds no data.'],
      ['View vs materialised view?', 'Always current versus stored, indexable and stale between refreshes.'],
      ['When is a trigger right?', 'An audit trail that must not be bypassable. Almost never otherwise.'],
    ]),

    h('Indexes and performance'),
    asked([
      ['What structure is an index?', 'A B+ tree — balanced, high fan-out, data in linked leaves.'],
      ['Why is it fast?', 'Logarithmic depth with fan-out in the hundreds: a billion rows is about four page reads.'],
      ['Clustered vs non-clustered?', 'Clustered is the table in key order, one per table; non-clustered is a separate structure pointing back.'],
      ['What is InnoDB’s clustered index?', 'The primary key — and secondary indexes store it, so they need a second lookup.'],
      ['What is the leftmost prefix rule?', 'A composite index serves only queries constraining a leftmost prefix.'],
      ['Where does the range column go?', 'Last — after a range, later columns cannot be used for seeking.'],
      ['What is a covering index?', 'One containing every column the query needs, so the table is never read.'],
      ['Why does a function on a column disable the index?', 'The index holds raw values; the function must be computed per row.'],
      ['When should you not index?', 'Low-selectivity columns, small tables, write-heavy tables read rarely.'],
      ['What does an index cost?', 'Slower writes, disk, memory, and more optimiser work.'],
      ['Does PostgreSQL index foreign keys?', 'Only the referenced primary key. The child column needs an index you add.'],
      ['What is the N+1 problem?', 'One query per row of a result. Fix with a join or a batched IN.'],
      ['Name the join algorithms.', 'Nested loop, hash join, merge join.'],
      ['What is the first thing to check in a plan?', 'Estimated versus actual rows.'],
      ['Why does a query suddenly get slow?', 'Usually stale statistics — the data changed and the plan is based on the old picture.'],
    ]),

    h('Transactions'),
    asked([
      ['What is a transaction?', 'A group of statements that all succeed or all fail.'],
      ['What does ACID stand for?', 'Atomicity, Consistency, Isolation, Durability.'],
      ['Which is your responsibility?', 'Consistency — the database enforces only the rules you declared.'],
      ['How is durability implemented?', 'Write-ahead logging: log and flush before COMMIT returns, write data pages later, replay on recovery.'],
      ['Name the isolation levels.', 'READ UNCOMMITTED, READ COMMITTED, REPEATABLE READ, SERIALIZABLE.'],
      ['MySQL and PostgreSQL defaults?', 'REPEATABLE READ and READ COMMITTED.'],
      ['What is a dirty read?', 'Reading uncommitted data that may be rolled back.'],
      ['Non-repeatable vs phantom read?', 'A row’s value changing versus the set of matching rows changing.'],
      ['What is a lost update?', 'Two transactions read a value, both write, one silently overwrites the other.'],
      ['How do you prevent it?', 'An atomic `SET x = x - n`, or FOR UPDATE, or a version column.'],
      ['What is write skew?', 'Two transactions each check an invariant and write different rows, breaking it. Only SERIALIZABLE prevents it.'],
      ['What is MVCC?', 'Multiple row versions so readers never block writers and writers never block readers.'],
      ['Why does PostgreSQL need VACUUM?', 'To reclaim dead tuples left in the table by updates and deletes.'],
      ['What is two-phase locking?', 'Acquire in a growing phase, release in a shrinking one. Strict 2PL holds all locks until commit.'],
      ['What is a deadlock?', 'A cycle of transactions each waiting on a lock another holds.'],
      ['How do you prevent one?', 'Consistent lock ordering, short transactions, indexed WHERE columns.'],
      ['What should the app do on a deadlock?', 'Retry the whole transaction — SQLSTATE 40001.'],
      ['How does parameterisation stop SQL injection?', 'The statement is parsed before the values arrive, so input can never become code.'],
    ]),

    h('The twelve queries'),
    p('Asked by name, in interviews, constantly. All against the two tables this track has used throughout.'),
    employees(),
    departments(),

    h('1 · Second highest salary'),
    code(
      sql(`
-- The one they actually want.
SELECT MAX(salary) AS second_highest
FROM employees
WHERE salary < (SELECT MAX(salary) FROM employees);

-- Or with LIMIT.
SELECT DISTINCT salary FROM employees ORDER BY salary DESC LIMIT 1 OFFSET 1;

-- Or with a window function.
SELECT salary FROM (
  SELECT salary, DENSE_RANK() OVER (ORDER BY salary DESC) rk FROM employees
) t WHERE rk = 2;
`),
    ),
    result(['second_highest'], [['`91000.00`']]),
    tip(
      'The `MAX(… WHERE salary < MAX(…))` form has one advantage worth mentioning out loud: it returns `NULL` rather than no rows when there is no second salary. `LIMIT 1 OFFSET 1` returns an empty result, which a caller expecting one row may not handle. Interviewers often follow up with exactly that edge case.',
    ),

    h('2 · Nth highest salary'),
    code(
      sql(`
-- N = 3.
SELECT DISTINCT salary FROM employees ORDER BY salary DESC LIMIT 1 OFFSET 2;

SELECT salary FROM (
  SELECT salary, DENSE_RANK() OVER (ORDER BY salary DESC) rk FROM employees
) t WHERE rk = 3;
`),
    ),
    result(['salary'], [['`82000.00`']]),
    warn(
      'Use `DENSE_RANK`, not `RANK`. With two people on the top salary, `RANK` produces 1, 1, 3 — there is no rank 2, so `WHERE rk = 2` returns nothing at all. This is the follow-up question, every time.',
    ),

    h('3 · Employees earning more than their manager'),
    code(
      sql(`
SELECT e.name AS employee, e.salary, m.name AS manager, m.salary AS manager_salary
FROM employees e
JOIN employees m ON e.manager_id = m.id
WHERE e.salary > m.salary;
`),
    ),
    p('**Zero rows on this data** — nobody out-earns their manager here, and being able to say why is worth more than a query that happens to return rows.'),

    h('4 · Duplicates'),
    code(
      sql(`
-- Which values repeat?
SELECT name, COUNT(*) AS copies
FROM employees GROUP BY name HAVING COUNT(*) > 1;

-- The duplicate rows themselves.
SELECT * FROM employees
WHERE name IN (SELECT name FROM employees GROUP BY name HAVING COUNT(*) > 1);

-- Delete all but the lowest id of each group.
DELETE e FROM employees e
JOIN employees keep ON e.name = keep.name AND e.id > keep.id;

-- Or with a window function, which generalises to any tie-break rule.
DELETE FROM employees WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY name ORDER BY id) rn FROM employees
  ) t WHERE rn > 1
);
`),
    ),

    h('5 · Department-wise highest earner'),
    code(
      sql(`
SELECT d.name AS department, e.name AS employee, e.salary
FROM employees e
JOIN departments d ON e.dept_id = d.id
WHERE e.salary = (SELECT MAX(x.salary) FROM employees x WHERE x.dept_id = e.dept_id);
`),
    ),
    result(
      ['department', 'employee', 'salary'],
      [
        ['Engineering', 'Ada', '`95000.00`'],
        ['Data', 'Barbara', '`91000.00`'],
        ['Design', 'Alan', '`68000.00`'],
      ],
    ),

    h('6 · Top N per group'),
    code(
      sql(`
-- Top 1 per department, exactly one row each even on a tie.
SELECT department, employee, salary FROM (
  SELECT d.name AS department, e.name AS employee, e.salary,
         ROW_NUMBER() OVER (PARTITION BY e.dept_id ORDER BY e.salary DESC, e.id) rn
  FROM employees e JOIN departments d ON e.dept_id = d.id
) t WHERE rn <= 1;
`),
    ),
    p('Change `rn <= 1` to `rn <= 3` for the top three, and swap `ROW_NUMBER` for `RANK` to keep every tied row.'),

    h('7 · Departments with no employees'),
    code(
      sql(`
SELECT d.name FROM departments d
WHERE NOT EXISTS (SELECT 1 FROM employees e WHERE e.dept_id = d.id);

-- Or as an anti-join.
SELECT d.name FROM departments d
LEFT JOIN employees e ON e.dept_id = d.id
WHERE e.id IS NULL;
`),
    ),
    result(['name'], [['Legal']]),
    warn(
      '`WHERE id NOT IN (SELECT dept_id FROM employees)` returns **nothing**, because `employees.dept_id` contains a NULL. This is the trap the question is testing.',
    ),

    h('8 · Headcount per department, including empty ones'),
    code(
      sql(`
SELECT d.name AS department, COUNT(e.id) AS headcount
FROM departments d
LEFT JOIN employees e ON e.dept_id = d.id
GROUP BY d.id, d.name
ORDER BY headcount DESC;
`),
    ),
    result(
      ['department', 'headcount'],
      [
        ['Engineering', '`2`'],
        ['Data', '`2`'],
        ['Design', '`1`'],
        ['Legal', '`0`'],
      ],
    ),
    p('`COUNT(e.id)`, not `COUNT(*)` — otherwise Legal shows 1, counting the NULL-padded row.'),

    h('9 · Above their department average'),
    code(
      sql(`
SELECT name, salary, dept_avg FROM (
  SELECT name, salary, AVG(salary) OVER (PARTITION BY dept_id) AS dept_avg
  FROM employees
) t WHERE salary > dept_avg;
`),
    ),
    result(
      ['name', 'salary', 'dept_avg'],
      [
        ['Ada', '`95000.00`', '`88500.00`'],
        ['Barbara', '`91000.00`', '`82500.00`'],
      ],
    ),

    h('10 · Consecutive rows'),
    p('Three or more of the same value in a row. The gaps-and-islands trick: **`ROW_NUMBER()` minus the value is constant within a run.**'),
    code(
      sql(`
SELECT DISTINCT num FROM (
  SELECT num,
         ROW_NUMBER() OVER (ORDER BY id) - ROW_NUMBER() OVER (PARTITION BY num ORDER BY id) AS grp
  FROM logs
) t
GROUP BY num, grp HAVING COUNT(*) >= 3;

-- Or the self-join form, which breaks if the ids have gaps.
SELECT DISTINCT a.num FROM logs a
JOIN logs b ON b.id = a.id + 1 AND b.num = a.num
JOIN logs c ON c.id = a.id + 2 AND c.num = a.num;
`),
    ),
    tip(
      'The subtraction is the whole idea and it is worth being able to explain: within a run both row numbers increase by one each step, so their difference is constant; the moment the value changes, only one of them advances and the difference jumps. Group by that difference and each group is one run. The self-join version is what most people write and it silently misses runs whenever an id is missing.',
    ),

    h('11 · Running total'),
    code(
      sql(`
SELECT name, hired_on, salary,
  SUM(salary) OVER (ORDER BY hired_on) AS running_total
FROM employees
ORDER BY hired_on;
`),
    ),
    result(
      ['name', 'hired_on', 'salary', 'running_total'],
      [
        ['Barbara', '`2018-11-02`', '`91000.00`', '`91000.00`'],
        ['Ada', '`2019-03-04`', '`95000.00`', '`186000.00`'],
        ['Grace', '`2020-07-15`', '`82000.00`', '`268000.00`'],
        ['Linus', '`2021-01-11`', '`74000.00`', '`342000.00`'],
        ['Alan', '`2022-05-30`', '`68000.00`', '`410000.00`'],
        ['Radia', '`2023-02-20`', '`78000.00`', '`488000.00`'],
      ],
    ),

    h('12 · Pivot — rows into columns'),
    code(
      sql(`
-- Conditional aggregation. There is no PIVOT in MySQL or PostgreSQL.
SELECT
  COUNT(*)                                       AS total,
  SUM(CASE WHEN dept_id = 1 THEN 1 ELSE 0 END)   AS engineering,
  SUM(CASE WHEN dept_id = 2 THEN 1 ELSE 0 END)   AS data,
  SUM(CASE WHEN dept_id = 3 THEN 1 ELSE 0 END)   AS design,
  SUM(CASE WHEN dept_id IS NULL THEN 1 ELSE 0 END) AS unassigned
FROM employees;
`),
    ),
    result(
      ['total', 'engineering', 'data', 'design', 'unassigned'],
      [['`6`', '`2`', '`2`', '`1`', '`1`']],
    ),
    note(
      'The columns have to be written out, which means the shape is fixed at query-writing time. A genuinely dynamic pivot needs the column list built by an outer query and the SQL assembled as a string — at which point it belongs in the application, not in SQL.',
    ),

    h('And the two asked as conversation'),
    table(
      ['question', 'a good answer'],
      [
        [
          '**"How would you speed up a slow query?"**',
          'Measure it first with `EXPLAIN ANALYZE`. Compare estimated with actual rows — if they are far apart, run `ANALYZE`. Then look for the usual suspects: a function wrapping a filtered column, a missing index on a join or filter, `SELECT *` preventing a covering index, an N+1 in the calling code. Add the index, re-measure. Denormalise only after the cheap options are exhausted.',
        ],
        [
          '**"SQL or NoSQL for this?"**',
          'Ask what the invariants are and how the data will be read. Relationships to query across, and rules that must always hold, argue for SQL — the database enforces them for every writer. Variable shape, or write volume beyond one primary, argues for NoSQL. Most systems that regretted the choice chose NoSQL for scale they never reached and lost the constraints they did need.',
        ],
      ],
    ),

    h('Cheatsheet'),
    cheat([
      ['Second highest', '`MAX(x) WHERE x < (SELECT MAX(x))`'],
      ['Nth highest', '`DENSE_RANK() = n`'],
      ['Duplicates', '`GROUP BY col HAVING COUNT(*) > 1`'],
      ['Delete duplicates', '`ROW_NUMBER() OVER (PARTITION BY col ORDER BY id) > 1`'],
      ['Max per group', '`ROW_NUMBER() … PARTITION BY g ORDER BY x DESC` = 1'],
      ['Rows with no match', '`NOT EXISTS`'],
      ['Count including empty groups', '`LEFT JOIN` + `COUNT(right.col)`'],
      ['Compare to a group average', '`AVG(x) OVER (PARTITION BY g)`'],
      ['Consecutive runs', '`ROW_NUMBER()` minus the value'],
      ['Running total', '`SUM(x) OVER (ORDER BY d)`'],
      ['Rows into columns', '`SUM(CASE WHEN … THEN 1 ELSE 0 END)`'],
      ['Previous row', '`LAG(x) OVER (ORDER BY d)`'],
    ]),

    links(
      wiki('SQL', 'SQL'),
      wiki('Database_normalization', 'Normalization'),
      wiki('ACID', 'ACID'),
    ),
  ],
};
