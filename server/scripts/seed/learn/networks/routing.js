import { asked, cheat, code, h, links, note, p, sh, table, tip, ul, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Routing is one decision, made over and over by different machines: **given this destination address, which of my interfaces do I send it out of, and to which next box?** No router knows the whole path. Each one knows only the next hop, and the packet finds its way by having that question answered ten or twenty times in a row.',
    ),

    h('The routing table'),
    p('Your own machine has one. It is short, and every line is a rule of the form "for this range, go here":'),
    code(
      sh(`
$ ip route
default via 192.168.1.1 dev wlan0            <- everything else -> the gateway
192.168.1.0/24 dev wlan0 proto kernel        <- my own network -> straight out
172.17.0.0/16 dev docker0                    <- docker's network -> the bridge
`),
    ),
    p(
      'The matching rule is **longest prefix wins**. A packet for `172.17.0.5` matches both `172.17.0.0/16` and `default` (`0.0.0.0/0`), and the more specific one — more fixed bits — is chosen. This is why `0.0.0.0/0` works as a catch-all: it is the least specific route there is, so it only wins when nothing else matched.',
    ),
    table(
      ['Destination', 'Matches', 'Chosen because'],
      [
        ['`192.168.1.50`', '`192.168.1.0/24`, default', '/24 is longer than /0'],
        ['`172.17.0.5`', '`172.17.0.0/16`, default', '/16 is longer than /0'],
        ['`93.184.216.34`', 'default only', 'Nothing else matched'],
      ],
    ),
    tip(
      '`ip route get 1.1.1.1` asks the kernel to answer the question for you — it prints exactly which route, interface and source address would be used. It is the fastest way to settle "why is this traffic going out of the wrong interface", VPN arguments included.',
    ),

    h('One hop, in full'),
    p('What a router does with a packet, every time, in five steps:'),
    ul(
      'Receive the frame, check the layer-2 checksum, strip the Ethernet header.',
      'Read the destination **IP**. Look it up in the routing table, longest prefix first.',
      'Decrement **TTL**. If it hits zero, drop the packet and send back an ICMP "time exceeded".',
      'Build a **new** Ethernet frame addressed to the next hop’s MAC (ARP if not cached).',
      'Send it out of the chosen interface.',
    ),
    note(
      'Notice what did *not* happen: the IP header’s source and destination were untouched. A router forwards; it does not rewrite addresses. The one box that does rewrite them is doing NAT, and that is a deliberate exception.',
    ),

    h('Traceroute, and why it works'),
    p(
      'That TTL rule is exploitable, and `traceroute` exploits it. Send a packet with TTL=1: the first router decrements it to zero and sends back an ICMP error revealing its own address. Send TTL=2: the second router does. Repeat, and each reply names one more hop along the path.',
    ),
    code(
      sh(`
$ traceroute example.com
 1  192.168.1.1        1.1 ms      <- my router
 2  10.20.0.1         12.4 ms      <- ISP
 3  * * *                          <- a hop that will not answer ICMP
 4  ae-3.border1.lon  22.8 ms      <- an exchange in London
 8  93.184.216.34     94.2 ms      <- destination
`),
    ),
    warn(
      'A line of `* * *` does **not** mean the packet was dropped. Plenty of routers are configured not to answer ICMP, and traffic passes through them perfectly. Only a trace that stops and never reaches the destination is evidence of a break.',
    ),

    h('Static and dynamic routes'),
    table(
      ['', 'Static', 'Dynamic'],
      [
        ['Written by', 'A human, or Terraform', 'A routing protocol, from neighbours'],
        ['Adapts to failure', 'No', 'Yes — reroutes around a dead link'],
        ['Where you meet it', '**AWS route tables**, your laptop, small networks', 'ISPs, large enterprise networks'],
        ['Protocols', '—', 'OSPF and IS-IS inside a network; **BGP** between networks'],
      ],
    ),
    p(
      'Everything you configure in a cloud account is **static**. An AWS route table is a hand-written list of prefixes and targets; nothing is negotiated. The dynamic protocols matter to you as vocabulary, and one of them matters as news.',
    ),

    h('BGP, in two sentences'),
    p(
      'The internet is about a hundred thousand **autonomous systems** — an ISP, a university, AWS, Cloudflare — each with a number. **BGP** is how they advertise to each other which address ranges they can reach, and the paths propagate outward until everyone has an opinion about how to reach everyone.',
    ),
    p(
      'It is built on trust, which is why it makes the news. If a network wrongly advertises "I am the best path to these addresses" — by mistake or on purpose — the internet believes it, and that traffic goes to the wrong place. That is a **BGP hijack**, and the famous outages where "a country lost access to a site for two hours" are usually this or a bad configuration push. **RPKI** is the ongoing effort to sign route announcements so they can be verified.',
    ),
    note(
      'You will not configure BGP. You should be able to say what it is, why route leaks happen, and — the useful part — that a large provider’s outage can break your service without any packet of yours being at fault.',
    ),

    h('Cheatsheet'),
    cheat([
      ['See where traffic will go', '`ip route get <ip>`'],
      ['Read a routing table', 'Longest prefix wins; `0.0.0.0/0` is the fallback'],
      ['Send everything to the gateway', 'A default route'],
      ['Trace the path to a host', '`traceroute` / `mtr` — and expect some `* * *`'],
      ['Route inside a VPC', 'Route tables — always static, one per subnet'],
      ['Name the internet’s routing protocol', 'BGP, between autonomous systems'],
    ]),

    h('Interview'),
    asked([
      ['How does a router decide where to send a packet?', 'Longest-prefix match against its routing table, then forwards to that next hop.'],
      ['What is a default route?', 'The `0.0.0.0/0` entry used when no more specific route matches — usually the gateway.'],
      ['What changes in the packet at each hop?', 'TTL decrements and the layer-2 frame is rebuilt; the IP addresses stay unless NAT is involved.'],
      ['How does traceroute work?', 'It sends packets with increasing TTL and reads the ICMP “time exceeded” each hop returns.'],
      ['Static vs dynamic routing?', 'Hand-written entries versus routes learned from neighbours by a protocol like OSPF or BGP.'],
      ['What is BGP and why does it cause outages?', 'The protocol autonomous systems use to advertise reachable prefixes; it trusts announcements, so a bad or malicious one redirects traffic.'],
    ]),

    links(
      wiki('Routing_table', 'Routing table'),
      wiki('Border_Gateway_Protocol', 'Border Gateway Protocol'),
      wiki('Traceroute', 'Traceroute'),
    ),
  ],
};
