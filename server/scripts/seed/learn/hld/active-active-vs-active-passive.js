import { asked, diagram, flow, h, links, p, quick, table, tip, tradeoff, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'You have a second region. **Is it serving traffic, or waiting?** That single question decides your cost, your recovery time, and whether you have to solve write conflicts.',
    ),

    h('The two'),
    diagram(
      `
   ACTIVE-PASSIVE                    ACTIVE-ACTIVE

        traffic                          traffic
           │                            ╱       ╲
           ▼                           ▼         ▼
      ┌─────────┐   ┌─────────┐   ┌─────────┐ ┌─────────┐
      │ PRIMARY │──▶│ STANDBY │   │ REGION A│◀│ REGION B│
      │ serving │   │  idle   │   │ serving │─│ serving │
      └─────────┘   └─────────┘   └─────────┘ └─────────┘
                     replicating    both take writes
                                    bidirectional replication
   ✓ no write conflicts
   ✓ simple to reason about         ✓ zero-downtime failover
   ✓ the standby is a known-good    ✓ all capacity is used
     copy                           ✓ lowest latency for everyone
   ✗ paying for idle capacity       ✗ WRITE CONFLICTS
   ✗ failover takes minutes         ✗ every service must be
   ✗ the untested path is the         region-aware
     one you need                   ✗ hardest thing in this track
`,
      'Two answers to one question',
    ),
    tradeoff([
      ['**Active-passive**', 'No conflicts, simple, one source of truth', 'Idle capacity, minutes of downtime on failover, and a failover path you rarely exercise'],
      ['**Active-active**', 'Seconds of failover, full capacity utilisation, best latency everywhere', 'Conflict resolution, region-aware services, and substantially more to build and operate'],
    ]),

    h('Flavours of passive'),
    table(
      ['Type', 'Standby is', 'RTO', 'Cost'],
      [
        ['**Cold**', 'Backups only', 'Hours to days', '~5%'],
        ['**Warm**', 'Running, scaled down, data replicating', '**Minutes**', '~30%'],
        ['**Hot**', 'Fully scaled, ready, just not routed to', '**Seconds to a minute**', '~100%'],
        ['**Active-active**', 'Serving', '**Seconds**', '~100%, and all of it used'],
      ],
    ),
    tip(
      'Hot standby is the awkward one: you pay full price for capacity that serves nothing. **Once you are paying for it anyway, active-active gives you better latency and real confidence it works** — which is why teams that reach hot standby usually take the next step.',
    ),

    h('The failover nobody tested'),
    warn(
      'The most common failure in active-passive is that **failover has never actually been performed.** Replication lagged, a DNS TTL was long, a credential was missing in the standby region, the runbook was stale. You discover all of it during the incident.',
    ),
    table(
      ['Practice', 'Why'],
      [
        ['**Regular failover drills**', 'The only way to know it works'],
        ['Fail over and stay there', 'Proves the standby can sustain real traffic, not just accept it'],
        ['Automate it', 'A manual runbook at 3am is a source of mistakes'],
        ['Keep the DNS TTL low', 'It bounds recovery, and cannot be shortened during the incident'],
        ['Test the data path too', 'Replication lag at failover is data loss'],
      ],
    ),

    h('Active-active: where the conflicts come from'),
    diagram(
      `
   both regions accept writes. replication takes 100ms.

   t=0   region A: user sets name = "Asha"
   t=0   region B: user sets name = "A. Patel"
   t=100 A receives B's write. B receives A's.

   which one wins? both regions must reach the SAME answer,
   or they diverge permanently.

   RESOLUTION STRATEGIES

   last-write-wins    simplest, SILENTLY DISCARDS a write,
                      and depends on clocks agreeing
   per-field merge    fewer losses; needs per-field timestamps
   CRDTs              mathematically convergent; limited to
                      specific data types
   ask the user       correct, and a terrible experience
   AVOID IT           ◀── partition writes by region so the
                          same record is only written in one
`,
      'And the strategy that is actually used',
    ),
    tip(
      'The last line is the real answer. **Partition write ownership** — a user\'s home region owns their record, and other regions forward writes there. You keep active-active for reads and availability, and never have two writers for the same row.',
    ),

    h('Choosing'),
    table(
      ['Situation', 'Choose'],
      [
        ['Compliance requires a DR plan', '**Active-passive**, warm'],
        ['Cost-sensitive, hours of RTO acceptable', '**Cold or warm passive**'],
        ['Global users, latency matters', '**Active-active**'],
        ['Downtime is unacceptable', '**Active-active**'],
        ['Writes are naturally regional', '**Active-active** — partition ownership and it is easy'],
        ['One strongly consistent global dataset', '**Active-passive**, or a single-writer region'],
      ],
    ),
    p(
      'The fifth row is the one worth noticing. **If writes partition naturally by user or by geography, active-active is far easier than its reputation** — it is only hard when the same record is written from two places.',
    ),

    h('The hybrid'),
    flow(['Active-active for reads', 'Single-writer per record', 'Global store for the few consistent things'], 'What most large systems do'),
    p(
      'Every region serves reads and accepts requests. Writes are routed to whichever region owns that record. A small global store — consensus-backed — holds the handful of things that must be consistent everywhere: identity, uniqueness, balances.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'Whether the second region serves traffic or waits'],
      ['Why it matters', 'It sets recovery time, cost, and whether conflicts exist'],
      ['Use when', 'Active-passive for DR compliance; active-active when downtime is unacceptable'],
      ['Trade-off', 'Active-active removes downtime and adds conflict resolution'],
      [
        '30-second answer',
        '"Active-passive keeps a standby replicating but not serving — simple and conflict-free, but you pay for idle capacity and failover takes minutes on a path you rarely test. Active-active serves from both, so failover is seconds and latency is better, but two writers means conflicts. The practical answer is a hybrid: active-active for reads, write ownership partitioned so each record has one writing region, plus a small consensus store for identity and balances."',
      ],
    ]),
    asked([
      ['Active-active or active-passive?', 'Passive for DR compliance and cost. Active-active when downtime is unacceptable or users are global.'],
      ['How fast is active-passive failover?', 'Minutes for warm, seconds to a minute for hot — and only if the path has actually been tested.'],
      ['How do you handle write conflicts?', 'Avoid them. Partition write ownership so each record is only written in one region.'],
      ['Why do failovers fail?', 'They are never rehearsed. Replication lag, stale runbooks, long DNS TTLs, missing credentials.'],
      ['What is the hybrid?', 'Reads everywhere, writes routed to the owning region, and a small consensus store for truly global data.'],
    ]),

    links(
      wiki('High-availability_cluster', 'High-availability cluster'),
      wiki('Conflict-free_replicated_data_type', 'CRDT'),
    ),
  ],
};
