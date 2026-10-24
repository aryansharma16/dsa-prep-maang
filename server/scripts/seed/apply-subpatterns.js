/**
 * Files every shared problem under its sub-pattern, and gives every pattern
 * its sub-pattern list.
 *
 *   npm run seed:subpatterns
 *
 * Also runs at the end of `seed:db`. On its own it touches nothing but the two
 * fields it owns — `Pattern.subPatterns` and `Problem.subPattern` — so it is
 * safe against a live database: no progress, notes or descriptions are read or
 * written.
 *
 * The map (server/data/subpatterns.json) is `slug → "pattern/sub"`. The pattern
 * is part of the value on purpose: a problem the admin panel has moved to a
 * different pattern no longer matches the filter, so it is left alone rather
 * than filed under a sub-pattern from a list it is not in.
 *
 * A user's own copy of a curated problem (same slug, same pattern) is filed too,
 * but only while it has no sub-pattern yet.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pattern } from '../../src/models/Pattern.js';
import { Problem } from '../../src/models/Problem.js';
import { SUB_PATTERNS } from './subpatterns.js';

const here = path.dirname(fileURLToPath(import.meta.url));
export const SUBPATTERN_MAP_PATH = path.resolve(here, '../../data/subpatterns.json');

/** Reads the map and refuses entries that point outside their pattern's list. */
export function loadSubPatternMap() {
  const raw = JSON.parse(fs.readFileSync(SUBPATTERN_MAP_PATH, 'utf8'));
  const valid = {};
  const bad = [];
  for (const [slug, key] of Object.entries(raw)) {
    const [pattern, sub] = String(key).split('/');
    if (SUB_PATTERNS[pattern]?.some((s) => s.slug === sub)) valid[slug] = { pattern, sub };
    else bad.push(`${slug} → ${key}`);
  }
  if (bad.length) console.warn(`[subpatterns] ${bad.length} unknown entries skipped: ${bad.join(', ')}`);
  return valid;
}

/** Needs an open connection. Returns counts for the caller to log. */
export async function applySubPatterns() {
  const map = loadSubPatternMap();

  // Not gated on Pattern.editedAt: the admin panel does not edit this field, so
  // there is no hand-made value here for the seed to overwrite.
  await Pattern.bulkWrite(
    Object.entries(SUB_PATTERNS).map(([slug, subPatterns]) => ({
      updateOne: { filter: { slug }, update: { $set: { subPatterns } } },
    })),
  );

  const ops = Object.entries(map).map(([slug, { pattern, sub }]) => ({
    updateMany: {
      /*
        `$ne: sub` so a re-run touches nothing: Mongoose stamps `updatedAt` on
        every matched update, which would otherwise bump all of them each time.
      */
      filter: {
        slug,
        patternSlug: pattern,
        subPattern: { $ne: sub },
        $or: [{ owner: null }, { subPattern: { $in: ['', null] } }],
      },
      update: { $set: { subPattern: sub } },
    },
  }));
  const result = ops.length ? await Problem.bulkWrite(ops, { ordered: false }) : { modifiedCount: 0 };

  const unfiled = await Problem.find({ owner: null, subPattern: { $in: ['', null] } })
    .select('slug patternSlug')
    .lean();

  return { mapped: ops.length, modified: result.modifiedCount, unfiled };
}

// Run directly: `node scripts/seed/apply-subpatterns.js`.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { connectDb, disconnectDb } = await import('../../src/config/db.js');
  await connectDb();
  try {
    const { mapped, modified, unfiled } = await applySubPatterns();
    console.log(`[subpatterns] ${mapped} mapped, ${modified} problems updated`);
    if (unfiled.length) {
      console.log(
        `[subpatterns] ${unfiled.length} shared problem(s) have no sub-pattern: ` +
          unfiled.map((p) => `${p.patternSlug}/${p.slug}`).join(', '),
      );
    }
  } finally {
    await disconnectDb();
  }
}
