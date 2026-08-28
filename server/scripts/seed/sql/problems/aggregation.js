/**
 * Aggregation & grouping — collapse rows into groups, then filter the groups.
 *
 * Where `COUNT(*)` against `COUNT(column)` stops being a trivia question and
 * starts being the difference between a report that is right and one that is
 * plausibly wrong, and where `HAVING` earns its existence.
 */

export default [
  {
    slug: 'orders-per-customer',
    title: 'Orders per customer',
    category: 'aggregation',
    difficulty: 'Easy',
    statement:
      'Return each `customer_id` in `orders` and how many orders they have placed, in a column named `orders`.\n\nOnly customers who have placed at least one order appear in this table, so every group is real.',
    setupSql: `
CREATE TABLE orders (
  id          INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL,
  total       INTEGER NOT NULL,
  placed_on   TEXT NOT NULL
);
INSERT INTO orders VALUES
  (1, 10, 4200, '2024-01-04'),
  (2, 11, 1800, '2024-01-06'),
  (3, 10, 990,  '2024-01-11'),
  (4, 12, 7600, '2024-02-02'),
  (5, 10, 2400, '2024-02-19'),
  (6, 11, 350,  '2024-03-01');
`,
    solutionSql:
      'SELECT customer_id, COUNT(*) AS orders FROM orders GROUP BY customer_id;',
    expectRows: 3,
    hints: [
      'One row out per distinct `customer_id` — that is what GROUP BY does.',
      'The count of rows in each group is `COUNT(*)`.',
    ],
    explanation:
      'The shape every aggregate query has: group by the thing you want one row of, and put an aggregate beside it. Note that only `customer_id` and aggregates may appear in the SELECT list — adding `total` would be asking for one value where the group holds three.',
    learnTopic: 'sql/group-by-having',
    topicTags: ['group-by', 'count'],
  },

  {
    slug: 'count-star-vs-column',
    title: 'How many have a manager?',
    category: 'aggregation',
    difficulty: 'Easy',
    statement:
      'Return three numbers from `employees` in one row:\n\n- `headcount` — how many employees there are\n- `with_manager` — how many have a manager recorded\n- `departments` — how many distinct departments are referenced\n\nSome employees have no manager and one has no department.',
    setupSql: `
CREATE TABLE employees (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  dept_id    INTEGER,
  manager_id INTEGER
);
INSERT INTO employees VALUES
  (1, 'Ada',     1, NULL),
  (2, 'Grace',   1, 1),
  (3, 'Linus',   2, 1),
  (4, 'Barbara', 2, 1),
  (5, 'Alan',    3, 4),
  (6, 'Radia',   NULL, 4);
`,
    solutionSql:
      'SELECT COUNT(*) AS headcount, COUNT(manager_id) AS with_manager, COUNT(DISTINCT dept_id) AS departments FROM employees;',
    expectRows: 1,
    hints: [
      '`COUNT(*)` counts rows. `COUNT(column)` counts values that are not NULL.',
      'Ada has no manager and Radia has no department — so two of these three numbers are smaller than six.',
      '`COUNT(DISTINCT col)` also skips NULLs, so the department count is 3, not 4.',
    ],
    explanation:
      'Three counts off one column set, and all three differ. `COUNT(*)` is 6 — it counts rows and cannot skip anything. `COUNT(manager_id)` is 5, because Ada has none. `COUNT(DISTINCT dept_id)` is 3 rather than 4, because `COUNT` of a column never counts NULLs — even though `SELECT DISTINCT dept_id` would return four rows including the NULL. Both behaviours are consistent with their own rules and they disagree, which is exactly why this gets asked.',
    learnTopic: 'sql/aggregate-functions',
    topicTags: ['count', 'null', 'distinct'],
  },

  {
    slug: 'departments-over-budget',
    title: 'Departments spending over budget',
    category: 'aggregation',
    difficulty: 'Medium',
    statement:
      'Return the `dept_id` and total salary as `wage_bill` for every department whose **total salary exceeds 160,000**, most expensive first.\n\nIgnore anyone earning under 50,000 — they are part-time and are budgeted separately.\n\nEmployees with no department are not in scope.',
    setupSql: `
CREATE TABLE employees (
  id      INTEGER PRIMARY KEY,
  name    TEXT NOT NULL,
  dept_id INTEGER,
  salary  INTEGER NOT NULL
);
INSERT INTO employees VALUES
  (1, 'Ada',     1, 95000),
  (2, 'Grace',   1, 82000),
  (3, 'Linus',   2, 74000),
  (4, 'Barbara', 2, 91000),
  (5, 'Alan',    3, 68000),
  (6, 'Radia',   NULL, 78000),
  (7, 'Hedy',    1, 42000),
  (8, 'Katherine', 3, 88000);
`,
    solutionSql: `
SELECT dept_id, SUM(salary) AS wage_bill
FROM employees
WHERE salary >= 50000 AND dept_id IS NOT NULL
GROUP BY dept_id
HAVING SUM(salary) > 160000
ORDER BY wage_bill DESC;`,
    expectRows: 2,
    orderMatters: true,
    hints: [
      'Two filters, and they are not the same kind. One removes people; the other removes departments.',
      'A filter on a single employee goes in WHERE, before the grouping. A filter on a department total needs HAVING, after it.',
      'Hedy earns 42,000 — she has to be gone *before* the totals are computed, or Engineering is over-counted.',
    ],
    explanation:
      'Both filters in one query, doing different jobs. `WHERE salary >= 50000` runs first and removes Hedy, so she never reaches a total. `HAVING SUM(salary) > 160000` runs after grouping and removes whole departments. Putting the salary filter in HAVING would give the wrong answer — the totals would already include her. Putting the total in WHERE is not even legal: there are no groups yet for `SUM` to sum.',
    learnTopic: 'sql/group-by-having',
    topicTags: ['group-by', 'having', 'sum', 'where'],
  },

  {
    slug: 'click-through-rate',
    title: 'Click-through rate per app',
    category: 'aggregation',
    difficulty: 'Medium',
    statement:
      'Every row of `events` is either an `impression` or a `click`.\n\nFor each `app_id`, return its click-through rate — clicks divided by impressions — as `ctr`, rounded to two decimals and ordered by app.\n\nOne app has clicks but no impressions recorded. Report **0** for it rather than failing or vanishing.',
    setupSql: `
CREATE TABLE events (
  id      INTEGER PRIMARY KEY,
  app_id  INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  kind    TEXT NOT NULL
);
INSERT INTO events (app_id, user_id, kind) VALUES
  (1, 10, 'impression'), (1, 11, 'impression'), (1, 12, 'impression'),
  (1, 13, 'impression'), (1, 14, 'impression'), (1, 15, 'impression'),
  (1, 10, 'click'),      (1, 12, 'click'),      (1, 15, 'click'),
  (2, 20, 'impression'), (2, 21, 'impression'), (2, 22, 'impression'),
  (2, 23, 'impression'),
  (3, 30, 'click'),      (3, 31, 'click');
`,
    solutionSql: `
SELECT app_id,
       ROUND(
         COALESCE(
           SUM(CASE WHEN kind = 'click'      THEN 1 ELSE 0 END) * 1.0
           / NULLIF(SUM(CASE WHEN kind = 'impression' THEN 1 ELSE 0 END), 0),
           0
         ), 2) AS ctr
FROM events
GROUP BY app_id
ORDER BY app_id;`,
    expectRows: 3,
    orderMatters: true,
    hints: [
      'Both numbers come out of the same group — count each kind with a `CASE` inside `SUM`.',
      'Dividing two integers truncates. Multiply one side by `1.0` first.',
      '`NULLIF(x, 0)` turns a zero denominator into NULL, and `COALESCE(…, 0)` turns the NULL that division produces back into a number.',
    ],
    explanation:
      'Conditional aggregation: `SUM(CASE WHEN … THEN 1 ELSE 0 END)` counts a subset of the group without a second pass over the table. It is the single most reusable shape in this category — every "of these rows, how many were X" question is that expression.\n\nThe two traps are both about arithmetic rather than SQL.\n\n**Integer division.** In SQLite and PostgreSQL, `3 / 6` is `0`, not `0.5` — the operands are integers, so the result is one too. Every CTR would be reported as zero and the query would look like it worked. `* 1.0` on one side forces the whole expression to floating point. (MySQL divides with `/` as a decimal and does not have this problem, which is exactly why it catches people moving between engines.)\n\n**Division by zero.** App 3 has clicks and no impressions. Most engines raise an error and stop; SQLite quietly returns NULL. Neither is the answer the question asked for. `NULLIF(denominator, 0)` makes the division deliberately produce NULL, and `COALESCE(…, 0)` then says what a rate with no impressions should be reported as. Doing it in that order means you have *decided* the edge case rather than inherited whatever the engine does with it.',
    learnTopic: 'sql/aggregate-functions',
    source: {
      platform: 'github',
      url: 'https://github.com/Aafreen29/SQL-Interview-Prep-Question',
    },
    topicTags: ['group-by', 'case', 'nullif', 'integer-division'],
  },

  {
    slug: 'active-all-seven-days',
    title: 'Active every day of the week',
    category: 'aggregation',
    difficulty: 'Medium',
    statement:
      '`logins` covers one week, 2024-05-06 to 2024-05-12.\n\nReturn the `user_id` of everybody who logged in on **all seven days**. Somebody logging in twice in one day still only covers one day.',
    setupSql: `
CREATE TABLE logins (
  id      INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  day     TEXT NOT NULL
);
INSERT INTO logins (user_id, day) VALUES
  (1, '2024-05-06'), (1, '2024-05-07'), (1, '2024-05-08'), (1, '2024-05-09'),
  (1, '2024-05-10'), (1, '2024-05-11'), (1, '2024-05-12'), (1, '2024-05-08'),
  (2, '2024-05-06'), (2, '2024-05-07'), (2, '2024-05-08'), (2, '2024-05-09'),
  (2, '2024-05-10'), (2, '2024-05-11'), (2, '2024-05-11'), (2, '2024-05-11'),
  (3, '2024-05-06'), (3, '2024-05-12');
`,
    solutionSql: `
SELECT user_id
FROM logins
GROUP BY user_id
HAVING COUNT(DISTINCT day) = 7
ORDER BY user_id;`,
    expectRows: 1,
    orderMatters: true,
    hints: [
      'User 2 has seven rows. Count their *days* rather than their rows.',
      '`COUNT(DISTINCT day)`, in a `HAVING`.',
      'Hard-coding 7 works here; `= (SELECT COUNT(DISTINCT day) FROM logins)` is the version that survives the week changing length.',
    ],
    explanation:
      'The trap is `HAVING COUNT(*) = 7`, and it is designed to look right. User 2 has exactly seven login rows — three of them on 2024-05-11 and none at all on the 12th. Counting rows says they were here all week; counting distinct days says they missed a day. Only one of those answers the question.\n\n`COUNT(DISTINCT day)` is the fix, and the general shape is worth naming: **"did this thing happen across all N of something" is a distinct count compared against N**, not a row count. The same shape answers "customers who bought every product" and "students who sat every exam".\n\nThe literal `7` is the version to write in an interview and the version to argue against in review. `= (SELECT COUNT(DISTINCT day) FROM logins)` asks the data how many days there were, which is right if the table really does hold exactly the window — and wrong if a day exists on which nobody at all logged in, since then the table never saw it. Which one is correct depends on a fact about the data, and being able to say *which* fact is the answer an interviewer is listening for.',
    learnTopic: 'sql/group-by-having',
    source: {
      platform: 'github',
      url: 'https://github.com/Aafreen29/SQL-Interview-Prep-Question',
    },
    topicTags: ['group-by', 'having', 'count-distinct'],
  },

  {
    slug: 'histogram-buckets',
    title: 'A histogram of session lengths',
    category: 'aggregation',
    difficulty: 'Medium',
    statement:
      'Bucket every session into a **500-second band** — 0–499, 500–999, and so on — and report how many distinct users fall in each.\n\nReturn `bucket` (the first second of the band) and `users`, lowest bucket first. Bands nobody landed in are simply absent.',
    setupSql: `
CREATE TABLE sessions (
  id      INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  seconds INTEGER NOT NULL
);
INSERT INTO sessions (user_id, seconds) VALUES
  (1, 120), (2, 480), (1, 300),
  (3, 500), (4, 999),
  (5, 1000), (5, 1200), (6, 1499),
  (7, 2600);
`,
    solutionSql: `
SELECT (seconds / 500) * 500 AS bucket,
       COUNT(DISTINCT user_id) AS users
FROM sessions
GROUP BY bucket
ORDER BY bucket;`,
    expectRows: 4,
    orderMatters: true,
    hints: [
      'Integer division throws away the remainder — which is exactly what a bucket is.',
      '`(seconds / 500) * 500` maps 120 and 480 both to 0, and 1200 to 1000.',
      'Group by the expression, and count users rather than sessions.',
    ],
    explanation:
      'A histogram in SQL is one expression: **divide by the band width, throw away the remainder, multiply back**. `(seconds / 500) * 500` sends everything from 0 to 499 to 0, everything from 500 to 999 to 500, and so on. Grouping by that expression is the whole query.\n\nTwo things to say about it in an interview.\n\nUser 5 has two sessions in the 1000 band and is counted once — `COUNT(DISTINCT user_id)`, because the question asked about users and the table is about sessions. Getting that wrong turns a histogram of people into a histogram of activity, which is a different chart with the same axes.\n\nAnd the empty bands. There is nothing between 1500 and 2499, so the 1500 and 2000 rows do not exist in the output. `GROUP BY` can only produce groups the data actually has. If the chart needs a zero there, the bands have to come from somewhere else — a numbers table or a generated series joined against — which is the same problem the "count salary categories" question is really asking.',
    dialectNote:
      'In SQLite and PostgreSQL, `/` between two integers truncates, which is what makes `(seconds / 500) * 500` a bucket. MySQL divides with `/` as a decimal, so there it has to be written `FLOOR(seconds / 500) * 500` — and `FLOOR` is the form worth writing everywhere, because it says what it means on every engine.',
    learnTopic: 'sql/group-by-having',
    source: {
      platform: 'github',
      url: 'https://github.com/Aafreen29/SQL-Interview-Prep-Question',
    },
    topicTags: ['group-by', 'buckets', 'count-distinct', 'integer-division'],
  },

  {
    slug: 'pivot-sales-by-quarter',
    title: 'Turn the quarters into columns',
    category: 'aggregation',
    difficulty: 'Medium',
    statement:
      '`sales` holds one row per region per quarter. Turn it sideways: **one row per region**, with a column for each quarter.\n\nReturn `region`, `q1`, `q2`, `q3`, `q4`, alphabetically by region. A region that sold nothing in a quarter shows `0`, not NULL.',
    setupSql: `
CREATE TABLE sales (
  id      INTEGER PRIMARY KEY,
  region  TEXT NOT NULL,
  quarter INTEGER NOT NULL,
  amount  INTEGER NOT NULL
);
INSERT INTO sales (region, quarter, amount) VALUES
  ('east',  1, 100), ('east',  2, 150), ('east',  3, 120), ('east', 4, 180),
  ('north', 1, 200), ('north', 3, 220), ('north', 4, 260),
  ('south', 2,  90), ('south', 2,  60), ('south', 4, 300);
`,
    solutionSql: `
SELECT region,
       SUM(CASE WHEN quarter = 1 THEN amount ELSE 0 END) AS q1,
       SUM(CASE WHEN quarter = 2 THEN amount ELSE 0 END) AS q2,
       SUM(CASE WHEN quarter = 3 THEN amount ELSE 0 END) AS q3,
       SUM(CASE WHEN quarter = 4 THEN amount ELSE 0 END) AS q4
FROM sales
GROUP BY region
ORDER BY region;`,
    expectRows: 3,
    orderMatters: true,
    hints: [
      'One row per region means `GROUP BY region`. The four columns all come out of that one group.',
      'A column is a `SUM` that only counts the rows belonging to its quarter — `SUM(CASE WHEN quarter = 1 THEN amount ELSE 0 END)`.',
      '`ELSE 0` rather than no `ELSE`: the second gives NULL for a quarter with no rows.',
    ],
    explanation:
      'This is the pivot, and it is asked by name. The shape is always the same: **`GROUP BY` the thing that becomes the row, and one conditional aggregate per thing that becomes a column.**\n\nThree details decide whether it is right.\n\n`SUM` rather than `MAX`. South has two rows in Q2 (90 and 60) and the answer is 150. `MAX(CASE …)` is a common way to write a pivot and it silently returns 90 here — it is only correct when the row/column pair is guaranteed unique, and this one is not.\n\n`ELSE 0` rather than omitting it. North has no Q2 row at all. Without the `ELSE`, every branch fails, `SUM` sees only NULLs, and the cell comes back NULL — which is arguably honest but is not what the question asked for, and NULL in a total column tends to poison whatever adds it up next.\n\nAnd the limitation worth volunteering: **the columns are written by hand**. SQL results have a fixed shape decided before the data is read, so a pivot over an unknown set of quarters is not one query — it is either dynamic SQL that builds the text, or a job for whatever is drawing the table. MySQL and SQLite have no `PIVOT` clause at all; SQL Server and Oracle do, and it compiles to roughly this.',
    learnTopic: 'sql/group-by-having',
    topicTags: ['group-by', 'case', 'pivot', 'conditional-aggregate'],
  },
];
