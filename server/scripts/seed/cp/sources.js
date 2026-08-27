import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const CP_RAW_DIR = path.resolve(here, '../../../data/raw/cp');
export const CP_DATA_DIR = path.resolve(here, '../../../data/cp');

export const CF_PROBLEMSET_PATH = path.join(CP_RAW_DIR, 'codeforces-problemset.json');
export const CF_CONTESTS_PATH = path.join(CP_RAW_DIR, 'codeforces-contests.json');
export const CURATED_CP_PATH = path.join(CP_DATA_DIR, 'curated-cp.json');

/**
 * How many problems the ladder is aiming for.
 *
 * Targets rather than limits: the curator fills per (pattern × tier) quotas and
 * these are what those quotas are scaled to hit. Undershooting is normal — some
 * pattern/tier cells genuinely have few good problems, and padding them with
 * whatever scored highest is how a curated list turns back into a dump.
 */
export const TARGET_CF = 600;
export const TARGET_CC = 200;

/**
 * The accessibility floor.
 *
 * A Codeforces problem that fewer than this many accounts have solved is,
 * overwhelmingly, one with a statement people could not parse or a trick with no
 * transferable lesson. It is a proxy for "has a readable statement and an
 * editorial somebody actually wrote", which is not a field the API exposes.
 *
 * It also has to scale with rating, and does not here — 500 solves at 800 is
 * unremarkable and 500 solves at 2600 is a well-known problem. `minSolvers()`
 * below is the version the curator uses; this is the floor under it.
 */
export const MIN_SOLVERS = 300;

/**
 * The floor, by rating band.
 *
 * Solve counts fall off roughly geometrically with rating — the pool of accounts
 * that *can* solve a 2400 is a fraction of the pool that can solve a 1200 — so a
 * flat threshold either lets junk through at the bottom or empties the top of
 * the ladder entirely. These are picked to keep each band's survivors at a
 * similar percentile of their own band rather than of the whole set.
 */
export function minSolvers(rating) {
  if (!rating) return MIN_SOLVERS;
  if (rating <= 1000) return 3000;
  if (rating <= 1300) return 2000;
  if (rating <= 1500) return 1200;
  if (rating <= 1800) return 700;
  if (rating <= 2100) return 400;
  if (rating <= 2400) return 250;
  return MIN_SOLVERS;
}

/**
 * Contests whose problems are deliberately unlike normal ones.
 *
 * April Fools rounds are joke problems — guessing games with no algorithmic
 * content — and Q#/Kotlin/surprise rounds test a language rather than a
 * technique. Both are fun and neither belongs on a ladder someone is working
 * through to get to Expert.
 */
export const EXCLUDED_CONTEST_PATTERNS = [
  /april fools/i,
  /q#|microsoft q#|quantum/i,
  /kotlin heroes/i,
  /surprise language/i,
  /unrated/i,
  /april\s*1/i,
];

/**
 * The oldest contest worth pulling from, unless the curated core names it.
 *
 * Early Codeforces statements are terser, the tags are patchier, and the
 * editorials are often a forum thread rather than a written tutorial. The
 * classics from before this date are still on the ladder — they are in
 * `curated-core.js`, which bypasses every filter — but sweeping the era wholesale
 * costs more in bad rows than it returns in good ones.
 */
export const OLDEST_CONTEST_YEAR = 2015;

/**
 * Tags that describe a *format* rather than a technique.
 *
 * `*special` marks problems tied to one contest's gimmick. The rest are real
 * techniques but need their own pattern rather than being folded into whatever
 * else the problem is tagged with — an interactive binary search is an
 * interactive problem first.
 */
export const FORMAT_TAGS = new Set(['*special', 'interactive', 'communication', 'schedules']);
