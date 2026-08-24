import { asked, cheat, code, h, link, links, note, p, reactDoc, table, tip, ts, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Most React jobs are TypeScript jobs now, and the interview version of this is not "do you know TypeScript" — it is whether you can type props, hooks and events without reaching for `any`. That is a small, learnable surface, and this topic is all of it.',
    ),

    h('Props'),
    code(
      ts(`
type ButtonProps = {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'ghost';        // optional, and a union not a string
  disabled?: boolean;
  children?: React.ReactNode;
};

function Button({ label, onClick, variant = 'primary' }: ButtonProps) {
  return <button className={variant} onClick={onClick}>{label}</button>;
}
`),
    ),
    warn(
      'Do not use `React.FC`. It adds an implicit `children` even for components that take none, it interferes with generic components, and the React types dropped its automatic `children` in v18 anyway. A plain function with a typed parameter is better in every way.',
    ),
    code(
      ts(`
// Extending native element props — the pattern for a design-system component.
type InputProps = React.ComponentPropsWithoutRef<'input'> & {
  label: string;
  error?: string;
};

function Input({ label, error, ...rest }: InputProps) {
  return (
    <>
      <label htmlFor={rest.id}>{label}</label>
      <input {...rest} aria-invalid={!!error} />
      {error && <p role="alert">{error}</p>}
    </>
  );
}
// Consumers now get autocomplete for type, placeholder, onChange, everything.
`),
    ),
    table(
      ['Type', 'For'],
      [
        ['`React.ReactNode`', 'Anything renderable — **use this for `children`**'],
        ['`React.ReactElement`', 'Specifically an element, not a string or number'],
        ['`React.ComponentPropsWithoutRef<"button">`', 'Every native prop of an element'],
        ['`React.CSSProperties`', 'An inline style object'],
        ['`React.Dispatch<React.SetStateAction<T>>`', 'A `setState` function passed as a prop'],
      ],
    ),

    h('Discriminated unions'),
    p(
      'The technique that most distinguishes someone who has used TypeScript from someone who has read about it: make impossible prop combinations unrepresentable.',
    ),
    code(
      ts(`
// Weak — every combination is allowed, including all three at once.
type AlertProps = { message?: string; error?: Error; loading?: boolean };

// Strong — exactly one shape is valid, and TS narrows inside the switch.
type AlertProps =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; error: Error }
  | { status: 'success'; data: Task[] };

function Alert(props: AlertProps) {
  switch (props.status) {
    case 'error':   return <p>{props.error.message}</p>;   // error exists here
    case 'success': return <List items={props.data} />;    // data exists here
    default:        return <Spinner />;
  }
}
`),
    ),
    tip(
      'This is the same idea as `useReducer` over four booleans, expressed in the type system. It is also why a query library returning a discriminated result is pleasant in TypeScript — the `isPending` check narrows `data` to non-undefined.',
    ),

    h('Hooks'),
    code(
      ts(`
// Inferred — do not annotate what TS already knows.
const [count, setCount] = useState(0);              // number
const [user, setUser] = useState<User | null>(null); // annotate when it starts null

// Refs: the initial value decides the type.
const inputRef = useRef<HTMLInputElement>(null);     // for an element — read only
const timer = useRef<number | undefined>(undefined); // a mutable box
inputRef.current?.focus();                            // current can be null

// Reducer: type the state and the action union, and the rest infers.
type Action = { type: 'add'; task: Task } | { type: 'remove'; id: string };

function reducer(state: Task[], action: Action): Task[] {
  switch (action.type) {
    case 'add': return [...state, action.task];
    case 'remove': return state.filter((t) => t.id !== action.id);
  }
}
const [tasks, dispatch] = useReducer(reducer, []);
`),
    ),
    code(
      ts(`
// Context: the null-check-once pattern, so consumers never write it.
const AuthContext = createContext<AuthValue | null>(null);

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;                          // AuthValue, never null, for every caller
}
`),
    ),
    note(
      'That custom hook does two jobs at once: it removes a null check from every consumer, and it turns "I forgot the provider" from a confusing `undefined` deep in a component into a clear error naming the fix.',
    ),

    h('Events'),
    code(
      ts(`
// Inline handlers are inferred — no annotation needed.
<input onChange={(e) => setValue(e.target.value)} />   // e is inferred

// A handler defined separately does need one.
const onChange = (e: React.ChangeEvent<HTMLInputElement>) => setValue(e.target.value);
const onSubmit = (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); };
const onClick = (e: React.MouseEvent<HTMLButtonElement>) => {};
const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (e.key === 'Enter') submit();
};
`),
    ),
    tip(
      'If you are unsure of an event type, write the handler inline first, hover it in the editor, and copy what TypeScript inferred. That is faster than searching, and it is right by construction.',
    ),

    h('Generic components'),
    code(
      ts(`
type ListProps<T> = {
  items: T[];
  keyOf: (item: T) => string;
  render: (item: T) => React.ReactNode;
};

function List<T>({ items, keyOf, render }: ListProps<T>) {
  return <ul>{items.map((item) => <li key={keyOf(item)}>{render(item)}</li>)}</ul>;
}

// T is inferred as Task, so 'task' is fully typed inside render.
<List items={tasks} keyOf={(t) => t.id} render={(t) => t.title} />
`),
    ),

    h('Typing the API boundary'),
    warn(
      'A hand-written `interface Task` is a **claim**, not a check. `await res.json()` is `any` at runtime, so if the API renames a field TypeScript happily believes your old type and the failure surfaces as `undefined` somewhere far away.',
    ),
    code(
      ts(`
// Validate at the boundary, and let the type come FROM the schema.
import { z } from 'zod';

const taskSchema = z.object({
  id: z.string(),
  title: z.string(),
  done: z.boolean(),
  createdAt: z.coerce.date(),
});

export type Task = z.infer<typeof taskSchema>;    // one source of truth

export async function getTask(id: string): Promise<Task> {
  const res = await fetch(\`/api/tasks/\${id}\`);
  if (!res.ok) throw new ApiError(res.status);
  return taskSchema.parse(await res.json());       // throws HERE if the shape changed
}
`),
    ),
    tip(
      'This is the same Zod schema idea as the Node track\'s `validation` topic, pointed the other way. Combined with a query library, `useQuery` then infers `data` as `Task` with no annotation anywhere.',
    ),

    h('Escape hatches'),
    table(
      ['Instead of', 'Use'],
      [
        ['`any`', '`unknown`, then narrow — `any` disables checking silently'],
        ['`as SomeType`', 'A type guard, or a schema parse. An assertion is a promise, not a proof'],
        ['`value!`', 'An explicit check. `!` is an assertion that it is never null'],
        ['`@ts-ignore`', '`@ts-expect-error` with a comment — it errors when it stops being needed'],
      ],
    ),
    code(
      ts(`
// A type guard: a real runtime check that narrows the type.
function isTask(value: unknown): value is Task {
  return typeof value === 'object' && value !== null && 'id' in value;
}
`),
    ),

    h('Cheatsheet'),
    cheat([
      ['Type props', 'A `type` alias and a plain function — not `React.FC`'],
      ['Children', '`React.ReactNode`'],
      ['Wrap a native element', '`React.ComponentPropsWithoutRef<"input">`'],
      ['Make bad combinations impossible', 'A discriminated union on a `status` field'],
      ['State that starts null', '`useState<User | null>(null)`'],
      ['A DOM ref', '`useRef<HTMLInputElement>(null)`'],
      ['Context without null checks', 'A custom hook that throws when the provider is missing'],
      ['A separately defined handler', '`React.ChangeEvent<HTMLInputElement>`'],
      ['Trust API data', 'Parse it with Zod and `z.infer` the type'],
      ['Silence an error', '`@ts-expect-error` with a reason — never `any`'],
    ]),

    h('Interview'),
    asked([
      ['Why not `React.FC`?', 'It implies `children` you may not accept and gets in the way of generic components.'],
      ['How do you type `children`?', '`React.ReactNode`.'],
      ['What is a discriminated union good for in React?', 'Making impossible prop or state combinations unrepresentable, and narrowing automatically in a switch.'],
      ['How do you type a ref to a DOM node?', '`useRef<HTMLInputElement>(null)` — and `current` is nullable, so guard it.'],
      ['Does typing an API response guarantee it?', 'No — `res.json()` is `any`. Parse with a schema and infer the type from it.'],
      ['`interface` or `type` for props?', 'Either; `type` composes unions and intersections more naturally, `interface` supports declaration merging.'],
      ['What is wrong with `as`?', 'It asserts rather than checks — a type guard or a parse actually verifies at runtime.'],
    ]),

    links(
      reactDoc('learn/typescript', 'Using TypeScript'),
      link('React TypeScript Cheatsheet', 'https://react-typescript-cheatsheet.netlify.app'),
      link('TypeScript handbook — narrowing', 'https://www.typescriptlang.org/docs/handbook/2/narrowing.html'),
    ),
  ],
};
