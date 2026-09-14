import { shapeFor } from '../../shapes/registry.js';

/**
 * The eraser: sweep across things to remove them.
 *
 * Whole elements, not pixels — the way FigJam's and tldraw's erasers work,
 * because a half-erased rectangle is not something a diagram needs. What the
 * sweep touches fades while the button is held and is deleted on release, in
 * one undo step; Escape lets go of everything. Frames are never erased (one
 * sweep across a region would take its contents with it), nor is anything
 * locked.
 */

export function createEraserTool(editor) {
  const { ui } = editor;
  let state = null;

  const erasable = (record) => !record.data.locked && shapeFor(record.type).caps.erasable;

  function sweep(ctx) {
    const last = state.last;
    const steps = Math.max(1, Math.ceil(Math.hypot(ctx.sx - last.sx, ctx.sy - last.sy) / 4));
    for (let i = 1; i <= steps; i += 1) {
      const t = i / steps;
      const wx = last.wx + (ctx.wx - last.wx) * t;
      const wy = last.wy + (ctx.wy - last.wy) * t;
      const hit = editor.hitTest(wx, wy, { filter: erasable, tolerancePx: 6 });
      if (hit) state.marked.add(hit);
    }
    state.last = ctx;
    ui.set({ erasing: [...state.marked] });
  }

  const clear = () => {
    state = null;
    ui.set({ erasing: [] });
  };

  return {
    id: 'eraser',
    cursor: 'cell',
    onPointerDown(ctx) {
      state = { last: ctx, marked: new Set() };
      const hit = editor.hitTest(ctx.wx, ctx.wy, { filter: erasable, tolerancePx: 6 });
      if (hit) state.marked.add(hit);
      ui.set({ erasing: [...state.marked] });
    },
    onPointerMove(ctx) {
      if (state) sweep(ctx);
    },
    onPointerUp(ctx) {
      if (!state) return;
      if (!ctx.cancelled) sweep(ctx);
      const ids = [...state.marked];
      clear();
      if (ids.length) editor.commit('Erase', (tx) => ids.forEach((id) => tx.remove(id)), { selectAfter: [] });
    },
    onCancel: clear,
    onKeyDown(event) {
      if (event.key === 'Escape' && state) {
        clear();
        return true;
      }
      return false;
    },
  };
}
