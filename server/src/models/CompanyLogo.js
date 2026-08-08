import mongoose from 'mongoose';

/**
 * One cached company logo, bytes and all.
 *
 * The image lives in Mongo rather than on the API host's disk on purpose: the
 * box the server runs on is small and ephemeral, so anything written there is
 * both a disk-usage leak and lost on the next deploy. A logo is a few KB, which
 * is a rounding error next to the 16MB document ceiling, and it means a fresh
 * container serves logos immediately instead of re-crawling the internet.
 *
 * `data: null` with `failedAt` set is a remembered miss — no provider had a
 * logo for that name. Kept so a company nobody has a logo for is not re-fetched
 * on every page load.
 */
const companyLogoSchema = new mongoose.Schema(
  {
    // Derived from the company name: 'Goldman Sachs' -> 'goldman-sachs'
    slug: { type: String, required: true, unique: true, index: true },
    domain: { type: String, default: '' },

    data: { type: Buffer, default: null },
    contentType: { type: String, default: '' },
    bytes: { type: Number, default: 0 },

    // Which provider answered — useful when a logo comes back wrong.
    source: { type: String, default: '' },
    fetchedAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },
    attempts: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const CompanyLogo = mongoose.model('CompanyLogo', companyLogoSchema);
