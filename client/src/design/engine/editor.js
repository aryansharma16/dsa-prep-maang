import { isAnyModalOpen } from '../../components/ui/useDialog.js';
import { keyBetween } from '../core/fractional.js';
import {
  aabbContainsPoint,
  aabbIntersects,
  aabbUnion,
  distToPolyline,
  rotatedBounds,
  toBoxLocal,
} from '../core/geometry.js';
import { newId } from '../core/ids.js';
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
          const geo = connectorGeometry(store.get(connectorId) || connector, lookupBox);
          const patch = {};
          if (connector.data.start?.eid === record.id) patch.start = { point: [geo.start.x, geo.start.y] };
          if (connector.data.end?.eid === record.id) patch.end = { point: [geo.end.x, geo.end.y] };
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

  const paintCache = { order: null };
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
    }
    bumpGeometry(changes);
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

  /** World position of a parent's origin — where its children's (0, 0) is. */
  function worldOrigin(parentId) {
    let x = 0;
    let y = 0;
    let current = parentId ? store.get(parentId) : null;
    let guard = 0;
    while (current && guard < 16) {
      x += current.data.x || 0;
      y += current.data.y || 0;
      current = current.parent ? store.get(current.parent) : null;
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

  const geoCache = new WeakMap();
  function connectorGeo(record) {
    const start = record.data.start?.eid ? lookupBox(record.data.start.eid) : null;
    const end = record.data.end?.eid ? lookupBox(record.data.end.eid) : null;
    const signature = `${start ? `${start.x},${start.y},${start.w},${start.h},${start.rot}` : ''}|${end ? `${end.x},${end.y},${end.w},${end.h},${end.rot}` : ''}`;
    const cached = geoCache.get(record);
    if (cached && cached.signature === signature) return cached.geo;
    const geo = connectorGeometry(record, lookupBox);
    geoCache.set(record, { signature, geo });
    return geo;
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
      const titleW = Math.max(80 / camera.z, Math.min(box.w, 240 / camera.z));
      const titleHit = local.y >= -titleH && local.y <= 0 && local.x >= 0 && local.x <= titleW;
      return titleHit || hitOutlineEdge('rect', local.x, local.y, box.w, box.h, tol);
    }
    if (!def.caps.hitInterior) return hitOutlineEdge(def.outline, local.x, local.y, box.w, box.h, tol);
    return hitOutline(def.outline, local.x, local.y, box.w, box.h, tol);
  }

  /** The topmost element under a world point, or null. */
  function hitTest(wx, wy, { filter, tolerancePx = 4 } = {}) {
    const tol = tolerancePx / camera.z;
    const order = paintOrder();
    for (let i = order.length - 1; i >= 0; i -= 1) {
      const record = store.get(order[i]);
      if (!record || (filter && !filter(record))) continue;
      if (hitElement(record, wx, wy, tol)) return record.id;
    }
    return null;
  }

  /** Everything a world rectangle touches (or fully contains, for frames). */
  function queryRect(rect) {
    const hits = [];
    for (const id of paintOrder()) {
      const record = store.get(id);
      const b = boundsOf(record);
      if (!b || !aabbIntersects(rect, b)) continue;
      if (record.type === 'frame') {
        if (b.minX >= rect.minX && b.maxX <= rect.maxX && b.minY >= rect.minY && b.maxY <= rect.maxY) hits.push(id);
        continue;
      }
      hits.push(id);
    }
    return hits;
  }

  /** The deepest frame whose body contains a world point, skipping `exclude` and anything inside it. */
  function frameAt(wx, wy, exclude = new Set()) {
    const order = paintOrder();
    for (let i = order.length - 1; i >= 0; i -= 1) {
      const record = store.get(order[i]);
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

  /** Moves a record under a new parent, keeping its position on screen. */
  function reparent(tx, id, parentId) {
    const record = tx.get(id);
    if (!record || (record.parent ?? null) === (parentId ?? null)) return;
    if (record.type === 'connector') {
      tx.update(id, { parent: parentId ?? null, z: zOnTop(parentId, tx) });
      return;
    }
    const from = worldOrigin(record.parent);
    const to = worldOrigin(parentId);
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

  function onKeyDown(event) {
    if (!dom) return;
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
    zOnTop,
    zAtBottom,

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
