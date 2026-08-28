import {
  asked,
  cheat,
  code,
  h,
  links,
  mysqlDoc,
  note,
  p,
  result,
  sql,
  table,
  tip,
  ul,
  warn,
  wiki,
} from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Isolation has to be implemented, and one of the two ways is **locking**: a transaction takes a lock before touching a row, and anyone else wanting an incompatible lock waits. It works, it is simple, and it produces the one failure mode every backend engineer eventually has to debug — the **deadlock**.',
    ),

    h('Shared and exclusive'),
    table(
      ['lock', 'taken by', 'compatible with'],
      [
        ['**Shared (S)** — read lock', '`SELECT … LOCK IN SHARE MODE`, and every read at `SERIALIZABLE`', 'Other **S** locks. Many readers at once.'],
        ['**Exclusive (X)** — write lock', '`UPDATE`, `DELETE`, `INSERT`, `SELECT … FOR UPDATE`', '**Nothing.** One writer, no readers.'],
      ],
    ),
    result(
      ['holder \\ requester', 'S', 'X'],
      [
        ['**S**', '**compatible**', 'wait'],
        ['**X**', 'wait', 'wait'],
      ],
      'The compatibility matrix',
    ),
    note(
      'Only one cell is compatible, and that is the whole of "readers do not block readers, writers block everything". Under **MVCC** — which both InnoDB and PostgreSQL use by default — plain `SELECT`s take no locks at all and read an older version instead, so in practice the matrix only applies to explicit locking reads and to writes.',
    ),

    h('Taking a lock deliberately'),
    code(
      sql(`
START TRANSACTION;

  -- X lock: nobody else may read-for-update or write this row until we commit.
  SELECT balance FROM accounts WHERE id = 1 FOR UPDATE;

  UPDATE accounts SET balance = balance - 10000 WHERE id = 1;

COMMIT;   -- lock released here, and only here
`),
    ),
    ul(
      '`FOR UPDATE` — an exclusive lock. Use it when you are going to write what you read.',
      '`FOR SHARE` (`LOCK IN SHARE MODE` in MySQL) — a shared lock. Others may read, none may write.',
      '`FOR UPDATE NOWAIT` — fail immediately instead of waiting.',
      '`FOR UPDATE SKIP LOCKED` — ignore locked rows and take the rest. **The queue-worker idiom** — several workers claim different jobs from one table without ever blocking each other.',
    ),
    code(
      sql(`
-- Ten workers, one jobs table, no contention and no duplicated work.
START TRANSACTION;
  SELECT id FROM jobs WHERE status = 'pending'
  ORDER BY created_at LIMIT 1
  FOR UPDATE SKIP LOCKED;

  UPDATE jobs SET status = 'running' WHERE id = ?;
COMMIT;
`),
    ),
    tip(
      '`SKIP LOCKED` is worth knowing by name. It turns a table into a work queue without a message broker: each worker takes the first row nobody else has claimed, and because the lock is held only for the length of the claim, ten workers get ten different jobs with no waiting at all.',
    ),

    h('Granularity'),
    table(
      ['level', 'locks', 'concurrency', 'overhead'],
      [
        ['**Row**', 'One row', 'Best', 'Most — a lock per row'],
        ['**Gap**', 'The space *between* index records', 'Reduced', 'InnoDB-specific'],
        ['**Next-key**', 'A row plus the gap before it', 'Reduced', 'InnoDB’s default at `REPEATABLE READ`'],
        ['**Page**', 'A disk page of rows', 'Worse', 'Less'],
        ['**Table**', 'The whole table', 'Worst', 'Least'],
      ],
    ),
    warn(
      'A **gap lock** locks a range where no row exists yet, which is how InnoDB prevents phantoms — and it is also why an `UPDATE` on an **unindexed** column can block far more than you expect. With no index to identify the rows, InnoDB scans and locks essentially everything it examines, so a statement that changes two rows can block writes to the whole table. **An index on the `WHERE` column is a concurrency feature, not only a speed one.**',
    ),

    h('Two-phase locking'),
    p(
      'The protocol that makes locking produce serializable results. Every transaction has two phases and never goes back:',
    ),
    ul(
      '**Growing phase** — acquire locks. No lock may be released.',
      '**Shrinking phase** — release locks. No lock may be acquired.',
    ),
    p(
      'In practice databases use **strict 2PL**: all locks are held until `COMMIT` or `ROLLBACK`, so the shrinking phase is instantaneous at the end. That is what prevents a second transaction reading a value that a first one is about to roll back — and it is the reason **a long transaction is a concurrency problem**, because every lock it took at the start is still held at the end.',
    ),
    note(
      '2PL guarantees serializability and guarantees nothing about deadlocks. The two properties are independent: holding locks to the end is exactly what makes a cycle possible.',
    ),

    h('Deadlock'),
    p('Two transactions each holding a lock the other needs. Neither can proceed, and neither will give up:'),
    result(
      ['t', 'Transaction A', 'Transaction B', 'state'],
      [
        ['1', '`START TRANSACTION`', '`START TRANSACTION`', ''],
        ['2', '`UPDATE accounts WHERE id = 1`', '', 'A holds **X on row 1**'],
        ['3', '', '`UPDATE accounts WHERE id = 2`', 'B holds **X on row 2**'],
        ['4', '`UPDATE accounts WHERE id = 2`', '', 'A **waits** for B'],
        ['5', '', '`UPDATE accounts WHERE id = 1`', 'B **waits** for A'],
        ['6', '', '', '**Deadlock**'],
      ],
      'A cycle in the wait-for graph',
    ),
    p(
      'The database detects it — InnoDB maintains a wait-for graph and looks for a cycle — and breaks it by **killing one transaction**, normally whichever has done less work:',
    ),
    code(
      sql(`
-- ERROR 1213 (40001): Deadlock found when trying to get lock; try restarting transaction
`),
    ),
    warn(
      'Note the SQLSTATE: **40001**, the same class as a Postgres serialization failure. That is the database telling you the transaction was not wrong, it was unlucky, and the correct response is to **retry the whole transaction** — not to log an error, and not to retry the single failing statement, because every lock the transaction held has been released. An application doing bulk writes without a deadlock retry loop is one that works in staging and pages someone in production.',
    ),

    h('Avoiding them'),
    p('**Consistent lock ordering** is the fix that actually works. If every transaction takes locks in the same order, a cycle cannot form:'),
    code(
      sql(`
-- Deadlocks: two concurrent transfers in opposite directions.
--   A: 1 → 2      B: 2 → 1

-- Does not: lock the lower id first, always, whatever the direction.
START TRANSACTION;
  SELECT * FROM accounts WHERE id IN (1, 2) ORDER BY id FOR UPDATE;
  UPDATE accounts SET balance = balance - 10000 WHERE id = 1;
  UPDATE accounts SET balance = balance + 10000 WHERE id = 2;
COMMIT;
`),
    ),
    table(
      ['technique', 'why it helps'],
      [
        ['**Consistent ordering**', 'Removes the cycle by construction. The only structural fix.'],
        ['**Short transactions**', 'Fewer locks held for less time is less overlap.'],
        ['**Index the `WHERE` columns**', 'Locks the rows you meant instead of everything scanned.'],
        ['**Touch fewer rows**', 'A batched `UPDATE … LIMIT 1000` in a loop rather than one enormous statement.'],
        ['**Lower isolation where safe**', '`READ COMMITTED` takes fewer gap locks than `REPEATABLE READ`.'],
        ['**No user interaction inside a transaction**', 'Never hold a lock across a network call or a prompt.'],
        ['**Retry on 40001**', 'Not prevention — but the only correct handling.'],
      ],
    ),

    h('Diagnosing one'),
    code(
      sql(`
-- MySQL: the most recent deadlock, in full — both transactions and the locks held.
SHOW ENGINE INNODB STATUS;

-- Who is waiting for whom, right now.
SELECT * FROM performance_schema.data_lock_waits;
SELECT * FROM sys.innodb_lock_waits;

-- Long-running transactions, which are usually the cause.
SELECT * FROM information_schema.innodb_trx ORDER BY trx_started;

-- How long before a waiting statement gives up. Default 50 seconds.
SELECT @@innodb_lock_wait_timeout;
`),
    ),
    tip(
      'The `LATEST DETECTED DEADLOCK` section of `SHOW ENGINE INNODB STATUS` gives you both transactions, the exact statements, and the locks each held and wanted. It is the fastest route from "we get deadlocks sometimes" to knowing which two code paths take locks in opposite orders — which is nearly always the answer.',
    ),

    h('Deadlock or lock wait timeout'),
    table(
      ['', 'Deadlock', 'Lock wait timeout'],
      [
        ['Error', '`1213` / SQLSTATE `40001`', '`1205`'],
        ['Cause', 'A **cycle** — mutual waiting', 'One transaction holding a lock too long'],
        ['Detected', 'Immediately', 'After `innodb_lock_wait_timeout`'],
        ['Resolution', 'The engine kills one transaction', 'The waiter gives up'],
        ['Fix', 'Consistent lock ordering', 'Shorter transactions'],
      ],
    ),
    p(
      'They are different problems with different fixes and get conflated constantly. A timeout means somebody is slow; a deadlock means two paths disagree about ordering.',
    ),

    h('Optimistic locking — no locks at all'),
    p('The alternative for low-contention workloads: do not lock, detect the conflict instead.'),
    code(
      sql(`
ALTER TABLE accounts ADD COLUMN version INT NOT NULL DEFAULT 0;

-- Read, including the version.
SELECT balance, version FROM accounts WHERE id = 1;    -- 50000, version 7

-- Write only if nothing has changed since.
UPDATE accounts
SET balance = 40000, version = version + 1
WHERE id = 1 AND version = 7;

-- 0 rows affected = someone else got there first. Re-read and retry.
`),
    ),
    table(
      ['', 'Pessimistic (`FOR UPDATE`)', 'Optimistic (`version`)'],
      [
        ['Assumes', 'A conflict is likely', 'A conflict is rare'],
        ['Cost when uncontended', 'A lock, and waiting', '**None**'],
        ['Cost when contended', 'Blocking', 'A wasted attempt and a retry'],
        ['Deadlocks', 'Possible', '**Impossible** — no locks are held'],
        ['Works across requests', 'No — a lock dies with the transaction', '**Yes** — a user can hold version 7 in a form for an hour'],
      ],
    ),
    tip(
      'The last row is why every ORM implements optimistic locking and none implements pessimistic locking across requests. You cannot hold a database lock while a user fills in a form — the transaction would have to stay open for minutes. A version column survives the round trip, and "this record was changed by someone else" is a message you can actually show them.',
    ),

    h('Interview'),
    asked([
      ['Shared vs exclusive lock?', 'Shared allows other shared locks (many readers); exclusive allows nothing else.'],
      ['What is two-phase locking?', 'Acquire locks in a growing phase, release in a shrinking phase. Strict 2PL holds them all until commit.'],
      ['Does 2PL prevent deadlocks?', 'No. It guarantees serializability; holding locks to the end is exactly what makes cycles possible.'],
      ['What is a deadlock?', 'A cycle of transactions each waiting for a lock another holds.'],
      ['How does the database resolve one?', 'It detects the cycle and kills one transaction — usually the one that has done less work.'],
      ['What should the application do?', 'Retry the whole transaction on SQLSTATE 40001. All its locks were released.'],
      ['How do you prevent deadlocks?', 'Consistent lock ordering, short transactions, indexed WHERE columns, and no network calls inside a transaction.'],
      ['Deadlock vs lock wait timeout?', 'A deadlock is mutual waiting, detected at once; a timeout is one slow holder, detected after a delay.'],
      ['What is a gap lock?', 'A lock on the space between index records, used by InnoDB to prevent phantoms.'],
      ['Why does an unindexed UPDATE block so much?', 'Without an index InnoDB locks everything it scans, not just the rows it changes.'],
      ['What does SKIP LOCKED do?', 'Ignores rows locked by others — the standard way to build a work queue in a table.'],
      ['Optimistic vs pessimistic locking?', 'Pessimistic locks up front and blocks; optimistic uses a version column and retries on conflict. Only optimistic works across requests.'],
    ]),

    h('Cheatsheet'),
    cheat([
      ['Lock a row you will write', '`SELECT … FOR UPDATE`'],
      ['Lock a row nobody may change', '`SELECT … FOR SHARE`'],
      ['Fail rather than wait', '`FOR UPDATE NOWAIT`'],
      ['Build a job queue', '`FOR UPDATE SKIP LOCKED`'],
      ['Prevent deadlocks', 'Take locks in a consistent order — sort by id'],
      ['Handle a deadlock', 'Retry the whole transaction on `40001`'],
      ['Diagnose one', '`SHOW ENGINE INNODB STATUS`'],
      ['Reduce lock scope', 'Index the `WHERE` column'],
      ['Concurrency across requests', 'A `version` column, not a lock'],
    ]),

    links(
      mysqlDoc('innodb-locking.html', 'InnoDB locking'),
      mysqlDoc('innodb-deadlocks.html', 'Deadlocks in InnoDB'),
      wiki('Two-phase_locking', 'Two-phase locking'),
    ),
  ],
};
