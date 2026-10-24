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
     * The second level of the tree, in display order. Problems point at these
     * by `slug` (Problem.subPattern). Seeded from scripts/seed/subpatterns.js;
     * not edited from the admin panel, so the seeder always refreshes it.
     */
    subPatterns: {
      type: [new mongoose.Schema({ slug: String, name: String }, { _id: false })],
      default: [],
    },

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
