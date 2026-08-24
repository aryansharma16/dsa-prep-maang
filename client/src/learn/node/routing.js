import { asked, cheat, code, h, js, link, links, note, p, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'A route is a method plus a path pattern plus one or more handlers. Express matches them **in the order they were registered**, top to bottom, and stops at the first one whose method and pattern both match — which is the source of most routing surprises.',
    ),

    h('Patterns'),
    code(
      js(`
app.get('/tasks', handler);                 // exact
app.get('/tasks/:id', handler);             // req.params.id
app.get('/users/:userId/tasks/:id', h);     // several params
app.get('/files/*splat', handler);          // the rest of the path (Express 5)
app.all('/admin/*splat', requireAdmin);     // every method
`),
    ),
    warn(
      'Wildcard syntax changed in Express 5: the bare `*` and optional `:id?` of Express 4 are gone, replaced by named forms like `*splat` and `{/:id}`. Check `npm ls express` before copying a pattern from an old answer.',
    ),

    h('Order decides the winner'),
    code(
      js(`
// Broken: /tasks/new is matched by /tasks/:id, so 'new' arrives as an id.
app.get('/tasks/:id', getTask);
app.get('/tasks/new', newTaskForm);          // unreachable

// Fixed: the specific route goes first.
app.get('/tasks/new', newTaskForm);
app.get('/tasks/:id', getTask);
`),
    ),
    tip(
      'The rule: **static before dynamic, specific before general.** A 404 middleware registered before your routes catches everything and your API returns 404 for every endpoint — the same mistake in a different costume.',
    ),

    h('The three sources of input'),
    code(
      js(`
// GET /users/42/tasks?status=open&page=2   body: {"title":"x"}
app.post('/users/:userId/tasks', (req, res) => {
  req.params.userId;      // '42'      — identifies the resource
  req.query.status;       // 'open'    — filters or modifies
  req.query.page;         // '2'       — a STRING
  req.body.title;         // 'x'       — the data
});
`),
    ),
    code(
      js(`
// Arrays and nested objects in the query string, which surprise people:
// ?tag=a&tag=b        -> req.query.tag = ['a', 'b']
// ?filter[done]=true  -> req.query.filter = { done: 'true' }  (extended parser)

// So this is not safe:
const page = parseInt(req.query.page);       // NaN if the client sent ?page[]=1

// This is:
const page = Math.max(1, Number(req.query.page) || 1);
`),
    ),
    warn(
      'A query parameter can arrive as a string, an array or an object, entirely at the client\'s discretion. Code that assumes "string" crashes or behaves strangely on a crafted request. Validate the shape, do not just convert the type — the `validation` topic covers this properly.',
    ),

    h('Router — splitting across files'),
    p(
      '`express.Router()` is a mini-app: it has its own routes and its own middleware, and it gets mounted under a prefix. This is how an API stays readable past about ten endpoints.',
    ),
    code(
      js(`
// routes/tasks.js
import { Router } from 'express';

const router = Router();

router.use(requireAuth);                 // applies to every route below

router.get('/', listTasks);              // GET  /tasks
router.post('/', createTask);            // POST /tasks
router.get('/:id', getTask);             // GET  /tasks/:id
router.patch('/:id', updateTask);
router.delete('/:id', requireRole('admin'), deleteTask);

export default router;
`),
    ),
    code(
      js(`
// routes/index.js
import { Router } from 'express';
import tasks from './tasks.js';
import users from './users.js';

const api = Router();
api.use('/tasks', tasks);
api.use('/users', users);
export default api;

// app.js
app.use('/v1', api);          // -> /v1/tasks, /v1/users
`),
    ),
    note(
      'Inside a mounted router, `req.url` is relative to the mount point but `req.originalUrl` is the full path. Log `originalUrl` — `url` will tell you `/7` when the request was for `/v1/tasks/7`.',
    ),

    h('Chained handlers'),
    code(
      js(`
// Several handlers on one route, run in order. Any of them can end the response.
router.post('/', requireAuth, validate(createTaskSchema), createTask);

// Group the methods for one path.
router.route('/:id')
  .get(getTask)
  .patch(validate(updateTaskSchema), updateTask)
  .delete(requireRole('admin'), deleteTask);
`),
    ),

    h('Nested resources'),
    code(
      js(`
// mergeParams lets the child router see the parent's :userId.
const taskRouter = Router({ mergeParams: true });
taskRouter.get('/', (req, res) => {
  req.params.userId;      // undefined WITHOUT mergeParams
});

app.use('/users/:userId/tasks', taskRouter);
`),
    ),
    tip(
      'Nest one level at most. `/users/:userId/projects/:projectId/tasks/:id` is painful to build URLs for and painful to authorise. Once the child has its own id, `/tasks/:id?userId=42` says the same thing and is easier to cache, link and secure.',
    ),

    h('param middleware'),
    code(
      js(`
// Runs whenever a route in this router has :id — load once, reuse everywhere.
router.param('id', async (req, res, next, id) => {
  const task = await service.findById(id);
  if (!task) return res.status(404).json({ error: 'Not found' });
  req.task = task;
  next();
});

router.get('/:id', (req, res) => res.json(req.task));
router.patch('/:id', (req, res) => res.json(service.update(req.task, req.body)));
`),
    ),

    h('404 and 405'),
    code(
      js(`
// Register AFTER every route — this is the fall-through.
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.originalUrl });
});
`),
    ),
    code(
      js(`
// 405 when the path exists but the method does not.
router.route('/:id')
  .get(getTask)
  .all((req, res) => res.status(405)
    .set('Allow', 'GET')
    .json({ error: 'Method not allowed' }));
`),
    ),

    h('Cheatsheet'),
    cheat([
      ['Match a path param', '`/tasks/:id`, read `req.params.id`'],
      ['Put routes in their own file', '`express.Router()` + `app.use(prefix, router)`'],
      ['Protect a whole group', '`router.use(requireAuth)` at the top'],
      ['Group methods on one path', '`router.route("/:id").get(...).patch(...)`'],
      ['See a parent\'s params', '`Router({ mergeParams: true })`'],
      ['Load a resource once per route', '`router.param("id", ...)`'],
      ['Catch unmatched paths', 'A final `app.use` returning 404'],
      ['Fix "my specific route never runs"', 'Move it above the `:param` route'],
    ]),

    h('Interview'),
    asked([
      ['How does Express choose a route?', 'First registered match on method and pattern wins — order matters.'],
      ['Why does `/tasks/new` hit `/tasks/:id`?', 'The dynamic route was registered first and matches anything in that position.'],
      ['How do you split routes across files?', '`express.Router()` per resource, mounted with `app.use(prefix, router)`.'],
      ['What is `mergeParams` for?', 'Letting a nested router read params from the path it was mounted under.'],
      ['Are query params always strings?', 'No — they can be arrays or nested objects depending on what the client sends.'],
      ['Where does the 404 handler go?', 'Last, after every route, as a plain `app.use`.'],
    ]),

    links(
      link('Express routing guide', 'https://expressjs.com/en/guide/routing.html'),
      link('Express — Router', 'https://expressjs.com/en/4x/api.html#router'),
      link('Express 5 migration guide', 'https://expressjs.com/en/guide/migrating-5.html'),
    ),
  ],
};
