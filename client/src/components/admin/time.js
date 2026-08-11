/**
 * The panel's two ways of saying when.
 *
 * Shared rather than copied because the choice between them is a rule, not a
 * preference, and it only stays a rule if there is one place it is written down.
 */

export const shortDate = (value) =>
  new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * How long ago, coarsely.
 *
 * A column scanned down a list wants "3d", not "3 days ago" — the unit is the
 * only part that varies and the eye is comparing magnitudes. The detail panel
 * spells the same fact out in words, where there is one of it to read.
 */
export function since(value) {
  if (!value) return '—';
  const mins = Math.round((Date.now() - new Date(value)) / 60000);
  if (!Number.isFinite(mins)) return '—';
  if (mins < 60) return 'now';
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 31) return `${days}d`;
  const months = Math.round(days / 30);
  return months < 12 ? `${months}mo` : `${Math.round(months / 12)}y`;
}

export const exact = (value) => (value ? new Date(value).toLocaleString() : 'No record of this yet');
