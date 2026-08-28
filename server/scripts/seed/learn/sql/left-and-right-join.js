import { asked, cheat, code, h, links, mysqlDoc, note, p, result, sql, table, tip, warn } from '../blocks.js';
import { departments, employees } from './sample-data.js';

/*
  The topic this whole section exists for. LEFT JOIN is where people stop being
  able to predict what a query returns, and the two things that fix that are
  seeing the padded row printed, and understanding that WHERE on the right-hand
  table cancels the outerness. Both get a worked result here.
*/
export const doc = {
  blocks: [
    p(
      'A `LEFT JOIN` returns **every row from the left table**, matched or not. Where there was no match, the right-hand columns come back as `NULL` — the row is *padded* rather than dropped. `RIGHT JOIN` is the same thing pointing the other way.',
    ),
    p(
      'This is the join for attaching something **optional**. "Every employee, and their department if they have one" is a `LEFT JOIN`; "every employee who has a department" is an `INNER JOIN`, and the difference between those two sentences is a person missing from a report.',
    ),
    employees(),
    departments(),

    h('LEFT JOIN'),
    code(
      sql(`
SELECT e.name AS employee, d.name AS department, d.location
FROM employees e
LEFT JOIN departments d ON e.dept_id = d.id
ORDER BY e.id;
`),
    ),
    result(
      ['employee', 'department', 'location'],
      [
        ['Ada', 'Engineering', 'Bengaluru'],
        ['Grace', 'Engineering', 'Bengaluru'],
        ['Linus', 'Data', 'Hyderabad'],
        ['Barbara', 'Data', 'Hyderabad'],
        ['Alan', 'Design', 'Pune'],
        ['**Radia**', '**`NULL`**', '**`NULL`**'],
      ],
      '6 rows — one per employee',
    ),
    p(
      '**Six rows, against the inner join\'s five.** Radia is back. She has no `dept_id`, so nothing matched, so the join emitted her once with `NULL` in every column that would have come from `departments`. Legal is still absent — it is on the right, and the right side gets no such protection.',
    ),
    tip(
      'The row count is the check: a `LEFT JOIN` returns **at least** as many rows as the left table has. Exactly as many, if the right side matches at most once. If you write a `LEFT JOIN` from a six-row table and get four rows back, something is wrong — and it is almost certainly the `WHERE` clause covered below.',
    ),

    h('RIGHT JOIN'),
    code(
      sql(`
SELECT e.name AS employee, d.name AS department
FROM employees e
RIGHT JOIN departments d ON e.dept_id = d.id
ORDER BY d.id;
`),
    ),
    result(
      ['employee', 'department'],
      [
        ['Ada', 'Engineering'],
        ['Grace', 'Engineering'],
        ['Linus', 'Data'],
        ['Barbara', 'Data'],
        ['Alan', 'Design'],
        ['**`NULL`**', '**Legal**'],
      ],
      '6 rows — one per department, plus the extra employees',
    ),
    p(
      'Now every **department** is preserved. Legal appears with a `NULL` employee, because nobody works there. Radia is gone, because she is on the left.',
    ),
    note(
      '`A RIGHT JOIN B` is exactly `B LEFT JOIN A` with the columns in a different order. Every right join can be rewritten as a left join, and in practice almost everyone does — reading a query is easier when the preserved table is always the one you already read, at the top. Some style guides ban `RIGHT JOIN` outright for this reason. Know what it means; reach for `LEFT`.',
    ),
    code(
      sql(`
-- Identical to the RIGHT JOIN above.
SELECT e.name AS employee, d.name AS department
FROM departments d
LEFT JOIN employees e ON e.dept_id = d.id
ORDER BY d.id;
`),
    ),

    h('The mistake that cancels the outer join'),
    p('This is the most valuable page in the joins section, and it is one clause:'),
    code(
      sql(`
-- Intent: every employee, showing their department only if it is in Bengaluru.
SELECT e.name, d.name AS dept
FROM employees e
LEFT JOIN departments d ON e.dept_id = d.id
WHERE d.location = 'Bengaluru';
`),
    ),
    result(['name', 'dept'], [['Ada', 'Engineering'], ['Grace', 'Engineering']], '2 rows — not 6'),
    warn(
      '**Four employees have vanished.** The join did its job and padded Linus, Barbara, Alan and Radia with `NULL` in `d.location`. Then `WHERE d.location = \'Bengaluru\'` was evaluated against those NULLs, which gives `NULL` — not true — so every padded row was dropped. The `LEFT JOIN` has been silently downgraded to an `INNER JOIN`.',
    ),
    p('Put the condition in `ON` and it is applied **while matching**, so unmatched rows are still preserved:'),
    code(
      sql(`
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
    table(
      ['put the condition in', 'when it concerns', 'effect on unmatched rows'],
      [
        ['`ON`', 'The **optional** (right) table', 'Preserved, padded with NULL'],
        ['`WHERE`', 'The **preserved** (left) table', 'Fine — filters the left table as intended'],
        ['`WHERE`', 'The **optional** table', '**Dropped** — the join becomes inner'],
      ],
    ),

    h('The anti-join — finding what is missing'),
    p(
      'There is exactly one case where a `WHERE` on the right-hand table is correct, and it is because you are deliberately looking *for* the padded rows. `LEFT JOIN … WHERE right.key IS NULL` is the standard way to ask "which rows on the left have no match":',
    ),
    code(
      sql(`
-- Employees with no department.
SELECT e.name
FROM employees e
LEFT JOIN departments d ON e.dept_id = d.id
WHERE d.id IS NULL;
`),
    ),
    result(['name'], [['Radia']]),
    code(
      sql(`
-- Departments with nobody in them.
SELECT d.name
FROM departments d
LEFT JOIN employees e ON e.dept_id = d.id
WHERE e.id IS NULL;
`),
    ),
    result(['name'], [['Legal']]),
    tip(
      'Test the right table’s **primary key**, not any old column. `d.id IS NULL` can only be true for a padded row, because a real department always has an id. `d.location IS NULL` would also match a department that genuinely has no location recorded — a different question, and a bug that only appears when such a row exists.',
    ),
    p('Three ways to write an anti-join. They usually produce the same plan; pick for readability:'),
    code(
      sql(`
SELECT e.name FROM employees e
LEFT JOIN departments d ON e.dept_id = d.id WHERE d.id IS NULL;

SELECT e.name FROM employees e
WHERE NOT EXISTS (SELECT 1 FROM departments d WHERE d.id = e.dept_id);

-- Correct only because dept_id has no NULLs in departments. See the NULL topic.
SELECT e.name FROM employees e WHERE e.dept_id NOT IN (SELECT id FROM departments);
`),
    ),

    h('Counting over a LEFT JOIN'),
    p('The counting trap, and it is asked directly. Compare these two:'),
    code(
      sql(`
SELECT d.name AS department, COUNT(*) AS wrong
FROM departments d
LEFT JOIN employees e ON e.dept_id = d.id
GROUP BY d.name;
`),
    ),
    result(
      ['department', 'wrong'],
      [
        ['Engineering', '`2`'],
        ['Data', '`2`'],
        ['Design', '`1`'],
        ['Legal', '**`1`**'],
      ],
      'Legal has one employee?',
    ),
    warn(
      '`COUNT(*)` counts **rows**, and Legal has exactly one row — the padded one, full of NULLs. It is not counting an employee; it is counting the row that says there is no employee. Count a column from the *right* table instead, because `COUNT(column)` skips NULLs:',
    ),
    code(
      sql(`
SELECT d.name AS department, COUNT(e.id) AS headcount
FROM departments d
LEFT JOIN employees e ON e.dept_id = d.id
GROUP BY d.name
ORDER BY headcount DESC;
`),
    ),
    result(
      ['department', 'headcount'],
      [
        ['Engineering', '`2`'],
        ['Data', '`2`'],
        ['Design', '`1`'],
        ['Legal', '**`0`**'],
      ],
      'Correct',
    ),
    note(
      'This is the practical payoff of `COUNT(*)` versus `COUNT(col)`. Over a `LEFT JOIN`, `COUNT(*)` is almost always wrong and `COUNT(right_table.some_column)` is almost always right. The same applies to `SUM` — it ignores NULLs, so a `SUM(e.salary)` over Legal gives `NULL`, and `COALESCE(SUM(e.salary), 0)` is what a report wants.',
    ),

    h('Chained LEFT JOINs'),
    code(
      sql(`
SELECT e.name AS employee, d.name AS department, m.name AS manager
FROM employees e
LEFT JOIN departments d ON e.dept_id    = d.id
LEFT JOIN employees   m ON e.manager_id = m.id
ORDER BY e.id;
`),
    ),
    result(
      ['employee', 'department', 'manager'],
      [
        ['Ada', 'Engineering', '`NULL`'],
        ['Grace', 'Engineering', 'Ada'],
        ['Linus', 'Data', 'Ada'],
        ['Barbara', 'Data', 'Ada'],
        ['Alan', 'Design', 'Barbara'],
        ['Radia', '`NULL`', 'Barbara'],
      ],
      'All 6 employees',
    ),
    p(
      'All six survive, with `NULL` wherever a fact is genuinely absent — Ada has no manager, Radia no department. The equivalent with two inner joins returned **four** rows. Same data, same intent, two people missing.',
    ),
    warn(
      'One `INNER JOIN` anywhere in the chain collapses every outer join before it, because it drops rows the earlier joins had carefully preserved. If the answer is "every employee, with whatever else we know", every join in the chain must be `LEFT`.',
    ),

    h('Interview'),
    asked([
      ['What does a LEFT JOIN return?', 'Every row from the left table, with the right-hand columns NULL where nothing matched.'],
      ['How many rows does it return?', 'At least as many as the left table — more if the right side matches more than once.'],
      ['LEFT vs RIGHT?', 'Which side is preserved. `A RIGHT JOIN B` is `B LEFT JOIN A`; prefer LEFT for readability.'],
      ['Why does my LEFT JOIN behave like an INNER JOIN?', 'A WHERE condition on the right-hand table — the padded NULLs fail it. Move it into ON.'],
      ['When is a WHERE on the right table correct?', 'When it is `IS NULL` — that is the anti-join, deliberately selecting the padded rows.'],
      ['How do you find rows with no match?', '`LEFT JOIN … WHERE right.pk IS NULL`, or `NOT EXISTS`.'],
      ['Which column should the IS NULL test use?', 'The right table’s primary key — only a padded row can have a NULL there.'],
      ['Why is COUNT(*) wrong over a LEFT JOIN?', 'It counts the padded row too, so an empty group shows 1. Use `COUNT(right.col)`.'],
      ['What does SUM return for an unmatched group?', 'NULL. Wrap it in COALESCE for 0.'],
      ['What happens if you mix INNER into a chain of LEFT JOINs?', 'It drops the rows the LEFT JOINs preserved, collapsing everything before it.'],
    ]),

    h('Cheatsheet'),
    cheat([
      ['Every row from the left, matched or not', '`LEFT JOIN`'],
      ['Attach something optional', '`LEFT JOIN`'],
      ['Filter the optional side', 'Put it in `ON`'],
      ['Filter the preserved side', 'Put it in `WHERE`'],
      ['Rows with no match', '`LEFT JOIN … WHERE right.pk IS NULL`'],
      ['Count per group, including empty groups', '`LEFT JOIN` + `COUNT(right.col)`'],
      ['Sum per group, showing 0 for empty', '`COALESCE(SUM(right.col), 0)`'],
      ['Preserve rows through several joins', 'Every join in the chain must be `LEFT`'],
    ]),

    links(
      mysqlDoc('outer-join-simplification.html', 'Outer join simplification (MySQL)'),
      mysqlDoc('join.html', 'JOIN syntax'),
    ),
  ],
};
