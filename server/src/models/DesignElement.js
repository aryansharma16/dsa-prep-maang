import mongoose from 'mongoose';
import { ELEMENT_TYPES } from '../config/design.js';

/**
 * One thing on a board — a shape, a connector, a pen stroke, a table.
 *
 * A document per element, not an array on the board. An array would put a
 * board-sized ceiling of 16MB on every board and turn each drag into a rewrite
 * of the whole document; per-element documents make a change exactly as big as
 * what changed, which is what autosave, delta sync and — later — two people
 * editing the same board all need.
 *
 * `eid` is minted by the client, so a shape exists (and can be connected to,
 * undone, redone) before the server has heard of it. Unique per board.
 *
 * `data` is a flat object of the element's own fields — geometry and style
 * alike — validated per type in validation/designElements.js. It is written
 * only with `$set` from lean objects, never through `doc.save()`: Mixed fields
 * need `markModified` to be saved at all, and schema minimisation would quietly
 * strip an empty `{}` the client meant to store.
 *
 * Deletion is a tombstone (`deletedAt`) kept for a fortnight, because "what
 * changed since rev N" has to be able to say "this was removed". A tombstone is
 * revived in place by a `put`, which is how redo of a delete works.
 */
const designElementSchema = new mongoose.Schema(
  {
    board: { type: mongoose.Schema.Types.ObjectId, ref: 'DesignBoard', required: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'DesignProject', required: true },
    eid: { type: String, required: true, match: /^[A-Za-z0-9_-]{6,40}$/ },
    type: { type: String, enum: ELEMENT_TYPES, required: true },
    /** The frame or group this sits in, by eid. Not enforced to exist — a dangling parent renders at the root. */
    parent: { type: String, default: null },
    /** Fractional key among siblings under the same parent; ties broken by eid. */
    z: { type: String, required: true, maxlength: 64 },
    data: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    bytes: { type: Number, default: 0 },
    /** The board rev of the batch that last wrote this. */
    rev: { type: Number, required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, minimize: false },
);

designElementSchema.index({ board: 1, eid: 1 }, { unique: true });
// Loading a board: every live element.
designElementSchema.index({ board: 1, deletedAt: 1 });
// Delta sync: everything written after a rev, tombstones included.
designElementSchema.index({ board: 1, rev: 1 });
// Purging a project, and future project-wide reads.
designElementSchema.index({ project: 1 });

/** An element on the wire. The same shape the client sends in a `put`, plus its rev. */
export const publicElement = (el) => ({
  eid: el.eid,
  type: el.type,
  parent: el.parent ?? null,
  z: el.z,
  data: el.data || {},
  rev: el.rev,
});

/** A change as delta sync reports it: the element, or a note that it is gone. */
export const publicChange = (el) =>
  el.deletedAt ? { eid: el.eid, rev: el.rev, deleted: true } : publicElement(el);

export const DesignElement = mongoose.model('DesignElement', designElementSchema);
