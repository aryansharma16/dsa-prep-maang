import mongoose from 'mongoose';
import { Problem } from '../models/Problem.js';
import { Progress } from '../models/Progress.js';
import { currentStreak, dayKey, daysBetween, maxStreak } from './activity.service.js';

/**
 * Everything a motivational line is allowed to know about you.
 *
 * One object, built once per request, handed to every trigger predicate and to
 * the AI prompt. Keeping it a plain snapshot rather than letting predicates run
 * their own queries is what makes the whole thing cheap enough to sit on four
 * pages: three aggregations, not thirteen.
 *
 * Two deliberate choices about what "active" means:
 *
 *   The **streak** counts attempt days, because that is what the Stats page has
 *   always counted and a line quoting a different number than the tile above it
 *   is a bug people will report. Both call the same helper.
 *
 *   **solvedToday** counts solves, not activity. "Nothing solved today" has to
 *   mean nothing solved — opening a problem and closing it again is not the
 *   thing the line is congratulating.
 */

const oid = (id) => new mongoose.Types.ObjectId(id);

/** Only the shared curriculum plus this person's own problems. */
const visibleTo = (user) => ({ $or: [{ owner: null }, { owner: user }] });

/**
 * A pattern needs a few problems before "you are weakest here" means anything.
 * With no floor, a five-problem pattern at 0/5 outranks Graphs at 2/28 forever.
 */
const MIN_PATTERN_SIZE = 8;

export async function buildSignals(userId) {
  const user = oid(userId);
  const now = new Date();
  const todayKey = dayKey(now);

  const [counts, rows, byPattern] = await Promise.all([
    Progress.aggregate([
      { $match: { user } },
      {
        $group: {
          _id: null,
          solvedTotal: { $sum: { $cond: [{ $eq: ['$status', 'solved'] }, 1, 0] } },
          attemptedNotSolved: { $sum: { $cond: [{ $eq: ['$status', 'attempted'] }, 1, 0] } },
          flaggedCount: { $sum: { $cond: ['$flagged', 1, 0] } },
          dueCount: {
            $sum: {
              $cond: [
                {
                  $or: [
                    '$needsRevision',
                    {
                      $and: [
                        { $ne: ['$nextReviewAt', null] },
                        { $lte: ['$nextReviewAt', now] },
                      ],
                    },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]),

    /*
      Solve dates and attempt dates in one read, joined to the problem only for
      its difficulty. `attempts.at` alone would be enough for the streak, but
      the same rows answer "what did you solve today, and was any of it Hard",
      and two passes over the same collection to learn that would be silly.
    */
    Progress.aggregate([
      { $match: { user } },
      {
        $lookup: {
          from: 'problems',
          localField: 'problem',
          foreignField: '_id',
          pipeline: [{ $project: { difficulty: 1 } }],
          as: 'p',
        },
      },
      {
        $project: {
          _id: 0,
          status: 1,
          solvedAt: 1,
          attemptDays: '$attempts.at',
          difficulty: { $first: '$p.difficulty' },
        },
      },
    ]),

    // Per-pattern completion, over what this user can actually see.
    Problem.aggregate([
      { $match: visibleTo(user) },
      {
        $lookup: {
          from: 'progresses',
          let: { pid: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $and: [{ $eq: ['$problem', '$$pid'] }, { $eq: ['$user', user] }] },
              },
            },
            { $project: { status: 1 } },
          ],
          as: 'p',
        },
      },
      { $addFields: { status: { $ifNull: [{ $first: '$p.status' }, 'todo'] } } },
      {
        $group: {
          _id: '$patternSlug',
          total: { $sum: 1 },
          solved: { $sum: { $cond: [{ $eq: ['$status', 'solved'] }, 1, 0] } },
        },
      },
      { $lookup: { from: 'patterns', localField: '_id', foreignField: 'slug', as: 'pattern' } },
      { $addFields: { pattern: { $first: '$pattern' } } },
      {
        $project: {
          _id: 0,
          slug: '$_id',
          name: { $ifNull: ['$pattern.name', '$_id'] },
          order: '$pattern.order',
          total: 1,
          solved: 1,
        },
      },
    ]),
  ]);

  const totals = counts[0] || {
    solvedTotal: 0,
    attemptedNotSolved: 0,
    flaggedCount: 0,
    dueCount: 0,
  };

  const activeDays = new Set();
  let solvedToday = 0;
  let solvedThisWeek = 0;
  let hardSolvedToday = 0;
  let mediumSolvedToday = 0;
  let lastSolvedAt = null;

  for (const row of rows) {
    for (const at of row.attemptDays || []) activeDays.add(dayKey(at));
    // Mirrors the heatmap in stats.controller.js: a solve is its own activity
    // only when the row carries no attempts, or the day is double-counted.
    if (row.solvedAt && !(row.attemptDays || []).length) activeDays.add(dayKey(row.solvedAt));

    if (!row.solvedAt) continue;
    if (!lastSolvedAt || row.solvedAt > lastSolvedAt) lastSolvedAt = row.solvedAt;

    const age = daysBetween(row.solvedAt, now);
    if (age < 7) solvedThisWeek += 1;
    if (dayKey(row.solvedAt) !== todayKey) continue;

    solvedToday += 1;
    if (row.difficulty === 'Hard') hardSolvedToday += 1;
    if (row.difficulty === 'Medium') mediumSolvedToday += 1;
  }

  const curriculumTotal = byPattern.reduce((sum, p) => sum + p.total, 0);

  /*
    Weakest = lowest completion among patterns big enough to judge, ties broken
    by curriculum order so the earlier one wins. Fully-solved patterns are out;
    "your weakest is the one you finished" is not a sentence worth generating.
  */
  const weakest = byPattern
    .filter((p) => p.total >= MIN_PATTERN_SIZE && p.solved < p.total)
    .sort((a, b) => a.solved / a.total - b.solved / b.total || (a.order ?? 99) - (b.order ?? 99))[0];

  return {
    solvedTotal: totals.solvedTotal,
    attemptedNotSolved: totals.attemptedNotSolved,
    flaggedCount: totals.flaggedCount,
    dueCount: totals.dueCount,

    curriculumTotal,
    remaining: Math.max(0, curriculumTotal - totals.solvedTotal),
    percent: curriculumTotal ? Math.round((totals.solvedTotal / curriculumTotal) * 100) : 0,

    solvedToday,
    solvedThisWeek,
    hardSolvedToday,
    mediumSolvedToday,
    // Null when they have never solved anything — `lapsed` guards on
    // solvedTotal so it never reads this as "lapsed since the epoch".
    daysSinceLastSolve: lastSolvedAt ? daysBetween(lastSolvedAt, now) : null,

    streak: currentStreak(activeDays),
    maxStreak: maxStreak(activeDays),
    activeDays: activeDays.size,

    weakestPattern: weakest
      ? { slug: weakest.slug, name: weakest.name, solved: weakest.solved, total: weakest.total }
      : null,

    day: todayKey,
  };
}
