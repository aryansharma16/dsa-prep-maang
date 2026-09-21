import { asked, code, diagram, flow, h, links, p, quick, sh, table, tip, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Video is not a file you download — it is **a sequence of small files the client fetches one at a time**, at whatever quality its connection can currently sustain. Once you see it that way, streaming is an ordinary CDN problem with a transcoding pipeline in front.',
    ),

    flow(['Upload', 'Transcode ladder', 'Segment + manifest', 'CDN', 'Client picks a rendition'], 'The pipeline'),

    h('The rendition ladder'),
    diagram(
      `
   one master file ──▶ many versions, so the client always
                       has something it can play

   4K    HEVC   15 Mbps  ─┐
   1080p H.264   5 Mbps   │
   720p  H.264   2.5 Mbps ├── all segmented into 2-10s chunks
   480p  H.264   1 Mbps   │
   360p  H.264   0.6 Mbps │
   240p  H.264   0.3 Mbps ─┘

   × each audio track
   × each subtitle
   × each DRM scheme

   ──▶ storage is many times the original.
       which is why unwatched renditions get pruned.
`,
      'Why one upload becomes dozens of files',
    ),
    p(
      'Transcoding is **embarrassingly parallel by chunk**: split the master into segments, transcode a thousand of them across a thousand workers, and stitch. A two-hour film takes minutes instead of days, and it is the textbook case for a work queue.',
    ),

    h('Manifests and adaptive bitrate'),
    code(
      sh(`
# The manifest is a plain text index of the renditions.
#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080
1080p/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1280x720
720p/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=600000,RESOLUTION=640x360
360p/index.m3u8

# ...and each of those lists the actual segments.
#EXTINF:6.0,
seg-0001.ts
#EXTINF:6.0,
seg-0002.ts
`),
    ),
    diagram(
      `
   the client measures its own throughput and chooses

   bandwidth  ████████████░░░░░░░░  drops mid-stream
                          │
   quality    1080p 1080p │ 480p 480p 720p 1080p
                          └─ switched DOWN at the next
                             segment boundary. no rebuffer.

   the server is DUMB. it serves whatever file is requested.
   ALL the adaptation logic lives in the client.

   ──▶ which is exactly why a CDN works: every segment is a
       static file, identical for everyone who wants it.
`,
      'The server does nothing clever',
    ),
    table(
      ['', 'HLS', 'MPEG-DASH'],
      [
        ['Origin', 'Apple', 'Open standard'],
        ['Manifest', '`.m3u8` playlist', '`.mpd` XML'],
        ['Support', '**Universal** — required on iOS', 'Everywhere except Safari, natively'],
        ['Codec', 'Was H.264-only; now flexible', 'Codec-agnostic by design'],
        ['In practice', 'Ship both, or CMAF segments shared by both', ''],
      ],
    ),
    tip(
      '**CMAF** is the answer to shipping both: one set of segment files, two manifests. It halves storage and doubles the CDN hit rate compared with maintaining separate HLS and DASH copies of every segment.',
    ),

    h('Live versus on demand'),
    table(
      ['', 'On demand', 'Live'],
      [
        ['Content', 'Fully transcoded in advance', 'Encoded in real time'],
        ['Manifest', 'Fixed, complete', '**Rolling window, rewritten constantly**'],
        ['Latency target', 'Irrelevant', '**Seconds behind reality**'],
        ['Cache hit rate', 'Depends on the long tail', '**Near 100% — everyone wants the same segment**'],
        ['Failure looks like', 'Press play again', 'You miss the goal'],
        ['Hard part', 'Storage and cost', 'The encoder, and the spike'],
      ],
    ),
    warn(
      'Live is **easier to cache and harder to operate**. Every viewer requests the same segment within the same few seconds, so origin load is trivial — but the encoder is a single point of failure producing content that cannot be regenerated, and the audience arrives all at once.',
    ),

    h('Reducing live latency'),
    table(
      ['Technique', 'Gets you to'],
      [
        ['Standard HLS, 6–10s segments', '~30–60s behind'],
        ['Shorter segments (2s)', '~10s — more requests, worse compression'],
        ['**LL-HLS / LL-DASH** (partial segments)', '~3–5s'],
        ['**WebRTC**', '**Sub-second** — but it is not a CDN problem any more'],
      ],
    ),
    p(
      'Each step down costs something. **WebRTC gives sub-second latency and abandons the CDN model entirely** — you are now running media servers with per-viewer connections, which is a completely different and much more expensive architecture.',
    ),

    h('Cost'),
    table(
      ['Cost', 'Driver', 'Control'],
      [
        ['**Egress**', 'Bytes × viewers — usually the largest line', 'Better codecs; cap resolution on small screens'],
        ['**Storage**', 'Renditions × catalogue', 'Prune unwatched renditions and old content'],
        ['**Transcoding**', 'CPU/GPU hours per upload', 'Transcode top qualities lazily, on first request'],
        ['**Origin**', 'Cache misses', 'An origin shield in front'],
      ],
    ),
    tip(
      'Lazy transcoding is the underrated saving for user-generated video: **most uploads are watched almost never.** Produce a low rendition immediately and generate 1080p and 4K on first request, and you stop paying to transcode content nobody watches.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'Serving video as small cacheable segments the client selects between'],
      ['The hard part', 'Transcoding cost, storage multiplication, and CDN economics'],
      ['Use when', 'Any video or audio product'],
      ['Trade-off', 'More renditions give better playback and cost storage and transcoding'],
      [
        '30-second answer',
        '"Video is transcoded into a ladder of renditions and cut into segments of a few seconds, indexed by a manifest. The client measures its own throughput and picks a rendition per segment, so the server is dumb and every segment is a static file a CDN caches perfectly. Transcoding is parallel by chunk on a queue. Live is the same, with a rolling manifest — easier to cache because everyone wants the same segment, harder to operate because the encoder cannot be re-run."',
      ],
    ]),
    asked([
      ['How does adaptive bitrate work?', 'The client measures throughput and requests a different rendition at the next segment boundary.'],
      ['Why is video so cacheable?', 'Every segment is an identical static file for every viewer, and it never changes.'],
      ['HLS or DASH?', 'Ship both, ideally over shared CMAF segments so you store one set of files.'],
      ['What makes live harder?', 'A rolling manifest, a real-time encoder that cannot be re-run, and an audience that arrives at once.'],
      ['How do you cut video costs?', 'Egress first — better codecs and capped resolutions. Then prune renditions and transcode high qualities lazily.'],
    ]),

    links(
      wiki('HTTP_Live_Streaming', 'HTTP Live Streaming'),
      wiki('Adaptive_bitrate_streaming', 'Adaptive bitrate streaming'),
    ),
  ],
};
