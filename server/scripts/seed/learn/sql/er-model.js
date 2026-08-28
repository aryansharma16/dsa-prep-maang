import { asked, cheat, code, h, links, note, p, sql, table, tip, ul, warn, wiki } from '../blocks.js';

/*
  ER diagrams are drawings, and this is a text file, so the shapes are described
  rather than drawn — which turns out to be the right call anyway: an interview
  asks you to *name* the notation ("that's a double ellipse, so it's
  multivalued"), and a reader who can name it can draw it.
*/
export const doc = {
  blocks: [
    p(
      'The **entity–relationship model** is how you design a schema before you have any tables. You describe the world as **entities** (the things), **attributes** (what you know about each thing) and **relationships** (how they connect), and then convert that mechanically into tables. Peter Chen, 1976.',
    ),
    p(
      'It is a design tool and not a storage model — no DBMS stores an ER diagram. Its value is that it is much cheaper to notice a mistake in a drawing than in a schema with three million rows in it.',
    ),

    h('Entity'),
    p(
      'A thing you need to keep facts about, distinguishable from every other thing of its kind. An **entity type** is the category — `Employee`; an **entity instance** is one of them — Ada. Drawn as a **rectangle**.',
    ),
    p(
      'The test for "is this an entity or an attribute" is whether it has facts of its own. `department` looks like an attribute of an employee until you need the department\'s location, budget and head — at which point it has become an entity.',
    ),

    h('Attribute — the six kinds'),
    p(
      'Drawn as **ellipses** hanging off the entity. The notation carries the type, and being able to read it back is most of what gets asked.',
    ),
    table(
      ['kind', 'notation', 'means', 'example'],
      [
        ['**Simple** (atomic)', 'Plain ellipse', 'Cannot be broken down usefully.', '`salary`, `hired_on`'],
        [
          '**Composite**',
          'Ellipse with child ellipses',
          'Made of parts you might want separately.',
          '`address` → street, city, pincode',
        ],
        [
          '**Single-valued**',
          'Plain ellipse',
          'Exactly one value per instance.',
          '`date_of_birth`',
        ],
        [
          '**Multivalued**',
          '**Double** ellipse',
          'Several values per instance.',
          '`phone_numbers`, `skills`',
        ],
        [
          '**Derived**',
          '**Dashed** ellipse',
          'Computable from something else, so not stored.',
          '`age`, from `date_of_birth`',
        ],
        [
          '**Key**',
          '**Underlined** label',
          'Identifies the instance uniquely.',
          '`employee_id`',
        ],
      ],
    ),
    tip(
      'Two of those become tables rather than columns when you convert the diagram, and it catches people out. A **multivalued** attribute becomes its own table — one row per value — because a column holding "three phone numbers" violates 1NF. A **composite** attribute becomes several columns, one per leaf. A **derived** attribute becomes no column at all, unless you decide to denormalise on purpose.',
    ),

    h('Strong and weak entities'),
    p(
      'A **strong** entity has a key of its own. `Employee` has `employee_id`; that is enough to find exactly one of them, forever.',
    ),
    p(
      'A **weak** entity does not. It only makes sense in the context of an owner, and it is identified by the owner\'s key plus a **partial key** (a **discriminator**) that is unique only within that owner. The classic example is a dependant: "child number 2" means nothing on its own, and means exactly one person once you say whose.',
    ),
    ul(
      'Weak entity — **double rectangle**.',
      'Its relationship to the owner (the **identifying relationship**) — **double diamond**.',
      'Its partial key — **dashed underline**.',
      'It always has **total participation** in the identifying relationship: a dependant with no employee cannot exist.',
    ),
    code(
      sql(`
-- A weak entity: the key is the owner's key plus the discriminator.
CREATE TABLE dependants (
  employee_id INT NOT NULL,
  seq         INT NOT NULL,              -- the partial key
  name        VARCHAR(50) NOT NULL,
  relation    VARCHAR(20),
  PRIMARY KEY (employee_id, seq),        -- composite: owner + discriminator
  FOREIGN KEY (employee_id)
    REFERENCES employees(id) ON DELETE CASCADE   -- existence depends on the owner
);
`),
    ),
    note(
      '`ON DELETE CASCADE` is not an optional flourish here — it is the weak entity\'s definition expressed in SQL. If the owner can go while the dependant stays, it was never weak.',
    ),

    h('Reading the whole notation'),
    table(
      ['shape', 'means'],
      [
        ['Rectangle', 'Entity'],
        ['**Double** rectangle', 'Weak entity'],
        ['Ellipse', 'Attribute'],
        ['**Double** ellipse', 'Multivalued attribute'],
        ['**Dashed** ellipse', 'Derived attribute'],
        ['Underlined label', 'Key attribute'],
        ['**Dashed** underline', 'Partial key of a weak entity'],
        ['Diamond', 'Relationship'],
        ['**Double** diamond', 'Identifying relationship'],
        ['Single line', 'Partial participation — *may* take part'],
        ['**Double** line', 'Total participation — *must* take part'],
      ],
    ),

    h('A worked design'),
    p('"Employees work in departments. A department has one head. Employees have skills and dependants."'),
    ul(
      '**Entities** — `Employee` (strong), `Department` (strong), `Dependant` (weak, owned by Employee).',
      '**Attributes of Employee** — `id` (key), `name`, `date_of_birth`, `age` (derived), `address` (composite), `skills` (multivalued).',
      '**Relationships** — `WORKS_IN` between Employee and Department; `HEADS` between Employee and Department; `HAS_DEPENDANT`, identifying, between Employee and Dependant.',
    ),
    p(
      'Note that `Employee` and `Department` are joined by **two** different relationships. That is normal and it is the thing beginners collapse into one — "works in" and "heads" are different facts and become different columns.',
    ),

    h('Extended ER — the three you should be able to name'),
    ul(
      '**Specialisation / generalisation** — `Employee` splits into `Contractor` and `Permanent`. Drawn with a triangle marked ISA. Specialisation is top-down (splitting), generalisation is bottom-up (noticing two entities share a parent). Same picture, opposite direction of thought.',
      '**Aggregation** — treating a whole relationship as if it were an entity, so another relationship can point at it. Needed when a fact is *about* a relationship: "this employee worked on this project, and that assignment was approved by this manager".',
      '**Disjoint vs overlapping** — can an instance be in two subclasses at once? Marked `d` or `o` on the triangle.',
    ),

    h('The mistakes people make'),
    warn(
      '**Making an attribute an entity, or the reverse.** Ask whether the thing has attributes of its own and whether it is referenced from more than one place. If yes to either, it is an entity. `city` as a plain string is an attribute right up until you need its state and timezone.',
    ),
    warn(
      '**Putting a relationship attribute on an entity.** `start_date` for an employee working in a department belongs on `WORKS_IN`, not on `Employee` — the moment someone can move departments, an attribute on the entity has nowhere to put the second date.',
    ),

    h('Interview'),
    asked([
      ['What is an entity?', 'A distinguishable thing you store facts about — one rectangle in the diagram.'],
      [
        'Entity type vs entity instance?',
        'The category (`Employee`) versus one member of it (Ada).',
      ],
      [
        'What is a weak entity?',
        'One with no key of its own, identified by its owner’s key plus a partial key, with total participation in an identifying relationship.',
      ],
      [
        'How is a weak entity drawn?',
        'Double rectangle, double diamond for the identifying relationship, dashed underline on the partial key.',
      ],
      [
        'What is a multivalued attribute and how is it stored?',
        'Double ellipse; it becomes its own table, because a column holding several values breaks 1NF.',
      ],
      [
        'What is a derived attribute?',
        'One computable from others — dashed ellipse — normally not stored at all.',
      ],
      [
        'Specialisation vs generalisation?',
        'Same ISA hierarchy; specialisation splits a parent downwards, generalisation abstracts children upwards.',
      ],
      [
        'What is aggregation in an ER diagram?',
        'Treating a relationship as an entity so another relationship can refer to it.',
      ],
    ]),

    h('Cheatsheet'),
    cheat([
      ['Store several phone numbers', 'A multivalued attribute → its own table'],
      ['Store an address you will search by city', 'A composite attribute → one column per part'],
      ['Store age', 'A derived attribute → store the birth date, compute the age'],
      ['Model an order line, an invoice line, a dependant', 'A weak entity, keyed on owner + sequence'],
      ['Record when someone joined their department', 'An attribute on the *relationship*, not the entity'],
    ]),

    links(wiki('Entity–relationship_model', 'Entity–relationship model'), wiki('Peter_Chen', 'Peter Chen')),
  ],
};
