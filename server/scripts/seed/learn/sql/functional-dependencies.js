import { asked, cheat, data, h, links, note, p, table, tip, ul, warn, wiki } from '../blocks.js';

/*
  The maths under normalisation, and the topic people skip — which is why they
  then have to memorise the normal forms instead of deriving them. Closure is
  taught as a procedure you can actually run on paper, because that is how it is
  asked: "compute the closure of AB".
*/
export const doc = {
  blocks: [
    p(
      'A **functional dependency** `X → Y` says: *if two rows agree on X, they must agree on Y.* Knowing X is enough to know Y. That is the entire definition, and every normal form in the next topic is stated in terms of it — which is why doing this one first turns normalisation from four rules to memorise into three rules you can derive.',
    ),
    p('Read `X → Y` as "X determines Y", or "Y is functionally dependent on X".'),

    h('On a table'),
    data(
      'enrolments — badly designed on purpose',
      ['student_id', 'student_name', 'course_id', 'course_name', 'instructor', 'grade'],
      [
        ['`1`', 'Ada', '`CS101`', 'Databases', 'Codd', '`A`'],
        ['`1`', 'Ada', '`CS102`', 'Networks', 'Cerf', '`B`'],
        ['`2`', 'Grace', '`CS101`', 'Databases', 'Codd', '`A`'],
        ['`3`', 'Linus', '`CS101`', 'Databases', 'Codd', '`C`'],
      ],
    ),
    p('The dependencies that hold here:'),
    table(
      ['dependency', 'reads as', 'why it holds'],
      [
        ['`student_id → student_name`', 'A student id determines the name.', 'Both rows with `1` say Ada.'],
        [
          '`course_id → course_name, instructor`',
          'A course id determines its name and who teaches it.',
          'All three `CS101` rows say Databases, Codd.',
        ],
        [
          '`{student_id, course_id} → grade`',
          'A student *and* a course determine one grade.',
          'Neither alone does — Ada has two grades, `CS101` has three.',
        ],
        ['`course_id → instructor`', 'Already implied by the second row.', 'Decomposition rule, below.'],
      ],
    ),
    note(
      'A functional dependency is a statement about the **world**, not about the rows you can see. `student_name → student_id` looks true in this table because no two students share a name — but two people can obviously be called Ada, so it does not hold. This is the same trap as reading keys off sample data, and it is the single most common way a normalisation answer goes wrong.',
    ),

    h('The vocabulary'),
    ul(
      '**Trivial** — `X → Y` where Y is part of X. `{a, b} → a`. Always true, never interesting.',
      '**Non-trivial** — Y is not part of X. These are the ones that matter.',
      '**Full functional dependency** — Y depends on *all* of X. Removing any attribute of X breaks it.',
      '**Partial dependency** — Y depends on only *part* of a composite key. `{student_id, course_id} → student_name` is partial, because `student_id` alone determines it. **This is what 2NF forbids.**',
      '**Transitive dependency** — `X → Y` and `Y → Z`, so `X → Z` indirectly, where Y is not a key. **This is what 3NF forbids.**',
    ),
    tip(
      'Those last two lines are the whole of the next topic. 2NF removes partial dependencies; 3NF removes transitive ones. If you can spot which of the two a table has, you can name the normal form it violates without recalling any definitions.',
    ),

    h('Armstrong’s axioms'),
    p(
      'Three rules that are sound and complete — every dependency that follows from a set can be derived using only these:',
    ),
    table(
      ['axiom', 'rule', 'in words'],
      [
        ['**Reflexivity**', 'If `Y ⊆ X` then `X → Y`', 'A set determines its own parts. Generates the trivial ones.'],
        ['**Augmentation**', 'If `X → Y` then `XZ → YZ`', 'Adding the same thing to both sides keeps it true.'],
        ['**Transitivity**', 'If `X → Y` and `Y → Z` then `X → Z`', 'Dependencies chain.'],
      ],
    ),
    p('Three more are derived from those, and are the ones you actually use:'),
    table(
      ['rule', 'says'],
      [
        ['**Union**', 'If `X → Y` and `X → Z` then `X → YZ`'],
        ['**Decomposition**', 'If `X → YZ` then `X → Y` and `X → Z`'],
        ['**Pseudo-transitivity**', 'If `X → Y` and `WY → Z` then `WX → Z`'],
      ],
    ),
    warn(
      'Decomposition works on the **right** side only. From `X → YZ` you may conclude `X → Y`. From `XY → Z` you may **not** conclude `X → Z` — that is the difference between a full and a partial dependency, and assuming it is the most common error in an exam answer.',
    ),

    h('Attribute closure — the procedure'),
    p(
      'The closure `X⁺` is every attribute you can reach from X. It answers both of the questions you actually need: *is X a key?* and *does this dependency hold?*',
    ),
    ul(
      '**1.** Start with `X⁺ = X`.',
      '**2.** Find any dependency `A → B` where `A ⊆ X⁺`. Add B to `X⁺`.',
      '**3.** Repeat until nothing new can be added.',
    ),
    p('Worked on the table above, with `F = { S → SN, C → CN, C → I, SC → G }`:'),
    table(
      ['step', 'using', 'closure so far'],
      [
        ['Start', '—', '`{S, C}`'],
        ['1', '`S → SN`', '`{S, C, SN}`'],
        ['2', '`C → CN`', '`{S, C, SN, CN}`'],
        ['3', '`C → I`', '`{S, C, SN, CN, I}`'],
        ['4', '`SC → G`', '`{S, C, SN, CN, I, G}` — everything'],
      ],
    ),
    p(
      '`{S, C}⁺` is every attribute, so **`{student_id, course_id}` is a super key**. Is it minimal? Check the parts: `{S}⁺ = {S, SN}` and `{C}⁺ = {C, CN, I}`. Neither is everything, so neither part suffices — **it is a candidate key.**',
    ),
    note(
      'That is the whole method for finding candidate keys, and it is worth being able to do on paper: compute the closure of each plausible set, keep the ones that reach every attribute, then discard any that still reach everything after you remove an attribute.',
    ),

    h('What the dependencies say about this table'),
    p(
      'The key is `{student_id, course_id}`. Now look at what else is in the table:',
    ),
    ul(
      '`student_id → student_name` — the left side is **half the key**. A partial dependency. **2NF violation.**',
      '`course_id → course_name, instructor` — also half the key. Also partial. **2NF violation.**',
      'And the consequence, visible in the data above: *Databases, Codd* is stored three times. Change the instructor and you must change three rows or the table starts disagreeing with itself.',
    ),
    p('The fix is the next topic, and it is now obvious what it has to be: split the table so each fact sits with its own determinant.'),

    h('Interview'),
    asked([
      ['What is a functional dependency?', '`X → Y` — any two rows agreeing on X must agree on Y.'],
      ['Trivial vs non-trivial?', 'Trivial means Y is contained in X, so it is automatically true.'],
      ['What is a partial dependency?', 'A non-key attribute depending on only part of a composite key. 2NF forbids it.'],
      ['What is a transitive dependency?', '`X → Y → Z` with Y not a key, so X determines Z indirectly. 3NF forbids it.'],
      ['State Armstrong’s axioms.', 'Reflexivity, augmentation, transitivity — sound and complete.'],
      ['What is attribute closure used for?', 'Testing whether a set is a super key, and whether a dependency is implied.'],
      ['How do you find candidate keys?', 'Compute closures; keep sets whose closure is everything and that are minimal.'],
      [
        'Can you read dependencies off sample data?',
        'No — a dependency is a rule about the world. Sample data can only *disprove* one.',
      ],
    ]),

    h('Cheatsheet'),
    cheat([
      ['Say "knowing this tells me that"', '`X → Y`'],
      ['Test whether X is a super key', 'Compute `X⁺`; it is a super key if that is every attribute'],
      ['Test whether X is a candidate key', '`X⁺` is everything, and no proper subset of X manages it'],
      ['Spot a 2NF violation', 'A non-key attribute determined by part of a composite key'],
      ['Spot a 3NF violation', 'A non-key attribute determined by another non-key attribute'],
      ['Disprove a claimed dependency', 'Two rows agreeing on X and disagreeing on Y'],
    ]),

    links(
      wiki('Functional_dependency', 'Functional dependency'),
      wiki('Armstrong%27s_axioms', "Armstrong's axioms"),
    ),
  ],
};
