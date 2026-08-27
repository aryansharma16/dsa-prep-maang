import mongoose from 'mongoose';
import { CP_TIERS } from '../../config/cpTiers.js';
import { CPPattern } from '../../models/CPPattern.js';
import { CPProblem } from '../../models/CPProblem.js';
import { CPProfile } from '../../models/CPProfile.js';
import { currentStreak, dayKey, maxStreak } from '../../services/activity.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const oid = (id) => new mongoose.Types.ObjectId(id);

/**
 * Everything the CP section of the stats page needs, in one request.
 *
 * Deliberately a separate endpoint from `/api/stats` rather than a branch
 * inside it. The two curriculums are measured by different things — the roadmap
 * by difficulty and company coverage, the ladder by rating band and tier — and
 * folding them together would mean one response where half the fields are null
 * depending on which half you asked about.
 */

/**
 * The join every aggregation below needs: the caller's status per problem.
 *
 * Written once because there are four of them and a `$lookup` that differed
 * between two would make two charts disagree about the same solve.
 */
const withStatus = (user) => [
  { $match: { $or: [{ owner: null }, { owner: user }] } },
  {
    $lookup: {
      from: 'cpprogresses',
      let: { pid: '$_id' },
      pipeline: [
        { $match: { $expr: { $and: [{ $eq: ['$problem', '$$pid'] }, { $eq: ['$user', user] }] } } },
        { $project: { status: 1, solvedOnPlatform: 1 } },
      ],
      as: 'p',
    },
  },
  {
    $addFields: {
      status: { $ifNull: [{ $first: '$p.status' }, 'todo'] },
      onPlatform: { $ifNull: [{ $first: '$p.solvedOnPlatform' }, false] },
    },
  },
];

const solvedSum = { $sum: { $cond: [{ $eq: ['$status', 'solved'] }, 1, 0] } };

export const getCpStats = asyncHandler(async (req, res) => {
  const user = oid(req.userId);

  const [byTier, byPattern, byRating, byPlatform, activity, profile, patterns] = await Promise.all([
    CPProblem.aggregate([
      ...withStatus(user),
      { $group: { _id: '$tier', total: { $sum: 1 }, solved: solvedSum } },
      { $project: { _id: 0, tier: '$_id', total: 1, solved: 1 } },
    ]),

    CPProblem.aggregate([
      ...withStatus(user),
      { $group: { _id: '$patternSlug', total: { $sum: 1 }, solved: solvedSum } },
      { $project: { _id: 0, slug: '$_id', total: 1, solved: 1 } },
    ]),

    /*
      The rating histogram — Codeforces only.

      CodeChef ratings are on their own scale and mixing them into these buckets
      would produce a chart that means nothing: a CodeChef 1600 sits far below a
      Codeforces 1600, so a combined histogram would pile CodeChef's whole range
      into the middle of Codeforces' and misreport both.
    */
    CPProblem.aggregate([
      ...withStatus(user),
      { $match: { platform: 'codeforces', 'codeforces.rating': { $gt: 0 } } },
      {
        $group: {
          _id: { $subtract: ['$codeforces.rating', { $mod: ['$codeforces.rating', 100] }] },
          total: { $sum: 1 },
          solved: solvedSum,
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, rating: '$_id', total: 1, solved: 1 } },
    ]),

    CPProblem.aggregate([
      ...withStatus(user),
      {
        $group: {
          _id: '$platform',
          total: { $sum: 1 },
          solved: solvedSum,
          onPlatform: { $sum: { $cond: ['$onPlatform', 1, 0] } },
        },
      },
      { $project: { _id: 0, platform: '$_id', total: 1, solved: 1, onPlatform: 1 } },
    ]),

    /*
      Attempts per day, for the heatmap.

      Reads the embedded attempt dates rather than `solvedAt`, so a day spent
      failing at a 1900 counts as work — which is most of what competitive
      programming practice actually looks like, and a heatmap that only lit up
      on solves would tell somebody grinding a hard band that they had done
      nothing all week.
    */
    mongoose.connection
      .collection('cpprogresses')
      .aggregate([
        { $match: { user } },
        { $unwind: '$attempts' },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$attempts.at', timezone: 'UTC' },
            },
            count: { $sum: 1 },
            minutes: { $sum: '$attempts.minutes' },
          },
        },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, day: '$_id', count: 1, minutes: 1 } },
      ])
      .toArray(),

    CPProfile.findOne({ user }).lean(),
    CPPattern.find().select('slug name order tier').sort({ order: 1 }).lean(),
  ]);

  const tierCounts = new Map(byTier.map((t) => [t.tier, t]));
  const patternCounts = new Map(byPattern.map((p) => [p.slug, p]));
  // A Set, not an array — `currentStreak` and `maxStreak` do membership tests.
  const days = new Set(activity.map((a) => a.day));

  const totals = byPlatform.reduce(
    (acc, p) => ({
      total: acc.total + p.total,
      solved: acc.solved + p.solved,
      onPlatform: acc.onPlatform + p.onPlatform,
    }),
    { total: 0, solved: 0, onPlatform: 0 },
  );

  res.json({
    totals,
    tiers: CP_TIERS.map((t) => ({
      ...t,
      total: tierCounts.get(t.slug)?.total || 0,
      solved: tierCounts.get(t.slug)?.solved || 0,
    })),
    patterns: patterns.map((p) => ({
      ...p,
      total: patternCounts.get(p.slug)?.total || 0,
      solved: patternCounts.get(p.slug)?.solved || 0,
    })),
    ratings: byRating,
    platforms: byPlatform,
    activity,
    streak: { current: currentStreak(days), max: maxStreak(days), today: dayKey(new Date()) },
    handle: profile?.handle
      ? {
          handle: profile.handle,
          rating: profile.rating,
          maxRating: profile.maxRating,
          rank: profile.rank,
          lastSyncAt: profile.lastSyncAt,
        }
      : null,
  });
});
