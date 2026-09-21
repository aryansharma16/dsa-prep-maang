import { asked, diagram, flow, h, links, p, quick, table, tip, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      '"Eventually consistent" and "strongly consistent" are the two words most people know, and the interesting models are all in between. Each one is **a promise about what a read may return**, and each one still permits a specific, nameable bug.',
    ),

    h('The ladder'),
    diagram(
      `
   STRONGER                                          CHEAPER
   ────────────────────────────────────────────────────────▶

   linearizable      every read sees the latest write,
                     globally, as if there were one copy
        │            cost: a quorum round trip per operation
        ▼
   sequential        everyone sees operations in the SAME order,
                     not necessarily real time
        │
        ▼
   causal            if A caused B, everyone sees A before B.
                     unrelated events may be seen in any order
        │
        ▼
   read-your-writes  YOU see your own writes.
                     others may not yet
        │
        ▼
   monotonic reads   you never see time go backwards
        │
        ▼
   eventual          if writes stop, all replicas converge.
                     until then, anything goes
`,
      'Each rung permits more, and costs less',
    ),

    h('What each one still allows'),
    table(
      ['Model', 'Promises', 'The bug it still permits'],
      [
        ['**Linearizable**', 'Reads see the latest write, globally', 'None. It costs latency and availability'],
        ['**Sequential**', 'One agreed order for everyone', 'You may read stale data — just consistently stale'],
        ['**Causal**', 'Cause is seen before effect', 'Concurrent unrelated writes appear in different orders'],
        ['**Read-your-writes**', 'You see your own writes', 'You see your comment; your friend does not yet'],
        ['**Monotonic reads**', 'Time never goes backwards for you', 'You may be permanently behind'],
        ['**Eventual**', 'Convergence, eventually', '**Everything above**, until it converges'],
      ],
    ),

    h('The anomalies, drawn'),
    diagram(
      `
   READ-YOUR-WRITES violated

   user  ──write "hello"──▶ primary
   user  ──read─────────────▶ replica (lagging)  ──▶ nothing there
         "my comment vanished"


   MONOTONIC READS violated

   read 1 ──▶ replica A (fresh)  ──▶ 10 likes
   read 2 ──▶ replica B (stale)  ──▶  7 likes
         "the count went DOWN"


   CAUSAL violated

   alice: "is anyone there?"      ─┐ B caused by A
   bob:   "yes, I am"             ─┘

   carol sees:  "yes, I am"
                "is anyone there?"      ──▶ nonsense
`,
      'Three bugs users actually report',
    ),
    warn(
      'These are not theoretical. **"I posted and it disappeared"** is read-your-writes; **"the number went down"** is monotonic reads; **"the replies are out of order"** is causal. They are among the most confusing bugs to receive as a report, because the data is not corrupt — it is just late.',
    ),

    h('How to get each one'),
    table(
      ['Want', 'Cheapest way to get it'],
      [
        ['**Linearizable**', 'Read and write through a leader, or a quorum with R+W>N'],
        ['**Read-your-writes**', 'Route that user\'s reads to the primary for a few seconds after a write'],
        ['**Read-your-writes, cheaper**', 'Sticky-route the user to one replica; or return the write result optimistically'],
        ['**Monotonic reads**', 'Pin a user to one replica for their session'],
        ['**Causal**', 'Version vectors, or carry a "last seen version" token on each request'],
        ['**Eventual**', 'Do nothing. It is what you get by default'],
      ],
    ),
    tip(
      'The first two rows of that table cover most real needs. **"Read from the primary for five seconds after a write"** is a handful of lines of code and removes the single most-reported consistency complaint — without giving up replica reads for everyone else.',
    ),

    h('Choosing per operation, not per system'),
    flow(['Write balance', 'Read balance → primary', 'Read feed → replica'], 'Different paths, different models'),
    table(
      ['Operation', 'Model needed', 'Why'],
      [
        ['Transfer money', 'Linearizable', 'A stale balance allows an overdraft'],
        ['Check your own order status', 'Read-your-writes', 'You just placed it; not seeing it is alarming'],
        ['Browse a product catalogue', 'Eventual', 'A price a second old is fine'],
        ['View a like count', 'Monotonic at most', 'Approximate is acceptable; going backwards is not'],
        ['Read a chat thread', 'Causal', 'Replies must follow what they reply to'],
        ['Claim a unique username', 'Linearizable', 'Two winners is a corrupted account space'],
      ],
    ),
    p(
      'Consistency is a **per-operation** decision. A design that declares itself "eventually consistent" and then transfers money has not made a decision — it has made one decision and applied it where it does not belong.',
    ),

    h('A note on time'),
    p(
      'Clocks on different machines disagree by milliseconds and occasionally jump backwards, so **wall-clock timestamps cannot order events** across nodes. Last-write-wins on a timestamp silently drops writes when clocks skew — which is why serious systems use logical clocks or version vectors, or, like Spanner, buy bounded clock uncertainty with atomic hardware.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'A ladder of promises about what a read may return'],
      ['Why it matters', 'Each rung permits a specific, user-visible bug'],
      ['Use when', 'Choosing a read path — and choose per operation, not per system'],
      ['Trade-off', 'Stronger models cost a round trip and availability'],
      [
        '30-second answer',
        '"It is a ladder, not a binary. Linearizable means every read sees the latest write and costs a quorum round trip. Below that: causal keeps cause before effect, read-your-writes means you see your own changes, monotonic reads means time never goes backwards, and eventual promises only convergence. Each rung permits a named bug — a vanishing comment, a like count going down. So pick per operation: linearizable for balances and usernames, eventual for feeds."',
      ],
    ]),
    asked([
      ['What is read-your-writes?', 'You always see your own writes, even if others do not yet. Usually implemented by reading from the primary briefly after a write.'],
      ['Eventual vs causal?', 'Eventual only promises convergence. Causal also guarantees cause is seen before effect.'],
      ['Why did the like count go down?', 'Monotonic reads violated — two reads hit replicas at different staleness.'],
      ['What does linearizable cost?', 'A round trip to a leader or quorum on every operation, and unavailability during a partition.'],
      ['Why can you not order events by timestamp?', 'Clocks on different machines disagree and can move backwards. Use logical clocks or version vectors.'],
    ]),

    links(
      wiki('Consistency_model', 'Consistency model'),
      wiki('Linearizability', 'Linearizability'),
    ),
  ],
};
