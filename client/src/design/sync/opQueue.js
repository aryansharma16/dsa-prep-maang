/**
 * Pending board changes, coalesced per element until they are sent.
 *
 * Twenty nudges of one shape become one patch; creating a shape and then
 * recolouring it becomes one put. The rules are the whole file:
 *
 *   put   then patch  → put, with the patch folded in
 *   put   then put    → the later put
 *   put   then del    → del
 *   patch then patch  → one patch: later values win, unset and set cancel
 *   patch then put    → the put
 *   patch then del    → del
 *   del   then put    → put (an undone delete)
 *   del   then patch  → del
 *
 * `put` then `del` stays a `del` rather than vanishing, because the queue
 * cannot know whether the server has seen the element — an undo can resurrect
 * something that exists there as a tombstone — and a del of nothing is
 * harmless while a lost del is not.
 *
 * `meta` and `source` ops (board settings, schema text) are kept separately:
 * meta keys merge, and only the newest source text matters.
 */

export function coalesce(a, b) {
  if (!a) return b;
  if (!b) return a;
  if (b.op === 'del') return b;
  if (b.op === 'put') return b;

  // b is a patch.
  if (a.op === 'del') return a;
  if (a.op === 'put') {
    const data = { ...a.el.data, ...(b.set || {}) };
    for (const key of b.unset || []) delete data[key];
    return {
      op: 'put',
      el: {
        ...a.el,
        parent: b.parent !== undefined ? b.parent : a.el.parent,
        z: b.z !== undefined ? b.z : a.el.z,
        data,
      },
    };
  }

  // patch then patch
  const merged = { op: 'patch', eid: a.eid };
  const parent = b.parent !== undefined ? b.parent : a.parent;
  const z = b.z !== undefined ? b.z : a.z;
  if (parent !== undefined) merged.parent = parent;
  if (z !== undefined) merged.z = z;
  const set = { ...(a.set || {}) };
  const unset = new Set(a.unset || []);
  for (const [key, value] of Object.entries(b.set || {})) {
    set[key] = value;
    unset.delete(key);
  }
  for (const key of b.unset || []) {
    delete set[key];
    unset.add(key);
  }
  if (Object.keys(set).length) merged.set = set;
  if (unset.size) merged.unset = [...unset];
  return merged;
}

const eidOf = (op) => op.eid ?? op.el?.eid;

export function createOpQueue() {
  let ops = new Map();
  let meta = null;
  let source = null;

  const add = (op) => {
    if (op.op === 'meta') {
      meta = { ...(meta || {}), ...op.set };
      return;
    }
    if (op.op === 'source') {
      source = op;
      return;
    }
    const eid = eidOf(op);
    const next = coalesce(ops.get(eid), op);
    // Keep insertion order meaningful: a re-touched element moves to the back.
    ops.delete(eid);
    ops.set(eid, next);
  };

  return {
    add,
    addAll(list) {
      for (const op of list) add(op);
    },
    get size() {
      return ops.size + (meta ? 1 : 0) + (source ? 1 : 0);
    },
    has: (eid) => ops.has(eid),
    peek: () => [...ops.values()],

    /**
     * Removes and returns up to `maxOps` ops whose JSON stays under `maxBytes`.
     * Always takes at least one op, however large, so an oversized element is
     * sent (and rejected by the server) rather than blocking the queue forever.
     */
    take({ maxOps = 500, maxBytes = 512 * 1024 } = {}) {
      const batch = [];
      let bytes = 2;
      if (source) {
        batch.push(source);
        bytes += source.text.length + 40;
        source = null;
      }
      if (meta) {
        batch.push({ op: 'meta', set: meta });
        bytes += JSON.stringify(meta).length + 20;
        meta = null;
      }
      for (const [eid, op] of ops) {
        const size = JSON.stringify(op).length + 1;
        if (batch.length && (batch.length >= maxOps || bytes + size > maxBytes)) break;
        batch.push(op);
        bytes += size;
        ops.delete(eid);
      }
      return batch;
    },

    /**
     * Puts a batch that failed to send back *underneath* whatever was queued
     * since, so newer edits still win.
     */
    requeue(batch) {
      const newer = ops;
      const newerMeta = meta;
      const newerSource = source;
      ops = new Map();
      meta = null;
      source = null;
      for (const op of batch) add(op);
      for (const op of newer.values()) add(op);
      if (newerMeta) meta = { ...(meta || {}), ...newerMeta };
      if (newerSource) source = newerSource;
    },

    /** Everything pending, for the crash-recovery mirror. */
    snapshot() {
      const list = [...ops.values()];
      if (meta) list.push({ op: 'meta', set: meta });
      if (source) list.push(source);
      return list;
    },

    clear() {
      ops = new Map();
      meta = null;
      source = null;
    },
  };
}
