import { HOUR, MINUTE, ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Per-caller request ceilings.
 *
 * The threat these answer is not a clever one. It is a loop: someone points a
 * script at /auth/login and walks a password list, or at /chat/stream and spends
 * the AI key, or at any route at all until a small instance stops answering.
 * None of that needs a vulnerability — the endpoints work exactly as designed,
 * just far more often than a person could ask.
 *
 * So the shape is one generous ceiling across everything, and tight ones on the
 * handful of routes where a single request is expensive or a wrong answer is
 * worth guessing at. Tight everywhere would be a limiter someone switches off
 * the first time it fires on a real user, which is worse than not having one.
 *
 * Two things this rests on that live in other files.
 *
 * `app.set('trust proxy', 1)` in app.js is load-bearing here. nginx, Render and
 * Vercel all terminate TLS in front of this process, so without it every request
 * arrives carrying the proxy's own address and the entire internet shares one
 * bucket — the first busy minute locks out everybody. It is already set for the
 * cookies; this is the second reason it cannot be removed.
 *
 * The counters live in this process's memory. That is exact on the single
 * instance this deploys to, and it degrades honestly rather than silently if
 * that changes: N instances means a caller gets up to N times the limit, because
 * each keeps its own tally, and a restart forgives everyone. The fix at that
 * point is a shared store — `rate-limit-redis` goes into the `store` option in
 * `limiter()` below and nothing else in this file moves.
 */

/**
 * IPv6 is why this is not simply `req.ip`.
 *
 * An IPv4 line gives an attacker one address to be counted by. An IPv6
 * subscriber is handed a whole prefix — billions of addresses they can rotate
 * through for free — so a per-address counter on v6 is not a limit, it is a
 * rounding error. `ipKeyGenerator` collapses a v6 address to the /56 its
 * subscriber was actually allocated, and passes v4 through untouched.
 */
const byIp = (req) => ipKeyGenerator(req.ip || 'unknown');

/**
 * Signed-in routes count against the account, not the address.
 *
 * Shared egress is the ordinary case for this app's audience, not the exception:
 * a college network, an office, a hostel, a carrier's CGNAT all put hundreds of
 * people behind one address. Keying the expensive routes by address would have
 * them locking each other out of chat and uploads while every one of them
 * behaved perfectly.
 *
 * It opens nothing. Minting accounts to buy more budget has to get past
 * `registerLimiter` first, and `apiLimiter` is keyed by address and runs above
 * everything, so the ceiling on one connection holds however many sessions it is
 * spread across.
 *
 * The address fallback is for callers that reach a limiter before `requireAuth`
 * has run — today only the mount points above the gate, but the fallback means a
 * limiter moved above it fails closed rather than handing every anonymous caller
 * the same `undefined` bucket.
 */
const byUser = (req) => (req.userId ? `user:${req.userId}` : `ip:${byIp(req)}`);

/**
 * The 429, in the shape everything else in this app produces.
 *
 * `meta` is the errorHandler's channel for structured facts a client can act on,
 * and how long to wait is exactly that: it lets the UI say "try again in 40
 * seconds" instead of "try again later", and lets a retry sleep the right amount
 * rather than guess. The same number goes out as `Retry-After`, which is what a
 * non-browser caller reads.
 */
function tooMany(req, message) {
  const err = ApiError.tooManyRequests(message);
  const resetTime = req.rateLimit?.resetTime;
  if (resetTime) {
    err.meta = {
      retryAfterSeconds: Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000)),
    };
  }
  return err;
}

/**
 * @param {object} options
 * @param {string} options.name       policy name, reported in the RateLimit header
 * @param {number} options.windowMs
 * @param {number} options.limit      requests per window per key
 * @param {string} options.message    shown to the person who tripped it
 * @param {Function} [options.key]    `byIp` (default) or `byUser`
 * @param {Function} [options.skip]   requests this policy should not count
 */
function limiter({ name, windowMs, limit, message, key = byIp, skip, ...rest }) {
  return rateLimit({
    windowMs,
    limit,
    identifier: name,
    keyGenerator: key,
    // draft-7's single `RateLimit` header, plus `Retry-After` on rejection.
    // `legacyHeaders` would add the pre-standard X- forms on top, which nothing
    // in this app reads.
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    /*
      The kill switch is folded in here rather than at each mount point, so
      RATE_LIMIT_DISABLED cannot come to mean "off for most of them".
    */
    skip: (req, res) => !env.rateLimit.enabled || Boolean(skip?.(req, res)),
    // Routed through Express's error path rather than answered here, so a 429
    // arrives as the same `{ error: { message, code, meta } }` every other
    // failure does and the client needs no special case to read it.
    handler: (req, _res, next) => next(tooMany(req, message)),
    ...rest,
  });
}

/**
 * The backstop, over everything under /api.
 *
 * Sized to be invisible to a browser and fatal to a loop: a page here is under a
 * dozen calls, so 300 a minute is roughly twenty-five full page loads a minute
 * from one address, while a script hammering one endpoint is stopped inside two
 * seconds.
 *
 * It is deliberately not tighter, because it is the one limiter keyed by address
 * and an address can be a whole campus. Everything below narrows from here per
 * account, where a shared address costs nobody anything.
 */
export const apiLimiter = limiter({
  name: 'api',
  windowMs: MINUTE,
  limit: env.rateLimit.globalPerMinute,
  message: 'Too many requests from this network. Slow down and try again shortly.',
  /*
    /health is exempt, and has to be. It is this service's health check on both
    deployment paths (`healthCheckPath` in render.yaml, and nginx/uptime probes
    on the EC2 box), and a 429 there does not read as "slow down" — it reads as
    "the service is down", and the response to that is a restart or a page. It
    costs a `process.uptime()` and three boolean reads, so there is nothing here
    worth protecting anyway.

    `req.path` and not `req.originalUrl`: this is mounted on /api, so Express has
    already stripped that prefix by the time the check runs.
  */
  skip: (req) => req.path === '/health',
});

/**
 * Credentials. The limiter doing classical security work.
 *
 * Ten a quarter-hour is not a password policy — it is what turns an offline-speed
 * guess into an offline-speed wait. A list that would take four minutes at HTTP
 * speed takes a month at this rate, which is long enough that nobody bothers.
 *
 * Only failures are counted. A password manager filling the form correctly, a
 * shared office address, a person signing in on their phone and their laptop —
 * none of those should spend budget that exists to stop guessing, and a run of
 * successes is evidence of the opposite of an attack. It also means the limit is
 * measured in wrong answers, which is the thing actually worth capping.
 */
export const loginLimiter = limiter({
  name: 'login',
  windowMs: 15 * MINUTE,
  limit: 10,
  message: 'Too many failed sign-in attempts. Wait a few minutes and try again.',
  skipSuccessfulRequests: true,
});

/**
 * Registration, which is the same idea inverted and so cannot share the limiter
 * above.
 *
 * On login a success is innocent. Here a success *is* the abuse — the damage is
 * ten thousand accounts filling the collection and the admin user list, each one
 * a fresh per-account budget for every limiter keyed by `byUser`. So nothing is
 * skipped, and the number is small: five an hour is generous for a household or
 * a classroom signing up together, and useless as a way to farm accounts.
 */
export const registerLimiter = limiter({
  name: 'register',
  windowMs: HOUR,
  limit: 5,
  message: 'Too many accounts created from this network. Try again in an hour.',
});

/**
 * The chat stream. The only route where one request spends money.
 *
 * Every other limit here protects the box; this one protects the API key. A loop
 * on /chat/stream is not a load problem — the instance would barely notice it —
 * it is a bill, and on a free tier it is the whole day's quota gone before
 * anybody else gets a turn.
 *
 * Twenty in ten minutes is well past what a conversation with a model that takes
 * seconds to answer can actually consume, and it is per account, so one person
 * burning through it cannot take the assistant away from anyone else.
 */
export const aiLimiter = limiter({
  name: 'ai',
  windowMs: 10 * MINUTE,
  limit: 20,
  key: byUser,
  message: 'You are asking the assistant faster than it can answer. Give it a few minutes.',
});

/**
 * Uploads.
 *
 * Three costs stack on this one route in a way they do not anywhere else:
 * multer holds the bytes in the heap (see middleware/upload.js — memory storage
 * is what makes the size caps there load-bearing), the request then blocks on a
 * round trip to Cloudinary or S3, and whatever lands is storage somebody pays
 * for and nothing reclaims. The per-file caps bound one request; this bounds the
 * sequence.
 *
 * Mount it *above* the multer middleware wherever it is used. Below it, a
 * rejected caller has already pushed their megabytes into this process's heap
 * before being told no, which is precisely the thing being defended against —
 * the same ordering argument `requireAuth` before `singleImage` already makes in
 * auth.routes.js.
 */
export const uploadLimiter = limiter({
  name: 'upload',
  windowMs: HOUR,
  limit: 30,
  key: byUser,
  message: 'Too many uploads in a short time. Try again in a little while.',
});

/**
 * Board saves in the system design module.
 *
 * Autosave is the one writer in this app whose ordinary use is a steady stream:
 * a tab sends a batch at most every second or so for as long as someone is
 * drawing. Under `writeLimiter` that is 120 writes spent in two minutes and a
 * board that stops saving mid-thought, so the save routes are mounted above it
 * (see routes/index.js) and counted here instead.
 *
 * Sized in batches, not edits — a tab coalesces a burst of changes into one
 * request and sends one at a time — so 240 a minute covers three tabs open on
 * boards at once with room for retries. A loop still stops within the minute.
 */
export const designSyncLimiter = limiter({
  name: 'design-sync',
  windowMs: MINUTE,
  limit: 240,
  key: byUser,
  message: 'Saving faster than the server can keep up. Your changes are kept and will retry.',
});

/**
 * Everything that changes something, for signed-in callers.
 *
 * Reads are already covered by `apiLimiter` and cost a query. Writes cost a
 * document that stays — tasks, custom problems, feedback, attempt history — so
 * the failure mode is not load, it is a collection quietly filling up with
 * whatever a script felt like inserting overnight.
 *
 * GET and HEAD are skipped rather than given a separate policy, so this can be
 * mounted once as a `use()` and cover every mutation declared under it,
 * including ones written later. The threshold is sized against the burstiest
 * honest case — someone catching up their roadmap, ticking off problems as fast
 * as they can click — which is nowhere near two a second sustained for five
 * minutes.
 */
export const writeLimiter = limiter({
  name: 'write',
  windowMs: 5 * MINUTE,
  limit: 120,
  key: byUser,
  message: 'Too many changes at once. Give it a minute and try again.',
  skip: (req) => req.method === 'GET' || req.method === 'HEAD',
});
