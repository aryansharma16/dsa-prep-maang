import { asked, code, diagram, h, links, p, quick, sh, table, tip, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      '**OAuth 2 is about authorization: letting an app act on your behalf without your password. OIDC is a thin layer on top that adds authentication: proving who you are.** "Sign in with Google" is OIDC; "let this app read your calendar" is OAuth.',
    ),

    h('The four parties'),
    table(
      ['Party', 'Is', 'Example'],
      [
        ['**Resource owner**', 'You', 'The user'],
        ['**Client**', 'The app wanting access', 'Your application'],
        ['**Authorization server**', 'Who authenticates and issues tokens', 'Google, Auth0, your own IdP'],
        ['**Resource server**', 'Holds the protected data', 'The Google Calendar API'],
      ],
    ),

    h('Authorization code flow with PKCE'),
    diagram(
      `
   the only flow you should use in 2026.

   1. user clicks "sign in with Google"
        │
        │  client generates:  verifier (random)
        │                     challenge = SHA256(verifier)
        ▼
   2. redirect to the authorization server
        /authorize?client_id=...&redirect_uri=...&state=xyz
                  &code_challenge=<challenge>&scope=openid email
        │
        ▼
   3. user authenticates THERE and approves the scopes
        │              (your app never sees the password)
        ▼
   4. redirect back:  /callback?code=abc&state=xyz
        │             ◀── verify state matches. CSRF defence.
        ▼
   5. BACK CHANNEL — server to server, not via the browser
        POST /token  { code: abc, code_verifier: <verifier> }
        │            ◀── server hashes the verifier and compares
        ▼                to the challenge from step 2
   6. { access_token, refresh_token, id_token }

   the code is useless without the verifier, which never
   left the client. an intercepted redirect gains nothing.
`,
      'Six steps, and why each one exists',
    ),
    table(
      ['Parameter', 'Defends against'],
      [
        ['`state`', '**CSRF** — an attacker completing a flow in your session'],
        ['`code_challenge` / `code_verifier` (PKCE)', '**Interception of the authorization code**'],
        ['`redirect_uri` exact-match registration', 'Redirecting the code to an attacker'],
        ['Short-lived, single-use code', 'Replay'],
        ['Back-channel token exchange', 'Tokens never appearing in a URL or browser history'],
      ],
    ),
    tip(
      'PKCE was originally for mobile apps that cannot hold a client secret, and is now **recommended for every client including server-side web apps**. It costs one hash and removes an entire class of interception attack.',
    ),

    h('Flows, and which are dead'),
    table(
      ['Flow', 'For', 'Status'],
      [
        ['**Authorization code + PKCE**', 'Everything with a user', '**The answer**'],
        ['**Client credentials**', 'Machine to machine, no user', 'Correct, for that case'],
        ['**Device code**', 'TVs, CLIs — no browser', 'Correct, for that case'],
        ['~~Implicit~~', 'Old single-page apps', '**Deprecated** — tokens in the URL fragment'],
        ['~~Password grant~~', 'Legacy', '**Deprecated** — the app sees the password, defeating the point'],
      ],
    ),
    warn(
      'The implicit flow returns tokens in the URL fragment, where they land in **browser history, referrer headers and logs**. It existed because browsers could not make cross-origin token requests; CORS solved that, and PKCE replaced it.',
    ),

    h('What OIDC adds'),
    table(
      ['', 'OAuth 2', 'OIDC'],
      [
        ['Answers', '"May this app access X?"', '**"Who is this user?"**'],
        ['Returns', '`access_token`', '`access_token` **+ `id_token`**'],
        ['Token format', 'Opaque or JWT — unspecified', '`id_token` is **always a JWT**'],
        ['Identity claims', 'None standardised', '`sub`, `email`, `name`, `picture`'],
        ['Discovery', 'None', '`/.well-known/openid-configuration`'],
      ],
    ),
    code(
      sh(`
# The id_token payload — a JWT, for YOU, about the USER.
{
  "iss": "https://accounts.google.com",   # who issued it
  "sub": "110169484474386276334",         # stable user id — key on THIS
  "aud": "your-client-id",                # issued to YOU
  "exp": 1765000000,
  "iat": 1764996400,
  "nonce": "n-0S6_WzA2Mj",                # replay defence
  "email": "user@example.com",
  "email_verified": true
}
`),
    ),
    warn(
      '**Key on `sub`, never on `email`.** An email address can change, and can be reassigned by a domain administrator to a different person — keying accounts on it means a new employee inherits their predecessor\'s account.',
    ),

    h('Access token versus ID token'),
    table(
      ['', '`access_token`', '`id_token`'],
      [
        ['Audience', 'The **resource server**', '**Your client**'],
        ['Means', '"The bearer may access X"', '"This user authenticated"'],
        ['You should', 'Send it to APIs', '**Verify it, then discard it**'],
        ['Never', 'Inspect it if opaque', '**Send it to an API as a credential**'],
      ],
    ),
    tip(
      'Sending an `id_token` to an API instead of an `access_token` is a very common mistake. The `aud` claim says who the token is for — **an API that accepts a token audienced to someone else is accepting a credential it should refuse.**',
    ),

    h('Verifying a token'),
    table(
      ['Check', 'Why'],
      [
        ['**Signature**, against the issuer\'s JWKS', 'Otherwise anyone can mint one'],
        ['`iss` matches the expected issuer', 'A token from another provider is not yours'],
        ['`aud` matches your client or API', 'Prevents token passing between services'],
        ['`exp` and `nbf`', 'Expiry'],
        ['`nonce`, on login', 'Replay of a previous login'],
        ['**`alg` is not `none`**', 'The classic JWT bypass — reject unsigned tokens'],
      ],
    ),

    h('Interview'),
    quick([
      ['What it is', 'Delegated authorization, plus a standard identity layer on top'],
      ['Why it exists', 'So an app can act for you without holding your password'],
      ['Use when', 'Third-party sign-in, SSO, or any delegated API access'],
      ['Trade-off', 'A standard flow with real security properties, and several round trips'],
      [
        '30-second answer',
        '"OAuth 2 delegates authorization; OIDC adds authentication with an id_token JWT. Use the authorization code flow with PKCE: redirect to the provider with a state parameter and a hashed code challenge, the user authenticates there, you get a code back, and you exchange it server-to-server with the verifier. State defends CSRF, PKCE defends code interception, and tokens never touch the browser URL. Key accounts on sub, never email, and always check the aud claim."',
      ],
    ]),
    asked([
      ['Walk me through the authorization code flow.', 'Redirect with state and a PKCE challenge, user authenticates, code returns to your callback, exchange it server-side with the verifier for tokens.'],
      ['What does OIDC add over OAuth 2?', 'An id_token JWT with standard identity claims, plus discovery. OAuth alone says nothing about who the user is.'],
      ['What is PKCE for?', 'It stops an intercepted authorization code being usable, because the verifier never left the client.'],
      ['Access token or id_token to an API?', 'Access token. The id_token is audienced to your client and should be verified then discarded.'],
      ['Why not key users on email?', 'Emails change and get reassigned. Use the stable sub claim.'],
    ]),

    links(wiki('OAuth', 'OAuth'), wiki('OpenID_Connect', 'OpenID Connect')),
  ],
};
