import mongoose from 'mongoose';
import { z } from 'zod';
import { PRIORITIES, Task, publicTask } from '../models/Task.js';
import { STATUS_HUES, STATUS_KINDS, publicBoard, publicStatus } from '../models/TaskBoard.js';
import { User } from '../models/User.js';
import {
  MAX_TASKS,
  addStatus,
  applyStatus,
  assertStatus,
  boardFor,
  detachAttachment,
  editStatus,
  hydrateTask,
  hydrateTasks,
  moveTask,
  nextOrder,
  orderedStatuses,
  ownedTask,
  purgeTask,
  removeStatus,
  reorderStatuses,
  resolveQuestions,
  startTimer,
  stopTimer,
  uploadTaskFiles,
} from '../services/task.service.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { objectId } from '../utils/query.js';

const oid = (id) => new mongoose.Types.ObjectId(id);

/* -------------------------------------------------------------------------- */
/* validation                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * A deadline, or the absence of one.
 *
 * `null` is a value here, not a missing field — it is how "remove the deadline"
 * is said, and a schema that only accepted a date would make clearing one
 * impossible. `nullish` rather than `optional` so both spellings arrive as the
 * same thing.
 */
const dueAt = z.coerce.date().nullish();

const tags = z.array(z.string().trim().min(1).max(40)).max(20);

export const createSchema = z
  .object({
    title: z.string().trim().min(1, 'Give it a title').max(200),
    status: objectId.optional(),
    notes: z.string().max(4000).optional(),
    dueAt,
    priority: z.enum(PRIORITIES).optional(),
    tags: tags.optional(),
  })
  .strict();

/**
 * Everything editable in one place, all optional.
 *
 * `status` is here as well as on `/move` because the two are different actions:
 * this one changes a column without saying anything about position — what the
 * drawer's dropdown does — while `/move` is a drag and carries the order it
 * produced. Sharing one endpoint would mean every status change had to invent
 * an ordering.
 */
export const updateSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    status: objectId.optional(),
    notes: z.string().max(4000).optional(),
    dueAt,
    priority: z.enum(PRIORITIES).optional(),
    tags: tags.optional(),
  })
  .strict();

/**
 * A drag, as the client drew it.
 *
 * `ids` is the destination column in full rather than an index, so the server
 * never has to reconstruct what the board looked like — and a move computed
 * against a stale copy fails as a not-found rather than silently landing in the
 * wrong place.
 */
export const moveSchema = z
  .object({
    id: objectId,
    status: objectId,
    ids: z.array(objectId).max(MAX_TASKS),
  })
  .strict();

export const statusCreateSchema = z
  .object({
    name: z.string().trim().min(1, 'Give the column a name').max(40),
    hue: z.enum(STATUS_HUES).optional(),
    kind: z.enum(STATUS_KINDS).optional(),
  })
  .strict();

export const statusUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(40).optional(),
    hue: z.enum(STATUS_HUES).optional(),
    kind: z.enum(STATUS_KINDS).optional(),
  })
  .strict();

export const statusOrderSchema = z.object({ ids: z.array(objectId).min(1) }).strict();

/** The column endpoints take only their own id — the board is the caller's. */
export const statusIdParam = z.object({ statusId: objectId });
export const statusDeleteQuery = z.object({ moveTo: objectId.optional() });

export const subtaskCreateSchema = z
  .object({ title: z.string().trim().min(1, 'Give it a title').max(200) })
  .strict();

export const subtaskUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    done: z.boolean().optional(),
  })
  .strict();

export const subtaskParam = z.object({ id: objectId, subtaskId: objectId });

/** Ids only. Titles and difficulties are read from the roadmap — see `resolveQuestions`. */
export const questionsSchema = z
  .object({ problemIds: z.array(objectId).min(1).max(50) })
  .strict();

export const questionParam = z.object({ id: objectId, problemId: objectId });

/**
 * A session typed in after the fact.
 *
 * Minutes rather than seconds, because this is the field a person fills in and
 * nobody remembers to the second — the same unit `AttemptPopover` already asks
 * for. Capped at twelve hours, matching what a measured run is capped at, so
 * the two cannot disagree about how long a sitting is allowed to be.
 */
export const sessionSchema = z
  .object({
    minutes: z.coerce.number().int().min(1).max(12 * 60),
    endedAt: z.coerce.date().optional(),
  })
  .strict();

export const sessionParam = z.object({ id: objectId, sessionId: objectId });

export const attachmentParam = z.object({ id: objectId, fileId: objectId });

/* -------------------------------------------------------------------------- */
/* the page                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * GET /api/tasks — the board and everything on it.
 *
 * One response rather than two, because the columns and the cards are never
 * wanted apart: a board without its statuses cannot be drawn at all, and the
 * statuses are a dozen short subdocuments. Splitting them would buy a second
 * round trip and a render where the columns exist and the cards have not
 * arrived.
 *
 * Unpaged, deliberately. `MAX_TASKS` bounds the collection at 500 rows of a few
 * hundred bytes, every view on the page needs the whole set to group, count and
 * lay out, and a paged board is a board that cannot tell you how much is in the
 * column below the fold.
 */
export const getBoard = asyncHandler(async (req, res) => {
  const userId = oid(req.userId);
  const board = await boardFor(userId);

  const rows = await Task.live({ user: userId }).sort({ order: 1, createdAt: 1 });
  const tasks = await hydrateTasks(rows);

  res.json({ board: publicBoard(board), tasks: tasks.map(publicTask) });
});

/* -------------------------------------------------------------------------- */
/* tasks                                                                       */
/* -------------------------------------------------------------------------- */

export const create = asyncHandler(async (req, res) => {
  const userId = oid(req.userId);
  const board = await boardFor(userId);

  const live = await Task.countDocuments({ user: userId, deletedAt: null });
  if (live >= MAX_TASKS) {
    const error = ApiError.badRequest(
      `That is ${MAX_TASKS} tasks — finish or delete some before adding more`,
      'TOO_MANY_TASKS',
    );
    error.meta = { tasks: live, limit: MAX_TASKS };
    throw error;
  }

  // No column named means the leftmost one, which is what a quick-add from the
  // page header wants.
  const [first] = orderedStatuses(board);
  const status = assertStatus(board, req.body.status || first?._id);

  const task = new Task({
    user: userId,
    board: board._id,
    title: req.body.title,
    notes: req.body.notes ?? '',
    dueAt: req.body.dueAt ?? null,
    priority: req.body.priority ?? 'none',
    tags: req.body.tags ?? [],
    order: await nextOrder(userId, status._id),
  });
  applyStatus(task, status);
  await task.save();

  res.status(201).json({ task: publicTask(task) });
});

export const getOne = asyncHandler(async (req, res) => {
  const task = await ownedTask(req.params.id, oid(req.userId));
  res.json({ task: publicTask(await hydrateTask(task)) });
});

export const update = asyncHandler(async (req, res) => {
  const userId = oid(req.userId);
  const task = await ownedTask(req.params.id, userId);

  const { status: statusId, ...fields } = req.body;

  // `null` passes and `undefined` does not, which is the distinction the whole
  // patch rests on: `dueAt: null` is a real edit — clearing the deadline — while
  // an absent key means "leave it alone".
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) task[key] = value;
  }

  if (statusId && String(statusId) !== String(task.status)) {
    const board = await boardFor(userId);
    const status = assertStatus(board, statusId);
    applyStatus(task, status);
    task.order = await nextOrder(userId, status._id);
  }

  await task.save();
  res.json({ task: publicTask(await hydrateTask(task)) });
});

/**
 * DELETE /api/tasks/:id — soft.
 *
 * Soft because the task owns S3 objects, and dropping the row is what makes
 * their keys unfindable. It also gives an undo on a button whose mistake is
 * otherwise unrecoverable.
 */
export const remove = asyncHandler(async (req, res) => {
  const userId = oid(req.userId);
  const task = await ownedTask(req.params.id, userId);

  // A deleted task must not keep counting. This is the one stop that cannot be
  // reached by the `done` column rule, because deleting is not completing.
  await stopTimer(task);
  await Task.softDelete(task._id, userId);

  res.json({ ok: true, id: task._id });
});

export const restore = asyncHandler(async (req, res) => {
  const userId = oid(req.userId);
  const task = await Task.findOneAndUpdate(
    { _id: req.params.id, user: userId, deletedAt: { $ne: null } },
    { $set: { deletedAt: null, deletedBy: null } },
    { new: true },
  );
  if (!task) throw ApiError.notFound('Task not found');

  // The column it came from may have been deleted while it was gone.
  const board = await boardFor(userId);
  if (!board.statuses.some((status) => String(status._id) === String(task.status))) {
    const [first] = orderedStatuses(board);
    applyStatus(task, first);
    task.order = await nextOrder(userId, task.status);
    await task.save();
  }

  res.json({ task: publicTask(await hydrateTask(task)) });
});

/** DELETE /api/tasks/:id/permanent — the row and its bytes. */
export const purge = asyncHandler(async (req, res) => {
  const userId = oid(req.userId);
  const task = await Task.findOne({ _id: req.params.id, user: userId });
  if (!task) throw ApiError.notFound('Task not found');

  const { files } = await purgeTask(task, userId);
  res.json({ ok: true, id: task._id, filesReleased: files });
});

/** POST /api/tasks/move — a drag, applied. */
export const move = asyncHandler(async (req, res) => {
  const userId = oid(req.userId);
  const board = await boardFor(userId);
  const task = await moveTask(board, req.body);

  res.json({ task: publicTask(task) });
});

/* -------------------------------------------------------------------------- */
/* columns                                                                     */
/* -------------------------------------------------------------------------- */

export const createStatus = asyncHandler(async (req, res) => {
  const board = await boardFor(oid(req.userId));
  const status = await addStatus(board, req.body);
  res.status(201).json({ status: publicStatus(status), board: publicBoard(board) });
});

export const patchStatus = asyncHandler(async (req, res) => {
  const board = await boardFor(oid(req.userId));
  const status = await editStatus(board, req.params.statusId, req.body);
  res.json({ status: publicStatus(status), board: publicBoard(board) });
});

/**
 * DELETE /api/tasks/board/statuses/:statusId
 *
 * `?moveTo=` is required when the column holds anything. The service answers
 * `STATUS_NOT_EMPTY` with a count in `meta` when it is missing, which is what
 * the client turns into "these six tasks go to —".
 */
export const deleteStatus = asyncHandler(async (req, res) => {
  const board = await boardFor(oid(req.userId));
  const { moved } = await removeStatus(board, req.params.statusId, req.query.moveTo);
  res.json({ ok: true, moved, board: publicBoard(board) });
});

export const putStatusOrder = asyncHandler(async (req, res) => {
  const board = await boardFor(oid(req.userId));
  await reorderStatuses(board, req.body.ids);
  res.json({ board: publicBoard(board) });
});

/* -------------------------------------------------------------------------- */
/* subtasks                                                                    */
/* -------------------------------------------------------------------------- */

export const addSubtask = asyncHandler(async (req, res) => {
  const task = await ownedTask(req.params.id, oid(req.userId));

  const order = Math.max(-1, ...(task.subtasks || []).map((s) => s.order ?? 0)) + 1;
  task.subtasks.push({ title: req.body.title, order });
  await task.save();

  res.status(201).json({ task: publicTask(await hydrateTask(task)) });
});

export const patchSubtask = asyncHandler(async (req, res) => {
  const task = await ownedTask(req.params.id, oid(req.userId));

  const subtask = task.subtasks.id(req.params.subtaskId);
  if (!subtask) throw ApiError.notFound('Subtask not found');

  if (req.body.title !== undefined) subtask.title = req.body.title;
  if (req.body.done !== undefined) {
    subtask.done = req.body.done;
    // Stamped on the way in and cleared on the way out, so a re-ticked item
    // reads as done now rather than done whenever it first was.
    subtask.doneAt = req.body.done ? new Date() : null;
  }

  await task.save();
  res.json({ task: publicTask(await hydrateTask(task)) });
});

export const removeSubtask = asyncHandler(async (req, res) => {
  const task = await ownedTask(req.params.id, oid(req.userId));

  const subtask = task.subtasks.id(req.params.subtaskId);
  if (!subtask) throw ApiError.notFound('Subtask not found');

  task.subtasks.pull({ _id: subtask._id });
  await task.save();

  res.json({ task: publicTask(await hydrateTask(task)) });
});

/* -------------------------------------------------------------------------- */
/* questions                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * POST /api/tasks/:id/questions — attach problems from the roadmap.
 *
 * Takes a list rather than one id, because "I'll do these three today" is the
 * sentence the feature exists for and three round trips to say it would be
 * three chances to half-succeed.
 *
 * Attaching something already attached is a no-op rather than an error — the
 * picker is multi-select and re-picking a row is a normal thing to do.
 */
export const addQuestions = asyncHandler(async (req, res) => {
  const userId = oid(req.userId);
  const task = await ownedTask(req.params.id, userId);

  const resolved = await resolveQuestions(req.body.problemIds, userId);
  const already = new Set((task.questions || []).map((q) => String(q.problem)));

  task.questions.push(...resolved.filter((q) => !already.has(String(q.problem))));
  await task.save();

  res.json({ task: publicTask(await hydrateTask(task)) });
});

export const removeQuestion = asyncHandler(async (req, res) => {
  const task = await ownedTask(req.params.id, oid(req.userId));

  const before = task.questions.length;
  task.questions = task.questions.filter(
    (question) => String(question.problem) !== String(req.params.problemId),
  );
  if (task.questions.length === before) throw ApiError.notFound('That problem is not on this task');

  await task.save();
  res.json({ task: publicTask(await hydrateTask(task)) });
});

/* -------------------------------------------------------------------------- */
/* the clock                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The server's own clock, sent with every timer response.
 *
 * The client renders elapsed time by subtracting `runningSince` from now, and
 * "now" on a laptop four minutes fast would show four extra minutes. Sending
 * the server's instant lets the client hold the offset and subtract against the
 * same clock the timestamp was written by.
 */
const withNow = (body) => ({ ...body, now: new Date() });

export const timerStart = asyncHandler(async (req, res) => {
  const userId = oid(req.userId);
  const task = await ownedTask(req.params.id, userId);

  await startTimer(task, userId);
  res.json(withNow({ task: publicTask(await hydrateTask(task)) }));
});

export const timerStop = asyncHandler(async (req, res) => {
  const task = await ownedTask(req.params.id, oid(req.userId));

  await stopTimer(task);
  res.json(withNow({ task: publicTask(await hydrateTask(task)) }));
});

/**
 * GET /api/tasks/timer — whatever is running, for the top bar.
 *
 * Its own endpoint rather than a field on `/auth/me`, because the pill is drawn
 * on every page and the session is fetched once: a timer started on the tasks
 * page would not appear anywhere else until the next sign-in. Answers
 * `{ task: null }` rather than 404 when nothing is running — that is not a
 * missing resource, it is the ordinary answer.
 */
export const timerCurrent = asyncHandler(async (req, res) => {
  const task = await Task.findOne({
    user: oid(req.userId),
    runningSince: { $ne: null },
    deletedAt: null,
  });

  res.json(withNow({ task: task ? publicTask(task) : null }));
});

export const addSession = asyncHandler(async (req, res) => {
  const task = await ownedTask(req.params.id, oid(req.userId));

  const seconds = req.body.minutes * 60;
  const endedAt = req.body.endedAt ?? new Date();
  task.sessions.push({
    startedAt: new Date(endedAt.getTime() - seconds * 1000),
    endedAt,
    seconds,
    manual: true,
  });
  await task.save();

  res.status(201).json({ task: publicTask(await hydrateTask(task)) });
});

export const removeSession = asyncHandler(async (req, res) => {
  const task = await ownedTask(req.params.id, oid(req.userId));

  const session = task.sessions.id(req.params.sessionId);
  if (!session) throw ApiError.notFound('Session not found');

  task.sessions.pull({ _id: session._id });
  await task.save();

  res.json({ task: publicTask(await hydrateTask(task)) });
});

/* -------------------------------------------------------------------------- */
/* attachments                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * POST /api/tasks/:id/attachments — screenshots, PDFs, whatever the work needed.
 *
 * Partial success is a normal outcome: `failed` names what to retry rather than
 * losing the batch to one bad file.
 */
export const uploadAttachments = asyncHandler(async (req, res) => {
  const userId = oid(req.userId);
  const task = await ownedTask(req.params.id, userId);
  if (!req.files?.length) throw ApiError.badRequest('No files were sent', 'NO_FILES');

  const user = await User.findById(userId).select('email').lean();
  const result = await uploadTaskFiles(task, req.files, { id: userId, email: user?.email || '' });

  res.status(201).json({ ...result, task: publicTask(await hydrateTask(task)) });
});

export const removeAttachment = asyncHandler(async (req, res) => {
  const userId = oid(req.userId);
  const task = await ownedTask(req.params.id, userId);

  await detachAttachment(task, req.params.fileId, userId);
  res.json({ ok: true, task: publicTask(await hydrateTask(task)) });
});
