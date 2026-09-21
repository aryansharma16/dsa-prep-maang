import { asked, diagram, flow, h, links, p, quick, table, tip, warn, wiki } from '../blocks.js';
import { interviewLevel } from './shapes.js';

export const doc = {
  blocks: [
    p(
      'Video on demand at continental scale. The interesting thing about Netflix is that **the hard problem is not the software** — it is that 15% of the internet\'s evening traffic is video bytes, and no origin server can send them.',
    ),

    flow(['Client', 'DNS', 'Control plane API', 'Manifest', 'CDN edge', 'Video chunks'], 'Two paths, not one'),
    diagram(
      `
   CONTROL PLANE  (small, dynamic, your servers)
   ┌──────────────────────────────────────────────────┐
   │  browse · search · recommendations · profiles    │
   │  "play this"  ──▶  returns a MANIFEST            │
   └──────────────────────────────────────────────────┘
                              │  manifest = list of chunk URLs
                              ▼
   DATA PLANE  (enormous, static, somebody else's wires)
   ┌──────────────────────────────────────────────────┐
   │   edge server inside YOUR ISP                    │
   │   ├── video_1080p_0001.ts                        │
   │   ├── video_1080p_0002.ts     ~4s each           │
   │   └── ...                                        │
   └──────────────────────────────────────────────────┘

   the split is the whole design: metadata is a normal web app,
   video never touches it.
`,
      'Control plane and data plane',
    ),

    h('The pieces'),
    table(
      ['Piece', 'What it does', 'Why it is there'],
      [
        ['**Client app**', 'Picks a bitrate, requests chunks, buffers ahead', 'The client adapts — the server sends whatever is asked for'],
        ['**API / control plane**', 'Browse, search, profiles, "play"', 'Ordinary stateless services; tiny traffic compared to video'],
        ['**Manifest**', 'A list of chunk URLs at every quality', 'The handoff from your servers to the CDN'],
        ['**Transcoding pipeline**', 'One upload → dozens of renditions', 'Every device and every bandwidth needs a different file'],
        ['**Object storage**', 'The master copies and all renditions', 'Cheap, durable, and never serves a user directly'],
        ['**CDN / edge caches**', 'Serves the bytes', 'The product. Everything else is metadata'],
        ['**Recommendation pipeline**', 'Ranks the rows on the home screen', 'Offline-computed; the home page is a cached, ranked list'],
      ],
    ),

    h('Why the CDN is the architecture'),
    p(
      'Netflix runs its own CDN and puts the boxes **inside ISP networks**. A subscriber in Pune streaming from a server in that ISP\'s own data centre costs the ISP nothing in transit and gives the viewer a 5ms first byte. The alternative — serving from a cloud region — is paying for petabytes of egress to deliver a worse experience.',
    ),
    table(
      ['Approach', 'Cost', 'Latency', 'Verdict'],
      [
        ['Serve from origin', 'Ruinous egress', '100ms+', 'Impossible at this scale'],
        ['Commercial CDN', 'Expensive at petabyte scale', '~20ms', 'Workable, and what most people should say'],
        ['Own boxes in ISPs', 'Hardware, and a partnership', '~5ms', 'What actually happens at this size'],
      ],
    ),
    tip(
      'Video is **perfectly cacheable** — the same file, byte for byte, for millions of people, and it never changes. That is why a CDN works here and does not work for a personalised feed.',
    ),

    h('Transcoding: one upload, many files'),
    diagram(
      `
   master file (ProRes, ~100GB/hr)
        │
        ▼
   ┌──────────┐   split into chunks, transcode in PARALLEL
   │  split   │   ──▶ worker ──▶ 4K   HEVC
   └──────────┘   ──▶ worker ──▶ 1080p H.264
                  ──▶ worker ──▶ 720p  H.264
                  ──▶ worker ──▶ 480p  H.264
                  ──▶ worker ──▶ 240p  H.264   (per audio track,
                       │                        per subtitle, per DRM)
                       ▼
                  ┌──────────┐
                  │  stitch  │──▶ object storage ──▶ push to edges
                  └──────────┘
`,
      'Parallel by chunk, not by file',
    ),
    p(
      'Transcoding a two-hour film serially would take days. Splitting it into chunks makes it **embarrassingly parallel**: a thousand workers each do four seconds, and the whole film is ready in minutes. This runs on a queue, and it is the textbook case for one.',
    ),

    h('Adaptive bitrate — why playback does not stall'),
    diagram(
      `
   client measures its own throughput, chooses the next chunk

   bandwidth  ████████████░░░░░░  drops (someone starts a download)
                          │
   quality    1080p 1080p │ 480p 480p 720p 1080p
                          └─ switched DOWN mid-stream, at a
                             chunk boundary, no rebuffer

   the server is dumb. all the intelligence is in the client.
`,
      'The client decides',
    ),

    h('Recommendations'),
    flow(['Events', 'Feature store', 'Offline training', 'Precomputed rows', 'Cache', 'Home screen'], 'Mostly offline'),
    p(
      'The home screen is not computed when you open the app — it is **a cached, ranked list computed hours earlier**, with a light re-rank at request time. That is the batch-versus-real-time trade made in favour of batch, and it is why the screen paints instantly.',
    ),

    h('Scale'),
    table(
      ['Dimension', 'Order of magnitude', 'What breaks first'],
      [
        ['Subscribers', '~250M', '—'],
        ['Concurrent streams at peak', 'Tens of millions', 'Edge capacity in one region'],
        ['Bandwidth', 'Tens of Tbps', 'ISP peering, not your servers'],
        ['Catalogue size', 'Petabytes after transcoding', 'Storage cost, which is why old renditions get pruned'],
        ['Control-plane QPS', 'Hundreds of thousands', 'Ordinary, and the easy part'],
      ],
    ),

    h('When traffic spikes'),
    table(
      ['Event', 'What happens'],
      [
        ['A big release at 00:01 Friday', 'Content is **pre-positioned** on edges days ahead — the spike is reads from a warm cache'],
        ['Everyone home at 8pm', 'Predictable daily curve; capacity is provisioned for it, not autoscaled into it'],
        ['An edge cluster fails', 'DNS/anycast steers to the next-nearest edge; the viewer may drop a quality level'],
        ['The control plane is degraded', 'Playback of an already-started stream continues — the manifest is already on the client'],
      ],
    ),
    tip(
      'That last row is the design goal worth stating in an interview: **the data plane must survive the control plane.** If browse is down you cannot start a new show, but nobody watching one notices.',
    ),

    h('Failures'),
    table(
      ['What dies', 'Effect', 'Mitigation'],
      [
        ['One edge server', 'None visible', 'Client retries the next URL in the manifest'],
        ['A whole region of the control plane', 'Cannot browse or start playback', 'Multi-region, active-active, stateless services'],
        ['Recommendation pipeline', 'Home screen goes generic', 'Fall back to a global popularity list — degrade, do not fail'],
        ['Transcoding pipeline', 'New titles are delayed', 'Not user-facing; it is a queue that drains later'],
      ],
    ),
    warn(
      'The classic interview mistake here is designing the video path through your own services. **Bytes must never pass through your application tier** — the API returns URLs, and the CDN does the rest.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'Video on demand: a small control plane and an enormous CDN'],
      ['The hard part', 'Delivering petabytes without paying to move them'],
      ['Key decision', 'Split control plane from data plane; the API returns URLs, never bytes'],
      ['Trade-off', 'Pre-positioning content costs storage everywhere, and buys a warm cache always'],
      [
        '30-second answer',
        '"Two planes. The control plane is an ordinary stateless web app — browse, search, recommendations — and it returns a manifest of chunk URLs. The data plane is a CDN with servers inside ISPs, serving pre-transcoded four-second chunks. Uploads fan out through a parallel transcoding pipeline into a ladder of renditions, the client picks a bitrate per chunk, and recommendations are precomputed offline and cached."',
      ],
    ]),
    asked([
      ['Why a CDN and not bigger servers?', 'Egress cost and physics. Bytes are cheapest when they never cross the internet backbone.'],
      ['How does quality change mid-stream?', 'The client measures its own throughput and picks a different rendition at the next chunk boundary.'],
      ['Where do queues fit?', 'Transcoding, primarily — one upload fans out into thousands of parallel chunk jobs.'],
      ['How do recommendations work?', 'Trained and ranked offline, cached per user, lightly re-ranked at request time.'],
      ['What if the API is down?', 'Existing streams keep playing. The manifest is already on the client.'],
    ]),

    interviewLevel('Netflix'),
    links(
      wiki('Adaptive_bitrate_streaming', 'Adaptive bitrate streaming'),
      wiki('Content_delivery_network', 'Content delivery network'),
    ),
  ],
};
