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
import { departments, employees } from './sample-data.js';

export const doc = {
  blocks: [
    p(
      'Two joins that come up less often and are asked about more than their usage justifies — `FULL OUTER JOIN` because MySQL does not have one, and `CROSS JOIN` because most people have only met it by accident.',
    ),
    employees(),
    departments(),

    h('FULL OUTER JOIN'),
    p(
      'Every row from **both** sides. Matched pairs join up; unmatched rows from either side appear once, padded with NULLs on the other. It is `LEFT` and `RIGHT` at the same time.',
    ),
    code(
      postgres(`
SELECT e.name AS employee, d.name AS department
FROM employees e
FULL OUTER JOIN departments d ON e.dept_id = d.id
ORDER BY d.id, e.id;
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
        ['**Radia**', '**`NULL`**'],
      ],
      '7 rows',
    ),
    p(
      '**Seven rows** — the five matches, plus Legal with no employee, plus Radia with no department. This is the only join that shows both problems at once, which is exactly what makes it the reconciliation tool: given two lists that should agree, it shows you everything in one and not the other, in one query.',
    ),

    h('MySQL has no FULL OUTER JOIN'),
    warn(
      'It is not supported, and never has been. Writing one is a syntax error. This is a favourite interview question precisely because the workaround shows whether you understand what the join *means*.',
    ),
    p('Emulate it with a `LEFT JOIN` and a `RIGHT JOIN` stacked by `UNION`:'),
    code(
      mysql(`
SELECT e.name AS employee, d.name AS department
FROM employees e
LEFT JOIN departments d ON e.dept_id = d.id

UNION

SELECT e.name, d.name
FROM employees e
RIGHT JOIN departments d ON e.dept_id = d.id;
`),
    ),
    p('Or, avoiding the deduplication cost, with `UNION ALL` and an anti-join for the second half:'),
    code(
      mysql(`
SELECT e.name AS employee, d.name AS department
FROM employees e
LEFT JOIN departments d ON e.dept_id = d.id

UNION ALL

-- Only the right-hand rows the LEFT JOIN could not have produced.
SELECT NULL, d.name
FROM departments d
WHERE NOT EXISTS (SELECT 1 FROM employees e WHERE e.dept_id = d.id);
`),
    ),
    tip(
      '`UNION` deduplicates, which is what makes the first version correct — the matched rows are produced by both halves and must not appear twice. That also makes it slower, because deduplicating means sorting or hashing the whole result. The second version produces no duplicates by construction, so `UNION ALL` is safe and there is nothing to deduplicate. On a large table that is a real difference, and knowing why is the better half of the answer.',
    ),
    warn(
      'The `UNION` version has a second trap: it deduplicates **on the whole row**, so two genuinely distinct employees who happen to share a name and a department would be collapsed into one. Select a key column as well, or use the `UNION ALL` form.',
    ),

    h('The reconciliation use case'),
    p('What a full outer join is actually for — comparing two sources that should match:'),
    code(
      postgres(`
SELECT
  COALESCE(a.id, b.id) AS id,
  a.amount             AS in_ledger,
  b.amount             AS in_bank,
  CASE
    WHEN a.id IS NULL          THEN 'missing from ledger'
    WHEN b.id IS NULL          THEN 'missing from bank'
    WHEN a.amount <> b.amount  THEN 'amounts differ'
  END AS problem
FROM ledger a
FULL OUTER JOIN bank b ON a.id = b.id
WHERE a.id IS NULL OR b.id IS NULL OR a.amount <> b.amount;
`),
    ),
    p(
      'One query, three kinds of discrepancy: in A only, in B only, and in both but disagreeing. No other join can produce all three.',
    ),

    h('CROSS JOIN'),
    p(
      'Every row of one table against every row of the other. **No condition** — that is the definition, not an omission. The result has `n × m` rows.',
    ),
    code(
      sql(`
SELECT e.name, d.name AS department
FROM employees e
CROSS JOIN departments d;
`),
    ),
    result(
      ['name', 'department'],
      [
        ['Ada', 'Engineering'],
        ['Ada', 'Data'],
        ['Ada', 'Design'],
        ['Ada', 'Legal'],
        ['Grace', 'Engineering'],
        ['…', '…'],
      ],
      '24 rows — 6 × 4',
    ),

    h('When it is deliberate'),
    p('Three genuine uses, and they are all "generate a complete grid":'),
    code(
      sql(`
-- 1. Every department × every month, so a report has a row even where there
--    were no sales — the classic "missing zeros" fix.
SELECT d.name, m.month, COALESCE(SUM(s.amount), 0) AS total
FROM departments d
CROSS JOIN (SELECT 1 AS month UNION SELECT 2 UNION SELECT 3) m
LEFT JOIN sales s ON s.dept_id = d.id AND s.month = m.month
GROUP BY d.name, m.month;

-- 2. A single constant applied to every row.
SELECT e.name, e.salary * c.rate AS in_usd
FROM employees e
CROSS JOIN (SELECT 0.012 AS rate) c;

-- 3. Generating rows — pairing a small table with a numbers table.
SELECT e.name, n.n FROM employees e CROSS JOIN numbers n WHERE n.n <= 3;
`),
    ),
    tip(
      'The first is the one worth remembering. A report grouped straight off a fact table has no row where nothing happened, so a chart shows a gap where it should show a zero. Cross-joining the dimensions to build the full grid and then `LEFT JOIN`ing the facts onto it gives every cell — and this is one of the most common real reporting patterns there is.',
    ),

    h('When it is an accident'),
    warn(
      'A cross join you did not ask for is the most expensive mistake in SQL. Two tables of a million rows produce a **trillion** rows; the query will not finish, and it will take the server\'s memory and temporary disk with it. It comes from exactly one thing: the comma join form with a forgotten or misspelled condition.',
    ),
    code(
      sql(`
-- No error, no warning. A cross product.
SELECT * FROM employees, departments;

-- The same, with a typo that broke the only condition connecting them.
SELECT * FROM employees e, departments d WHERE e.dept_id = e.id;
`),
    ),
    p(
      'That second one is the realistic version: `e.id` where `d.id` was meant. It is a valid predicate, it filters *something*, and it joins nothing. Writing `JOIN … ON` makes the connection structural — you cannot leave it out without a syntax error, and a wrong column in an `ON` clause is much easier to see than one buried in a `WHERE` full of genuine filters.',
    ),
    note(
      'Writing `CROSS JOIN` explicitly when you mean it is worth the extra word for the same reason. It tells the next reader — and the reviewer — that the missing condition is intentional rather than lost.',
    ),

    h('The five, side by side, on our data'),
    table(
      ['join', 'rows', 'Radia (no dept)', 'Legal (no staff)'],
      [
        ['`INNER JOIN`', '**5**', 'Dropped', 'Dropped'],
        ['`LEFT JOIN`', '**6**', '**Kept**, dept NULL', 'Dropped'],
        ['`RIGHT JOIN`', '**6**', 'Dropped', '**Kept**, employee NULL'],
        ['`FULL OUTER JOIN`', '**7**', '**Kept**', '**Kept**'],
        ['`CROSS JOIN`', '**24**', 'Paired with all 4', 'Paired with all 6'],
      ],
    ),

    h('Interview'),
    asked([
      ['What does FULL OUTER JOIN return?', 'Every row from both tables — matches joined, unmatched rows padded with NULL on the missing side.'],
      ['Does MySQL support it?', 'No. Emulate it with LEFT JOIN UNION RIGHT JOIN.'],
      ['Why UNION and not UNION ALL there?', 'The matched rows are produced by both halves; UNION deduplicates them. UNION ALL is safe only if the second half is an anti-join.'],
      ['What is FULL OUTER JOIN good for?', 'Reconciling two sources — it shows in-A-only, in-B-only and disagreeing rows in one query.'],
      ['What does CROSS JOIN return?', 'The cartesian product — every combination, n × m rows.'],
      ['When would you want one?', 'Generating a complete grid of dimensions before LEFT JOINing facts onto it, or applying a single constant to every row.'],
      ['How do accidental cross joins happen?', 'The comma join form with a missing or mistyped condition — no error, just a product.'],
      ['How many rows for 6 × 4?', '24.'],
      ['Is CROSS JOIN the same as an inner join with no ON?', 'Yes — an inner join whose condition is always true is a cross product.'],
    ]),

    h('Cheatsheet'),
    cheat([
      ['Everything from both sides', '`FULL OUTER JOIN`'],
      ['The same, in MySQL', '`LEFT JOIN` `UNION` `RIGHT JOIN`'],
      ['Compare two sources', '`FULL OUTER JOIN`, then `WHERE a.id IS NULL OR b.id IS NULL`'],
      ['Every combination', '`CROSS JOIN`'],
      ['A report row for every period, including empty ones', '`CROSS JOIN` the dimensions, then `LEFT JOIN` the facts'],
      ['One constant across all rows', '`CROSS JOIN (SELECT … ) c`'],
      ['Avoid an accidental product', 'Never use the comma form — always `JOIN … ON`'],
    ]),

    links(wiki('Join_(SQL)#Full_outer_join', 'Full outer join'), wiki('Cartesian_product', 'Cartesian product')),
  ],
};
