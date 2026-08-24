import { asked, cheat, code, h, js, link, links, note, p, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'A transaction makes a group of statements behave as one: all of them happen, or none do. That is the easy half. The hard half is **concurrency** — what happens when two requests run the same transaction at the same moment — and that is where the bugs that only appear in production live.',
    ),

    h('ACID'),
    table(
      ['', 'Guarantees'],
      [
        ['**Atomicity**', 'All statements commit, or none do. A crash mid-way rolls back.'],
        ['**Consistency**', 'Constraints hold at commit — foreign keys, checks, uniqueness.'],
        ['**Isolation**', 'Concurrent transactions do not see each other\'s uncommitted work. *How much* they see is the isolation level.'],
        ['**Durability**', 'Once committed, it survives a crash — it is on disk in the write-ahead log.'],
      ],
    ),
    code(
      js(`
begin;
  update accounts set balance = balance - 100 where id = 1;
  update accounts set balance = balance + 100 where id = 2;
commit;                    -- both, or neither. Never one.
`),
    ),

    h('In Node'),
    code(
      js(`
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}
`),
    ),
    warn(
      'Every statement inside must use the **same** `client`. A stray `pool.query(...)` in the middle of a transaction runs on a different connection, outside the transaction — so it commits independently and is not rolled back. This is a genuinely nasty bug because it works fine until something fails.',
    ),
    code(
      js(`
await withTransaction(async (client) => {
  await client.query('update accounts set balance = balance - $1 where id = $2', [amt, from]);
  await pool.query('insert into audit_log …');    // <- WRONG: outside the transaction
  await client.query('update accounts set balance = balance + $1 where id = $2', [amt, to]);
});
`),
    ),
    tip(
      'Keep transactions short and put no network calls inside them. An `await stripe.charge()` between `begin` and `commit` holds a database connection open for the duration of an external API call — and if that call hangs, so does a connection from your pool.',
    ),

    h('Isolation levels'),
    table(
      ['Level', 'Prevents', 'Still possible'],
      [
        ['`read uncommitted`', 'Nothing — and Postgres treats it as `read committed` anyway', ''],
        ['**`read committed`** (default)', 'Dirty reads', 'Non-repeatable reads, phantoms, lost updates'],
        ['`repeatable read`', 'Dirty and non-repeatable reads, phantoms', 'Serialization failures you must retry'],
        ['`serializable`', 'Everything — as if transactions ran one at a time', 'Serialization failures you must retry'],
      ],
    ),
    code(
      js(`
await client.query('begin isolation level repeatable read');
await client.query('begin isolation level serializable');
`),
    ),
    note(
      'Postgres\'s default is `read committed`: each **statement** sees a fresh snapshot of committed data. So two `SELECT`s in one transaction can return different results — that is a non-repeatable read, and it is allowed at this level.',
    ),

    h('The lost update'),
    p(
      'The concurrency bug you will actually hit. Two requests read the same row, both compute a new value from what they read, and both write. One update is silently lost.',
    ),
    code(
      js(`
// Request A                          Request B
// select stock from items  -> 1
//                                    select stock from items  -> 1
// if (stock < 1) throw
//                                    if (stock < 1) throw
// update items set stock = 0
//                                    update items set stock = 0
// Two orders placed. One item existed.
`),
    ),
    warn(
      'A transaction does **not** prevent this at `read committed`. Both transactions are individually valid; they just interleave. Wrapping the code in `begin`/`commit` and expecting it to be safe is the single most common misunderstanding about transactions.',
    ),

    h('Four fixes'),
    code(
      js(`
// 1. Do it in one atomic statement. Best when it fits — no lock to think about.
const { rowCount } = await pool.query(
  'update items set stock = stock - 1 where id = $1 and stock > 0',
  [id],
);
if (rowCount === 0) throw new ConflictError('Out of stock');
`),
    ),
    code(
      js(`
// 2. Pessimistic lock: FOR UPDATE. The second transaction WAITS at the select.
await withTransaction(async (client) => {
  const { rows: [item] } = await client.query(
    'select stock from items where id = $1 for update',      // <- the lock
    [id],
  );
  if (item.stock < 1) throw new ConflictError('Out of stock');
  await client.query('update items set stock = stock - 1 where id = $1', [id]);
});
`),
    ),
    code(
      js(`
// 3. Optimistic lock: a version column. No waiting; the loser is told to retry.
const { rowCount } = await pool.query(
  \`update tasks set title = $1, version = version + 1
   where id = $2 and version = $3\`,
  [title, id, expectedVersion],
);
if (rowCount === 0) throw new ConflictError('Modified by someone else');
`),
    ),
    code(
      js(`
// 4. serializable + retry. Postgres detects the conflict and aborts one side.
async function serializable(fn, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await withTransaction(async (client) => {
        await client.query('set transaction isolation level serializable');
        return fn(client);
      });
    } catch (err) {
      if (err.code !== '40001' || i === attempts - 1) throw err;   // 40001 = retry
      await sleep(50 * 2 ** i);
    }
  }
}
`),
    ),
    table(
      ['Approach', 'Choose when'],
      [
        ['One atomic statement', 'The update is expressible in SQL. **Try this first.**'],
        ['`for update`', 'Contention is low and you need to read, decide, then write'],
        ['A version column', 'A human is editing — you want "someone else changed this", not a wait'],
        ['`serializable` + retry', 'Complex invariants across several tables'],
      ],
    ),
    tip(
      'Optimistic locking is the right default for user-facing edits. Two people editing the same task should be told about the conflict, not silently have one overwrite the other — and no lock is held while a human thinks.',
    ),

    h('Deadlocks'),
    code(
      js(`
// A: lock row 1, then row 2.   B: lock row 2, then row 1.  Both wait forever —
// so Postgres kills one with error 40P01 after deadlock_timeout (1s default).

// The fix is an ordering rule everyone follows.
const [first, second] = [fromId, toId].sort();
await client.query('select * from accounts where id = $1 for update', [first]);
await client.query('select * from accounts where id = $1 for update', [second]);
`),
    ),
    note(
      'Deadlocks are not a database malfunction — they are the database noticing a cycle and breaking it. Retrying `40P01` is legitimate. Consistently ordering your locks is what makes them rare.',
    ),

    h('SKIP LOCKED'),
    code(
      js(`
-- The queue pattern: several workers, no worker takes the same job twice,
-- and none of them wait for each other.
begin;
  select * from jobs
  where status = 'pending'
  order by created_at
  limit 1
  for update skip locked;              -- step over rows another worker holds

  update jobs set status = 'running', started_at = now() where id = $1;
commit;
`),
    ),
    tip(
      'This is how you build a reliable job queue on Postgres alone, with no Redis. It is enough for a very large number of applications, and it means jobs are transactional with the data that created them.',
    ),

    h('Error codes to know'),
    table(
      ['Code', 'Means', 'Do'],
      [
        ['`23505`', 'Unique violation', '`409 Conflict`'],
        ['`23503`', 'Foreign key violation', '`422` — the referenced row is missing'],
        ['`23514`', 'Check constraint violation', '`422`'],
        ['`40001`', 'Serialization failure', '**Retry the transaction**'],
        ['`40P01`', 'Deadlock detected', '**Retry the transaction**'],
        ['`57014`', 'Query cancelled — `statement_timeout`', '`504`, and look at the query'],
      ],
    ),

    h('Cheatsheet'),
    cheat([
      ['Group statements atomically', '`begin` … `commit`, on one client'],
      ['Prevent a lost update, simply', 'One statement — `set x = x - 1 where x > 0`'],
      ['Read then write safely', '`select … for update`'],
      ['Detect a concurrent edit', 'A `version` column and `where version = $n`'],
      ['Guarantee complex invariants', '`serializable`, and retry on `40001`'],
      ['Avoid deadlocks', 'Always lock rows in the same order'],
      ['Build a job queue', '`for update skip locked`'],
      ['Keep the pool healthy', 'Short transactions, no network calls inside'],
    ]),

    h('Interview'),
    asked([
      ['What does ACID stand for?', 'Atomicity, Consistency, Isolation, Durability.'],
      ['What is Postgres\'s default isolation level?', '`read committed` — each statement sees a fresh snapshot of committed data.'],
      ['Two requests decrement the same stock — how do you stop overselling?', 'One atomic `update … where stock > 0`, or `select … for update`, or a version column.'],
      ['Does a transaction alone prevent a lost update?', 'No — at `read committed` both transactions are valid and one write is silently lost.'],
      ['Optimistic vs pessimistic locking?', 'Optimistic detects conflict at write time and asks for a retry; pessimistic makes the other side wait.'],
      ['What causes a deadlock and how do you avoid it?', 'Two transactions locking the same rows in opposite orders; a consistent lock order prevents it.'],
      ['How would you build a job queue in Postgres?', '`select … for update skip locked` so workers claim distinct rows without blocking.'],
    ]),

    links(
      link('PostgreSQL — Transaction isolation', 'https://www.postgresql.org/docs/current/transaction-iso.html'),
      link('PostgreSQL — Explicit locking', 'https://www.postgresql.org/docs/current/explicit-locking.html'),
      link('PostgreSQL — Error codes', 'https://www.postgresql.org/docs/current/errcodes-appendix.html'),
    ),
  ],
};
