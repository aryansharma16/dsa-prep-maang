import mongoose from 'mongoose';
import { z } from 'zod';
import {
  Feedback,
  FEEDBACK_STATUSES,
  FEEDBACK_TYPES,
  feedbackCard,
  OPEN_STATUSES,
} from '../models/Feedback.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { paged, pageQuery } from '../utils/query.js';

/*
  `requireAuth` leaves `req.userId` as a plain string, deliberately — it reads no
  database. Mongoose casts that inside a `find` filter but not inside an
  aggregation `$match`, so everything here goes through the same helper
  note.controller.js uses rather than relying on which of the two a line happens
  to be.
*/
const oid = (id) => new mongoose.Types.ObjectId(id);

/**
 * How many unanswered submissions one account may have at once.
 *
 * A cap on what is still open, not a rate per hour, and the difference is the
 * whole design. A time window punishes the person who finds three bugs in ten
 * minutes — exactly the person this feature exists for — and rewards anyone
 * patient about being a nuisance. A cap on the unanswered clears itself: staff
 * working the queue is what hands somebody their slots back, so the limit tracks
 * the conversation rather than the clock. It also needs no counter collection,
 * no TTL and no timer, which a daily quota does — ChatUsage exists precisely
 * because that shape needs its own lifetime.
 */
const OPEN_LIMIT = 5;

/**
 * Strict, which is unusual for a create schema here and is the point.
 *
 * This is the one form an ordinary account posts to. A body carrying `status` or
 * `response` has to be refused out loud rather than quietly dropped, so that the
 * refusal is a 400 somebody reads instead of a privilege that looks like it
 * worked.
 */
export const createSchema = z
  .object({
    type: z.enum(FEEDBACK_TYPES).default('suggestion'),
    title: z.string().trim().min(3, 'Give it a short title').max(140),
    message: z.string().trim().min(10, 'Say a little more than that').max(4000),
    // `location.pathname` from wherever the form was opened.
    path: z.string().max(200).optional(),
  })
  .strict();

export const listQuery = pageQuery.extend({
  status: z.enum(FEEDBACK_STATUSES).optional(),
  type: z.enum(FEEDBACK_TYPES).optional(),
});

/**
 * GET /api/feedback — what you have sent, and what happened to it.
 *
 * The vocabulary rides along with the page, the way the motivation list ships its
 * trigger catalogue: the form needs the type list to draw itself and the list
 * needs the status names to label rows, and neither should wait on a second
 * request for a few hundred bytes. `remaining` is here so the form can say why
 * Submit is unavailable *before* the 429 rather than after it.
 */
export const listMine = asyncHandler(async (req, res) => {
  const submitter = oid(req.userId);
  const { status, type, page, limit } = req.query;

  const filter = { submitter };
  if (status) filter.status = status;
  if (type) filter.type = type;

  const [rows, total, open] = await Promise.all([
    Feedback.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Feedback.countDocuments(filter),
    Feedback.countDocuments({ submitter, status: { $in: OPEN_STATUSES } }),
  ]);

  res.json({
    ...paged('submissions', rows.map(feedbackCard), { total, page, limit }),
    types: FEEDBACK_TYPES,
    statuses: FEEDBACK_STATUSES,
    // `openLimit`, not `limit` — `paged` already spent that name on the page
    // size, and two meanings for one key is a bug waiting for whoever reads the
    // second one first.
    openLimit: OPEN_LIMIT,
    remaining: Math.max(0, OPEN_LIMIT - open),
  });
});

/** POST /api/feedback — send one. */
export const create = asyncHandler(async (req, res) => {
  const submitter = oid(req.userId);

  const open = await Feedback.countDocuments({ submitter, status: { $in: OPEN_STATUSES } });
  if (open >= OPEN_LIMIT) {
    const error = new ApiError(
      429,
      `You already have ${OPEN_LIMIT} submissions waiting for a reply. Give us a chance to answer those first.`,
      'FEEDBACK_LIMIT',
    );
    error.meta = { open, limit: OPEN_LIMIT };
    throw error;
  }

  // Read once and copy in, the way a note copies its author's name. The row has
  // to stay readable after the account is gone.
  const user = await User.findById(submitter).select('name email').lean();

  const item = await Feedback.create({
    ...req.body,
    submitter,
    submitterName: user?.name || '',
    submitterEmail: user?.email || '',
  });

  res.status(201).json({
    submission: feedbackCard(item.toObject()),
    remaining: Math.max(0, OPEN_LIMIT - open - 1),
  });
});
