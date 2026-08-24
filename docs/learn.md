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

---

## Where the code lives

```
client/src/
  learn/
    tracks.js                 the track registry — React, and what is coming
    blocks.js                 the block constructors content is written with
    progress.js               which topics you have read
    react/
      index.js                the track's table of contents; metadata only
      use-effect.js           one topic, one module          (35 of these)
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

1. The definition, in react.dev's terms.
2. Why it exists — what problem it solves.
3. `sig(...)` — the signature table.
4. The smallest example that shows the point.
5. `h('How it works')` — the mechanism.
6. `warn` / `tip` — the gotchas.
7. `cheat(...)` — the "when do I reach for this" table.
8. `links(reactDoc(...))` — always back to the official page.

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
| `table(columns, rows)` | a table |
| `sig(rows)` | `table` with the header `Parameter / Type / What it does` |
| `cheat(rows)` | `table` with the header `Want to / Reach for` |
| `note` · `tip` · `warn` | a labelled callout |
| `links(link(label, url))` · `reactDoc(path, label)` | the footer links |

`sig` and `cheat` exist so the header row is written once. Writing
`['Parameter', 'Type', 'What it does']` at the top of twenty files is how the
fourth one ends up saying something else.

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
- `/learn` lists React live, Node.js and SQL as *Soon* and not clickable.
- `/learn/react` renders 6 sections and 35 topics; the filter matches title,
  summary **and** tags — try `hook`, `performance`, `ref`.
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
