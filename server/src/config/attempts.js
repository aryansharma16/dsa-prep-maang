/**
 * The rules an attempt is written and re-written under.
 *
 * How it went, and what that means for the row it is logged against.
 *
 * The table is the rule. Before it there was an `if (outcome === 'stuck')` in
 * the controller and a hard-coded list in the popover, which is fine for three
 * outcomes and wrong for six: "solved after watching the video" solves the
 * problem *and* should bring it back around, and there is no way to say that in
 * a boolean.
 *
 * - `solves`        — marks the problem solved and advances the revision ladder.
 * - `flagsRevision` — sets `needsRevision`. Never clears it: an outcome says how
 *                     one sitting went, and it is not evidence that a flag you
 *                     set by hand no longer applies.
 *
 * The three original values keep their spelling, because they are already
 * written into everybody's history.
 */
export const ATTEMPT_OUTCOMES = {
  solved: { solves: true, flagsRevision: false },
  'solved-with-help': { solves: true, flagsRevision: false },
  'solved-after-video': { solves: true, flagsRevision: true },
  partial: { solves: false, flagsRevision: true },
  stuck: { solves: false, flagsRevision: true },
};

/** The enum, in the order the client draws the chips. */
export const OUTCOME_VALUES = Object.keys(ATTEMPT_OUTCOMES);

export const outcomeEffect = (outcome) => ATTEMPT_OUTCOMES[outcome] ?? ATTEMPT_OUTCOMES.solved;

/**
 * How long after logging an attempt you may still edit or delete it.
 *
 * The log is a record, not a draft. Left open forever it stops being evidence
 * of anything — a history you can rewrite at leisure is a history that agrees
 * with whatever you believe today, which is the opposite of what timing
 * yourself is for. Left closed entirely it punishes the ordinary mis-tap:
 * logging against the row above, or 30m when you meant 3.
 *
 * Half an hour is the window in which you are still in the sitting you just
 * logged and can remember what actually happened in it.
 *
 * Enforced on the server. The dialog counts it down and hides the controls when
 * it runs out, but that is the courtesy — this is the rule.
 */
export const ATTEMPT_EDIT_WINDOW_MS = 30 * 60 * 1000;

/**
 * When the window on an attempt closes.
 *
 * Measured from `loggedAt` — when the record was written — and never from `at`,
 * which says when the sitting happened and is the field a "log yesterday's
 * attempt" feature would let you set. Anchoring a grace period to a value its
 * beneficiary can choose is not a grace period. Attempts written before
 * `loggedAt` existed fall back to `at`, which for all of them is long past.
 */
export const attemptEditableUntil = (attempt) =>
  new Date(new Date(attempt.loggedAt || attempt.at).getTime() + ATTEMPT_EDIT_WINDOW_MS);

export const attemptEditable = (attempt, now = Date.now()) =>
  attemptEditableUntil(attempt).getTime() > now;
