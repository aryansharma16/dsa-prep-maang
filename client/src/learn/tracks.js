import { IconGlobe, IconLayers, IconTable } from '../components/ui/Icons.jsx';

/**
 * What Learn covers, and what it is going to cover.
 *
 * One list, so adding a track is one entry plus one folder — the hub, the
 * breadcrumb and the "is this a real track" check all read from here. `status`
 * is the only thing that decides whether a card is a link: `soon` tracks are
 * listed on purpose rather than hidden, because a reference that shows what is
 * coming reads as a plan, and one that shows a single item reads as abandoned.
 *
 * `load` is a dynamic import of the track's index — its topic list, not its
 * prose. Every topic body is a further import behind that, so opening the hub
 * costs one small chunk and opening a topic costs one more.
 */
export const TRACKS = [
  {
    slug: 'react',
    name: 'React',
    status: 'live',
    Icon: IconLayers,
    blurb:
      'How React actually renders, every built-in hook, and the parts of the API that are easy to use and hard to explain.',
    load: () => import('./react/index.js'),
  },
  {
    slug: 'node',
    name: 'Node.js',
    status: 'soon',
    Icon: IconGlobe,
    blurb: 'The event loop, modules, streams, and the built-ins worth knowing by name.',
  },
  {
    slug: 'sql',
    name: 'SQL',
    status: 'soon',
    Icon: IconTable,
    blurb: 'Joins, indexes, window functions, and reading a query plan.',
  },
];

export const findTrack = (slug) => TRACKS.find((track) => track.slug === slug) || null;

/**
 * Flattens a track index into reading order.
 *
 * The index is grouped into sections for the topic list, but prev/next has to
 * walk it as one sequence — and that sequence is the section order, so the two
 * cannot drift.
 */
export const flatTopics = (sections = []) => sections.flatMap((section) => section.topics);
