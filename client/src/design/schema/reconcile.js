/**
 * Keeping a schema board's table positions in step with its DBML text.
 *
 * Each table on the diagram is a `dbtable` element holding where it sits and
 * which table it is (`data.table`, the qualified key). The text changes on every
 * keystroke, and the diagram must not thrash while it does:
 *
 * - **Renames keep their place.** When exactly one table disappears and one
 *   appears, it is the same table renamed — typing "user" → "users" moves no
 *   box. Otherwise a vanished table and a new one with at least half the same
 *   column names are paired too.
 * - **New tables wait until their name settles** (`SETTLE_MS`), so typing a name
 *   does not create "u", "us", "use"… Removed tables wait the same time before
 *   their position is forgotten, so cutting a table to paste it lower keeps it.
 * - **The first time** a board has text but no positions (an import, a paste into
 *   an empty board), everything is created at once.
 *
 * Pure: time comes in as `now`, and the caller keeps `pending` between calls.
 */

export const SETTLE_MS = 1500;

/**
 * @param model     analyzed DBML (`tables[{ key, columns }]`)
 * @param elements  `[{ id, table, columns? }]` — current dbtable elements and the column names last seen for them
 * @param pending   `{ added: Map<key, since>, removed: Map<id, since> }` from the previous call (or empty)
 * @returns `{ create: key[], rename: [{ id, table }], remove: id[], pending, wakeIn }`
 */
export function reconcileTables(model, elements, pending = { added: new Map(), removed: new Map() }, now = Date.now()) {
  const keys = new Set(model.tables.map((t) => t.key));
  const byKey = new Map(model.tables.map((t) => [t.key, t]));
  const placed = new Set(elements.map((e) => e.table));
  const added = model.tables.filter((t) => !placed.has(t.key)).map((t) => t.key);
  const missing = elements.filter((e) => !keys.has(e.table));
  const result = { create: [], rename: [], remove: [], pending: { added: new Map(), removed: new Map() }, wakeIn: 0 };

  if (!elements.length) {
    result.create = added;
    return result;
  }

  // Pair renames.
  const unpairedAdded = new Set(added);
  const unpairedMissing = new Set(missing);
  // One table gone and one new *in the same edit* is a rename. Two that were already waiting to settle
  // did not change together, so they are not paired by count alone.
  const fresh = added.length === 1 && missing.length === 1 && !pending.added.has(added[0]) && !pending.removed.has(missing[0].id);
  if (fresh) {
    result.rename.push({ id: missing[0].id, table: added[0] });
    unpairedAdded.clear();
    unpairedMissing.clear();
  } else {
    for (const element of missing) {
      const before = new Set(element.columns || []);
      if (!before.size) continue;
      let best = null;
      for (const key of unpairedAdded) {
        const names = byKey.get(key).columns.map((c) => c.name);
        const overlap = names.filter((n) => before.has(n)).length / Math.max(before.size, names.length);
        if (overlap >= 0.5 && (!best || overlap > best.overlap)) best = { key, overlap };
      }
      if (best) {
        result.rename.push({ id: element.id, table: best.key });
        unpairedAdded.delete(best.key);
        unpairedMissing.delete(element);
      }
    }
  }

  const wait = (since) => SETTLE_MS - (now - since);
  let wakeIn = Infinity;
  for (const key of unpairedAdded) {
    const since = pending.added.get(key) ?? now;
    if (wait(since) <= 0) result.create.push(key);
    else {
      result.pending.added.set(key, since);
      wakeIn = Math.min(wakeIn, wait(since));
    }
  }
  for (const element of unpairedMissing) {
    const since = pending.removed.get(element.id) ?? now;
    if (wait(since) <= 0) result.remove.push(element.id);
    else {
      result.pending.removed.set(element.id, since);
      wakeIn = Math.min(wakeIn, wait(since));
    }
  }
  result.wakeIn = Number.isFinite(wakeIn) ? Math.max(16, Math.ceil(wakeIn)) : 0;
  return result;
}

/**
 * Where to put tables that just appeared, given the ones already placed:
 * to the right of a table they are related to when there is one, otherwise in
 * a column to the right of everything. `positions`/`sizes` are Map key → {x,y}/{w,h}.
 */
export function placeNewTables(model, positions, sizes, newKeys, gap = { x: 120, y: 48 }) {
  const out = new Map();
  const occupied = [...positions].map(([key, p]) => ({ ...p, ...sizes.get(key) }));
  const overlaps = (box) => occupied.some((o) => box.x < o.x + o.w + 20 && o.x < box.x + box.w + 20 && box.y < o.y + o.h + 20 && o.y < box.y + box.h + 20);
  const rightmost = occupied.reduce((m, o) => Math.max(m, o.x + o.w), 0);
  const top = occupied.reduce((m, o) => Math.min(m, o.y), Infinity);
  for (const key of newKeys) {
    const size = sizes.get(key);
    const neighbour = model.relations
      .flatMap((r) => (r.from.table === key ? [r.to.table] : r.to.table === key ? [r.from.table] : []))
      .find((k) => positions.has(k) || out.has(k));
    let box;
    if (neighbour) {
      const n = positions.get(neighbour) || out.get(neighbour);
      box = { x: n.x + sizes.get(neighbour).w + gap.x, y: n.y, ...size };
    } else {
      box = { x: rightmost + gap.x, y: Number.isFinite(top) ? top : 0, ...size };
    }
    while (overlaps(box)) box.y += gap.y + 20;
    out.set(key, { x: Math.round(box.x), y: Math.round(box.y) });
    occupied.push(box);
  }
  return out;
}

/**
 * The first place near `start` (a top-left corner) where a box of `size` overlaps none of `boxes`:
 * the spot itself, then rings of candidates around it, nearest first — so "Add table" never drops a
 * table on top of another.
 */
export function freeSpot(boxes, size, start, margin = 40) {
  const clear = (x, y) => boxes.every((b) => x >= b.x + b.w + margin || b.x >= x + size.w + margin || y >= b.y + b.h + margin || b.y >= y + size.h + margin);
  if (clear(start.x, start.y)) return { x: start.x, y: start.y };
  const stepX = size.w + margin;
  const stepY = size.h + margin;
  for (let ring = 1; ring <= 12; ring += 1) {
    const candidates = [];
    for (let i = -ring; i <= ring; i += 1) {
      for (let j = -ring; j <= ring; j += 1) {
        if (Math.max(Math.abs(i), Math.abs(j)) !== ring) continue;
        candidates.push({ x: start.x + i * stepX, y: start.y + j * stepY });
      }
    }
    candidates.sort((a, b) => Math.hypot(a.x - start.x, a.y - start.y) - Math.hypot(b.x - start.x, b.y - start.y));
    const found = candidates.find((c) => clear(c.x, c.y));
    if (found) return found;
  }
  const right = boxes.reduce((m, b) => Math.max(m, b.x + b.w), start.x);
  return { x: right + margin, y: start.y };
}
