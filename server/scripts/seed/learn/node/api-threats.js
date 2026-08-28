import { asked, cheat, code, h, js, link, links, note, p, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'This section is the shortlist: what a public Node API actually gets attacked with, ranked by how often it works. The ranking matters, because the things that break real APIs are rarely the exotic ones — they are missing access-control checks and dependencies nobody updated.',
    ),

    h('What actually gets exploited'),
    table(
      ['Rank', 'Weakness', 'In this track'],
      [
        ['1', '**Broken object-level authorization** — reading someone else\'s row by id', '`authorization-rbac`'],
        ['2', '**Broken authentication** — weak passwords, no rate limit, leaky tokens', '`passwords`, `jwt`'],
        ['3', '**Broken function-level authorization** — an admin endpoint anyone can call', '`authorization-rbac`'],
        ['4', '**Unrestricted resource consumption** — no pagination, no body limit, no rate limit', 'Below, and `secrets-and-rate-limiting`'],
        ['5', '**Injection** — SQL, NoSQL, command', '`injection`'],
        ['6', '**Security misconfiguration** — debug on, CORS wide open, stack traces returned', '`cors-and-headers`'],
        ['7', '**Vulnerable dependencies**', 'Below'],
        ['8', '**Mass assignment**', '`validation`'],
      ],
    ),
    note(
      'Notice that the top three are all authorization, and none of them are caught by a scanner, a linter or TypeScript. A tool can find an unpatched dependency; only you know that task 7 belongs to Alice.',
    ),

    h('The model to hold'),
    p('Three assumptions, and every specific defence follows from them:'),
    table(
      ['Assume', 'Because'],
      [
        ['**Every byte from a client is hostile**', 'Body, query, params, headers, cookies, file names, `Content-Type` — all attacker-controlled'],
        ['**Client-side checks do not exist**', 'A browser form validates for convenience; `curl` skips it entirely'],
        ['**An id is not permission**', 'Knowing a UUID says nothing about being allowed to see it'],
      ],
    ),
    code(
      js(`
// Everything below is attacker-controlled. All of it.
req.body            req.query           req.params
req.headers         req.cookies         req.file.originalname
req.get('Content-Type')                 req.get('X-Forwarded-For')
`),
    ),

    h('Resource consumption'),
    p(
      'The category people skip, and the one that takes a service down without any cleverness at all.',
    ),
    code(
      js(`
// Every one of these is a way for one client to consume everything.
app.get('/tasks', async (req, res) => res.json(await repo.all()));   // no limit
app.use(express.json());                              // default 100kb — state it
app.post('/upload', upload.single('f'), …);           // no file size limit
app.get('/search', (req, res) => …);                  // no rate limit
const re = new RegExp(req.query.pattern);             // ReDoS, from user input
`),
    ),
    code(
      js(`
// The baseline, on day one.
app.use(express.json({ limit: '100kb' }));
app.use(rateLimit({ windowMs: 60_000, limit: 100 }));

const limit = Math.min(100, Number(req.query.limit) || 20);   // capped, always
const pool = new pg.Pool({ max: 10, statement_timeout: 5_000 });
upload = multer({ limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
`),
    ),
    warn(
      'Never build a `RegExp` from user input. Beyond ReDoS, a pattern is a small program and you have handed the client a way to run it on your only thread.',
    ),

    h('Dependencies'),
    code(
      js(`
npm audit --omit=dev          # what ships, not your test tooling
npm ls <package>              # every copy in the tree
npm why <package>             # who pulled it in
`),
    ),
    table(
      ['Practice', 'Why'],
      [
        ['Commit the lockfile, `npm ci` in CI', 'The bytes you tested are the bytes you ship'],
        ['`npm audit` in the pipeline', 'A known CVE fails the build rather than the pentest'],
        ['Automated dependency PRs', 'Small, frequent upgrades beat one enormous one'],
        ['Fewer dependencies', 'Every one is code you did not review and a name someone can typosquat'],
        ['Pin the base image by digest', '`node:22-slim` moves; a digest does not'],
      ],
    ),
    tip(
      'Read the advisory before acting. A prototype-pollution CVE in a build-only tool is not the same as one in your HTTP parser, and `npm audit fix --force` will happily install a breaking major version to silence it.',
    ),

    h('Never leak internals'),
    code(
      js(`
// Development
app.use(errorHandler);        // stack traces, query text, file paths

// Production — the same handler, but nothing unexpected reaches the client.
{ "error": { "message": "Internal server error", "requestId": "8f3a…" } }
`),
    ),
    table(
      ['Leaks', 'Fix'],
      [
        ['A stack trace in the response', 'Generic message for anything not `expected`'],
        ['`X-Powered-By: Express`', '`app.disable("x-powered-by")` — or `helmet()`'],
        ['A Postgres error naming a table', 'Map error codes to your own messages'],
        ['`403` on some rows and `404` on others', 'One convention, everywhere'],
        ['Login timing differing by account existence', 'Hash against a dummy'],
        ['Verbose `/health` output', 'Status and uptime only — no versions, no config'],
      ],
    ),

    h('Log carefully'),
    code(
      js(`
// Every one of these ends up in a log aggregator someone else can read.
log.info({ body: req.body });          // passwords, tokens, card numbers
log.info({ headers: req.headers });    // the Authorization header
log.info({ config });                  // every secret you have
log.info({ user });                    // the password hash, and PII
`),
    ),
    code(
      js(`
// Redact at the logger, not at each call site — call sites are forgotten.
const logger = pino({
  redact: {
    paths: [
      'req.headers.authorization', 'req.headers.cookie',
      'password', '*.password', 'passwordHash', 'token', '*.token',
    ],
    censor: '[redacted]',
  },
});
`),
    ),
    warn(
      'Logs are usually the least protected copy of your data — shipped to a third party, searchable by the whole team, retained for a year. A password in a log is a breach even though the database was never touched.',
    ),

    h('The day-one checklist'),
    code(
      js(`
app.disable('x-powered-by');
app.set('trust proxy', 1);                       // a number, never true
app.use(helmet());
app.use(cors({ origin: config.corsOrigins }));   // a list, never '*' with credentials
app.use(express.json({ limit: '100kb' }));
app.use(rateLimit({ windowMs: 60_000, limit: 100 }));

// Every route: validate -> authenticate -> authorize -> scope the query
// Every list:  paginate, with a maximum
// Every error: typed, generic when unexpected, with a request id
// Every secret: from the environment, never in the repo
// Every dependency: locked, audited in CI
`),
    ),

    h('Cheatsheet'),
    cheat([
      ['The most likely real hole', 'A missing ownership check'],
      ['Treat as hostile', 'Body, query, params, headers, cookies, filenames'],
      ['Cap everything', 'Body size, page size, upload size, request rate'],
      ['Never from user input', '`new RegExp(...)`, `eval`, a shell command'],
      ['Keep dependencies safe', 'Lockfile + `npm ci` + `npm audit` in CI'],
      ['Hide internals', 'Generic 500s, no `X-Powered-By`, quiet health checks'],
      ['Protect logs', 'Redaction configured on the logger'],
      ['Verify access control', 'A negative test per endpoint'],
    ]),

    h('Interview'),
    asked([
      ['What are the most common holes in a Node API?', 'Broken object-level authorization first, then weak authentication, missing function-level checks, and unlimited resource consumption.'],
      ['Why is access control hard to test for?', 'No tool knows which rows a user should see — it requires per-endpoint negative tests.'],
      ['How do you stop one client exhausting the service?', 'Body limits, page-size caps, upload limits, rate limits, pool caps and statement timeouts.'],
      ['What should a 500 response contain?', 'A generic message and a request id — never a stack trace or a database error.'],
      ['How do you manage dependency risk?', 'Lockfile, `npm ci`, audit in CI, automated upgrade PRs, and fewer dependencies.'],
      ['What is the risk of verbose logging?', 'Logs are widely readable and long-lived; a token or password in one is a breach.'],
    ]),

    links(
      link('OWASP API Security Top 10 (2023)', 'https://owasp.org/API-Security/editions/2023/en/0x11-t10/'),
      link('OWASP Top 10 (2021)', 'https://owasp.org/Top10/'),
      link('Node.js security best practices', 'https://nodejs.org/en/learn/getting-started/security-best-practices'),
    ),
  ],
};
