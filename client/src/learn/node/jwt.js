import { asked, cheat, code, h, js, link, links, note, p, sh, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'A JSON Web Token is a signed, **not encrypted**, blob of JSON. The server can verify it was issued by them and has not been altered, without storing anything — which is the appeal, and also the source of every hard problem with them.',
    ),

    h('What is inside'),
    code(
      sh(`
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3IiwiZXhwIjoxNzU2MDAwMDAwfQ.dBjftJeZ...
└──────────── header ────────────┘ └────────── payload ──────────┘ └── signature ──┘
`),
    ),
    code(
      js(`
// header
{ "alg": "HS256", "typ": "JWT" }

// payload — these are "claims"
{
  "sub": "8f3a91c2-…",        // subject: who this is about
  "role": "user",
  "iat": 1755990000,          // issued at
  "exp": 1755990900,          // expires — the only one that limits damage
  "iss": "tasks-api",         // issuer
  "aud": "tasks-web"          // audience
}
`),
    ),
    warn(
      'The payload is **base64url, not encryption**. Anyone holding the token can read every claim — paste one into jwt.io and see. Never put a password, an email, a phone number or anything else private in a JWT.',
    ),
    p(
      'The signature is an HMAC (or a real signature) over `header.payload` using your secret. Change one character of the payload and the signature no longer matches — that is the entire security property.',
    ),

    h('Signing and verifying'),
    code(
      sh(`
npm install jsonwebtoken
`),
    ),
    code(
      js(`
import jwt from 'jsonwebtoken';

const token = jwt.sign(
  { sub: user.id, role: user.role },
  config.jwt.secret,
  { expiresIn: '15m', issuer: 'tasks-api', audience: 'tasks-web' },
);

try {
  const payload = jwt.verify(token, config.jwt.secret, {
    algorithms: ['HS256'],          // <- pin it. See below.
    issuer: 'tasks-api',
    audience: 'tasks-web',
  });
} catch (err) {
  // TokenExpiredError | JsonWebTokenError | NotBeforeError -> all 401
  throw new UnauthorizedError();
}
`),
    ),
    warn(
      'Always pass `algorithms`. Without it, a library will use the algorithm the **token** claims — and the classic attack is a forged token with `"alg": "none"` or an RS256 public key abused as an HS256 secret. Pinning the list closes both.',
    ),
    table(
      ['Algorithm', 'Key', 'Use when'],
      [
        ['`HS256`', 'One shared secret', 'One service signs and verifies. Simplest'],
        ['`RS256` / `ES256`', 'A private key signs, a public key verifies', 'Several services verify, one issues — they never need the signing key'],
        ['`none`', 'Nothing', '**Never.** It exists only as an attack'],
      ],
    ),
    tip(
      'For an HS256 secret, generate at least 32 random bytes — `openssl rand -base64 48`. A short or guessable secret means anyone can mint valid admin tokens, and offline cracking of a captured token costs an attacker nothing.',
    ),

    h('The hard part: you cannot revoke one'),
    p(
      'A JWT is valid until it expires, because verification touches no database. Log a user out, delete their account, downgrade their role — a token already issued keeps working. That is the trade you make for statelessness.',
    ),
    table(
      ['Approach', 'Cost'],
      [
        ['**Short expiry** — 5 to 15 minutes', 'None. The standard answer, and it bounds the damage'],
        ['A denylist of revoked token ids in Redis', 'A lookup per request — you have given up statelessness'],
        ['A `tokenVersion` on the user, checked on refresh', 'Only on refresh, so cheap. Revokes at the next refresh'],
        ['Server-side sessions instead', 'A lookup per request, and instant revocation'],
      ],
    ),

    h('Access and refresh tokens'),
    p(
      'The standard resolution: a short-lived access token that is never checked against a database, and a long-lived refresh token that is — and is therefore revocable.',
    ),
    table(
      ['', 'Access token', 'Refresh token'],
      [
        ['Lifetime', '5–15 minutes', '7–30 days'],
        ['Sent on', 'Every API request', 'Only the refresh endpoint'],
        ['Stored server-side', 'No', '**Yes** — hashed, so it can be revoked'],
        ['Held by the client in', 'Memory', 'An `HttpOnly` cookie'],
        ['On theft', 'Useless within minutes', 'Serious — hence rotation'],
      ],
    ),
    code(
      js(`
// Issue both at login.
export async function issueTokens(user) {
  const accessToken = jwt.sign(
    { sub: user.id, role: user.role },
    config.jwt.secret,
    { expiresIn: '15m' },
  );

  const refreshToken = crypto.randomBytes(32).toString('base64url');
  await repo.insertRefreshToken({
    userId: user.id,
    tokenHash: sha256(refreshToken),          // hashed at rest, like a password
    familyId: crypto.randomUUID(),            // for rotation detection
    expiresAt: new Date(Date.now() + 7 * 864e5),
  });

  return { accessToken, refreshToken };
}
`),
    ),
    note(
      'The refresh token is an opaque random string, not a JWT. It is checked against the database on every use anyway, so signing it buys nothing — and a random string cannot leak claims.',
    ),

    h('Rotation and reuse detection'),
    code(
      js(`
export async function refresh(presented) {
  const hash = sha256(presented);

  return withTransaction(async (client) => {
    const row = await repo.findRefreshToken(client, hash);
    if (!row || row.expiresAt < new Date()) throw new UnauthorizedError();

    if (row.usedAt) {
      // This token was already exchanged. Either it was stolen and replayed,
      // or the legitimate client is replaying. Assume the worst.
      await repo.revokeFamily(client, row.familyId);
      throw new UnauthorizedError();
    }

    await repo.markUsed(client, row.id);

    const next = crypto.randomBytes(32).toString('base64url');
    await repo.insertRefreshToken(client, {
      userId: row.userId,
      tokenHash: sha256(next),
      familyId: row.familyId,                 // same family, new token
      expiresAt: new Date(Date.now() + 7 * 864e5),
    });

    const user = await repo.findUser(client, row.userId);
    return { accessToken: signAccess(user), refreshToken: next };
  });
}
`),
    ),
    tip(
      'Reuse detection is the part that makes refresh tokens worth the machinery. A stolen token gets used once; when the real client next refreshes with the old one, you see a used token and kill the entire family — so a theft ends in one refresh cycle rather than lasting a month.',
    ),

    h('Where the client keeps them'),
    table(
      ['Location', 'XSS', 'CSRF', 'Verdict'],
      [
        ['`localStorage`', '**Readable by any script**', 'Not sent automatically', 'Common, and the weakest'],
        ['A normal cookie', 'Readable by script', 'Sent automatically', 'Worst of both'],
        ['**`HttpOnly` cookie**', 'Not readable', 'Sent automatically — needs `SameSite`', '**Best**, with `SameSite=Lax`'],
        ['JS memory', 'Readable while the page runs, gone on reload', 'Not sent automatically', 'Good for the access token'],
      ],
    ),
    code(
      js(`
// The usual combination: refresh in an HttpOnly cookie, access in memory.
res.cookie('refresh_token', refreshToken, {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  path: '/v1/auth/refresh',        // sent ONLY to the refresh endpoint
  maxAge: 7 * 24 * 60 * 60 * 1000,
});

res.json({ accessToken });          // the client holds this in memory
`),
    ),
    warn(
      'The advice "never store a JWT in localStorage" is right but often misstated. XSS is game over either way — an attacker with script execution can call your API as the user. The difference is that an `HttpOnly` cookie cannot be **exfiltrated**, so the attack ends when the page closes rather than continuing for a month from the attacker\'s machine.',
    ),

    h('Logout'),
    code(
      js(`
export async function logout(refreshToken, res) {
  if (refreshToken) await repo.revokeRefreshToken(sha256(refreshToken));
  res.clearCookie('refresh_token', { path: '/v1/auth/refresh' });
  // The access token stays valid until it expires — up to 15 minutes.
}

// Log out everywhere:
await repo.revokeAllRefreshTokens(userId);
`),
    ),

    h('JWT or sessions'),
    table(
      ['Choose a JWT when', 'Choose sessions when'],
      [
        ['Several services must verify without sharing a database', 'One application, one database'],
        ['Mobile or third-party clients with no cookie jar', 'A browser client you control'],
        ['You genuinely need statelessness to scale', 'Instant revocation matters more than a lookup'],
        ['', 'You want the simpler thing that is harder to get wrong'],
      ],
    ),
    tip(
      'For a single web application, a session in Redis is simpler, revocable instantly and entirely sufficient. JWTs are chosen far more often than they are needed — and if a request already hits Redis or Postgres, the "stateless" argument was never load-bearing.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Sign a token', '`jwt.sign(claims, secret, { expiresIn: "15m" })`'],
      ['Verify one', '`jwt.verify(token, secret, { algorithms: ["HS256"] })`'],
      ['Never put in a payload', 'Anything private — it is readable by anyone'],
      ['Generate a secret', '`openssl rand -base64 48`'],
      ['Revoke access', 'Short expiry plus a revocable refresh token'],
      ['Store a refresh token', 'Hashed in the database, `HttpOnly` cookie on the client'],
      ['Detect a stolen refresh token', 'Rotation with reuse detection, revoking the family'],
      ['Scope the refresh cookie', '`path: "/v1/auth/refresh"`'],
    ]),

    h('Interview'),
    asked([
      ['Is a JWT encrypted?', 'No — signed. The payload is base64url and readable by anyone holding the token.'],
      ['How do you invalidate a JWT?', 'You cannot, directly — use short expiry plus a revocable refresh token, or a denylist.'],
      ['Why have a refresh token at all?', 'It lets access tokens be short-lived without logging the user out every 15 minutes, and it is revocable.'],
      ['What is refresh token rotation?', 'Each refresh issues a new token and invalidates the old one; reuse of an old one means theft, so the whole family is revoked.'],
      ['`localStorage` or a cookie?', 'An `HttpOnly` cookie — XSS can still act as the user, but it cannot exfiltrate the token.'],
      ['Why pin the algorithm on verify?', 'Otherwise a forged token can specify `alg: none`, or abuse an RS256 public key as an HS256 secret.'],
      ['JWT or sessions for one web app?', 'Sessions — simpler, instantly revocable, and the statelessness argument rarely applies.'],
    ]),

    links(
      link('RFC 7519 — JSON Web Token', 'https://www.rfc-editor.org/rfc/rfc7519'),
      link('OWASP — JWT Cheat Sheet', 'https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html'),
      link('jsonwebtoken', 'https://github.com/auth0/node-jsonwebtoken'),
    ),
  ],
};
