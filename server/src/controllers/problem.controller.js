import mongoose from 'mongoose';
import { z } from 'zod';
import { Pattern } from '../models/Pattern.js';
import { Problem } from '../models/Problem.js';
import { Progress } from '../models/Progress.js';
import { fetchDescription, fetchProblem, slugFromUrl } from '../services/leetcode.service.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { youtubeId } from '../utils/links.js';

const oid = (id) => new mongoose.Types.ObjectId(id);

/**
 * The visibility rule, in one place: the seeded curriculum, plus your own
 * additions, and nothing else.
 *
 * Every read of a problem goes through this. It matters most on the queries
 * that take a slug rather than an id — since problems became unique per owner
 * a slug can name more than one document, and an unscoped `findOne({ slug })`
 * would return whichever the index reached first. That is someone else's row
 * roughly half the time.
 */
const visibleTo = (userId) => ({ $or: [{ owner: null }, { owner: oid(userId) }] });

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

  // Extras (problems outside the default roadmap) only when asked for, and
  // then only them: the default payload, and every count built on it, is unchanged.
  const extras = req.query.extras === 'only';
  const groups = await Problem.aggregate([
    { $match: { ...visibleTo(req.userId), extra: extras ? true : { $ne: true } } },
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
              /* Why the flag is up and what you said about it. `$ifNull`
                 because the fields postdate most rows — see config/revision.js. */
              revisionReason: { $ifNull: ['$revisionReason', ''] },
              revisionNote: { $ifNull: ['$revisionNote', ''] },
              confidence: 1,
              notes: 1,
              solvedAt: 1,
              nextReviewAt: 1,
              attemptCount: { $size: { $ifNull: ['$attempts', []] } },
              attemptMinutes: { $sum: '$attempts.minutes' },
              /*
                The tail of the log, so the table can show how the last few
                sittings actually went rather than a count that says nothing
                about whether you are getting anywhere.

                Bounded twice, because this ships once per problem for every
                problem on the roadmap: the last four attempts, and their notes
                cut to a tooltip's worth. The dialog fetches the whole log with
                whole notes when you open it — see listAttempts.
              */
              recentAttempts: {
                $map: {
                  input: { $slice: [{ $ifNull: ['$attempts', []] }, -4] },
                  as: 'a',
                  in: {
                    // The address the dialog edits and deletes by. Null on the
                    // attempts written before ids — see the migration.
                    _id: { $ifNull: ['$$a._id', null] },
                    at: '$$a.at',
                    // What the dialog's half-hour window is measured from, so
                    // the preview it shows before its own fetch lands does not
                    // offer an Edit that the server will refuse.
                    loggedAt: { $ifNull: ['$$a.loggedAt', null] },
                    minutes: '$$a.minutes',
                    outcome: '$$a.outcome',
                    color: { $ifNull: ['$$a.color', ''] },
                    timed: { $ifNull: ['$$a.timed', false] },
                    confidence: { $ifNull: ['$$a.confidence', null] },
                    note: { $substrCP: [{ $ifNull: ['$$a.note', ''] }, 0, 120] },
                  },
                },
              },
            },
          },
        ],
        as: 'progress',
      },
    },
    {
      $addFields: {
        progress: { $first: '$progress' },
        /*
          "Yours to edit", decided here rather than by the client comparing
          `owner` to its own id. The rule is the server's — `source === 'custom'`
          is the version the UI used to guess with, and it is wrong for a
          LeetCode problem you added, which is `source: 'leetcode'` and still
          yours. One computed field means the row cannot disagree with the
          endpoint that will accept or refuse the edit.
        */
        mine: { $eq: ['$owner', userId] },
      },
    },
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
        subPatterns: { $ifNull: ['$pattern.subPatterns', []] },
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
  // Scoped, so this cannot be used to confirm that someone else has added a
  // given problem — and so the row it caches the description onto is the one
  // the caller is actually reading.
  const problem = await Problem.findOne({ slug: req.params.slug, ...visibleTo(req.userId) });
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

  /*
    "Already tracked" has to mean *by you*. Answering it from the whole
    collection tells one learner that another has added this problem, hands
    them its title and pattern, and then refuses the add — all about a row that
    is not theirs and that they will never see on the roadmap.
  */
  const existing = await Problem.findOne({ slug, ...visibleTo(req.userId) }).select(
    'slug title patternSlug',
  );
  if (existing) {
    return res.json({ found: true, alreadyTracked: true, problem: existing });
  }

  const data = await fetchProblem(slug);
  if (!data) return res.json({ found: false, reason: 'Could not reach LeetCode for that slug' });

  res.json({ found: true, alreadyTracked: false, problem: data });
});

const optionalUrl = z.string().url().or(z.literal('')).optional();

export const createSchema = z.object({
  title: z.string().min(1).max(200),
  url: optionalUrl,
  difficulty: z.enum(['Easy', 'Medium', 'Hard']),
  patternSlug: z.string().min(1),
  topicTags: z.array(z.string().min(1).max(40)).max(20).optional(),
  companies: z.array(z.string().min(1).max(60)).max(30).optional(),
  // Editorial / article / write-up you want to come back to.
  articleUrl: optionalUrl,
  // Full YouTube URL or a bare id — normalised server-side.
  video: z.string().max(200).optional(),
  notes: z.string().max(20000).optional(),
  status: z.enum(['todo', 'attempted', 'solved']).optional(),
});

/** POST /api/problems — add your own problem from any site. */
export const createCustom = asyncHandler(async (req, res) => {
  const {
    title,
    url = '',
    difficulty,
    patternSlug,
    topicTags = [],
    companies = [],
    articleUrl = '',
    video = '',
    notes = '',
    status,
  } = req.body;

  const pattern = await Pattern.findOne({ slug: patternSlug });
  if (!pattern) throw ApiError.badRequest(`Unknown pattern: ${patternSlug}`);

  const lcSlug = slugFromUrl(url);
  const slug = lcSlug || `custom-${req.userId.slice(-6)}-${Date.now().toString(36)}`;

  // Scoped for the same reason the lookup above is: the message says "your
  // list", so the query has to be about your list. Someone else having added
  // this problem is not a reason to refuse you — see the compound index on the
  // Problem model, which is what makes both rows able to exist.
  if (lcSlug && (await Problem.findOne({ slug: lcSlug, ...visibleTo(req.userId) }))) {
    throw ApiError.conflict('That problem is already in your list', 'DUPLICATE');
  }

  // Put custom problems at the end of their pattern — of *your* pattern, so
  // where yours lands does not depend on how many problems strangers have added
  // to it.
  const last = await Problem.findOne({ patternSlug, ...visibleTo(req.userId) })
    .sort({ patternOrder: -1 })
    .select('patternOrder');

  const clean = (list) => [...new Set(list.map((s) => s.trim()).filter(Boolean))];

  const problem = await Problem.create({
    slug,
    title,
    url,
    articleUrl,
    difficulty,
    patternSlug,
    patternOrder: (last?.patternOrder ?? 0) + 1,
    topicTags: clean(topicTags),
    // freq is 0 because it means "how often this company asks it" in the seeded
    // dataset, and there is no way to know that for a hand-added problem.
    companies: clean(companies).map((name) => ({ name, freq: 0 })),
    videoId: youtubeId(video),
    source: lcSlug ? 'leetcode' : 'custom',
    owner: oid(req.userId),
    addedBy: oid(req.userId),
  });

  // Notes and status live on Progress, not Problem — seed that row only if the
  // form actually supplied something.
  let progress = null;
  if (notes.trim() || (status && status !== 'todo')) {
    progress = await Progress.findOneAndUpdate(
      { user: oid(req.userId), problem: problem._id },
      {
        $set: {
          ...(notes.trim() ? { notes: notes.trim() } : {}),
          ...(status ? { status } : {}),
          ...(status === 'solved' ? { solvedAt: new Date(), reviewStage: 1 } : {}),
        },
        $setOnInsert: { user: oid(req.userId), problem: problem._id },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
  }

  res.status(201).json({
    problem: {
      ...problem.toObject(),
      // So the row it lands on carries its edit and delete actions without
      // waiting for the next roadmap fetch to label it.
      mine: true,
      progress: progress
        ? {
            status: progress.status,
            flagged: progress.flagged,
            needsRevision: progress.needsRevision,
            confidence: progress.confidence,
            notes: progress.notes,
            attemptCount: 0,
          }
        : undefined,
    },
  });
});

/**
 * Editing your own addition.
 *
 * `slug` and `url` are absent on purpose. The slug is the identity every
 * `Progress` row joins on and the seeder's name for a problem, so changing it
 * orphans your own history — the admin panel omits it from its update schema
 * for the same reason. The URL is what the slug was derived from, so letting it
 * move would leave the two disagreeing about which problem this is; delete and
 * re-add if you pasted the wrong link.
 *
 * Everything else is yours to correct: the wrong pattern, a typo in the title,
 * the difficulty you guessed before solving it.
 */
export const updateSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    difficulty: z.enum(['Easy', 'Medium', 'Hard']).optional(),
    patternSlug: z.string().min(1).optional(),
    topicTags: z.array(z.string().min(1).max(40)).max(20).optional(),
    companies: z.array(z.string().min(1).max(60)).max(30).optional(),
    articleUrl: optionalUrl,
    video: z.string().max(200).optional(),
  })
  .refine((body) => Object.keys(body).length > 0, 'Nothing to update');

/**
 * The one you added, or nothing.
 *
 * Ownership rather than `source === 'custom'`: a LeetCode problem you added is
 * `source: 'leetcode'` and still yours, and a check on source would quietly
 * refuse to let you edit half of your own list. `owner` is the visibility rule,
 * so it is the right thing to ask.
 */
async function loadOwned(problemId, userId) {
  const problem = await Problem.findById(problemId);
  if (!problem) throw ApiError.notFound('Problem not found');
  if (!problem.owner || String(problem.owner) !== userId) {
    throw ApiError.forbidden('You can only change problems you added');
  }
  return problem;
}

/** PATCH /api/problems/:id — only your own additions. */
export const updateCustom = asyncHandler(async (req, res) => {
  const problem = await loadOwned(req.params.id, req.userId);
  const { patternSlug, topicTags, companies, video, ...rest } = req.body;

  if (patternSlug && patternSlug !== problem.patternSlug) {
    const pattern = await Pattern.findOne({ slug: patternSlug }).select('slug').lean();
    if (!pattern) throw ApiError.badRequest(`Unknown pattern: ${patternSlug}`);

    // Moved sections, so the old position means nothing — put it at the end of
    // the new one, where a fresh addition would go.
    const last = await Problem.findOne({ patternSlug, ...visibleTo(req.userId) })
      .sort({ patternOrder: -1 })
      .select('patternOrder');
    problem.patternSlug = patternSlug;
    // A sub-pattern belongs to one pattern's list; it does not travel.
    problem.subPattern = '';
    problem.patternOrder = (last?.patternOrder ?? 0) + 1;
  }

  const clean = (list) => [...new Set(list.map((s) => s.trim()).filter(Boolean))];

  problem.set(rest);
  if (topicTags) problem.topicTags = clean(topicTags);
  // freq stays 0 for the same reason it is 0 on create: there is no way to know
  // how often a company asks a problem you added by hand.
  if (companies) problem.companies = clean(companies).map((name) => ({ name, freq: 0 }));
  if (video !== undefined) problem.videoId = youtubeId(video);

  await problem.save();
  // `mine` is added by the roadmap aggregation, not stored — this row is by
  // definition the caller's, and the client replaces its copy wholesale.
  res.json({ problem: { ...problem.toObject(), mine: true } });
});

/** DELETE /api/problems/:id — only your own additions. */
export const removeCustom = asyncHandler(async (req, res) => {
  const problem = await loadOwned(req.params.id, req.userId);

  await Progress.deleteMany({ problem: problem._id });
  await problem.deleteOne();
  res.json({ ok: true });
});

/** GET /api/patterns — used by the sidebar and the add-problem dropdown. */
export const listPatterns = asyncHandler(async (_req, res) => {
  const patterns = await Pattern.find().sort({ order: 1 }).lean();
  res.json({ patterns });
});
