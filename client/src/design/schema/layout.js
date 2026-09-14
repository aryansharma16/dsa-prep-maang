/**
 * Geometry for schema diagrams: how big a table is, where its column rows are,
 * where a relation leaves and enters, and an automatic arrangement.
 *
 * DOM-free by design (the plan's "header 36, rows 28"): sizes come from
 * character counts with a generous average advance for the canvas font, so the
 * layout is testable and identical everywhere; the view truncates with an
 * ellipsis in the rare case a name is wider than estimated.
 *
 * Auto-arrange is a small layered (Sugiyama-style) layout: referenced tables
 * ("parents") go in earlier columns, tables referencing them after; each column
 * is ordered by the barycentre of its neighbours to reduce crossings; separate
 * groups of related tables are laid out one after another, and unrelated tables
 * fill a grid at the end. It only ever proposes positions — tables stay
 * draggable, and nothing moves unless the user asks for it.
 *
 * Pure.
 */

export const SCHEMA_METRICS = Object.freeze({ headerH: 36, rowH: 28, padX: 12, minW: 180, maxW: 420, charW: 7.4, typeCharW: 6.8, gapX: 120, gapY: 48 });

/** { w, h } of a table box. */
export function tableSize(table, m = SCHEMA_METRICS) {
  const title = (table.schema && table.schema !== 'public' ? `${table.schema}.` : '') + table.name;
  let widest = title.length * m.charW + 40;
  for (const column of table.columns) {
    const type = column.type.name + (column.type.args?.length ? `(${column.type.args.join(',')})` : '') + (column.type.array ? '[]' : '');
    // name … type, plus room for the key/marker icons on the left.
    const badge = (column.unique && !column.pk ? 52 : 0) + (column.enum ? 44 : 0);
    widest = Math.max(widest, m.padX * 2 + 22 + column.name.length * m.charW + 24 + type.length * m.typeCharW + badge);
  }
  return { w: Math.round(Math.min(m.maxW, Math.max(m.minW, widest))), h: m.headerH + Math.max(1, table.columns.length) * m.rowH };
}

/** The world y of a column's row centre, given the table's box. */
export function columnRowY(box, table, columnName, m = SCHEMA_METRICS) {
  const index = table.columns.findIndex((c) => c.name === columnName);
  return box.y + m.headerH + (index < 0 ? 0 : index) * m.rowH + m.rowH / 2;
}

/**
 * Where a relation attaches to its two tables: the rows of its first columns,
 * on whichever sides face each other (both on one side when the tables overlap
 * horizontally, so the line loops out instead of crossing a table).
 */
export function relationEnds(relation, fromTable, fromBox, toTable, toBox, m = SCHEMA_METRICS) {
  const fy = columnRowY(fromBox, fromTable, relation.from.columns[0], m);
  const ty = columnRowY(toBox, toTable, relation.to.columns[0], m);
  const fromCenter = fromBox.x + fromBox.w / 2;
  const toCenter = toBox.x + toBox.w / 2;
  const overlapX = fromBox.x < toBox.x + toBox.w && toBox.x < fromBox.x + fromBox.w;
  let fromSide;
  let toSide;
  if (fromTable === toTable) {
    fromSide = 'right';
    toSide = 'right';
  } else if (overlapX) {
    fromSide = fromCenter <= toCenter ? 'left' : 'right';
    toSide = fromSide;
  } else {
    fromSide = fromCenter < toCenter ? 'right' : 'left';
    toSide = fromSide === 'right' ? 'left' : 'right';
  }
  const at = (box, side, y) => ({ x: side === 'right' ? box.x + box.w : box.x, y, side });
  return { from: at(fromBox, fromSide, fy), to: at(toBox, toSide, ty) };
}

/**
 * An orthogonal path between two relation ends, with a stub out of each side so
 * the cardinality markers sit on a straight run.
 */
export function relationPath(from, to, stub = 28) {
  const dir = (side) => (side === 'right' ? 1 : -1);
  const a = [from.x + dir(from.side) * stub, from.y];
  const b = [to.x + dir(to.side) * stub, to.y];
  if (from.side === to.side) {
    const x = from.side === 'right' ? Math.max(a[0], b[0]) : Math.min(a[0], b[0]);
    return [[from.x, from.y], [x, from.y], [x, to.y], [to.x, to.y]];
  }
  const midX = (a[0] + b[0]) / 2;
  const facing = (from.side === 'right' && a[0] <= b[0]) || (from.side === 'left' && a[0] >= b[0]);
  if (facing) return [[from.x, from.y], [midX, from.y], [midX, to.y], [to.x, to.y]];
  // Ends point away from each other: go around through the gap between the rows.
  const midY = (from.y + to.y) / 2;
  return [[from.x, from.y], a, [a[0], midY], [b[0], midY], b, [to.x, to.y]];
}

/**
 * Positions for every table: Map key → { x, y }. `sizes` is Map key → { w, h }.
 * Deterministic for the same model.
 */
export function autoArrange(model, sizes, m = SCHEMA_METRICS) {
  const keys = model.tables.map((t) => t.key);
  const parents = new Map(keys.map((k) => [k, new Set()]));
  const children = new Map(keys.map((k) => [k, new Set()]));
  const link = (child, parent) => {
    if (child === parent || !parents.has(child) || !parents.has(parent)) return;
    parents.get(child).add(parent);
    children.get(parent).add(child);
  };
  for (const r of model.relations) {
    // The side holding the foreign key is the child: "many" in > and <, `from` in - and <>.
    if (r.op === '<') link(r.to.table, r.from.table);
    else link(r.from.table, r.to.table);
  }

  // Connected components, in the order their first table was written.
  const component = new Map();
  const components = [];
  for (const key of keys) {
    if (component.has(key)) continue;
    const members = [];
    const stack = [key];
    component.set(key, components.length);
    while (stack.length) {
      const k = stack.pop();
      members.push(k);
      for (const n of [...parents.get(k), ...children.get(k)]) {
        if (!component.has(n)) {
          component.set(n, components.length);
          stack.push(n);
        }
      }
    }
    components.push(members.sort((a, b) => keys.indexOf(a) - keys.indexOf(b)));
  }

  const positions = new Map();
  let offsetY = 0;
  const loners = [];

  for (const members of components) {
    if (members.length === 1 && !parents.get(members[0]).size && !children.get(members[0]).size) {
      loners.push(members[0]);
      continue;
    }
    // Layer = longest path from a root, ignoring edges that close a cycle.
    const layer = new Map();
    const visiting = new Set();
    const depth = (k) => {
      if (layer.has(k)) return layer.get(k);
      if (visiting.has(k)) return 0;
      visiting.add(k);
      let d = 0;
      for (const p of parents.get(k)) d = Math.max(d, depth(p) + 1);
      visiting.delete(k);
      layer.set(k, d);
      return d;
    };
    members.forEach(depth);
    const columns = [];
    for (const k of members) {
      const d = layer.get(k);
      (columns[d] ||= []).push(k);
    }
    // Barycentre ordering, two sweeps.
    const order = new Map();
    const reindex = () => columns.forEach((col) => col.forEach((k, i) => order.set(k, i)));
    reindex();
    for (let sweep = 0; sweep < 4; sweep += 1) {
      const forward = sweep % 2 === 0;
      const range = forward ? columns.map((_, i) => i).slice(1) : columns.map((_, i) => i).slice(0, -1).reverse();
      for (const i of range) {
        const neighbours = (k) => [...(forward ? parents.get(k) : children.get(k))].filter((n) => order.has(n));
        columns[i].sort((a, b) => {
          const bary = (k) => {
            const list = neighbours(k);
            return list.length ? list.reduce((s, n) => s + order.get(n), 0) / list.length : order.get(k);
          };
          return bary(a) - bary(b) || keys.indexOf(a) - keys.indexOf(b);
        });
        reindex();
      }
    }
    let x = 0;
    let componentH = 0;
    for (const col of columns) {
      if (!col) continue;
      const colW = Math.max(...col.map((k) => sizes.get(k).w));
      let y = offsetY;
      for (const k of col) {
        positions.set(k, { x, y });
        y += sizes.get(k).h + m.gapY;
      }
      componentH = Math.max(componentH, y - offsetY - m.gapY);
      x += colW + m.gapX;
    }
    offsetY += componentH + m.gapY * 2;
  }

  // Unrelated tables: a grid under everything else, roughly as wide as it is tall.
  if (loners.length) {
    const perRow = Math.max(1, Math.ceil(Math.sqrt(loners.length)));
    let y = offsetY;
    for (let i = 0; i < loners.length; i += perRow) {
      const row = loners.slice(i, i + perRow);
      let x = 0;
      for (const k of row) {
        positions.set(k, { x, y });
        x += sizes.get(k).w + m.gapX / 2;
      }
      y += Math.max(...row.map((k) => sizes.get(k).h)) + m.gapY;
    }
  }
  return positions;
}
