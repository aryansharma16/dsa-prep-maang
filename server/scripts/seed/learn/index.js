import { summarise } from '../../../src/services/learn.content.js';
import { CONTENT_ROOT, TRACKS } from './tracks.js';

/**
 * Reads the Learn content tree into plain documents.
 *
 * The half of the seeder that knows about *files*. `learn.js` next door is the
 * half that knows about Mongo, and keeping them apart is what lets the whole
 * tree be validated — and compared against what came back out of the database —
 * without a connection open.
 *
 * Nothing here rewrites the content modules. A topic still exports
 * `doc = { blocks: [...] }` and a track index still exports
 * `{ title, summary, sections }` with a `load` thunk per topic, exactly as the
 * client bundle wrote them, because `() => import('./big-o.js')` works
 * unchanged under Node ESM. That was worth protecting: 170 dynamic imports cost
 * about a second on a laptop, and they buy a move of 1.9MB of prose with a
 * reviewable diff — one where "did we lose anything" is a question you can
 * actually answer.
 */

/** `[{ track, topics }]`, in the registry's order, with reading order resolved. */
export async function readTracks() {
  const out = [];

  for (const entry of TRACKS) {
    const index = await import(new URL(`${entry.slug}/index.js`, CONTENT_ROOT).href);

    const sections = (index.sections || []).map((section, i) => ({
      key: section.key,
      title: section.title,
      blurb: section.blurb || '',
      order: i,
    }));

    const track = {
      slug: entry.slug,
      name: entry.name,
      hue: entry.hue,
      icon: entry.icon,
      status: entry.status,
      order: entry.order,
      blurb: entry.blurb,
      // The track page's hero, which lives in the track's own index rather than
      // the registry. Falls back to the card's blurb rather than to nothing.
      summary: index.summary || entry.blurb || '',
      sections,
    };

    /*
      `order` is assigned here, from position, and never read off the content.

      It is two guarantees in one number: the sequence prev/next walks, and the
      sequence the section headings group. `flatTopics` used to make those agree
      by construction — it walked the very array the page rendered — and once
      the array is rows in a database, this counter is what replaces that.
      Authoring it by hand would be inviting exactly the drift it prevents.
    */
    let order = 0;
    const topics = [];

    for (const section of index.sections || []) {
      for (const topic of section.topics || []) {
        const module = await topic.load();
        const blocks = module.doc?.blocks;
        if (!Array.isArray(blocks)) {
          throw new Error(`${entry.slug}/${topic.slug}: module exports no doc.blocks`);
        }

        topics.push({
          track: entry.slug,
          slug: topic.slug,
          section: section.key,
          order: order++,
          status: 'live',
          title: topic.title,
          summary: topic.summary || '',
          tags: topic.tags || [],
          ask: topic.ask || [],
          blocks,
          related: {
            patterns: topic.related?.patterns || [],
            problems: topic.related?.problems || [],
          },
          ...summarise(blocks),
        });
      }
    }

    out.push({ track, topics });
  }

  return out;
}
