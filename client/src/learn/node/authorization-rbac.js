import { asked, cheat, code, h, js, link, links, note, p, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Authorization has two layers, and only the first one is easy. **Role checks** — "is this an admin?" — are a line of middleware. **Ownership checks** — "is this *their* task?" — depend on the row, cannot live in middleware, and are the ones that get forgotten.',
    ),

    h('Roles'),
    code(
      js(`
// The simplest model that works: one role per user, checked on the route.
export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return next(new UnauthorizedError());
  if (!roles.includes(req.user.role)) return next(new ForbiddenError());
  next();
};

router.get('/', requireAuth, controller.list);
router.delete('/:id', requireAuth, requireRole('admin'), controller.remove);
`),
    ),
    warn(
      'Role hierarchies grow teeth quickly. `requireRole("admin")` looks fine until there is a `superadmin` who is not literally `"admin"` and suddenly cannot delete anything. Either list every acceptable role explicitly, or move to permissions.',
    ),

    h('Permissions'),
    p(
      'A role is a **bundle of permissions**, and checking the permission rather than the role is what stops the code changing every time the roles do.',
    ),
    code(
      js(`
// permissions.js
export const PERMISSIONS = {
  user:      ['task:read', 'task:create', 'task:update:own', 'task:delete:own'],
  manager:   ['task:read', 'task:create', 'task:update:any', 'report:read'],
  admin:     ['*'],
};

export const can = (user, permission) => {
  const granted = PERMISSIONS[user.role] ?? [];
  return granted.includes('*') || granted.includes(permission);
};

export const require_ = (permission) => (req, res, next) => {
  if (!req.user) return next(new UnauthorizedError());
  if (!can(req.user, permission)) return next(new ForbiddenError());
  next();
};

router.get('/reports', requireAuth, require_('report:read'), controller.reports);
`),
    ),
    tip(
      'Adding a role then becomes a data change, not a code change: a new `auditor` role is a new entry in the table, and every endpoint already checks the right permission. That is the whole reason to prefer permissions over roles in the checks.',
    ),
    code(
      js(`
// At scale, permissions live in the database, not a constant.
// roles(id, name)
// permissions(id, key)
// role_permissions(role_id, permission_id)
// user_roles(user_id, role_id)      -- a user may hold several roles

const perms = await repo.permissionsForUser(userId);   // cache this per request
`),
    ),

    h('Ownership — the check that matters'),
    p(
      'No middleware can answer "does this user own task 7", because the task has not been loaded yet. It belongs in the service, next to the data.',
    ),
    code(
      js(`
// services/tasks.service.js
export async function getForUser(id, user) {
  const task = await repo.findById(id);
  if (!task) throw new NotFoundError('Task');

  const owns = task.userId === user.id;
  if (!owns && !can(user, 'task:read:any')) throw new NotFoundError('Task');

  return task;
}

export async function updateForUser(id, user, patch) {
  const task = await getForUser(id, user);          // reuse the read check
  const owns = task.userId === user.id;
  if (!owns && !can(user, 'task:update:any')) throw new ForbiddenError();
  return repo.update(id, patch);
}
`),
    ),
    code(
      js(`
// Stronger still: make the query itself owner-scoped, so there is no branch
// to forget. The repository simply cannot return someone else's row.
export async function findForUser(id, userId) {
  const { rows } = await pool.query(
    'select * from tasks where id = $1 and user_id = $2',
    [id, userId],
  );
  return rows[0] ? toTask(rows[0]) : null;
}
`),
    ),
    tip(
      'If you only take one thing from this section: **do not expose an unscoped `findById` from a repository that holds per-user data.** A method that cannot return the wrong row is better than a check that can be omitted.',
    ),

    h('Lists leak too'),
    code(
      js(`
// The ownership check people remember is on GET /tasks/:id.
// The one they forget is here.
select * from tasks order by created_at desc limit 20;              // everyone's

select * from tasks where user_id = $1 order by created_at desc;    // theirs
`),
    ),
    warn(
      'Every collection endpoint needs the same scoping as every member endpoint. A `/tasks` that lists all tasks is the same vulnerability as an unprotected `/tasks/:id`, just faster to exploit — one request returns everything instead of one row at a time.',
    ),

    h('Mass assignment, again'),
    code(
      js(`
// If role is a column and the update takes req.body, a user promotes themselves.
PATCH /users/me   { "name": "x", "role": "admin" }

// The schema is the fix — and it must be per-operation.
const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  bio: z.string().max(500).optional(),
}).strict();

const adminUpdateUserSchema = updateProfileSchema.extend({
  role: z.enum(['user', 'manager', 'admin']),
}).strict();
`),
    ),
    p(
      'Two schemas, two routes, and the privilege-changing field only exists on the one behind `require_("user:update:role")`.',
    ),

    h('Testing it'),
    code(
      js(`
// Write the negative tests. They are the ones that catch a regression.
test('cannot read another user\\'s task', async () => {
  const res = await request(app)
    .get(\`/v1/tasks/\${otherUsersTaskId}\`)
    .set('Authorization', \`Bearer \${aliceToken}\`);
  expect(res.status).toBe(404);
});

test('cannot promote self', async () => {
  const res = await request(app)
    .patch('/v1/users/me')
    .set('Authorization', \`Bearer \${aliceToken}\`)
    .send({ role: 'admin' });
  expect(res.status).toBe(422);
  expect((await repo.findUser(alice.id)).role).toBe('user');
});
`),
    ),
    note(
      'A test per endpoint that a non-owner is refused is tedious to write and the highest-value security testing you can do — because access control is not something a scanner or a type system can check for you.',
    ),

    h('Beyond RBAC'),
    table(
      ['Model', 'Decides by', 'Use when'],
      [
        ['**RBAC**', 'The user\'s role', 'Most applications. Start here'],
        ['**ABAC**', 'Attributes — department, time, resource state', 'Rules like "a manager in the same team, during business hours"'],
        ['**ReBAC**', 'The relationship between user and resource', 'Sharing graphs — Google Docs, GitHub repos'],
        ['Policy engines — OPA, Cedar, OpenFGA', 'A declarative policy file', 'Many services needing one consistent policy'],
      ],
    ),
    tip(
      'Do not start with a policy engine. RBAC plus explicit ownership checks in the service covers a large majority of applications, and adds no infrastructure. Move up only when the rules genuinely stop fitting.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Check a role', '`requireRole("admin")` middleware'],
      ['Check a capability', '`require_("task:delete:any")` — better than a role'],
      ['Check ownership', 'In the service, or scope the SQL by `user_id`'],
      ['Avoid IDOR structurally', 'No unscoped `findById` on per-user data'],
      ['Scope a list endpoint', '`where user_id = $1` — always'],
      ['Stop self-promotion', 'A per-operation `.strict()` schema without the role field'],
      ['Hide a resource\'s existence', '`404` instead of `403`, consistently'],
      ['Keep it correct', 'A negative test per endpoint'],
    ]),

    h('Interview'),
    asked([
      ['How do you implement RBAC in Express?', 'Roles on the user, a middleware checking the required permission, and ownership checks in the service.'],
      ['Why check permissions rather than roles?', 'Adding a role becomes a data change instead of an edit to every route.'],
      ['Why can ownership not be middleware?', 'It depends on the loaded resource, which middleware has not fetched.'],
      ['How do you stop a user reading another user\'s record?', 'Scope the query by owner so the repository cannot return it.'],
      ['How do you stop a user promoting themselves?', 'A strict per-operation schema that has no `role` field for that route.'],
      ['What do people forget when securing a list endpoint?', 'To scope it — `/tasks` without a `where user_id` leaks everything at once.'],
    ]),

    links(
      link('OWASP — Access Control Cheat Sheet', 'https://cheatsheetseries.owasp.org/cheatsheets/Access_Control_Cheat_Sheet.html'),
      link('OWASP API Top 10 — Broken Object Level Authorization', 'https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/'),
      link('OpenFGA — relationship-based access control', 'https://openfga.dev/docs/authorization-concepts'),
    ),
  ],
};
