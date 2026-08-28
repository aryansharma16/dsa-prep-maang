import { asked, cheat, code, h, links, note, p, result, sql, table, tip, warn, wiki } from '../blocks.js';
import { employees } from './sample-data.js';

export const doc = {
  blocks: [
    p(
      'A **self join** is a table joined to itself. There is no `SELF JOIN` keyword — it is an ordinary `INNER` or `LEFT` join where both sides happen to be the same table, and the only thing that makes it work is **aliases**, which let the query talk about two different rows of one table at once.',
    ),
    p('Two situations need it, and between them they cover most of its use: **hierarchies** stored in one table, and **comparing a row against other rows** in the same table.'),
    employees(),
    p('`manager_id` points back at `employees.id`. Ada manages Grace, Linus and Barbara; Barbara manages Alan and Radia; Ada answers to nobody.'),

    h('Everyone, with their manager'),
    code(
      sql(`
SELECT e.name AS employee, m.name AS manager
FROM employees e
LEFT JOIN employees m ON e.manager_id = m.id
ORDER BY e.id;
`),
    ),
    result(
      ['employee', 'manager'],
      [
        ['Ada', '`NULL`'],
        ['Grace', 'Ada'],
        ['Linus', 'Ada'],
        ['Barbara', 'Ada'],
        ['Alan', 'Barbara'],
        ['Radia', 'Barbara'],
      ],
      '6 rows',
    ),
    warn(
      '`LEFT`, not `INNER`, and the reason is the first row. Ada has no `manager_id`, so an inner join would drop her — and Ada is the CEO. "List every employee with their manager" answered with an inner join silently omits whoever is at the top, which is the one person nobody notices is missing from a staff list.',
    ),
    note(
      'The aliases are doing all the work. `e` and `m` are the same table, and the query is meaningless without them — `employees.name` would be ambiguous and there would be no way to say "the name from the *other* row". Choose aliases that say which role each copy is playing: `e`/`m` for employee and manager reads better than `e1`/`e2`.',
    ),

    h('Managers and their team sizes'),
    code(
      sql(`
SELECT m.name AS manager, COUNT(e.id) AS reports
FROM employees m
LEFT JOIN employees e ON e.manager_id = m.id
GROUP BY m.id, m.name
ORDER BY reports DESC, m.name;
`),
    ),
    result(
      ['manager', 'reports'],
      [
        ['Ada', '`3`'],
        ['Barbara', '`2`'],
        ['Alan', '`0`'],
        ['Grace', '`0`'],
        ['Linus', '`0`'],
        ['Radia', '`0`'],
      ],
    ),
    p(
      'The join is the other way round: `m` is preserved and `e` is optional, so everyone appears including those managing nobody. `COUNT(e.id)` rather than `COUNT(*)` is what makes the zeros correct — the same trap as any `LEFT JOIN` aggregate.',
    ),

    h('Comparing a row against its peers'),
    p('The other family of self joins. Every pair of people in the same department:'),
    code(
      sql(`
SELECT a.name AS person, b.name AS colleague, a.dept_id
FROM employees a
JOIN employees b ON a.dept_id = b.dept_id AND a.id < b.id
ORDER BY a.dept_id;
`),
    ),
    result(
      ['person', 'colleague', 'dept_id'],
      [
        ['Ada', 'Grace', '`1`'],
        ['Linus', 'Barbara', '`2`'],
      ],
    ),
    tip(
      '`a.id < b.id` rather than `a.id <> b.id` is the trick, and it does two jobs at once. `<>` would return each pair **twice** — (Ada, Grace) and (Grace, Ada) — because both orderings satisfy it. `<` picks one ordering, halving the result and removing the duplication. It also excludes the row pairing someone with themselves, which `=` would have allowed.',
    ),

    h('Employees earning more than their manager'),
    p('A genuine interview question, and a self join is the natural answer:'),
    code(
      sql(`
SELECT e.name AS employee, e.salary, m.name AS manager, m.salary AS manager_salary
FROM employees e
JOIN employees m ON e.manager_id = m.id
WHERE e.salary > m.salary;
`),
    ),
    p('The pairs the join produces, and how each one fares:'),
    result(
      ['employee', 'salary', 'manager', 'manager_salary', 'kept?'],
      [
        ['Grace', '`82000.00`', 'Ada', '`95000.00`', 'no'],
        ['Linus', '`74000.00`', 'Ada', '`95000.00`', 'no'],
        ['Barbara', '`91000.00`', 'Ada', '`95000.00`', 'no'],
        ['Alan', '`68000.00`', 'Barbara', '`91000.00`', 'no'],
        ['Radia', '`78000.00`', 'Barbara', '`91000.00`', 'no'],
      ],
      'Before the WHERE — 5 rows, then 0',
    ),
    warn(
      '**The answer is empty**, and deliberately so: on this data nobody out-earns their manager. Ada is not in the list at all, because the `INNER JOIN` dropped her — she has no manager — which is correct here, since a person with no manager cannot out-earn one. An empty result is a valid answer, and being able to walk the pairs and say *why* it is empty is worth more in an interview than a query that happens to return rows.',
    ),

    h('Comparing consecutive rows'),
    p(
      'Before window functions, comparing a row to the one before it meant a self join on an arithmetic relationship between keys:',
    ),
    code(
      sql(`
-- Each employee beside the person hired immediately before them.
SELECT curr.name, curr.hired_on, prev.name AS hired_before
FROM employees curr
LEFT JOIN employees prev
  ON prev.hired_on = (
       SELECT MAX(hired_on) FROM employees x WHERE x.hired_on < curr.hired_on
     )
ORDER BY curr.hired_on;
`),
    ),
    result(
      ['name', 'hired_on', 'hired_before'],
      [
        ['Barbara', '`2018-11-02`', '`NULL`'],
        ['Ada', '`2019-03-04`', 'Barbara'],
        ['Grace', '`2020-07-15`', 'Ada'],
        ['Linus', '`2021-01-11`', 'Grace'],
        ['Alan', '`2022-05-30`', 'Linus'],
        ['Radia', '`2023-02-20`', 'Alan'],
      ],
    ),
    tip(
      '`LAG()` does this in one line, correctly, and without the correlated subquery — see the window-functions topic. The self-join version is worth having seen because it is what a lot of existing code looks like, and because interviewers who learned SQL before 2018 still ask for it. The window version is what you should write.',
    ),

    h('The three-or-more-consecutive problem'),
    p(
      'The other classic. Given a table of readings, find values that appear three times in a row. The self-join answer joins the table to itself twice on adjacent ids:',
    ),
    code(
      sql(`
SELECT DISTINCT a.num AS consecutive_value
FROM logs a
JOIN logs b ON b.id = a.id + 1 AND b.num = a.num
JOIN logs c ON c.id = a.id + 2 AND c.num = a.num;
`),
    ),
    warn(
      'This works only if `id` has **no gaps**. One deleted row and the arithmetic breaks — `id + 1` points at nothing and a genuine run is missed. That fragility is exactly why `ROW_NUMBER()` exists: number the rows yourself and the numbering is contiguous by construction, whatever the ids do.',
    ),

    h('A hierarchy is only as deep as the joins'),
    code(
      sql(`
-- Three levels. Each extra level is another LEFT JOIN.
SELECT e.name, m.name AS manager, mm.name AS skip_level
FROM employees e
LEFT JOIN employees m  ON e.manager_id = m.id
LEFT JOIN employees mm ON m.manager_id = mm.id
ORDER BY e.id;
`),
    ),
    result(
      ['name', 'manager', 'skip_level'],
      [
        ['Ada', '`NULL`', '`NULL`'],
        ['Grace', 'Ada', '`NULL`'],
        ['Linus', 'Ada', '`NULL`'],
        ['Barbara', 'Ada', '`NULL`'],
        ['Alan', 'Barbara', 'Ada'],
        ['Radia', 'Barbara', 'Ada'],
      ],
    ),
    note(
      'The limitation is structural: **a self join can only walk a fixed number of levels**, because each level is a join you had to write. A five-level org chart needs five joins, and an org chart of unknown depth cannot be written this way at all. That is what a **recursive CTE** is for, and it is the topic after next.',
    ),

    h('Interview'),
    asked([
      ['What is a self join?', 'A table joined to itself using aliases, so one query can refer to two different rows of it.'],
      ['Is there a SELF JOIN keyword?', 'No — it is an ordinary INNER or LEFT join where both sides are the same table.'],
      ['Why are aliases mandatory?', 'Without them every column reference is ambiguous and there is no way to name the other row.'],
      ['How do you list employees with their managers?', 'LEFT JOIN the table to itself on `e.manager_id = m.id` — LEFT, so the person at the top survives.'],
      ['Why `a.id < b.id` when pairing rows?', 'It returns each pair once instead of twice, and excludes pairing a row with itself.'],
      ['How do you find employees earning more than their manager?', 'Self join on manager_id, then `WHERE e.salary > m.salary`.'],
      ['How deep a hierarchy can a self join walk?', 'Exactly as many levels as you wrote joins. Unknown depth needs a recursive CTE.'],
      ['What is the problem with joining on `id + 1`?', 'It assumes there are no gaps. One deleted row breaks it — use ROW_NUMBER instead.'],
      ['What has replaced self joins for adjacent-row comparisons?', 'LAG and LEAD window functions.'],
    ]),

    h('Cheatsheet'),
    cheat([
      ['Each row with its parent', '`LEFT JOIN t p ON t.parent_id = p.id`'],
      ['Count children per parent', 'Join the other way, `COUNT(child.id)`'],
      ['Every pair within a group', '`JOIN … ON a.grp = b.grp AND a.id < b.id`'],
      ['Rows beating their parent on some value', 'Self join, then compare in `WHERE`'],
      ['The previous row', '`LAG()` — not a self join'],
      ['A hierarchy of unknown depth', 'A recursive CTE — not a self join'],
      ['N levels up', 'N chained `LEFT JOIN`s'],
    ]),

    links(wiki('Join_(SQL)#Self-join', 'Self join'), wiki('Hierarchical_query', 'Hierarchical queries')),
  ],
};
