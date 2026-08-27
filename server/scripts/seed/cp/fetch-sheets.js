/**
 * Downloads the community problem sheets into server/data/raw/cp/sheets/.
 *
 * These are what turn a ratings sweep into a curriculum — see sheets.js for what
 * each source is and why it is weighted the way it is. Everything lands on disk
 * and is committed, so `seed:cp:curate` is a pure function of files rather than
 * of whatever GitHub was serving that afternoon.
 *
 *   npm run seed:cp:sheets
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { CP_RAW_DIR } from './sources.js';
import { SHEETS, rawUrl, treeUrl } from './sheets.js';

const SHEET_DIR = path.join(CP_RAW_DIR, 'sheets');

/*
  Unauthenticated GitHub is 60 requests an hour, and the A2OJ pull alone is 150
  files. A token lifts it to 5,000 — read-only, no scopes needed — and without
  one this script paces itself and says so rather than dying at request 61.
*/
const token = process.env.GITHUB_TOKEN || '';
const headers = {
  'user-agent': 'dsa-prep-cp-seed',
  accept: 'application/vnd.github+json',
  ...(token ? { authorization: `Bearer ${token}` } : {}),
};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, { json = false, tries = 3 } = {}) {
  for (let attempt = 1; ; attempt += 1) {
    const res = await fetch(url, { headers });
    if (res.ok) return json ? res.json() : res.text();

    // Secondary rate limit or a blip. Both are worth one more go.
    if (attempt < tries && (res.status === 403 || res.status === 429 || res.status >= 500)) {
      const reset = Number(res.headers.get('x-ratelimit-reset')) * 1000;
      const waitMs = reset && reset > Date.now() ? Math.min(reset - Date.now() + 1000, 60000) : attempt * 2000;
      console.warn(`  ! HTTP ${res.status} on ${url.slice(-60)} — waiting ${Math.round(waitMs / 1000)}s`);
      await wait(waitMs);
      continue;
    }
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
}

/** CP-31: the file tree *is* the data — rating, order, title and solution URL. */
async function fetchCp31(sheet) {
  const tree = await get(treeUrl(sheet.repo, sheet.ref), { json: true });
  const entries = (tree.tree || [])
    .filter((n) => n.type === 'blob' && n.path.endsWith('.cpp'))
    .map((n) => {
      // '1300/1300-7-Vasya and Golden Ticket.cpp'
      const file = n.path.split('/').pop().replace(/\.cpp$/, '');
      const match = file.match(/^(\d{3,4})-(\d+)-(.+)$/);
      if (!match) return null;
      return {
        rating: Number(match[1]),
        order: Number(match[2]),
        title: match[3].trim(),
        path: n.path,
      };
    })
    .filter(Boolean);

  if (!entries.length) throw new Error('CP-31 tree parsed to zero entries — did the layout change?');
  return entries.sort((a, b) => a.rating - b.rating || a.order - b.order);
}

/** A2OJ: one markdown table per category directory. */
async function fetchA2oj(sheet) {
  const tree = await get(treeUrl(sheet.repo, sheet.ref), { json: true });
  const files = (tree.tree || [])
    .filter((n) => n.type === 'blob' && n.path.startsWith(sheet.prefix) && n.path.endsWith('README.md'))
    .map((n) => n.path);

  const out = [];
  for (const [i, file] of files.entries()) {
    const category = file.slice(sheet.prefix.length).replace(/\/README\.md$/, '');
    try {
      out.push({ category, markdown: await get(rawUrl(sheet.repo, sheet.ref, file)) });
    } catch (err) {
      console.warn(`  ! skipped ${category}: ${err.message}`);
    }
    if (!token && i % 10 === 9) await wait(1000);
  }
  if (!out.length) throw new Error('A2OJ produced zero category files');
  return out;
}

/** Plain markdown files at known paths. */
async function fetchRawFiles(sheet) {
  const out = [];
  for (const file of sheet.files) {
    out.push({
      group: file.group,
      path: file.path,
      markdown: await get(rawUrl(sheet.repo, sheet.ref, file.path)),
    });
  }
  return out;
}

const FETCHERS = {
  'github-tree': fetchCp31,
  'github-tree-files': fetchA2oj,
  'raw-files': fetchRawFiles,
};

async function main() {
  await fs.mkdir(SHEET_DIR, { recursive: true });
  if (!token) {
    console.log('No GITHUB_TOKEN set — using the anonymous 60/hour limit and pacing accordingly.\n');
  }

  for (const sheet of SHEETS) {
    console.log(`Fetching ${sheet.label} (${sheet.repo})...`);
    const data = await FETCHERS[sheet.kind](sheet);
    const dest = path.join(SHEET_DIR, sheet.file || `${sheet.id}.json`);
    await fs.writeFile(dest, JSON.stringify({ sheet: sheet.id, repo: sheet.repo, ref: sheet.ref, data }, null, 0));
    console.log(`  ${data.length} entries -> ${path.basename(dest)}`);
  }

  console.log('\nNext: npm run seed:cp:codechef');
}

main().catch((err) => {
  console.error('[seed:cp:sheets] failed:', err.message);
  process.exit(1);
});
