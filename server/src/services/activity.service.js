/**
 * Days, and runs of days.
 *
 * These were private to the stats controller until the motivation lines needed
 * to quote a streak back at you. Two implementations of "current streak" is the
 * kind of drift that ends with the Stats tile saying five and the line directly
 * under it saying three — so there is one, here, and both callers import it.
 *
 * Buckets are UTC. That is a real choice: a local-midnight bucket moves when
 * you travel, and a streak that breaks because you flew somewhere is worse than
 * one that rolls over a few hours early.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export const dayKey = (date) => new Date(date).toISOString().slice(0, 10);

/** Today's bucket. */
export const today = () => dayKey(new Date());

/**
 * Consecutive active days ending today — or yesterday.
 *
 * The grace day is deliberate. Without it the number collapses to zero every
 * morning and only comes back once you have done something, which reads as
 * "you lost it" at precisely the moment you are deciding whether to start.
 */
export function currentStreak(daySet) {
  let streak = 0;
  const cursor = new Date();
  if (!daySet.has(dayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!daySet.has(dayKey(cursor))) return 0;
  }
  while (daySet.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** Longest run of consecutive active days, ever. */
export function maxStreak(daySet) {
  const days = [...daySet].sort();
  let best = 0;
  let run = 0;
  let prev = null;

  for (const day of days) {
    const time = Date.parse(`${day}T00:00:00Z`);
    run = prev !== null && time - prev === DAY_MS ? run + 1 : 1;
    best = Math.max(best, run);
    prev = time;
  }
  return best;
}

/** Whole days between two dates, floored. Negative when `to` precedes `from`. */
export const daysBetween = (from, to = new Date()) =>
  Math.floor((Date.parse(dayKey(to)) - Date.parse(dayKey(from))) / DAY_MS);
