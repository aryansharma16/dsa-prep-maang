import { z } from 'zod';
import {
  Feedback,
  FEEDBACK_STATUSES,
  FEEDBACK_TYPES,
  feedbackRow,
} from '../../models/Feedback.js';
import { AUDIT, diff, recordAudit } from '../../services/audit.service.js';
import { ApiError } from '../../utils/ApiError.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { escapeRegex, objectId, paged, pageQuery } from '../../utils/query.js';

export const listQuery = pageQuery.extend({
  q: z.string().max(200).optional(),
  status: z.enum(FEEDBACK_STATUSES).optional(),
  type: z.enum(FEEDBACK_TYPES).optional(),
  submitter: objectId.optional(),
});

export const updateSchema = z
  .object({
    status: z.enum(FEEDBACK_STATUSES).optional(),
    /**
     * An empty string clears the reply; an absent key leaves it alone.
     *
     * Two different intentions that `.optional()` on its own cannot tell apart,
     * which is why the handler below branches on `!== undefined` rather than on
     * whether the string is truthy.
     */
    response: z.string().max(2000).optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, 'Nothing to update');

/**
 * GET /admin/feedback — the queue.
 *
 * Sorted by when it arrived and by nothing else. Sorting on `statusChangedAt`
 * would be the obvious "most recently touched first", and it would move rows
 * between pages as staff work them — the worst behaviour pagination can have on a
 * list somebody is going down one item at a time.
 */
export const listFeedback = asyncHandler(async (req, res) => {
  const { q, status, type, submitter, page, limit } = req.query;

  const filter = {};
  if (status) filter.status = status;
  if (type) filter.type = type;
  if (submitter) filter.submitter = submitter;
  if (q) {
    // Escaped: an unescaped user string in a RegExp is a denial of service
    // waiting for someone to type `(a+)+`.
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ title: rx }, { message: rx }, { submitterName: rx }, { submitterEmail: rx }];
  }

  const [rows, total, grouped] = await Promise.all([
    Feedback.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Feedback.countDocuments(filter),
    // Over the whole collection rather than the current page — the same argument
    // the activity feed makes about its actor list. A count derived from the page
    // in front of you only ever counts the page in front of you.
    Feedback.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
  ]);

  res.json({
    ...paged('submissions', rows.map(feedbackRow), { total, page, limit }),
    // Seeded with a zero for every status first, so a filter that matches nothing
    // reads "0" instead of disappearing from the row of counts.
    counts: {
      ...Object.fromEntries(FEEDBACK_STATUSES.map((s) => [s, 0])),
      ...Object.fromEntries(grouped.map((g) => [g._id, g.n])),
    },
    types: FEEDBACK_TYPES,
    statuses: FEEDBACK_STATUSES,
  });
});

/** PATCH /admin/feedback/:id — set the status, write the reply, or both. */
export const updateFeedback = asyncHandler(async (req, res) => {
  const item = await Feedback.findById(req.params.id);
  if (!item) throw ApiError.notFound('That submission no longer exists', 'NO_FEEDBACK');

  const before = item.toObject();
  const { status, response } = req.body;

  // Stamped only when the status actually moves. Saving a reply without touching
  // the status must not reset how long the item has been sitting there.
  if (status && status !== item.status) {
    item.status = status;
    item.statusChangedAt = new Date();
    item.statusChangedBy = req.actor._id;
  }

  let responseAction = null;
  if (response !== undefined) {
    const text = response.trim();
    responseAction = text ? (item.response?.text ? 'edited' : 'written') : 'cleared';
    // `undefined`, not null — that is how Mongoose stores "there is no
    // subdocument here", which is the state a submission starts in.
    item.response = text
      ? { text, by: req.actor._id, byName: req.actor.name || '', at: new Date() }
      : undefined;
  }

  await item.save();

  await recordAudit(req, {
    action: AUDIT.FEEDBACK_UPDATE,
    targetType: 'feedback',
    targetId: item._id,
    targetLabel: item.title.slice(0, 80),
    meta: {
      ...diff(before, item.toObject(), ['status']),
      // A verb rather than the reply itself. `diff` skips objects on purpose, and
      // copying the text in would put a second copy of it in a collection whose
      // own comment says diffs, never documents.
      ...(responseAction ? { response: responseAction } : {}),
      submitter: item.submitterEmail || '',
    },
  });

  res.json({ submission: feedbackRow(item.toObject()) });
});
