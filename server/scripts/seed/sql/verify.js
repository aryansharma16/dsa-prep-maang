import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import initSqlJs from 'sql.js';
import { compareResults } from '../../../../client/src/sql/compare.js';
import { createDb, runQuery } from '../../../../client/src/sql/run.js';
import {
  SQL_CATEGORY_SLUGS,
  SQL_DIFFICULTY_SLUGS,
  SQL_MODE_SLUGS,
} from '../../../src/config/sqlCategories.js';
import { sqlProblems } from './problems/index.js';

/**
 * Run every reference solution, write down what it returned, and refuse to
 * proceed if anything is wrong.
 *
 * ---------------------------------------------------------------------------
 * Two kinds of problem, and the checks are not the same shape.
 *
 * An `editor` problem is executed: its setup runs, its solution runs, and what
 * came back becomes the expected grid. An `external` one has no SQL to execute
 * — it is a link to a judge — so what is checked instead is that the link is
 * actually there and actually unique, and that the row is not carrying
 * half-written SQL nobody will ever run.
 *
 * The `external` checks are deliberately *exclusive* as well as inclusive: a
 * `setupSql` on a linked problem fails the seed rather than being ignored,
 * because a field that is silently dropped is how a problem ends up authored
 * twice, in two places, with the two halves disagreeing.
 * ---------------------------------------------------------------------------
 *
 * ---------------------------------------------------------------------------
 * The expected output is generated, never typed.
 *
 * A hand-written expected grid is a second opinion about the answer, and the
 * two opinions disagree eventually — at which point the Lab tells a reader with
 * a correct query that they are wrong, which is the one failure that makes the
 * whole module untrustworthy. So the reference solution is run here, against
 * the same sql.js build and the same shims the browser uses, and whatever comes
 * back *is* the expected result.
 *
 * That closes one hole and opens another, which is what `expectRows` is for:
 * running the solution proves it **runs**, not that it answers the **question**.
 * A subtly wrong solution would quietly become a subtly wrong expectation. So
 * every problem carries a hand-written row count, and this script fails if the
 * two disagree. It is the cheapest assertion that catches the expensive mistake.
 * ---------------------------------------------------------------------------
 *
 * The sample tables shown beside the statement are generated here too, by
 * reading the database back after the setup has run. They were briefly a
 * hand-written field on the problem and that was worse: the same rows written
 * twice, drifting the first time someone edited the DDL and not the display.
 *
 *   npm run seed:sql:verify
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(HERE, '../../../data/sql');
const OUT_PATH = path.join(OUT_DIR, 'curated-sql.json');

/** How many rows of each table are shown beside the statement. */
const PREVIEW_ROWS = 12;

const pass = (label, detail) =>
  console.log(`  ${'PASS'.padEnd(6)} ${label}${detail ? ` — ${detail}` : ''}`);
const fail = (label, detail) =>
  console.log(`  ${'FAIL'.padEnd(6)} ${label}${detail ? ` — ${detail}` : ''}`);

const problems = [];
const record = (slug, detail, hint) => {
  fail(slug, detail);
  problems.push({ slug, hint });
};

/* -------------------------------------------------------------------------- */
/* structural checks, before anything is executed                              */
/* -------------------------------------------------------------------------- */

console.log(`\nSQL Lab — verifying ${sqlProblems.length} problems\n`);

/** Everything needs these, whichever kind it is. */
const REQUIRED = ['slug', 'title', 'statement', 'category', 'difficulty'];

/** And a Lab problem needs the two that make it runnable. */
const REQUIRED_IN_THE_LAB = ['setupSql', 'solutionSql'];

/**
 * Fields an external problem must NOT carry.
 *
 * Not tidiness. A linked problem with a `setupSql` is a problem somebody began
 * authoring locally and then linked instead, and leaving the fragment in place
 * means the next person to read the file cannot tell which half is the truth.
 */
const FORBIDDEN_WHEN_EXTERNAL = ['setupSql', 'solutionSql', 'checkSql'];

const isExternal = (p) => p.mode === 'external';

const seen = new Set();
/* One problem per destination, and per LeetCode id — see the dedupe pass below. */
const seenUrl = new Map();
const seenLcId = new Map();
let structural = 0;

for (const p of sqlProblems) {
  const missing = [
    ...REQUIRED,
    ...(isExternal(p) ? [] : REQUIRED_IN_THE_LAB),
  ].filter((k) => !p[k]);
  if (missing.length) {
    record(p.slug || '(no slug)', `missing: ${missing.join(', ')}`);
    structural += 1;
    continue;
  }

  if (p.mode && !SQL_MODE_SLUGS.includes(p.mode)) {
    record(p.slug, `unknown mode "${p.mode}"`, `one of: ${SQL_MODE_SLUGS.join(', ')}`);
    structural += 1;
  }

  if (isExternal(p)) {
    const stray = FORBIDDEN_WHEN_EXTERNAL.filter((k) => p[k]);
    if (stray.length) {
      record(
        p.slug,
        `external problem carries: ${stray.join(', ')}`,
        'either drop the SQL, or drop the mode and finish authoring it here',
      );
      structural += 1;
    }
    if (!p.source?.platform) {
      record(p.slug, 'external problem with no source.platform');
      structural += 1;
    }
    if (!/^https:\/\/\S+$/.test(p.source?.url || '')) {
      record(p.slug, `external problem with no usable source.url: ${p.source?.url || '(none)'}`);
      structural += 1;
    }
  }

  /*
    The dedupe pass, and it is the check this whole import needed.

    Five of the SQL 50 were authored locally before the plan was imported, and
    the importer skips their ids. If that skip list ever falls out of step with
    the files, the bank grows a second copy of Big Countries — one you solve
    here and one that sends you to LeetCode — and nothing else in the pipeline
    would notice, because the two have different slugs.
  */
  const lcId = p.source?.lcId;
  if (lcId) {
    if (seenLcId.has(lcId)) {
      record(
        p.slug,
        `LeetCode ${lcId} is already in the bank as "${seenLcId.get(lcId)}"`,
        'one problem per id — either drop this row or take the other one out',
      );
      structural += 1;
    } else seenLcId.set(lcId, p.slug);
  }

  /*
    Destinations are unique; credits are not. Two linked problems pointing at
    one URL means one of them is unreachable, which is a bug. Two *local*
    problems crediting the same repository is just two problems whose shape came
    off the same list, which is ordinary — so this only applies to link-outs.
  */
  const url = p.source?.url;
  if (isExternal(p) && url) {
    const key = url.replace(/\/+$/, '');
    if (seenUrl.has(key)) {
      record(p.slug, `links to the same URL as "${seenUrl.get(key)}"`);
      structural += 1;
    } else seenUrl.set(key, p.slug);
  }

  if (!/^[a-z0-9-]+$/.test(p.slug)) {
    record(p.slug, 'slug must be kebab-case');
    structural += 1;
  }
  if (seen.has(p.slug)) {
    record(p.slug, 'duplicate slug — two problems cannot share one');
    structural += 1;
  }
  seen.add(p.slug);

  if (!SQL_CATEGORY_SLUGS.includes(p.category)) {
    record(p.slug, `unknown category "${p.category}"`, `one of: ${SQL_CATEGORY_SLUGS.join(', ')}`);
    structural += 1;
  }
  if (!SQL_DIFFICULTY_SLUGS.includes(p.difficulty)) {
    record(p.slug, `unknown difficulty "${p.difficulty}"`);
    structural += 1;
  }
  if (p.learnTopic && !p.learnTopic.startsWith('sql/')) {
    record(p.slug, `learnTopic should look like "sql/<slug>", got "${p.learnTopic}"`);
    structural += 1;
  }
}

if (structural) {
  console.log(`\n${structural} structural problem(s) — nothing was executed.\n`);
  process.exit(1);
}
const externalCount = sqlProblems.filter(isExternal).length;
pass(
  'structure',
  `${sqlProblems.length} problems, ${seen.size} unique slugs, ` +
    `${sqlProblems.length - externalCount} runnable here, ${externalCount} linked out`,
);

/* -------------------------------------------------------------------------- */
/* execute                                                                     */
/* -------------------------------------------------------------------------- */

const SQL = await initSqlJs();
pass('sql.js', 'the same build the browser runs');
console.log('');

/** The tables a problem's setup created, with a few rows of each, for display. */
function readTables(db) {
  const listed = runQuery(
    db,
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY rootpage;",
  );
  if (!listed) return [];

  return listed.values.map(([name]) => {
    const rows = runQuery(db, `SELECT * FROM "${name}" LIMIT ${PREVIEW_ROWS + 1};`);
    const shown = (rows?.values || []).slice(0, PREVIEW_ROWS);
    return {
      name,
      columns: rows?.columns || [],
      /*
        Stringified for display, and `NULL` spelled out rather than left blank —
        an empty cell reads as "we did not bother", which is the one thing NULL
        never means. The same convention the Learn track's tables use.
      */
      rows: shown.map((row) => row.map((v) => (v === null ? 'NULL' : String(v)))),
      truncated: (rows?.values.length || 0) > PREVIEW_ROWS,
    };
  });
}

const curated = [];
const perCategory = new Map();

/** `categoryOrder`, assigned in file order within each category. */
const nextOrder = (category) => {
  const order = (perCategory.get(category) || 0) + 1;
  perCategory.set(category, order);
  return order;
};

for (const p of sqlProblems) {
  /*
    Nothing to execute, so nothing to generate: a linked problem's answer lives
    on the judge it points at. It still gets a `categoryOrder` from the same
    counter as everything else, because it sits in the same table under the same
    heading — the only thing it does not get is an expected grid.
  */
  if (isExternal(p)) {
    curated.push({
      ...p,
      mode: 'external',
      categoryOrder: nextOrder(p.category),
      tables: [],
      expected: { columns: [], rows: [] },
      expectRows: -1,
      hints: p.hints || [],
      topicTags: p.topicTags || [],
      source: p.source || {},
      orderMatters: false,
      setupSql: '',
      solutionSql: '',
      checkSql: '',
      dialectNote: p.dialectNote || '',
      explanation: p.explanation || '',
      learnTopic: p.learnTopic || '',
      score: p.score ?? 0,
    });
    pass(p.slug, `→ ${p.source.platform}`);
    continue;
  }

  let db;
  try {
    db = createDb(SQL, p.setupSql);
  } catch (error) {
    record(p.slug, error.message, 'the setup SQL does not run');
    continue;
  }

  const tables = readTables(db);
  if (!tables.length) {
    record(p.slug, 'the setup created no tables');
    db.close();
    continue;
  }

  let expected;
  try {
    /* The reader's statements run first; a check query, where there is one, decides. */
    let out = runQuery(db, p.solutionSql);
    if (p.checkSql?.trim()) out = runQuery(db, p.checkSql);
    expected = out;
  } catch (error) {
    record(p.slug, error.message, 'the reference solution does not run');
    db.close();
    continue;
  } finally {
    db.close();
  }

  if (!expected) {
    record(
      p.slug,
      'the reference solution returned no rows at all',
      p.checkSql ? 'the checkSql returned nothing' : 'a problem with no checkSql must end in a SELECT',
    );
    continue;
  }

  /*
    The hand-written count against the generated one. This is the assertion that
    catches a solution which runs and answers the wrong question — the one
    failure generating the expectation cannot see.
  */
  if (p.expectRows >= 0 && expected.values.length !== p.expectRows) {
    record(
      p.slug,
      `expectRows says ${p.expectRows}, the solution returned ${expected.values.length}`,
      'either the solution is wrong or the count is — check the statement decides which',
    );
    continue;
  }

  /*
    A determinism check, and it is not paranoia: a solution whose row order
    varies between runs would produce an expectation that only matches
    sometimes. Running it twice against a fresh database catches an ORDER BY
    that does not fully determine the order, which on a problem marked
    `orderMatters` would fail correct answers at random.
  */
  if (p.orderMatters) {
    const db2 = createDb(SQL, p.setupSql);
    let again = runQuery(db2, p.solutionSql);
    if (p.checkSql?.trim()) again = runQuery(db2, p.checkSql);
    db2.close();
    if (!compareResults(again, expected, { orderMatters: true }).pass) {
      record(
        p.slug,
        'the reference solution is not order-stable across runs',
        'orderMatters is set but the ORDER BY does not fully determine the order — add a tiebreak',
      );
      continue;
    }
  }

  curated.push({
    ...p,
    mode: 'editor',
    categoryOrder: nextOrder(p.category),
    tables,
    expected: { columns: expected.columns, rows: expected.values },
    expectRows: expected.values.length,
    hints: p.hints || [],
    topicTags: p.topicTags || [],
    source: p.source || {},
    orderMatters: Boolean(p.orderMatters),
    checkSql: p.checkSql || '',
    dialectNote: p.dialectNote || '',
    explanation: p.explanation || '',
    learnTopic: p.learnTopic || '',
    score: p.score ?? 0,
  });

  pass(p.slug, `${expected.values.length} row${expected.values.length === 1 ? '' : 's'} × ${expected.columns.length}`);
}

/* -------------------------------------------------------------------------- */
/* report and write                                                            */
/* -------------------------------------------------------------------------- */

console.log('');

if (problems.length) {
  console.log(`${problems.length} problem(s) failed. Nothing was written.\n`);
  for (const { slug, hint } of problems) {
    console.log(`  ${slug}`);
    if (hint) console.log(`      likely: ${hint}`);
  }
  console.log('');
  process.exit(1);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify(curated, null, 0));

const byCategory = [...perCategory.entries()].sort();
const linked = curated.filter((p) => p.mode === 'external').length;
console.log(`${curated.length} problems verified and written to data/sql/curated-sql.json`);
console.log(`  ${curated.length - linked} run here · ${linked} link out\n`);
for (const [category, n] of byCategory) console.log(`  ${String(n).padStart(3)}  ${category}`);
console.log('');
process.exit(0);
