import { cheat, code, h, jsx, links, p, reactDoc, sig, table, tip, ul, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      '`useId` returns a unique string, stable for the life of the component instance, that is guaranteed to be identical on the server and on the client. It exists for one job: generating ids for accessibility attributes.',
    ),
    code(
      jsx(`
const id = useId();
<label htmlFor={id}>Email</label>
<input id={id} type="email" />
`),
    ),

    h('Signature'),
    sig([
      ['(no parameters)', '—', 'It takes nothing. An id is not derived from anything you pass.'],
      ['returns', '`string`', 'Something like `«r1»` — opaque, unique in the page, and containing characters that are legal in an id but not in a CSS selector.'],
    ]),

    h('Why not a counter or a random number'),
    p(
      'Because of server rendering. The server renders the markup, the client renders the same tree and compares — and any id produced by `Math.random()`, `Date.now()`, or a module-level counter differs between the two runs. That is a hydration mismatch, and it appears as a warning plus a subtree React has to re-render on the client.',
    ),
    p(
      '`useId` is derived from the component position in the tree, which is the one thing both renders agree on.',
    ),
    warn(
      'Do not use `useId` for list keys. A key must identify an *item* so it can follow that item as the list reorders; `useId` identifies a position in the tree, which is exactly the wrong thing. Use the data id — see lists and keys.',
    ),

    h('One id, several attributes'),
    p(
      'Calling `useId` several times in one component works but is wasteful. Generate one and suffix it — the result is still unique, and it reads better in devtools.',
    ),
    code(
      jsx(`
function PasswordField({ label }) {
  const id = useId();

  return (
    <div className="field">
      <label htmlFor={\`\${id}-input\`}>{label}</label>
      <input
        id={\`\${id}-input\`}
        type="password"
        aria-describedby={\`\${id}-hint \${id}-error\`}
      />
      <p id={\`\${id}-hint\`}>At least twelve characters.</p>
      <p id={\`\${id}-error\`} role="alert">{error}</p>
    </div>
  );
}
`),
    ),

    h('Where ids are actually required'),
    table(
      ['Attribute', 'What it does'],
      [
        ['`htmlFor` / `id`', 'Ties a label to its input. Clicking the label focuses the field, and a screen reader announces it.'],
        ['`aria-describedby`', 'Points at hint or error text. Takes a space-separated list of ids.'],
        ['`aria-labelledby`', 'Points at an element that labels this one — a dialog title, for instance.'],
        ['`aria-controls`', 'Ties a trigger to the region it opens.'],
        ['`aria-activedescendant`', 'Marks the active option in a combobox.'],
      ],
    ),
    tip(
      'When the label wraps the input, no id is needed at all: `<label>Email <input /></label>` is already associated. `useId` is for the cases where the markup cannot nest.',
    ),

    h('Two React apps on one page'),
    p(
      'Ids are unique within one root. Two independent React apps on the same page can generate the same id, so pass a different prefix to each root.',
    ),
    code(
      jsx(`
createRoot(nodeA, { identifierPrefix: 'app-a-' }).render(<AppA />);
createRoot(nodeB, { identifierPrefix: 'app-b-' }).render(<AppB />);
`),
    ),

    h('Watch for'),
    ul(
      'The format is opaque and may change between React versions — never parse it or depend on its shape.',
      'It contains colons in React 18, which are legal in HTML ids but need escaping in `querySelector`. Prefer a ref over a selector.',
      'It is stable per component instance, so a component that remounts gets a new one. That is correct: it is a different instance.',
      'React 19 adds `useId` variants under discussion for view transitions; the core behaviour above is unchanged.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Label an input', '`useId()` once, used by `htmlFor` and `id`'],
      ['Several ids in one component', 'One `useId`, then suffix it'],
      ['Describe a field with hint text', '`aria-describedby` pointing at the suffixed id'],
      ['A list key', 'Not this — use the item id'],
      ['Two React roots on a page', '`identifierPrefix` per root'],
      ['Label that wraps the input', 'No id needed'],
    ]),

    links(
      reactDoc('reference/react/useId', 'useId'),
      reactDoc('reference/react-dom/client/createRoot', 'createRoot'),
    ),
  ],
};
