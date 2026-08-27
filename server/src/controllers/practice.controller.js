import mongoose from 'mongoose';
import { z } from 'zod';
import { DEFAULT_LANG, SOLUTION_LANGS } from '../config/attempts.js';
import { DrillRun } from '../models/DrillRun.js';
import { MockRun } from '../models/MockRun.js';
import { Problem } from '../models/Problem.js';
import { objectId } from '../utils/query.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Practice — the drill, and later the mock.
 *
 * Both are exercises *over* the curriculum rather than edits to it, so nothing
 * here touches a `Progress` row. A drill answer is not an attempt: you did not
 * solve anything, you recognised something, and folding it into the attempt log
 * would corrupt the one record that is supposed to mean "I sat down with this
 * problem".
 */

const oid = (id) => new mongoose.Types.ObjectId(id);

/**
 * A finished run, posted once when you stop.
 *
 * `correct` is sent rather than derived from `misses.length`, and then checked
 * against it. The client is the only thing that knows how many questions it
 * actually asked — a run can be ended early — so the count has to come from
 * there; but a `correct` greater than `total` is a bug worth catching at the
 * door rather than one that quietly skews every accuracy figure afterwards.
 */
export const drillRunSchema = z
  .object({
    total: z.number().int().min(1).max(500),
    correct: z.number().int().min(0).max(500),
    misses: z
      .array(z.object({ problem: objectId, chose: z.string().max(64).default('') }))
      .max(500)
      .default([]),
  })
  .refine((v) => v.correct <= v.total, { message: 'More correct answers than questions' })
  .refine((v) => v.misses.length <= v.total - v.correct, {
    message: 'More misses than wrong answers',
  });

/**
 * POST /practice/drill-runs — record one finished drill.
 *
 * The misses are filtered against what this account may actually see before
 * they are stored, using the same visibility rule the rest of the app applies:
 * the seeded curriculum plus your own additions. An id that does not resolve is
 * dropped rather than rejected — it means a problem was deleted mid-run, which
 * is not a reason to throw away the other nineteen answers.
 */
export const saveDrillRun = asyncHandler(async (req, res) => {
  const user = oid(req.userId);
  const { total, correct, misses } = req.body;

  const ids = misses.map((m) => oid(m.problem));
  const allowed = ids.length
    ? await Problem.find({ _id: { $in: ids }, $or: [{ owner: null }, { owner: user }] })
        .select('_id')
        .lean()
    : [];
  const allowedIds = new Set(allowed.map((p) => String(p._id)));

  const run = await DrillRun.create({
    user,
    total,
    correct,
    misses: misses.filter((m) => allowedIds.has(String(m.problem))),
  });

  res.status(201).json({ run: { _id: run._id, at: run.at, total: run.total, correct: run.correct } });
});

/**
 * A finished mock, posted once at the end.
 *
 * Everything is optional except the problems it was run on, because a mock you
 * abandoned twelve minutes in with nothing written is still a fact worth
 * keeping — arguably the most useful one in the collection.
 */
export const mockRunSchema = z.object({
  budgetMinutes: z.number().int().min(5).max(240).default(45),
  minutes: z.number().int().min(0).max(240).default(0),
  problems: z
    .array(
      z.object({
        problem: objectId,
        approach: z.string().max(2000).default(''),
        code: z.string().max(20000).default(''),
        lang: z.enum(SOLUTION_LANGS).default(DEFAULT_LANG),
        finished: z.boolean().default(false),
      }),
    )
    .min(1)
    .max(5),
  rubric: z
    .object({
      clarified: z.boolean().default(false),
      complexity: z.boolean().default(false),
      tested: z.boolean().default(false),
      narrated: z.boolean().default(false),
    })
    .default({}),
});

/**
 * POST /practice/mock-runs — record one finished mock.
 *
 * Problems are filtered against the caller's visibility the same way a drill's
 * misses are: an id that does not resolve is dropped rather than rejected, so a
 * problem deleted mid-session does not throw away the other one's answer.
 */
export const saveMockRun = asyncHandler(async (req, res) => {
  const user = oid(req.userId);
  const { budgetMinutes, minutes, problems, rubric } = req.body;

  const allowed = await Problem.find({
    _id: { $in: problems.map((p) => oid(p.problem)) },
    $or: [{ owner: null }, { owner: user }],
  })
    .select('_id')
    .lean();
  const allowedIds = new Set(allowed.map((p) => String(p._id)));

  const kept = problems.filter((p) => allowedIds.has(String(p.problem)));
  if (!kept.length) {
    // Every problem in the run is gone or was never visible. Nothing to record,
    // and a 404 says so more usefully than an empty document would.
    throw ApiError.notFound('None of those problems exist', 'NO_PROBLEMS');
  }

  const run = await MockRun.create({ user, budgetMinutes, minutes, problems: kept, rubric });
  res.status(201).json({ run: { _id: run._id, at: run.at, minutes: run.minutes } });
});

/**
 * GET /practice/stats — how the drill is going.
 *
 * Two numbers and a list: lifetime accuracy, the last ten runs for the trend,
 * and the patterns most often missed. The last one is the point — a pattern you
 * cannot recognise is invisible in every other view in this app, because you
 * never solved anything for it to be a low number in.
 */
export const getPracticeStats = asyncHandler(async (req, res) => {
  const user = oid(req.userId);

  const [totals, recent, byPattern, mocks] = await Promise.all([
    DrillRun.aggregate([
      { $match: { user } },
      {
        $group: {
          _id: null,
          runs: { $sum: 1 },
          asked: { $sum: '$total' },
          correct: { $sum: '$correct' },
        },
      },
      { $project: { _id: 0, runs: 1, asked: 1, correct: 1 } },
    ]),

    DrillRun.find({ user }).sort({ at: -1 }).limit(10).select('at total correct').lean(),

    /*
      Misses grouped by the pattern of the problem that was shown — not by the
      pattern that was picked. "I keep failing to spot sliding window" is the
      sentence worth acting on; what you guessed instead is detail underneath it,
      and it is kept on the row for when that detail matters.
    */
    DrillRun.aggregate([
      { $match: { user } },
      { $unwind: '$misses' },
      {
        $lookup: {
          from: 'problems',
          localField: 'misses.problem',
          foreignField: '_id',
          as: 'p',
        },
      },
      { $unwind: '$p' },
      { $group: { _id: '$p.patternSlug', missed: { $sum: 1 } } },
      { $sort: { missed: -1 } },
      { $limit: 8 },
      { $project: { _id: 0, slug: '$_id', missed: 1 } },
    ]),

    /*
      The last few mocks, for the strip above the harness. Only what the summary
      draws — the answers you wrote are worth keeping and are not worth shipping
      to a page that shows four dates.
    */
    MockRun.find({ user })
      .sort({ at: -1 })
      .limit(5)
      .select('at minutes budgetMinutes rubric problems.finished')
      .lean(),
  ]);

  res.json({
    totals: totals[0] || { runs: 0, asked: 0, correct: 0 },
    recent,
    byPattern,
    mocks: mocks.map((m) => ({
      _id: m._id,
      at: m.at,
      minutes: m.minutes,
      budgetMinutes: m.budgetMinutes,
      rubric: m.rubric,
      problems: m.problems.length,
      finished: m.problems.filter((p) => p.finished).length,
    })),
  });
});
