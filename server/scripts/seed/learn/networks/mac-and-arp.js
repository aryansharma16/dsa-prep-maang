import { asked, cheat, code, h, links, note, p, rfc, sh, table, tip, ul, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Every machine has **two** addresses, and the question "why two" is asked constantly. A **MAC address** identifies a network card; an **IP address** identifies a machine’s position in a network. One is *who you are*, the other is *where you are*, and delivery needs both for the same reason a parcel needs a name and a street.',
    ),

    h('The two addresses'),
    table(
      ['', 'MAC address', 'IP address'],
      [
        ['Layer', '2 — data link', '3 — network'],
        ['Looks like', '`a4:83:e7:2f:19:0c` — 48 bits, hex', '`10.0.1.7` — 32 bits, dotted decimal'],
        ['Assigned by', 'The manufacturer, burned into the card', 'The network you joined (DHCP or static)'],
        ['Scope', '**This wire only** — never leaves the local network', 'End to end, globally'],
        ['Changes when you move', 'No', 'Yes'],
        ['Analogy', 'Your name', 'Your current street address'],
      ],
    ),
    p(
      'The first three bytes of a MAC are the **OUI**, the vendor code — which is why a tool can tell you a device is an Apple or an Intel card from its address alone.',
    ),

    h('Why both are needed'),
    p(
      'If we only had MAC addresses, routing would mean every router on earth holding a table of every network card ever made — flat, unaggregatable, unroutable. IP addresses are **hierarchical**: `10.0.1.0/24` is one entry covering 256 machines, and a backbone router can hold one route for millions of addresses. That hierarchy is the only reason routing scales.',
    ),
    p(
      'If we only had IP addresses, the wire itself would still need to know which of the forty cards on this switch should pick up the frame. That is what MAC does, and it does it for exactly one hop.',
    ),
    note(
      '**The IP addresses stay the same all the way across the internet; the MAC addresses are rewritten at every single hop.** If you remember one sentence from this page, that is it.',
    ),

    h('ARP: the missing link'),
    p(
      'You know the destination IP. To build the Ethernet frame you need a destination MAC. **ARP** — Address Resolution Protocol — gets it by shouting on the local network:',
    ),
    code(
      sh(`
1. Host A wants 10.0.1.20.
   Broadcast:  "Who has 10.0.1.20? Tell 10.0.1.7"     (to ff:ff:ff:ff:ff:ff — everyone)

2. Every host on the wire hears it; only .20 answers.
   Unicast:    "10.0.1.20 is at a4:83:e7:2f:19:0c"

3. Host A caches that for a few minutes and sends the frame.
`),
    ),
    code(
      sh(`
ip neigh          # the ARP cache on Linux
arp -a            # the same on macOS and Windows
`),
    ),

    h('The step everybody gets wrong'),
    p(
      'ARP only ever asks about addresses **on the local subnet**. If the destination is remote, the host does not ARP for it — it ARPs for its **default gateway** and sends the frame there, with the destination IP still naming the far-away server.',
    ),
    code(
      sh(`
me 10.0.1.7/24  ->  93.184.216.34 (remote)

Ethernet:  dst MAC = my router's MAC        <- next hop
IP:        dst IP  = 93.184.216.34          <- final destination

The router strips the frame, looks up the route, writes a NEW frame
with the next router's MAC, and forwards. IP header untouched (except TTL--).
`),
    ),
    tip(
      'This is the answer to “does the MAC address change as a packet crosses the internet?” — yes, at every hop; and to “does the IP change?” — no, unless NAT rewrites it, which is exactly what NAT is for.',
    ),

    h('Where you actually meet ARP'),
    ul(
      '**A duplicate IP on the network** — two machines answer the same ARP and traffic flips between them at random.',
      '**A stale ARP entry after a failover** — you moved an IP to a new server and clients keep talking to the old MAC until the cache expires. The fix is a **gratuitous ARP**: the new owner broadcasts "this IP is now at my MAC" unprompted, which is exactly how a floating/virtual IP failover works.',
      '**ARP spoofing** — an attacker on your LAN answers ARP requests with their own MAC and now sees your traffic. It is the classic local man-in-the-middle, it is why HTTPS matters on café WiFi, and it is covered in `network-security-basics`.',
    ),
    warn(
      'ARP has no authentication whatsoever. Any machine on the local network can claim any IP. Nothing at layer 2 protects you — the defence is encryption above it (TLS), not trust below it.',
    ),
    note(
      'IPv6 does not use ARP. It uses **NDP** (Neighbor Discovery Protocol) over ICMPv6, which does the same job with multicast instead of broadcast. Same idea, different name — worth knowing the word.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Identify a network card', 'MAC — 48 bits, vendor prefix, local scope'],
      ['Identify a machine on the internet', 'IP — hierarchical, routable, end to end'],
      ['Map an IP to a MAC on this wire', 'ARP (IPv6: NDP)'],
      ['Send to a remote host', 'ARP for the gateway, keep the destination IP'],
      ['Move an IP to a new server cleanly', 'Gratuitous ARP'],
      ['Inspect the mapping', '`ip neigh` or `arp -a`'],
    ]),

    h('Interview'),
    asked([
      ['Why do we need MAC addresses if we have IPs?', 'IP is hierarchical and routable end to end; MAC delivers the frame to the right card on this one wire.'],
      ['What does ARP do?', 'Broadcasts “who has this IP” on the local network and caches the MAC that answers.'],
      ['Does the MAC change across the internet?', 'Yes — rewritten at every hop. The IP does not, unless NAT rewrites it.'],
      ['What does a host do when the destination is not local?', 'ARPs for the default gateway’s MAC and sends the frame there, with the destination IP unchanged.'],
      ['What is ARP spoofing?', 'Answering ARP requests with your own MAC to intercept LAN traffic — a local man-in-the-middle.'],
      ['What replaces ARP in IPv6?', 'NDP, Neighbor Discovery, over ICMPv6.'],
    ]),

    links(
      wiki('Address_Resolution_Protocol', 'Address Resolution Protocol'),
      wiki('MAC_address', 'MAC address'),
      rfc(826, 'RFC 826 — ARP'),
    ),
  ],
};
