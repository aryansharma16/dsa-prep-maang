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
  warn,
  wiki,
} from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'The **isolation level** is the dial. It decides how much of the concurrency in the previous topic your transactions are exposed to, and it is a genuine trade: stricter means more correct and more blocking. The SQL standard defines four levels, entirely in terms of which phenomena they forbid.',
    ),

    h('The table'),
    table(
      ['level', 'Dirty read', 'Non-repeatable read', 'Phantom read', 'Concurrency'],
      [
        ['`READ UNCOMMITTED`', '**Possible**', 'Possible', 'Possible', 'Highest'],
        ['`READ COMMITTED`', 'Prevented', '**Possible**', 'Possible', 'High'],
        ['`REPEATABLE READ`', 'Prevented', 'Prevented', '**Possible***', 'Medium'],
        ['`SERIALIZABLE`', 'Prevented', 'Prevented', 'Prevented', 'Lowest'],
      ],
    ),
    note(
      '*The asterisk matters and is worth raising unprompted: **InnoDB\'s `REPEATABLE READ` does prevent phantoms** for ordinary reads, because its consistent snapshot simply does not include rows committed after the transaction started, and its gap locks block the inserts that would create them. So MySQL is stricter than the standard requires at that level. The standard permits phantoms there; InnoDB mostly does not.',
    ),

    h('Setting it'),
    code(
      sql(`
-- This transaction only.
SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
START TRANSACTION;
  …
COMMIT;

-- Or as part of starting it (PostgreSQL).
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;

-- This connection, from now on.
SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED;

-- What am I on?
SELECT @@transaction_isolation;                 -- MySQL
SHOW transaction_isolation;                     -- PostgreSQL
`),
    ),

    h('READ UNCOMMITTED'),
    p('No isolation worth the name. A transaction can read another\'s uncommitted writes.'),
    warn(
      'There is essentially no correct use for it. The historical argument — a rough count over a huge table without taking locks — barely applies to MVCC engines, where reads do not block writers anyway. **PostgreSQL does not implement it at all**: asking for it silently gives you `READ COMMITTED`, and that is a fair comment on how useful it is.',
    ),

    h('READ COMMITTED — the PostgreSQL default'),
    p('You only ever see committed data. But **each statement gets a fresh view**, so two reads in one transaction can differ.'),
    result(
      ['t', 'Transaction A (READ COMMITTED)', 'Transaction B', 'A sees'],
      [
        ['1', '`START TRANSACTION`', '', ''],
        ['2', '`SELECT balance WHERE id = 1`', '', '`50000`'],
        ['3', '', '`UPDATE … = 60000 WHERE id = 1`', ''],
        ['4', '', '`COMMIT`', ''],
        ['5', '`SELECT balance WHERE id = 1`', '', '**`60000`**'],
      ],
      'Non-repeatable — and by design',
    ),
    tip(
      'This is the right default for most web applications, and the reasoning is worth having: a typical request does one or two short queries, so a per-statement snapshot is not a practical problem, and it holds far fewer locks than the alternatives. Reach for something stricter for the specific transaction that needs it, not for the whole application.',
    ),

    h('REPEATABLE READ — the MySQL default'),
    p(
      'The transaction takes a **snapshot at its first read**, and every subsequent read in that transaction sees that same snapshot. The same query gives the same answer all the way through.',
    ),
    result(
      ['t', 'Transaction A (REPEATABLE READ)', 'Transaction B', 'A sees'],
      [
        ['1', '`START TRANSACTION`', '', ''],
        ['2', '`SELECT balance WHERE id = 1`', '', '`50000` ← snapshot taken'],
        ['3', '', '`UPDATE … = 60000 WHERE id = 1`', ''],
        ['4', '', '`COMMIT`', ''],
        ['5', '`SELECT balance WHERE id = 1`', '', '**`50000`** ← still'],
        ['6', '`COMMIT`', '', ''],
        ['7', '`SELECT balance WHERE id = 1`', '', '`60000`'],
      ],
      'Repeatable, at the cost of being stale',
    ),
    p(
      'A is looking at a consistent view of the database **as it was**, which is exactly what a multi-query report wants: every figure comes from the same instant, so the totals reconcile.',
    ),
    warn(
      'And it produces one genuinely surprising behaviour, which gets asked about. A **write** does not use the snapshot — it reads the current committed version. So `UPDATE accounts SET balance = balance - 100 WHERE id = 1` at `t=5` operates on 60,000, not the 50,000 A can see. Reading and writing in the same transaction at this level can therefore act on two different versions of the same row. InnoDB calls this a *current read* as opposed to a *consistent read*, and `SELECT … FOR UPDATE` is a current read too — which is precisely why it is the right tool for read-then-write.',
    ),

    h('SERIALIZABLE'),
    p(
      'The strongest guarantee: the result is as if the transactions had run one after another in some order. It is the only level that prevents **write skew**.',
    ),
    p('The two engines get there completely differently, and the difference is practical rather than academic:'),
    table(
      ['', 'MySQL / InnoDB', 'PostgreSQL'],
      [
        ['Mechanism', 'Two-phase locking — every plain `SELECT` becomes `SELECT … LOCK IN SHARE MODE`', '**SSI** — Serializable Snapshot Isolation'],
        ['Readers block writers', '**Yes**', 'No'],
        ['Failure mode', 'Blocking, lock waits, deadlocks', '**A serialization failure at commit**'],
        ['What you must do', 'Keep transactions short', '**Catch the error and retry the whole transaction**'],
      ],
    ),
    code(
      sql(`
-- PostgreSQL: this is not an error to log, it is an instruction to retry.
-- ERROR:  could not serialize access due to read/write dependencies
-- SQLSTATE: 40001
--
-- Any application using SERIALIZABLE on Postgres needs a retry loop.
-- Without one, it works in testing and fails under load.
`),
    ),
    tip(
      'That row is the most practically useful thing on this page. Postgres does not block to achieve serializability — it lets transactions run optimistically and **aborts one at commit time** if the interleaving could not have happened serially. Code that does not retry on SQLSTATE `40001` will appear to work perfectly until there is real concurrency.',
    ),

    h('The defaults, and why they differ'),
    table(
      ['engine', 'default', 'why'],
      [
        ['**MySQL / InnoDB**', '`REPEATABLE READ`', 'Historically for replication correctness with statement-based binary logs.'],
        ['**PostgreSQL**', '`READ COMMITTED`', 'Less blocking; the level most applications actually need.'],
        ['**Oracle**', '`READ COMMITTED`', 'Same reasoning. Has no `REPEATABLE READ` at all.'],
        ['**SQL Server**', '`READ COMMITTED`', 'With locking by default; snapshot isolation is opt-in.'],
      ],
    ),
    warn(
      'Knowing which default you are on is not trivia. The same application code behaves differently on MySQL and PostgreSQL: a two-query report is internally consistent on MySQL and can be inconsistent on Postgres, and a read-then-write is subject to different races on each. Porting between them without checking is a reliable way to ship a heisenbug.',
    ),

    h('Choosing'),
    table(
      ['situation', 'level'],
      [
        ['A normal web request — read a few rows, write a few', '`READ COMMITTED` is fine'],
        ['A report that must be internally consistent across queries', '`REPEATABLE READ`'],
        ['Money, stock, seat booking — an invariant across rows', '`SERIALIZABLE`, with retries'],
        ['A read-then-write on one row', 'Any level, plus `SELECT … FOR UPDATE`'],
        ['Increment a counter', 'Any level — use `SET n = n + 1` and the problem disappears'],
        ['Anything at all', 'Never `READ UNCOMMITTED`'],
      ],
    ),
    tip(
      'Row four and five are the practical takeaway. **Most concurrency bugs are better fixed at the statement level than the isolation level.** An atomic `UPDATE` or an explicit `FOR UPDATE` fixes one specific race precisely, costs nothing elsewhere, and is visible in the code — whereas raising the isolation level for the whole application to fix one endpoint slows everything down and hides the reason.',
    ),

    h('Interview'),
    asked([
      ['Name the four isolation levels.', 'READ UNCOMMITTED, READ COMMITTED, REPEATABLE READ, SERIALIZABLE.'],
      ['Which phenomena does each allow?', 'RU: all three. RC: non-repeatable and phantoms. RR: phantoms (per the standard). SERIALIZABLE: none.'],
      ['What is the MySQL default?', 'REPEATABLE READ.'],
      ['And PostgreSQL?', 'READ COMMITTED.'],
      ['How does REPEATABLE READ work?', 'A snapshot taken at the first read; every later read in the transaction sees that snapshot.'],
      ['Does InnoDB’s REPEATABLE READ allow phantoms?', 'Mostly not — the snapshot excludes later commits and gap locks block the inserts. It is stricter than the standard requires.'],
      ['What is the difference between a consistent read and a current read?', 'A plain SELECT reads the snapshot; an UPDATE, DELETE or SELECT FOR UPDATE reads the latest committed version.'],
      ['How does PostgreSQL implement SERIALIZABLE?', 'SSI — optimistic, with a serialization failure at commit rather than blocking.'],
      ['What must an application using it do?', 'Retry on SQLSTATE 40001. Without a retry loop it fails under load.'],
      ['Which level prevents write skew?', 'Only SERIALIZABLE.'],
      ['When would you use READ UNCOMMITTED?', 'Essentially never — PostgreSQL does not even implement it.'],
      ['Better to raise the isolation level or fix the statement?', 'Fix the statement — an atomic update or FOR UPDATE targets the actual race without slowing everything else.'],
    ]),

    h('Cheatsheet'),
    cheat([
      ['See only committed data', '`READ COMMITTED`'],
      ['A consistent view across several queries', '`REPEATABLE READ`'],
      ['A cross-row invariant', '`SERIALIZABLE` + a retry loop'],
      ['Protect one read-then-write', '`SELECT … FOR UPDATE`'],
      ['Protect a counter', '`SET n = n + 1`'],
      ['Check the current level', '`SELECT @@transaction_isolation`'],
      ['Set it for one transaction', '`SET TRANSACTION ISOLATION LEVEL …`'],
      ['Handle a Postgres serialization failure', 'Catch SQLSTATE `40001` and retry the whole transaction'],
    ]),

    links(
      mysqlDoc('innodb-transaction-isolation-levels.html', 'InnoDB isolation levels'),
      pgDoc('transaction-iso.html', 'Transaction isolation (PostgreSQL)'),
      wiki('Isolation_(database_systems)', 'Isolation'),
    ),
  ],
};
