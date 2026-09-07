# Learn — the reference

Learn is the reference half of this app: **5 tracks, 42 sections, 205 topics** of
authored prose about Complexity, React, Node.js, SQL and Computer Networks. The
roadmap teaches the algorithms; Learn is everything around them.

The prose version of *why*, for a human reading the repo for the first time, is
[**Learn** in the README](../README.md#learn). This file is the part that would
clutter it — the architecture, the data model, the API, the block vocabulary, and
how to add a topic or a whole new track.

**If you are picking this up cold, read [Architecture](#architecture) and
[Invariants](#invariants) and you will not break anything.**

- [Architecture](#architecture)
- [Where the code lives](#where-the-code-lives)
- [The data model](#the-data-model)
- [The API](#the-api)
  - [Caching](#caching)
- [The client](#the-client)
- [Read, and scheduled](#read-and-scheduled)
- [How a topic is authored](#how-a-topic-is-authored)
- [The block vocabulary](#the-block-vocabulary)
- [Inline formatting](#inline-formatting)
- [The seeder](#the-seeder)
- [Adding a topic](#adding-a-topic)
- [Adding a track](#adding-a-track)
- [Invariants](#invariants)
- [What is not built](#what-is-not-built)
- [The look](#the-look)
- [The reading page](#the-reading-page)
- [Syntax highlighting](#syntax-highlighting)
- [Ask AI](#ask-ai)
- [Verifying it](#verifying-it)
- [What is in each track](#what-is-in-each-track)

---

## Architecture

**Authored in git, served from the database.** One sentence, and it is
deliberately two answers rather than one.

```
server/scripts/seed/learn/**        205 JS modules — the source of truth
        │  npm run seed:learn
        ▼
MongoDB  learntracks · learntopics   what the app actually reads
        │  GET /learn/catalogue  ·  GET /learn/topics/:track/:topic
        ▼
client   useLearnCatalogue · useLearnTopic → GuideBlocks
```

The prose is written as JavaScript modules and reviewed as diffs, because a
paragraph about `useEffect` is authored material that wants `git blame`, not a
form. The seeder writes it into Mongo, skipping any topic the admin panel has
edited. The app reads the database and never the files.

**This is the same shape `PatternGuide` already used**, and copying it was the
whole reason the move was cheap. If you have read `server/scripts/seed/guides.js`
you already know this seeder.

### Why it is not in the bundle any more

Until recently all 170 topics shipped as lazy chunks in the client bundle, and
the doc here argued that was the architectural decision. What it cost was
everything the server could not see:

- The revision queue rendered a title **the client had sent it**, because nothing
  on the server could turn `react/use-effect` into "useEffect".
- Renaming a slug orphaned progress rows.
- Cross-track search meant downloading all four track indexes.
- Fixing a typo meant a deploy.

**Bundle size was never the reason**, and a future change should not claim it
was. The topic bodies were already lazy chunks; the main bundle did not contain
them and did not shrink when they left. What *did* change: the build went from
178 JS chunks to 2, and `client/src/learn/` went from 1.9 MB to two files.

Two consequences worth knowing. Hiding Learn in the admin panel now takes the
prose with the pages, where before it could only remove the nav item — a real
change in what that toggle does. And every Learn page now depends on the seeder
having been run, which is a runtime failure where it used to be a build one.

## Where the code lives

```
server/
  scripts/seed/learn.js       the seeder — npm run seed:learn
  scripts/seed/learn/
    tracks.js                 the 5-track registry, and CONTENT_ROOT
    index.js                  reads the tree into plain documents
    verify.js                 npm run seed:learn:verify
    blocks.js                 the block constructors content is written with
    complexity/
      index.js                the track's table of contents; metadata only
      logarithms.js           one topic, one module           (6 of these)
    react/
      index.js                the same, for React
      use-effect.js           one topic, one module          (43 of these)
    node/
      index.js                the same, for Node.js
      event-loop-phases.js    one topic, one module          (68 of these)
    sql/
      index.js                the same, for SQL
      left-and-right-join.js  one topic, one module          (53 of these)
      sample-data.js          the two tables every SQL topic uses — not a topic
    networks/
      index.js                the same, for Computer Networks
      url-to-page.js          one topic, one module          (35 of these)
  src/
    models/LearnTrack.js      one per track; sections embedded
    models/LearnTopic.js      one per topic; blocks: [guideBlockSchema]
    models/LearnProgress.js   one row per account per topic
    models/schemas/guideBlock.js  the block vocabulary, shared with the guides
    validation/blocks.js      the same vocabulary as a request validator
    services/learn.content.js plaintext, word count, reading time — one writer
    controllers/learn.content.controller.js  the catalogue and one topic
    controllers/learn.controller.js          read state, and the revision queue
    routes/learn.routes.js    all eight /learn/* routes, behind requireModule
    utils/httpCache.js        ETag + 304, and the memo behind the catalogue stamp

client/src/
  learn/tracks.js             the five tracks' chrome — icons and the stubs
  learn/progress.js           read state and the revision control
  hooks/useLearnCatalogue.js  the catalogue, fetched once and mirrored to disk
  hooks/useLearnTopic.js      one topic's words, cached for the session
  hooks/useScrollContainer.js the element that actually scrolls, found at runtime
  pages/Learn.jsx             /learn            the hub
  pages/LearnTrack.jsx        /learn/:track     the topic index
  pages/LearnTopic.jsx        /learn/:track/:topic
  components/learn/
    TrackCard.jsx  TopicCard.jsx  LearnToc.jsx  AskAi.jsx
  styles/learn.css            the whole look — tokens, ambient wash, glass, per-track hue
  components/problem/
    GuideBlocks.jsx           the renderer, shared with the pattern guides
    inline.jsx                `code`, **bold**, *italic* inside a sentence
    highlight.js              the Java/C++/JS/JSX/SQL lexer
```

## The data model

Three collections. Two hold content and are written only by the seeder (and, one
day, the admin panel); one holds per-account state.

### `LearnTrack` — 5 documents

```js
{
  slug, name,                       // 'react', 'React'
  hue,                              // a palette NAME from tokens.css: violet|sky|green|amber
  icon,                             // a NAME: clock|layers|globe|table — see below
  status,                           // 'live' | 'soon'
  order,                            // hub order, authored (there are only four)
  blurb,                            // the hub card's sentence
  summary,                          // the track page's hero sentence — a different string
  sections: [{ key, title, blurb, order }],   // embedded, _id: false
  editedAt, editedBy, seededAt,
}
```

**`icon` is a name, not a component.** The registry used to hold a React
component, which is the one field of a track that no JSON response can carry.
`client/src/learn/tracks.js` maps the name back and falls back to a generic icon
rather than crashing, so a fifth track added in the database renders with no
deploy at all.

**Sections are embedded and keyed by a string.** 42 of them, four scalars each,
never fetched without their track. `key` is a plain string and not a subdoc
`_id`, because the seeder rewrites the whole array on every run — a generated id
would be a "stable" pointer that moves. `LearnTopic.section` joins on it.

**`blurb` and `summary` are both kept** and neither is derivable from the other:
one is an advertisement on a card, the other an introduction on a page.

### `LearnTopic` — 205 documents

```js
{
  track, slug, section,             // identity is { track, slug }
  order,                            // reading order within the track, 0..n-1, CONTIGUOUS
  status,                           // 'live' | 'draft' — the catalogue lists only live
  title, summary, tags[], ask[],    // the catalogue's fields
  blocks: [guideBlockSchema],       // the words — see The block vocabulary
  plaintext,                        // select: false — prose only, no code
  wordCount, readingMinutes,        // derived; one writer, services/learn.content.js
  related: { patterns[], problems[] },   // roadmap slugs — designed, not yet populated
  slugHistory[],                    // previous slugs, for resolving old URLs
  version,                          // $inc on every write — the topic's ETag
  editedAt, editedBy, seededAt,
}
```

Indexes:

```js
{ track: 1, slug: 1 }, { unique: true }   // identity; every read and upsert
{ track: 1, order: 1 }                    // a track's list, the catalogue sort
{ status: 1, updatedAt: -1 }              // the catalogue ETag stamp, index-only
{ track: 1, slugHistory: 1 }              // resolving a renamed slug
{ 'related.patterns': 1 }                 // "which topics teach this pattern"
```

**`order` is two guarantees in one number**: the sequence prev/next walks, and
the sequence the section headings group. It is assigned by the seeder from array
position and **never authored**. The old client code got this for free because
`flatTopics` walked the very array the page rendered; this number is what
replaces that guarantee now the array is rows in a database.

**`plaintext` excludes code**, on purpose. A search that matches `const` and
`SELECT` across most of the corpus is not a search, it is a list of every topic.
It is `select: false` because it is 866 KB across the collection and no reader
wants it.

### `LearnProgress` — one row per account per topic

```js
{
  user, track, topic,               // slug pair, NOT a ref to LearnTopic — see below
  title,                            // snapshot, resolved server-side at schedule time
  readAt, lastViewedAt,             // the browsing fact
  scheduledAt,                      // the deliberate act — null means not on the ladder
  confidence, needsRevision,
  revisionReason, revisionNote,     // why the flag is up, and your line about it
  lastReviewedAt, nextReviewAt, reviewStage,   // the 3/7/21/60 ladder
  recalls[],
}
```

**Why the topic is still a slug pair and not a ref.** The old docblock justified
it with "Learn has no collection", and that premise died. The conclusion
survived it: a ref has to be backfilled, and the rows that cannot be — the ones
naming a slug renamed at some point — are exactly the rows a ref is meant to
protect. It would fix them by losing them. `slugHistory` is the version that
works and is strictly larger, because it also fixes bookmarks, roadmap links and
`SqlProblem.learnTopic`. Nothing was migrated and marking a topic stays one
query. `npm run seed:learn` reports rows pointing at slugs that no longer exist,
which is the visibility that replaces enforcement.

## The API

Eight routes, all in `server/src/routes/learn.routes.js`, mounted as
`router.use('/learn', requireModule('learn'), learnRouter)`. The gate is on the
**mount**, so a route added to that file tomorrow is covered by having been added
at all.

| method | path | what |
|---|---|---|
| `GET` | `/learn/catalogue` | every track, section and topic heading — one document, ETagged |
| `GET` | `/learn/topics/:track/:topic` | one topic's blocks; resolves a renamed slug |
| `GET` | `/learn/progress` | every row for this account, in one request |
| `GET` | `/learn/revision` | the topics that are due, shaped for the merged queue |
| `PUT` | `/learn/progress/read` | bulk — the one-time localStorage hand-over |
| `PUT` | `/learn/progress/:track/:topic/read` | the browsing fact; never touches the ladder |
| `PUT` | `/learn/progress/:track/:topic` | schedule with a confidence |
| `POST` | `/learn/progress/:track/:topic/review` | working the queue: `recalled` (with a `grade` of `hard` \| `good` \| `easy`) \| `missed` \| `dismissed` |

`/topics/:track/:topic` rather than `/:track/:topic` so it can never shadow
`/progress`. `/progress/read` is two segments against the three of
`/progress/:track/:topic`, so those two cannot shadow each other either.

### The two content endpoints

| | raw | gzipped |
|---|---|---|
| `GET /learn/catalogue` | 85 KB | **25 KB** |
| `GET /learn/topics/:track/:topic` | 9 KB avg, 24 KB max | 4 KB avg |

```jsonc
// GET /learn/catalogue
{
  "version": 1787925473396,          // max(updatedAt) — the client keys its cache on this
  "tracks": [{
    "slug": "sql", "name": "SQL", "hue": "amber", "icon": "table",
    "status": "live", "order": 3, "blurb": "…", "summary": "…",
    "topicCount": 53,
    "sections": [{
      "key": "joins", "title": "Joins", "blurb": "…",
      "topics": [{ "track", "slug", "title", "summary", "tags": [], "ask": [], "order", "readingMinutes" }]
    }]
  }]
}

// GET /learn/topics/sql/left-and-right-join
{
  "topic": { "track", "slug", "section", "title", "summary", "tags": [], "ask": [],
             "blocks": [ … ], "related": {}, "readingMinutes", "wordCount",
             "version", "updatedAt" },
  "canonical": null                  // set to "sql/join-types" when the slug was renamed
}
```

**One document, not one per track**, because every consumer wants all of it: the
hub searches across tracks and draws four meters, a topic page needs its track's
whole reading order before it can draw a pager or say `07 / 43`. Per-track
endpoints would put the hub back to four requests — the exact problem the old
`requestIdleCallback` fan-out existed to hide, reproduced in HTTP instead of in
the bundler.

**Nested, not flat.** The response is `tracks[].sections[].topics[]`, the shape
the pages render. A flat list would have to be regrouped on arrival, and a
regroup that ever ran inside a render would hand every card a new object — which
is precisely what breaks `TopicCard`'s memo.

**`ask` is included** even though only the topic page reads it. It costs 6 KB
gzipped, and leaving it out would mean the Ask-AI block above a topic's prose
could not render until the body landed.

**A renamed slug answers `200` with `canonical`, not a 301.** An XHR follows a
redirect transparently, so the client would never learn the URL changed and the
address bar would keep the dead one. A body the page can act on lets it call
`navigate(…, { replace: true })`.

### Caching

There was no ETag or `Cache-Control` handling anywhere in `server/src` before
this. `utils/httpCache.js` is fifteen lines:

- **The ETag is set before the work.** Express computes its own from the
  serialised body, which means the query has already run and the JSON has already
  been stringified before it can answer 304. Setting it first wins — `res.send`
  only generates one when the header is absent — and lets the handler return
  before touching Mongo at all.
- **`private, no-cache`.** `private` because every one of these sits below
  `requireAuth` and carries a session cookie. `no-cache` means "store it, but
  revalidate every time", which turns a repeat visit into a 304 with an empty
  body; a `max-age` on content an admin can edit is a stale copy with no way to
  bust it.
- **The catalogue's tag is `W/"learn-<tracks>-<topics>-<maxUpdatedAt>"`**, from
  four index-only queries memoised for ten seconds. The **counts are
  load-bearing**: a deletion does not move any surviving document's `updatedAt`,
  so a tag built only from the newest edit would serve a deleted topic forever.
  That is the classic bug in this pattern and it costs one `countDocuments`.
- **The topic's tag is `W/"<track>/<slug>-<version>"`.**
- **There is no invalidation to write.** A save `$inc`s `version` and bumps
  `updatedAt`; both tags move on the next request. No cache to purge and no
  second worker to notify — which is the entire argument for deriving a validator
  from the data rather than keeping one.

Also new, and not Learn-specific: **`compression` is mounted in `app.js`.** Every
JSON response this API had ever sent went out uncompressed. It is a three-to-one
saving across the whole surface.

## The client

Two hooks, three pages, and one rule.

**The rule: a request means you opened something.** No prefetching, anywhere.
See [What was measured and rejected](#what-was-measured-and-rejected) for the two
kinds that were built and removed. On a walk from the hub into a topic:

```
/learn          GET /learn/progress   GET /learn/catalogue
/learn/react    (nothing)
  …idle, pointer moving over cards…   (nothing)
open a topic    GET /learn/topics/react/use-effect
```

Three requests. Walking three topics with `→` costs three more; walking back over
them costs **zero**.

### `hooks/useLearnCatalogue.js`

Module-scope `cache` + `inflight` + `generation`, the `useGuide.js` shape. Plus:

- **Seeded synchronously from `localStorage` at module load.** This is the whole
  reason it is localStorage and not IndexedDB: an async store cannot answer on
  the first frame, and answering on the first frame is the entire job.
- **`shape(payload)` derives `Icon`, `flat` and `at` once at parse time** — not
  per render. `flat` is the track in reading order; `at` is a `slug → position`
  Map. The spread `{...track}` clones the track and nothing beneath it, so
  `sections` and every topic keep the identity `JSON.parse` gave them. This is
  what `TopicCard`'s memo depends on.
- **A matching `version` keeps the existing object** rather than swapping in a
  fresh parse — 205 memo misses to redraw an identical page is a strange way to
  spend a 304.
- **One request per session, and it took two flags.** `cache` is set at module
  load from disk, so *"do we have a catalogue"* and *"have we confirmed it is
  current"* are different questions; collapsing them gives a choice of two bugs.
  Bail on `cache` and a returning reader never revalidates, so a re-seed is
  invisible until they clear storage. Ignore it and every page mount fires
  another request — hub → track → topic asked three times to learn nothing.
  `validated` is the second flag.
- Exports `findTrack(catalogue, slug)`, `catalogueVersion()` and
  `invalidateLearnCatalogue()`. The last is unused until an editor exists, and
  ships now because the localStorage layer has to agree with the generation
  counter and retrofitting that later is the expensive version.

### `hooks/useLearnTopic.js`

Same shape, keyed by `track/slug`. Two deliberate differences from the
`useLearnDoc` it replaced:

- **No `load` thunk parameter.** It only existed because the loader came off a
  frozen registry, and it was the source of the footgun its own docblock warned
  about: `[key, load]` in the deps meant an inline closure re-ran forever. The key
  *is* the request now.
- **The previous topic's body is cleared during render, not in an effect.** This
  fixed a latent bug: `LearnTopic` does not remount between topics (same route,
  changed params), so a lazy `useState` initialiser runs once and never again.
  The old hook cleared from inside its effect, which runs *after* paint, so every
  prev/next navigation drew the last topic's words under the new one's title for
  a frame.

### The pages

`client/src/learn/tracks.js` is no longer a registry. It holds the two things a
JSON response cannot carry and the one thing that cannot wait for one:
`trackIcon(name)`, and `TRACK_STUBS` — four names, colours and sentences, about
600 bytes. `findTrack` was synchronous and three things leaned on that: the hue
on the shell, the name in the crumb, and the "No such track" gate. The stubs
answer on the first frame and the catalogue replaces them when it lands.

| page | reads |
|---|---|
| `Learn.jsx` | `catalogue.tracks` for the cards, meters and cross-track search; `TRACK_STUBS` until it lands |
| `LearnTrack.jsx` | `track.sections` for the grouped list, `track.flat` for the counts; filters client-side over title + summary + tags |
| `LearnTopic.jsx` | `track.at.get(slug)` for the position, `track.flat` for prev/next, and `useLearnTopic` for the blocks |

Both track-scoped pages need the "slug in neither the stub nor a landed
catalogue" branch: render an empty shell for a frame rather than a verdict,
because `track.hue` on `null` throws.

## Read, and scheduled

Two facts about one topic, on one row, in two fields. **Do not merge them.**

| | field | set by | in the revision queue? |
|---|---|---|---|
| **Read** | `readAt`, `lastViewedAt` | scrolling past 90%, or the button | **never** |
| **Scheduled** | `scheduledAt` + the ladder | pressing *Revise this* with a confidence | yes, when due |

Read used to live in localStorage *specifically* to keep the two apart — a topic
skimmed on a train must not turn up in Tuesday's queue. That was a good argument
for separating the two **meanings** and a bad one for choosing a storage to do
it, which is what it had quietly been conscripted into. `scheduledAt` separates
them properly now, so read is an account fact and follows you between browsers.

`learnRevisionQueue` filters on `scheduledAt: { $ne: null }` and **never**
`readAt`. If you ever change that line, every topic anyone has scrolled to the
bottom of lands in their queue.

Client side, `learn/progress.js` holds one shared map keyed `track/slug`,
hydrated from `GET /learn/progress` and **mirrored write-through to
localStorage** so ticks paint on the first frame. `mark` is optimistic and
**idempotent** — it is called from a scroll handler on every frame past the mark
and writes exactly once. A one-time migration hands the old `learn-read` map to
`PUT /learn/progress/read` and sets a done-flag; it is additive, because that map
is one device's memory and treating an absence in it as "not read" would let the
first laptop to sync erase the second one's ticks.

`markTopic` resolves the title from `LearnTopic` and ignores any `title` in the
request body. The field is still stored, because a queue row has to render for a
topic that has since been deleted.
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
8. `h('Interview')` + `asked(...)` — the questions this topic gets asked,
   answered in a line each. **Every Node, SQL and Networks topic, and the React
   ecosystem section.** Not the rest of React.
9. `links(reactDoc(...))` — always back to the official page.

**Complexity is the exception**, and deliberately. It has no API to sign, so
there is no `sig` step; the tables it does carry are `table(...)` with their own
headers, because "Parameter / Type / What it does" describes nothing about a
sorting algorithm. Its footer link is `wiki(...)` rather than a vendor doc — the
material has no vendor — and its code carries `java` and `js` tabs rather than
`jsx`: Java because it is `DEFAULT_LANG` on the roadmap, JavaScript because it
is the language this reader thinks in, and complexity is a shape that reads the
same in both.

Step 8 marks the interview-oriented material. React's first six sections are
reference you reach for while building, so they stop at step 7; the Node, SQL
and Networks tracks and React's `ecosystem` section are written for someone
preparing for an interview, and a topic that cannot be explained out loud has
not been learned. Node's examples are additionally **runnable** — a real file
with the command to run it — and its sections 07 to 12 build one `/tasks` API
across topics rather than showing unrelated fragments.

**Networks is the other exception, and in the opposite direction to Complexity.**
It has no API to sign either, so no `sig`; what replaces the code example is
usually an ASCII diagram in an `sh` block — a handshake, a route table, a header
layout — because the thing being taught is a *sequence of messages* and there is
no snippet that shows one. Its footer links are `wiki`, `rfc` and `awsDoc`
rather than a single vendor's docs, because a protocol's canonical page is its
specification and a VPC's is Amazon's manual, and those are different kinds of
authority. Its code blocks are `sh` and occasionally `js` — never `java`, since
nothing in the track is an algorithm.

Text is written from the official docs in our own sentences, with the canonical
page linked at the foot. Never bulk-pasted.

## The block vocabulary

`server/scripts/seed/learn/blocks.js` is a twin of
`server/scripts/seed/guides/blocks.js`. They used to be duplicated because one
lived under `client/` and one under `server/`, and the browser bundle had no
business reaching across the repo; both are seed-script dependencies now, so that
argument is gone and they are still two files for a better one. They are two
*vocabularies* for two authors — the guides need `java` and `cpp`, Learn needs
`jsx`, `sql`, `data`, `result` and the eight documentation-link helpers — over
one block schema. `models/schemas/guideBlock.js` is the thing that is genuinely
shared, and `validation/blocks.js` is that same vocabulary as a request
validator, so what the seeder can write and what the admin panel can save are
the same set by construction.

| constructor | block |
|---|---|
| `h(text)` | a section heading, and the anchor the side rail jumps to |
| `p(text)` · `ul(...items)` | prose |
| `code(jsx(src), js(src), ts(src))` | a code block; several variants become a tab strip |
| `code(sh(src))` | a terminal block — commands, not JavaScript |
| `code(java(src))` | the same, for the Complexity track — `java` is not in `JS_LANGS`, so it takes the highlighter's C-family scan, which is the one the pattern guides have always used |
| `code(sql(src))` · `code(mysql(src), postgres(src))` | the same, for the SQL track. One `lang` and three names: the dialect is a tab *label*, never a different scan, and the two-name form is how a topic shows a real dialect difference |
| `table(columns, rows, caption)` | a table, optionally captioned |
| `data(caption, columns, rows)` | a **sample table** — the caption is its real name, set in mono, and the `FROM` clause below it uses that name |
| `result(columns, rows, caption)` | **what the query returned** — the same block, drawn with the track's hue on its edge, because it is the only grid on the page that is an answer |
| `sig(rows)` | `table` with the header `Parameter / Type / What it does` |
| `cheat(rows)` | `table` with the header `Want to / Reach for` |
| `asked(rows)` | `table` with the header `Asked in interviews / The answer in one line` |
| `note` · `tip` · `warn` | a labelled callout |
| `links(link(label, url))` | the footer links |
| `reactDoc(path, label)` · `nodeDoc(path, label)` · `mdn(path, label)` · `wiki(path, label)` · `mysqlDoc(path, label)` · `pgDoc(path, label)` | a footer link to react.dev, nodejs.org/api, MDN, Wikipedia, or the MySQL and PostgreSQL manuals |
| `rfc(number, label)` · `awsDoc(path, label)` | the Networks track's two: an RFC at rfc-editor.org, and a page of the AWS documentation. `rfc` takes a **number**, not a path, so a topic cannot link to a draft by accident |

`sig`, `cheat` and `asked` exist so the header row is written once. Writing
`['Parameter', 'Type', 'What it does']` at the top of twenty files is how the
fourth one ends up saying something else.

`data` and `result` exist for the same reason one level up. A SQL topic is
regularly three grids in a row — here are the tables, here is the query, here is
what came back — and three *unlabelled* grids is a page the reader has to count
their way through. Both are the ordinary `table` block with `caption` and
`variant` set, so `GuideBlocks` renders one table and `learn.css` decides what a
sample looks like against an answer. Every table written before they existed is
unaffected: both fields are optional and default to nothing.

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

## The seeder

```bash
npm run seed:learn -- --dry-run   # validate the whole tree, open no connection
npm run seed:learn                # write it
npm run seed:learn:verify         # compare the database against the files
npm run seed:learn -- --force     # overwrite topics the panel has edited
```

**Everything that can be wrong is found before `connectDb()`.** Track and topic
slugs, uniqueness within a track, every topic's section key existing on its
track, `related.patterns` against `PATTERN_SLUGS` — and **every block against the
shared zod union** from `src/validation/blocks.js`. That last one is what makes
*seedable* and *editable* the same word: a topic this seeder writes that the
admin panel would refuse is a page nobody can fix from the panel, and you find
out when you try. It was green on all 5,495 blocks the day it went in, which is
exactly when a check like that should be installed.

`--dry-run` runs all of it and prints the totals having opened nothing.

**`verify.js` earns its place once.** It compares every authored field of every
topic against what came back out of Mongo — 205 topics and 6,440 blocks — and it
exists because during the cutover both copies were on disk and that was the only
moment the move could be *proved* lossless rather than assumed to be. It compares
the fields an author wrote, not whole documents: Mongoose fills every optional
field on the way in, so a heading comes back carrying an empty `rows` and
`columns`, and a deep equality would fail on all 6,440 and prove nothing.

**The `editedAt` handshake, with one difference from `seed:guides`.** A topic
with `editedAt` set keeps its prose; unlike a guide, it does *not* keep its
placement. `section` and `order` are rewritten on every run regardless:

```js
const structural = { section, order, seededAt: new Date() };          // always
const content    = { title, summary, tags, ask, blocks, ...summarise(blocks) };  // locked
```

A guide has no position — there is one per pattern and nothing moves. A topic
sits in a reading order, and if someone edits topic 12 in the panel and a new
topic is later inserted above it, a frozen `order` breaks prev/next for every
reader with nothing reporting it. A human who edits a topic edited its *prose*;
where it sits in the curriculum is the seed file's business.

**Pruning is three-way.** A topic no longer in the content files and never
hand-edited is deleted. One that *was* edited is somebody's writing and is
reported instead. `LearnProgress` is never cascaded into — those rows are keyed
on slugs, so a deleted topic orphans nothing and a schedule for a topic that
comes back next week survives. The run reports any rows pointing at slugs that no
longer exist, which is the visibility that replaces enforcement.

## Adding a topic

1. Write `server/scripts/seed/learn/react/<slug>.js` exporting `doc`.
2. Add an entry to the right section in `server/scripts/seed/learn/react/index.js`:

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

3. `npm run seed:learn` — or `-- --dry-run` first, which validates every block
   and prints the totals without opening a connection.

Section order is reading order. The seeder numbers topics from their position as
it walks the sections, and `order` is the only thing prev/next and the section
headings both read — so moving a topic in the index moves it everywhere, and the
two cannot drift. It is never written by hand.

`load` still reads as a lazy import and is no longer lazy about anything: the
seeder simply calls it. It stayed because `() => import('./use-thing.js')`
resolves relative to the file that wrote it under Node ESM exactly as it did in
the bundler, which is what let 174 files move without one of them being edited.

`ask` is at most three questions. They are a nudge past the blank composer, not
a FAQ.

## Adding a track

1. `server/scripts/seed/learn/<track>/index.js` with `title`, `summary` and
   `sections`.
2. One module per topic beside it.
3. Add the entry to `server/scripts/seed/learn/tracks.js` with `status: 'live'`.
4. `npm run seed:learn`.

The `hue` on the entry is a name from the palette in `tokens.css`, and it is the
only line that decides the track's ambient wash, its icon tile, its meters, its
section rules and its topics' side rail. See [The look](#the-look).

`icon` is a name too — `clock`, `layers`, `globe`, `table`, `network` — and it is the one
field of a track that a JSON response cannot carry, because it was a React
component. `client/src/learn/tracks.js` maps the name back to a component and
falls back to a generic one rather than crashing, so a *fifth* track added here
shows up with no deploy at all. It will want its icon added to that map to stop
looking generic, which is the only client-side step left in adding a track.

A `soon` track is listed on purpose rather than hidden — a hub showing what is
coming reads as a plan, one showing a single item reads as abandoned.

## Invariants

The things a change here must not break. Each one has cost something to learn.

1. **`order` is contiguous `0..n-1` per track, and assigned from array position
   by the seeder.** It is the sequence prev/next walks *and* the sequence the
   section headings group. Authoring it by hand invites the drift it exists to
   prevent. The seeder asserts it; `verify` checks it.
2. **A locked topic keeps its prose, not its placement.** `editedAt` freezes
   `title`/`summary`/`tags`/`ask`/`blocks`; `section` and `order` are rewritten
   every run. A human who edits a topic edited its *words* — where it sits in the
   curriculum is the seed file's business, and a frozen `order` silently breaks
   prev/next when a topic is inserted above it.
3. **The revision queue filters on `scheduledAt`, never `readAt`.** See
   [Read, and scheduled](#read-and-scheduled).
4. **The catalogue ETag includes document counts, not just `max(updatedAt)`.** A
   deletion moves no surviving document's timestamp.
5. **Nothing maps over the topic list per render.** `Icon`, `flat` and `at` are
   attached once in `shape()`. `TopicCard` is memoised against those object
   identities, and the Node track is 68 cards re-rendered on every keystroke in
   the filter box.
6. **No prefetching.** A request means you opened something.
7. **The block vocabulary is one set across three collections.** `guideBlock.js`
   (Mongoose), `validation/blocks.js` (zod) and `blockKinds.js` (the editor's
   field lists) must agree. A field in one and not the others is silently
   dropped — that is exactly how `caption`/`variant` were lost for a while, and
   fixing only the server fixed nothing because `toPayload` stripped them in the
   browser first.
8. **`AuditLog.targetType` is a closed enum and `recordAudit` swallows its own
   errors.** A value not in `AUDIT_TARGET_TYPES` is a row that silently never
   writes. `learn` is in the list.
9. **`LearnProgress` is never cascaded into.** Deleting a topic orphans nothing;
   the seeder reports orphans instead.
10. **Learn pages depend on the seeder having been run.** A fresh deployment that
    skips `npm run seed:learn` gets an empty Learn. This used to be a build-time
    guarantee and is now a runtime one.

## What is not built

Designed, argued for, and deliberately left out. If you are here to add
something, it is probably one of these.

### The admin editor (prose only)

The intended shape, already decided:

- `client/src/components/admin/AdminLearn.jsx` + `server/src/controllers/admin/learn.controller.js`.
- **Reuse `GuideEditor.jsx` and `BlockFields.jsx` as they stand.** They know
  nothing about patterns — only `GuideEditor`'s load/save/identity is
  guide-specific. `blockKinds.js` is already correct for Learn's blocks.
- **Reuse the `guide:write` capability rather than adding `learn:write`.** It
  protects long-form block prose, a Learn topic *is* long-form block prose, and
  the roles holding it are exactly the right set. Widen the comment in
  `config/roles.js` if you do.
- **Prose only.** `order` and `section` stay outside the editor so the seeder can
  always re-place a topic — see invariant 2.
- The audit actions already exist: `LEARN_TOPIC_SAVE`, `LEARN_TOPIC_UNLOCK`,
  `LEARN_TRACK_SAVE`, and `learn` is in the `targetType` enum.
- `invalidateLearnCatalogue()` and `invalidateLearnTopic()` already exist on the
  client for the save-then-check loop.

One warning from the existing code: `listGuides` and `AdminGuides` are hardwired
to the `Pattern` collection, and `CPPatternGuide` has a model and a seeder but
**no editor at all**. The "one collection gets an editor" precedent has already
failed to generalise once.

### `related.patterns` / `related.problems`

The fields, the index and the seed-time validation against `PATTERN_SLUGS` are
all in place; **nothing populates them.** This is the part that would actually
serve MAANG prep — Complexity's `from-constraints` and `time-complexity` against
the 23 roadmap patterns, and a link back from the pattern guide drawer.

Store slugs, not refs, matching `SqlProblem.learnTopic`. Query the reverse with
`LearnTopic.find({ 'related.patterns': slug })` on the existing index — **do not
store both directions**, that is a second thing to keep true.

Be honest about the scale: it is a handful of hand-authored arrays in the seed
files, not a system.

### Body search

`plaintext` is populated and `select: false`. The house pattern is
`escapeRegex` from `server/src/utils/query.js` over 205 documents — **not** a
Mongo text index. `$text` is stemmed whole-word matching, so it would not match
"memo" against "useMemo", which is literally what the hub's placeholder
advertises; and Mongo permits one text index per collection, which makes it a
one-way door. Revisit at 2,000 topics, not 205.

### Cross-track prerequisites

Cut on purpose. Reading order already expresses within-track prerequisites, and
the section blurbs are the argument in prose. The only version worth defending is
**cross-track** — `node/sql-basics` genuinely presupposes `sql/select-lifecycle`
— and there are maybe eight such pairs and no UI for them. Add it when the "read
this first" banner is designed, not before.

## The look

Learn wears the app's own glass material — the ambient wash on `.shell`, the
translucent panels, the hairlines, the sheen and the lift, all out of
`tokens.css`. None of it is restated in `learn.css`. An earlier version of this
file carried a private copy of the whole set, written when Learn was the only
room built this way; the rest of the app reads the same tokens now, and two
copies of one material is exactly the drift this repo warns about everywhere
else.

What `learn.css` adds is a **light** and a layout. `styles/learn.css` is
imported last in `main.jsx`, after `playbook.css`, because several of its rules
override a plain `.thing` at equal specificity and source order is what decides
those.

The full-bleed is `.content:has(.learn-shell)`, the same trick and for the same
reason as `.content:has(.cp-page)`: `.content` belongs to the app shell several
levels above any page, and a page cannot reach up to it. The light goes edge to
edge; the column inside stays bounded at 1340px and centred.

### The two rules

**Colour is a light, never a fill behind text.** Learn's own wash is three soft
radial lights at the top of the shell, laid into the element's own `background`
rather than drawn by a pseudo-element — a `z-index: -1` pseudo would need a
stacking context on the parent, and a stacking context here would trap the chat
dock under the floating launcher. The last layer is `transparent`, not a colour,
so the app's wash shows straight through and these three are an extra helping of
light over it rather than a replacement for it. Hues then appear on edges,
icons, meters and marks only. Nothing tinted ever sits under a paragraph.

(The app-wide rule about `backdrop-filter` — that there is none, anywhere —
lives in `tokens.css` and in the README. It bites twice here: `.learn-toc` is
`position: sticky` and the chat launcher is `position: fixed`, and an ancestor
carrying a backdrop filter becomes the containing block for fixed descendants.)

**One hue per track, named not valued.** `learn/tracks.js` gives each track a
name out of the palette in `tokens.css` — Complexity `violet`, React `sky`,
Node `green`, SQL `amber`. The pages hand it to `data-hue` on `.learn-shell`
(and `TrackCard` puts it on each card), the `[data-hue='x']` block in
`tokens.css` resolves `--hue` and `--hue-rgb`, and `.learn-shell[data-hue]`
takes the lead light off the accent:

```css
.learn-shell        { --lx-1: var(--accent-rgb); }   /* the hub, which has no one track */
.learn-shell[data-hue] { --lx-1: var(--hue-rgb); }   /* a track page and its topics */
```

`--lx-2` and `--lx-3` are fixed at blue and fuchsia. A lead colour plus those
two spreads into a prism from any starting hue, where three neighbours on the
wheel would read as one smudged light. Because the hue names are the palette's
own, the light theme re-steps a track's colour through the same block that
re-steps every other hue in the app — no second set of values to keep in sync.

The accent is deliberately **not** redefined. It is the one colour the reader
picked, and taking it away here to fly a house colour would make that choice
mean less everywhere else.

### Motion

Only two things move, and both say "this is a link", which the cursor has
already said — so both are off under `prefers-reduced-motion`. A track card's
hue glow is a separate absolutely-positioned `.track-card-lume` element
transitioned on **opacity**, which the compositor can do without repainting the
card or the text on it; the 1px lift is a `transform`. Neither touches layout.

## The reading page

### Width

`.learn-page` is a flex row of the rail and the column, capped at 1340px and
centred. **The rail is first**, so it sits on the left — the row carries no
`order`, so reading order is the only thing deciding the side, and it matches
the field guide at `/docs` where the contents rail is also the first child. A
list of sections is something you consult before the section, not after
scrolling past all of it. Moving it was safe because `headings` is derived from
the block data rather than read out of the DOM, and the scroll-spy resolves each
heading by id, so neither cares which sibling renders first.

The column is 1000px — wider than the guide reader's 720px — and the
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
a **callback** ref, and that detail was load-bearing: `LearnTopic` used to
render a `Loading...` early return before its real markup, so on first mount
there was no node to walk up from. An effect keyed on a ref *object* would run
once against nothing and settle on the document scroller forever.

That early return is gone — the page draws its frame immediately now, so
`.learn-page` is there on the first render either way. The callback ref stays,
because it is still the correct shape: the two `empty` states below it (no such
track, no such topic) render no `.learn-page` at all, and a callback ref simply
fires again if one of them is ever replaced by real markup.

### What the page does

| behaviour | how |
|---|---|
| Progress rule | `scrollProgress(container)` written straight onto the bar's `style.transform` through a ref — **not** React state. Sticky and transform-only, so scrolling never lays anything out. Sits **outside** `.learn-page` — a full-width bar inside a flex row is an item competing for horizontal space. |
| Side rail | Scroll-spy on the same container, against heading offsets measured once rather than re-read every frame. A heading is current once it reaches the upper quarter of the scroll region. rAF-throttled. |
| Deep links | A rail click writes `#heading-id` with `replaceState`, so a section is copyable from the address bar without piling up history entries. On load, a hash suppresses the scroll-to-top and scrolls to the anchor once the topic's body has landed. |
| Arrow keys | `←` / `→` walk the track. Ignored while typing (input, textarea, select, contenteditable), while a modifier is held, and while a modal is open. |
| Read tracking | `learn/progress.js` — one shared map keyed `track/slug`, hydrated from `GET /learn/progress` and mirrored to `localStorage` so the ticks paint on the first frame. Auto-marked at 90% scrolled, plus a button. Optimistic, and **idempotent**: the scroll handler fires every frame past the mark and writes exactly once. Drives the ticks, the per-section counts and the meters. |
| Loading | No page holds the route on a blank `Loading...`. The frame comes from the URL and the requests fill it in: `LearnTrack` draws its title, filter and a grid of correctly-sized `.skeleton` cards; `LearnTopic` draws its crumb, column and progress rule, with the slug spelled out as a placeholder title so the paragraph under it does not jump when the catalogue lands. |

### What scrolling costs

Two things move as you scroll a topic, and both used to do real work per frame.

**The progress rule was React state.** `setProgress` on every animation frame
re-rendered `LearnTopic` — the crumb, both Ask-AI blocks, the revision panel,
the pager and `LearnToc` — sixty times a second to move one bar. `GuideBlocks`
is memoised and sat it out, which is why the page was not *worse*, but
everything around it was not. It is a ref and one `style.transform` write now.
The bar starts at `scaleX(0)` in the stylesheet and the effect takes it from
there, so there is no first-frame flash to render from state either.

**The side rail measured everything, every frame.** A `getElementById` and a
`getBoundingClientRect()` per heading per frame — cheap on a settled page, and a
forced synchronous reflow the moment anything else in the same frame has dirtied
layout, which is exactly what the progress bar above was doing. Heading
positions do not move while you scroll, so they are measured once as offsets
*within the scroll content* (`rect.top - containerRect.top + scrollTop`) and
compared against `scrollTop` after that. The active rule is arithmetically
identical to the old one — the same heading lights up at the same moment.

Re-measured on resize, and whenever `container.scrollHeight` changes. That last
one is the self-healing part: a code tab switching to a longer variant, an image
landing, a web font swapping in are all invisible from here individually, and
all of them move `scrollHeight`. One number read per frame beats twenty
rectangles, and beats a `ResizeObserver` on content this component does not own.

Neither change is visible. Both were found by asking what the page does on a
frame where nothing has happened, which for a reading page is nearly all of
them.

### What the other two pages cost

**The hub fanned out over four track indexes behind `requestIdleCallback`.** That
whole apparatus is gone. One catalogue request answers every question the page
has, it is smaller than the four chunks it replaces, and it blocks nothing — so
there is nothing left to defer, and `whenIdle`, `topicsByTrack` and the
search-jumps-the-queue special case all went with it.

**`TopicCard` is memoised.** The filter box re-renders the track page on every
keystroke, and the Node track is 68 cards — none of which has changed. What used
to guarantee that was a frozen module; what guarantees it now is that the
catalogue is parsed and shaped **once**, at module scope, and nothing downstream
maps over the topic list per render. `Icon`, the flat reading order and the
`slug → position` Map are all attached at parse time for exactly this reason.
A revalidation that comes back with the same `version` deliberately keeps the
existing object rather than swapping in a fresh parse — 205 memo misses to redraw
an identical page is a strange way to spend a 304.

That is *more* stable than before, not less: `LearnTrack` used to `useMemo` a
fresh flattened array whenever its sections changed, and needed a frozen
module-scope `EMPTY` to keep the dependency stable at all. `track.flat` is one
array, computed once, and both of those memos deleted.

### What was measured and rejected

The index → body waterfall, which the move to the database dissolved rather than
solved. A topic's body used to be reachable only through its entry in the track
index, so a cold arrival at `/learn/react/use-effect` was two requests *in a
row*: fetch the index, read `load` off it, fetch the words. Deriving the loader
from the slug with `import.meta.glob` was built, measured and reverted — it put a
map of 117 import thunks in the main bundle, **+5.1 KB gzipped on every first
load of the whole app**, including for people who never open Learn.

The endpoint made the problem disappear. A topic's URL is derivable from the
address bar, so the catalogue and the body leave on the same frame with nothing
generated and nothing added to the bundle. Measured on a cold deep link: the
catalogue started at 342ms and the body at 343ms, and the body *finished first*
— which under the old design was not possible.

**Prefetching, of both kinds, was built and then removed.** `TopicCard` fetched a
topic once the pointer had rested on it for 120ms, and `LearnTopic` fetched its
two neighbours on idle. Neither was expensive and the rest timer did its job — a
sweep down the 68-card Node grid cost nothing.

They went anyway, because of what they looked like from the outside. Resting on
four cards while deciding fetched four topics; opening one topic put three
requests in the panel. The rule now is that **a request means you opened
something**, and it is worth more than the round trip it saves: a network panel
you can read is what you need on the day something is actually wrong, and a page
that speculates is indistinguishable from a page with a bug. Bodies are cached
for the session, so walking back across a track is still free.

`useLocalState` stopped writing what it had just read. Its effect ran on mount as
well as on change, so every component using it serialised its whole value and
wrote it back unchanged on arrival. It compares against `getItem` first now —
app-wide, not Learn-only. `learn/progress.js` no longer uses it at all: read
state is a server fact with a hand-rolled localStorage mirror, because the mirror
has to be read *synchronously at module load* to paint on the first frame, and
has to be written through on an optimistic update rather than on a render.

**Read state was in localStorage, deliberately, and is now on the server.** The
old argument was that syncing it would be wrong — a topic skimmed on a train has
no business in Tuesday's queue. That was a good argument for keeping the two
*meanings* apart and a bad one for choosing a storage to do it, which is what it
had been quietly conscripted into. `scheduledAt` on the row keeps them apart now:
the revision queue reads that field and never `readAt`, so read can be an account
fact and follow you between browsers without the queue hearing about it.

IndexedDB was considered for the catalogue mirror and rejected in one line: it is
async, so it cannot answer on the first frame, and answering on the first frame
is the entire job. Its quota advantage is irrelevant at 60 KB. A service worker
was rejected too — there is no manifest and no offline story anywhere else in the
app, so offline Learn alone would be an inconsistency rather than a feature.

The 90% threshold is not 100% because the pager, the ask-AI block and the footer
links all sit below the last paragraph — you have finished the words well before
you have finished the page. The mark is idempotent so a scroll handler calling
it every frame does not re-render the page.

## Syntax highlighting

`highlight(source, lang)` takes a language now, and picks between **three**
scans. `jsx`, `js`, `ts` and `tsx` use the JavaScript one: JS and TypeScript
keywords, template literals, and a JSX mode where a name after `<` is a tag and
the names inside the tag are attributes. `sql` uses its own. Anything else falls
through to the original Java/C++ scan, so every pattern-guide call site is
unchanged.

SQL needed a scan of its own rather than a third keyword set bolted onto the
C-family one, because the two disagree about the rule the C scan leans on
hardest: there, an identifier starting with a capital is a type. In SQL, capitals
are what people put on **keywords**, and half of those keywords — `SELECT`,
`ORDER`, `KEY`, `NAME` — are perfectly ordinary column names in lowercase. So the
SQL lists are matched **case-insensitively** and capitalisation decides nothing.
Three other differences fall out of the same file: `--` and `#` open a line
comment rather than `//`, a string is single-quoted with `''` as the escape, and a
*quoted identifier* — MySQL's backticks, everyone else's double quotes — gets its
own alternative in the regex so `` `order` `` is coloured as the column name it is
rather than as a literal.

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
cd server && npm run seed:learn -- --dry-run && npm run seed:learn && npm run seed:learn:verify
cd client && npm run dev
```

- The dry run prints **5 tracks, 42 sections, 205 topics, 6440 blocks** and says
  every block validates. `verify` compares all 205 against the database and says
  the move is lossless. Re-running the seeder writes the same numbers again.
- `curl` the catalogue: ~85 KB, and ~25 KB with `Accept-Encoding: gzip`. Repeat
  it with `If-None-Match` and get a **304 with an empty body**. Delete a topic in
  Mongo and the catalogue's ETag moves — that is the document count in the tag
  doing its job, and the half of it that `max(updatedAt)` cannot do alone.
- Sidebar shows **Learn**, in both the collapsed rail and the expanded menu.
- `/learn` lists five live tracks — Complexity first, then React, Node.js, SQL
  and Computer Networks — with a meter under each.
- `/learn/complexity` renders 3 sections and 6 topics.
- `/learn/complexity/logarithms` renders the halving table, the Java/JS code
  tabs and the rules table. `/learn/complexity/cheatsheet` renders eight tables
  and none of them scrolls sideways at 1000px.
- `/learn/react` renders 7 sections and 43 topics; the filter matches title,
  summary **and** tags — try `hook`, `performance`, `ref`, `typescript`.
- `/learn/node` renders 13 sections and 68 topics; try the filter on `closure`,
  `event loop`, `interview`, `express`.
- `/learn/sql` renders 10 sections and 53 topics, in amber; the filter matches
  title, summary and tags — try `joins`, `normalisation`, `null`, `window`,
  `interview`.
- `/learn/sql/left-and-right-join` renders the two captioned sample tables, the
  query, and a captioned result grid under each — the result grid wearing the
  track's hue on its edge. SQL keywords are coloured, `--` comments are grey, a
  backticked identifier is not coloured as a string, and the Java/C++ and JS
  guides are unaffected.
- `/learn/sql/sql-overview` has a code block with **MySQL** and **PostgreSQL**
  tabs; switching them re-highlights and the copy button copies the visible tab.
- `/learn/sql/read-phenomena` and `/learn/sql/isolation-levels` render the
  two-session timelines without a horizontal scrollbar at 1000px.
- Every SQL topic ends with an **Interview** table and a links block. Spot-check
  a result grid against the data in `sql/sample-data.js` — six employees, four
  departments, Radia with no department, Legal with no employees.
- `/learn/networks` renders 9 sections and 35 topics, in teal, with the node
  glyph on its icon tile. The filter matches title, summary and tags — try
  `tcp`, `dns`, `aws`, `interview`, `cidr`.
- `/learn/networks/url-to-page` renders the sixty-second answer as bullets and
  then the long version; `/learn/networks/cheatsheet` renders fourteen reference
  tables and none of them scrolls sideways at 1000px. Every Networks topic ends
  with an **Interview** table and a links block, and the RFC links resolve.
- `/learn/react` ends with **The ecosystem** — 8 topics carrying Interview
  tables, unlike the six sections above them.
- `/learn/node/native-server` and `/learn/node/scope-and-closures` render the
  Interview table, terminal blocks, and `process` / `require` coloured as
  globals. Copy a runnable snippet into a scratch file and run it.
- `/learn/react/use-effect` renders prose, the signature table, JSX code with a
  working language tab and copy button, callouts, the cheatsheet and the
  react.dev links. Inline `` `code` `` renders as code.
- The side rail tracks the heading you are reading; clicking one jumps to it and
  writes the anchor to the address bar. It disappears below 1240px.
- The rule under the top bar fills as you scroll. With the Profiler recording,
  scrolling a long topic commits **nothing** — the bar is not React state. The
  side rail still tracks, and still tracks after switching a code block to its
  other language tab, which changes the page height under it.
- Reaching the bottom ticks the topic; the tick shows on its card back on
  `/learn/react`, and the counts and meters follow. Scroll past the mark a dozen
  times with the network panel open: **one** `PUT …/read`, not one per frame.
- Clear `localStorage` and reload: the ticks come back, because they are on the
  server now. Confirm the topic did **not** enter `/revision` — read and
  scheduled are different fields, and only *Revise this* schedules.
- Press **Revise this**: it appears in `/revision` under its real title, resolved
  server-side. Sending a wrong `title` in the request body changes nothing.
- Prev/next walks the track in index order, and so do `←` and `→` — but not
  while the cursor is in the filter box. Both neighbours are already fetched.
- Sweep the pointer down `/learn/node` without stopping: the network panel shows
  no topic requests — and resting on one changes nothing either. Only a click
  fetches. Walk three topics with `→` and then back with `←`: three requests out,
  **none** on the way back.
- Deep-link a topic cold: the catalogue and the body start on the **same frame**,
  not one after the other.
- Paste a URL with a `#section` anchor: it opens at that heading, not the top.
- **Ask AI** opens the dock and streams a reply; the buttons are gone when the
  chat module is hidden.
- `/learn/sql/left-and-right-join` renders two captioned sample grids and nine
  captioned result grids — that is the `caption`/`variant` round trip, from the
  seed file through Mongo to the DOM.
- Open a pattern guide from the roadmap — Java and C++ highlighting and the
  guide body are unchanged. Edit a guide's table in the admin panel and give it a
  caption: it survives the save, which it did not before.
- Admin → Modules → hide **Learn**: the nav entry goes, `/learn` falls through to
  the roadmap, **and `/learn/catalogue` 404s**. The prose goes with the pages
  now, which it could not before.

```bash
npm run build
```

**No per-topic chunks at all.** There were 170 of them — `logarithms-*.js`,
`use-state-*.js` — and `client/dist/assets` should now hold two JavaScript files:
the main bundle and the SQL Lab's worker. If a topic slug appears in a filename,
something is importing content from the client again.

The main bundle must **not shrink either**, and that is worth stating because it
is the thing people expect to happen and the reason the move was not about bundle
size. The topic bodies were already lazy chunks; they were never in it.

## What is in each track

The catalogue — what exists, in one line each, so you can see the shape of a
track without opening it. One section per track, in the hub's order.

Generated from the track's `index.js`, which is the only place these titles and
summaries live. If you add a topic, copy its row here too.

### Complexity

6 topics in 3 sections, in reading order. Each file is
`server/scripts/seed/learn/complexity/<slug>.js`.

**The idea** — The maths first — one page of it — and then what the notation is actually claiming.

| topic | |
|---|---|
| **Logarithms, from scratch** <br> `logarithms` | How many times can you halve n before you hit 1 — and why that is the whole idea. |
| **Big-O in plain words** <br> `big-o` | Growth, not seconds: dropping constants, O vs Ω vs Θ, best/average/worst, and amortised. |

**Counting it** — Reading a complexity off code you have never seen — the drill, one shape at a time.

| topic | |
|---|---|
| **Time complexity, counted off the code** <br> `time-complexity` | Every shape from O(1) to O(n!), each with the code that produces it, plus recursion and the traps. |
| **Space complexity** <br> `space-complexity` | Auxiliary space, the call stack you forgot to count, and trading memory for time on purpose. |

**Using it** — The two things you do with complexity in a real interview: pick the target before you start, and know the numbers.

| topic | |
|---|---|
| **Reading the constraints** <br> `from-constraints` | n ≤ 10⁵ means O(n log n). Turning the input size into a target complexity, and the target into a shortlist of techniques. |
| **The cheat sheet** <br> `cheatsheet` | Every table: data structures, sorting, Java collections, the C++ STL, JS built-ins, and the graph algorithms. |

The numbers in **The cheat sheet** are [bigocheatsheet.com](https://www.bigocheatsheet.com/)'s, which is
itself the CLRS and Wikipedia consensus, with the data-structure table split
into an average-case and a worst-case half — ten columns in one table is a
horizontal scrollbar, and the split is the more readable shape anyway. The three
language tables are ours: what a Java collection, an STL container and a JS
built-in actually cost is the part that decides whether the complexity you
reasoned about survives contact with the code, and no published cheat sheet
carries it. The thresholds in **Reading the constraints** are the
[USACO Guide](https://usaco.guide/bronze/time-comp)'s, which assume ~10⁸
operations a second.

### React

43 topics in 7 sections, in reading order. Each file is
`server/scripts/seed/learn/react/<slug>.js`.

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

**The ecosystem** — Everything a React job expects that React itself does not ship — the libraries, the types, and the tests.

| topic | |
|---|---|
| **State management** <br> `state-management` | Four kinds of state, and why most of what people put in a store does not belong there. |
| **Data fetching** <br> `data-fetching` | Server data is a cache, not state — TanStack Query, invalidation and optimistic updates. |
| **Routing** <br> `react-router` | Nested layouts, loaders that fetch before render, and keeping filters in the URL. |
| **Forms at scale** <br> `forms-at-scale` | Where controlled inputs stop scaling, and React Hook Form with a shared Zod schema. |
| **TypeScript with React** <br> `typescript-with-react` | Typing props, hooks and events without reaching for any — and why React.FC is out. |
| **Testing components** <br> `testing-react` | Testing Library, user-event and MSW — testing what a user does, not what the component holds. |
| **Performance in practice** <br> `performance-in-practice` | Profile first, then move state down, virtualise, and split the bundle — memo comes last. |
| **Rendering and Next.js** <br> `rendering-and-nextjs` | CSR, SSR, SSG, ISR, hydration and Server Components — and whether you need any of it. |

### Node.js

68 topics in 13 sections, in reading order. Each file is
`server/scripts/seed/learn/node/<slug>.js`.

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

**Production essentials** — The three things a real service needs that a tutorial API does not: a cache, somewhere to put slow work, and tests that prove it still works.

| topic | |
|---|---|
| **Redis and caching** <br> `redis` | Cache-aside, TTLs, rate limits and locks — and the three ways a cache fails under load. |
| **Queues and background jobs** <br> `queues` | Getting slow work out of the request with BullMQ — retries, backoff, idempotency and the outbox. |
| **Testing** <br> `testing` | API tests against a real database, what to mock, and the one test that catches a missing ownership check. |

### SQL

53 topics in 10 sections, in reading order. Each file is
`server/scripts/seed/learn/sql/<slug>.js`.

The odd one out in this catalogue, and deliberately: React and Node are notes
about somebody's API and Complexity is the maths under the roadmap, but this is
a **subject**. An interview asks about ER models, BCNF and isolation levels the
way it asks about graphs, so the track is written to be learned front to back
rather than referred to, and it runs theory-first — what a database is, how one
is designed and normalised, and only then the language.

**One dataset, all the way through.** `server/scripts/seed/learn/sql/sample-data.js` is
the only file in that folder which is not a topic, and it earns the exception:
six employees and four departments, defined once, used by every example in the
track. Two rows in it are load-bearing — **Radia has no `dept_id`** and
**Legal has no employees** — and they are what make the six join types return
six different results from one dataset. A reader comparing `INNER` to `LEFT`
should be comparing two results, not two worlds. `SCHEMA_SQL` in the same file
is the DDL behind them.

Every syntax topic follows the house shape with one substitution, and it is the
substitution the whole track exists for: **the tables, the query, and the result
grid underneath it.** That is what `data()` and `result()` are for — see
[The block vocabulary](#the-block-vocabulary).

**Foundations** — What a database actually is, and why nobody keeps a company in a folder of spreadsheets any more.

| topic | |
|---|---|
| **What a database is** <br> `what-is-a-database` | Data, database, DBMS — three words people use interchangeably, and the difference between them. |
| **DBMS vs a file system** <br> `dbms-vs-file-system` | Redundancy, inconsistency, concurrent writes and no crash recovery — the five problems that ended the flat file. |
| **The three-schema architecture** <br> `three-schema-architecture` | Physical, logical and view level — and the data independence the split was invented to buy. |
| **Data models** <br> `data-models` | Hierarchical, network, relational, object — what each got wrong, and why the relational model won. |

**Designing it** — From a sentence about the business to a set of tables that can hold it.

| topic | |
|---|---|
| **The ER model** <br> `er-model` | Entities and attributes: strong and weak, simple and composite, stored and derived. |
| **Relationships and cardinality** <br> `relationships-and-cardinality` | 1:1, 1:N, M:N, and the difference between total and partial participation. |
| **Turning an ER diagram into tables** <br> `er-to-tables` | The seven mapping rules, worked on one diagram — including the junction table every M:N needs. |
| **The relational model** <br> `relational-model` | Relation, tuple, attribute, domain, degree, cardinality — the words a theory question is asked in. |
| **Keys** <br> `keys` | Super, candidate, primary, alternate, composite, foreign and surrogate — seven names, and how they nest. |
| **Constraints** <br> `constraints` | NOT NULL, UNIQUE, CHECK, DEFAULT and the referential actions. |

**Normalisation** — The anomalies that come from putting everything in one table, and the forms that remove them.

| topic | |
|---|---|
| **Functional dependencies** <br> `functional-dependencies` | A → B, closure, and Armstrong's axioms — the arithmetic every normal form is defined in. |
| **1NF, 2NF and 3NF** <br> `normal-forms` | One badly-designed table, carried through all three forms, with the anomaly each one fixes named. |
| **BCNF, 4NF and lossless joins** <br> `bcnf-and-beyond` | The case 3NF lets through, and what "lossless" and "dependency-preserving" are protecting. |
| **Denormalisation** <br> `denormalisation` | Breaking the rules on purpose, and what it costs to keep the copy true. |

**The language** — The five command families, the types a column can hold, and the statements that change data.

| topic | |
|---|---|
| **SQL, and its five families** <br> `sql-overview` | DDL, DML, DQL, DCL, TCL — and which of them you can roll back. |
| **Data types** <br> `data-types` | Numbers, strings, dates and booleans — plus why money is never a FLOAT. |
| **Creating and altering tables** <br> `creating-tables` | CREATE TABLE with its constraints inline, then ALTER — and the NOT NULL column that fails in production. |
| **INSERT, UPDATE, DELETE** <br> `insert-update-delete` | Getting rows in and out, and the missing WHERE that changes every row you own. |
| **DELETE vs TRUNCATE vs DROP** <br> `delete-truncate-drop` | Three ways to remove things, compared on the four axes an interview asks about. |

**Querying** — Reading data back out, one clause at a time — and the execution order that makes the rest of it obvious.

| topic | |
|---|---|
| **How a SELECT actually runs** <br> `select-lifecycle` | You write SELECT first and the engine runs it sixth. The real order, and the five puzzles it solves. |
| **WHERE and its operators** <br> `where-and-operators` | Comparison, BETWEEN, IN, LIKE and the wildcards — and which of them an index can serve. |
| **NULL, and three-valued logic** <br> `null-handling` | NULL is unknown, and it makes every comparison a third thing. The topic behind most silent wrong answers. |
| **ORDER BY and LIMIT** <br> `order-and-limit` | Sorting, ties, where NULLs land, and paginating without skipping a row. |
| **DISTINCT and aliases** <br> `distinct-and-aliases` | Removing duplicates across the whole row, and where an alias is and is not visible. |
| **Aggregate functions** <br> `aggregate-functions` | COUNT, SUM, AVG, MIN, MAX — and the COUNT(*) vs COUNT(column) question that gets asked every time. |
| **GROUP BY and HAVING** <br> `group-by-having` | Collapsing rows into groups, filtering them afterwards, and why HAVING exists at all. |

**Joins** — Every join type on the same two tables, with the rows it returns printed underneath.

| topic | |
|---|---|
| **What a join really is** <br> `joins-overview` | Every join is a filtered cross product. The 24 rows underneath, printed once. |
| **INNER JOIN** <br> `inner-join` | Rows that matched on both sides — and the NULL keys it drops silently. |
| **LEFT and RIGHT JOIN** <br> `left-and-right-join` | Keep every row from one side, and the WHERE clause that silently cancels it. |
| **FULL OUTER and CROSS JOIN** <br> `full-and-cross-join` | Everything from both sides, everything against everything — and faking FULL OUTER in MySQL. |
| **SELF JOIN** <br> `self-join` | Joining a table to itself, for hierarchies and for comparing a row against its neighbours. |
| **UNION, INTERSECT, EXCEPT** <br> `set-operations` | Stacking result sets rather than widening them. |

**Going further** — The four things that separate a query someone can follow from a query someone can maintain.

| topic | |
|---|---|
| **Subqueries** <br> `subqueries` | Scalar, row, column and table — and the three clauses one can appear in. |
| **Correlated subqueries** <br> `correlated-subqueries` | The subquery that runs once per outer row, and the two rewrites that make it fast. |
| **EXISTS, IN, ANY and ALL** <br> `exists-in-any-all` | Four ways to ask "is it in that set", with different NULL behaviour and different costs. |
| **CTEs, including recursive ones** <br> `ctes` | WITH: naming a subquery so the query reads top to bottom — and the recursive form that walks a hierarchy. |
| **Window functions** <br> `window-functions` | Aggregate without collapsing: OVER, PARTITION BY, and ROW_NUMBER vs RANK vs DENSE_RANK. |
| **Frames, LAG and LEAD** <br> `window-frames-lag-lead` | Running totals, moving averages, and the default frame that quietly changes what SUM means. |

**Beyond the query** — The objects a real schema has that a tutorial one does not.

| topic | |
|---|---|
| **Views** <br> `views` | A stored query that behaves like a table — when it is updatable, and what a materialised view changes. |
| **Stored procedures and functions** <br> `stored-procedures-and-functions` | Code that lives in the database, and the argument about whether it should. |
| **Triggers** <br> `triggers` | Code that fires on write — for audit trails, and the reason they are easy to regret. |
| **Indexes** <br> `indexes` | The B+ tree, clustered vs non-clustered, composite indexes and the leftmost-prefix rule. |
| **Privileges and SQL injection** <br> `grants-and-injection` | GRANT and REVOKE, least privilege, and the one line of code that ends injection for good. |

**Transactions and concurrency** — What happens when two people write at the same time, worked step by step.

| topic | |
|---|---|
| **Transactions** <br> `transactions` | BEGIN, COMMIT, ROLLBACK and SAVEPOINT — the bank transfer, one statement at a time. |
| **ACID** <br> `acid` | Four letters, each with the exact thing that breaks without it, and which component provides it. |
| **Dirty, non-repeatable and phantom reads** <br> `read-phenomena` | Everything a concurrent reader can see that it should not, each as a two-session timeline. |
| **Isolation levels** <br> `isolation-levels` | Read Uncommitted to Serializable: what each allows, and what your database actually defaults to. |
| **Locks and deadlocks** <br> `locks-and-deadlocks` | Shared and exclusive locks, two-phase locking, and the deadlock two polite transactions cause. |
| **MVCC** <br> `mvcc` | How Postgres and InnoDB let readers and writers ignore each other — and why VACUUM exists. |

**Fast, and asked** — Why a query is slow, how to find out, and the questions all of it gets asked as.

| topic | |
|---|---|
| **How a query is executed** <br> `query-execution` | Parse, rewrite, plan, execute — what the optimiser chooses between, and why statistics decide it. |
| **Reading EXPLAIN** <br> `reading-explain` | A real plan line by line, in both engines, and one query taken from six seconds to a few milliseconds. |
| **What makes a query slow** <br> `query-killers` | Ten things that stop an index being used or turn one query into a thousand — each with the rewrite. |
| **The questions, and the classic queries** <br> `interview-questions` | ~90 theory questions answered in a line each, then the twelve queries asked by name. |

The dialect is **MySQL first**, because that is what LeetCode grades and what
interview questions assume. Where a difference is real the topic carries a
second tab — `code(mysql(...), postgres(...))` — rather than a paragraph about
it. Footer links go to the MySQL and PostgreSQL manuals via `mysqlDoc()` and
`pgDoc()`, and to Wikipedia for the theory topics, which have no vendor.

### Networks

35 topics in 9 sections, in reading order. Each file is
`server/scripts/seed/learn/networks/<slug>.js`.

**Written to a stated ceiling, and the ceiling is the design.** The reader is a
developer who builds applications, deploys them to AWS and sits interviews — not
someone becoming a network engineer. So there is no OSPF, no VLAN trunking, no
packet crafting, and no subnet arithmetic drilled for its own sake. Every topic
had to answer one question to get in: *does knowing this change what I would
build, debug or say out loud?* The material that only pays off with a router
console in front of you is absent on purpose, and a future addition should have
to clear the same bar.

**Section order is the path a byte takes.** Layers and addresses first, because
nothing later parses without those words; then routes and names; then transport;
then the web layer on top of all of it; then the four boxes between your users
and your server — proxies, load balancers, CDNs and the latency budget they
exist to spend; then the same ideas with AWS's names on them, which is where
this reader actually meets a route table; then debugging, and the tables worth
having in your head an hour before an interview.

**It overlaps the Node track deliberately, and the split is the side of the
socket you are on.** Node's `http-fundamentals`, `cors-and-headers` and
`sessions-and-cookies` teach you to *write the server*. These teach what the
network did before your handler ran and what it will do to your response
afterwards — and where they touch, the topic here says so in a `note`.

The two closing topics are revision rather than teaching. **The cheat sheet** is
every table in the track in one place — layers, ports, status codes, CIDR,
latency numbers, `Cache-Control`, the AWS mapping — with nothing new in it, and
**The questions, rapid fire** is forty questions answered at the length you
would actually say them out loud, grouped in the order an interview tends to
walk.

**The idea** — The vocabulary everything else is written in — the layers, what a packet is, and one end-to-end walk from a URL to a page.

| topic | |
|---|---|
| **What a network actually is** <br> `what-is-a-network` | Nodes, links and protocols; LAN, WAN and the internet; client–server against peer-to-peer. |
| **The OSI and TCP/IP models** <br> `osi-and-tcp-ip` | Seven layers, four layers, and which one a real engineer actually talks in — with a protocol on every floor. |
| **Encapsulation, and what a packet is** <br> `encapsulation` | Headers wrapped around headers: segment, packet, frame — plus MTU, fragmentation and why 1500 keeps appearing. |
| **What happens when you type a URL** <br> `url-to-page` | The whole journey in one page — cache, DNS, ARP, TCP, TLS, HTTP, render — and the version of it you say in an interview. |

**The link and the address** — How one machine is identified and how the box next to it is reached — MAC and IP, subnets, and the NAT hiding your laptop.

| topic | |
|---|---|
| **The boxes: switch, router, gateway** <br> `devices` | Hub, switch, router, gateway, NIC, access point, modem — what each one does, and at which layer. |
| **MAC addresses and ARP** <br> `mac-and-arp` | Why every machine has two addresses, and the broadcast that maps one to the other on the local wire. |
| **IP addresses** <br> `ip-addresses` | IPv4 and IPv6, public against private, loopback, link-local — and how a machine ends up with the address it has. |
| **Subnets and CIDR** <br> `subnetting-and-cidr` | Reading /24 without a calculator: masks, host counts, and splitting 10.0.0.0/16 into the subnets a VPC wants. |
| **NAT, and why your laptop is 192.168.x.x** <br> `nat-and-ports` | One public address for a whole house or a whole VPC: the translation table, port forwarding, and what NAT breaks. |

**Routes and names** — Getting a packet across the world, getting an address at all, and turning a name people can remember into one.

| topic | |
|---|---|
| **How a packet finds its way** <br> `routing` | Routing tables, the default route, hop by hop forwarding, and the two-sentence version of BGP. |
| **Joining a network: DHCP** <br> `dhcp` | The four messages that hand a device an address, a gateway and a resolver — and the lease behind them. |
| **DNS** <br> `dns` | The lookup in full — resolver, root, TLD, authoritative — every record type you will meet, TTLs, and why it is always DNS. |

**Transport: TCP and UDP** — The layer your socket actually speaks — a reliable ordered stream, or fast messages with no promises.

| topic | |
|---|---|
| **TCP vs UDP** <br> `tcp-vs-udp` | The comparison every interview opens with, and the four cases where UDP is the right answer. |
| **The TCP handshake, and closing down** <br> `tcp-handshake` | SYN, SYN-ACK, ACK; the four-way close; and what TIME_WAIT, RST and a half-open connection mean in your logs. |
| **Ports and sockets** <br> `ports-and-sockets` | The five-tuple that identifies a connection, the ports worth knowing by heart, and why one server handles 10,000 clients on port 443. |
| **Reliability, windows and congestion** <br> `reliability-and-congestion` | Sequence numbers and ACKs, the sliding window, slow start, and the head-of-line blocking that shaped HTTP/3. |

**The web layer** — The protocols your application actually speaks, from the network side: HTTP and its versions, TLS, origins, and the ways to keep a connection open.

| topic | |
|---|---|
| **HTTP, from the network side** <br> `http-basics` | The request and response on the wire, the status families, and the headers that decide how far a response travels. |
| **HTTP/1.1, HTTP/2 and HTTP/3** <br> `http-versions` | Keep-alive, multiplexing, header compression and QUIC — what each version fixed, and what it means for your frontend. |
| **HTTPS and TLS** <br> `https-and-tls` | The handshake in five steps, what a certificate proves, why the padlock is about identity as much as encryption, and where TLS is terminated. |
| **Origins, and CORS** <br> `origins-and-cors` | What an origin is, why the browser blocks the response and not the request, and how a preflight is negotiated. |
| **WebSockets, SSE and polling** <br> `websockets-and-realtime` | Four ways to push data to a browser, the upgrade handshake, and what each one costs a load balancer. |
| **The other protocols worth naming** <br> `application-protocols` | SSH, FTP and SFTP, SMTP with IMAP and POP3, NTP, SNMP, gRPC and MQTT — one line each, and their ports. |

**Delivering it at scale** — The four boxes between your users and your server in every system design answer — and the latency budget they exist to spend.

| topic | |
|---|---|
| **Forward and reverse proxies** <br> `proxies` | The same box pointed two ways, and everything a reverse proxy takes off your application: TLS, compression, rate limits, retries. |
| **Load balancers, L4 and L7** <br> `load-balancing` | Layer 4 against layer 7, the algorithms, health checks, sticky sessions, and how the load balancer itself gets balanced. |
| **CDNs, caching and the edge** <br> `cdn-and-caching` | Why a copy near the user beats a faster server, the cache headers that decide it, anycast, and how to invalidate. |
| **Latency, bandwidth and throughput** <br> `latency-and-throughput` | The four numbers people mix up, the round trips a first request really costs, and the latency table worth memorising. |
| **The network security a developer owns** <br> `network-security-basics` | Sniffing, spoofing, man-in-the-middle, DDoS and firewalls — the developer-level version, and the six defaults that cover most of it. |

**Networking in the cloud** — The same ideas with AWS names on them — which is where this reader actually meets a route table and a security group.

| topic | |
|---|---|
| **VPCs, subnets and route tables** <br> `vpc-and-subnets` | Your own private network in someone else’s data centre: the CIDR, public and private subnets, availability zones, and what makes a subnet “public”. |
| **Security groups vs NACLs** <br> `security-groups-and-nacls` | Stateful against stateless, allow-only against allow-and-deny, instance against subnet — the comparison AWS interviews ask for. |
| **The front door: Route 53, ALB, ACM, CloudFront** <br> `aws-front-door` | One request from a browser to a container, named service by service — and where the certificate lives. |
| **Connecting networks: peering, VPN, PrivateLink** <br> `connecting-networks` | Reaching another VPC, an office, or a managed service without going over the public internet — and the bastion you should not need. |

**When it breaks** — The commands that answer “where did it stop”, and the failure messages read as evidence rather than as noise.

| topic | |
|---|---|
| **The tools: ping, dig, curl, ss, tcpdump** <br> `the-tools` | Eight commands, what each one proves, and the order to reach for them in. |
| **Reading the failure** <br> `common-failures` | Connection refused, timeout, reset, DNS failure, 502 against 504 — what each one rules out, as a decision tree. |

**The interview** — The tables to have in your head an hour before, and the questions that actually get asked.

| topic | |
|---|---|
| **The cheat sheet** <br> `cheatsheet` | Every table in one place: layers, ports, status codes, protocols, record types, and the latency numbers. |
| **The questions, rapid fire** <br> `top-questions` | Forty questions with the answer said out loud in one or two lines, in the order they get asked. |
