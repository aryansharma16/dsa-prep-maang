import mongoose from 'mongoose';

import { connectDb, disconnectDb } from '../../src/config/db.js';
import { Progress } from '../../src/models/Progress.js';

/**
 * Gives every attempt written before this an `_id` and a `loggedAt`.
 *
 * Both are what the log's edit window needs to work at all. `_id` is the
 * address the edit and delete endpoints take — the sub-schema used to be
 * `{ _id: false }`, on the argument that an append-only array makes an index a
 * stable address, which stopped being true the moment a sitting could be
 * removed. `loggedAt` is what the half-hour window is measured from.
 *
 * Without it an attempt logged five minutes ago reads as **locked**, which is
 * true — nothing can address it — and looks like the clock is broken, because
 * the reason on screen is a deadline that has not passed.
 *
 * Run once, on every deployment that logged an attempt before this shipped.
 *
 * Safe to run twice: it only looks at rows still missing one of the two fields,
 * and only writes the ones that are missing. `loggedAt` is copied from `at`
 * rather than stamped with now — these were logged when they say they were, and
 * stamping now would hand every old attempt a fresh half-hour of editability.
 *
 *   npm run migrate:attempt-ids
 */

/** Rows holding an attempt missing either field. */
const NEEDS_WORK = {
  attempts: {
    $elemMatch: { $or: [{ _id: { $exists: false } }, { loggedAt: { $exists: false } }] },
  },
};

async function main() {
  await connectDb();

  const total = await Progress.countDocuments(NEEDS_WORK);
  if (!total) {
    console.log('[migrate] every attempt already has an id and a loggedAt');
    return;
  }
  console.log(`[migrate] ${total} progress rows to fix`);

  /*
    Read, stamp, write the whole array back — rather than a positional update
    per attempt. Mongo has no operator that mints an id per element, and the
    array is a handful of entries on a row that belongs to one person, so the
    cheap thing is also the simple one. `lean()` because a mongoose document
    would helpfully add the ids itself and hide what is actually being changed.
  */
  const cursor = Progress.find(NEEDS_WORK).select('attempts').lean().cursor();

  let rows = 0;
  let ids = 0;
  let stamps = 0;
  const writes = [];

  for await (const row of cursor) {
    const attempts = row.attempts.map((attempt) => {
      const patched = { ...attempt };
      if (!patched._id) {
        patched._id = new mongoose.Types.ObjectId();
        ids += 1;
      }
      if (!patched.loggedAt) {
        patched.loggedAt = patched.at;
        stamps += 1;
      }
      return patched;
    });

    writes.push({ updateOne: { filter: { _id: row._id }, update: { $set: { attempts } } } });
    rows += 1;

    if (writes.length === 500) {
      await Progress.bulkWrite(writes);
      writes.length = 0;
      console.log(`[migrate] ${rows} rows so far`);
    }
  }

  if (writes.length) await Progress.bulkWrite(writes);

  const left = await Progress.countDocuments(NEEDS_WORK);
  console.log(
    `[migrate] ${ids} ids and ${stamps} timestamps across ${rows} rows; ${left} rows left`,
  );
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
