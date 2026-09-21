import { asked, diagram, flow, h, links, p, quick, table, tip, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'CAP says that when the network splits, a distributed system must choose between **answering correctly and answering at all**. It is the most quoted and most misquoted result in system design, and the misquote — "pick two of three" — is what makes it useless in an interview.',
    ),

    h('What it actually says'),
    diagram(
      `
   THREE PROPERTIES

   C  consistency   every read sees the most recent write
   A  availability  every request gets a non-error response
   P  partition     the system keeps working when the network
      tolerance     between nodes breaks

   THE MISREADING              WHAT IT MEANS

   "pick 2 of 3"               P is NOT optional. networks fail.
                               so the real statement is:

   ┌───┐                       WHEN a partition happens,
   │ C │                       you choose C or A.
   ├───┤  choose
   │ A │  any two              WHEN there is no partition,
   ├───┤                       you get BOTH — and CAP has
   │ P │                       nothing to say about you.
   └───┘
   ✗ CA is not a choice
`,
      'The conditional nobody quotes',
    ),
    warn(
      '**"CA" is not an option.** You cannot choose not to tolerate partitions — you can only choose what happens when one occurs. A single-node database is CA in the sense that it has no network to partition, which is not a design choice about distribution.',
    ),

    h('The choice, concretely'),
    table(
      ['During a partition', 'CP chooses', 'AP chooses'],
      [
        ['A read on the minority side', '**Refuse** — it might be stale', '**Answer** — possibly with stale data'],
        ['A write on the minority side', '**Refuse** — it cannot be replicated', '**Accept** — reconcile later'],
        ['What breaks', 'Availability', 'Consistency'],
        ['What you tell the user', '"Try again shortly"', 'A plausible but possibly old answer'],
        ['Examples', 'etcd, ZooKeeper, HBase, Spanner', 'Cassandra, DynamoDB, Riak, DNS'],
      ],
    ),
    diagram(
      `
   NETWORK PARTITION

   ┌────────────┐          ╳╳╳╳          ┌────────────┐
   │  node A    │◀── broken link ──▶     │  node B    │
   │  (majority)│                        │ (minority) │
   └────────────┘                        └────────────┘
         │                                      │
    write x=5                              read x → ?
         │                                      │
         ▼                                      ▼
   CP:  accepted                          CP:  ERROR. refuse to
        (has quorum)                            serve a stale read

   AP:  accepted                          AP:  returns x=1 (old)
                                                and reconciles later
`,
      'Same event, two answers',
    ),

    h('PACELC — the version that describes real systems'),
    p(
      'CAP only tells you about the rare case. **PACELC adds the common one**: if there is a **P**artition, choose **A** or **C**; **E**lse — when everything is healthy — choose **L**atency or **C**onsistency.',
    ),
    diagram(
      `
   if (PARTITION) {           else {
     choose A or C              choose L or C
   }                          }

   the ELSE branch runs 99.99% of the time,
   and it is the one that shapes your latency numbers.

   strong consistency costs a round trip to a quorum,
   every single read, partition or not.
`,
      'Two branches, and the second one always runs',
    ),
    table(
      ['System', 'PACELC', 'In words'],
      [
        ['**DynamoDB / Cassandra**', 'PA/EL', 'Stay up during a partition; favour latency normally'],
        ['**Cassandra, tuned strict**', 'PC/EC', 'The same database, dialled the other way'],
        ['**MongoDB**', 'PC/EC', 'Refuse without a primary; read from the primary by default'],
        ['**Spanner**', 'PC/EC', 'Consistency always, paid for with atomic clocks and latency'],
        ['**MySQL + async replicas**', 'PA/EL', 'Replicas serve stale data and stay up'],
      ],
    ),
    tip(
      'Two rows of that table are the **same database**. Cassandra with `ONE` reads is AP/EL; with `QUORUM` reads and writes it is CP/EC. The database does not choose — **you choose, per query**, and saying that is the strongest answer available on this topic.',
    ),

    h('Choosing, in practice'),
    flow(['Is it money or identity?', 'CP', 'Else', 'AP'], 'The rough rule'),
    table(
      ['Data', 'Choose', 'Why'],
      [
        ['Account balance, inventory', '**CP**', 'A wrong answer costs real money'],
        ['Username uniqueness', '**CP**', 'Two people cannot have the same one'],
        ['Configuration, leader election', '**CP**', 'Disagreement means split-brain'],
        ['Social feed, timeline', '**AP**', 'Stale by five seconds is invisible'],
        ['View counts, likes', '**AP**', 'Approximate is fine; unavailable is not'],
        ['Product catalogue', '**AP**', 'An old price for a moment beats no page'],
        ['Session, cart', '**AP**', 'Annoying to lose, not incorrect'],
      ],
    ),
    warn(
      'The answer is almost never system-wide. A real product is **CP for the parts that matter and AP everywhere else** — and an interviewer asking "CP or AP?" is usually testing whether you notice that it is a per-data-type question.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'During a network partition, a system must choose consistency or availability'],
      ['Why it matters', 'It forces you to say what happens when the network breaks'],
      ['Use when', 'Justifying a data store, or asked about consistency'],
      ['Trade-off', 'CP refuses to answer when unsure; AP answers and may be wrong'],
      [
        '30-second answer',
        '"CAP is conditional, not a menu — partitions are not optional, so the real statement is that during a partition you choose between answering correctly and answering at all. PACELC is more useful because it adds the normal case: even with no partition, strong consistency costs a round trip to a quorum. And it is a per-data-type decision — balances and usernames are CP, feeds and view counts are AP — often in the same product and the same database."',
      ],
    ]),
    asked([
      ['What does CAP actually say?', 'During a partition, choose consistency or availability. Partition tolerance is not optional.'],
      ['Why is "pick two" wrong?', 'It implies CA is a choice. You cannot opt out of networks failing.'],
      ['What does PACELC add?', 'The non-partition case: even when healthy, you trade latency against consistency.'],
      ['Is Cassandra AP or CP?', 'Either — it is tunable per query. QUORUM reads and writes make it CP.'],
      ['CP or AP for this system?', 'Both. CP for money and identity, AP for feeds, counts and catalogues.'],
    ]),

    links(wiki('CAP_theorem', 'CAP theorem'), wiki('PACELC_theorem', 'PACELC theorem')),
  ],
};
