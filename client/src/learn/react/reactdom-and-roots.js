import { cheat, code, h, js, jsx, links, note, p, reactDoc, sig, table, ul, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'React itself knows nothing about the DOM. `react` is the component model — elements, hooks, state — and `react-dom` is the renderer that turns that model into browser nodes. The split is why the same components can be driven by React Native, or by a test renderer, without changing.',
    ),
    p(
      'A **root** is one connection between a React tree and a DOM node. Most apps create exactly one, in their entry file, and never think about it again.',
    ),

    h('createRoot'),
    p(
      'Creates a root for client-side rendering, and returns an object with `render` and `unmount`. This replaced the old `ReactDOM.render` in React 18 — the old call still exists in 18 but warns, and it is gone in 19.',
    ),
    sig([
      ['`domNode`', '`Element`', 'The container React will own. React replaces its contents; anything already inside is discarded.'],
      ['`options.onUncaughtError`', '`function`', 'React 19. Called for an error no error boundary caught.'],
      ['`options.onCaughtError`', '`function`', 'React 19. Called when an error boundary does catch one.'],
      ['`options.identifierPrefix`', '`string`', 'Prefix for `useId`, when two independent React apps share a page.'],
    ]),
    code(
      jsx(`
import { createRoot } from 'react-dom/client';
import { App } from './App.jsx';

const root = createRoot(document.getElementById('root'));
root.render(<App />);

// Later, to tear the whole tree down — effects clean up, state is gone
root.unmount();
`),
    ),
    warn(
      'Create the root once. Calling `createRoot` on the same node twice is a bug that shows up as a tree that has lost all its state; calling `root.render(...)` again on an existing root is fine and is just an update.',
    ),

    h('hydrateRoot'),
    p(
      'For a page whose HTML was already produced on the server. Rather than creating DOM nodes, React walks the markup that is already there and attaches its event handling and state to it — hydration.',
    ),
    p(
      'The rule is that the first client render must produce exactly the same tree as the server did. When it does not, React logs a hydration mismatch and, in React 19, re-renders the offending subtree on the client to recover.',
    ),
    code(
      jsx(`
import { hydrateRoot } from 'react-dom/client';

hydrateRoot(document.getElementById('root'), <App />);
`),
    ),
    table(
      ['Common mismatch cause', 'Fix'],
      [
        ['`Date.now()`, `Math.random()`, locale formatting', 'Render a stable placeholder, then set the real value in an effect'],
        ['Reading `window` or `localStorage` during render', 'Move it into `useEffect`, which never runs on the server'],
        ['Invalid nesting — a `<div>` inside a `<p>`', 'The browser silently repairs the HTML, so the DOM no longer matches. Fix the nesting.'],
        ['Extension-injected markup', 'Usually harmless; `suppressHydrationWarning` on that node if it is genuinely unavoidable'],
      ],
    ),
    note(
      'This app is a Vite SPA — everything renders on the client, so hydration does not apply here. It is the default in Next.js and Remix, which is where you will meet it.',
    ),

    h('flushSync'),
    p(
      'React batches state updates and commits them asynchronously. `flushSync` forces the update inside its callback to be committed to the DOM before it returns.',
    ),
    p(
      'It exists for the narrow case where you need to read or act on the updated DOM immediately — printing, or measuring a node that only exists after the update, or integrating with a third-party library that expects synchronous behaviour.',
    ),
    code(
      js(`
import { flushSync } from 'react-dom';

function addRowAndScroll() {
  flushSync(() => {
    setRows((prev) => [...prev, newRow]);
  });
  // The new row is in the DOM by this line, so this measures correctly.
  listRef.current.lastChild.scrollIntoView();
}
`),
    ),
    warn(
      '`flushSync` opts that update out of every concurrent feature and can noticeably hurt performance. Reach for it only when you have a concrete reason, and never as a fix for "my state seems one render behind" — that is the state snapshot rule, and the answer there is the updater form.',
    ),

    h('The rest of react-dom'),
    table(
      ['API', 'What it is for'],
      [
        ['`createPortal(children, domNode)`', 'Render children into a different DOM node while keeping them in the React tree. See portals.'],
        ['`preload`, `preinit`, `prefetchDNS`', 'React 19 resource hints, so a component can declare what the browser should fetch early.'],
        ['`react-dom/server`', '`renderToPipeableStream` and friends — the server half, used by frameworks rather than app code.'],
      ],
    ),

    h('Cheatsheet'),
    cheat([
      ['Start a client-only app', '`createRoot(node).render(<App />)`'],
      ['Attach to server HTML', '`hydrateRoot(node, <App />)`'],
      ['Tear the app down', '`root.unmount()`'],
      ['Read the DOM right after an update', '`flushSync(() => setX(...))`, sparingly'],
      ['Render outside the parent DOM node', '`createPortal(...)`'],
    ]),
    ul(
      'Two independent React apps on one page: two roots, and pass a different `identifierPrefix` to each so `useId` cannot collide.',
    ),

    links(
      reactDoc('reference/react-dom/client/createRoot', 'createRoot'),
      reactDoc('reference/react-dom/client/hydrateRoot', 'hydrateRoot'),
      reactDoc('reference/react-dom/flushSync', 'flushSync'),
    ),
  ],
};
