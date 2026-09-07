import mongoose from 'mongoose';
import { z } from 'zod';
import { SQL_CATEGORIES, SQL_DIFFICULTIES } from '../../config/sqlCategories.js';
import { SqlProblem } from '../../models/SqlProblem.js';
import { SqlProgress } from '../../models/SqlProgress.js';
import { ApiError } from '../../utils/ApiError.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

/**
 * The SQL Lab's bank, and one problem at a time.
 *
 * Reading only. Nothing here runs SQL — the engine is in the reader's browser,
 * which is what keeps this module's API surface small enough to fit in one
 * file and removes the injection and resource-exhaustion questions a
 * server-side runner would have raised.
 */

const oid = (id) => new mongoose.Types.ObjectId(id);

/**
 * The curated bank, plus this account's own additions.
 *
 * Its own copy rather than an import of the CP one, for the reason stated at
 * `cp.problem.controller.js:14` — a shared helper would have to take the model
 * as an argument before it could say anything true, at which point it is not
 * saying much. Exported so the progress controller can hand it to the kit.
 */
export const visibleTo = (userId) => ({ $or: [{ owner: null }, { owner: oid(userId) }] });

/**
 * What a row in the bank carries.
 *
 * An allowlist rather than an exclusion, so a field added to the model is not
 * published by having been added. Note what is **absent**: `solutionSql`,
 * `explanation` and `expected` are not in the list.
 */
const BANK_FIELDS =
  'slug title statement category categoryOrder difficulty mode orderMatters ' +
  'dialectNote hints learnTopic source topicTags score owner';

/**
 * ---------------------------------------------------------------------------
 * Why the answer is not in the list payload.
 *
 * `expected` is the answer. Shipping it with the bank would put every solution
 * in the browser's memory before a single problem was opened — and while
 * anybody determined can read it from the workbench anyway, there is a real
 * difference between "available if you go looking" and "handed to you
 * unasked". The gate is meant to be a small piece of friction, and friction
 * you never encounter is not friction.
 *
 * It also keeps the payload small: 120 expected grids is most of the bytes on
 * a page that mostly shows titles.
 *
 * `solutionSql` and `explanation` are absent for the stronger version of the
 * same reason — those are behind the twenty-five minute editorial gate, and a
 * gate whose contents already arrived is decoration.
 * ---------------------------------------------------------------------------
 */

const summariseProgress = (row) => {
  const attempts = row.attempts || [];
  return {
    status: row.status,
    flagged: row.flagged,
    needsRevision: row.needsRevision,
    /* Why the flag is up, and your line about it — see config/revision.js. */
    revisionReason: row.revisionReason || '',
    revisionNote: row.revisionNote || '',
    confidence: row.confidence,
    notes: row.notes,
    solvedAt: row.solvedAt,
    nextReviewAt: row.nextReviewAt,
    attemptCount: attempts.length,
    attemptMinutes: attempts.reduce((n, a) => n + (a.minutes || 0), 0),
    recentAttempts: attempts.slice(-4).map((a) => ({
      _id: a._id,
      at: a.at,
      loggedAt: a.loggedAt ?? null,
      minutes: a.minutes,
      outcome: a.outcome,
      color: a.color || '',
      timed: Boolean(a.timed),
      confidence: a.confidence ?? null,
      note: (a.note || '').slice(0, 120),
    })),
  };
};

/**
 * GET /sql/bank — every problem, with this account's progress on each.
 *
 * ---------------------------------------------------------------------------
 * Two queries and a Map, not an aggregation with a $lookup.
 *
 * The `$lookup` version is the obvious one and is what the roadmap does. It was
 * measured on the CP ladder and came out at roughly twice the wall-clock of the
 * entire roadmap endpoint — a sub-pipeline execution per row against a remote
 * cluster — and was replaced with exactly this: two indexed finds and a hash
 * join in memory. See the note at `cp.problem.controller.js:62`. Same answer,
 * a fraction of the round trip, and the same decision applies here for the same
 * reason.
 * ---------------------------------------------------------------------------
 *
 * The response is **flat**, with two ordered key lists beside it. The page
 * offers two groupings of the same rows, and re-fetching when someone presses
 * `g` would turn a re-render into a page load.
 */
export const getBank = asyncHandler(async (req, res) => {
  const userId = oid(req.userId);

  const [rows, progressRows] = await Promise.all([
    SqlProblem.find(visibleTo(req.userId))
      .select(BANK_FIELDS)
      .sort({ categoryOrder: 1, score: -1 })
      .lean(),
    SqlProgress.find({ user: userId }).lean(),
  ]);

  const byProblem = new Map(progressRows.map((r) => [String(r.problem), r]));

  const problems = rows.map(({ owner, ...p }) => ({
    ...p,
    mine: Boolean(owner) && String(owner) === String(userId),
    progress: byProblem.has(String(p._id)) ? summariseProgress(byProblem.get(String(p._id))) : null,
  }));

  const totals = { total: 0, solved: 0, attempted: 0 };
  const perCategory = new Map(SQL_CATEGORIES.map((c) => [c.slug, { total: 0, solved: 0 }]));
  const perDifficulty = new Map(SQL_DIFFICULTIES.map((d) => [d.slug, { total: 0, solved: 0 }]));

  for (const p of problems) {
    const status = p.progress?.status || 'todo';
    totals.total += 1;
    if (status === 'solved') totals.solved += 1;
    else if (status === 'attempted') totals.attempted += 1;

    const category = perCategory.get(p.category);
    if (category) {
      category.total += 1;
      if (status === 'solved') category.solved += 1;
    }
    const difficulty = perDifficulty.get(p.difficulty);
    if (difficulty) {
      difficulty.total += 1;
      if (status === 'solved') difficulty.solved += 1;
    }
  }

  res.json({
    problems,
    categories: SQL_CATEGORIES.map((c) => ({ ...c, ...perCategory.get(c.slug) })),
    difficulties: SQL_DIFFICULTIES.map((d) => ({ ...d, ...perDifficulty.get(d.slug) })),
    totals,
  });
});

export const idParam = z.object({ id: z.string().regex(/^[a-f\d]{24}$/i, 'Not an id') });

/**
 * GET /sql/problems/:id — everything needed to actually attempt one.
 *
 * The half `getBank` withholds: the schema to build, the sample rows to show,
 * and the expected grid to compare against. Fetched when a workbench opens
 * rather than with the list, so the answers arrive one at a time and only for
 * problems somebody actually opened.
 *
 * `solutionSql` and `explanation` ride along, and that is a deliberate and
 * stated limit: the twenty-five minute gate is enforced in the UI, and anybody
 * reading the network tab can have the answer. The gate is a rule you keep, not
 * a rule you are held to — exactly as `EditorialLink` says of itself. Splitting
 * it into a second request would make that no more true and would cost a round
 * trip at the moment someone has earned the answer and wants it.
 */
export const getProblem = asyncHandler(async (req, res) => {
  const problem = await SqlProblem.findOne({
    _id: oid(req.params.id),
    ...visibleTo(req.userId),
  })
    .select('-editedAt -editedBy -addedBy')
    .lean();

  if (!problem) throw ApiError.notFound('Problem not in the bank', 'NO_PROBLEM');

  const { owner, ...rest } = problem;
  res.json({
    problem: {
      ...rest,
      mine: Boolean(owner) && String(owner) === String(req.userId),
    },
  });
});

/**
 * GET /sql/stats — the category rail's numbers, without the whole bank.
 *
 * Its own endpoint so the rail can refresh after a solve without re-fetching
 * 120 statements. Uses an aggregation rather than the two-query shape above,
 * because here the rows are being counted rather than returned and there is
 * nothing to join back onto.
 */
export const getSqlStats = asyncHandler(async (req, res) => {
  const user = oid(req.userId);

  const [byCategory, byDifficulty] = await Promise.all([
    SqlProblem.aggregate(withStatus(user, '$category')),
    SqlProblem.aggregate(withStatus(user, '$difficulty')),
  ]);

  const cat = new Map(byCategory.map((r) => [r._id, r]));
  const diff = new Map(byDifficulty.map((r) => [r._id, r]));

  /*
    Zero-filled from the config rather than from the aggregation, so a category
    nobody has a problem in still appears with a 0 instead of vanishing from the
    rail — the same rule `cp.stats.controller.js` follows.
  */
  res.json({
    categories: SQL_CATEGORIES.map((c) => ({
      ...c,
      total: cat.get(c.slug)?.total || 0,
      solved: cat.get(c.slug)?.solved || 0,
    })),
    difficulties: SQL_DIFFICULTIES.map((d) => ({
      ...d,
      total: diff.get(d.slug)?.total || 0,
      solved: diff.get(d.slug)?.solved || 0,
    })),
  });
});

/** Problems joined to this user's status, grouped by one field. */
const withStatus = (user, groupBy) => [
  { $match: { $or: [{ owner: null }, { owner: user }] } },
  {
    $lookup: {
      from: 'sqlprogresses',
      let: { pid: '$_id' },
      pipeline: [
        { $match: { $expr: { $and: [{ $eq: ['$problem', '$$pid'] }, { $eq: ['$user', user] }] } } },
        { $project: { status: 1 } },
      ],
      as: 'p',
    },
  },
  { $addFields: { status: { $ifNull: [{ $first: '$p.status' }, 'todo'] } } },
  {
    $group: {
      _id: groupBy,
      total: { $sum: 1 },
      solved: { $sum: { $cond: [{ $eq: ['$status', 'solved'] }, 1, 0] } },
    },
  },
];
