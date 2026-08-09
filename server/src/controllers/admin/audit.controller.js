import { z } from 'zod';
import { AuditLog } from '../../models/AuditLog.js';
import { Pattern } from '../../models/Pattern.js';
import { PatternGuide } from '../../models/PatternGuide.js';
import { Problem } from '../../models/Problem.js';
import { User } from '../../models/User.js';
import { AUDIT_ACTIONS, AUDIT_LABEL } from '../../services/audit.service.js';
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

/** The panel's landing page: what exists, and what happened recently. */
export const overview = asyncHandler(async (_req, res) => {
  const [byRole, problems, shared, edited, patterns, guides, guidesEdited, recent] =
    await Promise.all([
      User.aggregate([{ $group: { _id: '$role', n: { $sum: 1 } } }]),
      Problem.countDocuments(),
      Problem.countDocuments({ owner: null }),
      Problem.countDocuments({ editedAt: { $ne: null } }),
      Pattern.countDocuments(),
      PatternGuide.countDocuments(),
      PatternGuide.countDocuments({ editedAt: { $ne: null } }),
      AuditLog.find().sort({ createdAt: -1 }).limit(8).lean(),
    ]);

  res.json({
    users: {
      total: byRole.reduce((n, r) => n + r.n, 0),
      byRole: Object.fromEntries(byRole.map((r) => [r._id, r.n])),
    },
    content: {
      problems,
      shared,
      custom: problems - shared,
      edited,
      patterns,
      guides,
      guidesEdited,
    },
    recent,
  });
});
