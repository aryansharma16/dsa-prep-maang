/**
 * Select & filter — get the right rows and the right columns out of one table.
 *
 * The opening category, and the one that has to be genuinely easy: someone
 * arriving here has read the Learn track and never run a query. Every problem
 * is one table, no joins, no aggregates.
 *
 * Three of them are traps rather than exercises, and they are the reason this
 * category is not four problems long: `NOT IN` with a NULL, `<>` skipping
 * NULLs, and `DISTINCT` applying to the row rather than the column are the
 * three mistakes that produce a *wrong answer with no error*, and reading about
 * them is demonstrably not the same as being caught by one.
 *
 * Statements are written from scratch. Where a problem's shape comes from a
 * known one, `source` credits it — the schema, the rows and the words here are
 * ours, which is also what makes each one runnable offline.
 */

export default [
  {
    slug: 'recyclable-and-low-fat',
    title: 'Recyclable and low-fat products',
    category: 'select',
    difficulty: 'Easy',
    statement:
      'The `products` table records whether each product is low fat and whether its packaging is recyclable, as `Y` or `N`.\n\nReturn the `product_id` of every product that is **both** low fat and recyclable.',
    setupSql: `
CREATE TABLE products (
  product_id INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  low_fats   TEXT NOT NULL,
  recyclable TEXT NOT NULL
);
INSERT INTO products VALUES
  (1, 'Oat crackers',   'Y', 'N'),
  (2, 'Rice cakes',     'Y', 'Y'),
  (3, 'Cheese straws',  'N', 'Y'),
  (4, 'Dried mango',    'Y', 'Y'),
  (5, 'Chocolate bar',  'N', 'N');
`,
    solutionSql: "SELECT product_id FROM products WHERE low_fats = 'Y' AND recyclable = 'Y';",
    expectRows: 2,
    hints: [
      'Both conditions have to hold, so they are joined with AND rather than OR.',
      "The columns hold the letters `'Y'` and `'N'`, not numbers or booleans — compare against a quoted string.",
    ],
    explanation:
      'Two conditions on one table, joined with `AND`. The only thing to be careful about is the quoting: `low_fats` is text, so `low_fats = Y` without quotes would be read as a column name and fail.',
    learnTopic: 'sql/where-and-operators',
    source: { platform: 'leetcode', url: 'https://leetcode.com/problems/recyclable-and-low-fat-products/', lcId: 1757 },
    topicTags: ['where', 'and'],
  },

  {
    slug: 'not-referred-by',
    title: 'Customers not referred by number two',
    category: 'select',
    difficulty: 'Easy',
    statement:
      'Each row of `customers` records who referred that customer, or `NULL` if nobody did.\n\nReturn the `name` of every customer who was **not** referred by customer 2 — including everyone who was not referred at all.',
    setupSql: `
CREATE TABLE customers (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  referee_id  INTEGER
);
INSERT INTO customers VALUES
  (1, 'Aisha',  NULL),
  (2, 'Bruno',  NULL),
  (3, 'Chidi',  2),
  (4, 'Dara',   1),
  (5, 'Elif',   2),
  (6, 'Farid',  NULL),
  (7, 'Gita',   3);
`,
    solutionSql:
      'SELECT name FROM customers WHERE referee_id <> 2 OR referee_id IS NULL;',
    expectRows: 5,
    hints: [
      'Four customers have no referee at all. Does your condition keep them?',
      '`referee_id <> 2` is unknown when `referee_id` is NULL, and WHERE keeps only rows that are *true*.',
      'Say the second half out loud: `OR referee_id IS NULL`.',
    ],
    explanation:
      "The trap is that `referee_id <> 2` silently drops every NULL row. `NULL <> 2` is not true and not false — it is unknown, and WHERE keeps only what is true. Reading the query in English says \"not referred by 2\", which obviously includes people nobody referred, so the query has to say so: `OR referee_id IS NULL`. This is the single most common way a report quietly under-counts.",
    dialectNote: '',
    learnTopic: 'sql/null-handling',
    source: { platform: 'leetcode', url: 'https://leetcode.com/problems/find-customer-referee/', lcId: 584 },
    topicTags: ['null', 'where', 'trap'],
  },

  {
    slug: 'large-countries',
    title: 'Large countries',
    category: 'select',
    difficulty: 'Easy',
    statement:
      'A country counts as **large** if its area is at least 3,000,000 km² *or* its population is at least 25,000,000.\n\nReturn the `name`, `population` and `area` of every large country.',
    setupSql: `
CREATE TABLE countries (
  name        TEXT PRIMARY KEY,
  continent   TEXT NOT NULL,
  area        INTEGER NOT NULL,
  population  INTEGER NOT NULL
);
INSERT INTO countries VALUES
  ('Afghanistan', 'Asia',    652230,   25500100),
  ('Albania',     'Europe',  28748,    2831741),
  ('Algeria',     'Africa',  2381741,  37100000),
  ('Andorra',     'Europe',  468,      78115),
  ('Angola',      'Africa',  1246700,  20609294),
  ('Australia',   'Oceania', 7692024,  23545500);
`,
    solutionSql:
      'SELECT name, population, area FROM countries WHERE area >= 3000000 OR population >= 25000000;',
    expectRows: 3,
    hints: [
      'Either condition is enough on its own, so they are joined with OR.',
      'Check the column order the question asks for — name, then population, then area.',
    ],
    explanation:
      'An `OR`, and the column order matters: the question asks for name, population, area, and the grader compares column names in order. Australia qualifies on area alone despite a population under the threshold, which is what makes `OR` the right operator rather than `AND`.',
    learnTopic: 'sql/where-and-operators',
    source: { platform: 'leetcode', url: 'https://leetcode.com/problems/big-countries/', lcId: 595 },
    topicTags: ['where', 'or'],
  },
  {
    slug: 'distinct-is-the-whole-row',
    title: 'How many distinct departments?',
    category: 'select',
    difficulty: 'Easy',
    statement:
      'Return every distinct `dept` in `staff`, one row each, ordered alphabetically.\n\nThere are six people and fewer than six departments.',
    setupSql: `
CREATE TABLE staff (
  id   INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  dept TEXT NOT NULL
);
INSERT INTO staff VALUES
  (1,'Ada','Engineering'), (2,'Grace','Engineering'), (3,'Linus','Data'),
  (4,'Barbara','Data'),    (5,'Alan','Design'),       (6,'Radia','Data');
`,
    solutionSql: 'SELECT DISTINCT dept FROM staff ORDER BY dept;',
    expectRows: 3,
    orderMatters: true,
    hints: [
      '`DISTINCT` goes after `SELECT`, not around a column.',
      'Selecting `name` as well would give six rows again — every pair is unique.',
    ],
    explanation:
      '`DISTINCT` applies to the **whole selected row**, not to one column, and it is not a function — `SELECT DISTINCT(dept), name` looks like it de-duplicates `dept` and does not. The brackets are just brackets, and since every name differs, nothing would be removed at all.',
    learnTopic: 'sql/distinct-and-aliases',
    topicTags: ['distinct'],
  },

  {
    slug: 'half-open-date-range',
    title: 'Everything that happened in March',
    category: 'select',
    difficulty: 'Medium',
    statement:
      'Return the `id` and `happened_at` of every event in **March 2024**, oldest first.\n\n`happened_at` is a timestamp, not a date.',
    setupSql: `
CREATE TABLE events (
  id          INTEGER PRIMARY KEY,
  label       TEXT NOT NULL,
  happened_at TEXT NOT NULL
);
INSERT INTO events VALUES
  (1,'deploy',   '2024-02-29 23:59:00'),
  (2,'rollback', '2024-03-01 00:00:00'),
  (3,'alert',    '2024-03-15 09:30:00'),
  (4,'deploy',   '2024-03-31 09:15:00'),
  (5,'alert',    '2024-03-31 23:59:59'),
  (6,'deploy',   '2024-04-01 00:00:01');
`,
    solutionSql:
      "SELECT id, happened_at FROM events WHERE happened_at >= '2024-03-01' AND happened_at < '2024-04-01' ORDER BY happened_at;",
    expectRows: 4,
    orderMatters: true,
    hints: [
      "`BETWEEN '2024-03-01' AND '2024-03-31'` looks right and loses two rows. Work out which.",
      'A timestamp on the 31st is *greater* than `2024-03-31 00:00:00`, so an inclusive upper bound misses the whole last day.',
      'Use a half-open range: `>= start AND < the first instant of the next month`.',
    ],
    explanation:
      "`BETWEEN` is inclusive at both ends, and on a timestamp column that is a trap: `'2024-03-31'` means midnight, so every event later that day is above the upper bound and disappears. Two of the six here.\n\nA half-open range — `>= '2024-03-01' AND < '2024-04-01'` — is correct for dates and timestamps alike, needs no thought about how many days the month has, and is the form worth making automatic.",
    learnTopic: 'sql/where-and-operators',
    topicTags: ['dates', 'between', 'trap'],
  },

  {
    slug: 'starts-with',
    title: 'Names beginning with A',
    category: 'select',
    difficulty: 'Easy',
    statement:
      'Return the `name` of everyone in `staff` whose name begins with a capital `A`, alphabetically.',
    setupSql: `
CREATE TABLE staff (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
INSERT INTO staff VALUES
  (1,'Ada'), (2,'Alan'), (3,'Barbara'), (4,'Grace'), (5,'Amara'), (6,'Linus');
`,
    solutionSql: "SELECT name FROM staff WHERE name LIKE 'A%' ORDER BY name;",
    expectRows: 3,
    orderMatters: true,
    hints: ['`%` matches any run of characters, including none.', "So `'A%'` is \"starts with A\"."],
    explanation:
      "`LIKE 'A%'` is the one wildcard shape an index can serve: the engine knows the value starts with A, so it can seek to that part of the B-tree and stop when it passes. `LIKE '%a%'` cannot use an index at all — a value containing an `a` could be anywhere in the sort order — which is why full-text search exists.",
    learnTopic: 'sql/where-and-operators',
    topicTags: ['like', 'pattern'],
  },

  {
    slug: 'null-is-not-empty',
    title: 'Missing, and merely blank',
    category: 'select',
    difficulty: 'Medium',
    statement:
      'Some `bio` values are `NULL` — never filled in — and some are the empty string, which means somebody saved the form without typing anything.\n\nReturn the `name` of everyone whose `bio` is **NULL**, alphabetically. Do not include the blank ones.',
    setupSql: `
CREATE TABLE profiles (
  id   INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  bio  TEXT
);
INSERT INTO profiles VALUES
  (1,'Ada',    'Analytical engines.'),
  (2,'Grace',  NULL),
  (3,'Linus',  ''),
  (4,'Barbara',NULL),
  (5,'Alan',   '');
`,
    solutionSql: 'SELECT name FROM profiles WHERE bio IS NULL ORDER BY name;',
    expectRows: 2,
    orderMatters: true,
    hints: [
      "`bio = ''` finds the blank ones, not the missing ones.",
      '`IS NULL` is the only way to test for absence — `= NULL` matches nothing at all.',
    ],
    explanation:
      "`NULL` and `''` are different things and SQL keeps them apart: NULL is \"we do not know\", the empty string is \"we know, and it is nothing\". `bio = ''` returns Linus and Alan; `bio IS NULL` returns Grace and Barbara.\n\n`WHERE bio = NULL` returns neither — it evaluates to NULL, which is not true, so no row passes. It does not error, which is what makes it dangerous.",
    learnTopic: 'sql/null-handling',
    topicTags: ['null', 'empty-string'],
  },

  {
    slug: 'precedence-brackets',
    title: 'Bracket the OR',
    category: 'select',
    difficulty: 'Medium',
    statement:
      'Return the `name` of every product that is **in stock** and costs **either under 500 or over 5000**, cheapest first.',
    setupSql: `
CREATE TABLE products (
  id       INTEGER PRIMARY KEY,
  name     TEXT NOT NULL,
  price    INTEGER NOT NULL,
  in_stock INTEGER NOT NULL
);
INSERT INTO products VALUES
  (1,'Cable',      120,  1),
  (2,'Keyboard',   2400, 1),
  (3,'Monitor',    8900, 1),
  (4,'Mouse',      450,  0),
  (5,'Dock',       6200, 0),
  (6,'Adapter',    300,  1);
`,
    solutionSql:
      'SELECT name FROM products WHERE in_stock = 1 AND (price < 500 OR price > 5000) ORDER BY price;',
    expectRows: 3,
    orderMatters: true,
    hints: [
      '`AND` binds tighter than `OR`, so without brackets this reads as `(in_stock AND price < 500) OR price > 5000`.',
      'That version returns out-of-stock products too. Bracket the OR.',
    ],
    explanation:
      'Without the brackets the condition parses as `(in_stock = 1 AND price < 500) OR price > 5000`, which lets the out-of-stock Dock through on the second branch. Bracket any mixture of `AND` and `OR`, even where the precedence happens to be what you wanted — a reader cannot tell "correct" from "correct by accident", and neither can you in six months.',
    learnTopic: 'sql/where-and-operators',
    topicTags: ['and', 'or', 'precedence'],
  },

  {
    slug: 'computed-column',
    title: 'Price with tax',
    category: 'select',
    difficulty: 'Easy',
    statement:
      'Return each product as `name`, its `price`, and the price with 18% tax added as `with_tax`, rounded to two decimal places. Most expensive first.',
    setupSql: `
CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT NOT NULL, price REAL NOT NULL);
INSERT INTO products VALUES
  (1,'Cable',120.00), (2,'Keyboard',2400.00), (3,'Monitor',8900.00), (4,'Adapter',300.50);
`,
    solutionSql:
      'SELECT name, price, ROUND(price * 1.18, 2) AS with_tax FROM products ORDER BY price DESC;',
    expectRows: 4,
    orderMatters: true,
    hints: [
      'An expression in the SELECT list needs a name, or the column comes back called something unpredictable.',
      '18% added is `price * 1.18`.',
    ],
    explanation:
      'Any computed column needs an alias: without `AS with_tax` the column is named after the expression, which differs between engines and is not what the question asked for. The grader compares column names, so this is not cosmetic.\n\nNote `price` is `REAL` here. Had it been an integer, `price * 1.18` would still be fine — but `price / 7` would do **integer division** in SQLite and truncate.',
    dialectNote:
      'SQLite does integer division when both operands are integers: `7 / 2` is 3, where MySQL gives 3.5. Multiply by `1.0` or `CAST(x AS REAL)` when you want a fraction.',
    learnTopic: 'sql/distinct-and-aliases',
    topicTags: ['alias', 'arithmetic', 'round'],
  },

  {
    slug: 'in-a-list',
    title: 'Only these three cities',
    category: 'select',
    difficulty: 'Easy',
    statement:
      'Return the `name` and `city` of everyone based in Pune, Mumbai or Chennai, ordered by city then name.',
    setupSql: `
CREATE TABLE staff (id INTEGER PRIMARY KEY, name TEXT NOT NULL, city TEXT NOT NULL);
INSERT INTO staff VALUES
  (1,'Ada','Bengaluru'), (2,'Grace','Pune'), (3,'Linus','Mumbai'),
  (4,'Barbara','Chennai'), (5,'Alan','Pune'), (6,'Radia','Hyderabad');
`,
    solutionSql:
      "SELECT name, city FROM staff WHERE city IN ('Pune','Mumbai','Chennai') ORDER BY city, name;",
    expectRows: 4,
    orderMatters: true,
    hints: ['`IN (…)` is shorthand for a chain of `OR`s.', 'The values are text, so they are quoted.'],
    explanation:
      '`IN` and a chain of `OR`s mean the same thing and usually produce the same plan; `IN` is simply readable once the list is longer than two. The caution is its negation: `NOT IN` over a subquery containing a `NULL` returns nothing at all, which is a different topic and a much sharper edge.',
    learnTopic: 'sql/where-and-operators',
    topicTags: ['in', 'where'],
  },

  {
    slug: 'not-in-with-null',
    title: 'Everyone except these two',
    category: 'select',
    difficulty: 'Medium',
    statement:
      'The `excluded` table lists people to leave out — but one of its rows is `NULL`, left over from a bad import.\n\nReturn the `name` of everyone in `staff` who is **not** excluded, alphabetically.',
    setupSql: `
CREATE TABLE staff (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE excluded (name TEXT);
INSERT INTO staff VALUES (1,'Ada'), (2,'Grace'), (3,'Linus'), (4,'Barbara');
INSERT INTO excluded VALUES ('Grace'), (NULL), ('Linus');
`,
    solutionSql: `
SELECT s.name FROM staff s
WHERE NOT EXISTS (SELECT 1 FROM excluded e WHERE e.name = s.name)
ORDER BY s.name;`,
    expectRows: 2,
    orderMatters: true,
    hints: [
      '`WHERE name NOT IN (SELECT name FROM excluded)` returns **zero** rows. Work out why before changing it.',
      '`x NOT IN (a, b, NULL)` becomes `x <> a AND x <> b AND x <> NULL`, and the last one is never true.',
      '`NOT EXISTS` asks whether a row was found, which is never unknown.',
    ],
    explanation:
      'This is the `NOT IN` trap in its purest form. The subquery contains a NULL, so the expansion ends in `x <> NULL` — unknown, never true — and every row is rejected. An empty result, no error, no warning.\n\n`NOT EXISTS` is immune because it asks a yes/no question about whether a row was produced. The other fix is `WHERE name IS NOT NULL` inside the subquery, which is correct and is one more thing to remember. Default to `NOT EXISTS`.',
    learnTopic: 'sql/exists-in-any-all',
    topicTags: ['not-in', 'null', 'not-exists', 'trap'],
  },

  {
    slug: 'case-insensitive-match',
    title: 'However they typed it',
    category: 'select',
    difficulty: 'Medium',
    statement:
      'Users typed their city themselves, so the capitalisation varies.\n\nReturn the `name` of everyone whose `city` is Pune, however it was written, alphabetically.',
    setupSql: `
CREATE TABLE staff (id INTEGER PRIMARY KEY, name TEXT NOT NULL, city TEXT NOT NULL);
INSERT INTO staff VALUES
  (1,'Ada','pune'), (2,'Grace','PUNE'), (3,'Linus','Pune'),
  (4,'Barbara','Mumbai'), (5,'Alan','puNe');
`,
    solutionSql: "SELECT name FROM staff WHERE LOWER(city) = 'pune' ORDER BY name;",
    expectRows: 4,
    orderMatters: true,
    hints: [
      "`city = 'Pune'` matches one of the four.",
      'Normalise both sides — lowercase the column and compare against a lowercase literal.',
    ],
    explanation:
      "`LOWER(city) = 'pune'` is correct and has a cost worth naming: wrapping the column in a function means an ordinary index on `city` cannot be used, because the index stores the raw values. On a large table the fix is an **expression index** — `CREATE INDEX … ON staff((LOWER(city)))` — or a case-insensitive collation on the column, which makes plain `=` do the right thing with no function at all.",
    dialectNote:
      "MySQL's default collation is case-insensitive, so `city = 'Pune'` would already match all four there. SQLite and PostgreSQL are case-sensitive, so this problem needs `LOWER()` — a genuine difference worth knowing about rather than relying on.",
    learnTopic: 'sql/where-and-operators',
    topicTags: ['strings', 'lower', 'collation', 'index'],
  },

  {
    slug: 'flag-columns',
    title: 'Active and verified',
    category: 'select',
    difficulty: 'Easy',
    statement:
      'Return the `email` of every account that is both active and verified, alphabetically.\n\nBoth flags are stored as `1` for yes and `0` for no.',
    setupSql: `
CREATE TABLE accounts (
  id       INTEGER PRIMARY KEY,
  email    TEXT NOT NULL,
  active   INTEGER NOT NULL,
  verified INTEGER NOT NULL
);
INSERT INTO accounts VALUES
  (1,'ada@x.io',1,1), (2,'grace@x.io',1,0), (3,'linus@x.io',0,1),
  (4,'barbara@x.io',1,1), (5,'alan@x.io',0,0);
`,
    solutionSql: 'SELECT email FROM accounts WHERE active = 1 AND verified = 1 ORDER BY email;',
    expectRows: 2,
    orderMatters: true,
    hints: ['Both flags must be 1.', 'They are numbers here, so no quotes.'],
    explanation:
      'Straightforward, and the thing worth noticing is the storage: SQLite and MySQL have no real boolean, so flags are integers and `active = 1` is the comparison. PostgreSQL has a genuine `BOOLEAN`, where you would write `WHERE active AND verified`. Comparing an integer flag against the string `\'1\'` would still work here through type coercion, and is the kind of habit that stops an index being used elsewhere.',
    learnTopic: 'sql/data-types',
    topicTags: ['where', 'boolean'],
  },

  {
    slug: 'rename-for-the-caller',
    title: 'Name the columns for the report',
    category: 'select',
    difficulty: 'Easy',
    statement:
      'A report expects three columns called exactly `employee`, `department` and `annual_pay`.\n\nReturn one row per person from `staff`, ordered by `annual_pay` descending. Annual pay is twelve times the monthly `salary`.',
    setupSql: `
CREATE TABLE staff (
  id     INTEGER PRIMARY KEY,
  name   TEXT NOT NULL,
  dept   TEXT NOT NULL,
  salary INTEGER NOT NULL
);
INSERT INTO staff VALUES
  (1,'Ada','Engineering',95000), (2,'Grace','Engineering',82000),
  (3,'Linus','Data',74000),      (4,'Barbara','Data',91000);
`,
    solutionSql:
      'SELECT name AS employee, dept AS department, salary * 12 AS annual_pay FROM staff ORDER BY annual_pay DESC;',
    expectRows: 4,
    orderMatters: true,
    hints: [
      'Three aliases, spelled exactly as the report expects.',
      'The alias is usable in `ORDER BY` — that clause runs after `SELECT`.',
    ],
    explanation:
      "Aliases are the interface a query presents to whatever consumes it, and the grader checks them: a right answer with the wrong column names is reported as a naming problem rather than a data one.\n\nNote where the alias works. `ORDER BY annual_pay` is fine because `ORDER BY` runs *after* `SELECT` creates it. `WHERE annual_pay > 1000000` would not be — `WHERE` runs before, and the alias does not exist yet.",
    learnTopic: 'sql/distinct-and-aliases',
    topicTags: ['alias', 'order-by'],
  },

  {
    slug: 'odd-numbered-rows',
    title: 'Every other row',
    category: 'select',
    difficulty: 'Easy',
    statement:
      'Return the `id` and `name` of every employee whose `id` is **odd**, lowest first.\n\nRead the ids in the sample before you answer — they have a gap in them, and that gap is the point.',
    setupSql: `
CREATE TABLE employees (
  id   INTEGER PRIMARY KEY,
  name TEXT NOT NULL
);
INSERT INTO employees VALUES
  (1, 'Ada'),
  (2, 'Grace'),
  (3, 'Linus'),
  (5, 'Barbara'),
  (8, 'Alan');
`,
    solutionSql: 'SELECT id, name FROM employees WHERE id % 2 = 1 ORDER BY id;',
    expectRows: 3,
    orderMatters: true,
    hints: [
      'The remainder after dividing by two is what "odd" means.',
      '`id % 2` is 1 for an odd number and 0 for an even one.',
    ],
    explanation:
      '`WHERE id % 2 = 1` is the whole query. What makes this worth a problem is the question underneath it: **"every other row" and "every odd id" are not the same request**, and the sample data is built so they disagree. The ids here are 1, 2, 3, 5, 8 — five rows. Odd ids give you three of them. Rows in odd *positions* would give you the 1st, 3rd and 5th, which is Ada, Linus and Alan. Two different answers, and the id-based one is only ever right when the ids happen to have no gaps.\n\nIf a question really means positions, the id cannot answer it and a window function has to: `ROW_NUMBER() OVER (ORDER BY id) % 2 = 1`. Worth asking which one an interviewer means before writing anything.',
    dialectNote:
      'MySQL also spells this `MOD(id, 2) = 1`, and both dialects accept the `%` operator. SQLite has only `%`, so that is the form to write here.',
    learnTopic: 'sql/where-and-operators',
    source: {
      platform: 'github',
      url: 'https://github.com/Aafreen29/SQL-Interview-Prep-Question',
    },
    topicTags: ['where', 'modulo', 'order-by'],
  },
];