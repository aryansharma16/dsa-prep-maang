/**
 * Attaches reference solutions to ladder problems, from public solution repos.
 *
 *   npm run seed:cp:solutions
 *
 * What this is and is not. These are *other people's accepted submissions*, not
 * editorials and not reviewed code — the value is seeing a working
 * implementation after you have tried, which is a different thing from being
 * taught the idea. The editorial link already on most problems is the better
 * source and stays first; this fills the gap where there is no editorial at all.
 *
 * Which is why the whole step is additive and idempotent: it never removes a
 * solution, never overwrites the CP-31 links the curator already attached, and
 * de-duplicates by URL so re-running does not stack the same entry twice.
 *
 * Mapping, not searching. Every source here is included because its file paths
 * or its index table name a problem *identifier* — a Codeforces contest id and
 * index, or a CodeChef problem code. Repos that only name problems by title were
 * looked at and rejected: Codeforces titles repeat across contests, so a title
 * match produces confident links to the wrong problem, and a wrong solution link
 * is worse than no link because it is only discovered after you click it.
 */
import fs from 'node:fs';
import { CURATED_CP_PATH } from './sources.js';

/**
 * @typedef {object} Source
 * @property {string} repo       'owner/name'
 * @property {string} branch     the default branch, which is what raw serves
 * @property {'tree'|'readme'} kind how the problem identity is discovered
 * @property {(path: string) => {key: string, lang: string}|null} [match]
 */

/** Solution file extensions worth linking, mapped to the schema's languages. */
const LANGS = {
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  c: 'cpp',
  java: 'java',
  py: 'python',
};

const cfKey = (contestId, index) => `cf:${Number(contestId)}:${String(index).toUpperCase()}`;
const ccKey = (code) => `cc:${String(code).toUpperCase()}`;

const langOf = (path) => LANGS[path.split('.').pop()?.toLowerCase()] || null;

const SOURCES = [
  {
    repo: 'abeaumont/competitive-programming',
    branch: 'master',
    kind: 'tree',
    /*
      `codeforces/0001/a.py` — zero-padded contest directory, index as the file
      stem. The directory also holds `a-1.in` and `a-1.ans` test fixtures, which
      the extension check filters out on its own.
    */
    match: (p) => {
      const cf = p.match(/^codeforces\/(\d+)\/([a-z]\d*)\.([a-z]+)$/i);
      if (cf && langOf(p)) return { key: cfKey(cf[1], cf[2]), lang: langOf(p) };
      const cc = p.match(/^codechef\/[^/]+\/([a-z0-9_]+)\.([a-z]+)$/i);
      if (cc && langOf(p)) return { key: ccKey(cc[1]), lang: langOf(p) };
      return null;
    },
  },
  {
    repo: 'Erfaniaa/competitive-programming',
    branch: 'master',
    kind: 'tree',
    // `Codeforces/1001B-GenerateBellstate.cs`, `Codechef/ALGPRX.cpp`.
    match: (p) => {
      const cf = p.match(/^Codeforces\/(\d+)([A-Z]\d*)-.*\.([a-z]+)$/);
      if (cf && langOf(p)) return { key: cfKey(cf[1], cf[2]), lang: langOf(p) };
      const cc = p.match(/^Codechef\/([A-Za-z0-9_]+?)(?: \d+)?\.([a-z]+)$/);
      if (cc && langOf(p)) return { key: ccKey(cc[1]), lang: langOf(p) };
      return null;
    },
  },
  {
    repo: 'hhhrrrttt222111/CodeChef',
    branch: 'main',
    kind: 'tree',
    // `Beginner/A - Books (BIT2A)/books.cpp` — the code is in the parentheses.
    match: (p) => {
      const m = p.match(/\(([A-Z0-9_]{3,20})\)\/[^/]+\.([a-z]+)$/);
      return m && langOf(p) ? { key: ccKey(m[1]), lang: langOf(p) } : null;
    },
  },
  {
    repo: 'mhdnazrul/Codeforces-Solutions',
    branch: 'main',
    /*
      This one publishes an index instead: a README table whose first column is
      the problem id and whose last is a link to the file. Reading the table is
      more reliable than reading its own tree, because the files are named after
      the problem *title* and nothing else — `A_Boredom.cpp` cannot be resolved
      to contest 455 without the table.
    */
    kind: 'readme',
  },
];

async function githubJson(url) {
  const res = await fetch(url, {
    headers: {
      'user-agent': 'dsa-prep-seed',
      accept: 'application/vnd.github+json',
      // Lifts the rate limit from 60/hour to 5000 when one happens to be set.
      ...(process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Every solution file in a repo, as key -> [{lang, url}]. */
async function fromTree(source) {
  const data = await githubJson(
    `https://api.github.com/repos/${source.repo}/git/trees/${source.branch}?recursive=1`,
  );
  if (data.truncated) {
    // Worth saying out loud: a truncated tree looks exactly like a repo with
    // fewer solutions in it, and would silently under-attach for ever.
    console.warn(`  ! ${source.repo}: tree truncated by the API — some files not seen`);
  }

  const found = new Map();
  for (const node of data.tree || []) {
    if (node.type !== 'blob') continue;
    const hit = source.match(node.path);
    if (!hit) continue;
    if (!found.has(hit.key)) found.set(hit.key, []);
    found.get(hit.key).push({
      lang: hit.lang,
      url: `https://github.com/${source.repo}/blob/${source.branch}/${node.path
        .split('/')
        .map(encodeURIComponent)
        .join('/')}`,
    });
  }
  return found;
}

/** The same, from a README index table. */
async function fromReadme(source) {
  const res = await fetch(
    `https://raw.githubusercontent.com/${source.repo}/${source.branch}/README.md`,
    { headers: { 'user-agent': 'dsa-prep-seed' } },
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();

  const found = new Map();
  for (const line of text.split('\n')) {
    if (!line.trimStart().startsWith('|')) continue;
    // | 455A | A Boredom | 1500 | tags | [View](...) | [Code](https://github.com/...) |
    const id = line.match(/^\|\s*(\d+)([A-Z]\d*)\s*\|/);
    const url = line.match(/\[Code\]\((https:\/\/github\.com\/[^)\s]+)\)/);
    if (!id || !url) continue;
    const lang = langOf(url[1]);
    if (!lang) continue;
    const key = cfKey(id[1], id[2]);
    if (!found.has(key)) found.set(key, []);
    found.get(key).push({ lang, url: url[1] });
  }
  return found;
}

async function main() {
  if (!fs.existsSync(CURATED_CP_PATH)) {
    console.error(`[seed:cp:solutions] ${CURATED_CP_PATH} not found. Run: npm run seed:cp:curate`);
    process.exit(1);
  }

  const problems = JSON.parse(fs.readFileSync(CURATED_CP_PATH, 'utf8'));

  // The ladder, addressed the way the repos address it.
  const byKey = new Map();
  for (const problem of problems) {
    if (problem.codeforces) {
      byKey.set(cfKey(problem.codeforces.contestId, problem.codeforces.index), problem);
    } else if (problem.codechef?.code) {
      byKey.set(ccKey(problem.codechef.code), problem);
    }
  }
  console.log(`  ladder: ${byKey.size} addressable problems`);

  const before = problems.filter((p) => p.solutions?.length).length;
  let attached = 0;

  for (const source of SOURCES) {
    let found;
    try {
      found = source.kind === 'readme' ? await fromReadme(source) : await fromTree(source);
    } catch (error) {
      // One unreachable repo must not cost the run the other three.
      console.warn(`  ! ${source.repo}: ${error.message} — skipped`);
      continue;
    }

    let hits = 0;
    for (const [key, files] of found) {
      const problem = byKey.get(key);
      if (!problem) continue;

      problem.solutions ??= [];
      const seen = new Set(problem.solutions.map((s) => s.url));

      /*
        One per language per repo, at most.

        abeaumont keeps several attempts at the same problem in one directory
        and hhhrrrttt keeps six language ports of every solution, so an
        unfiltered attach puts nine links under a problem that needs one. The
        first is taken rather than the "best" because they are all accepted
        submissions by the same author — there is no quality axis to sort on.
      */
      const perLang = new Map();
      for (const file of files) if (!perLang.has(file.lang)) perLang.set(file.lang, file);

      for (const file of perLang.values()) {
        if (seen.has(file.url)) continue;
        problem.solutions.push({ lang: file.lang, url: file.url, source: source.repo });
        seen.add(file.url);
        attached += 1;
      }
      hits += 1;
    }
    console.log(`  ${source.repo.padEnd(46)} ${String(hits).padStart(4)} problems matched`);
  }

  const after = problems.filter((p) => p.solutions?.length).length;
  fs.writeFileSync(CURATED_CP_PATH, JSON.stringify(problems, null, 2));

  console.log(`\n  links attached:      ${attached}`);
  console.log(`  problems covered:    ${before} -> ${after} of ${problems.length}`);
  console.log(`\n  wrote ${CURATED_CP_PATH}`);
  console.log('  Next: npm run seed:cp:db');
}

main().catch((err) => {
  console.error('[seed:cp:solutions] failed:', err.message);
  process.exit(1);
});
