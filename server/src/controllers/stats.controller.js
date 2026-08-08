import mongoose from 'mongoose';
import { Problem } from '../models/Problem.js';
import { Progress } from '../models/Progress.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const oid = (id) => new mongoose.Types.ObjectId(id);
const dayKey = (date) => new Date(date).toISOString().slice(0, 10);

/** Consecutive days ending today (or yesterday) that have at least one attempt. */
function currentStreak(daySet) {
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

const DAY_MS = 24 * 60 * 60 * 1000;

/** Longest run of consecutive active days, ever. */
function maxStreak(daySet) {
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

/** GET /api/stats — everything the stats page needs, in one request. */
export const getStats = asyncHandler(async (req, res) => {
  const user = oid(req.userId);

  const [byDifficulty, byPattern, byCompany, totals, activity] = await Promise.all([
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
