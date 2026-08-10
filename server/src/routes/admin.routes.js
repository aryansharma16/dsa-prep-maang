import { Router } from 'express';
import {
  auditQuery,
  listAudit,
  overview,
} from '../controllers/admin/audit.controller.js';
import {
  getChatUsage,
  getSettings,
  purgeChats,
  settingsSchema,
  updateSettings,
} from '../controllers/admin/settings.controller.js';
import {
  listModules,
  moduleSchema,
  setModuleHidden,
} from '../controllers/admin/modules.controller.js';
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
import {
  createMotivation,
  createSchema as motivationCreateSchema,
  deleteMotivation,
  draftMotivation,
  draftSchema,
  listMotivation,
  listQuery as motivationListQuery,
  previewMotivation,
  updateMotivation,
  updateSchema as motivationUpdateSchema,
} from '../controllers/admin/motivation.controller.js';
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

/* ----------------------------------------------------------- motivation */

adminRouter.get(
  '/motivation',
  requireCap('content:read'),
  validate(motivationListQuery, 'query'),
  listMotivation,
);
// Before /:id, or Express reads "preview" as an id and the validator rejects it.
adminRouter.get('/motivation/preview', requireCap('content:read'), previewMotivation);

adminRouter.post(
  '/motivation',
  requireCap('content:write'),
  validate(motivationCreateSchema),
  createMotivation,
);
adminRouter.post(
  '/motivation/draft',
  requireCap('content:write'),
  validate(draftSchema),
  draftMotivation,
);
adminRouter.patch(
  '/motivation/:id',
  requireCap('content:write'),
  validate(idParam, 'params'),
  validate(motivationUpdateSchema),
  updateMotivation,
);
adminRouter.delete(
  '/motivation/:id',
  requireCap('content:write'),
  validate(idParam, 'params'),
  deleteMotivation,
);

/* --------------------------------------------------------------- guides */

adminRouter.get('/guides', requireCap('content:read'), listGuides);
adminRouter.get('/guides/:slug', requireCap('content:read'), getGuideAdmin);
adminRouter.put('/guides/:slug', requireCap('guide:write'), validate(guideSaveSchema), saveGuide);
adminRouter.post('/guides/:slug/unlock', requireCap('guide:write'), unlockGuide);

/* ------------------------------------------------------------- settings */

/*
  Read and write are split so the panel can show an admin that chat is up and
  which providers are reachable, without letting them change how long everyone's
  history is kept or how much the deployment is allowed to spend. Only
  super_admin holds `settings:write`.
*/
adminRouter.get('/settings', requireCap('settings:read'), getSettings);
adminRouter.patch('/settings', requireCap('settings:write'), validate(settingsSchema), updateSettings);
adminRouter.get('/settings/chat-usage', requireCap('settings:read'), getChatUsage);
adminRouter.post('/settings/chat-purge', requireCap('settings:write'), purgeChats);

/* -------------------------------------------------------------- modules */

/*
  Split the same way, and for a sharper reason: reading tells an admin that Notes
  is missing on purpose rather than broken, while writing takes a feature away
  from every learner on the deployment. `module:write` is the super admin's.
*/
adminRouter.get('/modules', requireCap('settings:read'), listModules);
adminRouter.patch('/modules', requireCap('module:write'), validate(moduleSchema), setModuleHidden);
