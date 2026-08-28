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
 * Why a sitting did not end in a solve.
 *
 * The outcome above says *whether* it went well and what that does to the row.
 * It does not say what went wrong, and these five are not shades of one problem
 * — they are four different problems with four different fixes, plus running out
 * of clock:
 *
 *   approach        never found the idea            → more patterns
 *   complexity      found one, too slow             → more optimising
 *   edge-case       right idea, off-by-one or a case you missed
 *   syntax-api      the idea was there, the language got in the way
 *   ran-out-of-time would have got there with longer
 *
 * A table rather than a bare array, for the same reason the outcomes are one:
 * `appliesWhen` is the rule that keeps this off a solve, and a rule stated here
 * cannot be forgotten by the second caller. Today every entry is `unsolved` —
 * that is the current policy and not a property of the shape.
 *
 * Kebab-case values, matching the outcome spellings, because these go into
 * everybody's history the moment the first one is written.
 */
export const FAILURE_REASONS = {
  approach: { appliesWhen: 'unsolved' },
  complexity: { appliesWhen: 'unsolved' },
  'edge-case': { appliesWhen: 'unsolved' },
  'syntax-api': { appliesWhen: 'unsolved' },
  'ran-out-of-time': { appliesWhen: 'unsolved' },
};

/**
 * The enum, plus `''` for "not said".
 *
 * Empty is a real answer and not a missing field, exactly as it is for an
 * attempt's colour: a failed sitting whose reason you did not record is a
 * different fact from one you have not looked at yet, and the schema has to be
 * able to hold the first.
 */
export const REASON_VALUES = Object.keys(FAILURE_REASONS);

/** Whether a reason may be recorded against this outcome at all. */
export const reasonAllowed = (outcome) => !outcomeEffect(outcome).solves;

/**
 * The languages a stored solution may be written in.
 *
 * The list is deliberately short. Java and C++ are what the twelve CP guides are
 * written in, so a solution here sits beside a reference in the same language;
 * JavaScript is the one this account actually works in daily. `sql` joined them
 * for the SQL Lab, where the stored solution is the query that passed.
 *
 * Adding one means adding a keyword set to
 * client/src/components/problem/highlight.js *first* — that file knows a JS
 * family, a C family and SQL, and an unlisted language does not fail, it renders
 * subtly wrong, which is worse.
 *
 * This is the list of languages a solution may be *stored* in, not the list any
 * one picker offers: `CodeEditor` takes a `langs` prop, so the Lab shows SQL
 * alone and the roadmap's attempt dialog is unchanged at three.
 *
 * `cpp` and `js` rather than `c++` and `javascript`: these are stored on every
 * attempt forever and read straight into a CSS class and a highlighter switch.
 */
export const SOLUTION_LANGS = ['java', 'cpp', 'js', 'sql'];

/** What a solution is written in when nothing said otherwise. */
export const DEFAULT_LANG = 'java';

/**
 * How long you have to spend on a problem before its editorial unlocks.
 *
 * Twenty-five minutes, and it is a hard gate rather than a warning — that was a
 * deliberate choice, because a warning you can click through at minute four is
 * a warning you click through at minute four.
 *
 * Here rather than in the client, even though the client is what draws the
 * locked link, because it is a rule about how this app is meant to be used and
 * belongs next to the other one. See the note on the gate in
 * client/src/components/problem/EditorialLink.jsx for what counts as time
 * spent — logged minutes as well as the running clock, so the gate survives a
 * closed browser.
 */
export const EDITORIAL_GATE_MINUTES = 25;

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
