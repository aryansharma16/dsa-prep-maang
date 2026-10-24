import mongoose from 'mongoose';
import { z } from 'zod';
import { STORY_THEMES, Story, StoryPractice } from '../models/Story.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Interview Helper → Behavioral Prep. Stories and practice logs are private:
 * every query is scoped to `req.userId`.
 */
const MAX_STORIES = 60;

const text = (max) => z.string().trim().max(max).optional();

const storyFields = {
  title: z.string().trim().min(1, 'Give the story a title').max(120),
  themes: z.array(z.enum(STORY_THEMES)).max(STORY_THEMES.length).optional(),
  lps: z.array(z.string().regex(/^[a-z-]{2,40}$/)).max(16).optional(),
  questions: z.array(z.string().regex(/^[a-z0-9-]{1,40}$/)).max(60).optional(),
  situation: text(1500),
  task: text(1500),
  action: text(3000),
  result: text(1500),
  learning: text(600),
  resumeBullet: text(300),
  draft: z.boolean().optional(),
};

export const storySchema = z.object(storyFields).strict();
export const storyPatchSchema = z
  .object(storyFields)
  .partial()
  .strict()
  .refine((b) => Object.keys(b).length > 0, 'Nothing to update');
export const idParam = z.object({ id: z.string().regex(/^[a-f0-9]{24}$/, 'Bad id') });

export const practiceSchema = z
  .object({
    questionId: z.string().regex(/^[a-z0-9-]{1,40}$/),
    story: z.string().regex(/^[a-f0-9]{24}$/).nullable().optional(),
    seconds: z.number().int().min(0).max(3600).optional(),
    rating: z.enum(['nailed', 'ok', 'rough']),
    note: text(500),
  })
  .strict();

const card = (s) => ({
  id: String(s._id),
  title: s.title,
  themes: s.themes,
  lps: s.lps,
  questions: s.questions || [],
  situation: s.situation,
  task: s.task,
  action: s.action,
  result: s.result,
  learning: s.learning,
  resumeBullet: s.resumeBullet,
  draft: s.draft,
  updatedAt: s.updatedAt,
});

/** Stories, plus your practice history and per-question last result. */
export const listStories = asyncHandler(async (req, res) => {
  const user = new mongoose.Types.ObjectId(req.userId);
  const [stories, recent, byQuestion, uses] = await Promise.all([
    Story.find({ owner: user }).sort({ updatedAt: -1 }).lean(),
    StoryPractice.find({ user }).sort({ createdAt: -1 }).limit(30).lean(),
    StoryPractice.aggregate([
      { $match: { user } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: '$questionId', last: { $first: '$rating' }, count: { $sum: 1 }, at: { $first: '$createdAt' } } },
    ]),
    StoryPractice.aggregate([{ $match: { user, story: { $ne: null } } }, { $group: { _id: '$story', n: { $sum: 1 } } }]),
  ]);
  const usesById = Object.fromEntries(uses.map((u) => [String(u._id), u.n]));
  res.json({
    stories: stories.map((s) => ({ ...card(s), practised: usesById[String(s._id)] || 0 })),
    practice: {
      total: await StoryPractice.countDocuments({ user }),
      recent: recent.map((p) => ({
        id: String(p._id),
        questionId: p.questionId,
        story: p.story ? String(p.story) : null,
        seconds: p.seconds,
        rating: p.rating,
        note: p.note,
        at: p.createdAt,
      })),
      byQuestion: Object.fromEntries(byQuestion.map((q) => [q._id, { last: q.last, count: q.count, at: q.at }])),
    },
  });
});

export const createStory = asyncHandler(async (req, res) => {
  if ((await Story.countDocuments({ owner: req.userId })) >= MAX_STORIES) {
    throw ApiError.badRequest('That is plenty of stories; edit an existing one', 'LIMIT');
  }
  const story = await Story.create({ ...req.body, owner: req.userId });
  res.status(201).json({ story: { ...card(story), practised: 0 } });
});

export const updateStory = asyncHandler(async (req, res) => {
  const story = await Story.findOneAndUpdate(
    { _id: req.params.id, owner: req.userId },
    { $set: req.body },
    { new: true, runValidators: true },
  );
  if (!story) throw ApiError.notFound('Story not found');
  res.json({ story: card(story) });
});

export const deleteStory = asyncHandler(async (req, res) => {
  const result = await Story.deleteOne({ _id: req.params.id, owner: req.userId });
  if (!result.deletedCount) throw ApiError.notFound('Story not found');
  await StoryPractice.updateMany({ user: req.userId, story: req.params.id }, { $set: { story: null } });
  res.status(204).end();
});

export const logPractice = asyncHandler(async (req, res) => {
  if (req.body.story && !(await Story.exists({ _id: req.body.story, owner: req.userId }))) {
    throw ApiError.notFound('Story not found');
  }
  const p = await StoryPractice.create({ ...req.body, user: req.userId });
  res.status(201).json({
    practice: { id: String(p._id), questionId: p.questionId, story: p.story ? String(p.story) : null, seconds: p.seconds, rating: p.rating, note: p.note, at: p.createdAt },
  });
});
