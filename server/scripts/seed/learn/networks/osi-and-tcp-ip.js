import { asked, cheat, code, h, links, note, p, sh, table, tip, warn, wiki } from '../blocks.js';

/*
  The vocabulary topic. Nothing later in the track parses without "layer 4" and
  "layer 7" meaning something, and the honest framing — OSI is a teaching model
  that survives because interviewers ask for it — is worth more than reciting
  seven layers as if a packet visited each of them.
*/
export const doc = {
  blocks: [
    p(
      'Networking is built in **layers**: each one does a single job and hands its result to the layer below, and the layer below neither knows nor cares what is inside. Your `fetch` does not know whether the bytes will cross fibre or WiFi, and the WiFi card does not know it is carrying JSON. That separation is what let the web be invented without replacing Ethernet.',
    ),
    p(
      'There are two layer models in circulation. **OSI** has seven layers and is a teaching model — no software implements it as drawn. **TCP/IP** has four and is what the internet actually runs. Interviews ask for OSI, engineers talk in a mix of the two, and you need both.',
    ),

    h('The two models, side by side'),
    table(
      ['OSI', 'Layer', 'Job', 'TCP/IP', 'Examples'],
      [
        ['7', '**Application**', 'What the message means', 'Application', 'HTTP, DNS, SMTP, SSH, gRPC'],
        ['6', 'Presentation', 'Encoding, encryption, compression', 'Application', 'TLS, JPEG, UTF-8'],
        ['5', 'Session', 'Opening, keeping and closing a conversation', 'Application', 'TLS sessions, RPC, NetBIOS'],
        ['4', '**Transport**', 'Process-to-process delivery; reliability', 'Transport', '**TCP**, **UDP**, QUIC'],
        ['3', '**Network**', 'Addressing and routing across networks', 'Internet', '**IP**, ICMP, ARP*, BGP'],
        ['2', '**Data link**', 'Delivery to the next box on this wire', 'Link', 'Ethernet, WiFi (802.11), MAC'],
        ['1', 'Physical', 'Bits as electricity, light or radio', 'Link', 'Cables, fibre, radio, connectors'],
      ],
    ),
    note(
      'ARP is the classic exam quibble: it maps an IP to a MAC, so it sits *between* layers 2 and 3 and different books file it in different places. Say "layer 2/3 boundary" and nobody can mark you wrong.',
    ),

    h('A mnemonic that survives the interview'),
    p(
      'Bottom to top: **P**lease **D**o **N**ot **T**hrow **S**ausage **P**izza **A**way — Physical, Data link, Network, Transport, Session, Presentation, Application. Top to bottom: **A**ll **P**eople **S**eem **T**o **N**eed **D**ata **P**rocessing.',
    ),

    h('One request, layer by layer'),
    p('You call `fetch("https://api.example.com/tasks")`. What each layer contributes, on the way down:'),
    table(
      ['Layer', 'Adds'],
      [
        ['7 Application', '`GET /tasks HTTP/1.1`, the headers, the body'],
        ['6/5 (TLS)', 'Encrypts that, inside a session negotiated once'],
        ['4 Transport', 'A TCP header: source port `54321`, destination port `443`, sequence number'],
        ['3 Network', 'An IP header: from `192.168.1.42`, to `93.184.216.34`'],
        ['2 Data link', 'An Ethernet frame: from my MAC, to my **router’s** MAC, with a checksum'],
        ['1 Physical', 'Voltage on copper, or a radio burst'],
      ],
    ),
    p(
      'At the far end the same list is climbed in reverse, each layer stripping the header it understands. The next topic, `encapsulation`, is that wrapping drawn out in full.',
    ),

    h('Why this is worth knowing, practically'),
    p(
      'Layers are how you localise a fault. "The site is down" is not debuggable; "layer 3 is fine, layer 4 is fine, layer 7 returns 502" is nearly solved. This is the ladder you climb with the tools in section 8:',
    ),
    table(
      ['Question', 'Layer', 'Tool'],
      [
        ['Is the machine reachable at all?', '3', '`ping`'],
        ['Is the port open?', '4', '`nc -zv host 443`'],
        ['Is the name resolving?', '7 (DNS)', '`dig`'],
        ['Is the app answering correctly?', '7', '`curl -v`'],
      ],
    ),
    tip(
      '**Layer 4 vs layer 7** is the single most useful distinction in the whole model, because it is how load balancers, firewalls and proxies are sold. An **L4** device sees IPs and ports and forwards a stream blind. An **L7** device reads the HTTP request and can route on the path, the host header or a cookie — and to do that it must terminate TLS. See `load-balancing`.',
    ),
    code(
      sh(`
              L4 (AWS NLB, HAProxy in TCP mode)
              sees: 10.0.1.7:443  ->  10.0.2.9:8080
              routes on: IP + port. Fast, protocol-agnostic, no TLS needed.

              L7 (AWS ALB, nginx, Cloudflare)
              sees: GET /api/tasks  Host: api.example.com  Cookie: sid=...
              routes on: path, host, header, cookie. Needs to decrypt first.
`),
    ),
    warn(
      'Do not claim in an interview that data "physically visits seven layers". OSI is a conceptual map. Real stacks collapse 5, 6 and 7 into "the application", and TLS deliberately does not fit the model at all — which is exactly why RFCs describe it as sitting *between* transport and application rather than on a numbered floor.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Recite the layers', 'Please Do Not Throw Sausage Pizza Away — bottom to top'],
      ['Name layer 4', 'TCP and UDP — ports and reliability'],
      ['Name layer 3', 'IP — addresses and routing'],
      ['Name layer 2', 'Ethernet and MAC — the next hop on this wire'],
      ['Explain an L7 load balancer', 'Reads HTTP, routes on path/host/cookie, terminates TLS'],
      ['Explain an L4 load balancer', 'Forwards a TCP stream by IP and port, no decryption'],
      ['Place a router / a switch', 'Router layer 3, switch layer 2'],
    ]),

    h('Interview'),
    asked([
      ['Walk me through the OSI model.', 'Seven layers, physical up to application; each serves the one above and hides the one below.'],
      ['Why do we layer at all?', 'So a change at one layer — new WiFi standard, new app protocol — does not force a change at the others.'],
      ['OSI vs TCP/IP?', 'OSI is the seven-layer teaching model; TCP/IP is the four-layer model actually implemented, collapsing OSI 5–7 into “application”.'],
      ['Which layer is TCP? IP? Ethernet?', 'Transport (4), network (3), data link (2).'],
      ['What does “L7 load balancer” mean?', 'It reads the HTTP request, so it can route on path or host — and therefore must terminate TLS.'],
      ['Where does TLS sit?', 'Between transport and application; OSI would call it presentation/session, and the RFCs deliberately do not pick.'],
      ['Which layer does a switch work at, and a router?', 'Switch layer 2 on MAC addresses, router layer 3 on IP addresses.'],
    ]),

    links(
      wiki('OSI_model', 'OSI model'),
      wiki('Internet_protocol_suite', 'Internet protocol suite (TCP/IP)'),
    ),
  ],
};
