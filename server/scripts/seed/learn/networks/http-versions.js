import { asked, cheat, code, h, links, mdn, note, p, rfc, sh, table, tip, ul, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Four versions of HTTP are in use, and each one exists to fix a specific bottleneck the previous one left behind. The story is short and it is worth knowing as a story, because the questions asked about it are always "what problem did this solve".',
    ),

    h('The four, in one table'),
    table(
      ['Version', 'Year', 'Transport', 'The fix'],
      [
        ['HTTP/1.0', '1996', 'TCP', 'One connection per request — new handshake every time'],
        ['**HTTP/1.1**', '1997', 'TCP', '**Keep-alive** and the `Host` header — still one request at a time per connection'],
        ['**HTTP/2**', '2015', 'TCP', '**Multiplexing**, binary framing, header compression'],
        ['**HTTP/3**', '2022', '**QUIC over UDP**', 'Removes TCP head-of-line blocking; TLS built in'],
      ],
    ),

    h('1.1 — keep-alive, and six connections'),
    p(
      'HTTP/1.1 keeps the TCP connection open after a response so the next request skips the handshake. What it does **not** do is allow two requests in flight at once: a connection carries one request and its response, then the next. A slow response blocks everything queued behind it — application-level head-of-line blocking.',
    ),
    p(
      'Browsers worked around it by opening **six connections per host**, and web developers worked around *that* with tricks that are now obsolete:',
    ),
    table(
      ['1.1-era trick', 'Why', 'Under HTTP/2'],
      [
        ['**Domain sharding** — assets on `img1.`, `img2.`', 'More hosts, more parallel connections', '**Harmful** — defeats one-connection multiplexing'],
        ['**Concatenating** CSS and JS into one bundle', 'Fewer requests', 'Much less important; hurts caching granularity'],
        ['**Sprite sheets** — one image of many icons', 'Fewer requests', 'Obsolete'],
        ['**Inlining** assets as data URIs', 'Fewer requests', 'Usually harmful — uncacheable'],
      ],
    ),
    warn(
      'These are still in codebases and still in blog posts. Under HTTP/2 they range from pointless to actively slower. If you name them in an interview, name them as *history* — “that was the 1.1 workaround; H2 made it counterproductive”.',
    ),

    h('2 — one connection, many streams'),
    p('HTTP/2 keeps the same semantics — same methods, same status codes, same headers — and changes only how they are put on the wire:'),
    ul(
      '**Binary framing.** Messages become frames with stream IDs instead of text lines. No more parsing ambiguity, and interleaving becomes possible.',
      '**Multiplexing.** Many requests and responses share one connection, interleaved. Six connections become one.',
      '**HPACK header compression.** Repeated headers — cookies, user agent, accept — are sent once and referenced. On a typical request the headers were larger than the body.',
      '**Stream priority.** The client can say the stylesheet matters more than the tracking pixel.',
      '**Server push.** Send assets before they are asked for. It disappointed everyone, was hard to get right, and browsers have removed support — mention it as a footnote, not a feature.',
    ),
    note(
      'HTTP/2 in practice is always over TLS. The spec permits cleartext; no browser implements it. Which means "upgrading to HTTP/2" and "having HTTPS" arrive together.',
    ),

    h('What HTTP/2 did not fix'),
    p(
      'All those streams still ride **one TCP connection**, and TCP delivers one ordered byte stream. A single lost segment stalls delivery of every stream sharing it — the browser is waiting for a retransmission of a chunk of a font while your JSON, already arrived, sits undeliverable in a kernel buffer.',
    ),
    p(
      'On a good network this rarely matters. On a lossy mobile link it matters a great deal, and it is precisely why HTTP/2 can be *slower* than six HTTP/1.1 connections when packet loss is high: with six connections a loss stalls one sixth of the work.',
    ),

    h('3 — QUIC, and why UDP'),
    p(
      'HTTP/3 runs on **QUIC**, which runs on **UDP**. That is not a retreat from reliability; QUIC rebuilds it in user space, per stream, and adds encryption to the transport itself:',
    ),
    table(
      ['QUIC feature', 'Means'],
      [
        ['**Per-stream ordering**', 'A loss stalls only the stream that lost a packet — head-of-line blocking gone'],
        ['**TLS 1.3 built in**', 'Connection setup and encryption in **one** round trip, not two'],
        ['**0-RTT resumption**', 'A returning client can send data in the very first packet'],
        ['**Connection IDs**', 'The connection survives a change of IP — WiFi to cellular does not drop your download'],
        ['**User-space implementation**', 'Congestion control can be improved by shipping a library, not by updating every kernel on earth'],
      ],
    ),
    p(
      'That last point is the strategic one. TCP improvements need operating system updates and middlebox cooperation, which takes a decade. QUIC ships with the browser and the server.',
    ),
    tip(
      'The connection-ID answer is the one that makes an interviewer nod: with TCP, a connection *is* the four-tuple, so changing network changes the tuple and kills the connection. QUIC identifies a connection by an ID that survives the address change — which is why a video keeps playing as you leave the house.',
    ),
    warn(
      'Because it is UDP, HTTP/3 is blocked by some corporate firewalls that allow only TCP 443. Clients fall back to HTTP/2 automatically, so this is a graceful degradation rather than an outage — but it is why H3 adoption numbers are lower than they “should” be.',
    ),

    h('What this means for you'),
    ul(
      'You get HTTP/2 and HTTP/3 by putting a modern CDN or load balancer in front — CloudFront, an ALB, Cloudflare, nginx. **Your Node server almost certainly still speaks HTTP/1.1 to that proxy, and that is fine**: the slow, lossy, long-distance hop is the one in front of it.',
      'Stop sharding domains and stop inlining. Do keep hashed filenames and long cache lifetimes.',
      'Keep-alive and connection pooling still matter for **server-to-server** calls, which are usually still HTTP/1.1.',
    ),
    code(
      sh(`
curl -I --http2 https://example.com        # HTTP/2 200
curl -I --http3 https://example.com        # if your curl was built with it
# Chrome devtools -> Network -> right-click the columns -> Protocol
`),
    ),

    h('Cheatsheet'),
    cheat([
      ['Reuse a connection', 'HTTP/1.1 keep-alive — still the default server-to-server'],
      ['Parallel requests on one connection', 'HTTP/2 multiplexing'],
      ['Shrink repeated headers', 'HTTP/2 HPACK'],
      ['Survive packet loss on mobile', 'HTTP/3 — per-stream ordering'],
      ['Survive a network change mid-download', 'HTTP/3 connection IDs'],
      ['Speed up a site today', 'Put a CDN in front; it speaks H2/H3 to users for you'],
      ['Spot obsolete advice', 'Domain sharding, sprites, inlining — all 1.1-era'],
    ]),

    h('Interview'),
    asked([
      ['What did HTTP/1.1 add?', 'Persistent connections (keep-alive) and the Host header, enabling virtual hosting.'],
      ['What did HTTP/2 change?', 'Binary framing, multiplexed streams on one connection, and header compression — same semantics, new wire format.'],
      ['Why is domain sharding bad now?', 'It splits traffic across connections that HTTP/2 was designed to merge, losing multiplexing and compression.'],
      ['What did HTTP/2 fail to fix?', 'TCP-level head-of-line blocking — all streams share one ordered byte stream.'],
      ['Why does HTTP/3 use UDP?', 'QUIC implements per-stream ordering, congestion control and TLS in user space, avoiding TCP’s single stream and kernel upgrade cycle.'],
      ['What is 0-RTT?', 'A resumed QUIC connection carrying application data in its first packet, at the cost of replay risk for non-idempotent requests.'],
      ['Does my Node server need HTTP/2?', 'Usually not — the proxy or CDN in front speaks it to clients over the slow hop.'],
    ]),

    links(
      mdn('Web/HTTP/Guides/Evolution_of_HTTP', 'Evolution of HTTP'),
      rfc(9113, 'RFC 9113 — HTTP/2'),
      rfc(9114, 'RFC 9114 — HTTP/3'),
    ),
  ],
};
