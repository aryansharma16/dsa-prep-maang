import { z } from 'zod';
import { Pattern } from '../../models/Pattern.js';
import { PatternGuide } from '../../models/PatternGuide.js';
import { AUDIT, recordAudit } from '../../services/audit.service.js';
import { ApiError } from '../../utils/ApiError.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

/**
 * One zod member per block type, assembled into a discriminated union.
 *
 * This mirrors the enum on PatternGuide.blockSchema. Being a union rather than
 * one loose object matters twice over: a `code` block missing its variants is
 * rejected here instead of rendering as nothing in the reader, and zod strips
 * unknown keys — so a block whose type the editor changed leaves its orphaned
 * fields behind rather than carrying them into Mongo.
 */
const heading = z.object({ type: z.literal('heading'), text: z.string().min(1).max(200) });
const paragraph = z.object({ type: z.literal('paragraph'), text: z.string().min(1).max(8000) });
const bullets = z.object({
  type: z.literal('bullets'),
  items: z.array(z.string().min(1).max(1000)).min(1).max(100),
});
const code = z.object({
  type: z.literal('code'),
  variants: z
    .array(
      z.object({
        lang: z.string().min(1).max(20),
        label: z.string().max(40).default(''),
        code: z.string().min(1).max(20000),
      }),
    )
    .min(1)
    .max(5),
});
const callout = z.object({
  type: z.literal('callout'),
  tone: z.enum(['note', 'warn', 'tip']).default('note'),
  text: z.string().min(1).max(4000),
});
const table = z.object({
  type: z.literal('table'),
  columns: z.array(z.string().max(80)).min(1).max(8),
  rows: z.array(z.array(z.string().max(500)).max(8)).max(100),
});
const image = z.object({
  type: z.literal('image'),
  url: z.string().url().max(500),
  text: z.string().max(300).default(''),
});
const video = z.object({
  type: z.literal('video'),
  // A bare id, never a URL — GuideBlocks interpolates this straight into the
  // embed src, so a full URL there renders a silently dead iframe.
  videoId: z.string().regex(/^[\w-]{6,20}$/, 'a YouTube id, not a URL'),
  text: z.string().max(300).default(''),
});
const links = z.object({
  type: z.literal('links'),
  links: z
    .array(
      z.object({
        label: z.string().min(1).max(120),
        url: z.string().url().max(500),
        source: z.string().max(80).default(''),
      }),
    )
    .min(1)
    .max(20),
});

const guideBlock = z.discriminatedUnion('type', [
  heading,
  paragraph,
  bullets,
  code,
  callout,
  table,
  image,
  video,
  links,
]);

export const guideSaveSchema = z
  .object({
    title: z.string().min(1).max(160),
    summary: z.string().max(2000).default(''),
    blocks: z.array(guideBlock).max(300),
  })
  /*
    The row/column arity check lives here rather than on the `table` member.
    A member of z.discriminatedUnion has to be a ZodObject, and `.refine()`
    returns ZodEffects — attaching it to `table` throws at import time, which
    is a crash on boot rather than a validation error on a request.

    It matters because GuideBlocks maps each row blind: a row one cell short
    silently loses a column and nobody notices until a reader sees a hole.
  */
  .superRefine((value, ctx) => {
    value.blocks.forEach((block, i) => {
      if (block.type !== 'table') return;
      const bad = block.rows.findIndex((row) => row.length !== block.columns.length);
      if (bad >= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['blocks', i, 'rows', bad],
          message: `row ${bad + 1} has ${block.rows[bad].length} cells but the table has ${block.columns.length} columns`,
        });
      }
    });
  });

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
