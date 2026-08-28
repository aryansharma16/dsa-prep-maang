import { asked, cheat, code, h, links, mysqlDoc, note, p, result, sql, table, tip, warn } from '../blocks.js';
import { departments, employees } from './sample-data.js';

export const doc = {
  blocks: [
    p(
      '`INNER JOIN` returns **only the pairs that matched**. A row with no partner on the other side does not appear, from either table. It is the join you want nine times in ten, and `JOIN` with no qualifier means this one.',
    ),
    employees(),
    departments(),

    h('The query, and the result'),
    code(
      sql(`
SELECT e.name AS employee, e.salary, d.name AS department, d.location
FROM employees e
INNER JOIN departments d ON e.dept_id = d.id
ORDER BY e.id;
`),
    ),
    result(
      ['employee', 'salary', 'department', 'location'],
      [
        ['Ada', '`95000.00`', 'Engineering', 'Bengaluru'],
        ['Grace', '`82000.00`', 'Engineering', 'Bengaluru'],
        ['Linus', '`74000.00`', 'Data', 'Hyderabad'],
        ['Barbara', '`91000.00`', 'Data', 'Hyderabad'],
        ['Alan', '`68000.00`', 'Design', 'Pune'],
      ],
      '5 rows',
    ),
    p('**Five rows from six employees and four departments.** Two things are missing, and both were dropped for the same reason — no partner:'),
    table(
      ['missing', 'why'],
      [
        ['**Radia**', 'Her `dept_id` is `NULL`. `NULL = 1` is `NULL`, not true, so none of her four candidate pairs survived.'],
        ['**Legal**', 'No employee has `dept_id = 4`, so none of its six candidate pairs matched either.'],
      ],
    ),
    warn(
      'That first row is the one to internalise. An inner join **silently drops rows whose join key is NULL** — there is no error and no warning. A query written as "list the employees with their departments" quietly became "list the employees who have a department", and the difference is a person missing from a payroll report.',
    ),

    h('The many-to-one shape'),
    p(
      'This join is many-to-one: many employees, one department each. So the department columns **repeat**, once per employee — Engineering appears twice because two people are in it. That is not duplication in the sense of a bug; it is what a wider row means.',
    ),
    note(
      'The row count of an inner join is not bounded by either table. It is one row per *matching pair*. Join two tables on a key that is not unique on either side and you get the product of the group sizes — three orders and two addresses for one customer gives six rows, not three. When a join returns more rows than you expected, this is almost always why, and the fix is to check that the join key is unique on at least one side.',
    ),

    h('JOIN, INNER JOIN and the comma form'),
    code(
      sql(`
-- All three of these are the same query.
SELECT e.name, d.name FROM employees e INNER JOIN departments d ON e.dept_id = d.id;
SELECT e.name, d.name FROM employees e       JOIN departments d ON e.dept_id = d.id;
SELECT e.name, d.name FROM employees e, departments d WHERE e.dept_id = d.id;
`),
    ),
    p(
      'The third is the pre-1992 syntax. It produces an identical plan, and it is still worth not writing: the join condition sits in `WHERE` alongside the genuine filters, so a reader cannot see at a glance which is which, and omitting it produces a silent cross product rather than a syntax error.',
    ),

    h('More than one condition'),
    code(
      sql(`
-- A join condition is any boolean, not only equality.
SELECT e.name, d.name AS dept
FROM employees e
JOIN departments d
  ON e.dept_id = d.id
 AND d.location <> 'Pune';
`),
    ),
    result(
      ['name', 'dept'],
      [
        ['Ada', 'Engineering'],
        ['Grace', 'Engineering'],
        ['Linus', 'Data'],
        ['Barbara', 'Data'],
      ],
      '4 rows — Alan is in Design, which is in Pune',
    ),
    p(
      'On an **inner** join, moving `d.location <> \'Pune\'` into `WHERE` gives exactly the same result. That equivalence is what makes `ON`-versus-`WHERE` a non-question here and a critical one on an outer join, where it decides whether unmatched rows survive.',
    ),
    p('A join on something other than equality is a **non-equi join**, and it is occasionally exactly what you want:'),
    code(
      sql(`
-- Everyone who earns more than Alan.
SELECT hi.name, hi.salary
FROM employees hi
JOIN employees lo ON hi.salary > lo.salary AND lo.name = 'Alan';

-- Band a salary against a lookup table of ranges.
SELECT e.name, b.label
FROM employees e
JOIN salary_bands b ON e.salary BETWEEN b.min_salary AND b.max_salary;
`),
    ),

    h('Joining three tables'),
    code(
      sql(`
SELECT e.name AS employee, d.name AS department, m.name AS manager
FROM employees e
JOIN departments d ON e.dept_id    = d.id
JOIN employees   m ON e.manager_id = m.id
ORDER BY e.id;
`),
    ),
    result(
      ['employee', 'department', 'manager'],
      [
        ['Grace', 'Engineering', 'Ada'],
        ['Linus', 'Data', 'Ada'],
        ['Barbara', 'Data', 'Ada'],
        ['Alan', 'Design', 'Barbara'],
      ],
      '4 rows',
    ),
    warn(
      '**Down to four.** Each inner join removes more: Radia went on the first (no department), and Ada went on the second (no manager). Two inner joins have turned "every employee with their department and manager" into "employees who have both", which is a different question and a much smaller answer. Use `LEFT JOIN` when the thing being attached is optional — which is what the next topic is about.',
    ),

    h('Aggregating over a join'),
    code(
      sql(`
SELECT d.name AS department, COUNT(*) AS headcount, SUM(e.salary) AS wage_bill
FROM employees e
JOIN departments d ON e.dept_id = d.id
GROUP BY d.name
ORDER BY wage_bill DESC;
`),
    ),
    result(
      ['department', 'headcount', 'wage_bill'],
      [
        ['Engineering', '`2`', '`177000.00`'],
        ['Data', '`2`', '`165000.00`'],
        ['Design', '`1`', '`68000.00`'],
      ],
    ),
    tip(
      'Legal is absent, with no row saying `0`. That is correct for an inner join and it is almost never what a "headcount by department" report wants — a department with nobody in it is a fact worth showing. The fix is a `LEFT JOIN` **from `departments`**, and the counting subtlety that comes with it is the first thing the next topic covers.',
    ),

    h('Performance'),
    p('An inner join is fast when the join column is indexed on at least one side, and slow when it is not:'),
    code(
      sql(`
-- The foreign key column needs its own index. In MySQL/InnoDB, declaring a
-- foreign key creates one automatically. In PostgreSQL it does NOT.
CREATE INDEX idx_employees_dept ON employees(dept_id);
`),
    ),
    note(
      'That difference catches people moving between the two. PostgreSQL indexes the *referenced* primary key, because it must, but never the referencing column — so every join from the child side, and every `ON DELETE` check, scans the child table until you add the index yourself. It is one of the most common missing indexes in a Postgres schema.',
    ),

    h('Interview'),
    asked([
      ['What does an INNER JOIN return?', 'Only rows with a match on both sides.'],
      ['Is JOIN the same as INNER JOIN?', 'Yes — INNER is the default and is optional.'],
      ['What happens to rows with a NULL join key?', 'They are dropped, silently — NULL never equals anything.'],
      ['Can an inner join return more rows than either table?', 'Yes — one row per matching pair, so a non-unique key on both sides multiplies.'],
      ['ON vs WHERE on an inner join?', 'Identical results. The distinction only matters for outer joins.'],
      ['What is a non-equi join?', 'One whose condition is not equality — a range or inequality, as in banding a value against a lookup table.'],
      ['Why avoid the comma syntax?', 'A forgotten condition silently becomes a cross product, and the join condition hides among the filters.'],
      ['Which column should be indexed?', 'The one being joined on — typically the foreign key. MySQL creates that index with the constraint; PostgreSQL does not.'],
      ['What happens when you chain inner joins?', 'Each one can drop more rows, so the result narrows to entities that have all the relationships.'],
    ]),

    h('Cheatsheet'),
    cheat([
      ['Rows present in both tables', '`INNER JOIN … ON`'],
      ['Attach an optional thing', '`LEFT JOIN` — not this'],
      ['Join on a range', '`ON a.x BETWEEN b.lo AND b.hi`'],
      ['Aggregate per group across tables', '`JOIN … GROUP BY`'],
      ['Include groups with no rows', '`LEFT JOIN` from the group table'],
      ['Speed it up', 'Index the join column on the child side'],
      ['Check your work', 'Predict the row count before you run it'],
    ]),

    links(mysqlDoc('join.html', 'JOIN syntax (MySQL)'), mysqlDoc('nested-loop-joins.html', 'How MySQL joins')),
  ],
};
