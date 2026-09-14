/**
 * The board's elements, in memory — the one place the canvas reads from and
 * the only way anything on it changes.
 *
 * A record mirrors the wire shape exactly: `{ id, type, parent, z, data, rev }`,
 * with everything type-specific (geometry included) flat in `data`. Records are
 * immutable: an edit produces a new record, which is what makes three things
 * cheap that would otherwise be expensive —
 *
 * - **rendering**: a component re-renders when its record's identity changes,
 *   and only then; dragging one shape touches one component.
 * - **undo**: a history entry is a pair of record references per element,
 *   before and after. Nothing is diffed or copied to record it.
 * - **saving**: the ops a change needs are a shallow comparison of `data` keys
 *   between the two records (see diff.js).
 *
 * All writes go through `transact` (one atomic change, one commit) or a
 * gesture (many live updates — a drag — that commit once at the end). A commit
 * is `{ label, origin, changes: Map<id, [before, after]>, … }` and is what
 * history and autosave both listen to. `origin` separates what the person did
 * ('local') from what arrived ('remote') and what undo replayed ('undo').
 */

const ROOT = '';
const keyOf = (parent) => parent ?? ROOT;

export const byZ = (a, b) => (a.z < b.z ? -1 : a.z > b.z ? 1 : a.id < b.id ? -1 : 1);

function applyPatch(current, patch) {
  let changed = false;
  const next = { ...current };
  if ('parent' in patch && patch.parent !== current.parent) {
    next.parent = patch.parent ?? null;
    changed = true;
  }
  if ('z' in patch && patch.z !== current.z) {
    next.z = patch.z;
    changed = true;
  }
  if ('type' in patch && patch.type !== current.type) {
    next.type = patch.type;
    changed = true;
  }
  if (patch.data) {
    let data = null;
    for (const key of Object.keys(patch.data)) {
      const value = patch.data[key];
      if (value === undefined) {
        if (key in current.data) {
          data = data || { ...current.data };
          delete data[key];
        }
      } else if (current.data[key] !== value) {
        data = data || { ...current.data };
        data[key] = value;
      }
    }
    if (data) {
      next.data = data;
      changed = true;
    }
  }
  return changed ? next : current;
}

export function createStore({ sideEffects = {} } = {}) {
  const records = new Map();
  const byParent = new Map([[ROOT, new Set()]]);
  const sortedCache = new Map();

  const elementListeners = new Map();
  const childListeners = new Map();
  const commitListeners = new Set();
  const changeListeners = new Set();

  let gesture = null;
  let deferredRemote = [];
  let version = 0;

  /* ------------------------------------------------------------ indexes */

  const indexAdd = (record) => {
    const key = keyOf(record.parent);
    if (!byParent.has(key)) byParent.set(key, new Set());
    byParent.get(key).add(record.id);
  };
  const indexRemove = (record) => byParent.get(keyOf(record.parent))?.delete(record.id);

  function childIds(parent = null) {
    const key = keyOf(parent);
    const cached = sortedCache.get(key);
    if (cached) return cached;
    const ids = [...(byParent.get(key) || [])].map((id) => records.get(id)).sort(byZ).map((r) => r.id);
    sortedCache.set(key, ids);
    return ids;
  }

  /* ------------------------------------------------------------ applying */

  /** Writes a set of [before, after] changes into the maps and tells subscribers. */
  function write(changes) {
    const dirtyParents = new Set();
    for (const [id, [before, after]] of changes) {
      if (before) {
        indexRemove(before);
        if (!after || before.parent !== after.parent || before.z !== after.z) dirtyParents.add(keyOf(before.parent));
      }
      if (after) {
        records.set(id, after);
        indexAdd(after);
        if (!before || before.parent !== after.parent || before.z !== after.z) dirtyParents.add(keyOf(after.parent));
      } else {
        records.delete(id);
      }
    }
    for (const key of dirtyParents) sortedCache.delete(key);
    version += 1;

    for (const id of changes.keys()) {
      const set = elementListeners.get(id);
      if (set) for (const fn of [...set]) fn();
    }
    for (const key of dirtyParents) {
      const set = childListeners.get(key);
      if (set) for (const fn of [...set]) fn();
    }
    for (const fn of [...changeListeners]) fn(changes);
  }

  /* ------------------------------------------------------------ transactions */

  function makeTx(draft) {
    const get = (id) => (draft.has(id) ? draft.get(id) : records.get(id) ?? null);
    const tx = {
      get,
      has: (id) => Boolean(get(id)),
      /** Children of `parent` as the transaction currently sees them, in z order. */
      childIds(parent = null) {
        const key = keyOf(parent);
        const ids = new Set(byParent.get(key) || []);
        for (const [id, rec] of draft) {
          if (rec && keyOf(rec.parent) === key) ids.add(id);
          else ids.delete(id);
        }
        return [...ids].map(get).filter(Boolean).sort(byZ).map((r) => r.id);
      },
      create(record) {
        if (get(record.id)) throw new Error(`Element ${record.id} already exists`);
        const rec = { id: record.id, type: record.type, parent: record.parent ?? null, z: record.z, data: { ...record.data }, rev: 0 };
        draft.set(rec.id, rec);
        return rec;
      },
      update(id, patch) {
        const current = get(id);
        if (!current) return null;
        const next = applyPatch(current, patch);
        if (next !== current) draft.set(id, next);
        return next;
      },
      /** Replaces a record wholesale. No side effects — for undo, remote changes and loading. */
      put(record) {
        draft.set(record.id, record);
      },
      /** Removes with side effects (a frame's children go too, connectors let go). */
      remove(id) {
        const current = get(id);
        if (!current) return;
        draft.set(id, null);
        sideEffects.beforeDelete?.(tx, current);
      },
      /** Removes without side effects. */
      drop(id) {
        if (get(id)) draft.set(id, null);
      },
      /** Ids created, changed or removed so far in this transaction. */
      changedIds: () => [...draft.keys()],
    };
    return tx;
  }

  function collect(draft) {
    const changes = new Map();
    for (const [id, after] of draft) {
      const before = records.get(id) ?? null;
      if (before === after || (!before && !after)) continue;
      changes.set(id, [before, after]);
    }
    return changes;
  }

  function emit(changes, meta) {
    const commit = { label: '', origin: 'local', history: true, mergeKey: null, time: Date.now(), ...meta, changes };
    for (const fn of [...commitListeners]) fn(commit);
    return commit;
  }

  /**
   * One atomic change. Returns the commit, or null if nothing changed.
   *
   *   store.transact((tx) => { tx.update(id, { data: { x: 10 } }) }, { label: 'Move' })
   */
  function transact(fn, meta = {}) {
    if (gesture && meta.origin !== 'remote') gesture.commit();
    const draft = new Map();
    const result = fn(makeTx(draft));
    const changes = collect(draft);
    if (!changes.size) return null;
    sideEffects.afterChange?.(makeTx(draft), changes);
    const finalChanges = collect(draft);
    write(finalChanges);
    const commit = emit(finalChanges, meta);
    commit.result = result;
    return commit;
  }

  /**
   * Many live updates that become one commit — a drag, a resize, a scrubbed
   * number. Each `frame` is applied and drawn immediately but is invisible to
   * history and autosave until `commit`; `cancel` puts everything back.
   */
  function beginGesture(meta = {}) {
    if (gesture) gesture.commit();
    const origins = new Map();

    const handle = {
      frame(fn) {
        const draft = new Map();
        fn(makeTx(draft));
        const changes = collect(draft);
        if (!changes.size) return;
        for (const [id, [before]] of changes) if (!origins.has(id)) origins.set(id, before);
        write(changes);
      },
      update(id, patch) {
        handle.frame((tx) => tx.update(id, patch));
      },
      commit(extra = {}) {
        if (gesture !== handle) return null;
        gesture = null;
        const changes = new Map();
        for (const [id, before] of origins) {
          const after = records.get(id) ?? null;
          if (before !== after && (before || after)) changes.set(id, [before, after]);
        }
        flushDeferred();
        return changes.size ? emit(changes, { ...meta, ...extra }) : null;
      },
      cancel() {
        if (gesture !== handle) return;
        gesture = null;
        const changes = new Map();
        for (const [id, before] of origins) {
          const current = records.get(id) ?? null;
          if (current !== before) changes.set(id, [current, before]);
        }
        if (changes.size) write(changes);
        flushDeferred();
      },
      get active() {
        return gesture === handle;
      },
    };
    gesture = handle;
    return handle;
  }

  function flushDeferred() {
    const pending = deferredRemote;
    deferredRemote = [];
    for (const [fn, meta] of pending) transact(fn, meta);
  }

  /** Changes from elsewhere — another tab, the server. Held back while a gesture is live. */
  function applyRemote(fn, meta = {}) {
    const full = { history: false, ...meta, origin: 'remote' };
    if (gesture) {
      deferredRemote.push([fn, full]);
      return null;
    }
    return transact(fn, full);
  }

  /** Replaces everything. No commit — a load is not an edit. */
  function load(list) {
    const changes = new Map();
    const incoming = new Map(list.map((r) => [r.id, r]));
    for (const [id, before] of records) if (!incoming.has(id)) changes.set(id, [before, null]);
    for (const [id, after] of incoming) {
      const before = records.get(id) ?? null;
      if (before !== after) changes.set(id, [before, after]);
    }
    if (changes.size) write(changes);
  }

  /* ------------------------------------------------------------ subscriptions */

  const subscribeTo = (map, key, fn) => {
    if (!map.has(key)) map.set(key, new Set());
    map.get(key).add(fn);
    return () => {
      const set = map.get(key);
      set?.delete(fn);
      if (set && !set.size) map.delete(key);
    };
  };

  return {
    get: (id) => records.get(id) ?? null,
    has: (id) => records.has(id),
    all: () => records.values(),
    get size() {
      return records.size;
    },
    get version() {
      return version;
    },
    get gestureActive() {
      return Boolean(gesture);
    },
    childIds,
    transact,
    beginGesture,
    applyRemote,
    load,
    subscribeElement: (id, fn) => subscribeTo(elementListeners, id, fn),
    subscribeChildren: (parent, fn) => subscribeTo(childListeners, keyOf(parent), fn),
    onCommit: (fn) => {
      commitListeners.add(fn);
      return () => commitListeners.delete(fn);
    },
    onChange: (fn) => {
      changeListeners.add(fn);
      return () => changeListeners.delete(fn);
    },
  };
}
