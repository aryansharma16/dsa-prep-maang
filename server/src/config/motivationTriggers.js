/**
 * When a motivational line is allowed to fire.
 *
 * The admin panel needs to let someone say "show this one on a seven-day
 * streak" without writing code, and the server needs to be sure that whatever
 * they picked cannot become a runtime error on a page every user loads. So the
 * predicates live here and the panel only ever chooses a key from this table
 * plus, where it makes sense, one number.
 *
 * Two fields carry the whole design:
 *
 *   specificity  which line wins when several match. A line about the Hard you
 *                just solved must beat a general one about hard work, or the
 *                system collapses back into the random quote API it exists not
 *                to be.
 *
 *   threshold    the number the admin sets, or null when the condition takes
 *                none. The panel renders the input off this, so adding a
 *                trigger never means touching the form.
 *
 * The numbers are not a neat 10-20-30 ladder, and that is deliberate. They fall
 * into three bands, and what separates the bands is *how long the condition
 * stays true*:
 *
 *   0        `always`, the fallback pool.
 *
 *   40-52    persistent state — a weak pattern, a streak, a revision backlog,
 *            a milestone passed. All true at once for most people, most days.
 *            They sit close together on purpose: the picker draws from a band
 *            rather than a single tier (see BAND in motivation.service.js), so
 *            these rotate against each other instead of one monopolising every
 *            page for months.
 *
 *   68-95    momentary or exceptional — you solved something today, you solved
 *            a Hard, you have been away a fortnight, you have never started.
 *            Far enough above the persistent band to sweep it entirely, because
 *            when one of these is true it is the only thing worth saying.
 *
 * So moving a trigger between bands changes behaviour; moving it inside one
 * mostly does not.
 *
 * Every `test` reads its signals defensively. The public login endpoint has no
 * user and passes `{}`, so everything except `always` is false and the
 * "logged-out visitors only see generic lines" rule falls out of the data
 * rather than being a special case someone has to remember.
 */

export const TRIGGERS = {
  always: {
    label: 'Any time',
    hint: 'No condition. The fallback pool.',
    specificity: 0,
    threshold: null,
    test: () => true,
  },

  nothing_today: {
    label: 'Nothing solved today',
    hint: 'They have solved before, but not yet today.',
    specificity: 45,
    threshold: null,
    test: (s) => (s.solvedTotal ?? 0) > 0 && (s.solvedToday ?? 0) === 0,
  },

  first_of_day: {
    label: 'First solve of the day',
    hint: 'Exactly one solved today.',
    specificity: 68,
    threshold: null,
    test: (s) => (s.solvedToday ?? 0) === 1,
  },

  milestone_solved: {
    label: 'Solved N or more, ever',
    hint: 'A running total, not an exact hit — set several and the highest wins.',
    specificity: 42,
    threshold: { default: 50, min: 1, max: 1000, unit: 'problems' },
    test: (s, n) => (s.solvedTotal ?? 0) >= n,
  },

  attempted_stuck: {
    label: 'N or more attempted but unsolved',
    hint: 'A pile of half-finished problems.',
    specificity: 40,
    threshold: { default: 5, min: 1, max: 200, unit: 'problems' },
    test: (s, n) => (s.attemptedNotSolved ?? 0) >= n,
  },

  percent_reached: {
    label: 'N% of the roadmap done',
    hint: 'Share of every problem visible to them.',
    specificity: 44,
    threshold: { default: 50, min: 1, max: 100, unit: '%' },
    test: (s, n) => (s.percent ?? 0) >= n,
  },

  strong_day: {
    label: 'Solved N or more today',
    hint: 'A good session, while it is still happening.',
    specificity: 72,
    threshold: { default: 5, min: 2, max: 50, unit: 'today' },
    test: (s, n) => (s.solvedToday ?? 0) >= n,
  },

  streak_reached: {
    label: 'Streak of N or more days',
    hint: 'The same streak the Stats page shows.',
    specificity: 52,
    threshold: { default: 7, min: 2, max: 365, unit: 'days' },
    test: (s, n) => (s.streak ?? 0) >= n,
  },

  revision_due: {
    label: 'N or more due for revision',
    hint: 'Scheduled reviews plus anything flagged by hand.',
    specificity: 48,
    threshold: { default: 1, min: 1, max: 200, unit: 'problems' },
    test: (s, n) => (s.dueCount ?? 0) >= n,
  },

  hard_today: {
    label: 'Solved a Hard today',
    hint: 'The one worth saying something about.',
    specificity: 75,
    threshold: null,
    test: (s) => (s.hardSolvedToday ?? 0) > 0,
  },

  weak_pattern: {
    label: 'Has a clear weakest pattern',
    hint: 'Use {pattern}, {patternSolved} and {patternTotal} in the text.',
    specificity: 50,
    threshold: null,
    test: (s) => Boolean(s.weakestPattern),
  },

  lapsed: {
    label: 'No solve in N or more days',
    hint: 'For coming back, not for scolding.',
    specificity: 80,
    threshold: { default: 3, min: 1, max: 90, unit: 'days' },
    test: (s, n) => (s.solvedTotal ?? 0) > 0 && (s.daysSinceLastSolve ?? 0) >= n,
  },

  no_solves_ever: {
    label: 'Has never solved anything',
    hint: 'A brand new account. Nothing else should outrank this.',
    specificity: 95,
    threshold: null,
    // Strict, with no `?? 0`: the login endpoint passes no signals at all, and
    // "we know nothing about you" must not read as "you have solved nothing".
    test: (s) => s.solvedTotal === 0,
  },
};

export const TRIGGER_KEYS = Object.keys(TRIGGERS);

/**
 * Sent to the panel so the dropdown, the threshold input and its help text are
 * all built from this file — the same trick `capsFor` plays with the permission
 * matrix. Predicates are deliberately not included: they are server logic, and
 * shipping them would invite someone to evaluate them in the browser.
 */
export const triggerCatalogue = () =>
  TRIGGER_KEYS.map((key) => ({
    key,
    label: TRIGGERS[key].label,
    hint: TRIGGERS[key].hint,
    specificity: TRIGGERS[key].specificity,
    threshold: TRIGGERS[key].threshold,
  }));

/** The threshold to use when a row does not carry its own. */
export const thresholdFor = (trigger, stored) => {
  const spec = TRIGGERS[trigger]?.threshold;
  if (!spec) return null;
  return typeof stored === 'number' ? stored : spec.default;
};

export const CATEGORIES = [
  'grind',
  'big-tech',
  'money',
  'global',
  'people',
  'tech',
  'ai',
  'elite',
  'quant',
  'career',
];

/** Where a line may appear. `login` is the only one a logged-out visitor sees. */
export const SURFACES = ['login', 'roadmap', 'stats', 'profile', 'revision'];
