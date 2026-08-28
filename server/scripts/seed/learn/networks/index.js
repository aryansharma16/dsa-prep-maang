/**
 * The Computer Networks track's table of contents.
 *
 * Metadata only, like the other tracks — every topic's body is its own module
 * behind `load`.
 *
 * **This track is written to a ceiling, and the ceiling is the point.** The
 * reader is a developer who builds applications, deploys them to AWS and sits
 * interviews. They are not becoming a network engineer, so there is no OSPF,
 * no VLAN trunking, no packet-crafting and no subnet arithmetic drilled for its
 * own sake. Every topic had to answer one question to get in: *does knowing
 * this change what I would build, debug or say out loud?* Anything that only
 * pays off with a router console in front of you was left out on purpose.
 *
 * Section order is reading order, and it is the path a byte takes. The layers
 * and the address first, because nothing after them parses without those words;
 * then routes and names, then transport, then the web layer that sits on top of
 * all of it; then the four boxes between your users and your server —
 * proxies, load balancers, CDNs, and the latency budget they exist to spend;
 * then the same ideas with AWS's names on them, because that is where this
 * reader actually meets a route table; then how to debug it, and the tables
 * worth having in your head an hour before an interview.
 *
 * Some of this brushes against the Node track — `http-fundamentals`,
 * `cors-and-headers`, `sessions-and-cookies` are all there. The split is the
 * side of the socket you are on: Node teaches you to *write the server*, this
 * teaches you what the network did before your handler ran and what it will do
 * to your response afterwards. Where they touch, the topic here says so.
 */

export const title = 'Computer Networks';

export const summary =
  'What actually happens between your fetch and their server, at the level a developer needs it: the layer models, IP and subnets, DNS, TCP and UDP, HTTPS, the proxies, load balancers and CDNs in front of every real system, a VPC drawn the way AWS draws it, and the commands to prove any of it.';

export const sections = [
  {
    key: 'foundations',
    title: 'The idea',
    blurb:
      'The vocabulary everything else is written in — the layers, what a packet is, and one end-to-end walk from a URL to a page.',
    topics: [
      {
        slug: 'what-is-a-network',
        title: 'What a network actually is',
        summary:
          'Nodes, links and protocols; LAN, WAN and the internet; client–server against peer-to-peer.',
        tags: ['basics', 'vocabulary'],
        ask: [
          'Explain what a computer network is as if I have never thought about it.',
          'What is the difference between the internet, the Internet and the web?',
          'When would a system be peer-to-peer instead of client–server?',
        ],
        load: () => import('./what-is-a-network.js'),
      },
      {
        slug: 'osi-and-tcp-ip',
        title: 'The OSI and TCP/IP models',
        summary:
          'Seven layers, four layers, and which one a real engineer actually talks in — with a protocol on every floor.',
        tags: ['osi', 'layers', 'interview'],
        ask: [
          'Walk me through the OSI model layer by layer with an example protocol on each.',
          'Why do people say TCP/IP has four layers when OSI has seven?',
          'What does someone mean by an “L7 load balancer”?',
        ],
        load: () => import('./osi-and-tcp-ip.js'),
      },
      {
        slug: 'encapsulation',
        title: 'Encapsulation, and what a packet is',
        summary:
          'Headers wrapped around headers: segment, packet, frame — plus MTU, fragmentation and why 1500 keeps appearing.',
        tags: ['packets', 'mtu', 'layers'],
        ask: [
          'What is encapsulation in networking?',
          'What is the difference between a segment, a packet and a frame?',
          'What is MTU and what breaks when it is wrong?',
        ],
        load: () => import('./encapsulation.js'),
      },
      {
        slug: 'url-to-page',
        title: 'What happens when you type a URL',
        summary:
          'The whole journey in one page — cache, DNS, ARP, TCP, TLS, HTTP, render — and the version of it you say in an interview.',
        tags: ['interview', 'end-to-end', 'classic'],
        ask: [
          'What happens when I type google.com and press Enter?',
          'Give me a 60-second version of that answer for an interview.',
          'Where in that sequence does TLS happen, and why there?',
        ],
        load: () => import('./url-to-page.js'),
      },
    ],
  },
  {
    key: 'link-and-address',
    title: 'The link and the address',
    blurb:
      'How one machine is identified and how the box next to it is reached — MAC and IP, subnets, and the NAT hiding your laptop.',
    topics: [
      {
        slug: 'devices',
        title: 'The boxes: switch, router, gateway',
        summary:
          'Hub, switch, router, gateway, NIC, access point, modem — what each one does, and at which layer.',
        tags: ['hardware', 'layers'],
        ask: [
          'What is the difference between a switch and a router?',
          'What is a default gateway, in one sentence?',
          'What are collision and broadcast domains?',
        ],
        load: () => import('./devices.js'),
      },
      {
        slug: 'mac-and-arp',
        title: 'MAC addresses and ARP',
        summary:
          'Why every machine has two addresses, and the broadcast that maps one to the other on the local wire.',
        tags: ['arp', 'layer2', 'interview'],
        ask: [
          'Why do we need MAC addresses if we already have IP addresses?',
          'Walk me through what ARP does, step by step.',
          'Does the MAC address change as a packet crosses the internet?',
        ],
        load: () => import('./mac-and-arp.js'),
      },
      {
        slug: 'ip-addresses',
        title: 'IP addresses',
        summary:
          'IPv4 and IPv6, public against private, loopback, link-local — and how a machine ends up with the address it has.',
        tags: ['ip', 'ipv6', 'basics'],
        ask: [
          'What is the difference between a public and a private IP address?',
          'Why has IPv6 taken twenty years and what does it actually fix?',
          'What is 127.0.0.1 and how is it different from 0.0.0.0?',
        ],
        load: () => import('./ip-addresses.js'),
      },
      {
        slug: 'subnetting-and-cidr',
        title: 'Subnets and CIDR',
        summary:
          'Reading /24 without a calculator: masks, host counts, and splitting 10.0.0.0/16 into the subnets a VPC wants.',
        tags: ['cidr', 'subnet', 'aws'],
        ask: [
          'Explain CIDR notation to me — what does /24 mean?',
          'How many usable hosts are in a /26, and why not 64?',
          'How should I split a 10.0.0.0/16 VPC across three availability zones?',
        ],
        load: () => import('./subnetting-and-cidr.js'),
      },
      {
        slug: 'nat-and-ports',
        title: 'NAT, and why your laptop is 192.168.x.x',
        summary:
          'One public address for a whole house or a whole VPC: the translation table, port forwarding, and what NAT breaks.',
        tags: ['nat', 'ports', 'aws'],
        ask: [
          'How does NAT let twenty devices share one public IP address?',
          'Why can a server not open a connection *to* my laptop at home?',
          'What is the difference between an internet gateway and a NAT gateway on AWS?',
        ],
        load: () => import('./nat-and-ports.js'),
      },
    ],
  },
  {
    key: 'routing-and-names',
    title: 'Routes and names',
    blurb:
      'Getting a packet across the world, getting an address at all, and turning a name people can remember into one.',
    topics: [
      {
        slug: 'routing',
        title: 'How a packet finds its way',
        summary:
          'Routing tables, the default route, hop by hop forwarding, and the two-sentence version of BGP.',
        tags: ['routing', 'bgp'],
        ask: [
          'How does a router decide where to send a packet?',
          'What is a default route and what happens without one?',
          'What is BGP and why does it take the internet down occasionally?',
        ],
        load: () => import('./routing.js'),
      },
      {
        slug: 'dhcp',
        title: 'Joining a network: DHCP',
        summary:
          'The four messages that hand a device an address, a gateway and a resolver — and the lease behind them.',
        tags: ['dhcp', 'basics'],
        ask: [
          'What happens on the network when I connect to WiFi?',
          'Walk me through the DHCP DORA exchange.',
          'What is a DHCP lease and what happens when it expires?',
        ],
        load: () => import('./dhcp.js'),
      },
      {
        slug: 'dns',
        title: 'DNS',
        summary:
          'The lookup in full — resolver, root, TLD, authoritative — every record type you will meet, TTLs, and why it is always DNS.',
        tags: ['dns', 'interview', 'aws'],
        ask: [
          'Walk me through a full DNS resolution from a cold cache.',
          'What is the difference between an A record, a CNAME and an ALIAS?',
          'Why does a DNS change take so long to be picked up, and how do I plan a migration around it?',
        ],
        load: () => import('./dns.js'),
      },
    ],
  },
  {
    key: 'transport',
    title: 'Transport: TCP and UDP',
    blurb:
      'The layer your socket actually speaks — a reliable ordered stream, or fast messages with no promises.',
    topics: [
      {
        slug: 'tcp-vs-udp',
        title: 'TCP vs UDP',
        summary:
          'The comparison every interview opens with, and the four cases where UDP is the right answer.',
        tags: ['tcp', 'udp', 'interview'],
        ask: [
          'TCP versus UDP — the full comparison.',
          'Give me real systems that choose UDP and say why.',
          'Is UDP actually faster, or just less careful?',
        ],
        load: () => import('./tcp-vs-udp.js'),
      },
      {
        slug: 'tcp-handshake',
        title: 'The TCP handshake, and closing down',
        summary:
          'SYN, SYN-ACK, ACK; the four-way close; and what TIME_WAIT, RST and a half-open connection mean in your logs.',
        tags: ['tcp', 'handshake', 'interview'],
        ask: [
          'Walk me through the three-way handshake and why it is three and not two.',
          'Why does closing take four messages when opening takes three?',
          'What is TIME_WAIT and why do I have thousands of them?',
        ],
        load: () => import('./tcp-handshake.js'),
      },
      {
        slug: 'ports-and-sockets',
        title: 'Ports and sockets',
        summary:
          'The five-tuple that identifies a connection, the ports worth knowing by heart, and why one server handles 10,000 clients on port 443.',
        tags: ['ports', 'sockets', 'interview'],
        ask: [
          'What is a socket, precisely?',
          'How can thousands of clients all connect to port 443 at once?',
          'What does “address already in use” actually mean?',
        ],
        load: () => import('./ports-and-sockets.js'),
      },
      {
        slug: 'reliability-and-congestion',
        title: 'Reliability, windows and congestion',
        summary:
          'Sequence numbers and ACKs, the sliding window, slow start, and the head-of-line blocking that shaped HTTP/3.',
        tags: ['tcp', 'congestion', 'performance'],
        ask: [
          'How does TCP guarantee that my bytes arrive in order?',
          'What is TCP slow start and how does it hurt a short HTTPS request?',
          'What is head-of-line blocking, at TCP level and at HTTP level?',
        ],
        load: () => import('./reliability-and-congestion.js'),
      },
    ],
  },
  {
    key: 'web',
    title: 'The web layer',
    blurb:
      'The protocols your application actually speaks, from the network side: HTTP and its versions, TLS, origins, and the ways to keep a connection open.',
    topics: [
      {
        slug: 'http-basics',
        title: 'HTTP, from the network side',
        summary:
          'The request and response on the wire, the status families, and the headers that decide how far a response travels.',
        tags: ['http', 'basics'],
        ask: [
          'What does an HTTP request actually look like on the wire?',
          'Give me the status code families and the ten codes worth knowing.',
          'Which HTTP methods are safe and which are idempotent?',
        ],
        load: () => import('./http-basics.js'),
      },
      {
        slug: 'http-versions',
        title: 'HTTP/1.1, HTTP/2 and HTTP/3',
        summary:
          'Keep-alive, multiplexing, header compression and QUIC — what each version fixed, and what it means for your frontend.',
        tags: ['http2', 'http3', 'quic', 'performance'],
        ask: [
          'What did HTTP/2 change, and what did it not fix?',
          'Why does HTTP/3 run on UDP?',
          'Is domain sharding still a good idea?',
        ],
        load: () => import('./http-versions.js'),
      },
      {
        slug: 'https-and-tls',
        title: 'HTTPS and TLS',
        summary:
          'The handshake in five steps, what a certificate proves, why the padlock is about identity as much as encryption, and where TLS is terminated.',
        tags: ['tls', 'https', 'security', 'interview'],
        ask: [
          'Walk me through the TLS handshake.',
          'Why is there both asymmetric and symmetric encryption in one handshake?',
          'What does a certificate authority actually vouch for?',
        ],
        load: () => import('./https-and-tls.js'),
      },
      {
        slug: 'origins-and-cors',
        title: 'Origins, and CORS',
        summary:
          'What an origin is, why the browser blocks the response and not the request, and how a preflight is negotiated.',
        tags: ['cors', 'browser', 'security'],
        ask: [
          'What exactly is an origin?',
          'Why did my request reach the server and still fail with a CORS error?',
          'What triggers a preflight OPTIONS request?',
        ],
        load: () => import('./origins-and-cors.js'),
      },
      {
        slug: 'websockets-and-realtime',
        title: 'WebSockets, SSE and polling',
        summary:
          'Four ways to push data to a browser, the upgrade handshake, and what each one costs a load balancer.',
        tags: ['websockets', 'sse', 'realtime', 'system-design'],
        ask: [
          'Polling, long polling, SSE, WebSockets — when do I pick which?',
          'How does a WebSocket connection start?',
          'What breaks about WebSockets behind a load balancer?',
        ],
        load: () => import('./websockets-and-realtime.js'),
      },
      {
        slug: 'application-protocols',
        title: 'The other protocols worth naming',
        summary:
          'SSH, FTP and SFTP, SMTP with IMAP and POP3, NTP, SNMP, gRPC and MQTT — one line each, and their ports.',
        tags: ['protocols', 'ports', 'interview'],
        ask: [
          'Name some application layer protocols and what each is for.',
          'What is the difference between SFTP and FTPS?',
          'When would I use gRPC instead of REST over HTTP?',
        ],
        load: () => import('./application-protocols.js'),
      },
    ],
  },
  {
    key: 'at-scale',
    title: 'Delivering it at scale',
    blurb:
      'The four boxes between your users and your server in every system design answer — and the latency budget they exist to spend.',
    topics: [
      {
        slug: 'proxies',
        title: 'Forward and reverse proxies',
        summary:
          'The same box pointed two ways, and everything a reverse proxy takes off your application: TLS, compression, rate limits, retries.',
        tags: ['proxy', 'nginx', 'system-design'],
        ask: [
          'Forward proxy versus reverse proxy, with an example of each.',
          'What does nginx do in front of my Node app that Node cannot do itself?',
          'What is X-Forwarded-For and when can I trust it?',
        ],
        load: () => import('./proxies.js'),
      },
      {
        slug: 'load-balancing',
        title: 'Load balancers, L4 and L7',
        summary:
          'Layer 4 against layer 7, the algorithms, health checks, sticky sessions, and how the load balancer itself gets balanced.',
        tags: ['load-balancer', 'system-design', 'aws'],
        ask: [
          'What is the difference between an L4 and an L7 load balancer?',
          'How do health checks stop traffic reaching a dead instance?',
          'What is a sticky session and why is it a smell?',
        ],
        load: () => import('./load-balancing.js'),
      },
      {
        slug: 'cdn-and-caching',
        title: 'CDNs, caching and the edge',
        summary:
          'Why a copy near the user beats a faster server, the cache headers that decide it, anycast, and how to invalidate.',
        tags: ['cdn', 'cache', 'system-design'],
        ask: [
          'How does a CDN actually make a site faster?',
          'Explain Cache-Control, ETag and stale-while-revalidate.',
          'How do I ship a new version of an asset a CDN has cached for a year?',
        ],
        load: () => import('./cdn-and-caching.js'),
      },
      {
        slug: 'latency-and-throughput',
        title: 'Latency, bandwidth and throughput',
        summary:
          'The four numbers people mix up, the round trips a first request really costs, and the latency table worth memorising.',
        tags: ['performance', 'latency', 'system-design'],
        ask: [
          'Latency, bandwidth, throughput and jitter — define each.',
          'How many round trips does a first HTTPS request take?',
          'Why does adding bandwidth not make my site faster?',
        ],
        load: () => import('./latency-and-throughput.js'),
      },
      {
        slug: 'network-security-basics',
        title: 'The network security a developer owns',
        summary:
          'Sniffing, spoofing, man-in-the-middle, DDoS and firewalls — the developer-level version, and the six defaults that cover most of it.',
        tags: ['security', 'ddos', 'firewall'],
        ask: [
          'What is a man-in-the-middle attack and what actually stops it?',
          'How do you defend a public API against a DDoS?',
          'What is the difference between a firewall, a WAF and a security group?',
        ],
        load: () => import('./network-security-basics.js'),
      },
    ],
  },
  {
    key: 'cloud',
    title: 'Networking in the cloud',
    blurb:
      'The same ideas with AWS names on them — which is where this reader actually meets a route table and a security group.',
    topics: [
      {
        slug: 'vpc-and-subnets',
        title: 'VPCs, subnets and route tables',
        summary:
          'Your own private network in someone else’s data centre: the CIDR, public and private subnets, availability zones, and what makes a subnet “public”.',
        tags: ['aws', 'vpc', 'cloud'],
        ask: [
          'What is a VPC and what is inside one?',
          'What actually makes a subnet public rather than private?',
          'Why does a database go in a private subnet?',
        ],
        load: () => import('./vpc-and-subnets.js'),
      },
      {
        slug: 'security-groups-and-nacls',
        title: 'Security groups vs NACLs',
        summary:
          'Stateful against stateless, allow-only against allow-and-deny, instance against subnet — the comparison AWS interviews ask for.',
        tags: ['aws', 'security', 'vpc'],
        ask: [
          'Security group versus network ACL — the whole comparison.',
          'What does “stateful” mean for a security group?',
          'My instance can send traffic out but nothing comes back — what did I misconfigure?',
        ],
        load: () => import('./security-groups-and-nacls.js'),
      },
      {
        slug: 'aws-front-door',
        title: 'The front door: Route 53, ALB, ACM, CloudFront',
        summary:
          'One request from a browser to a container, named service by service — and where the certificate lives.',
        tags: ['aws', 'alb', 'route53', 'cloudfront'],
        ask: [
          'Trace a request from a browser to my container through the AWS services in front of it.',
          'ALB versus NLB — when do I need which?',
          'Where should TLS be terminated in an AWS stack?',
        ],
        load: () => import('./aws-front-door.js'),
      },
      {
        slug: 'connecting-networks',
        title: 'Connecting networks: peering, VPN, PrivateLink',
        summary:
          'Reaching another VPC, an office, or a managed service without going over the public internet — and the bastion you should not need.',
        tags: ['aws', 'vpn', 'vpc', 'cloud'],
        ask: [
          'VPC peering versus Transit Gateway versus PrivateLink — when is each right?',
          'How do I reach an instance in a private subnet without a public IP?',
          'What is a VPC endpoint and what does it save me?',
        ],
        load: () => import('./connecting-networks.js'),
      },
    ],
  },
  {
    key: 'debugging',
    title: 'When it breaks',
    blurb:
      'The commands that answer “where did it stop”, and the failure messages read as evidence rather than as noise.',
    topics: [
      {
        slug: 'the-tools',
        title: 'The tools: ping, dig, curl, ss, tcpdump',
        summary:
          'Eight commands, what each one proves, and the order to reach for them in.',
        tags: ['debugging', 'tools', 'cli'],
        ask: [
          'Which command should I run first when a service is unreachable?',
          'How do I check whether a port is open from here?',
          'How do I see what DNS is actually returning, bypassing the cache?',
        ],
        load: () => import('./the-tools.js'),
      },
      {
        slug: 'common-failures',
        title: 'Reading the failure',
        summary:
          'Connection refused, timeout, reset, DNS failure, 502 against 504 — what each one rules out, as a decision tree.',
        tags: ['debugging', 'interview', 'production'],
        ask: [
          'Connection refused versus connection timed out — what does each tell me?',
          'What is the difference between a 502 and a 504?',
          'The app works locally and hangs in the VPC — what is the checklist?',
        ],
        load: () => import('./common-failures.js'),
      },
    ],
  },
  {
    key: 'interview',
    title: 'The interview',
    blurb:
      'The tables to have in your head an hour before, and the questions that actually get asked.',
    topics: [
      {
        slug: 'cheatsheet',
        title: 'The cheat sheet',
        summary:
          'Every table in one place: layers, ports, status codes, protocols, record types, and the latency numbers.',
        tags: ['reference', 'tables', 'revision'],
        ask: [
          'Give me the port numbers worth memorising.',
          'Which HTTP status codes should I know cold?',
          'Summarise the OSI layers with a protocol and a device on each.',
        ],
        load: () => import('./cheatsheet.js'),
      },
      {
        slug: 'top-questions',
        title: 'The questions, rapid fire',
        summary:
          'Forty questions with the answer said out loud in one or two lines, in the order they get asked.',
        tags: ['interview', 'revision'],
        ask: [
          'Quiz me on computer networks the way an interviewer would.',
          'What is the one-line answer to “TCP vs UDP”?',
          'Which networking questions come up most in a backend interview?',
        ],
        load: () => import('./top-questions.js'),
      },
    ],
  },
];
