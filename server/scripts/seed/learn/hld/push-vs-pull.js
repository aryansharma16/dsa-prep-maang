import { asked, diagram, h, links, p, quick, table, tip, warn, wiki } from '../blocks.js';
import { seeAlso } from './shapes.js';

export const doc = {
  blocks: [
    p(
      'The server has something new. How does the client find out? **Four answers, and the choice is decided by direction, frequency and how much statefulness you are willing to operate.**',
    ),

    h('The four'),
    diagram(
      `
   SHORT POLLING                     LONG POLLING
   ask repeatedly                    ask, server HOLDS the request

   C ──▶ S  nothing                  C ──▶ S ......... holds 30s
   C ──▶ S  nothing                          │
   C ──▶ S  nothing                          ▼ data arrives
   C ──▶ S  HERE                     C ◀──── S  HERE
                                     C ──▶ S  (immediately re-asks)
   ✓ trivial, stateless
   ✗ ~99% wasted requests            ✓ near-instant, still HTTP
   ✗ latency = the interval          ✗ a held connection per client


   SERVER-SENT EVENTS                WEBSOCKETS
   one long-lived stream, S ──▶ C    full duplex, both ways

   C ──▶ S  (once)                   C ◀══▶ S   one TCP connection,
   C ◀── S  event                              both sides send freely
   C ◀── S  event
   C ◀── S  event                    ✓ lowest per-message overhead
                                     ✓ bidirectional
   ✓ plain HTTP, auto-reconnect      ✗ not HTTP after the upgrade
   ✓ text streams                    ✗ proxies, load balancers and
   ✗ SERVER TO CLIENT ONLY             auth all need special handling
   ✗ ~6 connections per browser
     on HTTP/1.1
`,
      'Four mechanisms, drawn',
    ),

    h('Comparison'),
    table(
      ['', 'Short poll', 'Long poll', 'SSE', 'WebSocket'],
      [
        ['Direction', 'C→S', 'C→S', '**S→C only**', '**Both**'],
        ['Latency', 'Half the interval', 'Near-instant', 'Instant', 'Instant'],
        ['Wasted requests', '**Most of them**', 'Few', 'None', 'None'],
        ['Protocol', 'HTTP', 'HTTP', 'HTTP', 'Upgraded from HTTP'],
        ['Reconnect', 'N/A', 'Manual', '**Automatic, with event id**', 'Manual'],
        ['Proxy friendly', '**Yes**', 'Mostly', 'Mostly', 'Often needs config'],
        ['Server state', 'None', 'A held request per client', 'A connection per client', 'A connection per client'],
        ['Good for', 'Infrequent, tolerant', 'A stopgap', '**Feeds, notifications, tickers, token streaming**', '**Chat, games, collaboration**'],
      ],
    ),
    tip(
      'SSE is the underused one. If updates only flow **server to client** — notifications, a live feed, a progress bar, LLM token streaming — it is plain HTTP, it reconnects by itself, it resumes from the last event id, and it needs none of the infrastructure work WebSockets do.',
    ),

    h('Choosing'),
    diagram(
      `
   does the CLIENT need to send messages too?
        │
        ├── yes ──▶ frequently?  ──▶ WEBSOCKET
        │           rarely?      ──▶ SSE down + ordinary POSTs up
        │
        └── no ───▶ how fresh must it be?
                       │
                       ├── instant   ──▶ SSE
                       ├── seconds   ──▶ SSE, or long polling
                       └── a minute  ──▶ SHORT POLLING. genuinely.
`,
      'Three questions',
    ),
    warn(
      'Polling is not a failure mode. A dashboard refreshing every thirty seconds is **stateless, cacheable, trivially load balanced and survives any restart** — properties a WebSocket fleet has to work hard for. Reach for a connection only when the latency requirement demands it.',
    ),

    h('What a persistent connection actually costs'),
    table(
      ['Cost', 'Detail'],
      [
        ['**Memory per connection**', 'A few KB; a million connections is gigabytes'],
        ['**Statefulness**', 'The socket is on one machine — routing to it is now your problem'],
        ['**Load balancer config**', 'Long idle timeouts, sticky routing, upgrade support'],
        ['**Deploys disconnect everyone**', 'A rolling restart drops every socket; clients reconnect in a wave'],
        ['**Auth on a long connection**', 'A token expiring mid-connection has no natural place to be refused'],
        ['**Scaling is by connections**', 'Not by CPU — an idle socket uses none'],
      ],
    ),
    tip(
      'The **reconnect thundering herd** is the operational gotcha. Restart a fleet and every client reconnects at once, and a client that retries immediately turns a deploy into an outage. Reconnection must use exponential backoff with jitter, on the client.',
    ),

    h('Scaling a connection tier'),
    table(
      ['Problem', 'Solution'],
      [
        ['Sockets live on one machine', 'A session registry mapping user → server'],
        ['Broadcasting to all clients', 'A pub/sub bus each connection server subscribes to'],
        ['The client is backgrounded', 'Fall back to push notifications'],
        ['Messages missed while disconnected', 'A per-user buffer, or resume from a last-seen id'],
        ['Uneven connection counts', 'Balance on connection count, not requests'],
      ],
    ),

    h('Interview'),
    quick([
      ['What it is', 'Four ways for a client to learn about server-side changes'],
      ['Why it matters', 'It decides whether your service tier is stateless'],
      ['Use when', 'Anything described as "live", "real-time" or "streaming"'],
      ['Trade-off', 'Persistent connections give instant delivery and cost statefulness'],
      [
        '30-second answer',
        '"Short polling wastes almost every request and its latency is the interval, but it is stateless and survives anything. Long polling is a stopgap. SSE is a server-to-client stream over plain HTTP with automatic reconnection and resume — the right default for feeds, notifications and token streaming. WebSockets are full duplex and the answer for chat and collaboration, at the cost of a stateful connection tier: a session registry, a pub/sub bus, and reconnect storms on every deploy."',
      ],
    ]),
    asked([
      ['WebSockets or SSE?', 'SSE if data only flows server to client — simpler, plain HTTP, auto-reconnecting. WebSockets when the client sends frequently too.'],
      ['When is polling still right?', 'When a minute of staleness is fine. It is stateless and survives restarts, which a connection tier does not.'],
      ['What does a persistent connection cost?', 'Memory per socket, a stateful tier, load balancer config, and every deploy disconnecting everyone.'],
      ['How do you route a message to a socket on another server?', 'A session registry maps user to server, and a pub/sub bus carries the message there.'],
      ['What is the reconnect thundering herd?', 'Every client reconnecting at once after a restart. Fix with exponential backoff and jitter on the client.'],
    ]),

    seeAlso('Computer Networks', 'WebSockets and real-time', 'the upgrade handshake and frame format'),
    links(wiki('Server-sent_events', 'Server-sent events'), wiki('WebSocket', 'WebSocket')),
  ],
};
