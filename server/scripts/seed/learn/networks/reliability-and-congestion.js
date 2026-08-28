import { asked, cheat, code, h, links, note, p, rfc, sh, table, tip, ul, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'The network drops, duplicates, delays and reorders packets as a matter of routine. TCP hands your application an ordered, complete byte stream anyway. This page is how — and the *how* matters to you because it explains why a small request over a long distance is slow for reasons that have nothing to do with your server.',
    ),

    h('Sequence numbers and acknowledgements'),
    p(
      'Every byte in a TCP stream has a number. The receiver acknowledges the **next byte it expects**, which implicitly confirms everything before it. If a segment goes missing, the receiver keeps acknowledging the same number, and those **duplicate ACKs** are the sender’s signal that something was lost.',
    ),
    code(
      sh(`
sender                                 receiver
  --- seq 1000, 500 bytes ---------->   ack 1500   "got up to 1499"
  --- seq 1500, 500 bytes --X           (lost)
  --- seq 2000, 500 bytes ---------->   ack 1500   "still waiting for 1500"  (dup ACK)
  --- seq 2500, 500 bytes ---------->   ack 1500   (dup ACK)
  --- seq 1500 RETRANSMIT ---------->   ack 3000   "got everything now"
`),
    ),
    p(
      'Three duplicate ACKs trigger a **fast retransmit** — resend immediately rather than waiting for a timeout. The timeout path, **RTO**, is the fallback and is much slower: it starts around the measured round-trip time and doubles on each further failure.',
    ),
    note(
      'The receiver held segments 2000 and 2500 the whole time. It could not *deliver* them to the application, because the application is promised bytes in order. That gap is head-of-line blocking, and it comes back at the bottom of this page.',
    ),

    h('The sliding window — flow control'),
    p(
      'Waiting for an ACK after every segment would limit you to one segment per round trip: on a 100 ms link, about 15 KB/s. Instead the receiver advertises a **window** — "I have room for 64 KB unacknowledged" — and the sender may have that much in flight at once.',
    ),
    code(
      sh(`
window = 64 KB
[ acked ][ sent, awaiting ack ][ may send now ][ not yet allowed ]
          └──────── 64 KB in flight ─────────┘
   as ACKs arrive, the whole window slides right
`),
    ),
    p(
      'This is **flow control**, and it protects the *receiver*: a slow phone tells a fast server to stop by shrinking its advertised window, down to zero if it must. It is the same idea as backpressure in a stream, one layer down — and it is why "the receiver was slow" can cap throughput with no packet loss at all.',
    ),

    h('The bandwidth–delay product'),
    p(
      'The maximum throughput of a single TCP connection is `window ÷ round-trip time`. That formula explains a genuinely common production surprise:',
    ),
    table(
      ['Window', 'RTT', 'Max throughput'],
      [
        ['64 KB', '10 ms (same region)', '~52 Mbps'],
        ['64 KB', '100 ms (across an ocean)', '~5 Mbps'],
        ['1 MB (scaled)', '100 ms', '~84 Mbps'],
      ],
    ),
    warn(
      'A gigabit link between London and Sydney will not give one connection anything near a gigabit. Distance caps a single stream regardless of bandwidth — which is why bulk transfer tools open many connections in parallel, and why a CDN’s real trick is shortening the RTT rather than adding capacity.',
    ),

    h('Congestion control — protecting the network'),
    p(
      'Flow control protects the receiver. **Congestion control** protects everything in between, and it is TCP’s most consequential behaviour: the sender guesses how much the *network* will take, and treats packet loss as the signal that it guessed too high.',
    ),
    table(
      ['Phase', 'Behaviour'],
      [
        ['**Slow start**', 'Begin with ~10 segments (~14 KB) in flight and **double** every round trip'],
        ['**Congestion avoidance**', 'Past a threshold, grow by one segment per RTT instead — cautious, linear'],
        ['**Loss**', 'Halve the window (or more) and back off'],
        ['**Recovery**', 'Climb again'],
      ],
    ),
    p(
      'The name is misleading — slow start ramps up *exponentially* — but the beginning is genuinely slow, and it is why the first request on a new connection is slower than the tenth. A 100 KB response over a fresh connection takes several round trips before the window is even large enough to send it in one go.',
    ),
    tip(
      'This is the real argument for **connection reuse**, and it is stronger than the handshake argument. A warm connection has already discovered how fast the path is. Every new connection re-learns it from scratch. Keep-alive, pooled HTTP agents and HTTP/2 multiplexing all cash in the same benefit.',
    ),
    note(
      'Modern Linux defaults to **BBR** or CUBIC rather than the classic loss-based algorithms. BBR models the path’s bandwidth and latency directly instead of waiting for loss, which works much better on links that buffer heavily. Worth naming; not worth tuning unless you own the servers on both ends.',
    ),

    h('Head-of-line blocking, at two layers'),
    ul(
      '**At TCP:** one lost segment stalls delivery of every byte behind it, even bytes that already arrived. Unavoidable — ordering is the promise.',
      '**At HTTP/1.1:** one connection carries one request at a time, so a slow response blocks the queue behind it. Browsers worked around it by opening six connections per host.',
      '**At HTTP/2:** many streams are multiplexed on one TCP connection, so the *application* blocking is gone — but a single lost TCP segment still stalls **all** the streams, because they share one ordered byte stream.',
      '**At HTTP/3:** QUIC gives each stream its own sequencing over UDP, so a loss affecting one stream leaves the others moving. This is the whole reason HTTP/3 exists.',
    ),

    h('Two knobs you might actually touch'),
    table(
      ['Setting', 'Does', 'When'],
      [
        ['`TCP_NODELAY`', 'Disables Nagle’s algorithm, which coalesces small writes', 'Latency-sensitive small messages — games, RPC, interactive shells'],
        ['Keep-alive / pooling', 'Reuses warm connections', 'Always, for any HTTP client in a loop'],
      ],
    ),
    p(
      'Nagle plus delayed ACKs is a famous 40 ms stall: one side holds a small write waiting for more data, the other holds its ACK waiting for a response. Both wait. If you have ever seen a suspiciously regular 40 ms in a trace, that is the pair.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Guarantee order and delivery', 'Sequence numbers plus cumulative ACKs and retransmission'],
      ['Protect a slow receiver', 'Flow control — the advertised window'],
      ['Protect the network', 'Congestion control — slow start, then back off on loss'],
      ['Explain slow first requests', 'Handshakes plus slow start on a cold connection'],
      ['Raise throughput over long distance', 'Bigger windows, or more connections — RTT is the cap'],
      ['Avoid the 40 ms stall', '`TCP_NODELAY` for small interactive writes'],
      ['Escape TCP head-of-line blocking', 'HTTP/3 over QUIC'],
    ]),

    h('Interview'),
    asked([
      ['How does TCP guarantee delivery and order?', 'Numbered bytes, cumulative acknowledgements, retransmission on duplicate ACKs or timeout, and reordering at the receiver.'],
      ['Flow control vs congestion control?', 'Flow control protects the receiver via its advertised window; congestion control protects the network by inferring capacity from loss.'],
      ['What is slow start?', 'A new connection starts with a small window and doubles it each RTT until loss or a threshold — so early requests are slower.'],
      ['What caps a single connection’s throughput?', 'Window size divided by round-trip time — the bandwidth-delay product.'],
      ['What is head-of-line blocking?', 'A stalled item blocking everything behind it — a lost TCP segment, or a slow HTTP/1.1 request on a connection.'],
      ['Why does HTTP/2 not fix it completely?', 'Its streams share one TCP connection, so one lost segment still stalls all of them; QUIC gives each stream its own ordering.'],
      ['Why reuse connections?', 'To skip the handshakes and keep a window that has already discovered the path’s capacity.'],
    ]),

    links(
      wiki('TCP_congestion_control', 'TCP congestion control'),
      wiki('Head-of-line_blocking', 'Head-of-line blocking'),
      rfc(5681, 'RFC 5681 — TCP congestion control'),
    ),
  ],
};
