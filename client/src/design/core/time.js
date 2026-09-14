/**
 * "Edited 3 hours ago", in the compact form the project cards and the
 * explorer use. Pure, so it is tested with the rest of design/.
 */

const UNITS = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

export function timeAgo(when, now = Date.now()) {
  if (!when) return '';
  const seconds = Math.max(0, Math.round((now - new Date(when).getTime()) / 1000));
  if (seconds < 45) return 'just now';
  for (const [unit, size] of UNITS) {
    const value = Math.floor(seconds / size);
    if (value >= 1) return `${value} ${unit}${value === 1 ? '' : 's'} ago`;
  }
  return 'just now';
}

/** Days until a trashed item is deleted for good, never negative. */
export function daysLeft(expiresAt, now = Date.now()) {
  if (!expiresAt) return 0;
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / (24 * 3600 * 1000)));
}
