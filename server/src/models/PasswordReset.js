import mongoose from 'mongoose';

/**
 * A one-time "set a new password" link, while it is still usable.
 *
 * The token itself is never stored. The email carries 32 random bytes; this row
 * carries their SHA-256. A database dump, a backup left in the wrong bucket or a
 * curious admin with a Mongo shell therefore cannot turn a row into a working
 * link — the same reason passwords are hashed, applied to the thing that can
 * *replace* a password. SHA-256 rather than bcrypt because the input is already
 * 256 bits of randomness: there is nothing to brute-force, so a slow hash would
 * only slow the lookup down.
 *
 * Its own collection rather than two fields on `User`, for the TTL index: an
 * expired link removes itself without a sweep job, and a `User` document cannot
 * be given an expiry.
 */
const passwordResetSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    /*
      Mongo deletes the row once this passes (`expireAfterSeconds: 0` below).
      The reaper runs about once a minute, so the service checks the time itself
      as well — a link must stop working at the minute it says, not whenever the
      background task gets round to it.
    */
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PasswordReset = mongoose.model('PasswordReset', passwordResetSchema);
