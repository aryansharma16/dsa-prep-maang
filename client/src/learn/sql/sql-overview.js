import { asked, cheat, code, h, links, mysqlDoc, note, p, pgDoc, sql, table, tip, ul, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      '**SQL** — Structured Query Language — is the language for talking to a relational database. It is **declarative**: you describe the rows you want, not how to find them. There is no loop in `SELECT`, and that is the point. The optimiser decides the loop, and it may decide differently tomorrow when the table is a hundred times bigger.',
    ),
    p(
      'Its statements are grouped into five families. Which family a statement belongs to decides one thing that matters enormously — **whether you can undo it.**',
    ),

    h('The five families'),
    table(
      ['family', 'stands for', 'statements', 'transactional?'],
      [
        [
          '**DDL**',
          'Data **Definition** Language',
          '`CREATE`, `ALTER`, `DROP`, `TRUNCATE`, `RENAME`',
          'In MySQL, **no** — and it silently commits whatever you had open. In PostgreSQL, **yes**.',
        ],
        [
          '**DML**',
          'Data **Manipulation** Language',
          '`INSERT`, `UPDATE`, `DELETE`, `MERGE`',
          'Yes — this is what transactions are for.',
        ],
        [
          '**DQL**',
          'Data **Query** Language',
          '`SELECT`',
          'Reads nothing to undo. Often counted as part of DML.',
        ],
        [
          '**DCL**',
          'Data **Control** Language',
          '`GRANT`, `REVOKE`',
          'Permissions. Usually autocommitting.',
        ],
        [
          '**TCL**',
          '**Transaction** Control Language',
          '`COMMIT`, `ROLLBACK`, `SAVEPOINT`, `SET TRANSACTION`',
          'It *is* the transaction control.',
        ],
      ],
    ),
    warn(
      "MySQL's implicit commit is the fact worth carrying out of this page. Run a `CREATE TABLE` in the middle of an open transaction and MySQL **commits everything you had done so far**, silently, before executing it. There is no warning and no way back. PostgreSQL has transactional DDL — you can create a table, insert into it, and roll the whole thing back — which is why Postgres migrations can be all-or-nothing and MySQL ones cannot.",
    ),

    h('One of each'),
    code(
      sql(`
-- DDL: define the shape.
CREATE TABLE departments (
  id       INT PRIMARY KEY,
  name     VARCHAR(50) NOT NULL,
  location VARCHAR(50)
);

-- DML: change the data.
INSERT INTO departments VALUES (1, 'Engineering', 'Bengaluru');
UPDATE departments SET location = 'Pune' WHERE id = 1;
DELETE FROM departments WHERE id = 1;

-- DQL: ask a question.
SELECT name, location FROM departments WHERE location = 'Pune';

-- DCL: decide who may do any of it.
GRANT SELECT ON departments TO 'reporting'@'%';
REVOKE INSERT ON departments FROM 'reporting'@'%';

-- TCL: decide whether it counts.
START TRANSACTION;
  UPDATE departments SET location = 'Mumbai' WHERE id = 2;
ROLLBACK;
`),
    ),

    h('The shape of a SELECT'),
    p('Every clause, in the order you write them. Only the first is compulsory:'),
    code(
      sql(`
SELECT   [DISTINCT] columns          -- what to return
FROM     table                       -- where from
JOIN     other ON condition          -- what to attach
WHERE    row_condition               -- which rows, before grouping
GROUP BY columns                     -- how to collapse them
HAVING   group_condition             -- which groups, after grouping
ORDER BY columns [ASC | DESC]        -- what order to return them in
LIMIT    n OFFSET m;                 -- how many
`),
    ),
    note(
      'The engine does **not** run them in that order — it starts at `FROM` and reaches `SELECT` sixth. That single fact explains most of the "why can I not do this" questions in SQL, and it has its own topic two pages on.',
    ),

    h('Dialects'),
    p(
      'SQL is standardised (SQL:2023 is current) and every vendor deviates. The core — `SELECT`, joins, `GROUP BY`, subqueries, transactions — is portable and is what interviews ask about. The edges are not:',
    ),
    table(
      ['want', 'MySQL', 'PostgreSQL', 'SQL Server'],
      [
        ['First 10 rows', '`LIMIT 10`', '`LIMIT 10`', '`SELECT TOP 10`'],
        ['Auto id', '`AUTO_INCREMENT`', '`SERIAL` / `IDENTITY`', '`IDENTITY(1,1)`'],
        ['Join strings', '`CONCAT(a, b)`', '`a || b`', '`a + b`'],
        ['Null fallback', '`IFNULL(x, 0)`', '`COALESCE(x, 0)`', '`ISNULL(x, 0)`'],
        ['Today', '`CURDATE()`', '`CURRENT_DATE`', '`GETDATE()`'],
        ['Quote an identifier', '`` `name` ``', '`"name"`', '`[name]`'],
        ['Full outer join', 'Not supported', 'Supported', 'Supported'],
      ],
    ),
    tip(
      '`COALESCE` is in the standard and works everywhere. `IFNULL`, `ISNULL` and `NVL` are the same idea in three dialects. When two spellings both work, the portable one is worth the extra characters.',
    ),

    h('Case, quotes and semicolons'),
    ul(
      '**Keywords are case-insensitive.** `select` and `SELECT` are identical. Uppercase for keywords is convention, not a rule, and it exists so the shape of a long query is scannable.',
      '**Identifiers may not be.** MySQL table names are case-sensitive on Linux and not on macOS or Windows, because they are filenames. PostgreSQL folds unquoted names to lowercase — so `CREATE TABLE Employees` creates `employees`, and `"Employees"` creates something you must quote forever after.',
      "**Single quotes are strings. Double quotes are identifiers.** `'Ada'` is text; `\"Ada\"` is a column called Ada in standard SQL. MySQL is lax about this by default, which teaches the wrong habit — `WHERE name = \"Ada\"` will not work everywhere.",
      '**Comments** — `-- to end of line`, `# to end of line` in MySQL, and `/* block */`.',
    ),

    h('Interview'),
    asked([
      ['What does SQL stand for?', 'Structured Query Language.'],
      ['Is SQL declarative or procedural?', 'Declarative — you describe the result, the optimiser chooses the plan.'],
      ['Name the command families.', 'DDL, DML, DQL, DCL and TCL.'],
      ['Which family is TRUNCATE in?', 'DDL — which is why it cannot be rolled back in MySQL.'],
      ['Can DDL be rolled back?', 'In PostgreSQL yes; in MySQL no, and it implicitly commits your open transaction first.'],
      ['GRANT belongs to which family?', 'DCL.'],
      ['Are SQL keywords case-sensitive?', 'No. Identifiers may be, depending on the engine and the operating system.'],
      ['Single vs double quotes?', 'Single for string literals, double for identifiers — MySQL is lenient, the standard is not.'],
      ['Which clauses are compulsory in a SELECT?', 'Only `SELECT`. Even `FROM` is optional — `SELECT 1 + 1` is valid.'],
    ]),

    h('Cheatsheet'),
    cheat([
      ['Define or change structure', 'DDL — `CREATE`, `ALTER`, `DROP`'],
      ['Change rows', 'DML — `INSERT`, `UPDATE`, `DELETE`'],
      ['Read rows', 'DQL — `SELECT`'],
      ['Grant access', 'DCL — `GRANT`, `REVOKE`'],
      ['Make changes all-or-nothing', 'TCL — `START TRANSACTION` … `COMMIT`'],
      ['Write portable null handling', '`COALESCE`, never `IFNULL`'],
      ['Write a string literal', 'Single quotes, everywhere'],
    ]),

    links(
      wiki('SQL', 'SQL'),
      mysqlDoc('sql-statements.html', 'MySQL statement reference'),
      pgDoc('sql-commands.html', 'PostgreSQL command reference'),
    ),
  ],
};
