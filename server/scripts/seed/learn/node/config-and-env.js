import { asked, cheat, code, h, js, link, links, note, p, sh, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Configuration is everything that differs between your laptop, CI and production: connection strings, ports, secrets, feature flags. The rule that makes it manageable is one line long — **read `process.env` in exactly one module, validate it there, and export a frozen object** — and it turns a class of 2am failures into a startup error.',
    ),

    h('The problem it solves'),
    code(
      js(`
// Scattered through the codebase:
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const port = process.env.PORT || 3000;
jwt.sign(payload, process.env.JWT_SECRET);
if (process.env.FEATURE_X === 'true') { … }
`),
    ),
    p('Four separate failures hiding in four lines:'),
    table(
      ['Line', 'When the variable is missing or wrong'],
      [
        ['`DATABASE_URL`', '`undefined` reaches the driver; the error appears on the first query, not at boot'],
        ['`PORT`', '`"0"` would fall back to 3000 — `||` treats it as absent'],
        ['`JWT_SECRET`', '**`jwt.sign` with `undefined` throws — or worse, a typo means every token is signed with the wrong key**'],
        ['`FEATURE_X`', 'A typo like `True` silently disables the feature, with no error anywhere'],
      ],
    ),

    h('One validated module'),
    code(
      js(`
// config/index.js
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().optional(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  CORS_ORIGINS: z.string().transform((s) => s.split(',').map(o => o.trim())),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid configuration:');
  for (const issue of parsed.error.issues) {
    console.error(\`  \${issue.path.join('.')}: \${issue.message}\`);
  }
  process.exit(1);                  // fail at boot, loudly, with the field name
}

export const config = Object.freeze({
  env: parsed.data.NODE_ENV,
  isProd: parsed.data.NODE_ENV === 'production',
  port: parsed.data.PORT,
  databaseUrl: parsed.data.DATABASE_URL,
  jwt: { secret: parsed.data.JWT_SECRET, expiresIn: parsed.data.JWT_EXPIRES_IN },
  logLevel: parsed.data.LOG_LEVEL,
  corsOrigins: parsed.data.CORS_ORIGINS,
});
`),
    ),
    code(
      js(`
// Everywhere else:
import { config } from './config/index.js';

const pool = new Pool({ connectionString: config.databaseUrl });
app.listen(config.port);
jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
`),
    ),
    tip(
      'The three things this buys, in order of value: a **missing variable stops the deploy instead of the request**, `config.port` is a real number rather than a string, and every configurable value in the system is listed in one readable file.',
    ),

    h('Loading a .env'),
    code(
      sh(`
# Node 20+ — no dependency
node --env-file=.env src/index.js
node --env-file=.env --env-file=.env.local src/index.js   # later wins

# package.json
"scripts": {
  "dev": "node --watch --env-file=.env src/index.js",
  "start": "node src/index.js"
}
`),
    ),
    note(
      'Note that `start` loads no file. In production the environment comes from the orchestrator — Docker, Kubernetes, systemd, the platform\'s secret store — not from a file in the image. A `.env` is a development convenience.',
    ),
    code(
      sh(`
# .gitignore
.env
.env.local
.env.*.local

# .env.example  — COMMITTED, with no real values
DATABASE_URL=postgres://localhost:5432/tasks_dev
PORT=3000
JWT_SECRET=generate-with-openssl-rand-base64-32
LOG_LEVEL=debug
CORS_ORIGINS=http://localhost:5173
`),
    ),
    tip(
      'Commit `.env.example` and keep it in sync with the schema. It is the fastest onboarding document you can write, and CI can diff the two to catch a variable someone added without documenting.',
    ),

    h('Secrets'),
    warn(
      'A secret committed to git is compromised, permanently. Removing it in a later commit does not help — it is in the history, on every clone, and in every fork. The response is always to **rotate the secret**, not to rewrite the history.',
    ),
    table(
      ['Where', 'Suitable for'],
      [
        ['`.env`, gitignored', 'Local development only'],
        ['Platform environment variables', 'Small deployments — Render, Railway, Fly, Heroku'],
        ['AWS Secrets Manager / SSM, Vault', 'Production. Versioned, audited, rotatable'],
        ['Kubernetes Secrets', 'Base64, **not encrypted** at rest by default — enable encryption or use an external store'],
      ],
    ),
    code(
      sh(`
openssl rand -base64 48        # generate a real secret
`),
    ),
    code(
      js(`
// Never log the config object wholesale — it contains the secrets.
log.info({ env: config.env, port: config.port }, 'starting');   // fine
log.info({ config }, 'starting');                                // leaks JWT_SECRET
`),
    ),

    h('Per-environment defaults'),
    code(
      js(`
// Refine the schema rather than branching on NODE_ENV all over the codebase.
const schema = base.superRefine((cfg, ctx) => {
  if (cfg.NODE_ENV === 'production') {
    if (cfg.JWT_SECRET.startsWith('dev-')) {
      ctx.addIssue({ code: 'custom', path: ['JWT_SECRET'],
        message: 'refusing to start with a development secret in production' });
    }
    if (!cfg.REDIS_URL) {
      ctx.addIssue({ code: 'custom', path: ['REDIS_URL'],
        message: 'required in production' });
    }
  }
});
`),
    ),
    p(
      'That first check is worth writing. Shipping a placeholder secret to production is a real incident that a three-line rule prevents at boot.',
    ),

    h('The twelve-factor rules worth keeping'),
    table(
      ['Rule', 'Why'],
      [
        ['Config comes from the environment', 'The same image runs in staging and production, with different values'],
        ['No config files in the image', 'Otherwise a config change requires a rebuild'],
        ['One value per variable', 'A JSON blob in one variable cannot be changed independently or audited'],
        ['Fail on missing config', 'A deploy that cannot possibly work should not become the running version'],
      ],
    ),
    warn(
      'The corollary people miss: **do not read `process.env` at import time in scattered modules.** A module reading it during its own initialisation runs before your validation, gets `undefined`, and caches it. One config module, imported everywhere, has no such ordering problem.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Read env vars', 'One `config/` module, and nowhere else'],
      ['Validate them', 'A Zod schema over `process.env`'],
      ['Fail fast', '`process.exit(1)` with the offending field names'],
      ['Convert types', '`z.coerce.number()`, not `Number(...)` at the call site'],
      ['Load a .env in development', '`node --env-file=.env`'],
      ['Document what is needed', 'A committed `.env.example`'],
      ['Generate a secret', '`openssl rand -base64 48`'],
      ['Store production secrets', 'A secret manager — never the repository'],
    ]),

    h('Interview'),
    asked([
      ['How do you manage configuration in Node?', 'One validated module reading `process.env` at boot, exporting a typed frozen object.'],
      ['Why validate config at startup?', 'A missing or malformed variable then fails the deploy instead of a request hours later.'],
      ['Why is `process.env.PORT || 3000` risky?', '`||` also replaces `"0"` and `""`; `??` and a schema express the intent correctly.'],
      ['Where do production secrets live?', 'A secret manager or the platform\'s environment — never in the repo or the image.'],
      ['What if a secret is committed?', 'Rotate it. It is in the history and in every clone; deleting the line changes nothing.'],
      ['Why not read `process.env` throughout the code?', 'Values are unvalidated strings, read at unpredictable times, and impossible to inventory.'],
    ]),

    links(
      link('node --env-file', 'https://nodejs.org/api/cli.html#--env-fileconfig'),
      link('The Twelve-Factor App — Config', 'https://12factor.net/config'),
      link('Zod', 'https://zod.dev'),
    ),
  ],
};
