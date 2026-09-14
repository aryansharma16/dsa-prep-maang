/**
 * Ramer–Douglas–Peucker simplification for pen strokes, carrying pressure.
 *
 * A hand-drawn stroke arrives as hundreds of samples a second, most of them
 * redundant. Simplifying at a tolerance measured in *screen* pixels at the zoom
 * it was drawn (the caller converts) keeps the stroke visually identical while
 * storing a fraction of the points.
 */

function perpendicularDistance(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lengthSq = dx * dx + dy * dy;
  if (!lengthSq) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lengthSq));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** @param {number[][]} points [[x, y, pressure], …] */
export function simplifyPoints(points, tolerance) {
  if (points.length <= 2) return points.slice();
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop();
    let maxDistance = 0;
    let index = -1;
    for (let i = start + 1; i < end; i += 1) {
      const d = perpendicularDistance(points[i], points[start], points[end]);
      // A pressure change is worth keeping a point for, even on a straight line.
      const pressureJump = Math.abs((points[i][2] ?? 0.5) - (points[start][2] ?? 0.5)) * tolerance * 4;
      const score = Math.max(d, pressureJump);
      if (score > maxDistance) {
        maxDistance = score;
        index = i;
      }
    }
    if (maxDistance > tolerance && index !== -1) {
      keep[index] = 1;
      stack.push([start, index], [index, end]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** Rounds to a grid of `step` to keep stored numbers short. */
export const quantize = (value, step) => Math.round(value / step) * step;
