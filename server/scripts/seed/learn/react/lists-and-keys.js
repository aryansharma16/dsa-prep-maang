import { cheat, code, h, js, jsx, links, note, p, reactDoc, table, tip, ul, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'React renders an array by rendering each element in it, which is why `.map()` is how you produce a list. Each item in that array needs a `key`: a string or number that identifies it among its siblings, stably, across renders.',
    ),
    p(
      'A key is not an id you are giving React for your own benefit. It is the answer to a question React has to ask on every update — "is this the same item as before, moved, or a different item?" — and the answer decides whether DOM nodes and component state are reused or destroyed.',
    ),

    h('The shape'),
    code(
      jsx(`
function TopicList({ topics }) {
  return (
    <ul>
      {topics.map((topic) => (
        <li key={topic.slug}>{topic.title}</li>
      ))}
    </ul>
  );
}
`),
    ),
    ul(
      'The key goes on the outermost element produced by the callback — the one that is actually in the array.',
      'It must be unique among siblings only, not globally.',
      'It is not a prop. `props.key` is undefined inside the child; pass the id again as its own prop if the child needs it.',
      'It must be stable: the same item must get the same key on every render.',
    ),

    h('Why the index is a bug'),
    p(
      'Using the array index means the key describes the *slot*, not the item. Insert at the front and every item shifts into a new slot, so React concludes that every item changed — while the DOM nodes and their state stay put in slots that now hold different data.',
    ),
    code(
      jsx(`
// Three inputs, each with its own uncontrolled text
{items.map((item, i) => <Row key={i} item={item} />)}

// Now prepend a new item:
//   slot 0  key 0  was "Alpha", is now "New"   <- React updates props only
//   slot 1  key 1  was "Beta",  is now "Alpha"
//   slot 2  key 2  was —        is now "Beta"
//
// The DOM node in slot 0 keeps whatever was typed into it, and React
// reuses the state of the component that used to be "Alpha" for "New".
`),
    ),
    warn(
      'The damage is invisible in a read-only list, which is why this survives review. It appears the moment a row holds state — a checkbox, an open/closed toggle, an uncontrolled input, a focused field, a CSS animation — and looks like data attaching itself to the wrong row.',
    ),
    p(
      'The index is safe in exactly one case: the list is never reordered, never filtered, never inserted into, and items are never removed except from the end. If you can guarantee all of that, and the items have no identity of their own, the index is fine.',
    ),

    h('Where to get a key'),
    table(
      ['Source', 'Verdict'],
      [
        ['A database id, slug, or uuid on the item', 'Best. Stable across sessions and re-fetches.'],
        ['A natural unique field — email, ISO date, file path', 'Fine, if it really is unique among siblings.'],
        ['An id generated when the item is created and stored with it', 'Fine — `crypto.randomUUID()` at creation time, kept in state.'],
        ['`Math.random()` or `crypto.randomUUID()` during render', 'Never. A new key every render means React destroys and rebuilds every row, every time.'],
        ['The array index', 'Only for a static, append-only list of stateless rows.'],
      ],
    ),
    code(
      js(`
// Wrong — new key on every render, so the whole list remounts constantly
{items.map((item) => <Row key={Math.random()} item={item} />)}

// Right — the id is created once, when the item is
function addItem(text) {
  setItems((prev) => [...prev, { id: crypto.randomUUID(), text }]);
}
`),
    ),

    h('Keys outside lists'),
    p(
      'Changing a key on a single element is the deliberate way to reset a subtree. React sees a different key at that position, unmounts the old component and mounts a fresh one, so all of its state is gone.',
    ),
    code(
      jsx(`
// Every field inside the form resets when a different user is selected —
// no effect, no manual reset of six state variables.
<ProfileForm key={userId} userId={userId} />
`),
    ),
    tip(
      'Reach for this before writing an effect that watches a prop and clears state. The effect version runs a render late, so the old user’s data is briefly on screen under the new user’s name.',
    ),

    h('Fragments in a list'),
    p(
      'When each item renders several siblings with no wrapper, the short `<>` syntax cannot take a key, so the long form is required.',
    ),
    code(
      jsx(`
import { Fragment } from 'react';

<dl>
  {entries.map((entry) => (
    <Fragment key={entry.term}>
      <dt>{entry.term}</dt>
      <dd>{entry.definition}</dd>
    </Fragment>
  ))}
</dl>
`),
    ),

    h('Filtering and flattening'),
    code(
      jsx(`
// filter before map — a map that returns null still occupies a slot
{topics
  .filter((topic) => topic.tags.includes(tag))
  .map((topic) => <TopicCard key={topic.slug} topic={topic} />)}

// Nested lists: keys are per-sibling-set, so the inner keys are independent
{sections.map((section) => (
  <section key={section.key}>
    {section.topics.map((topic) => (
      <TopicCard key={topic.slug} topic={topic} />
    ))}
  </section>
))}
`),
    ),
    note(
      'The inner `topic.slug` keys only need to be unique within their own section, but making them unique across the whole page costs nothing and removes the question.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Render a list', '`items.map((item) => <Row key={item.id} item={item} />)`'],
      ['No natural id', 'Generate one when the item is created and store it'],
      ['Several siblings per item', '`<Fragment key={...}>`'],
      ['Reset a component when something changes', 'Put that something in a `key`'],
      ['Silence the key warning', 'Do not — it is pointing at real reuse of the wrong node'],
    ]),

    links(
      reactDoc('learn/rendering-lists', 'Rendering lists'),
      reactDoc('learn/preserving-and-resetting-state', 'Preserving and resetting state'),
    ),
  ],
};
