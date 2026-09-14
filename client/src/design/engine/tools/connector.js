import { shapeFor } from '../../shapes/registry.js';
import { worldToScreen } from '../camera.js';
import { SIDES, sidePoint } from '../connectors/route.js';

/**
 * The connector tool: drag from one shape to another.
 *
 * Hovering a shape shows where an arrow would attach — its four side anchors,
 * or anywhere on it for "whichever side is best". Release over a shape to bind
 * the end to it; over another connector to attach at that point on its line
 * (and follow it when it moves); on empty canvas to leave that end free. Hold
 * ⌘/Ctrl to refuse binding and place the end exactly.
 */

const DRAG_PX = 4;
const SIDE_PX = 16;

export function createConnectorTool(editor) {
  const { store, ui } = editor;
  let state = null;

  function bindingAt(ctx, excludeId) {
    if (ctx.mod) return null;
    const target = editor.hitTest(ctx.wx, ctx.wy, {
      filter: (r) => r.id !== excludeId && r.type !== 'connector' && r.type !== 'stroke' && shapeFor(r.type).caps.bindable,
    });
    if (!target) return editor.lineBindingAt(ctx.wx, ctx.wy, excludeId);
    const box = editor.worldBox(target);
    let anchor = 'auto';
    for (const side of SIDES) {
      const [px, py] = sidePoint(box, side);
      const s = worldToScreen(editor.camera, px, py);
      if (Math.hypot(ctx.sx - s.x, ctx.sy - s.y) <= SIDE_PX) anchor = side;
    }
    return { eid: target, anchor };
  }

  const endFor = (ctx, binding) => binding || { point: [Math.round(ctx.wx), Math.round(ctx.wy)] };

  return {
    id: 'connector',
    cursor: 'crosshair',

    onHover(ctx) {
      ui.set({ bindTarget: bindingAt(ctx) });
    },

    onPointerDown(ctx) {
      const binding = bindingAt(ctx);
      state = { start: ctx, startEnd: endFor(ctx, binding), gesture: null, id: null };
    },

    onPointerMove(ctx) {
      if (!state) return;
      if (!state.gesture) {
        if (Math.hypot(ctx.sx - state.start.sx, ctx.sy - state.start.sy) < DRAG_PX) return;
        state.gesture = store.beginGesture({ label: 'Add connector', selectionBefore: ui.get().selection });
        state.gesture.frame((tx) => {
          const record = editor.newRecord('connector', { start: state.startEnd, end: endFor(ctx, null) }, { parent: null, tx });
          tx.create(record);
          state.id = record.id;
        });
      }
      const binding = bindingAt(ctx, state.id);
      state.gesture.frame((tx) => tx.update(state.id, { data: { end: endFor(ctx, binding) } }));
      ui.set({ bindTarget: binding });
    },

    onPointerUp(ctx) {
      if (!state) return;
      const current = state;
      state = null;
      ui.set({ bindTarget: null });
      if (!current.gesture) return;
      const record = store.get(current.id);
      const { start, end } = record?.data || {};
      const degenerate = ctx.cancelled || (start?.eid && start.eid === end?.eid && start.anchor === end.anchor);
      if (degenerate) {
        current.gesture.cancel();
        return;
      }
      current.gesture.frame((tx) => editor.settleConnectors(tx, [current.id]));
      current.gesture.commit({ selectionAfter: [current.id] });
      editor.select([current.id]);
      if (!ui.get().toolLocked) editor.setTool('select');
    },

    onCancel() {
      state?.gesture?.cancel();
      state = null;
      ui.set({ bindTarget: null });
    },

    onExit() {
      ui.set({ bindTarget: null });
    },

    onKeyDown(event) {
      if (event.key === 'Escape' && state?.gesture) {
        state.gesture.cancel();
        state = null;
        ui.set({ bindTarget: null });
        return true;
      }
      return false;
    },
  };
}
