import mongoose from 'mongoose';
import { DESIGN_LIMITS } from '../../config/design.js';
import { DesignBoard } from '../../models/DesignBoard.js';
import { DesignElement } from '../../models/DesignElement.js';
import { DesignNode } from '../../models/DesignNode.js';
import { DesignProject } from '../../models/DesignProject.js';
import { ApiError } from '../../utils/ApiError.js';
import { gone } from './access.service.js';
import { childrenOf, depthOf, heightOf, indexNodes, isWithin, orderAmong, subtreeIds } from './tree.js';
import { inTransaction } from './tx.js';

/**
 * Structural changes to a project's tree: create, rename, move, duplicate,
 * trash, restore, purge.
 *
 * Every one runs the same way — inside a transaction, starting by bumping the
 * project's `treeRev`, then loading the tree's skeleton and deciding in memory.
 * The bump comes first on purpose: it makes any two concurrent tree changes on
 * one project write the same document, so the second aborts and retries against
 * the first's result. That is what stops two tabs each moving a folder into the
 * other — both checks pass on their own snapshot, and only one can commit.
 */

const oid = (id) => new mongoose.Types.ObjectId(String(id));
const sameId = (a, b) => String(a ?? '') === String(b ?? '');

async function bumpTree(projectId, session) {
  const project = await DesignProject.findOneAndUpdate(
    { _id: projectId },
    { $inc: { treeRev: 1 }, $set: { touchedAt: new Date() } },
    { new: true, session, projection: { treeRev: 1 } },
  ).lean();
  if (!project) throw gone('Project not found');
  return project.treeRev;
}

const SKELETON = '_id parent kind boardKind order name deletedAt deletedRoot';

const skeleton = (projectId, session, { includeDeleted = false } = {}) =>
  DesignNode.find({ project: projectId, ...(includeDeleted ? {} : { deletedAt: null }) })
    .select(SKELETON)
    .session(session)
    .lean();

async function ownerBoardCount(ownerId, session) {
  const projectIds = await DesignProject.find({ owner: ownerId, deletedAt: null })
    .session(session)
    .distinct('_id');
  return DesignNode.countDocuments({ project: { $in: projectIds }, kind: 'board', deletedAt: null }).session(
    session,
  );
}

function assertParent(byId, parentId) {
  if (parentId == null) return null;
  const parent = byId.get(String(parentId));
  if (!parent || parent.kind !== 'folder') {
    throw ApiError.badRequest('That folder no longer exists', 'BAD_PARENT');
  }
  return parent;
}

/**
 * A new folder or board.
 *
 * `id` is optional and client-chosen, so a create that timed out can be retried
 * without making a second copy: the retry hits the unique `_id`, and is answered
 * with the node the first attempt made.
 */
export async function createNode({ project, userId }, { id, kind, boardKind, name, parentId, after }) {
  try {
    return await inTransaction(async (session) => {
      const treeRev = await bumpTree(project._id, session);
      const nodes = await skeleton(project._id, session);
      if (nodes.length >= DESIGN_LIMITS.nodesPerProject) {
        throw ApiError.conflict('This project has as many folders and boards as it can hold', 'PROJECT_FULL');
      }
      const byId = indexNodes(nodes);
      assertParent(byId, parentId);
      if (depthOf(byId, parentId) + 1 > DESIGN_LIMITS.treeDepth) {
        throw ApiError.badRequest('Folders cannot nest that deep', 'TOO_DEEP');
      }
      if (kind === 'board' && (await ownerBoardCount(project.owner, session)) >= DESIGN_LIMITS.boardsPerOwner) {
        throw ApiError.conflict('You have reached the board limit', 'BOARD_LIMIT');
      }

      const siblings = nodes.filter((node) => sameId(node.parent, parentId));
      const _id = id ? oid(id) : new mongoose.Types.ObjectId();
      const [node] = await DesignNode.create(
        [
          {
            _id,
            project: project._id,
            parent: parentId ? oid(parentId) : null,
            kind,
            boardKind: kind === 'board' ? boardKind : null,
            name,
            order: orderAmong(siblings, after),
            createdBy: userId,
            updatedBy: userId,
          },
        ],
        { session },
      );
      if (kind === 'board') {
        await DesignBoard.create([{ _id, project: project._id, kind: boardKind }], { session });
      }
      return { node: node.toObject(), treeRev };
    });
  } catch (error) {
    if (error?.code === 11000 && id) {
      const existing = await DesignNode.findById(id).lean();
      if (existing && sameId(existing.project, project._id) && existing.kind === kind) {
        return { node: existing, treeRev: project.treeRev };
      }
    }
    throw error;
  }
}

export async function renameNode({ project, node, userId }, name) {
  return inTransaction(async (session) => {
    const treeRev = await bumpTree(project._id, session);
    const updated = await DesignNode.findOneAndUpdate(
      { _id: node._id, deletedAt: null },
      { $set: { name, updatedBy: userId } },
      { new: true, session },
    ).lean();
    if (!updated) throw gone();
    return { node: updated, treeRev };
  });
}

/** Reparent and/or reorder. `after` undefined appends, null puts it first. */
export async function moveNode({ project, node, userId }, { parentId, after }) {
  return inTransaction(async (session) => {
    const treeRev = await bumpTree(project._id, session);
    const nodes = await skeleton(project._id, session);
    const byId = indexNodes(nodes);
    if (!byId.has(String(node._id))) throw gone();

    assertParent(byId, parentId);
    if (parentId != null && isWithin(byId, parentId, node._id)) {
      throw ApiError.badRequest('A folder cannot go inside itself', 'MOVE_INTO_SELF');
    }
    const children = childrenOf(nodes);
    if (depthOf(byId, parentId) + 1 + heightOf(children, node._id) > DESIGN_LIMITS.treeDepth) {
      throw ApiError.badRequest('Folders cannot nest that deep', 'TOO_DEEP');
    }

    const siblings = nodes.filter((entry) => sameId(entry.parent, parentId));
    const updated = await DesignNode.findOneAndUpdate(
      { _id: node._id },
      {
        $set: {
          parent: parentId ? oid(parentId) : null,
          order: orderAmong(siblings, after, node._id),
          updatedBy: userId,
        },
      },
      { new: true, session },
    ).lean();
    return { node: updated, treeRev };
  });
}

/**
 * A copy of a board, placed straight after it.
 *
 * The elements are copied **before** the transaction that creates the node, in
 * chunks, and that order is the whole design. A crash half-way through copying
 * leaves elements pointing at a board id that never came to exist — invisible,
 * and swept up by scripts/design/purge-trash.js. The other order would leave a
 * board that exists and is missing half its contents, which is the one outcome
 * a person would actually see.
 *
 * Element ids are kept, so connectors stay bound to the shapes they were bound
 * to; they are only unique per board.
 */
export async function duplicateBoard({ project, node, userId }, { name } = {}) {
  if (node.kind !== 'board') throw ApiError.badRequest('Only boards can be duplicated for now', 'NOT_A_BOARD');
  const source = await DesignBoard.findById(node._id).lean();
  if (!source) throw gone();

  const newId = new mongoose.Types.ObjectId();
  let copied = 0;
  let batch = [];
  const flush = async () => {
    if (!batch.length) return;
    await DesignElement.insertMany(batch, { ordered: false });
    copied += batch.length;
    batch = [];
  };

  try {
    const cursor = DesignElement.find({ board: node._id, deletedAt: null }).lean().cursor();
    for await (const el of cursor) {
      batch.push({
        board: newId,
        project: project._id,
        eid: el.eid,
        type: el.type,
        parent: el.parent ?? null,
        z: el.z,
        data: el.data || {},
        bytes: el.bytes || 0,
        rev: 1,
        updatedBy: userId,
      });
      if (batch.length === 500) await flush();
    }
    await flush();

    return await inTransaction(async (session) => {
      const treeRev = await bumpTree(project._id, session);
      const nodes = await skeleton(project._id, session);
      if (nodes.length >= DESIGN_LIMITS.nodesPerProject) {
        throw ApiError.conflict('This project has as many folders and boards as it can hold', 'PROJECT_FULL');
      }
      if ((await ownerBoardCount(project.owner, session)) >= DESIGN_LIMITS.boardsPerOwner) {
        throw ApiError.conflict('You have reached the board limit', 'BOARD_LIMIT');
      }
      const byId = indexNodes(nodes);
      const parentId = node.parent && byId.get(String(node.parent))?.kind === 'folder' ? node.parent : null;
      const siblings = nodes.filter((entry) => sameId(entry.parent, parentId));
      const after = sameId(parentId, node.parent) && byId.has(String(node._id)) ? node._id : undefined;

      const [created] = await DesignNode.create(
        [
          {
            _id: newId,
            project: project._id,
            parent: parentId,
            kind: 'board',
            boardKind: node.boardKind,
            name: (name || `${node.name} copy`).slice(0, 120),
            order: orderAmong(siblings, after),
            createdBy: userId,
            updatedBy: userId,
          },
        ],
        { session },
      );
      await DesignBoard.create(
        [
          {
            _id: newId,
            project: project._id,
            kind: source.kind,
            rev: 1,
            elementCount: copied,
            bytes: source.bytes || 0,
            meta: source.meta || {},
            source: source.source || '',
            sourceRev: source.source ? 1 : 0,
            lastWriteAt: new Date(),
            lastWriteBy: userId,
          },
        ],
        { session },
      );
      return { node: created.toObject(), treeRev };
    });
  } catch (error) {
    // Best effort — the purge script catches whatever this misses.
    await DesignElement.deleteMany({ board: newId }).catch(() => {});
    throw error;
  }
}

/** Moves a node and everything under it to the trash. Elements are untouched; access checks are the gate. */
export async function trashNode({ project, node, userId }) {
  return inTransaction(async (session) => {
    const treeRev = await bumpTree(project._id, session);
    const nodes = await skeleton(project._id, session);
    const ids = subtreeIds(childrenOf(nodes), node._id).map(oid);
    await DesignNode.updateMany(
      { _id: { $in: ids }, deletedAt: null },
      { $set: { deletedAt: new Date(), deletedBy: userId, deletedRoot: node._id } },
      { session },
    );
    return { ids, treeRev };
  });
}

const assertTrashRoot = (node) => {
  if (!node.deletedAt) throw ApiError.badRequest('This is not in the trash', 'NOT_IN_TRASH');
  if (!sameId(node.deletedRoot, node._id)) {
    throw ApiError.badRequest('This was deleted with its folder. Restore the folder instead.', 'NOT_TRASH_ROOT');
  }
};

/**
 * Brings back exactly what one delete removed.
 *
 * If the place it came from is gone — its folder deleted or purged since — it
 * lands at the project root rather than failing, because a restore that cannot
 * find somewhere to put things is a restore nobody can use.
 */
export async function restoreNode({ project, node, userId }) {
  assertTrashRoot(node);
  return inTransaction(async (session) => {
    const treeRev = await bumpTree(project._id, session);
    const all = await skeleton(project._id, session, { includeDeleted: true });
    const live = all.filter((entry) => !entry.deletedAt);
    const members = all.filter((entry) => sameId(entry.deletedRoot, node._id));
    if (live.length + members.length > DESIGN_LIMITS.nodesPerProject) {
      throw ApiError.conflict('This project has as many folders and boards as it can hold', 'PROJECT_FULL');
    }

    await DesignNode.updateMany(
      { project: project._id, deletedRoot: node._id },
      { $set: { deletedAt: null, deletedBy: null, deletedRoot: null, updatedBy: userId } },
      { session },
    );

    const liveById = indexNodes(live);
    const parent = node.parent ? liveById.get(String(node.parent)) : null;
    const restoredChildren = childrenOf([...live, ...members]);
    const fits =
      parent?.kind === 'folder' &&
      depthOf(liveById, parent._id) + 1 + heightOf(restoredChildren, node._id) <= DESIGN_LIMITS.treeDepth;

    if (node.parent && !fits) {
      const rootSiblings = live.filter((entry) => entry.parent == null);
      await DesignNode.updateOne(
        { _id: node._id },
        { $set: { parent: null, order: orderAmong(rootSiblings, undefined) } },
        { session },
      );
    }

    const nodes = await DesignNode.find({ _id: { $in: members.map((m) => m._id) } })
      .session(session)
      .lean();
    return { nodes, treeRev };
  });
}

/** Deletes a trashed node, everything that was under it, and every element on its boards — for good. */
export async function purgeNode({ project, node }) {
  assertTrashRoot(node);
  const { boardIds, ids } = await inTransaction(async (session) => {
    await bumpTree(project._id, session);
    const all = await skeleton(project._id, session, { includeDeleted: true });
    const byId = indexNodes(all);
    const subtree = subtreeIds(childrenOf(all), node._id).filter((id) => byId.has(id));
    const boards = subtree.filter((id) => byId.get(id).kind === 'board').map(oid);
    await DesignNode.deleteMany({ _id: { $in: subtree.map(oid) } }, { session });
    await DesignBoard.deleteMany({ _id: { $in: boards } }, { session });
    return { boardIds: boards, ids: subtree };
  });
  // Outside the transaction: potentially thousands of documents, and an
  // interrupted run leaves orphans the purge script sweeps rather than a
  // half-deleted tree.
  const { deletedCount } = await DesignElement.deleteMany({ board: { $in: boardIds } });
  return { ids, elements: deletedCount };
}

/** Trashed roots in a project, with how much each would take with it. */
export async function trashedRoots(projectIds) {
  const trashed = await DesignNode.find({ project: { $in: projectIds }, deletedAt: { $ne: null } })
    .select(SKELETON + ' project')
    .lean();
  const roots = trashed.filter((entry) => sameId(entry.deletedRoot, entry._id));
  return roots.map((root) => ({
    node: root,
    descendants: trashed.filter((entry) => sameId(entry.deletedRoot, root._id)).length - 1,
  }));
}
