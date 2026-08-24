import { asked, cheat, code, h, js, link, links, nodeDoc, note, p, sh, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'A single `app.js` works until roughly the tenth endpoint. After that the useful question is not "which folders" but **"where does each kind of code go, and what is it allowed to know about?"** Layers answer that, and the layout falls out of the answer.',
    ),

    h('The layers'),
    code(
      js(`
   HTTP request
        │
        ▼
   ┌──────────────┐  routes/        which URL maps to which handler
   │  Route       │                 middleware: auth, validation
   └──────┬───────┘
          ▼
   ┌──────────────┐  controllers/   HTTP in, HTTP out.
   │  Controller  │                 Reads req, calls a service, sends res.
   └──────┬───────┘                 NO business rules. NO SQL.
          ▼
   ┌──────────────┐  services/      The business rules.
   │  Service     │                 Knows nothing about req or res.
   └──────┬───────┘                 This is the part worth testing.
          ▼
   ┌──────────────┐  repositories/  The queries. One place per table.
   │  Repository  │                 Returns plain objects, not rows.
   └──────┬───────┘
          ▼
      PostgreSQL
`),
    ),
    table(
      ['Layer', 'Knows about', 'Never touches'],
      [
        ['Route', 'HTTP paths, middleware', 'Business rules, SQL'],
        ['Controller', '`req`, `res`, status codes', 'SQL, business rules'],
        ['**Service**', 'Domain rules, other services', '`req`, `res`, status codes'],
        ['Repository', 'SQL, the database client', 'HTTP, business rules'],
      ],
    ),
    tip(
      'The single most valuable rule is the one on the service: **it must not import `req` or `res`.** That is what lets you call it from a queue worker, a cron job, a CLI script and a test, and it is what makes it testable without spinning up a server.',
    ),

    h('The layout'),
    code(
      sh(`
src/
  index.js              start the server, handle signals
  app.js                build the express app — no listen()
  config/index.js       validated env, exported once
  routes/
    index.js            mounts every resource router
    tasks.routes.js
  controllers/
    tasks.controller.js
  services/
    tasks.service.js
  repositories/
    tasks.repo.js
  middleware/
    auth.js  validate.js  errorHandler.js  requestId.js
  errors/index.js       AppError and friends
  db/
    pool.js  migrations/
  utils/
tests/
`),
    ),
    note(
      '`app.js` builds the app and `index.js` starts it. That split is not decoration: a test imports `app.js` and hands it to Supertest without ever binding a port, which is what makes API tests fast and parallelisable.',
    ),

    h('One request through all four'),
    code(
      js(`
// routes/tasks.routes.js
import { Router } from 'express';
import * as controller from '../controllers/tasks.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createTaskSchema } from '../schemas/tasks.js';

const router = Router();
router.use(requireAuth);

router.get('/', controller.list);
router.post('/', validate(createTaskSchema), controller.create);
router.get('/:id', controller.getOne);

export default router;
`),
    ),
    code(
      js(`
// controllers/tasks.controller.js — thin, on purpose
import * as service from '../services/tasks.service.js';

export const list = async (req, res) => {
  const result = await service.list(req.user.id, req.query);
  res.json(result);
};

export const create = async (req, res) => {
  const task = await service.create(req.user.id, req.body);
  res.status(201).location(\`/v1/tasks/\${task.id}\`).json(task);
};

export const getOne = async (req, res) => {
  const task = await service.getForUser(req.params.id, req.user.id);
  res.json(task);                       // throws NotFoundError if absent
};
`),
    ),
    code(
      js(`
// services/tasks.service.js — the rules live here, and nothing HTTP does
import * as repo from '../repositories/tasks.repo.js';
import { ForbiddenError, NotFoundError, ConflictError } from '../errors/index.js';

const MAX_OPEN_TASKS = 100;

export async function create(userId, input) {
  const open = await repo.countOpen(userId);
  if (open >= MAX_OPEN_TASKS) {
    throw new ConflictError(\`At most \${MAX_OPEN_TASKS} open tasks\`);
  }
  return repo.insert({ ...input, userId });
}

export async function getForUser(id, userId) {
  const task = await repo.findById(id);
  if (!task) throw new NotFoundError('Task');
  if (task.userId !== userId) throw new ForbiddenError();   // ownership check
  return task;
}
`),
    ),
    code(
      js(`
// repositories/tasks.repo.js — SQL, and nothing else
import { pool } from '../db/pool.js';

const toTask = (row) => ({
  id: row.id,
  title: row.title,
  done: row.done,
  createdAt: row.created_at,          // snake_case stops at this boundary
});

export async function findById(id) {
  const { rows } = await pool.query('select * from tasks where id = $1', [id]);
  return rows[0] ? toTask(rows[0]) : null;
}

export async function insert({ userId, title }) {
  const { rows } = await pool.query(
    'insert into tasks (user_id, title) values ($1, $2) returning *',
    [userId, title],
  );
  return toTask(rows[0]);
}
`),
    ),
    tip(
      'The `toTask` mapper is small and pays for itself twice: your API shape stops being your database schema, so a column rename is not a breaking API change — and a row can never leak a column you forgot was there, like `password_hash`.',
    ),

    h('Wiring the app'),
    code(
      js(`
// app.js — builds, does not listen
import express from 'express';
import helmet from 'helmet';
import routes from './routes/index.js';
import { requestId } from './middleware/requestId.js';
import { errorHandler } from './middleware/errorHandler.js';
import { NotFoundError } from './errors/index.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(express.json({ limit: '100kb' }));
  app.use(requestId);

  app.get('/health', (req, res) => res.json({ ok: true, uptime: process.uptime() }));
  app.use('/v1', routes);

  app.use((req, res, next) => next(new NotFoundError('Route')));
  app.use(errorHandler);

  return app;
}
`),
    ),
    code(
      js(`
// index.js — starts it, and stops it properly
import { createApp } from './app.js';
import { config } from './config/index.js';
import { pool } from './db/pool.js';

const server = createApp().listen(config.port, () =>
  console.log(\`listening on \${config.port}\`));

const shutdown = async (signal) => {
  console.log(\`\${signal} received\`);
  setTimeout(() => process.exit(1), 10_000).unref();
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
`),
    ),

    h('When to skip the layers'),
    warn(
      'A controller that only forwards to a service that only forwards to a repository is three files doing one thing. For a genuinely CRUD resource with no rules, merging the service into the controller is fine — add the layer when there is a rule to put in it.',
    ),
    p(
      'What is **not** optional, at any size: the repository boundary (so SQL is in one place), the ownership check in the service (so it cannot be forgotten per endpoint), and the split between building and starting the app.',
    ),

    h('By feature, at scale'),
    code(
      sh(`
# Past a few dozen endpoints, group by feature rather than by layer —
# everything about tasks is then in one directory.
src/modules/
  tasks/    routes.js controller.js service.js repo.js schema.js tests/
  users/    routes.js controller.js service.js repo.js schema.js tests/
  shared/
`),
    ),
    note(
      'Both layouts express the same layers; they differ in what is easy to find. By-layer is easier to learn, by-feature is easier to change — because a change to tasks touches one directory instead of four.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Map a URL to code', 'routes/'],
      ['Read `req`, send `res`', 'controllers/ — and nowhere else'],
      ['Enforce a business rule', 'services/'],
      ['Write SQL', 'repositories/ — and nowhere else'],
      ['Check ownership', 'The service, so no endpoint can skip it'],
      ['Keep the API shape stable', 'A row-to-object mapper in the repository'],
      ['Make the app testable', '`createApp()` separate from `listen()`'],
      ['Handle every failure', 'Throw a typed error; one handler renders it'],
    ]),

    h('Interview'),
    asked([
      ['How would you structure a growing Express app?', 'Layered: routes → controllers → services → repositories, grouped by feature once it is large.'],
      ['Controller vs service?', 'The controller translates HTTP; the service holds the rules and knows nothing about HTTP.'],
      ['Why must a service not touch `req`?', 'So it can be called from a worker, a cron job or a test without faking a request.'],
      ['Why a repository layer?', 'SQL lives in one place, so schema changes and query tuning do not spread through the codebase.'],
      ['Why separate `app.js` from `index.js`?', 'Tests can import the app and drive it with Supertest without binding a port.'],
      ['Where does the ownership check belong?', 'The service — putting it in each controller means one endpoint eventually forgets it.'],
    ]),

    links(
      nodeDoc('modules.html', 'Modules'),
      link('Express — best practices for production', 'https://expressjs.com/en/advanced/best-practice-performance.html'),
      link('Node.js best practices', 'https://github.com/goldbergyoni/nodebestpractices'),
    ),
  ],
};
