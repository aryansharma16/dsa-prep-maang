import mongoose from 'mongoose';
import { designCan } from '../../config/design.js';
import { DesignNode } from '../../models/DesignNode.js';
import { DesignProject } from '../../models/DesignProject.js';
import { ApiError } from '../../utils/ApiError.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

/**
 * Who may do what to a project, a node or a board — the only place that
 * question is answered.
 *
 * Every design route resolves its resource through here, and controllers then
 * work only with the documents this put on `req.design`. Never with a second id
 * read off the request: a handler that took `projectId` from the URL and
 * `nodeId` from the body would authorise one and act on the other.
 *
 * v1 knows one role, `owner`, derived from `project.owner`. Sharing adds a
 * membership lookup inside `roleFor` and nothing else in the module changes —
 * which is the reason this exists as a helper today rather than as a `{ owner:
 * req.userId }` filter repeated in every query.
 *
 * A project the caller has no role on answers **404**, never 403: "this exists
 * and you may not see it" is itself something a stranger should not learn. 403
 * is reserved for a caller who can already see the thing and lacks a capability
 * — which, until sharing, never happens.
 */

export const gone = (message = 'Not found') => ApiError.notFound(message);

export function roleFor(project, userId) {
  return String(project.owner) === String(userId) ? 'owner' : null;
}

const validId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 * @param {string} userId
 * @param {string} projectId
 * @param {string} cap         read | edit | manage | purge | …
 * @param {{ trashed?: boolean, session?: object }} [options]
 *   `trashed` lets a trashed project through, for restore and purge.
 */
export async function projectAccess(userId, projectId, cap, { trashed = false, session = null } = {}) {
  if (!validId(projectId)) throw gone('Project not found');
  const project = await DesignProject.findById(projectId).session(session).lean();
  if (!project) throw gone('Project not found');
  if (project.deletedAt && !trashed) throw gone('Project not found');
  if (!project.deletedAt && trashed && cap === 'purge') {
    throw ApiError.badRequest('Move the project to the trash before deleting it for good', 'NOT_IN_TRASH');
  }

  const role = roleFor(project, userId);
  if (!role) throw gone('Project not found');
  if (!designCan(role, cap)) throw ApiError.forbidden('You cannot do that on this project', 'DESIGN_FORBIDDEN');

  // Archived means read-only for content. `manage` stays open so the project can be unarchived.
  if (cap === 'edit' && project.archivedAt) {
    throw ApiError.conflict('This project is archived. Unarchive it to make changes.', 'PROJECT_ARCHIVED');
  }
  return { project, role };
}

export async function nodeAccess(userId, nodeId, cap, { trashed = false, session = null } = {}) {
  if (!validId(nodeId)) throw gone();
  const node = await DesignNode.findById(nodeId).session(session).lean();
  if (!node) throw gone();
  const { project, role } = await projectAccess(userId, node.project, cap, { session });
  if (node.deletedAt && !trashed) {
    throw new ApiError(410, 'This is in the trash', 'IN_TRASH');
  }
  if (!node.deletedAt && trashed && cap === 'purge') {
    throw ApiError.badRequest('Move it to the trash before deleting it for good', 'NOT_IN_TRASH');
  }
  return { project, node, role };
}

export async function boardAccess(userId, boardId, cap, options = {}) {
  const access = await nodeAccess(userId, boardId, cap, options);
  if (access.node.kind !== 'board') throw gone();
  return access;
}

const RESOLVERS = { project: projectAccess, node: nodeAccess, board: boardAccess };

/**
 * Route middleware: resolves `req.params.id` as `scope` and requires `cap`.
 * Sets `req.design = { project, node?, role }`.
 */
export const designAccess = (scope, cap, options = {}) =>
  asyncHandler(async (req, _res, next) => {
    req.design = await RESOLVERS[scope](req.userId, req.params.id, cap, options);
    next();
  });
