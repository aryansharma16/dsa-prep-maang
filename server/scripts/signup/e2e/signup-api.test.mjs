// End-to-end checks for the signup approval flow, against a throwaway in-memory MongoDB.
//
// Never touches the database in server/.env: the env is set before the app is imported,
// and it is run from this folder, which has no .env for dotenv to find.
// mongodb-memory-server is deliberately not a dependency; install it without saving:
//
//   cd server && npm i --no-save mongodb-memory-server@10
//   cd server/scripts/signup/e2e && node --test signup-api.test.mjs
//
// Nothing is ever sent from here: under NODE_ENV=test `mail.service.js` puts each
// message in an in-memory `outbox` instead, and the reset tests below read the
// link out of it the way a person would read it out of their inbox.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

const SERVER = new URL('../../../src', import.meta.url).pathname;

let replSet;
let server;
let base;
let mongoose;
let outbox;

before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  Object.assign(process.env, {
    NODE_ENV: 'test',
    MONGO_URI: replSet.getUri('signup-test'),
    JWT_ACCESS_SECRET: 'test-access-secret-test-access-secret',
    JWT_REFRESH_SECRET: 'test-refresh-secret-test-refresh-secret',
    CLIENT_URL: 'http://localhost:3003',
    SUPER_ADMIN_EMAIL: 'owner@test.local',
    // The limiter allows 5 registrations an hour per address; this file files more.
    RATE_LIMIT_DISABLED: 'true',
  });
  ({ default: mongoose } = await import(`${SERVER}/../node_modules/mongoose/index.js`));
  const { connectDb } = await import(`${SERVER}/config/db.js`);
  const { createApp } = await import(`${SERVER}/app.js`);
  ({ outbox } = await import(`${SERVER}/services/mail.service.js`));
  await connectDb();
  await new Promise((resolve) => {
    server = createApp().listen(0, resolve);
  });
  base = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  server?.close();
  await mongoose?.disconnect();
  await replSet?.stop();
});

/* ------------------------------------------------------------ helpers */

function client() {
  let cookie = '';
  const call = async (method, path, body, headers = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const set = res.headers.getSetCookie?.() || [];
    if (set.length) cookie = set.map((c) => c.split(';')[0]).join('; ');
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text;
    }
    return { status: res.status, body: json };
  };
  return {
    get: (p) => call('GET', p),
    post: (p, b) => call('POST', p, b ?? {}),
    del: (p) => call('DELETE', p),
  };
}

const applicant = (over = {}) => ({
  name: 'Asha Rao',
  email: 'asha@example.com',
  mobile: '+91 98765 43210',
  password: 'correct-horse-battery',
  reason: 'Preparing for backend loops',
  ...over,
});

const owner = client();
const stranger = client();

/* ------------------------------------------------------------ tests */

test('the pinned super admin registers outright — there is nobody to approve them', async () => {
  const res = await owner.post('/auth/register', applicant({ email: 'owner@test.local', name: 'Owner' }));

  assert.equal(res.status, 201);
  assert.equal(res.body.user.email, 'owner@test.local');
  assert.equal(res.body.user.role, 'super_admin');

  // And they are signed in: the session cookie came back with that response.
  const me = await owner.get('/auth/me');
  assert.equal(me.status, 200);
  assert.equal(me.body.user.email, 'owner@test.local');
});

test('anyone else gets a queued request and no session', async () => {
  const res = await stranger.post('/auth/register', applicant());

  assert.equal(res.status, 202);
  assert.equal(res.body.pending, true);
  assert.equal(res.body.email, 'asha@example.com');
  assert.ok(!res.body.user, 'a queued request must not carry a user');

  // No cookies were set, so this client is still anonymous.
  const me = await stranger.get('/auth/me');
  assert.equal(me.status, 401);

  // And no account exists yet — the whole point.
  const login = await client().post('/auth/login', {
    email: 'asha@example.com',
    password: 'correct-horse-battery',
  });
  assert.equal(login.status, 401);
});

test('the request carries the device it came from, and never the password', async () => {
  const res = await owner.get('/admin/signups?status=pending');
  assert.equal(res.status, 200);

  const row = res.body.requests.find((r) => r.email === 'asha@example.com');
  assert.ok(row, 'the request should be in the queue');
  assert.equal(row.mobile, '+91 98765 43210');
  assert.equal(row.reason, 'Preparing for backend loops');
  assert.equal(row.status, 'pending');
  assert.ok(row.context.ip, 'the address it came from is recorded');
  // node's fetch sends no user agent, so the parse is empty — which is the
  // point of it being optional. The IP is what must always be there.
  assert.equal(
    JSON.stringify(row).includes('passwordHash'),
    false,
    'the hash must never reach the panel',
  );
});

test('one pending request per address', async () => {
  const again = await client().post('/auth/register', applicant({ name: 'Asha again' }));
  assert.equal(again.status, 409);
  assert.equal(again.body.error.code, 'REQUEST_PENDING');
});

test('a learner cannot see the queue, let alone decide on it', async () => {
  // Approve one applicant so there is an ordinary account to try this with.
  const outsider = client();
  await outsider.post('/auth/register', applicant({ email: 'plain@example.com', name: 'Plain' }));

  const queue = await owner.get('/admin/signups?status=pending');
  const row = queue.body.requests.find((r) => r.email === 'plain@example.com');
  await owner.post(`/admin/signups/${row._id}/approve`);

  const learner = client();
  const login = await learner.post('/auth/login', {
    email: 'plain@example.com',
    password: 'correct-horse-battery',
  });
  assert.equal(login.status, 200);
  assert.equal(login.body.user.role, 'user');

  assert.equal((await learner.get('/admin/signups')).status, 403);
  assert.equal((await learner.post(`/admin/signups/${row._id}/reject`, { note: '' })).status, 403);
});

test('approving creates the account, with the password they chose', async () => {
  const queue = await owner.get('/admin/signups?status=pending');
  const row = queue.body.requests.find((r) => r.email === 'asha@example.com');

  const res = await owner.post(`/admin/signups/${row._id}/approve`);
  assert.equal(res.status, 200);
  assert.equal(res.body.request.status, 'approved');
  assert.equal(res.body.user.email, 'asha@example.com');

  // The password from the request form is the one that now signs in.
  const asha = client();
  const login = await asha.post('/auth/login', {
    email: 'asha@example.com',
    password: 'correct-horse-battery',
  });
  assert.equal(login.status, 200);
  assert.equal(login.body.user.name, 'Asha Rao');
  assert.equal(login.body.user.role, 'user');
});

test('a decided request cannot be decided again', async () => {
  const queue = await owner.get('/admin/signups?status=approved');
  const row = queue.body.requests.find((r) => r.email === 'asha@example.com');

  const res = await owner.post(`/admin/signups/${row._id}/approve`);
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'ALREADY_DECIDED');
});

test('declining refuses the account and lets the address apply again', async () => {
  const applied = await client().post('/auth/register', applicant({ email: 'nope@example.com', name: 'Nope' }));
  assert.equal(applied.status, 202);

  const queue = await owner.get('/admin/signups?status=pending');
  const row = queue.body.requests.find((r) => r.email === 'nope@example.com');

  const res = await owner.post(`/admin/signups/${row._id}/reject`, { note: 'Not right now.' });
  assert.equal(res.status, 200);
  assert.equal(res.body.request.status, 'rejected');
  assert.equal(res.body.request.note, 'Not right now.');

  // No account was made.
  const login = await client().post('/auth/login', {
    email: 'nope@example.com',
    password: 'correct-horse-battery',
  });
  assert.equal(login.status, 401);

  // The partial unique index is on *pending* rows, so they can try again.
  const retry = await client().post('/auth/register', applicant({ email: 'nope@example.com', name: 'Nope' }));
  assert.equal(retry.status, 202);
});

test('an address that already has an account is turned away at the form', async () => {
  const res = await client().post('/auth/register', applicant({ email: 'asha@example.com' }));
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'EMAIL_TAKEN');
});

test('the five fields are the five fields', async () => {
  const missing = await client().post('/auth/register', {
    name: 'No Number',
    email: 'nonumber@example.com',
    password: 'correct-horse-battery',
  });
  assert.equal(missing.status, 400);

  const badNumber = await client().post('/auth/register', applicant({
    email: 'bad@example.com',
    mobile: 'call me maybe',
  }));
  assert.equal(badNumber.status, 400);
});

test('both decisions are in the audit log, naming who made them', async () => {
  const res = await owner.get('/admin/audit?action=signup.approve');
  assert.equal(res.status, 200);

  const row = res.body.entries.find((e) => e.targetLabel === 'asha@example.com');
  assert.ok(row, 'approving should be audited');
  assert.equal(row.actorEmail, 'owner@test.local');
  assert.equal(row.targetType, 'signup');

  const declined = await owner.get('/admin/audit?action=signup.reject');
  assert.ok(
    declined.body.entries.some((e) => e.targetLabel === 'nope@example.com'),
    'declining should be audited too',
  );
});

/* ------------------------------------------------------------ mail */

const lastMailTo = (to) => [...outbox].reverse().find((m) => m.to === to);

test('each step of the flow emails the right person, in the themed layout', async () => {
  const received = outbox.find((m) => m.to === 'asha@example.com' && /got your request/i.test(m.subject));
  assert.ok(received, 'the applicant hears their request is in');

  const toOwner = outbox.find((m) => m.to === 'owner@test.local' && /requested access/.test(m.subject));
  assert.ok(toOwner, 'the super admin hears somebody wants in');
  assert.match(toOwner.html, /\/admin\/signups/);

  const approved = lastMailTo('asha@example.com');
  assert.match(approved.subject, /approved/i);
  // The account has no readable password to send, and must not pretend to.
  assert.doesNotMatch(approved.text, /correct-horse-battery/);
  assert.match(approved.html, /\/forgot-password\?email=asha%40example\.com/);

  const declined = lastMailTo('nope@example.com');
  assert.ok(outbox.some((m) => m.to === 'nope@example.com' && /Not right now\./.test(m.text)), 'the note reaches the applicant');
  assert.ok(declined);
});

test('a name typed into the form cannot inject markup into the owner\'s email', async () => {
  await client().post('/auth/register', applicant({
    email: 'xss@example.com',
    name: '<img src=x onerror=alert(1)>',
    reason: '<script>alert(1)</script>',
  }));
  const mail = lastMailTo('owner@test.local');
  assert.doesNotMatch(mail.html, /<img src=x/);
  assert.doesNotMatch(mail.html, /<script>/);
});

/* ------------------------------------------------------------ password reset */

const tokenFrom = (mail) => new URL(mail.text.match(/https?:\/\/\S*reset-password\?token=\S+/)[0]).searchParams.get('token');

test('forgot-password answers the same sentence for an unknown address, and sends nothing', async () => {
  const before = outbox.length;
  const unknown = await client().post('/auth/forgot-password', { email: 'nobody@example.com' });
  const known = await client().post('/auth/forgot-password', { email: 'Asha@Example.com' });

  assert.equal(unknown.status, 200);
  assert.equal(known.status, 200);
  assert.equal(unknown.body.message, known.body.message, 'the response must not reveal who has an account');

  const sent = outbox.slice(before);
  assert.equal(sent.length, 1, 'only the real account gets a link');
  assert.equal(sent[0].to, 'asha@example.com');
});

test('a reset link sets a new password, works once, and signs out every session', async () => {
  // Asha is signed in somewhere before the reset.
  const oldSession = client();
  assert.equal((await oldSession.post('/auth/login', { email: 'asha@example.com', password: 'correct-horse-battery' })).status, 200);

  const token = tokenFrom(lastMailTo('asha@example.com'));
  assert.ok(token && token.length >= 40, 'the email carries a long random token');

  const reset = await client().post('/auth/reset-password', { token, password: 'a-brand-new-password' });
  assert.equal(reset.status, 200);

  // The receipt goes to the account's own address.
  assert.match(lastMailTo('asha@example.com').subject, /password was changed/i);

  // Old password is gone, new one works.
  assert.equal((await client().post('/auth/login', { email: 'asha@example.com', password: 'correct-horse-battery' })).status, 401);
  assert.equal((await client().post('/auth/login', { email: 'asha@example.com', password: 'a-brand-new-password' })).status, 200);

  // The session from before the reset can no longer be refreshed.
  assert.equal((await oldSession.post('/auth/refresh')).status, 401);

  // And the link is spent.
  const again = await client().post('/auth/reset-password', { token, password: 'yet-another-password' });
  assert.equal(again.status, 400);
  assert.equal(again.body.error.code, 'RESET_INVALID');
});

test('the database never holds a usable token', async () => {
  // Wait out the one-a-minute resend guard by clearing Asha's previous link row.
  const { PasswordReset } = await import(`${SERVER}/models/PasswordReset.js`);
  await PasswordReset.deleteMany({});

  await client().post('/auth/forgot-password', { email: 'plain@example.com' });
  const token = tokenFrom(lastMailTo('plain@example.com'));
  const rows = await PasswordReset.find({}).lean();

  assert.equal(rows.length, 1);
  assert.notEqual(rows[0].tokenHash, token, 'only a hash of the token is stored');
  assert.equal(JSON.stringify(rows[0]).includes(token), false);
});

test('only the newest link works, and asking again within a minute sends nothing', async () => {
  const before = outbox.length;
  await client().post('/auth/forgot-password', { email: 'plain@example.com' });
  assert.equal(outbox.length, before, 'a second request inside a minute is not emailed');

  const { PasswordReset } = await import(`${SERVER}/models/PasswordReset.js`);
  const firstToken = tokenFrom(lastMailTo('plain@example.com'));
  // Age the existing link past the resend guard, then ask again. Through the raw
  // driver: Mongoose's timestamps make `createdAt` immutable and drop the update.
  await PasswordReset.collection.updateMany({}, { $set: { createdAt: new Date(Date.now() - 5 * 60 * 1000) } });
  await client().post('/auth/forgot-password', { email: 'plain@example.com' });
  const secondToken = tokenFrom(lastMailTo('plain@example.com'));
  assert.notEqual(firstToken, secondToken);

  const stale = await client().post('/auth/reset-password', { token: firstToken, password: 'should-not-work' });
  assert.equal(stale.status, 400, 'the older link stopped working when a newer one was sent');

  const fresh = await client().post('/auth/reset-password', { token: secondToken, password: 'plain-new-password' });
  assert.equal(fresh.status, 200);
});

test('an expired link is refused even before Mongo reaps it', async () => {
  const { PasswordReset } = await import(`${SERVER}/models/PasswordReset.js`);
  await PasswordReset.deleteMany({});
  await client().post('/auth/forgot-password', { email: 'plain@example.com' });
  const token = tokenFrom(lastMailTo('plain@example.com'));

  await PasswordReset.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  const res = await client().post('/auth/reset-password', { token, password: 'too-late-password' });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'RESET_INVALID');
});
