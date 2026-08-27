import mongoose from 'mongoose';
import { guideBlockSchema } from './schemas/guideBlock.js';

/**
 * Long-form reference for one pattern — the "why" the roadmap itself does not
 * carry. One document per pattern slug.
 *
 * Deliberately its own collection rather than a field on Pattern: `listPatterns`
 * reads the whole collection with no projection and the roadmap aggregation
 * $lookups whole pattern documents, so a guide field would ship every guide on
 * every sidebar load.
 *
 * The block vocabulary lives in schemas/guideBlock.js, shared with
 * `CPPatternGuide` — see that file for why the collections are separate and the
 * vocabulary is not.
 */

const patternGuideSchema = new mongoose.Schema(
  {
    patternSlug: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    summary: { type: String, default: '' },
    blocks: { type: [guideBlockSchema], default: [] },

    /**
     * Stamped by the admin panel when a human edits a guide. Its presence is
     * what stops the seeder from overwriting that work — see scripts/seed/guides.js.
     * Null means "still exactly what was seeded", and the seeder is free to
     * refresh it.
     */
    editedAt: { type: Date, default: null },
    seededAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const PatternGuide = mongoose.model('PatternGuide', patternGuideSchema);
