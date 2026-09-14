import mongoose from 'mongoose';
import { z } from 'zod';
import { DESIGN_LIMITS, ELEMENT_TYPES } from '../config/design.js';
import { isOrderKey } from '../utils/fractionalIndex.js';

/**
 * What a board save may contain.
 *
 * Two layers with different jobs, and the split is the point.
 *
 * The **envelope** — the batch and its ops — is strict. Its shape is the wire
 * protocol, owned by both sides together, and an op this server does not
 * understand is a bug worth a loud 400.
 *
 * An **element's `data`** is not strict, and cannot be. The client deploys to
 * Vercel and this server to EC2, separately, and a new style property ships in
 * the client first. A schema that stripped unknown keys — what `.strict()` or a
 * plain `z.object` does — would silently delete that property on every save
 * until the server caught up, and nobody would see it happen. So each type
 * checks only the fields the server itself relies on (geometry is finite, a URL
 * is http, an image names a real file id) with `.passthrough()`, and everything
 * else is bounded by `assertBoundedJson`: sizes, depth and key names, which is
 * what actually protects the database from a hostile or runaway payload.
 */

const oidString = z
  .string()
  .refine((value) => mongoose.Types.ObjectId.isValid(value), 'Not a valid id');

export const EID = /^[A-Za-z0-9_-]{6,40}$/;
export const DATA_KEY = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;

const eid = z.string().regex(EID, 'Not a valid element id');
const dataKey = z.string().regex(DATA_KEY, 'Not a valid field name');
const orderKey = z.string().refine(isOrderKey, 'Not a valid order key');

/* -------------------------------------------------------------------------- */
/* the envelope                                                                */
/* -------------------------------------------------------------------------- */

const putOp = z
  .object({
    op: z.literal('put'),
    el: z
      .object({
        eid,
        type: z.enum(ELEMENT_TYPES),
        parent: eid.nullable(),
        z: orderKey,
        data: z.record(dataKey, z.unknown()),
      })
      .strict(),
  })
  .strict();

/**
 * A shallow change to one element.
 *
 * Field names are validated against `DATA_KEY`, which has no dots and no `$` —
 * so a client can never smuggle a nested path or an operator into the `$set`
 * this becomes. Nested values (a connector's `start`, a label object) are
 * replaced whole, which is also what makes two people editing different fields
 * of the same element compose instead of clobbering each other.
 */
const patchOp = z
  .object({
    op: z.literal('patch'),
    eid,
    parent: eid.nullable().optional(),
    z: orderKey.optional(),
    set: z.record(dataKey, z.unknown()).optional(),
    unset: z.array(dataKey).max(100).optional(),
  })
  .strict();

const delOp = z.object({ op: z.literal('del'), eid }).strict();

const metaOp = z.object({ op: z.literal('meta'), set: z.record(dataKey, z.unknown()) }).strict();

/** Schema boards: the whole DBML text, saved only if nobody else has saved since `base`. */
const sourceOp = z
  .object({
    op: z.literal('source'),
    base: z.number().int().min(0),
    text: z.string().max(DESIGN_LIMITS.sourceChars),
  })
  .strict();

export const opsSchema = z
  .object({
    /** Fixed across retries of the same save — it is how a retry is recognised. */
    batchId: z.string().regex(/^[A-Za-z0-9_:-]{8,64}$/, 'Not a valid batch id'),
    clientId: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/, 'Not a valid client id'),
    baseRev: z.number().int().min(0),
    ops: z
      .array(z.discriminatedUnion('op', [putOp, patchOp, delOp, metaOp, sourceOp]))
      .min(1)
      .max(DESIGN_LIMITS.opsPerBatch),
  })
  .strict()
  .refine((batch) => batch.ops.filter((op) => op.op === 'source').length <= 1, {
    message: 'At most one source change per save',
    path: ['ops'],
  });

/* -------------------------------------------------------------------------- */
/* bounded JSON                                                                */
/* -------------------------------------------------------------------------- */

const BOUNDS = Object.freeze({
  depth: 6,
  keys: 100,
  string: 20_000,
  // A pen stroke is the longest array anything stores: up to 2000 points of
  // [x, y, pressure]. Nothing else comes close.
  array: 6_000,
});

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Throws unless `value` is plain JSON within the bounds above.
 *
 * Hand-written rather than a recursive `z.lazy` schema, because it runs over
 * every point of every stroke in a save, and a zod union per number is the
 * difference between microseconds and a noticeable pause on a big paste.
 *
 * Keys starting with `$` or containing `.` are refused at any depth: Mongo reads
 * the first as an operator and the second as a path, and neither belongs in a
 * document written from user input.
 */
export function assertBoundedJson(value) {
  const stack = [[value, 0]];
  while (stack.length) {
    const [node, depth] = stack.pop();
    if (node === null || typeof node === 'boolean') continue;
    if (typeof node === 'number') {
      if (!Number.isFinite(node)) throw new Error('Numbers must be finite');
      continue;
    }
    if (typeof node === 'string') {
      if (node.length > BOUNDS.string) throw new Error('Text is too long');
      continue;
    }
    if (depth >= BOUNDS.depth) throw new Error('Nested too deeply');
    if (Array.isArray(node)) {
      if (node.length > BOUNDS.array) throw new Error('List is too long');
      for (const item of node) stack.push([item, depth + 1]);
      continue;
    }
    const proto = typeof node === 'object' ? Object.getPrototypeOf(node) : undefined;
    if (proto !== Object.prototype && proto !== null) throw new Error('Only plain JSON may be stored');
    const keys = Object.keys(node);
    if (keys.length > BOUNDS.keys) throw new Error('Too many fields');
    for (const key of keys) {
      if (key.startsWith('$') || key.includes('.') || FORBIDDEN_KEYS.has(key)) {
        throw new Error(`Field name not allowed: ${key.slice(0, 40)}`);
      }
      stack.push([node[key], depth + 1]);
    }
  }
}

export const jsonBytes = (value) => Buffer.byteLength(JSON.stringify(value), 'utf8');

/* -------------------------------------------------------------------------- */
/* per-type checks                                                             */
/* -------------------------------------------------------------------------- */

const coord = z.number().finite().min(-1e7).max(1e7);
const size = z.number().finite().min(0).max(1e7);

const httpUrl = z
  .string()
  .max(2048)
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }, 'Links must be http or https');

/** Fields any element may carry, typed where the server or a future reader relies on them. */
const common = {
  rot: z.number().finite().optional(),
  opacity: z.number().min(0).max(1).optional(),
  locked: z.boolean().optional(),
  url: httpUrl.optional(),
  linkBoard: oidString.nullable().optional(),
};

const box = z
  .object({ x: coord, y: coord, w: size.optional(), h: size.optional(), ...common })
  .passthrough();

const endpoint = z
  .object({
    eid: eid.optional(),
    point: z.tuple([coord, coord]).optional(),
  })
  .passthrough()
  .refine((end) => end.eid || end.point, 'A connector end needs an element or a point');

const connector = z
  .object({
    start: endpoint,
    end: endpoint,
    waypoints: z.array(z.tuple([coord, coord])).max(50).optional(),
    ...common,
  })
  .passthrough();

const stroke = box.and(
  z
    .object({
      points: z
        .array(z.number().finite())
        .max(6000)
        .refine((points) => points.length % 3 === 0, 'Points come in threes: x, y, pressure'),
    })
    .passthrough(),
);

const image = box.and(z.object({ fileId: oidString }).passthrough());
const embed = box.and(z.object({ url: httpUrl }).passthrough());
const table = box.and(
  z
    .object({
      rows: z.array(z.array(z.string().max(1000)).max(20)).max(100),
    })
    .passthrough(),
);
const dbtable = box.and(z.object({ name: z.string().min(1).max(128) }).passthrough());

export const TYPE_SCHEMAS = Object.freeze({
  frame: box,
  group: box,
  rect: box,
  ellipse: box,
  diamond: box,
  cylinder: box,
  text: box,
  paragraph: box,
  sticky: box,
  tech: box,
  connector,
  stroke,
  image,
  embed,
  table,
  dbtable,
});

/**
 * Checks one element's final state. Returns null when it may be stored, or a
 * short reason when it may not — a reason, not a throw, because one bad element
 * must not sink the rest of the save.
 */
export function elementProblem({ type, data }, { boardKind }) {
  const schema = TYPE_SCHEMAS[type];
  if (!schema) return 'UNKNOWN_TYPE';
  if (type === 'dbtable' && boardKind !== 'schema') return 'WRONG_BOARD';
  try {
    assertBoundedJson(data);
  } catch {
    return 'INVALID';
  }
  if (!schema.safeParse(data).success) return 'INVALID';
  if (jsonBytes(data) > DESIGN_LIMITS.elementBytes) return 'TOO_LARGE';
  return null;
}
