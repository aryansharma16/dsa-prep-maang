import {
  asked,
  cheat,
  code,
  h,
  links,
  mysql,
  note,
  p,
  postgres,
  result,
  sql,
  table,
  tip,
  warn,
  wiki,
} from '../blocks.js';
import { employees } from './sample-data.js';

export const doc = {
  blocks: [
    p(
      'A join makes rows **wider**. A set operation makes the result **longer** — it stacks one result set on top of another. That is the whole distinction, and it is the answer to "what is the difference between a UNION and a JOIN", which is asked far more often than it deserves to be.',
    ),
    employees(),

    h('The four'),
    table(
      ['operation', 'returns', 'duplicates'],
      [
        ['`UNION`', 'Rows in either', '**Removed**'],
        ['`UNION ALL`', 'Rows in either', '**Kept**'],
        ['`INTERSECT`', 'Rows in both', 'Removed'],
        ['`EXCEPT` (`MINUS` in Oracle)', 'Rows in the first and not the second', 'Removed'],
      ],
    ),

    h('The rules'),
    p('All four require the two sides to line up, and the requirements are stricter than people expect:'),
    table(
      ['rule', 'detail'],
      [
        ['Same number of columns', 'Not negotiable — a mismatch is an error.'],
        ['Compatible types, in order', 'Matched by **position**, not by name. Column 2 meets column 2.'],
        ['Column names come from the first query', 'The second query’s aliases are ignored entirely.'],
        ['One `ORDER BY`, at the very end', 'It sorts the combined result. It cannot appear on an individual branch.'],
      ],
    ),
    warn(
      'Matching by position is the sharp edge. `SELECT name, salary` unioned with `SELECT salary, name` is not an error in a loosely-typed engine — it lines up name against salary and produces nonsense. Naming the columns in both branches, in the same order, is the only protection.',
    ),

    h('UNION vs UNION ALL'),
    code(
      sql(`
SELECT name FROM employees WHERE dept_id = 1
UNION
SELECT name FROM employees WHERE salary > 90000;
`),
    ),
    result(['name'], [['Ada'], ['Barbara'], ['Grace']], 'UNION — 3 rows'),
    p(
      'The first branch gives Ada and Grace; the second gives Ada and Barbara. **Ada is in both**, and `UNION` returns her once.',
    ),
    code(
      sql(`
SELECT name FROM employees WHERE dept_id = 1
UNION ALL
SELECT name FROM employees WHERE salary > 90000;
`),
    ),
    result(['name'], [['Ada'], ['Grace'], ['Ada'], ['Barbara']], 'UNION ALL — 4 rows'),
    tip(
      '**Use `UNION ALL` unless you actually need the deduplication.** `UNION` has to sort or hash the entire combined result to find duplicates, which on large sets is the dominant cost of the query. `UNION ALL` just concatenates. When the branches are disjoint by construction — different date ranges, different statuses, a partitioned table — there are no duplicates to remove and `UNION` is paying for nothing.',
    ),
    note(
      'Duplicate removal is on the **whole row**, not on any key. Two branches returning `(Ada, 95000)` and `(Ada, 82000)` are different rows and both survive a `UNION`. Add an id column and even genuinely identical-looking rows stop deduplicating — which is usually what you want, and is a common surprise.',
    ),

    h('INTERSECT'),
    code(
      postgres(`
SELECT name FROM employees WHERE dept_id = 1
INTERSECT
SELECT name FROM employees WHERE salary > 90000;
`),
    ),
    result(['name'], [['Ada']]),
    p('In department 1 **and** earning over 90,000. Only Ada.'),

    h('EXCEPT'),
    code(
      postgres(`
SELECT name FROM employees WHERE dept_id = 1
EXCEPT
SELECT name FROM employees WHERE salary > 90000;
`),
    ),
    result(['name'], [['Grace']]),
    p('In department 1 but **not** earning over 90,000. Ada is removed; Grace remains.'),
    warn(
      '`EXCEPT` is **not** symmetric. `A EXCEPT B` and `B EXCEPT A` are different questions with different answers — the second here returns Barbara. `UNION` and `INTERSECT` are symmetric; this one is not, and swapping the operands is a real bug rather than a style choice.',
    ),

    h('MySQL before 8.0.31'),
    warn(
      '`INTERSECT` and `EXCEPT` arrived in MySQL **8.0.31**. Older versions have only `UNION` and `UNION ALL`, and interviewers who learned on MySQL 5.7 still ask how to work around it.',
    ),
    code(
      mysql(`
-- INTERSECT, via an inner join.
SELECT DISTINCT a.name
FROM (SELECT name FROM employees WHERE dept_id = 1) a
JOIN (SELECT name FROM employees WHERE salary > 90000) b ON a.name = b.name;

-- INTERSECT, via IN.
SELECT DISTINCT name FROM employees WHERE dept_id = 1
  AND name IN (SELECT name FROM employees WHERE salary > 90000);

-- EXCEPT, via an anti-join. NOT EXISTS rather than NOT IN — see the NULL topic.
SELECT DISTINCT a.name
FROM employees a
WHERE a.dept_id = 1
  AND NOT EXISTS (SELECT 1 FROM employees b WHERE b.salary > 90000 AND b.name = a.name);
`),
    ),

    h('Ordering and limiting the combined result'),
    code(
      sql(`
-- One ORDER BY, at the end. It applies to the whole thing.
SELECT name, salary FROM employees WHERE dept_id = 1
UNION ALL
SELECT name, salary FROM employees WHERE dept_id = 2
ORDER BY salary DESC
LIMIT 3;

-- To sort or limit a single branch, wrap it.
(SELECT name FROM employees WHERE dept_id = 1 ORDER BY salary DESC LIMIT 1)
UNION ALL
(SELECT name FROM employees WHERE dept_id = 2 ORDER BY salary DESC LIMIT 1);
`),
    ),
    result(
      ['name', 'salary'],
      [
        ['Ada', '`95000.00`'],
        ['Barbara', '`91000.00`'],
        ['Grace', '`82000.00`'],
      ],
      'The first query',
    ),
    p('The second returns the top earner from each of the two departments — Ada and Barbara — which is a genuinely useful shape when the branches are small and independent.'),

    h('Tagging where a row came from'),
    p('`UNION ALL` loses track of which branch produced a row. Add a literal column and it does not:'),
    code(
      sql(`
SELECT 'engineering' AS source, name, salary FROM employees WHERE dept_id = 1
UNION ALL
SELECT 'well paid',    name, salary FROM employees WHERE salary > 90000
ORDER BY source, salary DESC;
`),
    ),
    result(
      ['source', 'name', 'salary'],
      [
        ['engineering', 'Ada', '`95000.00`'],
        ['engineering', 'Grace', '`82000.00`'],
        ['well paid', 'Ada', '`95000.00`'],
        ['well paid', 'Barbara', '`91000.00`'],
      ],
    ),
    tip(
      'The tag also makes `UNION ALL` safe where you might have reached for `UNION`: with a distinct literal in each branch, no row can be a duplicate of one from the other branch, so there is nothing for `UNION` to remove and you can stop paying for the check.',
    ),

    h('UNION or JOIN'),
    table(
      ['', '`JOIN`', '`UNION`'],
      [
        ['Direction', 'Wider — adds columns', 'Longer — adds rows'],
        ['Inputs', 'Two tables, related by a key', 'Two result sets with the same shape'],
        ['Requires', 'A join condition', 'Matching column counts and types'],
        ['Typical use', 'Attach related facts', 'Combine similar lists from different places'],
        ['Result columns', 'Both sides’', 'One side’s'],
      ],
    ),
    p(
      'The everyday use of `UNION ALL` is combining rows that live in different tables but mean the same thing — an archive table with a live one, this year\'s partition with last year\'s, or several sources feeding one report.',
    ),
    code(
      sql(`
SELECT id, name, salary, 'current' AS status FROM employees
UNION ALL
SELECT id, name, salary, 'former'  AS status FROM employees_archive
ORDER BY name;
`),
    ),

    h('Interview'),
    asked([
      ['UNION vs UNION ALL?', 'UNION removes duplicate rows; UNION ALL keeps them and is faster because it does not have to look.'],
      ['Which should you default to?', 'UNION ALL, unless duplicates are actually possible and unwanted.'],
      ['UNION vs JOIN?', 'JOIN combines columns from related tables; UNION stacks rows from similarly-shaped results.'],
      ['What are the requirements for a UNION?', 'Same column count, compatible types in the same positions.'],
      ['Where do the result column names come from?', 'The first branch. The second’s aliases are ignored.'],
      ['Are columns matched by name or position?', 'Position. Swapping two columns in the second branch is silently wrong.'],
      ['Can each branch have its own ORDER BY?', 'Not directly — wrap the branch in parentheses. One ORDER BY at the end sorts the whole result.'],
      ['Is EXCEPT symmetric?', 'No. `A EXCEPT B` and `B EXCEPT A` are different questions.'],
      ['Does MySQL support INTERSECT?', 'Only from 8.0.31. Before that, emulate it with a join or IN.'],
      ['How do you emulate EXCEPT?', 'An anti-join — `NOT EXISTS`, not `NOT IN` if NULLs are possible.'],
      ['How do you know which branch a row came from?', 'Select a literal tag column in each branch.'],
    ]),

    h('Cheatsheet'),
    cheat([
      ['Stack two result sets', '`UNION ALL`'],
      ['Stack them and deduplicate', '`UNION`'],
      ['Rows in both', '`INTERSECT`, or a join'],
      ['Rows in the first only', '`EXCEPT`, or `NOT EXISTS`'],
      ['Combine live and archive tables', '`UNION ALL` with a tag column'],
      ['Sort the combined result', 'One `ORDER BY`, at the end'],
      ['Sort one branch', 'Wrap it in parentheses'],
      ['Emulate FULL OUTER JOIN in MySQL', '`LEFT JOIN` `UNION` `RIGHT JOIN`'],
    ]),

    links(wiki('Set_operations_(SQL)', 'Set operations in SQL'), wiki('Union_(SQL)', 'UNION')),
  ],
};
