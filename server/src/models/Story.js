import mongoose from 'mongoose';

/**
 * A behavioural interview story in STAR form, owned by one account and never
 * shown to anyone else. Themes say which questions it can answer; `lps` maps
 * it to Amazon Leadership Principles (keys in client/src/interview/behavioral.js).
 */
export const STORY_THEMES = [
  'ownership',
  'conflict',
  'failure',
  'ambiguity',
  'impact',
  'leadership',
  'customer',
  'deadline',
  'learning',
  'innovation',
];

const storySchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    themes: { type: [{ type: String, enum: STORY_THEMES }], default: [] },
    lps: { type: [String], default: [] },
    // Question ids (client/src/interview/behavioral.js) this story really
    // answers. Linked by you, so a story is only offered where it fits;
    // theme matching is just the fallback suggestion.
    questions: { type: [String], default: [] },
    situation: { type: String, trim: true, maxlength: 1500, default: '' },
    task: { type: String, trim: true, maxlength: 1500, default: '' },
    action: { type: String, trim: true, maxlength: 3000, default: '' },
    result: { type: String, trim: true, maxlength: 1500, default: '' },
    // The one-line lesson or "what I'd do differently", asked in most follow-ups.
    learning: { type: String, trim: true, maxlength: 600, default: '' },
    // Which resume bullet this backs up, so the story and the claim stay consistent.
    resumeBullet: { type: String, trim: true, maxlength: 300, default: '' },
    draft: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const Story = mongoose.model('Story', storySchema);

/**
 * One practice answer: which question, which story you used, how long you
 * spoke and how it felt. Per user, for the practice history and theme stats.
 */
const practiceSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    questionId: { type: String, required: true, maxlength: 40 },
    story: { type: mongoose.Schema.Types.ObjectId, ref: 'Story', default: null },
    seconds: { type: Number, min: 0, max: 3600, default: 0 },
    rating: { type: String, enum: ['nailed', 'ok', 'rough'], required: true },
    note: { type: String, trim: true, maxlength: 500, default: '' },
  },
  { timestamps: true },
);

practiceSchema.index({ user: 1, createdAt: -1 });

export const StoryPractice = mongoose.model('StoryPractice', practiceSchema);
