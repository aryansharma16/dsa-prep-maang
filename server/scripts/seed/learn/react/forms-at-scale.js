import { asked, cheat, code, h, jsx, link, links, note, p, reactDoc, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'A controlled input is the right first answer, and it stops scaling at about six fields — every keystroke re-renders the whole form, and validation, touched state, error messages and submission all become hand-written. React Hook Form solves it by keeping the form **uncontrolled** and subscribing only the parts that need to re-render.',
    ),

    h('Why the controlled version strains'),
    code(
      jsx(`
function Signup() {
  const [values, setValues] = useState({ email: '', password: '', name: '' });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [submitting, setSubmitting] = useState(false);
  // ...and validation, and per-field blur handlers, and submit error mapping
}
`),
    ),
    table(
      ['Problem', 'At scale'],
      [
        ['Every keystroke re-renders the form', 'Twenty fields with a date picker each is visibly laggy'],
        ['Validation is hand-written', 'It drifts from the server\'s rules'],
        ['Touched and dirty state', 'Four more `useState`s, or errors shown before typing'],
        ['Server errors', 'Mapping a `422` body onto fields by hand'],
        ['Nested and repeating fields', 'Array index bookkeeping everywhere'],
      ],
    ),

    h('React Hook Form'),
    code(
      jsx(`
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// The same schema shape the API validates with — see the Node validation topic.
const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'At least 8 characters'),
  name: z.string().trim().min(1, 'Required'),
});

function Signup() {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '', name: '' },
    mode: 'onTouched',            // validate on blur, then live after the first error
  });

  const onSubmit = async (values) => {
    try {
      await api.register(values);
    } catch (err) {
      if (err.status === 409) {
        setError('email', { message: 'That email is already registered' });
      } else {
        setError('root', { message: 'Something went wrong. Try again.' });
      }
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <label htmlFor="email">Email</label>
      <input
        id="email"
        {...register('email')}
        aria-invalid={!!errors.email}
        aria-describedby={errors.email ? 'email-error' : undefined}
      />
      {errors.email && <p id="email-error" role="alert">{errors.email.message}</p>}

      <button disabled={isSubmitting || !isDirty}>
        {isSubmitting ? 'Creating…' : 'Create account'}
      </button>
      {errors.root && <p role="alert">{errors.root.message}</p>}
    </form>
  );
}
`),
    ),
    p('Three things that code gets for free, and which are most of why the library exists:'),
    table(
      ['', 'How'],
      [
        ['**No re-render per keystroke**', '`register` attaches a `ref`; the input keeps its own value and React is not told'],
        ['**One source of validation truth**', 'The Zod schema, shared with the server if you publish it'],
        ['**Server errors on fields**', '`setError("email", …)` puts a `409` where the user can see it'],
      ],
    ),
    note(
      '`mode: "onTouched"` is the setting that makes a form feel right. Validating `onChange` shows "Enter a valid email" after the first character; validating only `onSubmit` hides problems until the end. Validate on blur, then live once a field has an error.',
    ),

    h('Controlled components inside it'),
    code(
      jsx(`
// A select, date picker or rich editor has no ref to register — wrap it.
import { Controller } from 'react-hook-form';

<Controller
  name="dueAt"
  control={control}
  render={({ field, fieldState }) => (
    <DatePicker
      value={field.value}
      onChange={field.onChange}
      onBlur={field.onBlur}
      error={fieldState.error?.message}
    />
  )}
/>
`),
    ),
    tip(
      '`Controller` re-renders only that field, not the form. Reach for it for third-party inputs; use plain `register` for anything with a native `ref`, which is every standard input, textarea and select.',
    ),

    h('Watching, without re-rendering everything'),
    code(
      jsx(`
// watch() re-renders the WHOLE form on every change of that field.
const country = watch('country');

// useWatch re-renders only the component that calls it.
function StateField({ control }) {
  const country = useWatch({ control, name: 'country' });
  return country === 'US' ? <StateSelect /> : null;
}

// And when you only need the value at submit time, do not watch at all:
const onSubmit = (values) => { values.country; };
`),
    ),
    warn(
      'Calling `watch("field")` at the top of a large form reintroduces exactly the re-render problem you installed the library to avoid. Use `useWatch` in the smallest component that needs the value.',
    ),

    h('Field arrays'),
    code(
      jsx(`
const { fields, append, remove } = useFieldArray({ control, name: 'items' });

{fields.map((field, index) => (
  <div key={field.id}>                    {/* field.id, NOT index */}
    <input {...register(\`items.\${index}.title\`)} />
    <button type="button" onClick={() => remove(index)}>Remove</button>
  </div>
))}
<button type="button" onClick={() => append({ title: '' })}>Add item</button>
`),
    ),
    warn(
      '`key={field.id}` rather than `key={index}` — the same rule as the `lists-and-keys` topic. With index keys, removing the second of five rows leaves the values shifted up by one and the user watching their data move.',
    ),

    h('React 19 form actions'),
    p(
      'React now has form handling of its own. It is enough for simple forms and needs no dependency.',
    ),
    code(
      jsx(`
function Signup() {
  const [state, formAction, isPending] = useActionState(
    async (prev, formData) => {
      const result = schema.safeParse(Object.fromEntries(formData));
      if (!result.success) return { errors: flatten(result.error) };
      try { await api.register(result.data); return { ok: true }; }
      catch { return { errors: { root: 'Something went wrong' } }; }
    },
    { errors: {} },
  );

  return (
    <form action={formAction}>
      <input name="email" />
      {state.errors.email && <p role="alert">{state.errors.email}</p>}
      <button disabled={isPending}>Create account</button>
    </form>
  );
}
`),
    ),
    table(
      ['Choose', 'When'],
      [
        ['**Form actions**', 'A few fields, submit-time validation, no dependency wanted — and it works with Server Actions'],
        ['**React Hook Form**', 'Many fields, per-field live validation, arrays, third-party inputs, performance'],
        ['Plain `useState`', 'One or two inputs. Do not install anything'],
      ],
    ),

    h('Accessibility, which interviews do ask about'),
    code(
      jsx(`
<label htmlFor="email">Email</label>             {/* not a placeholder */}
<input
  id="email"
  type="email"
  autoComplete="email"
  aria-invalid={!!errors.email}
  aria-describedby={errors.email ? 'email-error' : undefined}
/>
{errors.email && <p id="email-error" role="alert">{errors.email.message}</p>}
`),
    ),
    table(
      ['Do', 'Not'],
      [
        ['A real `<label htmlFor>`', 'A placeholder as the label — it vanishes when typing'],
        ['`role="alert"` on the error', 'A silent error a screen reader never announces'],
        ['`aria-describedby` linking input to error', 'An error visually adjacent but unassociated'],
        ['`type` and `autoComplete`', '`type="text"` for everything'],
        ['Move focus to the first error on submit', 'Leaving the user to hunt for it'],
      ],
    ),

    h('Cheatsheet'),
    cheat([
      ['One or two fields', '`useState`'],
      ['A real form', 'React Hook Form + `zodResolver`'],
      ['Validate once, on both sides', 'A shared Zod schema'],
      ['Avoid re-rendering per keystroke', '`register`, and `useWatch` over `watch`'],
      ['A third-party input', '`<Controller>`'],
      ['Repeating rows', '`useFieldArray`, keyed on `field.id`'],
      ['Show a server error on a field', '`setError("email", { message })`'],
      ['Disable while submitting', '`formState.isSubmitting`'],
      ['No dependency, React 19', '`useActionState` + `<form action>`'],
    ]),

    h('Interview'),
    asked([
      ['Controlled vs uncontrolled inputs?', 'Controlled keeps the value in React state and re-renders per keystroke; uncontrolled leaves it in the DOM and is read via a ref.'],
      ['Why is React Hook Form fast?', 'Inputs stay uncontrolled and register by ref, so typing does not re-render the form.'],
      ['Where does validation belong?', 'Both sides — a shared schema on the client for feedback, and on the server because the client can be bypassed.'],
      ['How do you show a server validation error?', 'Map the `422` response onto fields with `setError`.'],
      ['When would you use `Controller`?', 'For inputs with no native ref — date pickers, custom selects, rich editors.'],
      ['Why key a field array on `field.id`?', 'Index keys make React reuse the wrong DOM node when a row is removed, shifting the values.'],
      ['What does React 19 add for forms?', '`useActionState` and `useFormStatus` — pending, error and result handled without a library.'],
    ]),

    links(
      link('React Hook Form', 'https://react-hook-form.com/get-started'),
      reactDoc('reference/react/useActionState', 'useActionState'),
      link('MDN — Form validation and accessibility', 'https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Forms/Form_validation'),
    ),
  ],
};
