/**
 * Downloads every upstream source into server/data/raw/ so the rest of the seed
 * runs offline and reproducibly. Commit data/raw — it is the snapshot the
 * curated list was built from.
 *
 *   npm run seed:fetch
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  ALL_COMPANIES,
  COMPANY_BASE,
  LEETCODE_ALL_URL,
  NEETCODE_URL,
  RAW_DIR,
  STRIVER_SDE_URL,
} from './sources.js';

async function download(url, dest, { optional = false } = {}) {
  const res = await fetch(url, { headers: { 'user-agent': 'dsa-prep-seed' } });
  if (!res.ok) {
    if (optional) {
      console.warn(`  ! skipped ${path.basename(dest)} (HTTP ${res.status})`);
      return false;
    }
    throw new Error(`Failed ${url}: HTTP ${res.status}`);
  }
  const body = await res.text();
  if (!body.trim()) {
    if (optional) {
      console.warn(`  ! skipped ${path.basename(dest)} (empty)`);
      return false;
    }
    throw new Error(`Empty response from ${url}`);
  }
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, body);
  return true;
}

async function main() {
  await fs.mkdir(RAW_DIR, { recursive: true });

  console.log('Fetching LeetCode problem index (~4000 problems)...');
  await download(LEETCODE_ALL_URL, path.join(RAW_DIR, 'leetcode-all.json'));

  console.log('Fetching NeetCode 150/250/All list...');
  await download(NEETCODE_URL, path.join(RAW_DIR, 'neetcode.json'));

  console.log("Fetching Striver's SDE Sheet (191 problems)...");
  await download(STRIVER_SDE_URL, path.join(RAW_DIR, 'striver-sde.json'));

  console.log(`Fetching company tags for ${ALL_COMPANIES.length} companies...`);
  let ok = 0;
  for (const company of ALL_COMPANIES) {
    const url = `${COMPANY_BASE}/${encodeURIComponent(company)}/5.%20All.csv`;
    const written = await download(url, path.join(RAW_DIR, 'companies', `${company}.csv`), {
      optional: true,
    });
    if (written) ok += 1;
  }
  console.log(`  ${ok}/${ALL_COMPANIES.length} company files saved`);

  console.log(`\nDone. Raw sources in ${RAW_DIR}`);
  console.log('Next: npm run seed:curate');
}

main().catch((err) => {
  console.error('[seed:fetch] failed:', err.message);
  process.exit(1);
});
