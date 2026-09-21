import { asked, diagram, flow, h, links, p, quick, table, tip, tradeoff, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'A real-time system has one property nothing else in this track has: **a tier that cannot be stateless.** A socket lives on one machine, and every hard problem — routing, presence, fan-out, deploys — follows from that.',
    ),

    flow(['Client', 'Connection server', 'Session registry', 'Pub/sub', 'Other connection servers'], 'The shape'),

    h('The core problem'),
    diagram(
      `
   A is on server 1. B is on server 7. A messages B.

   ┌──────────┐                            ┌──────────┐
   │ conn s1  │                            │ conn s7  │
   │   [A]    │                            │   [B]    │
   └────┬─────┘                            └────▲─────┘
        │                                       │
        │ 1. who has B?                         │ 4. write to
        ▼                                       │    B's socket
   ┌───────────────────────┐                    │
   │  SESSION REGISTRY     │                    │
   │  user ──▶ server      │                    │
   │  TTL'd, heartbeated   │                    │
   └──────────┬────────────┘                    │
              │ 2. "server 7"                   │
              ▼                                 │
   ┌───────────────────────┐   3. publish to    │
   │    PUB/SUB BUS        │──── s7's channel ──┘
   └───────────────────────┘

   the registry and the bus are the entire architecture.
`,
      'Two components make it work',
    ),
    table(
      ['Component', 'Job', 'Usually'],
      [
        ['**Connection servers**', 'Hold sockets, read and write frames', 'A stateful, connection-count-balanced tier'],
        ['**Session registry**', 'Maps user → server, with a TTL', 'Redis, heartbeated'],
        ['**Pub/sub bus**', 'Carries a message to the right server', 'Redis pub/sub, NATS, or Kafka'],
        ['**Buffer / mailbox**', 'Holds messages for the disconnected', 'A durable store — this one must not lose data'],
        ['**Push gateway**', 'Wakes a backgrounded app', 'APNs, FCM'],
      ],
    ),
    tip(
      'Keep the connection servers as **dumb pipes**. All they should do is hold sockets and forward frames — no business logic, no database access. That way they can be restarted freely and scaled purely on connection count.',
    ),

    h('Fan-out: write or read'),
    tradeoff([
      ['**Fan-out on write**', 'Reads are O(1) — the recipient\'s list is already built', 'A post to 100M followers is 100M writes'],
      ['**Fan-out on read**', 'Writes are O(1)', 'Reads get slower as a user follows more accounts'],
    ]),
    diagram(
      `
   the hybrid, which is what everyone actually does

   producer posts
        │
        ├── followers < threshold ──▶ PUSH into each recipient's
        │                              feed / socket
        │
        └── followers ≥ threshold ──▶ DO NOTHING.
                                      recipients PULL it when
                                      they read.

   normal user   ──▶ push   (cheap, instant)
   celebrity     ──▶ pull   (one write instead of millions)

   nobody follows ten thousand celebrities, so the
   read-time merge stays small too.
`,
      'Both halves stay bounded',
    ),

    h('Presence'),
    p(
      'Knowing who is online sounds trivial and is not: a disconnect is often **silent**, so "online" has to be a claim with an expiry rather than a flag someone sets.',
    ),
    table(
      ['Approach', 'How', 'Problem'],
      [
        ['A boolean flag', '`online = true` on connect, false on disconnect', '**A crash leaves them online forever**'],
        ['**Heartbeat + TTL**', '`SETEX presence:42 30`, refreshed every 10s', 'Up to 30s of staleness — and that is fine'],
        ['Fan out every change', 'Notify every contact on connect/disconnect', 'A flapping mobile connection becomes a storm'],
        ['**Subscribe on demand**', 'Only track presence for contacts currently on screen', '**The scalable answer**'],
      ],
    ),
    warn(
      'Presence fan-out is a surprisingly effective way to melt a system. One user with 5,000 contacts on a flapping mobile connection generates **10,000 presence updates a minute** — which is why real systems only compute presence for the handful of contacts a client is actually looking at.',
    ),

    h('Delivery guarantees'),
    table(
      ['Guarantee', 'How'],
      [
        ['**Not lost**', 'Persist to a durable mailbox **before** routing to the socket'],
        ['**Ordered per conversation**', 'A sequence number per conversation; the client reorders'],
        ['**Deduplicated**', 'A client-generated message id; the server ignores repeats'],
        ['**Resumable**', 'The client reconnects with its last-seen id and gets the gap'],
        ['**Acknowledged**', 'Delivered and read receipts are separate messages travelling back'],
      ],
    ),
    tip(
      '**Persist before routing.** If a message is written to the recipient\'s socket and that server dies mid-write, a message you acknowledged to the sender has vanished with no trace. Store it, deliver it, then delete it on acknowledgement.',
    ),

    h('Scaling and operating it'),
    table(
      ['Concern', 'Handling'],
      [
        ['Connections per server', '~100k–1M with tuned file descriptors and buffers; memory is the limit'],
        ['Load balancing', 'By **connection count**, not request rate — an idle socket uses no CPU'],
        ['Deploys', 'Every restart disconnects everyone. Drain slowly; clients reconnect with jitter'],
        ['Reconnect storms', 'Exponential backoff with jitter, enforced client-side'],
        ['Registry failure', 'Fall back to mailbox plus push — slower, still correct'],
        ['Hot conversation', 'A huge group is a fan-out problem; switch it to pull'],
      ],
    ),
    warn(
      'A rolling deploy of a connection tier is **a self-inflicted thundering herd**: every socket drops and every client reconnects. Drain instances gradually, and make sure client reconnection uses jitter — otherwise the deploy is the outage.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'Delivering messages to clients holding open connections'],
      ['The hard part', 'A socket lives on one machine; everything else follows'],
      ['Use when', 'Chat, collaboration, live updates, presence'],
      ['Trade-off', 'Instant delivery, for a stateful tier and disruptive deploys'],
      [
        '30-second answer',
        '"Clients hold connections to a stateful tier of dumb pipes. A session registry maps user to server and a pub/sub bus carries a message to whichever server holds the socket — or to a durable mailbox plus a push notification if they are offline. Persist before routing, so a server dying mid-write cannot lose an acknowledged message. Fan-out is hybrid: push for normal recipients, pull for very large audiences. Presence is a heartbeat with a TTL, computed only for contacts on screen."',
      ],
    ]),
    asked([
      ['How do you deliver to a user on another server?', 'A session registry maps user to server; a pub/sub bus carries the message there.'],
      ['How do you handle offline users?', 'A durable mailbox plus a push notification, deleted on acknowledgement.'],
      ['How does presence scale?', 'Heartbeat with a TTL, and only track contacts the client is currently displaying.'],
      ['Why persist before routing?', 'A connection server dying mid-write would otherwise lose a message you already acknowledged.'],
      ['What breaks on deploy?', 'Every socket drops. Drain gradually and require jittered client reconnection.'],
    ]),

    links(wiki('WebSocket', 'WebSocket'), wiki('Publish%E2%80%93subscribe_pattern', 'Publish–subscribe')),
  ],
};
