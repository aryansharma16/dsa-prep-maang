import { z } from 'zod';
import { PROJECT_TEMPLATES } from '../../config/design.js';
import { HUES } from '../../config/hues.js';
import { publicNode } from '../../models/DesignNode.js';
import { publicProject } from '../../models/DesignProject.js';
import {
  createProject,
  listProjects,
  listTrash,
  projectTree,
  purgeProject,
  recentBoards,
  restoreProject,
  trashProject,
  updateProject,
} from '../../services/design/project.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { objectId } from '../../utils/query.js';

/* -------------------------------------------------------------------------- */
/* validation                                                                  */
/* -------------------------------------------------------------------------- */

const name = z.string().trim().min(1, 'Give it a name').max(120);

export const createProjectSchema = z
  .object({
    /** Optional and client-chosen, so a create that timed out can be retried without making two. */
    id: objectId.optional(),
    name,
    description: z.string().max(1000).optional(),
    icon: z.string().max(16).optional(),
    hue: z.enum(HUES).optional(),
    template: z.enum(Object.keys(PROJECT_TEMPLATES)).optional(),
  })
  .strict();

export const updateProjectSchema = z
  .object({
    name: name.optional(),
    description: z.string().max(1000).optional(),
    icon: z.string().max(16).optional(),
    hue: z.enum(HUES).optional(),
    archived: z.boolean().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, 'Nothing to change');

export const listProjectsQuery = z.object({
  archived: z.enum(['true', 'false']).optional(),
});

export const recentQuery = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(10),
});

/* -------------------------------------------------------------------------- */
/* handlers                                                                    */
/* -------------------------------------------------------------------------- */

export const list = asyncHandler(async (req, res) => {
  const archived = req.query.archived === undefined ? undefined : req.query.archived === 'true';
  const rows = await listProjects(req.userId, { archived });
  res.json({ projects: rows.map(({ project, boardCount }) => publicProject(project, { boardCount })) });
});

export const create = asyncHandler(async (req, res) => {
  const { project, nodes } = await createProject(req.userId, req.body);
  res.status(201).json({
    project: publicProject(project, { boardCount: nodes.filter((n) => n.kind === 'board').length }),
    nodes: nodes.map(publicNode),
    treeRev: project.treeRev ?? 0,
  });
});

export const getOne = asyncHandler(async (req, res) => {
  const { project, role } = req.design;
  const nodes = await projectTree(project);
  res.json({ project: publicProject(project), role, treeRev: project.treeRev ?? 0, nodes: nodes.map(publicNode) });
});

export const update = asyncHandler(async (req, res) => {
  const project = await updateProject(req.design.project, req.body);
  res.json({ project: publicProject(project) });
});

export const remove = asyncHandler(async (req, res) => {
  await trashProject(req.design.project, req.userId);
  res.json({ ok: true, id: req.design.project._id });
});

export const restore = asyncHandler(async (req, res) => {
  const project = await restoreProject(req.design.project);
  res.json({ project: publicProject(project) });
});

export const purge = asyncHandler(async (req, res) => {
  const counts = await purgeProject(req.design.project);
  res.json({ ok: true, id: req.design.project._id, ...counts });
});

export const trash = asyncHandler(async (req, res) => {
  const { projects, nodes } = await listTrash(req.userId);
  res.json({
    projects: projects.map(({ project, expiresAt }) => ({ project: publicProject(project), expiresAt })),
    nodes: nodes.map(({ node, projectName, descendants, expiresAt }) => ({
      node: publicNode(node),
      projectName,
      descendants,
      expiresAt,
    })),
  });
});

export const recent = asyncHandler(async (req, res) => {
  const rows = await recentBoards(req.userId, req.query.limit);
  res.json({
    boards: rows.map(({ node, project, lastWriteAt }) => ({
      node: publicNode(node),
      project: { id: project._id, name: project.name, hue: project.hue, icon: project.icon || '' },
      lastWriteAt,
    })),
  });
});
