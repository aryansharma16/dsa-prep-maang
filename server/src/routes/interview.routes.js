import { Router } from 'express';
import {
  create,
  createSchema,
  idParam,
  list,
  listQuery,
  outreachSchema,
  remove,
  setOutreach,
  update,
  updateSchema,
} from '../controllers/recruiter.controller.js';
import { enroll, enrollSchema, getSprint, leave, sprintParam } from '../controllers/sprint.controller.js';
import {
  createStory,
  deleteStory,
  idParam as storyIdParam,
  listStories,
  logPractice,
  practiceSchema,
  storyPatchSchema,
  storySchema,
  updateStory,
} from '../controllers/story.controller.js';
import {
  deleteResume,
  listResumes,
  openResumeFile,
  resumeParam,
} from '../controllers/application.controller.js';
import {
  bankLinkSchema,
  bankUpdateSchema,
  linkToBank,
  updateInBank,
  uploadToBank,
} from '../controllers/resumeBank.controller.js';
import { uploadLimiter } from '../middleware/rateLimit.js';
import { singleResume } from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';

/**
 * Interview Helper's API. Mounted in routes/index.js below `requireAuth`,
 * `writeLimiter` and `requireModule('interview')`, so every route here is
 * signed-in, rate-limited and hidden with the module.
 */
export const interviewRouter = Router();

interviewRouter.get('/recruiters', validate(listQuery, 'query'), list);
interviewRouter.post('/recruiters', validate(createSchema), create);
interviewRouter.patch(
  '/recruiters/:id',
  validate(idParam, 'params'),
  validate(updateSchema),
  update,
);
interviewRouter.delete('/recruiters/:id', validate(idParam, 'params'), remove);
// Your own status and note for a contact; never touches anyone else's.
interviewRouter.put(
  '/recruiters/:id/outreach',
  validate(idParam, 'params'),
  validate(outreachSchema),
  setOutreach,
);

// The sprint plan (shared, read-only) and your own length and start date.
interviewRouter.get('/sprints/:key', validate(sprintParam, 'params'), getSprint);
interviewRouter.put(
  '/sprints/:key/enrollment',
  validate(sprintParam, 'params'),
  validate(enrollSchema),
  enroll,
);
interviewRouter.delete('/sprints/:key/enrollment', validate(sprintParam, 'params'), leave);

// Behavioral Prep: your STAR stories and practice log, private to you.
interviewRouter.get('/stories', listStories);
interviewRouter.post('/stories', validate(storySchema), createStory);
interviewRouter.patch('/stories/:id', validate(storyIdParam, 'params'), validate(storyPatchSchema), updateStory);
interviewRouter.delete('/stories/:id', validate(storyIdParam, 'params'), deleteStory);
interviewRouter.post('/stories/practice', validate(practiceSchema), logPractice);

// Resume bank: the same CV library as Applications, reachable here so it does
// not depend on the Applications module being visible.
interviewRouter.get('/resumes', listResumes);
interviewRouter.post('/resumes', uploadLimiter, singleResume('file'), uploadToBank);
interviewRouter.post('/resumes/link', validate(bankLinkSchema), linkToBank);
interviewRouter.get('/resumes/:resumeId/file', validate(resumeParam, 'params'), openResumeFile);
interviewRouter.patch('/resumes/:resumeId', validate(resumeParam, 'params'), validate(bankUpdateSchema), updateInBank);
interviewRouter.delete('/resumes/:resumeId', validate(resumeParam, 'params'), deleteResume);
