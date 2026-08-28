import { asked, cheat, code, h, js, link, links, note, p, sh, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Prisma is a schema-first ORM: you declare your models in one file, it generates a typed client and the migrations, and you write queries as method calls. Its real value is the **type safety and the migration workflow**, not avoiding SQL — you will still drop to SQL, and it is designed to let you.',
    ),

    h('Setup'),
    code(
      sh(`
npm install prisma --save-dev
npm install @prisma/client
npx prisma init --datasource-provider postgresql
`),
    ),
    code(
      js(`
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String   @map("password_hash")
  role         Role     @default(USER)
  tasks        Task[]
  createdAt    DateTime @default(now()) @map("created_at")

  @@map("users")
}

model Task {
  id        String    @id @default(uuid())
  title     String
  done      Boolean   @default(false)
  dueAt     DateTime? @map("due_at")
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId    String    @map("user_id")
  createdAt DateTime  @default(now()) @map("created_at")

  @@index([userId, createdAt(sort: Desc)])
  @@map("tasks")
}

enum Role {
  USER
  ADMIN
}
`),
    ),
    tip(
      '`@map` and `@@map` keep `snake_case` in the database and `camelCase` in JavaScript — the same boundary the hand-written repository drew with a mapper function. Set it up from the first model; retrofitting it is a migration across every table.',
    ),

    h('Migrations'),
    code(
      sh(`
npx prisma migrate dev --name add_due_at   # dev: generate SQL, apply, regenerate
npx prisma migrate deploy                  # PRODUCTION: apply pending only
npx prisma migrate status                  # what has and has not been applied
npx prisma studio                          # a browser UI over your data
npx prisma db pull                         # generate a schema from an existing DB
`),
    ),
    warn(
      '`migrate dev` can **reset the database** when it detects drift — it will ask, but never point it at production. Deploys run `migrate deploy`, which only applies pending migrations and never resets anything.',
    ),
    note(
      'The generated SQL lands in `prisma/migrations/` and is meant to be read and edited. For anything sensitive — a concurrent index, a backfill, a column rename — generate with `--create-only`, edit the SQL, then apply.',
    ),

    h('The client'),
    code(
      js(`
// db/prisma.js — one instance, like the pool
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: config.isProd ? ['warn', 'error'] : ['query', 'warn', 'error'],
});
`),
    ),
    warn(
      'One `PrismaClient` per process. Each instance holds its own connection pool, so constructing one per request exhausts `max_connections` almost immediately. Under `--watch` or hot reload, cache it on `globalThis` in development so restarts do not stack instances up.',
    ),

    h('Queries'),
    code(
      js(`
// Read
await prisma.task.findUnique({ where: { id } });
await prisma.task.findFirst({ where: { userId, done: false } });
await prisma.task.findMany({
  where: {
    userId,
    done: false,
    title: { contains: 'ship', mode: 'insensitive' },
    createdAt: { gte: since },
    OR: [{ priority: 'high' }, { dueAt: { lt: new Date() } }],
  },
  orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  take: 20,
  select: { id: true, title: true, done: true },     // an explicit allowlist
});

// Write
await prisma.task.create({ data: { userId, title } });
await prisma.task.update({ where: { id }, data: { done: true } });
await prisma.task.upsert({ where: { id }, create: { … }, update: { … } });
await prisma.task.delete({ where: { id } });
await prisma.task.createMany({ data: rows, skipDuplicates: true });

// Aggregate
await prisma.task.count({ where: { userId, done: false } });
await prisma.task.groupBy({ by: ['status'], _count: true, where: { userId } });
`),
    ),
    tip(
      'Prefer `select` over the default "every field". It is an allowlist — so a `passwordHash` added to the model later cannot silently start appearing in an API response, which is exactly the leak the hand-written mapper was preventing.',
    ),

    h('Relations and N+1'),
    code(
      js(`
// The N+1: 1 query for the tasks, then 1 per task for its user.
const tasks = await prisma.task.findMany({ take: 50 });
for (const t of tasks) {
  t.user = await prisma.user.findUnique({ where: { id: t.userId } });   // 50 more
}

// include: Prisma batches this into a second query for all 50 users.
const tasks2 = await prisma.task.findMany({
  take: 50,
  include: { user: { select: { id: true, email: true } } },
});
`),
    ),
    note(
      'Prisma resolves `include` with a small fixed number of queries, not one per row, and its `relationJoins` preview feature turns them into real SQL joins. `include` is the fix for N+1 here — the equivalent of a `JOIN` in the hand-written repository.',
    ),

    h('Transactions'),
    code(
      js(`
// Sequential: all succeed or all roll back. No logic between them.
await prisma.$transaction([
  prisma.task.create({ data: { userId, title } }),
  prisma.auditLog.create({ data: { userId, action: 'task.created' } }),
]);

// Interactive: logic between statements. tx is the transactional client.
await prisma.$transaction(async (tx) => {
  const item = await tx.item.findUnique({ where: { id } });
  if (item.stock < 1) throw new ConflictError('Out of stock');
  await tx.item.update({ where: { id }, data: { stock: { decrement: 1 } } });
  await tx.order.create({ data: { userId, itemId: id } });
}, { isolationLevel: 'Serializable', timeout: 5000 });
`),
    ),
    warn(
      'That first example still has the lost-update problem from the `transactions` topic — a transaction is not a lock. The `{ decrement: 1 }` atomic update, `Serializable`, or a version column are what actually make it safe. An ORM changes none of that.',
    ),

    h('Dropping to SQL'),
    code(
      js(`
// Parameterised — this is a tagged template, NOT string interpolation.
const rows = await prisma.$queryRaw\`
  select status, count(*) as n
  from tasks
  where user_id = \${userId}::uuid
  group by status
\`;

await prisma.$executeRaw\`
  update tasks set done = true where user_id = \${userId}::uuid
\`;
`),
    ),
    warn(
      '`$queryRawUnsafe` takes a plain string and **is** injectable. The tagged-template forms are safe — Prisma turns the interpolations into placeholders. Never reach for the `Unsafe` variants with anything a client supplied.',
    ),
    p(
      'Window functions, recursive CTEs, `for update skip locked` and complex reporting queries are all things you write in SQL. That is normal, and expected — an ORM is for the 90% of queries that are shaped like CRUD.',
    ),

    h('Prisma or plain SQL'),
    table(
      ['Prisma', 'pg + SQL'],
      [
        ['Types generated from the schema, end to end', 'You write the types, or go without'],
        ['Migrations generated and tracked for you', 'You write and order the migration files'],
        ['CRUD and relations are terse', 'Every query is explicit and visible'],
        ['A layer to debug when a query is slow', 'The query you see is the query that runs'],
        ['`prisma studio` for browsing data', '`psql`'],
        ['Another dependency and a generate step', 'One small driver'],
      ],
    ),
    tip(
      'Both are reasonable. Prisma pays off fastest on a TypeScript team with a lot of ordinary CRUD; plain `pg` pays off when queries are the interesting part of the system. What is not reasonable is using an ORM to avoid learning SQL — you will need it the first time something is slow.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Define the schema', '`schema.prisma`, one model per table'],
      ['Keep snake_case in the DB', '`@map` and `@@map`'],
      ['Create a migration', '`prisma migrate dev --name x`'],
      ['Deploy migrations', '`prisma migrate deploy` — never `dev`'],
      ['Avoid N+1', '`include`, not a loop of `findUnique`'],
      ['Avoid leaking fields', '`select` an explicit list'],
      ['Run a transaction with logic', '`$transaction(async tx => …)`'],
      ['Write real SQL', '`$queryRaw` — the tagged template, never `Unsafe`'],
      ['One client per process', 'Export a single `PrismaClient`'],
    ]),

    h('Interview'),
    asked([
      ['What does Prisma give you over `pg`?', 'A single schema source, generated types, and a managed migration workflow.'],
      ['`migrate dev` vs `migrate deploy`?', '`dev` generates and may reset in development; `deploy` only applies pending migrations and is what production runs.'],
      ['How do you avoid N+1 in Prisma?', '`include` or `select` on the relation, instead of querying per row.'],
      ['Is `$queryRaw` safe?', 'The tagged-template form is — interpolations become placeholders. `$queryRawUnsafe` is not.'],
      ['Why only one `PrismaClient`?', 'Each carries its own pool; per-request instances exhaust the database\'s connection limit.'],
      ['Does an ORM solve concurrency?', 'No — lost updates need an atomic update, a lock, a version column or serializable isolation regardless.'],
    ]),

    links(
      link('Prisma docs', 'https://www.prisma.io/docs'),
      link('Prisma — Migrations', 'https://www.prisma.io/docs/orm/prisma-migrate'),
      link('Prisma — Raw queries', 'https://www.prisma.io/docs/orm/prisma-client/using-raw-sql'),
    ),
  ],
};
