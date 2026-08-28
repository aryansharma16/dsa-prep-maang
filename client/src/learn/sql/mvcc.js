import {
  asked,
  cheat,
  code,
  h,
  links,
  mysqlDoc,
  note,
  p,
  pgDoc,
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
      'Locking makes readers and writers wait for each other, and for a read-heavy database that is a disaster. **Multi-version concurrency control** removes the conflict entirely by keeping more than one version of each row: a writer creates a new version while readers carry on with the old one. Nobody waits.',
    ),
    p('The slogan is worth memorising because it is the whole design: **readers never block writers, and writers never block readers.**'),

    h('The idea'),
    p('Every row carries hidden bookkeeping about *when* it was written and *when* it stopped being current:'),
    table(
      ['engine', 'hidden columns', 'meaning'],
      [
        ['**PostgreSQL**', '`xmin`, `xmax`', 'The transaction that created this version, and the one that deleted it.'],
        ['**InnoDB**', '`DB_TRX_ID`, `DB_ROLL_PTR`', 'The last transaction to modify it, and a pointer to the previous version in the undo log.'],
      ],
    ),
    p(
      'A transaction reading a row walks back until it finds a version that was **committed before its snapshot began**. That is the whole mechanism: a read is a search through history for the newest version this transaction is allowed to see.',
    ),
    result(
      ['t', 'Transaction A (reader)', 'Transaction B (writer)', 'Row versions'],
      [
        ['1', '`START TRANSACTION`', '', '`balance = 50000` (v1)'],
        ['2', '`SELECT balance` → **50000**', '', 'v1'],
        ['3', '', '`UPDATE … = 60000`', 'v1, **v2 = 60000** (uncommitted)'],
        ['4', '`SELECT balance` → **50000**', '', 'A still reads v1. **No waiting.**'],
        ['5', '', '`COMMIT`', 'v2 committed'],
        ['6', '`SELECT balance` → **50000**', '', 'A’s snapshot predates v2'],
        ['7', '`COMMIT`', '', ''],
        ['8', '`SELECT balance` → **60000**', '', 'A new snapshot'],
      ],
      'At REPEATABLE READ',
    ),
    note(
      'At no point did either transaction wait. Under strict locking, B\'s update at `t=3` would have blocked until A committed at `t=7` — and if A were a long-running report, B would have blocked for its whole duration. This is why MVCC is the default in both PostgreSQL and InnoDB.',
    ),

    h('The snapshot'),
    p(
      'A transaction\'s snapshot is a list of which transactions had committed when it started. A row version is visible if the transaction that created it is in that list, and the transaction that deleted it is not.',
    ),
    table(
      ['isolation level', 'snapshot taken'],
      [
        ['`READ COMMITTED`', '**At the start of each statement.** Two statements can see different data — the non-repeatable read, by design.'],
        ['`REPEATABLE READ`', '**At the first read of the transaction**, and reused for all of it.'],
      ],
    ),
    p(
      'So the difference between the two levels, in an MVCC engine, is nothing more than *how often the snapshot is refreshed*. That is a satisfying answer to give, because it explains both levels at once.',
    ),

    h('The cost: dead rows'),
    warn(
      'An `UPDATE` under MVCC does not overwrite. It writes a **new version** and marks the old one dead — so a table updated a million times contains a million dead row versions until something removes them. Nothing about this is optional; it is the price of not blocking.',
    ),
    table(
      ['', 'PostgreSQL', 'InnoDB'],
      [
        ['Old versions live in', '**The table itself**', 'The **undo log**, a separate structure'],
        ['So the table', '**Bloats** with dead tuples', 'Stays compact'],
        ['Cleaned by', '`VACUUM` / autovacuum', 'A purge thread'],
        ['A long transaction causes', 'Bloat — vacuum cannot remove versions it might still need', 'Undo log growth, and slower reads walking longer version chains'],
        ['Indexes', 'Point at **every** version', 'Point at the primary key'],
      ],
    ),

    h('VACUUM'),
    p(
      'PostgreSQL keeps dead tuples in the table, so it needs a process to reclaim them. Autovacuum does this automatically, and understanding it is most of understanding Postgres operations:',
    ),
    code(
      sql(`
VACUUM employees;              -- mark dead tuples reusable. Does not lock.
VACUUM ANALYZE employees;      -- and refresh the planner's statistics.
VACUUM FULL employees;         -- rewrite the table, returning disk to the OS.
                               -- Takes an ACCESS EXCLUSIVE lock. Not on a live table.

-- How much of this table is dead?
SELECT relname, n_live_tup, n_dead_tup, last_autovacuum
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC;
`),
    ),
    result(
      ['relname', 'n_live_tup', 'n_dead_tup', 'last_autovacuum'],
      [
        ['sessions', '`1204`', '**`847302`**', '`2024-05-28 02:11:04`'],
        ['employees', '`6`', '`0`', '`2024-06-01 03:00:12`'],
      ],
      'A table that vacuum is not keeping up with',
    ),
    tip(
      'That first row is the classic Postgres production problem, and the cause is nearly always a **long-running transaction**. Vacuum may only remove versions no live transaction could still need — so one idle-in-transaction connection, left open by a connection pool or a debugger, prevents cleanup **across the whole database**. Bloat grows, and the query that finds it is `SELECT * FROM pg_stat_activity WHERE state = \'idle in transaction\'`.',
    ),

    h('MVCC and COUNT(*)'),
    warn(
      'Because visibility is per transaction, **no single stored number can be the row count** — different transactions legitimately see different counts of the same table. PostgreSQL therefore has to scan to answer `SELECT COUNT(*)`, which on a large table is slow, and this surprises people arriving from MySQL/MyISAM where the count was a stored constant. InnoDB has the same issue for the same reason.',
    ),
    code(
      sql(`
-- Exact, and O(n).
SELECT COUNT(*) FROM employees;

-- Approximate, and instant — good enough for a dashboard.
SELECT reltuples::bigint FROM pg_class WHERE relname = 'employees';   -- Postgres
SELECT table_rows FROM information_schema.tables
WHERE table_name = 'employees';                                       -- MySQL
`),
    ),

    h('MVCC and unique constraints'),
    p(
      'One place MVCC cannot avoid blocking, and it is worth knowing because it looks like a bug. Two transactions inserting the same unique value: the second **must** wait, because whether it is allowed depends on whether the first commits. There is no version to read that answers the question, so the writer blocks until the outcome is known.',
    ),

    h('Where locks still live'),
    p('MVCC removes read-write conflicts. It does not remove write-write conflicts, and these still take real locks:'),
    ul(
      'Two transactions updating the **same row** — the second waits.',
      '`SELECT … FOR UPDATE` — a deliberate current read, and a real lock.',
      '`UPDATE` and `DELETE` — they read the **latest committed** version, not the snapshot.',
      'Unique constraint checks, as above.',
      'DDL, which takes table-level locks.',
    ),
    warn(
      'That third point is the same trap as in the isolation-levels topic and it is worth repeating: a plain `SELECT` reads the snapshot, an `UPDATE` reads the present. At `REPEATABLE READ` a transaction can display 50,000 and simultaneously update from 60,000. This is why read-then-write must use `SELECT … FOR UPDATE`, which is a current read and takes the lock.',
    ),

    h('MVCC or locking'),
    table(
      ['', 'MVCC', 'Pure two-phase locking'],
      [
        ['Readers block writers', '**No**', 'Yes'],
        ['Writers block readers', '**No**', 'Yes'],
        ['Writers block writers', 'Yes', 'Yes'],
        ['Storage cost', 'Old versions until cleanup', 'None'],
        ['Maintenance', 'Vacuum / purge', 'None'],
        ['Read performance', 'Excellent', 'Poor under write load'],
        ['Used by', 'PostgreSQL, InnoDB, Oracle, SQL Server (opt-in)', 'SQL Server by default, InnoDB at `SERIALIZABLE`'],
      ],
    ),

    h('Interview'),
    asked([
      ['What is MVCC?', 'Keeping several versions of each row so readers see a consistent older version instead of waiting for writers.'],
      ['State the guarantee.', 'Readers never block writers and writers never block readers.'],
      ['How does a transaction know which version to read?', 'Its snapshot — the set of transactions committed when it started. It reads the newest version visible to that snapshot.'],
      ['What is the difference between READ COMMITTED and REPEATABLE READ under MVCC?', 'How often the snapshot is refreshed: per statement, or once per transaction.'],
      ['Where do old versions go?', 'PostgreSQL keeps them in the table; InnoDB puts them in the undo log.'],
      ['Why does PostgreSQL need VACUUM?', 'To reclaim dead tuples left in the table by updates and deletes.'],
      ['What stops vacuum working?', 'A long-running or idle-in-transaction connection — versions it might still need cannot be removed.'],
      ['Why is COUNT(*) slow in PostgreSQL?', 'Visibility is per transaction, so no single stored count can be correct; it must scan.'],
      ['Does MVCC eliminate all locking?', 'No — write-write conflicts, FOR UPDATE, and unique checks still block.'],
      ['Why does a unique insert block?', 'Whether the second insert is legal depends on whether the first commits; no version answers that.'],
      ['Which reads bypass the snapshot?', 'UPDATE, DELETE and SELECT … FOR UPDATE — current reads, taking the latest committed version.'],
    ]),

    h('Cheatsheet'),
    cheat([
      ['Let readers and writers coexist', 'MVCC — the default in Postgres and InnoDB'],
      ['A consistent view for a long report', '`REPEATABLE READ` — one snapshot throughout'],
      ['A fresh view per statement', '`READ COMMITTED`'],
      ['Read the *current* value to write it', '`SELECT … FOR UPDATE`'],
      ['Find Postgres bloat', '`pg_stat_user_tables`, `n_dead_tup`'],
      ['Find what is blocking vacuum', "`pg_stat_activity WHERE state = 'idle in transaction'`"],
      ['Reclaim disk', '`VACUUM FULL` — but it locks the table'],
      ['An approximate row count', '`reltuples` / `table_rows`'],
    ]),

    links(
      wiki('Multiversion_concurrency_control', 'MVCC'),
      pgDoc('mvcc-intro.html', 'MVCC in PostgreSQL'),
      mysqlDoc('innodb-multi-versioning.html', 'InnoDB multi-versioning'),
    ),
  ],
};
