import mongoose from 'mongoose';

import {
  APPLICATION_STAGES,
  COLUMNS,
  DEFAULT_STALE_AFTER_DAYS,
  DUE_WINDOW_DAYS,
  MAX_APPLICATIONS,
  MAX_QUESTIONS_PER_ROUND,
  MAX_ROUNDS,
  MAX_TOUCHPOINTS,
  REACHED_KEYS,
  defaultStageFor,
  isOneClick,
  outcomeAdverse,
  outcomeHappened,
  roundFamily,
  stageClosed,
} from '../config/applications.js';
import { Application } from '../models/Application.js';
import { ApplicationBoard, DEFAULT_COLUMNS } from '../models/ApplicationBoard.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Everything the Applications module does that is not routing or validation.
 *
 * Four jobs, the same split `task.service.js` makes:
 *
 *   1. Which board a request is about — `boardFor`, which also creates it and
 *      reconciles it, so no endpoint has to cope with somebody who has never
 *      opened the page or who last opened it before a lane existed.
 *   2. Which application, round and question a request may touch —
 *      `ownedApplication` and the two lookups under it, so nothing in the
 *      controllers ever writes an ownership filter by hand.
 *   3. What moving a card *means*: the stage rules, which are the only place
 *      `reached`, `appliedAt` and `closedAt` are allowed to be written.
 *   4. The two reports — what is due, and the funnel.
 */

/* -------------------------------------------------------------------------- */
/* the board                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * This account's board, created on first read.
 *
 * The `11000` catch is the same one `boardFor` next door carries: two tabs can
 * both miss the `findOne` and both try to create, and the loser should get the
 * winner's board rather than a 500.
 *
 * The reconcile below it is the part `TaskBoard` does not need. Lanes here come
 * from a server-side list that can grow, and a board stored before a lane
 * existed would leave its cards in a column that never renders. So any key in
 * the config the stored board lacks is appended with its default label — the
 * mirror of the module list's "store what is hidden, not what is shown".
 */
export async function boardFor(userId) {
  let board = await ApplicationBoard.findOne({ user: userId });

  if (!board) {
    try {
      board = await ApplicationBoard.create({ user: userId });
    } catch (err) {
      if (err?.code !== 11000) throw err;
      board = await ApplicationBoard.findOne({ user: userId });
    }
  }

  const known = new Set((board.columns || []).map((column) => column.key));
  const missing = DEFAULT_COLUMNS.filter((column) => !known.has(column.key));

  if (missing.length) {
    const next = (board.columns || []).length;
    missing.forEach((column, index) => {
      board.columns.push({ ...column, order: next + index });
    });
    await board.save();
  }

  return board;
}

/** The board's stale threshold, for the projections that need it. */
export const staleDaysOf = (board) => board?.staleAfterDays ?? DEFAULT_STALE_AFTER_DAYS;

/* -------------------------------------------------------------------------- */
/* ownership                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * One application, or a 404.
 *
 * **404 and never 403**, the rule the whole API follows: a record you do not own
 * does not exist, and a 403 would confirm that it does.
 */
export async function ownedApplication(id, userId) {
  const app = await Application.findOne({ _id: id, user: userId, deletedAt: null });
  if (!app) throw ApiError.notFound('Application not found');
  return app;
}

/** Sub-document ids, so compare as strings. */
export function roundIn(app, roundId) {
  const round = (app.rounds || []).find((item) => String(item._id) === String(roundId));
  if (!round) throw ApiError.notFound('Round not found');
  return round;
}

export function questionIn(round, questionId) {
  const question = (round.questions || []).find((item) => String(item._id) === String(questionId));
  if (!question) throw ApiError.notFound('Question not found');
  return question;
}

export function touchpointIn(app, touchpointId) {
  const touchpoint = (app.touchpoints || []).find(
    (item) => String(item._id) === String(touchpointId),
  );
  if (!touchpoint) throw ApiError.notFound('Entry not found');
  return touchpoint;
}

/* -------------------------------------------------------------------------- */
/* ceilings                                                                    */
/* -------------------------------------------------------------------------- */

export async function assertRoom(userId) {
  const live = await Application.countDocuments({ user: userId, deletedAt: null });
  if (live >= MAX_APPLICATIONS) {
    throw ApiError.badRequest(
      `That is ${MAX_APPLICATIONS} live applications. Delete one before adding another.`,
      'TOO_MANY_APPLICATIONS',
    );
  }
}

export function assertRoundRoom(app) {
  if ((app.rounds || []).length >= MAX_ROUNDS) {
    throw ApiError.badRequest(`A loop can hold ${MAX_ROUNDS} rounds.`, 'TOO_MANY_ROUNDS');
  }
}

export function assertQuestionRoom(round) {
  if ((round.questions || []).length >= MAX_QUESTIONS_PER_ROUND) {
    throw ApiError.badRequest(
      `A round can hold ${MAX_QUESTIONS_PER_ROUND} questions.`,
      'TOO_MANY_QUESTIONS',
    );
  }
}

export function assertTouchpointRoom(app) {
  if ((app.touchpoints || []).length >= MAX_TOUCHPOINTS) {
    throw ApiError.badRequest(`That is ${MAX_TOUCHPOINTS} entries.`, 'TOO_MANY_TOUCHPOINTS');
  }
}

/* -------------------------------------------------------------------------- */
/* moving a card                                                               */
/* -------------------------------------------------------------------------- */

/**
 * What a drag into a lane means.
 *
 * A drag has to be a complete status update on its own — that is the whole
 * argument for a board over a form — so a lane with several stages in it needs
 * one it means by default. Only `closed` has that problem, and its answer is
 * `rejected`, because that is what nine closures in ten are; the other three are
 * one click on the chip the card grows when it lands there.
 *
 * An explicit stage always wins, so the chip and the drawer both go through
 * here too and there is exactly one place that knows what changing a stage
 * does. The actual stamping — `reached`, `appliedAt`, `closedAt` — is in the
 * model's pre-save hook, because it must also fire for a stage set any other
 * way.
 */
export function setStage(app, { stage, column }) {
  const next = stage || (column ? defaultStageFor(column) : null);
  if (!next) throw ApiError.badRequest('No stage given', 'NO_STAGE');
  if (!APPLICATION_STAGES[next]) throw ApiError.badRequest('Unknown stage', 'BAD_STAGE');

  app.stage = next;
  return app;
}

/**
 * Rewrite one lane's order from the list the client drew.
 *
 * Takes the ids in the order they now appear, exactly as `POST /tasks/move`
 * does, and writes `order` as the position in that list. Ids that are not this
 * person's live applications are dropped rather than rejected: a board open in
 * two tabs can name a card the other tab deleted, and failing the whole drag
 * over it would be a worse answer than moving the ones that are still there.
 */
export async function reorderLane(userId, ids = []) {
  if (!ids.length) return;

  const live = await Application.find({
    _id: { $in: ids },
    user: userId,
    deletedAt: null,
  }).select('_id');

  const allowed = new Set(live.map((row) => String(row._id)));
  const ops = ids
    .filter((id) => allowed.has(String(id)))
    .map((id, index) => ({
      updateOne: { filter: { _id: id, user: userId }, update: { $set: { order: index } } },
    }));

  if (ops.length) await Application.bulkWrite(ops);
}

/* -------------------------------------------------------------------------- */
/* rounds                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Apply an edit to a round, keeping the two things the client must not set.
 *
 * `rescheduledFrom` is appended here and nowhere else, so a date change records
 * itself whichever screen made it. `outcomeAt` is stamped when the outcome
 * stops being `scheduled` — and is left alone if the caller sent one, because
 * backdating "I heard on Friday" is a thing people do on Monday.
 */
export function applyRoundPatch(round, patch) {
  if (patch.scheduledAt !== undefined) {
    const before = round.scheduledAt;
    const after = patch.scheduledAt ? new Date(patch.scheduledAt) : null;
    const moved = Boolean(before) && Boolean(after) && +before !== +after;
    if (moved) round.rescheduledFrom.push(before);
    round.scheduledAt = after;
  }

  if (patch.outcome !== undefined && patch.outcome !== round.outcome) {
    round.outcome = patch.outcome;
    if (patch.outcomeAt === undefined) {
      round.outcomeAt = patch.outcome === 'scheduled' ? null : new Date();
    }
  }

  const direct = [
    'type',
    'label',
    'order',
    'durationMinutes',
    'mode',
    'interviewers',
    'feeling',
    'notes',
  ];
  direct.forEach((key) => {
    if (patch[key] !== undefined) round[key] = patch[key];
  });

  if (patch.outcomeAt !== undefined) {
    round.outcomeAt = patch.outcomeAt ? new Date(patch.outcomeAt) : null;
  }

  return round;
}

/**
 * Remove a round, and keep the post-mortem readable.
 *
 * The ref is nulled in the same save that pulls the round, and the two snapshot
 * fields are left alone — so a post-mortem still reads "died at the system
 * design round" rather than rendering a blank line. See `postMortemSchema`: a
 * dangling id reads as corruption, a dangling label reads as history.
 */
export function removeRound(app, roundId) {
  const round = roundIn(app, roundId);

  if (app.postMortem && String(app.postMortem.round || '') === String(roundId)) {
    app.postMortem.round = null;
    if (!app.postMortem.roundType) app.postMortem.roundType = round.type;
    if (!app.postMortem.roundLabel) app.postMortem.roundLabel = round.label || round.type;
  }

  app.rounds.pull({ _id: roundId });
  return app;
}

/**
 * Point a post-mortem at a round, snapshotting it server-side.
 *
 * The type and label are read off the round here and never echoed from the
 * request — the rule `resolveAssets` applies to attachments, for the same
 * reason: a client cannot describe a round it cannot see.
 */
export function setPostMortem(app, { roundId, theirWord, myRead }) {
  const round = roundId ? roundIn(app, roundId) : null;

  app.postMortem = {
    round: round ? round._id : null,
    roundType: round ? round.type : app.postMortem?.roundType || '',
    roundLabel: round ? round.label || round.type : app.postMortem?.roundLabel || '',
    theirWord: theirWord ?? app.postMortem?.theirWord ?? '',
    myRead: myRead ?? app.postMortem?.myRead ?? '',
  };

  return app;
}

/* -------------------------------------------------------------------------- */
/* have I been here before                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Earlier applications to the same company, for the create form's warning.
 *
 * Deleted ones are included deliberately — somewhere you trashed the record of
 * is exactly the one you have forgotten about, which is the case the warning
 * exists for. It is a warning and never a block: two roles at one company and
 * re-applying six months later are both normal, and the second outcome is the
 * only way to learn whether the first rejection stuck.
 */
export async function priorApplications(userId, slug, { exclude = null } = {}) {
  if (!slug) return [];

  const filter = { user: userId, companySlug: slug };
  if (exclude) filter._id = { $ne: exclude };

  return Application.find(filter)
    .sort({ appliedAt: -1 })
    .limit(5)
    .select('company role team stage appliedAt closedReason deletedAt')
    .lean();
}

/* -------------------------------------------------------------------------- */
/* what needs you                                                              */
/* -------------------------------------------------------------------------- */

/**
 * The badge's answer, and deliberately tiny.
 *
 * Three questions, one read: a round inside the window, a follow-up that has
 * come due, and an offer whose clock is running. It is drawn in the top bar on
 * every page, so it ships ids and dates and nothing else — the page itself is
 * one click away and has the whole record.
 */
export async function dueFor(userId, { days = DUE_WINDOW_DAYS } = {}) {
  const now = new Date();
  const horizon = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const rows = await Application.live({ user: userId })
    .or([
      { nextRoundAt: { $ne: null, $lte: horizon } },
      { followUpBy: { $ne: null, $lte: now } },
      { 'comp.decideBy': { $ne: null, $lte: horizon } },
    ])
    .select('company role stage nextRoundAt followUpBy comp.decideBy')
    .limit(50)
    .lean();

  const upcoming = [];
  const overdue = [];

  rows.forEach((row) => {
    /*
      What this row is due *for*, and when — the earlier of its next round and
      its offer deadline. Sorting by `nextRoundAt` alone put an offer expiring
      in four days above a phone screen tomorrow, because Mongo sorts the null
      round date first; the badge then named the wrong company with no date on
      it. `kind` is sent so the badge can say "offer decision" rather than
      presenting a deadline as if it were an interview.
    */
    const candidates = [
      row.nextRoundAt && { kind: 'round', at: row.nextRoundAt },
      row.comp?.decideBy && +row.comp.decideBy >= +now && { kind: 'decision', at: row.comp.decideBy },
    ].filter(Boolean);
    const soonest = candidates.sort((a, b) => new Date(a.at) - new Date(b.at))[0] || null;

    const card = {
      id: row._id,
      company: row.company,
      role: row.role || '',
      stage: row.stage,
      kind: soonest?.kind || 'follow_up',
      at: soonest?.at || row.followUpBy || null,
      nextRoundAt: row.nextRoundAt ?? null,
      followUpBy: row.followUpBy ?? null,
      decideBy: row.comp?.decideBy ?? null,
    };
    if (row.followUpBy && row.followUpBy <= now) overdue.push(card);
    else upcoming.push(card);
  });

  upcoming.sort((a, b) => new Date(a.at) - new Date(b.at));

  return { upcoming, overdue, count: upcoming.length + overdue.length };
}

/* -------------------------------------------------------------------------- */
/* the funnel                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Every number the report shows, off one read.
 *
 * An aggregation pipeline was the obvious shape and is the wrong one here. The
 * collection is capped at five hundred rows per account and the board endpoint
 * already reads all of them; three `$unwind`/`$group` pipelines would be three
 * more round trips to compute what fits in one pass over a list this size. The
 * bargain the roadmap and Tasks both strike — one fetch, every view derived
 * from it — applies to the report as well.
 *
 * What the pipeline could not have done cheaply at all is the second half of
 * the kill report, below.
 */
export async function statsFor(userId) {
  const rows = await Application.live({ user: userId })
    .select(
      'stage source applyMethod referrer reached appliedAt firstReplyAt closedReason rounds.type rounds.outcome rounds.scheduledAt',
    )
    .lean();

  /* `wishlist` never applied, so counting it would make every conversion rate a
     function of how much window-shopping you did that month. */
  const applied = rows.filter((row) => row.reached?.applied);

  /* ---- the funnel ------------------------------------------------------- */

  const reachedCount = (key) => applied.filter((row) => row.reached?.[key]).length;
  const funnel = REACHED_KEYS.map((key) => ({ stage: key, count: reachedCount(key) }));

  /* ---- conversion by source, cut by referral ---------------------------- */

  const bySource = new Map();
  applied.forEach((row) => {
    const key = `${row.source}|${row.referrer ? 'referred' : 'direct'}`;
    const seen = bySource.get(key) || {
      source: row.source,
      referred: Boolean(row.referrer),
      applied: 0,
      screening: 0,
      in_process: 0,
      offer: 0,
    };
    seen.applied += 1;
    if (row.reached?.screening) seen.screening += 1;
    if (row.reached?.in_process) seen.in_process += 1;
    if (row.reached?.offer) seen.offer += 1;
    bySource.set(key, seen);
  });

  /* ---- one click, or a real application --------------------------------- */

  /*
    The comparison this field exists for, and it is deliberately its own block
    rather than a third dimension on `bySource` above — cutting by source *and*
    referral *and* method at once produces groups of one and a table nobody can
    read. Kept flat, it answers the question people actually have: does pressing
    Easy Apply ever work.

    `''` is a real row here rather than being dropped. Most of the first hundred
    applications anybody logs will not have this recorded, and a report that
    quietly excluded them would show a conversion rate computed from six rows
    while looking like it was computed from ninety.
  */
  const byMethod = new Map();
  applied.forEach((row) => {
    const key = row.applyMethod || '';
    const seen = byMethod.get(key) || {
      method: key,
      oneClick: isOneClick(key),
      applied: 0,
      screening: 0,
      in_process: 0,
      offer: 0,
    };
    seen.applied += 1;
    if (row.reached?.screening) seen.screening += 1;
    if (row.reached?.in_process) seen.in_process += 1;
    if (row.reached?.offer) seen.offer += 1;
    byMethod.set(key, seen);
  });

  /* ---- where applications die ------------------------------------------ */

  /*
    Two populations, and the second is what a naive query misses.

    The obvious one is rounds whose outcome is adverse. On its own it reports
    that DSA is killing you, when what is actually killing you is never hearing
    back after the hiring-manager round — so a `ghosted` application is charged
    to its last round that actually happened. Without that half, the round type
    that ends the most applications is invisible precisely because nobody ever
    told you it had ended.
  */
  const kills = new Map();
  const charge = (type) => {
    const seen = kills.get(type) || { type, family: roundFamily(type), count: 0 };
    seen.count += 1;
    kills.set(type, seen);
  };

  rows.forEach((row) => {
    const rounds = row.rounds || [];
    rounds.filter((round) => outcomeAdverse(round.outcome)).forEach((round) => charge(round.type));

    if (row.stage === 'ghosted') {
      const sat = rounds.filter((round) => outcomeHappened(round.outcome));
      const last = sat[sat.length - 1];
      if (last) charge(last.type);
    }
  });

  /* ---- how long they take to come back ---------------------------------- */

  /*
    Median and not mean: one recruiter who answers after a hundred and forty
    days moves a mean and does not move a median.
  */
  const waits = applied
    .filter((row) => row.appliedAt && row.firstReplyAt)
    .map((row) => Math.round((+new Date(row.firstReplyAt) - +new Date(row.appliedAt)) / 86400000))
    .filter((days) => days >= 0)
    .sort((a, b) => a - b);

  const median = waits.length
    ? waits.length % 2
      ? waits[(waits.length - 1) / 2]
      : Math.round((waits[waits.length / 2 - 1] + waits[waits.length / 2]) / 2)
    : null;

  /* ---- how the questions went ------------------------------------------- */

  const totals = {
    all: rows.length,
    applied: applied.length,
    live: rows.filter((row) => APPLICATION_STAGES[row.stage]?.kind === 'open').length,
    closed: rows.filter((row) => stageClosed(row.stage)).length,
    referred: applied.filter((row) => Boolean(row.referrer)).length,
    rounds: rows.reduce((sum, row) => sum + (row.rounds || []).length, 0),
  };

  return {
    totals,
    funnel,
    bySource: [...bySource.values()].sort((a, b) => b.applied - a.applied),
    byMethod: [...byMethod.values()].sort((a, b) => b.applied - a.applied),
    kills: [...kills.values()].sort((a, b) => b.count - a.count),
    reply: { medianDays: median, sample: waits.length },
  };
}

/* -------------------------------------------------------------------------- */
/* misc                                                                        */
/* -------------------------------------------------------------------------- */

/** `req.userId` is a string; aggregations and `$match` need the real thing. */
export const oid = (id) => new mongoose.Types.ObjectId(id);

/** The lane list, for a client that has not been told the vocabulary yet. */
export const columnDefaults = () => COLUMNS.map((column) => ({ ...column }));
