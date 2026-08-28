import { asked, cheat, code, h, links, note, p, result, sql, table, tip, ul, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Four properties a transaction is guaranteed to have. Everyone can list them; the answer that scores names, for each one, **the exact thing that breaks without it** and **which part of the database provides it** — because those are two different questions and the second is the one that separates a memorised answer from an understood one.',
    ),

    h('The four'),
    table(
      ['', 'guarantees', 'without it', 'provided by'],
      [
        [
          '**A**tomicity',
          'All statements happen, or none do.',
          'Money leaves one account and never arrives at the other.',
          'The **undo log** — a record of how to reverse each change.',
        ],
        [
          '**C**onsistency',
          'The database moves from one valid state to another valid state.',
          'A row references a department that does not exist; a salary is negative.',
          '**Constraints**, and your code. Not really the database alone.',
        ],
        [
          '**I**solation',
          'Concurrent transactions do not see each other’s partial work.',
          'A report reads a transfer halfway through and is short by 10,000.',
          '**Locks** and **MVCC**, tuned by the isolation level.',
        ],
        [
          '**D**urability',
          'Once committed, it survives a crash.',
          'The server loses power and acknowledged orders are gone.',
          'The **write-ahead log**, flushed to disk before the commit returns.',
        ],
      ],
    ),

    h('Atomicity'),
    p('All or nothing. The mechanism is worth knowing because it is the same one that powers rollback:'),
    code(
      sql(`
START TRANSACTION;
  UPDATE accounts SET balance = balance - 10000 WHERE id = 1;   -- ok
  UPDATE accounts SET balance = balance + 10000 WHERE id = 2;   -- fails
COMMIT;   -- never reached
`),
    ),
    p(
      'Before each change, the engine writes the **previous** value to an undo log. Rolling back means replaying that log backwards. Crucially this happens whether or not anyone asks: if the process is killed between the two updates, the recovery process on restart finds an uncommitted transaction and undoes it. Atomicity is not a promise the client has to keep.',
    ),

    h('Consistency'),
    p(
      'The database ends in a valid state — every constraint satisfied, every foreign key pointing somewhere real, every `CHECK` true.',
    ),
    code(
      sql(`
START TRANSACTION;
  INSERT INTO employees (id, name, dept_id, salary) VALUES (7, 'Katherine', 99, 88000);
  -- ERROR: foreign key constraint fails — there is no department 99
ROLLBACK;
`),
    ),
    warn(
      'This is the letter people fumble, and the honest answer is that **consistency is the odd one out**. Atomicity, isolation and durability are things the database does for you. Consistency is a *shared* responsibility: the database enforces the rules you declared, and it has no idea that a transfer should preserve the total balance unless you wrote that down. A transaction that debits without crediting is fully atomic, isolated and durable — and leaves the books wrong. Saying that out loud is a much better answer than reciting "the database stays consistent".',
    ),
    note(
      'The C in ACID is also **not** the C in CAP. ACID consistency is "constraints hold"; CAP consistency is "every replica returns the same value". Different properties, different subjects, unrelated theorems — and conflating them is a common stumble on a distributed-systems question.',
    ),

    h('Isolation'),
    p(
      'Concurrent transactions behave as though they ran one after another. The strictest form, `SERIALIZABLE`, guarantees exactly that; the weaker levels trade some of it for concurrency, which is what the isolation-levels topic is entirely about.',
    ),
    result(
      ['t', 'Transaction A (transfer)', 'Transaction B (balance report)'],
      [
        ['1', '`START TRANSACTION`', ''],
        ['2', '`UPDATE … balance - 10000 WHERE id = 1`', ''],
        ['3', '', '`SELECT SUM(balance) FROM accounts`'],
        ['4', '', '→ **80,000**, not 70,000'],
        ['5', '`UPDATE … balance + 10000 WHERE id = 2`', ''],
        ['6', '`COMMIT`', ''],
        ['7', '', '`SELECT SUM(balance)` → 80,000'],
      ],
      'B never sees the gap',
    ),
    p(
      'At `t=4` the totals do not add up **inside A**, and B reads 80,000 anyway. That is isolation: B sees the state before A started, or the state after A committed, and never the state in between.',
    ),

    h('Durability'),
    p(
      'Once `COMMIT` returns, the change survives anything — process crash, OS panic, power failure. The mechanism is **write-ahead logging**, and its ordering is the whole trick:',
    ),
    ul(
      '**1.** The change is written to the log, sequentially, and the log is **flushed to disk**.',
      '**2.** Only then does `COMMIT` return to the client.',
      '**3.** The actual data pages are written later, lazily, in the background.',
      '**4.** After a crash, recovery replays the log: committed transactions are re-applied (**redo**), uncommitted ones are reversed (**undo**).',
    ),
    tip(
      'The counter-intuitive part is that durability is achieved by writing *more*, not less. Writing the data pages themselves would be many random writes scattered across the disk; the log is one **sequential** append, which is far faster. So the database writes the change twice and is quicker than writing it once. That is worth being able to explain, because "why is it faster to write it twice" is a good follow-up question.',
    ),
    code(
      sql(`
-- MySQL: how hard durability is enforced.
SELECT @@innodb_flush_log_at_trx_commit;
--  1 = flush and sync on every commit. Fully durable. The default.
--  2 = write to the OS on commit, sync once a second. Survives a process crash,
--      not a power cut.
--  0 = flush once a second. Fastest, and up to a second of committed work can
--      be lost.
`),
    ),
    warn(
      'Settings 0 and 2 are how people accidentally turn durability off. Both make writes measurably faster and both mean a commit can be acknowledged and then lost. That is a legitimate choice for a cache or an analytics staging table and never for anything a user was told had been saved.',
    ),

    h('When ACID is relaxed'),
    p('The properties are not free, and distributed systems trade them deliberately:'),
    table(
      ['system', 'gives up', 'to get'],
      [
        ['A single relational database', 'Nothing', 'The baseline — everything below is measured against it'],
        ['Read replicas', 'Some isolation — replicas lag', 'Read throughput'],
        ['`READ COMMITTED` (the Postgres default)', 'Repeatable reads', 'Far less blocking'],
        ['Sharding', 'Cross-shard atomicity', 'Write throughput'],
        ['Most NoSQL', 'Multi-record atomicity, strong consistency', 'Horizontal scale, availability'],
        ['**BASE** systems', 'Immediate consistency', '**B**asically **A**vailable, **S**oft state, **E**ventual consistency'],
      ],
    ),
    note(
      'BASE is the deliberate counterpart to ACID, and the acronym is a chemistry joke. It is not "ACID done badly" — it is a different position on the same trade-off, appropriate when availability matters more than every reader agreeing at every instant. A shopping cart can be eventually consistent; a ledger cannot.',
    ),

    h('Interview'),
    asked([
      ['What does ACID stand for?', 'Atomicity, Consistency, Isolation, Durability.'],
      ['Explain atomicity.', 'All statements commit or none do — implemented with an undo log, and applied by crash recovery without the client’s help.'],
      ['Explain consistency.', 'The database moves between valid states. Partly your responsibility — the database only enforces the constraints you declared.'],
      ['Why is consistency the odd one out?', 'The other three are guarantees the engine provides; this one depends on the rules you wrote and the correctness of your transaction.'],
      ['Explain isolation.', 'Concurrent transactions do not see each other’s uncommitted work — enforced by locks or MVCC, tuned by the isolation level.'],
      ['Explain durability.', 'A committed change survives a crash, because the write-ahead log is flushed to disk before COMMIT returns.'],
      ['How is durability implemented?', 'Write-ahead logging: log first and flush, return, write data pages later, replay the log on recovery.'],
      ['Why is writing twice faster?', 'The log is one sequential append; the data pages are random writes deferred to the background.'],
      ['Is the C in ACID the C in CAP?', 'No. ACID consistency is constraint satisfaction; CAP consistency is replica agreement.'],
      ['What is BASE?', 'Basically Available, Soft state, Eventual consistency — the availability-first trade many distributed stores make.'],
      ['Which property does the isolation level tune?', 'Isolation. The other three are not negotiable per transaction.'],
      ['How would you knowingly weaken durability?', 'Set innodb_flush_log_at_trx_commit to 0 or 2 — acceptable for a cache, never for a ledger.'],
    ]),

    h('Cheatsheet'),
    cheat([
      ['All or nothing', 'Atomicity — the undo log'],
      ['Constraints always hold', 'Consistency — your `CHECK`s and foreign keys'],
      ['Concurrent readers see no partial work', 'Isolation — locks and MVCC'],
      ['Survives a power cut', 'Durability — the write-ahead log'],
      ['Trade isolation for throughput', 'A lower isolation level'],
      ['Trade durability for speed', 'A weaker flush setting — knowingly'],
      ['Explain what the database does *not* guarantee', 'That your transaction is logically correct'],
    ]),

    links(
      wiki('ACID', 'ACID'),
      wiki('Write-ahead_logging', 'Write-ahead logging'),
      wiki('Eventual_consistency', 'Eventual consistency'),
    ),
  ],
};
