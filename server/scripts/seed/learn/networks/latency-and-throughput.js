import { asked, cheat, code, h, links, note, p, sh, table, tip, ul, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Four words get used interchangeably and mean four different things. Getting them straight is worth a page on its own, because most performance arguments — “add more bandwidth”, “the server is fast, why is the page slow” — are really a confusion between two of them.',
    ),

    h('The four words'),
    table(
      ['Term', 'Is', 'Unit', 'Analogy — a pipe'],
      [
        ['**Latency**', 'Time for one message to arrive', 'ms', 'How long the pipe is'],
        ['**Bandwidth**', 'Theoretical capacity per second', 'Mbps', 'How wide the pipe is'],
        ['**Throughput**', 'What you *actually* get', 'Mbps', 'How much water really flows'],
        ['**Jitter**', 'Variation in latency', 'ms', 'Whether the flow is steady'],
      ],
    ),
    p(
      '**RTT** — round-trip time — is the one you measure, and it is roughly twice the one-way latency. `ping` reports it. Every handshake in this track costs at least one RTT, which is why RTT dominates the experience of a small request and bandwidth barely touches it.',
    ),
    tip(
      'Say this in an interview and it lands: **bandwidth is how wide the road is, latency is how long it is.** Adding lanes does not shorten the journey. A 1 Gbps link to Sydney still has a 250 ms round trip, and a page that makes ten sequential requests will take at least 2.5 seconds no matter how wide the pipe.',
    ),

    h('Where latency comes from'),
    table(
      ['Component', 'Cause', 'Fixable by'],
      [
        ['**Propagation**', 'Distance ÷ speed of light in fibre (~200,000 km/s)', 'Being closer — a CDN, another region'],
        ['**Transmission**', 'Pushing the bits onto the wire', 'More bandwidth'],
        ['**Queuing**', 'Waiting in router buffers', 'Less congestion, better queue management'],
        ['**Processing**', 'Routers, proxies, TLS, your app', 'Fewer hops, faster code'],
      ],
    ),
    p(
      'Only the second of those is helped by bandwidth, and only the first is a law of physics. **A CDN is the only tool that attacks propagation delay**, which is exactly why it is the highest-leverage change for a global audience.',
    ),

    h('The numbers worth memorising'),
    table(
      ['Operation', 'Roughly'],
      [
        ['L1 cache reference', '1 ns'],
        ['Main memory reference', '100 ns'],
        ['SSD random read', '~100 µs'],
        ['Round trip **within a data centre**', '**0.5 ms**'],
        ['Round trip **within a region / city**', '**1–5 ms**'],
        ['Read 1 MB sequentially from SSD', '~1 ms'],
        ['Round trip **cross-country** (e.g. London–Frankfurt)', '**10–20 ms**'],
        ['Round trip **transatlantic** (London–New York)', '**70–90 ms**'],
        ['Round trip **halfway round the world**', '**200–300 ms**'],
        ['Mobile network first hop (4G / 5G)', '~50 ms / ~10 ms'],
      ],
    ),
    note(
      'These are the classic “latency numbers every programmer should know”, trimmed to the network rows. The shape is what matters: **memory is a hundred thousand times faster than a cross-ocean round trip.** Any design answer about caching is really an argument about which row you are landing on.',
    ),

    h('The cost of a first request'),
    p('Add up what happens before a single byte of HTML arrives on a cold connection, on a 70 ms transatlantic path:'),
    table(
      ['Step', 'Round trips', 'Cost at 70 ms RTT'],
      [
        ['DNS lookup (uncached)', '1–2', '70–140 ms'],
        ['TCP handshake', '1', '70 ms'],
        ['TLS 1.3 handshake', '1', '70 ms'],
        ['HTTP request and response', '1', '70 ms'],
        ['**Total before the first byte**', '**4–5**', '**~280–350 ms**'],
      ],
    ),
    p(
      'Your server’s 5 ms of processing is a rounding error inside that. And then TCP slow start means a large response takes several more round trips to actually transfer. This table is the single best argument for connection reuse, HTTP/2, TLS 1.3 and a CDN — all four of which attack the round trips rather than the server.',
    ),
    warn(
      'The corollary is the one that catches people: **a page that makes sequential requests multiplies all of this.** Ten waterfalled API calls at 100 ms each is a second of nothing happening. Parallelise, or collapse them into one endpoint — that is a networking fix, not a backend one.',
    ),

    h('Percentiles, not averages'),
    p(
      'An average latency hides the users having a bad time. Report **p50, p95, p99**: the median, and the slowest 5% and 1%.',
    ),
    ul(
      'p50 is what a typical user sees. p99 is what your *worst* requests do — and at scale, that is a lot of real people.',
      '**Tail latency amplifies with fan-out.** If a request touches 10 services each with a 1% chance of being slow, roughly 10% of requests hit at least one slow dependency. This is why p99 gets worse as an architecture gets more distributed, and it is a great thing to raise unprompted in a design interview.',
      'Timeouts should be set from the p99, not the average, or you will cut off requests that were about to succeed.',
    ),

    h('Measuring it'),
    code(
      sh(`
ping example.com                     # RTT, and jitter in the variation
mtr example.com                      # per-hop latency and loss — traceroute + ping
curl -w '@-' -o /dev/null -s https://example.com <<'FMT'
  dns:      %{time_namelookup}s
  connect:  %{time_connect}s
  tls:      %{time_appconnect}s
  ttfb:     %{time_starttransfer}s
  total:    %{time_total}s
FMT
`),
    ),
    p(
      'That `curl` breakdown is the most useful single command in this track: it tells you whether a slow request was DNS, connection setup, TLS, the server thinking, or the download — and each of those has a completely different fix.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Reduce distance', 'A CDN, or a region closer to users'],
      ['Reduce round trips', 'Keep-alive, HTTP/2, TLS 1.3, fewer sequential requests'],
      ['Move more bytes over a long link', 'Larger windows, or parallel connections'],
      ['Find where the time went', '`curl -w` with the timing fields'],
      ['See per-hop loss and latency', '`mtr`'],
      ['Report performance honestly', 'p50, p95, p99 — never the average'],
      ['Set a timeout', 'From the p99, plus headroom'],
    ]),

    h('Interview'),
    asked([
      ['Latency vs bandwidth vs throughput?', 'Time for one message, theoretical capacity, and what you actually achieve — length, width, and real flow.'],
      ['Why does more bandwidth not make my site faster?', 'Small requests are dominated by round trips, and propagation delay is set by distance, not capacity.'],
      ['How many round trips before the first byte?', 'About four cold: DNS, TCP, TLS 1.3, then the request.'],
      ['What is RTT and what depends on it?', 'Round-trip time; every handshake, every sequential request and TCP’s throughput ceiling.'],
      ['Why report p99 rather than the average?', 'Averages hide the tail, and with fan-out a small per-service tail becomes a large per-request one.'],
      ['A request is slow — how do you find out where?', '`curl -w` to split DNS, connect, TLS, time-to-first-byte and transfer; `mtr` for the path.'],
    ]),

    links(
      wiki('Network_delay', 'Network delay'),
      wiki('Bandwidth-delay_product', 'Bandwidth-delay product'),
      wiki('Tail_latency', 'Tail latency'),
    ),
  ],
};
