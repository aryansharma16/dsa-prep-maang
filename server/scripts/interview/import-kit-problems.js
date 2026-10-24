/**
 * Add the resource kit's problems that are not in our bank, as `extra` problems.
 *
 *   node scripts/interview/import-kit-problems.js --kit /path/to/kit-plan.json
 *
 * The kit file is its 30-day plan as JSON (an array of days, each with
 * `problems: [{ slug, url, tags }]`), kept outside the repo.
 *
 * For each slug we do not already have, it looks the problem up on LeetCode
 * (title, difficulty, topic tags; the statement is not stored) and files it
 * under a roadmap pattern with the same classifier the seed uses. Rows are
 * shared (`owner: null`) and marked `extra: true`, so they stay off the default
 * roadmap and its counts and appear only under the Kit 360 sheet filter and on
 * the 30-Day Sprint page.
 *
 * Safe to re-run: existing slugs are skipped. Problems the lookup cannot find
 * are reported and skipped rather than guessed. Run build-sprint.js afterwards
 * to tag them and rebuild the Kit 360 plan.
 */
import { readFile } from 'node:fs/promises';
import { connectDb, disconnectDb } from '../../src/config/db.js';
import { Problem } from '../../src/models/Problem.js';
import { fetchProblem } from '../../src/services/leetcode.service.js';
import { classify } from '../seed/classify.js';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const file = arg('kit');
  if (!file) {
    console.error('Usage: --kit <kit-plan.json>');
    process.exit(1);
  }
  const plan = JSON.parse(await readFile(file, 'utf8'));
  const kit = plan.flatMap((day) => day.problems || []).filter((p) => p.slug);

  await connectDb();
  const have = new Set(
    (await Problem.find({ owner: null, slug: { $in: kit.map((p) => p.slug) } }, 'slug').lean()).map((p) => p.slug),
  );
  const missing = kit.filter((p) => !have.has(p.slug));
  console.log(`[kit] ${kit.length} in kit, ${have.size} already in bank, ${missing.length} to add`);

  // After every existing problem in a pattern, so extras never reorder the roadmap.
  const nextOrder = new Map();
  const orderFor = async (patternSlug) => {
    if (!nextOrder.has(patternSlug)) {
      const last = await Problem.findOne({ patternSlug }).sort({ patternOrder: -1 }).select('patternOrder').lean();
      nextOrder.set(patternSlug, Math.max(1000, (last?.patternOrder ?? 0) + 1));
    }
    const n = nextOrder.get(patternSlug);
    nextOrder.set(patternSlug, n + 1);
    return n;
  };

  let added = 0;
  const failed = [];
  for (const [i, k] of missing.entries()) {
    const lc = await fetchProblem(k.slug);
    if (!lc) {
      failed.push(k.slug);
      continue;
    }
    const kitTags = String(k.tags || '').split(',').map((t) => t.trim()).filter(Boolean);
    const topicTags = lc.topicTags.length ? lc.topicTags : kitTags;
    const patternSlug = classify({ slug: k.slug, topicTags });

    await Problem.updateOne(
      { slug: k.slug, owner: null },
      {
        $setOnInsert: {
          slug: k.slug,
          title: lc.title,
          source: 'leetcode',
          difficulty: lc.difficulty,
          url: lc.url,
          patternSlug,
          patternOrder: await orderFor(patternSlug),
          topicTags,
          owner: null,
          extra: true,
        },
      },
      { upsert: true },
    );
    added += 1;
    if ((i + 1) % 25 === 0) console.log(`[kit] ${i + 1}/${missing.length}…`);
    await sleep(150); // the LeetCode API is a free shared host; go easy on it
  }

  console.log(`[kit] added ${added}; not found on LeetCode: ${failed.length}${failed.length ? ` (${failed.join(', ')})` : ''}`);
}

main()
  .catch((err) => {
    console.error('[kit]', err.message);
    process.exitCode = 1;
  })
  .finally(() => disconnectDb());
