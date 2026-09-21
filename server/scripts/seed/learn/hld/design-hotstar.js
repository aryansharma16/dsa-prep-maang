import { asked, diagram, flow, h, links, p, quick, table, tip, warn, wiki } from '../blocks.js';
import { interviewLevel } from './shapes.js';

export const doc = {
  blocks: [
    p(
      'Live sport for tens of millions of concurrent viewers. Everything about this design is shaped by one fact: **the traffic arrives in ninety seconds and no autoscaler is that fast**. An IPL final goes from two million to fifty million concurrent when the match starts, and again at every wicket.',
    ),

    flow(['Stadium', 'Encoder', 'Origin', 'Packager', 'Multi-CDN', 'Millions of clients'], 'Live path'),
    diagram(
      `
   camera ──▶ encoder ──▶ origin ──▶ packager ──▶ CDN(s) ──▶ viewers
                 │            │          │
            H.264/HEVC   segments    HLS/DASH     30-60s behind
            ladder of    of 2-6s     manifests    the real event
            renditions

   THE SPIKE

   concurrent
   viewers  50M ┤                    ╭──────────────
                │                   ╱
            25M ┤                  ╱
                │                 ╱
             2M ┤────────────────╯
                └──────────────────────────────────▶
                     match start (90 seconds)

   you cannot autoscale into that. you arrive already scaled.
`,
      'The shape of the problem',
    ),

    h('The pieces'),
    table(
      ['Piece', 'What it does', 'Why it is there'],
      [
        ['**Encoder**', 'Camera feed → a ladder of bitrates, in real time', 'Cannot be batched — it is happening now'],
        ['**Packager**', 'Wraps segments into HLS/DASH manifests', 'Every player speaks one of these'],
        ['**Multi-CDN**', 'Two or more CDNs, steered live', 'No single CDN has headroom for this, and one may degrade'],
        ['**Rolling manifest**', 'A sliding window of the last N segments', 'Live has no end; the manifest is rewritten every few seconds'],
        ['**Control plane**', 'Login, entitlement, playback authorisation', 'The part that actually falls over — everyone logs in at once'],
        ['**Chat / reactions**', 'Real-time social layer', 'Deliberately degradable — the first thing to shed'],
      ],
    ),

    h('The hard part — arriving already scaled'),
    p(
      'Autoscaling reacts in 30–120 seconds and the spike is over by then. The answer is not a better autoscaler; it is **pre-scaling to a predicted peak and shedding load gracefully past it**.',
    ),
    table(
      ['Technique', 'What it does'],
      [
        ['**Pre-scale on a schedule**', 'Capacity is up an hour before toss, sized from the last comparable match'],
        ['**Predictive scaling**', 'Scale on concurrency trend, not CPU — CPU tells you too late'],
        ['**Staged warm-up**', 'Connection servers, caches and DB pools warmed before traffic, not during'],
        ['**Load shedding**', 'Past the ceiling, drop features in a fixed order: chat, then stats, then quality'],
        ['**Queue at the gate**', 'A waiting room is a better experience than a site that is down'],
        ['**Jittered clients**', 'Clients retry and refresh manifests with randomised offsets so they do not synchronise'],
      ],
    ),
    warn(
      'Synchronised clients are the self-inflicted half of this problem. Fifty million players all refreshing a manifest on the same two-second boundary is a **coordinated DDoS on your own origin**. Jitter is not an optimisation here, it is load-bearing.',
    ),

    h('Degradation ladder'),
    diagram(
      `
   load
    │
    │ 100% ─────────────────────────────  everything on
    │
    │ 110% ─────────────────────────────  chat read-only
    │
    │ 125% ─────────────────────────────  live stats frozen
    │
    │ 150% ─────────────────────────────  cap max bitrate
    │
    │ 200% ─────────────────────────────  waiting room for new
    │                                      sessions; existing
    ▼                                      viewers unaffected

   the video keeps playing at every level. that is the rule.
`,
      'What gets dropped, and in what order',
    ),
    tip(
      'Stating a degradation ladder out loud is the strongest single move in this interview. It shows you have accepted that the peak may exceed the plan and **decided in advance what the system gives up**, instead of letting it fail at whatever breaks first.',
    ),

    h('Live versus on demand'),
    table(
      ['', 'Live', 'On demand'],
      [
        ['Content exists', 'Being created now', 'Already transcoded'],
        ['Cacheable', 'Each segment, briefly', 'Forever'],
        ['Cache hit ratio', 'Very high — everyone wants the same segment', 'Depends on the long tail'],
        ['Origin load', 'Constant and predictable', 'Spiky on cold content'],
        ['Latency target', '**Seconds behind real time**', 'Irrelevant'],
        ['What failure looks like', 'You miss the wicket', 'You press play again'],
      ],
    ),
    p(
      'The saving grace is that **everybody is watching the same segment at the same time**. Cache hit ratios approach 100%, so origin sees one request per edge per segment rather than fifty million. Live is easier to cache than video on demand, not harder.',
    ),

    h('Scale'),
    table(
      ['Dimension', 'Order of magnitude', 'What breaks first'],
      [
        ['Peak concurrent viewers', 'Tens of millions', 'CDN capacity and ISP peering'],
        ['Bandwidth at peak', '10+ Tbps', 'The reason there is more than one CDN'],
        ['Logins in the first minute', 'Millions', 'The auth service — the real bottleneck'],
        ['Manifest requests', 'Concurrency ÷ segment duration', 'Origin, without jitter and caching'],
        ['Chat messages', 'Hundreds of thousands/s', 'Deliberately sampled, not delivered in full'],
      ],
    ),
    tip(
      'Note which row is the bottleneck: **not video**. It is the control plane — login, entitlement, session — because that is the part that cannot be served from a cache.',
    ),

    h('Failures'),
    table(
      ['What dies', 'Effect', 'Mitigation'],
      [
        ['One CDN degrades', 'Buffering for a share of viewers', 'Multi-CDN steering moves traffic within seconds'],
        ['The encoder', 'The stream stops — the worst failure', 'Redundant encoders on separate paths from the venue'],
        ['Auth service', 'Nobody new can start watching', 'Cache entitlement, issue long-lived playback tokens'],
        ['Chat', 'No chat', 'By design. It is the first thing shed'],
        ['Origin', 'Segments stop updating', 'Edges serve the last segments; multiple origins behind a load balancer'],
      ],
    ),

    h('Interview'),
    quick([
      ['What it is', 'Live streaming to tens of millions of simultaneous viewers'],
      ['The hard part', 'A spike that arrives faster than anything can scale'],
      ['Key decision', 'Pre-scale to a predicted peak; degrade in a planned order past it'],
      ['Trade-off', 'Paying for peak capacity in advance, and dropping features rather than the stream'],
      [
        '30-second answer',
        '"A real-time encoder produces a bitrate ladder, a packager cuts it into segments with a rolling manifest, and multiple CDNs serve them — everyone wants the same segment, so cache hit ratios are near 100%. The spike is the design constraint: capacity is pre-scaled from past matches rather than autoscaled, clients jitter their manifest requests so they do not synchronise, and past the ceiling the system sheds chat, then stats, then bitrate — never the video."',
      ],
    ]),
    asked([
      ['Why not autoscale?', 'The spike is 90 seconds and a node takes 30–120 to be useful. You arrive already scaled.'],
      ['Why is live easier to cache than VOD?', 'Everyone wants the same segment at the same moment, so the edge hit ratio is near 100%.'],
      ['What is the real bottleneck?', 'The control plane — logins and entitlement checks — not the video bytes.'],
      ['Why multi-CDN?', 'No single provider has the headroom, and it lets you steer away from one that degrades.'],
      ['What do you drop under load?', 'Chat, then live stats, then maximum bitrate. The stream itself is never shed.'],
    ]),

    interviewLevel('Hotstar'),
    links(
      wiki('HTTP_Live_Streaming', 'HTTP Live Streaming'),
      wiki('Dynamic_Adaptive_Streaming_over_HTTP', 'MPEG-DASH'),
    ),
  ],
};
