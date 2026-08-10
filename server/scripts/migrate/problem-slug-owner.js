import mongoose from 'mongoose';

import { connectDb, disconnectDb } from '../../src/config/db.js';
import { Problem } from '../../src/models/Problem.js';

/**
 * Replaces the global unique index on `Problem.slug` with `{ slug, owner }`.
 *
 * Run once, on every deployment that existed before problems became unique per
 * owner. Mongoose creates the new index on boot by itself but never drops an
 * old one — so without this the original `slug_1` is still there, still unique,
 * and still refusing the second person who adds a given LeetCode problem. The
 * symptom is the bug looking unfixed after a deploy that fixed it.
 *
 * Safe to run twice: it checks what is actually on the collection each time and
 * does nothing it has already done.
 *
 *   npm run migrate:problem-slugs
 */

const OLD = 'slug_1';
const NEW = 'slug_1_owner_1';

async function main() {
  await connectDb();

  const collection = Problem.collection;
  const existing = await collection.indexes();
  const byName = new Map(existing.map((index) => [index.name, index]));

  /*
    New index first. Dropping the old one first would leave a window — however
    short — with no uniqueness on slug at all, and this runs against a live
    deployment.
  */
  if (byName.has(NEW)) {
    console.log(`[migrate] ${NEW} already exists`);
  } else {
    /*
      Duplicates cannot exist yet: the constraint being replaced is stricter
      than the one being created, so anything the old index allowed the new one
      allows too. Reported rather than assumed, because a failure here is worth
      reading in full.
    */
    await collection.createIndex({ slug: 1, owner: 1 }, { unique: true, name: NEW });
    console.log(`[migrate] created ${NEW}`);
  }

  if (byName.has(OLD)) {
    await collection.dropIndex(OLD);
    console.log(`[migrate] dropped ${OLD}`);
  } else {
    console.log(`[migrate] ${OLD} is already gone`);
  }

  const counts = await Problem.aggregate([
    { $group: { _id: { $cond: [{ $eq: ['$owner', null] }, 'seeded', 'user-added'] }, n: { $sum: 1 } } },
  ]);
  console.log('[migrate] problems:', Object.fromEntries(counts.map((c) => [c._id, c.n])));
}

main()
  .catch((error) => {
    console.error('[migrate] failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDb().catch(() => {});
    await mongoose.connection.close().catch(() => {});
  });
