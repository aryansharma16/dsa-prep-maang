import { asked, cheat, code, h, links, note, p, sql, table, tip, ul, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      '**Denormalisation** is putting redundancy back on purpose, to make a read faster. It is not the opposite of normalisation and it is not what you do when normalisation is too hard — it is an optimisation applied to a normalised schema, after measuring, with a plan for keeping the duplicate true.',
    ),
    p(
      'That last clause is the whole subject. Every denormalisation creates a second copy of a fact, and every second copy will eventually disagree with the first unless something actively stops it.',
    ),

    h('When it is the right call'),
    ul(
      '**A read path that is measurably too slow**, and the profile blames joins rather than a missing index. Check the index first — it is free and reversible, and it fixes the problem far more often.',
      '**A read-to-write ratio that is lopsided.** A product page read ten thousand times a day and written once is a good candidate; an order status written as often as it is read is not.',
      '**An aggregate that is expensive and tolerates staleness.** "Posts: 1,204" does not need to be exact to the second.',
      '**Reporting and analytics.** A star schema is denormalised by design, and correctly so — it is a separate, rebuilt copy of the data whose job is scanning.',
      '**A historical snapshot.** Copying the price onto the order line is not really denormalisation at all; see below.',
    ),

    h('The four techniques'),
    table(
      ['technique', 'example', 'keep it true with'],
      [
        [
          '**Duplicated column**',
          'Store `department_name` on `employees` so the list page needs no join.',
          'A trigger, or one write path that always sets both.',
        ],
        [
          '**Precomputed aggregate**',
          'Store `post_count` on `users` instead of counting posts.',
          'A trigger on insert/delete, or a periodic recount.',
        ],
        [
          '**Merged tables**',
          'Fold a 1:1 `user_profiles` back into `users`.',
          'Nothing — this one adds no redundancy, only width.',
        ],
        [
          '**Materialised view**',
          'A stored, indexable result of an expensive query.',
          'The database, on a schedule you choose. **The safest of the four.**',
        ],
      ],
    ),
    tip(
      'Reach for the materialised view first. It is the only technique where the database owns the copy and knows it is a copy — nobody can update it by accident, and refreshing it is one command. The other three put a copy in a normal column where every writer in the system can silently break it.',
    ),

    h('A worked example'),
    p('The normalised read — a join per page load:'),
    code(
      sql(`
SELECT e.name, d.name AS department
FROM employees e
JOIN departments d ON e.dept_id = d.id;
`),
    ),
    p('Denormalised, the join is gone:'),
    code(
      sql(`
ALTER TABLE employees ADD COLUMN dept_name VARCHAR(50);

UPDATE employees e
JOIN departments d ON e.dept_id = d.id
SET e.dept_name = d.name;

SELECT name, dept_name FROM employees;
`),
    ),
    warn(
      'And now `UPDATE departments SET name = \'Platform\' WHERE id = 1` makes the database lie. Two employees still say Engineering. Nothing errors, nothing logs, and the bug surfaces weeks later as a report that does not reconcile. **A denormalisation without a synchronisation mechanism is not an optimisation, it is a deferred bug.**',
    ),
    p('So the mechanism is not optional. A trigger is the usual answer:'),
    code(
      sql(`
CREATE TRIGGER sync_dept_name
AFTER UPDATE ON departments
FOR EACH ROW
  UPDATE employees SET dept_name = NEW.name WHERE dept_id = NEW.id;
`),
    ),
    note(
      'Note what this has cost. Writes to `departments` are now slower and touch a second table; there is logic in the database that a developer reading `employees` will not see; and if anyone ever loads `employees` by a path that bypasses the trigger — a bulk import, a replica, a migration — the copy drifts anyway. That is the real price, and it is why "add an index" and "add a materialised view" are both better first answers.',
    ),

    h('The counting case'),
    p('The most common denormalisation, and the one with the most reliable payoff:'),
    code(
      sql(`
-- Normalised: counts every row, every time.
SELECT u.name, COUNT(p.id) AS posts
FROM users u LEFT JOIN posts p ON p.user_id = u.id
GROUP BY u.id, u.name;

-- Denormalised: one column, maintained on write.
ALTER TABLE users ADD COLUMN post_count INT NOT NULL DEFAULT 0;

-- Every write path must go through this, inside the same transaction.
START TRANSACTION;
  INSERT INTO posts (user_id, body) VALUES (1, '...');
  UPDATE users SET post_count = post_count + 1 WHERE id = 1;
COMMIT;
`),
    ),
    tip(
      'Inside the same transaction, always. Two separate statements can be interrupted between them, and then the counter is wrong with no record of why. And keep the recount query — you will need it, because counters drift, and a nightly job that repairs them is cheaper than an investigation.',
    ),

    h('The case that only looks like denormalisation'),
    p(
      'Copying the price onto an order line looks like duplicating `products.price`. It is not, and this distinction is worth being able to draw:',
    ),
    code(
      sql(`
CREATE TABLE order_lines (
  order_id   INT NOT NULL,
  product_id INT NOT NULL,
  quantity   INT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,   -- NOT a copy of products.price
  PRIMARY KEY (order_id, product_id)
);
`),
    ),
    p(
      '`products.price` is *the price now*. `order_lines.unit_price` is *the price this customer paid on that day*. They are two different facts that happen to be equal at one instant, and when the product price changes the order must not change with it. There is no redundancy here at all — a **snapshot is not a cache**, and the same reasoning applies to the delivery address on a completed order and the tax rate on an issued invoice.',
    ),

    h('The order of things to try'),
    p('Denormalisation is near the end of this list, not the start of it:'),
    ul(
      '**1.** Add the right index. Most "slow join" problems are a missing index on the join column.',
      '**2.** Fix the query. `SELECT *`, an N+1 loop, or a function wrapped around an indexed column will each cost more than the join does.',
      '**3.** Cache the *result*, outside the database, with a TTL. Nothing in the schema changes and the copy expires on its own.',
      '**4.** Materialise the view. The database owns the copy and knows how to rebuild it.',
      '**5.** Denormalise a column, with a trigger and a repair job — and write down why, next to the column.',
    ),

    h('Interview'),
    asked([
      ['What is denormalisation?', 'Deliberately reintroducing redundancy into a normalised schema to speed up reads.'],
      ['When is it justified?', 'A measured slow read path, a read-heavy ratio, and a plan for keeping the copy in sync.'],
      ['What does it cost?', 'Slower writes, more storage, and the risk of the copies disagreeing.'],
      ['How do you keep a denormalised column correct?', 'Update it in the same transaction, or by trigger — plus a periodic repair job.'],
      ['Name a technique.', 'Duplicated column, precomputed aggregate, merged 1:1 tables, materialised view.'],
      ['Which is safest?', 'A materialised view — the database owns the copy and can rebuild it.'],
      [
        'Is storing the price on an order line denormalisation?',
        'No. It is a historical snapshot — a different fact from the current price, not a copy of it.',
      ],
      ['What should you try before denormalising?', 'An index, then the query itself, then a cache, then a materialised view.'],
      ['Why is a star schema denormalised?', 'It is built for scanning and aggregation, and it is a separate rebuilt copy, so redundancy costs nothing.'],
    ]),

    h('Cheatsheet'),
    cheat([
      ['A join is slow', 'Index the join column *first*'],
      ['An aggregate is slow and can be stale', 'A materialised view'],
      ['A count is needed on every page', 'A counter column, maintained in the same transaction'],
      ['A name is joined on every read', 'A duplicated column, plus a trigger — last resort'],
      ['Record what a customer paid', 'A snapshot column. Not denormalisation'],
      ['You denormalised something', 'Write the repair query, and a comment saying why'],
    ]),

    links(
      wiki('Denormalization', 'Denormalization'),
      wiki('Materialized_view', 'Materialized view'),
      wiki('Star_schema', 'Star schema'),
    ),
  ],
};
