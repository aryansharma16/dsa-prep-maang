import { asked, cheat, code, h, links, mysqlDoc, note, p, pgDoc, sql, table, tip, ul, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'A column has a **type**, and the type is a constraint — the first and cheapest one. It decides what can be stored, how much space a row takes, how comparisons and sorting behave, and whether an index on the column is any good. Most of it is unremarkable. Three choices are worth getting right, and each has a bad default that people reach for.',
    ),

    h('Numbers'),
    table(
      ['type', 'holds', 'bytes', 'use for'],
      [
        ['`TINYINT`', '−128 to 127 (or 0–255 unsigned)', '1', 'Flags, small enums'],
        ['`INT`', '±2.1 billion', '4', 'Ids, counts — the default'],
        ['`BIGINT`', '±9.2 × 10¹⁸', '8', 'Ids that will exceed 2 billion, epoch millis'],
        ['`DECIMAL(p, s)`', 'Exact, `p` digits with `s` after the point', 'varies', '**Money, always**'],
        ['`FLOAT` / `DOUBLE`', 'Approximate binary floating point', '4 / 8', 'Measurements, scientific data'],
      ],
    ),
    warn(
      '**Never store money in a FLOAT or DOUBLE.** They are binary floating point, and `0.1` has no exact binary representation any more than `1/3` has an exact decimal one. Add ten ten-pence items and you get `0.9999999999999999`. Sum a million transactions and the error is real money that does not reconcile. `DECIMAL(10,2)` stores the digits exactly and arithmetic on it is exact.',
    ),
    code(
      sql(`
CREATE TABLE payments (
  id       BIGINT        PRIMARY KEY AUTO_INCREMENT,
  amount   DECIMAL(12,2) NOT NULL,       -- exact: up to 10 digits, 2 decimals
  fee_rate DOUBLE,                       -- fine: an approximate rate
  CHECK (amount >= 0)
);

-- The problem, demonstrated.
SELECT 0.1 + 0.2 = 0.3;                          -- DOUBLE:  0  (false)
SELECT CAST(0.1 AS DECIMAL(2,1)) + CAST(0.2 AS DECIMAL(2,1))
     = CAST(0.3 AS DECIMAL(2,1));                -- DECIMAL: 1  (true)
`),
    ),
    tip(
      'The other correct answer is to store money as an integer number of the smallest unit — paise, cents — in a `BIGINT`. Exact by construction and fast, at the cost of dividing by 100 in every display path. Either works; a `FLOAT` does not.',
    ),

    h('Strings'),
    table(
      ['type', 'stored as', 'use for'],
      [
        [
          '`CHAR(n)`',
          'Always exactly `n`, space-padded.',
          'Genuinely fixed-length codes — a 2-letter country code, a 6-digit pincode.',
        ],
        [
          '`VARCHAR(n)`',
          'Length prefix plus the actual bytes.',
          'Almost everything — names, emails, titles.',
        ],
        ['`TEXT`', 'Often stored away from the row.', 'Long free text with no sensible maximum.'],
        ['`ENUM(...)`', 'MySQL: an integer, displayed as text.', 'A small fixed set — though a `CHECK` is more portable.'],
      ],
    ),
    p(
      "`CHAR(5)` holding `'ab'` stores five characters and returns `'ab'` with the padding trimmed on the way out in MySQL — which means a value can come back different from how it went in. `VARCHAR` does not do that. Use `CHAR` only when every value genuinely is the same length.",
    ),
    note(
      "The `n` in `VARCHAR(n)` costs nothing when unused, so `VARCHAR(255)` is not more expensive than `VARCHAR(50)` for a 10-character name. It is still worth sizing honestly: the limit is a constraint, and `VARCHAR(255)` on a country code says the schema does not know what a country code is. In PostgreSQL, `TEXT` and `VARCHAR` are the same thing internally and `TEXT` is idiomatic.",
    ),

    h('Dates and times'),
    table(
      ['type', 'holds', 'timezone-aware?'],
      [
        ['`DATE`', '`2024-03-01`', 'No — a calendar date'],
        ['`TIME`', '`14:30:00`', 'No'],
        ['`DATETIME`', 'Date and time', '**No** — stored and returned as written'],
        ['`TIMESTAMP`', 'Date and time', '**Yes** in MySQL — converted to UTC on write, back on read'],
        ['`TIMESTAMPTZ`', 'Date and time', 'Yes — PostgreSQL. **The right default there.**'],
        ['`YEAR`', '`2024`', 'MySQL only, rarely worth it'],
      ],
    ),
    warn(
      'MySQL `TIMESTAMP` runs out in **2038** — it is a 32-bit epoch. For anything that might store a future date (a subscription end, a scheduled job, a birthday), use `DATETIME`, or `BIGINT` millis, or be certain the system will not outlive the range. This is not a theoretical concern for a schema written today.',
    ),
    tip(
      'Store instants in UTC and convert at the edge. A `DATETIME` column holding local times is unusable the first time a daylight-saving boundary falls inside a report, and there is no way to repair it afterwards because the offset was never recorded.',
    ),

    h('The rest'),
    ul(
      '**`BOOLEAN`** — MySQL has no real boolean; `BOOLEAN` is an alias for `TINYINT(1)` and `TRUE` is `1`. PostgreSQL has a genuine one.',
      '**`JSON`** — a real type in both, with operators for reaching inside. Useful for genuinely schemaless attributes; a warning sign when it holds things you filter and join on, because that is a table wearing a disguise.',
      '**`UUID`** — native in PostgreSQL (16 bytes). In MySQL use `BINARY(16)`, not `CHAR(36)`: the string form is more than twice the size in every index that references it.',
      '**`BLOB` / `BYTEA`** — binary. Usually the wrong place for a file; store the file in object storage and the URL here.',
    ),

    h('NULL is not a value'),
    p(
      "`NULL` means *unknown*. It is not zero, not an empty string, and not `false` — and it is not equal to another `NULL`, because two unknown things cannot be known to match. This has an entire topic of its own further down, and the one-line version is: **compare with `IS NULL`, never with `= NULL`.**",
    ),
    code(
      sql(`
SELECT NULL = NULL;        -- NULL, not 1. Never true.
SELECT NULL IS NULL;       -- 1
SELECT '' = NULL;          -- NULL
SELECT COALESCE(NULL, 0);  -- 0
`),
    ),

    h('Choosing, in practice'),
    table(
      ['storing', 'use'],
      [
        ['A primary key', '`BIGINT AUTO_INCREMENT`, or `UUID`/`BINARY(16)` if ids must be unguessable'],
        ['Money', '`DECIMAL(p,2)` — never a float'],
        ['A name, an email, a title', '`VARCHAR(n)`, sized honestly'],
        ['A country code, a pincode', '`CHAR(n)` — genuinely fixed'],
        ['An article body', '`TEXT`'],
        ['A status from a fixed set', '`VARCHAR(20)` with a `CHECK`, over `ENUM` — adding a value to an ENUM is an `ALTER`'],
        ['When something happened', '`DATETIME` in UTC, or `TIMESTAMPTZ` in Postgres'],
        ['A birthday', '`DATE` — it has no time and no timezone'],
        ['A yes/no', '`BOOLEAN`, or `TINYINT(1)` in MySQL'],
        ['A file', 'Object storage; a `VARCHAR` URL in the row'],
      ],
    ),

    h('Interview'),
    asked([
      ['CHAR vs VARCHAR?', 'CHAR is fixed-length and space-padded; VARCHAR stores only what is there. Use CHAR only for genuinely fixed-length codes.'],
      ['Why not store money in a FLOAT?', 'Binary floating point cannot represent 0.1 exactly, so sums drift. Use DECIMAL, or integer minor units.'],
      ['DATETIME vs TIMESTAMP in MySQL?', 'TIMESTAMP converts to UTC and back and ends in 2038; DATETIME stores what you wrote and has a far wider range.'],
      ['Is NULL a value?', 'No — it is the absence of one. Compare with IS NULL; `= NULL` is always NULL.'],
      ['Does VARCHAR(255) waste space for a short string?', 'No — only the actual bytes plus a length prefix. But the limit is still a constraint worth setting honestly.'],
      ['How do you store a UUID in MySQL?', 'BINARY(16), not CHAR(36) — the string form doubles the size of every index using it.'],
      ['When is a JSON column appropriate?', 'For genuinely variable attributes you do not filter or join on. Otherwise it is a table avoiding being one.'],
      ['ENUM or CHECK?', 'CHECK — portable, and adding a value does not require an ALTER of the column type.'],
    ]),

    h('Cheatsheet'),
    cheat([
      ['Store a price', '`DECIMAL(10,2)`'],
      ['Store a percentage or a measurement', '`DOUBLE` is fine'],
      ['Store a name', '`VARCHAR(100)`'],
      ['Store a fixed-length code', '`CHAR(2)`'],
      ['Store when a row was created', '`DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`, in UTC'],
      ['Store a date of birth', '`DATE`'],
      ['Store "not known yet"', '`NULL` — never `0`, `-1` or `\'\'`'],
      ['Test for absence', '`IS NULL`'],
    ]),

    links(
      mysqlDoc('data-types.html', 'MySQL data types'),
      pgDoc('datatype.html', 'PostgreSQL data types'),
    ),
  ],
};
