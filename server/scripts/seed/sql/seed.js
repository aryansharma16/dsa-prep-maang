import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { connectDb, disconnectDb } from '../../../src/config/db.js';
import { SQL_CATEGORIES } from '../../../src/config/sqlCategories.js';
import { SqlProblem } from '../../../src/models/SqlProblem.js';
import { SqlProgress } from '../../../src/models/SqlProgress.js';

/**
 * Write the verified bank into MongoDB.
 *
 * The same contract as `scripts/seed/seed.js` and `scripts/seed/cp/seed.js`,
 * and the three-way rule is the part not to get creative with:
 *
 *   - **A row somebody added themselves is never touched.** It has an `owner`,
 *     and `owner: null` is part of every filter here.
 *   - **A row the admin panel has edited is never overwritten and never
 *     pruned.** It carries `editedAt`; the text also lives in git, and pruning
 *     it would lose other people's progress permanently.
 *   - **A seeded, unedited row** is overwritten, and deleted when it leaves the
 *     curated list — its progress rows going first.
 *
 *   npm run seed:sql:db
 *   npm run seed:sql:db -- --force     # overwrite admin edits too
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CURATED_PATH = path.join(HERE, '../../../data/sql/curated-sql.json');

async function main() {
  if (!fs.existsSync(CURATED_PATH)) {
    console.error('[seed:sql:db] no curated bank on disk. Run: npm run seed:sql:verify');
    process.exit(1);
  }

  const problems = JSON.parse(fs.readFileSync(CURATED_PATH, 'utf8'));
  const force = process.argv.includes('--force');

  await connectDb();

  /*
    ---------------------------------------------------------------------------
    Locked slugs are collected up front, and are deliberately not expressed as a
    filter.

    `updateOne` with `upsert: true` and a filter matching nothing does **not**
    skip — it inserts. So excluding edited rows by adding `editedAt: null` to
    the filter would create a *second* document with the same slug, which then
    dies on the unique index and takes the whole run down halfway through. The
    same note is on the CP seeder, and it is the kind of thing that is obvious
    once and never again.
    ---------------------------------------------------------------------------
  */
  const locked = new Set(
    force
      ? []
      : (await SqlProblem.find({ owner: null, editedAt: { $ne: null } }).select('slug').lean()).map(
          (p) => p.slug,
        ),
  );

  const incoming = problems.filter((p) => !locked.has(p.slug));

  const result = await SqlProblem.bulkWrite(
    incoming.map((p) => ({
      updateOne: {
        /*
          `owner: null` is in the FILTER, not only the update. Without it this
          matches on slug alone, so the first curated slug that collides with
          something a learner added privately would reach *their* row and
          publish their addition to every account on the deployment.
        */
        filter: { slug: p.slug, owner: null },
        update: {
          $set: { ...p, owner: null, ...(force ? { editedAt: null, editedBy: null } : {}) },
        },
        upsert: true,
      },
    })),
    { ordered: false },
  );

  console.log(
    `[seed:sql:db] ${result.upsertedCount} new, ${result.modifiedCount} updated` +
      (locked.size ? `, ${locked.size} left alone (edited in the panel)` : ''),
  );

  /*
    Prune what has left the curated list, so a re-verify cannot leave orphans.
    Progress rows go first: deleting the problem first would leave rows pointing
    at nothing, and the revision queue populates the problem they point at.
  */
  const keep = problems.map((p) => p.slug);
  const stale = await SqlProblem.find({
    owner: null,
    editedAt: null,
    slug: { $nin: keep },
  }).select('_id slug');

  if (stale.length) {
    await SqlProgress.deleteMany({ problem: { $in: stale.map((s) => s._id) } });
    await SqlProblem.deleteMany({ _id: { $in: stale.map((s) => s._id) } });
    console.log(`[seed:sql:db] pruned ${stale.length} retired problems`);
  }

  await summarise();
  await disconnectDb();
}

async function summarise() {
  const total = await SqlProblem.countDocuments({});
  const curated = await SqlProblem.countDocuments({ owner: null });

  const rows = await SqlProblem.aggregate([
    { $match: { owner: null } },
    {
      $group: {
        _id: { category: '$category', difficulty: '$difficulty' },
        n: { $sum: 1 },
      },
    },
  ]);

  const byCategory = new Map(SQL_CATEGORIES.map((c) => [c.slug, { Easy: 0, Medium: 0, Hard: 0 }]));
  for (const r of rows) {
    const bucket = byCategory.get(r._id.category);
    if (bucket) bucket[r._id.difficulty] = r.n;
  }

  console.log(`\n[seed:sql:db] ${curated} curated, ${total} total\n`);
  console.log(`  ${'category'.padEnd(22)} ${'easy'.padStart(5)} ${'med'.padStart(5)} ${'hard'.padStart(5)} ${'all'.padStart(5)}`);
  for (const category of SQL_CATEGORIES) {
    const b = byCategory.get(category.slug);
    const all = b.Easy + b.Medium + b.Hard;
    console.log(
      `  ${category.label.padEnd(22)} ${String(b.Easy).padStart(5)} ${String(b.Medium).padStart(5)} ${String(b.Hard).padStart(5)} ${String(all).padStart(5)}`,
    );
  }
  console.log('');

  /*
    A problem in a category the config does not know is stored, counted and
    never drawn — the rail is built from the config, so the row is invisible
    rather than misplaced. Worth failing the seed over, exactly as the CP
    seeder fails on a problem under an unknown pattern.
  */
  const known = SQL_CATEGORIES.map((c) => c.slug);
  const orphans = await SqlProblem.distinct('category', {
    owner: null,
    category: { $nin: known },
  });
  if (orphans.length) {
    console.error(`[seed:sql:db] !! problems in unknown categories: ${orphans.join(', ')}`);
    process.exitCode = 1;
  }
}

main().catch(async (error) => {
  console.error('[seed:sql:db] failed:', error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
