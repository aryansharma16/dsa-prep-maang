import { z } from 'zod';
import { Pattern } from '../../models/Pattern.js';
import { PatternGuide } from '../../models/PatternGuide.js';
import { AUDIT, recordAudit } from '../../services/audit.service.js';
import { ApiError } from '../../utils/ApiError.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { blocksField, checkTableArity } from '../../validation/blocks.js';

/**
 * What a guide save may contain.
 *
 * The blocks themselves are validated by the shared vocabulary in
 * `validation/blocks.js` — this file owns only the envelope around them, which
 * is the part that is a *guide* rather than a block. `LearnTopic` has its own
 * envelope over the same vocabulary, for the same reason.
 */
export const guideSaveSchema = z
  .object({
    title: z.string().min(1).max(160),
    summary: z.string().max(2000).default(''),
    blocks: blocksField,
  })
  .superRefine((value, ctx) => checkTableArity(value.blocks, ctx));

/** Metadata only — 22 guides of two thousand words each is not a list payload. */
export const listGuides = asyncHandler(async (_req, res) => {
  const [patterns, guides] = await Promise.all([
    Pattern.find().sort({ order: 1 }).select('slug name order').lean(),
    PatternGuide.find().select('patternSlug title summary blocks editedAt seededAt updatedAt').lean(),
  ]);

  const byslug = Object.fromEntries(guides.map((g) => [g.patternSlug, g]));

  res.json({
    guides: patterns.map((pattern) => {
      const guide = byslug[pattern.slug];
      return {
        patternSlug: pattern.slug,
        patternName: pattern.name,
        order: pattern.order,
        exists: Boolean(guide),
        title: guide?.title || '',
        blockCount: guide?.blocks?.length || 0,
        // The seeder's own formula, so the number here matches what
        // `npm run seed:guides` prints.
        wordCount: (guide?.blocks || []).reduce(
          (n, b) => n + `${b.text || ''} ${(b.items || []).join(' ')}`.trim().split(/\s+/).filter(Boolean).length,
          0,
        ),
        editedAt: guide?.editedAt || null,
        seededAt: guide?.seededAt || null,
        updatedAt: guide?.updatedAt || null,
      };
    }),
  });
});

export const getGuideAdmin = asyncHandler(async (req, res) => {
  const slug = String(req.params.slug).toLowerCase();
  const pattern = await Pattern.findOne({ slug }).select('slug name blurb').lean();
  if (!pattern) throw ApiError.notFound(`Unknown pattern: ${slug}`, 'NO_PATTERN');

  const guide = await PatternGuide.findOne({ patternSlug: slug }).lean();
  res.json({ pattern, guide: guide || null });
});

export const saveGuide = asyncHandler(async (req, res) => {
  const slug = String(req.params.slug).toLowerCase();
  const pattern = await Pattern.findOne({ slug }).select('slug').lean();
  if (!pattern) throw ApiError.notFound(`Unknown pattern: ${slug}`, 'NO_PATTERN');

  const before = await PatternGuide.findOne({ patternSlug: slug }).select('editedAt').lean();

  const guide = await PatternGuide.findOneAndUpdate(
    { patternSlug: slug },
    {
      $set: {
        title: req.body.title,
        summary: req.body.summary,
        blocks: req.body.blocks,
        /*
          Load-bearing. scripts/seed/guides.js skips any guide with editedAt
          set — so without this line the next `npm run seed:guides` silently
          reverts everything typed here, and nothing anywhere reports it.
        */
        editedAt: new Date(),
      },
      $setOnInsert: { patternSlug: slug },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  await recordAudit(req, {
    action: AUDIT.GUIDE_SAVE,
    targetType: 'guide',
    targetId: guide._id,
    targetLabel: slug,
    meta: { blocks: guide.blocks.length, firstEdit: !before?.editedAt },
  });

  res.json({ guide: guide.toObject() });
});

/**
 * Hands a guide back to the content files.
 *
 * Clearing `editedAt` is what makes the save warning reversible — the next
 * `npm run seed:guides` picks the guide up again. A warning you cannot undo is
 * a threat; one with a way back is information.
 */
export const unlockGuide = asyncHandler(async (req, res) => {
  const slug = String(req.params.slug).toLowerCase();
  const guide = await PatternGuide.findOneAndUpdate(
    { patternSlug: slug },
    { $set: { editedAt: null } },
    { new: true },
  );
  if (!guide) throw ApiError.notFound('No guide for that pattern', 'NO_GUIDE');

  await recordAudit(req, {
    action: AUDIT.GUIDE_UNLOCK,
    targetType: 'guide',
    targetId: guide._id,
    targetLabel: slug,
  });

  res.json({ guide: guide.toObject() });
});
