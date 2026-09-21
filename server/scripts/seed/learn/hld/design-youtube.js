import { asked, diagram, flow, h, links, p, quick, table, tip, warn, wiki } from '../blocks.js';
import { interviewLevel } from './shapes.js';

export const doc = {
  blocks: [
    p(
      'Netflix with the upload side turned on. The catalogue is not curated, it arrives at hundreds of hours per minute from anyone, and **the view counter is a harder distributed systems problem than the video**.',
    ),

    flow(['Creator', 'Upload service', 'Object storage', 'Transcode queue', 'Renditions', 'CDN'], 'Upload path'),
    flow(['Viewer', 'API', 'Metadata DB', 'Manifest', 'CDN edge'], 'Watch path'),

    h('The architecture'),
    diagram(
      `
   UPLOAD                                    WATCH
   ┌─────────┐                          ┌──────────┐
   │ creator │                          │  viewer  │
   └────┬────┘                          └────┬─────┘
        │ presigned URL                      │
        ▼                                    ▼
   ┌─────────┐                          ┌──────────┐
   │   S3    │                          │   API    │──▶ metadata DB
   │  (raw)  │                          └────┬─────┘    (title, owner,
   └────┬────┘                               │           privacy)
        │ event                              │ manifest
        ▼                                    ▼
   ┌─────────┐   ┌──────────┐           ┌──────────┐
   │  Kafka  │──▶│ transcode│──┐        │   CDN    │
   └─────────┘   │  workers │  │        └──────────┘
                 └──────────┘  │             ▲
                               ▼             │
                        ┌─────────────┐      │
                        │  renditions │──────┘
                        │  in S3      │  pull on first request
                        └─────────────┘
`,
      'Upload is async; watch is a CDN read',
    ),

    h('The pieces'),
    table(
      ['Piece', 'What it does', 'Why it is there'],
      [
        ['**Presigned upload**', 'Creator uploads straight to object storage', 'A 4GB file must never pass through your app servers'],
        ['**Metadata DB**', 'Title, owner, privacy, tags', 'Small, relational, read-heavy — shard by `video_id`'],
        ['**Kafka**', 'Carries "a video arrived" to everything downstream', 'Transcode, moderate, index, notify — all from one event'],
        ['**Transcode workers**', 'Chunked, parallel, one job per rendition', 'A 10-minute video must not take 10 minutes to process'],
        ['**CDN**', 'Serves chunks', 'Same as Netflix — with a pull cache, not pre-positioned'],
        ['**Search index**', 'Title, description, transcript', 'A separate store; the metadata DB cannot do relevance'],
        ['**View counter**', 'Counts views without melting', 'See below — this is the interesting part'],
      ],
    ),
    tip(
      'The difference from Netflix is one word: **pull**. Netflix knows what will be popular and pushes it to edges in advance; YouTube has billions of videos of which almost none will be watched, so an edge fetches from origin on the first request and caches it.',
    ),

    h('The hard part — counting views'),
    p(
      'A naive `UPDATE videos SET views = views + 1` on a trending video is **millions of writes a minute to one row**, every one of them contending on the same lock. It is the single hottest key in the system.',
    ),
    diagram(
      `
   NAIVE                          WHAT ACTUALLY WORKS

   every view                     every view
        │                              │
        ▼                              ▼
   UPDATE videos                  append to Kafka
   SET views=views+1              (cheap, sequential)
   WHERE id=?                          │
        │                              ▼
        ▼                         ┌──────────┐
   ONE ROW                        │ aggregate│  tumbling window,
   one lock                       │  per 10s │  per video
   millions of writers            └────┬─────┘
        │                              │
        ▼                              ▼
   ✗ lock contention              ONE write per video
   ✗ replica lag                  per 10 seconds
   ✗ the row is a bottleneck           │
                                       ▼
                                  counts DB ──▶ cache ──▶ UI
`,
      'Turn N writes into one',
    ),
    table(
      ['Technique', 'What it buys'],
      [
        ['**Write to a log, not a row**', 'An append is contention-free; a counter update is not'],
        ['**Aggregate in windows**', 'A million events become one write per video per window'],
        ['**Approximate while hot**', 'The UI shows a cached, slightly stale number — nobody can tell'],
        ['**Reconcile in batch**', 'A nightly job produces the exact number for payouts'],
        ['**Dedupe by session**', 'A view is a watch, not a request — bots and refreshes do not count'],
      ],
    ),
    warn(
      'The counter is also an **anti-fraud** problem, which is why it is never a simple increment: a view has to be a real person watching for a real duration, and that decision cannot be made at request time.',
    ),

    h('Scale'),
    table(
      ['Dimension', 'Order of magnitude', 'What breaks first'],
      [
        ['Watch requests', 'Billions/day → ~100k QPS peak', 'Nothing — it is a CDN read'],
        ['Uploads', 'Hundreds of hours/minute', 'Transcoding compute, which is a queue you can grow'],
        ['Storage', 'Exabytes', 'Cost. Old and unwatched renditions get pruned'],
        ['Metadata reads', '~1M QPS', 'Cache it; the row rarely changes'],
        ['View events', '~1M/s at peak', 'The counter, if built naively'],
      ],
    ),

    h('When traffic spikes'),
    table(
      ['Event', 'What happens'],
      [
        ['A video goes viral', 'First few requests miss the edge and pull from origin; after that it is pure cache'],
        ['A premiere at a fixed time', 'Pre-warm the edges; treat it like a live event'],
        ['Upload surge', 'The transcode queue grows. Add workers; nothing user-facing degrades'],
        ['One video becomes a hot key in metadata', 'It is cached at the edge and in Redis — the DB never sees it'],
      ],
    ),
    tip(
      'Virality is the **easy** spike, because video is cacheable. One cold fetch per edge, and then a billion views cost origin nothing. Compare that to a personalised feed, where every request is different.',
    ),

    h('Failures'),
    table(
      ['What dies', 'Effect', 'Mitigation'],
      [
        ['Transcode workers', 'New uploads stay "processing"', 'Kafka retains the events; workers resume from their offsets'],
        ['Metadata DB primary', 'Cannot publish or edit; watching still works', 'Replicas serve reads; promote a replica for writes'],
        ['Search index', 'Search degraded', 'Fall back to a simple title match; the index rebuilds from the log'],
        ['View pipeline', 'Counts freeze', 'Events sit in Kafka and are processed later — nothing is lost'],
        ['A CDN edge', 'Invisible', 'Next-nearest edge; origin as the backstop'],
      ],
    ),

    h('Interview'),
    quick([
      ['What it is', 'User-generated video: async upload pipeline, CDN delivery, a hard counter'],
      ['The hard part', 'Counting views on a hot video without a hot row'],
      ['Key decision', 'Presigned upload + event-driven transcode; pull CDN rather than push'],
      ['Trade-off', 'View counts are eventually consistent and approximate while hot — reconciled in batch'],
      [
        '30-second answer',
        '"Creators upload straight to object storage with a presigned URL, which emits an event. Workers transcode it in parallel chunks into a rendition ladder, and a pull CDN caches chunks on first request. Watching is an API call for metadata and a manifest, then chunks from the edge. Views are appended to a log and aggregated in windows rather than incremented on a row, because a trending video would otherwise be millions of writes to one key."',
      ],
    ]),
    asked([
      ['How is this different from Netflix?', 'Uploads from anyone, a pull CDN instead of pre-positioned content, and a far bigger cold catalogue.'],
      ['How do you count views at this scale?', 'Append events to a log, aggregate in windows, cache an approximate number, reconcile in batch.'],
      ['Why presigned upload URLs?', 'So multi-gigabyte files never traverse your application servers.'],
      ['How do you make transcoding fast?', 'Split the file into chunks and transcode them in parallel, then stitch.'],
      ['How does search work?', 'A separate inverted index fed from the same event stream — the metadata DB cannot do relevance.'],
    ]),

    interviewLevel('YouTube'),
    links(
      wiki('Transcoding', 'Transcoding'),
      wiki('Stream_processing', 'Stream processing'),
    ),
  ],
};
