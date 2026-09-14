import mongoose from 'mongoose';
import { DESIGN_LIMITS, PROJECT_TEMPLATES } from '../../config/design.js';
import { DesignBoard } from '../../models/DesignBoard.js';
import { DesignElement } from '../../models/DesignElement.js';
import { DesignNode } from '../../models/DesignNode.js';
import { DesignProject } from '../../models/DesignProject.js';
import { ApiError } from '../../utils/ApiError.js';
import { keysBetween } from '../../utils/fractionalIndex.js';
import { trashedRoots } from './tree.service.js';
import { inTransaction } from './tx.js';

/**
 * Projects: the list, creating one (optionally with starter folders), editing,
 * the trash, and "recent boards".
 */

const DAY = 24 * 60 * 60 * 1000;

/** Live projects for an owner, most recently touched first, each with its board count. */
export async function listProjects(ownerId, { archived } = {}) {
  const filter = { owner: ownerId, deletedAt: null };
  if (archived === true) filter.archivedAt = { $ne: null };
  if (archived === false) filter.archivedAt = null;

  const projects = await DesignProject.find(filter).sort({ touchedAt: -1 }).lean();
  if (!projects.length) return [];

  const counts = await DesignNode.aggregate([
    { $match: { project: { $in: projects.map((p) => p._id) }, kind: 'board', deletedAt: null } },
    { $group: { _id: '$project', boards: { $sum: 1 } } },
  ]);
  const byProject = new Map(counts.map((row) => [String(row._id), row.boards]));
  return projects.map((project) => ({ project, boardCount: byProject.get(String(project._id)) || 0 }));
}

/**
 * A new project, and — for the `system` template — its starter folders, each
 * holding one board, all in one transaction so a project never exists
 * half-scaffolded.
 */
export async function createProject(ownerId, { id, name, description, icon, hue, template = 'blank' }) {
  const live = await DesignProject.countDocuments({ owner: ownerId, deletedAt: null });
  if (live >= DESIGN_LIMITS.projectsPerOwner) {
    throw ApiError.conflict('You have reached the project limit', 'PROJECT_LIMIT');
  }

  const folders = PROJECT_TEMPLATES[template] || [];
  const _id = id ? new mongoose.Types.ObjectId(id) : new mongoose.Types.ObjectId();

  try {
    return await inTransaction(async (session) => {
      const [project] = await DesignProject.create(
        [{ _id, owner: ownerId, name, description, icon, hue, treeRev: folders.length ? 1 : 0 }],
        { session },
      );

      const nodes = [];
      const boards = [];
      const folderOrders = keysBetween(null, null, folders.length);
      folders.forEach((folder, i) => {
        const folderId = new mongoose.Types.ObjectId();
        nodes.push({
          _id: folderId,
          project: _id,
          parent: null,
          kind: 'folder',
          boardKind: null,
          name: folder.name,
          order: folderOrders[i],
          createdBy: ownerId,
          updatedBy: ownerId,
        });
        const boardOrders = keysBetween(null, null, folder.boards.length);
        folder.boards.forEach((board, j) => {
          const boardId = new mongoose.Types.ObjectId();
          nodes.push({
            _id: boardId,
            project: _id,
            parent: folderId,
            kind: 'board',
            boardKind: board.boardKind,
            name: board.name,
            order: boardOrders[j],
            createdBy: ownerId,
            updatedBy: ownerId,
          });
          boards.push({ _id: boardId, project: _id, kind: board.boardKind });
        });
      });

      if (nodes.length) await DesignNode.insertMany(nodes, { session });
      if (boards.length) await DesignBoard.insertMany(boards, { session });

      return { project: project.toObject(), nodes };
    });
  } catch (error) {
    // A retried create with the same client id answers with the project the first attempt made.
    if (error?.code === 11000 && id) {
      const existing = await DesignProject.findOne({ _id: id, owner: ownerId }).lean();
      if (existing) {
        const nodes = await DesignNode.find({ project: existing._id, deletedAt: null }).lean();
        return { project: existing, nodes };
      }
    }
    throw error;
  }
}

export async function updateProject(project, { name, description, icon, hue, archived }) {
  const $set = {};
  if (name !== undefined) $set.name = name;
  if (description !== undefined) $set.description = description;
  if (icon !== undefined) $set.icon = icon;
  if (hue !== undefined) $set.hue = hue;
  if (archived !== undefined) $set.archivedAt = archived ? project.archivedAt || new Date() : null;
  return DesignProject.findOneAndUpdate({ _id: project._id }, { $set }, { new: true }).lean();
}

export async function projectTree(project) {
  return DesignNode.find({ project: project._id, deletedAt: null }).lean();
}

export async function trashProject(project, userId) {
  await DesignProject.updateOne(
    { _id: project._id, deletedAt: null },
    { $set: { deletedAt: new Date(), deletedBy: userId } },
  );
}

export async function restoreProject(project) {
  const live = await DesignProject.countDocuments({ owner: project.owner, deletedAt: null });
  if (live >= DESIGN_LIMITS.projectsPerOwner) {
    throw ApiError.conflict('You have reached the project limit', 'PROJECT_LIMIT');
  }
  return DesignProject.findOneAndUpdate(
    { _id: project._id },
    { $set: { deletedAt: null, deletedBy: null, touchedAt: new Date() } },
    { new: true },
  ).lean();
}

/**
 * Deletes a trashed project and everything in it, for good.
 *
 * Children first and the project last, so an interrupted purge leaves a project
 * row that can be purged again rather than orphaned boards nobody can reach.
 */
export async function purgeProject(project) {
  const { deletedCount: elements } = await DesignElement.deleteMany({ project: project._id });
  const { deletedCount: boards } = await DesignBoard.deleteMany({ project: project._id });
  await DesignNode.deleteMany({ project: project._id });
  await DesignProject.deleteOne({ _id: project._id });
  return { boards, elements };
}

/** Everything in an owner's trash: whole projects, and trashed folders and boards inside live ones. */
export async function listTrash(ownerId) {
  const expiresAt = (deletedAt) => new Date(new Date(deletedAt).getTime() + DESIGN_LIMITS.trashDays * DAY);

  const [trashedProjects, liveProjects] = await Promise.all([
    DesignProject.find({ owner: ownerId, deletedAt: { $ne: null } }).sort({ deletedAt: -1 }).lean(),
    DesignProject.find({ owner: ownerId, deletedAt: null }).select('_id name').lean(),
  ]);
  const names = new Map(liveProjects.map((p) => [String(p._id), p.name]));
  const roots = await trashedRoots(liveProjects.map((p) => p._id));

  return {
    projects: trashedProjects.map((project) => ({ project, expiresAt: expiresAt(project.deletedAt) })),
    nodes: roots
      .sort((a, b) => new Date(b.node.deletedAt) - new Date(a.node.deletedAt))
      .map(({ node, descendants }) => ({
        node,
        projectName: names.get(String(node.project)) || '',
        descendants,
        expiresAt: expiresAt(node.deletedAt),
      })),
  };
}

/** The boards an owner last wrote to, across projects. */
export async function recentBoards(ownerId, limit = 10) {
  const projects = await DesignProject.find({ owner: ownerId, deletedAt: null }).select('_id name hue icon').lean();
  if (!projects.length) return [];
  const byId = new Map(projects.map((p) => [String(p._id), p]));

  const boards = await DesignBoard.find({ project: { $in: [...byId.keys()] }, lastWriteAt: { $ne: null } })
    .select('_id project lastWriteAt kind')
    .sort({ lastWriteAt: -1 })
    .limit(limit * 3)
    .lean();
  const nodes = await DesignNode.find({ _id: { $in: boards.map((b) => b._id) }, deletedAt: null }).lean();
  const liveNodes = new Map(nodes.map((n) => [String(n._id), n]));

  return boards
    .filter((board) => liveNodes.has(String(board._id)))
    .slice(0, limit)
    .map((board) => ({
      node: liveNodes.get(String(board._id)),
      project: byId.get(String(board.project)),
      lastWriteAt: board.lastWriteAt,
    }));
}
