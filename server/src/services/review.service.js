// Spaced repetition ladder. Solving something schedules it to come back; how
// the review actually went stretches or compresses every gap after it.
export const LADDER_DAYS = [3, 7, 21, 60];

/** How many rungs there are, for anything drawing the position on the ladder. */
export const LADDER_RUNGS = LADDER_DAYS.length;

const confidenceMultiplier = (confidence) => {
  if (confidence <= 1) return 0.4;
  if (confidence === 2) return 0.7;
  if (confidence === 3) return 1;
  if (confidence === 4) return 1.4;
  return 2;
};

const addDays = (from, days) => {
  const date = new Date(from);
  date.setDate(date.getDate() + days);
  return date;
};

/**
 * The gap after a *solve*, from the confidence you gave the sitting.
 *
 * This is the entry point onto the ladder and it is unchanged: an attempt logged
 * with four dots means something different from one logged with two, and the
 * dial in the attempt dialog is the only reading of the problem that exists at
 * that moment.
 *
 * Reviews do not come through here. They have their own reading — see
 * `scheduleReview` below and the note on why the two must not share one.
 */
export function nextReview(stage, confidence = 3, from = new Date()) {
  const baseDays = LADDER_DAYS[Math.min(stage, LADDER_DAYS.length - 1)];
  const days = Math.max(1, Math.round(baseDays * confidenceMultiplier(confidence)));
  return { nextReviewAt: addDays(from, days), days };
}

/**
 * The four answers a review can have, and what each does to the ladder.
 *
 * ---------------------------------------------------------------------------
 * Why this replaced "tick, or take it off the list".
 *
 * The queue used to have one way of saying a review went well and no way at all
 * of saying it went badly, and both halves of that were wrong.
 *
 * The tick advanced a rung and computed the gap from `confidence` — a number
 * last written by whatever attempt you logged, possibly months earlier, on a day
 * you have since forgotten. So the interval was multiplied by a stale opinion,
 * and the one moment you actually know how solid a problem is — the moment you
 * have just tried to recall it — recorded nothing.
 *
 * Failing was worse. There was no answer for it, so test mode faked one: it
 * dismissed the row and then patched `needsRevision` back on from the client, in
 * two requests, which left a problem you had just failed flagged forever and
 * still standing on the rung it had clearly not earned. A lapse has to move the
 * ladder *down*, and it never did.
 *
 * `step`       what happens to `reviewStage`.
 * `multiplier` applied to the rung you are standing on, giving the gap.
 * `fixedDays`  overrides that outright — a lapse comes back tomorrow whatever
 *              rung it fell off.
 * `confidence` what the row's confidence becomes, so the number the rest of the
 *              app reads is the most recent evidence rather than the oldest.
 * ---------------------------------------------------------------------------
 */
export const REVIEW_ANSWERS = {
  missed: { step: -1, fixedDays: 1, confidence: 1 },
  hard: { step: 0, multiplier: 0.7, confidence: 2 },
  good: { step: 1, multiplier: 1, confidence: 3 },
  easy: { step: 1, multiplier: 2, confidence: 5 },
};

/** The three that count as having recalled it. `missed` is the fourth answer. */
export const RECALL_GRADES = ['hard', 'good', 'easy'];

/** What an unqualified "I got it" means — the ladder's plain step. */
export const DEFAULT_GRADE = 'good';

export const ANSWER_VALUES = Object.keys(REVIEW_ANSWERS);

/**
 * One review, applied to the ladder.
 *
 * `stage` is the number of rungs already cleared, so the gap comes from
 * `LADDER_DAYS[stage]` — the same indexing `nextReview` uses, and the same one
 * every caller has always passed the *pre*-increment stage for.
 *
 * Returns the whole new position rather than a date, so no caller has to
 * remember that the stage moves too. Getting that wrong in one of the four
 * controllers is exactly the kind of drift this file exists to prevent.
 */
export function scheduleReview(stage, answer = DEFAULT_GRADE, from = new Date()) {
  const rule = REVIEW_ANSWERS[answer] || REVIEW_ANSWERS[DEFAULT_GRADE];
  const standing = Math.max(0, Math.min(stage, LADDER_RUNGS - 1));
  const days = rule.fixedDays ?? Math.max(1, Math.round(LADDER_DAYS[standing] * rule.multiplier));
  return {
    // Capped at the top rung and floored at the bottom one. A problem you have
    // missed twice is on rung 0 and cannot go below it, which is where a
    // problem you cannot do belongs.
    stage: Math.max(0, Math.min(LADDER_RUNGS, stage + rule.step)),
    days,
    nextReviewAt: addDays(from, days),
    confidence: rule.confidence,
  };
}

/**
 * Which review a row at this stage is *waiting for*, 1-based.
 *
 * `reviewStage` counts ladder steps taken, and the solve is the first of them —
 * so a problem solved once and never reviewed stands at stage 1 and the review
 * it is waiting for is the first. The queue used to render `stage + 1` here and
 * call that "review 2 of 4" before you had done any, which is one of those
 * off-by-ones nobody reports and everybody quietly distrusts the page for.
 */
export const reviewNumber = (stage) => Math.max(1, Math.min(stage, LADDER_RUNGS));

/**
 * The rest of the schedule, said in dates.
 *
 * The queue could tell you a problem was due today and nothing else — not when
 * it would come back, not how many more times, not whether you were nearly done
 * with it. "Review 2 of 4" was on the row and the other half of that sentence,
 * the dates, existed only in the database.
 *
 * So this walks the rungs still to come and gives each one a date, assuming the
 * plain answer every time. It is a forecast and the page says so: answer `easy`
 * once and every date after it moves. The alternative — showing nothing because
 * the future is uncertain — is what the page did before, and "when does this
 * stop coming back" is a question a revision queue should be able to answer.
 *
 * `from` is when the review at `stage` happens, so what comes back is strictly
 * the reviews *after* that one. Always at least one entry: a problem past the
 * last rung repeats at sixty days forever, and an empty list would read as
 * "never again".
 */
export function reviewPlan(stage, from = new Date()) {
  const plan = [];
  let at = new Date(from);
  let standing = Math.max(0, stage);

  const steps = Math.max(1, LADDER_RUNGS - standing);
  for (let i = 0; i < steps; i += 1) {
    const step = scheduleReview(standing, DEFAULT_GRADE, at);
    standing = step.stage;
    at = step.nextReviewAt;
    plan.push({
      review: reviewNumber(standing),
      days: step.days,
      at,
      // The last rung repeats rather than ending, and the client says so
      // instead of implying the problem is finished with.
      repeats: standing >= LADDER_RUNGS,
    });
  }

  return plan;
}

/**
 * What each of the four buttons would do, in days and in dates.
 *
 * Computed here and shipped with the row so the buttons can be labelled with
 * the real answer — "Good · 21 Sep" rather than a tick you press and hope about.
 * A client that worked these out itself would eventually disagree with the date
 * the server actually writes, which is the one number on the page that has to be
 * true.
 */
export function reviewChoices(stage, from = new Date()) {
  return Object.fromEntries(
    ANSWER_VALUES.map((answer) => {
      const step = scheduleReview(stage, answer, from);
      return [answer, { days: step.days, at: step.nextReviewAt, stage: step.stage }];
    }),
  );
}
