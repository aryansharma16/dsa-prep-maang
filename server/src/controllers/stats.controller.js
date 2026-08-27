import mongoose from 'mongoose';
import { Problem } from '../models/Problem.js';
import { Progress } from '../models/Progress.js';
// Shared with the motivation lines, which quote the streak back at you — one
// implementation, so the tile and the line can never disagree.
import { currentStreak, dayKey, maxStreak } from '../services/activity.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const oid = (id) => new mongoose.Types.ObjectId(id);

/** GET /api/stats — everything the stats page needs, in one request. */
export const getStats = asyncHandler(async (req, res) => {
  const user = oid(req.userId);

  const [byDifficulty, byPattern, byCompany, totals, activity, byLeak] = await Promise.all([
    // Solved vs available, split by difficulty
    Problem.aggregate([
      { $match: { $or: [{ owner: null }, { owner: user }] } },
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
          _id: '$difficulty',
          total: { $sum: 1 },
          solved: { $sum: { $cond: [{ $eq: ['$status', 'solved'] }, 1, 0] } },
        },
      },
      { $project: { _id: 0, difficulty: '$_id', total: 1, solved: 1 } },
    ]),

    Problem.aggregate([
      { $match: { $or: [{ owner: null }, { owner: user }] } },
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
      { $sort: { 'pattern.order': 1 } },
      {
        $project: {
          _id: 0,
          slug: '$_id',
          name: { $ifNull: ['$pattern.name', '$_id'] },
          total: 1,
          solved: 1,
        },
      },
    ]),

    // Coverage per company — "how ready am I for Google?" needs solved AND the
    // total they ask, otherwise 12 solved means nothing.
    Problem.aggregate([
      { $match: { $or: [{ owner: null }, { owner: user }] } },
      { $unwind: '$companies' },
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
          _id: '$companies.name',
          total: { $sum: 1 },
          solved: { $sum: { $cond: [{ $eq: ['$status', 'solved'] }, 1, 0] } },
        },
      },
      { $sort: { total: -1 } },
      { $limit: 12 },
      { $project: { _id: 0, name: '$_id', total: 1, solved: 1 } },
    ]),

    Progress.aggregate([
      { $match: { user } },
      {
        $group: {
          _id: null,
          tracked: { $sum: 1 },
          solved: { $sum: { $cond: [{ $eq: ['$status', 'solved'] }, 1, 0] } },
          attempted: { $sum: { $cond: [{ $eq: ['$status', 'attempted'] }, 1, 0] } },
          flagged: { $sum: { $cond: ['$flagged', 1, 0] } },
          needsRevision: { $sum: { $cond: ['$needsRevision', 1, 0] } },
          minutes: { $sum: { $sum: '$attempts.minutes' } },
        },
      },
    ]),

    Progress.find({ user }).select('attempts solvedAt').lean(),

    /*
      The leak report — which patterns are actually hard *for you*.

      The `byPattern` aggregation above answers "how far through each pattern am
      I", which is coverage, and coverage is a plan's question rather than a
      learner's. It cannot tell a pattern you have not started from one you have
      fought through twice: 22/27 looks identical whether those 22 went in first
      time or needed the editorial on nine of them.

      This reads the attempt log instead, which is where that difference lives:

        attempts   how many sittings the pattern has cost
        assisted   solves that needed a hint, a video, or an editorial peek
        failed     sittings that ended without a solve
        reasons    what went wrong on those, by kind
        minutes    total time in the pattern

      `relearn` — attempts per solved problem — is the number the client ranks
      by. One is clean; two means everything in that pattern took two goes.

      Only over problems that have actually been attempted, so a pattern you have
      never opened does not appear at the top of a "weakest" list. Not knowing
      something yet is not the same as being bad at it, and only one of the two
      is worth a week of revision.
    */
    Progress.aggregate([
      { $match: { user } },
      { $unwind: '$attempts' },
      {
        $lookup: {
          from: 'problems',
          localField: 'problem',
          foreignField: '_id',
          as: 'prob',
        },
      },
      { $unwind: '$prob' },
      {
        $group: {
          _id: '$prob.patternSlug',
          attempts: { $sum: 1 },
          minutes: { $sum: '$attempts.minutes' },
          solvedProblems: {
            $addToSet: { $cond: [{ $eq: ['$status', 'solved'] }, '$problem', '$$REMOVE'] },
          },
          problems: { $addToSet: '$problem' },
          assisted: {
            $sum: {
              $cond: [
                {
                  $in: ['$attempts.outcome', ['solved-with-help', 'solved-after-video']],
                },
                1,
                0,
              ],
            },
          },
          peeked: { $sum: { $cond: ['$attempts.peeked', 1, 0] } },
          failed: {
            $sum: { $cond: [{ $in: ['$attempts.outcome', ['partial', 'stuck']] }, 1, 0] },
          },
          // Kept as a flat list and counted on the client, so adding a reason to
          // config/attempts.js does not mean editing an aggregation here too.
          reasons: {
            $push: { $cond: [{ $ne: ['$attempts.reason', ''] }, '$attempts.reason', '$$REMOVE'] },
          },
        },
      },
      {
        $project: {
          _id: 0,
          slug: '$_id',
          attempts: 1,
          minutes: 1,
          assisted: 1,
          peeked: 1,
          failed: 1,
          reasons: 1,
          touched: { $size: '$problems' },
          solved: { $size: '$solvedProblems' },
        },
      },
      { $sort: { attempts: -1 } },
    ]),
  ]);

  // Contribution-style heatmap: one bucket per day from attempts + solve dates.
  const counts = new Map();
  for (const row of activity) {
    for (const attempt of row.attempts || []) {
      const key = dayKey(attempt.at);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    if (row.solvedAt && !(row.attempts || []).length) {
      const key = dayKey(row.solvedAt);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }

  const heatmap = [...counts.entries()]
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const activeDays = new Set(counts.keys());

  res.json({
    totals: totals[0] || {
      tracked: 0,
      solved: 0,
      attempted: 0,
      flagged: 0,
      needsRevision: 0,
      minutes: 0,
    },
    byDifficulty,
    byPattern,
    byCompany,
    byLeak,
    heatmap,
    activity: {
      events: [...counts.values()].reduce((a, b) => a + b, 0),
      activeDays: activeDays.size,
      streak: currentStreak(activeDays),
      maxStreak: maxStreak(activeDays),
    },
    streak: currentStreak(activeDays),
  });
});
