import { asked, cheat, code, h, jsx, js, link, links, note, p, reactDoc, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Everything in this track so far runs in the browser: an empty HTML file, a bundle, then React builds the page. That is **client-side rendering**, and it has two costs — nothing is visible until the JavaScript arrives, and a crawler sees an empty page. The rest of the rendering strategies exist to address those, and Next.js is how most React applications adopt them.',
    ),

    h('The strategies'),
    table(
      ['', 'HTML built', 'First paint', 'Data freshness', 'Good for'],
      [
        ['**CSR**', 'In the browser', 'Slow — after the bundle', 'Live', 'Dashboards behind a login'],
        ['**SSR**', 'On the server, per request', 'Fast', 'Live', 'Personalised pages that must be indexed'],
        ['**SSG**', 'At build time', 'Fastest', 'Frozen until rebuilt', 'Docs, marketing, blogs'],
        ['**ISR**', 'At build, then regenerated', 'Fastest', 'Stale up to a revalidation window', 'Catalogues, listings'],
        ['**RSC**', 'On the server, as a component tree', 'Fast, and less JavaScript', 'Live or cached', 'The current Next.js default'],
      ],
    ),
    code(
      js(`
// CSR
GET /tasks -> <div id="root"></div>  +  bundle.js (300 kB)
             |------ download, parse, execute ------|--fetch--|--paint--|

// SSR
GET /tasks -> fully rendered HTML
             |--paint (readable now)--|--hydrate: attach handlers--|
`),
    ),

    h('Hydration'),
    p(
      'Server-rendered HTML is inert — no event handlers, no state. **Hydration** is React walking the existing DOM and attaching itself to it instead of recreating it.',
    ),
    code(
      jsx(`
// The client entry point for a server-rendered page.
hydrateRoot(document.getElementById('root'), <App />);
`),
    ),
    warn(
      'A **hydration mismatch** happens when the client\'s first render does not match the server\'s HTML — and React then discards the server markup and re-renders, losing the benefit entirely. The causes are almost always the same four.',
    ),
    code(
      jsx(`
// All four differ between server and client:
<p>{new Date().toLocaleString()}</p>       // different clock, different timezone
<p>{Math.random()}</p>                      // different value
<p>{window.innerWidth}</p>                  // window does not exist on the server
<p>{localStorage.getItem('theme')}</p>      // nor does localStorage

// The fix: render the server-safe version first, then correct after mount.
const [mounted, setMounted] = useState(false);
useEffect(() => setMounted(true), []);
return <p>{mounted ? new Date().toLocaleString() : null}</p>;

// Or opt one element out entirely.
<time suppressHydrationWarning>{new Date().toISOString()}</time>
`),
    ),
    tip(
      'Anything browser-only — `window`, `document`, `localStorage`, `matchMedia` — must be read inside an effect or an event handler, never during render. That single rule prevents most hydration errors and most "ReferenceError: window is not defined" build failures.',
    ),

    h('Server Components'),
    p(
      'The App Router\'s default. A **Server Component** runs only on the server: it can query the database directly, its code never reaches the browser, and it sends a rendered result rather than JavaScript.',
    ),
    code(
      jsx(`
// app/tasks/page.jsx — a Server Component. No 'use client'.
import { db } from '@/lib/db';

export default async function TasksPage({ searchParams }) {
  const { status } = await searchParams;
  const tasks = await db.task.findMany({ where: { status } });   // direct DB access

  return (
    <main>
      <h1>Tasks</h1>
      <TaskList tasks={tasks} />        {/* can be a Client Component */}
    </main>
  );
}
`),
    ),
    code(
      jsx(`
// app/tasks/TaskList.jsx — interactive, so it opts in to the client.
'use client';

export function TaskList({ tasks }) {
  const [filter, setFilter] = useState('');
  return …;                              // hooks and handlers work here
}
`),
    ),
    table(
      ['Server Component', 'Client Component'],
      [
        ['`async`, can `await` a query', 'Cannot be `async`'],
        ['**No hooks** — no state, no effects', 'All hooks'],
        ['No event handlers', 'Handlers, and browser APIs'],
        ['Its code is never sent to the browser', 'Ships in the bundle'],
        ['Can read secrets and env vars', 'Anything here is public'],
        ['The default', 'Opt in with `"use client"`'],
      ],
    ),
    warn(
      'A Server Component cannot pass a function to a Client Component — props must be serialisable to cross the boundary. And `"use client"` marks a **boundary**, not one file: everything imported below it is client code too.',
    ),
    tip(
      'Push `"use client"` as far down the tree as you can. Marking the layout as a client component pulls the entire page into the bundle and gives up the whole benefit — whereas marking one interactive button keeps everything else on the server.',
    ),

    h('Caching and revalidation'),
    code(
      js(`
// A fetch in a Server Component, with an explicit caching decision.
await fetch(url, { cache: 'no-store' });                  // every request
await fetch(url, { next: { revalidate: 60 } });           // ISR — at most 60s stale
await fetch(url, { next: { tags: ['tasks'] } });          // tagged for invalidation

// Route-level:
export const revalidate = 3600;
export const dynamic = 'force-dynamic';

// After a write, invalidate precisely:
import { revalidateTag, revalidatePath } from 'next/cache';
revalidateTag('tasks');
`),
    ),
    note(
      'Next.js caching defaults have changed meaningfully across versions — what is cached, for how long, and whether `fetch` is cached at all. Check the docs for the version you are on rather than trusting an older answer, and state your caching intent explicitly instead of relying on a default.',
    ),

    h('Server Actions'),
    code(
      jsx(`
// app/tasks/actions.js
'use server';

export async function createTask(formData) {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: parsed.error.flatten() };

  const session = await auth();                       // authorise HERE
  if (!session) return { errors: { root: 'Not signed in' } };

  await db.task.create({ data: { ...parsed.data, userId: session.user.id } });
  revalidatePath('/tasks');
}
`),
    ),
    code(
      jsx(`
// The form posts to it directly — no API route, no fetch, and it works
// before JavaScript loads.
<form action={createTask}>
  <input name="title" />
  <SubmitButton />
</form>
`),
    ),
    warn(
      'A Server Action is a **public HTTP endpoint** that Next.js generates for you. Anyone can invoke it with any payload. Validate the input and check authorisation inside the action — putting the check in the component that renders the form protects nothing.',
    ),

    h('Streaming'),
    code(
      jsx(`
export default function Page() {
  return (
    <>
      <Header />                        {/* sent immediately */}
      <Suspense fallback={<Skeleton />}>
        <SlowTaskList />                {/* streamed in when its query resolves */}
      </Suspense>
    </>
  );
}
`),
    ),
    p(
      'The shell reaches the user straight away and slow sections fill in as their data arrives — so one slow query no longer holds up the whole page. `loading.jsx` in a route folder does the same thing for a whole segment.',
    ),

    h('Do you need Next.js?'),
    table(
      ['Use it when', 'Vite SPA is fine when'],
      [
        ['SEO matters — public, indexed pages', 'Everything is behind a login'],
        ['First paint on slow connections matters', 'It is an internal tool'],
        ['You want one codebase for API and UI', 'The backend already exists and is separate'],
        ['Marketing and app share a codebase', 'You want a plain static deploy'],
      ],
    ),
    tip(
      'A dashboard behind authentication gains almost nothing from SSR — nothing is indexable and the user is already signed in. The honest interview answer is that rendering strategy follows from the audience, and "we use Next because everyone does" is the wrong one.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Public page needing SEO', 'SSR or SSG'],
      ['Content that changes hourly', 'ISR — `revalidate`'],
      ['App behind a login', 'CSR is fine'],
      ['Fetch data in the App Router', 'An `async` Server Component'],
      ['Add interactivity', '`"use client"`, as low in the tree as possible'],
      ['Handle a form', 'A Server Action + `<form action={fn}>`'],
      ['Refresh after a write', '`revalidateTag` / `revalidatePath`'],
      ['Stop one slow query blocking the page', '`<Suspense>` and stream it'],
      ['Fix a hydration mismatch', 'Read browser APIs in an effect, not during render'],
      ['Secure a Server Action', 'Validate and authorise inside it — it is a public endpoint'],
    ]),

    h('Interview'),
    asked([
      ['CSR vs SSR vs SSG vs ISR?', 'Where and when the HTML is built: in the browser, per request, at build time, or at build time with periodic regeneration.'],
      ['What is hydration?', 'React attaching to server-rendered HTML instead of recreating it — event handlers and state on top of existing markup.'],
      ['What causes a hydration mismatch?', 'Rendering something that differs between server and client — dates, randomness, `window` or `localStorage`.'],
      ['What is a Server Component?', 'A component that runs only on the server, can await data directly, and ships no JavaScript to the browser.'],
      ['What can a Server Component not do?', 'Hooks, state, effects, event handlers — and it cannot pass a function across the client boundary.'],
      ['Where should `"use client"` go?', 'As low in the tree as possible; on a layout it pulls the whole page into the bundle.'],
      ['Are Server Actions secure by default?', 'No — they are public endpoints. Validate and authorise inside the action.'],
      ['Does a dashboard behind a login need SSR?', 'Rarely — nothing is indexable and the user is authenticated, so CSR is usually the right call.'],
    ]),

    links(
      link('Next.js — rendering', 'https://nextjs.org/docs/app/getting-started/server-and-client-components'),
      reactDoc('reference/rsc/server-components', 'Server Components'),
      reactDoc('reference/react-dom/client/hydrateRoot', 'hydrateRoot'),
    ),
  ],
};
