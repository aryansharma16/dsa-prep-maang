/**
 * Downloads the Codeforces problemset and contest list into server/data/raw/cp/
 * so the rest of the CP seed runs offline and reproducibly.
 *
 * Commit what this writes — it is the snapshot the curated ladder was built
 * from, and it is what makes `seed:cp:curate` a pure function of files on disk
 * rather than of whatever Codeforces happened to be serving that afternoon.
 *
 *   npm run seed:cp:fetch
 */
import fs from 'node:fs/promises';
import { fetchContests, fetchProblemset } from '../../../src/services/cp/codeforces.service.js';
import { CF_CONTESTS_PATH, CF_PROBLEMSET_PATH, CP_RAW_DIR } from './sources.js';

async function main() {
  await fs.mkdir(CP_RAW_DIR, { recursive: true });

  console.log('Fetching Codeforces problemset (~11,000 problems)...');
  const problems = await fetchProblemset();
  if (problems.length < 5000) {
    // A short answer here is not a small problemset, it is a truncated download.
    // Writing it would silently halve the ladder on the next curate.
    throw new Error(`Only ${problems.length} problems returned — refusing to write a partial snapshot`);
  }
  await fs.writeFile(CF_PROBLEMSET_PATH, JSON.stringify(problems, null, 0));
  const rated = problems.filter((p) => p.rating).length;
  console.log(`  ${problems.length} problems (${rated} rated) -> ${CF_PROBLEMSET_PATH}`);

  console.log('Fetching Codeforces contest list...');
  const contests = await fetchContests();
  if (contests.length < 1000) {
    throw new Error(`Only ${contests.length} contests returned — refusing to write a partial snapshot`);
  }
  await fs.writeFile(CF_CONTESTS_PATH, JSON.stringify(contests, null, 0));
  console.log(`  ${contests.length} contests -> ${CF_CONTESTS_PATH}`);

  console.log('\nNext: npm run seed:cp:curate -- --dry');
}

main().catch((err) => {
  console.error('[seed:cp:fetch] failed:', err.message);
  process.exit(1);
});
