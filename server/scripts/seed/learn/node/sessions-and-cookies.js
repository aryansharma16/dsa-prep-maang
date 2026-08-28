import { asked, cheat, code, h, js, link, links, note, p, sh, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'A session is the other half of the authentication choice. The client holds an opaque id in a cookie; the server holds everything that id means. It is older than JWTs, simpler than JWTs, and for a single web application it is usually the better answer.',
    ),

    h('How it works'),
    code(
      js(`
1. POST /login with correct credentials
2. Server creates a session:  sess:8f3a… -> { userId, role, createdAt }
3. Set-Cookie: sid=8f3a…; HttpOnly; Secure; SameSite=Lax
4. Every later request sends the cookie automatically
5. Server looks the id up, finds the user, or rejects
6. Logout deletes the row. The next request is anonymous — instantly.
`),
    ),
    p(
      'Step 6 is the whole argument. Revocation is a `DELETE`, and it takes effect on the very next request — where a JWT keeps working until it expires.',
    ),

    h('With express-session'),
    code(
      sh(`
npm install express-session connect-redis redis
`),
    ),
    code(
      js(`
import session from 'express-session';
import { RedisStore } from 'connect-redis';
import { createClient } from 'redis';

const redis = createClient({ url: config.redisUrl });
await redis.connect();

app.set('trust proxy', 1);          // required for 'secure' behind a proxy

app.use(session({
  store: new RedisStore({ client: redis, prefix: 'sess:' }),
  secret: config.sessionSecret,     // signs the cookie — 32+ random bytes
  name: 'sid',                      // not the default 'connect.sid'
  resave: false,                    // do not rewrite an unchanged session
  saveUninitialized: false,         // do not create one for anonymous visitors
  rolling: true,                    // extend the expiry on activity
  cookie: {
    httpOnly: true,
    secure: config.isProd,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
}));
`),
    ),
    table(
      ['Option', 'Why it is set that way'],
      [
        ['`store`', '**Never the default MemoryStore.** It leaks memory and dies with the process'],
        ['`saveUninitialized: false`', 'Otherwise every bot and health check creates a session row'],
        ['`resave: false`', 'Avoids a write per request and the race that comes with it'],
        ['`name`', 'The default advertises the framework you are running'],
        ['`rolling: true`', 'An active user is not logged out mid-task'],
      ],
    ),
    warn(
      'The default `MemoryStore` is development-only, and Express says so on startup. It stores sessions in the process, so every deploy logs everyone out and a second instance sees none of the first instance\'s sessions — the exact statefulness that breaks horizontal scaling.',
    ),

    h('Using it'),
    code(
      js(`
// Login
app.post('/login', asyncHandler(async (req, res) => {
  const user = await authService.login(req.body);

  // Regenerate BEFORE storing anything — see session fixation below.
  await new Promise((resolve, reject) =>
    req.session.regenerate(err => (err ? reject(err) : resolve())));

  req.session.userId = user.id;
  req.session.role = user.role;
  res.json({ user: toPublicUser(user) });
}));

// Authentication middleware
export const requireAuth = (req, res, next) => {
  if (!req.session?.userId) throw new UnauthorizedError();
  next();
};

// Logout
app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('sid').status(204).end();
  });
});
`),
    ),
    warn(
      '**Session fixation**: if you keep the same session id across login, an attacker who set that id in the victim\'s browser beforehand is now logged in as them. `regenerate()` issues a fresh id at the moment privileges change, which closes it. Do the same on any privilege escalation, not only login.',
    ),

    h('Rolling your own'),
    code(
      js(`
// It is about twenty lines, and worth understanding.
export async function createSession(res, user) {
  const id = crypto.randomBytes(32).toString('base64url');
  await redis.set(
    \`sess:\${id}\`,
    JSON.stringify({ userId: user.id, role: user.role, at: Date.now() }),
    { EX: 7 * 24 * 60 * 60 },        // Redis expires it for you
  );
  res.cookie('sid', id, {
    httpOnly: true, secure: true, sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, path: '/',
  });
}

export const loadSession = asyncHandler(async (req, res, next) => {
  const id = req.cookies?.sid;
  if (!id) return next();
  const raw = await redis.get(\`sess:\${id}\`);
  if (raw) req.session = JSON.parse(raw);
  next();
});
`),
    ),
    tip(
      'Redis is the natural store: `EX` gives you expiry for free, lookups are sub-millisecond, and sessions surviving an application deploy is exactly what you want. Postgres works too — you then need a job to delete expired rows.',
    ),

    h('The cookie flags, again'),
    code(
      js(`
{
  httpOnly: true,       // script cannot read it — the XSS defence
  secure: true,         // HTTPS only
  sameSite: 'lax',      // not sent on cross-site POSTs — the CSRF defence
  path: '/',
  maxAge: 604800000,
}
`),
    ),
    table(
      ['`SameSite`', 'Sent cross-site?', 'Notes'],
      [
        ['`Lax`', 'Only on top-level `GET` navigations', 'The sensible default; blocks cross-site `POST`'],
        ['`Strict`', 'Never', 'Following a link from an email leaves you logged out — often too strict'],
        ['`None`', 'Always', 'Requires `Secure`. Only for a genuinely cross-origin front end'],
      ],
    ),
    note(
      '`SameSite=Lax` is now the browser default, which removed most classic CSRF. It is not a complete defence — set it explicitly, and add CSRF tokens for state-changing routes if you must use `SameSite=None`. That is the `xss-and-csrf` topic.',
    ),

    h('Sessions or JWTs'),
    table(
      ['', 'Sessions', 'JWT'],
      [
        ['Revocation', '**Instant** — delete the row', 'Not until expiry'],
        ['Per-request cost', 'One Redis lookup (~0.5 ms)', 'A signature verification (~0.05 ms)'],
        ['Server state', 'A shared store required', 'None'],
        ['Payload size on the wire', '~40 bytes', '~500 bytes, on every request'],
        ['Cross-service verification', 'Everyone needs the store', 'Anyone with the public key'],
        ['Non-browser clients', 'Workable, but cookies are awkward', 'Natural'],
        ['Easy to get wrong', 'Less', 'More — algorithm pinning, storage, rotation'],
      ],
    ),
    tip(
      'For one web application with one database: **sessions**. The "stateless" advantage of a JWT is worth having only when nothing else in the request touches shared state — and if you are already querying Postgres, you are not stateless anyway.',
    ),

    h('Session data'),
    code(
      js(`
// Keep it small. The session is fetched on EVERY request.
req.session.userId = user.id;          // good
req.session.role = user.role;          // acceptable — but goes stale on change
req.session.cart = [ …200 items… ];    // bad — put it in a table
req.session.user = fullUserRecord;     // bad — stale the moment they edit it
`),
    ),
    warn(
      'Anything copied into the session is a cache, with the usual invalidation problem. A role stored at login stays stale until the next login — so either re-read it per request, or bump a `sessionVersion` on the user and reject sessions that do not match.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Store sessions', 'Redis via `connect-redis` — never MemoryStore'],
      ['Prevent session fixation', '`req.session.regenerate()` at login'],
      ['Log one user out', '`req.session.destroy()`'],
      ['Log a user out everywhere', 'Delete every `sess:*` for that user id'],
      ['Set the cookie', '`httpOnly`, `secure`, `sameSite: "lax"`'],
      ['Behind a proxy', '`app.set("trust proxy", 1)`, or `secure` never applies'],
      ['Keep sessions small', 'An id and a role — nothing else'],
      ['Choose between the two', 'Sessions for one app; JWT for many services or mobile'],
    ]),

    h('Interview'),
    asked([
      ['Sessions or JWTs?', 'Sessions for a single application — instant revocation and simpler; JWTs when several services verify independently.'],
      ['How do you log out with a JWT?', 'You cannot immediately — short expiry plus a revocable refresh token, or a denylist.'],
      ['What is session fixation?', 'Reusing the pre-login session id, letting an attacker who planted it ride the authenticated session. Regenerate at login.'],
      ['Why not the default MemoryStore?', 'It leaks memory, dies with the process, and is not shared between instances.'],
      ['What does `SameSite=Lax` protect against?', 'CSRF — the cookie is not sent on cross-site state-changing requests.'],
      ['Why keep session data small?', 'It is read on every request, and any copied field goes stale.'],
    ]),

    links(
      link('OWASP — Session Management Cheat Sheet', 'https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html'),
      link('express-session', 'https://github.com/expressjs/session'),
      link('MDN — Set-Cookie', 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie'),
    ),
  ],
};
