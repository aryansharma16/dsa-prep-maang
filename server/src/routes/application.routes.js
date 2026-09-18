import { Router } from 'express';

import {
  checkResume,
  deleteResume,
  linkResume,
  listResumes,
  openResumeFile,
  renameResume,
  resumeCheckSchema,
  resumeLinkSchema,
  resumeParam,
  resumeUpdateSchema,
  uploadResume,
  addQuestion,
  addRound,
  addTouchpoint,
  boardSchema,
  create,
  createSchema,
  deleteQuestion,
  deleteRound,
  deleteTouchpoint,
  getBoard,
  getDue,
  getFeed,
  getOne,
  getStats,
  lookup,
  lookupQuery,
  move,
  moveSchema,
  patchBoard,
  patchQuestion,
  patchRound,
  patchStage,
  patchTouchpoint,
  postMortemSchema,
  putPostMortem,
  questionCreateSchema,
  questionParam,
  questionUpdateSchema,
  remove,
  restore,
  roundCreateSchema,
  roundParam,
  roundUpdateSchema,
  stageSchema,
  touchpointParam,
  touchpointSchema,
  update,
  updateSchema,
} from '../controllers/application.controller.js';
import { uploadLimiter } from '../middleware/rateLimit.js';
import { singleResume } from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';
import { idParam } from '../utils/query.js';

/**
 * The applications module.
 *
 * One router — nothing here is reachable without a session, and there is no
 * second audience for any of it. An application has one reader by design: there
 * is no sharing, no public surface and nobody to assign anything to, which is
 * what keeps this a single table rather than a pair.
 *
 * Mounted below `requireAuth`, below `writeLimiter` and behind
 * `requireModule('applications')` in routes/index.js, so a route added to this
 * file tomorrow is covered by having been added here at all.
 */

export const applicationRouter = Router();

/*
  The literal paths come first, and that ordering is required rather than
  stylistic: Express matches in declaration order, so `/due` or `/move`
  declared after `/:id` would be swallowed by the id route and rejected as a
  malformed ObjectId.
*/
applicationRouter.get('/due', getDue);
applicationRouter.get('/stats', getStats);
applicationRouter.get('/feed', getFeed);
applicationRouter.get('/lookup', validate(lookupQuery, 'query'), lookup);
applicationRouter.post('/move', validate(moveSchema), move);
applicationRouter.patch('/board', validate(boardSchema), patchBoard);

/* ------------------------------------------------------------ the CV library */

/*
  Also above `/:id`, for the same reason — `resumes` would otherwise be read as
  an application id and rejected.

  `/check` is the one that saves the upload: the browser hashes the file and
  asks first, and only a miss is followed by `POST /resumes` with the bytes.
  `uploadLimiter` sits in front of that one before anything else, so multer
  never allocates for a request that is going to be refused.
*/
applicationRouter.get('/resumes', listResumes);
applicationRouter.post('/resumes/check', validate(resumeCheckSchema), checkResume);
applicationRouter.post('/resumes/link', validate(resumeLinkSchema), linkResume);
applicationRouter.post('/resumes', uploadLimiter, singleResume('file'), uploadResume);
/* The file itself — streamed from here, never linked to the CDN. See the handler. */
applicationRouter.get('/resumes/:resumeId/file', validate(resumeParam, 'params'), openResumeFile);
applicationRouter.patch(
  '/resumes/:resumeId',
  validate(resumeParam, 'params'),
  validate(resumeUpdateSchema),
  renameResume,
);
applicationRouter.delete('/resumes/:resumeId', validate(resumeParam, 'params'), deleteResume);

/* ------------------------------------------------------------ applications */

applicationRouter.get('/', getBoard);
applicationRouter.post('/', validate(createSchema), create);

applicationRouter.get('/:id', validate(idParam, 'params'), getOne);
applicationRouter.patch('/:id', validate(idParam, 'params'), validate(updateSchema), update);
applicationRouter.delete('/:id', validate(idParam, 'params'), remove);

applicationRouter.post('/:id/restore', validate(idParam, 'params'), restore);

/*
  The stage on its own, for the drawer's dropdown and the chip on a closed card.
  Separate from `/move`, which is a drag and carries the order it produced —
  see the note on the handler.
*/
applicationRouter.patch(
  '/:id/stage',
  validate(idParam, 'params'),
  validate(stageSchema),
  patchStage,
);

applicationRouter.put(
  '/:id/post-mortem',
  validate(idParam, 'params'),
  validate(postMortemSchema),
  putPostMortem,
);

/* ------------------------------------------------------------ rounds */

applicationRouter.post(
  '/:id/rounds',
  validate(idParam, 'params'),
  validate(roundCreateSchema),
  addRound,
);
applicationRouter.patch(
  '/:id/rounds/:roundId',
  validate(roundParam, 'params'),
  validate(roundUpdateSchema),
  patchRound,
);
applicationRouter.delete('/:id/rounds/:roundId', validate(roundParam, 'params'), deleteRound);

/* ------------------------------------------------------------ questions */

applicationRouter.post(
  '/:id/rounds/:roundId/questions',
  validate(roundParam, 'params'),
  validate(questionCreateSchema),
  addQuestion,
);
applicationRouter.patch(
  '/:id/rounds/:roundId/questions/:questionId',
  validate(questionParam, 'params'),
  validate(questionUpdateSchema),
  patchQuestion,
);
applicationRouter.delete(
  '/:id/rounds/:roundId/questions/:questionId',
  validate(questionParam, 'params'),
  deleteQuestion,
);

/* ------------------------------------------------------------ touchpoints */

applicationRouter.post(
  '/:id/touchpoints',
  validate(idParam, 'params'),
  validate(touchpointSchema),
  addTouchpoint,
);
applicationRouter.patch(
  '/:id/touchpoints/:touchpointId',
  validate(touchpointParam, 'params'),
  validate(touchpointSchema),
  patchTouchpoint,
);
applicationRouter.delete(
  '/:id/touchpoints/:touchpointId',
  validate(touchpointParam, 'params'),
  deleteTouchpoint,
);
