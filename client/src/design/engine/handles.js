import { aabbUnion, boxCorners, rotatePoint } from '../core/geometry.js';
import { shapeFor } from '../shapes/registry.js';
import { worldToScreen } from './camera.js';

/**
 * The selection's frame and its handles, in one place, because two things must
 * agree about them exactly: the overlay that draws the handles and the select
 * tool that decides which one the pointer went down on.
 *
 * A single box-like element gets a frame along its own rotated axes. Several
 * elements get their axis-aligned union. A lone connector gets its two ends.
 */

export const HANDLE_RADIUS = 5;
const ROTATE_ZONE = 18;

const CORNERS = ['nw', 'ne', 'se', 'sw'];
const EDGES = ['n', 'e', 's', 'w'];

export function selectionFrame(editor) {
  const records = editor.selectedRecords();
  if (!records.length) return null;

  if (records.length === 1 && records[0].type === 'connector') {
    const geo = editor.connectorGeo(records[0]);
    return {
      kind: 'connector',
      record: records[0],
      ends: { start: [geo.start.x, geo.start.y], end: [geo.end.x, geo.end.y] },
      bounds: geo.bounds,
      points: geo.points,
    };
  }

  if (records.length === 1) {
    const record = records[0];
    const def = shapeFor(record.type);
    const box = editor.worldBox(record);
    return {
      kind: 'single',
      record,
      box,
      resize: record.data.locked ? 'none' : def.caps.resize,
      rotate: !record.data.locked && def.caps.rotate,
    };
  }

  const bounds = aabbUnion(records.map((r) => editor.boundsOf(r)));
  const locked = records.some((r) => r.data.locked);
  return {
    kind: 'multi',
    records,
    box: { x: bounds.minX, y: bounds.minY, w: bounds.maxX - bounds.minX, h: bounds.maxY - bounds.minY, rot: 0 },
    resize: locked ? 'none' : 'free',
    rotate: false,
  };
}

/** Handle positions in screen space for a frame, given the camera. */
export function handlePositions(frame, camera) {
  if (!frame) return [];
  if (frame.kind === 'connector') {
    return ['start', 'end'].map((id) => {
      const [wx, wy] = frame.ends[id];
      const p = worldToScreen(camera, wx, wy);
      return { id, x: p.x, y: p.y };
    });
  }
  const { box, resize } = frame;
  if (resize === 'none') return [];
  const corners = boxCorners(box.x, box.y, box.w, box.h, box.rot).map((c) => worldToScreen(camera, c.x, c.y));
  const out = [];
  const small = box.w * camera.z < 28 || box.h * camera.z < 28;

  if (resize === 'width') {
    const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    out.push({ id: 'e', ...mid(corners[1], corners[2]) });
    out.push({ id: 'w', ...mid(corners[3], corners[0]) });
    return out;
  }

  CORNERS.forEach((id, i) => out.push({ id, x: corners[i].x, y: corners[i].y }));
  if (resize === 'free' && !small) {
    EDGES.forEach((id, i) => {
      const a = corners[i];
      const b = corners[(i + 1) % 4];
      out.push({ id, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, edge: true });
    });
  }
  return out;
}

/**
 * Which handle (if any) a screen point is on. Rotation is a zone just outside
 * each corner, the way Figma does it, rather than a lollipop you have to find.
 */
export function handleAt(frame, camera, sx, sy) {
  if (!frame) return null;
  const handles = handlePositions(frame, camera);
  const hitRadius = HANDLE_RADIUS + 4;
  // Edges are long thin targets: the whole side, not only its midpoint.
  for (const h of handles) {
    if (!h.edge && Math.hypot(sx - h.x, sy - h.y) <= hitRadius) return h.id;
  }
  if (frame.kind === 'connector') return null;

  const { box } = frame;
  const corners = boxCorners(box.x, box.y, box.w, box.h, box.rot).map((c) => worldToScreen(camera, c.x, c.y));

  if (frame.resize === 'free') {
    for (let i = 0; i < 4; i += 1) {
      const a = corners[i];
      const b = corners[(i + 1) % 4];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len < 20) continue;
      const t = ((sx - a.x) * (b.x - a.x) + (sy - a.y) * (b.y - a.y)) / (len * len);
      if (t < 0.1 || t > 0.9) continue;
      const px = a.x + t * (b.x - a.x);
      const py = a.y + t * (b.y - a.y);
      if (Math.hypot(sx - px, sy - py) <= 4) return EDGES[i];
    }
  }

  if (frame.rotate) {
    const center = worldToScreen(camera, box.x + box.w / 2, box.y + box.h / 2);
    for (let i = 0; i < 4; i += 1) {
      const c = corners[i];
      const d = Math.hypot(sx - c.x, sy - c.y);
      if (d > hitRadius && d <= ROTATE_ZONE + hitRadius) {
        // Only outside the box, in the corner's quadrant.
        const out = (sx - center.x) * (c.x - center.x) + (sy - center.y) * (c.y - center.y);
        const inside = pointInPolygon(sx, sy, corners);
        if (out > 0 && !inside) return `rotate-${CORNERS[i]}`;
      }
    }
  }
  return null;
}

function pointInPolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** The CSS cursor for a handle, rotated with the element so a diagonal handle shows a diagonal arrow. */
export function cursorForHandle(handle, rotation = 0) {
  if (!handle) return null;
  if (handle.startsWith('rotate')) return 'grab';
  if (handle === 'start' || handle === 'end') return 'move';
  const base = { n: 0, ne: 45, e: 90, se: 135, s: 180, sw: 225, w: 270, nw: 315 }[handle];
  const angle = (((base + (rotation * 180) / Math.PI) % 360) + 360) % 360;
  const names = ['ns-resize', 'nesw-resize', 'ew-resize', 'nwse-resize'];
  return names[Math.round(angle / 45) % 4];
}

/** Rotates a local offset into world space around a box's centre — shared by resize math. */
export const localToWorld = (box, lx, ly) => rotatePoint(box.x + lx, box.y + ly, box.x + box.w / 2, box.y + box.h / 2, box.rot || 0);
