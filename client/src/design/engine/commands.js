import { keyBetween } from '../core/fractional.js';
import { aabbUnion } from '../core/geometry.js';
import { shapeFor } from '../shapes/registry.js';
import { instantiate, serializeSelection } from './clipboard.js';

/**
 * Everything the board can be asked to do by name — from a shortcut, the
 * context menu, the toolbar or the inspector. Each returns false when it did
 * not apply, so the key handler knows whether to swallow the key.
 */

export function createCommands(editor) {
  const { store, ui } = editor;
  const selection = () => ui.get().selection;

  /** Selected ids without any whose ancestor is also selected — what moves and arranges act on. */
  const topSelection = () => {
    const ids = selection();
    const set = new Set(ids);
    return ids.filter((id) => store.has(id) && !editor.ancestors(id).some((a) => set.has(a)));
  };

  const unlocked = (ids) => ids.filter((id) => !store.get(id)?.data.locked);

  function nudge(dx, dy) {
    const ids = unlocked(topSelection());
    if (!ids.length) return false;
    editor.commit(
      'Nudge',
      (tx) => {
        for (const id of ids) {
          const record = tx.get(id);
          if (record.type === 'connector') {
            const data = {};
            for (const key of ['start', 'end']) {
              if (record.data[key]?.point) data[key] = { point: [record.data[key].point[0] + dx, record.data[key].point[1] + dy] };
            }
            tx.update(id, { data });
          } else {
            tx.update(id, { data: { x: (record.data.x || 0) + dx, y: (record.data.y || 0) + dy } });
          }
        }
      },
      { mergeKey: `nudge:${ids.join(',')}` },
    );
    return true;
  }

  function reorder(mode) {
    const ids = topSelection();
    if (!ids.length) return false;
    editor.commit(`Reorder`, (tx) => {
      const byParent = new Map();
      for (const id of ids) {
        const parent = tx.get(id).parent ?? null;
        if (!byParent.has(parent)) byParent.set(parent, []);
        byParent.get(parent).push(id);
      }
      for (const [parent, moving] of byParent) {
        const siblings = tx.childIds(parent);
        const movingSet = new Set(moving);
        if (mode === 'front' || mode === 'back') {
          const rest = siblings.filter((id) => !movingSet.has(id));
          const ordered = siblings.filter((id) => movingSet.has(id));
          let anchor = mode === 'front' ? tx.get(rest.at(-1))?.z ?? null : null;
          const ceiling = mode === 'back' ? tx.get(rest[0])?.z ?? null : null;
          for (const id of ordered) {
            const z = keyBetween(anchor, ceiling);
            tx.update(id, { z });
            anchor = z;
          }
        } else {
          // One step: past the next sibling that is not itself moving.
          const list = mode === 'forward' ? [...moving].reverse() : moving;
          for (const id of list) {
            const current = tx.childIds(parent);
            const index = current.indexOf(id);
            const step = mode === 'forward' ? 1 : -1;
            let j = index + step;
            while (current[j] && movingSet.has(current[j])) j += step;
            if (!current[j]) continue;
            const neighbour = tx.get(current[j]);
            const beyond = current[j + step] ? tx.get(current[j + step]) : null;
            const z = mode === 'forward' ? keyBetween(neighbour.z, beyond?.z ?? null) : keyBetween(beyond?.z ?? null, neighbour.z);
            tx.update(id, { z });
          }
        }
      }
    });
    return true;
  }

  function align(mode) {
    const ids = unlocked(topSelection()).filter((id) => store.get(id).type !== 'connector');
    if (ids.length < 2) return false;
    const bounds = ids.map((id) => ({ id, b: editor.boundsOf(id) }));
    const all = aabbUnion(bounds.map((x) => x.b));
    editor.commit('Align', (tx) => {
      for (const { id, b } of bounds) {
        let dx = 0;
        let dy = 0;
        if (mode === 'left') dx = all.minX - b.minX;
        if (mode === 'right') dx = all.maxX - b.maxX;
        if (mode === 'centerH') dx = (all.minX + all.maxX) / 2 - (b.minX + b.maxX) / 2;
        if (mode === 'top') dy = all.minY - b.minY;
        if (mode === 'bottom') dy = all.maxY - b.maxY;
        if (mode === 'centerV') dy = (all.minY + all.maxY) / 2 - (b.minY + b.maxY) / 2;
        const record = tx.get(id);
        if (dx || dy) tx.update(id, { data: { x: Math.round((record.data.x || 0) + dx), y: Math.round((record.data.y || 0) + dy) } });
      }
    });
    return true;
  }

  function distribute(axis) {
    const ids = unlocked(topSelection()).filter((id) => store.get(id).type !== 'connector');
    if (ids.length < 3) return false;
    const items = ids.map((id) => ({ id, b: editor.boundsOf(id) }));
    const lo = axis === 'x' ? 'minX' : 'minY';
    const hi = axis === 'x' ? 'maxX' : 'maxY';
    items.sort((p, q) => p.b[lo] - q.b[lo]);
    const total = items.reduce((sum, it) => sum + (it.b[hi] - it.b[lo]), 0);
    const span = items.at(-1).b[hi] - items[0].b[lo];
    const gap = (span - total) / (items.length - 1);
    editor.commit('Distribute', (tx) => {
      let cursor = items[0].b[hi] + gap;
      for (const it of items.slice(1, -1)) {
        const delta = cursor - it.b[lo];
        const record = tx.get(it.id);
        const key = axis === 'x' ? 'x' : 'y';
        tx.update(it.id, { data: { [key]: Math.round((record.data[key] || 0) + delta) } });
        cursor += it.b[hi] - it.b[lo] + gap;
      }
    });
    return true;
  }

  function duplicate() {
    const ids = topSelection();
    if (!ids.length) return false;
    const payload = serializeSelection(editor, ids);
    const parents = new Set(ids.map((id) => store.get(id).parent ?? null));
    const parent = parents.size === 1 ? [...parents][0] : null;
    const origin = editor.worldOrigin(parent);
    let created = [];
    editor.commit('Duplicate', (tx) => {
      const { records, topIds } = instantiate(payload, {
        offsetX: 24 - origin.x,
        offsetY: 24 - origin.y,
        parent,
        zAfter: tx.get(tx.childIds(parent).at(-1))?.z ?? null,
      });
      for (const record of records) tx.create(record);
      created = topIds;
    });
    editor.select(created);
    return true;
  }

  function remove() {
    const ids = unlocked(topSelection());
    if (!ids.length) return false;
    editor.commit('Delete', (tx) => ids.forEach((id) => tx.remove(id)), { selectAfter: [] });
    return true;
  }

  function frameSelection() {
    const ids = unlocked(topSelection()).filter((id) => store.get(id).type !== 'connector');
    if (!ids.length) return false;
    const bounds = aabbUnion(ids.map((id) => editor.boundsOf(id)));
    const pad = 32;
    const parents = new Set(ids.map((id) => store.get(id).parent ?? null));
    const parent = parents.size === 1 ? [...parents][0] : null;
    const origin = editor.worldOrigin(parent);
    let frameId = null;
    editor.commit('Frame selection', (tx) => {
      const frame = editor.newRecord(
        'frame',
        {
          x: Math.round(bounds.minX - pad - origin.x),
          y: Math.round(bounds.minY - pad - origin.y),
          w: Math.round(bounds.maxX - bounds.minX + pad * 2),
          h: Math.round(bounds.maxY - bounds.minY + pad * 2),
        },
        { parent, tx },
      );
      // Below the elements it wraps, where they were.
      const firstZ = ids.map((id) => tx.get(id).z).sort()[0];
      const siblings = tx.childIds(parent);
      const index = siblings.findIndex((id) => tx.get(id).z === firstZ);
      frame.z = keyBetween(index > 0 ? tx.get(siblings[index - 1]).z : null, firstZ);
      tx.create(frame);
      frameId = frame.id;
      for (const id of ids) editor.reparent(tx, id, frameId);
    });
    editor.select([frameId]);
    return true;
  }

  function unframe() {
    const frames = topSelection().filter((id) => store.get(id).type === 'frame');
    if (!frames.length) return false;
    const released = [];
    editor.commit('Remove frame', (tx) => {
      for (const frameId of frames) {
        const frame = tx.get(frameId);
        for (const child of tx.childIds(frameId)) {
          editor.reparent(tx, child, frame.parent ?? null);
          released.push(child);
        }
        tx.drop(frameId);
      }
    });
    editor.select(released);
    return true;
  }

  function toggleLock() {
    const ids = topSelection();
    if (!ids.length) return false;
    const lock = ids.some((id) => !store.get(id).data.locked);
    editor.commit(lock ? 'Lock' : 'Unlock', (tx) => ids.forEach((id) => tx.update(id, { data: { locked: lock || undefined } })));
    return true;
  }

  function setOpacity(value) {
    const ids = topSelection();
    if (!ids.length) return false;
    editor.commit('Opacity', (tx) => ids.forEach((id) => tx.update(id, { data: { opacity: value >= 1 ? undefined : value } })));
    return true;
  }

  const tool = (name) => () => {
    editor.setTool(name);
    return true;
  };

  const commands = {
    toolSelect: tool('select'),
    toolHand: tool('hand'),
    toolFrame: tool('frame'),
    toolRect: tool('rect'),
    toolEllipse: tool('ellipse'),
    toolDiamond: tool('diamond'),
    toolCylinder: tool('cylinder'),
    toolConnector: tool('connector'),
    toolPen: tool('pen'),
    toolHighlighter: tool('highlighter'),
    toolEraser: tool('eraser'),
    toolText: tool('text'),
    toolParagraph: tool('paragraph'),
    toolSticky: tool('sticky'),
    toolLock: () => {
      ui.set({ toolLocked: !ui.get().toolLocked });
      return true;
    },

    undo: () => editor.undo(),
    redo: () => editor.redo(),
    duplicate,
    delete: remove,
    selectAll() {
      const { editingId } = ui.get();
      if (editingId) return false;
      // Within the frame the current selection lives in, like Figma; the whole board otherwise.
      const first = store.get(selection()[0]);
      editor.select(store.childIds(first?.parent ?? null));
      return true;
    },
    escape() {
      const state = ui.get();
      if (state.contextMenu) ui.set({ contextMenu: null });
      else if (state.tool !== 'select') editor.setTool('select');
      else if (state.selection.length) {
        // Up one level first: from a child to its frame, then to nothing.
        const parent = store.get(state.selection[0])?.parent;
        editor.select(parent && state.selection.length === 1 ? [parent] : []);
      } else return false;
      return true;
    },
    editText() {
      const ids = selection();
      if (ids.length !== 1) return false;
      const record = store.get(ids[0]);
      if (!record || record.data.locked || !shapeFor(record.type).caps.text) return false;
      ui.set({ editingId: record.id });
      return true;
    },
    save: () => {
      editor.flushSave();
      return true;
    },

    nudgeUp: () => nudge(0, -1),
    nudgeDown: () => nudge(0, 1),
    nudgeLeft: () => nudge(-1, 0),
    nudgeRight: () => nudge(1, 0),
    nudgeUpBig: () => nudge(0, -10),
    nudgeDownBig: () => nudge(0, 10),
    nudgeLeftBig: () => nudge(-10, 0),
    nudgeRightBig: () => nudge(10, 0),

    bringForward: () => reorder('forward'),
    sendBackward: () => reorder('backward'),
    bringToFront: () => reorder('front'),
    sendToBack: () => reorder('back'),

    frameSelection,
    unframe,
    toggleLock,

    alignLeft: () => align('left'),
    alignRight: () => align('right'),
    alignTop: () => align('top'),
    alignBottom: () => align('bottom'),
    alignCenterH: () => align('centerH'),
    alignCenterV: () => align('centerV'),
    distributeH: () => distribute('x'),
    distributeV: () => distribute('y'),

    zoomIn: () => (editor.zoomBy(1), true),
    zoomOut: () => (editor.zoomBy(-1), true),
    zoom100: () => (editor.zoomTo(1), true),
    zoomFit: () => (editor.zoomToFit(), true),
    zoomSelection: () => (editor.zoomToSelection(), true),
    shortcuts: () => (editor.openShortcuts(), true),
  };

  for (let digit = 0; digit <= 9; digit += 1) {
    commands[`opacity${digit}`] = () => setOpacity(digit === 0 ? 1 : digit / 10);
  }

  return commands;
}
