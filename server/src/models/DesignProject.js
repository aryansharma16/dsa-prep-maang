import mongoose from 'mongoose';
import { HUES } from '../config/hues.js';

/**
 * A system being designed — "WhatsApp", "URL shortener" — and the root of
 * everything the design module stores.
 *
 * Ownership lives here as a plain `owner` field and not as a membership row, on
 * purpose for v1. Every access check already goes through one helper
 * (services/design/access.service.js) that turns this field into the role
 * `owner`; sharing, when it comes, adds a `DesignMember` collection that the
 * same helper also reads. So sharing is data added, not documents rewritten — and
 * until then a project costs one write to create instead of two that would need
 * a transaction to agree.
 *
 * Per-viewer state (the last board opened, the camera) is deliberately absent.
 * It is different for every person looking at a shared project, so on the
 * project document it would be the first thing two collaborators fight over. In
 * v1 it lives in the browser.
 */
const designProjectSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 120 },
    description: { type: String, default: '', maxlength: 1000 },
    icon: { type: String, default: '', maxlength: 16 },
    hue: { type: String, enum: HUES, default: 'violet' },

    /**
     * Bumped by every structural change to the tree, inside the same transaction.
     *
     * Two tabs moving folders at once both write this document, so one of them
     * aborts and retries — and on the retry it sees the other's move and can
     * refuse a cycle that neither move would have made alone. Without a shared
     * document to collide on, both would pass their check and commit.
     */
    treeRev: { type: Number, default: 0 },

    /** When anything in the project last changed. Throttled to a minute; drives "recent" ordering. */
    touchedAt: { type: Date, default: Date.now },

    /** An archived project is readable and cannot be edited. */
    archivedAt: { type: Date, default: null },

    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

// The home page: my live projects, most recently touched first.
designProjectSchema.index({ owner: 1, deletedAt: 1, touchedAt: -1 });

designProjectSchema.statics.live = function live(filter = {}) {
  return this.find({ ...filter, deletedAt: null });
};

export const publicProject = (project, extra = {}) => ({
  id: project._id,
  name: project.name,
  description: project.description || '',
  icon: project.icon || '',
  hue: project.hue || 'violet',
  treeRev: project.treeRev ?? 0,
  archived: Boolean(project.archivedAt),
  touchedAt: project.touchedAt ?? project.updatedAt,
  deletedAt: project.deletedAt ?? null,
  createdAt: project.createdAt,
  updatedAt: project.updatedAt,
  ...extra,
});

export const DesignProject = mongoose.model('DesignProject', designProjectSchema);
