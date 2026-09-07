import mongoose from 'mongoose';
import { z } from 'zod';
import { CP_TIERS } from '../../config/cpTiers.js';
import { CPPattern } from '../../models/CPPattern.js';
import { CPPatternGuide } from '../../models/CPPatternGuide.js';
import { CPProblem } from '../../models/CPProblem.js';
import { CPProgress } from '../../models/CPProgress.js';
import { ApiError } from '../../utils/ApiError.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { youtubeId } from '../../utils/links.js';

const oid = (id) => new mongoose.Types.ObjectId(id);

/**
 * The visibility rule, in one place: the seeded ladder, plus your own
 * additions, and nothing else.
 *
 * The same shape as the roadmap's, and deliberately a separate function rather
 * than an import of it — they read different collections, and a single shared
 * helper would have to take the model as an argument to say anything true.
 */
export const visibleTo = (userId) => ({ $or: [{ owner: null }, { owner: oid(userId) }] });

/**
 * What a ladder row actually carries.
 *
 * An allowlist rather than an exclusion list, because the fields that must not
 * ship are the ones added later: `editedAt`, `editedBy` and `addedBy` are
 * provenance the table never draws, and shipping 800 of each is a hundred
 * kilobytes spent on nothing. `owner` is deliberately absent too — the server
 * computes `mine` from it and the client has no other use for it.
 */
const LADDER_FIELDS =
  'slug title platform difficulty url editorialUrl articleUrl videoId ' +
  'patternSlug patternOrder tier tierOrder topicTags platformTags companies ' +
  'codeforces codechef curatedFrom solutions score owner';

/**
 * Curation provenance, flattened for transport.
 *
 * `curatedFrom` is one entry per sheet *mention*, and A2OJ files a problem
 * under every topic it touches — so a well-known DSU problem carries six
 * near-identical rows. Stored that way on purpose (it is provenance, and the
 * group names are worth keeping), but shipping all of it made this field a
 * quarter of an 800-row payload for information the table shows as one badge.
 *
 * What the row actually needs is which sheets named it — that is the filter —
 * and one sentence saying why, which is the tooltip. The most specific note
 * wins, and CP-31's are the most specific because it is a syllabus with a
 * position per problem rather than a topic index.
 */
const flattenCuration = (entries = []) => {
  if (!entries.length) return { sheets: [], curationNote: '' };
  const sheets = [...new Set(entries.map((e) => e.sheet))];
  const best =
    entries.find((e) => e.sheet === 'cp-31' && e.note) ||
    entries.find((e) => e.note) ||
    entries[0];
  return { sheets, curationNote: best.note || best.group || '' };
};

/**
 * The caller's progress on one problem, reduced to what a row draws.
 *
 * Built in JS from a single `find`, not by a `$lookup` per problem. The
 * aggregation version was the obvious first shape — it is what the roadmap
 * does — and at 800 rows it is 800 sub-pipeline executions against a remote
 * cluster, which measured about twice the wall-clock of the whole roadmap
 * endpoint. Two indexed queries and a hash join in memory is the same answer
 * for a fraction of the round trip, and progress rows are small enough that
 * holding them all is nothing.
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
    solvedOnPlatform: row.solvedOnPlatform,
    platformSolvedAt: row.platformSolvedAt,
    attemptCount: attempts.length,
    attemptMinutes: attempts.reduce((n, a) => n + (a.minutes || 0), 0),
    /*
      The tail of the log, bounded twice — the last four sittings, notes cut to
      a tooltip's worth. This ships once per problem for every problem on the
      ladder; the dialog fetches the whole log with whole notes when opened.
    */
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
 * GET /api/cp/ladder
 *
 * The whole ladder in one response: every problem, the caller's progress
 * merged in, plus the pattern and tier metadata needed to group it either way.
 *
 * One payload rather than a query per view, because the page offers two
 * groupings of the same 800 rows and re-fetching on a toggle would make a
 * client-side regroup feel like a page load. The roadmap makes the same trade
 * at 430 rows for the same reason — the rows are small, and shipping them once
 * keeps search, filtering and grouping instant.
 *
 * The grouping itself is deliberately *not* done here. Sending a flat list plus
 * two ordered key lists lets the client regroup without a request, and means
 * this endpoint does not have to know which view is on screen.
 */
export const getLadder = asyncHandler(async (req, res) => {
  const userId = oid(req.userId);

  const [rows, progressRows, patterns] = await Promise.all([
    CPProblem.find(visibleTo(req.userId))
      .select(LADDER_FIELDS)
      .sort({ tierOrder: 1, score: -1 })
      .lean(),
    CPProgress.find({ user: userId }).lean(),
    CPPattern.find().sort({ order: 1 }).lean(),
  ]);

  const byProblem = new Map(progressRows.map((r) => [String(r.problem), r]));

  const problems = rows.map(({ owner, curatedFrom, ...p }) => ({
    ...p,
    ...flattenCuration(curatedFrom),
    // "Yours to edit", decided by the server rather than by the client
    // comparing `owner` to its own id. `owner` itself is dropped on the way out.
    mine: Boolean(owner) && String(owner) === String(userId),
    progress: byProblem.has(String(p._id))
      ? summariseProgress(byProblem.get(String(p._id)))
      : null,
  }));

  /*
    Which patterns have a full guide, as one query rather than a per-pattern
    lookup. The section header renders a "read the guide" affordance only where
    there is one to read, and only 12 of 49 have one today — so the alternative
    is 49 clients each discovering an empty guide by fetching it.
  */
  const guided = new Set(
    (await CPPatternGuide.find().select('patternSlug').lean()).map((g) => g.patternSlug),
  );

  const totals = { total: 0, solved: 0, attempted: 0, onPlatform: 0 };
  const perTier = new Map(CP_TIERS.map((t) => [t.slug, { total: 0, solved: 0 }]));
  const perPattern = new Map(patterns.map((p) => [p.slug, { total: 0, solved: 0 }]));

  for (const p of problems) {
    const status = p.progress?.status || 'todo';
    totals.total += 1;
    if (status === 'solved') totals.solved += 1;
    if (status === 'attempted') totals.attempted += 1;
    if (p.progress?.solvedOnPlatform) totals.onPlatform += 1;

    const tier = perTier.get(p.tier);
    if (tier) {
      tier.total += 1;
      if (status === 'solved') tier.solved += 1;
    }
    const pattern = perPattern.get(p.patternSlug);
    if (pattern) {
      pattern.total += 1;
      if (status === 'solved') pattern.solved += 1;
    }
  }

  res.json({
    problems,
    tiers: CP_TIERS.map((t) => ({ ...t, ...perTier.get(t.slug) })),
    patterns: patterns.map((p) => ({
      ...p,
      ...perPattern.get(p.slug),
      hasGuide: guided.has(p.slug),
    })),
    totals,
  });
});

/** GET /api/cp/patterns — the list, with briefs. Used by the add-problem form. */
export const listPatterns = asyncHandler(async (_req, res) => {
  const patterns = await CPPattern.find().sort({ order: 1 }).lean();
  res.json({ patterns, tiers: CP_TIERS });
});

/**
 * GET /api/cp/patterns/:slug/guide
 *
 * 404 when a pattern has no full guide yet, which is an ordinary answer here
 * rather than an error — only the core patterns have one, and the client shows
 * the structured brief instead.
 */
export const getGuide = asyncHandler(async (req, res) => {
  const guide = await CPPatternGuide.findOne({ patternSlug: req.params.slug })
    .select('-__v')
    .lean();
  if (!guide) throw ApiError.notFound('No guide for that pattern yet', 'NO_GUIDE');
  res.json({ guide });
});

const optionalUrl = z.string().url().or(z.literal('')).optional();

export const createSchema = z.object({
  title: z.string().min(1).max(200),
  url: optionalUrl,
  platform: z.enum(['codeforces', 'codechef', 'custom']).default('custom'),
  /** Free text, because it is the platform's own label and they disagree. */
  difficulty: z.string().max(40).default(''),
  rating: z.number().int().min(0).max(5000).optional(),
  patternSlug: z.string().min(1),
  tier: z.enum(CP_TIERS.map((t) => t.slug)),
  topicTags: z.array(z.string().min(1).max(40)).max(20).optional(),
  editorialUrl: optionalUrl,
  articleUrl: optionalUrl,
  video: z.string().max(200).optional(),
  notes: z.string().max(20000).optional(),
  status: z.enum(['todo', 'attempted', 'solved']).optional(),
});

/**
 * A Codeforces problem URL, reduced to (contestId, index).
 *
 * Both forms Codeforces serves the same problem under, in one expression rather
 * than two that can disagree about which is canonical.
 */
const cfFromUrl = (url) => {
  const m = String(url || '').match(
    /codeforces\.com\/(?:problemset\/problem|contest)\/(\d+)\/(?:problem\/)?([A-Za-z]\d?)/i,
  );
  return m ? { contestId: Number(m[1]), index: m[2].toUpperCase() } : null;
};

const ccFromUrl = (url) => {
  const m = String(url || '').match(/codechef\.com\/problems\/([A-Za-z0-9_]+)/i);
  return m ? m[1].toUpperCase() : null;
};

/** POST /api/cp/problems — add your own problem to the ladder. */
export const createCustom = asyncHandler(async (req, res) => {
  const {
    title,
    url = '',
    platform,
    difficulty = '',
    rating,
    patternSlug,
    tier,
    topicTags = [],
    editorialUrl = '',
    articleUrl = '',
    video = '',
    notes = '',
    status,
  } = req.body;

  const pattern = await CPPattern.findOne({ slug: patternSlug }).select('slug').lean();
  if (!pattern) throw ApiError.badRequest(`Unknown pattern: ${patternSlug}`);

  /*
    The slug is derived from the platform's own identity where the URL carries
    one, so adding a problem that is already on the ladder is refused as a
    duplicate rather than creating a second row for the same problem. Where
    there is no recognisable identity, a per-user slug keeps it unique without
    claiming to be canonical.
  */
  const cf = cfFromUrl(url);
  const cc = ccFromUrl(url);
  const slug = cf
    ? `cf-${cf.contestId}-${cf.index}`
    : cc
      ? `cc-${cc}`
      : `custom-${req.userId.slice(-6)}-${Date.now().toString(36)}`;

  // Scoped to what the caller can see: someone else having added this is not a
  // reason to refuse them. See the compound index on the model.
  if ((cf || cc) && (await CPProblem.findOne({ slug, ...visibleTo(req.userId) }))) {
    throw ApiError.conflict('That problem is already on your ladder', 'DUPLICATE');
  }

  const resolvedPlatform = cf ? 'codeforces' : cc ? 'codechef' : platform;

  // Put it at the end of its pattern and its tier — of *your* copy of them, so
  // where yours lands does not depend on what strangers have added.
  const [lastInPattern, lastInTier] = await Promise.all([
    CPProblem.findOne({ patternSlug, ...visibleTo(req.userId) })
      .sort({ patternOrder: -1 })
      .select('patternOrder')
      .lean(),
    CPProblem.findOne({ tier, ...visibleTo(req.userId) })
      .sort({ tierOrder: -1 })
      .select('tierOrder')
      .lean(),
  ]);

  const clean = (list) => [...new Set(list.map((s) => s.trim()).filter(Boolean))];

  const problem = await CPProblem.create({
    slug,
    title,
    platform: resolvedPlatform,
    difficulty: difficulty || (rating ? String(rating) : ''),
    url,
    editorialUrl,
    articleUrl,
    videoId: youtubeId(video),
    patternSlug,
    patternOrder: (lastInPattern?.patternOrder ?? 0) + 1,
    tier,
    tierOrder: (lastInTier?.tierOrder ?? 0) + 1,
    topicTags: clean(topicTags),
    ...(cf
      ? { codeforces: { contestId: cf.contestId, index: cf.index, rating: rating || 0 } }
      : {}),
    ...(cc ? { codechef: { code: cc, difficultyRating: rating || 0 } } : {}),
    owner: oid(req.userId),
    addedBy: oid(req.userId),
  });

  // Notes and status live on progress, not on the problem — seed that row only
  // if the form actually supplied something.
  let progress = null;
  if (notes.trim() || (status && status !== 'todo')) {
    progress = await CPProgress.findOneAndUpdate(
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
      mine: true,
      progress: progress
        ? {
            status: progress.status,
            flagged: progress.flagged,
            needsRevision: progress.needsRevision,
            confidence: progress.confidence,
            notes: progress.notes,
            attemptCount: 0,
            recentAttempts: [],
          }
        : undefined,
    },
  });
});

/**
 * Editing your own addition.
 *
 * `slug` and `url` are absent on purpose, for the reason the roadmap's update
 * schema gives: the slug is what every progress row joins on, so changing it
 * orphans your own history, and the URL is what the slug was derived from.
 */
export const updateSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    difficulty: z.string().max(40).optional(),
    patternSlug: z.string().min(1).optional(),
    tier: z.enum(CP_TIERS.map((t) => t.slug)).optional(),
    topicTags: z.array(z.string().min(1).max(40)).max(20).optional(),
    editorialUrl: optionalUrl,
    articleUrl: optionalUrl,
    video: z.string().max(200).optional(),
  })
  .refine((body) => Object.keys(body).length > 0, 'Nothing to update');

/** The one you added, or nothing. Ownership, not platform. */
async function loadOwned(problemId, userId) {
  const problem = await CPProblem.findById(problemId);
  if (!problem) throw ApiError.notFound('Problem not found');
  if (!problem.owner || String(problem.owner) !== userId) {
    throw ApiError.forbidden('You can only change problems you added');
  }
  return problem;
}

/** PATCH /api/cp/problems/:id — only your own additions. */
export const updateCustom = asyncHandler(async (req, res) => {
  const problem = await loadOwned(req.params.id, req.userId);
  const { patternSlug, tier, topicTags, video, ...rest } = req.body;

  if (patternSlug && patternSlug !== problem.patternSlug) {
    const pattern = await CPPattern.findOne({ slug: patternSlug }).select('slug').lean();
    if (!pattern) throw ApiError.badRequest(`Unknown pattern: ${patternSlug}`);

    // Moved sections, so the old position means nothing — put it at the end of
    // the new one, where a fresh addition would go.
    const last = await CPProblem.findOne({ patternSlug, ...visibleTo(req.userId) })
      .sort({ patternOrder: -1 })
      .select('patternOrder')
      .lean();
    problem.patternSlug = patternSlug;
    problem.patternOrder = (last?.patternOrder ?? 0) + 1;
  }

  if (tier && tier !== problem.tier) {
    const last = await CPProblem.findOne({ tier, ...visibleTo(req.userId) })
      .sort({ tierOrder: -1 })
      .select('tierOrder')
      .lean();
    problem.tier = tier;
    problem.tierOrder = (last?.tierOrder ?? 0) + 1;
  }

  const clean = (list) => [...new Set(list.map((s) => s.trim()).filter(Boolean))];

  problem.set(rest);
  if (topicTags) problem.topicTags = clean(topicTags);
  if (video !== undefined) problem.videoId = youtubeId(video);

  await problem.save();
  res.json({ problem: { ...problem.toObject(), mine: true } });
});

/** DELETE /api/cp/problems/:id — only your own additions. */
export const removeCustom = asyncHandler(async (req, res) => {
  const problem = await loadOwned(req.params.id, req.userId);
  await CPProgress.deleteMany({ problem: problem._id });
  await problem.deleteOne();
  res.json({ ok: true });
});
