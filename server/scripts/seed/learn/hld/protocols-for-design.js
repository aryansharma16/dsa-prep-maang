import { asked, diagram, h, links, p, quick, table, tip, tradeoff, warn, wiki } from '../blocks.js';
import { seeAlso } from './shapes.js';

export const doc = {
  blocks: [
    p(
      'Four protocol choices come up in almost every design round: **TCP or UDP, which HTTP version, how services talk to each other, and whether connections are reused.** None of them is exotic, and each one changes the numbers in your estimate.',
    ),

    h('TCP versus UDP'),
    diagram(
      `
   TCP                               UDP
   ───                               ───
   handshake before data             just send
   ordered                           any order
   retransmits lost packets          lost is lost
   congestion control                you implement it or you do not

   ┌───┐ SYN      ┌───┐              ┌───┐ ──────▶ ┌───┐
   │ A │─────────▶│ B │              │ A │         │ B │
   │   │◀─SYN-ACK─│   │              └───┘ no ack, no wait
   │   │──ACK────▶│   │
   └───┘ then data└───┘              ✓ no head-of-line blocking
                                     ✓ lowest possible latency
   ✓ you never think about it        ✗ you own reliability
   ✗ one lost packet stalls          → video, games, DNS, QUIC
     everything behind it
`,
      'Reliability, and what it costs',
    ),
    table(
      ['Use TCP for', 'Use UDP for'],
      [
        ['APIs, web, databases — anything where a missing byte is a bug', 'Live video and audio, where a late packet is worthless'],
        ['File transfer', 'Games, where the next update supersedes the lost one'],
        ['Anything you would rather not reimplement', 'DNS — one small request, one small answer'],
        ['', 'QUIC/HTTP3, which rebuilds reliability on top with better properties'],
      ],
    ),
    tip(
      'The interview-worthy line: **a retransmitted video frame arrives after it was needed.** For real-time media, reliability is not just unnecessary, it is actively harmful — which is why UDP wins there and nowhere else.',
    ),

    h('HTTP versions, and why they matter to a design'),
    table(
      ['', 'HTTP/1.1', 'HTTP/2', 'HTTP/3'],
      [
        ['Transport', 'TCP', 'TCP', '**UDP (QUIC)**'],
        ['Concurrency', 'One request per connection', 'Multiplexed on one connection', 'Multiplexed, independent streams'],
        ['Head-of-line blocking', 'At the connection', 'At the **TCP** layer', '**None**'],
        ['Headers', 'Plain text, repeated', 'Compressed (HPACK)', 'Compressed (QPACK)'],
        ['Connection setup', 'TCP + TLS', 'TCP + TLS', '**0-RTT resumption**'],
        ['Design impact', '6 connections per host; domain sharding', 'One connection; sharding now hurts', 'Best on lossy mobile networks'],
      ],
    ),
    warn(
      'Domain sharding — splitting assets across `img1.`, `img2.` — was a real HTTP/1.1 optimisation and is **actively harmful under HTTP/2**, because it forces multiple connections where one multiplexed connection was the point. Old advice that became a bug.',
    ),

    h('Service-to-service: REST, gRPC, GraphQL'),
    tradeoff([
      ['**REST**', 'Universal, cacheable by any proxy, debuggable with curl, no tooling', 'Chatty, over-fetches, no schema unless you add one'],
      ['**gRPC**', 'Binary and fast, typed contracts, streaming, code generation', 'Not browser-native, opaque to inspect, needs HTTP/2 all the way'],
      ['**GraphQL**', 'One round trip, the client asks for exactly what it needs', 'HTTP caching barely works, one query can be arbitrarily expensive'],
    ]),
    table(
      ['Use', 'When'],
      [
        ['**REST**', 'Public APIs, anything a browser calls directly, anything that should be cacheable'],
        ['**gRPC**', 'Internal service-to-service, especially high-volume or streaming'],
        ['**GraphQL**', 'Many clients with different data needs, particularly mobile over slow networks'],
      ],
    ),
    tip(
      'The common production answer is **all three**: gRPC between services, REST at the public edge, and a GraphQL BFF for the mobile app. Saying that is better than defending one as universally correct.',
    ),

    h('Connection reuse'),
    p(
      'Opening a TCP connection costs a round trip; adding TLS costs another. At 5ms per round trip inside a data centre that is invisible, and at 150ms across an ocean it is your entire latency budget.',
    ),
    diagram(
      `
   NO POOLING                        POOLED / KEEP-ALIVE

   per request:                      per request:
     TCP handshake    1 RTT            (already open)
     TLS handshake    1-2 RTT          request          1 RTT
     request          1 RTT
     ─────────────────────             ─────────────────────
     3-4 RTT                           1 RTT

   at 150ms RTT: 450-600ms           at 150ms RTT: 150ms
   vs
   at 1ms RTT:   3-4ms               at 1ms RTT: 1ms

   the pool matters MOST on the paths you control LEAST.
`,
      'Where the round trips go',
    ),
    table(
      ['Pool', 'Watch for'],
      [
        ['**HTTP client pool**', 'Default sizes are often tiny; a slow dependency exhausts it and blocks everything'],
        ['**Database pool**', 'Pool size × app instances must not exceed the database\'s connection limit'],
        ['**gRPC channel**', 'One channel multiplexes many calls — do not create one per request'],
        ['**Keep-alive timeouts**', 'Must be shorter on the client than the server, or you race a closing connection'],
      ],
    ),
    warn(
      'Connection pool exhaustion is one of the most common production incidents and it **looks like a slow database**. In reality all pool slots are held by requests waiting on one slow dependency, and everything else queues behind them. Timeouts, not a bigger pool, are the fix.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'The protocol choices that change a design\'s latency and cost'],
      ['Why it matters', 'They set the round-trip count, and round trips are the latency budget'],
      ['Use when', 'Choosing inter-service communication, or explaining where latency went'],
      ['Trade-off', 'Binary and typed protocols are fast and opaque; text and REST are slow and universal'],
      [
        '30-second answer',
        '"TCP unless a late packet is worthless — video, games, DNS — where UDP wins because a retransmitted frame arrives too late to use. HTTP/2 multiplexes on one connection, so old tricks like domain sharding now hurt. Between services I would use gRPC for typed, high-volume internal calls, REST at the public edge because it is cacheable and debuggable, and GraphQL where many clients need different shapes. And pool connections — handshakes are round trips, and round trips are the budget."',
      ],
    ]),
    asked([
      ['When would you use UDP?', 'Live media, games, DNS — anywhere a retransmission arrives too late to be useful.'],
      ['gRPC or REST between services?', 'gRPC internally for speed and typed contracts; REST at the edge for cacheability and debuggability.'],
      ['Why does GraphQL complicate caching?', 'Everything is a POST to one endpoint, so HTTP caches cannot key on the URL.'],
      ['Why does connection pooling matter?', 'A handshake is 2–4 round trips. On a 150ms link that is the whole latency budget.'],
      ['What breaks when a pool is exhausted?', 'Everything queues behind one slow dependency. The fix is timeouts, not a bigger pool.'],
    ]),

    seeAlso('Computer Networks', 'TCP vs UDP', 'the segment structure, handshake and congestion control in detail'),
    links(
      wiki('QUIC', 'QUIC'),
      wiki('GRPC', 'gRPC'),
    ),
  ],
};
