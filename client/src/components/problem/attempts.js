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

/**
 * Why a sitting did not end in a solve.
 *
 * A mirror of `FAILURE_REASONS` in server/src/config/attempts.js, kept here for
 * the reason the outcome table above is: the server owns which values are legal
 * and when they may be recorded, this owns what they are called.
 *
 * The five are not degrees of one failure. Each names a different missing
 * skill, and after two hundred problems the histogram of them is the most
 * actionable thing in the app — "I keep failing on edge cases" and "I keep
 * failing to find the idea" are the same row on a stats page today and want
 * opposite weeks of practice.
 *
 * Offered only on an outcome that did not solve. The server drops one sent
 * against a solving outcome rather than rejecting the log — see the transform
 * on `attemptSchema` there.
 */
export const FAILURE_REASONS = [
  {
    value: 'approach',
    label: 'No approach',
    short: 'Approach',
    hint: 'Never found the idea. The fix is more patterns, not more effort',
  },
  {
    value: 'complexity',
    label: 'Too slow',
    short: 'Slow',
    hint: 'Found something that worked and it was not fast enough',
  },
  {
    value: 'edge-case',
    label: 'Edge case',
    short: 'Edge',
    hint: 'Right idea, wrong details — off-by-one, empty input, overflow',
  },
  {
    value: 'syntax-api',
    label: 'Language',
    short: 'Syntax',
    hint: 'The idea was there and the language got in the way. This is what the ladder fixes',
  },
  {
    value: 'ran-out-of-time',
    label: 'Ran out of time',
    short: 'Time',
    hint: 'On the way there when the clock went',
  },
];

const REASON_BY_VALUE = Object.fromEntries(FAILURE_REASONS.map((r) => [r.value, r]));

/** Null for `''` — "not said" draws nothing, rather than a chip saying nothing. */
export const reasonOf = (value) =>
  value ? REASON_BY_VALUE[value] || { value, label: value, short: value, hint: '' } : null;

/**
 * The languages a solution may be stored in.
 *
 * Mirrors `SOLUTION_LANGS` on the server. `id` is what is stored and what
 * `highlight()` is handed; `label` is what the picker shows. Adding one means
 * adding a keyword set to highlight.js first — it knows a JS family, a C family
 * and SQL, and an unlisted language renders subtly wrong rather than failing.
 *
 * Storable is not the same as offered, and the two lists below are that
 * distinction. This one is every language an attempt may carry — it is what
 * `langLabel` reads, so a stored SQL attempt is labelled correctly wherever it
 * is rendered. What a *picker* shows is `CodeEditor`'s `langs` prop.
 */
export const SOLUTION_LANGS = [
  { id: 'java', label: 'Java' },
  { id: 'cpp', label: 'C++' },
  { id: 'js', label: 'JavaScript' },
  { id: 'sql', label: 'SQL' },
];

/**
 * What the roadmap and the ladder offer, and `CodeEditor`'s default.
 *
 * SQL is missing on purpose: a graph problem's attempt dialog has no business
 * offering it, and the four-wide picker that fell out of simply appending to the
 * list above was the whole reason these are two lists.
 */
export const PROBLEM_LANGS = SOLUTION_LANGS.filter((l) => l.id !== 'sql');

/** The Lab's picker: one entry, drawn as a label rather than a choice. */
export const SQL_ONLY = SOLUTION_LANGS.filter((l) => l.id === 'sql');

export const DEFAULT_LANG = 'java';

export const langLabel = (id) => SOLUTION_LANGS.find((l) => l.id === id)?.label || id || '';

/**
 * How long you have to spend on a problem before its editorial unlocks.
 *
 * A mirror of `EDITORIAL_GATE_MINUTES` in server/src/config/attempts.js. Unlike
 * the outcome and reason tables above, the server does not enforce this one —
 * it cannot, because the editorial is a link to leetcode.com and takeuforward
 * that never touches this API. That makes it the one rule here that is honestly
 * a rule you are keeping rather than a rule you are held to, which is why the
 * gate is a hard block in the UI rather than a warning: a rule with no enforcer
 * needs the friction to be real.
 *
 * It still lives on the server because it is a statement about how the app is
 * meant to be used, and belongs beside the outcome table rather than only in a
 * component.
 */
export const EDITORIAL_GATE_MINUTES = 25;

/** The presets, in the order the row draws them. */
export const TIME_PRESETS = [5, 15, 30, 45, 60, 90];

/**
 * What each of the five dots means, in words.
 *
 * The dial had a heading, five dots and a sentence about what it *does*, and no
 * statement anywhere of what the numbers themselves mean — so a 3 was whatever
 * you felt a 3 was on the day, and the series the log is supposed to make out of
 * them ("2 → 3 → 4 over three sittings") was measured against a moving ruler.
 *
 * The multiplier each one applies to the next gap is the server's — see
 * `confidenceMultiplier` in services/review.service.js — and is quoted here so
 * the dial can say what it is about to cost you.
 */
export const CONFIDENCE_WORDS = {
  1: { word: 'Lost', say: 'Could not do this again tomorrow', mult: '0.4×' },
  2: { word: 'Shaky', say: 'It went in, and it would not go in cold', mult: '0.7×' },
  3: { word: 'Fine', say: 'Ordinary. I would get there again', mult: '1×' },
  4: { word: 'Solid', say: 'Comfortable — I saw the approach quickly', mult: '1.4×' },
  5: { word: 'Cold', say: 'I could write this from memory, or teach it', mult: '2×' },
};

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
