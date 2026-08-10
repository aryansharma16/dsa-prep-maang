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

  const force = process.argv.includes('--force');
  const problems = JSON.parse(fs.readFileSync(CURATED_PATH, 'utf8'));
  await connectDb();

  if (force) console.warn('[seed:db] --force: hand-edited content will be overwritten\n');

  /*
    Anything the admin panel has touched belongs to the human, not to the
    curation pass — the same contract seed:guides has always had for guides.
    The locked slugs are collected up front rather than expressed as a filter,
    because `updateOne` with `upsert: true` and a filter that matches nothing
    does not skip: it inserts. A second document with the same slug then dies
    on the unique index, and the run fails halfway through.
  */
  const editedPatterns = force
    ? []
    : await Pattern.find({ editedAt: { $ne: null } }).select('slug').lean();
  const lockedPatterns = new Set(editedPatterns.map((p) => p.slug));

  const freshPatterns = patternDocs.filter((doc) => !lockedPatterns.has(doc.slug));
  if (freshPatterns.length) {
    await Pattern.bulkWrite(
      freshPatterns.map((doc) => ({
        updateOne: {
          filter: { slug: doc.slug },
          // A forced re-seed hands the pattern back to the content files.
          update: { $set: { ...doc, ...(force ? { editedAt: null, editedBy: null } : {}) } },
          upsert: true,
        },
      })),
    );
  }
  console.log(
    `[seed:db] patterns upserted: ${freshPatterns.length}` +
      (lockedPatterns.size ? `, ${lockedPatterns.size} hand-edited and skipped` : ''),
  );

  const editedProblems = force
    ? []
    : await Problem.find({ owner: null, editedAt: { $ne: null } }).select('slug').lean();
  const lockedProblems = new Set(editedProblems.map((p) => p.slug));

  // $set only the seeded fields so a re-run never wipes a cached description.
  const incoming = problems.filter((p) => !lockedProblems.has(p.slug));
  /*
    `owner: null` is part of the filter, not just the update.

    Without it this matches on slug alone, so the first time a curated problem
    is one a user had already added for themselves, the upsert reaches *their*
    row and sets `owner: null` on it — quietly publishing one person's private
    addition to every account on the deployment. Since problems became unique
    per owner it would also be picking one of several rows arbitrarily.

    With it, the seeded copy is created alongside theirs and the two stay
    separate. Their duplicate is theirs to delete.
  */
  const result = await Problem.bulkWrite(
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
    `[seed:db] problems upserted: ${result.upsertedCount} new, ${result.modifiedCount} updated` +
      (lockedProblems.size ? `, ${lockedProblems.size} hand-edited and skipped` : ''),
  );

  // Drop seeded problems that are no longer in the curated list (retired picks,
  // or slugs that changed) so a re-seed can't leave orphans behind. Problems you
  // added yourself have an owner and are never touched.
  const keep = problems.map((p) => p.slug);
  const stale = await Problem.find({
    owner: null,
    /*
      Never pruned, --force or not. A problem the admin panel created is shared
      (owner: null) and is not in the curated list, so without this line the
      very next seed deletes it — and takes every user's progress on it with
      it. The asymmetry with the upsert above is deliberate: overwriting an
      edit loses text that also lives in git, while pruning loses other
      people's progress permanently.
    */
    editedAt: null,
    slug: { $nin: keep },
  }).select('_id slug');
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
