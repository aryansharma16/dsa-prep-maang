/**
 * Dates, as a revision queue has to say them.
 *
 * The page used to speak entirely in relative days — "due in 5d", "3d overdue" —
 * and that is the wrong half of the fact. A relative day answers "is this
 * urgent"; it cannot answer "what is Saturday like", "when does this stop coming
 * back", or "did I already do this one this week". Those are the questions you
 * open a schedule to ask, and none of them survive a page with no dates on it.
 *
 * So everything here comes in both: a real date, and the relative word next to
 * it. Neither replaces the other.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Midnight local, so "tomorrow" does not depend on what time it is now. */
const midnight = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

/**
 * Whole days from today to `value`, counted in calendar days rather than in
 * 24-hour blocks. A review due at 09:00 tomorrow is "tomorrow" at any hour of
 * today, which is what a person means by it.
 */
export const daysUntil = (value) =>
  value ? Math.round((midnight(value) - midnight(new Date())) / DAY_MS) : null;

/**
 * `Mon 14 Sep`, or `14 Sep 2027` once the year stops being obvious.
 *
 * The weekday earns its four characters on this page specifically: a revision
 * plan is read against the week you are actually going to have, and "Sat 12 Sep"
 * tells you something "12 Sep" does not.
 */
export const dateLabel = (value, { weekday = true } = {}) => {
  if (!value) return '';
  const date = new Date(value);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(undefined, {
    ...(weekday && sameYear ? { weekday: 'short' } : {}),
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
};

/** `today`, `tomorrow`, `in 5 days`, `4 days ago`. */
export const dayWord = (days) => {
  if (days === null || days === undefined) return '';
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  return days > 0 ? `in ${days} days` : `${Math.abs(days)} days ago`;
};

/**
 * `+7d`, `+3mo`, `+1y` — a gap, in the shortest true unit.
 *
 * On a button rather than in prose, which is why it is this short: four of these
 * sit side by side under four one-word labels, and `+120 days` in that space is
 * a button that wraps.
 */
export const gapLabel = (days) => {
  if (!days && days !== 0) return '';
  if (days < 31) return `+${days}d`;
  if (days < 365) return `+${Math.round(days / 30)}mo`;
  return `+${(days / 365).toFixed(days % 365 ? 1 : 0)}y`;
};

/**
 * How a due row reads at the top of its cell.
 *
 * Three states and they are genuinely different: overdue is late work, today is
 * the work, and a flag is something you asked for with no date attached at all.
 * The old page collapsed the third into "Marked for revision" and left it
 * looking like a fourth kind of schedule.
 */
export const dueTone = (item) => {
  if (item.dueReason === 'marked') return 'flagged';
  const days = daysUntil(item.progress?.nextReviewAt);
  if (days === null) return 'flagged';
  if (days < 0) return 'overdue';
  return 'today';
};

export const dueHeadline = (item) => {
  const tone = dueTone(item);
  if (tone === 'flagged') return 'You flagged it';
  const days = daysUntil(item.progress.nextReviewAt);
  if (days < 0) return `${Math.abs(days)} ${Math.abs(days) === 1 ? 'day' : 'days'} late`;
  return 'Due today';
};

/** Rows of the same day, in the order they will be worked. */
export const groupByDay = (rows, at) => {
  const days = new Map();
  for (const row of rows) {
    const when = at(row);
    if (!when) continue;
    const key = midnight(when).toISOString();
    if (!days.has(key)) days.set(key, { at: when, rows: [] });
    days.get(key).rows.push(row);
  }
  return [...days.values()].sort((a, b) => new Date(a.at) - new Date(b.at));
};
