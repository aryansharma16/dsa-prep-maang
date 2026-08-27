import mongoose from 'mongoose';
import { guideBlockSchema } from './schemas/guideBlock.js';

/**
 * Long-form reference for one CP pattern.
 *
 * The same shape as `PatternGuide` and a separate collection, for the reason the
 * models themselves are separate: a roadmap guide teaches you to recognise a
 * pattern in an interview question, and a CP guide teaches you to implement one
 * correctly under time pressure. Different prose, different code, different
 * reader — and the two seeders write them independently, so one collection would
 * mean each seeder needing a filter it would be a bug to forget.
 *
 * Only the core patterns carry a document here. The other ~36 ship with the
 * structured `brief` on `CPPattern` and can be promoted to a full guide later
 * without a schema change — which is why the ladder treats a missing guide as an
 * ordinary state rather than a gap to apologise for.
 *
 * Code blocks carry Java and C++ variants. Both, rather than C++ alone: C++ is
 * what competitive programming is written in, and Java is what a large share of
 * the people arriving from an interview-prep curriculum already know. Handing
 * them a template in a language they cannot read yet is how a learning path
 * loses someone at the first segment tree.
 */
const cpPatternGuideSchema = new mongoose.Schema(
  {
    patternSlug: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    summary: { type: String, default: '' },
    blocks: { type: [guideBlockSchema], default: [] },

    /** Same contract as PatternGuide.editedAt — the seeder leaves edits alone. */
    editedAt: { type: Date, default: null },
    seededAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const CPPatternGuide = mongoose.model('CPPatternGuide', cpPatternGuideSchema);
