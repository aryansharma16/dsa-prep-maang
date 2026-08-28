import { asked, cheat, data, h, links, note, p, result, table, tip, warn, wiki } from '../blocks.js';

/*
  Every phenomenon here is a two-session timeline, and that is not decoration —
  a dirty read described in prose is a definition, and a dirty read shown as a
  clock with two columns is a thing you can reason about. The next topic maps
  these onto the isolation levels, so the phenomena come first.
*/
export const doc = {
  blocks: [
    p(
      'Weaker isolation buys concurrency by allowing a transaction to see things it arguably should not. There are **four** named things it might see, they are the vocabulary the isolation levels are defined in, and each one is much clearer as a timeline than as a sentence.',
    ),
    data(
      'accounts — the starting point for every example below',
      ['id', 'holder', 'balance'],
      [
        ['`1`', 'Ada', '`50000.00`'],
        ['`2`', 'Grace', '`30000.00`'],
      ],
    ),

    h('1 · Dirty read'),
    p('**Reading data another transaction has written and not committed** — data that may never have existed at all.'),
    result(
      ['t', 'Transaction A', 'Transaction B', 'What B sees'],
      [
        ['1', '`START TRANSACTION`', '`START TRANSACTION`', ''],
        ['2', '`UPDATE accounts SET balance = 90000 WHERE id = 1`', '', ''],
        ['3', '', '`SELECT balance FROM accounts WHERE id = 1`', '**`90000`** ← uncommitted'],
        ['4', '`ROLLBACK`', '', ''],
        ['5', '', '`SELECT balance FROM accounts WHERE id = 1`', '`50000`'],
      ],
      'B read a number that never existed',
    ),
    warn(
      'B acted on 90,000, and after A rolled back that value has never been true at any committed point in the database\'s history. If B approved a loan on it, the decision rests on a fact that was retracted. This is the only phenomenon that is straightforwardly *wrong* rather than merely stale — which is why every engine except at `READ UNCOMMITTED` prevents it, and why PostgreSQL does not implement `READ UNCOMMITTED` at all.',
    ),

    h('2 · Non-repeatable read'),
    p('**The same row, read twice in one transaction, gives two different values** — because another transaction committed a change in between.'),
    result(
      ['t', 'Transaction A', 'Transaction B', 'What A sees'],
      [
        ['1', '`START TRANSACTION`', '', ''],
        ['2', '`SELECT balance WHERE id = 1`', '', '`50000`'],
        ['3', '', '`UPDATE … balance = 60000 WHERE id = 1`', ''],
        ['4', '', '`COMMIT`', ''],
        ['5', '`SELECT balance WHERE id = 1`', '', '**`60000`** ← changed'],
        ['6', '`COMMIT`', '', ''],
      ],
      'Same query, same transaction, two answers',
    ),
    p(
      'Nothing here is invalid — B committed, so 60,000 is a real value. The problem is **internal inconsistency**: A has now computed two figures from two different versions of the world, and any total, ratio or comparison it derives across those two reads is from a state that never existed as a whole.',
    ),
    tip(
      'The realistic version is a report. Read the total assets, then read the total liabilities, and a transfer commits in between. Both numbers are individually correct and the balance sheet does not balance — which is exactly the kind of bug that gets escalated as "the numbers are wrong sometimes" and is nearly impossible to reproduce.',
    ),

    h('3 · Phantom read'),
    p(
      '**The same *query* returns a different set of rows**, because another transaction inserted or deleted rows matching the condition. The rows A already read did not change — new ones appeared.',
    ),
    result(
      ['t', 'Transaction A', 'Transaction B', 'What A sees'],
      [
        ['1', '`START TRANSACTION`', '', ''],
        ['2', '`SELECT COUNT(*) WHERE balance > 20000`', '', '**`2`**'],
        ['3', '', "`INSERT INTO accounts VALUES (3, 'Linus', 40000)`", ''],
        ['4', '', '`COMMIT`', ''],
        ['5', '`SELECT COUNT(*) WHERE balance > 20000`', '', '**`3`** ← a phantom'],
        ['6', '`COMMIT`', '', ''],
      ],
      'A new row appeared inside the range',
    ),
    note(
      'The distinction from a non-repeatable read is the one interviewers push on, and it is about **what changed**: a non-repeatable read is an existing row whose *value* changed; a phantom is the *set of rows* changing. That difference decides how they are prevented — locking the rows you read stops the first, and stops nothing about the second, because you cannot lock a row that does not exist yet. Preventing phantoms needs a **range** lock, which is what a gap lock or predicate lock is.',
    ),

    h('4 · Lost update'),
    p(
      '**Two transactions read the same value, both modify it, and one overwrites the other.** Not in the original SQL standard\'s list, and by far the most common of the four in real applications.',
    ),
    result(
      ['t', 'Transaction A', 'Transaction B', 'Balance'],
      [
        ['1', '`SELECT balance WHERE id = 1` → 50000', '', '`50000`'],
        ['2', '', '`SELECT balance WHERE id = 1` → 50000', '`50000`'],
        ['3', '`UPDATE … SET balance = 50000 - 10000`', '', '`40000`'],
        ['4', '`COMMIT`', '', '`40000`'],
        ['5', '', '`UPDATE … SET balance = 50000 - 5000`', '`45000`'],
        ['6', '', '`COMMIT`', '**`45000`**'],
      ],
      '15,000 was withdrawn. The balance says 5,000 was.',
    ),
    warn(
      'Neither transaction did anything wrong in isolation, both committed successfully, and **A\'s withdrawal has vanished** — B calculated from a value it read before A committed and wrote the result over the top. No error, no warning, and 10,000 that a customer took out is still in the account.',
    ),
    p('Three fixes, in increasing order of how much they cost:'),
    table(
      ['fix', 'how', 'cost'],
      [
        [
          '**Atomic update**',
          '`UPDATE accounts SET balance = balance - 10000 WHERE id = 1` — read and write in one statement, so there is no gap.',
          'None. **Do this whenever you can.**',
        ],
        [
          '**Pessimistic lock**',
          '`SELECT … FOR UPDATE` locks the row; the second transaction waits.',
          'Blocking, and a deadlock risk.',
        ],
        [
          '**Optimistic lock**',
          'A `version` column: `UPDATE … SET balance = ?, version = version + 1 WHERE id = ? AND version = ?`. Zero rows affected means someone got there first — retry.',
          'A retry loop. Best under low contention.',
        ],
      ],
    ),
    tip(
      'The first row deserves emphasis because it is so often skipped. `SET balance = balance - 10000` is evaluated by the database while it holds the row lock, so no read-modify-write gap exists at all. An enormous proportion of lost updates come from application code reading a value into a variable, subtracting in the application, and writing the result back.',
    ),

    h('And a fifth: write skew'),
    p(
      'Two transactions read an overlapping set, each checks a rule that is still satisfied, and each writes a *different* row — so no update is lost and the rule is broken anyway:',
    ),
    result(
      ['t', 'Doctor A', 'Doctor B', 'On call'],
      [
        ['1', '`SELECT COUNT(*) WHERE on_call` → 2', '', '`2`'],
        ['2', '', '`SELECT COUNT(*) WHERE on_call` → 2', '`2`'],
        ['3', '"2 > 1, safe to leave" → `UPDATE me SET on_call = false`', '', '`1`'],
        ['4', '', '"2 > 1, safe to leave" → `UPDATE me SET on_call = false`', '**`0`**'],
      ],
      'Nobody is on call',
    ),
    warn(
      'Both transactions were correct given what they read, they touched **different rows** so no lock on the written row would have helped, and the invariant "at least one doctor on call" is now violated. Only `SERIALIZABLE` prevents write skew — this is the phenomenon that justifies its existence, and `REPEATABLE READ` does not stop it.',
    ),

    h('The four, side by side'),
    table(
      ['phenomenon', 'A reads', 'B does', 'A sees'],
      [
        ['**Dirty read**', 'A row', 'Writes without committing', 'The uncommitted value'],
        ['**Non-repeatable read**', 'The same row twice', 'Updates and commits between them', 'Two different values'],
        ['**Phantom read**', 'The same range twice', 'Inserts or deletes and commits', 'A different set of rows'],
        ['**Lost update**', 'A value, then writes it back', 'The same, concurrently', 'Its own write silently overwritten'],
      ],
    ),
    p('Which of these your database allows is decided by the **isolation level**, which is the next topic.'),

    h('Interview'),
    asked([
      ['What is a dirty read?', 'Reading another transaction’s uncommitted change — a value that may be rolled back and never have existed.'],
      ['What is a non-repeatable read?', 'The same row read twice in one transaction returning different values, because another transaction committed in between.'],
      ['What is a phantom read?', 'The same query returning a different set of rows, because rows were inserted or deleted in the range.'],
      ['Non-repeatable vs phantom?', 'The first is an existing row’s value changing; the second is the set of matching rows changing.'],
      ['Why does that distinction matter?', 'Row locks prevent the first and not the second — you cannot lock a row that does not exist yet. Phantoms need range or predicate locks.'],
      ['What is a lost update?', 'Two transactions read the same value, both write, and one silently overwrites the other.'],
      ['How do you prevent it?', 'An atomic `SET x = x - n`, or `FOR UPDATE`, or a version column with a retry.'],
      ['Which is the cheapest?', 'The atomic update — the read and write happen in one statement under the row lock.'],
      ['What is write skew?', 'Two transactions each read a set, each check an invariant, and each write a different row — breaking the invariant with no lost update. Only SERIALIZABLE prevents it.'],
      ['Which phenomenon is not in the SQL standard?', 'Lost update and write skew. The standard names dirty, non-repeatable and phantom reads.'],
    ]),

    h('Cheatsheet'),
    cheat([
      ['Uncommitted data read', 'Dirty read — prevented above `READ UNCOMMITTED`'],
      ['A row’s value changed mid-transaction', 'Non-repeatable read — prevented by `REPEATABLE READ`'],
      ['New rows appeared in a range', 'Phantom — prevented by `SERIALIZABLE` (and by InnoDB’s gap locks)'],
      ['A write silently overwritten', 'Lost update — fix with an atomic update'],
      ['An invariant broken by two different writes', 'Write skew — needs `SERIALIZABLE`'],
      ['Increment a counter safely', '`SET n = n + 1`, never read-then-write'],
      ['Guard a read-then-write', '`SELECT … FOR UPDATE`'],
      ['Detect a concurrent change', 'A `version` column and a retry'],
    ]),

    links(
      wiki('Isolation_(database_systems)#Read_phenomena', 'Read phenomena'),
      wiki('Snapshot_isolation#Definition', 'Write skew'),
    ),
  ],
};
