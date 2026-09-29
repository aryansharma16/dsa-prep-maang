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
import { AI_SHEET, assignAiSheet } from './ai-sheet.js';
import { classify, classifyByTitle } from './classify.js';
import { cleanTitle } from './normalize.js';
import { faangGroup, parseFaang } from './parse-faang.js';
import { PATTERNS } from './patterns.js';
import {
  CURATED_PATH,
  DATA_DIR,
  FAANG_FILES,
  FAANG_SHEET,
  RAW_DIR,
  SHEET_150,
  SHEET_150_FILE,
  companyWeight,
  slugFromUrl,
} from './sources.js';

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

/**
 * The 2025-26 company signal, or an empty map.
 *
 * Optional on purpose, matching how the company CSVs are treated: this source
 * is a recency layer over a curriculum that was complete without it, so a
 * missing directory degrades the list rather than failing the build. It is the
 * newest and least stable of the four sources — one upstream rename and the
 * fetch 404s — and a seed that cannot run without it would be a seed that
 * cannot run.
 */
function loadFaang() {
  const dir = path.join(RAW_DIR, 'faang');
  const files = FAANG_FILES.filter((f) => fs.existsSync(path.join(dir, f))).map((f) => ({
    name: f,
    text: fs.readFileSync(path.join(dir, f), 'utf8'),
  }));

  if (!files.length) {
    console.warn('[seed:curate] no FAANG data found — no recency signal this run');
    return new Map();
  }

  const parsed = parseFaang(files);
  console.log(`  faang: ${files.length} files, ${parsed.size} problems mentioned`);
  return parsed;
}

/**
 * Sheet 150, keyed by slug, keeping its day and position for the sheet badge.
 *
 * Its rows are only ever checked against LeetCode, never against what curation
 * would pick, because the sheet is added to CORE_SHEETS below: every problem on
 * it is kept whatever its rank. A row that cannot be served — not on LeetCode,
 * or premium — fails the run instead, the same way ai-sheet.js refuses to
 * quietly ship a short sheet.
 */
function loadSheet150(lcBySlug) {
  const file = path.join(RAW_DIR, SHEET_150_FILE);
  if (!fs.existsSync(file)) {
    console.error(`[seed:curate] missing ${SHEET_150_FILE} — it is hand-kept, not fetched`);
    process.exit(1);
  }

  const bySlug = new Map();
  const bad = [];
  for (const row of JSON.parse(fs.readFileSync(file, 'utf8')).Roadmap) {
    // Review and mock days have no problem attached.
    const slug = slugFromUrl(row.URL);
    if (!slug) continue;
    const lc = lcBySlug.get(slug);
    if (!lc || lc.paid_only) bad.push(slug);
    bySlug.set(slug, { group: `Day ${row.Day}: ${row.Pattern}`, order: row['#'] });
  }
  if (bad.length) {
    console.error(`[seed:curate] ${SHEET_150} rows with no free LeetCode problem: ${bad.join(', ')}`);
    process.exit(1);
  }
  console.log(`  ${SHEET_150}: ${bySlug.size} problems`);
  return bySlug;
}

function main() {
  requireRaw();

  const leetcode = readJson('leetcode-all.json');
  const neetcode = readJson('neetcode.json');
  const striverDays = readJson('striver-sde.json');
  const companies = loadCompanies();
  const faang = loadFaang();

  const lcBySlug = new Map(leetcode.map((p) => [p.title_slug, p]));
  const ncBySlug = new Map(neetcode.map((n) => [n.link.replace(/\/$/, ''), n]));
  const sheet150 = loadSheet150(lcBySlug);

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
  const consider = new Set([
    ...companies.keys(),
    ...ncBySlug.keys(),
    ...striverBySlug.keys(),
    ...faang.keys(),
    ...sheet150.keys(),
  ]);

  for (const slug of consider) {
    const lc = lcBySlug.get(slug);
    // Premium problems can't be opened, so they're noise in a study list.
    if (!lc || lc.paid_only) continue;

    const cos = companies.get(slug) || [];
    const nc = ncBySlug.get(slug);
    const sde = striverBySlug.get(slug);
    const recent = faang.get(slug);
    const s150 = sheet150.get(slug);

    const companyScore = cos.reduce((sum, c) => sum + companyWeight(c.name) * (c.freq / 100), 0);
    let sheetScore = 0;
    if (sde) sheetScore += 2.5;
    if (nc?.neetcode150) sheetScore += 2.5;
    if (nc?.blind75) sheetScore += 1.5;
    else if (nc) sheetScore += 0.5;

    /*
      The recency bonus, capped so it can add at most as much as NeetCode 150.

      Breadth is the signal worth paying for — a problem four companies asked
      last year is a better use of an evening than one that appears in a single
      company's list — but it is a weaker claim than a hand-curated sheet, and
      the cap is what stops a problem mentioned by ten companies from outranking
      the whole of Striver's on this axis alone. `mustDo` is the repo's own
      cross-company list, which is a curation act rather than a count.
    */
    if (recent) {
      sheetScore += Math.min(recent.companies.length * 0.4, 2);
      if (recent.mustDo) sheetScore += 1;
    }

    const sheets = [];
    if (sde) sheets.push({ sheet: 'striver-sde', group: sde.day, order: sde.order });
    if (nc?.neetcode150) sheets.push({ sheet: 'neetcode-150', group: nc.pattern, order: 0 });
    if (nc?.blind75) sheets.push({ sheet: 'blind-75', group: nc.pattern, order: 0 });
    if (recent) sheets.push({ sheet: FAANG_SHEET, group: faangGroup(recent), order: 0 });
    // Last of the imported sheets, so a row's badge and group column still show
    // the list they showed before this one existed. No score bonus: it is a
    // plan built from the same canon, and counting it would count NeetCode twice.
    if (s150) sheets.push({ sheet: SHEET_150, group: s150.group, order: s150.order });

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
      lcId: Number(lc.frontend_id) || 0,
      likes: lc.likes || 0,
      dislikes: lc.dislikes || 0,
      likeRatio: Number(lc.like_ratio) || 0,
      videoId: nc?.video || '',
      /*
        Deliberately not merged into `companies[]`.

        That field holds a measured ask-frequency per company, and this holds a
        set of companies with no frequency at all — a mention in a 2025-26
        report. Writing these in as `freq: 100` would put an invented number
        beside real ones in the same array, and every consumer that sorts or
        filters on frequency would be silently reading a guess. Two fields, two
        claims: `companies` is how often, `askedRecently` is lately.
      */
      askedRecently: recent?.companies || [],
      patternSlug: classify({ slug, topicTags: lc.topic_tags, neetcodePattern: nc?.pattern }),
      score: Math.round((companyScore + sheetScore) * 100) / 100,
    });
  }

  // ---- per-pattern quota, easy first ----
  const rank = { Easy: 0, Medium: 1, Hard: 2 };
  const selected = [];
  const report = [];

  /*
    A problem on Striver's SDE Sheet or NeetCode 150 is always kept, even if it
    ranks below its pattern's quota cut — otherwise the app would show those
    sheets partially complete, which defeats the point of tracking them.

    The FAANG list joins them on the same argument turned around. Those two
    sheets are kept whole because a half-tracked sheet is worse than none; this
    one is kept whole because dropping an entry means dropping a problem a named
    company was reported to ask this year, and "we had it and ranked it out" is
    not a defensible answer for a list whose whole purpose is interview prep.
    It does push several patterns past their quota, which is the intended trade
    and is why the report below prints the overflow.
  */
  const CORE_SHEETS = new Set(['striver-sde', 'neetcode-150', FAANG_SHEET, SHEET_150]);
  const isCore = (c) => c.sheets.some((s) => CORE_SHEETS.has(s.sheet));

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
  const orphans = striver
    .filter((p) => !p.slug)
    .map((p) => {
      const patternSlug = classifyByTitle(p.title);
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
        // Not on LeetCode at all, so no company ever named it in a report that
        // links to one. Written as an empty array rather than left off, so every
        // curated record has the same shape.
        askedRecently: [],
        // Not on LeetCode, so there is no number or vote count to carry over.
        lcId: 0,
        likes: 0,
        dislikes: 0,
        likeRatio: 0,
        videoId: '',
        patternSlug,
        score: 2.5,
        // Placeholder. Every row's real order is derived below, over the
        // combined list, so that these sit inside the ramp rather than behind it.
        patternOrder: 0,
      };
    });

  // Titles repeat across the sheet (e.g. the same problem listed twice) — the
  // slug is the unique key, so collapse duplicates before writing.
  const seen = new Set();
  const uniqueOrphans = orphans.filter((o) => !seen.has(o.slug) && seen.add(o.slug));

  const problems = [...selected, ...uniqueOrphans];

  /*
    The ramp, re-derived once over everything.

    These 61 rows used to be stamped `1000 + n`, which parked them behind the
    curated LeetCode problems in their pattern. That made the roadmap's own
    promise false at the tail: `binary-search` ended H H H E H M H H, because
    the ramp stopped and a second, unsorted list began. Anyone working top to
    bottom hit Aggressive Cows after Median of Two Sorted Arrays.

    Same sort key as the per-pattern pass above, so the LeetCode ordering is
    untouched and the GFG rows simply interleave by difficulty. Their fixed
    score of 2.5 puts them at the back of their own difficulty band, which is
    the right place for a row carrying no votes and no company data.
  */
  const byPattern = new Map();
  for (const p of problems) {
    if (!byPattern.has(p.patternSlug)) byPattern.set(p.patternSlug, []);
    byPattern.get(p.patternSlug).push(p);
  }
  for (const rows of byPattern.values()) {
    rows
      .sort((a, b) => rank[a.difficulty] - rank[b.difficulty] || b.score - a.score)
      .forEach((p, i) => {
        p.patternOrder = i;
      });
  }

  // ---- report ----
  console.log('\n  pattern            pool  core  taken');
  for (const r of report) {
    /*
      Two things worth saying, and they are not the same thing.

      Under quota means the pool genuinely had nothing more worth keeping — a
      standing fact about the source data. Over quota means core problems
      outnumbered the allotment, which is the FAANG list doing its job and is
      information about this run. Printing only the first would make a pattern
      that quietly doubled look identical to one that did not move.
    */
    const flag =
      r.taken < r.quota
        ? `  << thin pool (quota ${r.quota})`
        : r.taken > r.quota
          ? `  +${r.taken - r.quota} over quota ${r.quota}`
          : '';
    console.log(
      `  ${r.pattern.padEnd(18)} ${String(r.pool).padStart(4)} ${String(r.core).padStart(5)} ${String(r.taken).padStart(6)}${flag}`,
    );
  }

  /*
    The fifth sheet, and the only one not imported from somebody else's list.
    Stamped last, after every other sheet is on the rows, because it is computed
    *from* them — see ai-sheet.js. Additive: it only pushes onto `sheets`, so no
    problem loses a membership and the roadmap is the same 517 either way.
  */
  const ai = assignAiSheet(problems);

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
    `  striver-sde ${inSheet('striver-sde')} · neetcode-150 ${inSheet('neetcode-150')} · blind-75 ${inSheet('blind-75')} · ${FAANG_SHEET} ${inSheet(FAANG_SHEET)}`,
  );
  console.log(`  ${SHEET_150}: ${inSheet(SHEET_150)}`);
  console.log(`  ${AI_SHEET}: ${inSheet(AI_SHEET)} across ${ai.filter((r) => r.picked).length} patterns`);
  console.log(`  with company tags:      ${problems.filter((p) => p.companies.length).length}`);
  console.log(
    `  asked in 2025-26:       ${problems.filter((p) => p.askedRecently?.length).length}`,
  );

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(CURATED_PATH, JSON.stringify(problems, null, 2));
  console.log(`\n  wrote ${CURATED_PATH}`);
  console.log('  Next: npm run seed:db');

  return fsp.stat(CURATED_PATH);
}

main();
