import { z } from 'zod';

/**
 * The block vocabulary, as a request validator.
 *
 * One zod member per block type, assembled into a discriminated union. Being a
 * union rather than one loose object matters twice over: a `code` block missing
 * its variants is rejected here instead of rendering as nothing in the reader,
 * and zod strips unknown keys — so a block whose type the editor changed leaves
 * its orphaned fields behind rather than carrying them into Mongo.
 *
 * ---------------------------------------------------------------------------
 * Why this is its own file rather than a const in a controller.
 *
 * It began inside `controllers/admin/guides.controller.js`, which was right
 * while one collection spoke this vocabulary. Three do now — `PatternGuide`,
 * `CPPatternGuide` and `LearnTopic` — and they share exactly what
 * `models/schemas/guideBlock.js` says they share: the block shapes, and nothing
 * above them. Each collection keeps its own envelope (a guide has a
 * `patternSlug`, a topic has tags and a track) and imports the vocabulary.
 *
 * That is the same relationship, one layer up, that `guideBlock.js` already
 * documents between the collections themselves: separate documents, one
 * vocabulary — because a `type` accepted by one writer and refused by another
 * is a block the renderer draws and the database will not store.
 *
 * The bounds are not arbitrary. Every one of them was checked against all 5,495
 * blocks of the seeded content and the headroom is real: the longest heading is
 * 58 of 200, the longest paragraph 481 of 8000, the widest table 8 columns of 8.
 * ---------------------------------------------------------------------------
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
        /*
          Free-form, and deliberately not an enum. `highlight()` picks a scan by
          name and falls through to a neutral one for anything it does not know,
          which is what `sh` relies on — a command list is better uncoloured than
          coloured wrong. An enum here would mean a deploy to add a language the
          renderer already handles gracefully.
        */
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
  /*
    A name above the grid, and what kind of grid it is.

    Both have been on `guideBlockSchema` since the Learn SQL track needed them,
    and until now neither was here — so a table carrying them round-tripped
    through the editor came out the other side without them, because zod strips
    what it is not told about. Nothing was visibly broken only because no seeded
    *guide* sets them; 180 Learn blocks do, and they are the whole point of a
    page that reads "here are the tables, here is the query, here is the result".

    Defaulted rather than optional, so a block written before they existed
    validates unchanged and stores the same empty strings the model would have
    defaulted to anyway.
  */
  caption: z.string().max(200).default(''),
  variant: z.enum(['', 'data', 'result']).default(''),
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

export const guideBlock = z.discriminatedUnion('type', [
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

/** A document's worth of them. 300 is roughly four times the longest topic. */
export const blocksField = z.array(guideBlock).max(300);

/**
 * The row/column arity check, as a `superRefine` body.
 *
 * It cannot live on the `table` member: a member of `z.discriminatedUnion` has
 * to be a ZodObject and `.refine()` returns ZodEffects, so attaching it there
 * throws at import time — a crash on boot rather than a validation error on a
 * request. So every envelope calls this from its own `superRefine` instead.
 *
 * It matters because `GuideBlocks` maps each row blind: a row one cell short
 * silently loses a column, and nobody notices until a reader sees a hole.
 */
export const checkTableArity = (blocks, ctx) => {
  blocks.forEach((block, i) => {
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
};
