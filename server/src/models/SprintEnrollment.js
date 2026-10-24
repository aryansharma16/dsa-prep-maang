import mongoose from 'mongoose';

/**
 * One person's run at a sprint: how many days they chose and when they started.
 * Progress is not stored here; it is read from Progress, so solving a problem
 * anywhere in the app ticks it off the sprint as well.
 */
export const SPRINT_LENGTHS = [30, 45, 60, 75, 90];

const enrollmentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sprint: { type: String, required: true },
    days: { type: Number, enum: SPRINT_LENGTHS, default: 30 },
    startedAt: { type: Date, required: true },
  },
  { timestamps: true },
);

enrollmentSchema.index({ user: 1, sprint: 1 }, { unique: true });

export const SprintEnrollment = mongoose.model('SprintEnrollment', enrollmentSchema);
