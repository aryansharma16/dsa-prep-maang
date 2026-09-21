import { asked, code, diagram, h, links, p, quick, sql, table, tip, tradeoff, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'One system, many customers who must never see each other\'s data. The whole design is **where you put the isolation boundary** — and it is a straight trade between cost per tenant and blast radius.',
    ),

    h('Three models'),
    diagram(
      `
   SHARED              BRIDGE              SILOED
   one DB, tenant_id   one DB, a schema    a database per tenant
                       per tenant

   ┌──────────────┐    ┌──────────────┐    ┌────┐ ┌────┐ ┌────┐
   │ users        │    │ schema_acme  │    │ DB │ │ DB │ │ DB │
   │ ─ tenant 1   │    │ schema_globex│    │ A  │ │ B  │ │ C  │
   │ ─ tenant 2   │    │ schema_initech    └────┘ └────┘ └────┘
   │ ─ tenant 3   │    └──────────────┘
   └──────────────┘
                                          ✓ total isolation
   ✓ cheapest by far   ✓ middle ground     ✓ per-tenant restore
   ✓ one migration     ✓ per-tenant        ✓ data residency
   ✗ ONE BUG LEAKS       backup            ✗ N migrations
     EVERYTHING        ✗ hundreds of       ✗ expensive per tenant
   ✗ noisy neighbours    schemas is        ✗ huge operational
   ✗ no per-tenant       unwieldy            surface
     restore
`,
      'The same trade, three positions',
    ),
    table(
      ['', 'Shared', 'Schema-per-tenant', 'Database-per-tenant'],
      [
        ['Cost per tenant', '**Lowest**', 'Medium', '**Highest**'],
        ['Isolation', 'Logical only', 'Better', '**Physical**'],
        ['Blast radius of a bug', '**Everyone**', 'One tenant, mostly', '**One tenant**'],
        ['Noisy neighbours', 'Yes', 'Yes', 'No'],
        ['Per-tenant restore', '**Very hard**', 'Easy', '**Trivial**'],
        ['Migrations', 'One', 'N', 'N'],
        ['Data residency', 'Hard', 'Hard', '**Natural**'],
        ['Scales to', 'Millions of tenants', 'Hundreds', 'Tens to low hundreds'],
      ],
    ),
    tip(
      'Most SaaS runs a **hybrid**: shared tables for the long tail of small customers, dedicated databases for the largest few and anyone with a compliance requirement. That gets the cost profile of shared with the isolation of siloed where it is actually being paid for.',
    ),

    h('Making shared tenancy safe'),
    warn(
      'In a shared model, **one missing `WHERE tenant_id = ?` is a cross-tenant data leak** — the most serious bug class a SaaS has. It cannot be prevented by remembering, because the endpoint that forgets is the one nobody reviewed carefully.',
    ),
    table(
      ['Defence', 'How'],
      [
        ['**Row-level security**', 'The **database** enforces it. Even a forgotten clause returns nothing'],
        ['A tenant-scoped repository', 'The only way to query is through a layer that always scopes'],
        ['Tenant id in the connection context', 'Set once per request, read by RLS policies'],
        ['A composite primary key', '`(tenant_id, id)` — a cross-tenant id simply does not resolve'],
        ['Automated tests', 'Tenant A must never see tenant B, asserted per endpoint'],
        ['Non-guessable ids', 'So enumeration is not a starting point'],
      ],
    ),
    code(
      sql(`
-- Row-level security moves the check from every query to the
-- database itself. This is the difference between "we remember
-- to filter" and "it cannot return another tenant's rows".
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON documents
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- Set once per request, from the authenticated session.
SET app.tenant_id = '...';

-- A query that forgot its WHERE clause now returns this tenant's
-- rows rather than everyone's.
SELECT * FROM documents;
`),
    ),
    tip(
      'Row-level security is the single highest-value control in a shared-tenancy design. **It converts a whole bug class from a data breach into a returned-nothing** — and it is enforced below the application, so no code path can bypass it.',
    ),

    h('Noisy neighbours'),
    tradeoff([
      ['**Shared resources**', 'Cheap, and efficient at low utilisation', 'One tenant\'s heavy usage degrades everyone else'],
    ]),
    table(
      ['Control', 'What it limits'],
      [
        ['**Per-tenant rate limits**', 'Requests per second, per tenant'],
        ['**Query timeouts and cost limits**', 'One expensive report monopolising the database'],
        ['**Per-tenant quotas**', 'Storage, rows, API calls'],
        ['**Separate pools by tier**', 'Free tenants cannot starve paying ones'],
        ['**Shuffle sharding**', 'Each tenant gets a random subset of nodes, so no two share all of them'],
        ['**Isolate the largest**', 'Move a whale to dedicated infrastructure'],
      ],
    ),
    p(
      '**Shuffle sharding is the elegant one.** With eight nodes and two per tenant there are twenty-eight combinations, so one tenant overloading their two nodes affects only the small fraction that shares both — instead of everyone on a common pool.',
    ),

    h('Tenant-aware everything'),
    table(
      ['Layer', 'Must carry the tenant'],
      [
        ['Logs and traces', 'A `tenantId` field, so an incident can be scoped'],
        ['Metrics', 'Bounded — tier or a hashed bucket, **never the raw id** if you have many'],
        ['Caching', 'The tenant in the cache key. A shared key is a cross-tenant leak'],
        ['Background jobs', 'The tenant in the job payload; fairness across tenants in the queue'],
        ['Feature flags', 'Per tenant, for staged rollout'],
        ['Backups', 'Per-tenant restore, if you promised it'],
      ],
    ),
    warn(
      'A **cache key without the tenant** is the second most common cross-tenant leak after a missing `WHERE` clause — and it is worse, because it can serve one tenant\'s data to another with no database query involved at all.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'Serving many customers from one system without leaking between them'],
      ['Why it matters', 'It decides cost per tenant and the blast radius of a bug'],
      ['Use when', 'Any B2B or SaaS design'],
      ['Trade-off', 'Shared is cheap with a global blast radius; siloed is isolated and expensive'],
      [
        '30-second answer',
        '"Three positions on one trade. Shared tables with a tenant id are cheapest and one missing WHERE clause leaks everything — so enforce it with row-level security in the database, plus composite keys and tenant-scoped repositories. Database-per-tenant gives real isolation, per-tenant restore and data residency, at real operational cost. Most products do both: shared for the long tail, dedicated for large or regulated customers. Then per-tenant rate limits and quotas for noisy neighbours."',
      ],
    ]),
    asked([
      ['Shared database or one per tenant?', 'Shared for the long tail, dedicated for large or regulated customers. The trade is cost against blast radius.'],
      ['How do you prevent cross-tenant leaks?', 'Row-level security in the database, composite keys, a tenant-scoped repository, and tests asserting isolation.'],
      ['How do you stop one tenant degrading others?', 'Per-tenant rate limits, query timeouts, quotas, separate pools by tier, and shuffle sharding.'],
      ['Where is the leak people forget?', 'Cache keys. A key without the tenant serves one tenant\'s data to another with no query at all.'],
      ['What if a customer demands data residency?', 'That is a database-per-tenant, or at least per-region, requirement. It is not solvable in shared tables.'],
    ]),

    links(
      wiki('Multitenancy', 'Multitenancy'),
      wiki('Row-level_security', 'Row-level security'),
    ),
  ],
};
