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
  ul,
  warn,
} from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'A **stored procedure** is a named block of SQL, stored in the database and run with `CALL`. A **stored function** is the same idea but returns a value and can be used inside an expression. Both put logic *in* the database, which is a decision with real arguments on each side — and being able to make those arguments is what the interview question is actually testing.',
    ),

    h('The difference'),
    table(
      ['', 'Procedure', 'Function'],
      [
        ['Called with', '`CALL p(…)`', 'Inside an expression — `SELECT f(x)`'],
        ['Returns', 'Nothing, or via `OUT` parameters', '**Exactly one value**'],
        ['Parameters', '`IN`, `OUT`, `INOUT`', '`IN` only'],
        ['May modify data', '**Yes**', 'MySQL: only if not `DETERMINISTIC`. Postgres: only in a `PROCEDURE`.'],
        ['Usable in `WHERE` / `SELECT`', 'No', '**Yes**'],
        ['May manage transactions', '**Yes** — `COMMIT` / `ROLLBACK` inside', 'No'],
        ['Can return a result set', 'Yes — a `SELECT` inside it', 'No'],
      ],
    ),
    note(
      'The distinction that actually matters day to day: **a function can appear in a query, a procedure cannot.** Everything else follows from that — a function has to be side-effect-free enough for the optimiser to call it whenever and however often it likes.',
    ),

    h('A procedure'),
    code(
      mysql(`
DELIMITER $$

CREATE PROCEDURE give_raise(
  IN  p_dept_id INT,
  IN  p_percent DECIMAL(5,2),
  OUT p_affected INT
)
BEGIN
  UPDATE employees
  SET salary = salary * (1 + p_percent / 100)
  WHERE dept_id = p_dept_id;

  SET p_affected = ROW_COUNT();
END $$

DELIMITER ;

CALL give_raise(1, 10.0, @n);
SELECT @n AS employees_updated;
`),
    ),
    result(['employees_updated'], [['`2`']]),
    tip(
      '`DELIMITER $$` is not part of the procedure — it is an instruction to the **client**. The body contains semicolons, and without changing the statement terminator the client would send the first line as a complete statement and get a syntax error. Change it, define the procedure, change it back. This trips up everyone once, and it does not apply to PostgreSQL, which uses `$$` quoting instead.',
    ),

    h('A function'),
    code(
      mysql(`
DELIMITER $$

CREATE FUNCTION annual_salary(p_monthly DECIMAL(10,2))
RETURNS DECIMAL(12,2)
DETERMINISTIC
READS SQL DATA
BEGIN
  RETURN p_monthly * 12;
END $$

DELIMITER ;

SELECT name, salary, annual_salary(salary) AS annual FROM employees;
`),
      postgres(`
CREATE FUNCTION annual_salary(monthly NUMERIC)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $$ SELECT monthly * 12 $$;

SELECT name, salary, annual_salary(salary) AS annual FROM employees;
`),
    ),
    p('The characteristics are not decoration — the optimiser reads them:'),
    ul(
      '**`DETERMINISTIC`** / **`IMMUTABLE`** — same inputs always give the same output. Lets the engine cache the result, evaluate it once for a constant argument, and use an index on an expression over it.',
      '**`READS SQL DATA`** / **`STABLE`** — reads the database but changes nothing; consistent within one statement.',
      '**`MODIFIES SQL DATA`** / **`VOLATILE`** — may change data, or may return different values on each call. `NOW()` and `RANDOM()` are volatile.',
    ),
    warn(
      'Declaring a function `DETERMINISTIC` when it is not is a way to get silently wrong answers. The engine is entitled to call it once and reuse the result, so a "deterministic" function that reads a table will happily return a stale value for every row. Both engines trust the declaration and do not check it.',
    ),

    h('Control flow'),
    code(
      mysql(`
DELIMITER $$

CREATE PROCEDURE transfer(IN from_id INT, IN to_id INT, IN amount DECIMAL(10,2))
BEGIN
  DECLARE v_balance DECIMAL(10,2);

  -- Anything that goes wrong undoes the whole thing.
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;

    SELECT balance INTO v_balance FROM accounts WHERE id = from_id FOR UPDATE;

    IF v_balance < amount THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Insufficient funds';
    END IF;

    UPDATE accounts SET balance = balance - amount WHERE id = from_id;
    UPDATE accounts SET balance = balance + amount WHERE id = to_id;

  COMMIT;
END $$

DELIMITER ;
`),
    ),
    p(
      'That is a fair demonstration of what procedures are genuinely good at: the balance check and both updates happen inside one transaction, with the row locked by `FOR UPDATE`, and there is **no window** in which a second connection could read the balance between the check and the debit. Doing the same from application code means three round trips and the same transaction held open across all of them.',
    ),
    table(
      ['construct', 'MySQL'],
      [
        ['Variable', '`DECLARE v INT DEFAULT 0;`'],
        ['Assignment', '`SET v = 1;` or `SELECT col INTO v FROM …`'],
        ['Branch', '`IF … THEN … ELSEIF … ELSE … END IF;`'],
        ['Multi-branch', '`CASE … WHEN … THEN … END CASE;`'],
        ['Loop', '`WHILE … DO … END WHILE;` · `REPEAT … UNTIL … END REPEAT;` · `LOOP … LEAVE`'],
        ['Raise an error', "`SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '…';`"],
        ['Catch one', '`DECLARE EXIT HANDLER FOR SQLEXCEPTION …`'],
        ['Row-by-row', '`DECLARE CURSOR … OPEN … FETCH … CLOSE`'],
      ],
    ),

    h('Cursors, and why they are usually wrong'),
    p(
      'A **cursor** walks a result set one row at a time. It exists, it is occasionally necessary, and reaching for it is almost always a sign that a set-based statement was available:',
    ),
    code(
      mysql(`
-- Don't. This is a loop where an UPDATE would do.
DECLARE done INT DEFAULT 0;
DECLARE v_id INT;
DECLARE cur CURSOR FOR SELECT id FROM employees WHERE dept_id = 1;
DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;

OPEN cur;
read_loop: LOOP
  FETCH cur INTO v_id;
  IF done THEN LEAVE read_loop; END IF;
  UPDATE employees SET salary = salary * 1.1 WHERE id = v_id;
END LOOP;
CLOSE cur;
`),
    ),
    code(
      sql(`
-- One statement. One pass. One transaction. Orders of magnitude faster.
UPDATE employees SET salary = salary * 1.1 WHERE dept_id = 1;
`),
    ),
    warn(
      'The cursor version issues one `UPDATE` per row, each with its own index maintenance and logging, and holds the result set open throughout. On ten thousand rows the difference is not a percentage, it is a category. SQL is a set language; if you are writing a loop over rows, check first whether the set version exists — it usually does.',
    ),

    h('The argument'),
    table(
      ['for', 'against'],
      [
        ['**One round trip.** A loop of ten statements becomes one call — decisive over a slow link.', '**Not in version control**, unless you are disciplined. Logic that lives only in a database is logic nobody reviews.'],
        ['**Atomic by construction.** Check-then-act happens in one transaction with no application-side gap.', '**Hard to test.** No unit test framework, no mocking, no CI story worth the name.'],
        ['**One implementation.** Three services calling the same procedure cannot each get the rule subtly wrong.', '**Hard to debug.** No debugger, no stack trace, and printing is a temporary table.'],
        ['**Security.** Grant `EXECUTE` on the procedure and nothing on the tables.', '**Not portable.** T-SQL, PL/pgSQL and MySQL’s dialect are three different languages.'],
        ['**Less data moved.** Aggregate in the database rather than shipping rows to aggregate them.', '**Scales with the database.** Application servers are cheap to add; the primary database is not.'],
      ],
    ),
    tip(
      'The defensible modern position, and a good answer to the interview question: **business logic in the application, data-intensive operations in the database.** A procedure that aggregates a hundred million rows and returns twelve is obviously right. A procedure encoding your pricing rules is logic in a place with no tests, no code review and no deploy pipeline. The deciding question is "how much data has to move", not "where does logic belong".',
    ),

    h('Managing them'),
    code(
      sql(`
SHOW PROCEDURE STATUS WHERE db = 'company';       -- MySQL
SHOW CREATE PROCEDURE give_raise;

SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'company';

DROP PROCEDURE IF EXISTS give_raise;
`),
    ),
    warn(
      'There is no `CREATE OR REPLACE PROCEDURE` in MySQL — you must `DROP` then `CREATE`, which leaves a window where the procedure does not exist and any caller gets an error. PostgreSQL has `CREATE OR REPLACE`, which is atomic. Check your migration tooling handles the MySQL case.',
    ),

    h('Interview'),
    asked([
      ['Procedure vs function?', 'A function returns one value and can be used in an expression; a procedure is called with CALL, may return result sets, and can manage transactions.'],
      ['Can a function modify data?', 'Generally no — it must be safe for the optimiser to call freely. Postgres puts data modification in procedures.'],
      ['What are IN, OUT and INOUT?', 'Parameter directions. Functions have IN only.'],
      ['What does DETERMINISTIC mean?', 'Same inputs, same output — so the engine may cache or skip calls. Declaring it falsely gives wrong answers.'],
      ['Why is DELIMITER needed?', 'The body contains semicolons; without changing the client’s terminator the definition is cut short.'],
      ['What is a cursor?', 'A row-by-row walk over a result set — almost always replaceable by one set-based statement.'],
      ['Why avoid cursors?', 'One statement per row, each with its own logging and index maintenance. Orders of magnitude slower.'],
      ['Advantages of stored procedures?', 'Fewer round trips, atomic check-then-act, one implementation, and EXECUTE-only permissions.'],
      ['Disadvantages?', 'Poor version control and testing, no real debugger, not portable, and they consume database capacity.'],
      ['Where do you draw the line?', 'Data-intensive operations in the database; business logic in the application. Decide on how much data has to move.'],
    ]),

    h('Cheatsheet'),
    cheat([
      ['A reusable multi-statement operation', 'A procedure, called with `CALL`'],
      ['A value usable inside a query', 'A function'],
      ['Return a count to the caller', 'An `OUT` parameter'],
      ['Make check-then-act atomic', 'A procedure with `START TRANSACTION` and `FOR UPDATE`'],
      ['Raise an error', "`SIGNAL SQLSTATE '45000'`"],
      ['Roll back on any error', '`DECLARE EXIT HANDLER FOR SQLEXCEPTION`'],
      ['Update many rows', 'One `UPDATE` — never a cursor'],
      ['Grant access without table access', '`GRANT EXECUTE` on the procedure'],
      ['Change one', 'MySQL: `DROP` then `CREATE`. Postgres: `CREATE OR REPLACE`'],
    ]),

    links(
      mysqlDoc('stored-programs-defining.html', 'Stored programs (MySQL)'),
      pgDoc('plpgsql.html', 'PL/pgSQL (PostgreSQL)'),
    ),
  ],
};
