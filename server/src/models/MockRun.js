import mongoose from 'mongoose';

import { DEFAULT_LANG, SOLUTION_LANGS } from '../config/attempts.js';

/**
 * One mock interview, self-scored.
 *
 * The Playbook asks for a timed mock every Saturday from week six. Without
 * something to run it, that is nineteen Saturdays that need another person — so
 * this is the harness: two problems, one clock across both, the answers out of
 * reach, an approach you have to state before you may write code, and a rubric
 * at the end that you fill in honestly.
 *
 * No model marks it, and it does not need one. The four rubric lines are the
 * things candidates actually lose on — not clarifying, not stating complexity,
 * never testing an example, not finishing — and every one of them is something
 * you can answer about yourself. What was missing was never the judgement; it
 * was being made to sit the exam at all.
 *
 * Separate from `Progress` on purpose, like `DrillRun`. A mock is not two
 * attempts: the clock is shared, the constraint is the point, and folding it
 * into the attempt log would make "I sat down with this problem" mean two
 * different things.
 */

const mockProblemSchema = new mongoose.Schema(
  {
    /** Ref only. If the problem is deleted the row stops being evidence too. */
    problem: { type: mongoose.Schema.Types.ObjectId, ref: 'Problem', required: true },

    /**
     * What you said you were going to do, before the code box unlocked.
     *
     * The forcing function of the whole exercise. In a real interview you have
     * to say the approach out loud before you type, and typing first is the
     * habit that loses the round — so here the code box stays locked until this
     * has something in it.
     */
    approach: { type: String, default: '', maxlength: 2000 },

    code: { type: String, default: '', maxlength: 20000 },
    lang: { type: String, enum: SOLUTION_LANGS, default: DEFAULT_LANG },

    /** Did you get it out in the time. Your answer, not a judge's. */
    finished: { type: Boolean, default: false },
  },
  { _id: false },
);

/**
 * The four things people lose on.
 *
 * Fixed rather than configurable. A rubric you can edit is a rubric you soften
 * on the week you did badly, which is exactly the week it is worth reading.
 */
const rubricSchema = new mongoose.Schema(
  {
    clarified: { type: Boolean, default: false },
    complexity: { type: Boolean, default: false },
    tested: { type: Boolean, default: false },
    narrated: { type: Boolean, default: false },
  },
  { _id: false },
);

const mockRunSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    at: { type: Date, default: Date.now },

    /** How long the session was given, and how long it actually took. */
    budgetMinutes: { type: Number, default: 45, min: 5, max: 240 },
    minutes: { type: Number, default: 0, min: 0, max: 240 },

    problems: { type: [mockProblemSchema], default: [] },
    rubric: { type: rubricSchema, default: () => ({}) },
  },
  { timestamps: true },
);

mockRunSchema.index({ user: 1, at: -1 });

export const MockRun = mongoose.model('MockRun', mockRunSchema);
