/**
 * Window functions — rank, running totals and the previous row, without
 * collapsing anything.
 *
 * Three problems that between them cover the whole reason the feature exists:
 * a per-group figure beside each row, top-N per group, and comparing a row to
 * its neighbour. Every one of them is painful without windows and short with
 * them, which is the most persuasive way to teach a tool.
 */

export default [
  {
    slug: 'rank-within-department',
    title: 'Rank within your department',
    category: 'window',
    difficulty: 'Medium',
    statement:
      'Return every employee as `name`, `dept_id`, `salary` and their `rank` **within their own department**, best-paid first.\n\nRanks restart at 1 in each department. Order the result by `dept_id`, then by rank.',
    setupSql: `
CREATE TABLE employees (
  id      INTEGER PRIMARY KEY,
  name    TEXT NOT NULL,
  dept_id INTEGER NOT NULL,
  salary  INTEGER NOT NULL
);
INSERT INTO employees VALUES
  (1, 'Ada',       1, 95000),
  (2, 'Grace',     1, 82000),
  (3, 'Hedy',      1, 82000),
  (4, 'Linus',     2, 74000),
  (5, 'Barbara',   2, 91000),
  (6, 'Alan',      3, 68000);
`,
    solutionSql: `
SELECT name, dept_id, salary,
       RANK() OVER (PARTITION BY dept_id ORDER BY salary DESC) AS rank
FROM employees
ORDER BY dept_id, rank, name;`,
    expectRows: 6,
    orderMatters: true,
    hints: [
      'Six rows in, six rows out — this is not a GROUP BY.',
      '`PARTITION BY dept_id` is what makes the numbering restart in each department.',
      'Grace and Hedy earn the same. The question says they share a rank, so `RANK`, not `ROW_NUMBER`.',
    ],
    explanation:
      'Grace and Hedy both earn 82,000, and what happens to them is the whole question. `RANK()` gives them both 2 and then skips to 4 for the next row. `DENSE_RANK()` would give them both 2 and continue at 3. `ROW_NUMBER()` would give one of them 2 and the other 3, chosen arbitrarily — and *arbitrarily* means it can change between runs.\n\nChoosing between the three is really choosing what to do about ties, which is a question worth asking before writing any of them.',
    learnTopic: 'sql/window-functions',
    topicTags: ['window', 'rank', 'partition', 'ties'],
  },

  {
    slug: 'top-earner-per-department',
    title: 'The top earner in each department',
    category: 'window',
    difficulty: 'Medium',
    statement:
      'Return the best-paid employee in each department as `name`, `dept_id` and `salary` — **exactly one row per department**, ordered by `dept_id`.\n\nWhere two people tie for the top, take the one with the lower `id`.',
    setupSql: `
CREATE TABLE employees (
  id      INTEGER PRIMARY KEY,
  name    TEXT NOT NULL,
  dept_id INTEGER NOT NULL,
  salary  INTEGER NOT NULL
);
INSERT INTO employees VALUES
  (1, 'Ada',       1, 95000),
  (2, 'Grace',     1, 82000),
  (3, 'Linus',     2, 91000),
  (4, 'Barbara',   2, 91000),
  (5, 'Alan',      3, 68000),
  (6, 'Katherine', 3, 88000);
`,
    solutionSql: `
SELECT name, dept_id, salary FROM (
  SELECT name, dept_id, salary,
         ROW_NUMBER() OVER (PARTITION BY dept_id ORDER BY salary DESC, id ASC) AS rn
  FROM employees
) ranked
WHERE rn = 1
ORDER BY dept_id;`,
    expectRows: 3,
    orderMatters: true,
    hints: [
      'Number the rows within each department, then keep the first of each.',
      'You cannot filter on a window function in the same query — WHERE runs before it is computed. Wrap it.',
      'Linus and Barbara both earn 91,000, and the question says the lower `id` wins. Put `id` in the ORDER BY.',
    ],
    explanation:
      'The most reused window pattern there is — rank inside the partition, then filter the rank in an **outer** query. The wrap is not a workaround: window functions are computed after `WHERE`, so `WHERE ROW_NUMBER() OVER (…) = 1` is an error, and there is no order in which that question can be asked in one query.\n\n`ROW_NUMBER` rather than `RANK` because the question asks for exactly one row per department; `RANK() = 1` would return both Linus and Barbara. The `, id ASC` makes which one deterministic — without it the engine picks, and it may pick differently tomorrow.',
    learnTopic: 'sql/window-functions',
    topicTags: ['window', 'row-number', 'top-n', 'partition'],
  },

  {
    slug: 'running-total-by-day',
    title: 'A running total',
    category: 'window',
    difficulty: 'Medium',
    statement:
      'Return each order as `placed_on`, `total`, and a `running_total` of every order up to and including that one, oldest first.\n\nNo two orders share a date.',
    setupSql: `
CREATE TABLE orders (
  id        INTEGER PRIMARY KEY,
  total     INTEGER NOT NULL,
  placed_on TEXT NOT NULL
);
INSERT INTO orders VALUES
  (1, 4200, '2024-01-04'),
  (2, 1800, '2024-01-06'),
  (3, 990,  '2024-01-11'),
  (4, 7600, '2024-02-02'),
  (5, 2400, '2024-02-19');
`,
    solutionSql: `
SELECT placed_on, total,
       SUM(total) OVER (ORDER BY placed_on) AS running_total
FROM orders
ORDER BY placed_on;`,
    expectRows: 5,
    orderMatters: true,
    hints: [
      'The same `SUM` you already know, with an `OVER` clause on it.',
      'Adding `ORDER BY` inside `OVER` changes what SUM means — from the grand total to everything up to this row.',
      'The last row should equal the sum of every order. That is the check.',
    ],
    explanation:
      'One clause changes everything. `SUM(total) OVER ()` puts the grand total on every row; `SUM(total) OVER (ORDER BY placed_on)` is a **running** total that differs on every row — because adding an `ORDER BY` silently changes the default frame from the whole partition to "everything up to and including the current row".\n\nNothing warns you about that, and it is the most common way a window function quietly returns a different number than intended. The check is the last row: a correct running total ends at the grand total, 17,000 here.',
    learnTopic: 'sql/window-frames-lag-lead',
    topicTags: ['window', 'running-total', 'frame'],
  },

  {
    slug: 'median-salary',
    title: 'The median salary in each department',
    category: 'window',
    difficulty: 'Hard',
    statement:
      'Return the **median** salary of each department as `median`, ordered by `dept_id`.\n\nThe median is the middle value once the salaries are sorted — and where there is an even number of them, the average of the middle two.\n\nOne department here has four people and one has three, so both cases are in the answer.',
    setupSql: `
CREATE TABLE employees (
  id      INTEGER PRIMARY KEY,
  name    TEXT NOT NULL,
  dept_id INTEGER NOT NULL,
  salary  INTEGER NOT NULL
);
INSERT INTO employees VALUES
  (1, 'Ada',     1,  60000),
  (2, 'Grace',   1,  70000),
  (3, 'Linus',   1,  80000),
  (4, 'Barbara', 1, 100000),
  (5, 'Radia',   2,  50000),
  (6, 'Alan',    2,  90000),
  (7, 'Katherine', 2, 110000);
`,
    solutionSql: `
WITH ranked AS (
  SELECT dept_id,
         salary,
         ROW_NUMBER() OVER (PARTITION BY dept_id ORDER BY salary) AS pos,
         COUNT(*)     OVER (PARTITION BY dept_id)                 AS n
  FROM employees
)
SELECT dept_id, AVG(salary) AS median
FROM ranked
WHERE pos IN (FLOOR((n + 1) / 2), FLOOR((n + 2) / 2))
GROUP BY dept_id
ORDER BY dept_id;`,
    expectRows: 2,
    orderMatters: true,
    hints: [
      'There is no `MEDIAN` function. Number the rows within each department and pick the middle position or positions.',
      '`ROW_NUMBER() OVER (PARTITION BY dept_id ORDER BY salary)` gives the position; a second window function gives the size of the group without a second query.',
      'For a group of size n the middle positions are `FLOOR((n+1)/2)` and `FLOOR((n+2)/2)` — the same number when n is odd, two adjacent ones when it is even.',
      'Averaging the one or two rows you kept handles both cases with no `CASE` at all.',
    ],
    explanation:
      'Median is the standard "there is no function for this" interview question, and the answer is worth knowing as a shape rather than as a formula.\n\n**Two window functions over the same partition.** `ROW_NUMBER()` says where each salary sits in its department once sorted; `COUNT(*) OVER (PARTITION BY dept_id)` says how many there are. Both are computed in one pass over one sorted stream — the alternative, a correlated subquery counting the group for every row, does the same work once per employee.\n\n**The middle-position trick.** `FLOOR((n+1)/2)` and `FLOOR((n+2)/2)` collapse to the same number for odd n and to the two adjacent middles for even n. Department 2 has three people, so both expressions give 2 and only Alan\'s 90,000 is kept. Department 1 has four, so they give 2 and 3 — Grace and Linus — and `AVG` produces 75,000. No branching, and no special case to get wrong.\n\n**`AVG` finishes it.** Averaging one row returns that row, so the same aggregate handles both parities. That is the part worth pointing at in an interview: the query has no `CASE WHEN n % 2` in it, and it does not need one.\n\nPostgreSQL has `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY salary)`, which is this problem as a function call. MySQL and SQLite have nothing equivalent, so this is the portable answer.',
    dialectNote:
      '`FLOOR` is written explicitly because integer division differs: in SQLite and PostgreSQL `5 / 2` is already 2, while MySQL returns 2.5 and would match no row at all. `FLOOR` gives the same answer on all three.',
    learnTopic: 'sql/window-functions',
    topicTags: ['row-number', 'partition-by', 'median', 'window-count'],
  },

  {
    slug: 'three-days-in-a-row',
    title: 'Three days in a row',
    category: 'window',
    difficulty: 'Medium',
    statement:
      'Return the `user_id` of everybody who logged in on **three consecutive days**, lowest id first.\n\nSomebody logging in twice on one day has still only covered that one day.',
    setupSql: `
CREATE TABLE logins (
  id      INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  day     TEXT NOT NULL
);
INSERT INTO logins (user_id, day) VALUES
  (1, '2024-05-01'), (1, '2024-05-02'), (1, '2024-05-02'), (1, '2024-05-03'),
  (2, '2024-05-01'), (2, '2024-05-02'), (2, '2024-05-04'), (2, '2024-05-05'),
  (3, '2024-05-05'), (3, '2024-05-06'), (3, '2024-05-07'), (3, '2024-05-08');
`,
    solutionSql: `
WITH days AS (
  SELECT DISTINCT user_id, day FROM logins
),
walked AS (
  SELECT user_id,
         day,
         LAG(day, 1) OVER (PARTITION BY user_id ORDER BY day) AS prev1,
         LAG(day, 2) OVER (PARTITION BY user_id ORDER BY day) AS prev2
  FROM days
)
SELECT DISTINCT user_id
FROM walked
WHERE DATEDIFF(day, prev1) = 1
  AND DATEDIFF(prev1, prev2) = 1
ORDER BY user_id;`,
    expectRows: 2,
    orderMatters: true,
    hints: [
      'User 1 has four login rows but only three distinct days. Deduplicate before doing anything else.',
      '`LAG(day, 1)` and `LAG(day, 2)` put three consecutive days on the same row.',
      'Then it is two subtractions: each gap has to be exactly one day.',
      'A user can hit the condition more than once, so the final `DISTINCT` is not decoration.',
    ],
    explanation:
      '"Consecutive" questions are all the same move: **get the neighbouring rows onto the current row, then compare them as ordinary columns.** `LAG(day, 1)` and `LAG(day, 2)` do that in one pass, and after them the condition is arithmetic rather than SQL.\n\nThree details decide whether it is right.\n\nThe `DISTINCT` in `days` comes first. User 1 logged in twice on 2024-05-02, so without it their rows are 05-01, 05-02, 05-02, 05-03 — and the window sees a gap of zero days where there is really a gap of one. Deduplicating the grain before applying a window is a habit worth having: a window function trusts the rows it is given.\n\n**Consecutive rows and consecutive days are different questions.** User 2 has four rows on 05-01, 05-02, 05-04, 05-05 — three in a row by position, never three days in a row. Comparing the dates rather than counting the rows is the difference, and it is also why user 2 is deliberately in the sample.\n\nAnd the last `DISTINCT`: user 3 has four consecutive days, so the condition holds on two different rows. Without it they appear twice.\n\nThe classic alternative, worth knowing because it generalises to runs of any length, is the **gaps-and-islands** trick: subtract the row number from the date and every consecutive run collapses to the same value, which can then be grouped and counted.',
    dialectNote:
      '`DATEDIFF(later, earlier)` is MySQL\'s argument order, and the Lab shims it so the same query runs here. Note that PostgreSQL has no `DATEDIFF` at all — there it is `day::date - prev1::date`.',
    learnTopic: 'sql/window-frames-lag-lead',
    topicTags: ['lag', 'consecutive', 'dates', 'distinct'],
  },

  {
    slug: 'gaps-in-the-numbering',
    title: 'Find the gaps in the invoice numbers',
    category: 'window',
    difficulty: 'Medium',
    statement:
      'Invoice numbers should run without gaps. Some are missing.\n\nReturn each gap as two columns — `after_id`, the last number before the gap, and `before_id`, the first one after it — ordered by `after_id`.',
    setupSql: `
CREATE TABLE invoices (
  id     INTEGER PRIMARY KEY,
  amount INTEGER NOT NULL
);
INSERT INTO invoices VALUES
  (1,  120),
  (2,  340),
  (3,   90),
  (7,  510),
  (8,  260),
  (12, 730);
`,
    solutionSql: `
SELECT after_id, before_id
FROM (
  SELECT id AS after_id,
         LEAD(id) OVER (ORDER BY id) AS before_id
  FROM invoices
) AS neighbours
WHERE before_id - after_id > 1
ORDER BY after_id;`,
    expectRows: 2,
    orderMatters: true,
    hints: [
      'A gap is visible from two adjacent rows — bring the next id onto the current row.',
      '`LEAD(id) OVER (ORDER BY id)` is the next id.',
      'A gap is where the difference between them is more than 1. The last row has no next id, and that comparison is NULL, which is not true — so it drops out on its own.',
    ],
    explanation:
      'The whole query is `LEAD`. Once the next id is a column on the same row, "is there a gap" is `next - current > 1`, which is arithmetic.\n\nThe last row deserves a moment. Invoice 12 has no successor, so `LEAD` returns NULL and `NULL - 12 > 1` evaluates to unknown. `WHERE` keeps only rows that are **true**, and unknown is not true, so the row drops out without a guard. That is one of the rare places where SQL\'s three-valued logic does exactly what you wanted — worth recognising, because the same reasoning is what makes `NOT IN` dangerous elsewhere.\n\nThe derived table exists because a window function cannot be used in the `WHERE` of the query that computes it: `WHERE LEAD(id) OVER (…) - id > 1` is a syntax error everywhere. Windows are evaluated after `WHERE`, so filtering on one always needs a subquery, a CTE, or `QUALIFY` on the engines that have it.\n\nNote what this query does **not** answer: it reports the gaps, not the missing numbers. Listing 4, 5, 6 individually needs a source of rows that do not exist in the table — a numbers table, or `generate_series` on PostgreSQL, or a recursive CTE. That distinction is usually the follow-up question.',
    learnTopic: 'sql/window-frames-lag-lead',
    topicTags: ['lead', 'gaps', 'null', 'derived-table'],
  },
];
