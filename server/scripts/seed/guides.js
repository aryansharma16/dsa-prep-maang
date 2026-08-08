/**
 * Seeds the long-form pattern guides into MongoDB.
 *
 * Optional and independent of the problem seed — guides are prose, they do not
 * depend on the curation pass, and rewriting one should not mean re-running a
 * LeetCode fetch.
 *
 *   npm run seed:guides
 *   npm run seed:guides -- --force
 *
 * A guide the admin panel has edited (`editedAt` set) is skipped, so re-running
 * this can never destroy someone's work. Guides still untouched are refreshed
 * from the content files, which keeps this repo the source of truth right up
 * until a human takes one over. `--force` overrides that, and says so loudly.
 */
import { connectDb, disconnectDb } from '../../src/config/db.js';
import { PatternGuide } from '../../src/models/PatternGuide.js';
import { guideDocs } from './guides/index.js';
import { PATTERN_SLUGS } from './patterns.js';

const force = process.argv.includes('--force');

async function main() {
  // A guide whose slug is not a real pattern would never be reachable from the
  // UI — catch the typo here rather than wondering why the drawer is empty.
  const orphans = guideDocs.filter((g) => !PATTERN_SLUGS.includes(g.patternSlug));
  if (orphans.length) {
    console.error(
      `[seed:guides] guides for unknown patterns: ${orphans.map((g) => g.patternSlug).join(', ')}`,
    );
    process.exit(1);
  }

  await connectDb();

  if (force) console.warn('[seed:guides] --force: hand-edited guides will be overwritten\n');

  let written = 0;
  let skipped = 0;

  for (const doc of guideDocs) {
    const existing = await PatternGuide.findOne({ patternSlug: doc.patternSlug })
      .select('editedAt')
      .lean();

    if (existing?.editedAt && !force) {
      skipped += 1;
      console.warn(
        `  --   ${doc.patternSlug.padEnd(18)} edited ${existing.editedAt
          .toISOString()
          .slice(0, 10)}, skipped`,
      );
      continue;
    }

    await PatternGuide.findOneAndUpdate(
      { patternSlug: doc.patternSlug },
      {
        $set: {
          title: doc.title,
          summary: doc.summary,
          blocks: doc.blocks,
          seededAt: new Date(),
          // A forced re-seed hands the guide back to the content files.
          ...(force ? { editedAt: null } : {}),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    written += 1;
    const words = doc.blocks.reduce(
      (n, b) => n + `${b.text || ''} ${(b.items || []).join(' ')}`.split(/\s+/).filter(Boolean).length,
      0,
    );
    console.log(
      `  ok   ${doc.patternSlug.padEnd(18)} ${String(doc.blocks.length).padStart(3)} blocks ${String(
        words,
      ).padStart(5)} words`,
    );
  }

  const missing = PATTERN_SLUGS.filter(
    (slug) => !guideDocs.some((g) => g.patternSlug === slug),
  );

  console.log(
    `\n[seed:guides] ${written} written, ${skipped} skipped, ` +
      `${guideDocs.length}/${PATTERN_SLUGS.length} patterns covered`,
  );
  if (missing.length) console.warn(`[seed:guides] no guide yet for: ${missing.join(', ')}`);

  await disconnectDb();
}

main().catch(async (err) => {
  console.error('[seed:guides] failed:', err.message);
  await disconnectDb().catch(() => {});
  process.exit(1);
});
