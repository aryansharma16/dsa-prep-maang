import { asked, cheat, code, h, js, links, mdn, note, p, rfc, sh, table, tip, ul, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'HTTP is request/response: the client asks, the server answers, done. A chat app, a live dashboard or a notification bell needs the opposite — the **server** wants to speak first. There are four ways to arrange that, and picking between them is a standard system design question.',
    ),

    h('The four options'),
    table(
      ['Approach', 'How', 'Direction', 'Cost'],
      [
        ['**Short polling**', 'Ask every N seconds', 'Client → server', 'Wasteful; latency up to N'],
        ['**Long polling**', 'Ask, server holds the request open until it has news', 'Client → server', 'One connection held per client; a reconnect per message'],
        ['**SSE** (Server-Sent Events)', 'One long-lived HTTP response, streamed', '**Server → client only**', 'One connection per client; text only'],
        ['**WebSocket**', 'Upgrade HTTP to a persistent two-way socket', '**Both ways**', 'One connection per client; not plain HTTP any more'],
      ],
    ),
    tip(
      '**The interview-safe rule: if only the server needs to push, use SSE. If both sides talk continuously, use WebSockets. If updates are rare and staleness is acceptable, polling is genuinely fine** — and saying so is a better answer than reaching for WebSockets by reflex, because they cost a held connection per user and every box between you and them has an opinion about that.',
    ),

    h('Short polling and long polling'),
    code(
      js(`
// Short polling — simple, and mostly wasted requests
setInterval(() => fetch('/api/messages?since=' + last).then(render), 3000);

// Long polling — the server does not answer until there is something to say
async function poll() {
  const res = await fetch('/api/messages/wait?since=' + last);  // may hang 30s
  render(await res.json());
  poll();                                                        // immediately again
}
`),
    ),
    p(
      'Long polling was how everything worked before WebSockets and it still has one real advantage: it is ordinary HTTP, so every proxy, load balancer and corporate firewall on earth handles it without special configuration.',
    ),

    h('Server-Sent Events'),
    p(
      'SSE is a single HTTP response with `Content-Type: text/event-stream` that never ends. The server writes lines; the browser turns each into an event. It is far simpler than WebSockets and does the job most “real-time” features actually need.',
    ),
    code(
      js(`
// Server
res.writeHead(200, {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
});
setInterval(() => res.write(\`data: \${JSON.stringify({ now: Date.now() })}\\n\\n\`), 1000);

// Browser — reconnects on its own, and remembers where it was
const es = new EventSource('/api/stream');
es.onmessage = (e) => render(JSON.parse(e.data));
`),
    ),
    ul(
      '**Automatic reconnection is built in**, with a `Last-Event-ID` header so the server can resume — a feature you would otherwise write yourself.',
      'It is plain HTTP, so it works with HTTP/2 multiplexing and ordinary infrastructure.',
      'Text only, one direction. The client still uses normal requests to send.',
    ),
    warn(
      'Over HTTP/1.1 the browser’s six-connections-per-host limit counts an SSE stream — open one per tab and a couple of tabs can starve the rest of the site. Over HTTP/2 it is a multiplexed stream and the problem disappears, which is one more reason to be behind a modern proxy.',
    ),

    h('WebSockets'),
    p(
      'A WebSocket starts as an ordinary HTTP request and then stops being HTTP. The client asks to upgrade; the server answers **`101 Switching Protocols`**; from then on the same TCP connection carries small binary frames in both directions with no headers per message.',
    ),
    code(
      sh(`
GET /socket HTTP/1.1
Host: example.com
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
Sec-WebSocket-Version: 13

HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=
`),
    ),
    p(
      'The URL scheme is `ws://` or, over TLS, **`wss://`** — and it should always be `wss://`, because plain `ws://` is blocked from HTTPS pages and readable by anyone on the path.',
    ),
    p('What that buys, and what it costs:'),
    table(
      ['Gains', 'Costs'],
      [
        ['Two-way, low latency, no per-message headers', 'A held connection per client — memory and file descriptors'],
        ['Binary frames', '**Stateful** — a connection belongs to one server instance'],
        ['One connection, many message types', 'No HTTP caching, no ordinary load-balancer routing'],
      ],
    ),

    h('What breaks in production'),
    ul(
      '**Idle timeouts.** Load balancers close quiet connections — an AWS ALB defaults to 60 seconds. Send a **ping/heartbeat** every 30 or your users silently disconnect. This is the number one WebSocket bug in the wild.',
      '**Scaling across instances.** User A is connected to instance 1, user B to instance 2. A message from A never reaches B unless the instances share a bus — Redis pub/sub, a message broker, or a managed service. That is the standard follow-up question in a chat-app design.',
      '**Reconnection is yours to write.** Unlike SSE, nothing reconnects for you. Exponential backoff, resubscribe, and replay missed messages.',
      '**Sticky sessions or not.** WebSockets pin a client to an instance for the connection’s life, so a deploy drops every connection. Plan for reconnect storms.',
      '**Proxies.** nginx needs `proxy_set_header Upgrade` and `Connection` explicitly; an ALB needs no special config, an old corporate proxy may refuse entirely.',
    ),
    note(
      'This is why Socket.IO exists and stays popular: it wraps WebSockets with reconnection, heartbeats, rooms, acknowledgements and a long-polling fallback. Worth naming as a library that solves the operational list above, not as a protocol.',
    ),

    h('Choosing, out loud'),
    table(
      ['Feature', 'Pick', 'Because'],
      [
        ['Notification bell, live counter', '**SSE** or polling', 'One direction, low volume'],
        ['Live dashboard, log tail, LLM token stream', '**SSE**', 'Server-push only, and it reconnects itself'],
        ['Chat, multiplayer, collaborative editing', '**WebSocket**', 'Both sides send constantly'],
        ['Order status that changes twice an hour', '**Polling**', 'A held connection per user buys nothing'],
        ['Video or voice media', 'WebRTC', 'Peer-to-peer UDP; a socket is only for signalling'],
      ],
    ),

    h('Cheatsheet'),
    cheat([
      ['Push server → client, simply', 'SSE — `text/event-stream`, auto-reconnect'],
      ['Two-way, low latency', 'WebSocket over `wss://`'],
      ['Survive corporate proxies', 'Long polling, or a library with a fallback'],
      ['Stop silent disconnects', 'Heartbeat below the load balancer’s idle timeout'],
      ['Broadcast across instances', 'Redis pub/sub or a message broker'],
      ['Handle a deploy', 'Client-side reconnect with backoff and resubscribe'],
    ]),

    h('Interview'),
    asked([
      ['Polling vs long polling vs SSE vs WebSockets?', 'Repeated asks; a held request answered on news; a one-way streamed HTTP response; a persistent two-way socket after an upgrade.'],
      ['How does a WebSocket start?', 'An HTTP request with Upgrade and Connection headers, answered with 101 Switching Protocols on the same TCP connection.'],
      ['When would you use SSE over WebSockets?', 'When only the server pushes — it is plain HTTP, reconnects automatically and needs no special infrastructure.'],
      ['How do you scale WebSockets across servers?', 'A shared pub/sub bus, because a connection lives on exactly one instance.'],
      ['Why do my connections drop after a minute?', 'A load balancer idle timeout — send heartbeats more often than it.'],
      ['What are the costs of WebSockets?', 'A held connection per client, statefulness, no HTTP caching, and reconnection logic you must write.'],
    ]),

    links(
      mdn('Web/API/WebSockets_API', 'The WebSocket API'),
      mdn('Web/API/Server-sent_events', 'Server-sent events'),
      rfc(6455, 'RFC 6455 — The WebSocket Protocol'),
    ),
  ],
};
