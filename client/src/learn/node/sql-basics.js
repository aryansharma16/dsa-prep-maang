import { asked, cheat, code, h, js, link, links, note, p, sh, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'A relational database stores rows in tables with a declared shape, and enforces rules about that shape itself. That last part is the reason to use one: constraints are the only guarantee in your system that no application bug, no forgotten code path and no manual `UPDATE` can violate.',
    ),

    h('Getting one running'),
    code(
      sh(`
docker run --name pg -e POSTGRES_PASSWORD=dev -p 5432:5432 -d postgres:17

psql postgres://postgres:dev@localhost:5432/postgres
# \\l          list databases
# \\c tasks    connect to one
# \\dt         list tables
# \\d tasks    describe a table
# \\q          quit
`),
    ),

    h('Creating a table'),
    code(
      js(`
create table users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  password_hash text not null,
  role          text not null default 'user'
                  check (role in ('user', 'admin')),
  created_at    timestamptz not null default now()
);

create table tasks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  title       text not null check (length(trim(title)) > 0),
  done        boolean not null default false,
  due_at      timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index tasks_user_created_idx on tasks (user_id, created_at desc);
`),
    ),
    table(
      ['Type', 'Use for'],
      [
        ['`text`', 'Any string. **Not** `varchar(n)` — in Postgres there is no performance difference, and the length belongs in a `check`'],
        ['`uuid`', 'Ids, when you do not want them guessable or sequential'],
        ['`bigint` / `bigserial`', 'Ids, when sortable and compact matters more'],
        ['`timestamptz`', '**Always** for time. Never `timestamp` — see below'],
        ['`numeric(12,2)`', 'Money. Never `float` or `double precision`'],
        ['`jsonb`', 'Genuinely schemaless data. Indexable, unlike `json`'],
        ['`boolean`', 'A flag — not `smallint`'],
      ],
    ),
    warn(
      '`timestamp` without `tz` stores a wall-clock reading with no zone, so the same value means different instants depending on who reads it. `timestamptz` stores an absolute instant and renders in the session zone. There is no case in an application where the first is what you want.',
    ),

    h('The constraints'),
    table(
      ['Constraint', 'Guarantees'],
      [
        ['`primary key`', 'Unique and not null. One per table. Indexed automatically'],
        ['`unique`', 'No duplicates. Also creates an index'],
        ['`not null`', 'The column always has a value'],
        ['`references`', 'The value exists in the other table — **referential integrity**'],
        ['`check`', 'Any boolean rule about the row'],
        ['`default`', 'A value when none is supplied'],
      ],
    ),
    tip(
      'Put every rule you can in the database. Application validation catches mistakes early and gives good error messages; a constraint makes the bad state *impossible* — including from a migration script, a psql session at 2am, or a second service you did not write.',
    ),
    code(
      js(`
// Postgres raises 23505 on a unique violation and 23503 on a foreign key one,
// which your error handler maps to 409 and 422. The database is doing the work.
if (err.code === '23505') throw new ConflictError('Email already registered');
`),
    ),

    h('Foreign keys and deletes'),
    code(
      js(`
user_id uuid not null references users(id) on delete cascade
user_id uuid     references users(id) on delete set null
user_id uuid not null references users(id) on delete restrict   -- the default
`),
    ),
    table(
      ['On delete', 'When the parent goes'],
      [
        ['`restrict` / `no action`', 'The delete fails while children exist. **The safe default**'],
        ['`cascade`', 'Children are deleted too. Right for owned data — a user\'s tasks'],
        ['`set null`', 'The reference is cleared. Right for optional links — an unassigned task'],
      ],
    ),
    warn(
      '`cascade` is convenient and unforgiving. Deleting one user can silently remove a million rows across a dozen tables, in one transaction, with no confirmation. For anything a human might delete by mistake, prefer a soft delete — a `deleted_at` column — and keep `cascade` for genuinely owned children.',
    ),

    h('The four statements'),
    code(
      js(`
-- read
select id, title, done from tasks
where user_id = $1 and done = false
order by created_at desc
limit 20;

-- create, returning what the database generated
insert into tasks (user_id, title) values ($1, $2)
returning *;

-- update. The WHERE is not optional.
update tasks set done = $2, updated_at = now()
where id = $1 and user_id = $3
returning *;

-- delete
delete from tasks where id = $1 and user_id = $2;
`),
    ),
    tip(
      '`returning *` is a Postgres feature worth building a habit around: one round trip gives you the generated id, the defaults and the trigger results, instead of an insert followed by a select.',
    ),
    warn(
      'The `and user_id = $3` on the update is not redundant. Without it, anyone who can guess an id can modify anyone\'s row — the same IDOR hole as a missing ownership check in the service, moved into SQL. Scoping the write by owner makes it structurally impossible.',
    ),

    h('Upsert'),
    code(
      js(`
insert into settings (user_id, theme)
values ($1, $2)
on conflict (user_id)
do update set theme = excluded.theme, updated_at = now()
returning *;

-- "insert if absent, otherwise do nothing" — the idempotency primitive
insert into idempotency_keys (key) values ($1)
on conflict (key) do nothing
returning key;
`),
    ),
    note(
      '`excluded` is the row that *would* have been inserted. `on conflict` needs a unique index on the conflict target — that is what makes the operation atomic, and why it works correctly under concurrency where select-then-insert does not.',
    ),

    h('NULL'),
    code(
      js(`
select * from tasks where due_at = null;      -- returns NOTHING, ever
select * from tasks where due_at is null;     -- correct

null = null       -- null, not true
null <> 'a'       -- null, not true
count(due_at)     -- counts non-null values only
count(*)          -- counts rows

coalesce(due_at, created_at)    -- first non-null
`),
    ),
    warn(
      '`NULL` means unknown, so any comparison with it is unknown — which is not true, so the row is filtered out. `= null` returning zero rows with no error is one of SQL\'s sharpest edges.',
    ),

    h('Migrations'),
    p(
      'Never change a schema by hand. Every change is a file, committed, applied in order, in every environment.',
    ),
    code(
      sh(`
migrations/
  0001_create_users.sql
  0002_create_tasks.sql
  0003_add_tasks_due_at.sql
`),
    ),
    code(
      js(`
-- 0003_add_tasks_due_at.sql
alter table tasks add column due_at timestamptz;
create index concurrently tasks_due_at_idx on tasks (due_at) where due_at is not null;
`),
    ),
    table(
      ['Safe on a live table', 'Locks or rewrites'],
      [
        ['`add column` (nullable, or with a default on PG 11+)', '`add column not null` with no default'],
        ['`create index concurrently`', '`create index` — takes a write lock'],
        ['`drop column`', 'Changing a column type — rewrites the whole table'],
        ['Adding a `check … not valid`, then `validate`', 'Adding a validated `check` in one step'],
      ],
    ),
    tip(
      'Deploy schema changes and code changes as separate steps, in a compatible order: add the column, deploy code that writes both old and new, backfill, deploy code that reads the new one, then drop the old. A migration and a deploy in one atomic step is a rollback you cannot perform.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Store a string', '`text` with a `check` on length'],
      ['Store a time', '`timestamptz`, always'],
      ['Store money', '`numeric(12,2)`, or an integer minor unit'],
      ['Generate an id', '`uuid primary key default gen_random_uuid()`'],
      ['Guarantee a rule', 'A `check` or `unique` constraint, not just application code'],
      ['Get the inserted row back', '`returning *`'],
      ['Insert or update', '`on conflict … do update`'],
      ['Test for absence', '`is null`, never `= null`'],
      ['Change the schema', 'A numbered migration file, applied in order'],
    ]),

    h('Interview'),
    asked([
      ['Primary key vs unique constraint?', 'A primary key is the row\'s identity — one per table, never null; unique constraints just forbid duplicates and may be nullable.'],
      ['Why `timestamptz` over `timestamp`?', '`timestamptz` stores an absolute instant; `timestamp` stores a zoneless reading that means different things to different readers.'],
      ['What does `on delete cascade` do?', 'Deletes the child rows with the parent — powerful and easy to trigger accidentally.'],
      ['Why not store money as a float?', 'Binary floats cannot represent decimal fractions exactly, so totals drift.'],
      ['Why does `where x = null` return nothing?', '`NULL` is unknown; comparing to it yields unknown, which is not true.'],
      ['How do you handle schema changes safely?', 'Versioned migration files, expand-then-contract across deploys, and `create index concurrently` on live tables.'],
    ]),

    links(
      link('PostgreSQL — Data types', 'https://www.postgresql.org/docs/current/datatype.html'),
      link('PostgreSQL — Constraints', 'https://www.postgresql.org/docs/current/ddl-constraints.html'),
      link('PostgreSQL — INSERT ... ON CONFLICT', 'https://www.postgresql.org/docs/current/sql-insert.html#SQL-ON-CONFLICT'),
    ),
  ],
};
