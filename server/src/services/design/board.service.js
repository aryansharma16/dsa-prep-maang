import { DESIGN_LIMITS } from '../../config/design.js';
import { DesignBoard } from '../../models/DesignBoard.js';
import { DesignElement, publicChange, publicElement } from '../../models/DesignElement.js';
import { DesignProject } from '../../models/DesignProject.js';
import { gone } from './access.service.js';
import { applyBoardLimits, foldMeta, foldOps } from './ops.js';
import { inTransaction } from './tx.js';

/**
 * Reading a board, and the single path by which anything on it changes.
 *
 * `commitOps` is that path. Autosave calls it today; restoring a snapshot,
 * merging a change request and a future live-editing channel will call it
 * tomorrow, which is why it takes a batch of ops rather than being shaped
 * around one HTTP request.
 */

const DAY = 24 * 60 * 60 * 1000;
const ELEMENT_OPS = new Set(['put', 'patch', 'del']);

class DuplicateBatch extends Error {
  constructor(rev) {
    super('duplicate batch');
    this.rev = rev;
  }
}

/** A board as the editor opens it: every live element, plus the board's state. */
export async function loadBoard(node) {
  const board = await DesignBoard.findById(node._id).select('-batches').lean();
  if (!board) throw gone('Board not found');
  const elements = await DesignElement.find({ board: board._id, deletedAt: null })
    .select('eid type parent z data rev')
    .lean();
  return { board, elements: elements.map(publicElement) };
}

/** The validator for a board load: changes when anything on the board or the board's node does. */
export async function boardTag(node) {
  const board = await DesignBoard.findById(node._id).select('rev').lean();
  if (!board) throw gone('Board not found');
  return `W/"b-${node._id}-${board.rev}-${new Date(node.updatedAt).getTime()}"`;
}

/**
 * Everything written to a board after `since`, tombstones included.
 *
 * `reset` means "too much, or too old, to describe as a delta — reload the
 * board". The board's rev is read before the elements, so a commit landing
 * between the two reads can only add a duplicate (which the client drops by
 * rev), never hide a change.
 */
export async function changesSince(node, since) {
  const board = await DesignBoard.findById(node._id).select('-source -batches').lean();
  if (!board) throw gone('Board not found');

  const base = { rev: board.rev, meta: board.meta || {} };
  if (since > board.rev || since < (board.tombFloorRev || 0)) return { ...base, changes: [], reset: true };
  if (since === board.rev) return { ...base, changes: [], reset: false };

  const docs = await DesignElement.find({ board: board._id, rev: { $gt: since } })
    .select('eid type parent z data rev deletedAt')
    .limit(DESIGN_LIMITS.changesPerResponse + 1)
    .lean();
  if (docs.length > DESIGN_LIMITS.changesPerResponse) return { ...base, changes: [], reset: true };

  const result = { ...base, changes: docs.map(publicChange), reset: false };
  if (board.kind === 'schema' && board.sourceRev > since) {
    const { source, sourceRev } = await DesignBoard.findById(board._id).select('source sourceRev').lean();
    result.board = { source, sourceRev };
  }
  return result;
}

/**
 * Applies one batch of ops to a board.
 *
 * Inside one transaction:
 *
 * 1. `$inc` the board's `rev`. First, deliberately — two batches for the same
 *    board now write the same document, so the second aborts and is retried by
 *    the driver after the first commits. That is the whole of the concurrency
 *    control, and it means readers never see a rev whose elements are not there.
 * 2. Recognise a retry: a `batchId` already recorded means this save happened.
 *    Throwing aborts the transaction, so the retry does not consume a rev.
 * 3. Read the touched elements, fold the ops (ops.js), apply board limits.
 * 4. Write the accepted elements, then the board's totals, settings and text.
 *
 * After commit, if the client's `baseRev` is behind — another tab or device
 * saved in between — the other writers' changes ride back on the response so
 * the client can merge them without a second round trip.
 */
export async function commitOps({ project, node, userId }, batch) {
  const now = new Date();
  const elementOps = batch.ops.filter((op) => ELEMENT_OPS.has(op.op));
  const sourceOp = batch.ops.find((op) => op.op === 'source');

  let committed;
  try {
    committed = await inTransaction(async (session) => {
      const board = await DesignBoard.findOneAndUpdate(
        { _id: node._id },
        { $inc: { rev: 1 } },
        { new: true, session, projection: { source: 0 } },
      ).lean();
      if (!board) throw gone('Board not found');

      const seen = (board.batches || []).find((entry) => entry.id === batch.batchId);
      if (seen) throw new DuplicateBatch(seen.rev);
      const rev = board.rev;

      const eids = [...new Set(elementOps.map((op) => op.el?.eid ?? op.eid))];
      const docs = eids.length
        ? await DesignElement.find({ board: board._id, eid: { $in: eids } }).session(session).lean()
        : [];
      const stored = new Map(docs.map((doc) => [doc.eid, doc]));

      const folded = foldOps(stored, elementOps, { boardKind: board.kind });
      const totals = applyBoardLimits(folded, board, stored);
      const rejected = [...folded.rejected];

      const writes = [...folded.writes.values()].map((w) => ({
        updateOne: {
          filter: { board: board._id, eid: w.eid },
          update: {
            $set: w.deleted
              ? { deletedAt: now, rev, updatedBy: userId, data: {}, bytes: 0 }
              : {
                  type: w.type,
                  parent: w.parent,
                  z: w.z,
                  data: w.data,
                  bytes: w.bytes,
                  rev,
                  updatedBy: userId,
                  deletedAt: null,
                },
            $setOnInsert: { project: project._id },
          },
          upsert: !w.deleted,
        },
      }));
      if (writes.length) await DesignElement.bulkWrite(writes, { session, ordered: false });

      const $set = { elementCount: totals.count, bytes: totals.bytes, lastWriteAt: now, lastWriteBy: userId };

      const meta = foldMeta(board.meta, batch.ops);
      if (meta === null) rejected.push({ op: 'meta', code: 'TOO_LARGE' });
      else if (meta) $set.meta = meta;

      let sourceSaved = false;
      if (sourceOp) {
        if (board.kind !== 'schema') rejected.push({ op: 'source', code: 'NOT_SCHEMA' });
        else if (sourceOp.base !== board.sourceRev) rejected.push({ op: 'source', code: 'SOURCE_CONFLICT' });
        else {
          $set.source = sourceOp.text;
          $set.sourceRev = rev;
          sourceSaved = true;
        }
      }

      await DesignBoard.updateOne(
        { _id: board._id },
        {
          $set,
          $push: {
            batches: {
              $each: [{ id: batch.batchId, rev, at: now }],
              $slice: -DESIGN_LIMITS.batchesRemembered,
            },
          },
        },
        { session },
      );

      return {
        rev,
        rejected,
        sourceSaved,
        kind: board.kind,
        sourceRevBefore: board.sourceRev,
        tombFloorRev: board.tombFloorRev || 0,
      };
    });
  } catch (error) {
    if (error instanceof DuplicateBatch) {
      return { rev: error.rev, duplicate: true, rejected: [], changes: [], reset: false };
    }
    throw error;
  }

  const { rev, rejected, sourceSaved, kind, sourceRevBefore, tombFloorRev } = committed;

  // Outside the transaction and throttled, so busy boards do not contend with
  // tree changes on the project document once a second.
  DesignProject.updateOne(
    { _id: project._id, touchedAt: { $lt: new Date(now.getTime() - 60_000) } },
    { $set: { touchedAt: now } },
  ).catch(() => {});

  const response = { rev, rejected, changes: [], reset: false };

  const conflict = rejected.find((entry) => entry.code === 'SOURCE_CONFLICT');
  const othersChangedSource = kind === 'schema' && !sourceSaved && sourceRevBefore > batch.baseRev;
  if (conflict || othersChangedSource) {
    const fresh = await DesignBoard.findById(node._id).select('source sourceRev').lean();
    const current = { source: fresh?.source ?? '', sourceRev: fresh?.sourceRev ?? 0 };
    if (conflict) conflict.current = current;
    response.board = current;
  }

  if (batch.baseRev !== rev - 1) {
    if (batch.baseRev > rev || batch.baseRev < tombFloorRev) {
      response.reset = true;
    } else {
      const docs = await DesignElement.find({ board: node._id, rev: { $gt: batch.baseRev, $lt: rev } })
        .select('eid type parent z data rev deletedAt')
        .limit(DESIGN_LIMITS.changesPerResponse + 1)
        .lean();
      if (docs.length > DESIGN_LIMITS.changesPerResponse) response.reset = true;
      else response.changes = docs.map(publicChange);
    }
  }

  return response;
}

/**
 * Drops tombstones older than the retention window.
 *
 * `tombFloorRev` is raised *before* the delete, so a delta request racing this
 * can only be told to reset — never handed a delta with a deletion missing from
 * it. Run after a board load at most once a day per board; cheap when there is
 * nothing to do.
 */
export async function compactTombstones(boardId) {
  const board = await DesignBoard.findById(boardId).select('compactedAt').lean();
  if (!board || (board.compactedAt && Date.now() - new Date(board.compactedAt).getTime() < DAY)) return;

  const cutoff = new Date(Date.now() - DESIGN_LIMITS.tombstoneDays * DAY);
  const newest = await DesignElement.findOne({ board: boardId, deletedAt: { $ne: null, $lt: cutoff } })
    .sort({ rev: -1 })
    .select('rev')
    .lean();

  if (newest) {
    await DesignBoard.updateOne(
      { _id: boardId, tombFloorRev: { $lt: newest.rev } },
      { $set: { tombFloorRev: newest.rev } },
    );
    await DesignElement.deleteMany({ board: boardId, deletedAt: { $ne: null, $lt: cutoff }, rev: { $lte: newest.rev } });
  }
  await DesignBoard.updateOne({ _id: boardId }, { $set: { compactedAt: new Date() } });
}
