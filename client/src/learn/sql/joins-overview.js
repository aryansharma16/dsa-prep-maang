import { asked, cheat, code, h, links, note, p, result, sql, table, tip, warn, wiki } from '../blocks.js';
import { departments, employees } from './sample-data.js';

/*
  The section opener, and it exists to make the five join types stop being five
  things to memorise. They are one thing — filter a cross product, then decide
  what to do with the rows that did not survive — and once the 24 rows have been
  printed once, every later topic can point back at them.
*/
export const doc = {
  blocks: [
    p(
      'A **join** combines rows from two tables into wider rows. There are five types, they are usually presented as five Venn diagrams to memorise, and they are much easier than that: **every join is a cross product with a filter on it, plus a rule about what to do with the rows that did not match.**',
    ),
    p('Print the cross product once and the five types stop needing memorising.'),

    h('The two tables'),
    employees(),
    departments(),
    p('Two facts about this data do all the work in this section, and they are there on purpose:'),
    table(
      ['fact', 'so'],
      [
        ['**Radia has no `dept_id`.**', 'An employee with no matching department.'],
        ['**Legal (id 4) has no employees.**', 'A department with no matching employee.'],
      ],
    ),
    p(
      'Those two rows are the *only* thing the join types disagree about. Every join returns the five matched pairs; what differs is whether Radia appears, whether Legal appears, and whether either appears at all.',
    ),

    h('The cross product underneath'),
    p('6 employees × 4 departments = **24 rows**, every combination, no condition:'),
    code(
      sql(`
SELECT e.name, e.dept_id, d.id, d.name
FROM employees e
CROSS JOIN departments d;
`),
    ),
    result(
      ['e.name', 'e.dept_id', 'd.id', 'd.name', 'e.dept_id = d.id ?'],
      [
        ['Ada', '`1`', '`1`', 'Engineering', '**true**'],
        ['Ada', '`1`', '`2`', 'Data', 'false'],
        ['Ada', '`1`', '`3`', 'Design', 'false'],
        ['Ada', '`1`', '`4`', 'Legal', 'false'],
        ['Grace', '`1`', '`1`', 'Engineering', '**true**'],
        ['Grace', '`1`', '`2`', 'Data', 'false'],
        ['…', '…', '…', '…', '*16 more rows*'],
        ['Radia', '`NULL`', '`1`', 'Engineering', '`NULL`'],
        ['Radia', '`NULL`', '`2`', 'Data', '`NULL`'],
        ['Radia', '`NULL`', '`3`', 'Design', '`NULL`'],
        ['Radia', '`NULL`', '`4`', 'Legal', '`NULL`'],
      ],
      '24 rows',
    ),
    p(
      'Now apply the condition `e.dept_id = d.id`. Of the 24 rows, exactly **five** satisfy it:',
    ),
    result(
      ['e.name', 'e.dept_id', 'd.id', 'd.name'],
      [
        ['Ada', '`1`', '`1`', 'Engineering'],
        ['Grace', '`1`', '`1`', 'Engineering'],
        ['Linus', '`2`', '`2`', 'Data'],
        ['Barbara', '`2`', '`2`', 'Data'],
        ['Alan', '`3`', '`3`', 'Design'],
      ],
      'The 5 matched pairs — this is the INNER JOIN',
    ),
    p(
      "Radia's four rows all fail, because `NULL = 1` is `NULL` rather than true. Legal's six rows all fail, because no employee holds `dept_id = 4`. **Those two exclusions are the entire subject of this section.**",
    ),
    note(
      'This is not a teaching analogy. In relational algebra a join is *defined* as `σ_condition (A × B)` — a selection over a cartesian product — and that is why the five types are all one operation. What an *outer* join adds is a second step: take the rows from one side that produced nothing, and emit them once with NULLs where the other side would have been.',
    ),

    h('The five, in one table'),
    table(
      ['join', 'returns', 'on our data'],
      [
        ['`INNER JOIN`', 'Only matched pairs.', '**5 rows.** No Radia, no Legal.'],
        [
          '`LEFT JOIN`',
          'All matched pairs, plus unmatched rows from the **left**, padded with NULLs.',
          '**6 rows.** Radia appears with a NULL department.',
        ],
        [
          '`RIGHT JOIN`',
          'The same, from the **right**.',
          '**6 rows.** Legal appears with a NULL employee.',
        ],
        ['`FULL OUTER JOIN`', 'Both.', '**7 rows.** Radia *and* Legal.'],
        ['`CROSS JOIN`', 'Every combination, no condition.', '**24 rows.**'],
      ],
    ),
    tip(
      'Count the rows before you write the query. "I expect one row per employee, so six" is a check you can perform in your head, and it catches the two most common join bugs — a missing condition (24 rows) and a duplicated join key (more rows than either table has) — immediately rather than three transformations later.',
    ),

    h('ON versus WHERE'),
    p(
      'On an inner join these are interchangeable. On an **outer** join they are completely different, and this is the most valuable thing on the page:',
    ),
    code(
      sql(`
-- Condition in ON: applied *while* matching. Unmatched left rows still survive.
SELECT e.name, d.name AS dept
FROM employees e
LEFT JOIN departments d ON e.dept_id = d.id AND d.location = 'Bengaluru';
`),
    ),
    result(
      ['name', 'dept'],
      [
        ['Ada', 'Engineering'],
        ['Grace', 'Engineering'],
        ['Linus', '`NULL`'],
        ['Barbara', '`NULL`'],
        ['Alan', '`NULL`'],
        ['Radia', '`NULL`'],
      ],
      '6 rows — everyone kept',
    ),
    code(
      sql(`
-- Same condition in WHERE: applied *after* the join, to the padded rows too.
SELECT e.name, d.name AS dept
FROM employees e
LEFT JOIN departments d ON e.dept_id = d.id
WHERE d.location = 'Bengaluru';
`),
    ),
    result(['name', 'dept'], [['Ada', 'Engineering'], ['Grace', 'Engineering']], '2 rows'),
    warn(
      'The second query is an **inner join wearing a LEFT JOIN costume.** The padding put `NULL` in `d.location` for Linus, Barbara, Alan and Radia; `WHERE d.location = \'Bengaluru\'` is then `NULL`, not true, so all four are dropped. Any `WHERE` condition on the right-hand table of a `LEFT JOIN` silently cancels the outerness — which is why "my LEFT JOIN is behaving like an INNER JOIN" is nearly always this.',
    ),
    p(
      'The rule: **filters on the preserved side go in `WHERE`; filters on the optional side go in `ON`.** The single exception is `WHERE d.id IS NULL`, which is deliberately looking *for* the padded rows — that is the anti-join, and it has its own section in the next topic.',
    ),

    h('Three ways to spell the same join'),
    code(
      sql(`
-- Explicit. Use this.
SELECT e.name, d.name FROM employees e JOIN departments d ON e.dept_id = d.id;

-- The old comma form. Valid, and the reason it should not be used is below.
SELECT e.name, d.name FROM employees e, departments d WHERE e.dept_id = d.id;

-- USING, but only when the two columns share a name. Ours do not
-- (dept_id vs id), so this would be an error here — shown on a table that does.
SELECT e.name, p.title FROM employees e JOIN payroll p USING (employee_id);
`),
    ),
    note(
      '`USING` returns the shared column **once** rather than twice, which is genuinely convenient with `SELECT *`, and it only works when the columns are identically named on both sides. `NATURAL JOIN` goes further and joins on *every* commonly-named column with no `ON` at all — which means adding a column called `created_at` to both tables silently changes what the query joins on. Avoid it.',
    ),
    warn(
      'The comma form puts the join condition in `WHERE`, so forgetting it is not a syntax error — it is a silent cross product. On two tables of a million rows that is a trillion-row query that takes the database down. `JOIN … ON` makes the condition part of the join, so leaving it out is a parse error rather than an outage. There is also no comma spelling of an outer join, so a mixed query becomes unreadable.',
    ),

    h('Joining more than two tables'),
    code(
      sql(`
SELECT e.name, d.name AS dept, m.name AS manager
FROM employees e
LEFT JOIN departments d ON e.dept_id = d.id
LEFT JOIN employees   m ON e.manager_id = m.id
ORDER BY e.id;
`),
    ),
    result(
      ['name', 'dept', 'manager'],
      [
        ['Ada', 'Engineering', '`NULL`'],
        ['Grace', 'Engineering', 'Ada'],
        ['Linus', 'Data', 'Ada'],
        ['Barbara', 'Data', 'Ada'],
        ['Alan', 'Design', 'Barbara'],
        ['Radia', '`NULL`', 'Barbara'],
      ],
    ),
    p(
      'Joins are evaluated left to right, each one against the accumulated result. Both are `LEFT` here on purpose: Ada has no manager and Radia has no department, and an inner join on either would have quietly removed a person from an employee list.',
    ),
    tip(
      'One inner join anywhere in a chain of outer joins collapses everything before it. If you need "every employee, with whatever we know about them", every join in the chain has to be `LEFT`.',
    ),

    h('Interview'),
    asked([
      ['What is a join?', 'A filtered cartesian product — `σ_condition(A × B)` — plus, for outer joins, the unmatched rows padded with NULLs.'],
      ['How many rows does a cross join produce?', 'The product of the row counts. 6 × 4 = 24 here.'],
      ['Name the join types.', 'INNER, LEFT OUTER, RIGHT OUTER, FULL OUTER, CROSS — plus SELF, which is any of those onto the same table.'],
      ['ON vs WHERE on an outer join?', 'ON is applied while matching and preserves unmatched rows; WHERE is applied afterwards and drops padded rows.'],
      ['Why does my LEFT JOIN act like an INNER JOIN?', 'A WHERE condition on the right-hand table — the padded NULLs fail it.'],
      ['What is the exception?', '`WHERE right.key IS NULL`, which is deliberately selecting the padded rows — the anti-join.'],
      ['Why avoid the comma join syntax?', 'A forgotten condition becomes a silent cross product rather than a syntax error, and there is no comma form for outer joins.'],
      ['What does USING do?', 'Joins on identically-named columns and returns the key once instead of twice.'],
      ['How are three joins evaluated?', 'Left to right, each against the accumulated result — so one inner join collapses the outer joins before it.'],
    ]),

    h('Cheatsheet'),
    cheat([
      ['Only rows present in both', '`INNER JOIN`'],
      ['Every row from the left', '`LEFT JOIN`'],
      ['Every row from both', '`FULL OUTER JOIN`'],
      ['Every combination', '`CROSS JOIN`'],
      ['Filter the optional side', 'Put it in `ON`'],
      ['Filter the preserved side', 'Put it in `WHERE`'],
      ['Find rows with no match', '`LEFT JOIN … WHERE right.key IS NULL`'],
      ['Sanity-check a join', 'Predict the row count first'],
    ]),

    links(
      wiki('Join_(SQL)', 'Join (SQL)'),
      wiki('Relational_algebra#Joins_and_join-like_operators', 'Joins in relational algebra'),
    ),
  ],
};
