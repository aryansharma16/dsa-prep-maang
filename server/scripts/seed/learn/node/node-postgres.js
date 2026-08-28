import { asked, cheat, code, h, js, link, links, note, p, sh, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      '`pg` — node-postgres — is the driver almost everything else is built on, including Prisma\'s Postgres adapter. Two things about it matter more than the rest of the API combined: **use a pool, not a client**, and **never build SQL with a template string**.',
    ),

    h('Setup'),
    code(
      sh(`
npm install pg
`),
    ),
    code(
      js(`
// db/pool.js — one pool for the whole process
import pg from 'pg';
import { config } from '../config/index.js';

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: 10,                        // connections; see sizing below
  idleTimeoutMillis: 30_000,      // close idle ones
  connectionTimeoutMillis: 5_000, // fail fast if the pool is exhausted
  ssl: config.isProd ? { rejectUnauthorized: true } : false,
});

// A pool emits errors from IDLE clients — unhandled, this kills the process.
pool.on('error', (err) => log.error({ err }, 'idle client error'));
`),
    ),
    table(
      ['', '`new Client()`', '`new Pool()`'],
      [
        ['Connections', 'One, that you open and close', 'A managed set, reused'],
        ['Cost per query', 'A full connect if not already open', 'Checkout from the pool — microseconds'],
        ['Concurrency', 'One query at a time', 'Up to `max` at once'],
        ['Use for', 'A migration script, a one-off CLI', '**A server. Always.**'],
      ],
    ),
    warn(
      'A Postgres connection costs a backend **process** on the server and several megabytes of memory — it is not a cheap socket. Connecting per request is both slow and a good way to exhaust `max_connections` and take the database down for everything else using it.',
    ),

    h('Querying'),
    code(
      js(`
// The common case: pool.query checks out a client, runs, releases it.
const { rows, rowCount } = await pool.query(
  'select id, title from tasks where user_id = $1 and done = $2 limit $3',
  [userId, false, 20],
);

rows;        // [{ id: '…', title: '…' }]
rowCount;    // number of rows affected — what UPDATE and DELETE return
`),
    ),
    code(
      js(`
// Named parameters via an object form, when a query has many placeholders.
await pool.query({
  name: 'find-task',              // a prepared statement, cached per connection
  text: 'select * from tasks where id = $1',
  values: [id],
});
`),
    ),

    h('Placeholders, not interpolation'),
    warn(
      'This is the most important paragraph in the topic. `$1` is **not** string substitution — the SQL and the values travel separately, so a value can never be parsed as SQL. That is what makes injection structurally impossible, rather than merely unlikely.',
    ),
    code(
      js(`
// Catastrophic. email = "x'; drop table users; --" and the table is gone.
await pool.query(\`select * from users where email = '\${email}'\`);

// Safe, always, for any value whatsoever.
await pool.query('select * from users where email = $1', [email]);
`),
    ),
    code(
      js(`
// Arrays work as one parameter — no need to build $1, $2, $3, …
await pool.query('select * from tasks where id = any($1::uuid[])', [ids]);

// LIKE: keep the wildcards outside the parameter.
await pool.query("select * from tasks where title ilike '%' || $1 || '%'", [q]);
`),
    ),
    warn(
      'A placeholder can hold a **value**, never an identifier. Table names, column names and `ORDER BY` directions cannot be parameterised, so they must come from an allowlist in your code — the point made in `pagination-filtering-sorting`.',
    ),

    h('Transactions'),
    p(
      'A transaction needs the **same** connection for every statement, so it cannot use `pool.query` — you check a client out and give it back.',
    ),
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
    client.release();               // ALWAYS — this is the leak if you forget
  }
}

await withTransaction(async (client) => {
  const { rows: [task] } = await client.query(
    'insert into tasks (user_id, title) values ($1, $2) returning *',
    [userId, title],
  );
  await client.query(
    'insert into audit_log (user_id, action, task_id) values ($1, $2, $3)',
    [userId, 'task.created', task.id],
  );
  return task;
});
`),
    ),
    warn(
      'A missing `client.release()` leaks a connection permanently. Ten leaked connections on a pool of ten means every subsequent query hangs until `connectionTimeoutMillis` — the whole service stops, with the database looking perfectly healthy. The `finally` is not optional.',
    ),

    h('Sizing the pool'),
    code(
      js(`
// The constraint is the DATABASE's max_connections, shared by every client.
//   instances x pool_max  +  migrations  +  your psql session  <  max_connections
//
// 4 instances x 10 = 40, on a default max_connections of 100. Fine.
// 20 instances x 20 = 400. Not fine.
`),
    ),
    table(
      ['Symptom', 'Means'],
      [
        ['Queries hang, then `timeout exceeded when trying to connect`', 'Pool exhausted — leaked clients, or too small'],
        ['`sorry, too many clients already`', 'The **database** limit is hit across all instances'],
        ['Latency rises with concurrency but the DB is idle', 'Requests queueing at the pool'],
      ],
    ),
    tip(
      'Bigger is not better. Postgres is most efficient at roughly `cores x 2` active connections; beyond that, more concurrency means more contention and *lower* throughput. When you truly need many instances, put PgBouncer in front in transaction pooling mode rather than raising every pool.',
    ),

    h('Types'),
    code(
      js(`
// pg maps most types sensibly, with two surprises:
// bigint (int8) and numeric come back as STRINGS, to avoid precision loss.
const { rows } = await pool.query('select count(*) from tasks');
rows[0].count;              // '143'  <- a string
Number(rows[0].count);      // 143

// timestamptz becomes a JS Date. int, bool, text, json, jsonb, uuid, arrays
// all map naturally.
`),
    ),
    note(
      'That `count` returning a string catches everyone once. It is correct — a `bigint` can exceed `Number.MAX_SAFE_INTEGER` — but it means `rows[0].count + 1` is `"1431"`. Convert explicitly, or map the type globally with `pg.types.setTypeParser`.',
    ),

    h('Streaming large results'),
    code(
      js(`
// pool.query buffers EVERY row in memory before resolving.
// For a large export, stream instead.
import QueryStream from 'pg-query-stream';
import { pipeline } from 'node:stream/promises';

const client = await pool.connect();
try {
  const stream = client.query(new QueryStream('select * from events'));
  await pipeline(stream, toCsv(), res);
} finally {
  client.release();
}
`),
    ),

    h('A repository, put together'),
    code(
      js(`
// repositories/tasks.repo.js
import { pool } from '../db/pool.js';

const toTask = (r) => ({
  id: r.id, title: r.title, done: r.done, createdAt: r.created_at,
});

export async function findById(id) {
  const { rows } = await pool.query('select * from tasks where id = $1', [id]);
  return rows[0] ? toTask(rows[0]) : null;
}

export async function listForUser(userId, { limit, status }) {
  const { rows } = await pool.query(
    \`select * from tasks
     where user_id = $1 and ($2::text is null or status = $2)
     order by created_at desc, id desc
     limit $3\`,
    [userId, status ?? null, limit],
  );
  return rows.map(toTask);
}
`),
    ),
    tip(
      'The `($2::text is null or status = $2)` trick keeps one query instead of building SQL conditionally. It is readable up to two or three optional filters; past that, build the clause list from an allowlist as in the pagination topic.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Query from a server', '`pool.query(sql, params)`'],
      ['Pass a value', '`$1` and the params array — never interpolation'],
      ['Pass a list', '`= any($1::uuid[])`'],
      ['Run a transaction', '`pool.connect()`, `begin`/`commit`, `release()` in `finally`'],
      ['Avoid a pool leak', 'The `finally { client.release() }`'],
      ['Size the pool', 'Instances × max must stay under `max_connections`'],
      ['Handle a `count`', 'It is a string — convert it'],
      ['Export many rows', '`pg-query-stream`, not `pool.query`'],
      ['Handle a unique violation', 'Catch `err.code === "23505"`'],
    ]),

    h('Interview'),
    asked([
      ['Client or pool?', 'A pool in a server — connections are expensive Postgres processes, so they are reused.'],
      ['How do parameterised queries prevent injection?', 'SQL and values are sent separately, so a value is never parsed as SQL.'],
      ['What cannot be parameterised?', 'Identifiers — table and column names, `ORDER BY` direction. Those need an allowlist.'],
      ['Why does a transaction need `pool.connect()`?', 'A transaction is per-connection state; `pool.query` may pick a different client each time.'],
      ['What happens if you forget `release()`?', 'The connection leaks; once the pool is exhausted every query hangs until it times out.'],
      ['How do you size a pool?', 'Total connections across instances must stay under `max_connections`; Postgres peaks around cores × 2 active.'],
      ['Why is `count` a string?', 'It is a `bigint`, which can exceed JavaScript\'s safe integer range.'],
    ]),

    links(
      link('node-postgres', 'https://node-postgres.com'),
      link('node-postgres — Pooling', 'https://node-postgres.com/features/pooling'),
      link('PostgreSQL — Connection settings', 'https://www.postgresql.org/docs/current/runtime-config-connection.html'),
    ),
  ],
};
