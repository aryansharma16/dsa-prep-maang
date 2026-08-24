import { cheat, code, h, jsx, links, note, p, reactDoc, table, tip, ul, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'React is a library for building user interfaces out of components. You write what the screen should look like for a given piece of state, and React works out which DOM operations turn the current screen into that one. You never write the operations.',
    ),
    p(
      'That single sentence is the whole model, and almost every confusing thing about React is a consequence of it. Your component is not a thing that draws; it is a function React is allowed to call whenever it wants, as often as it wants, to ask what the UI should be right now.',
    ),

    h('An element is a plain object'),
    p(
      'Writing `<Button count={3} />` does not create a button. It creates a small, immutable object describing one — the type to render and the props to render it with. Nothing has touched the DOM at this point.',
    ),
    code(
      jsx(`
// What you write
<Button count={3}>Save</Button>

// Roughly what React has after JSX compiles
{
  type: Button,
  key: null,
  props: { count: 3, children: 'Save' }
}
`),
    ),
    p(
      'Because elements are cheap, describing the entire UI on every state change is affordable. That is what buys you the declarative model: you never diff anything by hand, because re-describing everything costs almost nothing.',
    ),

    h('The three phases'),
    p(
      'Every update — the first one and every one after — goes through the same three steps. Knowing which phase you are in explains most timing questions.',
    ),
    table(
      ['Phase', 'What happens', 'Can it be interrupted?'],
      [
        [
          'Trigger',
          'The initial `createRoot(...).render(...)`, or a state setter being called.',
          'n/a',
        ],
        [
          'Render',
          'React calls your components to produce an element tree, then compares it to the previous one. No DOM is touched.',
          'Yes — it can be paused, restarted or thrown away entirely.',
        ],
        [
          'Commit',
          'React applies the minimum set of DOM mutations, then runs refs and layout effects. The browser paints. Passive effects run after.',
          'No — it is synchronous and must finish.',
        ],
      ],
    ),
    warn(
      'The render phase can be run more than once for a single update, and its result thrown away. That is why your component must be pure: no fetching, no timers, no mutating anything outside itself while rendering. Side effects belong in an effect or an event handler, which only ever run during or after commit.',
    ),

    h('What reconciliation actually compares'),
    p(
      'Reconciliation is the diff. React walks the new element tree beside the previous one, position by position, and applies two rules that explain most surprising behaviour.',
    ),
    ul(
      '**Same type in the same position** — React keeps the existing DOM node and the existing component state, and only updates the props that changed.',
      '**Different type in the same position** — React destroys that whole subtree, state and all, and builds a new one from scratch.',
      '**Same position, different `key`** — treated as a different element, so the subtree is destroyed and rebuilt. This is the lever you have over the other two rules.',
    ),
    code(
      jsx(`
// The state inside <Panel> survives, because the type and position match.
{isWide ? <Panel width="wide" /> : <Panel width="narrow" />}

// The state inside <Panel> is destroyed, because the type at this position
// changed from a div to a section.
{isWide ? <div><Panel /></div> : <section><Panel /></section>}
`),
    ),
    tip(
      'React never compares two components by what is inside them. It compares by type and position in the tree. "Position" means where the element sits in the rendered output, not where it sits in your source file.',
    ),

    h('Fiber, and why it exists'),
    p(
      'Fiber is the internal data structure React keeps for each element in the tree — one fiber node per element, holding its type, props, state and pointers to its parent, first child and next sibling.',
    ),
    p(
      'The pointers are the point. Before fiber, rendering was a recursive walk, and a recursive walk lives on the JavaScript call stack, which cannot be paused. Rewriting the tree as a linked list moved that progress into a data structure React owns, so it can render part of a tree, hand control back to the browser to handle a keystroke, and pick up exactly where it left off. Everything labelled "concurrent" — `useTransition`, `useDeferredValue`, Suspense — is built on that ability.',
    ),
    note(
      'Fiber is an implementation detail. You will see the word in stack traces and profiler output, and it is worth recognising, but there is no fiber API to call.',
    ),

    h('Is the virtual DOM fast?'),
    p(
      'Not in the way the phrase suggests. Hand-written DOM updates that you know are minimal will always beat React doing a diff first — the diff is pure overhead against a perfect manual update.',
    ),
    p(
      'What the virtual DOM buys is that you never have to write the perfect manual update. It is fast *enough*, consistently, for code that describes the whole UI declaratively — which is a much easier thing to get right than a hand-maintained set of mutations that has to stay correct as the app grows.',
    ),
    warn(
      'This is why "React is slow" is nearly always the wrong diagnosis. The usual cause is a component re-rendering far more of the tree than it needs to, and the fix is in your code — see memo and performance — not in the diff.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Know why a component re-ran', 'A state or context it reads changed, or its parent re-rendered'],
      ['Keep state across an update', 'Keep the type and position stable — and the key, if there is one'],
      ['Deliberately reset state', 'Change the `key`'],
      ['Do something with the DOM', 'A ref plus an effect, never during render'],
      ['Do something with the network', 'An event handler if a user caused it, an effect if it is synchronisation'],
    ]),

    links(
      reactDoc('learn/render-and-commit', 'Render and commit'),
      reactDoc('learn/preserving-and-resetting-state', 'Preserving and resetting state'),
      reactDoc('learn/keeping-components-pure', 'Keeping components pure'),
    ),
  ],
};
