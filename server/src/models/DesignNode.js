import mongoose from 'mongoose';
import { BOARD_KINDS, NODE_KINDS } from '../config/design.js';

/**
 * One entry in a project's tree: a folder, or a board.
 *
 * Parent pointers only — no materialised `ancestors` array. A project is capped
 * at a couple of thousand nodes (config/design.js) and the explorer loads all of
 * them anyway, so every structural question — "is this a descendant", "how deep
 * is this", "what does deleting this folder take with it" — is answered by
 * walking a small in-memory map in tree.service.js. An ancestors copy would make
 * a folder move rewrite its whole subtree, and give that subtree a way to
 * disagree with its own parents.
 *
 * Names are not unique among siblings. A rename or a move should never fail
 * because another board is also called "Schema", and nothing addresses a node by
 * name.
 */
const designNodeSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'DesignProject', required: true },
    /** Null is the project root. Otherwise a live folder in the same project — enforced by the service. */
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'DesignNode', default: null },
    kind: { type: String, enum: NODE_KINDS, required: true, immutable: true },
    boardKind: { type: String, enum: [...BOARD_KINDS, null], default: null, immutable: true },
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 120 },
    /** Fractional key among siblings — see utils/fractionalIndex.js. Compared byte-wise. */
    order: { type: String, required: true, maxlength: 64 },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    /**
     * The node whose deletion put this one in the trash.
     *
     * What makes restore exact. Restoring a folder brings back what went with it
     * and nothing else — a board inside it that had been trashed on its own a
     * week earlier has a different `deletedRoot`, and stays in the trash.
     */
    deletedRoot: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  { timestamps: true },
);

designNodeSchema.pre('validate', function requireBoardKind(next) {
  if (this.kind === 'board' && !this.boardKind) {
    this.invalidate('boardKind', 'A board needs a kind');
  }
  if (this.kind === 'folder' && this.boardKind) {
    this.invalidate('boardKind', 'A folder has no board kind');
  }
  next();
});

// The tree read and the skeleton every structural change loads.
designNodeSchema.index({ project: 1, deletedAt: 1 });
// Siblings in order, for "insert after".
designNodeSchema.index({ project: 1, parent: 1, deletedAt: 1, order: 1 });
// The trash, and restore by root.
designNodeSchema.index(
  { project: 1, deletedRoot: 1 },
  { partialFilterExpression: { deletedRoot: { $type: 'objectId' } } },
);

export const publicNode = (node) => ({
  id: node._id,
  projectId: node.project,
  parentId: node.parent ?? null,
  kind: node.kind,
  boardKind: node.boardKind ?? null,
  name: node.name,
  order: node.order,
  deletedAt: node.deletedAt ?? null,
  createdAt: node.createdAt,
  updatedAt: node.updatedAt,
});

export const DesignNode = mongoose.model('DesignNode', designNodeSchema);
