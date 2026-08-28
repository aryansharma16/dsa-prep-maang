import { asked, cheat, code, h, js, link, links, note, p, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Almost every "the API is slow" investigation ends at the database, and almost every one of those ends at a missing index or an N+1 query. Both are cheap to find once you know how to ask — which is what `EXPLAIN` is for.',
    ),

    h('What an index is'),
    p(
      'A sorted structure over one or more columns, letting the database find matching rows without reading the whole table. A B-tree index turns a scan of ten million rows into about two dozen page reads.',
    ),
    code(
      js(`
create index tasks_user_id_idx on tasks (user_id);

-- Composite: the ORDER of the columns is the whole design.
create index tasks_user_created_idx on tasks (user_id, created_at desc);

-- Partial: index only the rows you actually query. Smaller and faster.
create index tasks_pending_idx on tasks (created_at) where status = 'pending';

-- Expression: matches a query that calls a function on the column.
create index users_email_lower_idx on users (lower(email));

-- On a live table — no write lock.
create index concurrently tasks_due_at_idx on tasks (due_at);
`),
    ),
    warn(
      'An index is not free. Every `INSERT`, `UPDATE` and `DELETE` must maintain it, and it takes disk and cache space. Ten indexes on a write-heavy table can halve write throughput. Index what you query; drop what nothing uses.',
    ),

    h('Composite column order'),
    p(
      'A composite index works **left to right**, like a phone book sorted by surname then first name. You can look up by surname alone, or surname plus first name — never by first name alone.',
    ),
    code(
      js(`
-- index on (user_id, created_at)

where user_id = $1                             -- uses it
where user_id = $1 order by created_at desc    -- uses it, INCLUDING the sort
where user_id = $1 and created_at > $2         -- uses it
where created_at > $2                          -- does NOT use it
`),
    ),
    tip(
      'The rule: **equality columns first, then the range or sort column.** `(user_id, created_at)` serves "this user\'s tasks, newest first" with no sort step at all — the index is already in that order.',
    ),

    h('Reading EXPLAIN'),
    code(
      js(`
explain (analyze, buffers)
select * from tasks where user_id = $1 order by created_at desc limit 20;
`),
    ),
    code(
      js(`
-- Before the index:
Limit  (cost=45231.10..45231.15 rows=20)  (actual time=412.331..412.338 rows=20)
  ->  Sort  (cost=45231.10..45890.22 rows=263650)  (actual time=412.329..412.333)
        Sort Method: top-N heapsort  Memory: 32kB
        ->  Seq Scan on tasks  (actual time=0.019..380.442 rows=263650)
              Filter: (user_id = '…')
              Rows Removed by Filter: 4736350          <- read 5M, kept 264k
Execution Time: 412.9 ms

-- After create index tasks_user_created_idx on tasks (user_id, created_at desc):
Limit  (cost=0.43..8.61 rows=20)  (actual time=0.028..0.041 rows=20)
  ->  Index Scan using tasks_user_created_idx on tasks  (actual time=0.026..0.037)
        Index Cond: (user_id = '…')
Execution Time: 0.06 ms
`),
    ),
    table(
      ['See this', 'It means'],
      [
        ['`Seq Scan` on a big table', 'Reading every row. Fine for small tables, a red flag otherwise'],
        ['`Index Scan`', 'Using an index, then fetching the rows'],
        ['`Index Only Scan`', 'Answered entirely from the index — the fastest case'],
        ['`Bitmap Heap Scan`', 'Many matches; the planner batched the fetches. Often fine'],
        ['`Rows Removed by Filter: <large>`', 'Reading far more than you keep — a missing index'],
        ['`Sort` with a large `Memory`/`Disk`', 'An `ORDER BY` an index could have satisfied'],
        ['`Nested Loop` with a high loop count', 'Often the N+1 pattern, inside the database'],
        ['estimated `rows` far from actual', 'Stale statistics — `analyze tasks`'],
      ],
    ),
    tip(
      'Always use `explain (analyze, buffers)` — plain `EXPLAIN` shows the *plan* and its estimates; `ANALYZE` actually runs it and shows real timings and row counts. The gap between estimated and actual rows is often the whole diagnosis.',
    ),

    h('The N+1 query'),
    code(
      js(`
// 1 query for the tasks, then 1 per task. 51 round trips for 50 rows.
const tasks = await repo.listTasks(userId);
for (const t of tasks) {
  t.assignee = await repo.findUser(t.assigneeId);
}
`),
    ),
    p('Three fixes, in order of preference:'),
    code(
      js(`
// 1. A join — one query.
select t.*, u.name as assignee_name
from tasks t
left join users u on u.id = t.assignee_id
where t.user_id = $1;

// 2. Two queries and an in-memory join. Better when the join would multiply rows.
const tasks = await repo.listTasks(userId);
const ids = [...new Set(tasks.map(t => t.assigneeId).filter(Boolean))];
const users = await repo.findUsersByIds(ids);          // = any($1::uuid[])
const byId = new Map(users.map(u => [u.id, u]));
tasks.forEach(t => { t.assignee = byId.get(t.assigneeId) ?? null; });

// 3. In Prisma, 'include' — which does the same batching for you.
await prisma.task.findMany({ where: { userId }, include: { assignee: true } });
`),
    ),
    note(
      'N+1 hides well. It is invisible at 5 rows in development and obvious at 500 rows in production, which is why it so often ships. Logging a query count per request is the cheapest detector there is — alert when a single request issues more than about ten.',
    ),

    h('Finding the slow queries'),
    code(
      js(`
-- Enable once: shared_preload_libraries = 'pg_stat_statements'
create extension pg_stat_statements;

select
  round(mean_exec_time::numeric, 2) as avg_ms,
  calls,
  round(total_exec_time::numeric) as total_ms,
  left(query, 90) as query
from pg_stat_statements
order by total_exec_time desc
limit 20;
`),
    ),
    tip(
      'Sort by `total_exec_time`, not by `mean_exec_time`. A 2 ms query called two million times costs far more than a 900 ms report someone runs twice a day — and it is usually the one worth fixing.',
    ),
    code(
      js(`
-- Indexes nothing has ever used: candidates to drop.
select relname, indexrelname, idx_scan
from pg_stat_user_indexes
where idx_scan = 0
order by pg_relation_size(indexrelid) desc;

-- Tables taking sequential scans they should not.
select relname, seq_scan, seq_tup_read, idx_scan
from pg_stat_user_tables
order by seq_tup_read desc limit 10;
`),
    ),

    h('Guardrails'),
    code(
      js(`
// A statement timeout means a bad query fails instead of holding a connection.
const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  statement_timeout: 5_000,          // per query
  query_timeout: 5_000,              // client-side
  idle_in_transaction_session_timeout: 10_000,   // catches a forgotten commit
});
`),
    ),
    warn(
      '`idle_in_transaction_session_timeout` is the one people miss. A transaction left open — a missing `commit`, an await on something that never resolves — holds its locks and blocks vacuum indefinitely. The timeout turns a creeping outage into one failed request.',
    ),

    h('The order to look'),
    table(
      ['Step', 'Question'],
      [
        ['1', 'Is it one slow query, or a thousand fast ones? (Log the query count per request)'],
        ['2', 'What does `explain (analyze, buffers)` say? Look for `Seq Scan` and `Rows Removed`'],
        ['3', 'Would an index fix it? Equality columns first, then the sort'],
        ['4', 'Am I selecting columns and rows I do not need? `select` a list, and paginate'],
        ['5', 'Is it N+1? Join, batch, or `include`'],
        ['6', 'Is the pool exhausted rather than the database slow? Check queue time'],
        ['7', 'Only now: caching, read replicas, denormalisation'],
      ],
    ),
    tip(
      'Step 7 is last on purpose. A cache in front of an unindexed query hides the problem, adds an invalidation bug, and gives you two things to debug instead of one.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Speed up a `where` on one column', '`create index on t (col)`'],
      ['Speed up filter + sort', '`(equality_col, sort_col desc)`'],
      ['Index part of a table', 'A partial index with a `where`'],
      ['Add an index safely on a live table', '`create index concurrently`'],
      ['See what a query really does', '`explain (analyze, buffers)`'],
      ['Find the expensive queries', '`pg_stat_statements`, by `total_exec_time`'],
      ['Find unused indexes', '`pg_stat_user_indexes` where `idx_scan = 0`'],
      ['Fix N+1', 'A join, a batched `= any($1)`, or `include`'],
      ['Stop a runaway query', '`statement_timeout`'],
    ]),

    h('Interview'),
    asked([
      ['How do you know if a query uses an index?', '`explain (analyze, buffers)` — look for `Index Scan` rather than `Seq Scan`.'],
      ['What order do composite index columns go in?', 'Equality columns first, then the range or sort column — it is read left to right.'],
      ['What is the N+1 problem?', 'One query for a list plus one per row; fixed with a join, a batched lookup, or an ORM `include`.'],
      ['What does an index cost?', 'Write throughput, disk and cache — every write must maintain it.'],
      ['How do you find your slowest queries?', '`pg_stat_statements`, ordered by total execution time rather than mean.'],
      ['Why add an index `concurrently`?', 'A plain `create index` takes a write lock on the table for its whole duration.'],
      ['When would you add a cache?', 'After indexing, pagination and N+1 are dealt with — not instead of them.'],
    ]),

    links(
      link('PostgreSQL — Indexes', 'https://www.postgresql.org/docs/current/indexes.html'),
      link('PostgreSQL — Using EXPLAIN', 'https://www.postgresql.org/docs/current/using-explain.html'),
      link('pg_stat_statements', 'https://www.postgresql.org/docs/current/pgstatstatements.html'),
    ),
  ],
};
