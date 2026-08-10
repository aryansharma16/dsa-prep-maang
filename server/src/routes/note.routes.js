import { Router } from 'express';
import {
  assetParam,
  create,
  createSchema,
  getOne,
  getShared,
  listMine,
  listPublic,
  listQuery,
  listTags,
  publicIdParam,
  publicListQuery,
  purge,
  remove,
  removeAsset,
  restore,
  update,
  updateSchema,
  uploadAssets,
} from '../controllers/note.controller.js';
import { multipleFiles } from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';
import { idParam } from '../utils/query.js';

/**
 * Two routers, because this module has two audiences and only one of them is
 * signed in.
 *
 * `sharedNoteRouter` is mounted above the auth gate in routes/index.js and holds
 * exactly the endpoints a stranger with a link may reach. `noteRouter` is
 * mounted below it and assumes `req.userId`. Keeping them in separate objects
 * means the split is visible here rather than resting on where a line happens to
 * sit in another file — the thing index.js warns about in its own comment.
 */

/* ------------------------------------------------------------ public */

export const sharedNoteRouter = Router();

sharedNoteRouter.get('/', validate(publicListQuery, 'query'), listPublic);
sharedNoteRouter.get('/:publicId', validate(publicIdParam, 'params'), getShared);

/* ------------------------------------------------------------ authed */

export const noteRouter = Router();

/*
  Before `/:id`, and that ordering is required rather than stylistic: Express
  matches in declaration order, so a `/tags` declared afterwards would be
  swallowed by the id route and fail validation as a malformed ObjectId.
*/
noteRouter.get('/tags', listTags);

noteRouter.get('/', validate(listQuery, 'query'), listMine);
noteRouter.post('/', validate(createSchema), create);

noteRouter.get('/:id', validate(idParam, 'params'), getOne);
noteRouter.patch('/:id', validate(idParam, 'params'), validate(updateSchema), update);
noteRouter.delete('/:id', validate(idParam, 'params'), remove);

noteRouter.post('/:id/restore', validate(idParam, 'params'), restore);
noteRouter.delete('/:id/permanent', validate(idParam, 'params'), purge);

/*
  Images and PDFs together, since a note takes both. The ceiling is per file and
  the count is what bounds the request: memory storage means 10 × 25MB is a
  quarter gigabyte of buffers in the worst case, which is already as much as a
  small instance should hold for one upload.
*/
noteRouter.post(
  '/:id/assets',
  validate(idParam, 'params'),
  multipleFiles('files', { maxMb: 25, maxFiles: 10 }),
  uploadAssets,
);
noteRouter.delete('/:id/assets/:fileId', validate(assetParam, 'params'), removeAsset);
