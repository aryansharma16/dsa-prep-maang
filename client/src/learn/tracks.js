import { IconClock, IconGlobe, IconLayers, IconTable } from '../components/ui/Icons.jsx';

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
 *
 * `hue` is the track's colour, and the only per-track decoration in the system.
 * It is a name out of the palette in tokens.css rather than a value, so the
 * track page and the topic page can hand it to `data-hue` and have the ambient
 * wash, the icon tile and the card edges all resolve from one word — and so a
 * track's colour is re-stepped for the light theme by the same block that
 * re-steps every other hue in the app.
 */
export const TRACKS = [
  /*
    First, ahead of the two framework tracks, because it is the only one that is
    about the curriculum this app exists for. React and Node are notes for the
    day job; this is the maths the roadmap assumes you already have, and a
    reader who does not have it gets nothing from a pattern guide that opens
    with "this is O(n log n)".
  */
  {
    slug: 'complexity',
    hue: 'violet',
    name: 'Complexity',
    status: 'live',
    Icon: IconClock,
    blurb:
      'Logarithms from scratch, then Big-O: what each shape costs, how to count it off your own code, and the tables worth knowing cold.',
    load: () => import('./complexity/index.js'),
  },
  {
    slug: 'react',
    hue: 'sky',
    name: 'React',
    status: 'live',
    Icon: IconLayers,
    blurb:
      'How React actually renders, every built-in hook, and the parts of the API that are easy to use and hard to explain.',
    load: () => import('./react/index.js'),
  },
  {
    slug: 'node',
    hue: 'green',
    name: 'Node.js',
    status: 'live',
    Icon: IconGlobe,
    blurb:
      'The language first, then the runtime: closures and promises, the event loop, your first server, and the backend a real API needs behind it.',
    load: () => import('./node/index.js'),
  },
  /*
    Last, and the only track that is not notes about a tool. Complexity is the
    maths under the roadmap; React and Node are the day job. This one is a
    subject in its own right — an interview asks about ER models and isolation
    levels the way it asks about graphs, so it is written to be *learned* rather
    than referred to, and it runs theory-first: what a database is, how one is
    designed and normalised, and only then the language.

    Its examples all use the same two tables, defined once in sql/sample-data.js
    — six employees and four departments, with one employee who has no
    department and one department with no employees. Those two rows are what
    make the six join types return six different results from one dataset.
  */
  {
    slug: 'sql',
    hue: 'amber',
    name: 'SQL',
    status: 'live',
    Icon: IconTable,
    blurb:
      'Databases from the ground up: ER models and normalisation, every clause and join with its result printed underneath, window functions, transactions and isolation levels, indexes and query plans.',
    load: () => import('./sql/index.js'),
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
