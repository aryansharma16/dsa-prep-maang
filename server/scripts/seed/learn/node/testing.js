import { asked, cheat, code, h, js, link, links, note, p, sh, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Tests exist to let you change code without fear. That framing decides everything else: the tests worth writing are the ones that break when behaviour breaks and stay quiet when you rename a function — which in a backend means testing **through the API**, not through the units underneath it.',
    ),

    h('The shape'),
    table(
      ['Kind', 'Covers', 'Speed', 'How much'],
      [
        ['**Unit**', 'One pure function — pricing, a date rule, a parser', '~1 ms', 'Where the logic is genuinely tricky'],
        ['**Integration / API**', 'A real request through routes, services and a real database', '~50 ms', '**The bulk of a backend suite**'],
        ['**End to end**', 'The deployed system, browser included', 'Seconds', 'A handful of critical paths'],
      ],
    ),
    tip(
      'The classic pyramid says mostly unit tests. For an API that advice inverts: most of your bugs live in the wiring — middleware order, a missing ownership check, a SQL predicate, a status code — and only an API test through a real database catches those. A mocked repository will happily agree with a query that does not work.',
    ),

    h('The runner'),
    code(
      sh(`
# Built in since Node 18 — no dependency at all
node --test
node --test --watch
node --test --experimental-test-coverage

# Or Vitest, if you want richer mocking and a UI
npm install -D vitest supertest
`),
    ),
    code(
      js(`
// tests/pricing.test.js — the built-in runner
import test, { describe, it, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';

describe('applyDiscount', () => {
  it('takes a percentage off', () => {
    assert.equal(applyDiscount(1000, 10), 900);
  });

  it('never goes below zero', () => {
    assert.equal(applyDiscount(100, 150), 0);
  });

  it('rejects a negative percentage', () => {
    assert.throws(() => applyDiscount(100, -5), /percentage/);
  });
});
`),
    ),
    note(
      '`node:assert/strict` is deep-equal by default and gives readable diffs. `assert.deepStrictEqual(actual, expected)` is the one you will use most — it is the real structural comparison mentioned back in `values-and-types`.',
    ),

    h('API tests'),
    p(
      'Supertest starts your app on an ephemeral port, makes a real HTTP request and closes it. This is why `app.js` was separated from `index.js` in `project-structure` — the test imports the app and never binds your real port.',
    ),
    code(
      js(`
// tests/tasks.test.js
import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { pool } from '../src/db/pool.js';

const app = createApp();
let aliceToken, bobToken;

before(async () => {
  await migrate();
  ({ aliceToken, bobToken } = await seedUsers());
});

beforeEach(async () => {
  await pool.query('truncate tasks restart identity cascade');
});

after(async () => { await pool.end(); });

describe('POST /v1/tasks', () => {
  it('creates a task', async () => {
    const res = await request(app)
      .post('/v1/tasks')
      .set('Authorization', \`Bearer \${aliceToken}\`)
      .send({ title: 'Ship it' })
      .expect(201);

    assert.equal(res.body.title, 'Ship it');
    assert.equal(res.body.done, false);
    assert.match(res.headers.location, /^\\/v1\\/tasks\\//);
  });

  it('rejects an empty title', async () => {
    const res = await request(app)
      .post('/v1/tasks')
      .set('Authorization', \`Bearer \${aliceToken}\`)
      .send({ title: '   ' })
      .expect(422);

    assert.equal(res.body.error.issues[0].field, 'title');
  });

  it('requires authentication', async () => {
    await request(app).post('/v1/tasks').send({ title: 'x' }).expect(401);
  });
});
`),
    ),

    h('The tests that matter most'),
    p(
      'Access control cannot be checked by a type system, a linter or a scanner. A negative test per endpoint is the only thing that catches an ownership check someone deletes during a refactor.',
    ),
    code(
      js(`
describe('authorization', () => {
  it('cannot read another user\\'s task', async () => {
    const { body } = await request(app)
      .post('/v1/tasks')
      .set('Authorization', \`Bearer \${aliceToken}\`)
      .send({ title: 'private' });

    await request(app)
      .get(\`/v1/tasks/\${body.id}\`)
      .set('Authorization', \`Bearer \${bobToken}\`)
      .expect(404);                       // not 403 — we do not confirm it exists
  });

  it('does not list another user\\'s tasks', async () => {
    await request(app).post('/v1/tasks')
      .set('Authorization', \`Bearer \${aliceToken}\`).send({ title: 'private' });

    const res = await request(app).get('/v1/tasks')
      .set('Authorization', \`Bearer \${bobToken}\`).expect(200);

    assert.equal(res.body.data.length, 0);   // the gap people forget
  });

  it('cannot promote itself', async () => {
    await request(app).patch('/v1/users/me')
      .set('Authorization', \`Bearer \${aliceToken}\`)
      .send({ role: 'admin' })
      .expect(422);
  });
});
`),
    ),
    warn(
      'The list test is the one that gets skipped. Everyone tests `GET /tasks/:id` for another user; far fewer test that `GET /tasks` is scoped — and an unscoped list leaks everything in one request rather than one row at a time.',
    ),

    h('A real database, not a mock'),
    code(
      sh(`
# docker-compose.test.yml — the same Postgres version as production
services:
  db:
    image: postgres:17
    environment: { POSTGRES_PASSWORD: test }
    ports: ["5433:5432"]
    tmpfs: /var/lib/postgresql/data      # in memory: much faster, disposable
`),
    ),
    code(
      js(`
// Isolation between tests, cheapest first:
// 1. truncate the tables you touched      — fast, simple, the usual choice
await pool.query('truncate tasks, comments restart identity cascade');

// 2. wrap each test in a transaction and roll back — fastest, but the code
//    under test cannot manage its own transactions
// 3. a fresh schema per worker file      — for parallel runs
`),
    ),
    tip(
      'Testcontainers starts and stops the database from the test process, so `npm test` needs no manual `docker compose up` and CI needs no service definition. Worth it once more than one person runs the suite.',
    ),

    h('What to mock'),
    table(
      ['Mock', 'Do not mock'],
      [
        ['Third-party HTTP — Stripe, an email provider', 'Your own database'],
        ['Time, when behaviour depends on it', 'Your own repositories in an API test'],
        ['Randomness and id generation, when asserting output', 'Express, or the HTTP layer'],
        ['Queues, when asserting a job was enqueued', 'The code you are testing'],
      ],
    ),
    code(
      js(`
import { mock } from 'node:test';

it('sends a welcome email on registration', async () => {
  const send = mock.method(emailProvider, 'send', async () => ({ id: 'x' }));

  await request(app).post('/v1/auth/register')
    .send({ email: 'a@b.com', password: 'correct horse battery' })
    .expect(201);

  assert.equal(send.mock.callCount(), 1);
  assert.equal(send.mock.calls[0].arguments[0].to, 'a@b.com');
});

// Time, for anything with an expiry.
mock.timers.enable({ apis: ['Date', 'setTimeout'] });
mock.timers.tick(16 * 60_000);          // jump past a 15-minute token expiry
`),
    ),
    warn(
      'Mocking your own repository turns an API test into a test of your assumptions. It passes when the SQL is wrong, when a constraint fires, when a column is renamed — every failure mode a database test exists to catch.',
    ),

    h('Async traps'),
    code(
      js(`
// Silently passes — nothing awaits the assertion.
it('fails', () => { assertEventually(); });

// Correct — return or await the promise.
it('rejects a duplicate', async () => {
  await assert.rejects(() => service.register(existing), /already/);
});

// Test the failure path too, not only the happy one.
it('returns 409 on a duplicate email', async () => {
  await request(app).post('/v1/auth/register').send(user).expect(201);
  await request(app).post('/v1/auth/register').send(user).expect(409);
});
`),
    ),
    tip(
      'A test that never fails is worse than no test — it costs runtime and buys confidence it has not earned. When you write one, break the code deliberately once and watch it go red. If it stays green, the test is not testing anything.',
    ),

    h('Coverage'),
    code(
      sh(`
node --test --experimental-test-coverage
npx vitest run --coverage
`),
    ),
    p(
      'Coverage tells you what was **executed**, not what was **verified** — a test with no assertions covers plenty. Use it to find whole files nobody tests, not as a percentage to hit. A team chasing 90% writes tests for getters and still ships the missing authorization check.',
    ),

    h('In CI'),
    code(
      sh(`
# .github/workflows/ci.yml
services:
  postgres:
    image: postgres:17
    env: { POSTGRES_PASSWORD: test }
    options: >-
      --health-cmd pg_isready --health-interval 10s --health-retries 5
    ports: ["5432:5432"]

steps:
  - uses: actions/checkout@v4
  - uses: actions/setup-node@v4
    with: { node-version: 22, cache: npm }
  - run: npm ci
  - run: npm run migrate
  - run: npm test
  - run: npm audit --omit=dev
`),
    ),
    note(
      '`npm ci`, not `npm install` — the reason from `npm-and-package-json`: CI must run exactly the locked dependency tree, or the thing you tested is not the thing you ship.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Run tests with no dependency', '`node --test`'],
      ['Test an endpoint', 'Supertest against `createApp()`'],
      ['Compare objects', '`assert.deepStrictEqual`'],
      ['Assert a rejection', '`await assert.rejects(fn, /message/)`'],
      ['Isolate tests', '`truncate … restart identity cascade` in `beforeEach`'],
      ['Fake an external API', '`mock.method`'],
      ['Fake time', '`mock.timers`'],
      ['Test access control', 'A second user, and expect `404`'],
      ['Trust a test', 'Break the code once and watch it fail'],
    ]),

    h('Interview'),
    asked([
      ['How do you test a Node API?', 'Mostly integration tests with Supertest against a real database, plus unit tests where the logic is genuinely tricky.'],
      ['Why not mock the database?', 'The bugs live in the wiring — SQL, constraints, middleware order — and a mock agrees with a query that does not work.'],
      ['What do you mock, then?', 'Third-party APIs, time and randomness — things that are slow, flaky or outside your control.'],
      ['How do you isolate tests?', 'Truncate between tests, or a transaction rolled back per test, or a schema per worker for parallel runs.'],
      ['What is the most valuable test in an API?', 'A negative authorization test per endpoint — nothing else catches a missing ownership check.'],
      ['Is high coverage the goal?', 'No — it measures execution, not verification. Use it to find untested files, not as a target.'],
      ['Why `npm ci` in CI?', 'It installs the lockfile exactly, so the tested tree is the shipped tree.'],
    ]),

    links(
      link('Node.js test runner', 'https://nodejs.org/api/test.html'),
      link('Supertest', 'https://github.com/ladjs/supertest'),
      link('Vitest', 'https://vitest.dev'),
    ),
  ],
};
