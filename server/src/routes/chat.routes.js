import { Router } from 'express';

import { validate } from '../middleware/validate.js';
import { idParam } from '../utils/query.js';
import {
  getConfig,
  getConversation,
  listConversations,
  listQuery,
  removeAllConversations,
  removeConversation,
  sendSchema,
  stop,
  stopSchema,
  stream,
  updateConversation,
  updateSchema,
} from '../controllers/chat.controller.js';

/**
 * Everything here is already behind `requireAuth` — see routes/index.js, where
 * authorisation is positional and this router is mounted below the gate. Every
 * handler scopes its query to `req.userId`, so there is no capability check:
 * chat is a learner feature, and the only thing anyone can reach is their own.
 *
 * Route order is not load-bearing here the way it is in admin.routes.js —
 * `config`, `stop` and `conversations` are distinct first segments, so none of
 * them can be swallowed by a `:id` pattern. Worth saying, because the
 * equivalent mistake one file over is a live comment.
 */
export const chatRouter = Router();

chatRouter.get('/config', getConfig);

chatRouter.post('/stream', validate(sendSchema), stream);
chatRouter.post('/stop', validate(stopSchema), stop);

chatRouter.get('/conversations', validate(listQuery, 'query'), listConversations);
chatRouter.delete('/conversations', removeAllConversations);
chatRouter.get('/conversations/:id', validate(idParam, 'params'), getConversation);
chatRouter.patch('/conversations/:id', validate(idParam, 'params'), validate(updateSchema), updateConversation);
chatRouter.delete('/conversations/:id', validate(idParam, 'params'), removeConversation);
