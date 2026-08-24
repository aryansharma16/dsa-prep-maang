import { cheat, code, h, js, jsx, links, note, p, reactDoc, sig, table, tip, ul, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      '`useReducer` is `useState` with the update logic moved out of the component. Instead of calling a setter with the next value, you `dispatch` an action describing what happened, and a pure `reducer` function computes the next state from the current one.',
    ),
    code(
      js(`
const [state, dispatch] = useReducer(reducer, initialArg, init?);

function reducer(state, action) {
  // pure: same inputs, same output, no side effects
  return nextState;
}
`),
    ),

    h('Signature'),
    sig([
      ['`reducer`', '`(state, action) => state`', 'Must be pure. Called during render, and twice per dispatch in StrictMode.'],
      ['`initialArg`', 'any', 'The initial state — or the argument to `init`, if `init` is given.'],
      ['`init`', '`(initialArg) => state`', 'Optional. Lets you compute the initial state lazily, and re-derive it later for a reset.'],
      ['returns `[0]`', 'the state', 'Current state for this render.'],
      ['returns `[1]`', '`dispatch`', 'Stable for the life of the component — safe to omit from dependency arrays, and safe to put in context.'],
    ]),

    h('A real example'),
    p(
      'Not a counter. The case `useReducer` is actually for is state where several fields move together under named events — a form with a submit lifecycle, for instance.',
    ),
    code(
      js(`
const initial = { values: { email: '', name: '' }, status: 'idle', error: null };

function reducer(state, action) {
  switch (action.type) {
    case 'changed':
      return {
        ...state,
        values: { ...state.values, [action.field]: action.value },
        // Typing clears a previous failure — one rule, in one place
        status: state.status === 'error' ? 'idle' : state.status,
        error: null,
      };
    case 'submitted':
      return { ...state, status: 'saving', error: null };
    case 'succeeded':
      return { ...initial };
    case 'failed':
      return { ...state, status: 'error', error: action.message };
    default:
      throw new Error('Unknown action: ' + action.type);
  }
}

function ContactForm({ save }) {
  const [state, dispatch] = useReducer(reducer, initial);

  async function handleSubmit(e) {
    e.preventDefault();
    dispatch({ type: 'submitted' });
    try {
      await save(state.values);
      dispatch({ type: 'succeeded' });
    } catch (err) {
      dispatch({ type: 'failed', message: err.message });
    }
  }
  // ...
}
`),
    ),
    p(
      'What that buys: the rule "typing clears the error" is written once, in the reducer, instead of in every field handler. The component says *what happened*; the reducer decides *what that means*.',
    ),

    h('When to switch from useState'),
    table(
      ['Signal', 'Why the reducer helps'],
      [
        ['Several `setX` calls always fire together', 'One dispatch, one transition, impossible to update half of it'],
        ['The same update logic is duplicated across handlers', 'It moves into one function'],
        ['States that must not coexist — saving *and* error', 'A single `status` field, and the reducer is the only thing that can change it'],
        ['The next state depends on several current fields', 'The reducer sees the whole state, not one slice'],
        ['A bug is hard to trace', 'Log every action and you have the exact sequence that produced the state'],
        ['You want undo, or replay', 'Actions are data — keep them'],
      ],
    ),
    p(
      'And when not to: two or three independent values, updated in one place each, are clearer as `useState`. `useReducer` is more indirection, and indirection you did not need is a cost.',
    ),

    h('The reducer must be pure'),
    warn(
      'No fetching, no timers, no mutation, no `Date.now()` in a reducer. React calls it during rendering and calls it twice per dispatch under StrictMode — impure reducers produce different state on the two calls and the bug looks like nothing you did.',
    ),
    code(
      js(`
// Wrong on both counts: mutates, and reaches outside
case 'added':
  state.items.push(action.item);   // mutation — same reference, no render
  analytics.track('added');        // side effect in a pure function
  return state;

// Right — new object, and the tracking belongs in the handler that dispatched
case 'added':
  return { ...state, items: [...state.items, action.item] };
`),
    ),

    h('Lazy initialisation and reset'),
    code(
      js(`
function init(items) {
  return { items, selected: null, filter: '' };
}

const [state, dispatch] = useReducer(reducer, items, init);

// The same init is what a reset action can call
case 'reset':
  return init(action.items);
`),
    ),
    tip(
      '`init` is also how you avoid rebuilding an expensive initial state on every render — the same reason `useState` takes a lazy initialiser.',
    ),

    h('Reducer plus context'),
    p(
      'Because `dispatch` is stable, it can go into a context and never cause a re-render on its own. Putting the state and the dispatch in two separate contexts means components that only dispatch never re-render when the state changes.',
    ),
    code(
      jsx(`
const StateContext = createContext(null);
const DispatchContext = createContext(null);

export function TasksProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initial);
  return (
    <StateContext.Provider value={state}>
      {/* dispatch never changes, so this provider never invalidates */}
      <DispatchContext.Provider value={dispatch}>{children}</DispatchContext.Provider>
    </StateContext.Provider>
  );
}
`),
    ),
    note(
      'This is the closest thing React gives you to Redux out of the box, and for app state that changes a few times a minute it is enough. What it still lacks is selectors — see context patterns.',
    ),

    h('Conventions'),
    ul(
      'Name actions after **what happened**, not what to do: `submitted`, `changed`, `failed` — not `setStatus`, `setError`.',
      'Keep the action a plain serialisable object. That is what makes logging and replay possible.',
      'Throw on an unknown action rather than returning the state — a typo should fail loudly.',
      'Return the same state object when nothing changed, and React bails out of the render.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Several fields change together', '`useReducer`'],
      ['Impossible combinations of flags', 'One `status` field in the reducer'],
      ['Expensive initial state', 'The third `init` argument'],
      ['Reset to the start', 'A `reset` action that calls `init`'],
      ['Share state deeply', 'Reducer + two contexts, state and dispatch'],
      ['Dispatch inside an effect', 'Safe — `dispatch` is stable, so it needs no dependency'],
      ['Two unrelated booleans', 'Stay on `useState`'],
    ]),

    links(
      reactDoc('reference/react/useReducer', 'useReducer'),
      reactDoc('learn/extracting-state-logic-into-a-reducer', 'Extracting state logic into a reducer'),
      reactDoc('learn/scaling-up-with-reducer-and-context', 'Scaling up with reducer and context'),
    ),
  ],
};
