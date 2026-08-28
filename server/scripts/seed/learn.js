/**
 * Seeds the Learn tracks and topics into MongoDB.
 *
 *   npm run seed:learn
 *   npm run seed:learn -- --dry-run
 *   npm run seed:learn -- --force
 *
 * Independent of every other seeder, the way `seed:guides` is: Learn's prose
 * does not depend on the curation pass, and rewriting a paragraph should not
 * mean re-running a LeetCode fetch.
 *
 * A topic the admin panel has edited (`editedAt` set) keeps its words — with one
 * deliberate exception, described at `writeTopic` below, which is the only place
 * this seeder's contract differs from `seed:guides`. `--force` overrides the
 * lock and says so loudly.
 *
 * `--dry-run` reads and validates the whole tree without opening a connection.
 * That is the gate worth running first: everything that can be wrong about the
 * content is wrong before Mongo is involved.
 */
import { connectDb, disconnectDb } from '../../src/config/db.js';
import { LearnProgress } from '../../src/models/LearnProgress.js';
import { LearnTopic } from '../../src/models/LearnTopic.js';
import { LearnTrack } from '../../src/models/LearnTrack.js';
import { blocksField, checkTableArity } from '../../src/validation/blocks.js';
import { z } from 'zod';
import { readTracks } from './learn/index.js';
import { PATTERN_SLUGS } from './patterns.js';

const force = process.argv.includes('--force');
const dryRun = process.argv.includes('--dry-run');

const SLUG = /^[a-z0-9-]+$/;

/**
 * The same union the admin API validates a save against.
 *
 * Shared rather than re-stated, and that is the point: it makes *seedable* and
 * *editable* the same word. A topic this seeder writes but the editor would
 * refuse is a page that cannot be fixed from the panel, and nobody finds that
 * out until they try. Installing the check now costs nothing — all 5,495 blocks
 * pass it today — which is exactly when a check like this should go in.
 */
const topicBlocks = z
  .object({ blocks: blocksField })
  .superRefine((value, ctx) => checkTableArity(value.blocks, ctx));

/**
 * Everything that can be wrong about the content, found before connecting.
 *
 * Returns a list of complaints rather than throwing on the first, so one run
 * tells you everything to fix. An E11000 halfway through a write is a worse
 * error than a readable line before it starts.
 */
function validate(tracks) {
  const problems = [];
  const seenTracks = new Set();

  for (const { track, topics } of tracks) {
    if (!SLUG.test(track.slug)) problems.push(`track '${track.slug}': not a slug`);
    if (seenTracks.has(track.slug)) problems.push(`track '${track.slug}': duplicated`);
    seenTracks.add(track.slug);

    const sectionKeys = new Set(track.sections.map((s) => s.key));
    if (sectionKeys.size !== track.sections.length) {
      problems.push(`track '${track.slug}': two sections share a key`);
    }

    const seenTopics = new Set();
    for (const topic of topics) {
      const id = `${track.slug}/${topic.slug}`;
      if (!SLUG.test(topic.slug)) problems.push(`${id}: not a slug`);
      if (seenTopics.has(topic.slug)) problems.push(`${id}: duplicated within the track`);
      seenTopics.add(topic.slug);

      if (!topic.title?.trim()) problems.push(`${id}: no title`);
      // A section key that does not exist is a topic the track page cannot
      // group, so it renders under no heading at all rather than erroring.
      if (!sectionKeys.has(topic.section)) {
        problems.push(`${id}: section '${topic.section}' is not in this track`);
      }
      if (topic.ask.length > 3) problems.push(`${id}: ${topic.ask.length} ask questions, max 3`);

      const result = topicBlocks.safeParse({ blocks: topic.blocks });
      if (!result.success) {
        const issue = result.error.issues[0];
        problems.push(`${id}: blocks.${issue.path.join('.')} — ${issue.message}`);
      }

      /*
        A related pattern that is not a real pattern is a link the reader can
        click into nothing. Caught here rather than at render, the same way
        seed:guides catches a guide written for a pattern that does not exist.
      */
      for (const slug of topic.related.patterns) {
        if (!PATTERN_SLUGS.includes(slug)) problems.push(`${id}: unknown pattern '${slug}'`);
      }
    }

    /*
      The assertion that replaces `flatTopics`.

      Sorting by `order` has to produce contiguous runs matching section order —
      that is what makes "the list you see" and "the sequence prev/next walks"
      the same sequence. It cannot fail while order is assigned by the loop in
      learn/index.js, which is the point: this is here so it also cannot fail
      quietly if that ever stops being true.
    */
    const bySection = topics.map((t) => track.sections.findIndex((s) => s.key === t.section));
    for (let i = 1; i < bySection.length; i += 1) {
      if (bySection[i] < bySection[i - 1]) {
        problems.push(`track '${track.slug}': reading order crosses back into an earlier section`);
        break;
      }
    }
  }

  return problems;
}

/**
 * Writes one topic, splitting what a human owns from what the curriculum owns.
 *
 * This is the one place the contract differs from `seed:guides`, and the
 * difference is load-bearing. A guide has no position — there is one per
 * pattern and nothing moves. A topic sits at a place in a reading order, and if
 * someone edits topic 12 in the panel and a new topic is later inserted above
 * it, a locked `order` leaves the sequence broken for every reader with nothing
 * reporting it. Prev/next would skip a page and the section counts would drift.
 *
 * So: a human who edits a topic edited its *prose*. Where it sits in the
 * curriculum stays the seed file's business, and is rewritten every run.
 */
async function writeTopic(topic, existing) {
  const locked = Boolean(existing?.editedAt) && !force;

  const structural = {
    section: topic.section,
    order: topic.order,
    seededAt: new Date(),
  };

  const content = {
    title: topic.title,
    summary: topic.summary,
    tags: topic.tags,
    ask: topic.ask,
    blocks: topic.blocks,
    related: topic.related,
    plaintext: topic.plaintext,
    wordCount: topic.wordCount,
    readingMinutes: topic.readingMinutes,
    status: topic.status,
  };

  const set = locked ? structural : { ...structural, ...content };
  // A forced re-seed hands the topic back to the content files.
  if (force && existing?.editedAt) set.editedAt = null;

  await LearnTopic.findOneAndUpdate(
    { track: topic.track, slug: topic.slug },
    {
      $set: set,
      $inc: { version: 1 },
      $setOnInsert: { track: topic.track, slug: topic.slug },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  return locked;
}

async function main() {
  console.log('[seed:learn] reading the content tree...');
  const tracks = await readTracks();

  const problems = validate(tracks);
  if (problems.length) {
    console.error(`\n[seed:learn] ${problems.length} problem(s), nothing written:\n`);
    problems.forEach((p) => console.error(`  !!   ${p}`));
    process.exit(1);
  }

  const allTopics = tracks.flatMap((t) => t.topics);
  const totals = {
    tracks: tracks.length,
    sections: tracks.reduce((n, t) => n + t.track.sections.length, 0),
    topics: allTopics.length,
    blocks: allTopics.reduce((n, t) => n + t.blocks.length, 0),
    words: allTopics.reduce((n, t) => n + t.wordCount, 0),
  };

  if (dryRun) {
    console.log(
      `\n[seed:learn] --dry-run: ${totals.tracks} tracks, ${totals.sections} sections, ` +
        `${totals.topics} topics, ${totals.blocks} blocks, ${totals.words.toLocaleString()} words`,
    );
    console.log('[seed:learn] every block validates. Nothing written, no connection opened.');
    return;
  }

  await connectDb();
  if (force) console.warn('[seed:learn] --force: hand-edited topics will be overwritten\n');

  let written = 0;
  let skipped = 0;

  for (const { track, topics } of tracks) {
    const existingTrack = await LearnTrack.findOne({ slug: track.slug }).select('editedAt').lean();
    const trackLocked = Boolean(existingTrack?.editedAt) && !force;

    await LearnTrack.findOneAndUpdate(
      { slug: track.slug },
      {
        $set: {
          // A track's sections are its structure, so they are rewritten even
          // when its blurb has been edited — the same split as a topic's.
          sections: track.sections,
          order: track.order,
          status: track.status,
          hue: track.hue,
          icon: track.icon,
          seededAt: new Date(),
          ...(trackLocked
            ? {}
            : { name: track.name, blurb: track.blurb, summary: track.summary }),
          ...(force && existingTrack?.editedAt ? { editedAt: null } : {}),
        },
        $setOnInsert: { slug: track.slug },
      },
      { upsert: true, setDefaultsOnInsert: true },
    );

    const existing = Object.fromEntries(
      (await LearnTopic.find({ track: track.slug }).select('slug editedAt').lean()).map((t) => [
        t.slug,
        t,
      ]),
    );

    for (const topic of topics) {
      const locked = await writeTopic(topic, existing[topic.slug]);
      if (locked) {
        skipped += 1;
        const when = existing[topic.slug].editedAt.toISOString().slice(0, 10);
        console.warn(`  --   ${`${topic.track}/${topic.slug}`.padEnd(34)} edited ${when}, prose kept`);
      } else {
        written += 1;
        console.log(
          `  ok   ${`${topic.track}/${topic.slug}`.padEnd(34)} ` +
            `${String(topic.blocks.length).padStart(3)} blocks ` +
            `${String(topic.wordCount).padStart(5)} words ${String(topic.readingMinutes).padStart(2)} min`,
        );
      }
    }

    /*
      Prune only what the seeder still owns.

      A topic no longer in the content files and never hand-edited is gone on
      purpose. One that *was* edited is somebody's writing, and deleting it
      because it fell out of an index file is not a decision a script should
      make on its own — it is reported instead. The same three-way rule the SQL
      seeder uses.
    */
    const wanted = new Set(topics.map((t) => t.slug));
    const stale = Object.values(existing).filter((t) => !wanted.has(t.slug));
    const removable = stale.filter((t) => !t.editedAt);

    if (removable.length) {
      await LearnTopic.deleteMany({
        track: track.slug,
        slug: { $in: removable.map((t) => t.slug) },
      });
      console.warn(`  rm   ${track.slug}: ${removable.map((t) => t.slug).join(', ')}`);
    }
    for (const orphan of stale.filter((t) => t.editedAt)) {
      console.warn(`  ??   ${track.slug}/${orphan.slug} is edited but no longer in the index — kept`);
    }
  }

  console.log(
    `\n[seed:learn] ${written} written, ${skipped} kept · ${totals.tracks} tracks, ` +
      `${totals.sections} sections, ${totals.topics} topics, ${totals.blocks} blocks, ` +
      `${totals.words.toLocaleString()} words`,
  );

  /*
    Reading progress is keyed on slugs and is deliberately never cascaded into
    — see LearnProgress. So a renamed topic leaves rows pointing at a slug that
    no longer exists: harmless, because the queue simply never surfaces them,
    and invisible unless something says so. This is the something.
  */
  const live = new Set(allTopics.map((t) => `${t.track}/${t.slug}`));
  const rows = await LearnProgress.aggregate([
    { $group: { _id: { track: '$track', topic: '$topic' }, n: { $sum: 1 } } },
  ]);
  const orphaned = rows.filter((r) => !live.has(`${r._id.track}/${r._id.topic}`));
  if (orphaned.length) {
    const list = orphaned.map((r) => `${r._id.track}/${r._id.topic} (×${r.n})`).join(', ');
    console.warn(`[seed:learn] progress rows point at slugs that no longer exist: ${list}`);
  }

  await disconnectDb();
}

main().catch(async (err) => {
  console.error('[seed:learn] failed:', err.message);
  await disconnectDb().catch(() => {});
  process.exit(1);
});
