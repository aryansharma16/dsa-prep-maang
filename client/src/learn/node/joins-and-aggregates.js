import { asked, cheat, code, h, js, link, links, note, p, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'A join combines rows from two tables; an aggregate collapses many rows into one. Between them they cover most of what an API asks a database for — and doing this work in SQL rather than in JavaScript is usually the single largest performance difference available to you.',
    ),

    h('The joins'),
    table(
      ['Join', 'Keeps'],
      [
        ['`inner join`', 'Only rows with a match on both sides'],
        ['`left join`', 'Every left row; right columns are `NULL` when unmatched'],
        ['`right join`', 'The mirror image. Rare — swap the tables and use `left`'],
        ['`full join`', 'Everything from both sides'],
        ['`cross join`', 'Every combination. Usually a bug when it appears by accident'],
      ],
    ),
    code(
      js(`
-- Tasks with their assignee's name. Unassigned tasks are dropped.
select t.id, t.title, u.name as assignee
from tasks t
inner join users u on u.id = t.assignee_id;

-- Every task, assignee name null when there is none.
select t.id, t.title, u.name as assignee
from tasks t
left join users u on u.id = t.assignee_id;
`),
    ),
    warn(
      'Putting a condition on the **right** table in the `WHERE` clause of a `LEFT JOIN` turns it back into an inner join — the `NULL` rows fail the test and disappear. Conditions on the joined table belong in the `ON` clause.',
    ),
    code(
      js(`
-- Silently an inner join: unassigned tasks have u.active = null, which is not true.
select … from tasks t left join users u on u.id = t.assignee_id
where u.active = true;

-- Correct: the filter is part of the join.
select … from tasks t left join users u on u.id = t.assignee_id and u.active = true;
`),
    ),

    h('Aggregates'),
    code(
      js(`
select
  count(*)                       as total,
  count(due_at)                  as with_due_date,   -- ignores NULLs
  count(*) filter (where done)   as completed,       -- Postgres, and clearer
  avg(extract(epoch from (completed_at - created_at))) as avg_seconds,
  min(created_at)                as first,
  max(created_at)                as latest
from tasks
where user_id = $1;
`),
    ),
    tip(
      '`count(*) filter (where done)` replaces the `sum(case when done then 1 else 0 end)` idiom. It reads as what it is, and it lets you compute a dozen different conditional counts in one pass over the table.',
    ),

    h('GROUP BY and HAVING'),
    code(
      js(`
select
  u.id,
  u.name,
  count(t.id)                     as task_count,
  count(*) filter (where t.done)  as done_count
from users u
left join tasks t on t.user_id = u.id
group by u.id, u.name              -- every non-aggregated column
having count(t.id) > 5
order by task_count desc;
`),
    ),
    table(
      ['Clause', 'Filters', 'Runs'],
      [
        ['`where`', 'Individual rows', '**Before** grouping — so it cannot use an aggregate'],
        ['`having`', 'Groups', '**After** grouping — so it can'],
      ],
    ),
    note(
      'Order of evaluation: `FROM` → `WHERE` → `GROUP BY` → `HAVING` → `SELECT` → `ORDER BY` → `LIMIT`. That is why you cannot use a `SELECT` alias in `WHERE` but can in `ORDER BY`, and why filtering in `WHERE` is faster than in `HAVING` when both are possible.',
    ),

    h('Subqueries'),
    code(
      js(`
-- Scalar: one value, per row.
select t.*, (select count(*) from comments c where c.task_id = t.id) as comments
from tasks t;

-- IN: a set.
select * from tasks where user_id in (select id from users where role = 'admin');

-- EXISTS: usually faster than IN, and correct with NULLs.
select * from users u
where exists (select 1 from tasks t where t.user_id = u.id and not t.done);

-- Lateral: a per-row subquery that can reference the outer row. This is how
-- you get "the 3 most recent tasks per user" in one query.
select u.name, recent.title
from users u
cross join lateral (
  select title from tasks where user_id = u.id order by created_at desc limit 3
) recent;
`),
    ),
    warn(
      '`not in (subquery)` returns **no rows** if the subquery yields a single `NULL`, because `x <> NULL` is unknown for every row. `not exists` does not have this problem. Prefer `not exists`.',
    ),

    h('CTEs'),
    code(
      js(`
with recent as (
  select * from tasks where created_at > now() - interval '30 days'
),
per_user as (
  select user_id, count(*) as n, count(*) filter (where done) as done
  from recent
  group by user_id
)
select u.name, p.n, p.done, round(100.0 * p.done / p.n, 1) as pct
from per_user p
join users u on u.id = p.user_id
where p.n >= 5
order by pct desc;
`),
    ),
    p(
      'A CTE is a named subquery. Its value is readability: a three-step query written as three named steps is one a colleague can review. Since Postgres 12 they are inlined by default, so there is normally no performance cost — `materialized` and `not materialized` let you force either behaviour.',
    ),
    code(
      js(`
-- Recursive: walk a tree of subtasks.
with recursive subtree as (
  select id, parent_id, title, 1 as depth from tasks where id = $1
  union all
  select t.id, t.parent_id, t.title, s.depth + 1
  from tasks t join subtree s on t.parent_id = s.id
  where s.depth < 10                      -- always bound the recursion
)
select * from subtree;
`),
    ),

    h('Window functions'),
    p(
      'The tool for "rank within a group", "compare to the previous row", "running total" — anything that needs the aggregate **and** the individual rows. `GROUP BY` collapses; a window does not.',
    ),
    code(
      js(`
select
  title,
  user_id,
  created_at,
  row_number() over (partition by user_id order by created_at desc) as recency,
  count(*)     over (partition by user_id)                          as user_total,
  lag(created_at) over (partition by user_id order by created_at)   as previous,
  sum(points)  over (partition by user_id order by created_at
                     rows between unbounded preceding and current row) as running
from tasks;
`),
    ),
    table(
      ['Function', 'Gives'],
      [
        ['`row_number()`', 'A unique 1, 2, 3 within the partition'],
        ['`rank()` / `dense_rank()`', 'Ranking, with ties sharing a number (gaps / no gaps)'],
        ['`lag()` / `lead()`', 'A value from the previous or next row'],
        ['`sum()` / `avg()` over', 'A running or partition-wide total, kept alongside each row'],
        ['`ntile(4)`', 'Quartile buckets'],
        ['`first_value()` / `last_value()`', 'The edge of the window'],
      ],
    ),
    code(
      js(`
-- The classic: the most recent task per user, in one pass.
select * from (
  select t.*, row_number() over (partition by user_id order by created_at desc) as rn
  from tasks t
) ranked
where rn = 1;
`),
    ),
    warn(
      'A window function cannot appear in `WHERE` — windows are evaluated after filtering. Wrap the query in a subquery or a CTE and filter on the result, as above.',
    ),

    h('Doing it in SQL, not JavaScript'),
    code(
      js(`
// 200 ms, 50,000 rows over the wire, and it blocks the event loop.
const rows = await pool.query('select * from tasks where user_id = $1', [id]);
const done = rows.rows.filter(r => r.done).length;
const byStatus = Object.groupBy(rows.rows, r => r.status);

// 3 ms, one row over the wire, and the loop is free.
const { rows: [stats] } = await pool.query(
  \`select count(*) as total,
          count(*) filter (where done) as done,
          count(*) filter (where status = 'open') as open
   from tasks where user_id = $1\`,
  [id],
);
`),
    ),
    tip(
      'The rule of thumb: **filter, sort, group and aggregate in the database; format in JavaScript.** The database has indexes, statistics and a query planner; your process has one thread.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Combine two tables', '`inner join` — or `left join` to keep unmatched rows'],
      ['Filter a joined table without dropping rows', 'The condition goes in `ON`, not `WHERE`'],
      ['Count conditionally', '`count(*) filter (where …)`'],
      ['Filter on an aggregate', '`having`'],
      ['Check for existence', '`exists` — and `not exists`, never `not in`'],
      ['Name the steps of a complex query', 'A CTE'],
      ['Rank within a group', '`row_number() over (partition by … order by …)`'],
      ['Compare to the previous row', '`lag()`'],
      ['Top N per group', '`row_number()` in a subquery, filtered outside'],
    ]),

    h('Interview'),
    asked([
      ['`inner join` vs `left join`?', 'Inner keeps only matched rows; left keeps every left row with nulls where there is no match.'],
      ['Why did my `left join` behave like an inner join?', 'A `WHERE` condition on the right table filtered out the null rows — it belongs in `ON`.'],
      ['`where` vs `having`?', '`where` filters rows before grouping; `having` filters groups after.'],
      ['When do you need a window function?', 'When you need per-row detail *and* an aggregate — ranking, running totals, row comparisons.'],
      ['`in` vs `exists`?', '`exists` short-circuits and handles NULLs correctly; `not in` returns nothing if the subquery contains a NULL.'],
      ['How do you get the latest row per group?', '`row_number() over (partition by … order by … desc)` in a subquery, filtered to `rn = 1`.'],
    ]),

    links(
      link('PostgreSQL — Joins', 'https://www.postgresql.org/docs/current/tutorial-join.html'),
      link('PostgreSQL — Window functions', 'https://www.postgresql.org/docs/current/tutorial-window.html'),
      link('PostgreSQL — WITH queries (CTEs)', 'https://www.postgresql.org/docs/current/queries-with.html'),
    ),
  ],
};
