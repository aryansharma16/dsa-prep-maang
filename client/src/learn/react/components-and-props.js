import { cheat, code, h, jsx, links, note, p, reactDoc, table, tip, ul, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'A component is a JavaScript function that takes one argument — its props — and returns markup. The name must start with a capital letter, because that is how the JSX compiler tells a component apart from a DOM tag.',
    ),
    p(
      'Props are how a parent passes data down. They arrive as a single object, and the convention is to destructure it in the parameter list so the signature reads as the list of inputs.',
    ),
    code(
      jsx(`
function Avatar({ user, size = 40, rounded = true }) {
  return (
    <img
      src={user.avatarUrl}
      alt={user.name}
      width={size}
      height={size}
      className={rounded ? 'round' : ''}
    />
  );
}

// The parent chooses the values
<Avatar user={me} size={64} />
`),
    ),
    tip(
      'Default values go in the destructuring, not in a `defaultProps` object. `defaultProps` on a function component is removed in React 19.',
    ),

    h('Props are read-only'),
    p(
      'A component must never modify the props it received. This is not a stylistic rule — it is the purity requirement that makes the render phase safe to run twice, or to abandon halfway.',
    ),
    code(
      jsx(`
// Wrong. The object belongs to the parent, and mutating it changes what the
// parent sees without telling React anything happened.
function Row({ item }) {
  item.seen = true;
  return <li>{item.title}</li>;
}

// Right. Ask the parent to change it.
function Row({ item, onSee }) {
  return <li onClick={() => onSee(item.id)}>{item.title}</li>;
}
`),
    ),
    p(
      'Data flows one way: down through props, and back up through callbacks the parent passed in. When two components need the same value, it belongs to their nearest common parent — see lifting state.',
    ),

    h('children'),
    p(
      '`children` is an ordinary prop with one piece of syntax sugar: whatever you nest inside a component tag becomes its value. That is what makes wrappers possible without the wrapper knowing anything about what it wraps.',
    ),
    code(
      jsx(`
function Panel({ title, children, footer }) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      <div className="panel-body">{children}</div>
      {footer && <div className="panel-foot">{footer}</div>}
    </section>
  );
}

<Panel title="Filters" footer={<button>Reset</button>}>
  <SearchBox />
  <TagList />
</Panel>
`),
    ),
    p(
      'Nothing stops you passing JSX through any prop, as `footer` does here. `children` is only the one that gets the nesting syntax, so use it for the main slot and named props for the rest.',
    ),

    h('Spreading props'),
    code(
      jsx(`
// Forwards everything it was given, plus its own className
function Field({ label, className = '', ...rest }) {
  return (
    <label className={\`field \${className}\`}>
      <span>{label}</span>
      <input {...rest} />
    </label>
  );
}

<Field label="Email" type="email" required autoFocus />
`),
    ),
    warn(
      'Spreading is convenient and hides the interface. `<Row {...props} />` where `props` came from somewhere else means nobody reading the file can tell what `Row` receives. Use it for genuine pass-through wrappers, not to save typing.',
    ),

    h('What can be a prop'),
    table(
      ['Kind', 'Example', 'Watch for'],
      [
        ['String', '`title="Save"`', 'No braces needed for a literal.'],
        ['Number, boolean, object, array', '`count={3}`, `style={{ top: 0 }}`', 'Braces always. A bare `isOpen` means `isOpen={true}`.'],
        ['Function', '`onSave={handleSave}`', 'Pass the function, do not call it — `onSave={handleSave()}` runs it during render.'],
        ['JSX', '`icon={<IconStar />}`', 'An element is just a value.'],
        ['A component itself', '`as={Link}`, `Icon={IconStar}`', 'Capitalise the variable before using it as a tag.'],
      ],
    ),
    warn(
      'An object or array literal in JSX is a *new value on every render*. That is harmless for a plain DOM node and matters the moment the child is wrapped in `memo` or the value ends up in a dependency array. See memo and performance.',
    ),

    h('Rendering a component from a prop'),
    code(
      jsx(`
// The variable has to be capitalised for JSX to treat it as a component.
function Tile({ Icon, label }) {
  return (
    <div className="tile">
      <Icon size={16} />
      {label}
    </div>
  );
}

<Tile Icon={IconChart} label="Stats" />
`),
    ),
    note(
      'This is the pattern the sidebar in this app uses: `MODULE_NAV` stores an `Icon` on each entry and the nav renders `<Icon size={14} />`.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Give a prop a default', 'Destructure with `=` in the signature'],
      ['Accept arbitrary content', 'The `children` prop'],
      ['Accept several slots of content', 'Named props holding JSX'],
      ['Let a child change something', 'Pass a callback down; the parent owns the state'],
      ['Forward unknown props to a DOM node', '`...rest` and `{...rest}`'],
      ['Pass a component, not an element', 'Capitalise the prop name — `Icon`, not `icon`'],
    ]),
    ul(
      'A component that returns `null` renders nothing, and that is a normal thing to do.',
      'Never define a component inside another component. Each render creates a new function identity, so React sees a different type at that position and destroys the subtree and its state on every render.',
    ),

    links(
      reactDoc('learn/passing-props-to-a-component', 'Passing props to a component'),
      reactDoc('learn/your-first-component', 'Your first component'),
      reactDoc('learn/keeping-components-pure', 'Keeping components pure'),
    ),
  ],
};
