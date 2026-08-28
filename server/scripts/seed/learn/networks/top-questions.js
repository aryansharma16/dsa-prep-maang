import { asked, cheat, h, links, note, p, tip, wiki } from '../blocks.js';

/*
  Forty questions, grouped the way an interview actually walks: the opener, then
  the layer they poke at, then the design questions, then the ones that are
  really "have you run this in production". Answers are one or two lines because
  that is the length an answer should be *out loud* — the topic pages carry the
  depth, and this page is a check that you can say the thing.
*/
export const doc = {
  blocks: [
    p(
      'Forty questions in the order they tend to arrive, each answered in the length you would actually say it. If an answer here feels thin, that is deliberate — it is a prompt, and the topic it came from has the depth. Read this the night before; read the topics the week before.',
    ),
    tip(
      'Two habits are worth more than any single answer. **Answer in one sentence, then offer the detail** — “TCP is reliable and ordered, UDP is neither; shall I go into how TCP achieves that?” And **say the trade-off**, not just the fact. Interviewers are testing judgement far more often than recall.',
    ),

    h('The openers'),
    asked([
      ['What happens when you type a URL and press Enter?', 'DNS resolves the name, TCP connects, TLS handshakes, an HTTP GET goes out, a CDN or load balancer answers, and the browser parses and renders, fetching subresources as it goes.'],
      ['Walk me through the OSI model.', 'Seven layers, physical to application; each serves the one above and hides the one below. TCP/IP collapses it to four in practice.'],
      ['TCP vs UDP?', 'TCP is connection-oriented, reliable, ordered and congestion-controlled. UDP is a fire-and-forget datagram with an 8-byte header. Pick UDP when late data is worthless.'],
      ['What is an IP address versus a MAC address?', 'IP is where you are — hierarchical and routable end to end. MAC is who you are — flat, and only meaningful on the local wire.'],
      ['What is DNS?', 'A distributed, cached, hierarchical directory turning names into addresses, walked root → TLD → authoritative and cached at every level for the record’s TTL.'],
    ]),

    h('Layer 2 and 3'),
    asked([
      ['Switch vs router?', 'A switch forwards frames by MAC inside one network; a router forwards packets by IP between networks, and stops broadcasts.'],
      ['What does ARP do?', 'Broadcasts “who has this IP” on the local network and caches the MAC that replies.'],
      ['Does the IP change as a packet crosses the internet?', 'No — unless NAT rewrites it. The MAC changes at every hop.'],
      ['What is a default gateway?', 'The router a host sends anything outside its own subnet to.'],
      ['Explain CIDR — what does /24 mean?', '24 bits of network prefix, 8 host bits: 256 addresses, 254 usable, 251 on AWS.'],
      ['What is NAT and why does it exist?', 'Rewriting private source addresses to one public address, tracked by port. It exists because IPv4 ran out.'],
      ['How does a router choose a route?', 'Longest prefix match, then forward to that next hop, decrementing TTL.'],
      ['What is BGP?', 'How autonomous systems advertise which prefixes they can reach. It trusts announcements, which is why hijacks and route leaks take sites offline.'],
    ]),

    h('Transport'),
    asked([
      ['Describe the three-way handshake.', 'SYN with the client’s sequence number, SYN-ACK with the server’s acknowledging it, ACK acknowledging the server’s. Two directions, each announced and acknowledged.'],
      ['Why is closing four packets?', 'Each direction closes independently, so there is a half-closed state where one side is still sending.'],
      ['What is TIME_WAIT?', 'The last closer waits ~60 s to absorb delayed duplicates and to resend the final ACK if needed.'],
      ['What does a pile of CLOSE_WAIT mean?', 'Your application is not closing sockets after the peer sent FIN — a leak in your code.'],
      ['What is a socket?', 'One endpoint of a connection; a connection is identified by the five-tuple of protocol and both IP/port pairs.'],
      ['How do 10,000 clients share port 443?', 'The port is one fifth of the identity — each connection has a distinct tuple, and the server keeps one socket per client.'],
      ['What is TCP slow start?', 'A new connection begins with a small window and doubles each round trip, so early requests are slower — which is the real argument for connection reuse.'],
      ['What is head-of-line blocking?', 'One stalled item blocking everything behind it: a lost TCP segment, or a slow HTTP/1.1 request on a connection. QUIC fixes the TCP-level case.'],
    ]),

    h('The web layer'),
    asked([
      ['Safe vs idempotent?', 'Safe changes nothing; idempotent means repeating has the same effect as doing it once — which is what makes automatic retries safe.'],
      ['401 vs 403?', 'Not authenticated versus authenticated but not permitted.'],
      ['502 vs 504?', '502 is a bad or missing upstream response; 504 is upstream not answering in time.'],
      ['Walk me through the TLS handshake.', 'ClientHello with ciphers and a key share, ServerHello with the certificate, the client validates the chain, both derive a session key, then symmetric encryption. TLS 1.3 does it in one round trip.'],
      ['Why both asymmetric and symmetric encryption?', 'Asymmetric agrees a secret with a stranger and proves identity but is slow; symmetric carries the data.'],
      ['What does a certificate prove?', 'That this public key belongs to this hostname, vouched for by a CA. Identity, not honesty.'],
      ['What is a CORS error, really?', 'The browser sent the request and then refused to hand your JavaScript the response, because the server did not permit that origin to read it.'],
      ['What triggers a CORS preflight?', 'Anything beyond GET/HEAD/POST, a JSON content type, or custom headers such as Authorization.'],
      ['What did HTTP/2 change, and what did it not fix?', 'Multiplexing, binary framing and header compression on one connection — but all streams still share one TCP stream, so a loss stalls all of them.'],
      ['WebSockets vs SSE vs polling?', 'Two-way persistent socket after a 101 upgrade; one-way streamed HTTP that reconnects itself; repeated requests. Pick the simplest that fits the direction and volume.'],
    ]),

    h('Systems and scale'),
    asked([
      ['Forward vs reverse proxy?', 'A forward proxy acts for clients and hides them; a reverse proxy acts for servers and hides them.'],
      ['L4 vs L7 load balancer?', 'L4 forwards by IP and port without reading the payload; L7 parses HTTP and routes on path, host or cookie — and must terminate TLS.'],
      ['Which load balancing algorithm and why?', 'Least connections by default: request durations vary, and round robin ignores what a server is already busy with.'],
      ['How does a CDN make a site faster?', 'It serves a cached copy from a point of presence near the user, cutting round-trip time and offloading the origin.'],
      ['How do you invalidate a cached asset?', 'You do not — content-hashed filenames make each build a new URL. Purges are for emergencies.'],
      ['Latency vs bandwidth?', 'Length of the road versus width of it. Adding lanes does not shorten the journey.'],
      ['How would you fail over between regions?', 'DNS health checks with failover or latency routing on short-TTL records, with the data layer replicated.'],
      ['How do you defend against DDoS?', 'Absorb volumetric traffic upstream at a CDN, then rate limit, cache and autoscale at layer 7.'],
    ]),

    h('The cloud and the production ones'),
    asked([
      ['What makes a subnet public?', 'A route table entry sending 0.0.0.0/0 to an internet gateway. Nothing else.'],
      ['Security group vs NACL?', 'Instance-level, stateful, allow-only versus subnet-level, stateless, allow-and-deny in order — and stateless means you must permit the ephemeral return ports.'],
      ['How does a private instance reach the internet?', 'Outbound through a NAT gateway in a public subnet; nothing can initiate inbound.'],
      ['Connection refused vs timeout?', 'Refused means you reached the host and nothing was listening. A timeout means the packet was dropped — firewall, security group or route.'],
      ['A service is slow — how do you find out where?', 'Split the request: `curl -w` for DNS, connect, TLS, time to first byte and transfer; `mtr` for the path; then application traces.'],
      ['Requests fail after exactly 60 seconds — why?', 'An idle timeout, commonly a load balancer default. Timeouts must decrease outward: client > LB > app > database.'],
    ]),

    note(
      'If you can answer the bold half of these without looking, you are past the bar for a backend or full-stack interview’s networking round. The remainder are the ones that separate “knows the words” from “has debugged this at 3am” — and those are answered by having actually run the commands in `the-tools`, not by rereading.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Open strong', 'One sentence, then offer to go deeper'],
      ['Sound senior', 'Name the trade-off, not just the fact'],
      ['Handle the URL question', 'Six beats, ten seconds each, and reach the render'],
      ['Handle a debugging question', 'Narrate the elimination: name → port → app → timings'],
      ['Recover from a blank', 'Say which layer it belongs to and reason forward from there'],
    ]),

    links(
      wiki('Internet_protocol_suite', 'Internet protocol suite'),
      wiki('Computer_network', 'Computer network'),
    ),
  ],
};
