import mongoose from 'mongoose';
import { CPProblem } from '../../models/CPProblem.js';
import { CPProfile } from '../../models/CPProfile.js';
import { CPProgress } from '../../models/CPProgress.js';
import { ApiError } from '../../utils/ApiError.js';
import { fetchRatingHistory, fetchSubmissions, fetchUser } from './codeforces.service.js';

const oid = (id) => new mongoose.Types.ObjectId(String(id));

/**
 * Linking a Codeforces handle, and pulling what it knows.
 *
 * This is the feature that makes the ladder know where somebody actually is
 * rather than asking them to tell it. Two operations: verify a handle at the
 * moment it is saved, and sync accepted submissions onto the ladder.
 *
 * The whole design turns on one rule — **sync never downgrades**. It may mark a
 * problem solved; it may never un-mark one, clear a flag, drop a note or reset a
 * schedule. A person's own record of their work outranks anything an API says
 * about it, and a sync that could overwrite a note is a sync nobody should press
 * twice.
 */

/**
 * At most one sync per handle every ten minutes.
 *
 * `user.status` is the largest response Codeforces serves — a busy handle is
 * several megabytes — and the answer changes on the timescale of a contest, not
 * a page refresh. The limit protects the upstream more than it protects us,
 * which is why it is measured from the last *attempt* and lives on the profile
 * row rather than in a rate limiter: it has to survive a restart.
 */
export const SYNC_COOLDOWN_MS = 10 * 60 * 1000;

/**
 * Confirm the handle exists, and learn how Codeforces spells it.
 *
 * Done at save time rather than at sync time on purpose. A typo caught when you
 * press Save is a typo you fix; the same typo caught at the first sync is a
 * feature that silently did nothing for a week.
 */
export async function verifyHandle(handle) {
  const clean = String(handle || '').trim();
  if (!clean) throw ApiError.badRequest('Enter a Codeforces handle');
  if (!/^[A-Za-z0-9_.-]{1,24}$/.test(clean)) {
    throw ApiError.badRequest('That is not a valid Codeforces handle', 'BAD_HANDLE');
  }

  const user = await fetchUser(clean);
  if (!user) throw ApiError.notFound(`Codeforces has no user called ${clean}`, 'NO_HANDLE');

  return {
    // As Codeforces spells it, not as it was typed — handles are
    // case-insensitive to look up and case-sensitive to display.
    handle: user.handle,
    rating: user.rating ?? null,
    maxRating: user.maxRating ?? null,
    rank: user.rank || '',
    maxRank: user.maxRank || '',
    titlePhoto: user.titlePhoto || '',
    contribution: user.contribution || 0,
  };
}

/** Save (or clear) the handle for one account. */
export async function linkHandle(userId, handle) {
  if (!handle) {
    /*
      Clearing the handle empties the cached profile but leaves `CPProgress`
      alone — including the `solvedOnPlatform` marks a previous sync wrote.
      Those record something that happened, and unlinking an account is not a
      claim that it did not. Re-linking a different handle overwrites them on
      its own next sync.
    */
    const profile = await CPProfile.findOneAndUpdate(
      { user: oid(userId) },
      {
        $set: {
          handle: '',
          verifiedAt: null,
          rating: null,
          maxRating: null,
          rank: '',
          maxRank: '',
          titlePhoto: '',
          lastSyncError: '',
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    return profile;
  }

  const info = await verifyHandle(handle);
  return CPProfile.findOneAndUpdate(
    { user: oid(userId) },
    { $set: { ...info, verifiedAt: new Date(), lastSyncError: '' } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
}

/**
 * Pull accepted submissions and mark the ladder up.
 *
 * Three passes, in this order for a reason:
 *
 *  1. Refresh the cached profile from `user.info`. Cheap, and it is what the
 *     tier rail reads — so even a sync that matches nothing new leaves the
 *     header showing a current rating.
 *  2. Fetch every submission and reduce to the set of solved (contestId, index)
 *     pairs. Unpaginated: `from`/`count` exist, but walking them costs one
 *     queued request per page at 2.2s each, and the whole list is a single call
 *     Codeforces is happy to serve.
 *  3. Match against the ladder and bulk-write. The match is an indexed lookup
 *     per solved problem, which is why CPProblem carries a compound index on
 *     exactly that pair.
 */
export async function syncSolved(userId, { force = false } = {}) {
  const profile = await CPProfile.findOne({ user: oid(userId) });
  if (!profile?.handle) {
    throw ApiError.badRequest('Link a Codeforces handle first', 'NO_HANDLE');
  }

  const since = profile.lastSyncAt ? Date.now() - profile.lastSyncAt.getTime() : Infinity;
  if (!force && since < SYNC_COOLDOWN_MS) {
    const wait = Math.ceil((SYNC_COOLDOWN_MS - since) / 60000);
    const error = ApiError.tooManyRequests(
      `Already synced recently — try again in ${wait} minute${wait === 1 ? '' : 's'}`,
      'SYNC_COOLDOWN',
    );
    error.meta = { retryAt: new Date(profile.lastSyncAt.getTime() + SYNC_COOLDOWN_MS) };
    throw error;
  }

  // Stamp the attempt before doing the work, so a failure still starts the
  // cooldown — otherwise a handle whose sync always fails can be retried in a
  // loop, at Codeforces' expense.
  profile.lastSyncAt = new Date();
  await profile.save();

  try {
    const info = await fetchUser(profile.handle);
    if (info) {
      profile.rating = info.rating ?? null;
      profile.maxRating = info.maxRating ?? null;
      profile.rank = info.rank || '';
      profile.maxRank = info.maxRank || '';
      profile.titlePhoto = info.titlePhoto || '';
      profile.contribution = info.contribution || 0;
    }

    const submissions = await fetchSubmissions(profile.handle);

    /*
      Earliest accepted submission per problem, not the most recent.

      `user.status` is newest-first, so walking it and keeping the *last* AC seen
      for each problem yields the first time it was solved — which is the honest
      answer to "when did you learn this", and is stable across re-syncs in a way
      that "most recent AC" is not.
    */
    const solved = new Map();
    for (const s of submissions) {
      if (s.verdict !== 'OK') continue;
      const contestId = s.problem?.contestId ?? s.contestId;
      const index = s.problem?.index;
      if (!contestId || !index) continue;
      solved.set(`${contestId}:${index}`, {
        contestId,
        index,
        at: new Date(s.creationTimeSeconds * 1000),
        id: s.id,
      });
    }

    const onLadder = await CPProblem.find({
      platform: 'codeforces',
      $or: [{ owner: null }, { owner: oid(userId) }],
      'codeforces.contestId': { $in: [...new Set([...solved.values()].map((s) => s.contestId))] },
    })
      .select('_id codeforces.contestId codeforces.index')
      .lean();

    const writes = [];
    for (const problem of onLadder) {
      const hit = solved.get(`${problem.codeforces.contestId}:${problem.codeforces.index}`);
      if (!hit) continue;

      writes.push({
        updateOne: {
          filter: { user: oid(userId), problem: problem._id },
          /*
            `$set` for the platform facts, `$setOnInsert` for everything a person
            owns. On a row that already exists this touches only the three
            platform fields — a note, a flag, a confidence and an attempt log
            written by hand all survive untouched, which is the rule this whole
            service is built around.
          */
          update: {
            $set: {
              solvedOnPlatform: true,
              platformSolvedAt: hit.at,
              platformSubmissionId: hit.id,
            },
            $setOnInsert: {
              user: oid(userId),
              problem: problem._id,
              /*
                Only a row that did not exist is marked solved. A row already
                sitting at `todo` because somebody deliberately reset it stays
                there — `solvedOnPlatform` records the AC either way, and the
                ladder draws that difference rather than hiding it.
              */
              status: 'solved',
              solvedAt: hit.at,
              reviewStage: 1,
            },
          },
          upsert: true,
        },
      });
    }

    let matched = 0;
    if (writes.length) {
      const result = await CPProgress.bulkWrite(writes, { ordered: false });
      matched = result.upsertedCount + result.modifiedCount;
    }

    profile.syncedSolveCount = writes.length;
    profile.platformSolveCount = solved.size;
    profile.lastSyncError = '';
    await profile.save();

    return {
      profile,
      solvedOnPlatform: solved.size,
      onLadder: writes.length,
      changed: matched,
    };
  } catch (error) {
    // Kept rather than thrown away: the failure outlives the request that hit
    // it, and "Codeforces was unreachable" is an answer the page can show
    // tomorrow. See the note on the model.
    profile.lastSyncError = error.message?.slice(0, 300) || 'Sync failed';
    await profile.save().catch(() => {});
    throw error;
  }
}

/**
 * The rating curve, for the profile card.
 *
 * Not cached on the profile row. It is a list that grows by one entry every few
 * weeks, it is only ever looked at on one card, and storing it would mean
 * deciding when it goes stale — a question with no good answer for data that is
 * cheap to re-fetch and harmless to be a contest behind on.
 */
export async function ratingHistory(handle) {
  const rows = await fetchRatingHistory(handle);
  return rows.map((r) => ({
    at: new Date(r.ratingUpdateTimeSeconds * 1000),
    contestId: r.contestId,
    contestName: r.contestName,
    rank: r.rank,
    oldRating: r.oldRating,
    newRating: r.newRating,
  }));
}
