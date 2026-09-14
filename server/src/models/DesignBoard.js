import mongoose from 'mongoose';
import { BOARD_KINDS } from '../config/design.js';

/**
 * A board's own state: its clock, its totals, and — for schema boards — the
 * DBML text.
 *
 * Its `_id` is the `_id` of the DesignNode it belongs to. A separate collection
 * rather than fields on the node for two reasons that both come down to the tree
 * staying cheap: the explorer reads every node in a project, and must never pull
 * two hundred kilobytes of DBML per schema board to draw a list of names; and
 * `rev` is written about once a second while someone is drawing, which on the
 * node would churn the documents every tree query touches.
 *
 * Sharing the id means a board id *is* a node id — there is no lookup field to
 * keep in step, and access is resolved by loading the node.
 */
const batchSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    rev: { type: Number, required: true },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const designBoardSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'DesignProject', required: true },
    /** Copied from the node so the commit path answers "is this a schema board" with the read it already made. */
    kind: { type: String, enum: BOARD_KINDS, required: true, immutable: true },

    /**
     * The board's clock. +1 per accepted batch of changes, and stamped onto
     * every element that batch wrote.
     *
     * One number does four jobs: it is how a tab asks "what changed since I last
     * looked" (`rev > since`), how two tabs merge, how a future change request
     * detects that the elements it touched moved underneath it, and the resume
     * point for a future live stream. The increment is the first write in every
     * commit transaction, which is also what serialises commits per board.
     */
    rev: { type: Number, default: 0 },

    elementCount: { type: Number, default: 0 },
    bytes: { type: Number, default: 0 },

    /** Board-level settings — background, grid. Small, and replaced key by key through the `meta` op. */
    meta: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },

    /** Schema boards: the DBML text, which is the truth the diagram is drawn from. Excluded on the commit path. */
    source: { type: String, default: '' },
    /** The `rev` at which `source` last changed — the compare-and-set token for text saves. */
    sourceRev: { type: Number, default: 0 },

    /**
     * The last few batches applied, by the id the client gave them.
     *
     * A client retries a save it never heard back about with the same id, and
     * this is how the retry is recognised as the save that already happened
     * rather than applied twice. Capped with `$slice`, because a retry only ever
     * concerns the last handful.
     */
    batches: { type: [batchSchema], default: [] },

    /** Delta requests from before this rev may have missed a compacted tombstone, so they get a reset instead. */
    tombFloorRev: { type: Number, default: 0 },
    compactedAt: { type: Date, default: null },

    lastWriteAt: { type: Date, default: null },
    lastWriteBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, minimize: false },
);

designBoardSchema.index({ project: 1, lastWriteAt: -1 });

export const publicBoard = (board) => ({
  id: board._id,
  kind: board.kind,
  rev: board.rev ?? 0,
  elementCount: board.elementCount ?? 0,
  bytes: board.bytes ?? 0,
  meta: board.meta || {},
  ...(board.kind === 'schema' ? { source: board.source ?? '', sourceRev: board.sourceRev ?? 0 } : {}),
  lastWriteAt: board.lastWriteAt ?? null,
  ...(board.recentBatches ? { recentBatches: board.recentBatches } : {}),
});

export const DesignBoard = mongoose.model('DesignBoard', designBoardSchema);
