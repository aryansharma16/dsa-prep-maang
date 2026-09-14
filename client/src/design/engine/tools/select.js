import { aabbUnion, rotatePoint, snapAngle, toBoxLocal } from '../../core/geometry.js';
import { shapeFor } from '../../shapes/registry.js';
import { worldToScreen } from '../camera.js';
import { instantiate, serializeSelection } from '../clipboard.js';
import { cursorForHandle, handleAt, selectionFrame } from '../handles.js';
import { buildSnapTargets, snapMove, snapResize } from '../snapping.js';
import { SIDES, sidePoint } from '../connectors/route.js';
import { measureTextBox } from '../../text/measure.js';

/**
 * The select tool: click, shift-click, marquee, move, resize, rotate, and
 * dragging a connector's ends.
 *
 * A small state machine. Pointer-down only decides what the pointer is on
 * (`pointing-*`); nothing moves until the pointer has travelled a few pixels,
 * so a click never nudges a shape. Every drag runs inside one store gesture —
 * drawn live, one undo step, one save — and Escape cancels it back to where it
 * started.
 */

const DRAG_PX = { mouse: 3, pen: 5, touch: 6 };
const SNAP_PX = 6;
const BIND_SIDE_PX = 16;

export function createSelectTool(editor) {
  const { store, ui } = editor;
  let state = { mode: 'idle' };

  const setInteraction = (interaction) => ui.set({ interaction });

  const topSelection = () => {
    const ids = ui.get().selection;
    const set = new Set(ids);
    return ids.filter((id) => store.has(id) && !editor.ancestors(id).some((a) => set.has(a)));
  };

  const moved = (ctx) =>
    state.start && Math.hypot(ctx.sx - state.start.sx, ctx.sy - state.start.sy) >= (DRAG_PX[ctx.pointerType] || 3);

  function descendantsOf(id) {
    const out = [];
    const stack = [...store.childIds(id)];
    while (stack.length) {
      const child = stack.pop();
      out.push(child);
      stack.push(...store.childIds(child));
    }
    return out;
  }

  /* ------------------------------------------------------------ hover */

  function onHover(ctx) {
    const frame = ui.get().readOnly ? null : selectionFrame(editor);
    const handle = frame ? handleAt(frame, editor.camera, ctx.sx, ctx.sy) : null;
    if (handle) {
      editor.updateCursor(cursorForHandle(handle, frame.box?.rot || 0));
      if (ui.get().hovered) ui.set({ hovered: null });
      return;
    }
    const hit = editor.hitTest(ctx.wx, ctx.wy);
    if (ui.get().hovered !== hit) ui.set({ hovered: hit });
    editor.updateCursor();
  }

  /* ------------------------------------------------------------ down */

  function onPointerDown(ctx) {
    const { readOnly, selection } = ui.get();
    if (ui.get().editingId) ui.set({ editingId: null });

    const frame = readOnly ? null : selectionFrame(editor);
    const handle = frame ? handleAt(frame, editor.camera, ctx.sx, ctx.sy) : null;
    if (handle) {
      state = { mode: 'pointing-handle', handle, frame, start: ctx };
      return;
    }

    const hit = editor.hitTest(ctx.wx, ctx.wy);
    if (hit) {
      const wasSelected = selection.includes(hit);
      if (ctx.shift) editor.select(wasSelected ? selection.filter((id) => id !== hit) : [...selection, hit]);
      else if (!wasSelected) editor.select([hit]);
      state = { mode: 'pointing-element', hit, wasSelected, start: ctx };
      return;
    }

    if (!ctx.shift) editor.select([]);
    state = { mode: 'pointing-canvas', start: ctx, base: ctx.shift ? selection : [] };
  }

  /* ------------------------------------------------------------ move */

  function snapTargetsExcluding(exclude) {
    const visible = editor.queryRect(editor.visibleWorld());
    const bounds = [];
    for (const id of visible) {
      if (exclude.has(id)) continue;
      const record = store.get(id);
      if (!record || record.type === 'connector' || !shapeFor(record.type).caps.snaps) continue;
      if (editor.ancestors(id).some((a) => exclude.has(a))) continue;
      bounds.push(editor.boundsOf(record));
    }
    return buildSnapTargets(bounds);
  }

  function startTranslate(ctx) {
    if (ui.get().readOnly) {
      state = { mode: 'idle' };
      return;
    }
    let ids = topSelection().filter((id) => !store.get(id)?.data.locked);
    if (!ids.length) {
      state = { mode: 'idle' };
      return;
    }

    const gesture = store.beginGesture({ label: ctx.alt ? 'Duplicate' : 'Move', selectionBefore: ui.get().selection });

    if (ctx.alt) {
      // Alt-drag leaves the originals where they are and moves copies.
      const payload = serializeSelection(editor, ids);
      const parents = new Set(ids.map((id) => store.get(id).parent ?? null));
      const parent = parents.size === 1 ? [...parents][0] : null;
      const origin = editor.worldOrigin(parent);
      let created = [];
      gesture.frame((tx) => {
        const { records, topIds } = instantiate(payload, {
          offsetX: -origin.x,
          offsetY: -origin.y,
          parent,
          zAfter: tx.get(tx.childIds(parent).at(-1))?.z ?? null,
        });
        for (const record of records) tx.create(record);
        created = topIds;
      });
      ids = created;
      editor.select(ids);
    }

    const originals = new Map(ids.map((id) => [id, store.get(id)]));
    // Connectors inside moving frames whose ends are free points must travel too.
    for (const id of ids) {
      if (store.get(id).type !== 'frame') continue;
      for (const child of descendantsOf(id)) {
        const record = store.get(child);
        if (record?.type === 'connector') originals.set(child, record);
      }
    }
    const exclude = new Set(ids);
    state = {
      mode: 'translating',
      gesture,
      ids,
      originals,
      start: state.start,
      startBounds: aabbUnion(ids.map((id) => editor.boundsOf(id))),
      targets: snapTargetsExcluding(exclude),
      exclude,
    };
    setInteraction('translating');
    ui.set({ hovered: null });
    translate(ctx);
  }

  function translate(ctx) {
    let dx = ctx.wx - state.start.wx;
    let dy = ctx.wy - state.start.wy;
    if (ctx.shift) {
      if (Math.abs(dx) > Math.abs(dy)) dy = 0;
      else dx = 0;
    }
    let lines = [];
    if (!ctx.mod && state.startBounds) {
      const b = state.startBounds;
      const snap = snapMove(state.targets, { minX: b.minX + dx, minY: b.minY + dy, maxX: b.maxX + dx, maxY: b.maxY + dy }, SNAP_PX / editor.camera.z);
      if (!ctx.shift || dy === 0) dx += snap.dx;
      if (!ctx.shift || dx === 0) dy += snap.dy;
      lines = snap.lines;
    }
    state.dx = dx;
    state.dy = dy;
    state.gesture.frame((tx) => {
      for (const [id, original] of state.originals) {
        if (original.type === 'connector') {
          const data = {};
          for (const key of ['start', 'end']) {
            const end = original.data[key];
            if (end?.point) data[key] = { point: [end.point[0] + dx, end.point[1] + dy] };
          }
          if (Object.keys(data).length) tx.update(id, { data });
        } else if (state.ids.includes(id)) {
          tx.update(id, { data: { x: (original.data.x || 0) + dx, y: (original.data.y || 0) + dy } });
        }
      }
    });
    const dropTarget = editor.frameAt(ctx.wx, ctx.wy, state.exclude);
    ui.set({ snapLines: lines, dropTarget });
  }

  function finishTranslate() {
    const { dropTarget } = ui.get();
    state.gesture.frame((tx) => {
      for (const id of state.ids) {
        const record = tx.get(id);
        if (!record || record.type === 'connector') continue;
        tx.update(id, { data: { x: Math.round(record.data.x || 0), y: Math.round(record.data.y || 0) } });
        if ((record.parent ?? null) !== (dropTarget ?? null)) editor.reparent(tx, id, dropTarget ?? null);
      }
    });
    state.gesture.commit({ selectionAfter: state.ids });
  }

  /* ------------------------------------------------------------ resize */

  function startHandle(ctx) {
    const { handle, frame } = state;
    if (handle === 'start' || handle === 'end') {
      const record = frame.record;
      state = {
        mode: 'dragging-end',
        which: handle,
        record,
        gesture: store.beginGesture({ label: 'Reconnect', selectionBefore: ui.get().selection }),
        start: state.start,
      };
      setInteraction('dragging-end');
      dragEnd(ctx);
      return;
    }

    if (handle.startsWith('rotate')) {
      const box = frame.box;
      const cx = box.x + box.w / 2;
      const cy = box.y + box.h / 2;
      state = {
        mode: 'rotating',
        record: frame.record,
        center: [cx, cy],
        startAngle: Math.atan2(state.start.wy - cy, state.start.wx - cx),
        rot0: frame.record.data.rot || 0,
        gesture: store.beginGesture({ label: 'Rotate', selectionBefore: ui.get().selection }),
        start: state.start,
      };
      setInteraction('rotating');
      rotate(ctx);
      return;
    }

    const records = frame.kind === 'single' ? [frame.record] : frame.records.filter((r) => topSelection().includes(r.id));
    const exclude = new Set(records.map((r) => r.id));
    state = {
      mode: 'resizing',
      handle,
      frame,
      box0: { ...frame.box },
      originals: new Map(records.map((r) => [r.id, { record: r, box: editor.worldBox(r), bounds: editor.boundsOf(r), children: r.type === 'frame' ? store.childIds(r.id).map((c) => store.get(c)) : [] }])),
      gesture: store.beginGesture({ label: 'Resize', selectionBefore: ui.get().selection }),
      targets: snapTargetsExcluding(exclude),
      start: state.start,
    };
    setInteraction('resizing');
    resize(ctx);
  }

  function resize(ctx) {
    const { handle, box0, frame } = state;
    const single = frame.kind === 'single';
    const def = single ? shapeFor(frame.record.type) : null;
    const local = single ? toBoxLocal(ctx.wx, ctx.wy, box0.x, box0.y, box0.w, box0.h, box0.rot) : { x: ctx.wx - box0.x, y: ctx.wy - box0.y };
    const has = (c) => handle.includes(c);
    const corner = handle.length === 2;
    const minW = def?.minW ?? 8;
    const minH = def?.minH ?? 8;

    let l = 0;
    let t = 0;
    let r = box0.w;
    let b = box0.h;
    if (has('w')) l = local.x;
    if (has('e')) r = local.x;
    if (has('n')) t = local.y;
    if (has('s')) b = local.y;
    if (ctx.alt) {
      if (has('w')) r = box0.w - l;
      if (has('e')) l = box0.w - r;
      if (has('n')) b = box0.h - t;
      if (has('s')) t = box0.h - b;
    }

    // Snap the moving edges (unrotated only — a rotated box has no edge to line up).
    let lines = [];
    if (!ctx.mod && !box0.rot) {
      const bounds = { minX: box0.x + l, maxX: box0.x + r, minY: box0.y + t, maxY: box0.y + b };
      const snap = snapResize(state.targets, bounds, { left: has('w'), right: has('e'), top: has('n'), bottom: has('s') }, SNAP_PX / editor.camera.z);
      l += snap.left;
      r += snap.right;
      t += snap.top;
      b += snap.bottom;
      lines = snap.lines;
    }

    const aspect = (ctx.shift || def?.caps.resize === 'aspect') && box0.w > 0 && box0.h > 0;
    if (aspect) {
      const ratio = box0.w / box0.h;
      let w = Math.abs(r - l);
      let h = Math.abs(b - t);
      if (corner) {
        if (w / box0.w > h / box0.h) h = w / ratio;
        else w = h * ratio;
      } else if (has('e') || has('w')) h = w / ratio;
      else w = h * ratio;
      if (has('w')) l = r - w;
      else if (has('e')) r = l + w;
      else {
        l = (box0.w - w) / 2;
        r = l + w;
      }
      if (has('n')) t = b - h;
      else if (has('s')) b = t + h;
      else {
        t = (box0.h - h) / 2;
        b = t + h;
      }
    }

    if (r - l < minW) {
      if (has('w')) l = r - minW;
      else r = l + minW;
    }
    if (b - t < minH) {
      if (has('n')) t = b - minH;
      else b = t + minH;
    }

    const w = r - l;
    const h = b - t;
    // The new centre, back in world space along the box's own axes.
    const center = rotatePoint(box0.x + (l + r) / 2, box0.y + (t + b) / 2, box0.x + box0.w / 2, box0.y + box0.h / 2, box0.rot || 0);
    const nx = center.x - w / 2;
    const ny = center.y - h / 2;
    const sx = w / (box0.w || 1);
    const sy = h / (box0.h || 1);

    state.gesture.frame((tx) => {
      for (const [id, o] of state.originals) {
        const record = o.record;
        const origin = editor.worldOrigin(record.parent);
        if (record.type === 'connector') {
          const data = {};
          for (const key of ['start', 'end']) {
            const end = record.data[key];
            if (end?.point) data[key] = { point: [nx + (end.point[0] - box0.x) * sx, ny + (end.point[1] - box0.y) * sy] };
          }
          tx.update(id, { data });
          continue;
        }
        let box;
        if (single) box = { x: nx, y: ny, w, h };
        else {
          box = {
            x: nx + (o.box.x - box0.x) * sx,
            y: ny + (o.box.y - box0.y) * sy,
            w: Math.max(1, o.box.w * sx),
            h: Math.max(1, o.box.h * sy),
          };
        }
        const patch = { x: box.x - origin.x, y: box.y - origin.y, w: box.w, h: box.h };

        if (record.type === 'stroke') {
          const kx = box.w / (o.box.w || 1);
          const ky = box.h / (o.box.h || 1);
          const pts = record.data.points || [];
          const next = new Array(pts.length);
          for (let i = 0; i < pts.length; i += 3) {
            next[i] = Math.round(pts[i] * kx * 100) / 100;
            next[i + 1] = Math.round(pts[i + 1] * ky * 100) / 100;
            next[i + 2] = pts[i + 2];
          }
          patch.points = next;
        }
        if (shapeFor(record.type).caps.resize === 'width' && record.data.text !== undefined) {
          patch.autoWidth = undefined;
          patch.h = measureTextBox(record, box.w).h;
        }
        tx.update(id, { data: patch });

        // A frame's children keep their place on screen while its top-left moves.
        if (record.type === 'frame' && o.children.length) {
          const shiftX = box.x - o.box.x;
          const shiftY = box.y - o.box.y;
          if (shiftX || shiftY) {
            for (const child of o.children) {
              if (!child || child.type === 'connector') continue;
              tx.update(child.id, { data: { x: (child.data.x || 0) - shiftX, y: (child.data.y || 0) - shiftY } });
            }
          }
        }
      }
    });
    ui.set({ snapLines: lines });
  }

  function finishResize() {
    state.gesture.frame((tx) => {
      for (const id of state.originals.keys()) {
        const record = tx.get(id);
        if (!record || record.type === 'connector' || record.type === 'stroke') continue;
        const round = (v) => (v === undefined ? undefined : Math.round(v));
        tx.update(id, { data: { x: round(record.data.x), y: round(record.data.y), w: round(record.data.w), h: round(record.data.h) } });
      }
    });
    state.gesture.commit();
  }

  /* ------------------------------------------------------------ rotate */

  function rotate(ctx) {
    const [cx, cy] = state.center;
    let rot = state.rot0 + Math.atan2(ctx.wy - cy, ctx.wx - cx) - state.startAngle;
    if (ctx.shift) rot = snapAngle(rot, Math.PI / 12);
    const full = Math.PI * 2;
    rot = ((rot % full) + full) % full;
    if (Math.abs(rot) < 1e-3 || Math.abs(rot - full) < 1e-3) rot = undefined;
    state.gesture.frame((tx) => tx.update(state.record.id, { data: { rot } }));
    editor.updateCursor('grabbing');
  }

  /* ------------------------------------------------------------ connector ends */

  function bindingAt(ctx, excludeId) {
    const target = editor.hitTest(ctx.wx, ctx.wy, {
      filter: (r) => r.id !== excludeId && r.type !== 'connector' && r.type !== 'stroke' && shapeFor(r.type).caps.bindable,
    });
    if (!target) return null;
    const box = editor.worldBox(target);
    let anchor = 'auto';
    for (const side of SIDES) {
      const [px, py] = sidePoint(box, side);
      const s = worldToScreen(editor.camera, px, py);
      if (Math.hypot(ctx.sx - s.x, ctx.sy - s.y) <= BIND_SIDE_PX) anchor = side;
    }
    return { eid: target, anchor };
  }

  function dragEnd(ctx) {
    const binding = ctx.mod ? null : bindingAt(ctx, state.record.id);
    const end = binding || { point: [Math.round(ctx.wx), Math.round(ctx.wy)] };
    state.gesture.frame((tx) => tx.update(state.record.id, { data: { [state.which]: end } }));
    ui.set({ bindTarget: binding });
  }

  /* ------------------------------------------------------------ marquee */

  function brush(ctx) {
    const s = state.start;
    const rect = {
      minX: Math.min(s.wx, ctx.wx),
      minY: Math.min(s.wy, ctx.wy),
      maxX: Math.max(s.wx, ctx.wx),
      maxY: Math.max(s.wy, ctx.wy),
    };
    const hits = editor.queryRect(rect).filter((id) => !store.get(id)?.data.locked);
    const set = new Set(hits);
    const roots = hits.filter((id) => !editor.ancestors(id).some((a) => set.has(a)));
    editor.select([...new Set([...state.base, ...roots])]);
    ui.set({ marquee: rect });
  }

  /* ------------------------------------------------------------ dispatch */

  function onPointerMove(ctx) {
    switch (state.mode) {
      case 'pointing-element':
        if (moved(ctx)) startTranslate(ctx);
        break;
      case 'pointing-handle':
        if (moved(ctx)) startHandle(ctx);
        break;
      case 'pointing-canvas':
        if (moved(ctx)) {
          state.mode = 'brushing';
          setInteraction('brushing');
          brush(ctx);
        }
        break;
      case 'translating':
        translate(ctx);
        break;
      case 'resizing':
        resize(ctx);
        break;
      case 'rotating':
        rotate(ctx);
        break;
      case 'dragging-end':
        dragEnd(ctx);
        break;
      case 'brushing':
        brush(ctx);
        break;
      default:
        onHover(ctx);
    }
  }

  function clearTransient() {
    ui.set({ snapLines: [], dropTarget: null, bindTarget: null, marquee: null, interaction: 'idle' });
    editor.updateCursor();
  }

  function onPointerUp(ctx) {
    switch (state.mode) {
      case 'pointing-element':
        // A plain click on one member of a multi-selection narrows to it — on release, so dragging the group still works.
        if (!ctx.shift && state.wasSelected && ui.get().selection.length > 1) editor.select([state.hit]);
        break;
      case 'translating':
        finishTranslate();
        break;
      case 'resizing':
        finishResize();
        break;
      case 'rotating':
      case 'dragging-end':
        state.gesture.commit();
        break;
      default:
        break;
    }
    state = { mode: 'idle' };
    clearTransient();
  }

  function cancel() {
    state.gesture?.cancel();
    state = { mode: 'idle' };
    clearTransient();
  }

  function onDoubleClick(ctx) {
    if (ui.get().readOnly) return;
    const hit = editor.hitTest(ctx.wx, ctx.wy);
    if (hit) {
      const record = store.get(hit);
      if (shapeFor(record.type).caps.text && !record.data.locked) {
        editor.select([hit]);
        ui.set({ editingId: hit });
      }
      return;
    }
    // Double-click on empty canvas: start typing there, the way FigJam does.
    const parent = editor.frameAt(ctx.wx, ctx.wy);
    const origin = editor.worldOrigin(parent);
    let id = null;
    editor.commit('Add text', (tx) => {
      const record = editor.newRecord('text', { x: Math.round(ctx.wx - origin.x), y: Math.round(ctx.wy - origin.y - 14) }, { parent, tx });
      tx.create(record);
      id = record.id;
    });
    if (id) {
      editor.select([id]);
      ui.set({ editingId: id });
    }
  }

  return {
    id: 'select',
    cursor: 'default',
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onHover,
    onDoubleClick,
    onCancel: cancel,
    onKeyDown(event) {
      if (event.key === 'Escape' && state.mode !== 'idle') {
        cancel();
        return true;
      }
      return false;
    },
    onExit: cancel,
  };
}
