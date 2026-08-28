import { data } from '../blocks.js';

/**
 * The two tables the whole track runs on.
 *
 * Not a topic — the only file in this folder that is not one, and it earns the
 * exception. Fifty-three topics each inventing their own `employees` is fifty-three
 * chances for the reader to have to re-read a dataset before they can read a
 * query, and the Joins section in particular only works if `INNER` and `LEFT`
 * are shown returning different rows *from the same six people*. A reader
 * comparing two results should not also be comparing two worlds.
 *
 * The data is chosen, not typed at random. Every property below is load-bearing
 * for at least one topic:
 *
 * - **Radia has no `dept_id`.** So `employees LEFT JOIN departments` keeps her
 *   with NULLs and `INNER JOIN` drops her — the difference between the two,
 *   visible in the row count, without a second example.
 * - **Legal has no employees.** The mirror image, which is what makes RIGHT and
 *   FULL OUTER worth their own section rather than a footnote saying "the same
 *   but backwards".
 * - **Ada has no `manager_id`.** The root of the hierarchy, so the self-join and
 *   the recursive CTE have a place to stop.
 * - **`COUNT(*)` is 6 and `COUNT(dept_id)` is 5.** The single most-asked
 *   aggregate question answers itself on this table.
 * - **Two departments hold exactly two people each.** So GROUP BY produces
 *   groups worth looking at, and RANK and DENSE_RANK can be shown differing on a
 *   tie without a contrived extra row.
 *
 * Six employees and four departments is the smallest set with all of that in it.
 * It matters that it is small: the point of printing the result under every
 * query is that the reader can check it by eye, and a thirty-row sample is one
 * you skim instead.
 *
 * The same two tables seed the SQL Lab's scratch console, so what you read here
 * is what you can run there.
 */

/** The column list, so a topic can talk about the shape without redrawing it. */
export const EMPLOYEE_COLUMNS = ['id', 'name', 'dept_id', 'salary', 'manager_id', 'hired_on'];

export const DEPARTMENT_COLUMNS = ['id', 'name', 'location'];

/*
  NULLs are written as the bare word `NULL` in a code span, everywhere, in every
  table on every page of this track. An empty cell would read as "we did not
  bother filling this in", which is the one thing NULL never means.
*/
export const EMPLOYEE_ROWS = [
  ['`1`', 'Ada', '`1`', '`95000`', '`NULL`', '`2019-03-04`'],
  ['`2`', 'Grace', '`1`', '`82000`', '`1`', '`2020-07-15`'],
  ['`3`', 'Linus', '`2`', '`74000`', '`1`', '`2021-01-11`'],
  ['`4`', 'Barbara', '`2`', '`91000`', '`1`', '`2018-11-02`'],
  ['`5`', 'Alan', '`3`', '`68000`', '`4`', '`2022-05-30`'],
  ['`6`', 'Radia', '`NULL`', '`78000`', '`4`', '`2023-02-20`'],
];

export const DEPARTMENT_ROWS = [
  ['`1`', 'Engineering', 'Bengaluru'],
  ['`2`', 'Data', 'Hyderabad'],
  ['`3`', 'Design', 'Pune'],
  ['`4`', 'Legal', 'Mumbai'],
];

/** Ready-made blocks, so a topic that needs both writes two words. */
export const employees = () => data('employees', EMPLOYEE_COLUMNS, EMPLOYEE_ROWS);
export const departments = () => data('departments', DEPARTMENT_COLUMNS, DEPARTMENT_ROWS);

/**
 * The `CREATE TABLE` behind them, for the topics that need to show the schema
 * rather than the rows — and the exact DDL the Lab's console runs.
 */
export const SCHEMA_SQL = `
CREATE TABLE departments (
  id       INT PRIMARY KEY,
  name     VARCHAR(50) NOT NULL UNIQUE,
  location VARCHAR(50)
);

CREATE TABLE employees (
  id         INT PRIMARY KEY,
  name       VARCHAR(50) NOT NULL,
  dept_id    INT,
  salary     DECIMAL(10, 2) NOT NULL,
  manager_id INT,
  hired_on   DATE NOT NULL,
  FOREIGN KEY (dept_id)    REFERENCES departments(id),
  FOREIGN KEY (manager_id) REFERENCES employees(id)
);
`.trim();
