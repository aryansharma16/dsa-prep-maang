import { asked, cheat, code, h, js, link, links, note, p, sh, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'You never store a password. You store the output of a deliberately slow one-way function, and at login you run the same function on what was typed and compare. Everything else in this topic follows from "deliberately slow" — which is the exact opposite of what a hash is normally for.',
    ),

    h('Why not SHA-256'),
    table(
      ['', 'SHA-256', 'bcrypt / argon2'],
      [
        ['Designed to be', 'Fast', '**Slow, and tunably slower**'],
        ['Rate on a GPU', 'Billions per second', 'Thousands per second'],
        ['Salted', 'You must do it yourself', 'Built in, per password'],
        ['Cost adjustable', 'No', 'Yes — raise it as hardware improves'],
        ['Right for passwords', '**No**', 'Yes'],
      ],
    ),
    p(
      'A leaked SHA-256 table of 10 million passwords is cracked in hours, because a GPU can try every common password against every row. The same table hashed with bcrypt at cost 12 takes an infeasible amount of time — the slowness *is* the security property.',
    ),
    warn(
      '`crypto.createHash("sha256")` is right for file checksums, ETags and cache keys, and wrong for passwords. Using it for passwords is one of the most common serious mistakes in a Node codebase.',
    ),

    h('Hashing'),
    code(
      sh(`
npm install bcrypt
# or, preferred for new projects:
npm install argon2
`),
    ),
    code(
      js(`
import bcrypt from 'bcrypt';

const COST = 12;      // ~250ms on a modern server. Measure yours.

const hash = await bcrypt.hash(plainPassword, COST);
// $2b$12$LQv3c1yqBWVHxkd0LHAkCO...   <- algorithm, cost and salt, all inline

const ok = await bcrypt.compare(plainPassword, hash);   // true / false
`),
    ),
    code(
      js(`
import argon2 from 'argon2';

const hash = await argon2.hash(plainPassword);          // sane defaults
const ok = await argon2.verify(hash, plainPassword);    // note the order
`),
    ),
    note(
      'The salt is inside the hash string, along with the algorithm and the cost. That is why there is no separate salt column and why `compare` needs nothing but the two values — it reads the parameters back out of the stored hash.',
    ),
    tip(
      'Tune the cost so hashing takes 200–300 ms on your production hardware. Faster and you are cheap to attack; much slower and a login flood becomes a denial of service against yourself, because those hashes run on the libuv thread pool.',
    ),
    warn(
      'Use the **async** functions. `bcrypt.hashSync` blocks the event loop for the full 250 ms, stalling every other request. And remember the pool is four threads by default — the fifth concurrent login queues, so `UV_THREADPOOL_SIZE` matters on a login-heavy service.',
    ),
    warn(
      'bcrypt silently truncates input at 72 bytes. A password longer than that has its tail ignored, and a very long one is wasted work. Cap the input length in your schema — `z.string().min(8).max(72)` — or pre-hash with SHA-256 before bcrypt if you must accept more.',
    ),

    h('Registration'),
    code(
      js(`
// services/auth.service.js
export async function register({ email, password }) {
  const normalised = email.trim().toLowerCase();

  const hash = await bcrypt.hash(password, COST);

  try {
    return await repo.insertUser({ email: normalised, passwordHash: hash });
  } catch (err) {
    // Let the UNIQUE index decide. Checking first is a race and an oracle.
    if (err.code === '23505') throw new ConflictError('Could not register');
    throw err;
  }
}
`),
    ),
    p('Three deliberate choices in there:'),
    table(
      ['Choice', 'Why'],
      [
        ['Lowercase the email', 'Users do not remember capitalisation. Store one canonical form, with a `unique` index on it'],
        ['Insert and catch `23505`', 'A `select` then `insert` is a race — two simultaneous signups both pass the check'],
        ['A vague conflict message', '"Email already registered" is an account-enumeration oracle'],
      ],
    ),
    tip(
      'If the product needs to tell users their email is taken, do it by **email** — send "someone tried to register with your address" to the owner — not in the HTTP response. The person who owns the address learns something; a stranger probing addresses does not.',
    ),

    h('Login'),
    code(
      js(`
export async function login({ email, password }) {
  const user = await repo.findByEmail(email.trim().toLowerCase());

  // Hash even when there is no user, so the response time does not reveal
  // whether the account exists.
  const hash = user?.passwordHash ?? DUMMY_HASH;
  const ok = await bcrypt.compare(password, hash);

  if (!user || !ok) throw new UnauthorizedError('Invalid email or password');
  if (user.suspendedAt) throw new ForbiddenError('Account suspended');

  return issueTokens(user);
}

// A real bcrypt hash of a random string, generated once at startup.
const DUMMY_HASH = await bcrypt.hash(crypto.randomUUID(), COST);
`),
    ),
    warn(
      'Returning early when the user does not exist creates a **timing oracle**: a missing account answers in 2 ms and an existing one in 250 ms, so an attacker can enumerate your entire user list without ever guessing a password. Hashing against a dummy costs you nothing and closes it.',
    ),

    h('Rate limiting'),
    code(
      js(`
import rateLimit from 'express-rate-limit';

// Per IP — the blunt instrument.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  skipSuccessfulRequests: true,
});

router.post('/login', loginLimiter, controller.login);
`),
    ),
    code(
      js(`
// Per account — what actually stops credential stuffing, since an attacker
// rotates IPs but not the target email.
export async function checkAttempts(email) {
  const key = \`login:fail:\${email}\`;
  const fails = Number(await redis.get(key)) ?? 0;
  if (fails >= 10) throw new AppError('Too many attempts. Try again later.', 429);
}

export async function recordFailure(email) {
  const key = \`login:fail:\${email}\`;
  await redis.incr(key);
  await redis.expire(key, 900);
}
`),
    ),
    tip(
      'Limit on both axes. Per-IP stops a single machine brute-forcing one account; per-account stops a botnet trying one common password against every account — which is the attack that actually succeeds, because your users reuse passwords from other breaches.',
    ),

    h('Password reset'),
    code(
      js(`
// 1. Request. Always answer 200, whether or not the account exists.
export async function requestReset(email) {
  const user = await repo.findByEmail(email.trim().toLowerCase());
  if (!user) return;                       // silently, on purpose

  const token = crypto.randomBytes(32).toString('base64url');   // 256 bits
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  await repo.insertResetToken({
    userId: user.id,
    tokenHash,                             // store the HASH, never the token
    expiresAt: new Date(Date.now() + 30 * 60_000),   // 30 minutes
  });

  await queue.add('send-reset-email', { email: user.email, token });
}
`),
    ),
    code(
      js(`
// 2. Consume. Single use, and everything else is invalidated.
export async function resetPassword({ token, newPassword }) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  return withTransaction(async (client) => {
    const row = await repo.claimResetToken(client, tokenHash);   // deletes it
    if (!row || row.expiresAt < new Date()) {
      throw new AppError('Invalid or expired reset link', 400);
    }

    const hash = await bcrypt.hash(newPassword, COST);
    await repo.updatePassword(client, row.userId, hash);
    await repo.revokeAllRefreshTokens(client, row.userId);   // log every session out
    await repo.deleteOtherResetTokens(client, row.userId);
  });
}
`),
    ),
    table(
      ['Rule', 'Why'],
      [
        ['A cryptographically random token', '`Math.random()` is predictable and this is a password'],
        ['Store only its hash', 'A leaked database then cannot be used to reset accounts'],
        ['Short expiry — 15 to 60 minutes', 'Limits the window if an email account is compromised later'],
        ['Single use — delete on claim', 'A token in browser history or a proxy log cannot be replayed'],
        ['Revoke all sessions on success', 'If an attacker had a session, the reset must end it'],
        ['Always answer `200` to the request', 'Otherwise the endpoint enumerates accounts'],
        ['Notify the old address on change', 'The owner finds out even if they did not do it'],
      ],
    ),
    warn(
      'A reset token is a password with a short lifetime. Storing it in plaintext means a database leak hands the attacker every account — including admin ones — without a single hash to crack.',
    ),

    h('Email verification'),
    code(
      js(`
// The same shape: random token, store the hash, expire it, single use.
// Longer expiry is fine — 24 hours — because the consequence of a leak is
// smaller than for a reset token.
const token = crypto.randomBytes(32).toString('base64url');
await repo.insertVerification({ userId, tokenHash: sha256(token), expiresAt: in24h });
`),
    ),

    h('Policy'),
    code(
      js(`
export const passwordSchema = z.string()
  .min(8, 'at least 8 characters')
  .max(72, 'at most 72 characters');
`),
    ),
    p(
      'That is close to current NIST guidance: **length over composition**. Mandatory symbols and forced 90-day rotation both push users towards `Password1!` and `Password2!`, which is worse. What is worth adding instead is a check against known-breached passwords — the Have I Been Pwned range API lets you do it without sending the password anywhere.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Hash a password', '`bcrypt.hash(pw, 12)` or `argon2.hash(pw)` — async'],
      ['Verify one', '`bcrypt.compare(pw, hash)`'],
      ['Never use', '`createHash("sha256")`, or any `*Sync` variant'],
      ['Cap the input', '`max(72)` — bcrypt truncates'],
      ['Handle a duplicate email', 'Catch `23505`; do not `select` first'],
      ['Avoid a timing oracle', 'Hash against a dummy when the user is absent'],
      ['Generate a reset token', '`crypto.randomBytes(32).toString("base64url")`'],
      ['Store a reset token', 'Its SHA-256, never the token'],
      ['On a successful reset', 'Revoke every session and every other token'],
      ['Rate limit login', 'Per IP **and** per account'],
    ]),

    h('Interview'),
    asked([
      ['Why bcrypt rather than SHA-256?', 'bcrypt is deliberately slow and salted per password; SHA-256 is fast, which is what makes a leak crackable.'],
      ['What is a salt and where is it stored?', 'Random per-password data that defeats rainbow tables — bcrypt embeds it in the hash string.'],
      ['Why does the cost factor matter?', 'It sets how slow verification is, and can be raised as hardware gets faster.'],
      ['How do you avoid leaking whether an account exists?', 'One generic error, and hash against a dummy so the timing matches.'],
      ['Walk me through a secure password reset.', 'Random token, store only its hash, short expiry, single use, revoke all sessions, always answer 200 to the request.'],
      ['Why store the hash of a reset token?', 'A database leak would otherwise let the attacker reset every account.'],
      ['Should you force complex passwords and rotation?', 'No — current guidance favours length and breach checks; composition rules and rotation make passwords worse.'],
    ]),

    links(
      link('OWASP — Password Storage Cheat Sheet', 'https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html'),
      link('OWASP — Forgot Password Cheat Sheet', 'https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html'),
      link('NIST SP 800-63B — Authenticators', 'https://pages.nist.gov/800-63-3/sp800-63b.html'),
    ),
  ],
};
