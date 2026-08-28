import { asked, cheat, code, h, jsx, js, link, links, note, p, reactDoc, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Server data is not state — it is a **cache of someone else\'s state**. It goes stale without telling you, several components want the same copy, requests race, and every one can fail. `useState` plus `useEffect` models none of that, which is why the first thing most React apps grow is a bad reimplementation of a query cache.',
    ),

    h('What the naive version misses'),
    code(
      jsx(`
function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/tasks')
      .then((r) => r.json())
      .then(setTasks)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);
  …
}
`),
    ),
    table(
      ['Missing', 'Consequence'],
      [
        ['A shared cache', 'Two components mounting means two identical requests'],
        ['Race handling', 'A slow first request resolves after a fast second, overwriting newer data'],
        ['Cleanup', 'It sets state after unmount — a warning, and in StrictMode it runs twice'],
        ['`response.ok` check', 'A `404` body is parsed as data; the error path never runs'],
        ['Refetching', 'Data is stale from the moment it arrives until a reload'],
        ['Retries', 'One dropped connection means a permanently broken screen'],
        ['Invalidation', 'Creating a task does not update the list'],
      ],
    ),
    code(
      jsx(`
// Fixing just the race and the cleanup takes this much:
useEffect(() => {
  const ac = new AbortController();
  setLoading(true);

  fetch(\`/api/tasks?status=\${status}\`, { signal: ac.signal })
    .then((r) => {
      if (!r.ok) throw new Error(\`HTTP \${r.status}\`);   // fetch does NOT throw on 404
      return r.json();
    })
    .then(setTasks)
    .catch((err) => { if (err.name !== 'AbortError') setError(err); })
    .finally(() => setLoading(false));

  return () => ac.abort();          // cancel when status changes or we unmount
}, [status]);
`),
    ),
    warn(
      '`fetch` only rejects on a **network** failure. A `404`, a `422` and a `500` all resolve normally with `ok: false` — so without that check your error state stays `null` and the error body gets rendered as data.',
    ),

    h('TanStack Query'),
    p('The same screen, with caching, deduplication, retries, background refetching and cancellation included.'),
    code(
      js(`
// main.jsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,        // trust data for 30s before refetching
      gcTime: 5 * 60_000,       // keep unused data in memory 5 min
      retry: 2,
      refetchOnWindowFocus: true,
    },
  },
});

<QueryClientProvider client={queryClient}><App /></QueryClientProvider>
`),
    ),
    code(
      jsx(`
function Tasks({ status }) {
  const { data, isPending, isError, error, isFetching } = useQuery({
    queryKey: ['tasks', { status }],          // the cache key AND the dependency
    queryFn: ({ signal }) => api.getTasks({ status }, signal),
  });

  if (isPending) return <Spinner />;
  if (isError) return <ErrorState error={error} />;

  return (
    <>
      {isFetching && <RefreshingBar />}       {/* background refetch, data on screen */}
      <List items={data} />
    </>
  );
}
`),
    ),
    tip(
      'The `queryKey` is the whole model. It is the cache key, so two components with the same key share one request and one copy; it is the dependency array, so changing `status` fetches the new data and keeps the old visible; and it is what `invalidateQueries` matches against.',
    ),

    h('stale vs inactive'),
    table(
      ['Setting', 'Means', 'Default'],
      [
        ['`staleTime`', 'How long the data is trusted without refetching', '`0` — stale immediately'],
        ['`gcTime`', 'How long unused data stays in memory before collection', '5 minutes'],
        ['`isPending`', 'No data yet — the first load', ''],
        ['`isFetching`', 'A request is in flight, **including a background refetch**', ''],
      ],
    ),
    warn(
      'The default `staleTime: 0` surprises everyone: data is considered stale the moment it arrives, so remounting or refocusing the window refetches. That is deliberate freshness, not a bug — but for a list that changes hourly, set a real `staleTime` or you will refetch constantly.',
    ),
    note(
      'Distinguish `isPending` from `isFetching` in the UI. `isPending` means show a skeleton — there is nothing to display. `isFetching` with existing `data` means keep showing the data and hint at a refresh; replacing a populated screen with a spinner is a downgrade.',
    ),

    h('Mutations'),
    code(
      jsx(`
function NewTask() {
  const queryClient = useQueryClient();

  const { mutate, isPending } = useMutation({
    mutationFn: (input) => api.createTask(input),
    onSuccess: () => {
      // Mark every ['tasks', …] query stale so visible ones refetch.
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); mutate({ title }); }}>
      <button disabled={isPending}>{isPending ? 'Saving…' : 'Add'}</button>
    </form>
  );
}
`),
    ),
    p(
      'Invalidation is prefix-based: `["tasks"]` matches `["tasks", { status: "open" }]` and every other variant, so one line after a create refreshes every list on screen.',
    ),

    h('Optimistic updates'),
    code(
      js(`
useMutation({
  mutationFn: (id) => api.toggleTask(id),

  onMutate: async (id) => {
    await queryClient.cancelQueries({ queryKey: ['tasks'] });   // stop a race
    const previous = queryClient.getQueryData(['tasks']);        // snapshot

    queryClient.setQueryData(['tasks'], (old) =>
      old.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));

    return { previous };                                         // -> context
  },

  onError: (err, id, context) => {
    queryClient.setQueryData(['tasks'], context.previous);        // roll back
  },

  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['tasks'] });       // reconcile
  },
});
`),
    ),
    warn(
      'The `cancelQueries` is the part people omit. Without it, a background refetch that started before your optimistic write can resolve after it and overwrite the change — the checkbox flips back for a moment and users report it as a ghost bug.',
    ),
    tip(
      'React 19 has `useOptimistic` for the same idea inside a form action. Use it when the optimistic value is local to one component; use the query cache when other screens show the same data and must all update.',
    ),

    h('Pagination'),
    code(
      jsx(`
// Cursor pagination — the API shape from the Node track.
const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
  queryKey: ['tasks', { status }],
  queryFn: ({ pageParam, signal }) => api.getTasks({ status, cursor: pageParam }, signal),
  initialPageParam: null,
  getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
});

const tasks = data?.pages.flatMap((p) => p.data) ?? [];
`),
    ),
    code(
      js(`
// Offset pagination: keep the previous page on screen while the next loads.
useQuery({
  queryKey: ['tasks', { page }],
  queryFn: () => api.getTasks({ page }),
  placeholderData: keepPreviousData,      // no flash back to a skeleton
});
`),
    ),

    h('Prefetching'),
    code(
      js(`
// On hover, warm the cache so the detail page opens instantly.
<Link
  to={\`/tasks/\${task.id}\`}
  onMouseEnter={() => queryClient.prefetchQuery({
    queryKey: ['task', task.id],
    queryFn: () => api.getTask(task.id),
  })}
/>
`),
    ),

    h('SWR, and doing without'),
    table(
      ['Option', 'Notes'],
      [
        ['**TanStack Query**', 'The default. Mutations, infinite queries, devtools, framework-agnostic'],
        ['**SWR**', 'Smaller and simpler; less mutation machinery'],
        ['**RTK Query**', 'Already using Redux Toolkit — it is included'],
        ['**A framework loader**', 'Next.js server components or React Router loaders fetch before render — see those topics'],
        ['**`use()` + Suspense**', 'React 19 can read a promise during render; you still need something to create and cache it'],
      ],
    ),

    h('Cheatsheet'),
    cheat([
      ['Fetch server data', '`useQuery` with a descriptive `queryKey`'],
      ['Share one request across components', 'The same `queryKey`'],
      ['Stop refetching constantly', 'Raise `staleTime`'],
      ['Show a skeleton vs a refresh hint', '`isPending` vs `isFetching`'],
      ['Refresh a list after a write', '`invalidateQueries({ queryKey: ["tasks"] })`'],
      ['Make it feel instant', '`onMutate` + snapshot + rollback'],
      ['Avoid an optimistic race', '`cancelQueries` first'],
      ['Infinite scroll', '`useInfiniteQuery` + `getNextPageParam`'],
      ['Avoid a page flash', '`placeholderData: keepPreviousData`'],
      ['Raw fetch', 'Check `response.ok`, and abort on cleanup'],
    ]),

    h('Interview'),
    asked([
      ['Why not `useEffect` + `useState` for data?', 'It has no cache, dedupe, retry, cancellation or invalidation — you end up rewriting a query cache badly.'],
      ['What is the `queryKey` for?', 'It is the cache key, the dependency array and the invalidation target at once.'],
      ['`staleTime` vs `gcTime`?', 'How long data is trusted without refetching, versus how long unused data stays in memory.'],
      ['How do you update the list after a create?', '`invalidateQueries` on the list key — matching is prefix-based.'],
      ['How do optimistic updates work?', 'Cancel in-flight queries, snapshot the cache, write the expected value, roll back on error, invalidate on settle.'],
      ['Does `fetch` reject on a 404?', 'No — only on network failure. You must check `response.ok` yourself.'],
      ['Should server data go in Redux?', 'No — it is a cache, not state, and a query library already solves caching correctly.'],
    ]),

    links(
      link('TanStack Query', 'https://tanstack.com/query/latest/docs/framework/react/overview'),
      link('TanStack Query — optimistic updates', 'https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates'),
      reactDoc('reference/react/useOptimistic', 'useOptimistic'),
    ),
  ],
};
