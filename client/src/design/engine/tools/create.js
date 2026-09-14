import { shapeFor } from '../../shapes/registry.js';

/**
 * Tools that place a box-shaped element: rectangle, ellipse, diamond, cylinder,
 * frame, sticky note, text and paragraph.
 *
 * Click to drop one at its default size, centred on the pointer; drag to draw
 * it at the size you want (Shift for a square). Afterwards the tool hands back
 * to Select — unless the tool lock is on (Q), for drawing several in a row.
 * Text-bearing elements open for typing straight away.
 */

const DRAG_PX = 4;

export function createShapeTool(editor, type) {
  const { store, ui } = editor;
  const def = shapeFor(type);
  let state = null;

  const finish = (id) => {
    // Tool first: switching tools ends any text editing, so editing starts after.
    if (!ui.get().toolLocked) editor.setTool('select');
    if (id) {
      editor.select([id]);
      if (['text', 'sticky', 'paragraph'].includes(type)) ui.set({ editingId: id });
    }
  };

  /** Top-level elements wholly inside a new frame move into it, like drawing a frame in Figma. */
  function adopt(tx, frameId) {
    const frame = tx.get(frameId);
    const fx = frame.data.x;
    const fy = frame.data.y;
    for (const id of tx.childIds(frame.parent ?? null)) {
      if (id === frameId) continue;
      const record = tx.get(id);
      if (!record || record.type === 'connector') continue;
      const b = editor.boundsOf(record);
      const origin = editor.worldOrigin(frame.parent);
      const inside = b && b.minX >= fx + origin.x && b.minY >= fy + origin.y && b.maxX <= fx + origin.x + frame.data.w && b.maxY <= fy + origin.y + frame.data.h;
      if (inside) editor.reparent(tx, id, frameId);
    }
  }

  return {
    id: type,
    cursor: type === 'text' || type === 'paragraph' ? 'text' : 'crosshair',

    onPointerDown(ctx) {
      state = { start: ctx, gesture: null, id: null, parent: type === 'frame' ? null : editor.frameAt(ctx.wx, ctx.wy) };
    },

    onPointerMove(ctx) {
      if (!state) return;
      if (!state.gesture) {
        if (Math.hypot(ctx.sx - state.start.sx, ctx.sy - state.start.sy) < DRAG_PX) return;
        state.gesture = store.beginGesture({ label: `Add ${def.label.toLowerCase()}`, selectionBefore: ui.get().selection });
        const origin = editor.worldOrigin(state.parent);
        state.gesture.frame((tx) => {
          const record = editor.newRecord(type, { x: state.start.wx - origin.x, y: state.start.wy - origin.y, w: 1, h: 1 }, { parent: state.parent, tx });
          if (type === 'text' || type === 'paragraph') delete record.data.autoWidth;
          tx.create(record);
          state.id = record.id;
        });
        ui.set({ selection: [state.id] });
      }
      let w = ctx.wx - state.start.wx;
      let h = ctx.wy - state.start.wy;
      if (ctx.shift || def.caps.resize === 'aspect') {
        const side = Math.max(Math.abs(w), Math.abs(h));
        w = Math.sign(w || 1) * side;
        h = Math.sign(h || 1) * side;
      }
      const origin = editor.worldOrigin(state.parent);
      const x = Math.min(state.start.wx, state.start.wx + w) - origin.x;
      const y = Math.min(state.start.wy, state.start.wy + h) - origin.y;
      state.gesture.frame((tx) => tx.update(state.id, { data: { x, y, w: Math.abs(w), h: Math.abs(h) } }));
    },

    onPointerUp(ctx) {
      if (!state) return;
      const current = state;
      state = null;

      if (current.gesture) {
        if (ctx.cancelled) {
          current.gesture.cancel();
          return;
        }
        current.gesture.frame((tx) => {
          const record = tx.get(current.id);
          const defaults = def.defaults();
          const tooSmall = record.data.w < def.minW * 2 && record.data.h < def.minH * 2;
          const w = tooSmall ? defaults.w : Math.max(def.minW, Math.round(record.data.w));
          const h = tooSmall ? defaults.h : Math.max(def.minH, Math.round(record.data.h));
          tx.update(current.id, { data: { x: Math.round(record.data.x), y: Math.round(record.data.y), w, h } });
          if (type === 'frame') adopt(tx, current.id);
        });
        current.gesture.commit({ selectionAfter: [current.id] });
        finish(current.id);
        return;
      }

      // A click: default size, centred on the pointer (text starts at it).
      const defaults = def.defaults();
      const origin = editor.worldOrigin(current.parent);
      const centred = type !== 'text';
      const x = Math.round(ctx.wx - origin.x - (centred ? defaults.w / 2 : 0));
      const y = Math.round(ctx.wy - origin.y - (centred ? defaults.h / 2 : 14));
      let id = null;
      editor.commit(`Add ${def.label.toLowerCase()}`, (tx) => {
        const record = editor.newRecord(type, { x, y }, { parent: current.parent, tx });
        tx.create(record);
        id = record.id;
        if (type === 'frame') adopt(tx, id);
      });
      finish(id);
    },

    onCancel() {
      state?.gesture?.cancel();
      state = null;
    },

    onKeyDown(event) {
      if (event.key === 'Escape' && state?.gesture) {
        state.gesture.cancel();
        state = null;
        return true;
      }
      return false;
    },
  };
}
