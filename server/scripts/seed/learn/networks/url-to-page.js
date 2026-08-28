import { asked, cheat, code, h, links, mdn, note, p, sh, table, tip, ul, warn, wiki } from '../blocks.js';

/*
  The single most asked networking question there is, and the one topic in the
  track that is deliberately a *narrative*: every other page can be read on its
  own, and this one is the string they hang on.

  It carries two answers on purpose — the sixty-second one you actually say, and
  the long one underneath it — because the failure mode in an interview is not
  knowing too little, it is starting at ARP and never reaching the render.
*/
export const doc = {
  blocks: [
    p(
      '“What happens when you type `google.com` and press Enter?” is the most asked networking question in software interviews, and it is asked because it is a *thread*: the interviewer can stop you anywhere and pull. This page is that thread end to end, and then the short version you should actually say out loud.',
    ),

    h('The sixty-second answer'),
    p('Say this first, in this order, and let them stop you where they are interested:'),
    ul(
      '**1. Resolve the name.** The browser checks its caches, then the OS, then asks a DNS resolver, which walks root → TLD → authoritative until it has an IP.',
      '**2. Reach the first hop.** The OS compares the IP with its own subnet, decides it is remote, and ARPs for the router’s MAC to send the frame there.',
      '**3. Open a connection.** TCP three-way handshake to port 443, then a TLS handshake — certificate checked, keys agreed.',
      '**4. Ask.** One HTTP `GET`, with headers and cookies, over that encrypted connection.',
      '**5. Get answered.** Probably by a CDN edge, or a load balancer that picks a healthy server, which runs the app and maybe queries a database.',
      '**6. Render.** The browser parses HTML, discovers CSS, JS and images, and fetches them — mostly over the same connection — building the DOM and painting.',
    ),
    tip(
      'Six beats, about ten seconds each. Interviewers are listening for whether you know the *order* and can name the protocol at each step — not for the TCP flag diagram. Get to the render; then go deep wherever they ask.',
    ),

    h('Now the long version'),

    h('1 — The browser looks at what you typed'),
    p(
      'Before any network activity: is it a URL or a search phrase? Is there an HSTS entry saying this host must be HTTPS (so `http://` is rewritten before a packet leaves)? Is there a service worker that can answer from its own cache offline? Only then does it parse the URL into scheme, host, port, path, query and fragment — and the **fragment never leaves the browser**.',
    ),

    h('2 — DNS: the name becomes an address'),
    p('Four caches are checked in order, and most requests never get past the first two:'),
    table(
      ['Checked', 'Typical lifetime'],
      [
        ['Browser DNS cache', 'Seconds to a minute'],
        ['OS cache / `hosts` file', 'The TTL of the record'],
        ['Router or corporate resolver', 'The TTL'],
        ['Recursive resolver (your ISP, 1.1.1.1, 8.8.8.8)', 'The TTL'],
      ],
    ),
    p(
      'On a complete miss the resolver walks the hierarchy: a **root** server says who runs `.com`, the **TLD** server says who is authoritative for `google.com`, and the **authoritative** server returns the A/AAAA record. Usually over UDP port 53, in a couple of round trips, and cached at every level on the way back. `dns` covers this in full.',
    ),

    h('3 — Is this address local?'),
    p(
      'The OS ANDs the destination IP with its own subnet mask. Same subnet → the machine is on this wire, so ARP for *its* MAC. Different subnet → send it to the **default gateway**, so ARP for the *router’s* MAC instead. This is the moment IP and Ethernet meet, and it is `mac-and-arp`.',
    ),
    code(
      sh(`
me:    10.0.1.7/24        -> my network is 10.0.1.0 - 10.0.1.255
dest:  93.184.216.34      -> not in it
=> send the frame to the default gateway's MAC, with the destination IP untouched
`),
    ),
    note(
      'The **IP addresses stay the same the whole way across the internet; the MAC addresses are rewritten at every hop.** That single sentence answers a surprising number of interview questions.',
    ),

    h('4 — Routing across the internet'),
    p(
      'Your router forwards to your ISP, which forwards toward the destination’s network based on BGP routes, hop by hop, TTL decrementing each time. Ten to twenty hops is normal; `traceroute` prints them. Nothing on the path knows what an HTTP request is.',
    ),

    h('5 — TCP: three packets before a byte of yours moves'),
    code(
      sh(`
client  --- SYN (seq=x) ------------->  server
client  <-- SYN-ACK (seq=y, ack=x+1) -  server
client  --- ACK (ack=y+1) ----------->  server        connection established
`),
    ),
    p('One round trip, always, before any data. Over a 60 ms path that is 60 ms spent on nothing but agreement.'),

    h('6 — TLS: proving who they are'),
    ul(
      'Client sends `ClientHello` — versions, ciphers it supports, and **SNI**, the hostname in the clear so a shared server knows which certificate to send.',
      'Server replies with its **certificate chain** and its key-exchange part.',
      'The browser validates the chain up to a trusted root, checks the name matches, checks the dates and the revocation status.',
      'Both sides derive the same **symmetric** session key and everything after this is encrypted with it.',
    ),
    p(
      'TLS 1.3 does this in **one** round trip (TLS 1.2 took two). So a cold HTTPS request costs roughly: DNS + 1 RTT TCP + 1 RTT TLS + 1 RTT for the request itself. That is `latency-and-throughput`, and it is why connection reuse matters so much.',
    ),

    h('7 — The HTTP request'),
    code(
      sh(`
GET / HTTP/1.1
Host: google.com
User-Agent: Mozilla/5.0 ...
Accept: text/html,application/xhtml+xml
Accept-Encoding: gzip, br
Cookie: NID=...
`),
    ),
    p(
      '`Host` is what lets one IP serve thousands of sites. `Accept-Encoding` is why the response comes back compressed. The cookies were attached automatically by origin and path.',
    ),

    h('8 — What is actually on the other end'),
    p('Almost never one server. In order, typically:'),
    table(
      ['Hop', 'Doing'],
      [
        ['**CDN edge**', 'Static assets served from a city near you; a cache hit ends the journey here'],
        ['**Load balancer**', 'Picks a healthy instance; usually terminates TLS'],
        ['**Reverse proxy**', 'Rate limits, compresses, adds `X-Forwarded-For`'],
        ['**Application server**', 'Your code — routing, auth, business logic'],
        ['**Data stores**', 'Cache first (Redis), then the database'],
      ],
    ),

    h('9 — The response, and the render'),
    p(
      'A status line, headers and a body come back — probably gzip or brotli compressed, probably with cache headers. The browser then does the part that has nothing to do with networking and everything to do with the number people actually measure:',
    ),
    ul(
      'Parse HTML into the DOM, incrementally.',
      'Discover `<link rel="stylesheet">` and `<script>` — **CSS blocks rendering, synchronous JS blocks parsing.**',
      'Fetch subresources, mostly over the same connection (HTTP/1.1 keep-alive) or multiplexed on it (HTTP/2).',
      'Build the render tree, compute layout, paint, composite.',
    ),
    warn(
      'A candidate who stops at "the server responds" has answered half the question. A candidate who spends three minutes on ARP and never reaches the render has answered a quarter of it and used all the time. Pace it.',
    ),

    h('Where it goes wrong, per step'),
    table(
      ['Symptom', 'Step that failed'],
      [
        ['`ERR_NAME_NOT_RESOLVED`', 'DNS — no record, or the resolver is unreachable'],
        ['Hangs then times out', 'Routing or a firewall dropping packets silently'],
        ['`Connection refused`', 'Reached the host, nothing listening on that port'],
        ['Certificate warning', 'TLS — expired, wrong name, or an untrusted chain'],
        ['`502 Bad Gateway`', 'Load balancer reached the app and got nothing usable'],
        ['`504 Gateway Timeout`', 'The app was too slow for the proxy’s patience'],
        ['Blank page, 200 in the network tab', 'Nothing to do with the network — it rendered'],
      ],
    ),

    h('Cheatsheet'),
    cheat([
      ['Give the answer in a minute', 'DNS → ARP/route → TCP → TLS → HTTP → CDN/LB/app → render'],
      ['Name the caches DNS checks', 'Browser, OS, router, recursive resolver'],
      ['Say what stays constant end to end', 'The IP addresses; MACs change every hop'],
      ['Count the round trips', 'DNS + 1 TCP + 1 TLS 1.3 + 1 request'],
      ['Explain why one IP serves many sites', 'The `Host` header, and SNI in the TLS hello'],
      ['Sound senior', 'Mention that the response probably came from a CDN edge, not the origin'],
    ]),

    h('Interview'),
    asked([
      ['What happens when you type a URL and hit Enter?', 'DNS resolves the name, TCP and TLS open a connection, an HTTP GET goes out, a CDN or load balancer answers, and the browser parses and renders — fetching subresources as it goes.'],
      ['Where is DNS answered from?', 'The first of browser cache, OS cache, resolver cache, or a full recursive walk from the root.'],
      ['Why does the browser ARP for the router and not the server?', 'The destination is on another network, so the frame goes to the default gateway; the IP header still names the real destination.'],
      ['How many round trips before the first byte of HTML?', 'Roughly four on a cold connection: DNS, TCP handshake, TLS 1.3 handshake, then the request.'],
      ['Where does TLS fit in the sequence?', 'After the TCP handshake and before any HTTP is sent.'],
      ['What is SNI for?', 'It names the host in the clear during the TLS hello so a server with many certificates knows which to present.'],
      ['What happens after the response arrives?', 'HTML parsing builds the DOM; CSS blocks render and sync scripts block parsing; subresources are fetched over the same connection.'],
    ]),

    links(
      mdn('Web/Performance/Guides/Navigation_and_resource_timings', 'Navigation and resource timing'),
      wiki('Domain_Name_System', 'Domain Name System'),
      mdn('Web/HTTP/Guides/Overview', 'An overview of HTTP'),
    ),
  ],
};
