import { z } from 'zod';
import { profileSchema } from '../../config/profileFields.js';
import { ASSIGNABLE_ROLES, DEFAULT_ROLE } from '../../config/roles.js';
import { Problem } from '../../models/Problem.js';
import { Progress } from '../../models/Progress.js';
import { USER_PUBLIC_FIELDS, User } from '../../models/User.js';
import { AuditLog } from '../../models/AuditLog.js';
import {
  assertEmailNotReserved,
  assertNotSelf,
  loadTarget,
} from '../../services/admin.guards.js';
import { AUDIT, diff, recordAudit } from '../../services/audit.service.js';
import { hashPassword, registerUser } from '../../services/auth.service.js';
import { destroyAsset } from '../../services/media.service.js';
import { ApiError } from '../../utils/ApiError.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { escapeRegex, paged, pageQuery } from '../../utils/query.js';

/*
  Every read here goes through USER_PUBLIC_FIELDS. `passwordHash` is
  `select: false` on the schema so it cannot come along by accident, and this
  projection is the second layer: a sensitive field added to the schema later
  is not returned by default either.
*/

export const listQuery = pageQuery.extend({
  q: z.string().max(120).optional(),
  role: z.enum(['user', 'admin', 'dev_member', 'super_admin']).optional(),
});

export const updateSchema = z
  .object({
    name: z.string().min(1).max(60).optional(),
    email: z.string().email().optional(),
    // Shared with the self-edit route, so adding a profile field is one edit.
    profile: profileSchema.optional(),
  })
  .refine((body) => Object.keys(body).length > 0, 'Nothing to update');

/**
 * A new account, made by hand.
 *
 * The role is part of creation rather than a second call: an account that
 * exists as a plain `user` between the two requests is a window where the
 * person it was made for could sign in without what they were given.
 * `ASSIGNABLE_ROLES` again, so super_admin cannot be minted here either.
 */
export const createSchema = z.object({
  name: z.string().min(1, 'Name is required').max(60),
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(ASSIGNABLE_ROLES).default(DEFAULT_ROLE),
});

export const roleSchema = z.object({
  // super_admin is absent from the enum on purpose: the request fails
  // validation before a handler runs, so granting it is structurally
  // impossible rather than guarded by a check someone could forget.
  role: z.enum(ASSIGNABLE_ROLES),
});

export const passwordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const listUsers = asyncHandler(async (req, res) => {
  const { q, role, page, limit } = req.query;

  const filter = {};
  if (role) filter.role = role;
  if (q) {
    // Escaped: an unescaped user string in a RegExp is a denial of service
    // waiting for someone to type `(a+)+`.
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ name: rx }, { email: rx }];
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .select(USER_PUBLIC_FIELDS)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  res.json(paged('users', users, { total, page, limit }));
});

export const getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select(USER_PUBLIC_FIELDS).lean();
  if (!user) throw ApiError.notFound('User not found', 'NO_USER');

  // Counted rather than joined — the roadmap aggregation is scoped to its
  // caller and would be meaningless here.
  const [solved, attempted, problemsAdded, activity] = await Promise.all([
    Progress.countDocuments({ user: user._id, status: 'solved' }),
    Progress.countDocuments({ user: user._id, status: 'attempted' }),
    Problem.countDocuments({ addedBy: user._id }),
    AuditLog.find({ targetType: 'user', targetId: String(user._id) })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean(),
  ]);

  res.json({ user, stats: { solved, attempted, problemsAdded }, activity });
});

export const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;

  /*
    No target — this address is being claimed, not moved. The check still has
    to run: registering SUPER_ADMIN_EMAIL is promoted at its first sign-in, so
    without it "create a user" is a way to hand someone the site.
  */
  assertEmailNotReserved(email);

  // Shared with public signup, which is where "that email is taken" is worded.
  const created = await registerUser({ name, email, password, role });

  await recordAudit(req, {
    action: AUDIT.USER_CREATE,
    targetType: 'user',
    targetId: created._id,
    targetLabel: created.email,
    meta: { role: created.role },
  });

  // Re-read through the projection rather than serialising the document we
  // just made: that one was loaded with the hash on it.
  res
    .status(201)
    .json({ user: await User.findById(created._id).select(USER_PUBLIC_FIELDS).lean() });
});

export const updateUser = asyncHandler(async (req, res) => {
  const target = await loadTarget(req);
  const { name, email, profile } = req.body;

  if (email) assertEmailNotReserved(email, target);

  const before = target.toObject();
  if (name !== undefined) target.name = name;
  if (email !== undefined) target.email = email;
  if (profile) target.profile = { ...target.profile?.toObject?.(), ...profile };

  await target.save();

  await recordAudit(req, {
    action: AUDIT.USER_UPDATE,
    targetType: 'user',
    targetId: target._id,
    targetLabel: target.email,
    meta: diff(before, target.toObject(), ['name', 'email']),
  });

  res.json({ user: await User.findById(target._id).select(USER_PUBLIC_FIELDS).lean() });
});

export const setRole = asyncHandler(async (req, res) => {
  const target = await loadTarget(req);
  // Demoting yourself is a lockout with no way back short of editing Mongo.
  assertNotSelf(req, target, 'change the role of');

  const from = target.role;
  target.role = req.body.role;
  await target.save();

  await recordAudit(req, {
    action: AUDIT.USER_ROLE,
    targetType: 'user',
    targetId: target._id,
    targetLabel: target.email,
    meta: { from, to: target.role },
  });

  res.json({ user: await User.findById(target._id).select(USER_PUBLIC_FIELDS).lean() });
});

export const setPassword = asyncHandler(async (req, res) => {
  const target = await loadTarget(req);

  /*
    Bumping tokenVersion is what makes this reach devices already signed in —
    every token minted before now carries the old number and is refused at its
    next refresh. Without it the old password's sessions keep working for up to
    thirty days.
  */
  await User.updateOne(
    { _id: target._id },
    { $set: { passwordHash: await hashPassword(req.body.password) }, $inc: { tokenVersion: 1 } },
  );

  await recordAudit(req, {
    action: AUDIT.USER_PASSWORD,
    targetType: 'user',
    targetId: target._id,
    targetLabel: target.email,
  });

  res.json({ ok: true });
});

export const revokeSessions = asyncHandler(async (req, res) => {
  const target = await loadTarget(req);
  await User.updateOne({ _id: target._id }, { $inc: { tokenVersion: 1 } });

  await recordAudit(req, {
    action: AUDIT.USER_REVOKE,
    targetType: 'user',
    targetId: target._id,
    targetLabel: target.email,
  });

  res.json({ ok: true });
});

export const removeUserAvatar = asyncHandler(async (req, res) => {
  const target = await loadTarget(req);
  const publicId = target.avatar?.publicId;

  if (publicId) {
    target.avatar = undefined;
    await target.save();
    await destroyAsset(publicId);
    await recordAudit(req, {
      action: AUDIT.USER_AVATAR_REMOVE,
      targetType: 'user',
      targetId: target._id,
      targetLabel: target.email,
    });
  }

  res.json({ user: await User.findById(target._id).select(USER_PUBLIC_FIELDS).lean() });
});

export const deleteUser = asyncHandler(async (req, res) => {
  const target = await loadTarget(req);
  assertNotSelf(req, target, 'delete');

  const avatarId = target.avatar?.publicId;
  const owned = await Problem.find({ owner: target._id }).select('_id').lean();
  const ownedIds = owned.map((p) => p._id);

  const progress = await Progress.deleteMany({ user: target._id });
  if (ownedIds.length) {
    // Everyone's progress on their private problems, then the problems.
    await Progress.deleteMany({ problem: { $in: ownedIds } });
    await Problem.deleteMany({ _id: { $in: ownedIds } });
  }

  /*
    Problems they contributed that were promoted into the shared list stay —
    that separation is the whole reason `owner` and `addedBy` are two fields.
    Only the pointer to the departed account is cleared.
  */
  const kept = await Problem.updateMany(
    { addedBy: target._id, owner: null },
    { $set: { addedBy: null } },
  );

  // Read the label before the row is gone, then delete, then reach outside.
  const label = target.email;
  await User.deleteOne({ _id: target._id });
  if (avatarId) await destroyAsset(avatarId);

  await recordAudit(req, {
    action: AUDIT.USER_DELETE,
    targetType: 'user',
    targetId: target._id,
    targetLabel: label,
    meta: {
      progressDeleted: progress.deletedCount,
      problemsDeleted: ownedIds.length,
      contributionsKept: kept.modifiedCount,
    },
  });

  res.json({
    ok: true,
    progressDeleted: progress.deletedCount,
    problemsDeleted: ownedIds.length,
  });
});
