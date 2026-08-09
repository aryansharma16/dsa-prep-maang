import { z } from 'zod';
import {
  CATEGORIES,
  SURFACES,
  TRIGGERS,
  TRIGGER_KEYS,
  triggerCatalogue,
} from '../../config/motivationTriggers.js';
import { Motivation } from '../../models/Motivation.js';
import { AUDIT, diff, recordAudit } from '../../services/audit.service.js';
import { aiEnabled, generateJson } from '../../services/gemini.service.js';
import { pickLine } from '../../services/motivation.service.js';
import { buildSignals } from '../../services/motivation.signals.js';
import { ApiError } from '../../utils/ApiError.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { escapeRegex, paged, pageQuery } from '../../utils/query.js';

/*
  Every write stamps `editedAt` — the same reason content.controller.js does. It
  is what stops `npm run seed:motivation` reverting the change on its next run.
*/
const stamp = (req) => ({ editedAt: new Date(), editedBy: req.actor._id });

const surfacesField = z.array(z.enum(SURFACES)).min(1, 'Pick at least one page');

export const listQuery = pageQuery.extend({
  q: z.string().max(200).optional(),
  category: z.enum(CATEGORIES).optional(),
  trigger: z.enum(TRIGGER_KEYS).optional(),
  surface: z.enum(SURFACES).optional(),
  active: z.enum(['true', 'false']).optional(),
});

export const createSchema = z.object({
  text: z.string().min(4).max(240),
  category: z.enum(CATEGORIES).default('grind'),
  surfaces: surfacesField,
  trigger: z.enum(TRIGGER_KEYS).default('always'),
  // Nullable rather than optional: clearing it is a real edit, and the picker
  // falls back to the trigger's own default when it is null.
  threshold: z.number().int().nullable().default(null),
  weight: z.number().int().min(1).max(5).default(1),
  active: z.boolean().default(true),
});

export const updateSchema = createSchema
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Nothing to update');

export const draftSchema = z.object({
  trigger: z.enum(TRIGGER_KEYS).default('always'),
  category: z.enum(CATEGORIES).default('grind'),
  surfaces: surfacesField,
  // Capped here rather than trusted from the panel: this is the one route that
  // spends money per item.
  count: z.number().int().min(1).max(10).default(5),
  brief: z.string().max(400).optional(),
});

/* ------------------------------------------------------------------ reads */

/**
 * GET /admin/motivation — the list, plus the vocabulary the editor is built
 * from. Sending the catalogue with every page beats a second endpoint the form
 * has to wait on, and it is a few hundred bytes.
 */
export const listMotivation = asyncHandler(async (req, res) => {
  const { q, category, trigger, surface, active, page, limit } = req.query;

  const filter = {};
  if (category) filter.category = category;
  if (trigger) filter.trigger = trigger;
  if (surface) filter.surfaces = surface;
  if (active) filter.active = active === 'true';
  // Escaped: an unescaped user string in a RegExp is a denial of service
  // waiting for someone to type `(a+)+`.
  if (q) filter.text = new RegExp(escapeRegex(q), 'i');

  const [lines, total] = await Promise.all([
    Motivation.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Motivation.countDocuments(filter),
  ]);

  res.json({
    ...paged('lines', lines, { total, page, limit }),
    triggers: triggerCatalogue(),
    categories: CATEGORIES,
    surfaces: SURFACES,
    ai: aiEnabled(),
  });
});

/**
 * GET /admin/motivation/preview — what would actually fire, for the admin's own
 * account, right now.
 *
 * This is the difference between choosing a trigger and guessing at one. It
 * runs the real picker over the real signals, so it cannot drift from what a
 * learner sees.
 */
export const previewMotivation = asyncHandler(async (req, res) => {
  const signals = await buildSignals(req.userId);
  const surfaces = SURFACES.filter((s) => s !== 'login');

  const picks = await Promise.all(
    surfaces.map((surface) => pickLine({ surface, signals, userId: req.userId })),
  );

  res.json({
    signals,
    lines: Object.fromEntries(surfaces.map((surface, i) => [surface, picks[i]])),
    login: await pickLine({ surface: 'login', signals: {}, nonce: String(Math.random()) }),
  });
});

/* ----------------------------------------------------------------- writes */

export const createMotivation = asyncHandler(async (req, res) => {
  const line = await Motivation.create({ ...req.body, ...stamp(req) });

  await recordAudit(req, {
    action: AUDIT.MOTIVATION_CREATE,
    targetType: 'motivation',
    targetId: line._id,
    targetLabel: line.text.slice(0, 80),
    meta: { trigger: line.trigger, surfaces: line.surfaces.join(', ') },
  });

  res.status(201).json({ line: line.toObject() });
});

export const updateMotivation = asyncHandler(async (req, res) => {
  const line = await Motivation.findById(req.params.id);
  if (!line) throw ApiError.notFound('That line no longer exists', 'NO_MOTIVATION');

  const before = line.toObject();
  line.set({ ...req.body, ...stamp(req) });
  await line.save();

  await recordAudit(req, {
    action: AUDIT.MOTIVATION_UPDATE,
    targetType: 'motivation',
    targetId: line._id,
    targetLabel: line.text.slice(0, 80),
    meta: diff(before, line.toObject(), ['text', 'trigger', 'threshold', 'weight', 'active', 'category']),
  });

  res.json({ line: line.toObject() });
});

export const deleteMotivation = asyncHandler(async (req, res) => {
  const line = await Motivation.findById(req.params.id);
  if (!line) throw ApiError.notFound('That line no longer exists', 'NO_MOTIVATION');

  // Read the label before the row is gone.
  const label = line.text.slice(0, 80);
  await Motivation.deleteOne({ _id: line._id });

  await recordAudit(req, {
    action: AUDIT.MOTIVATION_DELETE,
    targetType: 'motivation',
    targetId: line._id,
    targetLabel: label,
    // A seeded line comes back on the next `npm run seed:motivation`; one
    // written here does not. Worth recording which kind this was.
    meta: { seeded: Boolean(line.key) },
  });

  res.json({ ok: true, seeded: Boolean(line.key) });
});

/* -------------------------------------------------------------------- ai */

const DRAFT_SCHEMA = {
  type: 'object',
  properties: {
    lines: {
      type: 'array',
      items: {
        type: 'object',
        properties: { text: { type: 'string' } },
        required: ['text'],
      },
    },
  },
  required: ['lines'],
};

const DRAFT_SYSTEM = `You write short motivational lines for a website where software engineers prepare for interviews by working through a curated roadmap of algorithm problems.

Rules, all of them hard:
- One sentence each. Under 22 words. No line breaks.
- Second person, plain and direct, a little dry. Write like a good mentor, not a poster.
- No emoji, no exclamation marks, no hashtags, no quotation marks.
- Never say "champion", "warrior", "crush it", "journey", "unlock", "let's" or "dream big".
- Never name the product, and never name a salary figure.
- Say something concrete about engineering, preparation or the work. Avoid lines that would fit equally well on a gym wall.
- Every line must be distinct from the others in the set.`;

/**
 * POST /admin/motivation/draft — candidates, saved to nothing.
 *
 * The admin ticks what they want and those become rows through the normal
 * create route. Nothing a model wrote reaches a learner without someone
 * choosing it, which is the whole reason this returns instead of inserting.
 */
export const draftMotivation = asyncHandler(async (req, res) => {
  const { trigger, category, surfaces, count, brief } = req.body;
  const spec = TRIGGERS[trigger];

  /*
    The tokens are the point. A line for `weak_pattern` that does not name the
    pattern is just another generic line, so the prompt is told which ones this
    trigger can actually fill — and only those, or the picker will discard
    everything it writes.
  */
  const tokens = {
    weak_pattern: '{pattern}, {patternSolved}, {patternTotal}, {patternRemaining}',
    streak_reached: '{streak}, {maxStreak}',
    strong_day: '{today}',
    first_of_day: '{today}, {solved}',
    hard_today: '{today}',
    revision_due: '{due}',
    lapsed: '{days}, {solved}',
    milestone_solved: '{solved}, {remaining}, {percent}',
    percent_reached: '{percent}, {solved}, {total}, {remaining}',
    attempted_stuck: '{attempted}',
    nothing_today: '{solved}, {streak}, {remaining}',
    no_solves_ever: '{total}',
    always: '',
  }[trigger];

  const prompt = [
    `Write ${count} lines.`,
    `They will be shown when: ${spec.label}.${spec.hint ? ` (${spec.hint})` : ''}`,
    `Theme: ${category}.`,
    `Shown on: ${surfaces.join(', ')}.`,
    tokens
      ? `You may use these placeholders, which are replaced with the reader's real numbers: ${tokens}. Use at least one in most lines. Use no other placeholder.`
      : 'Do not use any {placeholder} tokens — this condition carries no numbers.',
    brief ? `Extra direction: ${brief}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const result = await generateJson(prompt, {
    system: DRAFT_SYSTEM,
    schema: DRAFT_SCHEMA,
    temperature: 1.1,
  });

  // Trust the schema for shape, not for content: trim, drop empties, drop
  // anything over the column width, and de-duplicate.
  const seen = new Set();
  const drafts = (result?.lines || [])
    .map((line) => String(line?.text || '').trim())
    .filter((text) => text && text.length <= 240)
    .filter((text) => !seen.has(text.toLowerCase()) && seen.add(text.toLowerCase()))
    .slice(0, count)
    .map((text) => ({ text, category, surfaces, trigger, threshold: null, weight: 1, active: true }));

  res.json({ drafts });
});
