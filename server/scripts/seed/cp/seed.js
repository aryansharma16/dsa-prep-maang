/**
 * Upserts the CP patterns and the curated ladder into MongoDB. Idempotent —
 * re-running refreshes metadata without touching anybody's progress.
 *
 * The contract is the one scripts/seed/seed.js already established for the
 * roadmap, and it is deliberately identical: anything the admin panel has
 * touched carries `editedAt` and belongs to the human, not to the curation pass.
 * Two seeders behaving differently about that would be two sets of rules to
 * remember at the moment someone is trying to work out why their edit vanished.
 *
 *   npm run seed:cp:db
 *   npm run seed:cp:db -- --force     hand-edited content is overwritten
 */
import fs from 'node:fs';
import { connectDb, disconnectDb } from '../../../src/config/db.js';
import { CP_TIERS } from '../../../src/config/cpTiers.js';
import { CPPattern } from '../../../src/models/CPPattern.js';
import { CPProblem } from '../../../src/models/CPProblem.js';
import { CPProgress } from '../../../src/models/CPProgress.js';
import { cpPatternDocs } from './patterns.js';
import { CURATED_CP_PATH } from './sources.js';

async function main() {
  if (!fs.existsSync(CURATED_CP_PATH)) {
    console.error(`[seed:cp:db] ${CURATED_CP_PATH} not found. Run: npm run seed:cp:curate`);
    process.exit(1);
  }

  const force = process.argv.includes('--force');
  const problems = JSON.parse(fs.readFileSync(CURATED_CP_PATH, 'utf8'));
  await connectDb();

  if (force) console.warn('[seed:cp:db] --force: hand-edited content will be overwritten\n');

  /*
    Locked slugs are collected up front rather than expressed as a filter,
    because `updateOne` with `upsert: true` and a filter that matches nothing
    does not skip — it inserts. A second document with the same slug then dies
    on the unique index and the run fails halfway through. Same trap, same
    answer, as the roadmap seeder.
  */
  const lockedPatterns = new Set(
    force ? [] : (await CPPattern.find({ editedAt: { $ne: null } }).select('slug').lean()).map((p) => p.slug),
  );

  const freshPatterns = cpPatternDocs.filter((doc) => !lockedPatterns.has(doc.slug));
  if (freshPatterns.length) {
    await CPPattern.bulkWrite(
      freshPatterns.map((doc) => ({
        updateOne: {
          filter: { slug: doc.slug },
          update: { $set: { ...doc, ...(force ? { editedAt: null, editedBy: null } : {}) } },
          upsert: true,
        },
      })),
    );
  }
  console.log(
    `[seed:cp:db] patterns upserted: ${freshPatterns.length}` +
      (lockedPatterns.size ? `, ${lockedPatterns.size} hand-edited and skipped` : ''),
  );

  const lockedProblems = new Set(
    force
      ? []
      : (await CPProblem.find({ owner: null, editedAt: { $ne: null } }).select('slug').lean()).map(
          (p) => p.slug,
        ),
  );

  /*
    `owner: null` is part of the filter, not just the update.

    Without it this matches on slug alone, so the first time a curated problem
    is one a user had already added for themselves, the upsert reaches *their*
    row and publishes their private addition to every account on the
    deployment. The roadmap seeder carries this note for the same reason; the
    bug it prevents is identical and silent.
  */
  const incoming = problems.filter((p) => !lockedProblems.has(p.slug));
  const result = await CPProblem.bulkWrite(
    incoming.map((p) => ({
      updateOne: {
        filter: { slug: p.slug, owner: null },
        update: { $set: { ...p, owner: null, ...(force ? { editedAt: null, editedBy: null } : {}) } },
        upsert: true,
      },
    })),
    { ordered: false },
  );

  console.log(
    `[seed:cp:db] problems upserted: ${result.upsertedCount} new, ${result.modifiedCount} updated` +
      (lockedProblems.size ? `, ${lockedProblems.size} hand-edited and skipped` : ''),
  );

  /*
    Drop seeded problems no longer in the curated list, so a re-curation cannot
    leave orphans. Problems someone added themselves have an owner and are never
    touched; problems the admin panel created are shared but carry `editedAt`
    and are never pruned either — overwriting an edit loses text that also lives
    in git, while pruning loses other people's progress permanently.
  */
  const keep = problems.map((p) => p.slug);
  const stale = await CPProblem.find({ owner: null, editedAt: null, slug: { $nin: keep } }).select(
    '_id slug',
  );
  if (stale.length) {
    await CPProgress.deleteMany({ problem: { $in: stale.map((s) => s._id) } });
    await CPProblem.deleteMany({ _id: { $in: stale.map((s) => s._id) } });
    console.log(`[seed:cp:db] pruned ${stale.length} stale problems`);
  }

  await summarise();
  await disconnectDb();
}

async function summarise() {
  const total = await CPProblem.countDocuments();
  const seeded = await CPProblem.countDocuments({ owner: null });

  const byTier = await CPProblem.aggregate([
    { $match: { owner: null } },
    {
      $group: {
        _id: '$tier',
        n: { $sum: 1 },
        cf: { $sum: { $cond: [{ $eq: ['$platform', 'codeforces'] }, 1, 0] } },
        cc: { $sum: { $cond: [{ $eq: ['$platform', 'codechef'] }, 1, 0] } },
      },
    },
  ]);
  const tierCounts = new Map(byTier.map((t) => [t._id, t]));

  console.log(`\n[seed:cp:db] ${seeded} seeded problems (${total - seeded} user-added)\n`);
  for (const tier of CP_TIERS) {
    const row = tierCounts.get(tier.slug) || { n: 0, cf: 0, cc: 0 };
    console.log(
      `  ${String(tier.order)}. ${tier.label.padEnd(18)} ${String(row.n).padStart(4)}` +
        `  (cf ${String(row.cf).padStart(3)}, cc ${String(row.cc).padStart(3)})`,
    );
  }

  /*
    A problem filed under a pattern that does not exist is invisible: the ladder
    groups by pattern and renders the groups it can name, so the row is stored,
    counted in the total, and never drawn. Worth failing the seed over rather
    than discovering from a count that does not add up.
  */
  const patterns = new Set((await CPPattern.find().select('slug').lean()).map((p) => p.slug));
  const orphans = await CPProblem.distinct('patternSlug', {
    owner: null,
    patternSlug: { $nin: [...patterns] },
  });
  if (orphans.length) {
    console.error(`\n[seed:cp:db] !! problems reference unknown patterns: ${orphans.join(', ')}`);
    process.exitCode = 1;
  }

  console.log(`\n  ${patterns.size} patterns · next: npm run seed:cp:guides`);
}

main().catch(async (err) => {
  console.error('[seed:cp:db] failed:', err.message);
  await disconnectDb().catch(() => {});
  process.exit(1);
});
