import { asked, diagram, flow, h, links, p, quick, table, tip, warn, wiki } from '../blocks.js';
import { interviewLevel } from './shapes.js';

export const doc = {
  blocks: [
    p(
      'Audio streaming, and the thing that makes it a different design from video: **a song is about 3MB**. That single number means the whole catalogue fits at the edge, playback can be prefetched, and offline sync is a real feature rather than a fantasy.',
    ),

    flow(['Client', 'API', 'Track metadata', 'Signed CDN URL', 'Audio file'], 'Playback path'),
    diagram(
      `
   VIDEO                              AUDIO
   2 hours ≈ 4 GB                     3 minutes ≈ 3 MB
        │                                  │
        ▼                                  ▼
   must be chunked                    fetch the WHOLE file
   adaptive bitrate per chunk         one request, done
   cannot prefetch much               PREFETCH the next 3 tracks
   offline = a big download           offline = thousands of songs
                                      on a phone

   same CDN, completely different playback design.
`,
      'Why size changes everything',
    ),

    h('The pieces'),
    table(
      ['Piece', 'What it does', 'Why it is there'],
      [
        ['**Catalogue DB**', 'Tracks, albums, artists, rights by country', 'Relational, read-heavy, heavily cached'],
        ['**Audio storage + CDN**', 'A few encodings per track', 'Small files; near-perfect cacheability'],
        ['**Playlist service**', 'User-owned ordered lists', 'Write-heavy per user, sharded by `user_id`'],
        ['**Playback / stream log**', 'What was played, for how long', 'Feeds recommendations, and royalties'],
        ['**Recommendation pipeline**', 'Discover Weekly and friends', 'Offline, batch, weekly — see below'],
        ['**Search**', 'Tracks, artists, playlists', 'Inverted index; typo tolerance matters a lot here'],
        ['**Offline sync**', 'Encrypted local cache with a lease', 'The feature that only works because files are small'],
      ],
    ),

    h('Rights are part of the data model'),
    p(
      'A track is not globally available. Licensing is **per territory and changes over time**, so availability is a first-class field, checked on every resolve, and cached with a short TTL because a track can disappear from a country overnight.',
    ),
    warn(
      'Forgetting licensing is the most common miss in this design. "Play this track" is really "play this track, for this user, in this country, today" — and that is why the API returns a **short-lived signed URL** rather than a permanent one.',
    ),

    h('The hard part — Discover Weekly'),
    diagram(
      `
   OFFLINE (weekly, batch)                    ONLINE (per request)

   play events ──▶ ┌──────────────┐
                   │ collaborative│           user opens app
   playlists ────▶ │  filtering   │                 │
                   │  + content   │                 ▼
   audio ────────▶ │   features   │           read precomputed
   analysis        └──────┬───────┘           playlist from cache
                          │                         │
                          ▼                         ▼
                   ┌──────────────┐            instant render
                   │ 30 tracks    │
                   │ per user     │──▶ store ──▶ cache
                   └──────────────┘

   computed once a week for 600M users.
   nothing is computed while you wait.
`,
      'Batch inference, in its natural habitat',
    ),
    table(
      ['Signal', 'What it captures'],
      [
        ['**Collaborative filtering**', 'People with your taste also played this'],
        ['**Content features**', 'Tempo, key, energy — lets a brand-new track be recommended'],
        ['**Playlist co-occurrence**', 'Tracks humans put next to each other, which is a strong signal'],
        ['**Negative signals**', 'Skipped in the first 10 seconds is the clearest dislike you will ever get'],
      ],
    ),
    tip(
      'Content features are the **cold-start answer**: a track released this morning has no listeners, so collaborative filtering says nothing about it — but its audio can be analysed and placed next to things that sound like it.',
    ),

    h('Playback: prefetch, do not adapt'),
    diagram(
      `
   now playing ──▶ track A  ████████████░░░░░
                                    │
                   already fetched  ▼
                   track B  ████████████████  (in memory/disk)
                   track C  ████████░░░░░░░░  (fetching)

   gapless playback, and a skip costs nothing —
   the next track is already there.
`,
      'The whole trick',
    ),
    p(
      'Video adapts bitrate mid-stream because it cannot afford to buffer minutes ahead. Audio just **fetches the next few tracks entirely**, which is why a skip is instant and playback survives a tunnel.',
    ),

    h('Scale'),
    table(
      ['Dimension', 'Order of magnitude', 'What breaks first'],
      [
        ['Users', '~600M, ~250M paying', '—'],
        ['Catalogue', '~100M tracks × a few encodings', 'Storage, but audio is cheap'],
        ['Streams', 'Billions/day', 'Nothing — CDN reads'],
        ['Playback events', '~1M/s at peak', 'The event pipeline; it is append-only, so it is fine'],
        ['Playlist writes', 'High per user, low globally', 'Shard by user'],
        ['Recommendation compute', '600M users × weekly', 'Batch compute cost; it is scheduled, not urgent'],
      ],
    ),

    h('When traffic spikes'),
    table(
      ['Event', 'What happens'],
      [
        ['A major album drops', 'Pre-position it on edges at release time — the timing is known in advance'],
        ['Monday morning, everyone opens Discover Weekly', 'It is precomputed and cached; the read is trivial'],
        ['Wrapped season', 'A huge batch job plus a read-only feature — isolate it so it cannot affect playback'],
        ['A viral track', 'Perfectly cacheable; one cold fetch per edge'],
      ],
    ),

    h('Failures'),
    table(
      ['What dies', 'Effect', 'Mitigation'],
      [
        ['Recommendation pipeline', 'Stale playlists', 'Serve last week\'s. Nobody notices for a while'],
        ['Catalogue DB', 'Cannot browse or resolve new tracks', 'Aggressive caching; it is read-mostly and changes slowly'],
        ['Playlist service', 'Cannot edit playlists; playback continues', 'Separate service, separate failure domain'],
        ['Network, on a phone', 'Nothing, for a few minutes', 'Prefetched tracks plus the offline cache'],
        ['Event pipeline', 'Delayed recommendations and royalty counts', 'Events buffer in the log and are processed later'],
      ],
    ),

    h('Interview'),
    quick([
      ['What it is', 'Audio streaming with heavy personalisation'],
      ['The hard part', 'Recommendations at 600M-user scale, and per-territory licensing'],
      ['Key decision', 'Files are small enough to prefetch whole — no adaptive bitrate needed'],
      ['Trade-off', 'Weekly batch recommendations are stale by design, and cost nothing at request time'],
      [
        '30-second answer',
        '"A track is about 3MB, so playback is a signed CDN URL for a whole file plus prefetching the next few — no chunking, no adaptive bitrate, and offline sync becomes practical. Metadata and licensing live in a cached relational store, and availability is per-territory so URLs are short-lived. Recommendations are the hard part: collaborative filtering plus audio features, computed offline weekly for every user and served from cache."',
      ],
    ]),
    asked([
      ['How is audio different from video?', 'Files are a thousand times smaller, so you fetch whole tracks and prefetch ahead instead of adapting bitrate.'],
      ['How does Discover Weekly scale?', 'It is batch. Computed once a week per user and read from cache — nothing runs while you wait.'],
      ['How do you recommend a brand-new track?', 'Content features from the audio itself. Collaborative filtering has no data on it yet.'],
      ['Why signed, short-lived URLs?', 'Licensing is per country and changes, so entitlement is rechecked rather than granted permanently.'],
      ['How does offline mode work?', 'An encrypted local cache with a lease that must be renewed, which is only feasible because files are small.'],
    ]),

    interviewLevel('Spotify'),
    links(
      wiki('Collaborative_filtering', 'Collaborative filtering'),
      wiki('Cold_start_(recommender_systems)', 'Cold start'),
    ),
  ],
};
