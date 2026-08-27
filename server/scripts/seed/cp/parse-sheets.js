/**
 * Turns the downloaded sheets into one map: problem key -> what the sheets say
 * about it.
 *
 * The key is `${contestId}:${index}`, which is Codeforces' own identity for a
 * problem and the only thing all three sources can be reduced to. Two of them
 * carry it in a URL; CP-31 does not, and matching that one back to the
 * problemset is most of this file.
 *
 * Output per problem:
 *   { sheets: [{ sheet, group, order, note }], patternHints: [slug], solutions: [{lang,url,source}] }
 */
import fs from 'node:fs';
import path from 'node:path';
import { CP_RAW_DIR } from './sources.js';
import { SHEETS, blobUrl, sheetById } from './sheets.js';

const SHEET_DIR = path.join(CP_RAW_DIR, 'sheets');

const key = (contestId, index) => `${contestId}:${index}`;

const readJson = (file) => {
  const full = path.join(SHEET_DIR, file);
  if (!fs.existsSync(full)) return null;
  return JSON.parse(fs.readFileSync(full, 'utf8'));
};

/**
 * Both markdown sources link problems the same two ways — Codeforces serves the
 * same problem under /problemset/problem/1352/G and /contest/1352/problem/G —
 * so one expression covers both rather than two that can disagree.
 */
const CF_LINK = /codeforces\.com\/(?:problemset\/problem|contest)\/(\d+)\/(?:problem\/)?([A-Z]\d?)/gi;

/**
 * Normalised for title matching.
 *
 * Aggressive on purpose: the CP-31 filenames have been through a filesystem, so
 * anything illegal in a path is already gone or replaced, and punctuation
 * differences between "Vasya's Array" and "Vasya s Array" must not lose a match.
 * Dropping every non-alphanumeric leaves the letters, which is the part that
 * genuinely identifies a Codeforces title.
 */
const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

/** karansinghgit ladders — markdown tables with a link and a rating per row. */
function parseLadders(into) {
  const file = readJson('cf-ladders.json');
  if (!file) return 0;
  const sheet = sheetById('cf-ladders');
  let n = 0;

  for (const { group, markdown } of file.data) {
    // Row-wise rather than whole-file, because the order within a ladder is the
    // teaching order and is worth keeping.
    const lines = markdown.split('\n');
    let order = 0;
    for (const line of lines) {
      CF_LINK.lastIndex = 0;
      const link = CF_LINK.exec(line);
      if (!link) continue;
      order += 1;
      const rating = Number((line.match(/\|\s*(\d{3,4})\s*\|/) || [])[1]) || 0;
      const entry = ensure(into, key(link[1], link[2].toUpperCase()));
      entry.sheets.push({
        sheet: sheet.id,
        group,
        order,
        note: `${group} ladder, #${order}${rating ? ` · ${rating}` : ''}`,
      });
      n += 1;
    }
  }
  return n;
}

/** A2OJ — one table per topic; only the Codeforces rows matter here. */
function parseA2oj(into) {
  const file = readJson('a2oj.json');
  if (!file) return 0;
  const sheet = sheetById('a2oj');
  let n = 0;

  for (const { category, markdown } of file.data) {
    const hint = sheet.patternMap[category] || null;
    const seen = new Set();
    let match;
    CF_LINK.lastIndex = 0;
    while ((match = CF_LINK.exec(markdown))) {
      const k = key(match[1], match[2].toUpperCase());
      // A category can link the same problem twice; count it once.
      if (seen.has(k)) continue;
      seen.add(k);

      const entry = ensure(into, k);
      entry.sheets.push({
        sheet: sheet.id,
        group: category.replace(/^\d+\.\s*/, '').replace(/_/g, ' '),
        order: seen.size,
        note: '',
      });
      if (hint) entry.patternHints.push(hint);
      n += 1;
    }
  }
  return n;
}

/**
 * CP-31 — the one source with no contest ids.
 *
 * Matched on (normalised title, rating) against the problemset. The rating is
 * part of the key rather than a check afterwards, because Codeforces reuses
 * titles freely — there are several problems called "Two Arrays" — and the
 * rating band is what makes the pair almost always unique.
 *
 * Almost. Where a (title, rating) pair still matches more than one problem, the
 * match is dropped rather than guessed: a wrong contest id here would put a
 * reference solution on a different problem, which is worse than having none.
 * The count of those is reported, because a sudden jump means the matcher has
 * drifted and not that Codeforces changed.
 */
function parseCp31(into, problemset) {
  const file = readJson('cp-31.json');
  if (!file) return { matched: 0, ambiguous: 0, missed: 0 };
  const sheet = sheetById('cp-31');

  const byTitleRating = new Map();
  for (const p of problemset) {
    if (!p.rating) continue;
    const k = `${norm(p.name)}|${p.rating}`;
    if (!byTitleRating.has(k)) byTitleRating.set(k, []);
    byTitleRating.get(k).push(p);
  }

  let matched = 0;
  let ambiguous = 0;
  let missed = 0;

  for (const row of file.data) {
    const candidates = byTitleRating.get(`${norm(row.title)}|${row.rating}`) || [];
    if (candidates.length === 0) {
      missed += 1;
      continue;
    }
    if (candidates.length > 1) {
      ambiguous += 1;
      continue;
    }

    const p = candidates[0];
    const entry = ensure(into, key(p.contestId, p.index));
    entry.sheets.push({
      sheet: sheet.id,
      group: `Rating ${row.rating}`,
      order: row.order,
      note: `CP-31 · rating ${row.rating}, problem ${row.order} of 31`,
    });
    entry.solutions.push({
      lang: sheet.solutionLang,
      url: blobUrl(sheet.repo, sheet.ref, row.path),
      source: sheet.repo,
    });
    matched += 1;
  }

  return { matched, ambiguous, missed };
}

function ensure(map, k) {
  if (!map.has(k)) map.set(k, { sheets: [], patternHints: [], solutions: [] });
  return map.get(k);
}

/**
 * Everything the sheets know, keyed by `${contestId}:${index}`.
 *
 * `problemset` is needed only by the CP-31 matcher; the other two sources carry
 * their own ids.
 */
export function loadSheetIndex(problemset, { quiet = false } = {}) {
  const index = new Map();

  const ladders = parseLadders(index);
  const a2oj = parseA2oj(index);
  const cp31 = parseCp31(index, problemset);

  if (!quiet) {
    console.log(`  cf-ladders : ${ladders} rows`);
    console.log(`  a2oj       : ${a2oj} rows`);
    console.log(
      `  cp-31      : ${cp31.matched} matched, ${cp31.ambiguous} ambiguous, ${cp31.missed} unmatched`,
    );
    console.log(`  -> ${index.size} distinct problems mentioned by at least one sheet`);
  }

  return index;
}

/**
 * The pattern the sheets agree on, if they agree.
 *
 * A problem in both A2OJ's `dsu` and its `graphs` lists has two hints, and the
 * more specific one is the useful answer. "More specific" is approximated by
 * rarity — a hint that few problems carry is a narrower claim than one that
 * thousands do — which is computed across the whole index rather than guessed
 * per problem.
 */
export function resolveHints(index) {
  const frequency = new Map();
  for (const entry of index.values()) {
    for (const hint of entry.patternHints) frequency.set(hint, (frequency.get(hint) || 0) + 1);
  }

  for (const entry of index.values()) {
    if (!entry.patternHints.length) {
      entry.hint = null;
      continue;
    }
    entry.hint = [...new Set(entry.patternHints)].sort(
      (a, b) => (frequency.get(a) || 0) - (frequency.get(b) || 0),
    )[0];
  }
  return index;
}

/** The weight a problem earns from the sheets that mention it. */
export function sheetWeight(entry) {
  if (!entry) return 0;
  const byId = new Map();
  for (const s of entry.sheets) {
    // One mention per sheet counts; being in six A2OJ categories is not six
    // endorsements, it is one list being thorough.
    byId.set(s.sheet, Math.max(byId.get(s.sheet) || 0, 1));
  }
  let total = 0;
  for (const [id] of byId) total += sheetById(id)?.weight || 0;
  return total;
}

export const SHEET_IDS = SHEETS.map((s) => s.id);
