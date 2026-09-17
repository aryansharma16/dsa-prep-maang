/**
 * Data-structure blocks: arrays, stacks, queues, linked lists, call stacks, hash
 * maps, binary trees, matrices, shards and hash rings — as editable diagrams.
 *
 * A block stores its content as plain text (`data.text`, one item per line, or
 * LeetCode-style `[1,2,null,3]` for trees) and a `kind`. Everything drawn is
 * derived from that text by `layoutStructure`, which returns the block's size
 * and a flat list of primitives in local coordinates — rects, texts, lines,
 * arrows, circles, cylinders — that one generic view renders. Pure, so sizes are
 * known without the DOM (the text is monospace and measured by character
 * count), and every kind is testable.
 *
 * Text conventions shared by all kinds: a leading `*` highlights an item
 * ("*7" draws 7 in the accent colour). Empty lines are ignored.
 */

export const STRUCTURE_KINDS = [
  { id: 'array', label: 'Array', example: '3\n8\n*1\n9\n4', keywords: 'list vector index contiguous', about: 'Contiguous, indexed: O(1) access, O(n) insert in the middle.' },
  { id: 'stack', label: 'Stack', example: '*top call\nsecond\nthird', keywords: 'lifo push pop undo', about: 'LIFO — push and pop at the top in O(1). First line is the top.' },
  { id: 'queue', label: 'Queue', example: '*A\nB\nC\nD', keywords: 'fifo enqueue dequeue bfs', about: 'FIFO — enqueue at the rear, dequeue at the front. First line is the front.' },
  { id: 'linkedlist', label: 'Linked list', example: '1\n2\n3\n4', keywords: 'singly node pointer next', about: 'Nodes pointing to the next; O(1) insert at a known node, O(n) search.' },
  { id: 'doublylinkedlist', label: 'Doubly linked list', example: 'A\nB\nC', keywords: 'dll prev next lru', about: 'Nodes point both ways; O(1) removal of a known node (LRU cache).' },
  { id: 'callstack', label: 'Call stack', example: '*fib(1)\nfib(2)\nfib(3)\nmain()', keywords: 'recursion frames stack trace', about: 'One frame per active call; the first line is the running (top) frame.' },
  { id: 'hashmap', label: 'Hash map', example: 'alice: 42\nbob: 17\n*carol: 99', keywords: 'hash table dictionary dict map object kv', about: 'Key → value with O(1) average lookup. One "key: value" per line.' },
  { id: 'tree', label: 'Binary tree', example: '[8,3,10,1,6,null,14,null,null,4,7]', keywords: 'bst binary search tree heap priority queue leetcode', about: 'Level order like LeetCode — null for a missing child. Heaps and BSTs too.' },
  { id: 'matrix', label: 'Matrix / grid', example: '1 0 1\n0 *1 0\n1 1 1', keywords: 'grid 2d dp', about: 'Rows on lines, cells separated by spaces or commas (DP tables, grids).' },
  { id: 'shards', label: 'Shards', example: 'Shard 1: users A–H\nShard 2: users I–P\nShard 3: users Q–Z', keywords: 'sharding partition partitioning horizontal scaling', about: 'Horizontal partitioning: "name: key range" per line.' },
  { id: 'hashring', label: 'Hash ring', example: 'node-A\nnode-B\nnode-C\nnode-D', keywords: 'consistent hashing ring virtual nodes', about: 'Consistent hashing: nodes on a ring; adding one moves only ~1/N keys.' },
];

export const STRUCTURE_BY_ID = Object.fromEntries(STRUCTURE_KINDS.map((k) => [k.id, k]));

export const STRUCTURE_FONT = { s: 12, m: 14, l: 17 };
const CHAR = 0.62; // monospace advance as a fraction of the font size, with a little slack

/** "*x" → { text: 'x', hot: true } */
function item(raw) {
  const trimmed = raw.trim();
  return trimmed.startsWith('*') ? { text: trimmed.slice(1).trim(), hot: true } : { text: trimmed, hot: false };
}

export const lines = (text) =>
  String(text ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

const textWidth = (s, font) => Math.ceil(String(s).length * font * CHAR);

/* -------------------------------------------------------------------------- */

function metrics(size) {
  const font = STRUCTURE_FONT[size] || STRUCTURE_FONT.m;
  return { font, small: Math.round(font * 0.78), cellH: Math.round(font * 2.3), pad: Math.round(font * 0.7), gap: Math.round(font * 1.8) };
}

/** Places a title above the content: shifts every primitive down and widens the box if needed. */
function withTitle(result, title, m) {
  if (!title) return result;
  const offset = m.small + 12;
  const shifted = result.parts.map((p) => shift(p, 0, offset));
  const w = Math.max(result.w, textWidth(title, m.small) + 8);
  shifted.unshift({ t: 'text', x: 4, y: m.small / 2 + 2, text: title, size: m.small, anchor: 'start', muted: true, bold: true });
  return { w, h: result.h + offset, parts: shifted };
}

function shift(p, dx, dy) {
  switch (p.t) {
    case 'line':
    case 'arrow':
      return { ...p, points: p.points.map(([x, y]) => [x + dx, y + dy]) };
    case 'circle':
      return { ...p, cx: p.cx + dx, cy: p.cy + dy };
    default:
      return { ...p, x: p.x + dx, y: p.y + dy };
  }
}

/** Moves everything so the content starts at (0, 0) and reports its size. */
function normalise(parts) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const grow = (x0, y0, x1, y1) => {
    minX = Math.min(minX, x0);
    minY = Math.min(minY, y0);
    maxX = Math.max(maxX, x1);
    maxY = Math.max(maxY, y1);
  };
  for (const p of parts) {
    if (p.t === 'rect' || p.t === 'cylinder') grow(p.x, p.y, p.x + p.w, p.y + p.h);
    else if (p.t === 'circle') grow(p.cx - p.r, p.cy - p.r, p.cx + p.r, p.cy + p.r);
    else if (p.t === 'line' || p.t === 'arrow') for (const [x, y] of p.points) grow(x, y, x, y);
    else if (p.t === 'text') {
      const w = textWidth(p.text, p.size);
      const x0 = p.anchor === 'start' ? p.x : p.anchor === 'end' ? p.x - w : p.x - w / 2;
      grow(x0, p.y - p.size * 0.7, x0 + w, p.y + p.size * 0.7);
    }
  }
  if (!parts.length) return { w: 80, h: 40, parts };
  const pad = 2;
  return { w: Math.ceil(maxX - minX + pad * 2), h: Math.ceil(maxY - minY + pad * 2), parts: parts.map((p) => shift(p, pad - minX, pad - minY)) };
}

const placeholder = (m, label) => normalise([{ t: 'rect', x: 0, y: 0, w: textWidth(label, m.small) + m.pad * 2, h: m.cellH, dashed: true }, { t: 'text', x: (textWidth(label, m.small) + m.pad * 2) / 2, y: m.cellH / 2, text: label, size: m.small, muted: true }]);

/* -------------------------------------------------------------------------- */
/* sequences: array, stack, queue                                              */
/* -------------------------------------------------------------------------- */

function cellRow(items, m, { vertical, index, labels = {} }) {
  const cellW = Math.max(m.font * 2.6, ...items.map((it) => textWidth(it.text, m.font) + m.pad * 2));
  const parts = [];
  items.forEach((it, i) => {
    const x = vertical ? 0 : i * cellW;
    const y = vertical ? i * m.cellH : 0;
    parts.push({ t: 'rect', x, y, w: cellW, h: m.cellH, hot: it.hot });
    parts.push({ t: 'text', x: x + cellW / 2, y: y + m.cellH / 2, text: it.text, size: m.font, hot: it.hot });
    if (index) {
      if (vertical) parts.push({ t: 'text', x: -8, y: y + m.cellH / 2, text: String(i), size: m.small, anchor: 'end', muted: true });
      else parts.push({ t: 'text', x: x + cellW / 2, y: m.cellH + m.small, text: String(i), size: m.small, muted: true });
    }
    const label = labels[i];
    if (label) {
      if (vertical) {
        const lx = index ? -8 - textWidth(String(items.length - 1), m.small) - 14 : -10;
        parts.push({ t: 'arrow', points: [[lx + 2, y + m.cellH / 2], [-3, y + m.cellH / 2]] });
        parts.push({ t: 'text', x: lx - 4, y: y + m.cellH / 2, text: label, size: m.small, anchor: 'end', muted: true });
      } else {
        const below = index ? m.cellH + m.small * 2 + 6 : m.cellH + 12;
        parts.push({ t: 'arrow', points: [[x + cellW / 2, below + 2], [x + cellW / 2, m.cellH + (index ? m.small + 8 : 3)]] });
        parts.push({ t: 'text', x: x + cellW / 2, y: below + m.small, text: label, size: m.small, muted: true });
      }
    }
  });
  return parts;
}

function layoutArray(items, m, vertical) {
  return normalise(cellRow(items, m, { vertical, index: true }));
}

function layoutStack(items, m, vertical) {
  // First line is the top: at the top of a vertical stack, at the right end of a horizontal one.
  const ordered = vertical ? items : [...items].reverse();
  const topIndex = vertical ? 0 : ordered.length - 1;
  const parts = cellRow(ordered, m, { vertical, labels: { [topIndex]: 'top' } });
  // An open container: a floor under a vertical stack, a wall at the left of a horizontal one.
  const cellW = parts.find((p) => p.t === 'rect')?.w || 0;
  if (vertical) parts.push({ t: 'line', points: [[-6, ordered.length * m.cellH + 5], [cellW + 6, ordered.length * m.cellH + 5]], strong: true });
  else parts.push({ t: 'line', points: [[-5, -6], [-5, m.cellH + 6]], strong: true });
  return normalise(parts);
}

function layoutQueue(items, m, vertical) {
  const last = items.length - 1;
  const labels = last === 0 ? { 0: 'front · rear' } : { 0: 'front', [last]: 'rear' };
  const parts = cellRow(items, m, { vertical, labels });
  const cellW = parts.find((p) => p.t === 'rect')?.w || 0;
  // Out of the front, into the rear.
  if (vertical) {
    parts.push({ t: 'arrow', points: [[cellW / 2, -4], [cellW / 2, -m.gap]] });
    parts.push({ t: 'arrow', points: [[cellW / 2, items.length * m.cellH + m.gap], [cellW / 2, items.length * m.cellH + 4]] });
  } else {
    parts.push({ t: 'arrow', points: [[-4, m.cellH / 2], [-m.gap, m.cellH / 2]] });
    parts.push({ t: 'arrow', points: [[items.length * cellW + m.gap, m.cellH / 2], [items.length * cellW + 4, m.cellH / 2]] });
  }
  return normalise(parts);
}

/* -------------------------------------------------------------------------- */
/* linked lists                                                                */
/* -------------------------------------------------------------------------- */

function layoutLinkedList(items, m, vertical, doubly) {
  const valueW = Math.max(m.font * 2.2, ...items.map((it) => textWidth(it.text, m.font) + m.pad * 2));
  const ptrW = Math.round(m.font * 1.3);
  const nodeW = valueW + ptrW * (doubly ? 2 : 1);
  const gap = doubly ? Math.round(m.gap * 1.5) : m.gap;
  const step = vertical ? m.cellH + gap : nodeW + gap;
  const parts = [];
  items.forEach((it, i) => {
    const x = vertical ? 0 : i * step;
    const y = vertical ? i * step : 0;
    const vx = x + (doubly ? ptrW : 0);
    parts.push({ t: 'rect', x, y, w: nodeW, h: m.cellH, hot: it.hot, r: 6 });
    parts.push({ t: 'text', x: vx + valueW / 2, y: y + m.cellH / 2, text: it.text, size: m.font, hot: it.hot });
    parts.push({ t: 'line', points: [[vx + valueW, y], [vx + valueW, y + m.cellH]] });
    parts.push({ t: 'circle', cx: vx + valueW + ptrW / 2, cy: y + m.cellH / 2, r: 2.5, filled: true });
    if (doubly) {
      parts.push({ t: 'line', points: [[vx, y], [vx, y + m.cellH]] });
      parts.push({ t: 'circle', cx: x + ptrW / 2, cy: y + m.cellH / 2, r: 2.5, filled: true });
    }
    const hasNext = i < items.length - 1;
    const nextX = vertical ? x : x + step;
    const nextY = vertical ? y + step : y;
    if (vertical) {
      const px = vx + valueW + ptrW / 2;
      if (hasNext) parts.push({ t: 'arrow', points: [[px, y + m.cellH / 2], [px, nextY - 2]] });
      if (doubly && hasNext) parts.push({ t: 'arrow', points: [[x + ptrW / 2, nextY + m.cellH / 2], [x + ptrW / 2, y + m.cellH + 2]] });
    } else {
      const py = doubly ? y + m.cellH * 0.35 : y + m.cellH / 2;
      if (hasNext) parts.push({ t: 'arrow', points: [[vx + valueW + ptrW / 2, py], [nextX - 2, py]] });
      if (doubly && hasNext) parts.push({ t: 'arrow', points: [[nextX + ptrW / 2, y + m.cellH * 0.65], [x + nodeW + 2, y + m.cellH * 0.65]] });
    }
  });
  // head → first node, last next → null (and null ← first prev when doubly).
  if (vertical) {
    parts.push({ t: 'text', x: -10, y: m.cellH / 2, text: 'head', size: m.small, anchor: 'end', muted: true });
    const lastY = (items.length - 1) * step;
    parts.push({ t: 'arrow', points: [[nodeW - (doubly ? 0 : 0) - ptrW / 2, lastY + m.cellH / 2], [nodeW - ptrW / 2, lastY + m.cellH + m.gap * 0.6]] });
    parts.push({ t: 'text', x: nodeW - ptrW / 2, y: lastY + m.cellH + m.gap * 0.6 + m.small, text: 'null', size: m.small, muted: true });
  } else {
    parts.push({ t: 'text', x: 0, y: -m.small, text: 'head', size: m.small, anchor: 'start', muted: true });
    const lastX = (items.length - 1) * step;
    const py = doubly ? m.cellH * 0.35 : m.cellH / 2;
    parts.push({ t: 'arrow', points: [[lastX + nodeW - ptrW / 2, py], [lastX + nodeW + m.gap * 0.9, py]] });
    parts.push({ t: 'text', x: lastX + nodeW + m.gap * 0.9 + 8, y: py, text: 'null', size: m.small, anchor: 'start', muted: true });
    if (doubly) {
      parts.push({ t: 'arrow', points: [[ptrW / 2, m.cellH * 0.65], [-m.gap * 0.9, m.cellH * 0.65]] });
      parts.push({ t: 'text', x: -m.gap * 0.9 - 8, y: m.cellH * 0.65, text: 'null', size: m.small, anchor: 'end', muted: true });
    }
  }
  return normalise(parts);
}

/* -------------------------------------------------------------------------- */
/* call stack, hash map                                                        */
/* -------------------------------------------------------------------------- */

function layoutCallStack(items, m) {
  const w = Math.max(m.font * 9, ...items.map((it) => textWidth(it.text, m.font) + m.pad * 2 + 8));
  const h = Math.round(m.cellH * 1.05);
  const parts = [];
  items.forEach((it, i) => {
    const y = i * (h + 4);
    parts.push({ t: 'rect', x: 0, y, w, h, hot: it.hot || i === 0, r: 5 });
    parts.push({ t: 'text', x: m.pad + 4, y: y + h / 2, text: it.text, size: m.font, anchor: 'start', hot: it.hot || i === 0 });
  });
  parts.push({ t: 'text', x: w + 10, y: h / 2, text: '← top', size: m.small, anchor: 'start', muted: true });
  return normalise(parts);
}

function layoutHashMap(items, m) {
  const rows = items.map((it) => {
    const at = it.text.indexOf(':');
    return at < 0 ? { key: it.text, value: '', hot: it.hot } : { key: it.text.slice(0, at).trim(), value: it.text.slice(at + 1).trim(), hot: it.hot };
  });
  const keyW = Math.max(textWidth('key', m.small) + m.pad * 2, ...rows.map((r) => textWidth(r.key, m.font) + m.pad * 2));
  const valueW = Math.max(textWidth('value', m.small) + m.pad * 2, ...rows.map((r) => textWidth(r.value, m.font) + m.pad * 2));
  const headH = Math.round(m.cellH * 0.8);
  const parts = [
    { t: 'rect', x: 0, y: 0, w: keyW + valueW, h: headH + rows.length * m.cellH, r: 6 },
    { t: 'text', x: m.pad, y: headH / 2, text: 'key', size: m.small, anchor: 'start', muted: true, bold: true },
    { t: 'text', x: keyW + m.pad, y: headH / 2, text: 'value', size: m.small, anchor: 'start', muted: true, bold: true },
    { t: 'line', points: [[0, headH], [keyW + valueW, headH]] },
    { t: 'line', points: [[keyW, 0], [keyW, headH + rows.length * m.cellH]] },
  ];
  rows.forEach((r, i) => {
    const y = headH + i * m.cellH;
    if (i) parts.push({ t: 'line', points: [[0, y], [keyW + valueW, y]], faint: true });
    if (r.hot) parts.push({ t: 'rect', x: 1, y: y + 1, w: keyW + valueW - 2, h: m.cellH - 2, hot: true, ghost: true });
    parts.push({ t: 'text', x: m.pad, y: y + m.cellH / 2, text: r.key, size: m.font, anchor: 'start', hot: r.hot });
    parts.push({ t: 'text', x: keyW + m.pad, y: y + m.cellH / 2, text: r.value, size: m.font, anchor: 'start', hot: r.hot });
  });
  return normalise(parts);
}

/* -------------------------------------------------------------------------- */
/* binary tree (LeetCode level order)                                          */
/* -------------------------------------------------------------------------- */

/** Parses "[1,2,null,3]" / "1 2 null 3" / one per line into a tree of { text, hot, left, right }. */
export function parseLevelOrder(text) {
  const tokens = String(text ?? '')
    .replace(/[[\]]/g, ' ')
    .split(/[\s,]+/)
    .filter(Boolean);
  if (!tokens.length || isNull(tokens[0])) return null;
  const root = { ...item(tokens[0]), left: null, right: null };
  const queue = [root];
  let i = 1;
  while (queue.length && i < tokens.length) {
    const node = queue.shift();
    for (const side of ['left', 'right']) {
      if (i >= tokens.length) break;
      const token = tokens[i];
      i += 1;
      if (isNull(token)) continue;
      node[side] = { ...item(token), left: null, right: null };
      queue.push(node[side]);
    }
  }
  return root;
}

const isNull = (token) => /^(null|nil|none|-|_|#)$/i.test(token);

function layoutTree(text, m) {
  const root = parseLevelOrder(text);
  if (!root) return placeholder(m, 'empty tree');
  // x by in-order position, y by depth: simple and never overlaps.
  const nodes = [];
  let order = 0;
  const walk = (node, depth) => {
    if (!node) return;
    walk(node.left, depth + 1);
    node.order = order;
    node.depth = depth;
    order += 1;
    nodes.push(node);
    walk(node.right, depth + 1);
  };
  walk(root, 0);
  const r = Math.max(m.font * 1.15, ...nodes.map((n) => textWidth(n.text, m.font) / 2 + 6));
  const dx = r * 2 + m.font * 0.5;
  const dy = r * 2 + m.font * 1.2;
  const pos = (n) => [n.order * dx + r, n.depth * dy + r];
  const parts = [];
  for (const n of nodes) {
    const [x, y] = pos(n);
    for (const child of [n.left, n.right]) {
      if (!child) continue;
      const [cx, cy] = pos(child);
      const len = Math.hypot(cx - x, cy - y) || 1;
      const ux = (cx - x) / len;
      const uy = (cy - y) / len;
      parts.push({ t: 'line', points: [[x + ux * r, y + uy * r], [cx - ux * r, cy - uy * r]] });
    }
  }
  for (const n of nodes) {
    const [x, y] = pos(n);
    parts.push({ t: 'circle', cx: x, cy: y, r, hot: n.hot });
    parts.push({ t: 'text', x, y, text: n.text, size: m.font, hot: n.hot });
  }
  return normalise(parts);
}

/* -------------------------------------------------------------------------- */
/* matrix, shards, hash ring                                                   */
/* -------------------------------------------------------------------------- */

function layoutMatrix(text, m) {
  const rows = lines(text).map((line) => line.split(/[\s,]+/).filter(Boolean).map(item));
  if (!rows.length) return placeholder(m, 'empty matrix');
  const cols = Math.max(...rows.map((row) => row.length));
  const cellW = Math.max(m.font * 2.2, ...rows.flat().map((it) => textWidth(it.text, m.font) + m.pad * 2));
  const cellH = Math.round(m.cellH * 0.9);
  const parts = [];
  rows.forEach((row, r) => {
    parts.push({ t: 'text', x: -8, y: r * cellH + cellH / 2, text: String(r), size: m.small, anchor: 'end', muted: true });
    for (let c = 0; c < cols; c += 1) {
      const it = row[c];
      parts.push({ t: 'rect', x: c * cellW, y: r * cellH, w: cellW, h: cellH, hot: it?.hot, r: 0 });
      if (it) parts.push({ t: 'text', x: c * cellW + cellW / 2, y: r * cellH + cellH / 2, text: it.text, size: m.font, hot: it.hot });
    }
  });
  for (let c = 0; c < cols; c += 1) parts.push({ t: 'text', x: c * cellW + cellW / 2, y: -m.small, text: String(c), size: m.small, muted: true });
  return normalise(parts);
}

function layoutShards(items, m) {
  const shards = items.map((it) => {
    const at = it.text.indexOf(':');
    return at < 0 ? { name: it.text, range: '', hot: it.hot } : { name: it.text.slice(0, at).trim(), range: it.text.slice(at + 1).trim(), hot: it.hot };
  });
  const w = Math.max(m.font * 5, ...shards.map((s) => Math.max(textWidth(s.name, m.font), textWidth(s.range, m.small)) + m.pad * 2));
  const h = Math.round(m.cellH * 2.4);
  const parts = [];
  shards.forEach((s, i) => {
    const x = i * (w + m.gap * 0.6);
    parts.push({ t: 'cylinder', x, y: 0, w, h, hot: s.hot });
    parts.push({ t: 'text', x: x + w / 2, y: h * 0.52, text: s.name, size: m.font, hot: s.hot, bold: true });
    if (s.range) parts.push({ t: 'text', x: x + w / 2, y: h + m.small + 2, text: s.range, size: m.small, muted: true });
  });
  return normalise(parts);
}

function layoutHashRing(items, m) {
  const n = items.length;
  const longest = Math.max(...items.map((it) => textWidth(it.text, m.small)));
  const radius = Math.max(m.font * 4, n * m.font * 0.9);
  const parts = [{ t: 'circle', cx: 0, cy: 0, r: radius }];
  items.forEach((it, i) => {
    const angle = -Math.PI / 2 + (i / n) * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    parts.push({ t: 'circle', cx: x, cy: y, r: m.font * 0.45, filled: true, hot: it.hot });
    const lx = Math.cos(angle) * (radius + m.font * 0.9);
    const ly = Math.sin(angle) * (radius + m.font * 0.9);
    const anchor = Math.abs(Math.cos(angle)) < 0.3 ? 'middle' : Math.cos(angle) > 0 ? 'start' : 'end';
    parts.push({ t: 'text', x: lx, y: ly + (Math.abs(Math.cos(angle)) < 0.3 ? Math.sign(Math.sin(angle)) * m.small * 0.4 : 0), text: it.text, size: m.small, anchor, hot: it.hot });
  });
  // Reserve room for the widest label on both sides so the ring stays centred in its box.
  parts.push({ t: 'line', points: [[-radius - m.font - longest, 0], [-radius - m.font - longest, 0]], invisible: true });
  parts.push({ t: 'line', points: [[radius + m.font + longest, 0], [radius + m.font + longest, 0]], invisible: true });
  return normalise(parts);
}

/* -------------------------------------------------------------------------- */

/**
 * The drawing of a block: `{ w, h, parts }` in local coordinates.
 * `data` is the element's data: `{ kind, text, orientation: 'h'|'v', size, title }`.
 */
export function layoutStructure(data) {
  const m = metrics(data.size);
  const kind = STRUCTURE_BY_ID[data.kind] ? data.kind : 'array';
  const items = lines(data.text).map(item);
  const vertical = data.orientation ? data.orientation === 'v' : kind === 'stack' || kind === 'callstack';
  let result;
  if (kind === 'tree') result = layoutTree(data.text, m);
  else if (kind === 'matrix') result = layoutMatrix(data.text, m);
  else if (!items.length) result = placeholder(m, `empty ${STRUCTURE_BY_ID[kind].label.toLowerCase()}`);
  else if (kind === 'array') result = layoutArray(items, m, vertical);
  else if (kind === 'stack') result = layoutStack(items, m, vertical);
  else if (kind === 'queue') result = layoutQueue(items, m, vertical);
  else if (kind === 'linkedlist') result = layoutLinkedList(items, m, vertical, false);
  else if (kind === 'doublylinkedlist') result = layoutLinkedList(items, m, vertical, true);
  else if (kind === 'callstack') result = layoutCallStack(items, m);
  else if (kind === 'hashmap') result = layoutHashMap(items, m);
  else if (kind === 'shards') result = layoutShards(items, m);
  else result = layoutHashRing(items, m);
  return withTitle(result, data.title, m);
}
