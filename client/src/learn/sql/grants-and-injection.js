import {
  asked,
  cheat,
  code,
  h,
  js,
  link,
  links,
  mysqlDoc,
  note,
  p,
  result,
  sql,
  table,
  tip,
  ul,
  warn,
  wiki,
} from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Two halves of the same question — who may do what, and how the answer gets subverted. **SQL injection has been the number one web vulnerability for two decades**, and it is one of the very few security problems with a complete fix that takes no effort and costs no performance.',
    ),

    h('GRANT and REVOKE'),
    code(
      sql(`
CREATE USER 'reporting'@'%' IDENTIFIED BY 'a-long-random-secret';

-- Only what it needs, and only where.
GRANT SELECT ON company.employees   TO 'reporting'@'%';
GRANT SELECT ON company.departments TO 'reporting'@'%';

-- Down to the column.
GRANT SELECT (id, name, dept_id) ON company.employees TO 'support'@'%';

-- An application that never changes the schema.
GRANT SELECT, INSERT, UPDATE, DELETE ON company.* TO 'app'@'10.0.%';

-- Only through a procedure — no table access at all.
GRANT EXECUTE ON PROCEDURE company.give_raise TO 'hr'@'%';

REVOKE DELETE ON company.* FROM 'app'@'10.0.%';
SHOW GRANTS FOR 'app'@'10.0.%';
`),
    ),
    table(
      ['privilege', 'allows'],
      [
        ['`SELECT`', 'Read. Grantable per column.'],
        ['`INSERT` / `UPDATE` / `DELETE`', 'The three write statements.'],
        ['`CREATE` / `ALTER` / `DROP`', 'Schema changes — an application almost never needs these.'],
        ['`EXECUTE`', 'Call a procedure or function.'],
        ['`REFERENCES`', 'Create a foreign key pointing at the table.'],
        ['`ALL PRIVILEGES`', 'Everything. Almost always wrong.'],
        ['`GRANT OPTION`', 'Pass privileges on to others. Reserve for administrators.'],
      ],
    ),

    h('Least privilege, in practice'),
    p('Four accounts rather than one, because they need genuinely different things:'),
    table(
      ['account', 'gets', 'why'],
      [
        ['`app`', '`SELECT, INSERT, UPDATE, DELETE` on its own schema', 'No DDL — a compromised app cannot drop a table.'],
        ['`migrator`', 'DDL, used only by deployments', 'Separate credential, used for minutes a week.'],
        ['`reporting`', '`SELECT` on specific views', 'Analysts read views, never base tables.'],
        ['`backup`', '`SELECT`, `LOCK TABLES`, `RELOAD`', 'Read-only by construction.'],
      ],
    ),
    tip(
      'The `app` account having no `DROP` is the single highest-value line in that table. It means the worst case of an injection in your application is *data disclosure* rather than *data destruction*, and the difference between those two is the difference between an incident and a company-ending one.',
    ),
    ul(
      'Never let the application use `root`.',
      'Restrict the host: `\'app\'@\'10.0.%\'` cannot connect from a laptop.',
      'Grant on **views** rather than tables where the audience should not see every column.',
      'Roles (MySQL 8, PostgreSQL) group privileges so a new analyst is one `GRANT` rather than eleven.',
    ),

    h('SQL injection'),
    p('The vulnerability is always the same shape: **a string containing user input is parsed as SQL.**'),
    code(
      js(`
// Every SQL injection ever written starts here.
const sql = "SELECT * FROM users WHERE email = '" + email + "'";
db.query(sql);
`),
    ),
    p('With `email` = `ada@example.com`, that is the query you meant. With `email` = `\' OR \'1\'=\'1`, it is:'),
    code(
      sql(`
SELECT * FROM users WHERE email = '' OR '1'='1'
`),
    ),
    p('Every row. And it gets worse, because the input can end the statement and start another:'),
    table(
      ['input', 'becomes', 'effect'],
      [
        ["`' OR '1'='1`", "`WHERE email = '' OR '1'='1'`", 'Returns every row.'],
        ["`' OR 1=1 --`", '`WHERE email = \'\' OR 1=1 --\'`', 'The `--` comments out the rest, including a password check.'],
        ["`'; DROP TABLE users; --`", 'Two statements', 'Destruction — if the driver allows stacked queries.'],
        ["`' UNION SELECT card_number, 1, 1 FROM payments --`", 'A union', 'Returns data from a different table entirely.'],
        ["`' AND SLEEP(5) --`", 'A timing probe', 'Blind injection — the response time leaks the answer.'],
      ],
    ),
    warn(
      "The classic authentication bypass is the second one. `SELECT * FROM users WHERE email = '\" + email + \"' AND password_hash = '\" + hash + \"'` with an email of `admin@x.com' --` becomes a query that never checks the password at all. No exploit toolkit required; it is one apostrophe and two dashes typed into a login form.",
    ),

    h('The fix'),
    p(
      '**Parameterised queries.** The SQL and the data are sent to the database *separately*. The statement is parsed first, with placeholders where values go; the values arrive afterwards, as values. There is no step at which the input could be parsed as SQL — **so injection is not mitigated, it is impossible**:',
    ),
    code(
      js(`
// node-postgres
await db.query('SELECT * FROM users WHERE email = $1', [email]);

// mysql2
await db.execute('SELECT * FROM users WHERE email = ?', [email]);

// Even this input is now just a string to search for.
// email = "' OR '1'='1"  →  0 rows, because nobody has that email address.
`),
    ),
    code(
      sql(`
-- The same thing, in SQL itself.
PREPARE stmt FROM 'SELECT * FROM users WHERE email = ?';
SET @e = 'ada@example.com';
EXECUTE stmt USING @e;
DEALLOCATE PREPARE stmt;
`),
    ),
    tip(
      'Parameterised queries are also **faster**, which removes the last excuse. The parsed plan is cached and reused across executions with different values, so a prepared statement run a thousand times is parsed once. Safety and speed point the same way here, which is rare enough to be worth saying out loud.',
    ),
    note(
      'Escaping is the other approach and it is strictly worse. It depends on getting the character set right, on the escaping function matching the exact context, and on nobody ever forgetting it — and it does not help at all where a placeholder is not allowed, such as a table name. Parameterisation has no such conditions.',
    ),

    h('What parameters cannot do'),
    warn(
      'A placeholder can only stand for a **value**. Table names, column names and `ASC`/`DESC` are part of the statement structure and cannot be parameterised — which is exactly where injection creeps back into otherwise careful code, usually in a sort or filter driven by a query string.',
    ),
    code(
      js(`
// Injectable: the column name is concatenated.
const rows = await db.query(\`SELECT * FROM employees ORDER BY \${sortColumn}\`);

// Safe: an allowlist. The user picks an index into a list you wrote.
const SORTABLE = { name: 'name', salary: 'salary', hired: 'hired_on' };
const column = SORTABLE[sortColumn] ?? 'id';
const dir = sortDir === 'desc' ? 'DESC' : 'ASC';
const rows = await db.query(\`SELECT * FROM employees ORDER BY \${column} \${dir}\`);
`),
    ),
    p(
      'The allowlist is the general answer to any dynamic *identifier*: never sanitise the input, map it. The value that reaches the SQL string is one you wrote, not one that was sent to you.',
    ),

    h('The rest of the defence'),
    table(
      ['layer', 'does', 'stops injection?'],
      [
        ['**Parameterised queries**', 'Separates code from data', '**Yes. Completely.**'],
        ['Allowlists for identifiers', 'Covers what parameters cannot', 'Yes, for that case'],
        ['Least privilege', 'Limits the blast radius', 'No — limits the damage'],
        ['Input validation', 'Rejects obvious nonsense early', 'No — defence in depth only'],
        ['Stored procedures', 'Helps *if* they use parameters internally', 'No — string-building inside a procedure injects just as well'],
        ['A WAF', 'Blocks known patterns', 'No — buys time, and is bypassable'],
        ['Hiding error messages', 'Denies the attacker feedback', 'No — blind injection works without it'],
      ],
    ),
    warn(
      'Only the first two rows actually prevent it. Everything else reduces consequences or slows an attacker down, and treating any of them as the fix is how vulnerable code ships with a security review attached. An ORM is not on the list at all: an ORM parameterises by default, which is why it helps, but `Model.raw("… " + input)` is exactly as injectable as anything else.',
    ),

    h('Finding it in a codebase'),
    p('Injection has a recognisable shape, and it greps:'),
    code(
      js(`
// Every one of these is a candidate.
"SELECT ... " + variable
\`SELECT ... \${variable}\`
"SELECT ... %s" % variable
db.raw(...), db.execute(oneArgument)
`),
    ),
    p(
      'The rule that makes review cheap: **a query string should contain no variable at all.** If a query is built by concatenation or interpolation anywhere, it needs a reason, and the only acceptable reason is an identifier chosen from an allowlist.',
    ),

    h('Interview'),
    asked([
      ['What is SQL injection?', 'User input concatenated into a query string and then parsed as SQL.'],
      ['How do you prevent it?', 'Parameterised queries — the statement is parsed before the values arrive, so input can never become code.'],
      ['Why is escaping worse?', 'It depends on the character set, the exact context, and never being forgotten. Parameterisation has no conditions.'],
      ['What can a parameter not replace?', 'Identifiers — table and column names, and sort direction. Use an allowlist.'],
      ['Do stored procedures prevent it?', 'No. A procedure that builds SQL from a string is just as vulnerable.'],
      ['Do ORMs?', 'By default they parameterise, but any raw-SQL escape hatch reintroduces it.'],
      ['What is blind SQL injection?', 'Inferring data from response differences or timing when no error or data is returned.'],
      ['What does least privilege buy you?', 'Not prevention — a smaller blast radius. No DROP means an injection cannot destroy the table.'],
      ['Give the classic auth bypass.', "`admin@x.com' --` ends the string and comments out the password check."],
      ['What is GRANT OPTION?', 'The right to grant your privileges to others. Administrators only.'],
      ['Why grant on views?', 'It hides columns structurally — the role has no access to the base table at all.'],
      ['Are parameterised queries slower?', 'Faster, usually — the plan is prepared once and reused.'],
    ]),

    h('Cheatsheet'),
    cheat([
      ['Put a value in a query', 'A placeholder — `?` or `$1` — never concatenation'],
      ['Put a column name in a query', 'An allowlist map'],
      ['Give an app database access', '`SELECT, INSERT, UPDATE, DELETE` — no DDL'],
      ['Give an analyst access', '`SELECT` on views'],
      ['Hide a column from a role', 'Column-level `GRANT`, or a view'],
      ['Give access to an operation only', '`GRANT EXECUTE` on a procedure'],
      ['Limit where a user can connect from', "`'app'@'10.0.%'`"],
      ['Review for injection', 'Grep for a variable inside a query string'],
      ['See what an account can do', '`SHOW GRANTS FOR …`'],
    ]),

    links(
      wiki('SQL_injection', 'SQL injection'),
      mysqlDoc('grant.html', 'GRANT (MySQL)'),
      link(
        'SQL Injection Prevention Cheat Sheet',
        'https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html',
      ),
    ),
  ],
};
