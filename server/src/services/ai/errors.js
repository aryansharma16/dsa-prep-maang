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

/** A per-day quota does not come back before midnight; 60s would retry it hundreds of times. */
const DAILY_QUOTA_COOLDOWN_MS = 60 * MINUTE;

const RATE_COOLDOWN_MS = MINUTE;
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
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds * 1000, DAILY_QUOTA_COOLDOWN_MS);
  const at = Date.parse(header);
  if (Number.isFinite(at)) return Math.max(0, Math.min(at - Date.now(), DAILY_QUOTA_COOLDOWN_MS));
  return 0;
}

/**
 * Classify a thrown upstream failure.
 *
 * `failures` is the provider's consecutive-failure count, used only for the
 * transient backoff — a host having a bad minute should be tried again soon,
 * a host having a bad hour should not be tried every thirty seconds.
 *
 * @returns {{ kind: string, cooldownMs: number, status: number, message: string }}
 */
export function classify(error, failures = 1) {
  if (error?.name === 'AbortError') {
    return {
      kind: 'TIMEOUT',
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
      cooldownMs: Math.min(TRANSIENT_BASE_MS * 2 ** (failures - 1), TRANSIENT_MAX_MS),
      status: 502,
      message: error?.message || 'Could not reach the model',
    };
  }

  if (status === 429) {
    const daily = DAILY_HINT.test(body);
    return {
      kind: daily ? 'QUOTA' : 'RATE_LIMIT',
      cooldownMs: retryAfterMs(error?.retryAfter) || (daily ? DAILY_QUOTA_COOLDOWN_MS : RATE_COOLDOWN_MS),
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
    const kind = status === 404 ? 'NO_MODEL' : status === 402 ? 'NO_BALANCE' : 'NO_CREDENTIAL';
    const message =
      status === 404
        ? 'That model is not available on this provider'
        : status === 402
          ? 'This provider has no credit on its account'
          : 'This provider rejected our key';
    return { kind, cooldownMs: CREDENTIAL_COOLDOWN_MS, status: 502, message };
  }

  // A 400 is our request, not their host. It will fail identically next time,
  // so there is no cooldown to serve — but there is also nothing to fail over
  // to, since the next provider gets the same malformed thing.
  if (status >= 400 && status < 500) {
    return { kind: 'BAD_REQUEST', cooldownMs: 0, status: 400, message: body.slice(0, 200) || 'The model rejected the request' };
  }

  return {
    kind: 'UPSTREAM',
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
