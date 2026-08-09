import mongoose from 'mongoose';

const patternSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    // Position in the curriculum. Lower = learn first.
    order: { type: Number, required: true },
    blurb: { type: String, default: '' },
    keyTechniques: { type: [String], default: [] },

    /**
     * Same contract as Problem.editedAt and PatternGuide.editedAt: set by the
     * admin panel, and the seeder leaves an edited pattern alone. `seed:db`
     * `$set`s all four fields above on every run, so without this a hand-edited
     * name or blurb is silently reverted on the next seed.
     */
    editedAt: { type: Date, default: null },
    editedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

export const Pattern = mongoose.model('Pattern', patternSchema);
