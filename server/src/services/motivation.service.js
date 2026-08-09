import { TRIGGERS, thresholdFor } from '../config/motivationTriggers.js';
import { Motivation } from '../models/Motivation.js';

/**
 * Choosing the line.
 *
 * The rule this file exists to enforce is that the *most specific* true thing
 * wins. A pool of two hundred lines where "work hard" competes on equal terms
 * with "you just put away a Hard" is a quote API with extra steps; sorting by
 * `specificity` first is what makes it feel like the app is paying attention.
 */

/** `{token}` → a real number or name. */
const TOKEN = /\{(\w+)\}/g;

/**
 * What each token resolves to. Anything absent leaves its token in place, and a
 * line with a leftover token is discarded rather than shown — so a line asking
 * for `{pattern}` on an account with no weak pattern quietly loses to the next
 * candidate instead of rendering braces at somebody.
 */
function tokenValues(signals) {
  const weak = signals.weakestPattern;
  return {
    pattern: weak?.name,
    patternSolved: weak?.solved,
    patternTotal: weak?.total,
    patternRemaining: weak ? weak.total - weak.solved : undefined,
    streak: signals.streak,
    maxStreak: signals.maxStreak,
    solved: signals.solvedTotal,
    total: signals.curriculumTotal,
    remaining: signals.remaining,
    percent: signals.percent,
    today: signals.solvedToday,
    week: signals.solvedThisWeek,
    due: signals.dueCount,
    attempted: signals.attemptedNotSolved,
    days: signals.daysSinceLastSolve,
  };
}

/** Returns the filled text, or null when the line asked for something we lack. */
export function interpolate(text, values) {
  let missing = false;
  const filled = text.replace(TOKEN, (whole, key) => {
    const value = values[key];
    if (value === undefined || value === null || value === '') {
      missing = true;
      return whole;
    }
    return String(value);
  });
  return missing ? null : filled;
}

/**
 * FNV-1a. Small, dependency-free, and — the only property that matters here —
 * stable: the same string always picks the same line.
 */
function hash(seed) {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/**
 * The seed behind "it holds still until something changes".
 *
 * Every value in here is one the user can move. Solve a problem and
 * `solvedTotal` changes, so the line changes; navigate away and back and
 * nothing has, so it does not. Rotating on the day as well means a pool of
 * fifty `always` lines is not the same fifty-first of the time forever.
 */
const seedFor = (userId, surface, signals, nonce) =>
  [
    userId || 'anon',
    surface,
    signals.day || '',
    signals.solvedTotal ?? '',
    signals.solvedToday ?? '',
    signals.streak ?? '',
    nonce ?? '',
  ].join(':');

/**
 * How far below the winner a condition may still be drawn from.
 *
 * Taking only the single highest tier looks right and is not: several
 * conditions are true at once and most of them are *persistent*. Someone with a
 * weak pattern, a streak and a revision backlog satisfies all three every day,
 * so a strict maximum hands them the same category of line forever, and the
 * whole thing decays back into the wallpaper it exists not to be.
 *
 * The band keeps that from happening without letting the generic pool back in.
 * Twenty points is enough to gather the persistent conditions together — they
 * are deliberately clustered around 40-52 in the trigger table — while still
 * excluding `always` at 0 whenever anything specific is true, and excluding all
 * of them the moment something momentary like "you just solved a Hard" fires
 * from the 68-95 band above.
 */
const BAND = 20;

/**
 * Thresholds are a ladder, not a set.
 *
 * Six streak lines at 3, 7, 14, 30, 60 and 100 days all match at day 100, and
 * without this the draw could tell someone on a hundred-day streak that three
 * days is "not impressive yet". Only the highest rung a person has actually
 * reached stays in the running.
 */
function topThresholdOnly(candidates) {
  const ceiling = new Map();
  for (const c of candidates) {
    if (c.threshold === null) continue;
    const seen = ceiling.get(c.trigger);
    if (seen === undefined || c.threshold > seen) ceiling.set(c.trigger, c.threshold);
  }
  return candidates.filter(
    (c) => c.threshold === null || c.threshold === ceiling.get(c.trigger),
  );
}

/**
 * Picks one line for a surface, or null when nothing matches.
 *
 * @param {object}  args
 * @param {string}  args.surface   login | roadmap | stats | profile | revision
 * @param {object}  args.signals   from buildSignals, or `{}` for a logged-out visitor
 * @param {string} [args.userId]   only used to keep the pick stable per person
 * @param {string} [args.nonce]    breaks the stability on purpose. The signed-out
 *                                 page passes one: with no signals every part of
 *                                 the seed is constant, so without it every
 *                                 visitor would see the same line forever.
 */
export async function pickLine({ surface, signals = {}, userId, nonce }) {
  const rows = await Motivation.find({ active: true, surfaces: surface })
    .select('text trigger threshold weight')
    .lean();

  if (rows.length === 0) return null;

  const values = tokenValues(signals);

  const candidates = [];
  for (const row of rows) {
    const trigger = TRIGGERS[row.trigger];
    // A row whose trigger was removed from the vocabulary is skipped, not
    // crashed on. Config outlives data here, and the reverse happens too.
    if (!trigger) continue;

    const threshold = thresholdFor(row.trigger, row.threshold);
    if (!trigger.test(signals, threshold)) continue;

    const text = interpolate(row.text, values);
    if (!text) continue;

    candidates.push({
      text,
      threshold,
      trigger: row.trigger,
      specificity: trigger.specificity,
      weight: row.weight,
    });
  }
  if (candidates.length === 0) return null;

  const pool = [];
  const best = Math.max(...candidates.map((c) => c.specificity));
  for (const c of topThresholdOnly(candidates)) {
    if (c.specificity < best - BAND) continue;
    // Weight is how many slots a line takes in the draw, not a priority — a
    // 5-weight line is five times as likely as a 1, never guaranteed.
    for (let i = 0; i < (c.weight || 1); i += 1) pool.push(c);
  }

  const chosen = pool[hash(seedFor(userId, surface, signals, nonce)) % pool.length];
  return { text: chosen.text, trigger: chosen.trigger, source: 'curated' };
}
