import { Readable } from 'node:stream';
import { z } from 'zod';

import {
  APPLY_METHOD_KEYS,
  CLOSED_REASONS,
  COLUMN_KEYS,
  CURRENCIES,
  EMPLOYMENT_TYPES,
  MAX_INTERVIEWERS,
  MAX_LINKS,
  MAX_STALE_AFTER_DAYS,
  MAX_TAGS,
  MIN_STALE_AFTER_DAYS,
  PRIORITIES,
  QUESTION_RATINGS,
  ROUND_MODES,
  ROUND_OUTCOME_KEYS,
  ROUND_TYPE_KEYS,
  SOURCES,
  STAGE_KEYS,
  TOUCHPOINT_KINDS,
  WORK_MODES,
} from '../config/applications.js';
import {
  Application,
  applicationCard,
  applicationTimeline,
  publicApplication,
} from '../models/Application.js';
import { publicApplicationBoard } from '../models/ApplicationBoard.js';
import {
  applyRoundPatch,
  assertQuestionRoom,
  assertRoom,
  assertRoundRoom,
  assertTouchpointRoom,
  boardFor,
  dueFor,
  ownedApplication,
  priorApplications,
  questionIn,
  removeRound,
  reorderLane,
  roundIn,
  setPostMortem,
  setStage,
  staleDaysOf,
  statsFor,
  touchpointIn,
} from '../services/application.service.js';
import { companySlug } from '../services/logo.service.js';
import {
  findByHash,
  ownedResume,
  recount,
  removeResume,
  resumeFile,
  resumeSnapshot,
  storeLink,
  storeUpload,
} from '../services/resume.service.js';
import { Resume, publicResume } from '../models/Resume.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { objectId } from '../utils/query.js';

/* -------------------------------------------------------------------------- */
/* validation                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * A date, or the absence of one.
 *
 * `null` is a value here and not a missing field — it is how "there is no date
 * on this" is said, and a schema that only accepted a date would make clearing
 * one impossible. `nullish` so both spellings arrive as the same thing. The
 * same argument `dueAt` makes next door in the tasks controller.
 */
const when = z.coerce.date().nullish();

/** Every amount is whole units of the currency. See compensationSchema. */
const money = z.number().int().min(0).max(1_000_000_000).nullish();

const linkSchema = z
  .object({
    label: z.string().trim().max(60).optional(),
    url: z.string().trim().min(1).max(2000),
  })
  .strict();

const interviewerSchema = z
  .object({
    name: z.string().trim().max(120).optional(),
    title: z.string().trim().max(120).optional(),
    contact: z.string().trim().max(200).optional(),
  })
  .strict();

const referrerSchema = z
  .object({
    name: z.string().trim().max(120).optional(),
    title: z.string().trim().max(120).optional(),
    relationship: z.string().trim().max(200).optional(),
    contact: z.string().trim().max(200).optional(),
    askedAt: when,
  })
  .strict();

const contactSchema = z
  .object({
    name: z.string().trim().max(120).optional(),
    title: z.string().trim().max(120).optional(),
    email: z.string().trim().max(200).optional(),
    phone: z.string().trim().max(40).optional(),
  })
  .strict();

const compSchema = z
  .object({
    currency: z.enum(CURRENCIES).optional(),
    expected: money,
    offered: money,
    base: money,
    bonus: money,
    joiningBonus: money,
    esop: money,
    esopNote: z.string().max(500).optional(),
    receivedAt: when,
    decideBy: when,
    notes: z.string().max(2000).optional(),
  })
  .strict();

/**
 * Everything an application carries, all optional.
 *
 * Shared between create and update, because there is nothing you may set at
 * creation that you may not change later — and a second near-identical schema
 * is the kind of pair that drifts on the first field added to one of them.
 * Create adds the one field it genuinely requires on top.
 *
 * `stage` is deliberately absent from both. It is set through `/move` or
 * `/:id/stage`, which is the only place `reached`, `appliedAt` and `closedAt`
 * are allowed to move — see `setStage`.
 */
const applicationFields = {
  company: z.string().trim().min(1).max(120).optional(),
  role: z.string().trim().max(140).optional(),
  team: z.string().trim().max(120).optional(),
  level: z.string().trim().max(60).optional(),
  employment: z.enum(EMPLOYMENT_TYPES).optional(),
  location: z.string().trim().max(120).optional(),
  workMode: z.enum([...WORK_MODES, '']).optional(),
  links: z.array(linkSchema).max(MAX_LINKS).optional(),
  jdText: z.string().max(20000).optional(),
  source: z.enum(SOURCES).optional(),
  sourceNote: z.string().trim().max(200).optional(),
  applyMethod: z.enum([...APPLY_METHOD_KEYS, '']).optional(),
  /*
    An id into the CV library, never a URL. The label and link the application
    stores are copied from the library row on the server, so a client cannot
    attach a CV it does not own. `null` detaches it.
  */
  resumeId: objectId.nullish(),
  /* `null` clears it — which is how "they did not refer me after all" is said. */
  referrer: referrerSchema.nullish(),
  contact: contactSchema.nullish(),
  appliedAt: when,
  followUpBy: when,
  comp: compSchema.nullish(),
  closedReason: z.enum([...CLOSED_REASONS, '']).optional(),
  excitement: z.number().int().min(1).max(5).nullish(),
  priority: z.enum(PRIORITIES).optional(),
  notes: z.string().max(8000).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(MAX_TAGS).optional(),
};

export const createSchema = z
  .object({
    ...applicationFields,
    /*
      The only required field, and that is the whole point of the add form: you
      type a company name and get a card. Everything else is filled in as you
      learn it, which is the difference between a tracker you keep up and one
      you abandon in week two.
    */
    company: z.string().trim().min(1, 'Which company?').max(120),
    stage: z.enum(STAGE_KEYS).optional(),
  })
  .strict();

export const updateSchema = z.object(applicationFields).strict();

export const stageSchema = z
  .object({
    stage: z.enum(STAGE_KEYS).optional(),
    column: z.enum(COLUMN_KEYS).optional(),
  })
  .strict()
  .refine((body) => body.stage || body.column, 'Give a stage or a column');

/** A drag: the card, where it landed, and the lane in the order it was drawn. */
export const moveSchema = z
  .object({
    id: objectId,
    stage: z.enum(STAGE_KEYS).optional(),
    column: z.enum(COLUMN_KEYS).optional(),
    ids: z.array(objectId).max(500).optional(),
  })
  .strict()
  .refine((body) => body.stage || body.column, 'Give a stage or a column');

const roundFields = {
  type: z.enum(ROUND_TYPE_KEYS).optional(),
  label: z.string().trim().max(80).optional(),
  order: z.number().int().min(0).max(100).optional(),
  scheduledAt: when,
  durationMinutes: z.number().int().min(0).max(600).nullish(),
  mode: z.enum([...ROUND_MODES, '']).optional(),
  interviewers: z.array(interviewerSchema).max(MAX_INTERVIEWERS).optional(),
  outcome: z.enum(ROUND_OUTCOME_KEYS).optional(),
  outcomeAt: when,
  feeling: z.number().int().min(1).max(5).nullish(),
  notes: z.string().max(4000).optional(),
};

export const roundCreateSchema = z.object(roundFields).strict();
export const roundUpdateSchema = z.object(roundFields).strict();

const questionFields = {
  text: z.string().trim().max(600).optional(),
  answer: z.string().max(4000).optional(),
  rating: z.enum([...QUESTION_RATINGS, '']).optional(),
  topic: z.string().trim().max(60).optional(),
  notes: z.string().max(1000).optional(),
  order: z.number().int().min(0).max(200).optional(),
};

export const questionCreateSchema = z
  .object({ ...questionFields, text: z.string().trim().min(1, 'What was asked?').max(600) })
  .strict();

export const questionUpdateSchema = z.object(questionFields).strict();

export const touchpointSchema = z
  .object({
    at: when,
    kind: z.enum(TOUCHPOINT_KINDS).optional(),
    fromThem: z.boolean().optional(),
    note: z.string().max(2000).optional(),
  })
  .strict();

export const postMortemSchema = z
  .object({
    roundId: objectId.nullish(),
    theirWord: z.string().max(2000).optional(),
    myRead: z.string().max(2000).optional(),
  })
  .strict();

export const boardSchema = z
  .object({
    columns: z
      .array(
        z
          .object({
            key: z.enum(COLUMN_KEYS),
            label: z.string().trim().min(1).max(40).optional(),
            hue: z.string().trim().max(20).optional(),
            order: z.number().int().min(0).max(20).optional(),
            hidden: z.boolean().optional(),
          })
          .strict(),
      )
      .max(COLUMN_KEYS.length)
      .optional(),
    defaultCurrency: z.enum(CURRENCIES).optional(),
    staleAfterDays: z.number().int().min(MIN_STALE_AFTER_DAYS).max(MAX_STALE_AFTER_DAYS).optional(),
  })
  .strict();

export const roundParam = z.object({ id: objectId, roundId: objectId });
export const questionParam = z.object({ id: objectId, roundId: objectId, questionId: objectId });
export const touchpointParam = z.object({ id: objectId, touchpointId: objectId });
export const lookupQuery = z.object({ company: z.string().trim().min(1).max(120) });

/* -------------------------------------------------------------------------- */
/* reading                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The board, and every application on it, in one read.
 *
 * `-rounds.questions` is the whole reason embedding the questions is safe: the
 * document holds everything, and the response holds what the screen needs. A
 * board of three hundred cards would otherwise ship every answer you have ever
 * typed in order to draw a column of company names.
 */
export const getBoard = asyncHandler(async (req, res) => {
  const board = await boardFor(req.userId);
  const staleAfterDays = staleDaysOf(board);

  const rows = await Application.live({ user: req.userId })
    .select('-rounds.questions -jdText -notes')
    .sort({ order: 1, createdAt: -1 })
    .lean();

  res.json({
    board: publicApplicationBoard(board),
    applications: rows.map((row) => applicationCard(row, { staleAfterDays })),
  });
});

export const getOne = asyncHandler(async (req, res) => {
  const board = await boardFor(req.userId);
  const app = await ownedApplication(req.params.id, req.userId);

  res.json({
    application: publicApplication(app.toObject(), { staleAfterDays: staleDaysOf(board) }),
    prior: await priorApplications(req.userId, app.companySlug, { exclude: app._id }),
  });
});

/** What the add form asks before you have finished typing the company name. */
export const lookup = asyncHandler(async (req, res) => {
  const prior = await priorApplications(req.userId, companySlug(req.query.company));
  res.json({ prior });
});

/**
 * Everything that happened, across every application, newest first.
 *
 * Built from the same `applicationTimeline` the drawer's timeline is, per
 * application, then merged — so the feed and the drawer cannot disagree about
 * what a round or a stage change looks like. The alternative, deriving it again
 * in the browser from the board's cards, was a second implementation of rules
 * that already live here, and it would also have missed the touchpoints, which
 * the card shape does not carry.
 *
 * Capped, because a feed is read from the top and nobody scrolls to the four
 * hundredth event; the cap is on events, not applications, so a quiet
 * application is never dropped in favour of a busy one's history.
 */
export const FEED_LIMIT = 400;

export const getFeed = asyncHandler(async (req, res) => {
  const rows = await Application.live({ user: req.userId })
    .select('-rounds.questions -jdText -notes')
    .lean();

  const events = rows
    .flatMap((app) =>
      applicationTimeline(app).map((event) => ({
        ...event,
        id: `${app._id}:${event.id}`,
        applicationId: app._id,
        company: app.company,
        logoSlug: app.companySlug || '',
        role: app.role || '',
        stage: app.stage,
      })),
    )
    .filter((event) => event.at && +new Date(event.at) <= Date.now() + 90 * 86400000)
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, FEED_LIMIT);

  res.json({ events });
});

export const getDue = asyncHandler(async (req, res) => {
  res.json(await dueFor(req.userId));
});

export const getStats = asyncHandler(async (req, res) => {
  res.json(await statsFor(req.userId));
});

/* -------------------------------------------------------------------------- */
/* writing                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Copy a validated patch onto the document.
 *
 * `undefined` means "not mentioned" and is skipped; `null` means "clear this"
 * and is written. The sub-documents that are `default: undefined` on the model
 * take `null` as "there is no referrer / no offer", which is what lets the
 * truthy check on the card stay a truthy check.
 */
const apply = (app, patch) => {
  Object.entries(patch).forEach(([key, value]) => {
    if (value === undefined) return;
    if (value === null && ['referrer', 'contact', 'comp'].includes(key)) {
      app.set(key, undefined);
      return;
    }
    app.set(key, value);
  });
};

/**
 * Point an application at a CV from the library, or at none.
 *
 * Returns the ids whose `usedCount` may have moved — the one it had and the one
 * it has now — so the caller can recount exactly those after saving.
 */
const attachResume = async (app, resumeId, userId) => {
  if (resumeId === undefined) return [];
  const before = app.resume?.id ? String(app.resume.id) : null;

  if (resumeId === null) {
    app.set('resume', undefined);
    return [before];
  }

  const resume = await ownedResume(resumeId, userId);
  app.set('resume', resumeSnapshot(resume));
  return [before, String(resume._id)];
};

export const create = asyncHandler(async (req, res) => {
  await assertRoom(req.userId);

  const board = await boardFor(req.userId);
  const { stage, resumeId, ...rest } = req.body;

  const app = new Application({ user: req.userId, company: rest.company });
  apply(app, rest);
  const touched = await attachResume(app, resumeId, req.userId);
  setStage(app, { stage: stage || 'applied' });

  /* New cards go to the top of their lane. Nothing you just typed should
     require a scroll to find. */
  app.order = -Date.now() / 1000;

  await app.save();
  await recount(req.userId, touched);

  res.status(201).json({
    application: publicApplication(app.toObject(), { staleAfterDays: staleDaysOf(board) }),
    prior: await priorApplications(req.userId, app.companySlug, { exclude: app._id }),
  });
});

export const update = asyncHandler(async (req, res) => {
  const board = await boardFor(req.userId);
  const app = await ownedApplication(req.params.id, req.userId);
  const { resumeId, ...rest } = req.body;

  apply(app, rest);
  const touched = await attachResume(app, resumeId, req.userId);
  await app.save();
  await recount(req.userId, touched);

  res.json({
    application: publicApplication(app.toObject(), { staleAfterDays: staleDaysOf(board) }),
  });
});

/**
 * The stage, changed from the drawer or from the chip on a closed card.
 *
 * Separate from `/move` because the two are different actions: this changes a
 * lane without saying anything about position, and `/move` is a drag that
 * carries the order it produced. Sharing one endpoint would mean every stage
 * change had to invent an ordering — the argument `PATCH /tasks/:id` already
 * makes against its own `/move`.
 */
export const patchStage = asyncHandler(async (req, res) => {
  const board = await boardFor(req.userId);
  const app = await ownedApplication(req.params.id, req.userId);

  setStage(app, req.body);
  await app.save();

  res.json({
    application: publicApplication(app.toObject(), { staleAfterDays: staleDaysOf(board) }),
  });
});

export const move = asyncHandler(async (req, res) => {
  const board = await boardFor(req.userId);
  const { id, stage, column, ids } = req.body;

  const app = await ownedApplication(id, req.userId);
  setStage(app, { stage, column });
  await app.save();

  /* After the save, so the moved card is in the lane whose order is written. */
  if (ids?.length) await reorderLane(req.userId, ids);

  const fresh = await ownedApplication(id, req.userId);
  res.json({
    application: publicApplication(fresh.toObject(), { staleAfterDays: staleDaysOf(board) }),
  });
});

export const remove = asyncHandler(async (req, res) => {
  const app = await Application.softDelete(req.params.id, req.userId);
  if (!app || String(app.user) !== String(req.userId)) {
    throw ApiError.notFound('Application not found');
  }
  /* A deleted application no longer counts as a use of its CV. */
  await recount(req.userId, [app.resume?.id]);
  res.json({ ok: true, id: app._id });
});

export const restore = asyncHandler(async (req, res) => {
  const board = await boardFor(req.userId);
  const app = await Application.findOneAndUpdate(
    { _id: req.params.id, user: req.userId, deletedAt: { $ne: null } },
    { $set: { deletedAt: null, deletedBy: null } },
    { new: true },
  );
  if (!app) throw ApiError.notFound('Application not found');
  await recount(req.userId, [app.resume?.id]);

  res.json({
    application: publicApplication(app.toObject(), { staleAfterDays: staleDaysOf(board) }),
  });
});

/* -------------------------------------------------------------------------- */
/* rounds                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Every round write answers with the whole application.
 *
 * Adding a round changes `nextRoundAt`, `lastActivityAt`, `roundCount` and the
 * entire timeline, so a response carrying only the round would leave the client
 * to recompute four derived fields it does not own the rules for. One shape
 * back, and the drawer re-renders from it.
 */
const respond = async (res, app, board) =>
  res.json({
    application: publicApplication(app.toObject(), { staleAfterDays: staleDaysOf(board) }),
  });

export const addRound = asyncHandler(async (req, res) => {
  const board = await boardFor(req.userId);
  const app = await ownedApplication(req.params.id, req.userId);
  assertRoundRoom(app);

  const round = app.rounds.create({ order: app.rounds.length });
  applyRoundPatch(round, req.body);
  app.rounds.push(round);

  await app.save();
  await respond(res, app, board);
});

export const patchRound = asyncHandler(async (req, res) => {
  const board = await boardFor(req.userId);
  const app = await ownedApplication(req.params.id, req.userId);

  applyRoundPatch(roundIn(app, req.params.roundId), req.body);
  app.markModified('rounds');

  await app.save();
  await respond(res, app, board);
});

export const deleteRound = asyncHandler(async (req, res) => {
  const board = await boardFor(req.userId);
  const app = await ownedApplication(req.params.id, req.userId);

  removeRound(app, req.params.roundId);

  await app.save();
  await respond(res, app, board);
});

/* -------------------------------------------------------------------------- */
/* questions                                                                   */
/* -------------------------------------------------------------------------- */

export const addQuestion = asyncHandler(async (req, res) => {
  const board = await boardFor(req.userId);
  const app = await ownedApplication(req.params.id, req.userId);
  const round = roundIn(app, req.params.roundId);
  assertQuestionRoom(round);

  round.questions.push({ ...req.body, order: round.questions.length });
  app.markModified('rounds');

  await app.save();
  await respond(res, app, board);
});

export const patchQuestion = asyncHandler(async (req, res) => {
  const board = await boardFor(req.userId);
  const app = await ownedApplication(req.params.id, req.userId);
  const question = questionIn(roundIn(app, req.params.roundId), req.params.questionId);

  Object.entries(req.body).forEach(([key, value]) => {
    if (value !== undefined) question[key] = value;
  });
  app.markModified('rounds');

  await app.save();
  await respond(res, app, board);
});

export const deleteQuestion = asyncHandler(async (req, res) => {
  const board = await boardFor(req.userId);
  const app = await ownedApplication(req.params.id, req.userId);
  const round = roundIn(app, req.params.roundId);

  questionIn(round, req.params.questionId);
  round.questions.pull({ _id: req.params.questionId });
  app.markModified('rounds');

  await app.save();
  await respond(res, app, board);
});

/* -------------------------------------------------------------------------- */
/* touchpoints and the post-mortem                                             */
/* -------------------------------------------------------------------------- */

export const addTouchpoint = asyncHandler(async (req, res) => {
  const board = await boardFor(req.userId);
  const app = await ownedApplication(req.params.id, req.userId);
  assertTouchpointRoom(app);

  app.touchpoints.push(req.body);

  await app.save();
  await respond(res, app, board);
});

export const patchTouchpoint = asyncHandler(async (req, res) => {
  const board = await boardFor(req.userId);
  const app = await ownedApplication(req.params.id, req.userId);
  const touchpoint = touchpointIn(app, req.params.touchpointId);

  Object.entries(req.body).forEach(([key, value]) => {
    if (value !== undefined) touchpoint[key] = value;
  });
  app.markModified('touchpoints');

  await app.save();
  await respond(res, app, board);
});

export const deleteTouchpoint = asyncHandler(async (req, res) => {
  const board = await boardFor(req.userId);
  const app = await ownedApplication(req.params.id, req.userId);

  touchpointIn(app, req.params.touchpointId);
  app.touchpoints.pull({ _id: req.params.touchpointId });

  await app.save();
  await respond(res, app, board);
});

export const putPostMortem = asyncHandler(async (req, res) => {
  const board = await boardFor(req.userId);
  const app = await ownedApplication(req.params.id, req.userId);

  setPostMortem(app, req.body);

  await app.save();
  await respond(res, app, board);
});

/* -------------------------------------------------------------------------- */
/* the board document                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Rename a lane, recolour it, reorder it, hide it.
 *
 * Columns are matched by `key`, which is `immutable` on the model — so this can
 * never add a lane, never delete one, and never change what a lane *means*. A
 * user-invented stage is a stage no report can classify, and the report is the
 * point of the module.
 */
export const patchBoard = asyncHandler(async (req, res) => {
  const board = await boardFor(req.userId);
  const { columns, defaultCurrency, staleAfterDays } = req.body;

  (columns || []).forEach((patch) => {
    const column = board.columns.find((item) => item.key === patch.key);
    if (!column) return;
    if (patch.label !== undefined) column.label = patch.label;
    if (patch.hue !== undefined) column.hue = patch.hue;
    if (patch.order !== undefined) column.order = patch.order;
    if (patch.hidden !== undefined) column.hidden = patch.hidden;
  });

  if (defaultCurrency !== undefined) board.defaultCurrency = defaultCurrency;
  if (staleAfterDays !== undefined) board.staleAfterDays = staleAfterDays;

  await board.save();
  res.json({ board: publicApplicationBoard(board) });
});

/* -------------------------------------------------------------------------- */
/* the CV library                                                              */
/* -------------------------------------------------------------------------- */

export const resumeParam = z.object({ resumeId: objectId });
export const resumeCheckSchema = z
  .object({ hash: z.string().regex(/^[a-f0-9]{64}$/, 'Not a SHA-256 hash') })
  .strict();
export const resumeLinkSchema = z
  .object({ url: z.string().trim().min(1).max(2000), label: z.string().trim().max(80).optional() })
  .strict();
export const resumeUpdateSchema = z
  .object({ label: z.string().trim().min(1).max(80) })
  .strict();

export const listResumes = asyncHandler(async (req, res) => {
  const rows = await Resume.find({ user: req.userId }).sort({ createdAt: -1 }).lean();
  res.json({ resumes: rows.map(publicResume) });
});

/**
 * "Have I uploaded this exact file before?" — asked with a hash, before any
 * bytes move. A hit is the whole saving: the browser links the row it gets
 * back and never uploads. A miss answers `null` and the upload goes ahead.
 */
export const checkResume = asyncHandler(async (req, res) => {
  const resume = await findByHash(req.userId, req.body.hash);
  res.json({ resume: resume ? publicResume(resume) : null });
});

export const uploadResume = asyncHandler(async (req, res) => {
  const { resume, existed } = await storeUpload(req.userId, req.file, {
    label: typeof req.body?.label === 'string' ? req.body.label.trim() : '',
  });
  /* 200 for "you already had this one", 201 for a new row — the client uses
     the difference to say which happened. */
  res.status(existed ? 200 : 201).json({ resume: publicResume(resume), existed });
});

export const linkResume = asyncHandler(async (req, res) => {
  const { resume, existed } = await storeLink(req.userId, req.body.url, {
    label: req.body.label,
  });
  res.status(existed ? 200 : 201).json({ resume: publicResume(resume), existed });
});

/**
 * Rename a CV, and carry the new name onto every application's snapshot.
 *
 * The snapshot exists for when the row is *gone*; while it is here it should
 * say what the row says, or the drawer and the picker disagree about what the
 * same file is called.
 */
export const renameResume = asyncHandler(async (req, res) => {
  const resume = await ownedResume(req.params.resumeId, req.userId);
  resume.label = req.body.label;
  await resume.save();
  await Application.updateMany(
    { user: req.userId, 'resume.id': resume._id },
    { $set: { 'resume.label': resume.label } },
  );
  res.json({ resume: publicResume(resume) });
});

/**
 * The CV itself, served from this app rather than from Cloudinary's CDN.
 *
 * See `resumeFile` for why. `inline` so a PDF opens in the browser's own viewer
 * instead of downloading, with the original filename for when it is saved —
 * written twice, as the RFC 5987 form a modern browser reads and a plain ASCII
 * fallback for one that does not. `private` caching, because this is somebody's
 * phone number and should never sit in a shared cache.
 */
export const openResumeFile = asyncHandler(async (req, res) => {
  const file = await resumeFile(req.userId, req.params.resumeId);
  if (file.redirect) {
    res.redirect(302, file.redirect);
    return;
  }

  const ascii = file.name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '');
  res.set({
    'Content-Type': file.type,
    'Content-Disposition': `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
    'Cache-Control': 'private, max-age=300',
    'X-Content-Type-Options': 'nosniff',
  });
  if (file.length) res.set('Content-Length', file.length);

  Readable.fromWeb(file.body).pipe(res);
});

export const deleteResume = asyncHandler(async (req, res) => {
  const resume = await removeResume(req.userId, req.params.resumeId);
  res.json({ ok: true, id: resume._id });
});
