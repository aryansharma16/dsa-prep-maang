/**
 * Undo and redo.
 *
 * An entry is a commit's `changes` — for each element, the record before and
 * the record after — plus the selection on either side. Undo is not a special
 * operation on the store: it is an ordinary transaction that puts the `before`
 * records back, tagged `origin: 'undo'`. So it re-renders like any edit, saves
 * like any edit, and never needs an inverse computed.
 *
 * `mergeKey` folds a run of commits into one entry — every keystroke of a text
 * edit, every tick of a scrubbed number — so one undo takes the whole run back.
 *
 * Remote commits never enter history. When two people can edit the same board,
 * an entry whose `after` no longer matches the current record will need to be
 * applied field by field rather than wholesale; that seam is `restore` below.
 */

const MERGE_WINDOW_MS = 1500;

export function createHistory(store, { limit = 300, getSelection = () => [], setSelection = () => {} } = {}) {
  const undoStack = [];
  const redoStack = [];
  const listeners = new Set();
  const notify = () => listeners.forEach((fn) => fn());

  store.onCommit((commit) => {
    if (commit.origin !== 'local' || commit.history === false) return;
    const top = undoStack.at(-1);
    if (commit.mergeKey && top && top.mergeKey === commit.mergeKey && commit.time - top.time < MERGE_WINDOW_MS) {
      for (const [id, [before, after]] of commit.changes) {
        const existing = top.changes.get(id);
        if (existing) existing[1] = after;
        else top.changes.set(id, [before, after]);
      }
      top.time = commit.time;
      top.selectionAfter = commit.selectionAfter ?? getSelection();
    } else {
      undoStack.push({
        label: commit.label,
        mergeKey: commit.mergeKey,
        time: commit.time,
        changes: new Map([...commit.changes].map(([id, pair]) => [id, [...pair]])),
        selectionBefore: commit.selectionBefore ?? [],
        selectionAfter: commit.selectionAfter ?? getSelection(),
      });
      if (undoStack.length > limit) undoStack.shift();
    }
    redoStack.length = 0;
    notify();
  });

  function restore(entry, side) {
    const index = side === 'before' ? 0 : 1;
    store.transact(
      (tx) => {
        for (const [id, pair] of entry.changes) {
          const record = pair[index];
          if (record) tx.put(record);
          else tx.drop(id);
        }
      },
      { label: `${side === 'before' ? 'Undo' : 'Redo'} ${entry.label}`, origin: 'undo', history: false },
    );
  }

  return {
    undo() {
      const entry = undoStack.pop();
      if (!entry) return false;
      restore(entry, 'before');
      redoStack.push(entry);
      setSelection(entry.selectionBefore.filter((id) => store.has(id)));
      notify();
      return true;
    },
    redo() {
      const entry = redoStack.pop();
      if (!entry) return false;
      restore(entry, 'after');
      undoStack.push(entry);
      setSelection(entry.selectionAfter.filter((id) => store.has(id)));
      notify();
      return true;
    },
    /** Ends a merge run, so the next commit with the same key starts a new entry. */
    seal() {
      const top = undoStack.at(-1);
      if (top) top.mergeKey = null;
    },
    clear() {
      undoStack.length = 0;
      redoStack.length = 0;
      notify();
    },
    get canUndo() {
      return undoStack.length > 0;
    },
    get canRedo() {
      return redoStack.length > 0;
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
