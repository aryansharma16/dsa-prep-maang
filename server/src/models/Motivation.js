import mongoose from 'mongoose';
import { CATEGORIES, SURFACES, TRIGGER_KEYS } from '../config/motivationTriggers.js';

/**
 * One line of copy, and the condition under which it is allowed to appear.
 *
 * The enums are imported rather than written out, so adding a trigger or a
 * surface is one edit in config/motivationTriggers.js instead of one here that
 * someone forgets and only discovers when a save fails validation.
 */
const motivationSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true, maxlength: 240 },
    category: { type: String, enum: CATEGORIES, default: 'grind', index: true },

    /** At least one — a line that can appear nowhere is a row nobody will find. */
    surfaces: {
      type: [String],
      enum: SURFACES,
      default: ['roadmap'],
      validate: [(value) => value.length > 0, 'Pick at least one page'],
    },

    trigger: { type: String, enum: TRIGGER_KEYS, default: 'always', index: true },
    /** Null when the trigger takes no number. See `thresholdFor`. */
    threshold: { type: Number, default: null },

    /**
     * How many slots this line takes in the pool of equally-specific
     * candidates. It is not a priority — specificity decides that — it is how
     * often you want to see this one rather than its neighbours.
     */
    weight: { type: Number, min: 1, max: 5, default: 1 },
    active: { type: Boolean, default: true, index: true },

    /**
     * The seeder's identity for this row, and nothing else's.
     *
     * Sparse-unique because lines written in the panel have no seed identity:
     * they are `null` here, and that is exactly what keeps the seeder's prune
     * from deleting somebody's hand-written line as "no longer in the file".
     * An explicit slug rather than a hash of the text, so fixing a typo in the
     * content file updates that row instead of inserting a second one.
     */
    key: { type: String, default: null, unique: true, sparse: true },

    // The contract Problem, Pattern and PatternGuide all use: null means "still
    // exactly what was seeded", and the seeder is free to refresh it.
    editedAt: { type: Date, default: null, index: true },
    editedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

// The selection query: active lines for one surface. Everything else — the
// trigger predicate, the weighting, the pick — happens in memory over the
// couple of hundred rows this returns.
motivationSchema.index({ active: 1, surfaces: 1 });

export const Motivation = mongoose.model('Motivation', motivationSchema);
