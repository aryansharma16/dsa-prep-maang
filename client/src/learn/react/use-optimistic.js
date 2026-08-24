import { cheat, code, h, jsx, links, note, p, reactDoc, sig, tip, ul, warn } from '../blocks.js';

export const doc = {
  blocks: [
    note(
      'React 19. This app runs React 18.3.1, so it is not available here yet.',
    ),
    p(
      '`useOptimistic` shows the result of an action immediately, before the server has confirmed it, and reverts on its own when the action finishes. It exists because "click, wait, see" feels slow even when the request takes 200ms.',
    ),
    code(
      jsx(`
const [optimistic, addOptimistic] = useOptimistic(actual, updateFn);
`),
    ),

    h('Signature'),
    sig([
      ['`state`', 'any', 'The real state — what the server has confirmed.'],
      [
        '`updateFn`',
        '`(current, optimisticValue) => next`',
        'Pure. Merges an optimistic value into the current state and returns what to display.',
      ],
      ['returns `[0]`', 'the display state', 'The real state, plus any optimistic updates still in flight.'],
      [
        'returns `[1]`',
        '`addOptimistic(value)`',
        'Adds an optimistic update. Only usable inside an action or a transition.',
      ],
    ]),

    h('How the revert works'),
    p(
      'This is the part worth understanding, because there is no rollback code to write. The optimistic value only exists **for the duration of the transition**. When the action settles — success or failure — React discards every optimistic update and re-renders from the real state.',
    ),
    ul(
      'On success, the real state has been updated by then, so the optimistic value is replaced by an identical real one and nothing visibly changes.',
      'On failure, the real state was never updated, so the optimistic value simply vanishes. That *is* the rollback.',
    ),
    tip(
      'So the only thing you have to get right is updating the real state on success. Failure needs no cleanup — but it does need a message, or the change disappears with no explanation.',
    ),

    h('A message list'),
    code(
      jsx(`
function Thread({ messages, send }) {
  const [optimistic, addOptimistic] = useOptimistic(
    messages,
    (current, text) => [...current, { id: 'pending', text, sending: true }],
  );

  async function action(formData) {
    const text = formData.get('text');
    addOptimistic(text);          // on screen immediately
    await send(text);             // the real write
    // messages arrives updated from above; the optimistic entry is dropped
  }

  return (
    <>
      {optimistic.map((m) => (
        <p key={m.id} className={m.sending ? 'sending' : ''}>
          {m.text}
          {m.sending && <span className="hint">Sending...</span>}
        </p>
      ))}
      <form action={action}>
        <input name="text" />
        <button>Send</button>
      </form>
    </>
  );
}
`),
    ),
    p(
      'The `sending: true` flag is worth adding. A message that appears indistinguishable from a sent one, and then quietly disappears when the request fails, is worse than a short wait.',
    ),

    h('A toggle'),
    code(
      jsx(`
function LikeButton({ post, toggleLike }) {
  const [optimistic, setOptimistic] = useOptimistic(
    post.liked,
    (_current, next) => next,
  );

  return (
    <button
      onClick={() =>
        startTransition(async () => {
          setOptimistic(!optimistic);
          await toggleLike(post.id);
        })
      }
    >
      {optimistic ? 'Liked' : 'Like'}
    </button>
  );
}
`),
    ),
    note(
      'Outside a `<form action>`, the update must be inside a `startTransition` — that is what defines the window the optimistic value lives in.',
    ),

    h('The rules'),
    warn(
      '`addOptimistic` only works inside an action or a transition. Calling it from a plain event handler does nothing useful: with no transition to bound it, React has no idea when to discard the value.',
    ),
    ul(
      '`updateFn` must be pure. It runs during render, possibly more than once.',
      'The real state has to come from outside — a prop, a context, a query cache. `useOptimistic` never writes to it.',
      'Several optimistic updates can be in flight at once; `updateFn` is applied for each of them, in order, over the real state.',
      'Handle the failure. The value reverting is automatic; explaining why is not.',
    ),

    h('When to use it'),
    ul(
      '**Yes:** likes, toggles, reordering, adding an item to a list, marking read, anything the server almost always accepts.',
      '**No:** payments, irreversible deletes, anything where showing success and then taking it back is worse than a spinner.',
      '**No:** operations that usually fail, or fail slowly. The revert becomes the normal experience.',
    ),
    p(
      'The React 18 equivalent is writing the optimistic value into state, keeping a copy of the old one, and restoring it in a `catch`. That works, and it is what most codebases do today — this hook is the version where the bookkeeping belongs to React instead of to you.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Show a change before the server confirms', '`useOptimistic(real, updateFn)`'],
      ['Roll back on failure', 'Automatic — the transition ending discards it'],
      ['Use it outside a form', 'Wrap the call in `startTransition`'],
      ['Show that it is not confirmed yet', 'A flag in the optimistic item'],
      ['Tell the user it failed', 'Your own error state — the revert says nothing'],
      ['Irreversible or high-stakes actions', 'Do not — use a real pending state'],
    ]),

    links(
      reactDoc('reference/react/useOptimistic', 'useOptimistic'),
      reactDoc('reference/react/useActionState', 'useActionState'),
    ),
  ],
};
