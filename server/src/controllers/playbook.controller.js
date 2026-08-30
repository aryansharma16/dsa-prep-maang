import { z } from 'zod';
import { Playbook } from '../models/Playbook.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * A prep plan — the parts of it that are state rather than document.
 *
 * One row per account, and always has been: every query here is keyed on
 * `req.userId`, so opening the playbook module to every role (see
 * config/modules.js) needed no change in this file and no migration. Two people
 * running the plan see the same authored schedule and their own progress.
 *
 * Two handlers and almost no logic, like the saved-views controller it is
 * modelled on. The plan itself is authored in the client (see
 * models/Playbook.js for why), so there is nothing here that knows what a phase
 * is, how long the plan runs, or what any ticked id refers to. This bounds what
 * arrives and stores it.
 */

/** ISO-8601, and a date the plan could plausibly be run in. */
const planDate = z.coerce
  .date()
  .refine((d) => d.getUTCFullYear() >= 2020 && d.getUTCFullYear() <= 2100, 'Date out of range');

export const patchSchema = z
  .object({
    /**
     * Nullable on purpose, both of them: clearing the start date is how the
     * plan is reset to "not started yet", and that has to be expressible.
     */
    startedAt: planDate.nullable().optional(),
    targetDate: planDate.nullable().optional(),

    /**
     * One tick at a time, as `{ id, on }` rather than the whole set.
     *
     * A replace would make every checkbox a read-modify-write of the entire
     * list, so two boxes ticked in the same second would lose one — which on
     * this page is a morning's work quietly un-ticking itself. `$addToSet` and
     * `$pull` are the operations the UI actually performs.
     */
    tick: z
      .object({ id: z.string().min(1).max(64), on: z.boolean() })
      .optional(),

    /** A week's retro line. Empty text removes the key rather than storing "". */
    note: z
      .object({ key: z.string().min(1).max(64), text: z.string().max(4000) })
      .optional(),
  })
  .refine(
    (body) => Object.keys(body).length > 0,
    'Nothing to change',
  );

const shape = (plan) => ({
  startedAt: plan?.startedAt ?? null,
  targetDate: plan?.targetDate ?? null,
  done: plan?.done ?? [],
  // A Mongoose Map does not survive res.json as an object on a lean() document
  // in every version, so it is flattened here rather than relied on.
  notes: plan?.notes ? Object.fromEntries(plan.notes instanceof Map ? plan.notes : Object.entries(plan.notes)) : {},
  updatedAt: plan?.updatedAt ?? null,
});

/**
 * GET /playbook
 *
 * 200 with an empty plan rather than a 404, like `GET /views/:scope`. "You have
 * not started yet" is the ordinary first answer, and the page renders the whole
 * schedule from that state — only the countdown is missing.
 */
export const getPlaybook = asyncHandler(async (req, res) => {
  const plan = await Playbook.findOne({ owner: req.userId }).lean();
  res.json({ plan: shape(plan) });
});

/**
 * PATCH /playbook — one field, one tick, or one note.
 *
 * Upserts, so the first tick creates the document. Answers with the whole plan
 * so the client never has to reconstruct what the server decided.
 */
export const patchPlaybook = asyncHandler(async (req, res) => {
  const { startedAt, targetDate, tick, note } = req.body;

  const set = {};
  const unset = {};
  if (startedAt !== undefined) {
    if (startedAt === null) unset.startedAt = '';
    else set.startedAt = startedAt;
  }
  if (targetDate !== undefined) {
    if (targetDate === null) unset.targetDate = '';
    else set.targetDate = targetDate;
  }
  if (note) {
    const text = note.text.trim();
    if (text) set[`notes.${note.key}`] = text;
    else unset[`notes.${note.key}`] = '';
  }

  const update = {};
  if (Object.keys(set).length) update.$set = set;
  if (Object.keys(unset).length) update.$unset = unset;
  if (tick) update[tick.on ? '$addToSet' : '$pull'] = { done: tick.id };

  const plan = await Playbook.findOneAndUpdate({ owner: req.userId }, update, {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true,
    runValidators: true,
  }).lean();

  res.json({ plan: shape(plan) });
});
