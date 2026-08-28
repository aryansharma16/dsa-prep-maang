import { asked, cheat, code, h, links, note, p, sql, table, ul, wiki } from '../blocks.js';

/*
  History, and it earns its place for one reason: the relational model's design
  decisions look arbitrary until you know what they were a reaction to. "Why can
  I not just store a pointer" is a much better question once you have seen a
  database where you could.
*/
export const doc = {
  blocks: [
    p(
      'A **data model** is a way of describing what data looks like and how pieces of it connect. Four have mattered, and only one is worth learning properly — but the other three explain *why* the relational model is shaped the way it is, and one of them is coming back under a different name.',
    ),

    h('Hierarchical — a tree'),
    p(
      'IBM IMS, 1966. Data is a tree: a parent record owns child records, and you reach a record by walking down from the root. A department owns its employees.',
    ),
    ul(
      '**Good at** — the one shape it was built for. Walking down is fast, because the path is the storage.',
      '**Fatal flaw** — an employee has exactly one parent. Model an employee who splits time between two departments and you must either duplicate the employee record or redesign the tree. Many-to-many is not expressible.',
      '**Second flaw** — the query is the navigation. "Everyone in Hyderabad" means writing a traversal, by hand, in application code.',
    ),

    h('Network — a graph'),
    p(
      'CODASYL, 1969. The fix for the first flaw: a record may have many parents, and records are linked by explicit pointers called *sets*. Many-to-many now works.',
    ),
    ul(
      '**Good at** — expressing any relationship, and fast, because a link is a pointer to follow.',
      '**Fatal flaw** — the programmer navigates. There is no query language; there is an API for "find owner", "find next member", and your program is a loop. Change the structure and every program that walked it breaks.',
    ),
    note(
      'Both of these are called **navigational** models, and that is the word the interview wants. The programmer follows a path the schema designer laid down. It is fast on the anticipated question and useless on any other — which is problem three from the file-system topic, in a more expensive form.',
    ),

    h('Relational — a set of tables'),
    p(
      "Edgar Codd, IBM, 1970, in a paper called *A Relational Model of Data for Large Shared Data Banks*. The idea that changed everything is one sentence: **throw away the pointers and connect records by their values instead.**",
    ),
    p(
      'There is no link from `employees` to `departments`. There is a column holding a number, and a rule saying that number must exist over there. The connection is *computed*, at query time, by whatever query wants it:',
    ),
    code(
      sql(`
SELECT e.name, d.name AS department
FROM employees e
JOIN departments d ON e.dept_id = d.id;
`),
    ),
    p('Three things follow from that, and they are why it won:'),
    ul(
      '**Any question, without a new structure.** Joining on values means a relationship nobody designed for is still queryable. The hierarchical and network models had to be *told* about a relationship in advance.',
      '**Declarative querying.** You say what you want, not how to get it. That leaves the *how* to the optimiser, which can change its mind as the data grows — and is why physical data independence is possible at all.',
      '**A theory underneath.** Relational algebra gives an optimiser rules it can prove are safe, so it can rewrite your query into a faster one that returns identical rows.',
    ),

    h('The four, compared'),
    table(
      ['model', 'structure', 'many-to-many', 'how you query', 'status'],
      [
        ['Hierarchical', 'Tree', 'No', 'Navigate the tree in code', 'Legacy — IMS still runs in banks'],
        ['Network', 'Graph of pointers', 'Yes', 'Follow pointers in code', 'Gone'],
        [
          'Relational',
          'Tables joined on values',
          'Yes, via a junction table',
          '`SELECT` — declarative',
          'Dominant',
        ],
        [
          'Object-oriented',
          'Objects with identity and inheritance',
          'Yes',
          "The language's own",
          'Niche; the ideas survive in ORMs',
        ],
        [
          'Document',
          'Nested JSON documents',
          'By embedding or by reference',
          "Each product's API",
          'Common — the hierarchical model, returned',
        ],
      ],
    ),
    note(
      'The last row is worth noticing out loud in an interview. A document database is a tree of nested records reached by a path, which is the hierarchical model with better tooling. It has the same strength — the anticipated access pattern is very fast — and the same weakness, which is that the second access pattern is a redesign. That is not an argument against it; it is the trade being made.',
    ),

    h('And the ER model, which is none of these'),
    p(
      'The **entity–relationship model** (Chen, 1976) sits at a different level and gets mixed into this list constantly. It is not a way of *storing* data — no DBMS implements it. It is a way of *designing* on paper, before choosing tables: entities, their attributes, and the relationships between them. You draw an ER diagram, then mechanically convert it into relational tables. That conversion is a topic of its own two pages down.',
    ),

    h('Interview'),
    asked([
      [
        'Name the data models.',
        'Hierarchical, network, relational, object-oriented — plus document as the modern descendant of the first.',
      ],
      [
        "What is the hierarchical model's limitation?",
        'One parent per record, so many-to-many cannot be expressed.',
      ],
      ['What is a navigational model?', 'One where the programmer follows pointers or paths by hand rather than declaring a query.'],
      [
        'Why did relational win?',
        'Values instead of pointers, so any relationship is queryable, and a declarative language, so the optimiser owns the plan.',
      ],
      ['Who proposed it and when?', 'Edgar F. Codd, at IBM, in 1970.'],
      [
        'Is the ER model a data model?',
        'A conceptual design model, not a storage one. You convert an ER diagram into relational tables.',
      ],
      [
        'How is a document database like the hierarchical model?',
        'Both nest records in a tree reached by a path — fast on the anticipated query, a redesign for the next one.',
      ],
    ]),

    h('Cheatsheet'),
    cheat([
      ['Design before choosing tables', 'The ER model, on paper'],
      ['Connect two tables', 'A foreign key holding a *value*, never a pointer'],
      ['Express many-to-many', 'A junction table — the relational answer to the tree'],
      ['Explain why SQL is declarative', 'Relational algebra gives the optimiser provable rewrites'],
    ]),

    links(
      wiki('Relational_model', 'Relational model'),
      wiki('Hierarchical_database_model', 'Hierarchical model'),
      wiki('Edgar_F._Codd', 'Edgar F. Codd'),
    ),
  ],
};
