import {
  asked,
  cheat,
  code,
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

export const doc = {
  blocks: [
    p(
      'An **index** is a separate data structure that lets the database find rows without reading all of them. It is the single biggest lever on query performance, and it is not free: every index makes writes slower and takes disk. The skill is knowing which ones to create and, just as importantly, which not to.',
    ),

    h('The analogy that is actually accurate'),
    p(
      'A book\'s index is a sorted list of terms, each with page numbers. To find "normalisation" you binary-search the index — a few page turns — then jump. Without it you read the book. A database index is the same thing: a **sorted structure over one or more columns**, with pointers back to the rows.',
    ),
    p(
      'And it has the same costs. The index takes pages of its own, and every edit to the book means editing the index too.',
    ),

    h('The B+ tree'),
    p(
      'Nearly every index you meet is a **B+ tree**, and one property explains everything it is good at:',
    ),
    ul(
      '**Balanced.** Every leaf is the same distance from the root, so *every* lookup costs the same — no pathological cases.',
      '**High fan-out.** A node is a disk page, typically 8 or 16 KB, holding hundreds of keys. Depth grows like `log₂₀₀ n` rather than `log₂ n`.',
      '**Data only in the leaves**, and **the leaves are linked**. That last detail is what makes range scans fast: find the start, then walk sideways.',
    ),
    table(
      ['rows', 'tree depth', 'page reads to find one row'],
      [
        ['100', '1', '**1**'],
        ['40,000', '2', '**2**'],
        ['8,000,000', '3', '**3**'],
        ['1,600,000,000', '4', '**4**'],
      ],
    ),
    tip(
      'That table is the answer to "how does an index actually make it faster", and it is worth quoting numbers. A billion-row table is **four page reads** away from any row by primary key — and the top two levels are always in memory, so it is realistically one or two disk reads. The scan alternative is a billion rows. This is also why "add an index" fixes so much: you are not making the query 10% faster, you are changing its complexity class from `O(n)` to `O(log n)`.',
    ),
    p(
      'The linked leaves matter as much as the depth. `WHERE salary BETWEEN 70000 AND 90000` finds 70,000 in three page reads, then walks the leaf chain until it passes 90,000 — no re-descending the tree per row. A hash index cannot do this at all.',
    ),

    h('Clustered and non-clustered'),
    table(
      ['', 'Clustered', 'Non-clustered (secondary)'],
      [
        ['Is', '**The table itself**, stored in key order', 'A separate structure pointing back'],
        ['How many', '**One** per table — data has one physical order', 'As many as you like'],
        ['Leaf holds', 'The whole row', 'The indexed columns + a pointer to the row'],
        ['Lookup by it', 'One traversal, and you have the row', 'Two — find the pointer, then fetch the row'],
        ['In InnoDB', 'The primary key, always', 'Everything else'],
        ['In PostgreSQL', '**None.** The heap is unordered', 'All indexes are secondary'],
      ],
    ),
    warn(
      'In InnoDB a secondary index leaf stores the **primary key**, not a physical address — so every secondary lookup is a traversal of the secondary index followed by a traversal of the clustered one. Two consequences follow, and both are practical: a **large primary key makes every secondary index larger**, because it is copied into all of them; and a **random primary key** like a UUID v4 makes inserts scatter across the whole tree instead of appending at the end, fragmenting pages. Prefer a small, monotonically increasing primary key — or UUID v7, which is time-ordered.',
    ),
    note(
      'PostgreSQL has no clustered index. Every index is secondary, pointing into an unordered heap, which is why the `CLUSTER` command exists — it physically reorders the table once, and the ordering decays as rows are updated. This is a genuine architectural difference between the two engines and a good thing to be able to name.',
    ),

    h('Creating them'),
    code(
      sql(`
CREATE INDEX idx_employees_dept ON employees(dept_id);

-- Composite: order matters enormously. See below.
CREATE INDEX idx_employees_dept_salary ON employees(dept_id, salary);

-- Unique: an index that also enforces a constraint.
CREATE UNIQUE INDEX idx_employees_email ON employees(email);

-- Descending, for a query that sorts that way.
CREATE INDEX idx_employees_hired ON employees(hired_on DESC);

-- Partial: index only the rows you query. Small and fast.
CREATE INDEX idx_active ON employees(dept_id) WHERE deleted_at IS NULL;  -- Postgres

-- On an expression, so a function in the WHERE can still use an index.
CREATE INDEX idx_lower_name ON employees((LOWER(name)));

DROP INDEX idx_employees_dept ON employees;   -- MySQL
DROP INDEX idx_employees_dept;                -- PostgreSQL
`),
    ),
    tip(
      'A **partial index** is underused and often the best answer to a soft-delete schema. If 95% of queries add `WHERE deleted_at IS NULL`, an index over only those rows is a twentieth of the size, stays in memory, and is not touched when a deleted row is written. PostgreSQL has them; MySQL does not, and the usual substitute is a generated column.',
    ),

    h('Composite indexes and the leftmost prefix'),
    p(
      'This is the most valuable rule on the page. An index on `(a, b, c)` is sorted by `a`, then by `b` within equal `a`, then by `c`. So it can serve any query that constrains a **leftmost prefix** — and no others.',
    ),
    code(sql(`CREATE INDEX idx ON employees(dept_id, salary, hired_on);`)),
    table(
      ['query', 'uses the index?'],
      [
        ['`WHERE dept_id = 1`', '**Yes** — prefix `(a)`'],
        ['`WHERE dept_id = 1 AND salary > 80000`', '**Yes** — prefix `(a, b)`'],
        ['`WHERE dept_id = 1 AND salary = 80000 AND hired_on > …`', '**Yes** — all three'],
        ['`WHERE salary > 80000`', '**No** — skips `dept_id`'],
        ['`WHERE hired_on > …`', '**No**'],
        ['`WHERE salary = 80000 AND dept_id = 1`', '**Yes** — written order is irrelevant, the optimiser reorders'],
        ['`WHERE dept_id = 1 ORDER BY salary`', '**Yes** — and no sort is needed, the index is already in that order'],
        ['`WHERE dept_id > 1 AND salary = 80000`', 'Partly — the range on `a` stops `b` being used for seeking'],
      ],
    ),
    p(
      'The phone-book analogy holds exactly: sorted by surname then forename, you can find "everyone called Sharma" and "Sharma, Anil" — but not "everyone called Anil", which is a full scan whatever the sort order.',
    ),
    warn(
      'The last row is the subtler rule. **Once a column is used for a range, the columns after it can no longer be used for seeking** — only for filtering rows already fetched. So put **equality columns first and the range column last**: `(dept_id, hired_on)` serves `dept_id = 1 AND hired_on > x` well, and `(hired_on, dept_id)` serves it badly.',
    ),
    note(
      'One well-chosen composite index usually beats three single-column ones. MySQL can use only one index per table per query (index merge exists and is rarely chosen), so `(dept_id, salary)` serves both `dept_id` alone and the pair, while separate indexes on each serve the pair poorly.',
    ),

    h('Covering indexes'),
    p(
      'If an index contains **every column the query needs**, the engine never touches the table at all. The plan says *Using index*, and it is often several times faster than the same query with one extra column selected.',
    ),
    code(
      sql(`
CREATE INDEX idx_cover ON employees(dept_id, salary, name);

-- Covered: dept_id, salary and name are all in the index.
SELECT name, salary FROM employees WHERE dept_id = 1;

-- Not covered: hired_on is not, so every matching row is fetched from the table.
SELECT name, salary, hired_on FROM employees WHERE dept_id = 1;
`),
    ),
    tip(
      'This is the concrete cost of `SELECT *`. A query selecting three columns can be answered from an index; the same query with `*` must fetch every row from the table, turning one traversal into one plus N random reads.',
    ),

    h('When an index is not used'),
    p('Each of these silently forces a scan. They are the first things to check when an index "does not work":'),
    table(
      ['written', 'problem', 'instead'],
      [
        ['`WHERE YEAR(hired_on) = 2021`', 'The column is wrapped in a function.', "`hired_on >= '2021-01-01' AND hired_on < '2022-01-01'`"],
        ['`WHERE salary * 12 > 1000000`', 'Arithmetic on the column.', '`salary > 83333.33`'],
        ["`WHERE name LIKE '%ada%'`", 'Leading wildcard — the sort order cannot help.', "`LIKE 'ada%'`, or full-text search"],
        ['`WHERE dept_id != 1`', 'Negation matches most of the table.', 'Often unavoidable; a scan may genuinely be right'],
        ["`WHERE phone = 9001`", 'Type mismatch on a `VARCHAR` column forces a conversion on every row.', "`WHERE phone = '9001'`"],
        ['`WHERE a = 1 OR b = 2`', 'Two different columns; one index cannot serve both.', '`UNION` of two indexed queries'],
        ['`WHERE dept_id IS NULL`', 'Fine in Postgres and InnoDB — NULLs *are* indexed.', 'No change needed'],
      ],
    ),
    warn(
      'The type-mismatch row is the one that hides best. Comparing a `VARCHAR` column to a number makes MySQL convert **the column**, row by row, to a number — which is a function on the column by another name, and the index is dead. It produces correct results, so nothing points at it; only the plan shows it.',
    ),

    h('What an index costs'),
    table(
      ['cost', 'detail'],
      [
        ['**Writes**', 'Every `INSERT`, `UPDATE` and `DELETE` maintains every affected index. Five indexes make an insert roughly five times the work.'],
        ['**Disk**', 'A secondary index on a wide column can approach the size of the table.'],
        ['**Memory**', 'Indexes compete for the buffer pool. An unused index evicts pages a used one wanted.'],
        ['**Planning**', 'More candidates for the optimiser to consider, and more chances for it to choose wrong.'],
      ],
    ),
    code(
      sql(`
-- Which indexes exist, and how selective are they?
SHOW INDEX FROM employees;                       -- MySQL

-- Which are never used? Postgres tracks this. Drop them.
SELECT relname, indexrelname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0;
`),
    ),
    result(
      ['relname', 'indexrelname', 'idx_scan'],
      [['employees', 'idx_employees_hired', '`0`']],
      'An index nobody has used since the last restart',
    ),
    tip(
      '`pg_stat_user_indexes` with `idx_scan = 0` is the highest-value maintenance query in this topic. Unused indexes are pure cost — they slow every write, occupy memory that a used index wanted, and nobody ever notices because nothing gets slower in a way anyone attributes to them. Check it before adding more.',
    ),

    h('Which columns to index'),
    table(
      ['index it', 'do not'],
      [
        ['Primary and foreign keys', 'A column with two distinct values — a scan is cheaper'],
        ['Columns in `WHERE`, `JOIN` and `ORDER BY`', 'A small table — it fits in one page'],
        ['Columns with high **selectivity** (many distinct values)', 'A write-heavy table read rarely'],
        ['The combination a query filters on, as one composite', 'Every column individually, "just in case"'],
      ],
    ),
    note(
      '**Selectivity** is the ratio of distinct values to rows, and it is what the optimiser actually reasons about. A `status` column with three values across a million rows has selectivity 0.000003 — an index on it points at 300,000 rows, and reading 300,000 random rows is slower than scanning the table sequentially. The optimiser knows this and will ignore the index, which is correct and surprises people who then conclude the index is broken.',
    ),

    h('Other index types'),
    table(
      ['type', 'good at', 'available'],
      [
        ['**B-tree**', 'Equality, ranges, sorting, prefixes. The default.', 'Everywhere'],
        ['**Hash**', 'Equality only — no ranges, no sorting.', 'Postgres; MySQL MEMORY tables'],
        ['**Full-text**', '`MATCH … AGAINST` word search — what `LIKE \'%x%\'` cannot do', 'Both'],
        ['**GIN**', 'Arrays, JSONB, full text — many values per row', 'PostgreSQL'],
        ['**GiST / SP-GiST**', 'Geometry, ranges, nearest-neighbour', 'PostgreSQL'],
        ['**BRIN**', 'Huge naturally-ordered tables — tiny index, approximate', 'PostgreSQL'],
        ['**Spatial (R-tree)**', 'Geographic data', 'Both'],
      ],
    ),

    h('Interview'),
    asked([
      ['What is an index?', 'A sorted structure over one or more columns that lets rows be found without scanning the table.'],
      ['What structure is used?', 'A B+ tree — balanced, high fan-out, data in linked leaves.'],
      ['Why is it fast?', 'Depth is logarithmic with a fan-out of hundreds: a billion rows is about four page reads.'],
      ['Clustered vs non-clustered?', 'Clustered *is* the table in key order — one per table. Non-clustered is a separate structure pointing back.'],
      ['What is InnoDB’s clustered index?', 'The primary key. Secondary indexes store the primary key and require a second lookup.'],
      ['Why avoid a UUID v4 primary key in InnoDB?', 'Random inserts scatter across the tree and it is copied into every secondary index. Use a small increasing key, or UUID v7.'],
      ['What is the leftmost prefix rule?', 'A composite index serves only queries constraining a leftmost prefix of its columns.'],
      ['Where should the range column go?', 'Last — after a range, later columns cannot be used for seeking.'],
      ['What is a covering index?', 'One containing every column the query needs, so the table is never read.'],
      ['Why does a function on a column disable the index?', 'The index stores the raw values; the engine must compute the function for every row to compare.'],
      ['What does an index cost?', 'Slower writes, disk, memory, and more work for the optimiser.'],
      ['When should you not index?', 'Low-selectivity columns, small tables, and write-heavy tables read rarely.'],
      ['How do you find unused indexes?', '`pg_stat_user_indexes` where `idx_scan = 0`, or performance_schema in MySQL.'],
    ]),

    h('Cheatsheet'),
    cheat([
      ['Speed up a `WHERE` on one column', '`CREATE INDEX ON t(col)`'],
      ['Speed up a multi-column filter', 'One composite index, equality columns first'],
      ['Avoid a sort', 'Index the `ORDER BY` columns after the `WHERE` ones'],
      ['Avoid touching the table', 'A covering index — and stop selecting `*`'],
      ['Index only live rows', 'A partial index (Postgres)'],
      ['Filter on a function', 'An expression index'],
      ['Search inside text', 'Full-text, not `LIKE \'%x%\'`'],
      ['Enforce uniqueness', '`CREATE UNIQUE INDEX`'],
      ['Find out why it is not used', '`EXPLAIN`'],
      ['Reduce write cost', 'Drop indexes nothing has used'],
    ]),

    links(
      mysqlDoc('mysql-indexes.html', 'How MySQL uses indexes'),
      wiki('B%2B_tree', 'B+ tree'),
      wiki('Database_index', 'Database index'),
    ),
  ],
};
