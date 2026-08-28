import { asked, cheat, code, h, links, p, rfc, sh, table, tip, ul, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'TCP is connection-oriented, which means both sides agree to talk before either sends data. The agreement is three packets to open and four to close, and the reason for those numbers is a standard interview question with a genuinely good answer.',
    ),

    h('Opening: SYN, SYN-ACK, ACK'),
    code(
      sh(`
client                                                server
  |                                                     |  LISTEN
  |--- SYN,  seq=x ------------------------------------>|  SYN_RECEIVED
  |<-- SYN-ACK, seq=y, ack=x+1 -------------------------|
  |--- ACK,  ack=y+1 ---------------------------------->|  ESTABLISHED
  |                                                     |
  |=== data can now flow, both directions ==============|
`),
    ),
    p(
      'Each side picks a random **initial sequence number** and the other acknowledges it with `+1`. Randomising it is not decoration: a predictable ISN lets an attacker inject packets into someone else’s connection, which was a real attack.',
    ),

    h('Why three and not two'),
    p(
      'A TCP connection is **two independent streams**, one in each direction. Each direction needs its sequence number announced *and* acknowledged, which is four events: SYN→, ←ACK, ←SYN, ACK→. The middle two travel in one packet, so three packets carry four facts.',
    ),
    p(
      'Two packets would leave the server unsure the client can actually receive: without the final ACK, a spoofed SYN with a forged source address would open a real connection to a machine that never asked. Which is exactly the next section.',
    ),

    h('SYN flood, and SYN cookies'),
    p(
      'Between the SYN and the final ACK the server holds a **half-open** connection in a queue, waiting. Send thousands of SYNs from forged addresses and never complete them, and that queue fills — legitimate clients then get nothing. That is a **SYN flood**, the classic layer-4 denial of service.',
    ),
    p(
      'The defence is **SYN cookies**: instead of storing state, the server encodes the connection details into the sequence number it sends back, keeps nothing, and reconstructs the state only if a valid final ACK arrives. It is on by default on Linux, and it is a satisfying thing to be able to explain.',
    ),

    h('Closing: four packets, because each side closes separately'),
    code(
      sh(`
client                                     server
  |--- FIN -------------------------------->|   "I'm done sending"
  |<-- ACK ---------------------------------|
  |                                         |   ... server may still send data ...
  |<-- FIN ---------------------------------|   "so am I"
  |--- ACK --------------------------------->|
  |  TIME_WAIT (2 x MSL, typically 60s)     |   CLOSED
`),
    ),
    p(
      'Opening is symmetric — both directions start together. Closing is not: one side can finish sending while the other still has data to deliver. That state is called **half-closed**, and it is why the close takes four messages rather than three.',
    ),

    h('The states you will actually see in logs'),
    table(
      ['State', 'Means', 'Lots of them means'],
      [
        ['`LISTEN`', 'A server waiting for connections', 'Normal'],
        ['`SYN_SENT`', 'Client sent SYN, waiting', 'The destination is unreachable or filtered'],
        ['`SYN_RECV`', 'Half-open, waiting for the final ACK', 'Possibly a SYN flood'],
        ['`ESTABLISHED`', 'Open, data can flow', 'Normal — count them to see real concurrency'],
        ['`FIN_WAIT_1/2`', 'We closed, waiting on them', 'The peer is slow to close'],
        ['`CLOSE_WAIT`', '**They closed, we have not**', '**A bug in your code** — sockets not being closed'],
        ['`TIME_WAIT`', 'We closed last, waiting out stragglers', 'High connection churn — see below'],
      ],
    ),
    warn(
      'Piles of `CLOSE_WAIT` are the one that means *your* code is wrong: the peer sent FIN and your application never called close. It is a socket leak, and it will eventually exhaust file descriptors. Piles of `TIME_WAIT`, by contrast, are usually normal.',
    ),
    code(
      sh(`
ss -s                          # summary by state
ss -tan | awk '{print $1}' | sort | uniq -c | sort -rn
netstat -an | grep TIME_WAIT | wc -l
`),
    ),

    h('TIME_WAIT, explained properly'),
    p(
      'The side that closes **last** — usually the client, but the server if it closes first — holds the socket in `TIME_WAIT` for twice the maximum segment lifetime, typically 60 seconds. It does this for two reasons: to absorb any delayed duplicate packet from the old connection so it cannot be mistaken for part of a new one on the same port pair, and to be able to resend the final ACK if it was lost.',
    ),
    ul(
      'Thousands of `TIME_WAIT` sockets on a **client** or a proxy is normal at high request rates.',
      'It becomes a real problem only when you run out of **ephemeral ports** to the same destination — roughly 28,000 by default — which shows up as connection failures under load.',
      'The correct fix is almost always **connection reuse**: HTTP keep-alive, a connection pool, an agent with `keepAlive: true`. Not tuning kernel parameters, and never `tcp_tw_recycle`, which is removed and was dangerous behind NAT.',
    ),
    tip(
      'This is why an HTTP client in a hot loop should share one agent. Every `fetch` that opens a fresh connection pays a handshake *and* leaves a `TIME_WAIT` behind; a pooled connection pays neither.',
    ),

    h('RST — the abrupt end'),
    p(
      'A **RST** is not part of the handshake; it is "this connection does not exist, stop". You get one when you connect to a port nothing is listening on (`ECONNREFUSED`), when a process crashes with sockets open, or when a middlebox kills an idle connection. In application terms:',
    ),
    table(
      ['You see', 'Meaning'],
      [
        ['`ECONNREFUSED`', 'RST on connect — the host is up, nothing is listening on that port'],
        ['`ECONNRESET`', 'RST mid-connection — the peer or a middlebox tore it down'],
        ['Timeout, no reply at all', 'Not TCP — a firewall is dropping silently. See `common-failures`'],
      ],
    ),

    h('Cheatsheet'),
    cheat([
      ['Open a connection', 'SYN, SYN-ACK, ACK'],
      ['Close one', 'FIN, ACK, FIN, ACK — plus TIME_WAIT on the closer'],
      ['Explain three packets', 'Two directions, each needing a sequence number announced and acknowledged'],
      ['Defend against a SYN flood', 'SYN cookies — no state until the final ACK'],
      ['Diagnose many `CLOSE_WAIT`', 'Your application is not closing sockets'],
      ['Diagnose many `TIME_WAIT`', 'Connection churn — reuse connections, keep-alive, pooling'],
      ['Inspect states', '`ss -tan`, `ss -s`'],
    ]),

    h('Interview'),
    asked([
      ['Describe the three-way handshake.', 'SYN with the client’s ISN, SYN-ACK with the server’s ISN acknowledging it, ACK acknowledging the server’s — then data flows.'],
      ['Why three packets and not two?', 'Two independent directions each need their sequence number sent and acknowledged; the two middle events share one packet.'],
      ['Why is closing four packets?', 'Each direction closes separately, so a half-closed state exists where one side still sends.'],
      ['What is TIME_WAIT for?', 'To absorb delayed duplicates from the old connection and to be able to resend the final ACK.'],
      ['What does a pile of CLOSE_WAIT mean?', 'The application is not closing sockets after the peer sent FIN — a leak in your code.'],
      ['What is a SYN flood and how is it mitigated?', 'Half-open connections from forged SYNs exhausting the queue; SYN cookies store no state until a valid ACK returns.'],
      ['ECONNREFUSED vs a timeout?', 'Refused is an RST — the host answered and nothing is listening; a timeout means packets were dropped silently, usually a firewall.'],
    ]),

    links(
      wiki('Transmission_Control_Protocol', 'TCP'),
      rfc(9293, 'RFC 9293 — Transmission Control Protocol'),
      wiki('SYN_flood', 'SYN flood'),
    ),
  ],
};
