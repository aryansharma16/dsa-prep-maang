/**
 * What Learn covers — the seeder's copy of the registry.
 *
 * This is the one file in the move whose contents changed, and it changed for
 * exactly one reason: `client/src/learn/tracks.js` opens with an import of
 * `Icons.jsx`, and Node cannot parse JSX. Everything else about a track is a
 * string, so everything else came across untouched.
 *
 * `icon` is therefore a *name* rather than a component. The client keeps a
 * name → component map and resolves it on arrival, which is the same trick
 * `store/modules.js` already plays for the side menu. It is the one field a
 * JSON response cannot carry and the one field this file had to invent.
 *
 * `order` is written out rather than taken from array position, unlike a
 * topic's. There are four of these and they are read by a human deciding what
 * Learn opens with; a number you can see is worth more than one you have to
 * count to.
 */

/**
 * Where the prose lives — beside this file, now.
 *
 * It was `client/src/learn/**` until the client stopped importing it, and the
 * seeder read across the repo during the cutover so both copies could be
 * compared before either was trusted. `npm run seed:learn:verify` is what that
 * comparison became.
 *
 * The 174 modules moved unedited. `() => import('./big-o.js')` resolves relative
 * to the file that wrote it, so a track index works here exactly as it worked in
 * the bundle, and the diff of the move is a rename of every path and a change to
 * none of the words.
 */
export const CONTENT_ROOT = new URL('./', import.meta.url);

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
    name: 'Complexity',
    hue: 'violet',
    icon: 'clock',
    status: 'live',
    order: 0,
    blurb:
      'Logarithms from scratch, then Big-O: what each shape costs, how to count it off your own code, and the tables worth knowing cold.',
  },
  {
    slug: 'react',
    name: 'React',
    hue: 'sky',
    icon: 'layers',
    status: 'live',
    order: 1,
    blurb:
      'How React actually renders, every built-in hook, and the parts of the API that are easy to use and hard to explain.',
  },
  {
    slug: 'node',
    name: 'Node.js',
    hue: 'green',
    icon: 'globe',
    status: 'live',
    order: 2,
    blurb:
      'The language first, then the runtime: closures and promises, the event loop, your first server, and the backend a real API needs behind it.',
  },
  /*
    Last, and the only track that is not notes about a tool. An interview asks
    about ER models and isolation levels the way it asks about graphs, so it is
    written to be *learned* front to back rather than referred to, and it runs
    theory-first: what a database is, how one is designed and normalised, and
    only then the language.
  */
  {
    slug: 'sql',
    name: 'SQL',
    hue: 'amber',
    icon: 'table',
    status: 'live',
    order: 3,
    blurb:
      'Databases from the ground up: ER models and normalisation, every clause and join with its result printed underneath, window functions, transactions and isolation levels, indexes and query plans.',
  },
];
