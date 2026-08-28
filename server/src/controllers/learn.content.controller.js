import { z } from 'zod';
import { LearnTopic } from '../models/LearnTopic.js';
import { LearnTrack } from '../models/LearnTrack.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { memoize, precondition } from '../utils/httpCache.js';

/**
 * Learn's content, as an API.
 *
 * Two endpoints, and the split between them is the whole design: one response
 * carries everything needed to *list* Learn, and one carries the words of a
 * single topic. Nothing in between, because there is no page that wants a
 * third thing.
 *
 * ---------------------------------------------------------------------------
 * Why the catalogue is one document and not one per track.
 *
 * Every consumer wants all of it. The hub draws four cards, a progress meter on
 * each and a search box that matches across every track; a track page wants one
 * track but arrives via the hub; a topic page needs its track's whole reading
 * order before it can draw a pager or say "07 / 43".
 *
 * The client used to solve this by importing all four track indexes behind
 * `requestIdleCallback` — four chunk downloads, 79KB of minified JavaScript,
 * deferred because they were too expensive to put in front of a paint. This is
 * one request of about 60KB, ~19KB compressed, that blocks nothing. Splitting it
 * per track would reproduce the original problem in HTTP instead of the bundler.
 * ---------------------------------------------------------------------------
 */

const slug = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-z0-9-]+$/i, 'Not a topic slug');

export const topicContentParams = z.object({ track: slug, topic: slug });

/** What a topic looks like in the catalogue: everything except its words. */
const CATALOGUE_FIELDS = 'track slug section order title summary tags ask readingMinutes';

/**
 * The catalogue's ETag inputs.
 *
 * `max(updatedAt)` is the obvious half and is not sufficient on its own: a
 * *deletion* does not move any surviving document's timestamp, so a catalogue
 * tagged only by the newest edit would serve a topic that no longer exists
 * forever. The counts are what close that, and they are why this is four
 * queries rather than two. All four are covered by indexes and read no
 * documents.
 */
const catalogueStamp = memoize(async () => {
  const [topics, tracks, newestTopic, newestTrack] = await Promise.all([
    LearnTopic.countDocuments({ status: 'live' }),
    LearnTrack.countDocuments({}),
    LearnTopic.findOne({ status: 'live' }).sort({ updatedAt: -1 }).select('updatedAt').lean(),
    LearnTrack.findOne().sort({ updatedAt: -1 }).select('updatedAt').lean(),
  ]);

  const newest = Math.max(
    newestTopic?.updatedAt?.getTime() || 0,
    newestTrack?.updatedAt?.getTime() || 0,
  );

  return { topics, tracks, newest };
}, 10_000);

/**
 * GET /learn/catalogue — every track, section and topic heading, in one shape.
 *
 * Nested rather than flat, and that is a decision about the *client* rather than
 * the wire. A flat list would have to be regrouped into sections on arrival, and
 * a regroup that ever ran during a render would hand every card a new object —
 * which is precisely what breaks the memo on `TopicCard`, the thing that keeps
 * typing in a 68-card filter cheap. Grouped once here, it is grouped once there.
 *
 * `ask` is included even though only the topic page reads it. It is 6KB
 * compressed, and leaving it out would mean the Ask-AI block above a topic's
 * prose could not render until the body landed — paying a visible beat of
 * layout to save nothing anybody would notice.
 */
export const getCatalogue = asyncHandler(async (req, res) => {
  const stamp = await catalogueStamp();
  const etag = `W/"learn-${stamp.tracks}-${stamp.topics}-${stamp.newest}"`;
  if (precondition(req, res, etag)) return;

  const [tracks, topics] = await Promise.all([
    LearnTrack.find().sort({ order: 1 }).select('-editedBy -__v').lean(),
    LearnTopic.find({ status: 'live' }).sort({ track: 1, order: 1 }).select(CATALOGUE_FIELDS).lean(),
  ]);

  const byTrack = new Map(tracks.map((t) => [t.slug, []]));
  for (const topic of topics) byTrack.get(topic.track)?.push(topic);

  res.json({
    version: stamp.newest,
    tracks: tracks.map((track) => {
      const mine = byTrack.get(track.slug) || [];
      const bySection = new Map(track.sections.map((s) => [s.key, []]));
      for (const topic of mine) bySection.get(topic.section)?.push(topic);

      return {
        slug: track.slug,
        name: track.name,
        hue: track.hue,
        icon: track.icon,
        status: track.status,
        order: track.order,
        blurb: track.blurb,
        summary: track.summary,
        topicCount: mine.length,
        sections: track.sections
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((section) => ({
            key: section.key,
            title: section.title,
            blurb: section.blurb,
            topics: (bySection.get(section.key) || []).map(({ _id, section: _s, ...rest }) => rest),
          })),
      };
    }),
  });
});

/**
 * GET /learn/topics/:track/:topic — one topic's words.
 *
 * A renamed slug answers 200 with `canonical` set rather than a 301. An XHR
 * follows a redirect transparently, so the client would never learn the URL had
 * changed and the address bar would stay wrong; a body the page can act on lets
 * it correct itself with `replace: true`.
 */
export const getTopic = asyncHandler(async (req, res) => {
  const track = String(req.params.track).toLowerCase();
  const wanted = String(req.params.topic).toLowerCase();

  let doc = await LearnTopic.findOne({ track, slug: wanted, status: 'live' })
    .select('-plaintext -editedBy -__v')
    .lean();

  let canonical = null;
  if (!doc) {
    doc = await LearnTopic.findOne({ track, slugHistory: wanted, status: 'live' })
      .select('-plaintext -editedBy -__v')
      .lean();
    if (doc) canonical = `${doc.track}/${doc.slug}`;
  }

  if (!doc) throw ApiError.notFound(`Unknown topic: ${track}/${wanted}`, 'NO_TOPIC');

  const etag = `W/"${doc.track}/${doc.slug}-${doc.version}"`;
  if (precondition(req, res, etag)) return;

  res.json({
    topic: {
      track: doc.track,
      slug: doc.slug,
      section: doc.section,
      title: doc.title,
      summary: doc.summary,
      tags: doc.tags,
      ask: doc.ask,
      blocks: doc.blocks,
      related: doc.related,
      readingMinutes: doc.readingMinutes,
      wordCount: doc.wordCount,
      version: doc.version,
      updatedAt: doc.updatedAt,
    },
    canonical,
  });
});
