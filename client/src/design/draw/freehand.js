/**
 * Pen strokes: from raw pointer samples to a smooth, pressure-shaped outline.
 *
 * Written for this module rather than vendored. The approach is the one every
 * good ink renderer takes (perfect-freehand popularised it for the web):
 *
 * 1. **Streamline** — each point is pulled part of the way toward the previous
 *    smoothed point, which removes the jitter of a hand and a 125Hz mouse.
 * 2. **Radius** — per point, from the pen's pressure, or simulated from speed
 *    for a mouse or finger (fast strokes thin out, the way ink does).
 * 3. **Outline** — offset each point along its normal by its radius on both
 *    sides, cap both ends with a half circle, and join the two sides.
 * 4. **Path** — the polygon is drawn with quadratic curves through midpoints,
 *    so the outline has no visible corners at any zoom.
 *
 * The outline is computed when drawn and never stored; a stroke saves only its
 * simplified centre-line points and pressures (see simplify.js).
 */

const lerp = (a, b, t) => a + (b - a) * t;

/**
 * @param {number[][]} input   [[x, y, pressure?], …]
 * @param {object} options
 * @param {number} options.size         diameter at full pressure
 * @param {number} [options.thinning]   how much pressure narrows the line, 0…1
 * @param {number} [options.streamline] 0…1
 * @param {boolean} [options.simulatePressure]
 * @returns {number[][]} outline polygon
 */
export function strokeOutline(input, { size = 4, thinning = 0.55, streamline = 0.45, simulatePressure = true, taperEnd = true } = {}) {
  if (!input.length) return [];
  const radiusBase = size / 2;

  // 1. Streamline.
  const pts = [];
  let prev = null;
  for (const [x, y, p] of input) {
    if (!prev) {
      prev = [x, y, p ?? 0.5];
    } else {
      const t = 1 - streamline;
      const next = [lerp(prev[0], x, t), lerp(prev[1], y, t), p ?? 0.5];
      if (Math.hypot(next[0] - prev[0], next[1] - prev[1]) < 0.3) continue;
      prev = next;
    }
    pts.push(prev);
  }
  if (pts.length === 1) return circle(pts[0][0], pts[0][1], radiusBase * pressureScale(pts[0][2], thinning));

  // 2. Radii.
  const radii = [];
  let simulated = 0.5;
  for (let i = 0; i < pts.length; i += 1) {
    let pressure = pts[i][2];
    if (simulatePressure) {
      const d = i ? Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]) : 0;
      const speed = Math.min(1, d / size);
      const target = 1 - speed * 0.75;
      simulated = lerp(simulated, target, 0.35);
      pressure = simulated;
    }
    let r = radiusBase * pressureScale(pressure, thinning);
    if (i && radii.length) r = lerp(radii.at(-1), r, 0.5);
    radii.push(Math.max(0.25, r));
  }
  // A gentle taper at the tail, so a stroke ends like a pen lifting.
  if (taperEnd && pts.length > 6) {
    const n = Math.min(6, Math.floor(pts.length / 3));
    for (let k = 0; k < n; k += 1) radii[pts.length - 1 - k] *= 0.55 + (0.45 * k) / n;
  }

  // 3. Offsets.
  const left = [];
  const right = [];
  for (let i = 0; i < pts.length; i += 1) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    let dx = b[0] - a[0];
    let dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    const nx = -dy;
    const ny = dx;
    const r = radii[i];
    left.push([pts[i][0] + nx * r, pts[i][1] + ny * r]);
    right.push([pts[i][0] - nx * r, pts[i][1] - ny * r]);
  }

  // 4. Caps.
  const first = pts[0];
  const last = pts.at(-1);
  const startAngle = Math.atan2(left[0][1] - first[1], left[0][0] - first[0]);
  const endAngle = Math.atan2(right.at(-1)[1] - last[1], right.at(-1)[0] - last[0]);
  const startCap = arc(first[0], first[1], radii[0], startAngle, startAngle + Math.PI);
  const endCap = arc(last[0], last[1], radii.at(-1), endAngle, endAngle + Math.PI);

  return [...startCap.reverse().slice(1), ...left, ...endCap.reverse().slice(1), ...right.reverse()];
}

const pressureScale = (pressure, thinning) => 1 - thinning + thinning * Math.min(1, Math.max(0, pressure)) * 1.35;

function arc(cx, cy, r, from, to, steps = 8) {
  const out = [];
  for (let i = 0; i <= steps; i += 1) {
    const a = from + ((to - from) * i) / steps;
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return out;
}

const circle = (cx, cy, r) => arc(cx, cy, r, 0, Math.PI * 2, 16);

/** A closed SVG path through a polygon, smoothed with quadratic curves through midpoints. */
export function outlineToPath(points) {
  const n = points.length;
  if (n < 3) return '';
  const fmt = (v) => Math.round(v * 100) / 100;
  let d = `M${fmt((points[0][0] + points[1][0]) / 2)},${fmt((points[0][1] + points[1][1]) / 2)}`;
  for (let i = 1; i <= n; i += 1) {
    const p = points[i % n];
    const q = points[(i + 1) % n];
    d += `Q${fmt(p[0])},${fmt(p[1])} ${fmt((p[0] + q[0]) / 2)},${fmt((p[1] + q[1]) / 2)}`;
  }
  return `${d}Z`;
}
