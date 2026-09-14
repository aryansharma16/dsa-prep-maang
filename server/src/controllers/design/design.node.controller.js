import { z } from 'zod';
import { BOARD_KINDS, NODE_KINDS } from '../../config/design.js';
import { publicNode } from '../../models/DesignNode.js';
import {
  createNode,
  duplicateBoard,
  moveNode,
  purgeNode,
  renameNode,
  restoreNode,
  trashNode,
} from '../../services/design/tree.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { objectId } from '../../utils/query.js';

/* -------------------------------------------------------------------------- */
/* validation                                                                  */
/* -------------------------------------------------------------------------- */

const name = z.string().trim().min(1, 'Give it a name').max(120);

/**
 * `after` is three-valued on purpose, and the same on create and move:
 * absent appends, `null` puts it first, an id puts it straight after that
 * sibling. One field that says where rather than an index, so a drag computed
 * against a slightly stale tree still lands next to the thing it was dropped on.
 */
const after = objectId.nullable().optional();

export const createNodeSchema = z
  .object({
    id: objectId.optional(),
    kind: z.enum(NODE_KINDS),
    boardKind: z.enum(BOARD_KINDS).optional(),
    name,
    parentId: objectId.nullable().default(null),
    after,
  })
  .strict()
  .refine((body) => body.kind !== 'board' || body.boardKind, {
    message: 'A board needs a kind',
    path: ['boardKind'],
  })
  .refine((body) => body.kind !== 'folder' || !body.boardKind, {
    message: 'A folder has no board kind',
    path: ['boardKind'],
  });

export const renameSchema = z.object({ name }).strict();

export const moveSchema = z.object({ parentId: objectId.nullable(), after }).strict();

export const duplicateSchema = z.object({ name: name.optional() }).strict();

/* -------------------------------------------------------------------------- */
/* handlers                                                                    */
/* -------------------------------------------------------------------------- */

const context = (req) => ({ ...req.design, userId: req.userId });

export const create = asyncHandler(async (req, res) => {
  const { node, treeRev } = await createNode(context(req), req.body);
  res.status(201).json({ node: publicNode(node), treeRev });
});

export const rename = asyncHandler(async (req, res) => {
  const { node, treeRev } = await renameNode(context(req), req.body.name);
  res.json({ node: publicNode(node), treeRev });
});

export const move = asyncHandler(async (req, res) => {
  const { node, treeRev } = await moveNode(context(req), req.body);
  res.json({ node: publicNode(node), treeRev });
});

export const duplicate = asyncHandler(async (req, res) => {
  const { node, treeRev } = await duplicateBoard(context(req), req.body);
  res.status(201).json({ node: publicNode(node), treeRev });
});

export const remove = asyncHandler(async (req, res) => {
  const { ids, treeRev } = await trashNode(context(req));
  res.json({ ok: true, ids, treeRev });
});

export const restore = asyncHandler(async (req, res) => {
  const { nodes, treeRev } = await restoreNode(context(req));
  res.json({ nodes: nodes.map(publicNode), treeRev });
});

export const purge = asyncHandler(async (req, res) => {
  const { ids, elements } = await purgeNode(context(req));
  res.json({ ok: true, ids, elements });
});
