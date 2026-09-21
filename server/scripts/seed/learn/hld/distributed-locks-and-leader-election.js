import { asked, code, diagram, h, js, links, p, quick, table, tip, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'A lock in one process is a language feature. **A lock across machines is a distributed systems problem**, because the holder can pause, die or be partitioned away without ever releasing it — and you cannot tell which of those happened.',
    ),

    h('Why it is hard'),
    diagram(
      `
   client A acquires the lock (TTL 30s)
        │
        ├─ starts work
        │
        ├─ ████ GC PAUSE / VM migration / network hiccup ████ 45s
        │
   t=30 │  ◀── LOCK EXPIRES. client B acquires it.
        │      client B starts the same work.
        │
   t=45 ├─ A wakes up, believing it still holds the lock
        └─ A writes.  B writes.  BOTH think they are exclusive.

   the TTL is a guess about how long work takes.
   a guess is not mutual exclusion.
`,
      'The failure every distributed lock has',
    ),
    warn(
      'No TTL-based lock provides **guaranteed** mutual exclusion. A process cannot know it lost its lock — it was paused, not informed. This is not a flaw in any particular implementation; it is inherent to locking over a network.',
    ),

    h('Fencing tokens'),
    p(
      'The only real fix. The lock service hands out a **monotonically increasing number** with each grant, and the protected resource rejects any write carrying a token lower than the highest it has seen.',
    ),
    diagram(
      `
   lock service                      storage
   ────────────                      ───────
   A acquires ──▶ token 33
                                     (highest seen: none)
   A pauses...

   B acquires ──▶ token 34
   B writes with token 34 ─────────▶ accept. highest = 34

   A wakes, writes with token 33 ──▶ REJECT. 33 < 34.

   ✓ mutual exclusion is now enforced by the RESOURCE,
     which is the only component that can actually see both
   ✗ requires the resource to support fencing — many do not
`,
      'The resource enforces it, not the lock',
    ),
    tip(
      'The key insight worth stating: **the lock service cannot enforce exclusion; only the resource being protected can.** A lock without fencing is an optimisation that usually works, not a correctness guarantee.',
    ),

    h('Implementations'),
    table(
      ['Approach', 'Safety', 'When'],
      [
        ['**Redis `SET NX EX`**', 'Best-effort', 'Good enough for "usually once" — cron dedup, cache fills'],
        ['**Redlock** (multiple Redis)', 'Disputed', 'Widely criticised; no fencing tokens'],
        ['**ZooKeeper / etcd**', '**Strong** — consensus-backed, with a version to fence on', 'Correctness actually matters'],
        ['**Database row lock**', 'Strong, within that database', 'The work is already in that database'],
        ['**No lock at all**', 'N/A', '**Often the best answer** — see below'],
      ],
    ),
    code(
      js(`
// Redis lock, done as correctly as Redis allows.
const token = crypto.randomUUID();

// NX so only one caller wins; EX so a crash cannot hold it forever.
const ok = await redis.set(key, token, 'NX', 'EX', 30);
if (!ok) return null;

try {
  await doWork();
} finally {
  // Release via Lua, comparing the token. A plain DEL can delete
  // SOMEONE ELSE'S lock: if ours expired mid-work and another
  // client acquired it, DEL would free theirs.
  await redis.eval(
    \`if redis.call('GET', KEYS[1]) == ARGV[1]
        then return redis.call('DEL', KEYS[1]) else return 0 end\`,
    1, key, token,
  );
}
`),
    ),

    h('Designing the lock away'),
    table(
      ['Instead of a lock', 'Use'],
      [
        ['Serialising updates to a row', '`UPDATE ... WHERE version = ?` — optimistic locking'],
        ['Serialising work per entity', 'Partition by that key; one consumer owns it'],
        ['"Only one worker should do this"', 'A queue — the message is the exclusivity'],
        ['Preventing duplicate side effects', '**Idempotency**, not exclusion'],
        ['A singleton background job', 'Leader election, or a scheduler with its own locking'],
      ],
    ),
    tip(
      'The strongest answer to "how would you implement a distributed lock?" often starts with **"I would try not to need one."** Partitioning by key gives exclusivity by construction, and idempotency makes duplicate execution harmless — both are more robust than any lock.',
    ),

    h('Leader election'),
    p(
      'One instance does something that must happen exactly once — a scheduler, a rebalancer, a compaction job. The others stand by, ready to take over.',
    ),
    diagram(
      `
   all instances try to acquire the leader lease
        │
        ▼
   one wins ──▶ LEADER      others ──▶ FOLLOWERS
        │                                 │
        │ renews the lease                │ watch
        │ every few seconds               │
        ▼                                 ▼
   leader dies ──▶ lease expires ──▶ election ──▶ new leader

   THE GAP: between the old leader dying and the new one
   starting, nothing happens. that is correct — better a
   pause than two leaders.

   AND: the old leader may not know it lost. fence its writes.
`,
      'A lease that must be renewed',
    ),
    table(
      ['Mechanism', 'Note'],
      [
        ['**etcd / ZooKeeper**', 'Purpose-built; Raft or ZAB underneath, with a fencing version'],
        ['**Kubernetes lease**', 'A `Lease` object; the standard way for operators'],
        ['**Database row**', '`UPDATE leader SET holder=?, expires=? WHERE expires < now()` — simple and adequate'],
        ['**Redis lease**', 'Same caveats as any Redis lock'],
      ],
    ),
    warn(
      'Leader election has the same split-brain risk as failover: a partitioned leader keeps working while a new one is elected. **Require a majority to elect, and fence the leader\'s writes** — a leader that cannot reach the quorum must stop acting as leader.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'Mutual exclusion and single-instance ownership across machines'],
      ['Why it is hard', 'A holder can pause or be partitioned without releasing, and cannot tell'],
      ['Use when', 'Genuinely nothing else works — prefer partitioning or idempotency'],
      ['Trade-off', 'Redis is fast and best-effort; consensus stores are correct and slower'],
      [
        '30-second answer',
        '"A TTL-based lock cannot guarantee exclusion — the holder can GC-pause past its expiry and keep writing. Fencing tokens are the real fix: each grant carries an increasing number and the resource rejects anything lower, so exclusion is enforced where both writes are visible. Redis SET NX EX is fine for best-effort; etcd or ZooKeeper when correctness matters. But the strongest answer is usually to design the lock away — partition by key, or make the work idempotent."',
      ],
    ]),
    asked([
      ['Is Redlock safe?', 'Disputed, and it has no fencing tokens. For correctness use a consensus store; for best-effort, plain Redis is simpler.'],
      ['What is a fencing token?', 'An increasing number issued with the lock; the resource rejects writes carrying an older one.'],
      ['Why can a lock holder lose exclusivity?', 'A GC pause or partition can outlast the TTL, and the process is never told.'],
      ['How does leader election work?', 'Instances race for a lease and the winner renews it. Expiry triggers a new election; fence the old leader.'],
      ['How do you avoid needing a lock?', 'Partition work by key so one consumer owns it, or make the operation idempotent.'],
    ]),

    links(
      wiki('Distributed_lock_manager', 'Distributed lock manager'),
      wiki('Leader_election', 'Leader election'),
    ),
  ],
};
