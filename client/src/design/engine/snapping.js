/**
 * Alignment snapping while moving and resizing — the red guides Figma draws
 * when an edge or centre lines up with something else on the board.
 *
 * Candidates are gathered once when a drag starts (the edges and centres of
 * everything visible that is not being dragged) into sorted arrays, so every
 * pointer move is a handful of binary searches rather than a scan of the board.
 *
 * Pure: bounds in, offsets and guide lines out.
 */

/** Sorted candidate stops along each axis, each remembering the bounds it came from. */
export function buildSnapTargets(boundsList) {
  const xs = [];
  const ys = [];
  for (const b of boundsList) {
    const cx = (b.minX + b.maxX) / 2;
    const cy = (b.minY + b.maxY) / 2;
    for (const at of [b.minX, cx, b.maxX]) xs.push({ at, b });
    for (const at of [b.minY, cy, b.maxY]) ys.push({ at, b });
  }
  xs.sort((p, q) => p.at - q.at);
  ys.sort((p, q) => p.at - q.at);
  return { xs, ys };
}

function nearest(stops, value) {
  let lo = 0;
  let hi = stops.length - 1;
  if (hi < 0) return null;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (stops[mid].at < value) lo = mid + 1;
    else hi = mid;
  }
  const candidates = [stops[lo], stops[lo - 1]].filter(Boolean);
  let best = null;
  for (const c of candidates) if (!best || Math.abs(c.at - value) < Math.abs(best.at - value)) best = c;
  return best;
}

/**
 * The smallest offset along one axis that lines one of `values` up with a
 * target, if any is within `threshold`.
 */
function snapAxis(stops, values, threshold) {
  let best = null;
  for (const value of values) {
    const hit = nearest(stops, value);
    if (!hit) continue;
    const delta = hit.at - value;
    if (Math.abs(delta) <= threshold && (!best || Math.abs(delta) < Math.abs(best.delta))) best = { delta, at: hit.at };
  }
  return best;
}

/** Guide segments along `axis` at every stop exactly aligned with one of the moved values. */
function guidesFor(axis, stops, moved, values) {
  const lines = [];
  const seen = new Set();
  for (const value of values) {
    for (const stop of stops) {
      if (Math.abs(stop.at - value) > 0.5) continue;
      const key = Math.round(value * 2);
      const other = stop.b;
      const from = axis === 'x' ? Math.min(moved.minY, other.minY) : Math.min(moved.minX, other.minX);
      const to = axis === 'x' ? Math.max(moved.maxY, other.maxY) : Math.max(moved.maxX, other.maxX);
      if (seen.has(key)) {
        const line = lines.find((l) => Math.round(l.at * 2) === key);
        line.from = Math.min(line.from, from);
        line.to = Math.max(line.to, to);
      } else {
        seen.add(key);
        lines.push({ axis, at: stop.at, from, to });
      }
    }
  }
  return lines;
}

/**
 * Snaps a moving box. Returns `{ dx, dy, lines }`: the correction to apply and
 * the guides to draw.
 */
export function snapMove(targets, bounds, threshold) {
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  const sx = snapAxis(targets.xs, [bounds.minX, cx, bounds.maxX], threshold);
  const sy = snapAxis(targets.ys, [bounds.minY, cy, bounds.maxY], threshold);
  const dx = sx?.delta ?? 0;
  const dy = sy?.delta ?? 0;
  const moved = { minX: bounds.minX + dx, minY: bounds.minY + dy, maxX: bounds.maxX + dx, maxY: bounds.maxY + dy };
  const mcx = cx + dx;
  const mcy = cy + dy;
  const lines = [
    ...(sx ? guidesFor('x', targets.xs, moved, [moved.minX, mcx, moved.maxX]) : []),
    ...(sy ? guidesFor('y', targets.ys, moved, [moved.minY, mcy, moved.maxY]) : []),
  ];
  return { dx, dy, lines };
}

/**
 * Snaps the moving edges of a resize. `edges` says which move: `{ left, right,
 * top, bottom }` booleans. Returns corrections per edge.
 */
export function snapResize(targets, bounds, edges, threshold) {
  const result = { left: 0, right: 0, top: 0, bottom: 0, lines: [] };
  const xValues = [edges.left && bounds.minX, edges.right && bounds.maxX].filter((v) => v !== false);
  const yValues = [edges.top && bounds.minY, edges.bottom && bounds.maxY].filter((v) => v !== false);
  const sx = xValues.length ? snapAxis(targets.xs, xValues, threshold) : null;
  const sy = yValues.length ? snapAxis(targets.ys, yValues, threshold) : null;
  if (sx) {
    if (edges.left && Math.abs(bounds.minX + sx.delta - sx.at) < 0.5) result.left = sx.delta;
    else if (edges.right) result.right = sx.delta;
  }
  if (sy) {
    if (edges.top && Math.abs(bounds.minY + sy.delta - sy.at) < 0.5) result.top = sy.delta;
    else if (edges.bottom) result.bottom = sy.delta;
  }
  const moved = {
    minX: bounds.minX + result.left,
    maxX: bounds.maxX + result.right,
    minY: bounds.minY + result.top,
    maxY: bounds.maxY + result.bottom,
  };
  if (sx) result.lines.push(...guidesFor('x', targets.xs, moved, [edges.left ? moved.minX : null, edges.right ? moved.maxX : null].filter((v) => v != null)));
  if (sy) result.lines.push(...guidesFor('y', targets.ys, moved, [edges.top ? moved.minY : null, edges.bottom ? moved.maxY : null].filter((v) => v != null)));
  return result;
}
