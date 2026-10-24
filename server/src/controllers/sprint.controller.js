import { z } from 'zod';
import { Sprint } from '../models/Sprint.js';
import { SPRINT_LENGTHS, SprintEnrollment } from '../models/SprintEnrollment.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Interview Helper → 30-Day Sprint.
 *
 * The plan is shared and read-only here. What a person sets is their length
 * and start date. Solved status comes from the roadmap's own progress on the
 * client, so it is not repeated in this response.
 */

export const sprintParam = z.object({ key: z.string().regex(/^[a-z0-9-]{1,40}$/) });

export const enrollSchema = z
  .object({
    days: z.coerce.number().refine((n) => SPRINT_LENGTHS.includes(n), 'Pick 30, 45, 60, 75 or 90 days'),
    startedAt: z.coerce.date().optional(),
  })
  .strict();

const shapeEnrollment = (e) => e && { days: e.days, startedAt: e.startedAt };

export const getSprint = asyncHandler(async (req, res) => {
  const sprint = await Sprint.findOne({ key: req.params.key }).lean();
  if (!sprint) throw ApiError.notFound('Sprint not found');
  const enrollment = await SprintEnrollment.findOne({ user: req.userId, sprint: sprint.key }).lean();

  const item = (i) => ({
    problemId: String(i.problem),
    slug: i.slug,
    pattern: i.pattern,
    difficulty: i.difficulty,
    kit: i.kit,
  });

  res.json({
    sprint: {
      key: sprint.key,
      title: sprint.title,
      summary: sprint.summary,
      baseDays: sprint.baseDays,
      lengths: sprint.lengths,
      items: sprint.items.map(item),
      stretch: sprint.stretch.map(item),
    },
    enrollment: shapeEnrollment(enrollment),
  });
});

/** Start the sprint, or change its length. Changing length keeps the start date. */
export const enroll = asyncHandler(async (req, res) => {
  const sprint = await Sprint.exists({ key: req.params.key });
  if (!sprint) throw ApiError.notFound('Sprint not found');

  const set = { days: req.body.days };
  if (req.body.startedAt) set.startedAt = req.body.startedAt;

  const enrollment = await SprintEnrollment.findOneAndUpdate(
    { user: req.userId, sprint: req.params.key },
    { $set: set, $setOnInsert: req.body.startedAt ? {} : { startedAt: new Date() } },
    { new: true, upsert: true, runValidators: true },
  ).lean();

  res.json({ enrollment: shapeEnrollment(enrollment) });
});

/** Stop the sprint. Solved problems stay solved; only the schedule goes. */
export const leave = asyncHandler(async (req, res) => {
  await SprintEnrollment.deleteOne({ user: req.userId, sprint: req.params.key });
  res.status(204).end();
});
