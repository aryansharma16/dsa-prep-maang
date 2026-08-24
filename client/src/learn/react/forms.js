import { cheat, code, h, js, jsx, links, note, p, reactDoc, table, tip, ul, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'A DOM input keeps its own value. A **controlled** input gives that job to React: you pass `value` and an `onChange`, and the input can only ever display what state says it should. An **uncontrolled** input keeps its own value and you read it when you need it.',
    ),
    p(
      'Controlled is the default choice, because it makes the value available to render — for validation, for a character count, for a disabled submit button. Uncontrolled is the lighter option when nothing needs to react to each keystroke.',
    ),

    h('Controlled'),
    code(
      jsx(`
function SearchBox() {
  const [query, setQuery] = useState('');

  return (
    <>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter topics"
      />
      {query.length > 40 && <p className="hint">That is a long search.</p>}
    </>
  );
}
`),
    ),
    p(
      'The loop is: keystroke fires `onChange`, state updates, React re-renders, the input receives the new `value`. The DOM input is never the source of truth, which is why you can transform on the way in — uppercase it, strip spaces, cap the length — and the field simply obeys.',
    ),
    warn(
      'Passing `value` without `onChange` makes a permanently read-only field, and React warns about it. Use `readOnly` if that is what you meant, or `defaultValue` if you wanted an uncontrolled field with a starting value.',
    ),

    h('Uncontrolled'),
    code(
      jsx(`
function ContactForm({ onSave }) {
  const nameRef = useRef(null);

  function handleSubmit(e) {
    e.preventDefault();
    onSave({ name: nameRef.current.value });
  }

  return (
    <form onSubmit={handleSubmit}>
      <input ref={nameRef} defaultValue="" name="name" />
      <button type="submit">Save</button>
    </form>
  );
}
`),
    ),
    tip(
      'For a whole form, `new FormData(e.currentTarget)` is usually better than a ref per field — every input with a `name` is in it, and no ref is needed at all.',
    ),
    code(
      js(`
function handleSubmit(e) {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.currentTarget));
  onSave(data); // { name: '...', email: '...' }
}
`),
    ),

    h('Controlled or uncontrolled — pick per field'),
    table(
      ['Situation', 'Choose'],
      [
        ['Live validation, character count, or a dependent field', 'Controlled'],
        ['Disable submit until the form is valid', 'Controlled'],
        ['Format or restrict input as it is typed', 'Controlled'],
        ['A large form where nothing depends on each keystroke', 'Uncontrolled + `FormData`'],
        ['Integrating a non-React widget', 'Uncontrolled, with a ref'],
        ['File input', 'Uncontrolled — `value` cannot be set programmatically'],
      ],
    ),
    warn(
      'Never switch a field from one to the other. `useState(props.value)` where `props.value` starts as `undefined` gives an uncontrolled input that becomes controlled the moment data arrives, and React warns. Initialise with `useState(props.value ?? \'\')`.',
    ),

    h('The other input types'),
    code(
      jsx(`
// Checkbox — checked, not value
<input type="checkbox" checked={done} onChange={(e) => setDone(e.target.checked)} />

// Radio group — same name, compare against the group value
<input type="radio" name="size" value="sm" checked={size === 'sm'} onChange={(e) => setSize(e.target.value)} />

// Select — value on the select, never selected on the option
<select value={sort} onChange={(e) => setSort(e.target.value)}>
  <option value="new">Newest</option>
  <option value="old">Oldest</option>
</select>

// Multi-select — value is an array
<select multiple value={tags} onChange={(e) =>
  setTags([...e.target.selectedOptions].map((o) => o.value))
} />

// Textarea — children are not the value
<textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
`),
    ),

    h('One state object for many fields'),
    code(
      jsx(`
const [form, setForm] = useState({ name: '', email: '' });

// One handler for every field, keyed by the input name
const update = (e) =>
  setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

<input name="name" value={form.name} onChange={update} />
<input name="email" value={form.email} onChange={update} />
`),
    ),
    note(
      'Once a form grows validation rules and a submit lifecycle, `useReducer` handles it better than a spread per keystroke — and in React 19, `useActionState` handles the pending and error halves for you.',
    ),

    h('Submitting'),
    code(
      jsx(`
function Form() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    // Without this the browser navigates and the page reloads.
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await save(new FormData(e.currentTarget));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input name="email" type="email" required />
      <button type="submit" disabled={saving}>
        {saving ? 'Saving...' : 'Save'}
      </button>
      {error && <p className="alert">{error}</p>}
    </form>
  );
}
`),
    ),
    ul(
      'Put the handler on the `<form>`, not the button — that is what makes Enter submit.',
      'A `<button>` inside a form defaults to `type="submit"`. Any button that is not submitting needs `type="button"`.',
      'Keep the native attributes — `required`, `type="email"`, `minLength`. They give you free validation and the right mobile keyboard.',
      'Label every field: `<label htmlFor={id}>` with a matching `id`, or wrap the input in the label. `useId` generates the id.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Read a value while typing', 'Controlled — `value` + `onChange`'],
      ['Read values only on submit', '`new FormData(e.currentTarget)`'],
      ['Checkbox', '`checked` + `e.target.checked`'],
      ['Select', '`value` on the `<select>`'],
      ['Stop the page reloading', '`e.preventDefault()` in `onSubmit`'],
      ['Give a field a starting value, uncontrolled', '`defaultValue` / `defaultChecked`'],
      ['Connect a label to an input', '`useId` + `htmlFor`'],
    ]),

    links(
      reactDoc('reference/react-dom/components/input', '<input>'),
      reactDoc('reference/react-dom/components/select', '<select>'),
      reactDoc('learn/reacting-to-input-with-state', 'Reacting to input with state'),
    ),
  ],
};
