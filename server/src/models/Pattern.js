import mongoose from 'mongoose';

const patternSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    // Position in the curriculum. Lower = learn first.
    order: { type: Number, required: true },
    blurb: { type: String, default: '' },
    keyTechniques: { type: [String], default: [] },
  },
  { timestamps: true },
);

export const Pattern = mongoose.model('Pattern', patternSchema);
