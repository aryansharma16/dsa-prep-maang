import { Router } from 'express';
import {
  auditQuery,
  listAudit,
  overview,
} from '../controllers/admin/audit.controller.js';
import {
  createProblem,
  deleteProblem,
  getProblem,
  listPatternsAdmin,
  listProblems,
  patternUpdateSchema,
  problemCreateSchema,
  problemQuery,
  problemUpdateSchema,
  updatePattern,
  updateProblem,
} from '../controllers/admin/content.controller.js';
import {
  getGuideAdmin,
  guideSaveSchema,
  listGuides,
  saveGuide,
  unlockGuide,
} from '../controllers/admin/guides.controller.js';
import {
  createSchema,
  createUser,
  deleteUser,
  getUser,
  listQuery,
  listUsers,
  passwordSchema,
  removeUserAvatar,
  revokeSessions,
  roleSchema,
  setPassword,
  setRole,
  updateSchema,
  updateUser,
} from '../controllers/admin/users.controller.js';
import { requireCap } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import { idParam } from '../utils/query.js';

/**
 * Everything under /api/admin.
 *
 * Mounted after the router-level `requireAuth`, so the caller is already known.
 * `requireCap('panel')` then gates the whole surface, and each route names the
 * capability it actually needs on top — so a dev_member reaching a password
 * route is refused by that route, not by the panel gate.
 *
 * The actor is read from the database once per request and memoised on `req`,
 * so stacking two gates costs one query.
 */
export const adminRouter = Router();

adminRouter.use(requireCap('panel'));

adminRouter.get('/overview', overview);
adminRouter.get('/audit', validate(auditQuery, 'query'), listAudit);

/* ---------------------------------------------------------------- users */

adminRouter.get('/users', requireCap('user:read'), validate(listQuery, 'query'), listUsers);
adminRouter.get('/users/:id', requireCap('user:read'), validate(idParam, 'params'), getUser);

adminRouter.post('/users', requireCap('user:create'), validate(createSchema), createUser);

adminRouter.patch(
  '/users/:id',
  requireCap('user:write'),
  validate(idParam, 'params'),
  validate(updateSchema),
  updateUser,
);
adminRouter.delete(
  '/users/:id/avatar',
  requireCap('user:write'),
  validate(idParam, 'params'),
  removeUserAvatar,
);

adminRouter.patch(
  '/users/:id/role',
  requireCap('user:role'),
  validate(idParam, 'params'),
  validate(roleSchema),
  setRole,
);

adminRouter.post(
  '/users/:id/password',
  requireCap('user:password'),
  validate(idParam, 'params'),
  validate(passwordSchema),
  setPassword,
);
adminRouter.post(
  '/users/:id/revoke',
  requireCap('user:password'),
  validate(idParam, 'params'),
  revokeSessions,
);

adminRouter.delete(
  '/users/:id',
  requireCap('user:delete'),
  validate(idParam, 'params'),
  deleteUser,
);

/* ------------------------------------------------------------- problems */

adminRouter.get(
  '/problems',
  requireCap('content:read'),
  validate(problemQuery, 'query'),
  listProblems,
);
adminRouter.get(
  '/problems/:id',
  requireCap('content:read'),
  validate(idParam, 'params'),
  getProblem,
);
adminRouter.post(
  '/problems',
  requireCap('content:write'),
  validate(problemCreateSchema),
  createProblem,
);
adminRouter.patch(
  '/problems/:id',
  requireCap('content:write'),
  validate(idParam, 'params'),
  validate(problemUpdateSchema),
  updateProblem,
);
adminRouter.delete(
  '/problems/:id',
  requireCap('content:write'),
  validate(idParam, 'params'),
  deleteProblem,
);

/* ------------------------------------------------------------- patterns */

adminRouter.get('/patterns', requireCap('content:read'), listPatternsAdmin);
adminRouter.patch(
  '/patterns/:slug',
  requireCap('content:write'),
  validate(patternUpdateSchema),
  updatePattern,
);

/* --------------------------------------------------------------- guides */

adminRouter.get('/guides', requireCap('content:read'), listGuides);
adminRouter.get('/guides/:slug', requireCap('content:read'), getGuideAdmin);
adminRouter.put('/guides/:slug', requireCap('guide:write'), validate(guideSaveSchema), saveGuide);
adminRouter.post('/guides/:slug/unlock', requireCap('guide:write'), unlockGuide);
