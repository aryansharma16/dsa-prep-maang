import { DESIGN_LIMITS } from '../../config/design.js';
import { publicChange } from '../../models/DesignElement.js';
import { assertBoundedJson, elementProblem, jsonBytes } from '../../validation/designElements.js';

/**
 * Folding a batch of ops onto the elements they touch — the pure half of a
 * board save.
 *
 * Kept free of Mongo so the rules can be tested on their own (see
 * __tests__/ops.test.js): board.service.js reads the current documents, hands
 * them here, and writes back whatever this decides. Every rule about what an op
 * means lives in this file and nowhere else.
 *
 * The unit of acceptance is the **element**, not the op and not the batch. Ops
 * for one eid are applied in order, the final state is validated once, and if
 * it fails, that element keeps its stored state and is reported back with it —
 * so the client can put its copy right — while every other element in the batch
 * still saves. Rejecting a whole batch for one bad element would have the
 * client retrying it forever.
 */

const clone = (data) => ({ ...(data || {}) });

/**
 * @param {Map<string, object>} stored   eid → current document (lean), tombstones included
 * @param {Array} ops                     the batch's put/patch/del ops, in order
 * @param {{ boardKind: string }} ctx
 * @returns {{ writes: Map<string, object>, rejected: Array }}
 *   `writes` holds the final state of each accepted element that changed:
 *   `{ eid, type, parent, z, data, bytes, deleted, wasLive }`.
 */
export function foldOps(stored, ops, ctx) {
  const states = new Map();
  const rejectedCodes = new Map();

  const stateFor = (eid) => {
    if (states.has(eid)) return states.get(eid);
    const doc = stored.get(eid);
    const state = doc
      ? {
          eid,
          type: doc.type,
          parent: doc.parent ?? null,
          z: doc.z,
          data: clone(doc.data),
          deleted: Boolean(doc.deletedAt),
          exists: true,
          wasLive: !doc.deletedAt,
          touched: false,
        }
      : { eid, type: null, parent: null, z: null, data: {}, deleted: true, exists: false, wasLive: false, touched: false };
    states.set(eid, state);
    return state;
  };

  for (const op of ops) {
    if (op.op === 'put') {
      const { el } = op;
      const state = stateFor(el.eid);
      Object.assign(state, {
        type: el.type,
        parent: el.parent === el.eid ? null : el.parent,
        z: el.z,
        data: clone(el.data),
        deleted: false,
        touched: true,
      });
      continue;
    }

    if (op.op === 'patch') {
      const state = stateFor(op.eid);
      if (state.deleted) {
        // A change to something that is not there. Reported, not fatal — the
        // usual cause is another tab deleting it a moment earlier.
        if (!rejectedCodes.has(op.eid)) rejectedCodes.set(op.eid, 'MISSING');
        continue;
      }
      if (op.parent !== undefined) state.parent = op.parent === op.eid ? null : op.parent;
      if (op.z !== undefined) state.z = op.z;
      if (op.set) Object.assign(state.data, op.set);
      if (op.unset) for (const key of op.unset) delete state.data[key];
      state.touched = true;
      continue;
    }

    if (op.op === 'del') {
      const state = stateFor(op.eid);
      if (!state.deleted) {
        state.deleted = true;
        state.touched = true;
      }
    }
  }

  const writes = new Map();
  const rejected = [];

  for (const state of states.values()) {
    if (!state.touched) {
      if (rejectedCodes.has(state.eid)) rejected.push(rejection(state.eid, rejectedCodes.get(state.eid), stored));
      continue;
    }
    // A delete of something that never existed has nothing to write.
    if (state.deleted && !state.exists) continue;

    let bytes = 0;
    if (!state.deleted) {
      const problem = elementProblem(state, ctx);
      if (problem) {
        rejected.push(rejection(state.eid, problem, stored));
        continue;
      }
      bytes = jsonBytes(state.data);
    }
    writes.set(state.eid, {
      eid: state.eid,
      type: state.type,
      parent: state.parent,
      z: state.z,
      data: state.data,
      bytes,
      deleted: state.deleted,
      wasLive: state.wasLive,
      wasBytes: state.wasLive ? stored.get(state.eid)?.bytes ?? 0 : 0,
    });
  }

  return { writes, rejected };
}

function rejection(eid, code, stored) {
  const doc = stored.get(eid);
  return { eid, code, current: doc ? publicChange(doc) : null };
}

/**
 * Enforces the board's size ceilings on a folded batch, in place.
 *
 * Only growth is refused. An element that is shrinking, moving or being deleted
 * always saves, because a board that is over its limit must still be editable
 * back under it.
 */
export function applyBoardLimits(folded, board, stored) {
  const totals = () => {
    let count = board.elementCount ?? 0;
    let bytes = board.bytes ?? 0;
    for (const w of folded.writes.values()) {
      const live = !w.deleted;
      count += (live ? 1 : 0) - (w.wasLive ? 1 : 0);
      bytes += (live ? w.bytes : 0) - w.wasBytes;
    }
    return { count, bytes };
  };

  let { count, bytes } = totals();
  if (count <= DESIGN_LIMITS.elementsPerBoard && bytes <= DESIGN_LIMITS.boardBytes) {
    return { count, bytes };
  }

  for (const w of [...folded.writes.values()]) {
    const creates = !w.wasLive && !w.deleted;
    const grows = !w.deleted && w.bytes > w.wasBytes;
    const overCount = count > DESIGN_LIMITS.elementsPerBoard && creates;
    const overBytes = bytes > DESIGN_LIMITS.boardBytes && grows;
    if (overCount || overBytes) {
      folded.writes.delete(w.eid);
      folded.rejected.push(rejection(w.eid, 'BOARD_FULL', stored));
      ({ count, bytes } = totals());
    }
  }
  return { count, bytes };
}

/**
 * Folds `meta` ops onto the board's settings. Returns the new object, or null
 * when the result would be too large to keep — board settings are a handful of
 * flags, and a meta object growing past 4KB is a client bug.
 */
export function foldMeta(meta, ops) {
  const metaOps = ops.filter((op) => op.op === 'meta');
  if (!metaOps.length) return undefined;
  const next = { ...(meta || {}) };
  for (const op of metaOps) Object.assign(next, op.set);
  try {
    assertBoundedJson(next);
  } catch {
    return null;
  }
  return jsonBytes(next) <= 4096 ? next : null;
}
