import { ApiError } from '../../utils/ApiError.js';

/**
 * What went wrong upstream, and how long to stop asking.
 *
 * The registry needs two different things from a failure and they are not the
 * same question. `status` answers "what do I tell the caller"; `cooldownMs`
 * answers "when is it worth trying this provider again". Conflating them is how
 * you end up retrying a key that has no credits once per message, forever.
 *
 * The xAI key in this deployment is exactly that case: it authenticates fine
 * and then answers 403 "your team doesn't have any credits". Nothing about that
 * improves in thirty seconds, so it earns a long sit-down rather than a place
 * at the front of every chain.
 */

const MINUTE = 60 * 1000;

/** Long enough that a dead key costs one request per quarter hour, not per chat. */
const CREDENTIAL_COOLDOWN_MS = 15 * MINUTE;

const RATE_COOLDOWN_MS = MINUTE;

/**
 * A daily allowance comes back at midnight UTC and not one minute sooner, so
 * that is the cooldown — not a fixed interval that happens to be long.
 *
 * This is also the number the UI shows a reader ("back in 4 hours"), which only
 * works if it is the real reset rather than a guess. Google counts these in
 * UTC days, matching activity.service.js's buckets.
 */
export function nextUtcMidnight(from = Date.now()) {
  const next = new Date(from);
  next.setUTCHours(24, 0, 0, 0);
  return next.getTime();
}

const dailyCooldownMs = () => Math.max(MINUTE, nextUtcMidnight() - Date.now());
const TRANSIENT_BASE_MS = 30 * 1000;
const TRANSIENT_MAX_MS = 5 * MINUTE;

/**
 * Providers phrase an exhausted daily allowance in their own words, and the
 * only thing they agree on is the number 429. Gemini says "per day", Cerebras
 * says "daily", so this reads the body rather than trusting a shared shape.
 */
const DAILY_HINT = /per[\s-]?day|daily|requests? per day|RPD|quota.*exceeded/i;

/** Seconds, or an HTTP date. Both are legal, and vendors use both. */
function retryAfterMs(header) {
  if (!header) return 0;
  const seconds = Number(header);
  const ceiling = dailyCooldownMs();
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds * 1000, ceiling);
  const at = Date.parse(header);
  if (Number.isFinite(at)) return Math.max(0, Math.min(at - Date.now(), ceiling));
  return 0;
}

/**
 * Classify a thrown upstream failure.
 *
 * `failures` is the consecutive-failure count, used only for the transient
 * backoff — a host having a bad minute should be tried again soon, a host
 * having a bad hour should not be tried every thirty seconds.
 *
 * `scope` is what separates "this key cannot spend money" from "this one model
 * is out of requests for today", and it is the difference between one exhausted
 * model taking a provider's entire catalogue down with it and the chain simply
 * moving to the next model on the same host. Get it wrong in the safe-looking
 * direction — everything provider-scoped — and a free tier that is 20 requests
 * per model per day behaves as though it were 20 for the whole account.
 *
 * @returns {{ kind: string, scope: 'provider'|'model', cooldownMs: number, status: number, message: string }}
 */
export function classify(error, failures = 1) {
  if (error?.name === 'AbortError') {
    return {
      kind: 'TIMEOUT',
      scope: 'provider',
      cooldownMs: Math.min(TRANSIENT_BASE_MS * 2 ** (failures - 1), TRANSIENT_MAX_MS),
      status: 504,
      message: 'The model took too long to answer',
    };
  }

  const status = Number(error?.status) || 0;
  const body = String(error?.body || error?.message || '');

  // No status at all means we never got an HTTP response — DNS, TLS, a reset
  // socket. Transient by nature.
  if (!status) {
    return {
      kind: 'NETWORK',
      scope: 'provider',
      cooldownMs: Math.min(TRANSIENT_BASE_MS * 2 ** (failures - 1), TRANSIENT_MAX_MS),
      status: 502,
      message: error?.message || 'Could not reach the model',
    };
  }

  // Both counted per model, not per key — which is why an exhausted model must
  // not disqualify the rest of the host's catalogue.
  if (status === 429) {
    const daily = DAILY_HINT.test(body);
    return {
      kind: daily ? 'QUOTA' : 'RATE_LIMIT',
      scope: 'model',
      cooldownMs: retryAfterMs(error?.retryAfter) || (daily ? dailyCooldownMs() : RATE_COOLDOWN_MS),
      status: 429,
      message: daily ? 'This model is out of requests for today' : 'This model is busy',
    };
  }

  /*
    Four different ways of saying "this account cannot spend money", and all of
    them are stable until a human visits a billing page:

      401  the key is wrong
      402  Cerebras "Payment required", DeepSeek "Insufficient Balance"
      403  xAI "your team doesn't have any credits or licenses yet"
      404  the model does not exist on this host

    402 is the one worth calling out. It is a 4xx, so the obvious reading is
    "our request was malformed" — which would put it in the bad-request branch
    below with no cooldown at all, and retry a provider that cannot bill us once
    per message forever. Three of the four providers on this deployment are in
    exactly this state today, so getting it wrong is not hypothetical.
  */
  if (status === 401 || status === 402 || status === 403 || status === 404) {
    // 404 is the one that is about a model rather than an account: a retired id
    // on a host whose other models are fine. gemini-2.5-flash is exactly this.
    const kind = status === 404 ? 'NO_MODEL' : status === 402 ? 'NO_BALANCE' : 'NO_CREDENTIAL';
    const message =
      status === 404
        ? 'That model is not available on this provider'
        : status === 402
          ? 'This provider has no credit on its account'
          : 'This provider rejected our key';
    return {
      kind,
      scope: status === 404 ? 'model' : 'provider',
      cooldownMs: CREDENTIAL_COOLDOWN_MS,
      status: 502,
      message,
    };
  }

  // A 400 is our request, not their host — but it can be model-specific (an
  // unsupported parameter on one model), so it only sidelines that model.
  if (status >= 400 && status < 500) {
    return {
      kind: 'BAD_REQUEST',
      scope: 'model',
      cooldownMs: CREDENTIAL_COOLDOWN_MS,
      status: 400,
      message: body.slice(0, 200) || 'The model rejected the request',
    };
  }

  return {
    kind: 'UPSTREAM',
    scope: 'provider',
    cooldownMs: Math.min(TRANSIENT_BASE_MS * 2 ** (failures - 1), TRANSIENT_MAX_MS),
    status: 502,
    message: 'The model is unavailable',
  };
}

/**
 * The public-facing error for a failure that reached the client.
 *
 * Deliberately does not carry the upstream body. Vendor 4xx text sometimes
 * quotes back parts of the request, and the request here contains someone's
 * question — see the sanitising the admin settings route does for the same
 * reason.
 */
export function asApiError(error, providerId) {
  if (error instanceof ApiError) return error;
  const { status, message } = classify(error);
  return new ApiError(status, message, `AI_${providerId ? providerId.toUpperCase() : 'FAILED'}`);
}
