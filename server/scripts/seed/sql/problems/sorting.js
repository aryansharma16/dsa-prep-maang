/**
 * Sorting & pagination — order, ties, top-N, and the Nth of something.
 *
 * The category where `orderMatters` is usually true, and that is the point: an
 * ordering the question asks for is part of the answer, and grading it any
 * other way would accept a query that found the right rows and sorted them
 * wrongly.
 *
 * "The Nth highest" gets two problems rather than one because the interesting
 * half is what happens to ties, and a single problem can only demonstrate one
 * answer to that.
 */

export default [
  {
    slug: 'second-highest-salary',
    title: 'The second highest salary',
    category: 'sorting',
    difficulty: 'Medium',
    statement:
      'Return the **second highest** distinct salary in `employees`, in a column named `second_highest`.\n\nTwo people on the same salary share one place — so if the top two earners are paid equally, the second highest *salary* is the next distinct figure below them.\n\nIf there is no second salary, return `NULL` rather than no rows.',
    setupSql: `
CREATE TABLE employees (
  id     INTEGER PRIMARY KEY,
  name   TEXT NOT NULL,
  salary INTEGER NOT NULL
);
INSERT INTO employees VALUES
  (1, 'Ada',     95000),
  (2, 'Barbara', 95000),
  (3, 'Grace',   82000),
  (4, 'Linus',   74000),
  (5, 'Radia',   82000);
`,
    solutionSql:
      'SELECT MAX(salary) AS second_highest FROM employees WHERE salary < (SELECT MAX(salary) FROM employees);',
    expectRows: 1,
    orderMatters: false,
    hints: [
      'Two people earn 95,000. Does your answer say 95,000 or 82,000? The question asks for the second distinct *salary*.',
      'One way: find the maximum salary that is below the maximum salary.',
      '`LIMIT 1 OFFSET 1` also works — but only over `SELECT DISTINCT salary`, and it returns no rows rather than NULL when there is no second.',
    ],
    explanation:
      'Two answers work and they differ on an edge case worth knowing. `MAX(salary) WHERE salary < (SELECT MAX(salary))` returns `NULL` when there is no second salary, because `MAX` over zero rows is NULL. `SELECT DISTINCT salary ORDER BY salary DESC LIMIT 1 OFFSET 1` returns **no rows at all** in the same situation, which a caller expecting exactly one row may not handle. The question asks for NULL, so it picks the first. `DISTINCT` matters either way: without it the two people on 95,000 would make the "second highest" 95,000 again.',
    learnTopic: 'sql/order-and-limit',
    source: { platform: 'leetcode', url: 'https://leetcode.com/problems/second-highest-salary/', lcId: 176 },
    topicTags: ['order-by', 'limit', 'subquery', 'ties'],
  },

  {
    slug: 'top-three-by-score',
    title: 'The three highest scores',
    category: 'sorting',
    difficulty: 'Easy',
    statement:
      'Return the `name` and `score` of the three highest-scoring players in `players`, highest first.\n\nBreak ties by `name`, alphabetically, so the answer is the same every time you run it.',
    setupSql: `
CREATE TABLE players (
  id    INTEGER PRIMARY KEY,
  name  TEXT NOT NULL,
  score INTEGER NOT NULL
);
INSERT INTO players VALUES
  (1, 'Nadia',  88),
  (2, 'Omar',   94),
  (3, 'Priya',  88),
  (4, 'Quentin',72),
  (5, 'Rosa',   99),
  (6, 'Sam',    61);
`,
    solutionSql: 'SELECT name, score FROM players ORDER BY score DESC, name ASC LIMIT 3;',
    expectRows: 3,
    orderMatters: true,
    hints: [
      'Two players are on 88. The question says how to break that tie.',
      'A second `ORDER BY` key is what breaks a tie — `ORDER BY score DESC, name`.',
    ],
    explanation:
      'The tiebreak is not decoration. Nadia and Priya both score 88, so without `, name` the third row is whichever the engine happened to reach first — and that can change between runs, between versions, and after an index is added. Any query with `LIMIT` and a non-unique sort key needs a tiebreak that is unique, or the answer is only accidentally stable.',
    learnTopic: 'sql/order-and-limit',
    topicTags: ['order-by', 'limit', 'ties'],
  },

  {
    slug: 'nulls-last',
    title: 'Put the unknowns at the end',
    category: 'sorting',
    difficulty: 'Medium',
    statement:
      'Return every row of `tasks` as `title` and `due_on`, ordered by `due_on` **soonest first**, with tasks that have no due date at the **end**.\n\nBreak any remaining tie by `title`, alphabetically.',
    setupSql: `
CREATE TABLE tasks (
  id     INTEGER PRIMARY KEY,
  title  TEXT NOT NULL,
  due_on TEXT
);
INSERT INTO tasks VALUES
  (1, 'Ship the migration', '2024-03-01'),
  (2, 'Write the postmortem', NULL),
  (3, 'Review the schema',  '2024-02-14'),
  (4, 'Archive old logs',   NULL),
  (5, 'Rotate the keys',    '2024-03-01');
`,
    solutionSql:
      'SELECT title, due_on FROM tasks ORDER BY due_on IS NULL, due_on ASC, title ASC;',
    expectRows: 5,
    orderMatters: true,
    hints: [
      'Sorting by `due_on` alone puts the NULLs somewhere — but where depends on the engine.',
      '`due_on IS NULL` is 0 for a real date and 1 for a missing one. Sort by that first.',
      'PostgreSQL has `NULLS LAST`; MySQL and SQLite do not, so this is the portable way.',
    ],
    explanation:
      'Where NULLs sort is not standardised: MySQL and SQLite put them **first** when ascending, PostgreSQL puts them **last**. So a query whose ordering matters has to say what it wants rather than inherit a default that changes with the engine. `ORDER BY due_on IS NULL` sorts on a boolean — false (0) before true (1) — which puts the real dates first and the unknowns after, everywhere.',
    dialectNote:
      'PostgreSQL would let you write `ORDER BY due_on NULLS LAST`. MySQL and the SQLite this runs on have no such clause, so the `IS NULL` trick is the portable form and the one worth knowing.',
    learnTopic: 'sql/order-and-limit',
    topicTags: ['order-by', 'null'],
  },

  {
    slug: 'page-three-of-the-list',
    title: 'The third page of results',
    category: 'sorting',
    difficulty: 'Easy',
    statement:
      'The catalogue is shown three products to a page, ordered by `price` **highest first**, ties broken by `name` alphabetically.\n\nReturn the `name` and `price` on **page 3**.',
    setupSql: `
CREATE TABLE products (
  id    INTEGER PRIMARY KEY,
  name  TEXT NOT NULL,
  price INTEGER NOT NULL
);
INSERT INTO products VALUES
  (1,  'Anvil',      900),
  (2,  'Bellows',    750),
  (3,  'Chisel',     750),
  (4,  'Drill',      600),
  (5,  'Emery',      480),
  (6,  'File',       480),
  (7,  'Gouge',      420),
  (8,  'Hammer',     360),
  (9,  'Ingot',      300),
  (10, 'Jointer',    240),
  (11, 'Kiln',       120);
`,
    solutionSql:
      'SELECT name, price FROM products ORDER BY price DESC, name ASC LIMIT 3 OFFSET 6;',
    expectRows: 3,
    orderMatters: true,
    hints: [
      'Page size is 3. Page 1 skips nothing, page 2 skips 3 — so page 3 skips how many?',
      '`LIMIT 3 OFFSET 6`. The offset is `(page - 1) * size`, never `page * size`.',
      'The `ORDER BY` needs both keys, or the pages overlap where prices tie.',
    ],
    explanation:
      'Two things decide whether pagination works, and only one of them is the `OFFSET`.\n\nThe arithmetic is `(page - 1) * size` — page 3 skips 6 rows, not 9. Off-by-one here shows up as a page that quietly starts in the wrong place, which nobody notices until a user does.\n\nThe **tiebreak is the part that actually breaks**. Bellows and Chisel both cost 750, as do Emery and File. `ORDER BY price DESC` alone leaves their relative order undefined, and the engine is free to answer differently on two different runs — so a row can appear on page 2 *and* page 3, while another appears on neither. Any sort a `LIMIT` is applied to needs a final key that is unique.\n\nWorth knowing for the follow-up question: `OFFSET` is not free. The engine produces and discards all six skipped rows, so page 5,000 costs 15,000 rows of work. Deep pagination is done by remembering the last row you saw — `WHERE (price, name) < (:price, :name) ORDER BY price DESC, name LIMIT 3` — which is constant-cost at any depth.',
    learnTopic: 'sql/order-and-limit',
    source: {
      platform: 'github',
      url: 'https://github.com/Aafreen29/SQL-Interview-Prep-Question',
    },
    topicTags: ['order-by', 'limit', 'offset', 'pagination'],
  },

  {
    slug: 'max-without-max',
    title: 'The largest reading, without MAX',
    category: 'sorting',
    difficulty: 'Easy',
    statement:
      'Return the largest value in `readings`, in a column named `largest` — **without using an aggregate function**. No `MAX`, no `MIN`.\n\nOne sensor has not reported yet, so one row has no value at all.',
    setupSql: `
CREATE TABLE readings (
  id     INTEGER PRIMARY KEY,
  sensor TEXT NOT NULL,
  value  INTEGER
);
INSERT INTO readings VALUES
  (1, 'north', 412),
  (2, 'south', 903),
  (3, 'east',  NULL),
  (4, 'west',  651),
  (5, 'inner', 903);
`,
    solutionSql:
      'SELECT value AS largest FROM readings WHERE value IS NOT NULL ORDER BY value DESC LIMIT 1;',
    expectRows: 1,
    orderMatters: false,
    hints: [
      'Sorting puts the largest value at one end of the result. Take one row from that end.',
      '`ORDER BY value DESC LIMIT 1`.',
      'Two rows tie on 903 — `LIMIT 1` still returns one row, which is what was asked for.',
      'Decide what the NULL should do before you rely on where the engine happens to sort it.',
    ],
    explanation:
      'The interview answer is `ORDER BY value DESC LIMIT 1`, and it is worth being able to say out loud that this is *not* free: `MAX` can be answered from an index in a single seek, while a sort is a sort unless an index happens to provide the order.\n\nTwo differences from `MAX` matter more than the performance.\n\n**Empty input.** `SELECT MAX(value) FROM readings` over an empty table returns one row containing NULL. `ORDER BY … LIMIT 1` returns **no rows at all**. A caller written to read one row from the result handles one of those and crashes on the other.\n\n**NULL.** `MAX` ignores NULLs by definition. A sort does not — it has to put them somewhere, and where is not standardised: MySQL and SQLite sort NULLs first ascending (so last descending), PostgreSQL does the opposite. `WHERE value IS NOT NULL` is what makes the answer the same on all three, which is why it is in the solution rather than left to luck.',
    learnTopic: 'sql/order-and-limit',
    source: {
      platform: 'github',
      url: 'https://github.com/Aafreen29/SQL-Interview-Prep-Question',
    },
    topicTags: ['order-by', 'limit', 'null', 'aggregate-free'],
  },

  {
    slug: 'top-n-with-ties',
    title: 'The top three scores, and everyone on them',
    category: 'sorting',
    difficulty: 'Medium',
    statement:
      'Return the `name` and `score` of every player whose score is one of the **three highest distinct scores**.\n\nThat is not the same as the three highest players: if two people are tied on the third-best score, both are in the answer. Order by score highest first, then name.',
    setupSql: `
CREATE TABLE players (
  id    INTEGER PRIMARY KEY,
  name  TEXT NOT NULL,
  score INTEGER NOT NULL
);
INSERT INTO players VALUES
  (1, 'Nadia',   99),
  (2, 'Omar',    94),
  (3, 'Priya',   88),
  (4, 'Quentin', 88),
  (5, 'Rosa',    72),
  (6, 'Sam',     61);
`,
    solutionSql: `
SELECT name, score
FROM players
WHERE score >= (SELECT DISTINCT score FROM players ORDER BY score DESC LIMIT 1 OFFSET 2)
ORDER BY score DESC, name ASC;`,
    expectRows: 4,
    orderMatters: true,
    hints: [
      '`LIMIT 3` returns three rows. The question asks for three *scores* — count how many players that is.',
      'Find the third-highest distinct score first, then keep everybody at or above it.',
      'The other way round: `DENSE_RANK() OVER (ORDER BY score DESC) <= 3`.',
    ],
    explanation:
      'The two readings of "top three" differ here by a row. `ORDER BY score DESC LIMIT 3` gives Nadia, Omar and *one* of Priya and Quentin — chosen arbitrarily, since they are tied. The question asks for the top three **scores**, which is four players.\n\nTwo ways to write it, and the difference is which SQL you are allowed to use.\n\nThe subquery form finds the cut-off — the third distinct score, which is 88 — and keeps every row at or above it. It works on any engine, including ones with no window functions.\n\nThe window form says it directly: `DENSE_RANK() OVER (ORDER BY score DESC) <= 3`. **`DENSE_RANK` is the one that matches this question**, and the choice between the three ranking functions *is* the question — `ROW_NUMBER` would number the tied players 3 and 4 and cut one of them off, and `RANK` would number them both 3 but then skip to 5, which changes what "the next one" means.\n\nSQL Server and MySQL 8 also have `FETCH FIRST 3 ROWS WITH TIES`, which is this problem as a clause.',
    learnTopic: 'sql/order-and-limit',
    topicTags: ['order-by', 'limit', 'ties', 'dense-rank'],
  },
];
