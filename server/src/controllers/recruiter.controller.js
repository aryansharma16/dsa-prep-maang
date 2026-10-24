import mongoose from 'mongoose';
import { z } from 'zod';
import {
  Recruiter,
  RECRUITER_SENIORITY,
  RECRUITER_VISIBILITY,
  recruiterCard,
} from '../models/Recruiter.js';
import { RecruiterOutreach, RECRUITER_STATUSES } from '../models/RecruiterOutreach.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { escapeRegex, makePageQuery, paged } from '../utils/query.js';

/**
 * The MAANG Recruiter Directory.
 *
 * Who sees what:
 *   - `shared` contacts: every signed-in user.
 *   - `private` contacts: their owner, and the super admin.
 * Who changes what:
 *   - locked contacts (the base list): nobody.
 *   - other contacts' details: their owner, or the super admin.
 *   - outreach status and note: each user, for themselves only.
 */

const MAX_PER_USER = 2000;

/** Who is asking, and whether they may see and change everything. */
async function viewerOf(req) {
  const user = await User.findById(req.userId).select('role').lean();
  if (!user) throw ApiError.unauthorized('Not authenticated', 'NO_USER');
  return { id: new mongoose.Types.ObjectId(req.userId), admin: user.role === 'super_admin' };
}

/** The contacts this viewer may see. */
const visibleTo = (viewer) =>
  viewer.admin ? {} : { $or: [{ visibility: 'shared' }, { owner: viewer.id }] };

/** Load a contact the viewer can see, or 404 (never reveal that a private one exists). */
async function findVisible(viewer, id) {
  const row = await Recruiter.findOne({ _id: id, ...visibleTo(viewer) });
  if (!row) throw ApiError.notFound('Contact not found');
  return row;
}

const canEdit = (viewer, row) =>
  !row.locked && (viewer.admin || String(row.owner) === String(viewer.id));

const optionalText = (max) => z.string().trim().max(max).optional();

const fields = {
  name: z.string().trim().min(1, 'Name is required').max(120),
  title: optionalText(160),
  seniority: z.enum(RECRUITER_SENIORITY).optional(),
  company: z.string().trim().min(1, 'Company is required').max(80),
  location: optionalText(120),
  phone: optionalText(40),
  email: z.union([z.literal(''), z.string().trim().email('Not a valid email').max(160)]).optional(),
  linkedin: z
    .union([z.literal(''), z.string().trim().url('Not a valid link').max(300)])
    .optional(),
  visibility: z.enum(RECRUITER_VISIBILITY).optional(),
};

export const createSchema = z.object(fields).strict();
export const updateSchema = z
  .object(fields)
  .partial()
  .strict()
  .refine((body) => Object.keys(body).length > 0, 'Nothing to update');

export const outreachSchema = z
  .object({
    status: z.enum(RECRUITER_STATUSES).optional(),
    note: z.string().trim().max(1000).optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, 'Nothing to update');

export const idParam = z.object({ id: z.string().regex(/^[a-f0-9]{24}$/, 'Bad id') });

/** 20 per page by default; search and filters run in the query, not the client. */
export const listQuery = makePageQuery({ max: 50, defaultLimit: 20 }).extend({
  q: z.string().trim().max(100).optional(),
  company: z.string().trim().max(80).optional(),
  status: z.enum(RECRUITER_STATUSES).optional(),
  mine: z.enum(['true', 'false']).optional(),
});

const cardsFor = async (rows, viewer) => {
  const outreach = await RecruiterOutreach.find({
    user: viewer.id,
    recruiter: { $in: rows.map((r) => r._id) },
  }).lean();
  const byId = new Map(outreach.map((o) => [String(o.recruiter), o]));
  return rows.map((r) =>
    recruiterCard(r, { viewerId: viewer.id, admin: viewer.admin, outreach: byId.get(String(r._id)) }),
  );
};

export const list = asyncHandler(async (req, res) => {
  const viewer = await viewerOf(req);
  const { page, limit, q, company, status, mine } = req.query;

  const visible = visibleTo(viewer);
  const and = [visible];
  if (company) and.push({ company });
  if (mine === 'true') and.push({ owner: viewer.id, locked: { $ne: true } });
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    and.push({ $or: [{ name: rx }, { title: rx }, { company: rx }, { location: rx }, { email: rx }] });
  }
  if (status) {
    // Status lives in the viewer's outreach rows; "new" means no row past new.
    if (status === 'new') {
      const moved = await RecruiterOutreach.distinct('recruiter', {
        user: viewer.id,
        status: { $ne: 'new' },
      });
      and.push({ _id: { $nin: moved } });
    } else {
      const ids = await RecruiterOutreach.distinct('recruiter', { user: viewer.id, status });
      and.push({ _id: { $in: ids } });
    }
  }
  const filter = { $and: and };

  // The chips and stat cards describe everything this viewer can see, not the page.
  const [rows, total, companies, progress] = await Promise.all([
    Recruiter.find(filter)
      .sort({ locked: -1, company: 1, name: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('owner', 'name')
      .lean(),
    Recruiter.countDocuments(filter),
    Recruiter.aggregate([
      { $match: visible },
      { $group: { _id: '$company', count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
    ]),
    RecruiterOutreach.aggregate([
      { $match: { user: viewer.id, status: { $ne: 'new' } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
  ]);

  const byStatus = Object.fromEntries(progress.map((s) => [s._id, s.count]));

  res.json({
    ...paged('recruiters', await cardsFor(rows, viewer), { total, page, limit }),
    companies: companies.map((c) => ({ name: c._id, count: c.count })),
    stats: {
      total: companies.reduce((n, c) => n + c.count, 0),
      contacted: progress.reduce((n, s) => n + s.count, 0),
      replied: (byStatus.replied || 0) + (byStatus.call || 0),
    },
    admin: viewer.admin,
  });
});

export const create = asyncHandler(async (req, res) => {
  const viewer = await viewerOf(req);
  const count = await Recruiter.countDocuments({ owner: viewer.id });
  if (count >= MAX_PER_USER) throw ApiError.badRequest('You have added the maximum number of contacts', 'LIMIT');
  const row = await Recruiter.create({ visibility: 'shared', ...req.body, owner: viewer.id });
  const [card] = await cardsFor([row.toObject()], viewer);
  res.status(201).json({ recruiter: card });
});

export const update = asyncHandler(async (req, res) => {
  const viewer = await viewerOf(req);
  const row = await findVisible(viewer, req.params.id);
  if (row.locked) throw ApiError.forbidden('This contact is part of the main directory and cannot be edited');
  if (!canEdit(viewer, row)) throw ApiError.forbidden('Only the person who added this contact can edit it');
  row.set(req.body);
  await row.save();
  await row.populate('owner', 'name');
  const [card] = await cardsFor([row.toObject()], viewer);
  res.json({ recruiter: card });
});

export const remove = asyncHandler(async (req, res) => {
  const viewer = await viewerOf(req);
  const row = await findVisible(viewer, req.params.id);
  if (row.locked) throw ApiError.forbidden('This contact is part of the main directory and cannot be deleted');
  if (!canEdit(viewer, row)) throw ApiError.forbidden('Only the person who added this contact can delete it');
  await Promise.all([row.deleteOne(), RecruiterOutreach.deleteMany({ recruiter: row._id })]);
  res.status(204).end();
});

/** Anyone who can see a contact can track their own outreach with it. */
export const setOutreach = asyncHandler(async (req, res) => {
  const viewer = await viewerOf(req);
  const row = await findVisible(viewer, req.params.id);

  const patch = { ...req.body };
  const existing = await RecruiterOutreach.findOne({ user: viewer.id, recruiter: row._id }).lean();
  if (patch.status && patch.status !== 'new' && !existing?.contactedAt) patch.contactedAt = new Date();

  const outreach = await RecruiterOutreach.findOneAndUpdate(
    { user: viewer.id, recruiter: row._id },
    { $set: patch },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  ).lean();

  res.json({ status: outreach.status, note: outreach.note, contactedAt: outreach.contactedAt });
});
