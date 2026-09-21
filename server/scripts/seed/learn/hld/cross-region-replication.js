import { asked, code, diagram, flow, h, js, links, p, quick, table, tip, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Replication within a region is milliseconds and you can afford to wait for it. **Across an ocean it is 150ms, so you cannot** — which makes cross-region replication asynchronous by necessity, and asynchronous replication is where conflicts and data loss live.',
    ),

    h('Why it must be async'),
    diagram(
      `
   SYNCHRONOUS across regions        ASYNCHRONOUS

   write ──▶ Mumbai                  write ──▶ Mumbai ──▶ ack
                │                                 │
                │ 150 ms                          │ 150 ms, later
                ▼                                 ▼
             Virginia                          Virginia
                │
                │ 150 ms back
                ▼
             ack to client

   every write costs 300 ms          writes are local-speed
   and FAILS if the other            and survive the other
   region is unreachable             region being down

   ✗ availability of BOTH            ✗ a failover can lose the
     regions, ANDed                    last N seconds of writes
                                     ✗ both sides can write the
                                       same record
`,
      'The trade you cannot avoid',
    ),
    warn(
      'Synchronous cross-region replication makes availability **worse**: you now need both regions up for any write to succeed. The second region was supposed to improve availability and has instead been ANDed into the critical path.',
    ),

    h('What async costs you'),
    table(
      ['Cost', 'Detail'],
      [
        ['**RPO > 0**', 'A regional failure loses whatever had not replicated — seconds, usually'],
        ['**Stale reads**', 'The other region is always slightly behind'],
        ['**Conflicts**', 'If both regions write, the same record diverges'],
        ['**Ordering**', 'Related writes can arrive out of order without care'],
      ],
    ),

    h('Conflict resolution'),
    table(
      ['Strategy', 'How', 'Loses data?'],
      [
        ['**Last-write-wins**', 'Highest timestamp wins', '**Yes, silently** — and it trusts clocks'],
        ['**Per-field LWW**', 'Timestamp per field, merge fields', 'Less; a field can still be lost'],
        ['**Version vectors**', 'Detect concurrency, surface the conflict', 'No — but now you must resolve it'],
        ['**CRDTs**', 'Types that converge by construction', '**No** — limited to counters, sets, sequences'],
        ['**Application merge**', 'Domain logic decides', 'No, if written correctly'],
        ['**Avoid conflicts**', 'One writer per record', '**No** — and this is the real answer'],
      ],
    ),
    warn(
      'Last-write-wins **silently discards a write** and depends on clocks that disagree by milliseconds and occasionally jump backwards. It is the default in several systems and it is a data-loss mechanism wearing a sensible name.',
    ),
    tip(
      'CRDTs are genuinely useful in a narrow band: **a counter that only increments, a set that only grows, a sequence for collaborative text.** Within those types, concurrent updates merge correctly with no coordination at all — which is why they power collaborative editors.',
    ),

    h('Avoiding conflicts by design'),
    diagram(
      `
   HOME REGION per record

   user 42's home region = Mumbai

   write from Mumbai   ──▶ handled locally.        fast.
   write from Virginia ──▶ FORWARDED to Mumbai.    slower, correct.
   read  from anywhere ──▶ local replica.          fast, maybe stale.

   ✓ exactly one writer per record  ──▶ NO conflicts, ever
   ✓ reads stay local and fast
   ✗ cross-region writes are slower for the minority of users
     who are away from home
   ✗ moving a user between regions is a real migration

   this is what large systems actually do, and it is far
   simpler than any resolution strategy.
`,
      'One writer, and the problem disappears',
    ),
    code(
      js(`
// The routing decision, made once, at the edge.
async function handleWrite(req) {
  const home = await lookupHomeRegion(req.user.id);   // cached

  if (home !== CURRENT_REGION) {
    // Forwarding costs a cross-region round trip, but it is the
    // only thing that guarantees a single writer per record — and
    // it is a small minority of writes.
    return forwardTo(home, req);
  }
  return writeLocally(req);
}
`),
    ),

    h('Choosing what to replicate'),
    table(
      ['Data', 'Strategy', 'Why'],
      [
        ['User content', 'Home region, replicated read-only elsewhere', 'Naturally single-writer'],
        ['Catalogue, config', 'One writer, replicated everywhere', 'Read-mostly, rarely conflicts'],
        ['Sessions', 'Regional, not replicated', 'Cheap to recreate'],
        ['Caches', '**Not replicated** — rebuilt locally', 'Derived data'],
        ['Search indexes', 'Built per region from the event stream', 'Derived data'],
        ['Balances, identity, uniqueness', '**Consensus, or a single region**', 'Cannot tolerate divergence'],
      ],
    ),
    p(
      'The last row is the small expensive set. **Everything else is either regional or derived**, and derived data should be rebuilt in each region rather than replicated — it is usually cheaper and it removes a replication stream you would otherwise have to operate.',
    ),

    h('Monitoring it'),
    flow(['Replication lag', 'Conflict rate', 'Divergence checks', 'Transfer cost'], 'All four'),
    table(
      ['Metric', 'Why'],
      [
        ['**Replication lag per region**', 'It is your RPO, measured live'],
        ['**Conflict rate**', 'A rise means write ownership is being violated somewhere'],
        ['**Periodic divergence check**', 'Compare checksums; silent divergence is otherwise undetectable'],
        ['**Inter-region transfer volume**', 'Charged per GB — often a surprising share of the bill'],
      ],
    ),
    tip(
      'A periodic **checksum comparison between regions** is the only way to catch silent divergence. Conflict resolution bugs do not raise errors — both sides believe they are correct — so without an explicit check the drift is found by a customer.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'Keeping data in step across regions 150ms apart'],
      ['Why it is hard', 'Distance forces async, and async permits conflicts and loss'],
      ['Use when', 'Any multi-region design with more than read replicas'],
      ['Trade-off', 'Async gives local write speed and costs a non-zero RPO'],
      [
        '30-second answer',
        '"Cross-region replication has to be asynchronous, because synchronous means 300ms per write and needing both regions up. Async means a non-zero RPO and the possibility of two writers diverging. Last-write-wins silently drops data and trusts clocks, so the real answer is to avoid conflicts: give each record a home region that owns its writes and forward writes from elsewhere. Replicate regional and global data; rebuild derived data like caches and indexes locally."',
      ],
    ]),
    asked([
      ['Why is cross-region replication asynchronous?', 'Synchronous costs a 300ms round trip per write and requires both regions to be up.'],
      ['How do you resolve write conflicts?', 'Prefer not to have them — one home region per record. Otherwise per-field merge or CRDTs; last-write-wins loses data.'],
      ['What is wrong with last-write-wins?', 'It silently discards a write and depends on clocks that disagree and can move backwards.'],
      ['Does all data need replicating?', 'No. Derived data — caches, indexes — is rebuilt locally. Only regional and truly global data replicates.'],
      ['How do you detect divergence?', 'Periodic checksum comparison. Conflict bugs raise no errors, so nothing else catches them.'],
    ]),

    links(
      wiki('Multi-master_replication', 'Multi-master replication'),
      wiki('Conflict-free_replicated_data_type', 'CRDT'),
    ),
  ],
};
