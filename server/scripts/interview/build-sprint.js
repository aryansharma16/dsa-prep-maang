/**
 * Build "Sprint 300", the 30-day sprint, and tag its problems on the roadmap.
 *
 *   node scripts/interview/build-sprint.js [--kit /path/to/kit-plan.json]
 *
 * The sprint is the AI-recommended 300 (the `ai-300` sheet), re-ordered for a
 * sprint: pattern by pattern in roadmap order, and Easy → Medium → Hard inside
 * each pattern, so every day ramps up instead of opening on a Hard.
 *
 * --kit is optional: the resource kit's 30-day plan as JSON (an array of days,
 * each with `problems: [{ slug }]`). It is read from wherever you keep it and
 * never committed. With it, the script also builds a second sprint, `kit-360`:
 * the kit's own list in the kit's own day order (run import-kit-problems.js
 * first so all 360 are in the bank). Sprint 300 items that are also on the kit
 * list are marked `kit`.
 *
 * Also writes two sheets onto the problems, so the roadmap's Sheet filter and
 * row badges show them:
 *   sprint-300  the 300, `order` = position in the sprint, `group` = pattern
 *   kit-360     kit problems that exist in our bank
 *
 * Safe to re-run, and should be re-run after a seed (a seed can rewrite
 * sheets): it removes and re-adds only these two sheets.
 */
import { readFile } from 'node:fs/promises';
import { connectDb, disconnectDb } from '../../src/config/db.js';
import { Pattern } from '../../src/models/Pattern.js';
import { Problem } from '../../src/models/Problem.js';
import { Sprint } from '../../src/models/Sprint.js';

const KEY = 'sprint-300';
const KIT_SHEET = 'kit-360';
const KIT_KEY = 'kit-360';
const DIFF_RANK = { Easy: 0, Medium: 1, Hard: 2 };

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};

async function main() {
  const kitFile = arg('kit');
  let kitSlugs = new Set();
  let kitOrder = [];
  if (kitFile) {
    const plan = JSON.parse(await readFile(kitFile, 'utf8'));
    kitOrder = plan.flatMap((day) => (day.problems || []).map((p) => p.slug)).filter(Boolean);
    kitSlugs = new Set(kitOrder);
  }

  await connectDb();

  const patterns = await Pattern.find({}, 'slug name order').lean();
  const patternOrder = new Map(patterns.map((p) => [p.slug, p.order]));
  const patternName = new Map(patterns.map((p) => [p.slug, p.name]));

  const core = await Problem.find({ owner: null, 'sheets.sheet': 'ai-300' }).lean();
  if (!core.length) throw new Error('No ai-300 sheet found; seed the roadmap first');

  const aiOrder = (p) => p.sheets.find((s) => s.sheet === 'ai-300')?.order ?? 0;
  core.sort(
    (a, b) =>
      (patternOrder.get(a.patternSlug) ?? 999) - (patternOrder.get(b.patternSlug) ?? 999) ||
      DIFF_RANK[a.difficulty] - DIFF_RANK[b.difficulty] ||
      aiOrder(a) - aiOrder(b) ||
      a.slug.localeCompare(b.slug),
  );

  const toItem = (p) => ({
    problem: p._id,
    slug: p.slug,
    pattern: patternName.get(p.patternSlug) || p.patternSlug,
    difficulty: p.difficulty,
    kit: kitSlugs.has(p.slug),
  });

  const coreSlugs = new Set(core.map((p) => p.slug));
  const kitInBank = kitSlugs.size
    ? await Problem.find({ owner: null, slug: { $in: [...kitSlugs] } }).lean()
    : [];
  // The kit's extra problems now have a plan of their own (below), so Sprint
  // 300 no longer carries a stretch list.
  const stretch = [];
  void coreSlugs;

  await Sprint.findOneAndUpdate(
    { key: KEY },
    {
      $set: {
        title: 'Sprint 300',
        summary:
          'The AI-recommended 300, pattern by pattern and easy to hard, spread over 30 days (or 45, 60, 75, 90).',
        baseDays: 30,
        lengths: [30, 45, 60, 75, 90],
        items: core.map(toItem),
        stretch: stretch.map(toItem),
      },
    },
    { upsert: true },
  );

  // Re-tag: drop both sheets everywhere, then add them back.
  await Problem.updateMany(
    { owner: null, 'sheets.sheet': { $in: [KEY, KIT_SHEET] } },
    { $pull: { sheets: { sheet: { $in: [KEY, KIT_SHEET] } } } },
  );
  await Problem.bulkWrite(
    core.map((p, i) => ({
      updateOne: {
        filter: { _id: p._id },
        update: { $push: { sheets: { sheet: KEY, group: patternName.get(p.patternSlug) || '', order: i } } },
      },
    })),
  );
  if (kitInBank.length) {
    await Problem.bulkWrite(
      kitInBank.map((p, i) => ({
        updateOne: {
          filter: { _id: p._id },
          update: { $push: { sheets: { sheet: KIT_SHEET, group: patternName.get(p.patternSlug) || '', order: i } } },
        },
      })),
    );
  }

  // The kit's own plan: its list, its order, 12 a day over 30 days.
  if (kitOrder.length) {
    const bySlug = new Map(kitInBank.map((p) => [p.slug, p]));
    const kitItems = kitOrder.filter((slug) => bySlug.has(slug)).map((slug) => ({ ...toItem(bySlug.get(slug)), kit: true }));
    await Sprint.findOneAndUpdate(
      { key: KIT_KEY },
      {
        $set: {
          title: 'Kit 360',
          summary: "The resource kit's 30-day list in its own order: 360 problems, almost all Hard.",
          baseDays: 30,
          lengths: [30, 45, 60, 75, 90],
          items: kitItems,
          stretch: [],
        },
      },
      { upsert: true },
    );
    console.log(`[sprint] ${KIT_KEY}: ${kitItems.length} of ${kitOrder.length} kit problems in the plan`);
  }

  const kitInCore = core.filter((p) => kitSlugs.has(p.slug)).length;
  console.log(
    `[sprint] ${KEY}: ${core.length} problems, ${stretch.length} stretch; ` +
      `kit: ${kitSlugs.size} listed, ${kitInBank.length} in bank (${kitInCore} already in the 300)`,
  );
}

main()
  .catch((err) => {
    console.error('[sprint]', err.message);
    process.exitCode = 1;
  })
  .finally(() => disconnectDb());
