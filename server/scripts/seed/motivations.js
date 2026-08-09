/**
 * Seeds the motivation corpus into MongoDB.
 *
 * Independent of everything else — these are prose, they do not depend on the
 * curation pass, and rewording one should not mean re-running a LeetCode fetch.
 *
 *   npm run seed:motivation
 *   npm run seed:motivation -- --force
 *
 * A line the admin panel has edited (`editedAt` set) is skipped, so re-running
 * this can never destroy someone's work — the same contract seed:guides and
 * seed:db have. `--force` overrides it, and says so loudly.
 *
 * Lines written in the panel have no `key` and are invisible to this script in
 * both directions: never refreshed, and never pruned.
 */
import { connectDb, disconnectDb } from '../../src/config/db.js';
import { SURFACES, TRIGGERS, thresholdFor } from '../../src/config/motivationTriggers.js';
import { Motivation } from '../../src/models/Motivation.js';
import { interpolate } from '../../src/services/motivation.service.js';
import { MOTIVATION_LINES } from './motivation-lines.js';

const force = process.argv.includes('--force');

/**
 * Which tokens a line is allowed to use, and it is the *surface* that decides
 * most of it rather than the trigger.
 *
 * Every signal below is a number for anyone signed in, whatever condition
 * matched — so a milestone line may quote the streak, and a streak line may
 * quote the total. Only two are conditional, and each has exactly one trigger
 * that guarantees it.
 */
const UNIVERSAL = [
  'streak', 'maxStreak', 'solved', 'total', 'remaining',
  'percent', 'today', 'week', 'due', 'attempted',
];

const GATED = {
  pattern: 'weak_pattern',
  patternSolved: 'weak_pattern',
  patternTotal: 'weak_pattern',
  patternRemaining: 'weak_pattern',
  // Null for someone who has never solved anything; `lapsed` is the one
  // condition that cannot be true in that state.
  days: 'lapsed',
};

/**
 * The signed-out page is handed no signals at all — deliberately, it is what
 * stops a stranger matching a personal condition. So a login line containing
 * any token can never render, whatever its trigger says.
 */
const tokensAllowedFor = (line) =>
  line.surfaces?.includes('login')
    ? []
    : [...UNIVERSAL, ...Object.keys(GATED).filter((t) => GATED[t] === line.trigger)];

/**
 * Everything that can be wrong with a line, caught before it reaches Mongo.
 *
 * The token check is the one that matters. A line using `{pattern}` under a
 * trigger that cannot supply it is not an error at runtime — the picker just
 * discards it and moves on — so without this it would sit in the database
 * looking healthy and never once appear.
 */
function problemsWith(line) {
  const found = [];
  const trigger = TRIGGERS[line.trigger];

  if (!trigger) found.push(`unknown trigger "${line.trigger}"`);
  if (!line.text?.trim()) found.push('empty text');
  if (line.text && line.text.length > 240) found.push(`${line.text.length} chars, max is 240`);

  const badSurface = (line.surfaces || []).find((s) => !SURFACES.includes(s));
  if (badSurface) found.push(`unknown surface "${badSurface}"`);
  if (!line.surfaces?.length) found.push('no surfaces');

  if (trigger) {
    const allowed = tokensAllowedFor(line);
    for (const [, token] of line.text.matchAll(/\{(\w+)\}/g)) {
      if (allowed.includes(token)) continue;
      found.push(
        line.surfaces?.includes('login')
          ? `{${token}} can never be filled on the login page`
          : GATED[token]
            ? `{${token}} needs the ${GATED[token]} trigger, not ${line.trigger}`
            : `{${token}} is not a token`,
      );
    }
    if (trigger.threshold && typeof line.threshold !== 'number') {
      // Not fatal — the picker falls back to the trigger's default — but it is
      // almost always an oversight, since the default is rarely what you meant.
      found.push(`no threshold, will default to ${trigger.threshold.default}`);
    }
    if (!trigger.threshold && line.threshold != null) {
      found.push(`threshold ${line.threshold} is ignored by ${line.trigger}`);
    }
  }

  return found;
}

async function main() {
  const seen = new Set();
  const fatal = [];

  for (const line of MOTIVATION_LINES) {
    if (!line.key) fatal.push(`a line has no key: "${line.text?.slice(0, 50)}"`);
    else if (seen.has(line.key)) fatal.push(`duplicate key "${line.key}"`);
    seen.add(line.key);

    for (const issue of problemsWith(line)) {
      // Threshold defaults are a warning; everything else stops the run.
      if (issue.startsWith('no threshold')) console.warn(`  !    ${line.key.padEnd(14)} ${issue}`);
      else fatal.push(`${line.key}: ${issue}`);
    }
  }

  if (fatal.length) {
    console.error(`[seed:motivation] ${fatal.length} problem(s) in the content file:`);
    for (const issue of fatal) console.error(`  ${issue}`);
    process.exit(1);
  }

  await connectDb();

  if (force) console.warn('[seed:motivation] --force: hand-edited lines will be overwritten\n');

  let written = 0;
  let skipped = 0;

  for (const line of MOTIVATION_LINES) {
    const existing = await Motivation.findOne({ key: line.key }).select('editedAt').lean();

    if (existing?.editedAt && !force) {
      skipped += 1;
      console.warn(
        `  --   ${line.key.padEnd(14)} edited ${existing.editedAt.toISOString().slice(0, 10)}, skipped`,
      );
      continue;
    }

    await Motivation.findOneAndUpdate(
      { key: line.key },
      {
        $set: {
          text: line.text.trim(),
          category: line.category,
          surfaces: line.surfaces,
          trigger: line.trigger,
          threshold: thresholdFor(line.trigger, line.threshold),
          weight: line.weight ?? 1,
          active: line.active ?? true,
          // A forced re-seed hands the line back to the content file.
          ...(force ? { editedAt: null, editedBy: null } : {}),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    written += 1;
  }

  /*
    Prune lines this file used to contain. Scoped to rows that carry a `key`, so
    anything written in the panel is untouched, and to `editedAt: null`, so a
    seeded line somebody took over survives its removal from the file — the same
    exemption seed:db's prune makes, and for the same reason: the text here also
    lives in git, and theirs does not.
  */
  const keys = MOTIVATION_LINES.map((l) => l.key);
  const pruned = await Motivation.deleteMany({
    key: { $ne: null, $nin: keys },
    editedAt: null,
  });

  const [total, custom] = await Promise.all([
    Motivation.countDocuments(),
    Motivation.countDocuments({ key: null }),
  ]);

  console.log(
    `\n[seed:motivation] ${written} written, ${skipped} skipped` +
      (pruned.deletedCount ? `, ${pruned.deletedCount} pruned` : ''),
  );
  console.log(`  seeded: ${total - custom}   written in the panel: ${custom}   total: ${total}`);

  // A surface with nothing to show renders no strip at all, which looks like a
  // bug from the outside. Cheaper to notice here.
  for (const surface of SURFACES) {
    const n = MOTIVATION_LINES.filter(
      (l) => l.surfaces.includes(surface) && l.trigger === 'always',
    ).length;
    if (n === 0) console.warn(`[seed:motivation] no fallback lines for "${surface}"`);
  }

  // Cheap proof the interpolation contract holds, without a database round trip.
  const sample = { weakestPattern: { name: 'Graphs', solved: 3, total: 28 }, streak: 7,
    solvedTotal: 120, curriculumTotal: 429, remaining: 309, percent: 28, solvedToday: 2,
    solvedThisWeek: 9, dueCount: 4, attemptedNotSolved: 6, daysSinceLastSolve: 3, maxStreak: 21 };
  const unfillable = MOTIVATION_LINES.filter((l) => interpolate(l.text, {
    pattern: sample.weakestPattern.name,
    patternSolved: sample.weakestPattern.solved,
    patternTotal: sample.weakestPattern.total,
    patternRemaining: sample.weakestPattern.total - sample.weakestPattern.solved,
    streak: sample.streak, maxStreak: sample.maxStreak, solved: sample.solvedTotal,
    total: sample.curriculumTotal, remaining: sample.remaining, percent: sample.percent,
    today: sample.solvedToday, week: sample.solvedThisWeek, due: sample.dueCount,
    attempted: sample.attemptedNotSolved, days: sample.daysSinceLastSolve,
  }) === null);
  if (unfillable.length) {
    console.warn(`[seed:motivation] never renderable: ${unfillable.map((l) => l.key).join(', ')}`);
  }

  await disconnectDb();
}

main().catch(async (err) => {
  console.error('[seed:motivation] failed:', err.message);
  await disconnectDb().catch(() => {});
  process.exit(1);
});
