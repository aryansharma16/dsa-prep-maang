/**
 * How long until something comes back.
 *
 * "Unavailable" and "back in 4 hours" are different messages: the first reads
 * as broken and ends the session, the second is a fact someone can plan
 * around. A daily quota has an exact reset — the server computes it as the next
 * UTC midnight — so there is no reason to be vague about it.
 */
export function untilLabel(iso) {
  if (!iso) return '';
  const ms = new Date(iso) - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return 'any moment';

  const mins = Math.round(ms / 60000);
  if (mins < 1) return 'less than a minute';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'}`;

  const hours = Math.floor(mins / 60);
  const rest = mins % 60;
  // Past a couple of hours the minutes are noise — nobody waits out 4h 07m to
  // the minute, and a number that precise invites watching it.
  if (hours >= 3 || rest === 0) return `${hours} hour${hours === 1 ? '' : 's'}`;
  return `${hours}h ${rest}m`;
}

/** Why a model cannot be picked, in words rather than a code. */
export const REASON_LABEL = {
  NO_KEY: 'no key set',
  DISABLED: 'turned off',
  NO_CREDENTIAL: 'key rejected',
  NO_BALANCE: 'needs credit',
  NO_MODEL: 'retired',
  QUOTA: 'daily limit reached',
  RATE_LIMIT: 'busy',
  TIMEOUT: 'timed out',
  NETWORK: 'unreachable',
  UPSTREAM: 'provider error',
  BAD_REQUEST: 'rejected the request',
  EMPTY: 'returned nothing',
};

export const reasonLabel = (code) => REASON_LABEL[code] || code || 'unavailable';
