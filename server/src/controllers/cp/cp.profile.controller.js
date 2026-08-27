import mongoose from 'mongoose';
import { z } from 'zod';
import { CP_TIERS, cfRank, tierForRating } from '../../config/cpTiers.js';
import { CPProfile } from '../../models/CPProfile.js';
import { linkHandle, ratingHistory, syncSolved } from '../../services/cp/sync.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const oid = (id) => new mongoose.Types.ObjectId(id);

/**
 * The Codeforces identity behind the ladder.
 *
 * Everything here is scoped to `req.userId`, so there is no shape of these
 * requests that reads somebody else's profile — which matters more than usual
 * because a handle is a real-world identity and the sync endpoint spends an
 * upstream request.
 */

/**
 * The profile plus what the tier rail needs to draw itself.
 *
 * `tier` and `rank` are derived here rather than on the client for the reason
 * the revision ladder's `nextGapDays` is: the thresholds live in
 * config/cpTiers.js, and a client that reimplemented them would eventually
 * disagree with the server about which tier somebody is in.
 */
const decorate = (profile) => {
  if (!profile) return null;
  const rating = Number.isFinite(profile.rating) ? profile.rating : null;
  return {
    handle: profile.handle,
    verifiedAt: profile.verifiedAt,
    rating,
    maxRating: profile.maxRating,
    rank: profile.rank,
    maxRank: profile.maxRank,
    titlePhoto: profile.titlePhoto,
    contribution: profile.contribution,
    lastSyncAt: profile.lastSyncAt,
    lastSyncError: profile.lastSyncError,
    syncedSolveCount: profile.syncedSolveCount,
    platformSolveCount: profile.platformSolveCount,
    // Null for an unrated account, which is an ordinary state — a brand-new
    // handle has no rating and the rail renders the first rung for it.
    tier: rating === null ? null : tierForRating(rating)?.slug || null,
    cfRank: rating === null ? null : cfRank(rating),
  };
};

/** GET /api/cp/profile — null for an account that has never linked a handle. */
export const getProfile = asyncHandler(async (req, res) => {
  const profile = await CPProfile.findOne({ user: oid(req.userId) }).lean();
  res.json({ profile: decorate(profile), tiers: CP_TIERS });
});

export const handleSchema = z.object({
  /*
    Empty string clears the link. A separate DELETE would be tidier REST and
    would mean the client needed two calls for what is one control — a text
    field you can empty and save.
  */
  handle: z.string().trim().max(24),
});

/** PUT /api/cp/profile/handle — link, re-link, or clear. Verified upstream. */
export const setHandle = asyncHandler(async (req, res) => {
  const profile = await linkHandle(req.userId, req.body.handle);
  res.json({ profile: decorate(profile) });
});

/**
 * POST /api/cp/profile/sync — pull accepted submissions onto the ladder.
 *
 * Answers with what actually changed rather than just `ok`, because the numbers
 * are the point: "1,240 solved on Codeforces, 312 of them on this ladder, 47
 * newly marked" is the sentence someone wants after pressing the button, and it
 * is also how they can tell a sync that did nothing from one that failed.
 */
export const sync = asyncHandler(async (req, res) => {
  const result = await syncSolved(req.userId);
  res.json({
    profile: decorate(result.profile),
    solvedOnPlatform: result.solvedOnPlatform,
    onLadder: result.onLadder,
    changed: result.changed,
  });
});

/**
 * GET /api/cp/profile/rating-history — the curve for the profile card.
 *
 * Empty for an unrated account, which is what Codeforces itself reports for
 * someone who has never entered a rated contest. An empty array is the answer,
 * not an error.
 */
export const getRatingHistory = asyncHandler(async (req, res) => {
  const profile = await CPProfile.findOne({ user: oid(req.userId) }).select('handle').lean();
  if (!profile?.handle) return res.json({ history: [] });
  res.json({ history: await ratingHistory(profile.handle) });
});
