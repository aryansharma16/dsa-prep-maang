import { createContext, useCallback, useContext, useRef, useSyncExternalStore } from 'react';

/**
 * How React reads the editor.
 *
 * Every hook here subscribes to exactly what it reads: one element, one
 * parent's child list, one slice of UI state. A drag re-renders the dragged
 * shape and the overlay; it does not re-render the board.
 */

export const EditorContext = createContext(null);

export function useEditor() {
  const editor = useContext(EditorContext);
  if (!editor) throw new Error('useEditor outside a BoardEditor');
  return editor;
}

/** One element's record. The record is immutable, so it is its own snapshot. */
export function useElement(id) {
  const editor = useEditor();
  const subscribe = useCallback((fn) => editor.store.subscribeElement(id, fn), [editor, id]);
  return useSyncExternalStore(subscribe, () => editor.store.get(id));
}

/** Child ids of a parent (null for the board root), in paint order. */
export function useChildIds(parent) {
  const editor = useEditor();
  const subscribe = useCallback((fn) => editor.store.subscribeChildren(parent, fn), [editor, parent]);
  return useSyncExternalStore(subscribe, () => editor.store.childIds(parent));
}

/**
 * A derived slice of UI state. `select` runs on every UI change; the component
 * re-renders only when `isEqual` says the slice changed.
 */
export function useUi(select, isEqual = Object.is) {
  const editor = useEditor();
  const last = useRef({ has: false, value: undefined });
  const getSnapshot = () => {
    const next = select(editor.ui.get());
    if (last.current.has && isEqual(last.current.value, next)) return last.current.value;
    last.current = { has: true, value: next };
    return next;
  };
  return useSyncExternalStore(editor.ui.subscribe, getSnapshot);
}

export const shallowArray = (a, b) => a === b || (a.length === b.length && a.every((v, i) => v === b[i]));

/** A value recomputed whenever the store commits or changes; for the inspector and similar. */
export function useStoreValue(compute, isEqual = Object.is) {
  const editor = useEditor();
  const last = useRef({ has: false, value: undefined, version: -1 });
  const subscribe = useCallback(
    (fn) => {
      const offStore = editor.store.onChange(fn);
      const offUi = editor.ui.subscribe(fn);
      return () => {
        offStore();
        offUi();
      };
    },
    [editor],
  );
  const getSnapshot = () => {
    const next = compute(editor);
    if (last.current.has && isEqual(last.current.value, next)) return last.current.value;
    last.current = { has: true, value: next };
    return next;
  };
  return useSyncExternalStore(subscribe, getSnapshot);
}

/** The camera, re-rendering once per frame it changes. For the overlay only. */
export function useCamera() {
  const editor = useEditor();
  return useSyncExternalStore(editor.subscribeCamera, () => editor.camera);
}

/** Re-renders when any of `ids` changes — for things drawn from other elements' geometry. */
export function useGeometryVersion(ids) {
  const editor = useEditor();
  const version = useRef(0);
  const key = ids.join('|');
  const subscribe = useCallback(
    (fn) =>
      editor.watchGeometry(key ? key.split('|') : [], () => {
        version.current += 1;
        fn();
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` is `ids` by value
    [editor, key],
  );
  return useSyncExternalStore(subscribe, () => version.current);
}
