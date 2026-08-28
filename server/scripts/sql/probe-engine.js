/**
 * Prove that the SQL Lab's engine actually works on this machine.
 *
 * This exists for the same reason `s3/probe-storage.js` and
 * `ai/probe-providers.js` do: everything downstream is built on claims about
 * something we do not control — that sql.js loads under Node, that
 * `create_function` accepts the arities the shims register, that SQLite's
 * result shape is what the grader expects. Those claims are cheap to check here
 * and expensive to debug once they are underneath a worker, a WASM fetch and a
 * React tree.
 *
 * It imports the engine from `client/src/sql/`, deliberately — see the note at
 * the top of shims.js. The same modules run in the browser.
 *
 *   npm run sql:probe
 */

import initSqlJs from 'sql.js';
import { compareResults, cellsMatch, diffCells } from '../../../client/src/sql/compare.js';
import { execute } from '../../../client/src/sql/run.js';
import { SHIMMED } from '../../../client/src/sql/shims.js';

const pass = (label, detail) => console.log(`  ${'PASS'.padEnd(6)} ${label}${detail ? ` — ${detail}` : ''}`);
const fail = (label, detail) => console.log(`  ${'FAIL'.padEnd(6)} ${label}${detail ? ` — ${detail}` : ''}`);
const info = (label, detail) => console.log(`  ${'INFO'.padEnd(6)} ${label}${detail ? ` — ${detail}` : ''}`);

const problems = [];
const record = (label, detail, hint) => {
  fail(label, detail);
  problems.push({ label, hint });
};

/** Asserts a condition, recording a failure rather than throwing. */
const check = (label, ok, detail, hint) => (ok ? pass(label, detail) : record(label, detail, hint));

/* -------------------------------------------------------------------------- */
/* the fixture — the Learn track's own two tables                              */
/* -------------------------------------------------------------------------- */

const SETUP = `
CREATE TABLE departments (id INT PRIMARY KEY, name VARCHAR(50), location VARCHAR(50));
CREATE TABLE employees (
  id INT PRIMARY KEY, name VARCHAR(50), dept_id INT,
  salary DECIMAL(10,2), manager_id INT, hired_on DATE
);
INSERT INTO departments VALUES
  (1,'Engineering','Bengaluru'), (2,'Data','Hyderabad'),
  (3,'Design','Pune'),           (4,'Legal','Mumbai');
INSERT INTO employees VALUES
  (1,'Ada',1,95000,NULL,'2019-03-04'), (2,'Grace',1,82000,1,'2020-07-15'),
  (3,'Linus',2,74000,1,'2021-01-11'),  (4,'Barbara',2,91000,1,'2018-11-02'),
  (5,'Alan',3,68000,4,'2022-05-30'),   (6,'Radia',NULL,78000,4,'2023-02-20');
`;

const run = (SQL, sql, checkSql) => execute(SQL, { setupSql: SETUP, sql, checkSql });

/* -------------------------------------------------------------------------- */
/* run                                                                         */
/* -------------------------------------------------------------------------- */

console.log('\nSQL Lab engine probe');
console.log(`\n  Shims registered: ${SHIMMED.join(', ')}\n`);

let SQL;
try {
  const started = process.hrtime.bigint();
  SQL = await initSqlJs();
  pass('sql.js initialises', `${Math.round(Number(process.hrtime.bigint() - started) / 1e6)}ms`);
} catch (error) {
  fail('sql.js initialises', error.message);
  console.log('\n  Cannot continue without the engine.\n');
  process.exit(1);
}

/* --- the basics --- */

{
  const { result, error } = run(SQL, 'SELECT name, salary FROM employees ORDER BY salary DESC;');
  check('a SELECT runs', !error && result?.values.length === 6, error || `${result?.values.length} rows`);
  check(
    'rows come back in order',
    result?.values[0][0] === 'Ada' && result?.values[5][0] === 'Alan',
    `${result?.values[0][0]} … ${result?.values[5][0]}`,
  );
  check('columns are named', result?.columns.join(',') === 'name,salary', result?.columns.join(','));
}

{
  const { result } = run(SQL, 'SELECT COUNT(*) AS a, COUNT(dept_id) AS b FROM employees;');
  const [a, b] = result.values[0];
  check('COUNT(*) vs COUNT(col) differ on NULL', a === 6 && b === 5, `${a} and ${b}`);
}

{
  const { result } = run(
    SQL,
    `SELECT e.name, d.name AS dept FROM employees e
     LEFT JOIN departments d ON e.dept_id = d.id ORDER BY e.id;`,
  );
  const radia = result.values.find((r) => r[0] === 'Radia');
  check('LEFT JOIN pads with NULL', result.values.length === 6 && radia[1] === null, `${result.values.length} rows`);
}

{
  const { result } = run(
    SQL,
    `SELECT name, RANK() OVER (ORDER BY salary DESC) AS rk FROM employees;`,
  );
  check('window functions work', result?.values.length === 6 && result.values[0][1] === 1);
}

{
  const { result } = run(
    SQL,
    `WITH RECURSIVE chain AS (
       SELECT id, name, manager_id FROM employees WHERE manager_id IS NULL
       UNION ALL
       SELECT e.id, e.name, e.manager_id FROM employees e JOIN chain c ON e.manager_id = c.id
     ) SELECT COUNT(*) FROM chain;`,
  );
  check('recursive CTEs work', result?.values[0][0] === 6, `${result?.values[0][0]} rows reached`);
}

/* --- the shims, which are the whole reason this probe exists --- */

{
  const { result, error } = run(
    SQL,
    `SELECT
       IFNULL(dept_id, 0)                        AS a,
       IF(salary > 80000, 'high', 'low')         AS b,
       CONCAT(name, ' (', id, ')')               AS c,
       CONCAT_WS('-', name, dept_id)             AS d,
       LEFT(name, 2)                             AS e,
       RIGHT(name, 2)                            AS f,
       LOCATE('a', name)                         AS g,
       DATEDIFF('2024-01-01', hired_on)          AS h,
       DATE_FORMAT(hired_on, '%Y-%m')            AS i,
       TRUNCATE(salary * 1.0 / 7, 2)             AS j,
       NVL(dept_id, -1)                          AS k
     FROM employees WHERE id = 1;`,
  );

  if (error) {
    record('every shim resolves', error, 'a name or arity in shims.js does not match the call');
  } else {
    const [a, b, c, d, e, f, g, h, i, j, k] = result.values[0];
    pass('every shim resolves');
    check('IFNULL (native)', a === 1, String(a));
    check('IF', b === 'high', String(b));
    check('CONCAT is variadic (native)', c === 'Ada (1)', String(c));
    check('CONCAT_WS is variadic (native)', d === 'Ada-1', String(d));
    check('LEFT / RIGHT', e === 'Ad' && f === 'da', `${e} / ${f}`);
    check('LOCATE is 1-based', g === 3, String(g));
    check('DATEDIFF counts whole days', h === 1764, String(h));
    check('DATE_FORMAT', i === '2019-03', String(i));
    check('TRUNCATE chops', j === 13571.42, String(j));
    check('NVL', k === 1, String(k));
  }
}

{
  /* NULL handling is the half of the shims that is easy to get wrong. */
  const { result } = run(
    SQL,
    `SELECT CONCAT('a', NULL) AS a, CONCAT_WS('-', 'x', NULL, 'y') AS b,
            IF(NULL, 'yes', 'no') AS c, DATEDIFF(NULL, '2020-01-01') AS d;`,
  );
  const [a, b, c, d] = result.values[0];
  /*
    SQLite's native concat *skips* NULLs where MySQL's propagates them. Asserted
    rather than worked around: expected results are generated on this engine so
    nothing disagrees with itself, and pinning the behaviour here means a future
    SQLite that changed its mind would fail the probe rather than quietly
    changing what a problem returns.
  */
  check('CONCAT skips NULL (SQLite, not MySQL)', a === 'a', String(a));
  check('CONCAT_WS skips NULL', b === 'x-y', String(b));
  check('IF(NULL) takes the else branch', c === 'no', String(c));
  check('DATEDIFF(NULL) is NULL', d === null, String(d));
}

{
  /*
    Integer division, and it is a genuine dialect trap rather than a curiosity.
    MySQL's `/` always produces a decimal; SQLite's returns an integer when both
    operands are integers. `SELECT total / count` is a natural thing to write and
    silently truncates here. Recorded so that problem authors reach for
    `* 1.0` or `CAST(x AS REAL)`, and so the docs can say it out loud.
  */
  const intDiv = run(SQL, 'SELECT 95000 / 7 AS a, 95000 * 1.0 / 7 AS b;').result.values[0];
  check('integer / integer truncates', intDiv[0] === 13571, String(intDiv[0]));
  info('so a ratio needs *1.0 or CAST', `95000*1.0/7 = ${intDiv[1]}`);
}

{
  const { error } = run(SQL, "SELECT CONCAT('a','b','c','d','e','f','g');");
  check('a shim registered twice would have been caught at startup', !error, error || 'variadic, native');
}

{
  const { result } = run(SQL, `SELECT DATE_ADD('2024-01-30', 5) AS a, DATE_SUB('2024-03-01', 1) AS b;`);
  const [a, b] = result.values[0];
  check('DATE_ADD crosses a month', a === '2024-02-04', String(a));
  check('DATE_SUB crosses a leap day', b === '2024-02-29', String(b));
}

/* --- errors and edges --- */

{
  const { result, error } = run(SQL, 'SELECT * FORM employees;');
  check('a syntax error is reported, not thrown', Boolean(error) && !result, error);
}

{
  const { result, error } = run(SQL, 'UPDATE employees SET salary = 1 WHERE id = 1;');
  check('a statement with no result set returns null', !error && result === null);
}

{
  const { result, error } = run(
    SQL,
    'UPDATE employees SET salary = salary * 2 WHERE dept_id = 1;',
    'SELECT name, salary FROM employees WHERE dept_id = 1 ORDER BY id;',
  );
  const ok = !error && result?.values[0][1] === 190000 && result?.values[1][1] === 164000;
  check('checkSql grades a write', ok, error || JSON.stringify(result?.values));
}

{
  const first = run(SQL, 'UPDATE employees SET salary = 0;', 'SELECT SUM(salary) FROM employees;');
  const second = run(SQL, 'SELECT SUM(salary) FROM employees;');
  check(
    'each run gets a fresh database',
    first.result.values[0][0] === 0 && second.result.values[0][0] === 488000,
    `after write ${first.result.values[0][0]}, next run ${second.result.values[0][0]}`,
  );
}

{
  const { result } = run(SQL, 'SELECT 1 AS a; SELECT 2 AS b; SELECT 3 AS c;');
  check('the last statement wins', result.values[0][0] === 3, String(result.values[0][0]));
}

/* --- the grader --- */

{
  const expected = run(SQL, 'SELECT name, salary FROM employees ORDER BY id;').result;

  const same = compareResults(expected, expected, { orderMatters: true });
  check('identical results pass', same.pass, same.detail);

  const reordered = run(SQL, 'SELECT name, salary FROM employees ORDER BY salary;').result;
  check(
    'a reordering passes when order does not matter',
    compareResults(reordered, expected, { orderMatters: false }).pass,
  );
  check(
    'a reordering fails when order does matter',
    !compareResults(reordered, expected, { orderMatters: true }).pass,
  );

  const aliased = run(SQL, 'SELECT name, salary AS pay FROM employees ORDER BY id;').result;
  const aliasVerdict = compareResults(aliased, expected, { orderMatters: true });
  check(
    'a wrong alias is reported as a name, not as data',
    !aliasVerdict.pass && aliasVerdict.reason === 'column-name',
    aliasVerdict.detail,
  );

  const fewer = run(SQL, 'SELECT name, salary FROM employees WHERE id < 4 ORDER BY id;').result;
  const countVerdict = compareResults(fewer, expected, { orderMatters: true });
  check(
    'a missing row is reported as a row count',
    !countVerdict.pass && countVerdict.reason === 'row-count',
    countVerdict.detail,
  );

  const wrong = run(SQL, 'SELECT name, salary + 1 AS salary FROM employees ORDER BY id;').result;
  const cellVerdict = compareResults(wrong, expected, { orderMatters: true });
  check(
    'a wrong cell names the row and column',
    !cellVerdict.pass && cellVerdict.reason === 'cell',
    cellVerdict.detail,
  );
  check('and marks it on the grid', diffCells(wrong, expected, { orderMatters: true }).length === 6);
}

{
  check('95000 matches 95000.0', cellsMatch(95000, 95000.0));
  check("95000 matches '95000'", cellsMatch(95000, '95000'));
  check('NULL matches NULL', cellsMatch(null, null));
  check('NULL does not match 0', !cellsMatch(null, 0), 'the rule the NULL topic teaches');
  check("NULL does not match ''", !cellsMatch(null, ''));
  check('0 does not match empty string', !cellsMatch(0, ''));
}

/* --- report --- */

console.log('');
if (!problems.length) {
  console.log('All checks passed. The engine, the shims and the grader agree.\n');
  process.exit(0);
}

console.log(`${problems.length} check(s) failed:\n`);
for (const { label, hint } of problems) {
  console.log(`  ${label}`);
  if (hint) console.log(`      likely: ${hint}`);
}
console.log('');
process.exit(1);
