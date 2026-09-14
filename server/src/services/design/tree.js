import { keyBetween } from '../../utils/fractionalIndex.js';

/**
 * Pure helpers over a project's tree, loaded as a flat list of nodes.
 *
 * A project is small enough (config/design.js caps it) that every structural
 * question is cheaper to answer by walking parent pointers in memory than by
 * maintaining an ancestors array on every document. These take `{ _id, parent,
 * kind, order }` shaped objects and never touch the database, so they are
 * tested on their own.
 */

const key = (id) => (id == null ? '' : String(id));

export const byOrder = (a, b) => {
  if (a.order < b.order) return -1;
  if (a.order > b.order) return 1;
  return key(a._id) < key(b._id) ? -1 : 1;
};

export function indexNodes(nodes) {
  return new Map(nodes.map((node) => [key(node._id), node]));
}

export function childrenOf(nodes) {
  const map = new Map();
  for (const node of nodes) {
    const parent = key(node.parent);
    if (!map.has(parent)) map.set(parent, []);
    map.get(parent).push(node);
  }
  return map;
}

/** How many levels down `id` sits. A node at the root is at depth 1; the root itself (null) is 0. */
export function depthOf(byId, id) {
  let depth = 0;
  let current = id == null ? null : byId.get(key(id));
  const seen = new Set();
  while (current && !seen.has(key(current._id))) {
    seen.add(key(current._id));
    depth += 1;
    current = current.parent == null ? null : byId.get(key(current.parent));
  }
  return depth;
}

/** Levels below `id`: a node with no children has height 0. */
export function heightOf(children, id) {
  let height = 0;
  let frontier = children.get(key(id)) || [];
  const seen = new Set([key(id)]);
  while (frontier.length) {
    height += 1;
    const next = [];
    for (const node of frontier) {
      if (seen.has(key(node._id))) continue;
      seen.add(key(node._id));
      next.push(...(children.get(key(node._id)) || []));
    }
    frontier = next;
  }
  return height;
}

/** True when `candidateId` is `ancestorId` or sits anywhere beneath it. */
export function isWithin(byId, candidateId, ancestorId) {
  let current = candidateId == null ? null : byId.get(key(candidateId));
  const seen = new Set();
  while (current && !seen.has(key(current._id))) {
    if (key(current._id) === key(ancestorId)) return true;
    seen.add(key(current._id));
    current = current.parent == null ? null : byId.get(key(current.parent));
  }
  return false;
}

/** `rootId` and every node beneath it, breadth first. */
export function subtreeIds(children, rootId) {
  const out = [];
  const seen = new Set();
  const queue = [key(rootId)];
  while (queue.length) {
    const id = queue.shift();
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    for (const child of children.get(id) || []) queue.push(key(child._id));
  }
  return out;
}

/**
 * An order key for a node placed among `siblings`.
 *
 * `after` undefined appends; `after` null puts it first; an id puts it straight
 * after that sibling — or appends, if that sibling has gone (a drag computed
 * against a tree that changed underneath it should still land somewhere sane).
 */
export function orderAmong(siblings, after, excludeId = null) {
  const list = siblings.filter((node) => key(node._id) !== key(excludeId)).sort(byOrder);
  const last = list.at(-1)?.order ?? null;
  const append = () => keyBetween(last, null);

  if (after === undefined) return append();
  if (after === null) return keyBetween(null, list[0]?.order ?? null);

  const index = list.findIndex((node) => key(node._id) === key(after));
  if (index === -1) return append();
  const lo = list[index].order;
  const hi = list[index + 1]?.order ?? null;
  // Two siblings sharing a key cannot be split; landing at the end beats failing the move.
  if (hi !== null && hi <= lo) return append();
  return keyBetween(lo, hi);
}
