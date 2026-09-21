import { asked, diagram, flow, h, links, p, quick, table, tip, warn, wiki } from '../blocks.js';
import { interviewLevel } from './shapes.js';

export const doc = {
  blocks: [
    p(
      'Messaging for two billion people. Two things make it different from every other system on this list: **connections are long-lived and stateful**, and end-to-end encryption means the server cannot read, search or index anything it is carrying.',
    ),

    flow(['Phone A', 'Connection server', 'Message router', 'Queue', 'Connection server', 'Phone B'], 'One message'),
    diagram(
      `
   phone A                                        phone B
      │                                              │
      │ persistent WebSocket                         │ persistent
      ▼                                              ▼
   ┌────────────┐                            ┌────────────┐
   │ conn srv 1 │                            │ conn srv 7 │
   └─────┬──────┘                            └──────▲─────┘
         │                                          │
         │  which server is B on?                   │
         ▼                                          │
   ┌──────────────────────────────────────────┐     │
   │  session registry   user ──▶ server      │     │
   │  (Redis, TTL'd, heartbeated)             │     │
   └──────────────────┬───────────────────────┘     │
                      │                             │
                      ▼                             │
   ┌──────────────────────────────────────────┐     │
   │  message router / pub-sub                │─────┘
   └──────────────────────────────────────────┘
                      │
                      ▼  B is offline?
            ┌──────────────────┐
            │ per-user mailbox │  store until delivered,
            │  (the queue)     │  then delete
            └──────────────────┘
`,
      'The routing problem, which is the whole design',
    ),

    h('The pieces'),
    table(
      ['Piece', 'What it does', 'Why it is there'],
      [
        ['**Connection servers**', 'Hold millions of open sockets', 'Stateful by necessity — this is where the design gets hard'],
        ['**Session registry**', 'Maps user → which connection server', 'You cannot route to a socket you cannot find'],
        ['**Message router**', 'Delivers to the right server, or to a mailbox', 'The fan-out point for groups'],
        ['**Per-user mailbox**', 'Undelivered messages, in order', 'A phone is offline most of the time'],
        ['**Media path**', 'Encrypted blob to object storage, key in the message', 'Same reason as everywhere else: big files bypass the app'],
        ['**Push gateway**', 'APNs / FCM wake-up when the socket is gone', 'A backgrounded app has no socket'],
      ],
    ),
    tip(
      'The mailbox is **not a message history**. Messages are deleted once delivered and acknowledged — history lives on the devices. That is what makes storage tractable at this scale, and it falls straight out of end-to-end encryption.',
    ),

    h('The hard part — routing to a socket on another machine'),
    p(
      'A stateless service can be load balanced anywhere. A connection server cannot: B\'s socket is on one specific machine, and A is connected to a different one. The registry plus a pub/sub bus is how the message crosses.',
    ),
    table(
      ['Step', 'What happens'],
      [
        ['1', 'A sends over its socket; the connection server persists it to B\'s mailbox first'],
        ['2', 'Look up B in the session registry'],
        ['3', 'Online → publish on that server\'s channel → it writes to B\'s socket'],
        ['4', 'Offline → leave it in the mailbox and send a push notification'],
        ['5', 'B acknowledges → delete from the mailbox → tell A "delivered"'],
      ],
    ),
    warn(
      '**Persist before you route.** If the message is sent to B\'s connection server and that server dies mid-write, a message that was acknowledged to A has vanished. Write to the mailbox first, deliver second, delete third.',
    ),

    h('The two ticks'),
    diagram(
      `
   A ──── message ────▶ server
                          │
   A ◀─── ✓ sent ─────────┘        one tick: the server has it

                          │
                          └──────▶ B's device
                                     │
   A ◀─── ✓✓ delivered ──────────────┘   two ticks: the DEVICE has it

                                     B opens the chat
   A ◀─── ✓✓ blue ───────────────────┘   read receipt

   three separate acknowledgements, three separate messages
   travelling back. each one is its own small delivery problem.
`,
      'Each tick is an ack of a different thing',
    ),

    h('Groups'),
    table(
      ['Group size', 'Approach', 'Why'],
      [
        ['Small (≤ ~256)', 'Fan out server-side to each member\'s mailbox', 'Cheap enough, and keeps per-member ordering'],
        ['Large broadcast', 'Treat it as a channel; members pull', 'Fan-out cost becomes the bottleneck'],
        ['With E2E encryption', 'The **sender** encrypts per recipient device', 'The server cannot encrypt for anyone — it holds no keys'],
      ],
    ),
    p(
      'That last row is the real constraint: in an end-to-end encrypted group, a message to 256 people with 2 devices each is **512 separately encrypted payloads the sender produces**. The server just routes opaque blobs.',
    ),

    h('What encryption rules out'),
    table(
      ['Cannot do', 'Consequence'],
      [
        ['Search messages server-side', 'Search is on-device only'],
        ['Deduplicate or compress content', 'Every recipient gets their own ciphertext'],
        ['Fan out efficiently in groups', 'The sender does the work, not the server'],
        ['Restore history to a new phone', 'Needs an explicit, separately encrypted backup'],
        ['Moderate content', 'Only reports and metadata are available'],
      ],
    ),

    h('Scale'),
    table(
      ['Dimension', 'Order of magnitude', 'What breaks first'],
      [
        ['Users', '~2B', '—'],
        ['Messages/day', '~100B → ~1M/s, several million at peak', 'The router and the mailbox writes'],
        ['Concurrent connections', 'Hundreds of millions', 'Connection servers — memory per socket is the limit'],
        ['Connections per server', '~1M with tuned kernels', 'File descriptors and memory, not CPU'],
        ['Mailbox storage', 'Small — it drains constantly', 'Only when many users are offline for long'],
      ],
    ),
    tip(
      'A connection costs memory, not CPU — an idle socket does nothing. So connection servers are sized by **RAM per socket**, which is why the tuning conversation is about file descriptors and buffer sizes rather than about request throughput.',
    ),

    h('Failures'),
    table(
      ['What dies', 'Effect', 'Mitigation'],
      [
        ['A connection server', 'Its users disconnect', 'Clients reconnect to another; registry TTL expires; mailbox has the messages'],
        ['Session registry', 'Cannot route to online users', 'Fall back to mailbox + push for everyone — slower, still correct'],
        ['Push gateway', 'Offline users are not woken', 'They get messages when they next open the app'],
        ['A mailbox shard', 'Those users miss messages until it recovers', 'Replicate it. This is the one store that must not lose writes'],
        ['Media storage', 'Attachments fail; text is unaffected', 'Separate path, separate failure domain'],
      ],
    ),

    h('Interview'),
    quick([
      ['What it is', 'Real-time messaging over persistent connections'],
      ['The hard part', 'Routing to a socket on a different machine, and delivering to offline devices'],
      ['Key decision', 'Persist to a mailbox before routing; delete after acknowledgement'],
      ['Trade-off', 'E2E encryption gives privacy and costs server-side search, dedup and efficient group fan-out'],
      [
        '30-second answer',
        '"Clients hold a persistent WebSocket to a connection server. A session registry maps user to server, so a message is written to the recipient\'s mailbox first, then routed via pub/sub to whichever server holds their socket — or left for a push notification if they are offline. On acknowledgement it is deleted, which is why storage stays small. The ticks are three separate acks. End-to-end encryption means the server routes opaque blobs and the sender encrypts once per recipient device."',
      ],
    ]),
    asked([
      ['How do you deliver to a user on another server?', 'A session registry maps user to connection server, and a pub/sub bus carries the message there.'],
      ['What if the recipient is offline?', 'It stays in their mailbox and a push notification wakes the app. Deleted once acknowledged.'],
      ['How do the two ticks work?', 'One is the server accepting it, two is the device receiving it, blue is the app displaying it.'],
      ['Why is E2E encryption a design constraint?', 'No server-side search, no dedup, and group fan-out must be done by the sender per device.'],
      ['Why not keep all message history server-side?', 'Encryption makes it useless to you and the volume makes it expensive. History lives on devices.'],
    ]),

    interviewLevel('WhatsApp'),
    links(
      wiki('End-to-end_encryption', 'End-to-end encryption'),
      wiki('WebSocket', 'WebSocket'),
    ),
  ],
};
