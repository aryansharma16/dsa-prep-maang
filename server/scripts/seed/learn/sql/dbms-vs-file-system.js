import { asked, cheat, code, h, links, note, p, sql, table, ul, warn, wiki } from '../blocks.js';

/*
  The classic first interview question, and it is usually asked as a list. So
  this is written as a list — five problems, each with the concrete thing that
  goes wrong — because the answer that gets marks is the one where each item is
  followed by an example rather than a synonym.
*/
export const doc = {
  blocks: [
    p(
      'Before databases, applications kept their data in files that they parsed themselves. That approach did not fail because it was slow. It failed because of five specific problems, and **every feature of a DBMS is an answer to one of them.** Knowing the five in order is the answer to the most common opening question in a DBMS interview.',
    ),

    h('The setup'),
    p(
      'Imagine a company with no database. Payroll keeps `payroll.csv`. HR keeps `staff.xlsx`. The reporting team keeps its own extract. Every program reads and writes its own file, in its own format.',
    ),

    h('1 · Data redundancy'),
    p(
      "Ada's name, department and joining date are in all three files. Storage is the least of it — the real cost is that the same fact now exists in three places that can disagree.",
    ),

    h('2 · Data inconsistency'),
    p(
      'Ada moves from Engineering to Data. HR updates its file. Payroll does not. **The company now has two different true-looking answers to "which department is Ada in", and nothing in the system can tell you which one is right.** This is the direct consequence of redundancy, and it is the reason normalisation exists as a subject.',
    ),
    note(
      'Redundancy and inconsistency are two questions, not one. Redundancy is storing a fact twice; inconsistency is what happens when only one copy gets updated. An answer that names both, in that causal order, is a better answer than one that lists them side by side.',
    ),

    h('3 · Difficulty getting at the data'),
    p(
      'The files support exactly the questions somebody wrote a program for. "List everyone in Hyderabad earning over 80,000, newest first" is a new program, written by a developer, deployed. With a database it is one sentence, typed by whoever wanted to know:',
    ),
    code(
      sql(`
SELECT e.name, e.salary
FROM employees e
JOIN departments d ON e.dept_id = d.id
WHERE d.location = 'Hyderabad' AND e.salary > 80000
ORDER BY e.hired_on DESC;
`),
    ),

    h('4 · Integrity problems'),
    p(
      'The rule "a salary is never negative" and the rule "an employee\'s department must exist" live in whichever programs happened to be written carefully. Add a fourth program, or a hurried import script, and the rule is gone. In a database the rule is part of the table, so **there is no way in that does not go through it**:',
    ),
    code(
      sql(`
CREATE TABLE employees (
  id      INT PRIMARY KEY,
  name    VARCHAR(50) NOT NULL,
  dept_id INT,
  salary  DECIMAL(10,2) NOT NULL CHECK (salary >= 0),
  FOREIGN KEY (dept_id) REFERENCES departments(id)
);
`),
    ),

    h('5 · Atomicity, and the crash'),
    p(
      'Transfer 10,000 from one account to another: subtract from one, add to the other. The machine dies between the two writes. With files, the money has been destroyed and nothing in the system knows. A transaction makes those two writes **one indivisible unit** — both, or neither, even across a power cut.',
    ),
    code(
      sql(`
START TRANSACTION;
  UPDATE accounts SET balance = balance - 10000 WHERE id = 1;
  UPDATE accounts SET balance = balance + 10000 WHERE id = 2;
COMMIT;
`),
    ),

    h('6 · Concurrent access'),
    p(
      'Two people withdraw from the same account at the same moment. Both programs read a balance of 5,000, both subtract 3,000, both write 2,000. **Six thousand has left the account and the balance says three thousand was taken.** This is the lost update, and preventing it is what locking and isolation levels are for.',
    ),
    warn(
      "File locking does exist, and this is where people push back in interviews. The honest answer is that it locks a whole *file*, not a row — so it turns a concurrency bug into a queue, and your six-person company's payroll run blocks everyone else out of HR. A DBMS locks at row granularity, which is the difference between correct and usable.",
    ),

    h('7 · Security'),
    p(
      'A file is readable or it is not. There is no way to say "the support team may read a customer\'s name and not their card number". A database grants privileges per table, per column and per operation.',
    ),

    h('The table to memorise'),
    table(
      ['', 'File system', 'DBMS'],
      [
        ['Redundancy', 'Same fact in many files', 'Stored once, referenced by key'],
        ['Consistency', 'Nothing enforces it', 'Constraints, enforced on every write'],
        ['Querying', 'Write a program per question', '`SELECT`, for any question'],
        ['Integrity rules', 'Scattered across applications', 'Declared on the table'],
        ['Atomicity', 'None — a crash leaves half a change', 'Transactions: all or nothing'],
        ['Concurrency', 'Whole-file locks, or corruption', 'Row-level locks and isolation levels'],
        ['Recovery', 'Restore last night’s backup', 'Write-ahead log replays to the last commit'],
        ['Security', 'Per file', 'Per table, per column, per operation'],
        ['Data independence', 'A format change breaks every reader', 'Storage changes without touching queries'],
      ],
    ),

    h('When a file is still the right answer'),
    p(
      'Because the honest version of this answer has a second half, and interviewers notice when it is missing. Configuration, logs, a single-writer cache, anything append-only that nobody queries across — a file is simpler, faster and has no server to run. The five problems above are all consequences of *shared, changing, related* data. Data that is none of those things does not need a database.',
    ),
    ul(
      'One writer, no queries → a file.',
      'Many readers, one writer, simple lookups → a file, or an embedded database like SQLite.',
      'Many writers, relationships, rules that must hold → a DBMS, every time.',
    ),

    h('Interview'),
    asked([
      [
        'Why use a DBMS over a file system?',
        'Redundancy, inconsistency, ad-hoc querying, integrity, atomicity, concurrency, recovery and security — in that order.',
      ],
      [
        'What is data redundancy?',
        'Storing the same fact in more than one place, which is what makes inconsistency possible.',
      ],
      [
        'What is data inconsistency?',
        'Two copies of the same fact disagreeing because only one was updated.',
      ],
      [
        'What is atomicity, in one sentence?',
        'A group of writes either all happen or none do, even if the machine dies halfway.',
      ],
      [
        'Give an example of a concurrency problem.',
        'The lost update: two transactions read the same balance, both subtract, and one write overwrites the other.',
      ],
      [
        'Is a file system ever the right choice?',
        'Yes — one writer, no relationships, no cross-record queries. Logs and config, typically.',
      ],
      [
        'What is data independence?',
        'Changing how data is stored, or adding a column, without rewriting the queries that read it.',
      ],
    ]),

    h('Cheatsheet'),
    cheat([
      ['Stop the same fact being stored twice', 'Normalise — one fact, one place'],
      ['Stop a bad value getting in', 'A constraint on the column, not a check in your code'],
      ['Make two writes inseparable', '`START TRANSACTION` … `COMMIT`'],
      ['Stop two writers overwriting each other', 'Row locks, chosen by the isolation level'],
      ['Survive a crash mid-write', 'The write-ahead log — the DBMS does this for you'],
    ]),

    links(
      wiki('Database#Database_management_system', 'Database management system'),
      wiki('ACID', 'ACID'),
    ),
  ],
};
