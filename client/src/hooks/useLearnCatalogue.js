import { useEffect, useState } from 'react';
import { errorMessage } from '../api/http.js';
import { learnApi } from '../api/index.js';
import { TRACK_CHROME, trackIcon } from '../learn/tracks.js';

/**
 * Learn's table of contents — every track, section and topic heading — as one
 * document, fetched once and held for the session.
 *
 * One request rather than four, and the arithmetic is not close: the four track
 * indexes this replaces were 79KB of minified JavaScript in four chunks, and the
 * hub fetched all of them because the meters and the cross-track search both
 * need every topic. This is 20KB of JSON in one round trip — and the topic page
 * no longer waits for an index before it can name the body it wants.
 *
 * Seeded from `localStorage` at module load, synchronously. That is the whole
 * reason it is localStorage and not IndexedDB: an async store cannot answer on
 * the first frame, and answering on the first frame is the entire job. A
 * returning reader gets the meters, the totals and a working search box before
 * the request is even sent; the response then either confirms the seed or
 * replaces it.
 */
const LS_KEY = 'learn-catalogue';

let cache = null;
let inflight = null;

/*
  Whether this session has checked its copy against the server yet.

  Two flags rather than one, because `cache` alone cannot answer the question.
  It is set at module load from localStorage, so "do we have a catalogue" and
  "have we confirmed it is current" are different facts — and treating them as
  one gives you a choice of two bugs. Bail on `cache` and a returning reader
  never revalidates, so a re-seed or an admin edit is invisible until they clear
  their storage. Ignore it and every page mount fires another request: the hub,
  the track and the topic each asked separately, which is three round trips to
  learn nothing, and it is what put a row of `catalogue` calls in the network
  panel for a single walk into a topic.

  So: exactly one request per session. It is usually a 304 with an empty body,
  because the ETag has not moved.
*/
let validated = false;

/*
  Bumped by `invalidateLearnCatalogue`, and for the reason useGuide.js gives:
  dropping the copy is not enough on its own. A request already in flight when an
  edit lands keeps running, and its `.then` would put the pre-edit catalogue
  straight back.

  Nothing bumps it today — nothing can edit Learn yet. It goes in anyway, because
  the localStorage layer below has to agree with it, and retrofitting that
  agreement later is the expensive version of this.
*/
let generation = 0;

/**
 * Everything derived from the catalogue, derived once.
 *
 * This runs when a payload is parsed, not when a component renders, and that is
 * the whole of the referential-stability story. `TopicCard` is memoised because
 * typing in a track's filter re-renders sixty-eight of them, and that comparison
 * only pays if `topic` is the same object every time. A frozen module used to
 * give that away for free; a parsed payload gives it away just as cheaply, so
 * long as nothing downstream maps over the list per render — which is why the
 * three things the pages used to compute live here instead:
 *
 *   Icon  — the one field JSON cannot carry, resolved from its name
 *   flat  — the track in reading order, for prev/next and the counters
 *   at    — slug → position, so the topic page does not scan sixty-eight entries
 *
 * The spread copies the track object and nothing under it: `sections` and every
 * topic in them keep the identity `JSON.parse` gave them.
 */
function shape(payload) {
  const tracks = (payload.tracks || []).map((track) => {
    const flat = (track.sections || []).flatMap((section) => section.topics || []);
    return {
      ...track,
      Icon: trackIcon(track.icon),
      flat,
      at: new Map(flat.map((topic, i) => [topic.slug, i])),
    };
  });

  return {
    version: payload.version,
    tracks,
    bySlug: new Map(tracks.map((track) => [track.slug, track])),
  };
}

try {
  const raw = localStorage.getItem(LS_KEY);
  if (raw) cache = shape(JSON.parse(raw));
} catch {
  /* Private mode, a full quota, or a payload from an older shape. Fetch it. */
}

function fetchCatalogue() {
  if (validated && cache) return Promise.resolve(cache);
  if (inflight) return inflight;

  const startedAt = generation;
  inflight = learnApi
    .catalogue()
    .then((payload) => {
      if (startedAt !== generation) return cache;
      validated = true;

      /*
        Same version, same words — and swapping in a fresh parse would hand every
        card a new object for nothing: a hundred and seventy memo misses to
        redraw an identical page. The seed stays, and stays `===` to what the
        last render saw.
      */
      if (cache?.version !== payload.version) {
        cache = shape(payload);
        try {
          localStorage.setItem(LS_KEY, JSON.stringify(payload));
        } catch {
          /* A catalogue that could not be stored is one that gets fetched again. */
        }
      }
      return cache;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

/** Drops the catalogue so the next reader fetches it fresh. For the editor. */
export function invalidateLearnCatalogue() {
  generation += 1;
  cache = null;
  inflight = null;
  validated = false;
  try {
    localStorage.removeItem(LS_KEY);
  } catch {
    /* Nothing to do — the in-memory copy is already gone. */
  }
}

/** The content version, for anything keying a cache on it. Null until it lands. */
export const catalogueVersion = () => cache?.version ?? null;

/**
 * The track behind a slug, from whichever source can answer first.
 *
 * `null` is evidence of a bad slug and never a verdict on its own — a caller has
 * to check `loading` before drawing "No such track", or a deep link says so on
 * its way to rendering the track perfectly well.
 */
export const findTrack = (catalogue, slug) =>
  catalogue?.bySlug.get(slug) || TRACK_CHROME[slug] || null;

export function useLearnCatalogue() {
  const [catalogue, setCatalogue] = useState(cache);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;

    fetchCatalogue()
      .then((next) => live && setCatalogue(next))
      /*
        Only when there is nothing on screen. A revalidation that fails behind a
        good copy is not an error the reader can act on, and replacing a page
        they are reading with "Could not load" would be the request telling the
        truth and the page telling a lie.
      */
      .catch((err) => live && !cache && setError(errorMessage(err, 'Could not load Learn')));

    return () => {
      live = false;
    };
  }, []);

  return { catalogue, loading: !catalogue && !error, error };
}
