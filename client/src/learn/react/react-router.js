import { asked, cheat, code, h, jsx, js, link, links, note, p, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'React has no router. React Router is the one most applications use, and the version that matters is the **data router** — `createBrowserRouter` — because it can fetch before it renders, which removes the fetch-on-mount waterfall that makes single-page apps feel slow.',
    ),

    h('The shape'),
    code(
      jsx(`
// router.jsx
const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,          // renders an <Outlet /> for its children
    errorElement: <ErrorPage />,      // catches errors from this whole subtree
    children: [
      { index: true, element: <Home /> },              // matches '/'
      { path: 'tasks', element: <TaskList /> },        // '/tasks'
      { path: 'tasks/:id', element: <TaskDetail /> },  // '/tasks/7'
      { path: '*', element: <NotFound /> },            // anything else
    ],
  },
]);

createRoot(el).render(<RouterProvider router={router} />);
`),
    ),
    code(
      jsx(`
// The layout renders whichever child route matched.
function RootLayout() {
  return (
    <div className="app">
      <Sidebar />
      <main><Outlet /></main>
    </div>
  );
}
`),
    ),
    note(
      'Nested routes are the feature worth understanding. `/tasks/7` renders `RootLayout` **and** `TaskDetail` — the layout is not unmounted and remounted, so its state, scroll position and any open panel survive navigation between children.',
    ),

    h('Reading the URL'),
    code(
      jsx(`
const { id } = useParams();                     // '/tasks/:id' -> '7'  (a string)
const [searchParams, setSearchParams] = useSearchParams();
const status = searchParams.get('status') ?? 'all';
const navigate = useNavigate();
const location = useLocation();                 // pathname, search, state, hash

navigate('/tasks');
navigate(-1);                                    // back
navigate('/login', { replace: true, state: { from: location } });
`),
    ),
    code(
      jsx(`
// Filters in the URL — the point made in the state-management topic, applied.
function TaskFilters() {
  const [params, setParams] = useSearchParams();

  const setStatus = (status) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      status === 'all' ? next.delete('status') : next.set('status', status);
      next.delete('page');                       // changing a filter resets paging
      return next;
    }, { replace: true });                       // do not add a history entry per keystroke
  };
  …
}
`),
    ),
    tip(
      'Use `replace: true` for filter changes and `false` for real navigations. Otherwise typing eight characters into a search box puts eight entries in the history and the back button becomes useless.',
    ),

    h('Loaders'),
    p(
      'A loader runs **before** the route renders. That is the difference between the two timelines below, and it is why data routers exist.',
    ),
    code(
      js(`
// Without loaders: render -> effect -> fetch -> render again
//   |--render skeleton--|--fetch 200ms--|--render data--|
//   and a child that fetches too starts only after the parent has rendered.

// With loaders: fetch -> render once, and siblings fetch in PARALLEL
//   |--fetch 200ms--|--render data--|
`),
    ),
    code(
      js(`
{
  path: 'tasks/:id',
  element: <TaskDetail />,
  loader: async ({ params, request }) => {
    const res = await fetch(\`/api/tasks/\${params.id}\`, { signal: request.signal });
    if (res.status === 404) throw new Response('Not found', { status: 404 });
    if (!res.ok) throw new Response('Failed', { status: res.status });
    return res.json();
  },
}
`),
    ),
    code(
      jsx(`
function TaskDetail() {
  const task = useLoaderData();      // already here — no loading state at all
  return <h1>{task.title}</h1>;
}
`),
    ),
    warn(
      'Throwing a `Response` from a loader is how you signal an HTTP error — the nearest `errorElement` renders and `useRouteError()` gives you the response. Returning `null` for a missing record instead means every component has to handle "no data", which is the state loaders exist to remove.',
    ),

    h('Actions'),
    code(
      jsx(`
{
  path: 'tasks/new',
  element: <NewTask />,
  action: async ({ request }) => {
    const form = await request.formData();
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: form.get('title') }),
    });
    if (res.status === 422) return { errors: (await res.json()).error.issues };
    return redirect(\`/tasks/\${(await res.json()).id}\`);
  },
}

function NewTask() {
  const errors = useActionData();
  const { state } = useNavigation();          // 'idle' | 'submitting' | 'loading'
  return (
    <Form method="post">
      <input name="title" />
      <button disabled={state === 'submitting'}>Save</button>
    </Form>
  );
}
`),
    ),
    note(
      'After an action completes the router **automatically revalidates** every loader on the page, so the list refreshes without an explicit invalidation. It is the same idea as `invalidateQueries`, built into navigation.',
    ),

    h('Protected routes'),
    code(
      jsx(`
// As a layout route, so it wraps a whole subtree rather than each page.
function RequireAuth() {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <Spinner />;                    // do NOT redirect yet
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}

{ element: <RequireAuth />, children: [
    { path: 'tasks', element: <TaskList /> },
    { path: 'settings', element: <Settings /> },
] }
`),
    ),
    warn(
      'The `isLoading` branch is not optional. Redirecting while the session is still being checked bounces an authenticated user to the login page on every hard refresh — one of the most common bugs in a React app, and one that only shows up on reload.',
    ),
    warn(
      'A client-side guard is a **UX** feature, not security. Anyone can edit the bundle or call the API directly. The server must authorise every request regardless — the `authorization-rbac` topic in the Node track.',
    ),

    h('Code splitting'),
    code(
      js(`
// lazy() on a route so a rarely-visited page is not in the initial bundle.
{
  path: 'admin',
  lazy: async () => {
    const { Admin, adminLoader } = await import('./pages/Admin.jsx');
    return { element: <Admin />, loader: adminLoader };
  },
}
`),
    ),
    tip(
      'Split at route boundaries first — it is the highest-value split available, because a user who never opens the admin page never downloads it. Splitting individual components below that rarely pays for the extra request.',
    ),

    h('The alternatives'),
    table(
      ['Router', 'Notes'],
      [
        ['**React Router**', 'The default. Data routers, nested layouts, loaders and actions'],
        ['**TanStack Router**', 'Type-safe routes and search params, first-class data loading'],
        ['**Next.js App Router**', 'File-system routing built in — the next topic'],
        ['`wouter`', 'Tiny, hook-only, no data layer. Fine for a small app'],
      ],
    ),
    note(
      'React Router v7 merged with Remix, so its documentation now covers a full framework mode as well as the library. The `createBrowserRouter` API above is the library mode most existing SPAs use.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Define routes', '`createBrowserRouter` + `RouterProvider`'],
      ['Share a layout', 'A parent route with `<Outlet />`'],
      ['Read a path param', '`useParams()` — always strings'],
      ['Keep filters in the URL', '`useSearchParams`, with `replace: true`'],
      ['Fetch before render', 'A route `loader` + `useLoaderData`'],
      ['Signal a 404 from a loader', '`throw new Response(…, { status: 404 })`'],
      ['Handle a route error', '`errorElement` + `useRouteError`'],
      ['Submit a form', '`<Form method="post">` + a route `action`'],
      ['Show pending UI', '`useNavigation().state`'],
      ['Protect a subtree', 'A layout route that waits for auth, then `<Navigate>`'],
      ['Split a page out of the bundle', 'Route-level `lazy`'],
    ]),

    h('Interview'),
    asked([
      ['Why use a data router?', 'Loaders fetch before render, in parallel across nested routes — removing the render-then-fetch waterfall.'],
      ['What are nested routes for?', 'Shared layouts that stay mounted, so their state and scroll survive navigation between children.'],
      ['Where should filter state live?', 'The URL, via `useSearchParams`, so it survives refresh and can be shared.'],
      ['How do you protect a route?', 'A layout route that waits for the auth check, then redirects — and the server still authorises every request.'],
      ['Why does my app redirect to login on refresh?', 'The guard redirected while the session check was still loading.'],
      ['How do you code split by route?', '`lazy` on the route so the chunk loads only when that route is visited.'],
      ['How does the list refresh after a form submit?', 'A router action revalidates every loader on the page automatically.'],
    ]),

    links(
      link('React Router', 'https://reactrouter.com'),
      link('React Router — loaders', 'https://reactrouter.com/start/data/route-object#loader'),
      link('TanStack Router', 'https://tanstack.com/router/latest'),
    ),
  ],
};
