import { z } from 'zod';
import { SIGNUP_STATUSES, SignupRequest, signupRow } from '../../models/SignupRequest.js';
import { AUDIT, recordAudit } from '../../services/audit.service.js';
import { approveRequest, rejectRequest } from '../../services/signup.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { escapeRegex, paged, pageQuery } from '../../utils/query.js';

export const listQuery = pageQuery.extend({
  q: z.string().max(200).optional(),
  status: z.enum(SIGNUP_STATUSES).optional(),
});

export const rejectSchema = z
  .object({
    /**
     * Sent to the applicant verbatim, so it is capped and trimmed here rather
     * than trusted to be short because the textarea in the panel is small.
     */
    note: z.string().trim().max(500).optional().default(''),
  })
  .strict();

/**
 * GET /admin/signups — who is waiting.
 *
 * Sorted by arrival and by nothing else, for the reason the feedback queue is:
 * sorting on "recently decided" moves rows between pages while somebody is
 * working down them.
 */
export const listSignups = asyncHandler(async (req, res) => {
  const { q, status, page, limit } = req.query;

  const filter = {};
  if (status) filter.status = status;
  if (q) {
    // Escaped — an unescaped user string in a RegExp is a denial of service.
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ name: rx }, { email: rx }, { mobile: rx }];
  }

  const [rows, total, grouped] = await Promise.all([
    SignupRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    SignupRequest.countDocuments(filter),
    // Over the whole collection, not the page: "3 waiting" has to mean three.
    SignupRequest.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
  ]);

  res.json({
    ...paged('requests', rows.map(signupRow), { total, page, limit }),
    counts: {
      ...Object.fromEntries(SIGNUP_STATUSES.map((s) => [s, 0])),
      ...Object.fromEntries(grouped.map((g) => [g._id, g.n])),
    },
    statuses: SIGNUP_STATUSES,
  });
});

/** POST /admin/signups/:id/approve — the account exists after this. */
export const approveSignup = asyncHandler(async (req, res) => {
  const { request, user } = await approveRequest(req.params.id, req.actor);

  await recordAudit(req, {
    action: AUDIT.SIGNUP_APPROVE,
    targetType: 'signup',
    targetId: request._id,
    targetLabel: request.email,
    // The account this became, so the activity feed can be followed forward
    // from "let in" to everything that account then did.
    meta: { user: String(user._id), name: request.name },
  });

  res.json({ request: signupRow(request), user: { _id: user._id, email: user.email } });
});

/** POST /admin/signups/:id/reject */
export const rejectSignup = asyncHandler(async (req, res) => {
  const request = await rejectRequest(req.params.id, req.body.note, req.actor);

  await recordAudit(req, {
    action: AUDIT.SIGNUP_REJECT,
    targetType: 'signup',
    targetId: request._id,
    targetLabel: request.email,
    meta: { name: request.name, note: request.note || '' },
  });

  res.json({ request: signupRow(request) });
});
