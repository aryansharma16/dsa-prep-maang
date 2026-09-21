import { asked, diagram, flow, h, links, p, quick, table, tip, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Fault tolerance is **continuing to work correctly while something is broken**. High availability is the outcome you are aiming for; fault tolerance is the set of properties that produce it. The distinction matters because you can be highly available and not fault tolerant — you just have not been unlucky yet.',
    ),

    h('The failure modes worth designing for'),
    table(
      ['Mode', 'What it looks like', 'Why it is hard'],
      [
        ['**Crash**', 'The process is gone', 'The easy one — obvious and detectable'],
        ['**Slow**', 'Still answering, at 30 seconds', '**Worse than dead.** Health checks pass; callers pile up'],
        ['**Partial**', 'Reads work, writes do not', 'A shallow health check says everything is fine'],
        ['**Byzantine**', 'Answering, and wrong', 'Corrupted memory, a bad deploy on one node'],
        ['**Partition**', 'Alive, unreachable from here', 'Both sides think the other died'],
        ['**Correlated**', 'All nodes fail together', 'Same bug, same deploy, same rack, same AZ'],
      ],
    ),
    warn(
      '**A slow dependency is more dangerous than a dead one.** A dead one fails fast and you route around it; a slow one holds every caller\'s connection, exhausts thread pools, and takes down services that do not even depend on it directly. This is the single most common cascade in production.',
    ),

    h('Correlated failure is the one that gets you'),
    diagram(
      `
   WHAT YOU PLANNED FOR          WHAT ACTUALLY HAPPENS

   3 replicas                    3 replicas
   P(one fails) = 0.001            ...all on the same rack
   P(all three) = 10⁻⁹             ...same power supply
                                   ...same AZ
   "one in a billion"              ...same bad deploy
                                   ...same poisoned config

                                 P(all three) ≈ P(one event)
                                             ≈ 0.001

   independence is an ASSUMPTION, and usually a false one.
`,
      'Why the maths lies',
    ),
    table(
      ['Spread across', 'Protects against'],
      [
        ['Processes', 'A crash'],
        ['Machines', 'Hardware failure'],
        ['Racks', 'A switch or power distribution unit'],
        ['**Availability zones**', 'A data centre — flood, fire, power'],
        ['**Regions**', 'A regional outage or disaster'],
        ['**Deploy waves**', '**A bad release** — the most common cause of all'],
      ],
    ),
    tip(
      'That last row is the one people forget. Multi-AZ replication does nothing against a bug you deployed to every AZ simultaneously — which is why **canary deploys buy more real availability than another replica does**.',
    ),

    h('Redundancy patterns'),
    table(
      ['Pattern', 'Cost while healthy', 'Recovery time'],
      [
        ['**Active-active**', 'You pay for everything, and use it', 'Seconds — capacity is already serving'],
        ['**Active-passive (hot)**', 'Standby is running and idle', 'Seconds to a minute'],
        ['**Active-passive (warm)**', 'Standby is provisioned, scaled down', 'Minutes'],
        ['**Cold standby**', 'Backups only', 'Hours'],
        ['**N+1**', 'One spare unit of capacity', 'Immediate, if the failure is capacity'],
      ],
    ),

    h('Failover, and how it goes wrong'),
    flow(['Detect', 'Decide', 'Promote', 'Fence', 'Redirect'], 'Five steps, five ways to fail'),
    diagram(
      `
   SPLIT-BRAIN

   before                          after a partition
   ┌────────┐                      ┌────────┐  ╳╳  ┌────────┐
   │ leader │──▶ followers         │ leader │      │follower│
   └────────┘                      └────────┘      └────────┘
                                       │                │
                                   still taking     "leader is
                                     writes          gone — I'm
                                       │             leader now"
                                       ▼                ▼
                                   two leaders. both accepting
                                   writes. both correct, locally.
                                   data diverges permanently.

   PREVENTION
     ▸ majority quorum — a minority cannot elect
     ▸ fencing token   — an increasing number; the storage
                         rejects writes from an older one
     ▸ STONITH         — the new leader forcibly stops the old
`,
      'The failure that corrupts rather than interrupts',
    ),
    warn(
      '**A quorum alone does not prevent split-brain damage.** The old leader may not know it lost and can still be mid-write. Fencing tokens are what actually stop it: the storage layer refuses any write carrying a token lower than the highest it has seen.',
    ),

    h('Detection is a trade-off'),
    table(
      ['Setting', 'Too aggressive', 'Too conservative'],
      [
        ['Heartbeat interval', 'Network noise triggers failover', 'Slow to notice a real failure'],
        ['Failure threshold', 'Flapping — repeated failovers', 'Long outage before acting'],
        ['Timeout', 'A slow node is declared dead', 'A dead node holds callers for a minute'],
      ],
    ),
    p(
      'You cannot distinguish "dead" from "slow" over a network — **this is a fundamental limit, not a tuning problem.** Every timeout is a guess, and a system that fails over aggressively will sometimes fail over for no reason.',
    ),

    h('Blast radius'),
    table(
      ['Technique', 'What it contains'],
      [
        ['**Bulkheads**', 'Separate pools per dependency, so one cannot starve the rest'],
        ['**Cell architecture**', 'Independent stacks serving slices of users; one cell fails, others do not notice'],
        ['**Shuffle sharding**', 'Each customer gets a random subset of nodes, so no two share all of them'],
        ['**Circuit breakers**', 'Stop calling a failing dependency; fail fast instead of piling up'],
        ['**Graceful degradation**', 'Turn off a feature rather than the product'],
      ],
    ),
    tip(
      'Shuffle sharding is an elegant idea worth knowing: with 8 nodes and 2 per customer there are 28 combinations, so **one bad customer taking down their two nodes affects a tiny fraction of the others** rather than everybody on a shared pool.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'Continuing to work correctly while a component is broken'],
      ['Why it matters', 'Every design round ends with "what if that dies?"'],
      ['Use when', 'Always — name the failure mode and the degradation for each component'],
      ['Trade-off', 'Aggressive detection causes false failovers; conservative detection causes long outages'],
      [
        '30-second answer',
        '"Design for the modes, not just crashes — slow is worse than dead, because health checks pass while callers pile up. Redundancy only helps if failures are independent, and they usually are not: same rack, same AZ, same deploy. So spread across AZs and across deploy waves. Failover needs detection, a majority quorum to avoid split-brain, and fencing tokens so a demoted leader cannot still write. Then contain the blast radius with bulkheads and cells."',
      ],
    ]),
    asked([
      ['What is worse, a dead service or a slow one?', 'Slow. It passes health checks while exhausting every caller\'s connection pool.'],
      ['What is split-brain and how do you stop it?', 'Two leaders both accepting writes. Majority quorums to elect, fencing tokens to stop the old one writing.'],
      ['Why does redundancy sometimes not help?', 'Correlated failure — same rack, same AZ, same deploy. Independence is an assumption, not a fact.'],
      ['Fault tolerance vs high availability?', 'Fault tolerance is the property; high availability is the measured outcome.'],
      ['How do you limit blast radius?', 'Bulkheads, cells, shuffle sharding, circuit breakers, and degrading features rather than the product.'],
    ]),

    links(
      wiki('Fault_tolerance', 'Fault tolerance'),
      wiki('Split-brain_(computing)', 'Split-brain'),
    ),
  ],
};
