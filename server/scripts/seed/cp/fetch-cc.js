/**
 * Downloads the rated CodeChef problemset into server/data/raw/cp/codechef.json.
 *
 * CodeChef publishes no documented API, but codechef.com/practice paints its own
 * table from `/api/list/problems`, which needs no key and answers with real
 * difficulty ratings and submission counts. Sweeping it by rating band is what
 * makes it usable: there are ~21,500 problems in the index and only ~4,000 carry
 * a rating at all, so the band parameters filter and paginate at once.
 *
 * Two things about that endpoint are worth knowing before editing this file:
 *
 *  - `offset` is accepted and silently ignored. The obvious loop returns page
 *    one forever and looks like it is working. `page` is the real knob, and it
 *    is **zero-based**: the server computes the offset as `page * limit`, so
 *    starting at 1 silently skips the first `limit` rows of every band. That is
 *    invisible at limit=20 and drops two thirds of the data at limit=100, which
 *    is exactly the sort of bug that ships.
 *  - Unrated problems come back as `difficulty_rating: "-1"` and problems whose
 *    rating has not settled come back as `"9999"`. Both are sentinels, not
 *    ratings, and both are dropped here rather than in the curator.
 *
 *   npm run seed:cp:codechef
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { CP_RAW_DIR } from './sources.js';
import {
  CC_BANDS,
  CC_LIST_URL,
  CC_PROBLEM_URL,
  CC_SHORTLIST_FACTOR,
  ccEditorialUrl,
  ccScore,
} from './sheets.js';

const DEST = path.join(CP_RAW_DIR, 'codechef.json');
const PAGE_SIZE = 200;
/** Courtesy pacing. Nothing documents a limit, so do not go looking for one. */
const GAP_MS = 400;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function page(min, max, pageNo) {
  const url =
    `${CC_LIST_URL}?limit=${PAGE_SIZE}&page=${pageNo}` +
    `&start_rating=${min}&end_rating=${max}&sort_by=difficulty_rating&sort_order=asc`;

  const res = await fetch(url, {
    headers: { 'user-agent': 'Mozilla/5.0', accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for band ${min}-${max} page ${pageNo}`);

  const body = await res.json();
  if (body.status && body.status !== 'success') {
    throw new Error(`CodeChef refused band ${min}-${max}: ${body.message || body.status}`);
  }
  return { rows: body.data || [], total: Number(body.count) || 0 };
}

async function band(min, max) {
  const seen = new Map();
  // Zero-based — see the header. Page 1 is the *second* chunk.
  let pageNo = 0;
  let total = Infinity;

  while (seen.size < total) {
    const { rows, total: count } = await page(min, max, pageNo);
    total = count;
    if (!rows.length) break;

    const before = seen.size;
    for (const row of rows) {
      const rating = Number(row.difficulty_rating);
      // Sentinels, not ratings. See the header.
      if (!Number.isFinite(rating) || rating <= 0 || rating >= 9000) continue;
      seen.set(row.code, {
        code: row.code,
        name: row.name,
        rating,
        totalSubmissions: Number(row.total_submissions) || 0,
        successfulSubmissions: Number(row.successful_submissions) || 0,
        distinctSolvers: Number(row.distinct_successful_submissions) || 0,
        contestCode: row.contest_code || '',
      });
    }

    // A page that adds nothing new means pagination has stopped advancing —
    // bail rather than spin, which is the failure mode `offset` produces.
    if (seen.size === before) break;
    pageNo += 1;
    await wait(GAP_MS);
  }

  return [...seen.values()];
}

/**
 * One problem's detail record — tags, editorial, author.
 *
 * The list endpoint carries no tags at all, and without tags every CodeChef
 * problem in a tier would have to be filed under one pattern, which is how the
 * first version of this ended up with fifty problems under "Greedy" that nobody
 * had claimed were greedy. `user_tags` is the community's topic labelling and
 * `computed_tags` is CodeChef's own coarse bucket; both are kept because
 * neither is reliably populated on its own.
 *
 * Resolves to null on failure rather than throwing. A problem whose detail we
 * could not fetch is still a usable row — it just has no tags — and one 404 on
 * a retired problem should not lose the other 299.
 */
async function detail(code) {
  try {
    const res = await fetch(CC_PROBLEM_URL(code), {
      headers: { 'user-agent': 'Mozilla/5.0', accept: 'application/json' },
    });
    if (!res.ok) return null;
    const body = await res.json();
    if (!body?.problem_code) return null;

    return {
      tags: [
        ...new Set(
          [...(body.user_tags || []), ...(body.computed_tags || [])]
            .map((t) => String(t).trim())
            .filter(Boolean),
        ),
      ],
      bestTag: body.best_tag || '',
      category: body.category_name || '',
      contestCode: body.intended_contest_code || '',
      editorialUrl: ccEditorialUrl(body.text_editorial_topic_id),
      videoEditorialUrl: body.video_editorial_url || '',
      author: body.problem_author || '',
    };
  } catch {
    return null;
  }
}

async function main() {
  await fs.mkdir(CP_RAW_DIR, { recursive: true });

  const all = new Map();
  const shortlist = [];

  for (const b of CC_BANDS) {
    const rows = await band(b.min, b.max);
    for (const row of rows) all.set(row.code, row);

    // Only the plausible picks get a detail request — 4,000 of them would be an
    // hour of politeness for data the curator throws away.
    const take = Math.ceil(b.keep * CC_SHORTLIST_FACTOR);
    shortlist.push(
      ...rows
        .filter((p) => p.totalSubmissions >= 200 && p.distinctSolvers >= 50)
        .sort((x, y) => ccScore(y) - ccScore(x))
        .slice(0, take),
    );
    console.log(`  ${b.min}-${b.max}: ${rows.length} rated, ${Math.min(take, rows.length)} shortlisted`);
  }

  console.log(`\nEnriching ${shortlist.length} shortlisted problems with tags and editorials...`);
  let enriched = 0;
  for (const [i, p] of shortlist.entries()) {
    const info = await detail(p.code);
    if (info) {
      Object.assign(all.get(p.code), info);
      enriched += 1;
    }
    if (i % 50 === 49) console.log(`  ${i + 1}/${shortlist.length}`);
    await wait(GAP_MS);
  }
  console.log(`  ${enriched}/${shortlist.length} enriched`);

  const list = [...all.values()].sort((a, b) => a.rating - b.rating || a.code.localeCompare(b.code));
  if (list.length < 500) {
    throw new Error(`Only ${list.length} CodeChef problems — refusing to write a partial snapshot`);
  }

  await fs.writeFile(DEST, JSON.stringify(list, null, 0));
  console.log(`\n${list.length} rated CodeChef problems -> ${DEST}`);
  console.log('Next: npm run seed:cp:curate -- --dry');
}

main().catch((err) => {
  console.error('[seed:cp:codechef] failed:', err.message);
  process.exit(1);
});
