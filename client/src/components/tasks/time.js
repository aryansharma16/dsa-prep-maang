/**
 * Clocks and calendars, for the board.
 *
 * Two different jobs live here and they format differently on purpose. A
 * *duration* is read at a glance while it changes, so it is monospace-friendly
 * and never says "about". A *deadline* is read once, so it says "tomorrow"
 * rather than a date the reader has to subtract today from.
 */

const MIN = 60;
const HOUR = 60 * MIN;

/**
 * A running clock: `4:07`, `1:12:30`.
 *
 * Hours appear only once there are some, so the common case is two fields wide
 * and does not jump a character the moment it passes an hour — the seconds are
 * padded, the leading field is not.
 */
export function clock(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds || 0));
  const h = Math.floor(seconds / HOUR);
  const m = Math.floor((seconds % HOUR) / MIN);
  const s = seconds % MIN;

  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/**
 * A settled total: `45m`, `2h 10m`, `3h`.
 *
 * Seconds are dropped — nobody reads "1h 12m 30s" as anything but "about an
 * hour and a quarter", and the extra field is noise in a column of them. Under
 * a minute reads as `<1m` rather than `0m`, because zero is what a broken
 * counter shows and this one worked.
 */
export function duration(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds || 0));
  if (seconds === 0) return '';
  if (seconds < MIN) return '<1m';

  const h = Math.floor(seconds / HOUR);
  const m = Math.round((seconds % HOUR) / MIN);

  if (!h) return `${m}m`;
  // 59.6 minutes rounds to 60 and "2h 60m" is not a time. Carry it.
  if (m === 60) return `${h + 1}h`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/* -------------------------------------------------------------------------- */
/* deadlines                                                                   */
/* -------------------------------------------------------------------------- */

/** Midnight local, so "is this today" is a date question and not a time one. */
const startOfDay = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

/**
 * Whole days from today to `value`. Negative is the past.
 *
 * Compared at day boundaries rather than by dividing a millisecond difference,
 * so a deadline four hours away that happens to cross midnight reads as
 * "tomorrow" and not as "today" — and so the answer does not change depending
 * on what time of day the page is open. Daylight-saving shifts are absorbed for
 * the same reason: both ends are snapped to local midnight first.
 */
export function daysUntil(value) {
  if (!value) return null;
  const then = startOfDay(value);
  const now = startOfDay(new Date());
  return Math.round((then - now) / 86400000);
}

/** The `<input type="date">` value for a date, in local time. */
export function dateInputValue(value) {
  if (!value) return '';
  const date = new Date(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * A `yyyy-mm-dd` from an input back into a Date, at local midnight.
 *
 * `new Date('2026-09-01')` parses as UTC midnight, which in any negative offset
 * is the day before — the classic off-by-one that makes a deadline show as
 * yesterday for anyone west of Greenwich. Splitting the parts and handing them
 * to the constructor keeps it local.
 */
export function dateFromInput(value) {
  if (!value) return null;
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/**
 * How a deadline reads on a card.
 *
 * Relative near the present, absolute once it is far enough away that counting
 * days stops helping: "in 23 days" is a number you have to convert, "14 Sep" is
 * one you can plan around. Overdue always counts, because how late something is
 * is the whole of what you want to know about it.
 */
export function deadlineLabel(value) {
  const days = daysUntil(value);
  if (days === null) return '';

  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  if (days < 0) return `${Math.abs(days)} days late`;
  if (days <= 6) return `In ${days} days`;

  const date = new Date(value);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/** Past its deadline and not finished. A completed task is never late. */
export const isOverdue = (task) =>
  Boolean(task.dueAt) && !task.completedAt && daysUntil(task.dueAt) < 0;

/** Due today or tomorrow, and not finished — what the card marks in amber. */
export const isDueSoon = (task) => {
  if (!task.dueAt || task.completedAt) return false;
  const days = daysUntil(task.dueAt);
  return days >= 0 && days <= 1;
};

/** `23 Aug, 14:02` — for a session row, where the exact time is the point. */
export const sessionStamp = (value) =>
  new Date(value).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
