import { asked, cheat, code, h, links, note, p, rfc, sh, table, tip, ul, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      '**Encapsulation** is what layering looks like on the wire: each layer takes whatever the layer above handed it, treats it as an opaque blob of bytes, and wraps its own **header** around it. The receiver unwraps in the opposite order. Nothing is ever rewritten in the middle — it is envelopes inside envelopes.',
    ),

    h('The wrapping, drawn'),
    code(
      sh(`
your data              {"title":"Ship it"}
+ HTTP header          POST /tasks HTTP/1.1 ... {"title":"Ship it"}
+ TCP header           [src 54321 | dst 443 | seq | ack] HTTP...     -> a SEGMENT
+ IP header            [src 10.0.1.7 | dst 93.184.216.34 | TTL] TCP... -> a PACKET
+ Ethernet header      [src MAC | dst MAC] IP... [checksum]         -> a FRAME
                       -> bits on the wire
`),
    ),
    p(
      'The names are worth learning because interviewers use them as a shorthand for "which layer are you talking about":',
    ),
    table(
      ['Layer', 'Unit is called', 'Carries'],
      [
        ['Application', 'Message / data', 'Your JSON, your HTML'],
        ['Transport (TCP)', '**Segment**', 'Ports, sequence numbers'],
        ['Transport (UDP)', '**Datagram**', 'Ports, length, checksum'],
        ['Network (IP)', '**Packet**', 'Source and destination IP, TTL'],
        ['Data link', '**Frame**', 'Source and destination MAC, checksum'],
        ['Physical', 'Bits', 'Voltage, light, radio'],
      ],
    ),
    note(
      'Everyone says "packet" for all of them in conversation, including engineers who know better. Use the precise word once in an interview to show you know it, then relax.',
    ),

    h('What the headers actually contain'),
    p('The three you should be able to sketch. Every field here shows up somewhere else in this track:'),
    table(
      ['Header', 'Fields worth naming', 'Where it comes back'],
      [
        ['**Ethernet**', 'Destination MAC, source MAC, type, CRC', '`mac-and-arp`'],
        ['**IP**', 'Source IP, destination IP, **TTL**, protocol (6 = TCP, 17 = UDP), fragment fields', '`routing`, `the-tools`'],
        ['**TCP**', 'Source port, destination port, **sequence**, **ack**, flags (SYN/ACK/FIN/RST), **window**', '`tcp-handshake`, `reliability-and-congestion`'],
      ],
    ),
    p(
      'Two of those fields do a lot of work later. **TTL** is a hop counter that every router decrements; at zero the packet is dropped and an ICMP error is returned — which is the entire trick behind `traceroute`. **Protocol** is how the receiving IP layer knows whether to hand the payload to TCP or to UDP.',
    ),

    h('Overhead, and why it matters'),
    p(
      'Headers are not free. A bare TCP/IP over Ethernet stack costs roughly **54 bytes** per packet — 14 Ethernet, 20 IP, 20 TCP. Sending a 1-byte payload therefore puts 55 bytes on the wire.',
    ),
    ul(
      'This is why chatty protocols are slow: a thousand tiny writes cost a thousand headers plus a thousand round trips.',
      'It is why `Nagle’s algorithm` exists — TCP will hold small writes briefly to coalesce them, which is also why some latency-sensitive apps disable it with `TCP_NODELAY`.',
      'It is why HTTP/2 compresses headers: on a typical request the headers were bigger than the body.',
    ),

    h('MTU, and the number 1500'),
    p(
      '**MTU** — maximum transmission unit — is the largest frame payload a link will carry. Ethernet’s is **1500 bytes**, which is where the number in every networking log comes from. Subtract 20 for IP and 20 for TCP and you get the **MSS**, 1460 bytes of actual data per full segment.',
    ),
    table(
      ['Path', 'Typical MTU', 'Why'],
      [
        ['Ethernet / most of the internet', '1500', 'The standard everything defaults to'],
        ['A VPN or tunnel', '~1400–1460', 'The tunnel adds its own header inside the same 1500'],
        ['A data-centre network with jumbo frames', '9001', 'Fewer headers per megabyte — AWS supports this inside a VPC'],
      ],
    ),
    warn(
      '**MTU mismatches are a classic invisible bug.** Small requests work, large ones hang forever: the big packet needs fragmenting, the `Don’t Fragment` bit is set, the router replies with an ICMP "fragmentation needed" — and some firewall silently drops ICMP, so the sender never learns. This is called a **PMTU black hole**, and it is why "SSH connects then freezes when I `cat` a big file" is an MTU question, not an SSH question.',
    ),
    tip(
      'Test it in one line: `ping -M do -s 1472 example.com` sends a 1472-byte payload (+28 of headers = 1500) with fragmentation forbidden. If that fails and `-s 1400` succeeds, your path MTU is below 1500.',
    ),

    h('Fragmentation'),
    p(
      'If a packet is too big for the next link, IPv4 lets a router split it into fragments that the *destination* reassembles. It is universally considered a bad thing: one lost fragment costs the whole packet, and firewalls handle fragments badly. **IPv6 removed router fragmentation entirely** — the sender must discover the path MTU and size its packets correctly, which is why IPv6 depends on ICMP being allowed through.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Name the unit at layer 4 / 3 / 2', 'Segment (or datagram) / packet / frame'],
      ['Explain encapsulation', 'Each layer wraps the one above in its own header; the receiver unwraps in reverse'],
      ['Explain TTL', 'A hop counter; hits zero, packet dies, ICMP comes back — this is how traceroute works'],
      ['Explain the 1500', 'Ethernet MTU; MSS is 1460 after IP and TCP headers'],
      ['Diagnose "small requests work, big ones hang"', 'Path MTU, and probably ICMP being blocked'],
      ['Reduce header overhead', 'Fewer, larger writes; HTTP/2 header compression; jumbo frames inside a data centre'],
    ]),

    h('Interview'),
    asked([
      ['What is encapsulation?', 'Each layer wraps the payload from the layer above in its own header, and the receiver strips them in reverse order.'],
      ['Segment vs packet vs frame?', 'Transport, network and data-link units — the same data with one more header each time.'],
      ['What is in an IP header?', 'Source and destination address, TTL, protocol number, length and fragmentation fields.'],
      ['What is TTL for?', 'To kill packets caught in routing loops; each router decrements it and drops it at zero.'],
      ['What is MTU and MSS?', 'MTU is the largest frame payload a link takes (1500 on Ethernet); MSS is MTU minus the IP and TCP headers, so 1460.'],
      ['Why is fragmentation bad?', 'One lost fragment loses the whole packet, and IPv6 removed it in favour of path MTU discovery.'],
    ]),

    links(
      wiki('Encapsulation_(networking)', 'Encapsulation'),
      wiki('Maximum_transmission_unit', 'Maximum transmission unit'),
      rfc(791, 'RFC 791 — Internet Protocol'),
    ),
  ],
};
