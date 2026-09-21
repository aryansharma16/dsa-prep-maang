import { asked, diagram, h, links, p, quick, table, tip, warn, wiki } from '../blocks.js';
import { seeAlso } from './shapes.js';

export const doc = {
  blocks: [
    p(
      'A transaction is a group of operations that **either all happen or none do**. Isolation levels decide how much other transactions are allowed to see while yours is in progress — and each level permits a specific, named anomaly that you will eventually meet in production.',
    ),

    h('ACID, in one line each'),
    table(
      ['Property', 'Means', 'Without it'],
      [
        ['**Atomicity**', 'All or nothing', 'A transfer debits and never credits'],
        ['**Consistency**', 'Constraints hold before and after', 'Negative stock, orphaned rows'],
        ['**Isolation**', 'Concurrent transactions do not corrupt each other', 'You read half of someone else\'s work'],
        ['**Durability**', 'Committed means survives a crash', 'An acknowledged order disappears'],
      ],
    ),
    tip(
      'The "C" is the odd one out and interviewers occasionally poke at it: **consistency here means your constraints, not distributed consistency**. It is unrelated to the C in CAP, which is a different word doing a different job.',
    ),

    h('The four anomalies'),
    diagram(
      `
   DIRTY READ                        NON-REPEATABLE READ
   read uncommitted data             same row, two different answers

   T1: UPDATE x = 2                  T1: SELECT x  ──▶ 1
   T2: SELECT x  ──▶ 2               T2: UPDATE x = 2; COMMIT
   T1: ROLLBACK                      T1: SELECT x  ──▶ 2  ✗
       T2 acted on a value
       that never existed


   PHANTOM READ                      LOST UPDATE
   same query, different ROWS        two writers, one survives

   T1: SELECT count(*) WHERE ..  ▶ 5 T1: read x = 10
   T2: INSERT matching row; COMMIT   T2: read x = 10
   T1: SELECT count(*) WHERE ..  ▶ 6 T1: write x = 11
       ✗                             T2: write x = 11   ✗ should be 12
`,
      'Four ways concurrency lies to you',
    ),

    h('The isolation levels'),
    table(
      ['Level', 'Dirty read', 'Non-repeatable', 'Phantom', 'Cost'],
      [
        ['**Read uncommitted**', 'Possible', 'Possible', 'Possible', 'None'],
        ['**Read committed**', 'No', 'Possible', 'Possible', 'Low — **Postgres default**'],
        ['**Repeatable read**', 'No', 'No', 'Possible*', 'Medium — **MySQL default**'],
        ['**Serializable**', 'No', 'No', 'No', 'High — as if run one at a time'],
      ],
    ),
    p(
      '*MySQL\'s InnoDB prevents phantoms at repeatable read using gap locks, which the standard does not require. **The same level name behaves differently across engines**, and that difference is a genuine source of production bugs when a query is ported.',
    ),
    warn(
      '**No isolation level prevents a lost update** in a read-then-write done in application code. Read committed and repeatable read both allow it. You need `SELECT ... FOR UPDATE`, an atomic `UPDATE ... SET x = x + 1`, or optimistic version checking.',
    ),

    h('Fixing lost updates'),
    table(
      ['Approach', 'How', 'Good when'],
      [
        ['**Atomic update**', '`UPDATE t SET n = n + 1 WHERE id = ?`', 'Always, when the operation is expressible that way'],
        ['**Pessimistic lock**', '`SELECT ... FOR UPDATE`', 'Contention is high; the work between is short'],
        ['**Optimistic lock**', '`UPDATE ... WHERE version = ?`, retry on 0 rows', '**Contention is low** — the common case'],
        ['**Serializable**', 'Let the database detect and abort', 'Correct, expensive, and you must handle retries'],
      ],
    ),
    tip(
      'Optimistic locking is the default worth reaching for: **no lock is held, and a conflict costs a retry rather than a queue.** It only degrades when contention is genuinely high, at which point a pessimistic lock — or removing the contention — is the answer.',
    ),

    h('MVCC'),
    diagram(
      `
   readers do not block writers, writers do not block readers

   row x, with versions

   ┌──────────┬────────────┬────────────┐
   │ v1  x=1  │ v2  x=2    │ v3  x=3    │
   │ txn 100  │ txn 105    │ txn 110    │
   └──────────┴────────────┴────────────┘
        ▲            ▲
        │            │
   a txn that       a txn that started
   started at 102   at 107 sees v2
   sees v1

   each transaction sees a SNAPSHOT consistent with when it began

   ✓ no read locks at all
   ✗ old versions accumulate ──▶ vacuum / purge
   ✗ a long-running transaction pins old versions and bloats
`,
      'How Postgres and InnoDB avoid read locks',
    ),
    warn(
      'A long-running transaction is expensive in an MVCC engine for a reason people find surprising: it **prevents cleanup of every version created since it started**. An analytics query left open for an hour can bloat tables and degrade the whole database.',
    ),

    h('What transactions cost at scale'),
    table(
      ['Cost', 'Why'],
      [
        ['Locks held for the whole transaction', 'Long transactions serialise other work'],
        ['Connections held', 'A transaction pins a connection; pools exhaust'],
        ['Deadlocks', 'Two transactions taking locks in different orders'],
        ['No cross-shard transactions', 'They stop at one database'],
        ['Replication lag', 'A large transaction replicates as one lump'],
      ],
    ),
    tip(
      '**Keep transactions short and never do I/O inside one.** Calling a payment gateway with a transaction open holds locks for seconds — and if the call hangs, the locks outlive the request. Do the external work first, then open a short transaction to record the result.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'All-or-nothing groups of operations, and how much concurrency they tolerate'],
      ['Why it matters', 'Each isolation level permits a specific anomaly'],
      ['Use when', 'Money, inventory, bookings — anything where a partial result is wrong'],
      ['Trade-off', 'Stronger isolation costs concurrency and throughput'],
      [
        '30-second answer',
        '"ACID is all-or-nothing, constraints preserved, concurrent transactions not corrupting each other, and committed surviving a crash. Read committed is the usual default and still allows non-repeatable and phantom reads; serializable prevents everything and costs throughput. Crucially, no isolation level prevents a lost update from a read-then-write in application code — that needs an atomic update or optimistic version checking. And keep transactions short."',
      ],
    ]),
    asked([
      ['Which isolation level should I use?', 'Read committed by default. Go higher only for a specific anomaly you have identified.'],
      ['What does read committed still allow?', 'Non-repeatable reads, phantoms and lost updates.'],
      ['How do you prevent a lost update?', 'Atomic UPDATE, SELECT FOR UPDATE, or optimistic locking on a version column.'],
      ['What is MVCC?', 'Multiple row versions so readers see a snapshot and never block writers. Old versions need cleanup.'],
      ['Why keep transactions short?', 'They hold locks and connections. A network call inside one can hold locks for seconds.'],
    ]),

    seeAlso('SQL', 'Isolation levels', 'the read phenomena, locking, deadlocks and MVCC at query level'),
    links(
      wiki('ACID', 'ACID'),
      wiki('Isolation_(database_systems)', 'Isolation levels'),
    ),
  ],
};
