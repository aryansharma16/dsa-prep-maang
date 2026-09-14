import { z } from 'zod';
import { publicBoard } from '../../models/DesignBoard.js';
import { publicNode } from '../../models/DesignNode.js';
import { boardTag, changesSince, commitOps, compactTombstones, loadBoard } from '../../services/design/board.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { precondition } from '../../utils/httpCache.js';

export { opsSchema } from '../../validation/designElements.js';

export const changesQuery = z.object({
  since: z.coerce.number().int().min(0),
});

/**
 * A board, whole.
 *
 * Conditional on the board's rev and the node's last update, so reopening a
 * board nobody has touched is a 304 with no element read at all. Signed image
 * URLs are deliberately not in here — they expire, and an ETag'd payload that
 * carried them would hand back dead links on every revalidation.
 */
export const getOne = asyncHandler(async (req, res) => {
  const { node, role } = req.design;
  if (precondition(req, res, await boardTag(node))) return;

  const { board, elements } = await loadBoard(node);
  res.json({ node: publicNode(node), board: publicBoard(board), elements, role });

  compactTombstones(board._id).catch((error) => console.warn(`[design] compaction failed: ${error.message}`));
});

export const changes = asyncHandler(async (req, res) => {
  res.json(await changesSince(req.design.node, req.query.since));
});

export const commit = asyncHandler(async (req, res) => {
  res.json(await commitOps({ ...req.design, userId: req.userId }, req.body));
});
