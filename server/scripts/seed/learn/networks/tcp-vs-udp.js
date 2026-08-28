import { asked, cheat, code, h, links, note, p, rfc, sh, table, tip, ul, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'IP gets a packet to a machine. **Transport** gets it to the right *process* on that machine, and decides how much it promises about delivery. There are two choices and you already know both names: **TCP**, which promises a great deal, and **UDP**, which promises almost nothing and is faster for exactly that reason.',
    ),

    h('The comparison'),
    table(
      ['', 'TCP', 'UDP'],
      [
        ['Connection', 'Yes — a handshake first', 'None — just send'],
        ['Reliability', '**Guaranteed** delivery: lost data is retransmitted', 'None. Lost is lost'],
        ['Ordering', '**Guaranteed** — bytes arrive in order', 'None. Packets can arrive out of order'],
        ['Duplicates', 'Removed', 'Possible'],
        ['Flow control', 'Yes — will not overwhelm the receiver', 'No'],
        ['Congestion control', 'Yes — backs off when the network is busy', 'No — will happily flood a link'],
        ['Header size', '20 bytes', '**8 bytes**'],
        ['Model', 'A **stream** of bytes', 'Independent **messages** (datagrams)'],
        ['Speed', 'Slower to start, steady after', 'Immediate, no setup'],
        ['Broadcast / multicast', 'No', 'Yes'],
      ],
    ),
    p(
      'Two rows in there are the ones people forget in interviews and they are the interesting ones. **Congestion control** is why a UDP flood can wreck a shared link while TCP politely slows down. And **stream vs message** has a real consequence for your code: TCP has no concept of a message boundary, so two `write()` calls can arrive as one `read()`, or one can arrive as three. Every protocol over TCP — HTTP included — must define its own framing, which is what `Content-Length` is for.',
    ),

    h('Who uses which'),
    table(
      ['TCP', 'UDP'],
      [
        ['HTTP/1.1 and HTTP/2, so most of the web', 'DNS queries (small, retry is cheap)'],
        ['SSH, SFTP, FTP', 'Video and voice calls, live streaming'],
        ['SMTP, IMAP — email', 'Online game state'],
        ['Database connections (Postgres, MySQL)', 'DHCP, NTP, SNMP'],
        ['TLS, and therefore HTTPS', '**QUIC — and so HTTP/3**'],
      ],
    ),
    note(
      'The last row is the twist worth knowing. HTTP/3 runs over **QUIC**, which runs over **UDP** — but QUIC rebuilds reliability, ordering and congestion control in user space, plus encryption. So it is not “the web gave up on reliability”; it is “the web rebuilt reliability somewhere it can be changed without waiting for every operating system on earth to update”.',
    ),

    h('Why anything chooses UDP'),
    p('Four reasons, and each is a good interview answer because each names a real system:'),
    ul(
      '**Late data is worthless.** In a voice call, a packet from 400 ms ago has no use — playing it late is worse than dropping it. TCP would insist on retransmitting it and stall everything behind it.',
      '**The exchange is one packet each way.** A DNS query and its answer fit in one datagram; a three-packet handshake to send one packet would triple the cost.',
      '**You want broadcast or multicast.** TCP is strictly point-to-point. Service discovery and IPTV need one-to-many.',
      '**You want to build your own reliability.** Games retransmit *only* what still matters; QUIC does congestion control it can ship updates to. TCP’s guarantees are all-or-nothing and live in the kernel.',
    ),
    warn(
      '“UDP is faster” is a half-answer that invites a follow-up. UDP has **less overhead and no setup delay**; the raw bits do not travel faster. And when a UDP application needs reliability it reimplements it, often worse than TCP. The right framing is: *UDP is faster because it does less, and you choose it when the things TCP does are things you do not want.*',
    ),

    h('The headers, side by side'),
    code(
      sh(`
UDP — 8 bytes                     TCP — 20 bytes minimum
+----------------+                +--------------------------------+
| source port    |                | source port | destination port |
| dest port      |                | sequence number                |
| length         |                | acknowledgement number         |
| checksum       |                | flags (SYN ACK FIN RST PSH URG)|
+----------------+                | window size | checksum         |
                                  +--------------------------------+
`),
    ),
    p(
      'Everything TCP promises is paid for in that header: sequence numbers give ordering, acknowledgement numbers give reliability, the window gives flow control, the flags give connection state. UDP has ports and a checksum, because ports are the one thing you cannot do without at layer 4.',
    ),

    h('In code, the difference is small'),
    code(
      sh(`
# TCP: connect, then a stream
nc example.com 80

# UDP: no connection, just send a datagram
nc -u 8.8.8.8 53
`),
    ),
    tip(
      'In Node the split is `net`/`http` (TCP) versus `dgram` (UDP). You will almost certainly never write a UDP server in an application job — but you will absolutely be asked to justify the choice, and “metrics shipping over UDP because losing a datapoint is cheaper than blocking the app” is a good concrete answer.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Need every byte, in order', 'TCP'],
      ['Need it *now*, stale is useless', 'UDP'],
      ['One small question and answer', 'UDP — DNS'],
      ['Send to many receivers at once', 'UDP multicast'],
      ['Want your own retransmission policy', 'UDP, and build on it — this is QUIC'],
      ['Frame messages over TCP', 'Your own length prefix — TCP has no boundaries'],
    ]),

    h('Interview'),
    asked([
      ['TCP vs UDP?', 'TCP is connection-oriented, reliable, ordered and congestion-controlled; UDP is connectionless with none of those and an 8-byte header.'],
      ['When would you use UDP?', 'Real-time media, DNS, gaming, telemetry — anywhere late data is useless or a handshake costs more than the payload.'],
      ['Is UDP faster?', 'It has no setup and less overhead; the bits do not travel faster, and any reliability you need you must build yourself.'],
      ['Does TCP preserve message boundaries?', 'No — it is a byte stream, so protocols on top must frame themselves, which is what Content-Length does.'],
      ['Why does HTTP/3 use UDP?', 'QUIC rebuilds ordering, reliability and encryption in user space, so it can evolve without kernel changes and avoid TCP head-of-line blocking.'],
      ['Which does DNS use?', 'UDP 53, falling back to TCP for responses over 512 bytes and for zone transfers.'],
    ]),

    links(
      wiki('Transmission_Control_Protocol', 'TCP'),
      wiki('User_Datagram_Protocol', 'UDP'),
      rfc(9293, 'RFC 9293 — Transmission Control Protocol'),
    ),
  ],
};
