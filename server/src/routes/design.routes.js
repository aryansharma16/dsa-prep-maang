import express, { Router } from 'express';
import { DESIGN_LIMITS } from '../config/design.js';
import * as boards from '../controllers/design/design.board.controller.js';
import * as nodes from '../controllers/design/design.node.controller.js';
import * as projects from '../controllers/design/design.project.controller.js';
import { designSyncLimiter, writeLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { designAccess } from '../services/design/access.service.js';
import { ApiError } from '../utils/ApiError.js';
import { idParam } from '../utils/query.js';

/**
 * The system design module: projects, their folder trees, and boards.
 *
 * Mounted in routes/index.js below `requireAuth` and `requireModule('design')`
 * but **above** `writeLimiter`, which is the one thing about this router that
 * is unlike the others. Autosave would spend that limiter's budget in two
 * minutes, so the save routes take `designSyncLimiter` instead, and this file
 * re-applies `writeLimiter` itself for everything else. Positional, like the
 * file that mounts it: a route added below the `writeLimiter` line is covered
 * by having been added there.
 *
 * Bodies are parsed here rather than by the app-wide parser (see app.js), so
 * each group gets the limit that suits it and a caller is authorised and
 * rate-limited before a byte of their body is read.
 *
 * Order within each route: limiter, then the id, then access, then the body,
 * then its validation — cheapest refusal first.
 */

export const designRouter = Router();

const syncJson = express.json({ limit: DESIGN_LIMITS.syncBodyBytes });
const writeJson = express.json({ limit: DESIGN_LIMITS.writeBodyBytes });
const id = validate(idParam, 'params');

/* ------------------------------------------------------------ saves */

designRouter.post(
  '/boards/:id/ops',
  designSyncLimiter,
  id,
  designAccess('board', 'edit'),
  syncJson,
  validate(boards.opsSchema),
  boards.commit,
);

/* ------------------------------------------------------------ everything else */

designRouter.use(writeLimiter);
designRouter.use(writeJson);

/*
  Literal paths before `/:id`, because Express matches in declaration order and
  `trash` would otherwise be read as a malformed project id.
*/
designRouter.get('/trash', projects.trash);
designRouter.get('/recent', validate(projects.recentQuery, 'query'), projects.recent);

designRouter.get('/projects', validate(projects.listProjectsQuery, 'query'), projects.list);
designRouter.post('/projects', validate(projects.createProjectSchema), projects.create);
designRouter.get('/projects/:id', id, designAccess('project', 'read'), projects.getOne);
designRouter.patch(
  '/projects/:id',
  id,
  designAccess('project', 'manage'),
  validate(projects.updateProjectSchema),
  projects.update,
);
designRouter.delete('/projects/:id', id, designAccess('project', 'manage'), projects.remove);
designRouter.post(
  '/projects/:id/restore',
  id,
  designAccess('project', 'manage', { trashed: true }),
  projects.restore,
);
designRouter.delete(
  '/projects/:id/permanent',
  id,
  designAccess('project', 'purge', { trashed: true }),
  projects.purge,
);

designRouter.post(
  '/projects/:id/nodes',
  id,
  designAccess('project', 'edit'),
  validate(nodes.createNodeSchema),
  nodes.create,
);
designRouter.patch('/nodes/:id', id, designAccess('node', 'edit'), validate(nodes.renameSchema), nodes.rename);
designRouter.post('/nodes/:id/move', id, designAccess('node', 'edit'), validate(nodes.moveSchema), nodes.move);
designRouter.post(
  '/nodes/:id/duplicate',
  id,
  designAccess('node', 'edit'),
  validate(nodes.duplicateSchema),
  nodes.duplicate,
);
designRouter.delete('/nodes/:id', id, designAccess('node', 'edit'), nodes.remove);
designRouter.post('/nodes/:id/restore', id, designAccess('node', 'edit', { trashed: true }), nodes.restore);
designRouter.delete('/nodes/:id/permanent', id, designAccess('node', 'purge', { trashed: true }), nodes.purge);

designRouter.get('/boards/:id', id, designAccess('board', 'read'), boards.getOne);
designRouter.get(
  '/boards/:id/changes',
  id,
  designAccess('board', 'read'),
  validate(boards.changesQuery, 'query'),
  boards.changes,
);

/*
  Nothing under /design falls through to the routes after this mount.

  Not tidiness: those routes sit below the app-wide `writeLimiter`, which this
  request has already passed through above — and express-rate-limit counts the
  same request twice, and warns, when one limiter instance sees it again.
*/
designRouter.use((req, _res, next) => {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
});
