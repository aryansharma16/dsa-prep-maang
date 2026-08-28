import { asked, cheat, code, h, links, mysqlDoc, note, p, sql, table, tip, warn, wiki } from '../blocks.js';

/*
  A one-idea topic that exists because it is asked *constantly*, and because the
  table people memorise is usually right for the wrong reasons. The differences
  all fall out of one fact — DELETE is DML and TRUNCATE is DDL — so that leads.
*/
export const doc = {
  blocks: [
    p(
      'Three ways to get rid of things, and one of the most-asked questions in any SQL interview. Every difference between them follows from a single fact: **`DELETE` is DML and `TRUNCATE` and `DROP` are DDL.** Derive the table from that and you will never need to memorise it.',
    ),

    h('The table'),
    table(
      ['', '`DELETE`', '`TRUNCATE`', '`DROP`'],
      [
        ['Family', 'DML', 'DDL', 'DDL'],
        ['Removes', 'Rows you select', '**All** rows', 'Rows **and** the table itself'],
        ['`WHERE` clause', 'Yes', '**No**', 'No'],
        ['How it works', 'Row by row, each one logged', 'Deallocates the pages', 'Removes the definition'],
        ['Speed on a large table', 'Slow — proportional to rows', '**Very fast** — constant', 'Very fast'],
        ['Rollback (MySQL)', '**Yes**', 'No — implicitly commits', 'No — implicitly commits'],
        ['Rollback (PostgreSQL)', 'Yes', '**Yes** — DDL is transactional', 'Yes'],
        ['Fires triggers', '**Yes**, per row', 'No', 'No'],
        ['Resets `AUTO_INCREMENT`', 'No', '**Yes**', 'Table is gone'],
        ['Blocked by an inbound FK', 'Yes, unless cascading', '**Yes, always** — even with cascade', 'Yes, unless `CASCADE`'],
        ['Table afterwards', 'Exists, empty', 'Exists, empty', 'Gone'],
        ['Permission needed', '`DELETE`', '`DROP`', '`DROP`'],
      ],
    ),

    h('The three'),
    code(
      sql(`
-- DELETE: some rows, or all of them, one at a time, undoable.
DELETE FROM employees WHERE dept_id = 3;
DELETE FROM employees;

-- TRUNCATE: all rows, instantly, by throwing away the storage.
TRUNCATE TABLE employees;

-- DROP: the rows, the columns, the indexes, the constraints, the table.
DROP TABLE employees;
`),
    ),

    h('Why TRUNCATE is so much faster'),
    p(
      '`DELETE` is a normal DML statement, so it does what every DML statement does: it locates each row, writes it to the undo log so the change can be rolled back, removes it, updates every index, and fires any delete triggers. On ten million rows that is ten million times all of that.',
    ),
    p(
      '`TRUNCATE` does not touch rows at all. It deallocates the data pages — in InnoDB it effectively drops the table and recreates it with the same definition. **One operation, regardless of size.** That is also precisely why it cannot have a `WHERE` clause, cannot fire per-row triggers, and cannot be rolled back in MySQL: there was never a per-row operation to reverse.',
    ),
    note(
      'This is the answer that distinguishes a memorised response from an understood one. "TRUNCATE is faster" is a fact; "TRUNCATE is faster because it deallocates pages instead of logging row deletions, which is also why it has no WHERE and fires no triggers" is the reason, and it answers the next three questions at the same time.',
    ),

    h('The foreign key rule'),
    warn(
      '`TRUNCATE` is refused on any table another table references with a foreign key — **even if that constraint says `ON DELETE CASCADE`.** Cascade is a per-row action, and `TRUNCATE` has no rows to act on. `DELETE FROM t` on the same table works fine and cascades correctly. This one catches people out precisely because they expect truncate to be "delete but faster".',
    ),
    code(
      sql(`
TRUNCATE TABLE departments;
-- ERROR 1701: Cannot truncate a table referenced in a foreign key constraint

DELETE FROM departments;   -- works; cascades or sets null per the constraint
`),
    ),

    h('The auto-increment difference'),
    code(
      sql(`
-- After DELETE: the counter keeps going.
DELETE FROM employees;
INSERT INTO employees (name) VALUES ('Ada');    -- id = 11, say

-- After TRUNCATE: the counter is reset.
TRUNCATE TABLE employees;
INSERT INTO employees (name) VALUES ('Ada');    -- id = 1
`),
    ),
    p(
      'Which you want depends on why the table is empty. Resetting to 1 in a test fixture is convenient; resetting it on a table whose ids appear in logs, invoices or other systems means new rows will reuse identifiers that already mean something elsewhere.',
    ),

    h('DROP, and getting the table back'),
    code(
      sql(`
DROP TABLE employees;
DROP TABLE IF EXISTS employees;

-- Order matters: the child before the parent.
DROP TABLE employees;
DROP TABLE departments;

-- Or take the dependants with it (PostgreSQL; drops referencing constraints too).
DROP TABLE departments CASCADE;
`),
    ),
    warn(
      'In MySQL a `DROP TABLE` is committed the moment it runs, and the only route back is a backup or the binary log. In PostgreSQL, DDL is transactional — `BEGIN; DROP TABLE employees; ROLLBACK;` genuinely restores it, which is why Postgres migrations can be written as all-or-nothing.',
    ),

    h('Choosing'),
    table(
      ['you want', 'use'],
      [
        ['To remove some rows', '`DELETE … WHERE`'],
        ['To remove all rows, and might change your mind', '`DELETE FROM t`, inside a transaction'],
        ['To empty a large table quickly', '`TRUNCATE`'],
        ['To reset a test fixture', '`TRUNCATE` — fast, and the ids restart'],
        ['To empty a table other tables reference', '`DELETE` — `TRUNCATE` is refused'],
        ['To empty a table with delete triggers you need', '`DELETE` — `TRUNCATE` fires none'],
        ['To remove the table entirely', '`DROP`'],
        ['To change a column', '`ALTER` — none of these three'],
      ],
    ),
    tip(
      'A fourth answer exists and is often the best one for a genuinely huge table: `DROP` it and `CREATE` it again from the DDL. That is what `TRUNCATE` does internally anyway, and doing it explicitly lets you recreate the foreign keys afterwards — which is the way round the restriction above.',
    ),

    h('Interview'),
    asked([
      ['DELETE vs TRUNCATE?', 'DELETE is DML — row by row, with a WHERE, logged, rollbackable, fires triggers. TRUNCATE is DDL — deallocates pages, all rows, no WHERE, no triggers, resets auto-increment.'],
      ['Which is faster and why?', 'TRUNCATE — it frees storage in one operation rather than logging each row.'],
      ['Can TRUNCATE be rolled back?', 'Not in MySQL — it implicitly commits. In PostgreSQL yes, because DDL is transactional.'],
      ['Does TRUNCATE fire triggers?', 'No. There is no per-row operation to trigger on.'],
      ['Which resets AUTO_INCREMENT?', 'TRUNCATE. DELETE leaves the counter where it was.'],
      ['DROP vs TRUNCATE?', 'TRUNCATE empties the table and keeps it; DROP removes the table, its indexes and its constraints.'],
      ['Can you TRUNCATE a table with a foreign key pointing at it?', 'No — even with ON DELETE CASCADE, because cascade is per row and TRUNCATE has none.'],
      ['Which needs which privilege?', 'DELETE needs DELETE; TRUNCATE and DROP both need DROP.'],
      ['How do you empty a huge referenced table fast?', 'DROP and recreate it from the DDL, restoring the foreign keys afterwards.'],
    ]),

    h('Cheatsheet'),
    cheat([
      ['Remove matching rows', '`DELETE FROM t WHERE …`'],
      ['Empty a table, reversibly', '`DELETE FROM t` in a transaction'],
      ['Empty a big table fast', '`TRUNCATE TABLE t`'],
      ['Reset ids to 1', '`TRUNCATE`'],
      ['Keep triggers firing', '`DELETE` — `TRUNCATE` skips them'],
      ['Remove the table', '`DROP TABLE t` — child before parent'],
      ['Make a script re-runnable', '`DROP TABLE IF EXISTS t`'],
    ]),

    links(
      mysqlDoc('truncate-table.html', 'TRUNCATE TABLE (MySQL)'),
      mysqlDoc('drop-table.html', 'DROP TABLE (MySQL)'),
      wiki('Truncate_(SQL)', 'TRUNCATE'),
    ),
  ],
};
