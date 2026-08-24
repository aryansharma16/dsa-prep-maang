import { cheat, code, h, js, jsx, links, note, p, reactDoc, sig, table, tip, ul, warn } from '../blocks.js';

export const doc = {
  blocks: [
    note(
      'React 19. This app runs React 18.3.1, so none of this is available here yet — read it as what comes next.',
    ),
    p(
      'An **Action** is an async function passed where React expects an event handler — most often a `<form action={...}>`. React runs it inside a transition, which means it tracks the pending state, keeps the UI interactive while it runs, and handles errors and optimistic updates around it.',
    ),
    p(
      'The problem it removes is the boilerplate every form in every React app has written by hand: a `pending` boolean, an `error` state, a `try`/`catch`/`finally`, and remembering to reset all of it.',
    ),

    h('Before and after'),
    code(
      jsx(`
// React 18 — three state variables to submit one form
function Form({ save }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await save(name);
      setName('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }
  // ...
}
`),
    ),
    code(
      jsx(`
// React 19 — the same thing
function Form({ save }) {
  const [error, submit, isPending] = useActionState(
    async (previousError, formData) => {
      try {
        await save(formData.get('name'));
        return null;
      } catch (err) {
        return err.message;
      }
    },
    null,
  );

  return (
    <form action={submit}>
      <input name="name" />
      <button disabled={isPending}>{isPending ? 'Saving...' : 'Save'}</button>
      {error && <p className="alert">{error}</p>}
    </form>
  );
}
`),
    ),
    p(
      'No `preventDefault`, no pending flag to manage, no `finally`. React resets the form on success, and the transition keeps the rest of the page responsive while the request is in flight.',
    ),

    h('useActionState'),
    sig([
      [
        '`action`',
        '`(prevState, formData) => Promise<state>`',
        'Receives the previous state and the submitted `FormData`. Whatever it returns becomes the new state.',
      ],
      ['`initialState`', 'any', 'The state before the first submission.'],
      ['`permalink`', '`string`', 'Optional. A URL to fall back to for progressive enhancement before hydration.'],
      ['returns `[0]`', 'state', 'The last value the action returned. Commonly the error, or the result.'],
      ['returns `[1]`', '`formAction`', 'Pass this to `<form action>` — or to a button `formAction`.'],
      ['returns `[2]`', '`isPending`', 'True while the action is running.'],
    ]),
    warn(
      'The first parameter is the previous **state**, not the form data. Getting the order backwards is the most common mistake with this hook, and it fails in a confusing way because both arguments exist.',
    ),

    h('useFormStatus'),
    p(
      'Reads the pending state of the nearest `<form>` above, from inside a child — so a shared submit button knows it is submitting without every form passing a prop down to it.',
    ),
    code(
      jsx(`
import { useFormStatus } from 'react-dom';

// Note: react-dom, not react
function SubmitButton({ children }) {
  const { pending, data, method, action } = useFormStatus();
  return (
    <button type="submit" disabled={pending}>
      {pending ? 'Working...' : children}
    </button>
  );
}

// Any form can now use it, and it just works
<form action={submit}>
  <input name="email" />
  <SubmitButton>Subscribe</SubmitButton>
</form>
`),
    ),
    warn(
      'It reads the form **above** it. Calling `useFormStatus` in the same component that renders the `<form>` always returns `pending: false` — it has to be in a child.',
    ),

    h('The pieces, and which package'),
    table(
      ['API', 'From', 'What it gives you'],
      [
        ['`useActionState`', '`react`', 'Action result, form action, pending flag'],
        ['`useFormStatus`', '`react-dom`', 'The pending state of the parent form'],
        ['`useOptimistic`', '`react`', 'A temporary value shown while the action runs'],
        ['`useTransition`', '`react`', 'Async functions allowed in React 19 — the manual version of all this'],
        ['`<form action>`', '`react-dom`', 'Accepts a function, not just a URL'],
      ],
    ),

    h('Actions outside forms'),
    p(
      'React 19 lets `startTransition` take an async function, with the pending state covering the await. That is the same machinery without the form.',
    ),
    code(
      js(`
const [isPending, startTransition] = useTransition();

const publish = () => {
  startTransition(async () => {
    const error = await save(draft);
    if (error) setError(error);
    // Still inside the transition — isPending stays true until this resolves
  });
};
`),
    ),
    tip(
      'This is a genuine change from React 18, where an async function passed to `startTransition` lost the transition after the first await. In 19 the pending state survives it.',
    ),

    h('Notes'),
    ul(
      'A `<form action={fn}>` calls `fn` with `FormData` and calls `preventDefault` for you. Every input needs a `name`.',
      'React resets an uncontrolled form after a successful action. Return early or use controlled inputs when that is not what you want.',
      'These are client APIs, not Server Components. They work in a plain Vite SPA — Server Actions are a separate feature that needs a framework.',
      'Errors thrown out of an action reach the nearest error boundary. Catching and returning the message, as above, keeps it in the form.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Submit a form with pending and error handled', '`useActionState`'],
      ['A submit button that knows it is submitting', '`useFormStatus`, in a child'],
      ['Show the result before the server answers', '`useOptimistic`'],
      ['An async action outside a form', '`startTransition(async () => ...)`'],
      ['Keep an error in the form', 'Return it from the action'],
      ['Send it to an error boundary', 'Throw from the action'],
    ]),

    links(
      reactDoc('reference/react/useActionState', 'useActionState'),
      reactDoc('reference/react-dom/hooks/useFormStatus', 'useFormStatus'),
      reactDoc('blog/2024/12/05/react-19', 'React 19 release notes'),
    ),
  ],
};
