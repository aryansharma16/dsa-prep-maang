/**
 * How an attempt is written down and how it reads back.
 *
 * The values mirror `OUTCOME_VALUES` in server/src/config/attemptOutcomes.js,
 * for the reason `hues.js` mirrors the board's palette: the server owns which
 * outcomes are legal and what each one does to the row, the client owns what
 * they are called and what colour they wear. A value here that the server does
 * not know is rejected by the enum; a value there that is missing here falls
 * back to its own slug rather than rendering blank.
 *
 * `tone` is a class, not a colour. `good` is the problem answered, `mixed` is
 * answered with something helping, `bad` is not answered — three tones over
 * five outcomes, because the chip's job in a table is to be read at a glance
 * and five hues in one cell is not a glance.
 *
 * `solves` and `flagsRevision` mirror the server's effect table. They are here
 * only so the row can apply the same change on the same frame it is clicked and
 * be right about it — the server decides, and its answer replaces this a
 * moment later. Disagreeing with it makes the row flicker, not lie.
 */
export const OUTCOMES = [
  {
    value: 'solved',
    solves: true,
    flagsRevision: false,
    label: 'Solved',
    short: 'Solved',
    tone: 'good',
    hint: 'Got it on your own',
  },
  {
    value: 'solved-with-help',
    solves: true,
    flagsRevision: false,
    label: 'With hints',
    short: 'Hints',
    tone: 'mixed',
    hint: 'Needed a nudge — a hint, a tag, a peek at the discussion',
  },
  {
    value: 'solved-after-video',
    solves: true,
    flagsRevision: true,
    label: 'After video',
    short: 'Video',
    tone: 'mixed',
    hint: 'Watched the walkthrough or the editorial, then wrote it. Flags the problem for revision',
  },
  {
    value: 'partial',
    solves: false,
    flagsRevision: true,
    label: 'Partial',
    short: 'Partial',
    tone: 'bad',
    hint: 'Brute force, or it did not pass. Flags the problem for revision',
  },
  {
    value: 'stuck',
    solves: false,
    flagsRevision: true,
    label: 'Stuck',
    short: 'Stuck',
    tone: 'bad',
    hint: 'No real progress. Flags the problem for revision',
  },
];

const BY_VALUE = Object.fromEntries(OUTCOMES.map((o) => [o.value, o]));

/** Never null — an outcome from a newer deploy still has to render. */
export const outcomeOf = (value) =>
  BY_VALUE[value] || {
    value,
    label: value,
    short: value,
    tone: 'mixed',
    hint: '',
    solves: true,
    flagsRevision: false,
  };

/** The presets, in the order the row draws them. */
export const TIME_PRESETS = [5, 15, 30, 45, 60, 90];

/**
 * `23 Aug` / `23 Aug 2025` — an attempt's date, in a chip.
 *
 * The year appears only when it is not this one, which is the difference
 * between a stamp you read and a stamp you skip.
 */
export const attemptDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
};

/** `23 Aug, 14:02` — the same stamp where the hour is worth having. */
export const attemptStamp = (value) =>
  new Date(value).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

/** `45m`, `1h 10m`. Minutes are the unit an attempt is stored in. */
export const minutesLabel = (minutes) => {
  const m = Math.max(0, Math.round(minutes || 0));
  if (!m) return '—';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h}h ${rest}m` : `${h}h`;
};

/** One line describing an attempt, for a `title=`. */
export const attemptTitle = (attempt) => {
  const parts = [
    attemptStamp(attempt.at),
    outcomeOf(attempt.outcome).label,
    minutesLabel(attempt.minutes),
  ];
  if (attempt.timed) parts.push('timed');
  // Only when it was recorded. The attempts logged before confidence was kept
  // per sitting have none, and a "0 of 5" would read as the worst possible
  // answer to a question nobody asked.
  if (attempt.confidence) parts.push(`felt ${attempt.confidence}/5`);
  const head = parts.join(' · ');
  return attempt.note ? `${head}\n${attempt.note}` : head;
};

/**
 * How long after logging an attempt you may still edit or delete it.
 *
 * A mirror of `ATTEMPT_EDIT_WINDOW_MS` in server/src/config/attempts.js, kept
 * here for the reason the outcome table is: the server owns the rule and
 * enforces it, the client owns how it is shown. Drifting low only hides
 * controls early; drifting high offers an Edit the server then refuses, which
 * is the failure worth avoiding.
 */
export const EDIT_WINDOW_MS = 30 * 60 * 1000;

/**
 * Milliseconds left on an attempt's window, floored at zero.
 *
 * Measured from `loggedAt` and not from `at` — the first is when the record was
 * written and cannot be changed, the second is when the sitting happened. They
 * are the same instant today. Attempts written before `loggedAt` existed fall
 * back to `at`, which for all of them is long past, so they read as locked.
 */
export const editWindowLeft = (attempt, now = Date.now()) => {
  const from = new Date(attempt.loggedAt || attempt.at).getTime();
  if (!Number.isFinite(from)) return 0;
  return Math.max(0, from + EDIT_WINDOW_MS - now);
};

/** An attempt with no id was written before ids and can never be addressed. */
export const isEditable = (attempt, now = Date.now()) =>
  Boolean(attempt._id) && editWindowLeft(attempt, now) > 0;

/**
 * `29m left` / `40s left`.
 *
 * Minutes until the last one, then seconds — the difference between "I have
 * time" and "decide now", which is exactly what the last minute is.
 */
export const windowLabel = (ms) => {
  if (ms <= 0) return '';
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) return `${seconds}s left`;
  return `${Math.ceil(seconds / 60)}m left`;
};
