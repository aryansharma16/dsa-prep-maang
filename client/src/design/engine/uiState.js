/**
 * Editor state that is not part of the board: what is selected, hovered,
 * being edited, which tool is active, what the snap guides are showing.
 *
 * Kept apart from the element store on purpose. Selection changes on every
 * click, and if it lived on the records every selected element would re-render
 * — and every selection change would be a commit that history and autosave had
 * to learn to ignore. Elements never subscribe to this; the overlay, the
 * toolbar and the inspector do.
 */

const EMPTY = Object.freeze([]);

export const INITIAL_UI = Object.freeze({
  tool: 'select',
  toolLocked: false,
  selection: EMPTY,
  hovered: null,
  editingId: null,
  marquee: null, // { minX, minY, maxX, maxY } in world
  snapLines: EMPTY, // [{ axis: 'x'|'y', at, from, to }]
  dropTarget: null, // frame id a drag would land in
  bindTarget: null, // { eid, anchor } a connector end would bind to
  erasing: EMPTY, // ids the eraser has marked
  readOnly: false,
  flowPaused: false,
  moving: false,
  interaction: 'idle',
  cursor: 'default',
  contextMenu: null,
  shortcutsOpen: false,
  libraryOpen: false,
  schemaFocus: null, // { table, column } under the DBML editor's caret
  schemaReveal: null, // a text span the DBML editor should select and scroll to
  schemaRelation: null, // id of the relation line selected on a schema board
  toolStyle: Object.freeze({}), // last-used style per tool, applied to new elements
});

export function createUiState(initial = {}) {
  let state = { ...INITIAL_UI, ...initial };
  const listeners = new Set();

  return {
    get: () => state,
    set(patch) {
      const next = typeof patch === 'function' ? patch(state) : patch;
      let changed = false;
      for (const key of Object.keys(next)) {
        if (state[key] !== next[key]) {
          changed = true;
          break;
        }
      }
      if (!changed) return;
      state = { ...state, ...next };
      for (const fn of [...listeners]) fn(state);
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

/** Selection arrays compare by contents, so re-selecting the same ids does not notify. */
export function sameIds(a, b) {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}
