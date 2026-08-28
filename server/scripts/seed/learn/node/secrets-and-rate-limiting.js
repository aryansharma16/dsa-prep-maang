import { asked, cheat, code, h, js, link, links, note, p, sh, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Two operational defences that close out the section. **Secrets** are the credentials your service holds; **rate limiting** is the cap that stops one client being all of your traffic. Neither is difficult, and both are routinely missing on day one.',
    ),

    h('Where secrets live'),
    table(
      ['Location', 'Suitable for', 'Notes'],
      [
        ['Source code', '**Nothing**', 'Permanently compromised once committed'],
        ['`.env`, gitignored', 'Local development', 'Never in an image, never in the repo'],
        ['Platform env vars', 'Small deployments', 'Fine — visible to anyone with dashboard access'],
        ['AWS Secrets Manager / SSM, Vault', 'Production', 'Versioned, audited, rotatable, access-controlled'],
        ['Kubernetes Secrets', 'Kubernetes', 'Base64, **not encrypted** at rest by default'],
      ],
    ),
    code(
      sh(`
openssl rand -base64 48         # generate a real secret
`),
    ),
    warn(
      'A committed secret is compromised the moment it is pushed — it is in the history, in every clone, in every fork, and in whatever mirrors your CI keeps. Deleting the line does nothing. **The only response is to rotate it**, and only then to consider rewriting history.',
    ),

    h('Keeping them out'),
    code(
      sh(`
# .gitignore
.env
.env.*
!.env.example
*.pem
*.key

# A pre-commit hook that scans staged changes.
npx gitleaks protect --staged
`),
    ),
    code(
      js(`
// .github/workflows/ci.yml
- uses: gitleaks/gitleaks-action@v2
- run: npm ci && npm audit --omit=dev
`),
    ),
    code(
      js(`
// And do not log them back out.
log.info({ config }, 'starting');                       // leaks everything
log.info({ env: config.env, port: config.port }, 'starting');   // fine

const logger = pino({
  redact: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.token'],
});
`),
    ),

    h('Rotation'),
    code(
      js(`
// Accept two keys during a rotation window, so nothing breaks mid-deploy.
const verify = (token) => {
  for (const secret of [config.jwt.secret, config.jwt.previousSecret].filter(Boolean)) {
    try { return jwt.verify(token, secret, { algorithms: ['HS256'] }); } catch { /* next */ }
  }
  throw new UnauthorizedError();
};
// Sign with the new one; verify with either; drop the old after the max token age.
`),
    ),
    tip(
      'Design for rotation before you need it. The day a secret leaks, the difference between a five-minute fix and an outage is whether your code can hold two valid keys at once.',
    ),

    h('Why rate limit'),
    table(
      ['Without a limit', 'One client can'],
      [
        ['Login', 'Brute-force passwords, or enumerate accounts'],
        ['Password reset', 'Flood a user\'s inbox — and your email reputation'],
        ['Search', 'Run your most expensive query in a loop'],
        ['Any endpoint', 'Consume your whole connection pool'],
        ['A paid third-party call', 'Spend your budget'],
      ],
    ),

    h('The algorithms'),
    table(
      ['Algorithm', 'How', 'Trade-off'],
      [
        ['**Fixed window**', 'Count per calendar minute', 'Simple. Allows a 2× burst across a boundary'],
        ['**Sliding window**', 'Count over the last 60 s', 'Accurate, more storage'],
        ['**Token bucket**', 'Tokens refill at a rate; each request spends one', 'Allows bursts, caps the sustained rate. **Usually what you want**'],
        ['**Leaky bucket**', 'A fixed drain rate', 'Perfectly smooth, no bursts allowed'],
      ],
    ),
    p(
      'The fixed-window flaw in practice: with a limit of 100 per minute, a client can send 100 at 11:59:59 and 100 more at 12:00:00 — 200 requests in one second, all within the rules.',
    ),

    h('In Express'),
    code(
      sh(`
npm install express-rate-limit rate-limit-redis
`),
    ),
    code(
      js(`
import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';

const limiter = (opts) => rateLimit({
  store: new RedisStore({ sendCommand: (...args) => redis.sendCommand(args) }),
  standardHeaders: 'draft-7',      // RateLimit-Limit, -Remaining, -Reset
  legacyHeaders: false,
  ...opts,
});

// A global floor.
app.use(limiter({ windowMs: 60_000, limit: 100 }));

// Tighter on the endpoints that are worth attacking.
router.post('/login', limiter({
  windowMs: 15 * 60_000,
  limit: 10,
  skipSuccessfulRequests: true,        // only failures count
}), controller.login);

router.post('/password-reset', limiter({ windowMs: 60 * 60_000, limit: 3 }));
router.post('/upload', limiter({ windowMs: 60_000, limit: 10 }));
`),
    ),
    warn(
      'The default in-memory store is per instance. Four instances behind a load balancer means the effective limit is four times what you configured — and it resets on every deploy. Use the Redis store for anything real.',
    ),

    h('What to key on'),
    code(
      js(`
keyGenerator: (req) => {
  if (req.user) return \`user:\${req.user.id}\`;     // best — survives IP changes
  if (req.apiKey) return \`key:\${req.apiKey.id}\`;
  return \`ip:\${req.ip}\`;                          // last resort
}
`),
    ),
    table(
      ['Key', 'Problem'],
      [
        ['IP', 'A whole office or a mobile carrier shares one. IPv6 users have many'],
        ['User id', 'Only available after authentication'],
        ['API key', 'Ideal, where you issue them'],
        ['Email, on login', 'Stops credential stuffing that rotates IPs'],
      ],
    ),
    tip(
      'For login specifically, limit on **both** the IP and the target email. Per-IP stops one machine grinding through one account; per-email stops a botnet trying one leaked password against every account — which is the attack that actually works.',
    ),
    warn(
      '`req.ip` is only trustworthy if `trust proxy` is configured for exactly your proxy. With `trust proxy: true`, a client sets `X-Forwarded-For` to a random value per request and your limiter counts to one, forever.',
    ),

    h('Responding'),
    code(
      js(`
HTTP/1.1 429 Too Many Requests
RateLimit-Limit: 100
RateLimit-Remaining: 0
RateLimit-Reset: 42
Retry-After: 42

{ "error": { "message": "Too many requests", "code": "rate_limited",
             "retryAfter": 42 } }
`),
    ),
    note(
      'Always send `Retry-After`. A well-behaved client waits exactly that long; without it, clients guess, and guessing wrong turns your rate limit into a retry storm.',
    ),

    h('By cost, not by count'),
    code(
      js(`
// Not every request costs the same. Charge accordingly.
const COST = { '/search': 5, '/export': 20, '/tasks': 1 };

export const costLimiter = asyncHandler(async (req, res, next) => {
  const cost = COST[req.route?.path] ?? 1;
  const key = \`rl:\${req.user?.id ?? req.ip}\`;

  const used = await redis.incrby(key, cost);
  if (used === cost) await redis.expire(key, 60);

  if (used > 100) {
    const ttl = await redis.ttl(key);
    return res.status(429).set('Retry-After', String(ttl))
      .json({ error: { message: 'Too many requests', code: 'rate_limited' } });
  }
  next();
});
`),
    ),

    h('Where limiting belongs'),
    table(
      ['Layer', 'Good at', 'Blind to'],
      [
        ['CDN / WAF — Cloudflare', 'Volumetric attacks. Traffic never reaches you', 'Per-user and per-endpoint cost'],
        ['Load balancer / nginx', 'Cheap per-IP caps', 'Application identity'],
        ['**Your application**', 'Per-user, per-endpoint, per-cost rules', 'Traffic is already consuming a connection'],
      ],
    ),
    tip(
      'Use more than one. A real volumetric attack should be absorbed before it reaches Node — a Node process rejecting a million requests per second is still a Node process handling a million requests per second.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Generate a secret', '`openssl rand -base64 48`'],
      ['Store one in production', 'A secret manager — never the repo or the image'],
      ['A secret was committed', '**Rotate it.** History rewriting comes second'],
      ['Keep them out', 'gitleaks in pre-commit and in CI'],
      ['Survive a rotation', 'Accept the previous key during a window'],
      ['Rate limit', '`express-rate-limit` with the Redis store'],
      ['Key it on', 'User id where possible, IP as a fallback'],
      ['Protect login', 'Limit per IP **and** per email'],
      ['Respond', '`429` with `Retry-After`'],
    ]),

    h('Interview'),
    asked([
      ['How should secrets be managed?', 'From the environment, sourced from a secret manager, never in the repo or image, and rotatable.'],
      ['A secret was committed — what now?', 'Rotate it immediately; it is in every clone and rewriting history does not recall it.'],
      ['How do you rate limit properly?', 'A shared store like Redis, keyed on user where possible, with tighter limits on expensive and attackable endpoints.'],
      ['Why is an in-memory limiter wrong?', 'Each instance has its own counter, so the real limit is multiplied and resets on deploy.'],
      ['Fixed window vs token bucket?', 'Fixed window allows a double burst across a boundary; token bucket allows a controlled burst with a capped sustained rate.'],
      ['What should a 429 include?', '`Retry-After` and the `RateLimit-*` headers, so clients back off correctly instead of guessing.'],
      ['Why limit per account as well as per IP?', 'Credential stuffing rotates IPs but targets the same accounts.'],
    ]),

    links(
      link('OWASP — Secrets Management Cheat Sheet', 'https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html'),
      link('express-rate-limit', 'https://express-rate-limit.mintlify.app'),
      link('RateLimit header fields for HTTP', 'https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/'),
    ),
  ],
};
