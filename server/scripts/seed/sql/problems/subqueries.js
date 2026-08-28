/**
 * Subqueries & CTEs — a query inside a query, and naming one so the whole
 * thing reads.
 *
 * The category where the same answer can be written three ways with very
 * different costs, so the explanations spend their words on *which* to reach
 * for rather than on syntax.
 */

export default [
  {
    slug: 'above-company-average',
    title: 'Paid above the company average',
    category: 'subqueries',
    difficulty: 'Easy',
    statement:
      'Return the `name` and `salary` of every employee paid **more than the company average**, highest first.',
    setupSql: `
CREATE TABLE employees (
  id     INTEGER PRIMARY KEY,
  name   TEXT NOT NULL,
  salary INTEGER NOT NULL
);
INSERT INTO employees VALUES
  (1, 'Ada',     95000),
  (2, 'Grace',   82000),
  (3, 'Linus',   74000),
  (4, 'Barbara', 91000),
  (5, 'Alan',    68000),
  (6, 'Radia',   78000);
`,
    solutionSql: `
SELECT name, salary FROM employees
WHERE salary > (SELECT AVG(salary) FROM employees)
ORDER BY salary DESC;`,
    expectRows: 3,
    orderMatters: true,
    hints: [
      'You cannot write `WHERE salary > AVG(salary)` — WHERE runs before any aggregate exists.',
      'Compute the average in a subquery, and compare each row against that one number.',
    ],
    explanation:
      'The subquery returns a single value and runs **once**, not once per row — it does not mention the outer query, so the engine can evaluate it independently and reuse the result. That is an *uncorrelated* subquery, and it is the cheap kind. The average here is 81,333.33, so Grace at 82,000 makes the cut by 667.',
    learnTopic: 'sql/subqueries',
    topicTags: ['subquery', 'aggregate'],
  },

  {
    slug: 'above-department-average',
    title: 'Paid above your own department average',
    category: 'subqueries',
    difficulty: 'Medium',
    statement:
      'Return the `name` and `salary` of every employee paid more than the **average for their own department**, highest salary first.\n\nEmployees with no department are out of scope.',
    setupSql: `
CREATE TABLE employees (
  id      INTEGER PRIMARY KEY,
  name    TEXT NOT NULL,
  dept_id INTEGER,
  salary  INTEGER NOT NULL
);
INSERT INTO employees VALUES
  (1, 'Ada',       1, 95000),
  (2, 'Grace',     1, 82000),
  (3, 'Linus',     2, 74000),
  (4, 'Barbara',   2, 91000),
  (5, 'Alan',      3, 68000),
  (6, 'Katherine', 3, 88000),
  (7, 'Radia',     NULL, 78000);
`,
    solutionSql: `
SELECT e.name, e.salary
FROM employees e
JOIN (
  SELECT dept_id, AVG(salary) AS dept_avg
  FROM employees
  WHERE dept_id IS NOT NULL
  GROUP BY dept_id
) a ON e.dept_id = a.dept_id
WHERE e.salary > a.dept_avg
ORDER BY e.salary DESC;`,
    expectRows: 3,
    orderMatters: true,
    hints: [
      'Each employee is compared against a *different* number — the average of their own department.',
      'One way: pre-compute one average per department in a derived table, then join it back on `dept_id`.',
      'A correlated subquery also works, but it recomputes the average once per employee rather than once per department.',
    ],
    explanation:
      'Two shapes give this answer and they cost very differently. Joining to a **derived table** computes each department average once — three averages for seven employees. A **correlated subquery** — `WHERE salary > (SELECT AVG(salary) FROM employees x WHERE x.dept_id = e.dept_id)` — is shorter and recomputes an average per row.\n\nA third is better than both where the engine has window functions: `AVG(salary) OVER (PARTITION BY dept_id)` computes them in a single pass with no join at all.',
    learnTopic: 'sql/correlated-subqueries',
    topicTags: ['derived-table', 'correlated', 'group-by'],
  },

  {
    slug: 'busiest-day-cte',
    title: 'The busiest day',
    category: 'subqueries',
    difficulty: 'Medium',
    statement:
      'Return the day with the most orders as `placed_on`, and how many were placed as `orders`.\n\nIf several days tie for the most, return all of them, earliest first.',
    setupSql: `
CREATE TABLE orders (
  id        INTEGER PRIMARY KEY,
  total     INTEGER NOT NULL,
  placed_on TEXT NOT NULL
);
INSERT INTO orders VALUES
  (1, 4200, '2024-01-04'),
  (2, 1800, '2024-01-04'),
  (3, 990,  '2024-01-05'),
  (4, 7600, '2024-01-06'),
  (5, 2400, '2024-01-06'),
  (6, 350,  '2024-01-07'),
  (7, 1200, '2024-01-04');
`,
    solutionSql: `
WITH per_day AS (
  SELECT placed_on, COUNT(*) AS orders
  FROM orders
  GROUP BY placed_on
)
SELECT placed_on, orders
FROM per_day
WHERE orders = (SELECT MAX(orders) FROM per_day)
ORDER BY placed_on;`,
    expectRows: 1,
    orderMatters: true,
    hints: [
      'Count per day first, then find the largest of those counts.',
      'You need the per-day counts twice — once to find the maximum, once to pick the rows matching it.',
      'A CTE lets you name that intermediate result and use it in both places.',
    ],
    explanation:
      'This is the case a CTE does that a derived table cannot: the same intermediate result is needed **twice** in one query — once to compute the maximum, once to select the rows matching it. As derived tables it would be the same `GROUP BY` written out twice, and two copies of one definition drift the first time somebody edits only one.\n\nThe `= (SELECT MAX(...))` form also handles ties for free: change the data so two days have three orders each and both come back, where `ORDER BY orders DESC LIMIT 1` would silently return one of them.',
    learnTopic: 'sql/ctes',
    topicTags: ['cte', 'group-by', 'max', 'ties'],
  },

  {
    slug: 'never-sold-to-that-customer',
    title: 'Who has never sold to Northwind',
    category: 'subqueries',
    difficulty: 'Medium',
    statement:
      'Return the `name` of every salesperson who has **never** taken an order from the customer `Northwind`, alphabetically.\n\nOne order in the table has not been assigned to anybody yet. That row is why this problem is Medium.',
    setupSql: `
CREATE TABLE salespeople (
  id   INTEGER PRIMARY KEY,
  name TEXT NOT NULL
);
INSERT INTO salespeople VALUES
  (1, 'Abe'),
  (2, 'Bo'),
  (3, 'Chidi'),
  (4, 'Dara');

CREATE TABLE customers (
  id   INTEGER PRIMARY KEY,
  name TEXT NOT NULL
);
INSERT INTO customers VALUES
  (1, 'Northwind'),
  (2, 'Acme');

CREATE TABLE orders (
  id             INTEGER PRIMARY KEY,
  salesperson_id INTEGER,
  customer_id    INTEGER NOT NULL,
  amount         INTEGER NOT NULL
);
INSERT INTO orders VALUES
  (1, 1,    1, 4000),
  (2, 2,    2, 2500),
  (3, NULL, 1, 1800),
  (4, 3,    2,  900);
`,
    solutionSql: `
SELECT s.name
FROM salespeople s
WHERE NOT EXISTS (
  SELECT 1
  FROM orders o
  JOIN customers c ON c.id = o.customer_id
  WHERE o.salesperson_id = s.id
    AND c.name = 'Northwind'
)
ORDER BY s.name;`,
    expectRows: 3,
    orderMatters: true,
    hints: [
      'Write the positive query first — who *has* sold to Northwind — and then invert it.',
      'Try it with `NOT IN` and look at what comes back. Then look at order 3.',
      '`NOT EXISTS` compares row by row and never has to decide what to do with a NULL.',
    ],
    explanation:
      'The obvious answer is wrong, and it is wrong silently:\n\n```\nSELECT name FROM salespeople\nWHERE id NOT IN (\n  SELECT o.salesperson_id FROM orders o\n  JOIN customers c ON c.id = o.customer_id\n  WHERE c.name = \'Northwind\'\n);\n```\n\nThat inner query returns `{1, NULL}`, because order 3 is for Northwind and has no salesperson. `id NOT IN (1, NULL)` asks "is id different from 1 **and** different from NULL", and *different from NULL* is not false — it is unknown. Unknown is not true, so no row ever qualifies and the query returns **nothing at all**. No error, no warning, an empty result that looks like a real answer.\n\n`NOT EXISTS` has no such problem. It asks, for each salesperson, whether a matching row exists — and a row with a NULL salesperson never matches anybody, which is exactly the right behaviour. It is the safe default for "none of these" and the reason to reach for it over `NOT IN` by habit rather than by inspection.\n\nIf `NOT IN` has to be used, `... WHERE salesperson_id IS NOT NULL` inside the subquery makes it correct — but that is a fix you have to remember every time, and this is a fix you get for free.',
    learnTopic: 'sql/exists-in-any-all',
    source: {
      platform: 'github',
      url: 'https://github.com/Aafreen29/SQL-Interview-Prep-Question',
    },
    topicTags: ['not-exists', 'not-in', 'null', 'anti-join'],
  },

  {
    slug: 'four-or-more-interactions',
    title: 'Four interactions in a day',
    category: 'subqueries',
    difficulty: 'Medium',
    statement:
      'Each row of `interactions` is one interaction between two users on one day — a pair interacts at most once a day, and the row counts for **both** of them.\n\nReturn the `user_id` of everyone with **four or more** interactions on 2024-03-23, alongside the count as `interactions`, lowest id first.',
    setupSql: `
CREATE TABLE interactions (
  id     INTEGER PRIMARY KEY,
  user_a INTEGER NOT NULL,
  user_b INTEGER NOT NULL,
  day    TEXT NOT NULL
);
INSERT INTO interactions (user_a, user_b, day) VALUES
  (1, 2, '2024-03-23'),
  (1, 3, '2024-03-23'),
  (1, 4, '2024-03-23'),
  (1, 5, '2024-03-23'),
  (2, 3, '2024-03-23'),
  (2, 4, '2024-03-23'),
  (2, 5, '2024-03-23'),
  (3, 4, '2024-03-24');
`,
    solutionSql: `
SELECT user_id, COUNT(*) AS interactions
FROM (
  SELECT user_a AS user_id FROM interactions WHERE day = '2024-03-23'
  UNION ALL
  SELECT user_b AS user_id FROM interactions WHERE day = '2024-03-23'
) AS both_sides
GROUP BY user_id
HAVING COUNT(*) >= 4
ORDER BY user_id;`,
    expectRows: 2,
    orderMatters: true,
    hints: [
      'A user can be in either column, so neither column alone is the list of participants.',
      'Stack the two columns into one with `UNION ALL`, then group.',
      '`UNION` and `UNION ALL` give different counts here. Only one of them is right.',
    ],
    explanation:
      'The table stores a symmetric fact in an asymmetric shape: user 1 appears in `user_a`, user 5 appears in `user_b`, and both took part. Any question about *participants* has to unpivot those two columns into one before it can count anything.\n\n**`UNION ALL`, not `UNION`.** `UNION` removes duplicate rows, and after projecting down to a single `user_id` column every one of user 1\'s four interactions is the identical row `(1)`. `UNION` would collapse them to one and the count would be 1 for everybody — a query that runs, returns plausible-looking output, and answers a question nobody asked. `UNION ALL` also skips the dedupe pass, so it is the faster of the two whenever you do not specifically want deduplication.\n\nThe date filter goes **inside** both halves rather than outside the derived table. Either position gives the right answer here, but filtering early is the version that stays fast when the table is large, and it is what a planner would try to do for you anyway.\n\nAnd the derived table is aliased — `AS both_sides`. SQLite does not insist, MySQL does, and a query that only runs on one of them is a habit worth not forming.',
    learnTopic: 'sql/set-operations',
    source: {
      platform: 'github',
      url: 'https://github.com/Aafreen29/SQL-Interview-Prep-Question',
    },
    topicTags: ['union-all', 'group-by', 'having', 'derived-table'],
  },

  {
    slug: 'acceptance-rate',
    title: 'The friend-request acceptance rate',
    category: 'subqueries',
    difficulty: 'Medium',
    statement:
      'Return the overall acceptance rate — accepted requests over sent requests — as `accept_rate`, rounded to two decimals.\n\nBoth logs contain repeats: the same request can be sent twice and the same acceptance recorded twice. A pair counts once.\n\nIf nothing was ever sent, report `0` rather than an error or a NULL.',
    setupSql: `
CREATE TABLE requests (
  sender_id   INTEGER NOT NULL,
  receiver_id INTEGER NOT NULL,
  sent_on     TEXT NOT NULL
);
INSERT INTO requests VALUES
  (1, 2, '2024-04-01'),
  (1, 3, '2024-04-01'),
  (1, 3, '2024-04-02'),
  (2, 3, '2024-04-02'),
  (2, 4, '2024-04-03'),
  (3, 4, '2024-04-03');

CREATE TABLE accepted (
  sender_id   INTEGER NOT NULL,
  receiver_id INTEGER NOT NULL,
  accepted_on TEXT NOT NULL
);
INSERT INTO accepted VALUES
  (1, 2, '2024-04-02'),
  (1, 3, '2024-04-03'),
  (1, 3, '2024-04-04'),
  (2, 4, '2024-04-04');
`,
    solutionSql: `
SELECT ROUND(
  COALESCE(
    (SELECT COUNT(*) FROM (SELECT DISTINCT sender_id, receiver_id FROM accepted) AS a) * 1.0
    / NULLIF((SELECT COUNT(*) FROM (SELECT DISTINCT sender_id, receiver_id FROM requests) AS r), 0),
    0
  ), 2) AS accept_rate;`,
    expectRows: 1,
    orderMatters: false,
    hints: [
      'Count pairs, not rows — user 1 asked user 3 twice and that is still one request.',
      'The two counts come from two different tables, so neither is an aggregate of the other. Two scalar subqueries.',
      '`NULLIF(sent, 0)` handles the empty case, and `COALESCE(…, 0)` decides what the answer should be when it fires.',
    ],
    explanation:
      'A rate whose numerator and denominator live in different tables is two scalar subqueries divided, and the temptation to join them first is worth resisting: a join would multiply the duplicate rows together and give an answer that is wrong in a direction nobody would guess.\n\n`DISTINCT sender_id, receiver_id` in both halves is what makes the counts mean "requests" and "acceptances" rather than "log lines". Five distinct pairs were sent, three were accepted, so the rate is 0.6 — but the raw row counts are 6 and 4, which would give 0.67. Duplicated events in an append-only log are the normal case, not the exotic one, and every metric built on one has to say what it is counting.\n\nThe two guards are the same pair as in any rate: `* 1.0` so integer division does not floor the result to zero, and `NULLIF(denominator, 0)` so an empty table returns a decided value rather than an engine-dependent one.',
    learnTopic: 'sql/subqueries',
    source: {
      platform: 'github',
      url: 'https://github.com/Aafreen29/SQL-Interview-Prep-Question',
    },
    topicTags: ['scalar-subquery', 'distinct', 'nullif', 'rate'],
  },
];
