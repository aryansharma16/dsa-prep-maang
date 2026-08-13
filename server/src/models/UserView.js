import mongoose from 'mongoose';
import { VIEW_SCOPES } from '../config/viewScopes.js';

/**
 * How one account has a screen set up — today, which filters it left on.
 *
 * A collection rather than a block on the user document, for the reason
 * `passwordHash` is `select: false`: the shape should make the cheap thing the
 * default. Every request that resolves a session serialises the whole user, and
 * a filter bag that grows one key per module would ride along on all of them to
 * be thrown away by everything except the one page that asked. Here it is read
 * by the page that needs it, once.
 *
 * `filters` is Mixed and deliberately opaque. The server bounds it — see
 * config/viewScopes.js — and never reads inside it: what `topics` means is the
 * client's business, and the same endpoint serves a module this file has never
 * heard of. It is always written whole, so Mixed's usual trap (mutating a
 * subpath without `markModified`) has nowhere to bite.
 *
 * One row per account per scope, and rows only exist for accounts that actually
 * saved something — clearing every filter deletes the row rather than storing an
 * empty bag, so this collection stays the size of the people using it.
 */
const userViewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    /** Which screen. Enumerated so this cannot become a general-purpose store. */
    scope: { type: String, enum: VIEW_SCOPES, required: true },
    filters: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

// One saved view per user per scope — the upsert in the controller relies on it.
userViewSchema.index({ user: 1, scope: 1 }, { unique: true });

export const UserView = mongoose.model('UserView', userViewSchema);
