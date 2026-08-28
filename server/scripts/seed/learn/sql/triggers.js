import {
  asked,
  cheat,
  code,
  h,
  links,
  mysql,
  mysqlDoc,
  note,
  p,
  pgDoc,
  postgres,
  result,
  sql,
  table,
  tip,
  warn,
} from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'A **trigger** is code that runs automatically when a row is inserted, updated or deleted. Nobody calls it; it fires as part of the statement that caused it, inside the same transaction. That is its whole strength — **it cannot be bypassed** — and its whole weakness, which is that it happens invisibly to whoever wrote the statement.',
    ),

    h('The two axes'),
    table(
      ['', 'INSERT', 'UPDATE', 'DELETE'],
      [
        ['**BEFORE**', 'Validate or fill in a value', 'Validate or transform', 'Veto the delete'],
        ['**AFTER**', 'Audit, maintain a counter', 'Audit, sync a copy', 'Audit, archive'],
      ],
    ),
    p('Six combinations. The choice between `BEFORE` and `AFTER` is not stylistic:'),
    table(
      ['', '`BEFORE`', '`AFTER`'],
      [
        ['Runs', 'Before the row is written', 'Once the row is written'],
        ['May change the row', '**Yes** — assign to `NEW.col`', 'No — the write has happened'],
        ['May cancel the statement', 'Yes, by raising an error', 'Yes, but the work is already done'],
        ['Sees the generated id', '**No** — `AUTO_INCREMENT` is not assigned yet', '**Yes**'],
        ['Use for', 'Validation, defaults, normalising input', 'Audit trails, counters, cascades'],
      ],
    ),
    note(
      'The id row is the one that catches people. A `BEFORE INSERT` trigger cannot log the new row\'s id, because the id does not exist until the insert happens. Anything that needs it — an audit row, a child record — has to be `AFTER INSERT`.',
    ),

    h('OLD and NEW'),
    table(
      ['event', '`OLD`', '`NEW`'],
      [
        ['`INSERT`', 'unavailable', 'the row being inserted'],
        ['`UPDATE`', 'the row as it was', 'the row as it will be'],
        ['`DELETE`', 'the row being removed', 'unavailable'],
      ],
    ),

    h('An audit trail'),
    p('The most defensible use of a trigger: recording every salary change, where the record cannot be skipped by any write path.'),
    code(
      mysql(`
CREATE TABLE salary_audit (
  id          BIGINT PRIMARY KEY AUTO_INCREMENT,
  employee_id INT NOT NULL,
  old_salary  DECIMAL(10,2),
  new_salary  DECIMAL(10,2),
  changed_by  VARCHAR(100),
  changed_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DELIMITER $$

CREATE TRIGGER audit_salary_change
AFTER UPDATE ON employees
FOR EACH ROW
BEGIN
  -- Only when it actually changed. Without this every UPDATE writes an audit row.
  IF NEW.salary <> OLD.salary THEN
    INSERT INTO salary_audit (employee_id, old_salary, new_salary, changed_by)
    VALUES (NEW.id, OLD.salary, NEW.salary, CURRENT_USER());
  END IF;
END $$

DELIMITER ;
`),
    ),
    code(
      sql(`
UPDATE employees SET salary = 99000 WHERE id = 1;
SELECT * FROM salary_audit;
`),
    ),
    result(
      ['id', 'employee_id', 'old_salary', 'new_salary', 'changed_by', 'changed_at'],
      [['`1`', '`1`', '`95000.00`', '`99000.00`', 'app@localhost', '`2024-06-01 09:14:22`']],
    ),
    warn(
      "`NEW.salary <> OLD.salary` looks like a nicety and is not. Without it, an `UPDATE employees SET name = 'Ada' WHERE id = 1` writes an audit row saying the salary changed from 95,000 to 95,000 — and a bulk update touching every row fills the audit table with noise. Also note that `<>` is `NULL` when either side is `NULL`, so on a nullable column the correct test is `NOT (NEW.x <=> OLD.x)` in MySQL, or `IS DISTINCT FROM` in PostgreSQL.",
    ),

    h('Validation, in BEFORE'),
    code(
      mysql(`
DELIMITER $$

CREATE TRIGGER check_salary
BEFORE INSERT ON employees
FOR EACH ROW
BEGIN
  IF NEW.salary < 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Salary cannot be negative';
  END IF;

  -- BEFORE triggers can also fill things in.
  SET NEW.name = TRIM(NEW.name);
  IF NEW.hired_on IS NULL THEN SET NEW.hired_on = CURRENT_DATE(); END IF;
END $$

DELIMITER ;
`),
    ),
    tip(
      'Most of that should not be a trigger. `CHECK (salary >= 0)` and `DEFAULT (CURRENT_DATE)` do the first and third declaratively — visible in the table definition, cheaper, and impossible to forget when reading the schema. **A constraint you can express as a constraint should never be a trigger.** The `TRIM` is a fair use, because there is no declarative way to say it.',
    ),

    h('Maintaining a denormalised counter'),
    code(
      mysql(`
DELIMITER $$

CREATE TRIGGER dept_count_insert AFTER INSERT ON employees
FOR EACH ROW
BEGIN
  UPDATE departments SET headcount = headcount + 1 WHERE id = NEW.dept_id;
END $$

CREATE TRIGGER dept_count_delete AFTER DELETE ON employees
FOR EACH ROW
BEGIN
  UPDATE departments SET headcount = headcount - 1 WHERE id = OLD.dept_id;
END $$

CREATE TRIGGER dept_count_update AFTER UPDATE ON employees
FOR EACH ROW
BEGIN
  IF NOT (NEW.dept_id <=> OLD.dept_id) THEN
    UPDATE departments SET headcount = headcount - 1 WHERE id = OLD.dept_id;
    UPDATE departments SET headcount = headcount + 1 WHERE id = NEW.dept_id;
  END IF;
END $$

DELIMITER ;
`),
    ),
    warn(
      '**Three triggers, and it is still not complete.** A `TRUNCATE` fires none of them and leaves every counter wrong. A bulk load with triggers disabled does the same. A restore from backup, a replication rebuild, a direct write from a migration — each one is a path around the invariant. Denormalised counters need a **repair query** as well as the triggers, run periodically, and this is the single best argument for preferring a materialised view.',
    ),

    h('The problems'),
    table(
      ['problem', 'why it bites'],
      [
        [
          '**Invisible**',
          'A developer reads `UPDATE employees SET salary = …`, and three other tables change. Nothing at the call site says so; you have to know to look.',
        ],
        [
          '**Hard to debug**',
          'No stack trace names the trigger. A mysterious lock-wait timeout on `employees` turns out to be a trigger writing to a contended audit table.',
        ],
        [
          '**Cascading**',
          'Trigger A writes to table B, whose trigger writes to C, whose trigger writes to A. MySQL caps nesting at 32 and forbids the cycle outright; Postgres will happily recurse until it does not.',
        ],
        [
          '**Per row, not per statement**',
          'MySQL triggers are always `FOR EACH ROW`. An `UPDATE` touching a million rows runs the trigger a million times, inside one transaction, holding every lock it takes.',
        ],
        [
          '**Silently skipped**',
          '`TRUNCATE`, bulk loaders and replication apply may all bypass them, so an invariant maintained only by a trigger is not actually an invariant.',
        ],
      ],
    ),
    note(
      'PostgreSQL has statement-level triggers (`FOR EACH STATEMENT`) with transition tables, which run once per statement rather than once per row — a genuinely better tool for auditing a bulk update. MySQL has only row-level triggers.',
    ),

    h('Postgres syntax'),
    p('A trigger in PostgreSQL is a **function** plus a **binding**, which is why one function can serve several tables:'),
    code(
      postgres(`
CREATE FUNCTION audit_salary() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.salary IS DISTINCT FROM OLD.salary THEN
    INSERT INTO salary_audit (employee_id, old_salary, new_salary, changed_by)
    VALUES (NEW.id, OLD.salary, NEW.salary, CURRENT_USER);
  END IF;
  RETURN NEW;                     -- BEFORE triggers: RETURN NULL cancels the write
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_salary_change
AFTER UPDATE ON employees
FOR EACH ROW EXECUTE FUNCTION audit_salary();
`),
    ),

    h('Managing them'),
    code(
      sql(`
SHOW TRIGGERS;                                          -- MySQL
SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE trigger_schema = 'company';

DROP TRIGGER IF EXISTS audit_salary_change;
`),
    ),

    h('When to use one'),
    table(
      ['want', 'use'],
      [
        ['A value in a range', '`CHECK` — not a trigger'],
        ['A default value', '`DEFAULT` — not a trigger'],
        ['A reference to exist', '`FOREIGN KEY` — not a trigger'],
        ['Children deleted with the parent', '`ON DELETE CASCADE` — not a trigger'],
        ['An unforgeable audit trail', '**A trigger.** This is the good case.'],
        ['A cross-row rule a CHECK cannot see', 'A trigger, or application logic in a transaction'],
        ['A denormalised counter', 'A trigger **plus a repair job** — or a materialised view'],
        ['Business logic', 'The application'],
      ],
    ),
    tip(
      'The one-line rule worth carrying: **a trigger is right when the guarantee must hold no matter who writes, and the rule cannot be expressed declaratively.** Audit trails meet both tests. Almost nothing else does.',
    ),

    h('Interview'),
    asked([
      ['What is a trigger?', 'Code that runs automatically on INSERT, UPDATE or DELETE, inside the same transaction as the statement.'],
      ['BEFORE vs AFTER?', 'BEFORE can modify the row and runs before the write; AFTER sees the final row including generated ids.'],
      ['Which sees the AUTO_INCREMENT id?', 'AFTER INSERT only — it does not exist yet in BEFORE.'],
      ['What are OLD and NEW?', 'The row before and after. INSERT has no OLD; DELETE has no NEW.'],
      ['When is a trigger the right tool?', 'An audit trail that must not be bypassable, or a cross-row rule no constraint can express.'],
      ['When is it the wrong tool?', 'Anything a CHECK, DEFAULT or FOREIGN KEY can do declaratively, and any business logic.'],
      ['What are the risks?', 'Invisible side effects, hard debugging, cascades between triggers, per-row cost on bulk updates, and being skipped by TRUNCATE and bulk loads.'],
      ['Are triggers per row or per statement?', 'MySQL: per row only. PostgreSQL supports both.'],
      ['Can a trigger stop a statement?', 'Yes — raise an error with SIGNAL, or RETURN NULL from a BEFORE trigger in Postgres.'],
      ['Why compare with `<=>` or IS DISTINCT FROM?', '`<>` returns NULL when either side is NULL, so a nullable column would silently skip the branch.'],
    ]),

    h('Cheatsheet'),
    cheat([
      ['Log every change to a column', '`AFTER UPDATE` trigger writing to an audit table'],
      ['Only log real changes', '`IF NOT (NEW.x <=> OLD.x)`'],
      ['Normalise input on the way in', '`BEFORE INSERT`, assigning to `NEW.col`'],
      ['Reject a bad row', '`BEFORE` + `SIGNAL SQLSTATE \'45000\'`'],
      ['Enforce a range', '`CHECK` — not a trigger'],
      ['Supply a default', '`DEFAULT` — not a trigger'],
      ['Keep a counter', 'Three triggers **and** a repair job'],
      ['See what exists', '`SHOW TRIGGERS` / `information_schema.triggers`'],
    ]),

    links(
      mysqlDoc('triggers.html', 'Triggers (MySQL)'),
      pgDoc('plpgsql-trigger.html', 'Trigger functions (PostgreSQL)'),
    ),
  ],
};
