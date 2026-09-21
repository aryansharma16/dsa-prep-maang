import { asked, diagram, flow, h, links, p, quick, table, tip, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'A quorum is **a minimum number of nodes that must agree** before an operation counts. The whole idea rests on one observation: if the set of nodes you wrote to and the set you read from must overlap, then a read is guaranteed to see the write.',
    ),

    h('R + W > N'),
    diagram(
      `
   N = 3 replicas          W = 2 writes must ack
                           R = 2 reads must ack

   WRITE x=5                         READ x
   ┌────┐ ┌────┐ ┌────┐              ┌────┐ ┌────┐ ┌────┐
   │ N1 │ │ N2 │ │ N3 │              │ N1 │ │ N2 │ │ N3 │
   │ x=5│ │ x=5│ │ x=1│              │ x=5│ │ x=5│ │ x=1│
   └────┘ └────┘ └────┘              └────┘ └────┘ └────┘
     ███    ███    old                 ███           ███
     └──W = 2──┘                       └─────R = 2───┘

   R + W = 4 > N = 3
        ──▶ the two sets MUST share at least one node
        ──▶ that node has x=5
        ──▶ take the highest version. correct read.

   if R + W ≤ N, the sets can be disjoint and you can
   read x=1 after successfully writing x=5.
`,
      'Why the inequality is the whole rule',
    ),
    table(
      ['Configuration', 'N', 'W', 'R', 'Behaviour'],
      [
        ['**Strong, balanced**', '3', '2', '2', 'Consistent; tolerates one node down'],
        ['**Fast reads**', '3', '3', '1', 'Reads are one hop; a single node down stops writes'],
        ['**Fast writes**', '3', '1', '3', 'Writes are one hop; a single node down stops reads'],
        ['**Fast everything**', '3', '1', '1', '**Not consistent** — R+W=2 ≤ 3. Eventual'],
        ['**Typical production**', '5', '3', '3', 'Tolerates two node failures, still consistent'],
      ],
    ),
    tip(
      '`N=3, W=2, R=2` is the default worth knowing. It is the smallest configuration that is both **consistent and tolerant of one failure**, and it makes reads and writes cost the same.',
    ),

    h('Tuning per query'),
    p(
      'The reason quorums matter in an interview is that they are a **dial, not a setting**. The same table can be read strongly for one query and cheaply for another, in the same application.',
    ),
    table(
      ['Level', 'Waits for', 'Use for'],
      [
        ['`ONE`', 'One replica', 'Metrics, logs, anything approximate'],
        ['`QUORUM`', 'A majority in the local DC', 'The normal consistent read'],
        ['`LOCAL_QUORUM`', 'A majority in **this** data centre', 'Multi-region: consistency without a cross-ocean hop'],
        ['`EACH_QUORUM`', 'A majority in every data centre', 'Rare. Global consistency, global latency'],
        ['`ALL`', 'Every replica', 'Almost never — one slow node blocks everything'],
      ],
    ),
    warn(
      '`LOCAL_QUORUM` is the one to know for multi-region designs. It gives strong consistency **within a region** at region-local latency — and accepts that another region may briefly disagree. That is usually exactly the right trade.',
    ),

    h('What a quorum does not give you'),
    table(
      ['Assumption', 'Reality'],
      [
        ['"R+W>N means linearizable"', '**No.** It gives a strong read of a single key, not a total order across operations'],
        ['"Concurrent writes are ordered"', 'Two clients writing at once still conflict; you need versions to resolve'],
        ['"A failed write means nothing happened"', 'A write that reached one node but not W still lingers there'],
        ['"Every read repairs"', 'Only if read repair is enabled; otherwise stale replicas stay stale'],
      ],
    ),
    p(
      'That third row is the subtle one. **A quorum write that fails is not rolled back** — the nodes that did accept it keep it, and a later read may return it. Quorums give you a probability of freshness, not a transaction.',
    ),

    h('Keeping replicas in step'),
    flow(['Read repair', 'Hinted handoff', 'Anti-entropy'], 'Three mechanisms'),
    table(
      ['Mechanism', 'When', 'What it does'],
      [
        ['**Read repair**', 'On a read', 'Notices a stale replica and writes the newer value back'],
        ['**Hinted handoff**', 'A node is down during a write', 'Another node holds the write and delivers it on recovery'],
        ['**Anti-entropy**', 'Background', 'Merkle-tree comparison finds and fixes divergence'],
      ],
    ),

    h('Why odd numbers'),
    p(
      'A majority of 4 is 3, exactly as it is for 5. **So N=4 tolerates one failure and N=5 tolerates two** — the fourth node adds cost and no fault tolerance. Every quorum system is configured with an odd number for this reason.',
    ),
    diagram(
      `
   N    majority   failures tolerated
   ──   ────────   ──────────────────
   3       2              1
   4       3              1     ◀── the wasted one
   5       3              2
   6       4              2     ◀── wasted again
   7       4              3
`,
      'Even numbers buy nothing',
    ),

    h('Interview'),
    quick([
      ['What it is', 'A minimum number of nodes that must agree for an operation to count'],
      ['Why it exists', 'Overlapping read and write sets guarantee a read sees the latest write'],
      ['Use when', 'Leaderless stores, and any consistency decision you want tunable per query'],
      ['Trade-off', 'Higher R and W buy consistency and cost latency and availability'],
      [
        '30-second answer',
        '"R plus W greater than N guarantees the read set and write set overlap, so at least one node in the read has the latest write and you take the highest version. N=3, W=2, R=2 is the standard — consistent and survives one node down. The value is that it is tunable per query: ONE for metrics, QUORUM for correctness, LOCAL_QUORUM in multi-region so you get consistency without a cross-ocean round trip. Always an odd N, because an even one adds cost without tolerating another failure."',
      ],
    ]),
    asked([
      ['Why does R+W>N work?', 'The read and write sets must share a node, and that node holds the latest version.'],
      ['What is a good default?', 'N=3, W=2, R=2 — consistent and tolerant of one node failure.'],
      ['Does a quorum give linearizability?', 'Not on its own. It gives a fresh read of one key, not a total order across operations.'],
      ['What is LOCAL_QUORUM for?', 'Strong consistency within a region without paying cross-region latency.'],
      ['Why is N always odd?', 'A majority of 4 is the same as a majority of 3, so the fourth node adds no fault tolerance.'],
    ]),

    links(
      wiki('Quorum_(distributed_computing)', 'Quorum'),
      wiki('Dynamo_(storage_system)', 'Dynamo'),
    ),
  ],
};
