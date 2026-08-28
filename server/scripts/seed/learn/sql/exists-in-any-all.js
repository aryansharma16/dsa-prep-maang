import { asked, cheat, code, h, links, note, p, result, sql, table, tip, warn, wiki } from '../blocks.js';
import { departments, employees } from './sample-data.js';

export const doc = {
  blocks: [
    p(
      'Four ways to ask "is this value in that set?". They overlap heavily, they are asked about constantly, and they differ in exactly two respects that matter: **what they do with NULLs**, and **whether they stop at the first match**.',
    ),
    employees(),
    departments(),

    h('The four'),
    table(
      ['operator', 'asks', 'returns'],
      [
        ['`IN (set)`', 'Is the value equal to any member?', 'true / false / **NULL**'],
        ['`EXISTS (query)`', 'Did the query produce any row at all?', '**true / false only**'],
        ['`= ANY (set)`', 'Identical to `IN`.', 'true / false / NULL'],
        ['`> ALL (set)`', 'Is it greater than **every** member?', 'true / false / NULL'],
      ],
    ),
    note(
      'That middle row is the whole point of the topic. `EXISTS` is the only one of the four that can never return `NULL` — it asks whether a row *arrived*, and a row either arrived or it did not. There is no unknown. Everything else on this page follows from that.',
    ),

    h('IN'),
    code(
      sql(`
SELECT name FROM employees WHERE dept_id IN (1, 3);

SELECT name FROM employees
WHERE dept_id IN (SELECT id FROM departments WHERE location = 'Bengaluru');
`),
    ),
    result(['name'], [['Ada'], ['Grace'], ['Alan']], 'IN (1, 3)'),
    p('`IN` compares by equality against every member. It is a readable shorthand for a chain of `OR`s and produces the same plan.'),

    h('EXISTS'),
    code(
      sql(`
-- Departments that have at least one employee.
SELECT d.name FROM departments d
WHERE EXISTS (SELECT 1 FROM employees e WHERE e.dept_id = d.id);
`),
    ),
    result(['name'], [['Engineering'], ['Data'], ['Design']], 'Legal has nobody'),
    p(
      '`EXISTS` takes a **query**, not a set of values, and the query is almost always correlated — it references the outer row. The inner `SELECT` list is irrelevant and `SELECT 1` is conventional, because nothing reads it.',
    ),
    tip(
      'The mechanical difference: `IN` needs the whole inner result set to compare against, so it may materialise it. `EXISTS` short-circuits at the first row it finds. For a customer with fifty thousand orders, `EXISTS` reads one row and `COUNT(*) > 0` reads fifty thousand.',
    ),

    h('The NULL difference'),
    p('`IN` and `EXISTS` behave identically until a NULL appears. Then they diverge, and only one of them is still correct:'),
    table(
      ['expression', 'result', 'why'],
      [
        ['`5 IN (1, 5, NULL)`', '**true**', 'A match was found; the NULL never had to be considered.'],
        ['`5 IN (1, 2, NULL)`', '**NULL**', 'No match — but the NULL *might* have been 5, so the answer is unknown.'],
        ['`5 NOT IN (1, 2, NULL)`', '**NULL**', 'The negation of unknown is unknown. **Never true.**'],
        ['`NOT EXISTS (…)`', '**true / false**', 'A row was found or it was not. No unknown is possible.'],
      ],
    ),
    warn(
      'Row three is the bug. `NOT IN` over a subquery whose column contains even a single `NULL` returns **no rows at all** — not an error, not a warning, just an empty result. A report that should have listed two hundred customers lists none, and nothing anywhere records why.',
    ),
    code(
      sql(`
-- Departments with no employees, three ways.

-- 1. NOT IN — BROKEN. employees.dept_id contains a NULL (Radia's).
SELECT name FROM departments
WHERE id NOT IN (SELECT dept_id FROM employees);
-- 0 rows. Not "Legal".

-- 2. NOT IN, with the NULLs filtered out. Correct, and easy to forget.
SELECT name FROM departments
WHERE id NOT IN (SELECT dept_id FROM employees WHERE dept_id IS NOT NULL);

-- 3. NOT EXISTS. Correct by construction.
SELECT d.name FROM departments d
WHERE NOT EXISTS (SELECT 1 FROM employees e WHERE e.dept_id = d.id);
`),
    ),
    result(['name'], [['Legal']], 'Queries 2 and 3'),
    p(
      'Query 1 returns nothing on our data, and that is not a contrived example — `employees.dept_id` is nullable precisely because an employee may not have a department, which is an entirely ordinary schema.',
    ),
    tip(
      '**Default to `NOT EXISTS`.** It is correct whether or not NULLs are present, it short-circuits, and it needs no reasoning about the inner column. `NOT IN` is fine over a literal list you typed yourself, where you can see there is no NULL.',
    ),

    h('ANY and ALL'),
    p(
      'A comparison operator applied against a whole set. `ANY` is true if the comparison holds for **at least one** member; `ALL` if it holds for **every** member.',
    ),
    table(
      ['written', 'means', 'equivalent'],
      [
        ['`x = ANY (s)`', 'x equals some member', '`x IN (s)`'],
        ['`x <> ALL (s)`', 'x differs from every member', '`x NOT IN (s)`'],
        ['`x > ANY (s)`', 'x beats **at least one** member', '`x > (SELECT MIN(…) …)`'],
        ['`x > ALL (s)`', 'x beats **every** member', '`x > (SELECT MAX(…) …)`'],
      ],
    ),
    warn(
      'The two middle rows are the ones people get backwards, and the mnemonic is worth the sentence: **`> ANY` compares against the minimum, `> ALL` compares against the maximum.** To beat *someone* you only have to beat the weakest; to beat *everyone* you have to beat the strongest.',
    ),
    code(
      sql(`
-- Earning more than at least one person in Data (dept 2). Beat 74,000.
SELECT name, salary FROM employees
WHERE salary > ANY (SELECT salary FROM employees WHERE dept_id = 2);
`),
    ),
    result(
      ['name', 'salary'],
      [
        ['Ada', '`95000.00`'],
        ['Grace', '`82000.00`'],
        ['Barbara', '`91000.00`'],
        ['Radia', '`78000.00`'],
      ],
      'Beating the minimum of {74000, 91000}',
    ),
    code(
      sql(`
-- Earning more than everyone in Data. Beat 91,000.
SELECT name, salary FROM employees
WHERE salary > ALL (SELECT salary FROM employees WHERE dept_id = 2);
`),
    ),
    result(['name', 'salary'], [['Ada', '`95000.00`']], 'Beating the maximum of {74000, 91000}'),
    warn(
      '`ALL` has its own NULL trap, and it is the mirror of `NOT IN`. `x > ALL (1, 2, NULL)` is `NULL`, because the comparison against the NULL is unknown and `ALL` needs every one to be true. An empty set is the opposite edge: `x > ALL ()` is **true** — vacuously, since there is nothing to fail against — while `x > ANY ()` is **false**.',
    ),

    h('Choosing'),
    table(
      ['you want', 'use'],
      [
        ['Is it one of these literal values?', '`IN (a, b, c)`'],
        ['Is it in this list from another table?', '`IN (SELECT …)` or `EXISTS`'],
        ['Is it **not** in that list?', '**`NOT EXISTS`**'],
        ['Does a related row exist?', '`EXISTS` — never `COUNT(*) > 0`'],
        ['Beat the smallest of a set', '`> ANY`, or `> (SELECT MIN(…))`'],
        ['Beat the largest of a set', '`> ALL`, or `> (SELECT MAX(…))`'],
        ['Both tables’ columns in the result', 'A join, not any of these'],
      ],
    ),
    note(
      'That last row is worth stating plainly: `IN` and `EXISTS` are **filters**. They decide whether an outer row survives and contribute no columns to the result. If you need a value from the other table, you need a join — and a join is also what these often become internally, as a *semi-join*, which is the optimiser\'s name for "join, but stop at the first match and keep only the left columns".',
    ),

    h('Performance'),
    table(
      ['form', 'behaviour'],
      [
        ['`IN` with a literal list', 'Fast. Becomes a set of equality checks.'],
        ['`IN` with a subquery', 'Usually rewritten to a semi-join. Historically slow in MySQL 5.x; fine in 8.x.'],
        ['`EXISTS`', 'Short-circuits at the first match. Excellent when the inner side is indexed.'],
        ['`NOT IN` with a subquery', 'Cannot use an anti-join optimisation when NULLs are possible — and may be wrong.'],
        ['`NOT EXISTS`', 'Becomes an anti-join. The right default.'],
        ['`COUNT(*) > 0`', 'Reads every matching row to answer a yes/no question.'],
      ],
    ),
    p(
      'The old rule of thumb — "`EXISTS` for a large inner table, `IN` for a small one" — is largely obsolete on modern optimisers, which rewrite between the forms freely. Correctness with NULLs is the reason to prefer `NOT EXISTS`, and it has not changed at all.',
    ),

    h('Interview'),
    asked([
      ['IN vs EXISTS?', 'IN compares a value against a set; EXISTS asks whether a query returned any row. EXISTS short-circuits and never returns NULL.'],
      ['Why does NOT IN with a NULL return nothing?', 'It becomes a chain of `<>` including `<> NULL`, which is unknown — never true — so every row is rejected.'],
      ['Does NOT EXISTS have the same problem?', 'No. It asks whether a row was found, which is never unknown.'],
      ['What should you use to exclude a list?', 'NOT EXISTS, unless the list is a literal you wrote and can see has no NULL.'],
      ['What does `> ANY` compare against?', 'The minimum — beating at least one means beating the weakest.'],
      ['And `> ALL`?', 'The maximum.'],
      ['What is `= ANY` the same as?', 'IN.'],
      ['What is `<> ALL` the same as?', 'NOT IN — including its NULL problem.'],
      ['Why `SELECT 1` inside EXISTS?', 'The select list is never evaluated; only whether a row was produced matters.'],
      ['EXISTS or COUNT(*) > 0?', 'EXISTS — it stops at the first match rather than counting every one.'],
      ['What is `x > ALL ()` over an empty set?', 'True, vacuously. `x > ANY ()` is false.'],
    ]),

    h('Cheatsheet'),
    cheat([
      ['In a literal list', '`IN (a, b, c)`'],
      ['In a list from a query', '`IN (SELECT …)`'],
      ['Not in a list from a query', '`NOT EXISTS` — always'],
      ['A related row exists', '`EXISTS (SELECT 1 …)`'],
      ['No related row exists', '`NOT EXISTS`'],
      ['Better than the worst', '`> ANY` / `> (SELECT MIN …)`'],
      ['Better than the best', '`> ALL` / `> (SELECT MAX …)`'],
      ['Need columns from the other table', 'A join'],
    ]),

    links(
      wiki('Semi-join', 'Semi-join'),
      wiki('Null_(SQL)#Comparisons_with_NULL_and_the_three-valued_logic_(3VL)', 'NULL and 3VL'),
    ),
  ],
};
