import { z } from 'zod';
import { Pattern } from '../../models/Pattern.js';
import { Problem } from '../../models/Problem.js';
import { Progress } from '../../models/Progress.js';
import { AUDIT, diff, recordAudit } from '../../services/audit.service.js';
import { ApiError } from '../../utils/ApiError.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { escapeRegex, paged, pageQuery } from '../../utils/query.js';

/*
  Every write here stamps `editedAt`. That is not bookkeeping — it is what stops
  `npm run seed:db` reverting the change on its next run, and what keeps the
  prune from deleting an admin-created problem along with everyone's progress on
  it. See scripts/seed/seed.js.
*/
const stamp = (req) => ({ editedAt: new Date(), editedBy: req.actor._id });

/* ------------------------------------------------------------- problems */

export const problemQuery = pageQuery.extend({
  q: z.string().max(120).optional(),
  pattern: z.string().max(60).optional(),
  difficulty: z.enum(['Easy', 'Medium', 'Hard']).optional(),
  scope: z.enum(['all', 'shared', 'custom', 'edited']).default('all'),
});

const companyInput = z.array(
  z.object({ name: z.string().min(1).max(60), freq: z.number().min(0).max(100).default(0) }),
);

export const problemCreateSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9-]+$/, 'lowercase letters, numbers and dashes only'),
  difficulty: z.enum(['Easy', 'Medium', 'Hard']),
  patternSlug: z.string().min(1),
  url: z.string().url().or(z.literal('')).optional(),
  articleUrl: z.string().url().or(z.literal('')).optional(),
  topicTags: z.array(z.string().min(1).max(40)).max(20).optional(),
  companies: companyInput.max(30).optional(),
  videoId: z.string().max(20).optional(),
  lcId: z.number().int().min(0).optional(),
  score: z.number().min(0).optional(),
  patternOrder: z.number().int().min(0).optional(),
});

export const problemUpdateSchema = problemCreateSchema
  .partial()
  // The slug is the join key for progress rows and the seeder's identity for a
  // problem. Renaming it would orphan both, so it is create-only.
  .omit({ slug: true })
  .refine((body) => Object.keys(body).length > 0, 'Nothing to update');

const PROBLEM_LIST_FIELDS =
  'slug title difficulty source patternSlug patternOrder owner addedBy editedAt lcId score url updatedAt';

export const listProblems = asyncHandler(async (req, res) => {
  const { q, pattern, difficulty, scope, page, limit } = req.query;

  const filter = {};
  if (pattern) filter.patternSlug = pattern;
  if (difficulty) filter.difficulty = difficulty;
  if (scope === 'shared') filter.owner = null;
  if (scope === 'custom') filter.owner = { $ne: null };
  if (scope === 'edited') filter.editedAt = { $ne: null };
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ title: rx }, { slug: rx }];
  }

  // A positive projection, so descriptionHtml — many KB per row — cannot
  // dominate a 100-row page.
  const [problems, total] = await Promise.all([
    Problem.find(filter)
      .select(PROBLEM_LIST_FIELDS)
      /*
        Whose it is, by name. `owner` on its own is an ObjectId, which answers
        "is this someone's private problem" and not "whose" — and the second is
        the only useful question once the panel can filter down to them. One
        populate over a page of 25, not a query per row.
      */
      .populate('owner', 'name email')
      .sort({ patternOrder: 1, score: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Problem.countDocuments(filter),
  ]);

  res.json(paged('problems', problems, { total, page, limit }));
});

export const getProblem = asyncHandler(async (req, res) => {
  const problem = await Problem.findById(req.params.id)
    .select('-descriptionHtml')
    .populate('owner', 'name email')
    .populate('addedBy', 'name email')
    .lean();
  if (!problem) throw ApiError.notFound('Problem not found', 'NO_PROBLEM');

  // How much damage a delete would do, so the confirmation can say it.
  const progressCount = await Progress.countDocuments({ problem: problem._id });
  res.json({ problem, progressCount });
});

export const createProblem = asyncHandler(async (req, res) => {
  const pattern = await Pattern.findOne({ slug: req.body.patternSlug }).select('slug').lean();
  if (!pattern) throw ApiError.badRequest(`Unknown pattern: ${req.body.patternSlug}`, 'NO_PATTERN');

  const last = await Problem.findOne({ patternSlug: req.body.patternSlug })
    .sort({ patternOrder: -1 })
    .select('patternOrder')
    .lean();

  const problem = await Problem.create({
    ...req.body,
    patternOrder: req.body.patternOrder ?? (last?.patternOrder ?? 0) + 1,
    source: req.body.url?.includes('leetcode.com') ? 'leetcode' : 'custom',
    // Shared with everyone — that is what makes this a curriculum problem
    // rather than one person's private addition.
    owner: null,
    addedBy: req.actor._id,
    ...stamp(req),
  });

  await recordAudit(req, {
    action: AUDIT.PROBLEM_CREATE,
    targetType: 'problem',
    targetId: problem._id,
    targetLabel: problem.slug,
  });

  res.status(201).json({ problem });
});

export const updateProblem = asyncHandler(async (req, res) => {
  const problem = await Problem.findById(req.params.id);
  if (!problem) throw ApiError.notFound('Problem not found', 'NO_PROBLEM');

  if (req.body.patternSlug && req.body.patternSlug !== problem.patternSlug) {
    const pattern = await Pattern.findOne({ slug: req.body.patternSlug }).select('slug').lean();
    if (!pattern) throw ApiError.badRequest(`Unknown pattern: ${req.body.patternSlug}`, 'NO_PATTERN');
  }

  const before = problem.toObject();
  problem.set({ ...req.body, ...stamp(req) });
  await problem.save();

  await recordAudit(req, {
    action: AUDIT.PROBLEM_UPDATE,
    targetType: 'problem',
    targetId: problem._id,
    targetLabel: problem.slug,
    meta: diff(before, problem.toObject(), [
      'title',
      'difficulty',
      'patternSlug',
      'url',
      'articleUrl',
      'videoId',
      'topicTags',
    ]),
  });

  res.json({ problem: problem.toObject() });
});

export const deleteProblem = asyncHandler(async (req, res) => {
  const problem = await Problem.findById(req.params.id);
  if (!problem) throw ApiError.notFound('Problem not found', 'NO_PROBLEM');

  // Everyone's progress on it, not just the caller's — the row is about to
  // point at nothing. The count goes into the response so the UI can say what
  // it cost.
  const progress = await Progress.deleteMany({ problem: problem._id });
  const label = problem.slug;
  await problem.deleteOne();

  await recordAudit(req, {
    action: AUDIT.PROBLEM_DELETE,
    targetType: 'problem',
    targetId: req.params.id,
    targetLabel: label,
    meta: { progressDeleted: progress.deletedCount },
  });

  res.json({ ok: true, progressDeleted: progress.deletedCount });
});

/* ------------------------------------------------------------- patterns */

export const patternUpdateSchema = z
  .object({
    name: z.string().min(1).max(80).optional(),
    order: z.number().int().min(1).max(200).optional(),
    blurb: z.string().max(400).optional(),
    keyTechniques: z.array(z.string().min(1).max(60)).max(15).optional(),
  })
  .refine((body) => Object.keys(body).length > 0, 'Nothing to update');

export const listPatternsAdmin = asyncHandler(async (_req, res) => {
  const patterns = await Pattern.find().sort({ order: 1 }).lean();

  // One grouped count rather than a query per pattern.
  const counts = await Problem.aggregate([
    { $group: { _id: '$patternSlug', total: { $sum: 1 } } },
  ]);
  const byPattern = Object.fromEntries(counts.map((c) => [c._id, c.total]));

  res.json({
    patterns: patterns.map((p) => ({ ...p, problemCount: byPattern[p.slug] || 0 })),
  });
});

export const updatePattern = asyncHandler(async (req, res) => {
  const pattern = await Pattern.findOne({ slug: req.params.slug });
  if (!pattern) throw ApiError.notFound('Pattern not found', 'NO_PATTERN');

  const before = pattern.toObject();
  pattern.set({ ...req.body, ...stamp(req) });
  await pattern.save();

  await recordAudit(req, {
    action: AUDIT.PATTERN_UPDATE,
    targetType: 'pattern',
    targetId: pattern._id,
    targetLabel: pattern.slug,
    meta: diff(before, pattern.toObject(), ['name', 'order', 'blurb', 'keyTechniques']),
  });

  res.json({ pattern: pattern.toObject() });
});
