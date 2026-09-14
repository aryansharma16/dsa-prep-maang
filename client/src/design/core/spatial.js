/**
 * Which elements are near a point or inside a rectangle, without looking at all of them.
 *
 * A uniform grid over world space: each element is listed in every cell its
 * bounds touch, so a query reads only the cells it covers. Boards are sparse
 * and elements are roughly similar in size, which is the case a grid handles
 * best — simpler and faster to update than an R-tree, and updates are the hot
 * path here (a drag moves elements every frame).
 *
 * An element that would cover too many cells (a huge frame, a very long
 * connector) goes on a short "oversized" list that every query also returns,
 * so one giant element cannot make every update expensive.
 *
 * Queries return candidates, not answers: callers still run the exact test.
 */

const MAX_CELLS = 64;

export function createSpatialIndex(cellSize = 512) {
  const cells = new Map(); // "cx:cy" → Set<id>
  const entries = new Map(); // id → { box, keys: string[] | null }
  const oversized = new Set();

  const range = (box) => ({
    x0: Math.floor(box.minX / cellSize),
    y0: Math.floor(box.minY / cellSize),
    x1: Math.floor(box.maxX / cellSize),
    y1: Math.floor(box.maxY / cellSize),
  });

  function detach(id) {
    const entry = entries.get(id);
    if (!entry) return;
    if (entry.keys) {
      for (const key of entry.keys) {
        const set = cells.get(key);
        set.delete(id);
        if (!set.size) cells.delete(key);
      }
    } else {
      oversized.delete(id);
    }
    entries.delete(id);
  }

  /** Adds or moves an element. A missing or non-finite box removes it. */
  function set(id, box) {
    const valid = box && Number.isFinite(box.minX) && Number.isFinite(box.minY) && Number.isFinite(box.maxX) && Number.isFinite(box.maxY);
    if (!valid) {
      detach(id);
      return;
    }
    const previous = entries.get(id);
    if (previous && previous.box.minX === box.minX && previous.box.minY === box.minY && previous.box.maxX === box.maxX && previous.box.maxY === box.maxY) return;
    detach(id);
    const { x0, y0, x1, y1 } = range(box);
    const count = (x1 - x0 + 1) * (y1 - y0 + 1);
    if (count > MAX_CELLS) {
      oversized.add(id);
      entries.set(id, { box: { ...box }, keys: null });
      return;
    }
    const keys = [];
    for (let cx = x0; cx <= x1; cx += 1) {
      for (let cy = y0; cy <= y1; cy += 1) {
        const key = `${cx}:${cy}`;
        let bucket = cells.get(key);
        if (!bucket) cells.set(key, (bucket = new Set()));
        bucket.add(id);
        keys.push(key);
      }
    }
    entries.set(id, { box: { ...box }, keys });
  }

  /** Ids whose stored bounds intersect `box` (edges touching count). */
  function query(box) {
    const out = new Set();
    const intersects = (b) => b.minX <= box.maxX && b.maxX >= box.minX && b.minY <= box.maxY && b.maxY >= box.minY;
    const { x0, y0, x1, y1 } = range(box);
    if ((x1 - x0 + 1) * (y1 - y0 + 1) > cells.size) {
      // A query wider than the populated grid: walking entries is cheaper than walking empty cells.
      for (const [id, entry] of entries) if (intersects(entry.box)) out.add(id);
      return out;
    }
    for (let cx = x0; cx <= x1; cx += 1) {
      for (let cy = y0; cy <= y1; cy += 1) {
        const bucket = cells.get(`${cx}:${cy}`);
        if (!bucket) continue;
        for (const id of bucket) if (!out.has(id) && intersects(entries.get(id).box)) out.add(id);
      }
    }
    for (const id of oversized) if (intersects(entries.get(id).box)) out.add(id);
    return out;
  }

  return {
    set,
    remove: detach,
    query,
    queryPoint: (x, y, tolerance = 0) => query({ minX: x - tolerance, minY: y - tolerance, maxX: x + tolerance, maxY: y + tolerance }),
    has: (id) => entries.has(id),
    boxOf: (id) => entries.get(id)?.box || null,
    clear() {
      cells.clear();
      entries.clear();
      oversized.clear();
    },
    get size() {
      return entries.size;
    },
  };
}
