/**
 * Joins — combine tables, and keep the rows that did not match when you meant to.
 *
 * The largest category in the bank, and the one where the mistakes are silent:
 * an INNER JOIN that should have been LEFT loses people from a report, and a
 * WHERE on the right-hand table turns a LEFT JOIN back into an INNER one
 * without an error. Both are here as problems rather than warnings, because
 * being caught by one is what makes it stick.
 */

export default [
  {
    slug: 'employees-with-department',
    title: 'Everyone, with their department',
    category: 'joins',
    difficulty: 'Easy',
    statement:
      'Return the `name` of every employee and the name of their department as `department`.\n\n**Every employee must appear**, including anyone not yet assigned to a department — their `department` should come back as `NULL`.',
    setupSql: `
CREATE TABLE departments (
  id       INTEGER PRIMARY KEY,
  name     TEXT NOT NULL,
  location TEXT NOT NULL
);
CREATE TABLE employees (
  id      INTEGER PRIMARY KEY,
  name    TEXT NOT NULL,
  dept_id INTEGER
);
INSERT INTO departments VALUES
  (1, 'Engineering', 'Bengaluru'),
  (2, 'Data',        'Hyderabad'),
  (3, 'Design',      'Pune'),
  (4, 'Legal',       'Mumbai');
INSERT INTO employees VALUES
  (1, 'Ada',     1),
  (2, 'Grace',   1),
  (3, 'Linus',   2),
  (4, 'Barbara', 2),
  (5, 'Alan',    3),
  (6, 'Radia',   NULL);
`,
    solutionSql: `
SELECT e.name, d.name AS department
FROM employees e
LEFT JOIN departments d ON e.dept_id = d.id;`,
    expectRows: 6,
    hints: [
      'Six employees go in. How many come out of your query?',
      'Radia has no `dept_id`, so nothing on the other side matches — an INNER JOIN would drop her.',
      'Keeping every row from the left-hand table is what LEFT JOIN means.',
    ],
    explanation:
      'An `INNER JOIN` here returns five rows and looks completely correct. Radia\'s `dept_id` is NULL, `NULL = 1` is unknown rather than true, so none of her candidate pairs match and she is dropped without a warning. "List the employees with their departments" quietly became "list the employees who have a department" — and the difference is a person missing from a staff report.',
    learnTopic: 'sql/left-and-right-join',
    topicTags: ['left-join', 'null'],
  },

  {
    slug: 'departments-with-nobody',
    title: 'Departments with nobody in them',
    category: 'joins',
    difficulty: 'Medium',
    statement:
      'Return the `name` of every department that has **no employees at all**.\n\nBe careful: one employee has no department recorded.',
    setupSql: `
CREATE TABLE departments (
  id   INTEGER PRIMARY KEY,
  name TEXT NOT NULL
);
CREATE TABLE employees (
  id      INTEGER PRIMARY KEY,
  name    TEXT NOT NULL,
  dept_id INTEGER
);
INSERT INTO departments VALUES
  (1, 'Engineering'), (2, 'Data'), (3, 'Design'), (4, 'Legal'), (5, 'Facilities');
INSERT INTO employees VALUES
  (1, 'Ada', 1), (2, 'Grace', 1), (3, 'Linus', 2), (4, 'Alan', 3), (5, 'Radia', NULL);
`,
    solutionSql: `
SELECT d.name FROM departments d
WHERE NOT EXISTS (SELECT 1 FROM employees e WHERE e.dept_id = d.id);`,
    expectRows: 2,
    hints: [
      'Two departments have nobody. Does your query find both, or none at all?',
      '`WHERE id NOT IN (SELECT dept_id FROM employees)` returns **nothing** here — work out why before changing it.',
      'Radia\'s `dept_id` is NULL, so the subquery contains a NULL, and `x NOT IN (…, NULL)` is never true. `NOT EXISTS` has no such problem.',
    ],
    explanation:
      'The obvious `NOT IN` version returns zero rows. The subquery `SELECT dept_id FROM employees` includes Radia\'s NULL, and `x NOT IN (1, 2, 3, NULL)` expands to a chain of `<>` ending in `x <> NULL` — which is unknown, never true, so every department is rejected. No error, no warning, just an empty report.\n\n`NOT EXISTS` asks whether a row was *found*, which is never unknown, so it is correct whether or not NULLs are present. The other fix is `WHERE dept_id IS NOT NULL` inside the subquery — correct, and one more thing to remember. Default to `NOT EXISTS`.',
    learnTopic: 'sql/exists-in-any-all',
    topicTags: ['anti-join', 'not-exists', 'null', 'trap'],
  },

  {
    slug: 'headcount-including-empty',
    title: 'Headcount, including the empty departments',
    category: 'joins',
    difficulty: 'Medium',
    statement:
      'Return every department as `department` with the number of employees in it as `headcount`, largest first, breaking ties by department name.\n\n**A department with nobody in it must appear with a headcount of 0.**',
    setupSql: `
CREATE TABLE departments (
  id   INTEGER PRIMARY KEY,
  name TEXT NOT NULL
);
CREATE TABLE employees (
  id      INTEGER PRIMARY KEY,
  name    TEXT NOT NULL,
  dept_id INTEGER
);
INSERT INTO departments VALUES
  (1, 'Engineering'), (2, 'Data'), (3, 'Design'), (4, 'Legal');
INSERT INTO employees VALUES
  (1, 'Ada', 1), (2, 'Grace', 1), (3, 'Linus', 2), (4, 'Barbara', 2), (5, 'Alan', 3), (6, 'Radia', NULL);
`,
    solutionSql: `
SELECT d.name AS department, COUNT(e.id) AS headcount
FROM departments d
LEFT JOIN employees e ON e.dept_id = d.id
GROUP BY d.id, d.name
ORDER BY headcount DESC, department ASC;`,
    expectRows: 4,
    orderMatters: true,
    hints: [
      'Start from `departments` and attach the employees, not the other way round.',
      'Legal has nobody. Does it show 0 — or 1?',
      '`COUNT(*)` counts the NULL-padded row too. Count a column from the employees side instead.',
    ],
    explanation:
      '`COUNT(*)` gives Legal a headcount of **1**, and it is not wrong so much as answering a different question: the LEFT JOIN produced one row for Legal — padded with NULLs — and `COUNT(*)` counts rows. `COUNT(e.id)` counts values, and skips NULLs, so the padded row contributes nothing and Legal correctly shows 0.\n\nOver a LEFT JOIN, `COUNT(*)` is almost always wrong and `COUNT(right_table.column)` is almost always right. The same applies to `SUM`, which returns NULL rather than 0 for an empty group — `COALESCE(SUM(x), 0)` is what a report wants.',
    learnTopic: 'sql/left-and-right-join',
    topicTags: ['left-join', 'count', 'group-by', 'trap'],
  },
  {
    slug: 'orders-with-customer-name',
    title: 'Orders, with who placed them',
    category: 'joins',
    difficulty: 'Easy',
    statement:
      'Return every order as `id`, `total` and the customer `name`, oldest first.\n\nOne order has no customer recorded — show it with a `NULL` name rather than dropping it.',
    setupSql: `CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT NOT NULL, city TEXT);
CREATE TABLE orders (
  id INTEGER PRIMARY KEY, customer_id INTEGER, total INTEGER NOT NULL, placed_on TEXT NOT NULL
);
INSERT INTO customers VALUES
  (1,'Aisha','Pune'), (2,'Bruno','Mumbai'), (3,'Chidi','Pune'),
  (4,'Dara','Chennai'), (5,'Elif',NULL);
INSERT INTO orders VALUES
  (1,1,4200,'2024-01-04'), (2,1,990,'2024-02-11'), (3,2,7600,'2024-01-19'),
  (4,3,350,'2024-03-02'),  (5,1,2400,'2024-03-15'), (6,NULL,1500,'2024-03-20');`,
    solutionSql: `
SELECT o.id, o.total, c.name
FROM orders o
LEFT JOIN customers c ON o.customer_id = c.id
ORDER BY o.placed_on;`,
    expectRows: 6,
    orderMatters: true,
    hints: ['Six orders in — six out.', 'Order 6 has a NULL `customer_id`, so an INNER JOIN drops it.'],
    explanation:
      'The order with no customer is the whole question. `NULL = 1` is unknown rather than true, so an inner join finds nothing to pair it with and removes it silently — and an order that exists but has no customer is exactly the row an audit is looking for.',
    learnTopic: 'sql/left-and-right-join',
    topicTags: ['left-join', 'null'],
  },

  {
    slug: 'customers-who-never-ordered',
    title: 'Customers who never ordered',
    category: 'joins',
    difficulty: 'Easy',
    statement: 'Return the `name` of every customer with no orders at all, alphabetically.',
    setupSql: `CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT NOT NULL, city TEXT);
CREATE TABLE orders (
  id INTEGER PRIMARY KEY, customer_id INTEGER, total INTEGER NOT NULL, placed_on TEXT NOT NULL
);
INSERT INTO customers VALUES
  (1,'Aisha','Pune'), (2,'Bruno','Mumbai'), (3,'Chidi','Pune'),
  (4,'Dara','Chennai'), (5,'Elif',NULL);
INSERT INTO orders VALUES
  (1,1,4200,'2024-01-04'), (2,1,990,'2024-02-11'), (3,2,7600,'2024-01-19'),
  (4,3,350,'2024-03-02'),  (5,1,2400,'2024-03-15'), (6,NULL,1500,'2024-03-20');`,
    solutionSql: `
SELECT c.name FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
WHERE o.id IS NULL
ORDER BY c.name;`,
    expectRows: 2,
    orderMatters: true,
    hints: [
      'Keep every customer, then keep only the ones nothing attached to.',
      'Test the *primary key* of the orders side for NULL — only a padded row can have one.',
    ],
    explanation:
      'The anti-join: `LEFT JOIN` then `WHERE right.pk IS NULL`. Testing `o.id` rather than, say, `o.total` matters — a real order always has an id, so a NULL there can only mean "no row matched". A nullable column would also match a genuine order with a missing value.',
    learnTopic: 'sql/left-and-right-join',
    topicTags: ['anti-join', 'left-join'],
  },

  {
    slug: 'spend-per-customer',
    title: 'What each customer has spent',
    category: 'joins',
    difficulty: 'Medium',
    statement:
      'Return every customer as `name`, how many orders they placed as `orders`, and their total spend as `spent`.\n\nA customer who has never ordered must appear with **0 and 0**, not NULL. Highest spend first, then name.',
    setupSql: `CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT NOT NULL, city TEXT);
CREATE TABLE orders (
  id INTEGER PRIMARY KEY, customer_id INTEGER, total INTEGER NOT NULL, placed_on TEXT NOT NULL
);
INSERT INTO customers VALUES
  (1,'Aisha','Pune'), (2,'Bruno','Mumbai'), (3,'Chidi','Pune'),
  (4,'Dara','Chennai'), (5,'Elif',NULL);
INSERT INTO orders VALUES
  (1,1,4200,'2024-01-04'), (2,1,990,'2024-02-11'), (3,2,7600,'2024-01-19'),
  (4,3,350,'2024-03-02'),  (5,1,2400,'2024-03-15'), (6,NULL,1500,'2024-03-20');`,
    solutionSql: `
SELECT c.name,
       COUNT(o.id) AS orders,
       COALESCE(SUM(o.total), 0) AS spent
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
GROUP BY c.id, c.name
ORDER BY spent DESC, c.name;`,
    expectRows: 5,
    orderMatters: true,
    hints: [
      '`COUNT(*)` would give a customer with no orders a count of 1 — it counts the padded row.',
      '`SUM` over no rows is NULL, not 0.',
      'So: `COUNT(o.id)` and `COALESCE(SUM(o.total), 0)`.',
    ],
    explanation:
      'Both aggregate traps of a LEFT JOIN in one query. `COUNT(*)` counts rows including the NULL-padded one, so an empty group shows 1 — `COUNT(o.id)` counts values and skips it. And `SUM` over zero rows returns NULL rather than 0, which renders as a blank cell in a report; `COALESCE` is what a reader expects to see.',
    learnTopic: 'sql/left-and-right-join',
    topicTags: ['left-join', 'aggregate', 'coalesce'],
  },

  {
    slug: 'filter-the-optional-side',
    title: 'Every customer, and their Pune orders only',
    category: 'joins',
    difficulty: 'Hard',
    statement:
      'Return every customer as `name` and the `total` of each of their orders placed **in March 2024** — but **every customer must still appear**, with `NULL` where they placed no March order.\n\nOrder by name, then total.',
    setupSql: `CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT NOT NULL, city TEXT);
CREATE TABLE orders (
  id INTEGER PRIMARY KEY, customer_id INTEGER, total INTEGER NOT NULL, placed_on TEXT NOT NULL
);
INSERT INTO customers VALUES
  (1,'Aisha','Pune'), (2,'Bruno','Mumbai'), (3,'Chidi','Pune'),
  (4,'Dara','Chennai'), (5,'Elif',NULL);
INSERT INTO orders VALUES
  (1,1,4200,'2024-01-04'), (2,1,990,'2024-02-11'), (3,2,7600,'2024-01-19'),
  (4,3,350,'2024-03-02'),  (5,1,2400,'2024-03-15'), (6,NULL,1500,'2024-03-20');`,
    solutionSql: `
SELECT c.name, o.total
FROM customers c
LEFT JOIN orders o
  ON o.customer_id = c.id
 AND o.placed_on >= '2024-03-01' AND o.placed_on < '2024-04-01'
ORDER BY c.name, o.total;`,
    expectRows: 5,
    orderMatters: true,
    hints: [
      'Putting the date filter in `WHERE` gives you three rows, not five. Work out why.',
      'A padded row has `NULL` in `o.placed_on`, and `NULL >= anything` is unknown — so `WHERE` throws those rows away.',
      'Filters on the **optional** side of a LEFT JOIN belong in `ON`.',
    ],
    explanation:
      'This is the single most useful thing to know about outer joins. A condition on the right-hand table in `WHERE` is applied *after* the padding, so every NULL-padded row fails it and the LEFT JOIN silently becomes an INNER JOIN. Moving it into `ON` applies it *while matching*, so unmatched rows are still preserved.\n\nThe rule: filters on the preserved side go in `WHERE`, filters on the optional side go in `ON`. The one exception is `WHERE right.pk IS NULL`, which is deliberately looking for the padded rows.',
    learnTopic: 'sql/left-and-right-join',
    topicTags: ['left-join', 'on-vs-where', 'trap'],
  },

  {
    slug: 'self-join-manager',
    title: 'Everyone, with their manager',
    category: 'joins',
    difficulty: 'Medium',
    statement:
      'Return every employee as `employee` and their manager as `manager`, ordered by employee name.\n\nThe person at the top has no manager — show them with `NULL` rather than leaving them out.',
    setupSql: `
CREATE TABLE employees (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, manager_id INTEGER
);
INSERT INTO employees VALUES
  (1,'Ada',NULL), (2,'Grace',1), (3,'Linus',1), (4,'Barbara',1), (5,'Alan',4), (6,'Radia',4);
`,
    solutionSql: `
SELECT e.name AS employee, m.name AS manager
FROM employees e
LEFT JOIN employees m ON e.manager_id = m.id
ORDER BY e.name;`,
    expectRows: 6,
    orderMatters: true,
    hints: [
      'One table, joined to itself — the aliases are what make it possible.',
      'Ada has no manager. An INNER JOIN would drop the CEO.',
    ],
    explanation:
      'A self join is an ordinary join where both sides are the same table; the aliases are doing all the work, because `employees.name` would be ambiguous and there would be no way to say "the name from the *other* row".\n\n`LEFT`, not `INNER`, and the reason is the first row: an inner join drops whoever is at the top, and that is the one person nobody notices missing from a staff list.',
    learnTopic: 'sql/self-join',
    topicTags: ['self-join', 'left-join'],
  },

  {
    slug: 'pairs-in-the-same-city',
    title: 'Pairs in the same city',
    category: 'joins',
    difficulty: 'Medium',
    statement:
      'Return every **pair** of customers based in the same city, as `a` and `b`, listing each pair once. Order by city, then `a`, then `b`.\n\nOne customer has no city; they are in no pair.',
    setupSql: `CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT NOT NULL, city TEXT);
CREATE TABLE orders (
  id INTEGER PRIMARY KEY, customer_id INTEGER, total INTEGER NOT NULL, placed_on TEXT NOT NULL
);
INSERT INTO customers VALUES
  (1,'Aisha','Pune'), (2,'Bruno','Mumbai'), (3,'Chidi','Pune'),
  (4,'Dara','Chennai'), (5,'Elif',NULL);
INSERT INTO orders VALUES
  (1,1,4200,'2024-01-04'), (2,1,990,'2024-02-11'), (3,2,7600,'2024-01-19'),
  (4,3,350,'2024-03-02'),  (5,1,2400,'2024-03-15'), (6,NULL,1500,'2024-03-20');`,
    solutionSql: `
SELECT a.name AS a, b.name AS b
FROM customers a
JOIN customers b ON a.city = b.city AND a.id < b.id
ORDER BY a.city, a.name, b.name;`,
    expectRows: 1,
    orderMatters: true,
    hints: [
      '`a.id <> b.id` returns each pair twice — once in each order.',
      '`a.id < b.id` picks one ordering, which both halves the result and removes pairing somebody with themselves.',
      'Elif has a NULL city, and `NULL = NULL` is not true, so she pairs with nobody.',
    ],
    explanation:
      '`a.id < b.id` does two jobs at once: it excludes the self-pair that `=` would allow, and it returns (Aisha, Chidi) rather than both that and (Chidi, Aisha). Using `<>` instead gives every pair twice, which is the classic version of this bug.\n\nElif is absent for a third reason — her city is NULL, and `NULL = NULL` is unknown, so the join condition never holds for her.',
    learnTopic: 'sql/self-join',
    topicTags: ['self-join', 'pairs', 'null'],
  },

  {
    slug: 'three-table-join',
    title: 'Order lines, priced',
    category: 'joins',
    difficulty: 'Medium',
    statement:
      'Return each order line as the customer `name`, the product `title`, the `quantity`, and the line total as `line_total` (quantity × unit price).\n\nOrder by name, then title.',
    setupSql: `
CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE products  (id INTEGER PRIMARY KEY, title TEXT NOT NULL, price INTEGER NOT NULL);
CREATE TABLE lines_ (
  order_id INTEGER, customer_id INTEGER, product_id INTEGER, quantity INTEGER NOT NULL
);
INSERT INTO customers VALUES (1,'Aisha'), (2,'Bruno');
INSERT INTO products VALUES (10,'Cable',120), (11,'Dock',6200), (12,'Mouse',450);
INSERT INTO lines_ VALUES
  (1,1,10,3), (1,1,12,1), (2,2,11,1), (2,2,10,2);
`,
    solutionSql: `
SELECT c.name, p.title, l.quantity, l.quantity * p.price AS line_total
FROM lines_ l
JOIN customers c ON l.customer_id = c.id
JOIN products  p ON l.product_id  = p.id
ORDER BY c.name, p.title;`,
    expectRows: 4,
    orderMatters: true,
    hints: [
      'Start from the table that has both foreign keys.',
      'Two joins, each against the accumulated result.',
    ],
    explanation:
      'Joins are evaluated left to right, each against what came before. Starting from the junction table — the one holding both foreign keys — keeps each join a simple lookup.\n\nInner joins are right here because a line with no product or no customer would be corruption, not an optional relationship. That is the test for INNER against LEFT: is the missing side a legitimate absence, or a broken reference?',
    learnTopic: 'sql/inner-join',
    topicTags: ['inner-join', 'three-table'],
  },

  {
    slug: 'union-two-sources',
    title: 'Everyone we know about',
    category: 'joins',
    difficulty: 'Easy',
    statement:
      'The company kept staff in two tables after a merger. Return every distinct `name` across both, alphabetically.\n\nSome people appear in both.',
    setupSql: `
CREATE TABLE staff_old (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE staff_new (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
INSERT INTO staff_old VALUES (1,'Ada'), (2,'Grace'), (3,'Linus');
INSERT INTO staff_new VALUES (1,'Grace'), (2,'Barbara'), (3,'Alan');
`,
    solutionSql: `
SELECT name FROM staff_old
UNION
SELECT name FROM staff_new
ORDER BY name;`,
    expectRows: 5,
    orderMatters: true,
    hints: [
      'Two result sets stacked, not two tables joined.',
      'Grace is in both. `UNION` removes the duplicate; `UNION ALL` would keep it.',
    ],
    explanation:
      'A join makes rows **wider**; a set operation makes the result **longer**. Here the two tables mean the same thing, so they are stacked.\n\n`UNION` deduplicates and `UNION ALL` does not — and `UNION` is the more expensive of the two, because finding duplicates means sorting or hashing the whole combined result. Default to `UNION ALL` unless duplicates are actually possible and unwanted, which here they are.',
    learnTopic: 'sql/set-operations',
    topicTags: ['union', 'sets'],
  },

  {
    slug: 'union-all-with-tag',
    title: 'Which table did it come from?',
    category: 'joins',
    difficulty: 'Medium',
    statement:
      'Stack both staff tables again, but keep every row and record where it came from.\n\nReturn `source` (`old` or `new`) and `name`, ordered by source then name.',
    setupSql: `
CREATE TABLE staff_old (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE staff_new (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
INSERT INTO staff_old VALUES (1,'Ada'), (2,'Grace'), (3,'Linus');
INSERT INTO staff_new VALUES (1,'Grace'), (2,'Barbara'), (3,'Alan');
`,
    solutionSql: `
SELECT 'old' AS source, name FROM staff_old
UNION ALL
SELECT 'new' AS source, name FROM staff_new
ORDER BY source, name;`,
    expectRows: 6,
    orderMatters: true,
    hints: [
      'A literal in the SELECT list becomes a column.',
      'Every row is wanted, including the duplicate Grace — so `UNION ALL`.',
    ],
    explanation:
      'A literal tag column is how a `UNION ALL` keeps track of where a row came from, which the operation otherwise loses. It also makes `UNION ALL` safe where you might have reached for `UNION`: with a distinct literal in each branch, no row from one branch can be a duplicate of one from the other, so there is nothing to deduplicate and nothing to pay for.\n\nNote the column names come from the **first** branch — the second one\'s aliases are ignored entirely.',
    learnTopic: 'sql/set-operations',
    topicTags: ['union-all', 'sets', 'literal'],
  },

  {
    slug: 'in-both-tables',
    title: 'In both tables',
    category: 'joins',
    difficulty: 'Medium',
    statement: 'Return the `name` of everyone who appears in **both** staff tables, alphabetically.',
    setupSql: `
CREATE TABLE staff_old (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE staff_new (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
INSERT INTO staff_old VALUES (1,'Ada'), (2,'Grace'), (3,'Linus'), (4,'Barbara');
INSERT INTO staff_new VALUES (1,'Grace'), (2,'Barbara'), (3,'Alan');
`,
    solutionSql: `
SELECT name FROM staff_old
INTERSECT
SELECT name FROM staff_new
ORDER BY name;`,
    expectRows: 2,
    orderMatters: true,
    hints: ['`INTERSECT` returns rows present in both.', 'An inner join on `name` would also work.'],
    explanation:
      'Two ways to say this and they read differently. `INTERSECT` says "in both" directly; `JOIN … ON a.name = b.name` says it as a lookup and needs a `DISTINCT` if either side can repeat a name.\n\nMySQL only gained `INTERSECT` in **8.0.31**, which is why the join form is what older MySQL code uses and what an interviewer on that stack may expect.',
    dialectNote:
      '`INTERSECT` and `EXCEPT` arrived in MySQL 8.0.31. Before that, emulate them with a join and an anti-join respectively.',
    learnTopic: 'sql/set-operations',
    topicTags: ['intersect', 'sets'],
  },

  {
    slug: 'in-the-first-only',
    title: 'Left behind by the merger',
    category: 'joins',
    difficulty: 'Medium',
    statement:
      'Return the `name` of everyone in the **old** table who is not in the new one, alphabetically.',
    setupSql: `
CREATE TABLE staff_old (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE staff_new (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
INSERT INTO staff_old VALUES (1,'Ada'), (2,'Grace'), (3,'Linus'), (4,'Barbara');
INSERT INTO staff_new VALUES (1,'Grace'), (2,'Barbara'), (3,'Alan');
`,
    solutionSql: `
SELECT name FROM staff_old
EXCEPT
SELECT name FROM staff_new
ORDER BY name;`,
    expectRows: 2,
    orderMatters: true,
    hints: [
      '`EXCEPT` is "in the first and not the second".',
      'It is **not** symmetric — swapping the two gives a different answer.',
    ],
    explanation:
      '`EXCEPT` (Oracle spells it `MINUS`) is the only one of the three set operations that is not symmetric: `A EXCEPT B` and `B EXCEPT A` are different questions with different answers, and swapping the operands is a real bug rather than a style choice. Here the reverse would return Alan.',
    learnTopic: 'sql/set-operations',
    topicTags: ['except', 'sets'],
  },

  {
    slug: 'cross-join-grid',
    title: 'Every size in every colour',
    category: 'joins',
    difficulty: 'Easy',
    statement:
      'Return every combination of `size` and `colour` as `size`, `colour`, ordered by size then colour.',
    setupSql: `
CREATE TABLE sizes   (size TEXT PRIMARY KEY);
CREATE TABLE colours (colour TEXT PRIMARY KEY);
INSERT INTO sizes VALUES ('L'), ('M'), ('S');
INSERT INTO colours VALUES ('black'), ('white');
`,
    solutionSql: 'SELECT s.size, c.colour FROM sizes s CROSS JOIN colours c ORDER BY s.size, c.colour;',
    expectRows: 6,
    orderMatters: true,
    hints: ['No condition at all — that is what makes it a cross join.', '3 sizes × 2 colours = 6 rows.'],
    explanation:
      'A `CROSS JOIN` is every combination, and writing it explicitly is worth the extra word: it tells the next reader that the missing `ON` is deliberate rather than lost. The same query written `FROM sizes, colours` is identical and indistinguishable from a forgotten join condition — which on two large tables is a query that never finishes.',
    learnTopic: 'sql/full-and-cross-join',
    topicTags: ['cross-join'],
  },

  {
    slug: 'full-outer-emulated',
    title: 'Reconcile the two tables',
    category: 'joins',
    difficulty: 'Hard',
    statement:
      'Return one row for every name in **either** staff table, as `name`, `in_old` and `in_new` — each `1` or `0`. Alphabetical.\n\nThis is a reconciliation: the point is to see who is missing from which side.',
    setupSql: `
CREATE TABLE staff_old (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE staff_new (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
INSERT INTO staff_old VALUES (1,'Ada'), (2,'Grace'), (3,'Linus');
INSERT INTO staff_new VALUES (1,'Grace'), (2,'Barbara');
`,
    solutionSql: `
WITH everyone AS (
  SELECT name FROM staff_old
  UNION
  SELECT name FROM staff_new
)
SELECT e.name,
       CASE WHEN o.name IS NULL THEN 0 ELSE 1 END AS in_old,
       CASE WHEN n.name IS NULL THEN 0 ELSE 1 END AS in_new
FROM everyone e
LEFT JOIN staff_old o ON o.name = e.name
LEFT JOIN staff_new n ON n.name = e.name
ORDER BY e.name;`,
    expectRows: 4,
    orderMatters: true,
    hints: [
      'Build the list of all names first — that is a UNION.',
      'Then LEFT JOIN each table onto it and check whether anything matched.',
      'A `FULL OUTER JOIN` would do this in one step, but MySQL has none — and neither does the engine here.',
    ],
    explanation:
      'This is what a `FULL OUTER JOIN` is for: showing in-A-only, in-B-only and in-both in one result. Neither MySQL nor SQLite has one, so it is built from a `UNION` of the keys plus two `LEFT JOIN`s — which is also the shape that survives adding a third source.\n\nThe alternative emulation is `LEFT JOIN … UNION … RIGHT JOIN`, and `UNION` there is load-bearing: the matched rows are produced by both halves and `UNION ALL` would show them twice.',
    dialectNote:
      'PostgreSQL has `FULL OUTER JOIN` and would do this in one statement. MySQL and SQLite do not, so this emulation is the portable form.',
    learnTopic: 'sql/full-and-cross-join',
    topicTags: ['full-outer', 'union', 'reconciliation'],
  },

  {
    slug: 'busiest-city',
    title: 'Which city orders most?',
    category: 'joins',
    difficulty: 'Medium',
    statement:
      'Return each `city` and the total spent by customers there as `spent`, highest first.\n\nIgnore customers with no city, and cities with no orders.',
    setupSql: `CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT NOT NULL, city TEXT);
CREATE TABLE orders (
  id INTEGER PRIMARY KEY, customer_id INTEGER, total INTEGER NOT NULL, placed_on TEXT NOT NULL
);
INSERT INTO customers VALUES
  (1,'Aisha','Pune'), (2,'Bruno','Mumbai'), (3,'Chidi','Pune'),
  (4,'Dara','Chennai'), (5,'Elif',NULL);
INSERT INTO orders VALUES
  (1,1,4200,'2024-01-04'), (2,1,990,'2024-02-11'), (3,2,7600,'2024-01-19'),
  (4,3,350,'2024-03-02'),  (5,1,2400,'2024-03-15'), (6,NULL,1500,'2024-03-20');`,
    solutionSql: `
SELECT c.city, SUM(o.total) AS spent
FROM customers c
JOIN orders o ON o.customer_id = c.id
WHERE c.city IS NOT NULL
GROUP BY c.city
ORDER BY spent DESC;`,
    expectRows: 2,
    orderMatters: true,
    hints: [
      'An inner join drops both the cityless customer and the customerless order for you.',
      'Then group by city.',
    ],
    explanation:
      'Here the inner join is doing exactly what the question asks — dropping the unmatched rows on both sides — so the `WHERE` only has to handle the customer whose city is NULL but who *does* have orders. Reading which exclusions the join gives you for free, and which you still have to write, is the habit worth building.',
    learnTopic: 'sql/inner-join',
    topicTags: ['inner-join', 'group-by'],
  },

  {
    slug: 'orders-above-their-own-average',
    title: 'A bigger order than usual',
    category: 'joins',
    difficulty: 'Hard',
    statement:
      "Return each order as `name`, `total` where the order is larger than that customer's own average order, biggest first.",
    setupSql: `CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT NOT NULL, city TEXT);
CREATE TABLE orders (
  id INTEGER PRIMARY KEY, customer_id INTEGER, total INTEGER NOT NULL, placed_on TEXT NOT NULL
);
INSERT INTO customers VALUES
  (1,'Aisha','Pune'), (2,'Bruno','Mumbai'), (3,'Chidi','Pune'),
  (4,'Dara','Chennai'), (5,'Elif',NULL);
INSERT INTO orders VALUES
  (1,1,4200,'2024-01-04'), (2,1,990,'2024-02-11'), (3,2,7600,'2024-01-19'),
  (4,3,350,'2024-03-02'),  (5,1,2400,'2024-03-15'), (6,NULL,1500,'2024-03-20');`,
    solutionSql: `
SELECT c.name, o.total
FROM orders o
JOIN customers c ON o.customer_id = c.id
JOIN (
  SELECT customer_id, AVG(total) AS avg_total
  FROM orders WHERE customer_id IS NOT NULL GROUP BY customer_id
) a ON a.customer_id = o.customer_id
WHERE o.total > a.avg_total
ORDER BY o.total DESC;`,
    expectRows: 1,
    orderMatters: true,
    hints: [
      'Each order is compared against a different number — its own customer\'s average.',
      'Pre-compute one average per customer in a derived table, then join it back.',
      'Bruno has one order, so it cannot be above his average.',
    ],
    explanation:
      'A derived table computes each average once per customer rather than once per order, which is what a correlated subquery would do. Aisha averages 2,530 across three orders, so only her 4,200 clears it; Bruno and Chidi each have a single order, which is exactly their own average and therefore not above it.',
    learnTopic: 'sql/correlated-subqueries',
    topicTags: ['derived-table', 'join', 'aggregate'],
  },

  {
    slug: 'most-recent-order-per-customer',
    title: 'Each customer’s most recent order',
    category: 'joins',
    difficulty: 'Hard',
    statement:
      'Return the most recent order for each customer as `name`, `placed_on`, `total`, ordered by name.\n\nCustomers with no orders are out of scope.',
    setupSql: `CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT NOT NULL, city TEXT);
CREATE TABLE orders (
  id INTEGER PRIMARY KEY, customer_id INTEGER, total INTEGER NOT NULL, placed_on TEXT NOT NULL
);
INSERT INTO customers VALUES
  (1,'Aisha','Pune'), (2,'Bruno','Mumbai'), (3,'Chidi','Pune'),
  (4,'Dara','Chennai'), (5,'Elif',NULL);
INSERT INTO orders VALUES
  (1,1,4200,'2024-01-04'), (2,1,990,'2024-02-11'), (3,2,7600,'2024-01-19'),
  (4,3,350,'2024-03-02'),  (5,1,2400,'2024-03-15'), (6,NULL,1500,'2024-03-20');`,
    solutionSql: `
SELECT c.name, o.placed_on, o.total
FROM orders o
JOIN customers c ON o.customer_id = c.id
WHERE o.placed_on = (
  SELECT MAX(x.placed_on) FROM orders x WHERE x.customer_id = o.customer_id
)
ORDER BY c.name;`,
    expectRows: 3,
    orderMatters: true,
    hints: [
      'For each order, ask whether it is the latest one that customer placed.',
      'A correlated subquery can compare against the maximum for *that* customer.',
      '`ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY placed_on DESC) = 1` is the other way.',
    ],
    explanation:
      'The greatest-row-per-group problem, and one of the most-asked shapes there is. The correlated `= (SELECT MAX(…))` form returns **every** row tied for the latest, which is often what you want and occasionally not; `ROW_NUMBER() … = 1` returns exactly one per group, chosen by the tiebreak you supply.\n\nChoosing between them is choosing what to do about ties, which is worth deciding before writing either.',
    learnTopic: 'sql/correlated-subqueries',
    topicTags: ['greatest-per-group', 'correlated', 'join'],
  },

  {
    slug: 'friend-page-recommendations',
    title: 'Pages your friends like that you do not',
    category: 'joins',
    difficulty: 'Medium',
    statement:
      '`friendships` records who is friends with whom — **both directions are stored**, so a friendship appears as two rows. `likes` records who liked which page.\n\nFor every user, recommend the pages their friends like. Never recommend a page they already like themselves.\n\nReturn `user_id` and `page_id`, each pair once, ordered by user then page.',
    setupSql: `
CREATE TABLE friendships (
  user_id   INTEGER NOT NULL,
  friend_id INTEGER NOT NULL,
  PRIMARY KEY (user_id, friend_id)
);
INSERT INTO friendships VALUES
  (1, 2), (2, 1),
  (1, 3), (3, 1),
  (2, 3), (3, 2);

CREATE TABLE likes (
  user_id INTEGER NOT NULL,
  page_id INTEGER NOT NULL,
  PRIMARY KEY (user_id, page_id)
);
INSERT INTO likes VALUES
  (1, 10), (1, 20),
  (2, 20), (2, 30),
  (3, 30), (3, 40);
`,
    solutionSql: `
SELECT DISTINCT f.user_id, l.page_id
FROM friendships f
JOIN likes l ON l.user_id = f.friend_id
WHERE NOT EXISTS (
  SELECT 1 FROM likes mine
  WHERE mine.user_id = f.user_id
    AND mine.page_id = l.page_id
)
ORDER BY f.user_id, l.page_id;`,
    expectRows: 6,
    orderMatters: true,
    hints: [
      'Start by joining a user to their friends, then their friends to what those friends liked.',
      'Two friends can like the same page, so the same recommendation arrives twice — `DISTINCT`.',
      'Removing what they already like is an anti-join: `NOT EXISTS` against their own rows.',
    ],
    explanation:
      'A three-step query that reads as one sentence: **join to your friends, join to what they liked, subtract what you already like.**\n\nThe `DISTINCT` is load-bearing rather than defensive. User 1 is friends with both 2 and 3, and both of them like page 30, so the join produces that recommendation twice. Without `DISTINCT` the answer has duplicate rows — and if the next step is a count of recommendations, it is also wrong rather than merely untidy.\n\nThe exclusion is the interesting half. `NOT EXISTS` is the shape to reach for: it is correlated per candidate row, it stops at the first match, and — unlike `NOT IN` — it is unaffected by a NULL turning up in the set it checks against. `LEFT JOIN likes mine ON … WHERE mine.page_id IS NULL` is the same query written the other way and performs comparably on most planners; `NOT IN` is the one to be careful with.\n\nOne assumption is worth stating out loud, because an interviewer will ask: this relies on friendships being stored **both ways**. If only one direction were recorded, half the recommendations would silently go missing, and the fix would be to union the table with itself flipped before joining.',
    learnTopic: 'sql/exists-in-any-all',
    source: {
      platform: 'github',
      url: 'https://github.com/Aafreen29/SQL-Interview-Prep-Question',
    },
    topicTags: ['join', 'not-exists', 'distinct', 'anti-join'],
  },
];