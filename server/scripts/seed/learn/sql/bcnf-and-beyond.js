import { asked, cheat, data, h, links, note, p, table, tip, ul, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      '3NF lets one case through, and **BCNF** — Boyce–Codd normal form — closes it. The difference is small, it is asked about often, and the honest version of the answer includes the fact that closing it sometimes costs you something you would rather have kept.',
    ),

    h('The definition, and why it is simpler'),
    p(
      'A table is in **BCNF** when, for every non-trivial dependency `X → Y`, **X is a super key.** That is the whole rule. No special cases, no clause about non-key attributes.',
    ),
    p('Compare it with 3NF, which permits `X → Y` if *either*:'),
    ul('X is a super key, **or**', 'every attribute of Y is part of *some* candidate key — a "prime attribute".'),
    p(
      'That second escape clause is the entire gap. BCNF deletes it, which is why BCNF is both stricter and easier to state.',
    ),
    note(
      'Every BCNF table is in 3NF. Not every 3NF table is in BCNF. The gap only opens up when a table has **overlapping composite candidate keys** — which is rare enough that most real schemas in 3NF are already in BCNF without anyone checking.',
    ),

    h('The table that is 3NF and not BCNF'),
    p(
      'The classic. A student takes a subject, and is assigned one teacher for it. Each teacher teaches exactly one subject.',
    ),
    data(
      'teaching',
      ['student', 'subject', 'teacher'],
      [
        ['Ada', 'Databases', 'Codd'],
        ['Ada', 'Networks', 'Cerf'],
        ['Grace', 'Databases', 'Codd'],
        ['Linus', 'Databases', 'Date'],
      ],
    ),
    p('Two rules hold:'),
    ul(
      '`{student, subject} → teacher` — a student has one teacher per subject.',
      '`teacher → subject` — a teacher only ever teaches one subject.',
    ),
    p('So the candidate keys are `{student, subject}` and `{student, teacher}`. They **overlap** on `student`, and every attribute is part of some candidate key.'),
    table(
      ['check', 'verdict'],
      [
        ['1NF', 'Yes — atomic values throughout.'],
        ['2NF', 'Yes — `teacher` depends on both parts of `{student, subject}`.'],
        [
          '3NF',
          'Yes. The offending dependency `teacher → subject` is allowed because `subject` is a prime attribute — it is part of the candidate key `{student, subject}`.',
        ],
        [
          'BCNF',
          '**No.** `teacher → subject` has `teacher` on the left, and `teacher` alone is not a super key.',
        ],
      ],
    ),
    p('And the redundancy is real, not theoretical. *Codd teaches Databases* is stored twice. Correct him to a different subject and there are two rows to change, with a window in between where the table contradicts itself.'),

    h('Decomposing it'),
    p('Split on the offending dependency — put `teacher → subject` in its own table, and leave the rest:'),
    data('teaches', ['teacher', 'subject'], [['Codd', 'Databases'], ['Cerf', 'Networks'], ['Date', 'Databases']]),
    data(
      'studies',
      ['student', 'teacher'],
      [['Ada', 'Codd'], ['Ada', 'Cerf'], ['Grace', 'Codd'], ['Linus', 'Date']],
    ),
    p('Both are in BCNF. Every fact appears once. But something has been lost:'),
    warn(
      'The original constraint `{student, subject} → teacher` — "a student has only one teacher per subject" — can no longer be enforced by either table on its own. Nothing now stops inserting `(Ada, Date)`, which would give Ada two Databases teachers. Checking it requires joining the two tables back together.',
    ),

    h('Lossless, and dependency-preserving'),
    p('Two properties a decomposition can have. The first is compulsory; the second is desirable and not always available.'),
    table(
      ['property', 'means', 'how to test'],
      [
        [
          '**Lossless join**',
          'Joining the pieces back gives exactly the original rows — no more, no fewer. **Non-negotiable.** A lossy decomposition invents rows that were never there.',
          'The shared attributes must be a super key of at least one of the pieces.',
        ],
        [
          '**Dependency preserving**',
          'Every original dependency can still be checked within a single table, without a join.',
          'Every FD’s attributes must all sit together in some piece.',
        ],
      ],
    ),
    p('Our split above is lossless — `teacher` is the key of `teaches` — but **not** dependency preserving, and that is the trade:'),
    table(
      ['', '3NF', 'BCNF'],
      [
        ['Always achievable', 'Yes', 'Yes'],
        ['Always lossless', 'Yes', 'Yes'],
        ['Always dependency preserving', '**Yes**', '**No**'],
        ['Removes all FD-based redundancy', 'No — the prime-attribute case survives', 'Yes'],
      ],
    ),
    tip(
      'That table is the answer to "3NF or BCNF?" and it is a genuine trade rather than a right answer. You can always have a decomposition that is 3NF, lossless *and* dependency preserving. You cannot always have all three with BCNF. So: go to BCNF when you can; stop at 3NF when reaching BCNF would scatter a constraint you actually need enforced.',
    ),

    h('Testing losslessness'),
    p(
      'For a split into two tables R1 and R2, the decomposition is lossless if the attributes they share form a super key of R1 or of R2. Formally: `(R1 ∩ R2) → R1` or `(R1 ∩ R2) → R2`.',
    ),
    p(
      'In our case R1 ∩ R2 = `{teacher}`, and `teacher → subject` means `{teacher}` is the key of `teaches`. Lossless.',
    ),
    p(
      'A counter-example makes the failure concrete. Split `teaching` into `(student, subject)` and `(subject, teacher)` instead. They share `subject`, which is a key of neither. Join them back and Ada — who studies Databases — pairs with *every* Databases teacher, including Date. **Rows appear that were never in the original.** That is what "lossy" means, and note that it loses information by *gaining* rows.',
    ),

    h('4NF and 5NF, briefly'),
    p(
      'Worth being able to name, and almost never worth applying. Both deal with redundancy that functional dependencies cannot express.',
    ),
    ul(
      '**4NF** — no non-trivial **multivalued dependencies** unless the determinant is a super key. A multivalued dependency arises when a table records two *independent* multi-valued facts about the same key. A person with 2 phone numbers and 3 skills, in one table, forces 6 rows, and the phone repeats per skill for no reason. Fix: two tables. In practice you avoid 4NF violations by never putting two unrelated one-to-many relationships in one table.',
      '**5NF** (project-join normal form) — the table cannot be split into smaller pieces that rejoin losslessly. It concerns join dependencies that no pair of tables captures, and it is genuinely rare.',
      '**6NF** — one non-key attribute per table. Used in temporal databases and anti-corruption layers. You will not meet it.',
    ),
    note(
      'The correct thing to say about 4NF and 5NF in an interview is that you know what they address and that 3NF or BCNF is where real schemas stop. Claiming to routinely normalise to 5NF invites a follow-up question you do not want.',
    ),

    h('Interview'),
    asked([
      ['Define BCNF.', 'For every non-trivial dependency `X → Y`, X is a super key.'],
      ['How is BCNF stricter than 3NF?', '3NF allows `X → Y` when Y is a prime attribute even if X is not a super key. BCNF does not.'],
      ['When do the two differ?', 'Only with overlapping composite candidate keys — rare in practice.'],
      ['Is every 3NF table in BCNF?', 'No. Every BCNF table is in 3NF.'],
      ['What is a lossless decomposition?', 'One where rejoining the pieces reproduces the original rows exactly.'],
      ['How do you test for it?', 'The shared attributes must be a super key of at least one piece.'],
      ['What does dependency preserving mean?', 'Every original FD can still be checked inside one table, without a join.'],
      ['What is the BCNF trade-off?', 'BCNF is always lossless but not always dependency preserving; 3NF can always be both.'],
      ['What is 4NF about?', 'Multivalued dependencies — two independent one-to-many facts crammed into one table.'],
      ['How far do you normalise in practice?', '3NF or BCNF, then denormalise deliberately where a measured read path needs it.'],
    ]),

    h('Cheatsheet'),
    cheat([
      ['State BCNF in one line', 'Every determinant is a super key'],
      ['Spot the 3NF-but-not-BCNF case', 'Overlapping composite candidate keys'],
      ['Check a decomposition is safe', 'Shared attributes are a super key of one side'],
      ['Two independent one-to-many facts in one table', '4NF violation → two tables'],
      ['Decide how far to go', '3NF always; BCNF unless it scatters a constraint you need'],
    ]),

    links(
      wiki('Boyce–Codd_normal_form', 'Boyce–Codd normal form'),
      wiki('Fourth_normal_form', 'Fourth normal form'),
      wiki('Lossless_join_decomposition', 'Lossless join decomposition'),
    ),
  ],
};
