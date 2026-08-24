# Learn — the reference

The prose version, with the reasoning, is [**Learn** in the README](../README.md#learn).
This is the part that would clutter it: the file layout, the block vocabulary,
and how to add a topic or a whole new track.

- [Where the code lives](#where-the-code-lives)
- [How a topic is authored](#how-a-topic-is-authored)
- [The block vocabulary](#the-block-vocabulary)
- [Inline formatting](#inline-formatting)
- [Adding a topic](#adding-a-topic)
- [Adding a track](#adding-a-track)
- [The reading page](#the-reading-page)
- [Syntax highlighting](#syntax-highlighting)
- [Ask AI](#ask-ai)
- [Verifying it](#verifying-it)
- [What is in each track](#what-is-in-each-track)

---

## Where the code lives

```
client/src/
  learn/
    tracks.js                 the track registry — React, Node.js, and what is coming
    blocks.js                 the block constructors content is written with
    progress.js               which topics you have read
    react/
      index.js                the track's table of contents; metadata only
      use-effect.js           one topic, one module          (35 of these)
    node/
      index.js                the same, for Node.js
      event-loop-phases.js    one topic, one module          (65 of these)
  hooks/useLearnDoc.js        the cache around the dynamic imports
  hooks/useScrollContainer.js the element that actually scrolls, found at runtime
  pages/Learn.jsx             /learn            the hub
  pages/LearnTrack.jsx        /learn/:track     the topic index
  pages/LearnTopic.jsx        /learn/:track/:topic
  components/learn/
    TrackCard.jsx  TopicCard.jsx  LearnToc.jsx  AskAi.jsx
  components/problem/
    GuideBlocks.jsx           the renderer, shared with the pattern guides
    inline.jsx                `code`, **bold**, *italic* inside a sentence
    highlight.js              the Java/C++/JS/JSX lexer

server/src/config/modules.js  the `learn` key, for the admin on/off switch
```

There is **no server code and no database**. Learn content is authored prose
that only we edit, so it ships as JavaScript modules in the client bundle. That
is the whole architectural decision, and it is why `learn` is the one module key
with no matching `requireModule` in `routes/index.js` — there is no API to
guard. Hiding it is therefore cosmetic, which is safe here precisely because
there is nothing behind it but the notes themselves.

## How a topic is authored

A topic is a module exporting one object:

```js
import { cheat, code, h, jsx, links, p, reactDoc, sig, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p('The definition, in the official docs terms.'),
    h('Signature'),
    sig([['`deps`', '`array`', 'What it does.']]),
    code(jsx(`<Thing />`)),
    warn('The mistake people actually make.'),
    h('Cheatsheet'),
    cheat([['Want to', 'Reach for']]),
    links(reactDoc('reference/react/useThing', 'useThing')),
  ],
};
```

The house shape, so the whole track reads the same way:

1. The definition, in the official docs' terms.
2. Why it exists — what problem it solves.
3. `sig(...)` — the signature table, where there is an API to sign.
4. The smallest example that shows the point.
5. `h('How it works')` — the mechanism.
6. `warn` / `tip` — the gotchas.
7. `cheat(...)` — the "when do I reach for this" table.
8. `h('Interview')` + `asked(...)` — **Node only.** The questions this topic gets
   asked, answered in a line each.
9. `links(reactDoc(...))` — always back to the official page.

Step 8 is the one difference between the two tracks. React is written as
reference you reach for while building; Node is written for people preparing for
a backend interview as well, and a topic that cannot be explained out loud has
not been learned. Its examples are also **runnable** — a real file with the
command to run it — and sections 07 to 12 build one `/tasks` API across topics
rather than showing unrelated fragments.

Text is written from the official docs in our own sentences, with the canonical
page linked at the foot. Never bulk-pasted.

## The block vocabulary

`client/src/learn/blocks.js` is a twin of
`server/scripts/seed/guides/blocks.js`, deliberately duplicated rather than
imported: that one is a seed-script dependency under `server/`, and the browser
bundle has no business reaching across the repo for it.

| constructor | block |
|---|---|
| `h(text)` | a section heading, and the anchor the side rail jumps to |
| `p(text)` · `ul(...items)` | prose |
| `code(jsx(src), js(src), ts(src))` | a code block; several variants become a tab strip |
| `code(sh(src))` | a terminal block — commands, not JavaScript |
| `table(columns, rows)` | a table |
| `sig(rows)` | `table` with the header `Parameter / Type / What it does` |
| `cheat(rows)` | `table` with the header `Want to / Reach for` |
| `asked(rows)` | `table` with the header `Asked in interviews / The answer in one line` |
| `note` · `tip` · `warn` | a labelled callout |
| `links(link(label, url))` | the footer links |
| `reactDoc(path, label)` · `nodeDoc(path, label)` · `mdn(path, label)` | a footer link to react.dev, nodejs.org/api or MDN |

`sig`, `cheat` and `asked` exist so the header row is written once. Writing
`['Parameter', 'Type', 'What it does']` at the top of twenty files is how the
fourth one ends up saying something else.

`sh` deliberately uses a `lang` the highlighter does not know, so a command list
falls through to the neutral scan instead of having `install` coloured as an
identifier and `npm` as a function call.

Every one of these is a shape `GuideBlocks` already renders, which is the point
— the code tabs, copy buttons, callout styling and syntax colours all came for
free, and a fix to any of them lands on both surfaces at once.

## Inline formatting

Prose fields accept three markers, parsed by
`client/src/components/problem/inline.jsx`:

| written | renders |
|---|---|
| `` `useEffect` `` | inline code |
| `**important**` | bold |
| `*emphasis*` | italic |

Emphasis nests one way round: the body of a bold or italic run is scanned
again, so ``**a `key` prop**`` is a bold run with real inline code inside it.
That pairing is unavoidable in prose about an API and rendering the backticks
literally looked like a bug. Code spans are the floor and are never rescanned.
The scan reuses one module-level regex, so the recursive call saves and restores
its `lastIndex` — without that, the outer scan resumes at a cursor pointing into
the nested string.

It returns React elements, never a string of HTML, so the guarantee at the top
of `GuideBlocks.jsx` still holds: no content on either surface reaches
`dangerouslySetInnerHTML`.

Two rules keep it from firing on prose that never asked for it:

- A marker must hug a non-space character on both sides, so `2 * 3 * 4` stays
  arithmetic. This is markdown's own rule.
- **Underscore is not a marker**, unlike in markdown. Half the pattern-guide
  prose is about C++, and `lower_bound ... upper_bound` in one sentence is two
  underscores hugging non-space — markdown would italicise straight through the
  middle of two identifiers. Asterisks do not appear in identifiers.

## Adding a topic

1. Write `client/src/learn/react/<slug>.js` exporting `doc`.
2. Add an entry to the right section in `client/src/learn/react/index.js`:

```js
{
  slug: 'use-thing',
  title: 'useThing',
  summary: 'One line, shown on the card and searched by the filter.',
  tags: ['hook', 'performance'],
  ask: ['A question someone stuck on this page would type.'],
  load: () => import('./use-thing.js'),
}
```

Section order is reading order — `flatTopics` in `tracks.js` walks it, so
moving a topic in the index moves it in prev/next too.

Keep `index.js` free of prose. It ships with the track page, and everything in
it is paid for whether or not a topic is opened; the body behind `load` is a
separate chunk that costs nothing until someone clicks.

`ask` is at most three questions. They are a nudge past the blank composer, not
a FAQ.

## Adding a track

1. `client/src/learn/<track>/index.js` with `title`, `summary` and `sections`.
2. One module per topic beside it.
3. Flip the entry in `client/src/learn/tracks.js` from `status: 'soon'` to
   `status: 'live'` and give it a `load`.

Nothing else. The hub, the breadcrumb, the router and the "is this a real
track" check all read the registry.

A `soon` track is listed on purpose rather than hidden — a hub showing what is
coming reads as a plan, one showing a single item reads as abandoned.

## The reading page

### Width

`.learn-page` is a flex row of the column and the rail, capped at 1340px and
centred. The column is 1000px — wider than the guide reader's 720px — and the
**measure is held on the prose blocks, not on the column**:

```css
.learn-col .guide-body > p,
.learn-col .guide-body > ul,
.learn-col .guide-body > .guide-callout { max-width: 74ch; }
```

So paragraphs stay at a readable ~74 characters while code blocks and tables get
the full 1000px. That split is the whole point: a code block is a figure, not
text, and cramming one into a text measure is what made the page feel narrow.
Every override is scoped to `.learn-col` — never to `.guide-body` — because the
pattern-guide reader shares the class names and is a fixed-width modal where
widening the type would be a regression.

### The scroll container

Nothing here listens on `window`. `.content` in the app shell owns the
scrollbar and everything above it is `height: 100%`, so a `window` scroll
listener never fires — and a scroll-spy that silently never updates reads as a
CSS bug rather than a missing listener.

`useScrollContainer()` walks up from a node until it finds an ancestor whose
`overflow-y` is `auto` or `scroll`. It returns `[ref, container]` where `ref` is
a **callback** ref, and that detail is load-bearing: `LearnTopic` renders a
`Loading...` early return before its real markup, so on first mount there is no
node to walk up from. An effect keyed on a ref *object* would run once against
nothing and settle on the document scroller forever. A callback ref fires again
when the real node attaches.

### What the page does

| behaviour | how |
|---|---|
| Progress rule | `scrollProgress(container)` into a `scaleX` transform. Sticky, transform-only, so scrolling never lays anything out. Sits **outside** `.learn-page` — a full-width bar inside a flex row is an item competing for horizontal space. |
| Side rail | Scroll-spy on the same container. A heading is current once it reaches the upper quarter of the scroll region. rAF-throttled. |
| Deep links | A rail click writes `#heading-id` with `replaceState`, so a section is copyable from the address bar without piling up history entries. On load, a hash suppresses the scroll-to-top and scrolls to the anchor once the topic's chunk has landed. |
| Arrow keys | `←` / `→` walk the track. Ignored while typing (input, textarea, select, contenteditable), while a modifier is held, and while a modal is open. |
| Read tracking | `learn/progress.js` — `useLocalState` over one map keyed `track/slug`. Auto-marked at 90% scrolled, plus a button to set or unset it. Drives the ticks on topic cards, the per-section counts, and the meters on the track and hub pages. |

Read state is in localStorage, not on the server, which is a deliberate
downgrade from how the roadmap stores progress: Learn has no API, and inventing
a collection and a route so a reference page can draw a tick is a lot of
machinery for a convenience. It does not follow you to another browser.

The 90% threshold is not 100% because the pager, the ask-AI block and the footer
links all sit below the last paragraph — you have finished the words well before
you have finished the page. The mark is idempotent so a scroll handler calling
it every frame does not re-render the page.

## Syntax highlighting

`highlight(source, lang)` takes a language now. `jsx`, `js`, `ts` and `tsx` use
the JavaScript scan: JS and TypeScript keywords, template literals, and a JSX
mode where a name after `<` is a tag and the names inside the tag are
attributes. Anything else falls through to the original Java/C++ scan, so every
pattern-guide call site is unchanged.

It is still a lexer, not a parser. JSX text starting with a capital letter reads
as a type, and `${...}` inside a template literal is coloured as part of the
string. Neither changes what the code means.

## Ask AI

`AskAi.jsx` opens the existing chat dock and sends a pre-written question:

```js
const { setDockOpen, send } = useChat();
const ask = (question) => { setDockOpen(true); send(question); };
```

No new chat plumbing — `ChatLauncher` already mounts the dock on every
signed-in page from `AppShell`, and `ChatContext` holds one conversation shared
by the dock and `/chat`, so an answer started from a topic is still there after
navigating away.

It renders `null` when the chat module is hidden, the same courtesy
`ChatLauncher` extends. The assistant's system prompt in
`server/src/services/chat/prompt.js` names web and framework fundamentals so a
React question gets a straight answer rather than a redirection back to
algorithms.

## Verifying it

```bash
cd client && npm run dev
```

- Sidebar shows **Learn**, in both the collapsed rail and the expanded menu.
- `/learn` lists React and Node.js live, SQL as *Soon* and not clickable.
- `/learn/react` renders 6 sections and 35 topics; the filter matches title,
  summary **and** tags — try `hook`, `performance`, `ref`.
- `/learn/node` renders 12 sections and 65 topics; try the filter on `closure`,
  `event loop`, `interview`, `express`.
- `/learn/node/native-server` and `/learn/node/scope-and-closures` render the
  Interview table, terminal blocks, and `process` / `require` coloured as
  globals. Copy a runnable snippet into a scratch file and run it.
- `/learn/react/use-effect` renders prose, the signature table, JSX code with a
  working language tab and copy button, callouts, the cheatsheet and the
  react.dev links. Inline `` `code` `` renders as code.
- The side rail tracks the heading you are reading; clicking one jumps to it and
  writes the anchor to the address bar. It disappears below 1240px.
- The rule under the top bar fills as you scroll.
- Reaching the bottom ticks the topic; the tick shows on its card back on
  `/learn/react`, and the counts and meters follow.
- Prev/next walks the track in index order, and so do `←` and `→` — but not
  while the cursor is in the filter box.
- Paste a URL with a `#section` anchor: it opens at that heading, not the top.
- **Ask AI** opens the dock and streams a reply; the buttons are gone when the
  chat module is hidden.
- Open a pattern guide from the roadmap — Java and C++ highlighting and the
  guide body are unchanged.
- Admin → Modules → hide **Learn**: the nav entry goes and `/learn` falls
  through to the roadmap.

```bash
npm run build
```

Each topic must appear as its own chunk of a few kB. If the main bundle grows
by the size of the notes, something is importing a topic module statically
instead of through `load`.

## What is in each track

The catalogue — what exists, in one line each, so you can see the shape of a
track without opening it. One section per track; SQL gets its own when it is
written.

Generated from the track's `index.js`, which is the only place these titles and
summaries live. If you add a topic, copy its row here too.

### React

35 topics in 6 sections, in reading order. Each file is
`client/src/learn/react/<slug>.js`.

**Foundations** — What React is doing between your state update and the pixels.

| topic | |
|---|---|
| **How React works** <br> `how-react-works` | Render, reconcile, commit — and where the virtual DOM actually fits. |
| **JSX** <br> `jsx` | Syntax sugar over function calls, and the rules that fall out of that. |
| **ReactDOM and roots** <br> `reactdom-and-roots` | createRoot, render, hydrateRoot, flushSync — the boundary between React and the page. |
| **StrictMode** <br> `strict-mode` | Why your component renders twice in development, on purpose. |

**Components and state** — The data flowing down, and the state that makes it change.

| topic | |
|---|---|
| **Components and props** <br> `components-and-props` | Functions that take props and return UI, and what "read-only" really means. |
| **State** <br> `state` | Snapshots, batching, the updater form, and why you never mutate. |
| **Lists and keys** <br> `lists-and-keys` | What a key is for, and the damage an index does. |
| **Conditional rendering** <br> `conditional-rendering` | Branching in JSX, and the falsy values that leak onto the page. |
| **Forms and controlled inputs** <br> `forms` | Controlled vs uncontrolled, and which one you actually want. |
| **Lifting state and composition** <br> `lifting-state` | Where state belongs, and passing JSX instead of props. |

**Hooks** — Every built-in hook: what it returns, when it runs, what it costs.

| topic | |
|---|---|
| **Rules of hooks** <br> `rules-of-hooks` | Top level, same order, every render — and the reason behind it. |
| **useState** <br> `use-state` | A value that survives re-renders, and a function that schedules one. |
| **useEffect** <br> `use-effect` | Synchronise with something outside React — and clean up after yourself. |
| **useLayoutEffect** <br> `use-layout-effect` | The effect that runs before the browser paints, and its price. |
| **useRef** <br> `use-ref` | A mutable box that does not trigger a re-render. |
| **useContext** <br> `use-context` | Read a value from the nearest provider above you. |
| **useReducer** <br> `use-reducer` | State transitions as data, for when useState stops scaling. |
| **useMemo** <br> `use-memo` | Cache a computed value between renders — when it is actually worth it. |
| **useCallback** <br> `use-callback` | useMemo for functions, and why a stable identity matters. |
| **useTransition** <br> `use-transition` | Mark an update as interruptible so typing stays smooth. |
| **useDeferredValue** <br> `use-deferred-value` | Let one value lag behind so the rest of the UI keeps up. |
| **useId** <br> `use-id` | A unique id that matches between server and client. |
| **useSyncExternalStore** <br> `use-sync-external-store` | Subscribe to something outside React without tearing. |
| **Custom hooks** <br> `custom-hooks` | Sharing logic, not state — and what "use" actually buys you. |

**Advanced** — The APIs you reach for once the basics are not the problem any more.

| topic | |
|---|---|
| **Context patterns** <br> `context-patterns` | Splitting providers, memoising the value, and when not to bother. |
| **memo and performance** <br> `memo-and-performance` | What memo compares, when it pays, and how to find the real cost. |
| **Error boundaries** <br> `error-boundaries` | Catching a render crash before it blanks the page. |
| **Portals** <br> `portals` | Render somewhere else in the DOM, stay where you are in the tree. |
| **lazy and Suspense** <br> `lazy-and-suspense` | Code splitting, and a boundary that shows a fallback while you wait. |
| **Refs to components** <br> `refs-and-imperative-handle` | forwardRef, useImperativeHandle, and ref-as-a-prop in React 19. |

**React 19** — What changed, and what it replaced. This app runs React 18, so read these as "what is next".

| topic | |
|---|---|
| **Actions and form hooks** <br> `react-19-actions` | useActionState and useFormStatus — pending, error and result, handled for you. |
| **useOptimistic** <br> `use-optimistic` | Show the result before the server confirms it, and roll back if it fails. |
| **The use API** <br> `use-api` | Read a promise or a context during render — and it is not a hook. |
| **Other React 19 changes** <br> `react-19-changes` | ref as a prop, &lt;Context&gt; as a provider, ref cleanup, document metadata. |

**Pitfalls** — The bugs that are not bugs — the ones that come from the model, not the code.

| topic | |
|---|---|
| **Common pitfalls** <br> `common-pitfalls` | Stale closures, derived state, effect abuse, unstable deps. |

### Node.js

65 topics in 12 sections, in reading order. Each file is
`client/src/learn/node/<slug>.js`.

**JavaScript foundations** — The language Node runs. Most "Node is confusing" is really this, unlearned.

| topic | |
|---|---|
| **Values and types** <br> `values-and-types` | Primitives and objects, copying by value or by reference, and the equality you should use. |
| **Functions** <br> `functions` | Declarations, expressions, arrows, and functions as values you pass around. |
| **Scope and closures** <br> `scope-and-closures` | The scope chain, hoisting, the TDZ, and why a function remembers where it was born. |
| **this and context** <br> `this-and-context` | Four rules that decide what `this` is, and the one that arrows opt out of. |
| **Objects and destructuring** <br> `objects-and-destructuring` | Spread, destructuring, optional chaining, and the copy that is shallower than you think. |
| **Array methods** <br> `array-methods` | map, filter, reduce, find, some, sort, flat — which loop each one replaces. |
| **Classes and prototypes** <br> `classes-and-prototypes` | The prototype chain, what `class` desugars to, and inheritance you will actually use. |

**Async JavaScript** — Callbacks, promises and await — the three ways to say "later", in the order they were invented.

| topic | |
|---|---|
| **Callbacks** <br> `callbacks` | The error-first convention, and the nesting that made promises necessary. |
| **Promises** <br> `promises` | A value that is not here yet: states, chaining, and turning a callback API into one. |
| **async and await** <br> `async-await` | Promises that read like straight-line code, and the loop that quietly made it serial. |
| **Promise combinators** <br> `promise-combinators` | all, allSettled, race, any — and running a hundred jobs without opening a hundred sockets. |
| **Errors and throwing** <br> `errors-and-throwing` | Error objects, custom classes, and the rejection that takes the process down with it. |

**Node fundamentals** — What the runtime is made of, and the commands to make it run something.

| topic | |
|---|---|
| **What is Node.js** <br> `what-is-node` | A runtime, not a language: V8, libuv, and what the browser gave up to get here. |
| **Node architecture** <br> `node-architecture` | One JS thread, a thread pool behind it, and the OS doing the waiting. |
| **Your first script** <br> `first-script` | Install it, check the version, run a file, use the REPL — the commands, in order. |
| **npm and package.json** <br> `npm-and-package-json` | Dependencies, scripts, semver ranges, and why the lockfile is the file that matters. |
| **Globals** <br> `globals` | What exists without importing anything: process, Buffer, console, timers, fetch. |
| **process and the environment** <br> `process-and-env` | argv, env, exit codes and signals — how a Node program talks to whatever started it. |

**Modules** — Two module systems, one resolution algorithm, and a standard library worth a tour.

| topic | |
|---|---|
| **CommonJS** <br> `commonjs` | require, module.exports, the wrapper function, and the cache that surprises everyone once. |
| **ES modules** <br> `es-modules` | import, export, "type": "module", top-level await — and what breaks on the way over. |
| **Module resolution** <br> `module-resolution` | How a bare specifier becomes a file, and what an exports map decides. |
| **The built-in modules** <br> `builtin-modules` | A tour of the standard library: path, url, os, crypto, util — and what each is for. |

**The event loop** — The heart of the runtime, phase by phase — and every ordering question it answers.

| topic | |
|---|---|
| **Event loop phases** <br> `event-loop-phases` | One full turn of the loop, in order, with what queues into each phase. |
| **Microtasks and macrotasks** <br> `microtasks-and-macrotasks` | nextTick, promises, setImmediate, setTimeout — predict the output, then run it. |
| **Timers** <br> `timers` | setTimeout, setInterval, drift, unref, and why 0 does not mean now. |
| **Blocking the event loop** <br> `blocking-the-event-loop` | CPU-bound work in an I/O-bound runtime: how to see it, measure it, and move it. |
| **Async patterns** <br> `async-patterns` | Serial, parallel, batched and queued — choosing the shape on purpose. |

**Files, buffers and streams** — Reading the disk without reading it all into memory, and the events underneath.

| topic | |
|---|---|
| **The fs module** <br> `fs-module` | Read, write, append, delete — and the three API flavours to pick between. |
| **Paths and directories** <br> `paths-and-directories` | path.join over string concatenation, plus mkdir, readdir and stat. |
| **Buffers** <br> `buffers` | Fixed-length binary data, encodings, and why a string is the wrong tool for bytes. |
| **Streams** <br> `streams` | Readable, Writable, Duplex, Transform — data in pieces, at constant memory. |
| **Backpressure** <br> `backpressure` | What happens when the writer is slower than the reader, and who is supposed to notice. |
| **EventEmitter** <br> `event-emitter` | The pattern most of Node is built on: on, once, emit — and the listener leak. |

**HTTP and your first server** — The protocol, then a server with no framework — so you know what a framework is doing.

| topic | |
|---|---|
| **HTTP fundamentals** <br> `http-fundamentals` | Request, response, headers, body, and every part of a URL named. |
| **Methods and status codes** <br> `http-methods-and-status` | GET to DELETE, safe vs idempotent, and the twenty codes worth knowing cold. |
| **Your first server** <br> `native-server` | http.createServer, listen, respond with JSON — running in ten lines, no dependencies. |
| **Routing by hand** <br> `routing-by-hand` | Parsing a JSON body and matching a URL yourself — the case Express makes for itself. |
| **Headers and cookies** <br> `headers-and-cookies` | Content types, caching, Set-Cookie and the flags that make a cookie safe. |

**Express** — The same server, rewritten — then given the structure a real service needs.

| topic | |
|---|---|
| **Express basics** <br> `express-basics` | Install it, port the native server over, and see what disappeared. |
| **Routing** <br> `routing` | Params, query, body, Router — and why route order decides which one wins. |
| **Middleware** <br> `middleware` | The one signature everything in Express shares, and what next() really does. |
| **Error handling** <br> `express-errors` | The four-argument handler, async errors, and one error class for the whole API. |
| **Project structure** <br> `project-structure` | routes → controllers → services → repositories, and what belongs in each. |
| **Config and environments** <br> `config-and-env` | One validated config object, loaded once, so nothing reads process.env twice. |

**REST APIs** — Turning endpoints into an interface someone else can use without asking you.

| topic | |
|---|---|
| **REST principles** <br> `rest-principles` | Resources, statelessness, and the CRUD-to-HTTP mapping the whole style rests on. |
| **API design** <br> `api-design` | Naming, status codes, and one response and error envelope used everywhere. |
| **Pagination, filtering, sorting** <br> `pagination-filtering-sorting` | Offset vs cursor, safe filters, safe sorts — and the page that skips a row. |
| **Validation** <br> `validation` | Zod at the edge on body, query and params — and 400 vs 422. |
| **Versioning and idempotency** <br> `versioning-and-idempotency` | Changing an API without breaking callers, and a retry that does not double-charge. |

**PostgreSQL** — SQL worth writing by hand, then the driver, the ORM, and the query plan.

| topic | |
|---|---|
| **SQL basics** <br> `sql-basics` | Tables, keys, constraints, and the four statements that do almost everything. |
| **Joins and aggregates** <br> `joins-and-aggregates` | Join types, GROUP BY, HAVING, CTEs and window functions — read one, write one. |
| **Postgres from Node** <br> `node-postgres` | The pg pool, parameterised queries, and never building SQL with a template string. |
| **Transactions and concurrency** <br> `transactions` | ACID, isolation levels, lost updates, deadlocks — and locking a row on purpose. |
| **Prisma** <br> `prisma` | Schema, relations, migrations, typed queries — and where you still drop to SQL. |
| **Indexes and performance** <br> `indexes-and-performance` | What an index costs, reading EXPLAIN, and killing the N+1 query. |

**Authentication** — Who is calling, and what they are allowed to do — done the boring, correct way.

| topic | |
|---|---|
| **Authentication vs authorization** <br> `auth-vs-authorization` | Two questions people merge into one, and the two layers that answer them. |
| **Passwords** <br> `passwords` | Hashing with bcrypt or argon2, register, log in, reset — and never storing the password. |
| **JWT** <br> `jwt` | What is really inside a token, access vs refresh, expiry, and rotation. |
| **Sessions and cookies** <br> `sessions-and-cookies` | Server-side sessions, cookie flags, and choosing between this and a JWT. |
| **Authorization and RBAC** <br> `authorization-rbac` | Roles, permissions, and the ownership check that role checks always miss. |

**Security** — The attacks that actually reach a Node API, and the line of code that stops each one.

| topic | |
|---|---|
| **The threats that matter** <br> `api-threats` | What a public API is attacked with, ranked by how often it works. |
| **Injection** <br> `injection` | SQL and NoSQL injection, command injection, and why parameterising ends all three. |
| **XSS and CSRF** <br> `xss-and-csrf` | Two browser attacks, why one still hits your JSON API, and where each is stopped. |
| **CORS and security headers** <br> `cors-and-headers` | What CORS is really protecting, the preflight, and what helmet sets for you. |
| **Secrets and rate limiting** <br> `secrets-and-rate-limiting` | Keeping keys out of the repo, and keeping one client from being all your traffic. |

### SQL

Not written yet.
