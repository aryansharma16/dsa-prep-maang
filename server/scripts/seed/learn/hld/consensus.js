import { asked, diagram, flow, h, links, p, quick, table, tip, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Consensus is **getting a group of machines to agree on one value when some of them may fail**. It is the foundation under leader election, configuration, distributed locks and every database that promises linearizability — and in an interview you need Raft in two minutes, not the paper.',
    ),

    h('Raft in one page'),
    diagram(
      `
   THREE ROLES

   FOLLOWER ──── no heartbeat for a random timeout ────▶ CANDIDATE
      ▲                                                     │
      │                                            asks for votes
      │ sees a higher term                                  │
      │ or a valid leader                    majority says yes
      │                                                     ▼
      └──────────────────────────────────────────────── LEADER
                                                 sends heartbeats,
                                                 replicates the log

   A WRITE

   client ──▶ leader
                │ 1. append to own log (uncommitted)
                │ 2. replicate to followers
                │ 3. MAJORITY acknowledged?
                ▼
            4. COMMIT, apply, reply to client
            5. followers learn it is committed on the next heartbeat

   the majority is the whole trick: any two majorities of the same
   cluster must overlap, so a committed entry cannot be lost and
   two leaders of the same term cannot both exist.
`,
      'Leader election, log replication, safety',
    ),
    table(
      ['Concept', 'What it does'],
      [
        ['**Term**', 'A logical clock. A higher term always wins; it is how stale leaders are detected'],
        ['**Log**', 'An ordered sequence of commands, identical on every node'],
        ['**Commit index**', 'How far the log is durably agreed'],
        ['**Majority**', 'Any two majorities overlap — the source of all the safety'],
        ['**Randomised election timeout**', 'Stops every follower becoming a candidate simultaneously'],
      ],
    ),
    tip(
      'If you remember one sentence: **a write is committed once a majority has it, and any two majorities overlap, so a committed entry survives any election.** That is the safety argument, and it is enough for an interview.',
    ),

    h('Why an odd number'),
    table(
      ['Nodes', 'Majority', 'Failures tolerated'],
      [
        ['3', '2', '1'],
        ['4', '3', '1 — **the extra node buys nothing**'],
        ['5', '3', '2'],
        ['6', '4', '2 — again nothing'],
        ['7', '4', '3'],
      ],
    ),
    p(
      'Three or five is almost always the answer. **Seven is slower** — every write waits for four acknowledgements — and the extra fault tolerance is rarely worth the latency.',
    ),

    h('Raft versus Paxos'),
    table(
      ['', 'Paxos', 'Raft'],
      [
        ['Published', '1989', '2013'],
        ['Designed for', 'Correctness', '**Understandability**'],
        ['Leader', 'Optional, implicit', 'Explicit and central'],
        ['Reputation', 'Famously hard to implement correctly', 'Most new systems choose it'],
        ['Used by', 'Chubby, Spanner', 'etcd, Consul, CockroachDB, TiKV'],
      ],
    ),
    p(
      'They solve the same problem with the same guarantees. **Raft won because it is teachable**, which turned out to matter more than elegance for something every team must implement or operate correctly.',
    ),

    h('What it costs'),
    warn(
      'Every write is **a round trip to a majority** before it commits. That is fine for configuration and leader election and prohibitive for high-volume data — which is exactly why consensus systems store small, critical state and not your application tables.',
    ),
    table(
      ['Property', 'Reality'],
      [
        ['Write latency', 'At least one round trip to a majority'],
        ['Write throughput', 'Bounded by the leader — it does not shard'],
        ['Availability', '**CP** — a minority partition refuses to serve'],
        ['Reads', 'Linearizable reads also need a quorum, unless leases are used'],
        ['Cluster size', 'Larger is slower, not faster'],
      ],
    ),

    h('What you actually use it for'),
    flow(['Leader election', 'Config', 'Locks', 'Membership', 'Coordination'], 'Small, critical state'),
    table(
      ['Use', 'Example'],
      [
        ['**Leader election**', 'Which replica is the primary'],
        ['**Configuration**', 'Feature flags, shard maps, routing tables'],
        ['**Service registry**', 'Which instances exist and are healthy'],
        ['**Distributed locks**', 'With fencing, because etcd gives you a version'],
        ['**Cluster membership**', 'Who is in the cluster right now'],
      ],
    ),
    tip(
      'The useful framing: **etcd and ZooKeeper are not databases, they are agreement services.** They hold kilobytes of state that everything else depends on, and treating one as a general store is a well-known way to take a cluster down.',
    ),

    h('In practice'),
    table(
      ['System', 'Role'],
      [
        ['**etcd**', 'Kubernetes\' entire state; Raft'],
        ['**ZooKeeper**', 'Kafka (historically), HBase; ZAB — Paxos-like'],
        ['**Consul**', 'Service discovery and config; Raft'],
        ['**CockroachDB / TiDB**', 'Raft per data range — consensus underneath a SQL database'],
        ['**Spanner**', 'Paxos per split, plus atomic clocks for external consistency'],
      ],
    ),
    p(
      'The last two rows are worth noticing: **modern distributed SQL runs consensus per shard rather than per cluster**, so throughput scales with the number of ranges even though each individual range is still leader-bound.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'Agreement on one value among machines that may fail'],
      ['Why it exists', 'Leader election, configuration and locks all need one answer'],
      ['Use when', 'Small critical state — never your application data'],
      ['Trade-off', 'Strong guarantees, at a majority round trip per write'],
      [
        '30-second answer',
        '"Raft has three roles: followers become candidates after a randomised timeout, win a majority of votes, and become leader. All writes go through the leader, which appends to its log, replicates, and commits once a majority acknowledges. Any two majorities overlap, so a committed entry survives any election. Always an odd cluster size — four tolerates the same failures as three. It costs a round trip per write, so it holds config, leadership and locks, not application data."',
      ],
    ]),
    asked([
      ['Explain Raft in two minutes.', 'Leader election by randomised timeout and majority vote; the leader replicates a log; entries commit at a majority.'],
      ['Why does consensus need a majority?', 'Any two majorities overlap, so a committed entry is always visible to the next leader.'],
      ['Why an odd number of nodes?', 'A majority of four is the same as of three, so the even node adds cost and no fault tolerance.'],
      ['Raft or Paxos?', 'Same guarantees. Raft won on understandability, which matters for something everyone must implement correctly.'],
      ['What should you store in etcd?', 'Kilobytes of critical state — leadership, config, membership. Not application data.'],
    ]),

    links(
      wiki('Raft_(algorithm)', 'Raft'),
      wiki('Paxos_(computer_science)', 'Paxos'),
    ),
  ],
};
