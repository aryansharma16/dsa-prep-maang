import { DailyLine } from '../models/DailyLine.js';
import { aiEnabled, aiFastModel, generateText } from './gemini.service.js';

/**
 * One line, written for one person, from their own numbers.
 *
 * This is the only model output a learner ever sees, and it is never a
 * learner's prompt — the input is their progress and nothing else. That is what
 * makes it safe to show without a review step.
 *
 * Everything here is best-effort. Failure returns null and the caller falls
 * back to the curated pool, the same contract leetcode.service.js has: "every
 * caller must tolerate null rather than surfacing a 500." A motivational line
 * is the last thing in this app that should be able to break a page.
 */

/**
 * Tighter than the service default, because this one sits in front of a page
 * render. Seven seconds is the most a first-visit-of-the-day should ever pay,
 * and past that the curated line is already good.
 */
const TIMEOUT_MS = 7000;

const MAX_CHARS = 240;

/**
 * How many times a day a model may be asked for one person's line.
 *
 * The line quotes live numbers, so the moment you solve something it is wrong —
 * "you solved 1 today" read at four solves is worse than no line at all. It
 * therefore has to be rewritten as you go, and that is unbounded unless
 * something bounds it. Three is enough to cover the shape of a normal session
 * (the first solve, a good run, the end of the day) on a free-tier key.
 *
 * Past the cap the AI line is simply not used and the curated pool answers
 * instead — those interpolate live signals, so they are never stale and never
 * cost anything.
 */
const MAX_PER_DAY = 3;

/**
 * The numbers a line is likely to have quoted.
 *
 * Compared exactly rather than approximately: this decides whether what is on
 * screen is still true, and "close enough" is how you end up telling someone
 * they solved one problem today when they have solved four.
 */
const QUOTED = ['solvedToday', 'solvedTotal', 'streak', 'hardSolvedToday', 'dueCount'];

const stillTrue = (snapshot, now) =>
  Boolean(snapshot) && QUOTED.every((key) => snapshot[key] === now[key]);

const SYSTEM = `You write one sentence of motivation for someone preparing for software engineering interviews by working through a curated roadmap of algorithm problems.

Rules, all of them hard:
- Exactly one sentence. Never two. No line breaks.
- Twenty-two words maximum.
- Cite at least one real number from the data you are given, and state it exactly as labelled. Never combine two of the figures into one phrase: a count of today's problems is not out of the roadmap total.
- Second person. Plain, direct, a little dry.
- No emoji. No exclamation marks. No hashtags. No quotation marks.
- Never say "champion", "warrior", "crush", "conquer", "master", "momentum", "grind", "journey", "unlock" or "let's".
- Do not congratulate someone for doing nothing, and do not scold. State what is true and what it points at.
- Return the sentence alone, with no preamble, label or surrounding punctuation.`;

/*
  Only the fields worth spending tokens on.

  The labels are laboured on purpose. An earlier version listed "Solved in
  total: 1 of 429" above "Solved today: 1" and the model merged them into "you
  solved 1 of 429 problems today" — two true numbers welded into a false
  sentence. Every count now says out loud which population it is counted
  against, and the totals are kept away from the daily figures.
*/
const promptFor = (s) =>
  [
    `Problems solved today (since midnight UTC): ${s.solvedToday}`,
    `Of those, how many were rated Hard: ${s.hardSolvedToday}`,
    `Problems solved in the last 7 days: ${s.solvedThisWeek}`,
    '',
    `Problems solved in their whole life so far: ${s.solvedTotal}`,
    `Size of the entire roadmap, all time: ${s.curriculumTotal} problems`,
    `Share of the whole roadmap finished: ${s.percent}%`,
    '',
    `Current streak: ${s.streak} days (longest ever ${s.maxStreak})`,
    s.daysSinceLastSolve === null
      ? 'Has never solved anything'
      : `Days since the last solve: ${s.daysSinceLastSolve}`,
    `Started but not finished: ${s.attemptedNotSolved}`,
    `Due for revision: ${s.dueCount}`,
    s.weakestPattern
      ? `Weakest topic: ${s.weakestPattern.name}, ${s.weakestPattern.solved} of ${s.weakestPattern.total} solved`
      : 'No clear weakest topic',
  ].join('\n');

/**
 * A model asked for one sentence will occasionally send a paragraph, a
 * markdown bullet, or the sentence wrapped in quotes. Repairing the cheap cases
 * and rejecting the rest is less work than a retry, and a rejection costs
 * nothing — the curated line is right there.
 */
function clean(raw) {
  const text = String(raw || '')
    .trim()
    .replace(/^["'`*\-\s]+|["'`*\s]+$/g, '')
    .trim();

  if (!text) return null;
  if (text.includes('\n')) return null;
  if (text.length > MAX_CHARS) return null;
  // It was told to cite a number. Nothing here means it ignored the data, which
  // is exactly the generic quote this whole feature exists to avoid.
  if (!/\d/.test(text)) return null;
  return text;
}

/*
  Two tabs opening at the same moment both miss the cache. This collapses them
  into one call — the same trick logo.service.js uses for concurrent icon
  fetches. The unique index on DailyLine catches the case this cannot see, which
  is two server processes.
*/
const inflight = new Map();

/**
 * Today's line, if there is a true one to give.
 *
 * Three outcomes, and the middle one is the whole point:
 *
 *   the stored line still matches the numbers  ->  use it, no call
 *   it does not, and we are under the cap      ->  rewrite it, one call
 *   it does not, and we are over the cap       ->  null, and the caller
 *                                                  falls back to the curated
 *                                                  pool, which is never stale
 *
 * A stale line is never returned. It quotes numbers, and a number that has
 * moved makes it a lie about the person reading it — which is worse than the
 * generic line it displaced.
 *
 * @returns {Promise<{text: string, source: 'ai'}|null>}
 */
export async function dailyLine(userId, signals) {
  // Nothing personal to say about an empty account, and generating one anyway
  // would cost a call per signup per day for a sentence about zero.
  if (!aiEnabled() || !signals?.solvedTotal) return null;

  const day = signals.day;
  const stored = await DailyLine.findOne({ user: userId, day })
    .select('text signals generations')
    .lean();

  if (stored && stillTrue(stored.signals, signals)) {
    return { text: stored.text, source: 'ai' };
  }
  // Out of budget for today: say nothing rather than something untrue.
  if (stored && stored.generations >= MAX_PER_DAY) return null;

  /*
    Keyed on the state we are generating *for*, not just the day. Two tabs at
    the same solve count share one call; a tab at a later count is a different
    question and gets its own — which is what makes the line keep up.
  */
  const key = `${userId}:${day}:${signals.solvedTotal}:${signals.solvedToday}`;
  if (inflight.has(key)) return inflight.get(key);

  const task = (async () => {
    /*
      Read once, so the model that runs and the model the row claims ran cannot
      disagree. Two names for one thing is how a table of "which model wrote
      this" quietly stops being evidence.

      The cheap tier, deliberately: this is the one call in the app whose volume
      is set by how many people signed up. The quality tier's free-tier ceiling
      is 20 requests a day, which is six or seven learners before the feature
      stops working — and the fallback to the curated pool is silent, so it
      would stop working without ever looking broken.
    */
    const model = aiFastModel();

    try {
      const text = clean(
        await generateText(promptFor(signals), {
          system: SYSTEM,
          model,
          temperature: 1,
          // Headroom over the ~30 tokens a sentence costs. The service asks for
          // minimal thinking, so this is spent on the answer rather than on
          // reasoning the answer never needed.
          maxOutputTokens: 300,
          timeoutMs: TIMEOUT_MS,
        }),
      );
      if (!text) return null;

      /*
        Upserted and counted in one write. `$inc` on generations rather than a
        read-modify-write, so two processes racing the same rewrite cannot both
        read 2 and both store 3 — the cap has to hold against exactly the
        concurrency it exists to bound.
      */
      await DailyLine.updateOne(
        { user: userId, day },
        {
          $set: { text, model, signals },
          $inc: { generations: 1 },
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true },
      );

      return { text, source: 'ai' };
    } catch (error) {
      console.warn(`[motivation] daily line failed: ${error.message}`);
      return null;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, task);
  return task;
}
