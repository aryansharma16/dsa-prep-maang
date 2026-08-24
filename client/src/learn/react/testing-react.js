import { asked, cheat, code, h, jsx, js, link, links, note, p, sh, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'React Testing Library has one rule, and everything else follows from it: **test what a user can see and do, not what the component does internally.** A test that asserts on state, props or a class name breaks when you refactor and passes when the button is broken. A test that clicks a button and reads the screen does the opposite.',
    ),

    h('Setup'),
    code(
      sh(`
npm install -D vitest @testing-library/react @testing-library/user-event \\
  @testing-library/jest-dom jsdom
`),
    ),
    code(
      js(`
// vite.config.js
test: {
  environment: 'jsdom',
  globals: true,
  setupFiles: './src/test/setup.js',
}

// src/test/setup.js
import '@testing-library/jest-dom/vitest';   // toBeInTheDocument, toBeDisabled, …
import { cleanup } from '@testing-library/react';
afterEach(cleanup);
`),
    ),

    h('The first test'),
    code(
      jsx(`
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

test('adds a task', async () => {
  const user = userEvent.setup();          // ALWAYS setup() first
  render(<TaskForm onAdd={vi.fn()} />);

  await user.type(screen.getByLabelText(/title/i), 'Ship it');
  await user.click(screen.getByRole('button', { name: /add/i }));

  expect(screen.getByText('Ship it')).toBeInTheDocument();
});
`),
    ),
    warn(
      'Use `userEvent`, not `fireEvent`. `fireEvent.click` dispatches one synthetic event; `user.click` fires the whole real sequence — pointer down, focus, mouse up, click — and refuses to click a disabled or covered element. It catches bugs `fireEvent` walks straight past.',
    ),

    h('Queries, in priority order'),
    table(
      ['Query', 'Use', 'Why'],
      [
        ['`getByRole(role, { name })`', '**First choice, almost always**', 'It is how assistive technology sees the page'],
        ['`getByLabelText`', 'Form fields', 'Fails if the label is not associated — a real accessibility bug'],
        ['`getByPlaceholderText`', 'Only when there is no label', 'A placeholder is not a label'],
        ['`getByText`', 'Non-interactive content', ''],
        ['`getByTestId`', '**Last resort**', 'Invisible to users; couples the test to markup'],
      ],
    ),
    code(
      jsx(`
screen.getByRole('button', { name: /save/i });
screen.getByRole('textbox', { name: /email/i });
screen.getByRole('heading', { level: 1 });
screen.getByRole('checkbox', { name: /done/i, checked: true });
screen.getByRole('alert');                       // error messages
`),
    ),
    tip(
      'Preferring `getByRole` makes your tests double as accessibility checks. A button with no accessible name, an input with no label or a `<div onClick>` pretending to be a button all become impossible to query — so the test fails and points at a real defect.',
    ),
    table(
      ['Prefix', 'When it fails', 'For'],
      [
        ['`getBy…`', 'Throws immediately if absent', 'It should already be there'],
        ['`queryBy…`', 'Returns `null`', '**Asserting absence** — the only correct use'],
        ['`findBy…`', 'Async, retries until timeout', 'It will appear after a fetch or a transition'],
      ],
    ),
    code(
      jsx(`
expect(screen.queryByRole('alert')).not.toBeInTheDocument();   // absence
expect(await screen.findByText('Saved')).toBeInTheDocument();  // appears later
`),
    ),

    h('Async'),
    code(
      jsx(`
test('shows tasks after loading', async () => {
  render(<Tasks />);

  expect(screen.getByRole('status')).toBeInTheDocument();       // spinner now
  expect(await screen.findByText('Ship it')).toBeInTheDocument(); // data later
  expect(screen.queryByRole('status')).not.toBeInTheDocument();  // spinner gone
});
`),
    ),
    warn(
      'Never `await new Promise(r => setTimeout(r, 500))` to "wait for the fetch". It makes the suite slow and still flaky. `findBy*` and `waitFor` retry until the condition holds or the timeout expires — they are both faster and more reliable.',
    ),
    code(
      js(`
// waitFor, for assertions with no element to find.
await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));

// waitForElementToBeRemoved, for the disappearance of a loading state.
await waitForElementToBeRemoved(() => screen.queryByRole('status'));
`),
    ),

    h('Mocking the network, not your code'),
    p(
      'Mock Service Worker intercepts requests at the network layer, so your component runs its real fetching code — including the query library, retries and error handling.',
    ),
    code(
      js(`
// src/test/server.js
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

export const server = setupServer(
  http.get('/api/tasks', () =>
    HttpResponse.json({ data: [{ id: '1', title: 'Ship it', done: false }] })),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
`),
    ),
    code(
      jsx(`
test('shows an error when the API fails', async () => {
  server.use(
    http.get('/api/tasks', () => new HttpResponse(null, { status: 500 })),
  );

  render(<Tasks />, { wrapper: TestProviders });
  expect(await screen.findByRole('alert')).toHaveTextContent(/could not load/i);
});
`),
    ),
    tip(
      '`onUnhandledRequest: "error"` is worth setting. It turns "the component quietly called an endpoint nobody mocked" from a mysterious timeout into a named failure.',
    ),

    h('A test wrapper'),
    code(
      jsx(`
// Providers most components need. A fresh QueryClient per test — otherwise
// one test's cached data makes the next one pass for the wrong reason.
export function TestProviders({ children }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

// Re-export a render that always wraps.
export const renderWithProviders = (ui, options) =>
  render(ui, { wrapper: TestProviders, ...options });
`),
    ),
    warn(
      '`retry: false` in tests is important. The default retry means a test asserting an error state waits through several retries and then times out — the assertion was right, the test still failed.',
    ),

    h('Testing a hook'),
    code(
      js(`
import { renderHook, act } from '@testing-library/react';

test('useCounter increments', () => {
  const { result } = renderHook(() => useCounter(0));

  expect(result.current.count).toBe(0);
  act(() => { result.current.increment(); });
  expect(result.current.count).toBe(1);
});
`),
    ),
    note(
      'Reach for `renderHook` only for a genuinely reusable hook with its own logic. A hook that exists to serve one component is better tested through that component, where you find out whether it actually works in context.',
    ),

    h('What not to assert'),
    code(
      jsx(`
// Implementation details — all of these break on a harmless refactor.
expect(wrapper.state('isOpen')).toBe(true);
expect(component.find('Modal').props().visible).toBe(true);
expect(container.querySelector('.btn-primary')).toBeTruthy();
expect(useState).toHaveBeenCalled();

// The behaviour — survives any refactor that keeps the behaviour.
await user.click(screen.getByRole('button', { name: /open/i }));
expect(screen.getByRole('dialog')).toBeInTheDocument();
`),
    ),
    table(
      ['Worth testing', 'Not worth testing'],
      [
        ['Interaction changes what is on screen', 'A component renders without crashing'],
        ['Loading, empty, error and success states', 'That a prop was passed down'],
        ['A form rejects bad input and shows why', 'Internal state values'],
        ['Conditional rendering by role or permission', 'Class names and styling'],
        ['A callback fires with the right arguments', 'Third-party library internals'],
      ],
    ),

    h('Debugging'),
    code(
      js(`
screen.debug();                                    // print the DOM
screen.debug(screen.getByRole('form'));            // one element
screen.logTestingPlaygroundURL();                  // an interactive query builder

// "Unable to find role button" -> list every role actually present:
screen.getByRole('nonexistent');                   // the error enumerates them
`),
    ),

    h('Cheatsheet'),
    cheat([
      ['Render', '`render(<C />, { wrapper: TestProviders })`'],
      ['Find an element', '`getByRole(role, { name })` first'],
      ['Interact', '`const user = userEvent.setup()`, then `await user.click(…)`'],
      ['Wait for something to appear', '`await screen.findBy…`'],
      ['Assert absence', '`expect(screen.queryBy…).not.toBeInTheDocument()`'],
      ['Wait for a non-element condition', '`await waitFor(() => expect(fn).toHaveBeenCalled())`'],
      ['Fake the API', 'MSW handlers — not a mocked fetch'],
      ['Test an error state', 'A one-off MSW handler, and `retry: false`'],
      ['Test a reusable hook', '`renderHook` + `act`'],
      ['See why a query failed', '`screen.debug()`'],
    ]),

    h('Interview'),
    asked([
      ['What is the guiding principle of RTL?', 'Test what a user sees and does; the more your tests resemble real use, the more confidence they give.'],
      ['`getBy` vs `queryBy` vs `findBy`?', 'Throws if missing, returns null for asserting absence, and async-retries for something that appears later.'],
      ['Why `userEvent` over `fireEvent`?', 'It fires the full realistic event sequence and refuses interactions a real user could not perform.'],
      ['Why prefer `getByRole`?', 'It matches how assistive technology sees the page, so the test also catches accessibility defects.'],
      ['How do you test a component that fetches?', 'Intercept at the network with MSW so the real fetching code runs, then assert the loading, error and success states.'],
      ['Why not assert on state or props?', 'They are implementation details — the test breaks on refactors and passes on real bugs.'],
      ['How do you avoid flaky async tests?', '`findBy`/`waitFor` instead of fixed sleeps, and `retry: false` in the test query client.'],
    ]),

    links(
      link('Testing Library — guiding principles', 'https://testing-library.com/docs/guiding-principles'),
      link('Testing Library — about queries', 'https://testing-library.com/docs/queries/about'),
      link('Mock Service Worker', 'https://mswjs.io/docs'),
    ),
  ],
};
