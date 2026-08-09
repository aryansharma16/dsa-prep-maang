import { User, publicUser } from '../models/User.js';
import { assertEmailNotReserved } from '../services/admin.guards.js';
import { destroyAsset, folderFor, uploadBuffer } from '../services/media.service.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export { selfUpdateSchema } from '../config/profileFields.js';

/**
 * The signed-in user editing their own details.
 *
 * Separate from the admin route on purpose: this one can only ever touch the
 * caller's own document, so it needs no target guard and no capability. The
 * reserved-address check still runs — otherwise anyone could rename themselves
 * onto SUPER_ADMIN_EMAIL and be promoted at their next sign-in.
 */
export const updateMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) throw ApiError.unauthorized('Account no longer exists', 'NO_USER');

  const { name, email, profile, prefs } = req.body;
  if (email) assertEmailNotReserved(email, user);

  if (name !== undefined) user.name = name;
  if (email !== undefined) user.email = email;
  if (profile) user.profile = { ...user.profile?.toObject?.(), ...profile };
  // Merged, not replaced — the picker sends the whole block, but a future
  // caller changing only the theme should not blank out the accent.
  if (prefs) user.prefs = { ...user.prefs?.toObject?.(), ...prefs };

  await user.save();
  res.json({ user: publicUser(user) });
});

/**
 * Square, face-aware, and capped at 512px.
 *
 * Applied once at upload time rather than on delivery: an avatar is only ever
 * shown as a small square, so there is no reason to keep the 4000px original a
 * phone camera produces — cropping on the way in means the stored bytes are the
 * bytes served. 512 covers a 72px display at 3x and still costs a few tens of
 * kilobytes as a q_auto WebP.
 *
 * `gravity: 'face'` falls back to a centre crop when no face is found, so a
 * cartoon or a logo is not rejected or mangled.
 */
const AVATAR_TRANSFORM = [
  { width: 512, height: 512, crop: 'fill', gravity: 'face' },
  { fetch_format: 'auto', quality: 'auto' },
];

export const uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No image was uploaded', 'NO_FILE');

  const user = await User.findById(req.userId);
  if (!user) throw ApiError.unauthorized('Account no longer exists', 'NO_USER');

  const previous = user.avatar?.publicId;

  /*
    A stable public_id per user rather than a random one. It keeps the folder
    readable, and it means an interrupted request can never leave two live
    avatars for the same account — the second upload overwrites the first
    instead of orphaning it.
  */
  const asset = await uploadBuffer(req.file.buffer, {
    folder: folderFor('avatars'),
    publicId: String(user._id),
    transformation: AVATAR_TRANSFORM,
    tags: ['avatar'],
  });

  user.avatar = asset;
  await user.save();

  // Only if the id actually changed — with a stable public_id it usually has
  // not, and deleting it here would remove the image just uploaded.
  if (previous && previous !== asset.publicId) await destroyAsset(previous);

  res.json({ user: publicUser(user) });
});

export const removeAvatar = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) throw ApiError.unauthorized('Account no longer exists', 'NO_USER');

  const publicId = user.avatar?.publicId;
  if (!publicId) {
    // Already gone. Saying so with a 200 keeps a double-click from surfacing an
    // error for a state the caller wanted anyway.
    res.json({ user: publicUser(user) });
    return;
  }

  user.avatar = undefined;
  await user.save();
  await destroyAsset(publicId);

  res.json({ user: publicUser(user) });
});
