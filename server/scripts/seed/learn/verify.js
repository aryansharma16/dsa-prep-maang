/**
 * Proves the move was lossless.
 *
 *   npm run seed:learn:verify
 *
 * Reads the content tree and the database and compares them topic by topic,
 * block by block, field by field. This is the whole reason both copies exist at
 * once during the migration: once the client stops importing the modules, the
 * only answer to "did we lose a paragraph somewhere in the middle of the SQL
 * track" is a check that ran while both halves were still here.
 *
 * It compares *the fields the author wrote*, not whole documents. Mongoose fills
 * every optional field on the way in, so a heading arrives back carrying an
 * empty `items`, `rows`, `columns` and the rest; a deep equality against the
 * source would fail on all 5,495 blocks and prove nothing. What matters is the
 * other direction — that nothing an author typed came back different — and that
 * is what this walks.
 */
import { connectDb, disconnectDb } from '../../../src/config/db.js';
import { LearnTopic } from '../../../src/models/LearnTopic.js';
import { LearnTrack } from '../../../src/models/LearnTrack.js';
import { readTracks } from './index.js';

/** The fields each block type actually owns. Mirrors the zod union's members. */
const FIELDS = {
  heading: ['text'],
  paragraph: ['text'],
  bullets: ['items'],
  code: ['variants'],
  callout: ['text', 'tone'],
  table: ['columns', 'rows', 'caption', 'variant'],
  diagram: ['text', 'caption'],
  flow: ['items', 'caption'],
  image: ['url', 'text'],
  video: ['videoId', 'text'],
  links: ['links'],
};

/*
  Compared as JSON rather than field by field, deliberately.

  A block's leaves are strings, string arrays and arrays of arrays of strings —
  no numbers, no dates, nothing whose serialisation is lossy or ambiguous. So a
  stringify is an exact comparison here, and it catches the failure that a naive
  `===` per field would miss: a table row that came back with its cells in a
  different order, or one cell short.
*/
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

async function main() {
  const tracks = await readTracks();
  await connectDb();

  const problems = [];
  let topicsChecked = 0;
  let blocksChecked = 0;

  for (const { track, topics } of tracks) {
    const stored = await LearnTrack.findOne({ slug: track.slug }).lean();
    if (!stored) {
      problems.push(`track ${track.slug}: not in the database`);
      continue;
    }
    for (const field of ['name', 'hue', 'icon', 'status', 'order', 'blurb', 'summary']) {
      if (!same(stored[field], track[field])) {
        problems.push(`track ${track.slug}.${field}: '${stored[field]}' != '${track[field]}'`);
      }
    }
    if (!same(stored.sections.map((s) => [s.key, s.title, s.blurb, s.order]),
              track.sections.map((s) => [s.key, s.title, s.blurb, s.order]))) {
      problems.push(`track ${track.slug}: sections differ`);
    }

    for (const topic of topics) {
      const id = `${topic.track}/${topic.slug}`;
      const row = await LearnTopic.findOne({ track: topic.track, slug: topic.slug })
        .select('+plaintext')
        .lean();

      if (!row) {
        problems.push(`${id}: not in the database`);
        continue;
      }
      topicsChecked += 1;

      for (const field of ['section', 'order', 'status', 'title', 'summary', 'tags', 'ask']) {
        if (!same(row[field], topic[field])) problems.push(`${id}.${field} differs`);
      }
      for (const field of ['wordCount', 'readingMinutes', 'plaintext']) {
        if (!same(row[field], topic[field])) problems.push(`${id}.${field} differs`);
      }
      if (!same(row.related?.patterns || [], topic.related.patterns)) {
        problems.push(`${id}.related.patterns differs`);
      }

      if (row.blocks.length !== topic.blocks.length) {
        problems.push(`${id}: ${row.blocks.length} blocks stored, ${topic.blocks.length} authored`);
        continue;
      }

      topic.blocks.forEach((authored, i) => {
        blocksChecked += 1;
        const back = row.blocks[i];
        if (back.type !== authored.type) {
          problems.push(`${id} block ${i}: type ${back.type} != ${authored.type}`);
          return;
        }
        for (const field of FIELDS[authored.type] || []) {
          // Only what the author wrote. A table with no caption authored
          // nothing there, and the empty string Mongo defaulted to is correct.
          if (authored[field] === undefined) continue;
          if (!same(back[field], authored[field])) {
            problems.push(`${id} block ${i} (${authored.type}).${field} differs`);
          }
        }
      });
    }
  }

  const orphans = await LearnTopic.countDocuments({
    $nor: tracks.flatMap(({ topics }) =>
      topics.map((t) => ({ track: t.track, slug: t.slug })),
    ),
  });
  if (orphans) problems.push(`${orphans} topic(s) in the database are not in the content tree`);

  console.log(
    `\n[verify] ${topicsChecked} topics and ${blocksChecked} blocks compared against the database`,
  );
  if (problems.length) {
    console.error(`[verify] ${problems.length} difference(s):\n`);
    problems.slice(0, 40).forEach((p) => console.error(`  !!   ${p}`));
    await disconnectDb();
    process.exit(1);
  }
  console.log('[verify] every authored field round-trips. The move is lossless.');

  await disconnectDb();
}

main().catch(async (err) => {
  console.error('[verify] failed:', err.message);
  await disconnectDb().catch(() => {});
  process.exit(1);
});
