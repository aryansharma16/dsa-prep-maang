import { File } from '../models/File.js';
import { Problem } from '../models/Problem.js';
import { MAX_SESSION_SECONDS, Task } from '../models/Task.js';
import { MAX_STATUSES, TaskBoard } from '../models/TaskBoard.js';
import { ApiError } from '../utils/ApiError.js';
import { removeFile, storeFiles } from './file.service.js';
import { DOCUMENT_TYPES, IMAGE_TYPES, urlFor } from './s3.service.js';

/**
 * Everything the tasks module does that is not routing or validation.
 *
 * Four jobs live here rather than in the controller, each because it is a rule
 * about the data that has to hold whichever endpoint is asking:
 *
 *   1. Which board a request is about — `boardFor`, which also creates it, so
 *      no endpoint has to cope with a person who has never opened the page.
 *   2. Which column a task may sit in — `assertStatus`, so a task can never
 *      point at a status id that is not on its owner's board.
 *   3. What starting and stopping a clock means, including the part nobody
 *      remembers: at most one runs at a time, and finishing something stops it.
 *   4. Which problems and which S3 objects a task is allowed to name. Both are
 *      resolved from the database against the caller, never trusted from the
 *      request.
 */

/** Where every file uploaded through this module lands, in S3 and in the index. */
export const TASK_FOLDER = 'tasks';
export const TASK_PURPOSE = 'task-attachment';

/**
 * A ceiling on live tasks per account.
 *
 * Far above any real board — it is here to stop a loop, not to shape a feature,
 * which is the argument `VIEW_LIMITS` already makes. Without it this is an
 * unbounded per-account document store that anything with a session can fill.
 */
export const MAX_TASKS = 500;

/**
 * Runs shorter than this are discarded rather than recorded.
 *
 * Starting a timer on the wrong card and stopping it immediately is a misclick,
 * and a three-second session is noise in a list whose whole job is to be read.
 * Short enough that nothing anyone meant to measure falls through it.
 */
const MIN_SESSION_SECONDS = 5;

/* -------------------------------------------------------------------------- */
/* the board                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * This person's board, created with its default columns if it does not exist.
 *
 * Created on read rather than at registration, so the collection only holds
 * boards for people who actually opened the page, and so the module can be
 * switched on for an existing deployment without a backfill.
 *
 * The `11000` catch is the two-tabs case: both find nothing, both insert, one
 * loses. Re-reading is correct because by then the other tab's board exists —
 * the same shape `upsertProgress` uses for a double-clicked status.
 */
export async function boardFor(userId) {
  const existing = await TaskBoard.findOne({ user: userId });
  if (existing) return existing;

  try {
    return await TaskBoard.create({ user: userId });
  } catch (err) {
    if (err?.code === 11000) return TaskBoard.findOne({ user: userId });
    throw err;
  }
}

/** One column by id, or undefined. Ids are sub-document `_id`s, so compare as strings. */
export const findStatus = (board, statusId) =>
  (board.statuses || []).find((status) => String(status._id) === String(statusId));

/**
 * The column a write says it is for, or a 400.
 *
 * Every path that sets `task.status` goes through this. A task pointing at a
 * status that is not on its board renders in no column at all — present in the
 * database, invisible on the page, and indistinguishable from data loss.
 */
export function assertStatus(board, statusId) {
  const status = findStatus(board, statusId);
  if (!status) throw ApiError.badRequest('That column is not on this board', 'NO_SUCH_STATUS');
  return status;
}

/** Columns in draw order. */
export const orderedStatuses = (board) =>
  [...(board.statuses || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

/**
 * Adds a column.
 *
 * Only one `done` column is allowed, because `kind` is what decides whether a
 * task counts as finished and two of them would make that question ambiguous
 * for every consumer. Two `active` columns are fine — "Reading" and "Writing"
 * are both in progress and nothing branches on there being one of them.
 */
export async function addStatus(board, { name, hue, kind }) {
  if ((board.statuses || []).length >= MAX_STATUSES) {
    throw ApiError.badRequest(`A board holds at most ${MAX_STATUSES} columns`, 'TOO_MANY_STATUSES');
  }
  if (kind === 'done' && (board.statuses || []).some((s) => s.kind === 'done')) {
    throw ApiError.badRequest(
      'This board already has a done column — change that one first',
      'DONE_EXISTS',
    );
  }

  const order = Math.max(-1, ...(board.statuses || []).map((s) => s.order ?? 0)) + 1;
  board.statuses.push({ name, hue, kind, order });
  await board.save();

  return board.statuses[board.statuses.length - 1];
}

/**
 * Edits one column.
 *
 * Changing a column *to* `done` is what completes every task already sitting in
 * it, and changing one away from `done` un-completes them. Doing that here
 * rather than leaving it to the client is what keeps `completedAt` meaning the
 * same thing however it was set — a task in a done column always has one.
 */
export async function editStatus(board, statusId, changes) {
  const status = assertStatus(board, statusId);
  const wasDone = status.kind === 'done';

  if (changes.kind === 'done' && !wasDone && board.statuses.some((s) => s.kind === 'done')) {
    throw ApiError.badRequest(
      'This board already has a done column — change that one first',
      'DONE_EXISTS',
    );
  }

  if (changes.name !== undefined) status.name = changes.name;
  if (changes.hue !== undefined) status.hue = changes.hue;
  if (changes.kind !== undefined) status.kind = changes.kind;

  await board.save();

  const nowDone = status.kind === 'done';
  if (nowDone !== wasDone) await recompleteColumn(board, status, nowDone);

  return status;
}

/**
 * Brings a column's tasks in line with its `kind` after that kind changed.
 *
 * Running clocks are stopped one at a time rather than in a bulk write: closing
 * a run means reading `runningSince`, capping it and pushing a session, which
 * is per-document work no `updateMany` can express. There is at most one
 * running task per account, so this is one extra save at worst.
 */
async function recompleteColumn(board, status, done) {
  const filter = { user: board.user, status: status._id, deletedAt: null };

  if (!done) {
    await Task.updateMany(filter, { $set: { completedAt: null } });
    return;
  }

  const now = new Date();
  await Task.updateMany(
    { ...filter, completedAt: null },
    { $set: { completedAt: now } },
  );

  const running = await Task.find({ ...filter, runningSince: { $ne: null } });
  for (const task of running) {
    closeRun(task, now);
    // eslint-disable-next-line no-await-in-loop -- at most one, and each is a distinct document
    await task.save();
  }
}

/**
 * Removes a column, after its tasks have somewhere to go.
 *
 * `moveTo` is required whenever the column holds anything. Deleting tasks along
 * with their column would make a rename-gone-wrong unrecoverable, and silently
 * moving them to a column the caller did not choose is the kind of guess that
 * is only ever noticed once it is too late.
 *
 * The last column cannot go: a board with no columns has nowhere to put the
 * next task, and the empty state would have to be a special case in every view.
 */
export async function removeStatus(board, statusId, moveTo = null) {
  const status = assertStatus(board, statusId);

  if ((board.statuses || []).length <= 1) {
    throw ApiError.badRequest('A board needs at least one column', 'LAST_STATUS');
  }

  const held = await Task.countDocuments({ user: board.user, status: status._id, deletedAt: null });

  if (held > 0) {
    if (!moveTo) {
      const error = ApiError.badRequest(
        `${held} ${held === 1 ? 'task is' : 'tasks are'} in that column — say where they should go`,
        'STATUS_NOT_EMPTY',
      );
      error.meta = { tasks: held };
      throw error;
    }
    if (String(moveTo) === String(statusId)) {
      throw ApiError.badRequest('Tasks cannot move to the column being deleted', 'BAD_DESTINATION');
    }

    const destination = assertStatus(board, moveTo);
    const now = new Date();

    await Task.updateMany(
      { user: board.user, status: status._id, deletedAt: null },
      {
        $set: {
          status: destination._id,
          completedAt: destination.kind === 'done' ? now : null,
        },
      },
    );

    // The destination may be `done`, and moving a running task into it has to
    // stop the clock — the same rule a drag onto that column obeys.
    if (destination.kind === 'done') {
      const running = await Task.find({
        user: board.user,
        status: destination._id,
        runningSince: { $ne: null },
        deletedAt: null,
      });
      for (const task of running) {
        closeRun(task, now);
        // eslint-disable-next-line no-await-in-loop -- at most one
        await task.save();
      }
    }
  }

  board.statuses.pull({ _id: status._id });
  await board.save();

  return { moved: held };
}

/**
 * Reorders the columns from a full list of ids.
 *
 * A whole list rather than a from/to pair, so the result cannot depend on what
 * the server thought the previous order was — the client sends what it drew and
 * that is what is stored. Any id missing from the list keeps its place after
 * the ones that were named, which makes a stale client harmless rather than
 * destructive.
 */
export async function reorderStatuses(board, ids) {
  const known = new Set((board.statuses || []).map((status) => String(status._id)));
  for (const id of ids) {
    if (!known.has(String(id))) {
      throw ApiError.badRequest('That column is not on this board', 'NO_SUCH_STATUS');
    }
  }

  const rank = new Map(ids.map((id, index) => [String(id), index]));
  for (const status of board.statuses) {
    status.order = rank.has(String(status._id)) ? rank.get(String(status._id)) : ids.length;
  }

  await board.save();
  return orderedStatuses(board);
}

/* -------------------------------------------------------------------------- */
/* tasks                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * One live task belonging to the caller, or a 404.
 *
 * 404 and not 403 for someone else's task, so the response does not confirm
 * that the id exists — the rule `visibleProblem` already follows.
 */
export async function ownedTask(id, userId) {
  const task = await Task.findOne({ _id: id, user: userId, deletedAt: null });
  if (!task) throw ApiError.notFound('Task not found');
  return task;
}

/**
 * Applies a column to a task, with everything that column implies.
 *
 * The two side effects are here rather than at the call sites because there are
 * four call sites — create, patch, move, and deleting a column — and a rule
 * enforced in three of them is a bug in the fourth.
 */
export function applyStatus(task, status, now = new Date()) {
  task.status = status._id;

  if (status.kind === 'done') {
    // A finished task with a running clock is not a state worth being able to
    // reach: the number it produces is "how long until I remembered", not "how
    // long it took".
    closeRun(task, now);
    if (!task.completedAt) task.completedAt = now;
  } else {
    task.completedAt = null;
  }
}

/** Where a new card goes: the end of its column. */
export async function nextOrder(userId, statusId) {
  const last = await Task.findOne({ user: userId, status: statusId, deletedAt: null })
    .sort({ order: -1 })
    .select('order')
    .lean();
  return (last?.order ?? -1) + 1;
}

/**
 * Moves a card, and rewrites the destination column's order from the list the
 * client drew.
 *
 * `ids` is the destination column in full, so within-column reordering and
 * cross-column moves are the same operation and there is no second endpoint to
 * keep in step. Every id is checked against the caller before anything is
 * written — the list is the one part of this request that names other people's
 * documents, so it is the part that has to be verified rather than trusted.
 *
 * The source column is left with gaps in `order`. Nothing reads the numbers,
 * only their sort, so renumbering it would be a write that changes no output.
 */
export async function moveTask(board, { id, status: statusId, ids }) {
  const userId = board.user;
  const destination = assertStatus(board, statusId);
  const task = await ownedTask(id, userId);

  const unique = [...new Set(ids.map(String))];
  if (!unique.includes(String(id))) unique.push(String(id));

  const mine = await Task.countDocuments({
    _id: { $in: unique },
    user: userId,
    deletedAt: null,
  });
  if (mine !== unique.length) throw ApiError.notFound('Task not found');

  // The dragged card first, because it is the one whose column is changing and
  // the one whose side effects — the clock, the completion stamp — have to run.
  applyStatus(task, destination);
  task.order = unique.indexOf(String(id));
  await task.save();

  const others = unique.filter((other) => String(other) !== String(id));
  if (others.length) {
    await Task.bulkWrite(
      others.map((other) => ({
        updateOne: {
          filter: { _id: other, user: userId, deletedAt: null },
          update: { $set: { status: destination._id, order: unique.indexOf(other) } },
        },
      })),
    );
  }

  return task;
}

/* -------------------------------------------------------------------------- */
/* the clock                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Closes a running clock into a session. Mutates, does not save.
 *
 * Returns the session, or null if nothing was running or the run was too short
 * to be worth a row. Capping rather than discarding a long run keeps the fact
 * that work happened while bounding how wrong one forgotten timer can make
 * every average derived from it — and `truncated` is what lets it be seen as an
 * artefact rather than believed.
 */
export function closeRun(task, now = new Date()) {
  if (!task.runningSince) return null;

  const startedAt = task.runningSince;
  const raw = Math.max(0, Math.round((now.getTime() - startedAt.getTime()) / 1000));
  const truncated = raw > MAX_SESSION_SECONDS;
  const seconds = truncated ? MAX_SESSION_SECONDS : raw;

  task.runningSince = null;
  if (seconds < MIN_SESSION_SECONDS) return null;

  const endedAt = truncated ? new Date(startedAt.getTime() + seconds * 1000) : now;
  task.sessions.push({ startedAt, endedAt, seconds, truncated, manual: false });
  // `trackedSeconds` is recomputed by the model's pre-save hook.

  return task.sessions[task.sessions.length - 1];
}

/** Stops whatever this account has running. At most one, by index. */
export async function stopAllRunning(userId, now = new Date(), exceptId = null) {
  const running = await Task.find({
    user: userId,
    runningSince: { $ne: null },
    deletedAt: null,
    ...(exceptId ? { _id: { $ne: exceptId } } : {}),
  });

  const stopped = [];
  for (const task of running) {
    closeRun(task, now);
    // eslint-disable-next-line no-await-in-loop -- at most one, and each is its own document
    await task.save();
    stopped.push(task);
  }

  return stopped;
}

/**
 * Starts this task's clock, stopping any other first.
 *
 * The stop-then-start is the guarantee; the partial unique index on the model
 * is the backstop for two tabs doing it at the same instant. When that index
 * fires, the loser has already had its own stop pass run, so retrying once is
 * enough — the second attempt is racing nobody.
 */
export async function startTimer(task, userId) {
  if (task.runningSince) return task;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const now = new Date();
    // eslint-disable-next-line no-await-in-loop -- the retry depends on the failure
    await stopAllRunning(userId, now, task._id);

    task.runningSince = now;
    try {
      // eslint-disable-next-line no-await-in-loop -- as above
      await task.save();
      return task;
    } catch (err) {
      if (err?.code !== 11000 || attempt === 1) throw err;
      task.runningSince = null;
    }
  }

  return task;
}

/** Stops this task's clock. A no-op on a task that was not running. */
export async function stopTimer(task) {
  if (!task.runningSince) return { task, session: null };
  const session = closeRun(task);
  await task.save();
  return { task, session };
}

/* -------------------------------------------------------------------------- */
/* questions                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Turns problem ids into the snapshots a task stores.
 *
 * This is the module's authorisation boundary for the roadmap, and it is why
 * the client's titles are ignored: the scope clause is what stops a task naming
 * a problem in someone else's private set, and re-reading the row is what stops
 * a caller inventing a title for one. The same argument `resolveAssets` makes
 * about attachments.
 *
 * An id that does not resolve is an error rather than a silent drop. The client
 * picks these from the roadmap it was handed, so an unresolvable id is a bug or
 * a probe — in neither case is quietly attaching four of five the right answer.
 */
export async function resolveQuestions(problemIds, userId) {
  const unique = [...new Set(problemIds.map(String))];
  if (!unique.length) return [];

  const rows = await Problem.find({
    _id: { $in: unique },
    $or: [{ owner: null }, { owner: userId }],
  })
    .select('slug title difficulty patternSlug')
    .lean();

  if (rows.length !== unique.length) throw ApiError.notFound('Problem not found');

  return rows.map((row) => ({
    problem: row._id,
    slug: row.slug || '',
    title: row.title || '',
    difficulty: row.difficulty || '',
    patternSlug: row.patternSlug || '',
    addedAt: new Date(),
  }));
}

/* -------------------------------------------------------------------------- */
/* attachments                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Uploads files and records them against one task.
 *
 * `allow` is the list of types the leading bytes must actually sniff to, which
 * is a stronger claim than the multer filter that already ran: that one trusts
 * the `Content-Type` the client wrote. A rejection lands in `failed` rather
 * than failing the whole request, because nine good screenshots should not be
 * lost to one renamed archive.
 *
 * Task attachments are never public, so the stakes are lower than on a surface
 * that hands the bytes to a stranger. The check is worth it anyway: the argument
 * for sniffing is that S3 will serve back whatever type it was told, forever.
 */
export async function uploadTaskFiles(task, files, user) {
  const { files: rows, failed, total } = await storeFiles(files, {
    allow: [...IMAGE_TYPES, ...DOCUMENT_TYPES],
    folder: `${TASK_FOLDER}/${task._id}`,
    purpose: TASK_PURPOSE,
    owner: user.id,
    requestedBy: user.id,
    requestedByEmail: user.email || '',
    linkedTo: { type: 'task', id: String(task._id) },
  });

  const attachments = rows.map((row) => ({
    fileId: row._id,
    key: row.key,
    name: row.originalName,
    contentType: row.contentType,
    kind: row.kind,
    bytes: row.bytes ?? 0,
    width: row.width ?? null,
    height: row.height ?? null,
    url: row.url ?? null,
    addedAt: new Date(),
  }));

  task.attachments.push(...attachments);
  await task.save();

  const signed = await Promise.all(
    attachments.map(async (asset) => ({
      ...asset,
      url: asset.url || (await urlFor(asset.key)),
    })),
  );

  return { attachments: signed, failed, total };
}

/**
 * Detaches one file.
 *
 * Scoped by `linkedTo` as well as by owner, so a file id belonging to the
 * caller's avatar cannot be deleted through a tasks route. Soft, like
 * everything else — the sweeper takes the bytes later.
 */
export async function detachAttachment(task, fileId, userId) {
  const file = await File.findOne({
    _id: fileId,
    owner: userId,
    'linkedTo.type': 'task',
    'linkedTo.id': String(task._id),
    deletedAt: null,
  });
  if (!file) throw ApiError.notFound('That file is not attached to this task');

  await removeFile(file.key, userId);
  task.attachments = (task.attachments || []).filter(
    (asset) => String(asset.fileId) !== String(fileId),
  );
  await task.save();

  return file.key;
}

/**
 * Hard-deletes a task and releases every file it owns.
 *
 * Files first, then the row — the order file.service documents. Dropping the
 * task first and failing the file pass would strand every object it referenced:
 * `linkedTo.id` is the only index that knows they belong to anything, and the
 * task is what gives that id meaning.
 *
 * Found by `linkedTo` rather than by walking `attachments`, which is the only
 * way to catch a file that was uploaded and never recorded — a failed save, a
 * closed tab.
 */
export async function purgeTask(task, userId) {
  const files = await File.find({
    'linkedTo.type': 'task',
    'linkedTo.id': String(task._id),
    deletedAt: null,
  })
    .select('key')
    .lean();

  await Promise.all(files.map((file) => removeFile(file.key, userId)));
  await Task.deleteOne({ _id: task._id });

  return { files: files.length };
}

/* -------------------------------------------------------------------------- */
/* reading                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Attaches a usable URL to every attachment on every task.
 *
 * Per request, because the bucket is private and a signed URL expires — there
 * is nothing to store. Keys are deduplicated across the whole page first, so a
 * board of forty tasks costs one signature per distinct file rather than one
 * per reference.
 */
export async function hydrateTasks(tasks) {
  const plain = tasks.map((task) => (typeof task.toObject === 'function' ? task.toObject() : task));

  const keys = [
    ...new Set(
      plain.flatMap((task) => (task.attachments || []).map((asset) => asset.key)).filter(Boolean),
    ),
  ];
  if (!keys.length) return plain;

  const urls = new Map(await Promise.all(keys.map(async (key) => [key, await urlFor(key)])));

  for (const task of plain) {
    for (const asset of task.attachments || []) {
      asset.url = asset.url || urls.get(asset.key) || null;
    }
  }

  return plain;
}

/** The single-task case, so a caller with one document need not wrap it. */
export async function hydrateTask(task) {
  const [hydrated] = await hydrateTasks([task]);
  return hydrated;
}
