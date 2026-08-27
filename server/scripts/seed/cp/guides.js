/**
 * Seeds the long-form CP pattern guides into MongoDB.
 *
 * Optional and independent of the problem seed, exactly like its roadmap twin:
 * guides are prose, they do not depend on the curation pass, and rewriting one
 * should not mean re-running a Codeforces fetch.
 *
 *   npm run seed:cp:guides
 *   npm run seed:cp:guides -- --force
 *
 * Only the core patterns have a guide. The rest ship with the structured
 * `brief` on the pattern document and can be promoted later without a schema
 * change — so a pattern with no guide is an ordinary state here, reported at the
 * end rather than warned about per row.
 */
import { connectDb, disconnectDb } from '../../../src/config/db.js';
import { CPPatternGuide } from '../../../src/models/CPPatternGuide.js';
import { cpGuideDocs } from './guides/index.js';
import { CP_PATTERN_SLUGS } from './patterns.js';

const force = process.argv.includes('--force');

async function main() {
  // A guide whose slug is not a real pattern is unreachable from the UI — catch
  // the typo here rather than wondering why the reader never opens.
  const orphans = cpGuideDocs.filter((g) => !CP_PATTERN_SLUGS.includes(g.patternSlug));
  if (orphans.length) {
    console.error(
      `[seed:cp:guides] guides for unknown patterns: ${orphans.map((g) => g.patternSlug).join(', ')}`,
    );
    process.exit(1);
  }

  const duplicates = cpGuideDocs
    .map((g) => g.patternSlug)
    .filter((slug, i, all) => all.indexOf(slug) !== i);
  if (duplicates.length) {
    console.error(`[seed:cp:guides] two guides claim the same pattern: ${duplicates.join(', ')}`);
    process.exit(1);
  }

  await connectDb();
  if (force) console.warn('[seed:cp:guides] --force: hand-edited guides will be overwritten\n');

  let written = 0;
  let skipped = 0;

  for (const doc of cpGuideDocs) {
    const existing = await CPPatternGuide.findOne({ patternSlug: doc.patternSlug })
      .select('editedAt')
      .lean();

    if (existing?.editedAt && !force) {
      skipped += 1;
      console.warn(
        `  --   ${doc.patternSlug.padEnd(24)} edited ${existing.editedAt.toISOString().slice(0, 10)}, skipped`,
      );
      continue;
    }

    await CPPatternGuide.findOneAndUpdate(
      { patternSlug: doc.patternSlug },
      {
        $set: {
          title: doc.title,
          summary: doc.summary,
          blocks: doc.blocks,
          seededAt: new Date(),
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
    const langs = new Set(doc.blocks.flatMap((b) => (b.variants || []).map((v) => v.lang)));
    console.log(
      `  ok   ${doc.patternSlug.padEnd(24)} ${String(doc.blocks.length).padStart(3)} blocks ` +
        `${String(words).padStart(5)} words  [${[...langs].sort().join(', ') || 'prose only'}]`,
    );
  }

  /*
    Java *and* C++ on every guide that has code at all.

    C++ is what competitive programming is written in; Java is what a large
    share of the people arriving from the interview curriculum already know, and
    handing them a template in a language they cannot read yet is how a learning
    path loses someone at the first segment tree. A guide that quietly shipped
    one variant would look complete in the reader's tab and be missing half its
    audience, so it fails the seed instead.
  */
  const oneLanguage = cpGuideDocs.filter((doc) => {
    const codeBlocks = doc.blocks.filter((b) => b.type === 'code');
    if (!codeBlocks.length) return false;
    const langs = new Set(codeBlocks.flatMap((b) => b.variants.map((v) => v.lang)));
    return !(langs.has('java') && langs.has('cpp'));
  });
  if (oneLanguage.length) {
    console.error(
      `\n[seed:cp:guides] !! missing a Java or C++ variant: ${oneLanguage.map((g) => g.patternSlug).join(', ')}`,
    );
    process.exitCode = 1;
  }

  console.log(
    `\n[seed:cp:guides] ${written} written, ${skipped} skipped, ` +
      `${cpGuideDocs.length}/${CP_PATTERN_SLUGS.length} patterns have a full guide` +
      ` (the rest carry the structured brief on the pattern)`,
  );

  await disconnectDb();
}

main().catch(async (err) => {
  console.error('[seed:cp:guides] failed:', err.message);
  await disconnectDb().catch(() => {});
  process.exit(1);
});
