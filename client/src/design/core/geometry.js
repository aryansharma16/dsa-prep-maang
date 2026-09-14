/**
 * Plane geometry for the canvas — boxes, rotation, hit tests and distances.
 *
 * Pure functions over plain numbers; no DOM, no element records. Everything on
 * a board is either an axis-aligned box that may be rotated about its centre,
 * a polyline, or a curve, and every question the editor asks — what is under
 * the pointer, what does this marquee touch, where does this arrow meet that
 * shape — reduces to the handful of functions here.
 *
 * Bounds are `{ minX, minY, maxX, maxY }` throughout. Angles are radians.
 */

export const EPSILON = 1e-9;

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/* -------------------------------------------------------------------------- */
/* bounds                                                                      */
/* -------------------------------------------------------------------------- */

export const aabb = (minX, minY, maxX, maxY) => ({ minX, minY, maxX, maxY });

export const aabbFromBox = (x, y, w, h) => aabb(x, y, x + w, y + h);

export const aabbWidth = (b) => b.maxX - b.minX;
export const aabbHeight = (b) => b.maxY - b.minY;
export const aabbCenter = (b) => ({ x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 });

export const aabbIntersects = (a, b) => a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;

export const aabbContains = (outer, inner) =>
  inner.minX >= outer.minX && inner.maxX <= outer.maxX && inner.minY >= outer.minY && inner.maxY <= outer.maxY;

export const aabbContainsPoint = (b, x, y, tol = 0) =>
  x >= b.minX - tol && x <= b.maxX + tol && y >= b.minY - tol && y <= b.maxY + tol;

export function aabbUnion(boxes) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const b of boxes) {
    if (!b) continue;
    if (b.minX < minX) minX = b.minX;
    if (b.minY < minY) minY = b.minY;
    if (b.maxX > maxX) maxX = b.maxX;
    if (b.maxY > maxY) maxY = b.maxY;
  }
  return minX === Infinity ? null : aabb(minX, minY, maxX, maxY);
}

export const aabbExpand = (b, dx, dy = dx) => aabb(b.minX - dx, b.minY - dy, b.maxX + dx, b.maxY + dy);

export function aabbOfPoints(points) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return minX === Infinity ? null : aabb(minX, minY, maxX, maxY);
}

/* -------------------------------------------------------------------------- */
/* rotation                                                                    */
/* -------------------------------------------------------------------------- */

export function rotatePoint(px, py, cx, cy, angle) {
  if (!angle) return { x: px, y: py };
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = px - cx;
  const dy = py - cy;
  return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
}

/** Corners of a box rotated about its centre, clockwise from top-left. */
export function boxCorners(x, y, w, h, rot = 0) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  return [
    rotatePoint(x, y, cx, cy, rot),
    rotatePoint(x + w, y, cx, cy, rot),
    rotatePoint(x + w, y + h, cx, cy, rot),
    rotatePoint(x, y + h, cx, cy, rot),
  ];
}

/** The axis-aligned bounds of a box rotated about its centre. */
export function rotatedBounds(x, y, w, h, rot = 0) {
  if (!rot) return aabbFromBox(x, y, w, h);
  const cos = Math.abs(Math.cos(rot));
  const sin = Math.abs(Math.sin(rot));
  const bw = w * cos + h * sin;
  const bh = w * sin + h * cos;
  const cx = x + w / 2;
  const cy = y + h / 2;
  return aabb(cx - bw / 2, cy - bh / 2, cx + bw / 2, cy + bh / 2);
}

/** A world point in a rotated box's own frame, where (0,0) is the unrotated top-left. */
export function toBoxLocal(px, py, x, y, w, h, rot = 0) {
  const p = rot ? rotatePoint(px, py, x + w / 2, y + h / 2, -rot) : { x: px, y: py };
  return { x: p.x - x, y: p.y - y };
}

export const normalizeAngle = (angle) => {
  const full = Math.PI * 2;
  return ((angle % full) + full) % full;
};

export const snapAngle = (angle, step = Math.PI / 12) => Math.round(angle / step) * step;

/* -------------------------------------------------------------------------- */
/* hit tests in a box's local frame                                            */
/* -------------------------------------------------------------------------- */

export const inRect = (lx, ly, w, h, tol = 0) => lx >= -tol && lx <= w + tol && ly >= -tol && ly <= h + tol;

export function inEllipse(lx, ly, w, h, tol = 0) {
  const rx = w / 2 + tol;
  const ry = h / 2 + tol;
  if (rx <= 0 || ry <= 0) return false;
  const dx = (lx - w / 2) / rx;
  const dy = (ly - h / 2) / ry;
  return dx * dx + dy * dy <= 1;
}

export function inDiamond(lx, ly, w, h, tol = 0) {
  const rx = w / 2 + tol;
  const ry = h / 2 + tol;
  if (rx <= 0 || ry <= 0) return false;
  return Math.abs(lx - w / 2) / rx + Math.abs(ly - h / 2) / ry <= 1;
}

/* -------------------------------------------------------------------------- */
/* segments and polylines                                                      */
/* -------------------------------------------------------------------------- */

export function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  let t = lengthSq < EPSILON ? 0 : ((px - ax) * dx + (py - ay) * dy) / lengthSq;
  t = clamp(t, 0, 1);
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/** Smallest distance from a point to a polyline given as [[x, y], …]. */
export function distToPolyline(px, py, points) {
  if (!points.length) return Infinity;
  if (points.length === 1) return Math.hypot(px - points[0][0], py - points[0][1]);
  let best = Infinity;
  for (let i = 1; i < points.length; i += 1) {
    const d = distToSegment(px, py, points[i - 1][0], points[i - 1][1], points[i][0], points[i][1]);
    if (d < best) best = d;
  }
  return best;
}

function orientation(ax, ay, bx, by, cx, cy) {
  const v = (by - ay) * (cx - bx) - (bx - ax) * (cy - by);
  if (Math.abs(v) < EPSILON) return 0;
  return v > 0 ? 1 : 2;
}

const onSegment = (ax, ay, bx, by, cx, cy) =>
  bx <= Math.max(ax, cx) + EPSILON &&
  bx >= Math.min(ax, cx) - EPSILON &&
  by <= Math.max(ay, cy) + EPSILON &&
  by >= Math.min(ay, cy) - EPSILON;

export function segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
  const o1 = orientation(ax, ay, bx, by, cx, cy);
  const o2 = orientation(ax, ay, bx, by, dx, dy);
  const o3 = orientation(cx, cy, dx, dy, ax, ay);
  const o4 = orientation(cx, cy, dx, dy, bx, by);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(ax, ay, cx, cy, bx, by)) return true;
  if (o2 === 0 && onSegment(ax, ay, dx, dy, bx, by)) return true;
  if (o3 === 0 && onSegment(cx, cy, ax, ay, dx, dy)) return true;
  if (o4 === 0 && onSegment(cx, cy, bx, by, dx, dy)) return true;
  return false;
}

export function segmentIntersectsAabb(ax, ay, bx, by, box) {
  if (aabbContainsPoint(box, ax, ay) || aabbContainsPoint(box, bx, by)) return true;
  const { minX, minY, maxX, maxY } = box;
  return (
    segmentsIntersect(ax, ay, bx, by, minX, minY, maxX, minY) ||
    segmentsIntersect(ax, ay, bx, by, maxX, minY, maxX, maxY) ||
    segmentsIntersect(ax, ay, bx, by, maxX, maxY, minX, maxY) ||
    segmentsIntersect(ax, ay, bx, by, minX, maxY, minX, minY)
  );
}

export function polylineIntersectsAabb(points, box) {
  for (let i = 1; i < points.length; i += 1) {
    if (segmentIntersectsAabb(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1], box)) return true;
  }
  return points.length === 1 && aabbContainsPoint(box, points[0][0], points[0][1]);
}

export function polylineLength(points) {
  let length = 0;
  for (let i = 1; i < points.length; i += 1) {
    length += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  }
  return length;
}

/** The point `t` (0…1) of the way along a polyline, with the direction of travel there. */
export function pointAlongPolyline(points, t) {
  if (!points.length) return { x: 0, y: 0, angle: 0 };
  if (points.length === 1) return { x: points[0][0], y: points[0][1], angle: 0 };
  const total = polylineLength(points);
  let remaining = clamp(t, 0, 1) * total;
  for (let i = 1; i < points.length; i += 1) {
    const [ax, ay] = points[i - 1];
    const [bx, by] = points[i];
    const seg = Math.hypot(bx - ax, by - ay);
    if (remaining <= seg || i === points.length - 1) {
      const k = seg < EPSILON ? 0 : Math.min(1, remaining / seg);
      return { x: ax + (bx - ax) * k, y: ay + (by - ay) * k, angle: Math.atan2(by - ay, bx - ax) };
    }
    remaining -= seg;
  }
  const last = points.at(-1);
  return { x: last[0], y: last[1], angle: 0 };
}

/* -------------------------------------------------------------------------- */
/* curves                                                                      */
/* -------------------------------------------------------------------------- */

export function cubicPoint(t, p0, p1, p2, p3) {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return [a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]];
}

export function sampleCubic(p0, p1, p2, p3, segments = 24) {
  const out = [];
  for (let i = 0; i <= segments; i += 1) out.push(cubicPoint(i / segments, p0, p1, p2, p3));
  return out;
}

/* -------------------------------------------------------------------------- */
/* where a line from a shape's centre leaves its outline                       */
/* -------------------------------------------------------------------------- */

/**
 * The point on the outline of a (local, unrotated) shape of size w×h where a
 * ray from its centre toward (tx, ty) exits. `kind` is rect | ellipse | diamond.
 * Returns local coordinates.
 */
export function outlineExit(kind, w, h, tx, ty) {
  const cx = w / 2;
  const cy = h / 2;
  let dx = tx - cx;
  let dy = ty - cy;
  if (Math.abs(dx) < EPSILON && Math.abs(dy) < EPSILON) dy = -1;

  if (kind === 'ellipse') {
    const rx = Math.max(w / 2, EPSILON);
    const ry = Math.max(h / 2, EPSILON);
    const k = 1 / Math.sqrt((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry));
    return { x: cx + dx * k, y: cy + dy * k };
  }
  if (kind === 'diamond') {
    const rx = Math.max(w / 2, EPSILON);
    const ry = Math.max(h / 2, EPSILON);
    const k = 1 / (Math.abs(dx) / rx + Math.abs(dy) / ry);
    return { x: cx + dx * k, y: cy + dy * k };
  }
  const sx = Math.abs(dx) < EPSILON ? Infinity : w / 2 / Math.abs(dx);
  const sy = Math.abs(dy) < EPSILON ? Infinity : h / 2 / Math.abs(dy);
  const k = Math.min(sx, sy);
  return { x: cx + dx * k, y: cy + dy * k };
}

/** Vector helpers, for the connector router. */
export const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
export const scale = (a, k) => [a[0] * k, a[1] * k];
export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
