import { isAnyModalOpen } from '../../components/ui/useDialog.js';
import { keyBetween } from '../core/fractional.js';
import {
  aabbContainsPoint,
  aabbIntersects,
  aabbUnion,
  closestOnPolyline,
  distToPolyline,
  pointAlongPolyline,
  rotatedBounds,
  toBoxLocal,
} from '../core/geometry.js';
import { newId } from '../core/ids.js';
import { createSpatialIndex } from '../core/spatial.js';
import { hitOutline, hitOutlineEdge, isKnownType, shapeFor } from '../shapes/registry.js';
import '../shapes/shapes.js';
import { PEN_SIZES, STROKE_WIDTHS } from '../shapes/shapes.js';
import {
  clampZoom,
  fitBounds,
  screenToWorld,
  snapToDevicePixels,
  stepZoom,
  viewportBounds,
  wheelPixels,
  wheelZoomFactor,
  zoomAt,
  zoomBucket,
} from './camera.js';
import { connectorGeometry, forgetConnector } from './connectors/route.js';
import { opsFromCommit } from './diff.js';
import { createHistory } from './history.js';
import { matchShortcut } from './shortcuts.js';
import { createStore } from './store.js';
import { createTools } from './tools/index.js';
import { createUiState, sameIds } from './uiState.js';

/**
 * One open board: its elements, the camera looking at them, the tools that
 * change them, and the wiring between those and the DOM.
 *
 * Created once per board (BoardEditor keys itself by board id) and attached to
 * the viewport element after mount. Everything React draws reads from here
 * through hooks; nothing here imports React.
 *
 * The rules this file keeps:
 *
 * - **The camera bypasses React.** Pan and zoom write one transform to the
 *   world layer in a requestAnimationFrame. React hears about zoom only when it
 *   crosses a level-of-detail band.
 * - **One store commit per animation frame** during interaction. Pointer events
 *   only record the latest input; the frame callback runs the tool.
 * - **The world layer is promoted only while it moves.** `will-change` and a 3D
 *   transform during a pan or zoom, removed ~150ms after it stops so text is
 *   rasterised again at the new scale and stays sharp.
 * - **Pointer capture lives on the viewport**, never on a shape: a shape's DOM
 *   node can unmount mid-drag (culling, re-parenting) and take the capture with it.
 */

const SETTLE_MS = 150;
/** Records under this parent (a schema board's text) are data, not things on the board. */
const META_PARENT = '__meta';
const DRAG_THRESHOLD = { mouse: 3, pen: 6, touch: 6 };
const FRAME_TITLE_H = 24;

export function createEditor({ boardId, boardKind = 'canvas', readOnly = false, notify = () => {}, onRequestShortcuts } = {}) {
  /* ------------------------------------------------------------ state */

  const bindings = new Map(); // bound eid → Set<connector id>
  const store = createStore({
    sideEffects: {
      beforeDelete(tx, record) {
        for (const childId of tx.childIds(record.id)) tx.remove(childId);
        const connectors = bindings.get(record.id);
        if (!connectors) return;
        for (const connectorId of connectors) {
          const connector = tx.get(connectorId);
          if (!connector) continue;
          // Let go at the point the line currently touches, so the arrow stays where it was drawn.
          const geo = connectorGeo(store.get(connectorId) || connector);
          // Free points are stored relative to the connector's frame, like any child position.
          const origin = worldOrigin(connector.parent, tx);
          const patch = {};
          if (connector.data.start?.eid === record.id) patch.start = { point: [Math.round(geo.start.x - origin.x), Math.round(geo.start.y - origin.y)] };
          if (connector.data.end?.eid === record.id) patch.end = { point: [Math.round(geo.end.x - origin.x), Math.round(geo.end.y - origin.y)] };
          if (Object.keys(patch).length) tx.update(connectorId, { data: patch });
        }
      },
    },
  });

  const ui = createUiState({ readOnly, tool: 'select' });
  const history = createHistory(store, {
    getSelection: () => ui.get().selection,
    setSelection: (ids) => select(ids),
  });

  let camera = { x: 0, y: 0, z: 1 };
  let dom = null; // { root, viewport, world, grid }
  let viewportRect = { left: 0, top: 0, width: 1, height: 1 };
  let movingTimer = 0;
  let cameraFrame = 0;
  let cameraAnimation = null;
  let lastBucket = 'near';
  const cameraListeners = new Set();
  const disposers = [];

  /* ------------------------------------------------------------ bindings index */

  const bindingsOf = (record) => [record?.data?.start?.eid, record?.data?.end?.eid].filter(Boolean);

  const paintCache = { order: null, index: null, indexFor: null };

  /*
    Where things are, for hit-testing, marquee and culling without visiting every
    element. Entries hold each element's world bounds and are refreshed lazily:
    a change marks ids dirty, and the next query recomputes those — plus what a
    change moves along with them (a frame's contents, the connectors attached).
  */
  const spatial = createSpatialIndex(512);
  const spatialDirty = new Set();
  let spatialBuilt = false;

  function ensureSpatial() {
    if (!spatialBuilt) {
      spatial.clear();
      for (const record of store.all()) if (record.parent !== META_PARENT) spatial.set(record.id, boundsOf(record));
      spatialBuilt = true;
      spatialDirty.clear();
      return;
    }
    if (!spatialDirty.size) return;
    const affected = new Set();
    const visit = (id) => {
      if (affected.has(id)) return;
      affected.add(id);
      if (store.get(id)?.type === 'frame') for (const child of store.childIds(id)) visit(child);
      for (const connectorId of bindings.get(id) || []) visit(connectorId);
    };
    for (const id of spatialDirty) visit(id);
    spatialDirty.clear();
    for (const id of affected) {
      const record = store.get(id);
      if (record && record.parent !== META_PARENT) spatial.set(id, boundsOf(record));
      else spatial.remove(id);
    }
  }

  /** id → position in paint order, for sorting spatial candidates. */
  function paintIndex() {
    const order = paintOrder();
    if (paintCache.indexFor !== order) {
      paintCache.index = new Map(order.map((id, i) => [id, i]));
      paintCache.indexFor = order;
    }
    return paintCache.index;
  }

  /*
    Culling. On a big board only elements near the view are mounted: the view
    padded by half a screen each side, plus everything selected or being edited,
    plus the frames those sit in (a frame's children render inside it). React
    hears about it only when that set changes.
  */
  const CULL_FROM = 300;
  let visibleIds = null; // null means "everything"
  let visibleWindow = null;
  let visibilityFrame = 0;
  const visibilityListeners = new Set();

  function scheduleVisibility() {
    if (!visibilityFrame && typeof requestAnimationFrame !== 'undefined') visibilityFrame = requestAnimationFrame(updateVisibility);
  }

  function updateVisibility() {
    visibilityFrame = 0;
    if (!dom || store.size < CULL_FROM) {
      if (visibleIds !== null) {
        visibleIds = null;
        visibleWindow = null;
        for (const fn of visibilityListeners) fn();
      }
      return;
    }
    ensureSpatial();
    const view = visibleWorld();
    const padX = (view.maxX - view.minX) / 2;
    const padY = (view.maxY - view.minY) / 2;
    const area = { minX: view.minX - padX, minY: view.minY - padY, maxX: view.maxX + padX, maxY: view.maxY + padY };
    const next = new Set();
    const keep = (id) => {
      if (next.has(id)) return;
      next.add(id);
      for (const a of ancestors(id)) next.add(a);
    };
    for (const id of spatial.query(area)) keep(id);
    const { selection, editingId } = ui.get();
    for (const id of selection) keep(id);
    if (editingId) keep(editingId);
    visibleWindow = area;
    if (visibleIds && visibleIds.size === next.size && [...next].every((id) => visibleIds.has(id))) return;
    visibleIds = next;
    for (const fn of visibilityListeners) fn();
  }

  /** The camera moved: recompute only once the view nears the edge of the padded window. */
  function checkVisibilityForCamera() {
    if (!visibleWindow) {
      if (store.size >= CULL_FROM) scheduleVisibility();
      return;
    }
    const view = visibleWorld();
    const marginX = (view.maxX - view.minX) / 4;
    const marginY = (view.maxY - view.minY) / 4;
    const inside = view.minX - marginX >= visibleWindow.minX && view.maxX + marginX <= visibleWindow.maxX && view.minY - marginY >= visibleWindow.minY && view.maxY + marginY <= visibleWindow.maxY;
    // Zooming out past the window's size, or in far enough that it is wastefully large, also recomputes.
    const tooBig = visibleWindow.maxX - visibleWindow.minX > (view.maxX - view.minX) * 4;
    if (!inside || tooBig) scheduleVisibility();
  }
  store.onChange((changes) => {
    for (const [id, [before, after]] of changes) {
      if (before?.type === 'connector') {
        for (const eid of bindingsOf(before)) bindings.get(eid)?.delete(id);
      }
      if (after?.type === 'connector') {
        for (const eid of bindingsOf(after)) {
          if (!bindings.has(eid)) bindings.set(eid, new Set());
          bindings.get(eid).add(id);
        }
      }
      if (!after && before?.type === 'connector') forgetConnector(id);
      if (!before || !after || before.parent !== after.parent || before.z !== after.z) paintCache.order = null;
      spatialDirty.add(id);
    }
    bumpGeometry(changes);
    scheduleVisibility();
  });

  /*
    A connector's path depends on records other than its own — the shapes it
    joins, and the frames those shapes sit in. Listeners register interest in a
    set of ids and are told when any of them changes.
  */
  const geometryListeners = new Map();
  function bumpGeometry(changes) {
    if (!geometryListeners.size) return;
    const touched = new Set();
    for (const id of changes.keys()) {
      const set = geometryListeners.get(id);
      if (set) for (const fn of set) touched.add(fn);
    }
    for (const fn of touched) fn();
  }
  function watchGeometry(ids, fn) {
    for (const id of ids) {
      if (!geometryListeners.has(id)) geometryListeners.set(id, new Set());
      geometryListeners.get(id).add(fn);
    }
    return () => {
      for (const id of ids) {
        const set = geometryListeners.get(id);
        set?.delete(fn);
        if (set && !set.size) geometryListeners.delete(id);
      }
    };
  }

  /* ------------------------------------------------------------ geometry */

  function ancestors(id) {
    const out = [];
    let current = store.get(id);
    let guard = 0;
    while (current?.parent && guard < 16) {
      const parent = store.get(current.parent);
      if (!parent) break;
      out.push(parent.id);
      current = parent;
      guard += 1;
    }
    return out;
  }

  /**
   * World position of a parent's origin — where its children's (0, 0) is. Pass the
   * transaction when the parent may have been created or moved inside it: the store
   * does not know about a frame until its transaction commits.
   */
  function worldOrigin(parentId, tx = null) {
    const read = (id) => (tx ? tx.get(id) : store.get(id));
    let x = 0;
    let y = 0;
    let current = parentId ? read(parentId) : null;
    let guard = 0;
    while (current && guard < 16) {
      x += current.data.x || 0;
      y += current.data.y || 0;
      current = current.parent ? read(current.parent) : null;
      guard += 1;
    }
    return { x, y };
  }

  function worldBox(idOrRecord) {
    const record = typeof idOrRecord === 'string' ? store.get(idOrRecord) : idOrRecord;
    if (!record || record.type === 'connector') return null;
    const origin = worldOrigin(record.parent);
    const d = record.data;
    return { x: origin.x + (d.x || 0), y: origin.y + (d.y || 0), w: d.w || 0, h: d.h || 0, rot: d.rot || 0, outline: shapeFor(record.type).outline };
  }

  function lookupBox(eid) {
    const record = store.get(eid);
    if (!record || !shapeFor(record.type).caps.bindable) return null;
    return worldBox(record);
  }

  /** What a connector end is attached to: a shape's world box, or a point `t` of the way along another connector. */
  const resolving = new Set();
  function lookupTarget(eid, end) {
    const record = store.get(eid);
    if (record?.type !== 'connector') return lookupBox(eid);
    // Binding refuses loops, but one could still arrive from elsewhere; that end falls back to a free point.
    if (resolving.has(eid)) return null;
    resolving.add(eid);
    try {
      const geo = connectorGeo(record);
      const at = pointAlongPolyline(geo.points, end?.t ?? 0.5);
      const axis = geo.curve ? null : Math.abs(Math.sin(at.angle)) < 1e-3 ? 'h' : Math.abs(Math.cos(at.angle)) < 1e-3 ? 'v' : null;
      return { point: [at.x, at.y], axis };
    } finally {
      resolving.delete(eid);
    }
  }

  const targetSignature = (t) => (!t ? '' : t.point ? `${t.point[0]},${t.point[1]},${t.axis}` : `${t.x},${t.y},${t.w},${t.h},${t.rot}`);

  const geoCache = new WeakMap();
  function connectorGeo(record) {
    const origin = worldOrigin(record.parent);
    // Free points are relative to the connector's frame; routing works in world space.
    const toWorld = (e) => (e?.point && (origin.x || origin.y) ? { ...e, point: [e.point[0] + origin.x, e.point[1] + origin.y] } : e);
    const startEnd = toWorld(record.data.start);
    const endEnd = toWorld(record.data.end);
    const start = startEnd?.eid ? lookupTarget(startEnd.eid, startEnd) : null;
    const end = endEnd?.eid ? lookupTarget(endEnd.eid, endEnd) : null;
    const signature = `${origin.x},${origin.y}|${targetSignature(start)}|${targetSignature(end)}`;
    const cached = geoCache.get(record);
    if (cached && cached.signature === signature) return cached.geo;
    const world = startEnd === record.data.start && endEnd === record.data.end ? record : { ...record, data: { ...record.data, start: startEnd, end: endEnd } };
    const geo = connectorGeometry(world, (eid, which) => (which === startEnd ? start : which === endEnd ? end : lookupTarget(eid, which)));
    geoCache.set(record, { signature, geo });
    return geo;
  }

  /** A world point as a position inside `parentId` — how free connector points are stored. */
  function toLocalPoint(parentId, wx, wy, tx = null) {
    const origin = worldOrigin(parentId, tx);
    return [Math.round(wx - origin.x), Math.round(wy - origin.y)];
  }

  /**
   * Ids whose changes can move a connector: what its ends attach to and the
   * frames those sit in — and, for an end on another connector, everything that
   * connector depends on in turn.
   */
  function geometryDeps(record) {
    const ids = new Set();
    const visit = (connector) => {
      for (const eid of bindingsOf(connector)) {
        if (ids.has(eid)) continue;
        ids.add(eid);
        for (const a of ancestors(eid)) ids.add(a);
        const target = store.get(eid);
        if (target?.type === 'connector') visit(target);
      }
    };
    visit(record);
    return [...ids];
  }

  /** A connector under a world point that the end of `excludeId` may attach to, as `{ eid, t }`. */
  function lineBindingAt(wx, wy, excludeId) {
    const target = hitTest(wx, wy, { tolerancePx: 8, filter: (r) => r.type === 'connector' && r.id !== excludeId });
    if (!target) return null;
    const record = store.get(target);
    // Attaching to a line that already hangs off this connector would make a loop.
    if (excludeId && geometryDeps(record).includes(excludeId)) return null;
    const { t } = closestOnPolyline(wx, wy, connectorGeo(record).points);
    return { eid: target, t: Math.round(t * 10000) / 10000 };
  }

  /** World bounds of anything on the board. */
  function boundsOf(idOrRecord) {
    const record = typeof idOrRecord === 'string' ? store.get(idOrRecord) : idOrRecord;
    if (!record) return null;
    if (record.type === 'connector') return connectorGeo(record).bounds;
    const box = worldBox(record);
    if (record.type === 'frame') return rotatedBounds(box.x, box.y - FRAME_TITLE_H, box.w, box.h + FRAME_TITLE_H, 0);
    return rotatedBounds(box.x, box.y, box.w, box.h, box.rot);
  }

  function contentBounds(ids) {
    const list = ids || [...store.all()].filter((r) => !r.parent).map((r) => r.id);
    return aabbUnion(list.map(boundsOf));
  }

  /** Every element in paint order, bottom first: siblings by z, a frame's children just above the frame. */
  function paintOrder() {
    if (paintCache.order) return paintCache.order;
    const out = [];
    const walk = (parent) => {
      for (const id of store.childIds(parent)) {
        out.push(id);
        if (store.get(id)?.type === 'frame') walk(id);
      }
    };
    walk(null);
    paintCache.order = out;
    return out;
  }

  /* ------------------------------------------------------------ hit testing */

  function hitElement(record, wx, wy, tol) {
    const def = shapeFor(record.type);
    if (record.type === 'connector') {
      const geo = connectorGeo(record);
      const width = STROKE_WIDTHS[record.data.strokeWidth] || 2;
      return distToPolyline(wx, wy, geo.points) <= tol + width / 2 + 2;
    }
    const box = worldBox(record);
    if (record.type === 'stroke') {
      if (!aabbContainsPoint({ minX: box.x, minY: box.y, maxX: box.x + box.w, maxY: box.y + box.h }, wx, wy, tol)) return false;
      const points = record.data.points || [];
      const size = PEN_SIZES[record.data.size] || 4;
      const local = [];
      for (let i = 0; i < points.length; i += 3) local.push([box.x + points[i], box.y + points[i + 1]]);
      return distToPolyline(wx, wy, local) <= tol + size / 2;
    }
    const local = toBoxLocal(wx, wy, box.x, box.y, box.w, box.h, box.rot);
    if (record.type === 'frame') {
      const titleH = FRAME_TITLE_H / camera.z;
      // The title is drawn at a constant screen size: about 7px a character plus padding, up to 240px.
      const titleW = Math.min(box.w, Math.min(240, 16 + (record.data.name || 'Frame').length * 7.2) / camera.z);
      const titleHit = local.y >= -titleH && local.y <= 0 && local.x >= 0 && local.x <= titleW;
      return titleHit || hitOutlineEdge('rect', local.x, local.y, box.w, box.h, tol);
    }
    if (!def.caps.hitInterior) return hitOutlineEdge(def.outline, local.x, local.y, box.w, box.h, tol);
    return hitOutline(def.outline, local.x, local.y, box.w, box.h, tol);
  }

  /** False when a clipping frame above the element hides the point. */
  function visibleThroughClip(record, wx, wy) {
    let parentId = record.parent;
    let guard = 0;
    while (parentId && guard < 16) {
      const frame = store.get(parentId);
      if (!frame) break;
      if (frame.data.clip) {
        const box = worldBox(frame);
        if (wx < box.x || wy < box.y || wx > box.x + box.w || wy > box.y + box.h) return false;
      }
      parentId = frame.parent;
      guard += 1;
    }
    return true;
  }

  /** The topmost element under a world point, or null. */
  function hitTest(wx, wy, { filter, tolerancePx = 4 } = {}) {
    const tol = tolerancePx / camera.z;
    ensureSpatial();
    const index = paintIndex();
    // Wide enough for stroke widths and for frame titles, which sit above the box at a constant screen size.
    const margin = tol + 4 + FRAME_TITLE_H / camera.z;
    const candidates = [...spatial.queryPoint(wx, wy, margin)].filter((id) => index.has(id)).sort((a, b) => index.get(b) - index.get(a));
    for (const id of candidates) {
      const record = store.get(id);
      if (!record || (filter && !filter(record))) continue;
      if (hitElement(record, wx, wy, tol) && visibleThroughClip(record, wx, wy)) return record.id;
    }
    return null;
  }

  /** Everything a world rectangle touches (or fully contains, for frames). */
  function queryRect(rect) {
    const hits = [];
    ensureSpatial();
    const index = paintIndex();
    const ids = [...spatial.query(rect)].filter((id) => index.has(id)).sort((a, b) => index.get(a) - index.get(b));
    for (const id of ids) {
      const record = store.get(id);
      const b = spatial.boxOf(id);
      if (!b || !aabbIntersects(rect, b)) continue;
      if (record.type === 'frame') {
        if (b.minX >= rect.minX && b.maxX <= rect.maxX && b.minY >= rect.minY && b.maxY <= rect.maxY) hits.push(id);
        continue;
      }
      hits.push(id);
    }
    return hits;
  }

  /**
   * `frameAt` as a transaction sees the board: frames created or moved in `tx` count,
   * and the deepest containing frame wins (paint order does not know new frames yet).
   */
  function frameAtIn(tx, wx, wy) {
    const candidates = new Set();
    for (const id of paintOrder()) if (store.get(id)?.type === 'frame') candidates.add(id);
    for (const id of tx.changedIds()) if (tx.get(id)?.type === 'frame') candidates.add(id);
    let best = null;
    let bestDepth = -1;
    for (const id of candidates) {
      const frame = tx.get(id);
      if (!frame) continue;
      const origin = worldOrigin(frame.parent, tx);
      const x = origin.x + (frame.data.x || 0);
      const y = origin.y + (frame.data.y || 0);
      if (wx < x || wy < y || wx > x + (frame.data.w || 0) || wy > y + (frame.data.h || 0)) continue;
      let depth = 0;
      for (let p = frame.parent; p && depth < 16; p = tx.get(p)?.parent) depth += 1;
      if (depth >= bestDepth) {
        best = id;
        bestDepth = depth;
      }
    }
    return best;
  }

  /** The deepest frame whose body contains a world point, skipping `exclude` and anything inside it. */
  function frameAt(wx, wy, exclude = new Set()) {
    ensureSpatial();
    const index = paintIndex();
    const candidates = [...spatial.queryPoint(wx, wy, 0)].filter((id) => index.has(id) && store.get(id)?.type === 'frame').sort((a, b) => index.get(b) - index.get(a));
    for (const id of candidates) {
      const record = store.get(id);
      if (record?.type !== 'frame' || exclude.has(record.id)) continue;
      if (ancestors(record.id).some((id) => exclude.has(id))) continue;
      const box = worldBox(record);
      if (wx >= box.x && wx <= box.x + box.w && wy >= box.y && wy <= box.y + box.h) return record.id;
    }
    return null;
  }

  /* ------------------------------------------------------------ selection */

  function select(ids) {
    const unique = [...new Set(ids)].filter((id) => store.has(id));
    const current = ui.get().selection;
    if (!sameIds(current, unique)) ui.set({ selection: unique });
  }

  const selectedRecords = () => ui.get().selection.map((id) => store.get(id)).filter(Boolean);

  // Drop ids from the selection when their elements go away.
  store.onChange((changes) => {
    const { selection, editingId, hovered } = ui.get();
    let changed = false;
    for (const [id, [, after]] of changes) {
      if (!after && (selection.includes(id) || editingId === id || hovered === id)) changed = true;
    }
    if (changed) {
      ui.set({
        selection: selection.filter((id) => store.has(id)),
        editingId: editingId && store.has(editingId) ? editingId : null,
        hovered: hovered && store.has(hovered) ? hovered : null,
      });
    }
  });

  // Undoing the typing in a text element that is no longer being edited leaves it empty: tidy it away.
  store.onCommit((commit) => {
    if (commit.origin !== 'undo') return;
    const empty = [];
    for (const [id, [, after]] of commit.changes) {
      if (after?.type === 'text' && !(after.data.text || '').trim() && ui.get().editingId !== id) empty.push(id);
    }
    if (empty.length) {
      queueMicrotask(() => store.transact((tx) => empty.forEach((id) => tx.get(id) && tx.remove(id)), { label: 'Remove empty text', history: false }));
    }
  });

  ui.subscribe(() => {
    if (visibleIds) scheduleVisibility();
  });

  // When a text session ends: seal its undo run, and remove a text element left empty.
  // This lives here, not in the TextEditor's unmount: StrictMode runs effect cleanups
  // right after mount, which deleted every new text element before it could be typed in.
  let lastEditingId = null;
  ui.subscribe(() => {
    const ended = lastEditingId;
    lastEditingId = ui.get().editingId;
    if (!ended || ended === lastEditingId) return;
    history.seal();
    const record = store.get(ended);
    if (record?.type === 'text' && !(record.data.text || '').trim()) {
      store.transact((tx) => tx.remove(ended), { label: 'Remove empty text', history: false });
    }
  });

  /* ------------------------------------------------------------ edits */

  /** A z key above every current sibling under `parent`. */
  function zOnTop(parent, tx) {
    const ids = tx ? tx.childIds(parent) : store.childIds(parent);
    const last = ids.length ? (tx ? tx.get(ids.at(-1)) : store.get(ids.at(-1))) : null;
    return keyBetween(last?.z ?? null, null);
  }

  function zAtBottom(parent, tx) {
    const ids = tx ? tx.childIds(parent) : store.childIds(parent);
    const first = ids.length ? (tx ? tx.get(ids[0]) : store.get(ids[0])) : null;
    return keyBetween(null, first?.z ?? null);
  }

  /**
   * A change the person made. Records the selection on both sides so undo can
   * put it back, and refuses to run on a read-only board.
   */
  function commit(label, fn, { mergeKey = null, selectAfter } = {}) {
    if (ui.get().readOnly) return null;
    const selectionBefore = ui.get().selection;
    let result;
    const done = store.transact(
      (tx) => {
        result = fn(tx);
      },
      { label, mergeKey, selectionBefore, get selectionAfter() {
        return selectAfter ?? ui.get().selection;
      } },
    );
    if (selectAfter) select(selectAfter);
    return done ? result ?? true : result ?? null;
  }

  function newRecord(type, data, { parent = null, tx } = {}) {
    const def = shapeFor(type);
    const style = ui.get().toolStyle[type] || {};
    return {
      id: newId(),
      type,
      parent,
      z: zOnTop(parent, tx),
      data: { ...def.defaults(), ...style, ...data },
    };
  }

  /**
   * The frame a connector belongs in: the deepest frame containing both of its ends
   * (a bound end counts as being where its element is), or null. Connectors whose
   * ends are in the same frame move with it; clipping hides them with it too.
   */
  function connectorHome(tx, record) {
    const chainOf = (frameId) => {
      const chain = [];
      let current = frameId;
      let guard = 0;
      while (current && guard < 16) {
        chain.unshift(current);
        current = tx.get(current)?.parent ?? null;
        guard += 1;
      }
      return chain;
    };
    const frameOfEnd = (end) => {
      if (end?.eid) {
        const target = tx.get(end.eid);
        if (!target) return null;
        // Attached to a frame's edge is outside that frame; on a line, wherever the line lives.
        return target.parent ?? null;
      }
      if (!end?.point) return null;
      const origin = worldOrigin(record.parent, tx);
      return frameAtIn(tx, end.point[0] + origin.x, end.point[1] + origin.y);
    };
    const a = chainOf(frameOfEnd(record.data.start));
    const b = chainOf(frameOfEnd(record.data.end));
    let home = null;
    for (let i = 0; i < Math.min(a.length, b.length) && a[i] === b[i]; i += 1) home = a[i];
    return home;
  }

  /** Re-homes connectors after their ends moved between frames. */
  function settleConnectors(tx, ids) {
    for (const id of ids) {
      const record = tx.get(id);
      if (record?.type !== 'connector') continue;
      const home = connectorHome(tx, record);
      // Through reparent: free points are relative to the frame and must be converted.
      if ((record.parent ?? null) !== home) reparent(tx, id, home);
    }
  }

  /** Connectors attached to any of `ids` (or inside them), for settling after a move. */
  function connectorsTouching(ids) {
    const out = new Set();
    for (const id of ids) {
      for (const c of bindings.get(id) || []) out.add(c);
      if (store.get(id)?.type === 'connector') out.add(id);
    }
    return [...out];
  }

  /** Moves a record under a new parent, keeping its position on screen. */
  function reparent(tx, id, parentId) {
    const record = tx.get(id);
    if (!record || (record.parent ?? null) === (parentId ?? null)) return;
    const from = worldOrigin(record.parent, tx);
    const to = worldOrigin(parentId, tx);
    if (record.type === 'connector') {
      const data = {};
      for (const key of ['start', 'end']) {
        const end = record.data[key];
        if (end?.point) data[key] = { point: [end.point[0] + from.x - to.x, end.point[1] + from.y - to.y] };
      }
      tx.update(id, { parent: parentId ?? null, z: zOnTop(parentId, tx), data });
      return;
    }
    tx.update(id, {
      parent: parentId ?? null,
      z: zOnTop(parentId, tx),
      data: { x: (record.data.x || 0) + from.x - to.x, y: (record.data.y || 0) + from.y - to.y },
    });
  }

  /* ------------------------------------------------------------ camera */

  function writeCamera() {
    cameraFrame = 0;
    if (!dom) return;
    const moving = ui.get().moving;
    const dpr = window.devicePixelRatio || 1;
    const x = moving ? camera.x : snapToDevicePixels(camera.x, dpr);
    const y = moving ? camera.y : snapToDevicePixels(camera.y, dpr);
    dom.world.style.transform = moving
      ? `translate3d(${x}px, ${y}px, 0) scale(${camera.z})`
      : `translate(${x}px, ${y}px) scale(${camera.z})`;
    // For the few things that stay a constant size on screen, like frame titles.
    dom.world.style.setProperty('--sd-z', String(camera.z));

    // The dot grid: a step that stays between ~12 and ~48 screen pixels.
    let step = 24 * camera.z;
    while (step < 12) step *= 4;
    while (step > 48) step /= 2;
    dom.grid.style.backgroundSize = `${step}px ${step}px`;
    dom.grid.style.backgroundPosition = `${x % step}px ${y % step}px`;

    for (const fn of cameraListeners) fn(camera);
    checkVisibilityForCamera();
  }

  function scheduleCameraWrite() {
    if (!cameraFrame) cameraFrame = requestAnimationFrame(writeCamera);
  }

  function markMoving() {
    if (!ui.get().moving) {
      ui.set({ moving: true });
      dom?.root.classList.add('is-moving');
      if (dom) dom.world.style.willChange = 'transform';
    }
    clearTimeout(movingTimer);
    movingTimer = setTimeout(() => {
      ui.set({ moving: false });
      if (dom) {
        dom.root.classList.remove('is-moving');
        dom.world.style.willChange = 'auto';
      }
      scheduleCameraWrite();
      persistCamera();
    }, SETTLE_MS);
  }

  function setCamera(next, { animate = false } = {}) {
    const target = { x: next.x, y: next.y, z: clampZoom(next.z) };
    if (animate) {
      const from = { ...camera };
      const started = performance.now();
      const duration = 240;
      cameraAnimation = { cancelled: false };
      const animation = cameraAnimation;
      const step = (now) => {
        if (animation.cancelled) return;
        const t = Math.min(1, (now - started) / duration);
        const k = 1 - (1 - t) ** 3;
        applyCamera({ x: from.x + (target.x - from.x) * k, y: from.y + (target.y - from.y) * k, z: from.z + (target.z - from.z) * k });
        if (t < 1) requestAnimationFrame(step);
        else cameraAnimation = null;
      };
      requestAnimationFrame(step);
      return;
    }
    if (cameraAnimation) cameraAnimation.cancelled = true;
    applyCamera(target);
  }

  function applyCamera(next) {
    camera = next;
    markMoving();
    scheduleCameraWrite();
    const bucket = zoomBucket(camera.z);
    if (bucket !== lastBucket) {
      lastBucket = bucket;
      ui.set({ zoomBucket: bucket });
    }
    updateChrome();
  }

  function persistCamera() {
    try {
      localStorage.setItem(`sd-cam:${boardId}`, JSON.stringify(camera));
    } catch {
      /* private mode */
    }
  }

  function restoreCamera() {
    try {
      const saved = JSON.parse(localStorage.getItem(`sd-cam:${boardId}`) || 'null');
      if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y) && Number.isFinite(saved.z)) {
        camera = { x: saved.x, y: saved.y, z: clampZoom(saved.z) };
        return true;
      }
    } catch {
      /* ignore */
    }
    return false;
  }

  const zoomAround = (z, sx = viewportRect.width / 2, sy = viewportRect.height / 2, animate = false) =>
    setCamera(zoomAt(camera, sx, sy, z), { animate });

  function zoomToFit({ animate = true, ids } = {}) {
    const bounds = contentBounds(ids);
    if (!bounds) {
      setCamera({ x: viewportRect.width / 2, y: viewportRect.height / 2, z: 1 }, { animate });
      return;
    }
    setCamera(fitBounds(bounds, viewportRect.width, viewportRect.height, { padding: 80, maxZoom: ids ? 2 : 1 }), { animate });
  }

  const visibleWorld = () => viewportBounds(camera, viewportRect.width, viewportRect.height);

  /* ------------------------------------------------------------ chrome (top bar) */

  let chrome = { zoom: 1, canUndo: false, canRedo: false, save: { state: 'idle' }, flowPaused: false };
  const chromeListeners = new Set();
  function updateChrome(patch = {}) {
    const next = {
      ...chrome,
      zoom: Math.round(camera.z * 100) / 100,
      canUndo: history.canUndo,
      canRedo: history.canRedo,
      flowPaused: ui.get().flowPaused,
      ...patch,
    };
    const changed = Object.keys(next).some((key) => next[key] !== chrome[key]);
    if (!changed) return;
    chrome = next;
    for (const fn of chromeListeners) fn();
  }
  history.subscribe(() => updateChrome());

  /* ------------------------------------------------------------ input */

  const pointers = new Map();
  let spaceHeld = false;
  let penMode = false;
  let pan = null; // { lastX, lastY }
  let pinch = null; // { distance, cx, cy }
  let pendingMove = null;
  let moveFrame = 0;
  let activePointer = null;

  function toViewport(event) {
    return { sx: event.clientX - viewportRect.left, sy: event.clientY - viewportRect.top };
  }

  function makeContext(event, extra = {}) {
    const { sx, sy } = toViewport(event);
    const w = screenToWorld(camera, sx, sy);
    return {
      event,
      sx,
      sy,
      wx: w.x,
      wy: w.y,
      pointerType: event.pointerType || 'mouse',
      pressure: event.pressure || 0.5,
      button: event.button,
      shift: event.shiftKey,
      alt: event.altKey,
      mod: event.metaKey || event.ctrlKey,
      threshold: (DRAG_THRESHOLD[event.pointerType] || 3) / camera.z,
      ...extra,
    };
  }

  let toolset = null;
  const tools = () => toolset || (toolset = createTools(editor));

  function currentTool() {
    return tools()[ui.get().tool] || tools().select;
  }

  function setTool(name, { lock } = {}) {
    if (!tools()[name]) return;
    const readOnly = ui.get().readOnly;
    const next = readOnly && !['select', 'hand'].includes(name) ? 'select' : name;
    const previous = currentTool();
    if (previous.id !== next) previous.onExit?.();
    ui.set({ tool: next, ...(lock !== undefined ? { toolLocked: lock } : {}), editingId: null });
    tools()[next].onEnter?.();
    updateCursor();
  }

  function updateCursor(cursor) {
    if (!dom) return;
    const value = cursor || (pan || spaceHeld ? (pan ? 'grabbing' : 'grab') : currentTool().cursor || 'default');
    if (dom.viewport.style.cursor !== value) dom.viewport.style.cursor = value;
  }

  function startPan(event) {
    pan = { lastX: event.clientX, lastY: event.clientY };
    updateCursor();
  }

  /** Events that belong to an inline editor or a control floating over the canvas, not to the board. */
  const ownedByControl = (event) => Boolean(event.target?.closest?.('textarea, input, button, [data-sd-control]'));

  function onPointerDown(event) {
    if (!dom || ownedByControl(event)) return;
    if (cameraAnimation) cameraAnimation.cancelled = true;
    dom.viewport.focus({ preventScroll: true });
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, type: event.pointerType });
    if (event.pointerType === 'pen') penMode = true;

    // Two fingers: pinch and pan. Whatever the first finger started is cancelled.
    if (pointers.size === 2 && event.pointerType === 'touch') {
      currentTool().onCancel?.();
      activePointer = null;
      const [a, b] = [...pointers.values()];
      pinch = { distance: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
      return;
    }
    if (pointers.size > 1) return;

    try {
      dom.viewport.setPointerCapture(event.pointerId);
    } catch {
      /* the pointer may already be gone */
    }

    const touchPans = penMode && event.pointerType === 'touch';
    if (event.button === 1 || spaceHeld || ui.get().tool === 'hand' || touchPans) {
      event.preventDefault();
      startPan(event);
      activePointer = event.pointerId;
      return;
    }
    if (event.button !== 0 && event.pointerType === 'mouse') return;

    activePointer = event.pointerId;
    const tool = currentTool();
    tool.onPointerDown?.(makeContext(event));
  }

  function flushMove() {
    moveFrame = 0;
    const event = pendingMove;
    pendingMove = null;
    if (!event) return;
    const tool = currentTool();
    const ctx = makeContext(event);
    if (activePointer === event.pointerId) tool.onPointerMove?.(ctx);
    else tool.onHover?.(ctx);
  }

  function onPointerMove(event) {
    if (!dom) return;
    const tracked = pointers.get(event.pointerId);
    if (tracked) {
      tracked.x = event.clientX;
      tracked.y = event.clientY;
    }

    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      let next = zoomAt(camera, cx - viewportRect.left, cy - viewportRect.top, camera.z * (distance / pinch.distance));
      next = { ...next, x: next.x + (cx - pinch.cx), y: next.y + (cy - pinch.cy) };
      pinch = { distance, cx, cy };
      setCamera(next);
      return;
    }

    if (pan && activePointer === event.pointerId) {
      const dx = event.clientX - pan.lastX;
      const dy = event.clientY - pan.lastY;
      pan.lastX = event.clientX;
      pan.lastY = event.clientY;
      setCamera({ x: camera.x + dx, y: camera.y + dy, z: camera.z });
      return;
    }

    // Drawing tools want every sample the device produced, not one per frame.
    const tool = currentTool();
    if (tool.wantsCoalesced && activePointer === event.pointerId) {
      const samples = event.getCoalescedEvents?.() || [event];
      tool.onSamples?.(samples.map((sample) => makeContext(sample)));
    }

    pendingMove = event;
    if (!moveFrame) moveFrame = requestAnimationFrame(flushMove);
  }

  function onPointerUp(event) {
    pointers.delete(event.pointerId);
    if (pinch) {
      if (pointers.size < 2) pinch = null;
      return;
    }
    if (pendingMove) {
      cancelAnimationFrame(moveFrame);
      flushMove();
    }
    if (pan && activePointer === event.pointerId) {
      pan = null;
      activePointer = null;
      updateCursor();
      return;
    }
    if (activePointer !== event.pointerId) return;
    activePointer = null;
    currentTool().onPointerUp?.(makeContext(event));
  }

  function onPointerCancel(event) {
    pointers.delete(event.pointerId);
    if (pinch && pointers.size < 2) pinch = null;
    if (pan) {
      pan = null;
      updateCursor();
    }
    if (activePointer === event.pointerId) {
      activePointer = null;
      // An interrupted gesture completes, the way Figma's do, rather than vanishing.
      currentTool().onPointerUp?.(makeContext(event, { cancelled: true }));
    }
  }

  function onWheel(event) {
    event.preventDefault();
    if (cameraAnimation) cameraAnimation.cancelled = true;
    const { sx, sy } = toViewport(event);
    const { dx, dy } = wheelPixels(event, viewportRect.height);
    if (event.ctrlKey || event.metaKey) {
      // Pinch on a trackpad arrives as ctrl+wheel in every browser.
      setCamera(zoomAt(camera, sx, sy, camera.z * wheelZoomFactor(dy)));
      return;
    }
    const horizontal = event.shiftKey && !dx ? dy : dx;
    const vertical = event.shiftKey && !dx ? 0 : dy;
    setCamera({ x: camera.x - horizontal, y: camera.y - vertical, z: camera.z });
  }

  let gestureScale = 1;
  function onGestureStart(event) {
    event.preventDefault();
    gestureScale = 1;
  }
  function onGestureChange(event) {
    event.preventDefault();
    const { sx, sy } = toViewport(event);
    setCamera(zoomAt(camera, sx, sy, camera.z * (event.scale / gestureScale)));
    gestureScale = event.scale;
  }

  function onDoubleClick(event) {
    if (ownedByControl(event)) return;
    currentTool().onDoubleClick?.(makeContext(event));
  }

  function onContextMenu(event) {
    if (ownedByControl(event)) return;
    event.preventDefault();
    const ctx = makeContext(event);
    const hit = hitTest(ctx.wx, ctx.wy);
    if (hit && !ui.get().selection.includes(hit)) select([hit]);
    if (!hit) select([]);
    ui.set({ contextMenu: { x: event.clientX, y: event.clientY, wx: ctx.wx, wy: ctx.wy, targetId: hit } });
  }

  const typing = (target) =>
    target instanceof HTMLElement && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable);

  /**
   * Keys a focused control answers itself, which must not also reach the board. Everything else —
   * ⌘Z, Delete, tool letters — still works after clicking a button in the explorer, top bar or inspector.
   */
  const keysBelongElsewhere = (event) => {
    if (event.defaultPrevented) return true;
    const target = event.target;
    if (!target?.closest) return false;
    if (target.closest('[role="menu"], [role="dialog"], [role="alertdialog"], [role="listbox"]')) return true;
    // Composite widgets move with the arrow keys.
    if (/^(Arrow|Home$|End$|Page)/.test(event.key) && target.closest('[role="tree"], [role="radiogroup"], [role="tablist"], [role="slider"], [role="separator"], select')) return true;
    // A focused button, row, tab or link is activated by Enter and Space.
    if ((event.key === 'Enter' || event.key === ' ') && target.closest('button, a[href], [role="button"], [role="treeitem"], [role="tab"], select, summary')) return true;
    return false;
  };

  function onKeyDown(event) {
    if (!dom || keysBelongElsewhere(event)) return;
    if (event.key === ' ' && !typing(event.target) && !event.repeat) {
      if (!ui.get().editingId) {
        spaceHeld = true;
        updateCursor();
        event.preventDefault();
      }
      return;
    }
    if (isAnyModalOpen() || document.documentElement.classList.contains('sd-menu-open')) return;
    if (typing(event.target)) return;
    if (currentTool().onKeyDown?.(event)) {
      event.preventDefault();
      return;
    }
    const action = matchShortcut(event);
    if (!action) return;
    if (runAction(action, event) !== false) event.preventDefault();
  }

  function onKeyUp(event) {
    if (event.key === ' ') {
      spaceHeld = false;
      updateCursor();
    }
  }

  function onBlur() {
    spaceHeld = false;
    pan = null;
    pointers.clear();
    pinch = null;
    updateCursor();
  }

  /* ------------------------------------------------------------ actions */

  let commands = null;
  const actions = () => commands;

  function runAction(name, event) {
    const { readOnly: ro } = ui.get();
    const viewOnly = new Set(['zoomIn', 'zoomOut', 'zoom100', 'zoomFit', 'zoomSelection', 'toolSelect', 'toolHand', 'escape', 'shortcuts', 'selectAll', 'copy']);
    if (ro && !viewOnly.has(name)) return false;
    const fn = commands?.[name];
    if (!fn) return false;
    return fn(event);
  }

  /* ------------------------------------------------------------ attach */

  function attach(elements) {
    dom = elements;
    const measure = () => {
      const rect = dom.viewport.getBoundingClientRect();
      viewportRect = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    };
    measure();
    const observer = new ResizeObserver(() => {
      measure();
      scheduleCameraWrite();
    });
    observer.observe(dom.viewport);
    disposers.push(() => observer.disconnect());

    const listen = (target, type, fn, options) => {
      target.addEventListener(type, fn, options);
      disposers.push(() => target.removeEventListener(type, fn, options));
    };
    const v = dom.viewport;
    listen(v, 'pointerdown', onPointerDown);
    listen(v, 'pointermove', onPointerMove);
    listen(v, 'pointerup', onPointerUp);
    listen(v, 'pointercancel', onPointerCancel);
    listen(v, 'lostpointercapture', (event) => {
      if (activePointer === event.pointerId) onPointerCancel(event);
    });
    listen(v, 'wheel', onWheel, { passive: false });
    listen(v, 'gesturestart', onGestureStart, { passive: false });
    listen(v, 'gesturechange', onGestureChange, { passive: false });
    listen(v, 'dblclick', onDoubleClick);
    listen(v, 'contextmenu', onContextMenu);
    listen(window, 'keydown', onKeyDown);
    listen(window, 'keyup', onKeyUp);
    listen(window, 'blur', onBlur);
    // A pinch that starts over the chrome must not zoom the page.
    listen(document, 'wheel', (event) => event.ctrlKey && event.preventDefault(), { passive: false });
    window.addEventListener('scroll', measure, true);
    disposers.push(() => window.removeEventListener('scroll', measure, true));

    if (!restoreCamera()) {
      if (store.size) zoomToFit({ animate: false });
      else camera = { x: viewportRect.width / 2, y: viewportRect.height / 2, z: 1 };
    }
    lastBucket = zoomBucket(camera.z);
    ui.set({ zoomBucket: lastBucket });
    writeCamera();
    updateChrome();
    updateCursor();
  }

  function detach() {
    for (const dispose of disposers.splice(0)) dispose();
    cancelAnimationFrame(cameraFrame);
    cancelAnimationFrame(moveFrame);
    clearTimeout(movingTimer);
    persistCamera();
    dom = null;
  }

  /* ------------------------------------------------------------ public api */

  const editor = {
    boardId,
    boardKind,
    store,
    ui,
    history,
    notify,

    get camera() {
      return camera;
    },
    get viewportRect() {
      return viewportRect;
    },
    get dom() {
      return dom;
    },

    attach,
    detach,
    setCamera,
    zoomBy: (dir) => zoomAround(stepZoom(camera.z, dir), undefined, undefined, true),
    zoomTo: (z) => zoomAround(z, undefined, undefined, true),
    zoomToFit: () => zoomToFit(),
    zoomToSelection: () => {
      const ids = ui.get().selection;
      if (ids.length) zoomToFit({ ids });
      else zoomToFit();
    },
    visibleWorld,
    subscribeCamera(fn) {
      cameraListeners.add(fn);
      return () => cameraListeners.delete(fn);
    },
    screenToWorld: (sx, sy) => screenToWorld(camera, sx, sy),
    clientToWorld: (clientX, clientY) => screenToWorld(camera, clientX - viewportRect.left, clientY - viewportRect.top),

    worldOrigin,
    worldBox,
    boundsOf,
    contentBounds,
    connectorGeo,
    lookupBox,
    geometryDeps,
    lineBindingAt,
    /** Ids to mount, or null for all of them (small boards). */
    getVisibleIds: () => visibleIds,
    subscribeVisibility(fn) {
      visibilityListeners.add(fn);
      return () => visibilityListeners.delete(fn);
    },
    watchGeometry,
    ancestors,
    paintOrder,
    hitTest,
    queryRect,
    frameAt,
    bindingsOf: (eid) => bindings.get(eid) || new Set(),

    select,
    selectedRecords,
    commit,
    newRecord,
    reparent,
    settleConnectors,
    connectorsTouching,
    toLocalPoint,
    zOnTop,
    zAtBottom,
    zOnTop,

    setTool,
    currentTool,
    updateCursor,
    runAction,
    get actions() {
      return actions();
    },
    set commands(value) {
      commands = value;
    },

    undo: () => !ui.get().readOnly && history.undo(),
    redo: () => !ui.get().readOnly && history.redo(),
    toggleFlow() {
      ui.set({ flowPaused: !ui.get().flowPaused });
      updateChrome();
    },
    openShortcuts: () => onRequestShortcuts?.(),

    subscribeChrome: (fn) => {
      chromeListeners.add(fn);
      return () => chromeListeners.delete(fn);
    },
    getChrome: () => chrome,
    setSaveStatus: (save) => updateChrome({ save }),
    flushSave: () => editor.sync?.flush({ force: true }),

    /** Ops for a local commit, for autosave. Unknown types are never sent. */
    opsFor(commitRecord) {
      const filtered = new Map();
      for (const [id, [before, after]] of commitRecord.changes) {
        if ((before && !isKnownType(before.type)) || (after && !isKnownType(after.type))) continue;
        filtered.set(id, [before, after]);
      }
      return opsFromCommit({ ...commitRecord, changes: filtered });
    },

    setReadOnly(value) {
      ui.set({ readOnly: value, ...(value ? { editingId: null } : {}) });
      if (value) setTool('select');
    },
  };

  return editor;
}
