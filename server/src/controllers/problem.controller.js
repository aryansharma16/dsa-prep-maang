import mongoose from 'mongoose';
import { z } from 'zod';
import { Pattern } from '../models/Pattern.js';
import { Problem } from '../models/Problem.js';
import { Progress } from '../models/Progress.js';
import { fetchDescription, fetchProblem, slugFromUrl } from '../services/leetcode.service.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const oid = (id) => new mongoose.Types.ObjectId(id);

// Fields the roadmap never needs. descriptionHtml in particular is many KB per
// problem and would balloon a 400-problem payload.
const ROADMAP_EXCLUDE = {
  descriptionHtml: 0,
  descriptionFetchedAt: 0,
  createdAt: 0,
  updatedAt: 0,
  __v: 0,
};

/**
 * GET /api/problems
 * Returns every pattern in curriculum order with its problems and the caller's
 * progress already merged in — one round trip, no N+1.
 *
 * The whole curated list is ~430 problems, so it ships in one response and the
 * client filters locally. That keeps search and filtering instant, and keeps
 * this query to a single shape.
 */
export const listGrouped = asyncHandler(async (req, res) => {
  const userId = oid(req.userId);

  const groups = await Problem.aggregate([
    { $match: { $or: [{ owner: null }, { owner: userId }] } },
    { $project: ROADMAP_EXCLUDE },
    { $sort: { patternOrder: 1, score: -1 } },
    {
      $lookup: {
        from: 'progresses',
        let: { problemId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: { $and: [{ $eq: ['$problem', '$$problemId'] }, { $eq: ['$user', userId] }] },
            },
          },
          {
            $project: {
              _id: 0,
              status: 1,
              flagged: 1,
              needsRevision: 1,
              confidence: 1,
              notes: 1,
              solvedAt: 1,
              nextReviewAt: 1,
              attemptCount: { $size: '$attempts' },
            },
          },
        ],
        as: 'progress',
      },
    },
    { $addFields: { progress: { $first: '$progress' } } },
    {
      $group: {
        _id: '$patternSlug',
        problems: { $push: '$$ROOT' },
        total: { $sum: 1 },
        solved: {
          $sum: { $cond: [{ $eq: ['$progress.status', 'solved'] }, 1, 0] },
        },
      },
    },
    {
      $lookup: {
        from: 'patterns',
        localField: '_id',
        foreignField: 'slug',
        as: 'pattern',
      },
    },
    { $addFields: { pattern: { $first: '$pattern' } } },
    { $sort: { 'pattern.order': 1 } },
    {
      $project: {
        _id: 0,
        slug: '$_id',
        name: { $ifNull: ['$pattern.name', '$_id'] },
        blurb: { $ifNull: ['$pattern.blurb', ''] },
        keyTechniques: { $ifNull: ['$pattern.keyTechniques', []] },
        order: { $ifNull: ['$pattern.order', 999] },
        total: 1,
        solved: 1,
        problems: 1,
      },
    },
  ]);

  const totals = groups.reduce(
    (acc, g) => ({ total: acc.total + g.total, solved: acc.solved + g.solved }),
    { total: 0, solved: 0 },
  );

  res.json({ groups, totals });
});

/** GET /api/problems/:slug/description — lazily fetched and cached on first open. */
export const getDescription = asyncHandler(async (req, res) => {
  const problem = await Problem.findOne({ slug: req.params.slug });
  if (!problem) throw ApiError.notFound('Problem not found');

  if (problem.descriptionHtml) {
    return res.json({ slug: problem.slug, descriptionHtml: problem.descriptionHtml, cached: true });
  }

  if (problem.source !== 'leetcode') {
    return res.json({ slug: problem.slug, descriptionHtml: null, cached: false });
  }

  const html = await fetchDescription(problem.slug);
  if (html) {
    problem.descriptionHtml = html;
    problem.descriptionFetchedAt = new Date();
    await problem.save();
  }

  res.json({ slug: problem.slug, descriptionHtml: html, cached: false });
});

export const lookupSchema = z.object({ url: z.string().min(1) });

/**
 * POST /api/problems/lookup — resolves a pasted LeetCode URL so the add-problem
 * modal can prefill itself instead of making you type everything.
 */
export const lookup = asyncHandler(async (req, res) => {
  const slug = slugFromUrl(req.body.url);
  if (!slug) {
    return res.json({ found: false, reason: 'Not a LeetCode problem URL' });
  }

  const existing = await Problem.findOne({ slug }).select('slug title patternSlug');
  if (existing) {
    return res.json({ found: true, alreadyTracked: true, problem: existing });
  }

  const data = await fetchProblem(slug);
  if (!data) return res.json({ found: false, reason: 'Could not reach LeetCode for that slug' });

  res.json({ found: true, alreadyTracked: false, problem: data });
});

export const createSchema = z.object({
  title: z.string().min(1).max(200),
  url: z.string().url().or(z.literal('')).optional(),
  difficulty: z.enum(['Easy', 'Medium', 'Hard']),
  patternSlug: z.string().min(1),
  topicTags: z.array(z.string()).optional(),
  companies: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

/** POST /api/problems — add your own problem from any site. */
export const createCustom = asyncHandler(async (req, res) => {
  const { title, url = '', difficulty, patternSlug, topicTags = [], companies = [] } = req.body;

  const pattern = await Pattern.findOne({ slug: patternSlug });
  if (!pattern) throw ApiError.badRequest(`Unknown pattern: ${patternSlug}`);

  const lcSlug = slugFromUrl(url);
  const slug = lcSlug || `custom-${req.userId.slice(-6)}-${Date.now().toString(36)}`;

  if (lcSlug && (await Problem.findOne({ slug: lcSlug }))) {
    throw ApiError.conflict('That problem is already in your list', 'DUPLICATE');
  }

  // Put custom problems at the end of their pattern.
  const last = await Problem.findOne({ patternSlug }).sort({ patternOrder: -1 }).select('patternOrder');

  const problem = await Problem.create({
    slug,
    title,
    url,
    difficulty,
    patternSlug,
    patternOrder: (last?.patternOrder ?? 0) + 1,
    topicTags,
    companies: companies.map((name) => ({ name, freq: 0 })),
    source: lcSlug ? 'leetcode' : 'custom',
    owner: oid(req.userId),
  });

  res.status(201).json({ problem });
});

/** DELETE /api/problems/:id — only your own additions. */
export const removeCustom = asyncHandler(async (req, res) => {
  const problem = await Problem.findById(req.params.id);
  if (!problem) throw ApiError.notFound('Problem not found');
  if (!problem.owner || String(problem.owner) !== req.userId) {
    throw ApiError.forbidden('You can only delete problems you added');
  }

  await Progress.deleteMany({ problem: problem._id });
  await problem.deleteOne();
  res.json({ ok: true });
});

/** GET /api/patterns — used by the sidebar and the add-problem dropdown. */
export const listPatterns = asyncHandler(async (_req, res) => {
  const patterns = await Pattern.find().sort({ order: 1 }).lean();
  res.json({ patterns });
});
