import mongoose from 'mongoose';

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
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    // Absent until one is uploaded — the client falls back to initials, so
    // there is nothing sensible to default this to.
    avatar: { type: assetSchema, default: undefined },
  },
  { timestamps: true },
);

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  },
});

export const User = mongoose.model('User', userSchema);
