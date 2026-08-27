/**
 * Turns ~11,000 Codeforces problems and ~4,000 CodeChef ones into a ladder of
 * about 800.
 *
 * The selection is the product, so it is worth saying what it optimises for.
 * Not "the best problems" — that is not a thing a script can know. It optimises
 * for **coverage of a (pattern × tier) grid**: every technique should have a
 * ramp of problems across the bands where it is actually used, so that someone
 * working a pattern is never handed three 800s and a 2400. Within each cell the
 * ranking is quality, and quality is approximated by the two signals that
 * survive contact with reality — how many people have solved it, and whether a
 * human-curated sheet picked it out.
 *
 *   npm run seed:cp:curate -- --dry     print the distribution, write nothing
 *   npm run seed:cp:curate              write data/cp/curated-cp.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { CP_TIERS, tierForRating } from '../../../src/config/cpTiers.js';
import { divisionOf, problemUrl } from '../../../src/services/cp/codeforces.service.js';
import { ccTopicsFor, classify, classifyCodechef, topicsFor } from './classify.js';
import { loadSheetIndex, resolveHints, sheetWeight } from './parse-sheets.js';
import { CP_PATTERNS, quotaFor } from './patterns.js';
import {
  CC_BANDS,
  ccCategory,
  ccDifficultyLabel,
  ccDivision,
  ccProblemPage,
  ccScore,
} from './sheets.js';
import {
  CF_CONTESTS_PATH,
  CF_PROBLEMSET_PATH,
  CP_DATA_DIR,
  CURATED_CP_PATH,
  EXCLUDED_CONTEST_PATTERNS,
  FORMAT_TAGS,
  OLDEST_CONTEST_YEAR,
  TARGET_CC,
  TARGET_CF,
  minSolvers,
} from './sources.js';

const dry = process.argv.includes('--dry');

const read = (file, what) => {
  if (!fs.existsSync(file)) {
    console.error(`[seed:cp:curate] ${file} not found. Run: npm run seed:cp:${what}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
};

// ─────────────────────────────── Codeforces ──────────────────────────────────

function curateCodeforces() {
  const problems = read(CF_PROBLEMSET_PATH, 'fetch');
  const contests = read(CF_CONTESTS_PATH, 'fetch');
  const byContest = new Map(contests.map((c) => [c.id, c]));

  console.log('Reading sheets...');
  const sheets = resolveHints(loadSheetIndex(problems));

  const rejected = { unrated: 0, format: 0, contest: 0, old: 0, solvers: 0 };

  const pool = [];
  for (const p of problems) {
    if (!p.rating) {
      rejected.unrated += 1;
      continue;
    }

    const entry = sheets.get(`${p.contestId}:${p.index}`) || null;
    const weight = sheetWeight(entry);
    /*
      A curated problem bypasses every filter below.

      That is the point of having sheets at all: the filters are heuristics for
      "probably teachable", and a human who put this problem on a syllabus has
      already answered that question better than a solve-count threshold can.
      Several genuinely canonical problems are old, or niche, or from a round
      the exclusion list catches — and dropping them to keep the rules uniform
      would be letting the heuristic outrank the evidence it approximates.
    */
    const curated = weight > 0;

    const tags = new Set(p.tags || []);
    if (!curated && [...tags].some((t) => FORMAT_TAGS.has(t) && t !== 'interactive')) {
      rejected.format += 1;
      continue;
    }

    const contest = byContest.get(p.contestId);
    const contestName = contest?.name || '';
    if (!curated && EXCLUDED_CONTEST_PATTERNS.some((re) => re.test(contestName))) {
      rejected.contest += 1;
      continue;
    }

    const startedAt = contest?.startTimeSeconds ? new Date(contest.startTimeSeconds * 1000) : null;
    if (!curated && startedAt && startedAt.getUTCFullYear() < OLDEST_CONTEST_YEAR) {
      rejected.old += 1;
      continue;
    }

    if (!curated && p.solvedCount < minSolvers(p.rating)) {
      rejected.solvers += 1;
      continue;
    }

    const tier = tierForRating(p.rating);
    if (!tier) continue;

    const { pattern, confidence, via } = classify(p, { hint: entry?.hint });

    pool.push({
      cf: p,
      contest,
      contestName,
      startedAt,
      tier: tier.slug,
      pattern,
      confidence,
      via,
      entry,
      weight,
      score: scoreCf(p, weight, confidence),
    });
  }

  console.log(
    `\n${pool.length} candidates after filtering ` +
      `(dropped: ${rejected.unrated} unrated, ${rejected.solvers} too-few-solvers, ` +
      `${rejected.old} pre-${OLDEST_CONTEST_YEAR}, ${rejected.contest} excluded rounds, ${rejected.format} format-tagged)`,
  );

  const picked = fillGrid(pool, TARGET_CF);
  return picked.map(toCfDoc);
}

/**
 * How good a teaching example this problem is, as one number.
 *
 * Three terms, and the reason each is here:
 *
 * - **Solvers, logged.** The only quality signal Codeforces publishes. Logged
 *   because the difference between 200 and 2,000 solvers says a great deal and
 *   the difference between 40,000 and 60,000 says almost nothing. Normalised
 *   against the band's own floor, so a well-known 2400 is not out-scored by an
 *   unremarkable 900 that a hundred times more people have seen.
 * - **Sheet weight.** A human picked this out. Weighted heavily — it is the
 *   difference between a list and a curriculum.
 * - **Classification confidence.** A problem we are sure is *about* this pattern
 *   is a better example of it than one that matched a general rule.
 */
function scoreCf(p, weight, confidence) {
  const floor = minSolvers(p.rating);
  const popularity = Math.log10(Math.max(p.solvedCount, 1) / Math.max(floor, 1) + 1);
  return popularity * 2 + weight * 2.5 + confidence * 1.5;
}

/**
 * Fill a (pattern × tier) grid rather than taking the global top N.
 *
 * Taking the top N by score gives a list that is 70% Div. 2 A and B, because
 * that is where the solve counts are — a perfectly ranked list that teaches
 * nothing above 1400. The grid forces a ramp: each pattern gets its quota spread
 * across the tiers it actually appears in, and cells that genuinely have no good
 * problems stay short instead of being padded.
 *
 * Two passes. The first respects per-cell caps so no single band eats a
 * pattern's whole quota; the second spends whatever is left over on the best
 * remaining candidates, so a target is met even when some cells came up empty.
 */
function fillGrid(pool, target) {
  const byPattern = new Map();
  for (const item of pool) {
    if (!byPattern.has(item.pattern)) byPattern.set(item.pattern, []);
    byPattern.get(item.pattern).push(item);
  }

  const picked = [];
  const taken = new Set();

  for (const pattern of CP_PATTERNS) {
    const items = (byPattern.get(pattern.slug) || []).sort((a, b) => b.score - a.score);
    if (!items.length) continue;

    const quota = quotaFor(pattern.slug);
    const byTier = new Map();
    for (const item of items) {
      if (!byTier.has(item.tier)) byTier.set(item.tier, []);
      byTier.get(item.tier).push(item);
    }

    /*
      Spread the quota over the tiers this pattern actually occupies, weighted
      towards the tier it is introduced at. A pattern introduced at Specialist
      should have most of its problems at Specialist and a tail either side —
      that tail is what makes it a ramp rather than a block.
    */
    const home = CP_TIERS.findIndex((t) => t.slug === pattern.tier);
    const tiers = [...byTier.keys()];
    const weights = tiers.map((slug) => {
      const distance = Math.abs(CP_TIERS.findIndex((t) => t.slug === slug) - home);
      return 1 / (1 + distance);
    });
    const totalWeight = weights.reduce((a, b) => a + b, 0) || 1;

    tiers.forEach((slug, i) => {
      const cap = Math.max(1, Math.round((quota * weights[i]) / totalWeight));
      for (const item of byTier.get(slug).slice(0, cap)) {
        const id = `${item.cf.contestId}:${item.cf.index}`;
        if (taken.has(id)) continue;
        taken.add(id);
        picked.push(item);
      }
    });
  }

  /*
    Top up towards the target, round-robin over the patterns that are furthest
    from their quota.

    The obvious version — take the best remaining candidates by score until the
    target is hit — is what this replaced, and it is badly wrong in a way that
    looks fine: score correlates with solve count, solve count correlates with
    how common a tag is, so 200 leftover slots went almost entirely to greedy,
    implementation and linear DP. Those three ended at four times their quota
    while sqrt-decomposition sat at four problems. A ladder cannot be built out
    of whatever the sweep found most of.

    Filling by *deficit* instead spends the same slots on the sections that need
    them. The cap keeps a pattern with a deep pool from drifting far past what
    it was allotted; a pattern that runs dry simply stops being offered.
  */
  const remaining = new Map();
  for (const [slug, items] of byPattern) {
    remaining.set(
      slug,
      items.filter((i) => !taken.has(`${i.cf.contestId}:${i.cf.index}`)).sort((a, b) => b.score - a.score),
    );
  }

  const countFor = (slug) => picked.filter((i) => i.pattern === slug).length;
  const filled = new Map(CP_PATTERNS.map((p) => [p.slug, countFor(p.slug)]));

  while (picked.length < target) {
    const candidates = CP_PATTERNS.map((p) => ({
      slug: p.slug,
      quota: quotaFor(p.slug),
      have: filled.get(p.slug) || 0,
    }))
      // Never more than half again the quota — the allotment is a judgement
      // about how much of this technique is worth doing, and the top-up is not
      // a licence to overrule it.
      .filter((c) => c.have < c.quota * 1.5 && remaining.get(c.slug)?.length)
      .sort((a, b) => a.have / a.quota - b.have / b.quota);

    if (!candidates.length) break;

    const next = remaining.get(candidates[0].slug).shift();
    taken.add(`${next.cf.contestId}:${next.cf.index}`);
    picked.push(next);
    filled.set(candidates[0].slug, (filled.get(candidates[0].slug) || 0) + 1);
  }

  return picked;
}

function toCfDoc(item) {
  const { cf: p, contest, entry } = item;
  return {
    slug: `cf-${p.contestId}-${p.index}`,
    title: p.name,
    platform: 'codeforces',
    difficulty: String(p.rating),
    url: problemUrl(p.contestId, p.index),
    editorialUrl: '',
    patternSlug: item.pattern,
    tier: item.tier,
    topicTags: topicsFor(p.tags),
    platformTags: [...(p.tags || [])].sort(),
    companies: [],
    codeforces: {
      contestId: p.contestId,
      index: p.index,
      rating: p.rating,
      points: p.points || 0,
      solvedCount: p.solvedCount || 0,
      contestName: item.contestName,
      contestType: contest?.type || '',
      division: divisionOf(item.contestName),
      contestStartedAt: item.startedAt ? item.startedAt.toISOString() : null,
    },
    curatedFrom: entry?.sheets || [],
    solutions: entry?.solutions || [],
    score: Number(item.score.toFixed(3)),
  };
}

// ─────────────────────────────────── main ────────────────────────────────────

function report(docs) {
  const tiers = new Map(CP_TIERS.map((t) => [t.slug, { total: 0, cf: 0, cc: 0 }]));
  const patterns = new Map();

  for (const d of docs) {
    const tier = tiers.get(d.tier);
    tier.total += 1;
    tier[d.platform === 'codeforces' ? 'cf' : 'cc'] += 1;

    if (!patterns.has(d.patternSlug)) patterns.set(d.patternSlug, { total: 0, tiers: new Set() });
    const pattern = patterns.get(d.patternSlug);
    pattern.total += 1;
    pattern.tiers.add(d.tier);
  }

  console.log('\n── By tier ────────────────────────────────────────────────');
  for (const t of CP_TIERS) {
    const row = tiers.get(t.slug);
    const bar = '█'.repeat(Math.round(row.total / 6));
    console.log(
      `  ${t.label.padEnd(18)} ${String(row.total).padStart(4)}  ` +
        `(cf ${String(row.cf).padStart(3)}, cc ${String(row.cc).padStart(3)})  ${bar}`,
    );
  }

  console.log('\n── By pattern ─────────────────────────────────────────────');
  const empty = [];
  for (const p of CP_PATTERNS) {
    const row = patterns.get(p.slug);
    if (!row) {
      empty.push(p.slug);
      continue;
    }
    console.log(
      `  ${p.slug.padEnd(26)} ${String(row.total).padStart(3)}  ` +
        `across ${row.tiers.size} tier${row.tiers.size === 1 ? '' : 's'}`,
    );
  }
  if (empty.length) console.log(`\n  !! ${empty.length} patterns with no problems: ${empty.join(', ')}`);

  const withSolutions = docs.filter((d) => d.solutions?.length).length;
  const withSheets = docs.filter((d) => d.curatedFrom?.length).length;
  console.log(
    `\n  ${docs.length} problems · ${withSheets} named by a curated sheet · ${withSolutions} with a reference solution`,
  );

  return empty;
}

function main() {
  const cf = curateCodeforces();
  const cc = curateCodechefBands();

  const docs = [...cf, ...cc];

  // Order inside a pattern is the ramp, and order inside a tier is what the
  // default view walks. Both are assigned here rather than at read time, so the
  // ladder cannot reorder itself between two requests.
  assignOrder(docs, 'patternSlug', 'patternOrder');
  assignOrder(docs, 'tier', 'tierOrder');

  const empty = report(docs);

  if (dry) {
    console.log('\n--dry: nothing written.');
    return;
  }

  if (empty.length > CP_PATTERNS.length / 4) {
    console.error(`\n[seed:cp:curate] ${empty.length} empty patterns — refusing to write a broken ladder.`);
    process.exit(1);
  }

  fs.mkdirSync(CP_DATA_DIR, { recursive: true });
  fs.writeFileSync(CURATED_CP_PATH, JSON.stringify(docs, null, 0));
  console.log(`\nWrote ${docs.length} problems -> ${CURATED_CP_PATH}`);
  console.log('Next: npm run seed:cp:db');
}

/** Rank within a group, easiest first, so the position is the learning order. */
function assignOrder(docs, groupKey, orderKey) {
  const groups = new Map();
  for (const d of docs) {
    if (!groups.has(d[groupKey])) groups.set(d[groupKey], []);
    groups.get(d[groupKey]).push(d);
  }
  for (const list of groups.values()) {
    list
      .sort((a, b) => ratingOf(a) - ratingOf(b) || b.score - a.score)
      .forEach((d, i) => {
        d[orderKey] = i + 1;
      });
  }
}

/**
 * A single comparable number for ordering, across two incompatible scales.
 *
 * CodeChef ratings are not Codeforces ratings — the scales were calibrated
 * against different populations and a CodeChef 1600 sits far below a Codeforces
 * 1600. Rather than pretend to convert, CodeChef problems are placed by the tier
 * they were assigned to and ordered within it by their own rating. The offset
 * keeps the two from interleaving arbitrarily inside a shared tier.
 */
function ratingOf(doc) {
  if (doc.platform === 'codeforces') return doc.codeforces?.rating || 0;
  const tierIndex = CP_TIERS.findIndex((t) => t.slug === doc.tier);
  return CP_TIERS[tierIndex]?.min + (doc.codechef?.difficultyRating || 0) / 100;
}

/**
 * CodeChef, by rating band.
 *
 * A flat band sweep rather than the (pattern × tier) grid used for Codeforces,
 * and the reason is that CodeChef's list API publishes no tags at all. There is
 * nothing to classify on — so these are assigned to a pattern by rating band
 * alone, which is an honest "we do not know" rather than a fabricated one, and
 * keeps CodeChef a supporting source with Codeforces as the spine.
 *
 * Ranking within a band is acceptance rate against volume: a problem many people
 * have attempted and a reasonable share have solved is one with a
 * comprehensible statement, which is what the solve-count floor approximates on
 * the Codeforces side.
 */
function curateCodechefBands() {
  const file = path.join(path.dirname(CF_PROBLEMSET_PATH), 'codechef.json');
  if (!fs.existsSync(file)) {
    console.warn('\n[seed:cp:curate] no codechef.json — skipping CodeChef. Run: npm run seed:cp:codechef');
    return [];
  }
  const problems = JSON.parse(fs.readFileSync(file, 'utf8'));

  const docs = [];
  for (const band of CC_BANDS) {
    const inBand = problems
      .filter((p) => p.rating >= band.min && p.rating <= band.max)
      /*
        Attempted by enough people to be real, and solved by enough of them to
        be comprehensible. The 200-attempt floor drops the long tail of
        problems from contests nobody entered; the acceptance rate is what
        separates "hard" from "badly worded".
      */
      .filter((p) => p.totalSubmissions >= 200 && p.distinctSolvers >= 50)
      .sort((a, b) => ccScore(b) - ccScore(a))
      .slice(0, band.keep);

    for (const p of inBand) {
      const { pattern, via } = classifyCodechef(p.tags, ccPatternFor(band.tier));
      docs.push({
        slug: `cc-${p.code}`,
        title: p.name,
        platform: 'codechef',
        difficulty: ccDifficultyLabel(p.rating),
        url: ccProblemPage(p.code),
        editorialUrl: p.editorialUrl || '',
        videoId: '',
        patternSlug: pattern,
        tier: band.tier,
        topicTags: ccTopicsFor(p.tags),
        platformTags: [...(p.tags || [])].sort(),
        companies: [],
        codechef: {
          code: p.code,
          difficultyRating: p.rating,
          difficultyLabel: ccDifficultyLabel(p.rating),
          category: ccCategory(p.contestCode || ''),
          contestCode: p.contestCode || '',
          contestName: '',
          division: ccDivision(p.contestCode || ''),
          successfulSubmissions: p.successfulSubmissions,
        },
        curatedFrom: [
          {
            sheet: 'cc-practice',
            group: `${band.min}-${band.max}`,
            order: 0,
            note: `CodeChef practice · rating ${p.rating}${via === 'tier' ? ' · untagged' : ''}`,
          },
        ],
        solutions: [],
        score: Number(ccScore(p).toFixed(3)),
      });
    }
    const tagged = inBand.filter((p) => p.tags?.length).length;
    console.log(
      `  CodeChef ${band.min}-${band.max}: kept ${inBand.length}/${band.keep} (${tagged} tagged)`,
    );
  }

  console.log(`\n${docs.length} CodeChef problems (target ${TARGET_CC})`);
  return docs;
}

/**
 * The fallback pattern for a CodeChef problem whose tags said nothing.
 *
 * A tier's entry-point technique, not a claim about the problem. Stated plainly
 * here — and marked `· untagged` on the row's curation note — so that nobody
 * later reads it as a classification that went wrong.
 */
const CC_TIER_PATTERN = {
  newbie: 'implementation-simulation',
  pupil: 'greedy-exchange',
  specialist: 'dp-linear',
  expert: 'dp-grid-interval',
  'candidate-master': 'constructive-advanced',
  master: 'dp-optimizations',
  advanced: 'advanced-structures',
};
const ccPatternFor = (tier) => CC_TIER_PATTERN[tier] || 'implementation-simulation';

main();
