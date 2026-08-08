/**
 * Turns the raw sources into the curated curriculum at data/curated.json.
 *
 * Scoring: how often big tech actually asks it, plus a bonus for being on a
 * sheet that already survived curation by someone who knows what they're doing.
 * Selection: a fixed quota per pattern, so you get depth in every pattern
 * instead of 200 array problems and 3 graph problems.
 *
 *   npm run seed:curate
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { classify, classifyByTitle } from './classify.js';
import { cleanTitle } from './normalize.js';
import { PATTERNS } from './patterns.js';
import { CURATED_PATH, DATA_DIR, RAW_DIR, companyWeight, slugFromUrl } from './sources.js';

const readJson = (file) => JSON.parse(fs.readFileSync(path.join(RAW_DIR, file), 'utf8'));

function requireRaw() {
  const missing = ['leetcode-all.json', 'neetcode.json', 'striver-sde.json'].filter(
    (f) => !fs.existsSync(path.join(RAW_DIR, f)),
  );
  if (missing.length) {
    console.error(`[seed:curate] missing raw sources: ${missing.join(', ')}`);
    console.error('Run: npm run seed:fetch');
    process.exit(1);
  }
}

/** Minimal CSV reader — these files are machine-generated and well-formed. */
function parseCsv(text) {
  const rows = [];
  for (const line of text.split('\n').slice(1)) {
    if (!line.trim()) continue;
    const cells = [];
    let cur = '';
    let quoted = false;
    for (const ch of line) {
      if (ch === '"') quoted = !quoted;
      else if (ch === ',' && !quoted) {
        cells.push(cur);
        cur = '';
      } else cur += ch;
    }
    cells.push(cur);
    rows.push({ difficulty: cells[0], title: cells[1], freq: parseFloat(cells[2]) || 0, link: cells[4] });
  }
  return rows;
}

function loadCompanies() {
  const dir = path.join(RAW_DIR, 'companies');
  const bySlug = new Map();
  if (!fs.existsSync(dir)) {
    console.warn('[seed:curate] no company data found — scores will use sheets only');
    return bySlug;
  }

  let files = 0;
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.csv'))) {
    const text = fs.readFileSync(path.join(dir, file), 'utf8');
    if (!text.trim()) continue;
    files += 1;
    const company = file.replace(/\.csv$/, '');
    for (const row of parseCsv(text)) {
      const slug = slugFromUrl(row.link);
      if (!slug) continue;
      if (!bySlug.has(slug)) bySlug.set(slug, []);
      bySlug.get(slug).push({ name: company, freq: Math.round(row.freq * 10) / 10 });
    }
  }
  console.log(`  companies: ${files} files, ${bySlug.size} tagged problems`);
  return bySlug;
}

function main() {
  requireRaw();

  const leetcode = readJson('leetcode-all.json');
  const neetcode = readJson('neetcode.json');
  const striverDays = readJson('striver-sde.json');
  const companies = loadCompanies();

  const lcBySlug = new Map(leetcode.map((p) => [p.title_slug, p]));
  const ncBySlug = new Map(neetcode.map((n) => [n.link.replace(/\/$/, ''), n]));

  // Striver's sheet, flattened, keeping the day grouping for the sheet badge.
  const striver = [];
  striverDays.forEach((day, dayIndex) => {
    day.problems.forEach((p, i) => {
      striver.push({
        // The upstream scrape is CP437-mangled — repair before it reaches the DB.
        title: cleanTitle(p.Problem),
        day: cleanTitle(day.day),
        dayIndex,
        order: i,
        difficulty: p.Difficulty || 'Medium',
        article: p.Problem_link || p['Resource(Free)_link'] || '',
        slug: slugFromUrl(p.Practice_link),
      });
    });
  });
  const striverBySlug = new Map(striver.filter((p) => p.slug).map((p) => [p.slug, p]));

  console.log(
    `  sources: ${leetcode.length} leetcode · ${neetcode.length} neetcode · ${striver.length} striver`,
  );

  // ---- build candidates ----
  const candidates = [];
  const consider = new Set([...companies.keys(), ...ncBySlug.keys(), ...striverBySlug.keys()]);

  for (const slug of consider) {
    const lc = lcBySlug.get(slug);
    // Premium problems can't be opened, so they're noise in a study list.
    if (!lc || lc.paid_only) continue;

    const cos = companies.get(slug) || [];
    const nc = ncBySlug.get(slug);
    const sde = striverBySlug.get(slug);

    const companyScore = cos.reduce((sum, c) => sum + companyWeight(c.name) * (c.freq / 100), 0);
    let sheetScore = 0;
    if (sde) sheetScore += 2.5;
    if (nc?.neetcode150) sheetScore += 2.5;
    if (nc?.blind75) sheetScore += 1.5;
    else if (nc) sheetScore += 0.5;

    const sheets = [];
    if (sde) sheets.push({ sheet: 'striver-sde', group: sde.day, order: sde.order });
    if (nc?.neetcode150) sheets.push({ sheet: 'neetcode-150', group: nc.pattern, order: 0 });
    if (nc?.blind75) sheets.push({ sheet: 'blind-75', group: nc.pattern, order: 0 });

    candidates.push({
      slug,
      title: lc.title,
      source: 'leetcode',
      difficulty: lc.difficulty,
      url: lc.url || `https://leetcode.com/problems/${slug}/`,
      articleUrl: sde?.article || '',
      topicTags: lc.topic_tags || [],
      companies: cos.sort((a, b) => b.freq - a.freq),
      sheets,
      likes: lc.likes || 0,
      acceptance: Number(lc.acceptance_rate) || 0,
      videoId: nc?.video || '',
      patternSlug: classify({ slug, topicTags: lc.topic_tags, neetcodePattern: nc?.pattern }),
      score: Math.round((companyScore + sheetScore) * 100) / 100,
    });
  }

  // ---- per-pattern quota, easy first ----
  const rank = { Easy: 0, Medium: 1, Hard: 2 };
  const selected = [];
  const report = [];

  // A problem on Striver's SDE Sheet or NeetCode 150 is always kept, even if it
  // ranks below its pattern's quota cut — otherwise the app would show those
  // sheets partially complete, which defeats the point of tracking them.
  const isCore = (c) =>
    c.sheets.some((s) => s.sheet === 'striver-sde' || s.sheet === 'neetcode-150');

  for (const pattern of PATTERNS) {
    const pool = candidates
      .filter((c) => c.patternSlug === pattern.slug)
      .sort((a, b) => b.score - a.score);

    const core = pool.filter(isCore);
    const filler = pool.filter((c) => !isCore(c)).slice(0, Math.max(0, pattern.quota - core.length));

    const taken = [...core, ...filler]
      // Within a pattern, easy before hard — this ordering IS the learning ramp.
      .sort((a, b) => rank[a.difficulty] - rank[b.difficulty] || b.score - a.score)
      .map((c, i) => ({ ...c, patternOrder: i }));

    selected.push(...taken);
    report.push({
      pattern: pattern.slug,
      pool: pool.length,
      core: core.length,
      taken: taken.length,
      quota: pattern.quota,
    });
  }

  // ---- Striver problems with no LeetCode equivalent ----
  // 61 of the 191 are GFG/CodeStudio only. Dropping them would silently truncate
  // the sheet, so they're seeded with their article link instead.
  const orphanCounters = new Map();
  const orphans = striver
    .filter((p) => !p.slug)
    .map((p) => {
      const patternSlug = classifyByTitle(p.title);
      const n = (orphanCounters.get(patternSlug) || 0) + 1;
      orphanCounters.set(patternSlug, n);
      const difficulty = ['Easy', 'Medium', 'Hard'].includes(p.difficulty) ? p.difficulty : 'Medium';
      return {
        slug: `striver-${p.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
        title: p.title,
        source: 'gfg',
        difficulty,
        url: p.article,
        articleUrl: p.article,
        topicTags: [],
        companies: [],
        sheets: [{ sheet: 'striver-sde', group: p.day, order: p.order }],
        likes: 0,
        acceptance: 0,
        videoId: '',
        patternSlug,
        score: 2.5,
        // 1000+ keeps them after the curated LeetCode ramp in each pattern.
        patternOrder: 1000 + n,
      };
    });

  // Titles repeat across the sheet (e.g. the same problem listed twice) — the
  // slug is the unique key, so collapse duplicates before writing.
  const seen = new Set();
  const uniqueOrphans = orphans.filter((o) => !seen.has(o.slug) && seen.add(o.slug));

  const problems = [...selected, ...uniqueOrphans];

  // ---- report ----
  console.log('\n  pattern            pool  core  taken');
  for (const r of report) {
    const flag = r.taken < r.quota ? `  << thin pool (quota ${r.quota})` : '';
    console.log(
      `  ${r.pattern.padEnd(18)} ${String(r.pool).padStart(4)} ${String(r.core).padStart(5)} ${String(r.taken).padStart(6)}${flag}`,
    );
  }

  const byDifficulty = problems.reduce((acc, p) => {
    acc[p.difficulty] = (acc[p.difficulty] || 0) + 1;
    return acc;
  }, {});
  const inSheet = (name) => problems.filter((p) => p.sheets.some((s) => s.sheet === name)).length;

  console.log(`\n  curated (leetcode):     ${selected.length}`);
  console.log(`  striver GFG-only:       ${uniqueOrphans.length}`);
  console.log(`  TOTAL:                  ${problems.length}`);
  console.log(`  difficulty:             ${JSON.stringify(byDifficulty)}`);
  console.log(
    `  striver-sde ${inSheet('striver-sde')} · neetcode-150 ${inSheet('neetcode-150')} · blind-75 ${inSheet('blind-75')}`,
  );
  console.log(`  with company tags:      ${problems.filter((p) => p.companies.length).length}`);

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(CURATED_PATH, JSON.stringify(problems, null, 2));
  console.log(`\n  wrote ${CURATED_PATH}`);
  console.log('  Next: npm run seed:db');

  return fsp.stat(CURATED_PATH);
}

main();
