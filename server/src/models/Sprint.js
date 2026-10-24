import mongoose from 'mongoose';

/**
 * A fixed-list problem sprint, e.g. "Sprint 300": the problems in the order to
 * solve them, which the page then spreads across 30, 45, 60, 75 or 90 days.
 *
 * Built by scripts/interview/build-sprint.js, not edited in the app. The plan
 * itself is shared; each person's length and start date live in
 * SprintEnrollment, and solved status is the ordinary Progress row, so a
 * problem solved on the roadmap counts here too.
 *
 * `items` is the core list. `stretch` holds extra problems shown after it
 * (the resource kit's Hard problems that are in our bank but not in the 300).
 */
const itemSchema = new mongoose.Schema(
  {
    problem: { type: mongoose.Schema.Types.ObjectId, ref: 'Problem', required: true },
    slug: { type: String, required: true },
    pattern: { type: String, default: '' },
    difficulty: { type: String, default: '' },
    // Also on the resource kit's 30-day list.
    kit: { type: Boolean, default: false },
  },
  { _id: false },
);

const sprintSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    summary: { type: String, default: '' },
    baseDays: { type: Number, default: 30 },
    lengths: { type: [Number], default: [30, 45, 60, 75, 90] },
    items: { type: [itemSchema], default: [] },
    stretch: { type: [itemSchema], default: [] },
  },
  { timestamps: true },
);

export const Sprint = mongoose.model('Sprint', sprintSchema);
