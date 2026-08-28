import {
  IconBook,
  IconClock,
  IconGlobe,
  IconLayers,
  IconTable,
} from '../components/ui/Icons.jsx';

/**
 * The four tracks' chrome, and nothing else.
 *
 * This file used to be Learn: the registry, the loaders, and the whole answer to
 * "what does this cover". The content lives in Mongo now and arrives through
 * `useLearnCatalogue`. What stayed behind is the part a JSON response cannot
 * carry, and the part that cannot afford to wait for one.
 *
 * **`Icon` is the first.** It is a React component, and there is no encoding of
 * a component that survives a fetch. So the database stores a *name* and this
 * file turns it back into a component — the same trick `store/modules.js` plays
 * for the side menu.
 *
 * **The stubs are the second.** `findTrack` was synchronous, and three things
 * leaned on that: the hue on the shell, the name in the crumb, and the "No such
 * track" gate. A fetch cannot answer on the first frame, and a hub that draws
 * nothing for a beat is the one regression this move could have shipped. These
 * four entries answer immediately and the catalogue replaces them the moment it
 * lands — so a fifth track added in the database still appears with no deploy,
 * just a beat later, which is right for a track nobody has a bookmark to yet.
 *
 * They are a *fallback*, never the truth. Anything a reader acts on — how many
 * topics a track has, what they are called, what order they read in — comes from
 * the catalogue. What is here is four names, four colours and four sentences,
 * which is about six hundred bytes and does not go stale in a way that matters.
 */

const ICONS = {
  clock: IconClock,
  layers: IconLayers,
  globe: IconGlobe,
  table: IconTable,
};

/**
 * A track's icon, from the name the catalogue stores.
 *
 * Falls back rather than crashing. `<Icon size={19} />` on `undefined` throws
 * and takes the whole hub with it, and a track added in the database with an
 * icon name this build has never heard of is a thing that should render.
 */
export const trackIcon = (name) => ICONS[name] || IconBook;

export const TRACK_STUBS = [
  {
    slug: 'complexity',
    hue: 'violet',
    name: 'Complexity',
    status: 'live',
    Icon: IconClock,
    blurb:
      'Logarithms from scratch, then Big-O: what each shape costs, how to count it off your own code, and the tables worth knowing cold.',
  },
  {
    slug: 'react',
    hue: 'sky',
    name: 'React',
    status: 'live',
    Icon: IconLayers,
    blurb:
      'How React actually renders, every built-in hook, and the parts of the API that are easy to use and hard to explain.',
  },
  {
    slug: 'node',
    hue: 'green',
    name: 'Node.js',
    status: 'live',
    Icon: IconGlobe,
    blurb:
      'The language first, then the runtime: closures and promises, the event loop, your first server, and the backend a real API needs behind it.',
  },
  {
    slug: 'sql',
    hue: 'amber',
    name: 'SQL',
    status: 'live',
    Icon: IconTable,
    blurb:
      'Databases from the ground up: ER models and normalisation, every clause and join with its result printed underneath, window functions, transactions and isolation levels, indexes and query plans.',
  },
];

/** By slug, for the pages that resolve one track out of a URL parameter. */
export const TRACK_CHROME = Object.fromEntries(TRACK_STUBS.map((track) => [track.slug, track]));
