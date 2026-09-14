/**
 * The system design module's rules in one place: how big things may get, who
 * may do what, which element types exist, and what a new project starts with.
 *
 * Kept out of the models and services on purpose. These numbers are the ones
 * somebody tunes after watching real boards, and a limit scattered across a
 * schema `max`, a service check and a controller refine is three places to
 * change and two to forget.
 */

/*
  Limits.

  Each one bounds a cost somebody pays. Element and board bytes bound the load
  response and the heap of a 1GiB instance holding it; batch size bounds one
  transaction; node counts bound the in-memory tree walks in tree.service.js,
  which is what lets the tree skip a stored ancestors array; asset bytes bound
  the bucket. None is sized to be reached by someone designing a system — a
  WhatsApp HLD is a few hundred elements — they are sized to be reached by a
  loop.
*/
export const DESIGN_LIMITS = Object.freeze({
  projectsPerOwner: 100,
  boardsPerOwner: 1000,
  nodesPerProject: 2000,
  treeDepth: 12,
  elementsPerBoard: 5000,
  boardBytes: 5 * 1024 * 1024,
  elementBytes: 64 * 1024,
  opsPerBatch: 1000,
  syncBodyBytes: '2mb',
  writeBodyBytes: '256kb',
  sourceChars: 200_000,
  dbTablesPerBoard: 500,
  assetBytesPerProject: 200 * 1024 * 1024,
  imageMb: 10,
  changesPerResponse: 2000,
  batchesRemembered: 50,
  trashDays: 30,
  tombstoneDays: 14,
});

/*
  Roles and what they may do.

  Capability sets rather than a rank, the same shape as config/roles.js, so
  "commenter can suggest but not edit" is a line here rather than an inequality
  every caller has to get right. Only `owner` is reachable in v1 — sharing adds
  rows that name the other three, and nothing that checks a capability changes.
*/
export const DESIGN_CAPS = Object.freeze({
  viewer: Object.freeze(['read']),
  commenter: Object.freeze(['read', 'comment', 'suggest']),
  editor: Object.freeze(['read', 'comment', 'suggest', 'edit']),
  owner: Object.freeze(['read', 'comment', 'suggest', 'edit', 'manage', 'purge', 'share', 'merge']),
});

export const DESIGN_ROLES = Object.freeze(Object.keys(DESIGN_CAPS));

export const designCan = (role, cap) => Boolean(role && DESIGN_CAPS[role]?.includes(cap));

export const BOARD_KINDS = Object.freeze(['canvas', 'schema']);
export const NODE_KINDS = Object.freeze(['folder', 'board']);

/*
  Every element type a board may hold.

  An unknown type is rejected rather than stored, which is what makes the deploy
  order a rule: **ship the server before the client whenever a type is added**,
  or the new client's first save of that type comes back rejected. The reverse —
  an old client meeting a type it does not know — is safe, because the client
  draws a placeholder and never re-sends what it did not write.
*/
export const ELEMENT_TYPES = Object.freeze([
  // Phase 1
  'frame',
  'rect',
  'ellipse',
  'diamond',
  'cylinder',
  'text',
  'paragraph',
  'sticky',
  'connector',
  'stroke',
  // Phase 2
  'dbtable',
  // Phase 3
  'group',
  'image',
  'embed',
  'table',
  'tech',
]);

/*
  What "Start with HLD / LLD / Database folders" creates.

  A folder per layer with one board inside, rather than three boards at the
  root, because the point of the starter is the shape: a place where the second
  HLD board obviously goes.
*/
export const PROJECT_TEMPLATES = Object.freeze({
  blank: Object.freeze([]),
  system: Object.freeze([
    { name: 'HLD', boards: [{ name: 'Architecture', boardKind: 'canvas' }] },
    { name: 'LLD', boards: [{ name: 'Classes & flows', boardKind: 'canvas' }] },
    { name: 'Database', boards: [{ name: 'Schema', boardKind: 'schema' }] },
  ]),
});
