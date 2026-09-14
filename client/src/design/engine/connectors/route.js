import {
  aabbExpand,
  aabbOfPoints,
  clamp,
  outlineExit,
  rotatePoint,
  sampleCubic,
  segmentIntersectsAabb,
} from '../../core/geometry.js';

/**
 * Where a connector runs.
 *
 * A bound end stores which element and which side — never coordinates — so a
 * connector's path is derived every time it is drawn, from the boxes of the
 * shapes it joins. Nothing is written when a shape moves and its arrows follow,
 * which is both fewer saves and, later, one less thing two people can conflict
 * over.
 *
 * Pure: everything about the board arrives through `lookup(eid, end)`, which
 * returns a world box `{ x, y, w, h, rot, outline }` for a shape, a point
 * `{ point: [x, y], axis: 'h'|'v'|null }` for an end attached to another
 * connector (`{ eid, t }`, `t` of the way along it), or null.
 *
 * The elbow router is a candidate router, not a path search. It tries the
 * handful of orthogonal paths that could sensibly join two sides — through the
 * gap between the shapes, around either side — throws out any that cut through
 * either shape, and keeps the shortest with the fewest bends. It only avoids
 * the two shapes it joins, which is the behaviour people know from Figma and
 * tldraw, and it is stable: it does not jump to a wildly different route when a
 * shape moves a pixel, which a grid search around every obstacle would.
 */

export const SIDES = ['top', 'right', 'bottom', 'left'];
const DIR = { top: [0, -1], right: [1, 0], bottom: [0, 1], left: [-1, 0] };
const MARGIN = 24;
const BEND_COST = 40;

const center = (box) => [box.x + box.w / 2, box.y + box.h / 2];

/** The world point on a side's midpoint, honouring rotation. */
export function sidePoint(box, side) {
  const local = {
    top: [box.w / 2, 0],
    right: [box.w, box.h / 2],
    bottom: [box.w / 2, box.h],
    left: [0, box.h / 2],
  }[side];
  const p = rotatePoint(box.x + local[0], box.y + local[1], box.x + box.w / 2, box.y + box.h / 2, box.rot || 0);
  return [p.x, p.y];
}

function sideDir(box, side) {
  const [dx, dy] = DIR[side];
  if (!box.rot) return [dx, dy];
  const cos = Math.cos(box.rot);
  const sin = Math.sin(box.rot);
  return [dx * cos - dy * sin, dx * sin + dy * cos];
}

/** Where a straight line from a box's centre toward `toward` leaves its outline. */
function exitPoint(box, toward) {
  const [cx, cy] = center(box);
  const local = rotatePoint(toward[0], toward[1], cx, cy, -(box.rot || 0));
  const exit = outlineExit(box.outline || 'rect', box.w, box.h, local.x - box.x, local.y - box.y);
  const world = rotatePoint(box.x + exit.x, box.y + exit.y, cx, cy, box.rot || 0);
  return [world.x, world.y];
}

const worldAabb = (box) => {
  if (!box.rot) return { minX: box.x, minY: box.y, maxX: box.x + box.w, maxY: box.y + box.h };
  const corners = [
    [box.x, box.y],
    [box.x + box.w, box.y],
    [box.x + box.w, box.y + box.h],
    [box.x, box.y + box.h],
  ].map(([x, y]) => {
    const p = rotatePoint(x, y, box.x + box.w / 2, box.y + box.h / 2, box.rot);
    return [p.x, p.y];
  });
  return aabbOfPoints(corners);
};

/**
 * Resolves one end to a box (bound to a shape) or a fixed point (free, or on
 * another connector — then `axis` is that line's direction there, if it is
 * axis-aligned, so routes can meet it square).
 */
function resolveEnd(end, lookup) {
  if (end?.eid) {
    const target = lookup(end.eid, end);
    if (target?.point) return { box: null, point: [target.point[0], target.point[1]], axis: target.axis || null };
    if (target) return { box: target, anchor: end.anchor || 'auto' };
  }
  const point = end?.point || [0, 0];
  return { box: null, point: [point[0], point[1]], axis: null };
}

/** The side a free end leaves from: across the line it sits on, else along the dominant axis toward `target`. */
function freeSide(end, target) {
  const dx = target[0] - end.point[0];
  const dy = target[1] - end.point[1];
  if (end.axis === 'h') return dy >= 0 ? 'bottom' : 'top';
  if (end.axis === 'v') return dx >= 0 ? 'right' : 'left';
  return dominantSide(end.point, target);
}

/* -------------------------------------------------------------------------- */
/* straight and curve                                                          */
/* -------------------------------------------------------------------------- */

function endPointStraight(end, other) {
  if (!end.box) return end.point;
  if (end.anchor !== 'auto' && SIDES.includes(end.anchor)) return sidePoint(end.box, end.anchor);
  const target = other.box ? center(other.box) : other.point;
  return exitPoint(end.box, target);
}

function routeStraight(a, b) {
  const pa = endPointStraight(a, b);
  const pb = endPointStraight(b, a);
  return { points: [pa, pb] };
}

function dominantSide(from, to) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  return Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'right' : 'left') : dy >= 0 ? 'bottom' : 'top';
}

function curveEnd(end, other) {
  const target = other.box ? center(other.box) : other.point;
  if (!end.box) return { p: end.point, d: DIR[freeSide(end, target)] };
  const side = end.anchor !== 'auto' && SIDES.includes(end.anchor) ? end.anchor : dominantSide(center(end.box), target);
  return { p: sidePoint(end.box, side), d: sideDir(end.box, side) };
}

function routeCurve(a, b) {
  const sa = curveEnd(a, b);
  const sb = curveEnd(b, a);
  const distance = Math.hypot(sb.p[0] - sa.p[0], sb.p[1] - sa.p[1]);
  const k = clamp(distance * 0.4, 40, 220);
  const c1 = [sa.p[0] + sa.d[0] * k, sa.p[1] + sa.d[1] * k];
  const c2 = [sb.p[0] + sb.d[0] * k, sb.p[1] + sb.d[1] * k];
  return { points: sampleCubic(sa.p, c1, c2, sb.p, 32), curve: [sa.p, c1, c2, sb.p] };
}

/* -------------------------------------------------------------------------- */
/* elbow                                                                       */
/* -------------------------------------------------------------------------- */

function simplify(points) {
  const out = [];
  for (const p of points) {
    const last = out.at(-1);
    if (last && Math.abs(last[0] - p[0]) < 0.01 && Math.abs(last[1] - p[1]) < 0.01) continue;
    out.push(p);
  }
  // Drop the middle of any three collinear points.
  for (let i = out.length - 2; i >= 1; i -= 1) {
    const [a, b, c] = [out[i - 1], out[i], out[i + 1]];
    const collinear = (Math.abs(a[0] - b[0]) < 0.01 && Math.abs(b[0] - c[0]) < 0.01) || (Math.abs(a[1] - b[1]) < 0.01 && Math.abs(b[1] - c[1]) < 0.01);
    if (collinear) out.splice(i, 1);
  }
  return out;
}

function pathCost(points) {
  let length = 0;
  for (let i = 1; i < points.length; i += 1) length += Math.abs(points[i][0] - points[i - 1][0]) + Math.abs(points[i][1] - points[i - 1][1]);
  return length + Math.max(0, points.length - 2) * BEND_COST;
}

/** A segment passes through a box's interior (touching its edge does not count). */
function cutsThrough(points, box) {
  if (!box) return false;
  const inner = aabbExpand(box, -1.5);
  if (inner.maxX <= inner.minX || inner.maxY <= inner.minY) return false;
  for (let i = 1; i < points.length; i += 1) {
    if (segmentIntersectsAabb(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1], inner)) return true;
  }
  return false;
}

/** The orthogonal candidates between two stubs. */
function candidates(pa, da, pb, db, boxA, boxB) {
  const sa = [pa[0] + da[0] * MARGIN, pa[1] + da[1] * MARGIN];
  const sb = [pb[0] + db[0] * MARGIN, pb[1] + db[1] * MARGIN];

  const xs = new Set([sa[0], sb[0], (sa[0] + sb[0]) / 2]);
  const ys = new Set([sa[1], sb[1], (sa[1] + sb[1]) / 2]);
  const boxes = [boxA, boxB].filter(Boolean);
  if (boxes.length) {
    const minX = Math.min(...boxes.map((b) => b.minX)) - MARGIN;
    const maxX = Math.max(...boxes.map((b) => b.maxX)) + MARGIN;
    const minY = Math.min(...boxes.map((b) => b.minY)) - MARGIN;
    const maxY = Math.max(...boxes.map((b) => b.maxY)) + MARGIN;
    xs.add(minX).add(maxX);
    ys.add(minY).add(maxY);
  }
  if (boxA && boxB) {
    if (boxA.maxX < boxB.minX) xs.add((boxA.maxX + boxB.minX) / 2);
    if (boxB.maxX < boxA.minX) xs.add((boxB.maxX + boxA.minX) / 2);
    if (boxA.maxY < boxB.minY) ys.add((boxA.maxY + boxB.minY) / 2);
    if (boxB.maxY < boxA.minY) ys.add((boxB.maxY + boxA.minY) / 2);
  }

  const out = [];
  for (const x of xs) out.push([pa, sa, [x, sa[1]], [x, sb[1]], sb, pb]);
  for (const y of ys) out.push([pa, sa, [sa[0], y], [sb[0], y], sb, pb]);
  // The two one-bend routes, when the stubs line up for them.
  out.push([pa, sa, [sb[0], sa[1]], sb, pb]);
  out.push([pa, sa, [sa[0], sb[1]], sb, pb]);
  return out;
}

/** Does the path leave `p` in the direction `d` (not doubling back over its own stub)? */
function leavesAlong(points, d) {
  if (points.length < 2) return true;
  const [a, b] = points;
  const dot = (b[0] - a[0]) * d[0] + (b[1] - a[1]) * d[1];
  return dot > 0.01;
}

const sidesFor = (end) => (end.box ? (end.anchor !== 'auto' && SIDES.includes(end.anchor) ? [end.anchor] : SIDES) : [null]);

/** Previous side pair per connector, so routes do not flip-flop while a shape is dragged. */
const lastPair = new Map();

function routeElbow(a, b, id) {
  const boxA = a.box ? worldAabb(a.box) : null;
  const boxB = b.box ? worldAabb(b.box) : null;
  let best = null;
  let previous = null;
  const prevKey = id ? lastPair.get(id) : null;

  for (const sideA of sidesFor(a)) {
    for (const sideB of sidesFor(b)) {
      const pa = sideA ? sidePoint(a.box, sideA) : a.point;
      const pb = sideB ? sidePoint(b.box, sideB) : b.point;
      // A free end has no side: aim it across the line it sits on, or toward the other end.
      const da = sideA ? DIR[sideA] : DIR[freeSide(a, pb)];
      const db = sideB ? DIR[sideB] : DIR[freeSide(b, pa)];
      if (!sideA && !sideB) {
        // One bend, meeting a line an end sits on square; when both ends want it, the arrowhead end wins.
        const verticalFirst = b.axis === 'v' || (a.axis === 'h' && b.axis !== 'h');
        const direct = simplify([pa, verticalFirst ? [pa[0], pb[1]] : [pb[0], pa[1]], pb]);
        return { points: direct };
      }
      for (const raw of candidates(pa, da, pb, db, boxA, boxB)) {
        const points = simplify(raw);
        if (sideA && !leavesAlong(points, da)) continue;
        if (sideB && !leavesAlong([...points].reverse(), db)) continue;
        // The stubs start on each box's edge and head outward, so they only touch
        // the boxes; anything else that crosses a shrunken box cuts through it.
        if (cutsThrough(points, boxA) || cutsThrough(points, boxB)) continue;
        const cost = pathCost(points);
        const key = `${sideA}:${sideB}`;
        if (!best || cost < best.cost) best = { points, cost, key };
        if (key === prevKey && (!previous || cost < previous.cost)) previous = { points, cost, key };
      }
    }
  }

  if (!best) return routeStraight(a, b);
  const chosen = previous && previous.cost <= best.cost * 1.15 ? previous : best;
  if (id) lastPair.set(id, chosen.key);
  return { points: chosen.points };
}

/* -------------------------------------------------------------------------- */
/* entry point                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The geometry of a connector record: its polyline in world space, the angle at
 * each end (for arrowheads), and its bounds.
 */
export function connectorGeometry(record, lookup) {
  const data = record.data;
  const a = resolveEnd(data.start, lookup);
  const b = resolveEnd(data.end, lookup);
  const route = data.route || 'elbow';

  const result = route === 'straight' ? routeStraight(a, b) : route === 'curve' ? routeCurve(a, b) : routeElbow(a, b, record.id);
  const points = result.points.length >= 2 ? result.points : [result.points[0] || [0, 0], result.points[0] || [0, 0]];

  const first = points[0];
  const second = points[1];
  const last = points.at(-1);
  const beforeLast = points.at(-2);
  const tangentStart = result.curve ? result.curve[1] : second;
  const tangentEnd = result.curve ? result.curve[2] : beforeLast;

  return {
    points,
    curve: result.curve || null,
    start: { x: first[0], y: first[1], angle: Math.atan2(first[1] - tangentStart[1], first[0] - tangentStart[0]) },
    end: { x: last[0], y: last[1], angle: Math.atan2(last[1] - tangentEnd[1], last[0] - tangentEnd[0]) },
    bounds: aabbOfPoints(points),
  };
}

/** Clears the flip-flop memory for a connector that no longer exists. */
export const forgetConnector = (id) => lastPair.delete(id);
