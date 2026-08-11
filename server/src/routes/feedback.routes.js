import { Router } from 'express';
import {
  create,
  createSchema,
  listMine,
  listQuery,
} from '../controllers/feedback.controller.js';
import { validate } from '../middleware/validate.js';

/**
 * What a signed-in person can do with their own feedback: send it, and read what
 * came back.
 *
 * There is no `/:id` here and that is not an omission. The card carries the whole
 * message and the whole reply, so a detail route would hand the client what it
 * already has. Anyone adding one later should also note that a literal segment —
 * `/feedback/stats`, say — has to be declared *above* it, or Express reads the
 * word as an id and the validator rejects it with a message about the id that
 * route does not have. note.routes.js has the worked example.
 *
 * Editing and deleting are absent on purpose. A submission is a message that has
 * been received; rewriting it after somebody has read and answered it makes the
 * queue change under its reader, and deleting it deletes their reply.
 */
export const feedbackRouter = Router();

feedbackRouter.get('/', validate(listQuery, 'query'), listMine);
feedbackRouter.post('/', validate(createSchema), create);
