import { Router } from 'express';
import {
  addQuestions,
  addSession,
  addSubtask,
  attachmentParam,
  create,
  createSchema,
  createStatus,
  deleteStatus,
  getBoard,
  getOne,
  move,
  moveSchema,
  patchStatus,
  patchSubtask,
  purge,
  putStatusOrder,
  questionParam,
  questionsSchema,
  remove,
  removeAttachment,
  removeQuestion,
  removeSession,
  removeSubtask,
  restore,
  sessionParam,
  sessionSchema,
  statusCreateSchema,
  statusDeleteQuery,
  statusIdParam,
  statusOrderSchema,
  statusUpdateSchema,
  subtaskCreateSchema,
  subtaskParam,
  subtaskUpdateSchema,
  timerCurrent,
  timerStart,
  timerStop,
  update,
  updateSchema,
  uploadAttachments,
} from '../controllers/task.controller.js';
import { uploadLimiter } from '../middleware/rateLimit.js';
import { multipleFiles } from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';
import { idParam } from '../utils/query.js';

/**
 * The tasks module.
 *
 * One router, unlike notes — nothing here is reachable without a session. A
 * board has one reader by design: there are no assignees, no sharing and no
 * public surface, so there is no second audience to keep in a separate object.
 *
 * Everything is mounted below `requireAuth` and below `writeLimiter` in
 * routes/index.js, which is what covers every route in this file by having been
 * added here at all.
 */

export const taskRouter = Router();

/*
  The literal paths come first, and that ordering is required rather than
  stylistic: Express matches in declaration order, so `/timer` or `/move`
  declared after `/:id` would be swallowed by the id route and rejected as a
  malformed ObjectId.
*/
taskRouter.get('/timer', timerCurrent);
taskRouter.post('/move', validate(moveSchema), move);

/* ------------------------------------------------------------ columns */

/*
  Under `/board` rather than at the top level, because a column belongs to the
  board and not to the task collection — and because it keeps `statuses` from
  looking like a task id to the routes below.
*/
taskRouter.post('/board/statuses', validate(statusCreateSchema), createStatus);
taskRouter.put('/board/statuses', validate(statusOrderSchema), putStatusOrder);
taskRouter.patch(
  '/board/statuses/:statusId',
  validate(statusIdParam, 'params'),
  validate(statusUpdateSchema),
  patchStatus,
);
taskRouter.delete(
  '/board/statuses/:statusId',
  validate(statusIdParam, 'params'),
  validate(statusDeleteQuery, 'query'),
  deleteStatus,
);

/* ------------------------------------------------------------ tasks */

taskRouter.get('/', getBoard);
taskRouter.post('/', validate(createSchema), create);

taskRouter.get('/:id', validate(idParam, 'params'), getOne);
taskRouter.patch('/:id', validate(idParam, 'params'), validate(updateSchema), update);
taskRouter.delete('/:id', validate(idParam, 'params'), remove);

taskRouter.post('/:id/restore', validate(idParam, 'params'), restore);
taskRouter.delete('/:id/permanent', validate(idParam, 'params'), purge);

/* ------------------------------------------------------------ subtasks */

taskRouter.post(
  '/:id/subtasks',
  validate(idParam, 'params'),
  validate(subtaskCreateSchema),
  addSubtask,
);
taskRouter.patch(
  '/:id/subtasks/:subtaskId',
  validate(subtaskParam, 'params'),
  validate(subtaskUpdateSchema),
  patchSubtask,
);
taskRouter.delete('/:id/subtasks/:subtaskId', validate(subtaskParam, 'params'), removeSubtask);

/* ------------------------------------------------------------ questions */

taskRouter.post(
  '/:id/questions',
  validate(idParam, 'params'),
  validate(questionsSchema),
  addQuestions,
);
taskRouter.delete('/:id/questions/:problemId', validate(questionParam, 'params'), removeQuestion);

/* ------------------------------------------------------------ the clock */

taskRouter.post('/:id/timer/start', validate(idParam, 'params'), timerStart);
taskRouter.post('/:id/timer/stop', validate(idParam, 'params'), timerStop);

taskRouter.post('/:id/sessions', validate(idParam, 'params'), validate(sessionSchema), addSession);
taskRouter.delete('/:id/sessions/:sessionId', validate(sessionParam, 'params'), removeSession);

/* ------------------------------------------------------------ attachments */

/*
  Images and PDFs, the same pair a note takes and for the same reason: a task
  carries the screenshot of the failure and the PDF of the paper.

  `uploadLimiter` comes first — before the id is even validated — so multer
  never allocates for a request that is going to be refused. Ten files at 25MB
  is a quarter gigabyte of buffers in the worst case, which is why the count is
  what bounds the request rather than the per-file ceiling alone.
*/
taskRouter.post(
  '/:id/attachments',
  uploadLimiter,
  validate(idParam, 'params'),
  multipleFiles('files', { maxMb: 25, maxFiles: 10 }),
  uploadAttachments,
);
taskRouter.delete(
  '/:id/attachments/:fileId',
  validate(attachmentParam, 'params'),
  removeAttachment,
);
