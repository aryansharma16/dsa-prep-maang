import mongoose from 'mongoose';

/**
 * One account's Codeforces identity, and what the last sync learned from it.
 *
 * Its own collection rather than a block on `User`, for the reason
 * models/UserView.js gives at length: every request that resolves a session
 * serialises the whole user document, and a block that only the Pro Coder page
 * reads would ride along on all of them to be thrown away by everything else.
 * Here it is read by the page that wants it, once.
 *
 * Rows exist only for accounts that have actually linked a handle, so this
 * collection stays the size of the people using the feature rather than the size
 * of the user table.
 *
 * Everything below `handle` is a *cache* of what Codeforces said, not a fact
 * this app owns. It is refreshed on sync and is allowed to be stale; nothing is
 * gated on it, and the page renders a linked handle with no rating perfectly
 * well — which is what a brand-new account genuinely looks like.
 */
const cpProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },

    /**
     * The handle, exactly as Codeforces spells it.
     *
     * Stored as the API returns it rather than as it was typed, because CF
     * handles are case-insensitive to look up and case-*sensitive* to display,
     * and showing someone `TOURIST` when they are `tourist` reads as a bug. The
     * verify step at save time is what makes the canonical spelling available.
     */
    handle: { type: String, default: '', trim: true, maxlength: 60 },

    /** Confirmed to exist via `user.info` at save time. Null on a cleared handle. */
    verifiedAt: { type: Date, default: null },

    rating: { type: Number, default: null },
    maxRating: { type: Number, default: null },
    rank: { type: String, default: '' },
    maxRank: { type: String, default: '' },
    titlePhoto: { type: String, default: '' },
    /** CF's own contribution score. Cosmetic, but it is on every CF profile. */
    contribution: { type: Number, default: 0 },

    lastSyncAt: { type: Date, default: null },
    /**
     * Why the last sync failed, if it did.
     *
     * Kept rather than thrown away because the failure outlives the request that
     * hit it: someone syncs, closes the tab, comes back tomorrow and wants to
     * know why their ladder is empty. "Codeforces was unreachable at 14:02" is
     * an answer; a silently absent result is not.
     */
    lastSyncError: { type: String, default: '' },
    /** Accepted submissions matched to problems on the ladder, at last sync. */
    syncedSolveCount: { type: Number, default: 0 },
    /** Accepted submissions seen in total, matched or not. Context for the number above. */
    platformSolveCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const CPProfile = mongoose.model('CPProfile', cpProfileSchema);
