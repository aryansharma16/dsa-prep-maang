import {
  asked,
  cheat,
  code,
  data,
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

/*
  The section the request singled out — "explain the transactions properly with
  examples, step by step". So the bank transfer is walked one statement at a
  time with the table contents printed after each, rather than shown as a
  finished block of SQL with a paragraph about atomicity underneath it.
*/
export const doc = {
  blocks: [
    p(
      'A **transaction** is a group of statements that succeed together or fail together. Nothing in between is ever visible and nothing in between is ever left behind — not if another connection looks, not if the query fails, not if the machine loses power halfway.',
    ),
    p(
      'The reason it has to exist is that almost nothing useful is one statement. Moving money is two updates. Placing an order is an insert, a stock decrement and a payment record. Each of those has a moment in the middle where the data is **wrong**, and a transaction is the mechanism that guarantees nobody ever sees that moment.',
    ),

    h('The three statements'),
    table(
      ['statement', 'does'],
      [
        ['`START TRANSACTION`', 'Begins one. `BEGIN` is a synonym.'],
        ['`COMMIT`', 'Makes every change permanent and visible to everyone.'],
        ['`ROLLBACK`', 'Discards every change since the start, as if none of it happened.'],
        ['`SAVEPOINT name`', 'A named marker you can roll back to without abandoning the whole transaction.'],
      ],
    ),

    h('The bank transfer, one statement at a time'),
    p('Two accounts. Ada is about to send 10,000 to Grace.'),
    data(
      'accounts — before',
      ['id', 'holder', 'balance'],
      [
        ['`1`', 'Ada', '`50000.00`'],
        ['`2`', 'Grace', '`30000.00`'],
      ],
    ),
    p('**Step 1 — open the transaction.** Nothing has changed yet, but from here on this connection is working on a private draft.'),
    code(sql(`START TRANSACTION;`)),
    p('**Step 2 — take the money out of Ada\'s account.**'),
    code(sql(`UPDATE accounts SET balance = balance - 10000 WHERE id = 1;`)),
    p('This is the dangerous moment. **10,000 has left the system.** Ada has 40,000, Grace still has 30,000, and 10,000 exists nowhere:'),
    result(
      ['id', 'holder', 'balance', 'total'],
      [
        ['`1`', 'Ada', '`40000.00`', ''],
        ['`2`', 'Grace', '`30000.00`', '**`70000.00` — was 80,000**'],
      ],
      'What this connection sees, mid-transaction',
    ),
    warn(
      'Crucially, **no other connection sees that.** A second session reading `accounts` right now still sees 50,000 and 30,000, because the change is uncommitted. This is isolation, and it is the property doing the work here — without it, a balance report run at this instant would be short by 10,000 and nobody would ever know why.',
    ),
    p('**Step 3 — put it into Grace\'s account.**'),
    code(sql(`UPDATE accounts SET balance = balance + 10000 WHERE id = 2;`)),
    result(
      ['id', 'holder', 'balance', 'total'],
      [
        ['`1`', 'Ada', '`40000.00`', ''],
        ['`2`', 'Grace', '`40000.00`', '**`80000.00` — correct again**'],
      ],
      'Still private to this connection',
    ),
    p('**Step 4 — commit.** Now, and only now, both changes become visible to everyone, atomically. There is no instant at which another connection sees one update and not the other.'),
    code(sql(`COMMIT;`)),
    data(
      'accounts — after',
      ['id', 'holder', 'balance'],
      [
        ['`1`', 'Ada', '`40000.00`'],
        ['`2`', 'Grace', '`40000.00`'],
      ],
    ),

    h('What happens if it fails'),
    p('Rerun the same thing, and suppose the second update fails — a constraint, a deadlock, a dropped connection, a power cut:'),
    code(
      sql(`
START TRANSACTION;
  UPDATE accounts SET balance = balance - 10000 WHERE id = 1;   -- succeeds
  UPDATE accounts SET balance = balance + 10000 WHERE id = 99;  -- fails
ROLLBACK;
`),
    ),
    p('`ROLLBACK` undoes the first update. Ada is back to 50,000. **The money was never destroyed, because from the outside the first update never happened.**'),
    note(
      'And if nobody issues the `ROLLBACK` — the process is killed, the network drops, the server loses power — the database does it anyway. An uncommitted transaction is rolled back when the connection dies, and on restart after a crash the recovery process rolls back everything that was in flight. **"All or nothing" holds without cooperation from the client**, which is the part that makes it a guarantee rather than a convention.',
    ),

    h('Checking before you commit'),
    p('A transaction is not only a safety net — you can look at the result and decide:'),
    code(
      sql(`
START TRANSACTION;

  UPDATE accounts SET balance = balance - 10000 WHERE id = 1;

  -- Did that leave the account overdrawn?
  SELECT balance FROM accounts WHERE id = 1;
  -- 40000.00  → fine, carry on

  UPDATE accounts SET balance = balance + 10000 WHERE id = 2;

COMMIT;
`),
    ),
    tip(
      'This is the habit worth forming for any manual change to production data. Open a transaction, run the `UPDATE`, read the row count and the affected rows, and only then decide between `COMMIT` and `ROLLBACK`. It costs two words and turns "I have just updated 4,182 rows instead of 2" from an incident into a keystroke.',
    ),

    h('Enforcing the rule inside the transaction'),
    p('The check and the update must be in the **same** transaction, or the check means nothing:'),
    code(
      sql(`
START TRANSACTION;

  -- FOR UPDATE locks the row. Nobody else can change it until we commit.
  SELECT balance FROM accounts WHERE id = 1 FOR UPDATE;

  -- Application decides: is balance >= 10000?
  -- If not:  ROLLBACK;

  UPDATE accounts SET balance = balance - 10000 WHERE id = 1;
  UPDATE accounts SET balance = balance + 10000 WHERE id = 2;

COMMIT;
`),
    ),
    warn(
      'Without `FOR UPDATE`, two concurrent transfers can both read a balance of 10,000, both conclude there are sufficient funds, and both debit — leaving the account at −10,000. Neither did anything wrong on its own. This is the **lost update**, it is the reason locking exists, and it is covered properly in the isolation-levels and locks topics.',
    ),
    tip(
      'Better still, let the database do the check: `UPDATE accounts SET balance = balance - 10000 WHERE id = 1 AND balance >= 10000`. The condition and the write are one atomic statement, so there is no gap at all. Check the affected row count — zero means insufficient funds.',
    ),

    h('SAVEPOINT — partial rollback'),
    code(
      sql(`
START TRANSACTION;

  INSERT INTO orders (id, customer_id, total) VALUES (100, 1, 500);

  SAVEPOINT after_order;

  INSERT INTO order_lines (order_id, product_id, qty) VALUES (100, 55, 2);
  -- fails: product 55 is discontinued

  ROLLBACK TO SAVEPOINT after_order;   -- the line is gone, the order remains

  INSERT INTO order_lines (order_id, product_id, qty) VALUES (100, 56, 2);

COMMIT;   -- the order and the second line are saved
`),
    ),
    ul(
      '`SAVEPOINT name` — set a marker.',
      '`ROLLBACK TO SAVEPOINT name` — undo back to it. **The transaction stays open.**',
      '`RELEASE SAVEPOINT name` — discard the marker, keeping the work.',
      'A plain `ROLLBACK` still discards everything, savepoints included.',
    ),
    note(
      'Savepoints are what an ORM uses to give you nested transactions, which the database does not really have. `BEGIN` inside a `BEGIN` does not start a second transaction — the library issues a savepoint instead, so an inner "rollback" undoes only the inner block. Worth knowing when a framework claims to support nesting.',
    ),

    h('Autocommit'),
    warn(
      'By default, **every statement is its own transaction**. A bare `UPDATE` is implicitly wrapped in `START TRANSACTION … COMMIT`, which is why it is permanent the instant it runs and why there is nothing to roll back afterwards. `START TRANSACTION` suspends autocommit until you commit or roll back.',
    ),
    code(
      sql(`
SELECT @@autocommit;   -- 1 in MySQL by default

SET autocommit = 0;    -- now every statement opens a transaction you must COMMIT
-- ... work ...
COMMIT;
SET autocommit = 1;
`),
    ),

    h('Statements that commit whether you like it or not'),
    warn(
      'In **MySQL**, DDL causes an **implicit commit**. A `CREATE TABLE`, `ALTER TABLE`, `DROP` or `TRUNCATE` in the middle of an open transaction silently commits everything you had done so far, before executing itself. There is no warning and no way back. **PostgreSQL has transactional DDL** — you can create a table, populate it, and roll the whole thing back — which is why Postgres migrations can be genuinely all-or-nothing and MySQL ones cannot.',
    ),
    code(
      sql(`
START TRANSACTION;
  UPDATE accounts SET balance = 0 WHERE id = 1;
  CREATE TABLE audit_tmp (id INT);   -- MySQL: COMMITS the update above. Right now.
ROLLBACK;                            -- undoes nothing
`),
    ),

    h('In application code'),
    code(
      sql(`
-- The shape, in any language: acquire a connection, and always release it.
--
--   connection = pool.getConnection()
--   try:
--       connection.begin()
--       ... statements ...
--       connection.commit()
--   except:
--       connection.rollback()
--       raise
--   finally:
--       connection.release()
`),
    ),
    ul(
      '**Every statement must use the same connection.** A transaction belongs to a connection; taking a fresh one from the pool mid-way puts half the work outside it. This is the most common transaction bug in pooled applications.',
      '**Roll back on every error path**, including ones you did not expect. A `finally` that releases without rolling back returns a connection to the pool with an open transaction on it, and the next unrelated request inherits it.',
      '**Keep it short.** A transaction holds locks until it commits. An HTTP call inside one holds row locks for the length of somebody else’s network.',
    ),

    h('Interview'),
    asked([
      ['What is a transaction?', 'A group of statements that all succeed or all fail, with nothing in between ever visible.'],
      ['Name the control statements.', 'START TRANSACTION / BEGIN, COMMIT, ROLLBACK, SAVEPOINT.'],
      ['Walk through a bank transfer.', 'Begin, debit one account, credit the other, commit. The intermediate state where the money exists nowhere is never visible outside the transaction.'],
      ['What if the connection dies mid-transaction?', 'The database rolls it back — on disconnect, or during crash recovery on restart.'],
      ['What is autocommit?', 'Every statement is its own transaction unless you start one explicitly.'],
      ['What is a savepoint?', 'A marker you can roll back to without ending the transaction — how ORMs implement nested transactions.'],
      ['Can you roll back a CREATE TABLE?', 'In PostgreSQL yes; in MySQL no, and it implicitly commits your open transaction first.'],
      ['Why must the balance check be inside the transaction?', 'Otherwise another transaction can change the balance between the check and the write — the lost update.'],
      ['What does SELECT … FOR UPDATE do?', 'Locks the selected rows so no other transaction can modify them until you commit.'],
      ['Why keep transactions short?', 'They hold locks until commit, and long transactions block other writers and grow the undo log.'],
      ['What is the most common transaction bug in pooled code?', 'Running some statements on a different connection than the one holding the transaction.'],
    ]),

    h('Cheatsheet'),
    cheat([
      ['Group statements atomically', '`START TRANSACTION` … `COMMIT`'],
      ['Undo everything', '`ROLLBACK`'],
      ['Undo part of it', '`SAVEPOINT` + `ROLLBACK TO SAVEPOINT`'],
      ['Check before committing', 'Run the `SELECT` inside the transaction, then decide'],
      ['Stop a concurrent writer', '`SELECT … FOR UPDATE`'],
      ['Check-and-write with no gap', 'One `UPDATE` with the condition in the `WHERE`'],
      ['Make a manual production change', 'Always inside a transaction, commit after checking the count'],
      ['Avoid an implicit commit', 'Keep DDL out of transactions in MySQL'],
    ]),

    links(
      mysqlDoc('commit.html', 'START TRANSACTION, COMMIT, ROLLBACK'),
      mysqlDoc('savepoint.html', 'SAVEPOINT'),
      wiki('Database_transaction', 'Database transaction'),
    ),
  ],
};
