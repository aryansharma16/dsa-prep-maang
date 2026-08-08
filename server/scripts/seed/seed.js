/**
 * Upserts patterns + curated problems into MongoDB. Idempotent — re-running
 * refreshes metadata without touching your progress rows.
 *
 *   npm run seed:db
 */
import fs from 'node:fs';
import mongoose from 'mongoose';
import { connectDb, disconnectDb } from '../../src/config/db.js';
import { Pattern } from '../../src/models/Pattern.js';
import { Problem } from '../../src/models/Problem.js';
import { Progress } from '../../src/models/Progress.js';
import { patternDocs } from './patterns.js';
import { CURATED_PATH } from './sources.js';

async function main() {
  if (!fs.existsSync(CURATED_PATH)) {
    console.error(`[seed:db] ${CURATED_PATH} not found. Run: npm run seed:curate`);
    process.exit(1);
  }

  const problems = JSON.parse(fs.readFileSync(CURATED_PATH, 'utf8'));
  await connectDb();

  await Pattern.bulkWrite(
    patternDocs.map((doc) => ({
      updateOne: { filter: { slug: doc.slug }, update: { $set: doc }, upsert: true },
    })),
  );
  console.log(`[seed:db] patterns upserted: ${patternDocs.length}`);

  // $set only the seeded fields so a re-run never wipes a cached description.
  const result = await Problem.bulkWrite(
    problems.map((p) => ({
      updateOne: {
        filter: { slug: p.slug },
        update: { $set: { ...p, owner: null } },
        upsert: true,
      },
    })),
    { ordered: false },
  );

  console.log(
    `[seed:db] problems upserted: ${result.upsertedCount} new, ${result.modifiedCount} updated`,
  );

  // Drop seeded problems that are no longer in the curated list (retired picks,
  // or slugs that changed) so a re-seed can't leave orphans behind. Problems you
  // added yourself have an owner and are never touched.
  const keep = problems.map((p) => p.slug);
  const stale = await Problem.find({ owner: null, slug: { $nin: keep } }).select('_id slug');
  if (stale.length) {
    await Progress.deleteMany({ problem: { $in: stale.map((s) => s._id) } });
    await Problem.deleteMany({ _id: { $in: stale.map((s) => s._id) } });
    console.log(`[seed:db] pruned ${stale.length} stale problems`);
  }

  const total = await Problem.countDocuments();
  const seeded = await Problem.countDocuments({ owner: null });
  const custom = total - seeded;
  const patternCounts = await Problem.aggregate([
    { $match: { owner: null } },
    { $group: { _id: '$patternSlug', n: { $sum: 1 } } },
    { $lookup: { from: 'patterns', localField: '_id', foreignField: 'slug', as: 'p' } },
    { $addFields: { order: { $first: '$p.order' } } },
    { $sort: { order: 1 } },
  ]);

  console.log('\n  pattern            problems');
  for (const row of patternCounts) {
    console.log(`  ${String(row._id).padEnd(18)} ${String(row.n).padStart(5)}`);
  }
  console.log(`\n  seeded: ${seeded}   custom: ${custom}   total: ${total}`);

  await disconnectDb();
}

main().catch(async (err) => {
  console.error('[seed:db] failed:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
