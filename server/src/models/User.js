import mongoose from 'mongoose';
import { DEFAULT_ROLE, ROLES, capsFor } from '../config/roles.js';

/**
 * A file living in Cloudinary, as this app records it.
 *
 * `publicId` is the load-bearing field — it is the handle for deleting the
 * asset or deriving another size of it later. `url` is a convenience so the
 * client can render without the server building a URL on every response.
 *
 * No `_id`: it is one embedded value, not a collection.
 */
export const assetSchema = new mongoose.Schema(
  {
    publicId: { type: String, required: true },
    url: { type: String, required: true },
    format: String,
    bytes: Number,
    width: Number,
    height: Number,
    version: Number,
    uploadedAt: Date,
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    /**
     * `select: false` so it is never loaded unless a query asks for it by name.
     *
     * The `toJSON` transform below strips it, but a `.lean()` query skips that
     * transform entirely and hands back a plain object — and the admin user
     * list is exactly the kind of endpoint that wants `.lean()`. This makes the
     * leak impossible by construction rather than by remembering. Exactly one
     * caller needs it: `loginUser`, via `.select('+passwordHash')`.
     */
    passwordHash: { type: String, required: true, select: false },
    name: { type: String, required: true, trim: true },
    // Absent until one is uploaded — the client falls back to initials, so
    // there is nothing sensible to default this to.
    avatar: { type: assetSchema, default: undefined },

    /**
     * What this account is allowed to do. See config/roles.js.
     *
     * `super_admin` is never written by the API — it is reconciled from
     * SUPER_ADMIN_EMAIL on boot and at login, so the role lives in config
     * rather than in a row anything can update.
     */
    role: { type: String, enum: ROLES, default: DEFAULT_ROLE, index: true },

    /**
     * Bumped to invalidate every token already issued to this account.
     *
     * Tokens carry the version they were minted at; the refresh endpoint
     * compares the two and refuses a stale one. That is what makes "sign out
     * everywhere" and an admin password reset actually reach other devices,
     * without adding a database read to requireAuth on every request.
     */
    tokenVersion: { type: Number, default: 0 },

    // Optional, all of it. The user fills this in about themselves; a super
    // admin can correct it. Nothing here is required to use the app.
    profile: {
      bio: { type: String, default: '', maxlength: 1200 },
      location: { type: String, default: '', maxlength: 80 },
      college: { type: String, default: '', maxlength: 120 },
      gradYear: { type: Number, default: null },
      github: { type: String, default: '', maxlength: 120 },
      linkedin: { type: String, default: '', maxlength: 200 },
      leetcode: { type: String, default: '', maxlength: 60 },
      website: { type: String, default: '', maxlength: 200 },
      targetRole: { type: String, default: '', maxlength: 80 },
      targetCompanies: { type: [String], default: [] },
    },
  },
  { timestamps: true },
);

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    delete ret.tokenVersion;
    delete ret.__v;
    return ret;
  },
});

/**
 * The projection every user read should go through.
 *
 * The transform above only runs when a document is serialised — a `.lean()`
 * query returns a plain object and skips it entirely, which would put
 * `passwordHash` straight into an API response. The admin user list is exactly
 * the kind of endpoint that wants `.lean()`, so this exists to make the safe
 * thing the easy thing: select these fields and the hash cannot come along.
 */
export const USER_PUBLIC_FIELDS =
  'email name avatar role profile createdAt updatedAt';

/**
 * The signed-in user as the client receives it.
 *
 * `caps` is derived from the role so the UI can hide controls it cannot use
 * without keeping a second copy of the permission matrix in JSX. It is a
 * rendering convenience, never a security boundary — every admin route checks
 * for itself.
 *
 * Every endpoint that answers with the current user must go through this. The
 * client's `applyUser` replaces its whole copy, so one endpoint returning a
 * bare user would silently strip `caps` and make the admin nav disappear until
 * the next reload.
 */
export const publicUser = (user) => ({ ...user.toJSON(), caps: capsFor(user.role) });

export const User = mongoose.model('User', userSchema);
