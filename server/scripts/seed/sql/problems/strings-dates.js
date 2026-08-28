/**
 * Strings, dates & logic — CASE, text functions and date arithmetic.
 *
 * The category where MySQL and the SQLite this runs on differ most, so every
 * problem here either sticks to what both agree on or says what it is relying
 * on in its `dialectNote`. The shims cover `DATEDIFF`, `DATE_FORMAT`, `LEFT`,
 * `RIGHT`, `LOCATE` and `IF`, so a MySQL-flavoured answer runs.
 */

export default [
  {
    slug: 'band-by-case',
    title: 'Put each salary in a band',
    category: 'strings-dates',
    difficulty: 'Easy',
    statement:
      'Return each employee as `name` and a `band`:\n\n- `high` for 90,000 and above\n- `mid` for 75,000 up to but not including 90,000\n- `low` for anything below 75,000\n\nOrder by `salary` descending.',
    setupSql: `
CREATE TABLE employees (
  id     INTEGER PRIMARY KEY,
  name   TEXT NOT NULL,
  salary INTEGER NOT NULL
);
INSERT INTO employees VALUES
  (1, 'Ada',     95000),
  (2, 'Barbara', 91000),
  (3, 'Grace',   82000),
  (4, 'Radia',   78000),
  (5, 'Linus',   74000),
  (6, 'Alan',    68000);
`,
    solutionSql: `
SELECT name,
       CASE
         WHEN salary >= 90000 THEN 'high'
         WHEN salary >= 75000 THEN 'mid'
         ELSE 'low'
       END AS band
FROM employees
ORDER BY salary DESC;`,
    expectRows: 6,
    orderMatters: true,
    hints: [
      '`CASE WHEN … THEN … WHEN … THEN … ELSE … END`.',
      'The branches are tested in order, so the second only sees rows the first did not match — you do not need `AND salary < 90000`.',
    ],
    explanation:
      'The branches are evaluated **in order** and the first match wins, which is why the middle band needs no upper bound: anything 90,000 or over was already taken by the first branch. Writing the ranges out fully would work and would also be a second place for the boundary to be wrong.\n\n`ELSE` is not optional in spirit — without it, a row matching nothing gets `NULL`, which here would silently mean "no band" rather than "low".',
    learnTopic: 'sql/where-and-operators',
    topicTags: ['case', 'conditional'],
  },

  {
    slug: 'days-since-hire',
    title: 'How long have they been here?',
    category: 'strings-dates',
    difficulty: 'Medium',
    statement:
      'Treat the current date as **2024-06-01**.\n\nReturn each employee as `name`, `hired_on` and `days_here` — the whole number of days between their hire date and 2024-06-01 — longest-serving first.',
    setupSql: `
CREATE TABLE employees (
  id       INTEGER PRIMARY KEY,
  name     TEXT NOT NULL,
  hired_on TEXT NOT NULL
);
INSERT INTO employees VALUES
  (1, 'Barbara', '2018-11-02'),
  (2, 'Ada',     '2019-03-04'),
  (3, 'Grace',   '2020-07-15'),
  (4, 'Linus',   '2021-01-11'),
  (5, 'Alan',    '2022-05-30'),
  (6, 'Radia',   '2023-02-20');
`,
    solutionSql: `
SELECT name, hired_on, DATEDIFF('2024-06-01', hired_on) AS days_here
FROM employees
ORDER BY days_here DESC;`,
    expectRows: 6,
    orderMatters: true,
    hints: [
      "MySQL's `DATEDIFF(later, earlier)` gives whole days — note which argument comes first.",
      'Getting the arguments the wrong way round produces negative numbers, not an error.',
      "SQLite's own way is `julianday(a) - julianday(b)`; both work here.",
    ],
    explanation:
      "`DATEDIFF` takes the **later** date first, which is the reverse of what most people guess — and getting it backwards is a sign error rather than an exception, so it is the kind of mistake that reaches production. Barbara, hired first, has been there longest: 2,038 days.\n\nThis is one of the shimmed functions. SQLite has no `DATEDIFF` of its own; the Lab registers MySQL's so that the answer you write here is the answer you would write in an interview.",
    dialectNote:
      "`DATEDIFF` is provided by the Lab's MySQL shims — SQLite has no such function natively. `julianday(a) - julianday(b)` is the native equivalent and also works.",
    learnTopic: 'sql/data-types',
    topicTags: ['dates', 'datediff', 'shim'],
  },

  {
    slug: 'initials-and-domain',
    title: 'Initials and email domain',
    category: 'strings-dates',
    difficulty: 'Medium',
    statement:
      'Return each person as `name`, their first initial as `initial`, and the part of their email **after** the `@` as `domain`.\n\nOrder by `name`.',
    setupSql: `
CREATE TABLE people (
  id    INTEGER PRIMARY KEY,
  name  TEXT NOT NULL,
  email TEXT NOT NULL
);
INSERT INTO people VALUES
  (1, 'Ada Lovelace',      'ada@analytical.org'),
  (2, 'Grace Hopper',      'grace@navy.mil'),
  (3, 'Radia Perlman',     'radia@spanning.net'),
  (4, 'Barbara Liskov',    'barbara@mit.edu');
`,
    solutionSql: `
SELECT name,
       LEFT(name, 1) AS initial,
       SUBSTR(email, LOCATE('@', email) + 1) AS domain
FROM people
ORDER BY name;`,
    expectRows: 4,
    orderMatters: true,
    hints: [
      '`LEFT(text, 1)` takes the first character.',
      '`LOCATE(needle, haystack)` returns a **1-based** position, or 0 if it is not there.',
      'So the domain starts one character after the `@` — `SUBSTR(email, LOCATE(...) + 1)`.',
    ],
    explanation:
      'The one thing to get right is that `LOCATE` is **1-based**, like everything positional in SQL and unlike every array you have used. `LOCATE(\'@\', \'ada@analytical.org\')` is 4, so the domain starts at character 5 — hence the `+ 1`.\n\n`LEFT` and `LOCATE` are both MySQL functions the Lab shims in. `SUBSTR` is native to both dialects, and MySQL also spells it `SUBSTRING`.',
    dialectNote:
      "`LEFT` and `LOCATE` come from the Lab's MySQL shims. In plain SQLite you would write `SUBSTR(name, 1, 1)` and `INSTR(email, '@')`, which are also available here.",
    learnTopic: 'sql/data-types',
    topicTags: ['strings', 'substr', 'locate', 'shim'],
  },

  {
    slug: 'first-name-before-the-space',
    title: 'The name before the first space',
    category: 'strings-dates',
    difficulty: 'Easy',
    statement:
      '`people` stores each person as one `full_name` column.\n\nReturn each **distinct** first name — the text before the first space — as `first_name`, alphabetically.\n\nOne person here goes by a single name with no space in it at all. They still have a first name.',
    setupSql: `
CREATE TABLE people (
  id        INTEGER PRIMARY KEY,
  full_name TEXT NOT NULL
);
INSERT INTO people VALUES
  (1, 'Ada Lovelace'),
  (2, 'Grace Hopper'),
  (3, 'Ada Byron'),
  (4, 'Prince'),
  (5, 'Linus Torvalds');
`,
    solutionSql: `
SELECT DISTINCT
  CASE
    WHEN INSTR(full_name, ' ') = 0 THEN full_name
    ELSE SUBSTR(full_name, 1, INSTR(full_name, ' ') - 1)
  END AS first_name
FROM people
ORDER BY first_name;`,
    expectRows: 4,
    orderMatters: true,
    hints: [
      '`INSTR(full_name, \' \')` gives the position of the first space — counting from 1, and 0 when there is none.',
      '`SUBSTR(full_name, 1, position - 1)` is everything before it.',
      'Run it on Prince before you submit. What does `SUBSTR(name, 1, -1)` return?',
    ],
    explanation:
      'Two ideas and one edge case.\n\n`INSTR` finds the space, `SUBSTR` takes everything before it — and both are **1-based**, unlike every string API in every programming language you use. `SUBSTR(x, 1, n)` means "n characters starting at the first", so the length wanted is `position - 1`.\n\nPrince is the reason for the `CASE`. With no space, `INSTR` returns 0, and the length becomes `-1`. SQLite reads a negative length as "count backwards from the start" and returns an empty string; MySQL returns an empty string too; some engines error. All three answers are wrong, and none of them look wrong in a result grid — an empty cell reads as missing data, not as a bug. Handling the no-separator case explicitly is the difference between a query that works on the sample and a query that works.\n\nThe `DISTINCT` earns its place because two people are called Ada: parsing first and deduplicating second gives four names, and doing it the other way round would give five.\n\nAnd the caveat worth volunteering: **this is not a name parser.** "Mary Anne Evans" and "van Gogh" break it, because there is no rule that maps a human name onto a substring. Which is the real answer to the question — the reason interview candidates get asked it is to see whether they say so.',
    dialectNote:
      'MySQL has `SUBSTRING_INDEX(full_name, \' \', 1)`, which does the whole thing in one call and returns the entire string when there is no space — so the `CASE` disappears there. SQLite has no such function, which is why this problem is written the long way; the long way is also the one that ports.',
    learnTopic: 'sql/data-types',
    source: {
      platform: 'github',
      url: 'https://github.com/Aafreen29/SQL-Interview-Prep-Question',
    },
    topicTags: ['instr', 'substr', 'distinct', 'strings'],
  },

  {
    slug: 'birthday-attendance',
    title: 'Present on their own birthday',
    category: 'strings-dates',
    difficulty: 'Medium',
    statement:
      'What percentage of students were in school on their own birthday?\n\nReturn one number as `pct`, rounded to one decimal place. The denominator is **every** student — including the one with no attendance records at all.\n\nBirthdays repeat every year, so only the month and day matter.',
    setupSql: `
CREATE TABLE students (
  id      INTEGER PRIMARY KEY,
  name    TEXT NOT NULL,
  born_on TEXT NOT NULL
);
INSERT INTO students VALUES
  (1, 'Ada',   '2010-05-06'),
  (2, 'Grace', '2011-09-14'),
  (3, 'Linus', '2010-12-28'),
  (4, 'Radia', '2012-03-02');

CREATE TABLE attendance (
  id         INTEGER PRIMARY KEY,
  student_id INTEGER NOT NULL,
  on_day     TEXT NOT NULL
);
INSERT INTO attendance (student_id, on_day) VALUES
  (1, '2024-05-06'),
  (1, '2024-05-07'),
  (2, '2024-09-14'),
  (2, '2024-09-15'),
  (3, '2024-12-27');
`,
    solutionSql: `
SELECT ROUND(
  COUNT(DISTINCT CASE
    WHEN DATE_FORMAT(a.on_day, '%m-%d') = DATE_FORMAT(s.born_on, '%m-%d')
    THEN s.id
  END) * 100.0 / (SELECT COUNT(*) FROM students), 1) AS pct
FROM students s
LEFT JOIN attendance a ON a.student_id = s.id;`,
    expectRows: 1,
    orderMatters: false,
    hints: [
      'The years do not match and must not be compared. Compare the month and day only.',
      '`DATE_FORMAT(d, \'%m-%d\')` reduces a date to the part that repeats every year.',
      'A student present on their birthday twice is still one student — count them distinctly.',
      'Radia has no attendance rows. Which join keeps her in the denominator?',
    ],
    explanation:
      'The numerator and the denominator are both easy to get wrong, in opposite directions.\n\n**The comparison.** `a.on_day = s.born_on` is never true for anybody, because the birth year is 2010 and the attendance year is 2024. What repeats annually is the month and day, so both sides have to be reduced to that before they can be compared. `DATE_FORMAT(d, \'%m-%d\')` is the MySQL way of saying it; `MONTH(a) = MONTH(b) AND DAY(a) = DAY(b)` says the same thing and is easier to index around.\n\n**The denominator.** Radia has never been marked present. An inner join drops her entirely and the answer becomes 2 out of 3 — a higher, wronger number. `LEFT JOIN` keeps every student, and the scalar subquery `(SELECT COUNT(*) FROM students)` states the denominator outright so it cannot be affected by the join at all. Being explicit about the denominator is the safer habit: rates computed from a joined row count are only correct as long as nobody adds a table to the query.\n\n`COUNT(DISTINCT … CASE … THEN s.id END)` is doing two jobs. The `CASE` with no `ELSE` yields NULL for non-matching rows and `COUNT` skips NULLs, which is how a count of "rows that matched" is written without a subquery. The `DISTINCT` then makes it a count of **students** rather than of attendance rows — which matters the moment somebody is marked present twice on their birthday.',
    dialectNote:
      'MySQL has `DATE_FORMAT`, and the Lab shims it so this query runs here unchanged. Native SQLite would spell it `STRFTIME(\'%m-%d\', on_day)`, and PostgreSQL `TO_CHAR(on_day, \'MM-DD\')`.',
    learnTopic: 'sql/data-types',
    source: {
      platform: 'github',
      url: 'https://github.com/Aafreen29/SQL-Interview-Prep-Question',
    },
    topicTags: ['dates', 'date-format', 'left-join', 'percentage'],
  },

  {
    slug: 'percent-stored-as-text',
    title: 'A percentage stored as text',
    category: 'strings-dates',
    difficulty: 'Medium',
    statement:
      'Somebody stored the failure rate as text — `\'12.5%\'` — and left it empty where nothing failed.\n\nPer `country`, return the total messages `sent` and the number that failed as `failed`, rounded to the nearest whole message. Order by country.',
    setupSql: `
CREATE TABLE deliveries (
  id           INTEGER PRIMARY KEY,
  country      TEXT NOT NULL,
  sent         INTEGER NOT NULL,
  failure_rate TEXT
);
INSERT INTO deliveries (country, sent, failure_rate) VALUES
  ('DE', 800,  '12.5%'),
  ('IN', 1000, '10%'),
  ('IN', 500,  '20%'),
  ('US', 2000, '5%'),
  ('US', 1000, NULL);
`,
    solutionSql: `
SELECT country,
       SUM(sent) AS sent,
       ROUND(SUM(sent * CAST(REPLACE(COALESCE(failure_rate, '0%'), '%', '') AS REAL) / 100.0)) AS failed
FROM deliveries
GROUP BY country
ORDER BY country;`,
    expectRows: 3,
    orderMatters: true,
    hints: [
      'Strip the `%` before anything numeric can happen — `REPLACE(rate, \'%\', \'\')`.',
      'A stripped string is still a string. `CAST(… AS REAL)` makes it a number.',
      'The NULL row means "nothing failed", so give it a value before the arithmetic rather than after.',
      'Multiply row by row, then sum. Averaging the percentages first would weight a 1,000-message row the same as a 2,000-message one.',
    ],
    explanation:
      'Real data arrives like this, and the query has to say what it is doing about it.\n\n**Strip, then cast, then compute — in that order.** `CAST(\'10%\' AS REAL)` does not error in SQLite or MySQL; it reads as far as it can and returns `10`, which happens to be right here and would not be for `\'1,000\'` or `\'n/a\'`. Relying on a lenient cast is relying on the parser\'s idea of a number matching yours. `REPLACE` first makes the intent explicit and the failure loud.\n\n**Decide what NULL means.** An empty rate could mean "0%" or "we do not know", and those produce different answers. The question says nothing failed, so `COALESCE(failure_rate, \'0%\')` writes that decision into the query. Without it, `sent * NULL` is NULL, `SUM` skips it, and the US total silently comes from one row instead of two — the same number the right answer produces here, arrived at by accident.\n\n**Multiply before summing.** `SUM(sent * rate)` is not `SUM(sent) * AVG(rate)`. India is 1,000 at 10% plus 500 at 20% — 200 failures. Averaging the rates gives 15% of 1,500, which is 225. Weighted averages have to be computed row by row, and this is the most common place that gets skipped.\n\nAnd the real answer to the question: `failure_rate` should be a `DECIMAL` column holding `0.125`, with the `%` added by whatever displays it. The query above is what a schema fix costs while it is not being done.',
    dialectNote:
      'SQLite\'s numeric type is `REAL`; MySQL would want `CAST(… AS DECIMAL(5,2))`, since MySQL does not accept `REAL` as a cast target. Both accept the same `REPLACE` and the same arithmetic.',
    learnTopic: 'sql/data-types',
    source: {
      platform: 'github',
      url: 'https://github.com/Aafreen29/SQL-Interview-Prep-Question',
    },
    topicTags: ['cast', 'replace', 'coalesce', 'weighted-average'],
  },
];
