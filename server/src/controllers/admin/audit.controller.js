import { z } from 'zod';
import { MODULE_KEYS } from '../../config/modules.js';
import { can } from '../../config/roles.js';
import { AuditLog } from '../../models/AuditLog.js';
import { Feedback, OPEN_STATUSES } from '../../models/Feedback.js';
import { Pattern } from '../../models/Pattern.js';
import { PatternGuide } from '../../models/PatternGuide.js';
import { Problem } from '../../models/Problem.js';
import { Progress } from '../../models/Progress.js';
import { User } from '../../models/User.js';
import { dayKey } from '../../services/activity.service.js';
import { catalogue } from '../../services/ai/registry.js';
import { AUDIT_ACTIONS, AUDIT_LABEL } from '../../services/audit.service.js';
import { aiEnabled } from '../../services/gemini.service.js';
import { uploadsEnabled } from '../../services/media.service.js';
import { chatSettings, hiddenModules } from '../../services/settings.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { objectId, paged, pageQuery } from '../../utils/query.js';

export const auditQuery = pageQuery.extend({
  action: z.string().max(60).optional(),
  actor: objectId.optional(),
});

export const listAudit = asyncHandler(async (req, res) => {
  const { action, actor, page, limit } = req.query;

  const filter = {};
  if (action) filter.action = action;
  if (actor) filter.actor = actor;

  const [entries, total, actors] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    AuditLog.countDocuments(filter),
    // Everyone who has ever done something, for the filter dropdown. Deriving
    // it from the current page would only ever offer people on that page.
    AuditLog.aggregate([
      { $group: { _id: '$actor', email: { $first: '$actorEmail' } } },
      { $sort: { email: 1 } },
    ]),
  ]);

  res.json({
    ...paged('entries', entries, { total, page, limit }),
    // Served from the constants rather than a distinct() scan, so the filter
    // offers every action the app can record, not only those already recorded.
    filters: {
      actions: AUDIT_ACTIONS.map((value) => ({ value, label: AUDIT_LABEL[value] || value })),
      actors: actors.filter((a) => a._id).map((a) => ({ id: String(a._id), email: a.email })),
    },
  });
});

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Four weeks plus two days for the activity chart.
 *
 * Long enough that four weekly cycles are visible, so a Saturday dip reads as a
 * Saturday rather than as a decline. Ninety days would need a range picker and
 * would be doing the learner heatmap's job.
 */
const WINDOW_DAYS = 30;

/** Everything the People and KPI panels want to know about accounts, in one pass. */
async function readUsers(weekAgo, monthAgo) {
  const [facet] = await User.aggregate([
    {
      $facet: {
        byRole: [{ $group: { _id: '$role', n: { $sum: 1 } } }],
        windows: [
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              /*
                BSON orders null before every date, so an account that has never
                been seen scores false here rather than throwing or, worse,
                counting as active.
              */
              activeWeek: { $sum: { $cond: [{ $gte: ['$lastSeenAt', weekAgo] }, 1, 0] } },
              activeMonth: { $sum: { $cond: [{ $gte: ['$lastSeenAt', monthAgo] }, 1, 0] } },
              newWeek: { $sum: { $cond: [{ $gte: ['$createdAt', weekAgo] }, 1, 0] } },
            },
          },
        ],
      },
    },
  ]);

  const windows = facet?.windows?.[0] || {};

  return {
    total: windows.total || 0,
    byRole: Object.fromEntries((facet?.byRole || []).map((r) => [r._id, r.n])),
    activeWeek: windows.activeWeek || 0,
    activeMonth: windows.activeMonth || 0,
    newWeek: windows.newWeek || 0,
  };
}

/**
 * Attempts logged per day across everyone, for the last WINDOW_DAYS.
 *
 * Bucketed in the pipeline rather than pulled into the process and grouped in
 * JS. The stats page does the latter and is right to — it is reading one
 * learner. Site-wide the same shape would load every attempt array of every
 * account to throw eleven months of it away.
 */
async function readActivity(since) {
  const rows = await Progress.aggregate([
    // Bounds the scan, and rides the {'attempts.at': -1} index.
    { $match: { 'attempts.at': { $gte: since } } },
    { $unwind: '$attempts' },
    /*
      Again after the unwind, and it is not redundant. The first match kept whole
      documents that have *any* recent attempt, which drags along every older
      attempt in the same array.
    */
    { $match: { 'attempts.at': { $gte: since } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$attempts.at' } },
        attempts: { $sum: 1 },
        // Bounded by accounts rather than by attempts, so it stays small. It is
        // what lets the tooltip carry a second number without a second chart.
        users: { $addToSet: '$user' },
      },
    },
    { $project: { _id: 0, day: '$_id', attempts: 1, people: { $size: '$users' } } },
  ]);

  /*
    Zero-filled here, not in the client, and keyed with the same `dayKey` the
    streak uses. `$dateToString` defaults to UTC and so does `dayKey`, so the two
    agree by construction — two implementations of "which days are in the window"
    is exactly the drift activity.service.js exists to prevent.
  */
  const found = new Map(rows.map((r) => [r.day, r]));
  const now = Date.now();
  const days = [];

  for (let i = WINDOW_DAYS - 1; i >= 0; i -= 1) {
    const day = dayKey(new Date(now - i * DAY_MS));
    const row = found.get(day);
    days.push({ day, attempts: row?.attempts || 0, people: row?.people || 0 });
  }

  return {
    days,
    attempts: days.reduce((n, d) => n + d.attempts, 0),
    peak: days.reduce((n, d) => Math.max(n, d.attempts), 0),
    activeDays: days.filter((d) => d.attempts > 0).length,
  };
}

/**
 * Whether this deployment is wired up.
 *
 * The operator-facing twin of `GET /api/health`, which reports the same trio to
 * anyone who asks. `catalogue()` rather than `anyProviderConfigured()` because
 * the coarse boolean cannot tell "no keys anywhere" from "keyed but cooling down
 * right now", and the second is the state somebody is staring at when they are
 * told chat is broken.
 *
 * No database work: both settings reads resolve through the same memo, and the
 * rest is in-process.
 */
async function readHealth() {
  const [chat, hidden] = await Promise.all([chatSettings(), hiddenModules()]);
  const providers = catalogue(chat.providers);
  const live = providers.filter((p) => p.configured && p.enabled);

  return {
    chat: {
      /*
        The switch, not whether it works. "Turned off" and "turned on with no
        provider that answers" are different problems with different fixes, and
        collapsing them into one boolean is how an operator ends up looking for a
        missing key that is not missing.
      */
      enabled: chat.enabled,
      retentionHours: chat.retentionHours,
      dailyMessageCap: chat.dailyMessageCap,
    },
    providers: {
      total: providers.length,
      enabled: live.length,
      ready: live.filter((p) => p.health?.ok !== false).length,
      down: live
        .filter((p) => p.health?.ok === false)
        .map((p) => ({ id: p.id, label: p.label })),
      missing: providers
        .filter((p) => p.enabled && !p.configured)
        .map((p) => ({ id: p.id, label: p.label, envKey: p.envKey })),
    },
    ai: { configured: aiEnabled() },
    uploads: { configured: uploadsEnabled() },
    modules: { total: MODULE_KEYS.length, hidden },
  };
}

/**
 * The panel's landing page: what is waiting, what is misconfigured, what changed.
 *
 * Every key below is gated by the capability that owns the tab it summarises, and
 * a denied key is *absent* rather than empty. Shipping it and hiding it in JSX
 * would make that JSX the only thing between a role and the data, which is
 * precisely what config/roles.js says the client-side capability list must never
 * be. The work behind a denied key is not run either.
 *
 * Ordered by what somebody acts on rather than by what is cheapest to count. The
 * totals that used to lead this page are denominators now.
 */
export const overview = asyncHandler(async (req, res) => {
  const role = req.actor.role;
  const mayUsers = can(role, 'user:read');
  const mayContent = can(role, 'content:read');
  const maySettings = can(role, 'settings:read');
  const mayFeedback = can(role, 'feedback:read');

  const now = Date.now();
  const weekAgo = new Date(now - 7 * DAY_MS);
  const monthAgo = new Date(now - 30 * DAY_MS);
  // A whole day back rather than a partial one, so the first column is not a
  // stub that reads as a quiet Monday.
  const since = new Date(`${dayKey(new Date(now - (WINDOW_DAYS - 1) * DAY_MS))}T00:00:00.000Z`);

  const [
    users,
    problems,
    shared,
    edited,
    patterns,
    guides,
    guidesEdited,
    missingGuides,
    activity,
    auditWeek,
    recent,
    health,
    feedbackOpen,
    feedbackOldest,
  ] = await Promise.all([
    mayUsers ? readUsers(weekAgo, monthAgo) : null,

    mayContent ? Problem.countDocuments() : 0,
    mayContent ? Problem.countDocuments({ owner: null }) : 0,
    mayContent ? Problem.countDocuments({ editedAt: { $ne: null } }) : 0,
    mayContent ? Pattern.countDocuments() : 0,
    mayContent ? PatternGuide.countDocuments() : 0,
    mayContent ? PatternGuide.countDocuments({ editedAt: { $ne: null } }) : 0,
    mayContent
      ? Pattern.aggregate([
          {
            $lookup: {
              from: 'patternguides',
              localField: 'slug',
              foreignField: 'patternSlug',
              as: 'g',
            },
          },
          { $match: { g: { $size: 0 } } },
          { $sort: { order: 1 } },
          { $project: { _id: 0, slug: 1, name: 1 } },
        ])
      : [],

    readActivity(since),
    AuditLog.countDocuments({ createdAt: { $gte: weekAgo } }),
    AuditLog.find().sort({ createdAt: -1 }).limit(10).lean(),

    maySettings ? readHealth() : null,

    mayFeedback ? Feedback.countDocuments({ status: { $in: OPEN_STATUSES } }) : 0,
    mayFeedback
      ? Feedback.findOne({ status: { $in: OPEN_STATUSES } })
          .sort({ createdAt: 1 })
          .select('createdAt')
          .lean()
      : null,
  ]);

  res.json({
    ...(mayUsers ? { users } : null),
    ...(mayContent
      ? {
          content: {
            problems,
            shared,
            custom: problems - shared,
            edited,
            patterns,
            guides,
            guidesEdited,
            /*
              The list, and the client counts it. Deriving "N without a guide"
              from `patterns - guides` instead would go wrong the moment a guide
              row outlives the pattern it belongs to — the subtraction lies while
              the list stays right.
            */
            missingGuides,
          },
        }
      : null),
    activity,
    audit: { week: auditWeek },
    recent,
    ...(maySettings ? { health } : null),
    ...(mayFeedback
      ? { feedback: { open: feedbackOpen, oldestAt: feedbackOldest?.createdAt || null } }
      : null),
  });
});
