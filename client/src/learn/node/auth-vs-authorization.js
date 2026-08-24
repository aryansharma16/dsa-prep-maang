import { asked, cheat, code, h, js, link, links, note, p, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Two questions, asked in order, answered by different code. **Authentication**: who is calling? **Authorization**: is this caller allowed to do this? Merging them is how an API ends up with a login that works perfectly and a `/tasks/7` that shows you someone else\'s task.',
    ),

    h('The distinction'),
    table(
      ['', 'Authentication', 'Authorization'],
      [
        ['Asks', 'Who are you?', 'May you do this?'],
        ['Proof', 'A password, a token, a cookie', 'A role, a permission, ownership of the row'],
        ['Runs', 'Once per request, early', 'Per resource, in the service'],
        ['Fails with', '`401 Unauthorized`', '`403 Forbidden`'],
        ['Fix by', 'Logging in again', 'Nothing the caller can do'],
        ['Also called', 'AuthN', 'AuthZ'],
      ],
    ),
    note(
      'HTTP\'s own naming is unhelpful: `401 Unauthorized` is the *authentication* failure. Read it as "unauthenticated" and the pair stops being confusing.',
    ),

    h('In one request'),
    code(
      js(`
router.delete('/tasks/:id',
  requireAuth,                    // 1. AuthN — who is this? -> 401 if unknown
  requireRole('admin', 'user'),   // 2. AuthZ, coarse — role -> 403
  asyncHandler(async (req, res) => {
    // 3. AuthZ, fine — does this caller own THIS row? -> 403 or 404
    await service.deleteForUser(req.params.id, req.user);
    res.status(204).end();
  }),
);
`),
    ),
    p(
      'Three separate checks, and the third is the one that gets forgotten. A valid token and the right role still do not mean the row belongs to you.',
    ),

    h('Authentication middleware'),
    code(
      js(`
// middleware/auth.js
export const requireAuth = asyncHandler(async (req, res, next) => {
  const header = req.get('Authorization') ?? '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) throw new UnauthorizedError();

  let payload;
  try {
    payload = jwt.verify(token, config.jwt.secret);
  } catch {
    throw new UnauthorizedError();      // expired, tampered, wrong key — all 401
  }

  req.user = { id: payload.sub, role: payload.role };
  next();
});

// Optional auth: identify if possible, but do not require it.
export const optionalAuth = asyncHandler(async (req, res, next) => {
  try { await requireAuth(req, res, () => {}); } catch { /* anonymous */ }
  next();
});
`),
    ),
    warn(
      'Never distinguish "no such user" from "wrong password" in the response, and never distinguish an expired token from a forged one. Both distinctions are free information for an attacker: the first confirms which emails are registered, the second helps them probe your signing.',
    ),

    h('Where each check belongs'),
    code(
      js(`
// Middleware: authentication, and coarse role checks that are true for the
// whole route regardless of which row is involved.
router.use(requireAuth);
router.delete('/:id', requireRole('admin'), controller.remove);

// Service: ownership, and any rule that depends on the resource itself.
export async function deleteForUser(id, user) {
  const task = await repo.findById(id);
  if (!task) throw new NotFoundError('Task');
  if (task.userId !== user.id && user.role !== 'admin') throw new ForbiddenError();
  await repo.remove(id);
}
`),
    ),
    tip(
      'Ownership belongs in the service, not the controller. A controller check has to be repeated at every endpoint touching that resource, and the twelfth endpoint is the one that forgets. In the service it is written once and cannot be routed around — including by a queue worker or a CLI script.',
    ),

    h('IDOR'),
    p(
      'Insecure Direct Object Reference: the endpoint authenticates you correctly, then serves whichever id you asked for. It is consistently among the most common real API vulnerabilities, and it is one missing line.',
    ),
    code(
      js(`
// Vulnerable. Anyone logged in can read every task by changing the id.
router.get('/tasks/:id', requireAuth, async (req, res) => {
  res.json(await repo.findById(req.params.id));
});

// Fixed in the service.
const task = await repo.findById(id);
if (!task) throw new NotFoundError('Task');
if (task.userId !== user.id) throw new NotFoundError('Task');   // 404, not 403

// Or fixed in the query, which cannot be forgotten at all.
select * from tasks where id = $1 and user_id = $2
`),
    ),
    tip(
      'Scoping the **query** by owner is stronger than checking after the fetch, because there is no branch to omit. Make `findForUser(id, userId)` the only read method the repository exposes and the vulnerability becomes hard to write.',
    ),
    note(
      'Returning `404` rather than `403` for someone else\'s resource avoids confirming that it exists. Pick one convention for the whole API — inconsistency is itself the leak, since `403` on one endpoint and `404` on another tells the attacker which ids are real.',
    ),

    h('401 or 403'),
    code(
      js(`
// No Authorization header               -> 401
// Malformed or expired token            -> 401
// Valid token, endpoint needs admin     -> 403
// Valid token, admin, row belongs to
//   someone else                        -> 403, or 404 to hide it
// Valid token, account suspended        -> 403
`),
    ),
    code(
      js(`
// A 401 should say how to authenticate.
res.status(401)
  .set('WWW-Authenticate', 'Bearer realm="api"')
  .json({ error: { message: 'Not authenticated', code: 'unauthenticated' } });
`),
    ),

    h('Beyond users'),
    table(
      ['Caller', 'Authenticate with', 'Notes'],
      [
        ['A person in a browser', 'Session cookie or JWT', 'The rest of this section'],
        ['A person in a mobile app', 'JWT with a refresh token', 'No cookie jar to rely on'],
        ['Another service', 'mTLS, or a signed service token', 'Short-lived, scoped, rotated'],
        ['A third-party script', 'An API key', 'Hash it at rest, scope it, allow revocation'],
        ['A webhook sender', 'An HMAC signature over the raw body', '`timingSafeEqual`, plus a timestamp to stop replays'],
      ],
    ),

    h('Cheatsheet'),
    cheat([
      ['Identify the caller', '`requireAuth` middleware, once, early'],
      ['Check a role', '`requireRole("admin")` on the route'],
      ['Check ownership', 'In the service — or scope the SQL by `user_id`'],
      ['Not authenticated', '`401` + `WWW-Authenticate`'],
      ['Authenticated but not allowed', '`403`'],
      ['Hide that a resource exists', '`404`, consistently'],
      ['Avoid IDOR', 'Never expose a repository read that is not owner-scoped'],
      ['Login failure message', 'One generic message for every cause'],
    ]),

    h('Interview'),
    asked([
      ['Authentication vs authorization?', 'Who you are versus what you may do — `401` and `403` respectively.'],
      ['Why is `401` named "Unauthorized"?', 'A historical misnomer; it is the authentication failure. `403` is the authorization one.'],
      ['What is IDOR?', 'Serving a resource by id without checking the caller owns it — authentication passes, authorization was never done.'],
      ['Where does the ownership check belong?', 'The service, or better, the query — so no endpoint can omit it.'],
      ['`403` or `404` for someone else\'s row?', '`404` avoids confirming it exists; either is fine if applied consistently.'],
      ['Why the same message for a bad email and a bad password?', 'Distinguishing them tells an attacker which accounts exist.'],
    ]),

    links(
      link('OWASP — Broken Access Control', 'https://owasp.org/Top10/A01_2021-Broken_Access_Control/'),
      link('OWASP — Authorization Cheat Sheet', 'https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html'),
      link('MDN — HTTP authentication', 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Authentication'),
    ),
  ],
};
