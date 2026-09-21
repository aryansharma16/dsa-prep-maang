import { asked, code, diagram, flow, h, js, links, p, quick, sh, table, tip, tradeoff, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Two models. **A session id is a pointer to state you hold; a JWT is the state itself, signed.** The first is easy to revoke and needs a lookup; the second needs no lookup and is very hard to take back.',
    ),

    h('The two models'),
    diagram(
      `
   SERVER SESSION                    JWT

   cookie: sid=a3f9...               Authorization: Bearer eyJ...
             │                                       │
             ▼                                       ▼
   ┌──────────────────┐              ┌──────────────────────────┐
   │ session store    │              │ header.payload.signature │
   │ a3f9 ──▶ user 42 │              │  { sub: 42,              │
   │        roles     │              │    exp: ...,             │
   │        expires   │              │    roles: [...] }        │
   └──────────────────┘              └──────────────────────────┘
      a lookup, every request           verify the signature. done.

   ✓ revoke = delete a row            ✓ no lookup, no shared store
   ✓ the cookie means nothing         ✓ any service verifies alone
     if stolen without the store      ✗ REVOCATION IS THE PROBLEM
   ✗ a store every service needs      ✗ stale claims until expiry
   ✗ a lookup on the hot path         ✗ payload visible to anyone
`,
      'A pointer, or the thing itself',
    ),
    tradeoff([
      ['**Server sessions**', 'Instant revocation, small cookie, claims always current, easy to reason about', 'A store on every request, and a shared dependency across services'],
      ['**JWT**', 'Stateless verification, no shared store, works across services and domains', 'Cannot be revoked before expiry, claims go stale, and the payload is readable'],
    ]),

    h('What a JWT actually is'),
    code(
      sh(`
eyJhbGciOiJIUzI1NiJ9 . eyJzdWIiOiI0MiIsImV4cCI6MTc2NX0 . 4f2a...
└──── header ────────┘ └──────── payload ─────────────┘ └ signature ┘
      base64url              base64url                    HMAC/RSA

# The payload is ENCODED, not encrypted. Anyone holding the token
# reads it. The signature proves it was not modified — nothing more.
echo 'eyJzdWIiOiI0MiIsImV4cCI6MTc2NX0' | base64 -d
{"sub":"42","exp":1765}
`),
    ),
    warn(
      '**A JWT is signed, not secret.** Putting an email, a phone number or an internal id in the payload puts it in browser storage, in logs, in proxy traces and in any error report. Claims are for authorization decisions, never for private data.',
    ),

    h('The revocation problem'),
    diagram(
      `
   a user logs out. an admin deactivates an account.
   a token is stolen.

   SESSION        DELETE the row.  ──▶ next request fails. done.

   JWT            the token is still cryptographically valid
                  until 'exp'. nothing can refuse it.

   THE WORKAROUNDS

   short expiry (5-15 min)   the window shrinks. does not close
   a denylist                you now have a store — the thing
                             JWTs existed to avoid
   token version claim       compare a per-user counter; still
                             a lookup, but a tiny cacheable one
   short access + refresh    ◀── what everyone actually does
`,
      'Every fix reintroduces state',
    ),

    h('Access and refresh tokens'),
    flow(['Login', 'Access (15 min)', 'Expires', 'Refresh token', 'New access'], 'The standard shape'),
    table(
      ['', 'Access token', 'Refresh token'],
      [
        ['Lifetime', '5–15 minutes', 'Days to weeks'],
        ['Sent', 'On every request', '**Only to the refresh endpoint**'],
        ['Stored', 'In memory, ideally', '**httpOnly, Secure, SameSite cookie**'],
        ['Stateless?', 'Yes', '**No — kept server-side so it can be revoked**'],
        ['Stolen means', 'Up to 15 minutes of access', 'Full access until revoked'],
      ],
    ),
    tip(
      'The refresh token is deliberately **stateful**, which is what makes the whole scheme work: logout and revocation delete the refresh token, and within fifteen minutes the access token expires and cannot be renewed. You get stateless verification on the hot path and real revocation.',
    ),

    h('Refresh token rotation'),
    code(
      js(`
// Each refresh issues a NEW refresh token and invalidates the old.
// If an already-used token is presented, it was stolen and replayed
// — so the whole family is revoked and the user must log in again.
async function refresh(presented) {
  const record = await db.refreshTokens.findByHash(sha256(presented));
  if (!record) throw new AuthError('unknown token');

  if (record.usedAt) {
    // Reuse detected: either the attacker or the legitimate user is
    // replaying. You cannot tell which, so revoke everything.
    await db.refreshTokens.revokeFamily(record.familyId);
    throw new AuthError('token reuse detected');
  }

  await db.refreshTokens.markUsed(record.id);
  return issuePair(record.userId, record.familyId);
}
`),
    ),

    h('Where to store them'),
    table(
      ['Location', 'XSS-safe', 'CSRF-safe', 'Verdict'],
      [
        ['`localStorage`', '**No** — any script reads it', 'Yes', 'Common, and the weakest'],
        ['`sessionStorage`', '**No**', 'Yes', 'Same, plus it is lost on tab close'],
        ['JS variable in memory', 'Mostly', 'Yes', 'Good for the access token'],
        ['**httpOnly cookie**', '**Yes** — scripts cannot read it', 'Needs `SameSite`', '**Best for the refresh token**'],
      ],
    ),
    warn(
      'A token in `localStorage` is readable by **every script on the page**, including one injected via a compromised dependency. The httpOnly cookie plus `SameSite=Lax` and `Secure` is the combination that defends both XSS and CSRF.',
    ),

    h('Choosing'),
    table(
      ['Situation', 'Use'],
      [
        ['A single web app, one backend', '**Server sessions.** Simpler and instantly revocable'],
        ['Many services verifying independently', 'JWT access tokens'],
        ['Mobile or third-party API clients', 'JWT with refresh rotation'],
        ['Anything needing instant revocation', 'Sessions, or very short JWTs plus a denylist'],
        ['Cross-domain SSO', 'OIDC, which issues JWTs'],
      ],
    ),
    tip(
      'The honest default for a normal web product is **server sessions** — the lookup is a Redis hit, revocation is a delete, and none of the JWT footguns apply. JWTs earn their place when many services must verify independently without a shared store.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'A pointer to server state, or signed state carried by the client'],
      ['Why it matters', 'It decides whether logout works immediately'],
      ['Use when', 'Sessions by default; JWTs for multi-service or cross-domain'],
      ['Trade-off', 'Stateless verification, for the inability to revoke'],
      [
        '30-second answer',
        '"A session id is a pointer to server state — a lookup per request, and revocation is a delete. A JWT carries signed claims, so any service verifies it without a store, but it cannot be revoked before it expires and its payload is readable by anyone. So the standard shape is a short access token, stateless and 15 minutes, plus a stateful rotating refresh token in an httpOnly cookie. For a single web app, plain server sessions are simpler and better."',
      ],
    ]),
    asked([
      ['How do you revoke a JWT?', 'You cannot, before expiry. Use short access tokens with a stateful refresh token you can delete.'],
      ['Sessions or JWTs?', 'Sessions for a single app — simpler and instantly revocable. JWTs when many services verify independently.'],
      ['Is a JWT encrypted?', 'No. Signed and base64-encoded. Anyone holding it can read the payload.'],
      ['Where should tokens be stored?', 'Refresh token in an httpOnly Secure SameSite cookie; access token in memory. Not localStorage.'],
      ['What is refresh token rotation?', 'Each refresh issues a new token; presenting a used one signals theft, so the whole family is revoked.'],
    ]),

    links(
      wiki('JSON_Web_Token', 'JSON Web Token'),
      wiki('Session_(computer_science)', 'Session'),
    ),
  ],
};
