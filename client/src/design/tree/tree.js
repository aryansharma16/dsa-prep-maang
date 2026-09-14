import { keyBetween } from '../core/fractional.js';

/**
 * A project's folder tree on the client — the explorer, the breadcrumb and
 * optimistic moves all read it through these.
 *
 * Nodes arrive from the server as a flat list (`{ id, parentId, kind,
 * boardKind, name, order }`) and stay that way in state; the tree is derived.
 * Pure, and tested in __tests__/tree.test.js.
 */

const ROOT = '';
const keyOf = (id) => id ?? ROOT;

export const byOrder = (a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : a.id < b.id ? -1 : 1);

/** parentId → children sorted by order. The root's key is ''. */
export function childrenMap(nodes) {
  const map = new Map([[ROOT, []]]);
  for (const node of nodes) {
    const key = keyOf(node.parentId);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(node);
  }
  for (const list of map.values()) list.sort(byOrder);
  return map;
}

export const childrenOf = (map, id) => map.get(keyOf(id)) || [];

/** The rows the explorer draws: depth-first, skipping the insides of collapsed folders. */
export function visibleRows(map, expanded) {
  const rows = [];
  const walk = (parentId, depth) => {
    for (const node of childrenOf(map, parentId)) {
      rows.push({ node, depth });
      if (node.kind === 'folder' && expanded.has(node.id)) walk(node.id, depth + 1);
    }
  };
  walk(null, 0);
  return rows;
}

/** Ancestors of a node, root first — for the breadcrumb, and for expanding the way to a board. */
export function pathTo(byId, id) {
  const path = [];
  const seen = new Set();
  let current = byId.get(id);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    path.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : null;
  }
  return path;
}

/** The first board in tree order, if the project has one. */
export function firstBoard(map, parentId = null) {
  for (const node of childrenOf(map, parentId)) {
    if (node.kind === 'board') return node;
    const inside = firstBoard(map, node.id);
    if (inside) return inside;
  }
  return null;
}

/** Every node beneath `id`, not including it. */
export function descendants(map, id) {
  const out = [];
  const stack = [...childrenOf(map, id)];
  while (stack.length) {
    const node = stack.pop();
    out.push(node);
    stack.push(...childrenOf(map, node.id));
  }
  return out;
}

export function isWithin(byId, candidateId, ancestorId) {
  const seen = new Set();
  let current = byId.get(candidateId);
  while (current && !seen.has(current.id)) {
    if (current.id === ancestorId) return true;
    seen.add(current.id);
    current = current.parentId ? byId.get(current.parentId) : null;
  }
  return false;
}

/**
 * Turns a drop — "before X", "after X", "inside folder X" — into the
 * `{ parentId, after }` the move endpoint takes, plus the order key the client
 * can show immediately. Returns null for a drop that would change nothing or
 * is not allowed (a folder into itself).
 */
export function resolveDrop(map, byId, draggedId, target, position) {
  const dragged = byId.get(draggedId);
  if (!dragged || !target || target.id === draggedId) return null;

  let parentId;
  let afterId;
  if (position === 'inside') {
    if (target.kind !== 'folder') return null;
    parentId = target.id;
    const siblings = childrenOf(map, parentId).filter((n) => n.id !== draggedId);
    afterId = siblings.at(-1)?.id ?? null;
  } else {
    parentId = target.parentId ?? null;
    const siblings = childrenOf(map, parentId).filter((n) => n.id !== draggedId);
    const index = siblings.findIndex((n) => n.id === target.id);
    afterId = position === 'after' ? target.id : index > 0 ? siblings[index - 1].id : null;
  }

  if (dragged.kind === 'folder' && parentId && isWithin(byId, parentId, draggedId)) return null;

  const siblings = childrenOf(map, parentId).filter((n) => n.id !== draggedId);
  const index = afterId ? siblings.findIndex((n) => n.id === afterId) : -1;
  const lo = index >= 0 ? siblings[index].order : null;
  const hi = siblings[index + 1]?.order ?? null;

  // Dropped exactly where it already is.
  const current = childrenOf(map, dragged.parentId);
  const at = current.findIndex((n) => n.id === draggedId);
  if ((dragged.parentId ?? null) === parentId && (current[at - 1]?.id ?? null) === afterId) return null;

  let order;
  try {
    order = keyBetween(lo, hi);
  } catch {
    order = keyBetween(siblings.at(-1)?.order ?? null, null);
  }
  return { parentId, after: afterId, order };
}

/** An order key appending to a parent's children. */
export const appendOrder = (map, parentId) => keyBetween(childrenOf(map, parentId).at(-1)?.order ?? null, null);
