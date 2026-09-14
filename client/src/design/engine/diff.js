/**
 * Turns a store commit into the ops a board save sends.
 *
 * The wire contract is defined by the server (validation/designElements.js):
 * `put` sends a whole element, `patch` sends the top-level `data` keys that
 * changed — nested objects travel whole — and `del` names an element. Because
 * records are immutable, "changed" is an identity comparison per key.
 */

export function opsFromCommit(commit) {
  const ops = [];
  for (const [id, [before, after]] of commit.changes) {
    const op = opForChange(id, before, after);
    if (op) ops.push(op);
  }
  return ops;
}

/** The schema board's DBML text lives in a store record under this id (see schema/schemaSync.js). */
const SOURCE_ID = '__source';

export function opForChange(id, before, after) {
  // Schema text is not an element: it saves as the board's compare-and-set `source` op.
  // `base` (the server's source revision this edit starts from) is added when the batch is sent.
  if (id === SOURCE_ID) return after && after.data.text !== before?.data.text ? { op: 'source', text: after.data.text ?? '' } : null;
  if (!after) return before ? { op: 'del', eid: id } : null;
  if (!before || before.type !== after.type) {
    return { op: 'put', el: { eid: id, type: after.type, parent: after.parent ?? null, z: after.z, data: after.data } };
  }

  const patch = { op: 'patch', eid: id };
  let any = false;
  if ((before.parent ?? null) !== (after.parent ?? null)) {
    patch.parent = after.parent ?? null;
    any = true;
  }
  if (before.z !== after.z) {
    patch.z = after.z;
    any = true;
  }
  let set = null;
  for (const key of Object.keys(after.data)) {
    if (before.data[key] !== after.data[key]) {
      set = set || {};
      set[key] = after.data[key];
    }
  }
  let unset = null;
  for (const key of Object.keys(before.data)) {
    if (!(key in after.data)) {
      unset = unset || [];
      unset.push(key);
    }
  }
  if (set) {
    patch.set = set;
    any = true;
  }
  if (unset) {
    patch.unset = unset;
    any = true;
  }
  return any ? patch : null;
}

/** An element record from its wire form. */
export const recordFromWire = (el) => ({
  id: el.eid,
  type: el.type,
  parent: el.parent ?? null,
  z: el.z,
  data: el.data || {},
  rev: el.rev ?? 0,
});
