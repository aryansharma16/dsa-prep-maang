import { asked, diagram, flow, h, links, p, quick, table, tip, tradeoff, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Replication is keeping the same data on more than one machine. It buys three different things — **availability, read capacity and locality** — and every topology is a different answer to one question: *who is allowed to accept a write?*',
    ),

    flow(['Write', 'Leader', 'Replication log', 'Followers', 'Reads'], 'The common case'),

    h('Three topologies'),
    diagram(
      `
   LEADER-FOLLOWER            MULTI-LEADER            LEADERLESS

        write                  write     write         write to
          │                      │         │           several nodes
          ▼                      ▼         ▼                │
      ┌───────┐             ┌───────┐ ┌───────┐        ┌──┬──┬──┐
      │leader │             │ ldr A │◀▶│ ldr B │        │N1│N2│N3│
      └───┬───┘             └───┬───┘ └───┬───┘        └──┴──┴──┘
      ┌───┴───┐                 ▼         ▼             read from
      ▼       ▼             followers  followers        several too
   ┌────┐ ┌────┐
   │ f1 │ │ f2 │            ✓ writes in 2 regions     ✓ no failover
   └────┘ └────┘            ✗ CONFLICTS               ✗ you own
                                                         conflicts
   ✓ no write conflicts     use: multi-region,
   ✗ leader = bottleneck         offline-first        use: Dynamo,
        and failover point                                 Cassandra
`,
      'Who may accept a write',
    ),
    table(
      ['', 'Leader-follower', 'Multi-leader', 'Leaderless'],
      [
        ['Write conflicts', '**Impossible**', 'Routine — you must resolve them', 'Routine — quorum or vectors'],
        ['Write scaling', 'No — one leader', 'Yes, per region', 'Yes'],
        ['Failover', 'Needed, and delicate', 'Less critical', 'None needed'],
        ['Complexity', 'Low', '**High**', 'Medium'],
        ['Use for', 'Almost everything', 'Multi-region writes, offline clients', 'AP stores at scale'],
      ],
    ),
    tip(
      'Leader-follower is the right answer far more often than its reputation suggests. **It removes write conflicts entirely** — which is the hardest class of bug in this whole area — and you only leave it when one leader genuinely cannot take the write volume, or when writes must happen in two places at once.',
    ),

    h('Synchronous versus asynchronous'),
    tradeoff([
      ['**Synchronous**', 'No data loss on failover — the follower has the write', 'Every write waits for the slowest follower; one slow follower stalls all writes'],
      ['**Asynchronous**', 'Fast writes, a slow follower cannot block you', 'Failover can lose acknowledged writes'],
      ['**Semi-synchronous**', 'One follower confirms; the rest catch up', 'The usual compromise, and the usual default'],
    ]),
    diagram(
      `
   SYNCHRONOUS                       ASYNCHRONOUS

   client ──write──▶ leader          client ──write──▶ leader
                       │                                 │
                       ├──▶ follower                     ├──▶ (later)
                       │      │                          │
                       │◀─ack─┘                          │
                       │                                 │
   client ◀───ack──────┘             client ◀───ack──────┘
                                                (immediately)
   ✓ follower has it                 ✗ leader dies now
   ✗ slow follower = slow write          ──▶ that write is GONE
`,
      'Where the acknowledgement comes from',
    ),
    warn(
      'Fully synchronous replication to **all** followers is rarely used, because it makes availability worse, not better: any one follower being slow or down stops every write. Semi-synchronous — wait for one — gets most of the durability for a fraction of the cost.',
    ),

    h('Replica lag, and what it breaks'),
    table(
      ['Anomaly', 'What the user sees', 'Fix'],
      [
        ['**Read-your-writes**', '"I saved it and it is gone"', 'Read from the leader briefly after a write'],
        ['**Monotonic reads**', '"The count went down"', 'Pin the user to one replica per session'],
        ['**Causal**', 'A reply before the message', 'Version tokens, or route related reads together'],
      ],
    ),
    p(
      'Lag is normally milliseconds and occasionally **minutes** — during a bulk import, a long transaction, a network hiccup or a replica restart. Designs that assume lag is always small break exactly when the system is already under stress.',
    ),
    tip(
      'Monitor **replication lag as a first-class metric** and alert on it. It is the number that explains a whole category of "impossible" bug reports, and it is invisible unless you are watching for it.',
    ),

    h('Failover'),
    flow(['Detect', 'Elect', 'Promote', 'Redirect', 'Rejoin'], 'And every step can go wrong'),
    table(
      ['Step', 'What goes wrong'],
      [
        ['**Detect**', 'Too eager → failover on a network blip. Too slow → long outage'],
        ['**Elect**', 'Two nodes both think they won → **split-brain**'],
        ['**Promote**', 'The chosen follower was behind → acknowledged writes are lost'],
        ['**Redirect**', 'Clients cache the old leader; DNS TTL bites'],
        ['**Rejoin**', 'The old leader returns with writes nobody else has'],
      ],
    ),
    warn(
      'Split-brain is the dangerous one: two leaders both accepting writes, diverging, both believing they are correct. Prevention is **a majority quorum** — a minority partition cannot elect a leader — plus fencing, so a demoted leader is stopped from writing before the new one starts.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'Multiple copies of the same data on different machines'],
      ['Why it exists', 'Availability, read capacity, and serving users closer to them'],
      ['Use when', 'Always — one copy of anything important is not a design'],
      ['Trade-off', 'Sync replication costs write latency; async risks losing acknowledged writes'],
      [
        '30-second answer',
        '"Three topologies, and the question is who may accept a write. Leader-follower has no write conflicts and is the default; the leader is a bottleneck and a failover risk. Multi-leader lets two regions both write and hands you conflict resolution. Leaderless uses quorums instead of failover. Replication is usually semi-synchronous — one follower acknowledges, so failover is safe without a slow follower blocking writes. Then watch replica lag; it causes a whole class of user-visible bugs."',
      ],
    ]),
    asked([
      ['Sync or async replication?', 'Semi-synchronous usually — one follower acknowledges, so failover is safe without a slow follower blocking writes.'],
      ['What breaks with replica lag?', 'Read-your-writes, monotonic reads and causal ordering. Users report vanishing data and counts going backwards.'],
      ['When is multi-leader worth it?', 'Writes must succeed in more than one region, or clients work offline. You are accepting conflict resolution.'],
      ['What is split-brain?', 'Two leaders both accepting writes after a partition. Prevented by majority quorums and fencing.'],
      ['Does replication scale writes?', 'No. Every replica applies every write. Only sharding scales writes.'],
    ]),

    links(
      wiki('Replication_(computing)', 'Replication'),
      wiki('Multi-master_replication', 'Multi-master replication'),
    ),
  ],
};
