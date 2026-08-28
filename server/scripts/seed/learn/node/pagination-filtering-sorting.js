import { asked, cheat, code, h, js, link, links, note, p, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Every collection endpoint needs a page size limit from the first day, because "there are only fifty rows" stops being true without warning. The interesting part is *how* you page: the obvious approach has a correctness bug that only appears once the data is changing underneath you.',
    ),

    h('Offset pagination'),
    code(
      js(`
// GET /tasks?page=2&perPage=20
const page = Math.max(1, Number(req.query.page) || 1);
const perPage = Math.min(100, Math.max(1, Number(req.query.perPage) || 20));

const { rows } = await pool.query(
  \`select * from tasks
   where user_id = $1
   order by created_at desc, id desc
   limit $2 offset $3\`,
  [userId, perPage, (page - 1) * perPage],
);
`),
    ),
    code(
      js(`
{ "data": [...], "meta": { "page": 2, "perPage": 20, "total": 143, "totalPages": 8 } }
`),
    ),
    table(
      ['Good', 'Bad'],
      [
        ['Jump to any page — needed for a numbered pager', 'Rows shift when data changes underneath'],
        ['Easy to implement and to explain', '`OFFSET 100000` makes the database scan and discard 100,000 rows'],
        ['Total count is available', 'A `COUNT(*)` on a large table is itself slow'],
      ],
    ),

    h('The skipped row'),
    p(
      'The correctness bug. Page 1 returns rows 1–20. Before the client asks for page 2, someone inserts a row that sorts to the top. Everything shifts down by one — so the old row 20 is now row 21, and page 2 starts at row 21. **The client sees it twice and never sees the new row 41.**',
    ),
    code(
      js(`
// t=0   page 1: [A B C D E]           offset 0 limit 5
// t=1   someone inserts Z at the top
// t=2   page 2: [E F G H I]           offset 5 limit 5
//                ^ E again, and one row further down is skipped forever
`),
    ),
    warn(
      'This is not a rare race. On any feed ordered by newest-first with regular writes, it happens constantly — and it is why an "export everything by paging through" script silently misses rows.',
    ),

    h('Cursor pagination'),
    p(
      'Page by *where you got to*, not by how many you skipped. The cursor encodes the sort key of the last row you saw, so inserts above it change nothing.',
    ),
    code(
      js(`
// GET /tasks?limit=20&cursor=eyJjIjoiMjAyNi0wOC0yNFQxNDozMDowMFoiLCJpIjoiN2EifQ

const decode = (c) => JSON.parse(Buffer.from(c, 'base64url').toString());
const encode = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

const limit = Math.min(100, Number(req.query.limit) || 20);
const after = req.query.cursor ? decode(req.query.cursor) : null;

const { rows } = await pool.query(
  \`select * from tasks
   where user_id = $1
     and ($2::timestamptz is null or (created_at, id) < ($2, $3))
   order by created_at desc, id desc
   limit $4\`,
  [userId, after?.c ?? null, after?.i ?? null, limit + 1],   // +1 to peek ahead
);

const hasMore = rows.length > limit;
const data = hasMore ? rows.slice(0, limit) : rows;
const last = data.at(-1);

res.json({
  data: data.map(toTask),
  meta: {
    hasMore,
    nextCursor: hasMore ? encode({ c: last.created_at, i: last.id }) : null,
  },
});
`),
    ),
    p('Three details in there that are easy to get wrong:'),
    table(
      ['Detail', 'Why'],
      [
        ['`(created_at, id) < ($2, $3)`', 'A **row comparison**. Comparing only `created_at` skips or repeats rows that share a timestamp.'],
        ['`id` in the `ORDER BY`', 'The sort must be **total**. Ties in `created_at` otherwise order arbitrarily and the cursor cannot resume reliably.'],
        ['`limit + 1`', 'Fetching one extra row tells you `hasMore` without a second `COUNT` query.'],
      ],
    ),
    tip(
      'That row-comparison syntax — `(a, b) < (x, y)` — is standard SQL and uses a composite index on `(created_at, id)` directly. Rewriting it as `a < x OR (a = x AND b < y)` is equivalent but usually plans worse.',
    ),
    warn(
      'A cursor is an opaque token, not an API. Base64 makes it *look* opaque; it is not encrypted, so never put anything in it a client should not see, and always validate what comes back out — a client can craft one.',
    ),

    h('Choosing'),
    table(
      ['Use offset when', 'Use cursor when'],
      [
        ['An admin table with numbered pages', 'An infinite-scroll feed'],
        ['Small, slow-changing data', 'Large or fast-changing data'],
        ['Users need "jump to page 7"', 'Users only go forwards'],
        ['A total count is required', 'Exporting or syncing everything'],
      ],
    ),
    note(
      'Plenty of APIs offer both: offset for the UI table, cursor for the export endpoint. What you should not do is offer offset only and then build a sync client on it.',
    ),

    h('Filtering safely'),
    code(
      js(`
// NEVER build SQL from query keys. This is injection AND a column leak.
const where = Object.entries(req.query)
  .map(([k, v]) => \`\${k} = '\${v}'\`).join(' and ');    // catastrophic

// An allowlist, with placeholders.
const FILTERS = {
  status: (v) => ['status = $', v],
  assigneeId: (v) => ['assignee_id = $', v],
  createdAfter: (v) => ['created_at >= $', v],
};

const clauses = ['user_id = $1'];
const params = [userId];

for (const [key, raw] of Object.entries(req.query)) {
  const build = FILTERS[key];
  if (!build) continue;                       // unknown filters are ignored
  const [fragment, value] = build(raw);
  params.push(value);
  clauses.push(fragment + params.length);     // $2, $3, …
}

const sql = \`select * from tasks where \${clauses.join(' and ')}\`;
`),
    ),

    h('Sorting safely'),
    code(
      js(`
// A column name cannot be a placeholder, so it MUST come from an allowlist.
const SORTABLE = {
  createdAt: 'created_at',
  title: 'title',
  dueAt: 'due_at',
};

const [field, dir = 'asc'] = String(req.query.sort ?? 'createdAt').split(':');
const column = SORTABLE[field];
if (!column) throw new ValidationError(\`Cannot sort by \${field}\`);
const direction = dir.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

const sql = \`select * from tasks order by \${column} \${direction}, id DESC\`;
`),
    ),
    warn(
      'The `ORDER BY` clause is the one place a parameterised query cannot protect you, because a placeholder can hold a value but not an identifier. Every sortable column must come from a map you wrote. And note the `, id DESC` — without a tiebreaker the order is not stable, which breaks pagination in both styles.',
    ),

    h('Searching'),
    code(
      js(`
// Small tables: a trigram index makes ILIKE fast enough.
// create extension pg_trgm;
// create index tasks_title_trgm on tasks using gin (title gin_trgm_ops);
where title ilike '%' || $1 || '%'

// Larger, or when relevance matters: full text search.
// alter table tasks add column search tsvector generated always as
//   (to_tsvector('english', title || ' ' || coalesce(body, ''))) stored;
// create index tasks_search on tasks using gin (search);
where search @@ websearch_to_tsquery('english', $1)
order by ts_rank(search, websearch_to_tsquery('english', $1)) desc
`),
    ),
    tip(
      'Reach for Elasticsearch or Meilisearch when you need typo tolerance, faceting or relevance tuning — not before. Postgres full-text search covers a surprising amount and costs you no extra system to operate, back up and keep in sync.',
    ),

    h('Validating it all'),
    code(
      js(`
export const listTasksQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().base64url().optional(),
  status: z.enum(['open', 'done', 'archived']).optional(),
  sort: z.enum(['createdAt', 'title', 'dueAt']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  q: z.string().trim().min(1).max(100).optional(),
});

router.get('/', validate(listTasksQuery, 'query'), controller.list);
`),
    ),
    note(
      'A schema over the query string does the allowlisting for you: `sort` can only be one of three values because the enum says so, and `limit` is capped before it reaches any SQL.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Page an admin table', 'Offset — `limit`/`offset` + a total'],
      ['Page a feed or an export', 'Cursor — a row comparison on the sort key'],
      ['Know if there is more', 'Fetch `limit + 1`'],
      ['Make pagination stable', 'A total sort — always add `, id` as a tiebreaker'],
      ['Cap the page size', 'A `max` in the schema, enforced server-side'],
      ['Filter safely', 'An allowlist plus placeholders'],
      ['Sort safely', 'A column-name map — placeholders cannot help here'],
      ['Search text', '`pg_trgm` for small, `tsvector` for large'],
    ]),

    h('Interview'),
    asked([
      ['Offset vs cursor pagination?', 'Offset allows page jumps but shifts under concurrent writes and degrades at large offsets; cursor is stable and fast but forward-only.'],
      ['Why does page 2 repeat a row from page 1?', 'A row was inserted above the window, shifting everything down by one.'],
      ['Why is `OFFSET 100000` slow?', 'The database still produces and discards all 100,000 preceding rows.'],
      ['What must a cursor encode?', 'The full sort key of the last row — including a unique tiebreaker.'],
      ['How do you make sorting safe?', 'An allowlist of column names; a placeholder cannot substitute an identifier.'],
      ['How do you know whether there is a next page?', 'Request one more row than the page size.'],
    ]),

    links(
      link('Postgres — LIMIT and OFFSET', 'https://www.postgresql.org/docs/current/queries-limit.html'),
      link('Postgres — Full text search', 'https://www.postgresql.org/docs/current/textsearch.html'),
      link('Row-wise comparison', 'https://www.postgresql.org/docs/current/functions-comparisons.html#ROW-WISE-COMPARISON'),
    ),
  ],
};
