import { z } from 'zod';
import { SURFACES } from '../config/motivationTriggers.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { dailyLine } from '../services/motivation.ai.js';
import { pickLine } from '../services/motivation.service.js';
import { buildSignals } from '../services/motivation.signals.js';

/*
  Both endpoints answer the same shape, `{ line: { text, trigger, source } }` or
  `{ line: null }`. Null is not an error — a deployment with no seeded lines, or
  a surface nobody wrote for, should render nothing rather than a broken strip.
*/

export const surfaceQuery = z.object({
  // `login` is excluded here on purpose: it has its own public route, and
  // asking for it while signed in would return generic copy to someone we know
  // plenty about.
  surface: z.enum(SURFACES.filter((s) => s !== 'login')).default('roadmap'),
});

/**
 * GET /api/motivation?surface=roadmap
 *
 * The AI line takes precedence when there is one, because it was written from
 * these exact numbers rather than chosen to match them. Everything about it is
 * optional — no key, a new account, a slow model, output that fails validation
 * — and every one of those falls through to the curated pick.
 */
export const getMotivation = asyncHandler(async (req, res) => {
  const signals = await buildSignals(req.userId);

  const ai = await dailyLine(req.userId, signals);
  if (ai) return res.json({ line: { ...ai, trigger: 'daily' } });

  res.json({ line: await pickLine({ surface: req.query.surface, signals, userId: req.userId }) });
});

/**
 * GET /api/motivation/login — for the signed-out auth pages.
 *
 * No signals at all, which is the whole security of it: every trigger except
 * `always` tests something about a person, so a visitor we know nothing about
 * can only ever match the generic pool. That falls out of the predicates rather
 * than being a filter someone has to remember to write here.
 */
export const getLoginMotivation = asyncHandler(async (_req, res) => {
  // A nonce, because every other part of the seed is constant here — without
  // one the signed-out world would share a single line until the pool changed.
  res.json({
    line: await pickLine({ surface: 'login', signals: {}, nonce: String(Math.random()) }),
  });
});
