import { z } from 'zod';
import { VIEW_LIMITS, VIEW_SCOPES } from '../config/viewScopes.js';
import { UserView } from '../models/UserView.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Saved views — the filters an account left on, per screen.
 *
 * Three handlers and no business logic, because there is none to have: the
 * server bounds the payload and stores it, and the client decides what any of it
 * means. See models/UserView.js for why that split, and config/viewScopes.js for
 * where the boundary is drawn.
 */

export const scopeSchema = z.object({ scope: z.enum(VIEW_SCOPES) });

/**
 * One filter's value, in the three shapes a filter control can produce: a flag,
 * a single choice, or a multi-select.
 *
 * Order matters in a union — `z.boolean()` first so `false` is not coerced
 * anywhere — and every branch is length-capped, because each one is a string a
 * caller chose.
 */
const filterValue = z.union([
  z.boolean(),
  z.string().max(VIEW_LIMITS.value),
  z.array(z.string().min(1).max(VIEW_LIMITS.value)).max(VIEW_LIMITS.values),
]);

export const saveViewSchema = z.object({
  filters: z
    .record(z.string().min(1).max(VIEW_LIMITS.key), filterValue)
    .refine(
      (filters) => Object.keys(filters).length <= VIEW_LIMITS.fields,
      `At most ${VIEW_LIMITS.fields} filters can be saved for one screen`,
    ),
});

/** Absent is a real answer — an account that has never saved a view. */
const shape = (view) => (view ? { scope: view.scope, filters: view.filters ?? {}, updatedAt: view.updatedAt } : null);

/**
 * GET /views/:scope
 *
 * 200 with `view: null` rather than a 404. "You have never filtered this screen"
 * is the ordinary first answer, not a missing resource, and a 404 here would
 * have every client treating its own happy path as an error.
 */
export const getView = asyncHandler(async (req, res) => {
  const view = await UserView.findOne({ user: req.userId, scope: req.params.scope }).lean();
  res.json({ view: shape(view) });
});

/**
 * PUT /views/:scope — replace this screen's saved filters.
 *
 * A replace and not a merge. A filter set is one value: turning a filter off has
 * to be expressible, and under a merge the client would have to send a tombstone
 * for every key it had ever set to say "not this one any more".
 *
 * Clearing everything deletes the row. The client sends the same request either
 * way — it does not have to know that empty is special — and the collection does
 * not fill with documents recording that somebody has no filters on.
 */
export const saveView = asyncHandler(async (req, res) => {
  const { scope } = req.params;
  const { filters } = req.body;

  if (Object.keys(filters).length === 0) {
    await UserView.deleteOne({ user: req.userId, scope });
    res.json({ view: null });
    return;
  }

  const view = await UserView.findOneAndUpdate(
    { user: req.userId, scope },
    { $set: { filters } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();

  res.json({ view: shape(view) });
});

/**
 * DELETE /views/:scope
 *
 * Answers 200 whether or not there was a row, like the avatar route above it: a
 * second click should not surface an error for a state the caller wanted anyway.
 */
export const clearView = asyncHandler(async (req, res) => {
  await UserView.deleteOne({ user: req.userId, scope: req.params.scope });
  res.json({ view: null });
});
